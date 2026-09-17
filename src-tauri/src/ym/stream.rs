//! Whole-track prefetch cache and the `/{token}/ym/track/<id>` route of the
//! loopback media server.

use std::ops::Deref;

use tauri::{AppHandle, Manager, Runtime};

use super::api::{YmError, YmErrorKind};
use super::resolve::{resolve, ResolvedTrack, YmLinkCache};
use super::state::YmState;
use crate::audio_cache::{AudioCache, CachedAudio};
use crate::media_server::{forward_stream, memory_range_response, status_response};

/// mp3 320 runs ~2.4 MB/min; three tracks comfortably fit under this.
const MAX_PREFETCHED_YM_TRACKS: usize = 3;
const MAX_PREFETCHED_YM_BYTES: usize = 48 * 1024 * 1024;

/// The Yandex instance of [`AudioCache`] — a newtype because tauri manages
/// state by type, and nd and yt have their own.
pub(crate) struct YmAudioCache(AudioCache);

impl Default for YmAudioCache {
    fn default() -> Self {
        Self(AudioCache::new(
            MAX_PREFETCHED_YM_TRACKS,
            MAX_PREFETCHED_YM_BYTES,
        ))
    }
}

impl Deref for YmAudioCache {
    type Target = AudioCache;

    fn deref(&self) -> &AudioCache {
        &self.0
    }
}

/// Yandex track ids are decimal; anything else never reaches a URL.
pub(crate) fn is_track_id(id: &str) -> bool {
    !id.is_empty() && id.len() <= 20 && id.bytes().all(|b| b.is_ascii_digit())
}

/// The link for a track: cached while fresh, resolved otherwise.
pub(crate) async fn resolve_cached(
    state: &YmState,
    links: &YmLinkCache,
    client: &reqwest::Client,
    track_id: &str,
) -> Result<ResolvedTrack, YmError> {
    if let Some(link) = links.get(track_id) {
        return Ok(link);
    }
    let Some(session) = state.session() else {
        return Err(YmError::auth("not signed in to Yandex Music"));
    };
    let link = resolve(
        client,
        &state.endpoints.api,
        state.endpoints.link_scheme,
        &session,
        track_id,
    )
    .await?;
    log::info!(
        "ym resolve {track_id}: {} {} kbps{}",
        link.codec,
        link.bitrate,
        if link.preview { " (preview)" } else { "" }
    );
    links.insert(track_id, link.clone());
    Ok(link)
}

/// The prefetch itself, over explicit state so tests need no app handle.
pub(crate) async fn prefetch_track(
    state: &YmState,
    links: &YmLinkCache,
    cache: &YmAudioCache,
    client: &reqwest::Client,
    track_id: &str,
) -> Result<(), YmError> {
    if cache.contains(track_id) {
        return Ok(());
    }
    let link = resolve_cached(state, links, client, track_id).await?;
    let response = client
        .get(&link.url)
        .send()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    let status = response.status().as_u16();
    if status == 410 {
        links.invalidate(track_id);
    }
    if !(200..300).contains(&status) {
        return Err(YmError::from_status(status, "", None));
    }
    // Refuse over-cap tracks BEFORE reading the body — a whole-file download
    // that insert() then drops would waste the bandwidth every retry.
    if let Some(len) = response.content_length() {
        if len > MAX_PREFETCHED_YM_BYTES as u64 {
            return Err(YmError::unavailable(format!(
                "prefetch skipped: track is {len} bytes, over the cache cap"
            )));
        }
    }
    let bytes = response
        .bytes()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    log::debug!("ym_prefetch {track_id}: fetched {} bytes", bytes.len());
    if !cache.insert(
        track_id.to_owned(),
        content_type_for(&link).to_owned(),
        bytes,
    ) {
        return Err(YmError::unavailable(
            "prefetch skipped: track exceeds the cache cap",
        ));
    }
    Ok(())
}

/// The link host answers `application/octet-stream`; the media element wants to know it is mp3.
fn content_type_for(link: &ResolvedTrack) -> &'static str {
    if link.codec == "mp3" {
        "audio/mpeg"
    } else {
        "audio/mp4"
    }
}

/// Downloads the whole track for the next queue entry into the in-memory
/// cache. Called by the frontend while the current track plays.
#[tauri::command]
pub async fn ym_prefetch<R: Runtime>(app: AppHandle<R>, track_id: String) -> Result<(), YmError> {
    if !is_track_id(&track_id) {
        return Err(YmError::new(YmErrorKind::Unknown, "invalid track id"));
    }
    super::state::load_session_if_needed(&app);
    let client = crate::proxy::http_client(&app)?;
    prefetch_track(
        &app.state::<YmState>(),
        &app.state::<YmLinkCache>(),
        &app.state::<YmAudioCache>(),
        &client,
        &track_id,
    )
    .await
}

async fn forward_link(
    client: &reqwest::Client,
    link: &ResolvedTrack,
    range: Option<String>,
    origin: Option<&str>,
) -> Result<http::Response<crate::media_server::Body>, String> {
    let mut response = forward_stream(client, &link.url, &[], range, None, origin).await?;
    if response.status().is_success() {
        if let Ok(value) = http::HeaderValue::from_str(content_type_for(link)) {
            response
                .headers_mut()
                .insert(http::header::CONTENT_TYPE, value);
        }
    }
    Ok(response)
}

/// `/{token}/ym/track/<trackId>`: served from the prefetch cache when warm,
/// otherwise the signed link streams through. A link the host no longer
/// honours (410, or 403/404 past its lifetime) is resolved once more.
/// Upstream failures become 502; logs carry only the track id.
pub(crate) async fn serve_track(
    state: &YmState,
    links: &YmLinkCache,
    cache: &YmAudioCache,
    client: &reqwest::Client,
    track_id: &str,
    range: Option<String>,
    origin: Option<&str>,
) -> http::Response<crate::media_server::Body> {
    if !is_track_id(track_id) {
        return status_response(404, origin);
    }

    if let Some(CachedAudio {
        content_type,
        bytes,
    }) = cache.get(track_id)
    {
        return memory_range_response(&content_type, &bytes, range.as_deref(), origin);
    }

    if state.session().is_none() {
        return status_response(503, origin);
    }

    let link = match resolve_cached(state, links, client, track_id).await {
        Ok(link) => link,
        Err(e) => {
            log::warn!("media ym/track/{track_id}: resolve failed: {e}");
            return status_response(502, origin);
        }
    };
    match forward_link(client, &link, range.clone(), origin).await {
        Ok(response) if !matches!(response.status().as_u16(), 403 | 404 | 410) => {
            if response.status().as_u16() >= 400 {
                log::warn!(
                    "media ym/track/{track_id}: upstream status {}",
                    response.status()
                );
                return status_response(502, origin);
            }
            return response;
        }
        Ok(response) => log::info!(
            "media ym/track/{track_id}: upstream returned {}, resolving again",
            response.status()
        ),
        Err(e) => {
            log::warn!("media ym/track/{track_id}: {e}");
            return status_response(502, origin);
        }
    }

    links.invalidate(track_id);
    let link = match resolve_cached(state, links, client, track_id).await {
        Ok(link) => link,
        Err(e) => {
            log::warn!("media ym/track/{track_id}: re-resolve failed: {e}");
            return status_response(502, origin);
        }
    };
    match forward_link(client, &link, range, origin).await {
        Ok(response) if response.status().as_u16() < 400 => response,
        Ok(response) => {
            log::warn!(
                "media ym/track/{track_id}: upstream status {} on a fresh link",
                response.status()
            );
            status_response(502, origin)
        }
        Err(e) => {
            log::warn!("media ym/track/{track_id}: {e}");
            status_response(502, origin)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_server::test_support::spawn_upstream;
    use crate::ym::state::YmSession;
    use bytes::Bytes;
    use http_body_util::{BodyExt, Full};
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::{Arc, Mutex};

    fn direct() -> reqwest::Client {
        reqwest::Client::new()
    }

    fn signed_in(upstream: &str) -> YmState {
        let state = YmState::with_endpoints(upstream, upstream).with_link_scheme("http");
        state.set_session(Some(YmSession::new(
            42, true, "Tester", "tok-1", None, None,
        )));
        state
    }

    fn link(url: &str) -> ResolvedTrack {
        ResolvedTrack {
            url: url.into(),
            preview: false,
            codec: "mp3".into(),
            bitrate: 320,
        }
    }

    /// An upstream that resolves any track to `/audio` on itself and serves
    /// `body` there; `audio_status` decides how `/audio` answers per hit.
    async fn resolving_upstream(
        body: &'static [u8],
        audio_status: impl Fn(usize) -> u16 + Send + Sync + Clone + 'static,
    ) -> (String, Arc<AtomicUsize>) {
        let audio_hits = Arc::new(AtomicUsize::new(0));
        let hits = Arc::clone(&audio_hits);
        let base_holder: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
        let holder = Arc::clone(&base_holder);
        let upstream = spawn_upstream(move |req| {
            let base = holder.lock().expect("base").clone();
            let path = req.uri().path().to_owned();
            if path.ends_with("/download-info") {
                let json = format!(
                    r#"{{"result":[{{"codec":"mp3","bitrateInKbps":320,"preview":false,"downloadInfoUrl":"{base}/xml"}}]}}"#
                );
                return http::Response::builder().status(200).body(Full::new(Bytes::from(json))).unwrap();
            }
            if path == "/xml" {
                let host = base.trim_start_matches("http://").to_owned();
                let xml = format!("<download-info><host>{host}</host><path>/audio</path><ts>1</ts><region>-1</region><s>s</s></download-info>");
                return http::Response::builder().status(200).body(Full::new(Bytes::from(xml))).unwrap();
            }
            if path.ends_with("/audio") {
                let n = hits.fetch_add(1, Ordering::SeqCst);
                let status = audio_status(n);
                if status == 206 {
                    return http::Response::builder()
                        .status(206)
                        .header("Content-Type", "application/octet-stream")
                        .header("Content-Range", format!("bytes 0-{}/{}", body.len() - 1, body.len()))
                        .body(Full::new(Bytes::from_static(body)))
                        .unwrap();
                }
                return http::Response::builder()
                    .status(status)
                    .header("Content-Type", if status == 200 { "application/octet-stream" } else { "text/plain" })
                    .body(Full::new(if status == 200 { Bytes::from_static(body) } else { Bytes::new() }))
                    .unwrap();
            }
            panic!("unexpected request to {path}");
        })
        .await;
        *base_holder.lock().expect("base") = upstream.clone();
        (upstream, audio_hits)
    }

    #[tokio::test]
    async fn a_bad_id_is_404_and_no_session_is_503() {
        let state = YmState::with_endpoints("http://127.0.0.1:1", "http://127.0.0.1:1");
        let links = YmLinkCache::default();
        let cache = YmAudioCache::default();

        let bad = serve_track(&state, &links, &cache, &direct(), "../x", None, None).await;
        assert_eq!(bad.status(), 404);

        let signed_out = serve_track(&state, &links, &cache, &direct(), "40144", None, None).await;
        assert_eq!(signed_out.status(), 503);
    }

    #[tokio::test]
    async fn answers_ranges_from_the_prefetch_cache_before_any_network_or_session() {
        let state = YmState::with_endpoints("http://127.0.0.1:1", "http://127.0.0.1:1");
        let links = YmLinkCache::default();
        let cache = YmAudioCache::default();
        assert!(cache.insert(
            "40144".into(),
            "audio/mpeg".into(),
            Bytes::from_static(b"0123456789")
        ));

        let resp = serve_track(
            &state,
            &links,
            &cache,
            &direct(),
            "40144",
            Some("bytes=4-".into()),
            None,
        )
        .await;

        assert_eq!(resp.status(), 206);
        assert_eq!(resp.headers()["Content-Type"], "audio/mpeg");
        assert_eq!(resp.headers()["Content-Range"], "bytes 4-9/10");
        let body = resp.into_body().collect().await.expect("body").to_bytes();
        assert_eq!(body.as_ref(), b"456789");
    }

    #[tokio::test]
    async fn streams_the_signed_link_through_as_mpeg_and_caches_the_link() {
        let (upstream, audio_hits) = resolving_upstream(b"mp3body", |_| 200).await;
        let state = signed_in(&upstream);
        let links = YmLinkCache::default();
        let cache = YmAudioCache::default();

        let resp = serve_track(&state, &links, &cache, &direct(), "40144", None, None).await;

        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers()["Content-Type"], "audio/mpeg");
        let body = resp.into_body().collect().await.expect("body").to_bytes();
        assert_eq!(body.as_ref(), b"mp3body");
        assert!(
            links.get("40144").is_some(),
            "the link is kept for the next range request"
        );

        // A seek reuses the link: one more audio hit, no new resolve.
        let again = serve_track(
            &state,
            &links,
            &cache,
            &direct(),
            "40144",
            Some("bytes=0-".into()),
            None,
        )
        .await;
        assert_eq!(again.status(), 200);
        assert_eq!(audio_hits.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn a_410_from_the_link_host_resolves_once_more() {
        let (upstream, audio_hits) =
            resolving_upstream(b"mp3body", |n| if n == 0 { 410 } else { 206 }).await;
        let state = signed_in(&upstream);
        let links = YmLinkCache::default();
        links.insert("40144", link(&format!("{upstream}/audio")));
        let cache = YmAudioCache::default();

        let resp = serve_track(
            &state,
            &links,
            &cache,
            &direct(),
            "40144",
            Some("bytes=0-".into()),
            None,
        )
        .await;

        assert_eq!(resp.status(), 206);
        assert_eq!(audio_hits.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn a_link_host_that_keeps_refusing_is_502_without_a_third_try() {
        let (upstream, audio_hits) = resolving_upstream(b"", |_| 410).await;
        let state = signed_in(&upstream);
        let links = YmLinkCache::default();
        let cache = YmAudioCache::default();

        let resp = serve_track(&state, &links, &cache, &direct(), "40144", None, None).await;

        assert_eq!(resp.status(), 502);
        assert_eq!(audio_hits.load(Ordering::SeqCst), 2);
    }

    #[tokio::test]
    async fn a_failed_resolve_is_502_with_nothing_in_the_body() {
        let upstream = spawn_upstream(|_req| {
            http::Response::builder()
                .status(403)
                .body(Full::new(Bytes::new()))
                .unwrap()
        })
        .await;
        let state = signed_in(&upstream);
        let links = YmLinkCache::default();
        let cache = YmAudioCache::default();

        let resp = serve_track(&state, &links, &cache, &direct(), "40144", None, None).await;

        assert_eq!(resp.status(), 502);
        let body = resp.into_body().collect().await.expect("body").to_bytes();
        assert!(body.is_empty());
    }

    #[tokio::test]
    async fn prefetch_fills_the_cache_once_and_serves_from_it() {
        let (upstream, audio_hits) = resolving_upstream(b"mp3body", |_| 200).await;
        let state = signed_in(&upstream);
        let links = YmLinkCache::default();
        let cache = YmAudioCache::default();

        prefetch_track(&state, &links, &cache, &direct(), "40144")
            .await
            .expect("prefetch");
        prefetch_track(&state, &links, &cache, &direct(), "40144")
            .await
            .expect("second prefetch is a no-op");

        assert_eq!(audio_hits.load(Ordering::SeqCst), 1);
        let hit = cache.get("40144").expect("cached");
        assert_eq!(hit.content_type, "audio/mpeg");
        assert_eq!(hit.bytes.as_ref(), b"mp3body");
    }

    #[tokio::test]
    async fn prefetch_without_a_session_is_an_auth_error() {
        let state = YmState::with_endpoints("http://127.0.0.1:1", "http://127.0.0.1:1");

        let error = prefetch_track(
            &state,
            &YmLinkCache::default(),
            &YmAudioCache::default(),
            &direct(),
            "40144",
        )
        .await
        .unwrap_err();

        assert_eq!(error.kind, YmErrorKind::Auth);
    }

    #[test]
    fn track_ids_are_decimal() {
        assert!(is_track_id("40144"));
        assert!(!is_track_id(""));
        assert!(!is_track_id("40144:3328"));
        assert!(!is_track_id("../x"));
        assert!(!is_track_id("dQw4w9WgXcQ"));
    }
}
