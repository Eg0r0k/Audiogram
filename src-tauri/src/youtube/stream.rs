//! The stream registry and the `yt/<videoId>` route of the loopback media
//! server. Resolution is the webview's job; this side only forwards what was
//! registered and warms the prefetch cache.

use std::collections::HashMap;
use std::ops::Deref;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use bytes::Bytes;
use tauri::{AppHandle, Manager, Runtime};

use crate::audio_cache::{AudioCache, CachedAudio};
use crate::media_server::{forward_stream, memory_range_response, status_response};
use crate::remote_download::{content_range_total, get_range};

use super::{validate_id, YtError, YtErrorKind};

/// A registered googlevideo stream: the URL plus the request headers the
/// resolving client used. googlevideo binds URLs to that client —
/// downloading with a mismatched User-Agent gets 403 — so the headers ride
/// along with every request this side makes.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct StreamEntry {
    pub(super) url: String,
    pub(super) headers: Vec<(String, String)>,
    /// Unix seconds from the URL's `expire=` parameter; the entry is dead past it.
    expires_at: Option<u64>,
}

impl StreamEntry {
    fn is_expired(&self, now: u64) -> bool {
        self.expires_at.is_some_and(|expires_at| now >= expires_at)
    }
}

/// Video id → registered stream, filled by `yt_register_stream` and read by
/// the `yt/` route, prefetch and download. Expired entries read as absent.
#[derive(Default)]
pub struct YtStreamCache {
    entries: Mutex<HashMap<String, StreamEntry>>,
}

fn unix_now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_secs())
        .unwrap_or(0)
}

impl YtStreamCache {
    fn insert(&self, id: String, entry: StreamEntry) {
        if let Ok(mut map) = self.entries.lock() {
            map.insert(id, entry);
        }
    }

    pub(super) fn get(&self, id: &str) -> Option<StreamEntry> {
        self.get_at(id, unix_now())
    }

    fn get_at(&self, id: &str, now: u64) -> Option<StreamEntry> {
        self.entries
            .lock()
            .ok()
            .and_then(|map| map.get(id).cloned())
            .filter(|entry| !entry.is_expired(now))
    }

    /// Drops an entry upstream refused, so the next play re-resolves instead
    /// of hammering a dead URL.
    pub(super) fn remove(&self, id: &str) {
        if let Ok(mut map) = self.entries.lock() {
            map.remove(id);
        }
    }
}

/// Long uploads (2h mixes) are refused: warming them would pin hundreds of
/// MB of audio in memory for a head start streaming already provides.
const MAX_PREFETCHED_TRACKS: usize = 3;
const MAX_PREFETCHED_YT_BYTES: usize = 128 * 1024 * 1024;

/// Per-request range window for googlevideo, on the route and on every
/// whole-file walk (prefetch, download). Measured 2026-09-17 on the VISIONOS
/// URLs the engine resolves: an unranged request is throttled to ~30 KB/s,
/// an open-ended range too on a 1 h mix (0.9 MB in 30 s), while bounded
/// 10 MiB ranges — yt-dlp's chunk size — stream at full speed. A capped 206
/// + Content-Range makes the media element ask for the next window itself.
pub(crate) const YT_RANGE_SPAN: u64 = 10 * 1024 * 1024;

/// The YouTube instance of [`AudioCache`], keyed by video id — a newtype
/// because tauri manages state by type, and the nd path has its own.
pub(crate) struct YtAudioCache(AudioCache);

impl Default for YtAudioCache {
    fn default() -> Self {
        Self(AudioCache::new(
            MAX_PREFETCHED_TRACKS,
            MAX_PREFETCHED_YT_BYTES,
        ))
    }
}

impl Deref for YtAudioCache {
    type Target = AudioCache;

    fn deref(&self) -> &AudioCache {
        &self.0
    }
}

/// A googlevideo URL is a few KiB; anything past this is not one.
const MAX_STREAM_URL_LEN: usize = 16 * 1024;

/// Only googlevideo over https is ever forwarded: the route would otherwise
/// be an open proxy for whatever the webview registers.
fn validate_stream_url(url: &str) -> Result<String, String> {
    if url.len() > MAX_STREAM_URL_LEN {
        return Err("stream url too long".into());
    }
    let parsed = tauri::Url::parse(url).map_err(|_| "stream url is not a url".to_string())?;
    let host = parsed.host_str().unwrap_or_default();
    if parsed.scheme() != "https"
        || !(host == "googlevideo.com" || host.ends_with(".googlevideo.com"))
    {
        return Err("stream url must be an https googlevideo url".into());
    }
    Ok(url.to_owned())
}

/// Hop-by-hop headers reqwest must own. Accept-Encoding stays out so reqwest
/// negotiates (and transparently decodes) compression itself; Range is
/// forwarded separately per request.
fn is_forwardable_header(name: &str) -> bool {
    !matches!(
        name.to_ascii_lowercase().as_str(),
        "host" | "connection" | "content-length" | "accept-encoding" | "range"
    )
}

/// Keeps the headers googlevideo checks and guarantees a User-Agent, the one
/// header a mismatch on is fatal.
fn forwardable_headers(headers: Vec<(String, String)>) -> Vec<(String, String)> {
    let mut headers: Vec<(String, String)> = headers
        .into_iter()
        .filter(|(name, _)| is_forwardable_header(name))
        .collect();
    if !headers
        .iter()
        .any(|(name, _)| name.eq_ignore_ascii_case("user-agent"))
    {
        headers.push(("User-Agent".into(), "Mozilla/5.0".into()));
    }
    headers
}

/// Registers the stream the webview resolved for `id`. The frontend plays
/// `/{token}/yt/<id>` on the media server, which maps it back to this URL,
/// so seeks and the prefetch/download commands reuse a single resolution.
#[tauri::command]
pub fn yt_register_stream<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    url: String,
    headers: Vec<(String, String)>,
    expires_at: Option<u64>,
) -> Result<(), YtError> {
    let id = validate_id(&id).map_err(YtError::invalid_input)?;
    let url = validate_stream_url(&url).map_err(YtError::invalid_input)?;
    let entry = StreamEntry {
        url,
        headers: forwardable_headers(headers),
        expires_at,
    };
    log::debug!(
        "yt_register_stream {id}: {} request headers, expires {:?}",
        entry.headers.len(),
        entry.expires_at
    );
    app.state::<YtStreamCache>().insert(id, entry);
    Ok(())
}

fn not_registered() -> YtError {
    YtError::new(
        YtErrorKind::NotFound,
        "stream not registered — resolve it first",
    )
}

/// Downloads the whole audio file for `id` into the in-memory prefetch cache
/// so the `yt/` route answers the upcoming track's requests instantly.
/// Called by the frontend for the next queue entry while the current track
/// still plays; the entry must have been registered.
#[tauri::command]
pub async fn yt_prefetch<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), YtError> {
    let id = validate_id(&id).map_err(YtError::invalid_input)?;
    if app.state::<YtAudioCache>().contains(&id) {
        return Ok(());
    }
    let streams = app.state::<YtStreamCache>();
    let entry = streams.get(&id).ok_or_else(not_registered)?;
    let client = super::http_client(&app)?;

    let (content_type, bytes) = match fetch_ranged_bytes(&client, &entry).await {
        Ok(fetched) => fetched,
        Err(e) => {
            if e.starts_with("upstream status") {
                // googlevideo refused the registered URL: stale, drop it so
                // the next play re-resolves.
                streams.remove(&id);
                return Err(YtError::new(
                    YtErrorKind::Network,
                    format!("prefetch failed: {e}"),
                ));
            }
            return Err(YtError::from(e));
        }
    };
    log::debug!("yt_prefetch {id}: {} bytes", bytes.len());

    if !app.state::<YtAudioCache>().insert(id, content_type, bytes) {
        return Err(YtError::from(
            "prefetch skipped: track exceeds the cache cap".to_owned(),
        ));
    }
    Ok(())
}

/// Walks the whole file in [`YT_RANGE_SPAN`] ranges (see there for why not
/// one request): `(content_type, bytes)`. Over-cap tracks are refused as
/// soon as the first Content-Range reveals the total, before the bandwidth
/// is spent.
async fn fetch_ranged_bytes(
    client: &reqwest::Client,
    entry: &StreamEntry,
) -> Result<(String, Bytes), String> {
    let mut buf: Vec<u8> = Vec::new();
    let mut content_type = "audio/mp4".to_owned();
    let mut total: Option<u64> = None;

    loop {
        let start = buf.len() as u64;
        let Some(resp) =
            get_range(client, &entry.url, &entry.headers, start, YT_RANGE_SPAN).await?
        else {
            break;
        };
        let status = resp.status().as_u16();
        if start == 0 {
            if let Some(ct) = resp
                .headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
            {
                content_type = ct.to_owned();
            }
            total = if status == 200 {
                resp.content_length()
            } else {
                resp.headers()
                    .get(reqwest::header::CONTENT_RANGE)
                    .and_then(|v| v.to_str().ok())
                    .and_then(content_range_total)
            };
            if let Some(total) = total {
                if total > MAX_PREFETCHED_YT_BYTES as u64 {
                    return Err(format!(
                        "prefetch skipped: track is {total} bytes, over the cache cap"
                    ));
                }
            }
        }

        let bytes = resp
            .bytes()
            .await
            .map_err(|e| format!("download failed: {}", e.without_url()))?;
        if status == 200 {
            // The server ignored the range: the body already is the whole file.
            return Ok((content_type, bytes));
        }
        let short_chunk = (bytes.len() as u64) < YT_RANGE_SPAN;
        buf.extend_from_slice(&bytes);
        if buf.len() > MAX_PREFETCHED_YT_BYTES {
            return Err("prefetch skipped: track exceeds the cache cap".into());
        }
        let done = match total {
            Some(total) => buf.len() as u64 >= total,
            None => short_chunk,
        };
        if done || bytes.is_empty() {
            break;
        }
    }

    Ok((content_type, Bytes::from(buf)))
}

/// Handles `/{token}/yt/<videoId>`: proxied googlevideo audio, served from
/// the prefetch cache when warm, streamed through otherwise. Upstream refusing
/// the registered URL (expired after ~6 h, IP change behind a rotating proxy)
/// drops the entry and answers 502 — the media element errors, and the
/// player's retry re-resolves through the engine.
pub(crate) async fn serve_yt<R: Runtime>(
    app: &AppHandle<R>,
    client: &reqwest::Client,
    id: &str,
    range: Option<String>,
    origin: Option<&str>,
) -> http::Response<crate::media_server::Body> {
    if !crate::ids::is_plain_id(id) {
        return status_response(404, origin);
    }

    if let Some(CachedAudio {
        content_type,
        bytes,
    }) = app.state::<YtAudioCache>().get(id)
    {
        return memory_range_response(&content_type, &bytes, range.as_deref(), origin);
    }

    let streams = app.state::<YtStreamCache>();
    let Some(entry) = streams.get(id) else {
        log::info!("media yt/{id}: no registered stream (missing or expired)");
        return status_response(502, origin);
    };

    match forward_stream(
        client,
        &entry.url,
        &entry.headers,
        range,
        Some(YT_RANGE_SPAN),
        origin,
    )
    .await
    {
        Ok(response) if response.status().as_u16() >= 400 => {
            log::info!(
                "media yt/{id}: upstream status {}, dropping the registered stream",
                response.status()
            );
            streams.remove(id);
            status_response(502, origin)
        }
        Ok(response) => response,
        Err(e) => {
            log::warn!("media yt/{id}: {e}");
            status_response(502, origin)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn entry(expires_at: Option<u64>) -> StreamEntry {
        StreamEntry {
            url: "https://rr1---sn-x.googlevideo.com/videoplayback?x=1".into(),
            headers: vec![("User-Agent".into(), "ua".into())],
            expires_at,
        }
    }

    #[test]
    fn accepts_https_googlevideo_urls_only() {
        assert!(
            validate_stream_url("https://rr1---sn-x.googlevideo.com/videoplayback?x=1").is_ok()
        );
        assert!(validate_stream_url("https://googlevideo.com/v").is_ok());
        assert!(validate_stream_url("http://rr1---sn-x.googlevideo.com/v").is_err());
        assert!(validate_stream_url("https://evil.example/googlevideo.com").is_err());
        assert!(validate_stream_url("https://notgooglevideo.com/v").is_err());
        assert!(validate_stream_url("not a url").is_err());
        assert!(validate_stream_url(&format!(
            "https://a.googlevideo.com/{}",
            "x".repeat(MAX_STREAM_URL_LEN)
        ))
        .is_err());
    }

    #[test]
    fn keeps_client_headers_drops_hop_by_hop_ones_and_guarantees_a_user_agent() {
        let headers = forwardable_headers(vec![
            ("User-Agent".into(), "Mozilla/5.0 (Macintosh)".into()),
            ("Accept".into(), "*/*".into()),
            ("Host".into(), "rr1.googlevideo.com".into()),
            ("Accept-Encoding".into(), "gzip".into()),
            ("Range".into(), "bytes=0-1".into()),
        ]);

        assert_eq!(
            headers,
            vec![
                (
                    "User-Agent".to_owned(),
                    "Mozilla/5.0 (Macintosh)".to_owned()
                ),
                ("Accept".to_owned(), "*/*".to_owned()),
            ]
        );
        assert_eq!(
            forwardable_headers(Vec::new()),
            vec![("User-Agent".to_owned(), "Mozilla/5.0".to_owned())]
        );
    }

    #[test]
    fn an_expired_entry_reads_as_absent() {
        let cache = YtStreamCache::default();
        cache.insert("v1".into(), entry(Some(1_000)));
        cache.insert("v2".into(), entry(None));

        assert_eq!(cache.get_at("v1", 999), Some(entry(Some(1_000))));
        assert_eq!(cache.get_at("v1", 1_000), None);
        assert_eq!(cache.get_at("v2", u64::MAX), Some(entry(None)));

        cache.remove("v2");
        assert_eq!(cache.get_at("v2", 0), None);
    }
}
