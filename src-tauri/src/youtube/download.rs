//! Offline-copy downloads: `yt_download` copies the registered googlevideo
//! stream into `downloads-tmp/` through the shared `remote_download`
//! machinery, then writes the tags (lofty) the frontend knows for the track.

use std::path::Path;

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};

use lofty::config::WriteOptions;
use lofty::picture::{MimeType, Picture, PictureType};
use lofty::prelude::*;
use lofty::tag::{Tag, TagType};

use crate::remote_download::{
    fetch_to_tmp, tmp_dir, DownloadEvent, DownloadRegistry, DownloadRequest, DownloadResult,
};

use super::{http_client, is_allowed_image_host, validate_id, YtError, YtErrorKind, YtStreamCache};

/// Known-good metadata supplied by the frontend (search/playlist results), so
/// YT Music tracks get real artist/album tags.
#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YtTrackMeta {
    pub title: String,
    pub artists: Vec<String>,
    pub album: Option<String>,
    pub cover_url: Option<String>,
}

/// Registry key: the same raw id under another source is another download.
fn registry_key(id: &str) -> String {
    format!("yt:{id}")
}

/// Downloads the registered stream into `downloads-tmp/<id>.<ext>` (the
/// extension follows the upstream Content-Type: m4a for AAC, webm for Opus),
/// streaming progress over the channel, then tags an m4a in place. A
/// cancelled download removes its partial file and errors with "cancelled".
/// Logs carry only the video id.
#[tauri::command]
pub async fn yt_download<R: Runtime>(
    app: AppHandle<R>,
    id: String,
    meta: Option<YtTrackMeta>,
    on_progress: Channel<DownloadEvent>,
) -> Result<DownloadResult, YtError> {
    let id = validate_id(&id).map_err(YtError::invalid_input)?;
    let streams = app.state::<YtStreamCache>();
    let entry = streams.get(&id).ok_or_else(|| {
        YtError::new(
            YtErrorKind::NotFound,
            "stream not registered — resolve it first",
        )
    })?;

    let registry = app.state::<DownloadRegistry>();
    let slot = registry
        .register(&registry_key(&id))
        .map_err(YtError::invalid_input)?;
    let client = http_client(&app)?;
    let tmp = tmp_dir(&app)?;
    let result = fetch_to_tmp(
        &client,
        &tmp,
        DownloadRequest {
            url: &entry.url,
            headers: &entry.headers,
            file_stem: &id,
            suffix: None,
        },
        &on_progress,
        &slot.cancelled,
    )
    .await;
    drop(slot);

    let done = match result {
        Ok(done) => done,
        Err(e) if e == "cancelled" => return Err(YtError::cancelled("download cancelled")),
        Err(e) => {
            if e.starts_with("upstream status") {
                // googlevideo refused the registered URL — stale; the next
                // attempt must re-resolve rather than retry it.
                streams.remove(&id);
            }
            log::warn!("yt_download {id}: {e}");
            return Err(YtError::unknown(e));
        }
    };

    let _ = on_progress.send(DownloadEvent::Processing);
    if done.ext == "m4a" {
        // Best-effort — a tagging failure must not lose the finished download.
        if let Err(e) = embed_metadata(&app, Path::new(&done.path), &id, meta).await {
            log::warn!("yt_download {id}: tagging failed: {e}");
        }
    } else {
        log::debug!(
            "yt_download {id}: {} container, tags left to the importer",
            done.ext
        );
    }
    log::info!("yt_download {id}: done ({})", done.ext);
    Ok(done)
}

/// Flags the in-flight download as cancelled; the copy loop notices between
/// chunks. Idempotent — cancelling a finished download is a routine race.
#[tauri::command]
pub fn yt_download_cancel<R: Runtime>(app: AppHandle<R>, id: String) -> Result<(), YtError> {
    let id = validate_id(&id).map_err(YtError::invalid_input)?;
    app.state::<DownloadRegistry>().cancel(&registry_key(&id));
    Ok(())
}

/// Tags written into the downloaded file. `album` is `None` whenever no
/// source knows a real album: a stand-in (the track title, the video id)
/// would make the importer key one single-track album per download, since it
/// groups by artist + album title. Covers survive an absent album — the
/// import pipeline owns them at track level (`CoverOwnerType::Track`).
#[derive(Debug, PartialEq, Eq)]
struct TrackTags {
    title: String,
    artist: Option<String>,
    album: Option<String>,
}

impl TrackTags {
    /// Last resort when the frontend knew nothing: the id is at least a
    /// stable, searchable handle on the file.
    fn unknown(id: &str) -> Self {
        Self {
            title: id.to_owned(),
            artist: None,
            album: None,
        }
    }

    fn from_meta(meta: YtTrackMeta) -> Self {
        Self {
            artist: (!meta.artists.is_empty()).then(|| meta.artists.join(", ")),
            title: meta.title,
            album: meta.album,
        }
    }
}

/// Writes title/artist/album/cover into the downloaded m4a (MP4 ilst atoms).
/// The frontend's `meta` is the only source of tags; without it the file is
/// tagged with its id and the cover falls back to i.ytimg.com.
async fn embed_metadata<R: Runtime>(
    app: &AppHandle<R>,
    path: &Path,
    id: &str,
    meta: Option<YtTrackMeta>,
) -> Result<(), String> {
    let mut tag = Tag::new(TagType::Mp4Ilst);
    let mut cover_url: Option<String> = None;

    let tags = match meta {
        Some(mut meta) => {
            // SSRF guard: the frontend-provided URL must point at a known host.
            cover_url = meta.cover_url.take().filter(|url| {
                tauri::Url::parse(url).is_ok_and(|u| {
                    u.scheme() == "https" && u.host_str().is_some_and(is_allowed_image_host)
                })
            });
            TrackTags::from_meta(meta)
        }
        None => TrackTags::unknown(id),
    };

    tag.set_title(tags.title);
    if let Some(artist) = tags.artist {
        tag.set_artist(artist);
    }
    if let Some(album) = tags.album {
        tag.set_album(album);
    }

    if let Ok(http) = http_client(app) {
        match fetch_cover(&http, id, cover_url.as_deref()).await {
            Some((bytes, mime)) => tag.push_picture(
                Picture::unchecked(bytes)
                    .pic_type(PictureType::CoverFront)
                    .mime_type(mime)
                    .build(),
            ),
            None => log::warn!("no cover fetched for {id}; track will be tagged without artwork"),
        }
    }

    let path = path.to_path_buf();
    tokio::task::spawn_blocking(move || tag.save_to_path(&path, WriteOptions::default()))
        .await
        .map_err(|e| e.to_string())?
        .map_err(|e| e.to_string())
}

/// Fetches the cover, preferring the caller-provided (already host-validated)
/// URL over the i.ytimg fallbacks. MP4 covers only allow JPEG/PNG, so other
/// content types (lh3 serves webp without the `-rj` suffix) are skipped.
async fn fetch_cover(
    http: &reqwest::Client,
    id: &str,
    preferred: Option<&str>,
) -> Option<(Vec<u8>, MimeType)> {
    let fallbacks = ["maxresdefault", "hqdefault"]
        .map(|name| format!("https://i.ytimg.com/vi/{id}/{name}.jpg"));
    let urls = preferred.map(str::to_owned).into_iter().chain(fallbacks);

    for url in urls {
        let Ok(response) = http.get(&url).send().await else {
            continue;
        };
        if !response.status().is_success() {
            continue;
        }
        let mime = match response
            .headers()
            .get(reqwest::header::CONTENT_TYPE)
            .and_then(|v| v.to_str().ok())
        {
            Some(ct) if ct.starts_with("image/jpeg") => MimeType::Jpeg,
            Some(ct) if ct.starts_with("image/png") => MimeType::Png,
            _ => continue,
        };
        if let Ok(bytes) = response.bytes().await {
            return Some((bytes.to_vec(), mime));
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::{TrackTags, YtTrackMeta};

    fn meta(album: Option<&str>, artists: Vec<&str>) -> YtTrackMeta {
        YtTrackMeta {
            title: "Зима".into(),
            artists: artists.into_iter().map(str::to_owned).collect(),
            album: album.map(str::to_owned),
            cover_url: None,
        }
    }

    #[test]
    fn a_missing_album_stays_missing() {
        // Regression: the title used to stand in for an absent album, so a
        // batch of songs imported as one single-track album each.
        assert_eq!(
            TrackTags::from_meta(meta(None, vec!["Ранетки"])).album,
            None
        );
    }

    #[test]
    fn a_known_album_is_kept() {
        let tags = TrackTags::from_meta(meta(Some("Ранетки"), vec!["Ранетки"]));
        assert_eq!(tags.album.as_deref(), Some("Ранетки"));
        assert_eq!(tags.title, "Зима");
    }

    #[test]
    fn artists_join_into_one_tag_and_an_empty_list_is_no_artist() {
        assert_eq!(
            TrackTags::from_meta(meta(None, vec!["A", "B"]))
                .artist
                .as_deref(),
            Some("A, B"),
        );
        assert_eq!(TrackTags::from_meta(meta(None, vec![])).artist, None);
    }

    #[test]
    fn the_id_fallback_invents_no_album() {
        let tags = TrackTags::unknown("dQw4w9WgXcQ");
        assert_eq!(tags.title, "dQw4w9WgXcQ");
        assert_eq!(tags.album, None);
        assert_eq!(tags.artist, None);
    }
}
