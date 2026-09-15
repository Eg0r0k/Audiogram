//! Offline-copy downloads: `nd_download` streams the original file into the
//! temp dir through the shared `remote_download` machinery.

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};

use super::config::NdState;
use crate::remote_download::{
    fetch_to_tmp, tmp_dir, DownloadEvent, DownloadRegistry, DownloadRequest, DownloadResult,
};

/// Registry key: the same raw id under another source is another download.
fn registry_key(song_id: &str) -> String {
    format!("nd:{song_id}")
}

/// Downloads the whole original file (`stream.view?format=raw`) into
/// `downloads-tmp/<songId>.<ext>`, streaming progress over the channel. A
/// cancelled download removes its partial file and errors with "cancelled".
/// Logs carry only the song id.
#[tauri::command]
pub async fn nd_download<R: Runtime>(
    app: AppHandle<R>,
    song_id: String,
    suffix: Option<String>,
    on_progress: Channel<DownloadEvent>,
) -> Result<DownloadResult, String> {
    if !crate::ids::is_plain_id(&song_id) {
        return Err("invalid song id".into());
    }
    let Some(config) = app.state::<NdState>().get() else {
        return Err("nd source is not configured".into());
    };

    let registry = app.state::<DownloadRegistry>();
    let slot = registry.register(&registry_key(&song_id))?;
    let url = config.rest_url("stream.view", &song_id, "&format=raw");
    let client = crate::proxy::http_client(&app)?;
    let tmp = tmp_dir(&app)?;
    let result = fetch_to_tmp(
        &client,
        &tmp,
        DownloadRequest {
            url: &url,
            headers: &[],
            file_stem: &song_id,
            suffix: suffix.as_deref(),
        },
        &on_progress,
        &slot.cancelled,
    )
    .await;
    drop(slot);

    match &result {
        Ok(done) => log::info!("nd_download {song_id}: done ({})", done.ext),
        // A cancel is the user's own doing — nothing to report.
        Err(e) if e == "cancelled" => {}
        Err(e) => log::warn!("nd_download {song_id}: {e}"),
    }
    result
}

/// Flags the in-flight download as cancelled; the download loop notices
/// between chunks. Idempotent — cancelling a download that already finished
/// (a routine race with the completion event) is a no-op.
#[tauri::command]
pub fn nd_download_cancel<R: Runtime>(app: AppHandle<R>, song_id: String) {
    app.state::<DownloadRegistry>()
        .cancel(&registry_key(&song_id));
}
