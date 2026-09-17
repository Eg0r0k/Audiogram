//! Offline copies: `ym_download` resolves the track and streams the mp3
//! into the temp dir through the shared `remote_download` machinery.

use std::path::Path;

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};

use super::api::{YmError, YmErrorKind};
use super::resolve::YmLinkCache;
use super::state::YmState;
use super::stream::{is_track_id, resolve_cached};
use crate::remote_download::{
    fetch_to_tmp, tmp_dir, DownloadEvent, DownloadRegistry, DownloadRequest, DownloadResult,
};

/// Registry key: the same raw id under another source is another download.
fn registry_key(track_id: &str) -> String {
    format!("ym:{track_id}")
}

/// The download over explicit state so tests need no app handle. What the
/// account is entitled to is whatever `download-info` offers for the track:
/// a 30-second preview is refused, a whole track is saved. (The account's
/// Plus flag is not consulted — it is false for family members who do get
/// whole tracks.)
pub(crate) async fn download_track(
    state: &YmState,
    links: &YmLinkCache,
    registry: &DownloadRegistry,
    client: &reqwest::Client,
    tmp: &Path,
    track_id: &str,
    on_progress: &Channel<DownloadEvent>,
) -> Result<DownloadResult, YmError> {
    if state.session().is_none() {
        return Err(YmError::auth("not signed in to Yandex Music"));
    }
    let slot = registry.register(&registry_key(track_id))?;

    let link = resolve_cached(state, links, client, track_id).await?;
    if link.preview {
        return Err(YmError::new(
            YmErrorKind::Forbidden,
            "Yandex offers only a preview of this track",
        ));
    }

    let result = fetch_to_tmp(
        client,
        tmp,
        DownloadRequest {
            url: &link.url,
            headers: &[],
            file_stem: track_id,
            suffix: Some(&link.codec),
        },
        on_progress,
        &slot.cancelled,
    )
    .await;
    drop(slot);

    result.map_err(|e| {
        if e == "cancelled" {
            YmError::new(YmErrorKind::Cancelled, e)
        } else {
            YmError::network(e)
        }
    })
}

/// Downloads the whole mp3 into `downloads-tmp/<trackId>.mp3`, streaming
/// progress over the channel. A cancelled download removes its partial file
/// and fails with kind CANCELLED. Logs carry only the track id.
#[tauri::command]
pub async fn ym_download<R: Runtime>(
    app: AppHandle<R>,
    track_id: String,
    on_progress: Channel<DownloadEvent>,
) -> Result<DownloadResult, YmError> {
    if !is_track_id(&track_id) {
        return Err(YmError::new(YmErrorKind::Unknown, "invalid track id"));
    }
    super::state::load_session_if_needed(&app);
    let client = crate::proxy::http_client(&app)?;
    let tmp = tmp_dir(&app)?;
    let result = download_track(
        &app.state::<YmState>(),
        &app.state::<YmLinkCache>(),
        &app.state::<DownloadRegistry>(),
        &client,
        &tmp,
        &track_id,
        &on_progress,
    )
    .await;

    match &result {
        Ok(done) => log::info!("ym_download {track_id}: done ({})", done.ext),
        // A cancel is the user's own doing — nothing to report.
        Err(e) if e.kind == YmErrorKind::Cancelled => {}
        Err(e) => log::warn!("ym_download {track_id}: {e}"),
    }
    result
}

/// Flags the in-flight download as cancelled; the download loop notices
/// between chunks. Idempotent — cancelling a download that already finished
/// (a routine race with the completion event) is a no-op.
#[tauri::command]
pub fn ym_download_cancel<R: Runtime>(app: AppHandle<R>, track_id: String) {
    app.state::<DownloadRegistry>()
        .cancel(&registry_key(&track_id));
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_server::test_support::spawn_upstream;
    use crate::ym::resolve::ResolvedTrack;
    use crate::ym::state::YmSession;
    use http_body_util::Full;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use tauri::ipc::InvokeResponseBody;

    fn state_with(upstream: &str, has_plus: bool) -> YmState {
        let state = YmState::with_endpoints(upstream, upstream).with_link_scheme("http");
        state.set_session(Some(YmSession::new(42, has_plus, "Tester", "tok-1", None, None)));
        state
    }

    fn silent_channel() -> Channel<DownloadEvent> {
        Channel::new(|_body: InvokeResponseBody| Ok(()))
    }

    /// One directory per call: the tests share the stem "40144" and run in
    /// parallel, so a per-process directory let one test's cleanup or
    /// `File::create` clobber another's file.
    fn temp() -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "ym-download-test-{}",
            crate::media_server::new_token()
        ))
    }

    #[tokio::test]
    async fn without_a_session_nothing_is_requested() {
        let hits = Arc::new(AtomicUsize::new(0));
        let seen = Arc::clone(&hits);
        let upstream = spawn_upstream(move |_req| {
            seen.fetch_add(1, Ordering::SeqCst);
            http::Response::builder().status(200).body(Full::new(bytes::Bytes::new())).unwrap()
        })
        .await;
        let state = YmState::with_endpoints(&upstream, &upstream);

        let error = download_track(
            &state, &YmLinkCache::default(), &DownloadRegistry::default(),
            &reqwest::Client::new(), &temp(), "40144", &silent_channel(),
        )
        .await
        .unwrap_err();

        assert_eq!(error.kind, YmErrorKind::Auth);
        assert_eq!(hits.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn a_whole_track_downloads_even_when_the_plus_flag_is_off() {
        // The signed-in family member: hasPlus false, download-info not a preview.
        let upstream = spawn_upstream(|_req| {
            http::Response::builder()
                .status(200)
                .header("Content-Type", "application/octet-stream")
                .body(Full::new(bytes::Bytes::from_static(b"mp3body")))
                .unwrap()
        })
        .await;
        let state = state_with(&upstream, false);
        let links = YmLinkCache::default();
        links.insert("40144", ResolvedTrack {
            url: format!("{upstream}/full.mp3"),
            preview: false,
            codec: "mp3".into(),
            bitrate: 192,
        });
        let tmp = temp();

        let done = download_track(
            &state, &links, &DownloadRegistry::default(),
            &reqwest::Client::new(), &tmp, "40144", &silent_channel(),
        )
        .await
        .expect("download");

        assert_eq!(done.ext, "mp3");
        let _ = std::fs::remove_dir_all(tmp);
    }

    #[tokio::test]
    async fn a_preview_link_is_refused_rather_than_saved() {
        let upstream = spawn_upstream(|_req| {
            http::Response::builder().status(200).body(Full::new(bytes::Bytes::new())).unwrap()
        })
        .await;
        let state = state_with(&upstream, true);
        let links = YmLinkCache::default();
        links.insert("40144", ResolvedTrack {
            url: format!("{upstream}/preview.mp3"),
            preview: true,
            codec: "mp3".into(),
            bitrate: 128,
        });

        let error = download_track(
            &state, &links, &DownloadRegistry::default(),
            &reqwest::Client::new(), &temp(), "40144", &silent_channel(),
        )
        .await
        .unwrap_err();

        assert_eq!(error.kind, YmErrorKind::Forbidden);
    }

    #[tokio::test]
    async fn a_full_track_lands_in_the_tmp_dir_as_mp3_under_its_id() {
        let upstream = spawn_upstream(|req| {
            assert_eq!(req.uri().path(), "/full.mp3");
            http::Response::builder()
                .status(200)
                .header("Content-Type", "application/octet-stream")
                .body(Full::new(bytes::Bytes::from_static(b"mp3body")))
                .unwrap()
        })
        .await;
        let state = state_with(&upstream, true);
        let links = YmLinkCache::default();
        links.insert("40144", ResolvedTrack {
            url: format!("{upstream}/full.mp3"),
            preview: false,
            codec: "mp3".into(),
            bitrate: 320,
        });
        let tmp = temp();

        let done = download_track(
            &state, &links, &DownloadRegistry::default(),
            &reqwest::Client::new(), &tmp, "40144", &silent_channel(),
        )
        .await
        .expect("download");

        assert_eq!(done.ext, "mp3");
        assert!(done.path.ends_with("40144.mp3"));
        assert_eq!(std::fs::read(&done.path).expect("file"), b"mp3body");
        let _ = std::fs::remove_dir_all(tmp);
    }

    #[tokio::test]
    async fn a_second_download_of_the_same_track_is_refused_while_the_first_runs() {
        let state = state_with("http://127.0.0.1:1", true);
        let registry = DownloadRegistry::default();
        let _running = registry.register("ym:40144").expect("first");

        let error = download_track(
            &state, &YmLinkCache::default(), &registry,
            &reqwest::Client::new(), &temp(), "40144", &silent_channel(),
        )
        .await
        .unwrap_err();

        assert_eq!(error.message, "download already in progress");
    }
}
