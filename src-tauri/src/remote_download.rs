//! Offline-copy downloads shared by every remote source: one registry of
//! in-flight jobs and one streaming copy into `downloads-tmp/` with progress
//! and polled cancellation. A source's `*_download` command only builds the
//! upstream request and picks the file stem.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use tauri::ipc::Channel;
use tauri::{AppHandle, Manager, Runtime};
use tokio::io::AsyncWriteExt;

/// Where downloads land before the JS side moves the finished file into
/// offline storage via `importFile`. Orphans (crashed downloads) are swept by
/// the download manager before its first job starts.
pub const DOWNLOAD_TMP_SUBDIR: &str = "downloads-tmp";

/// Progress emitted at most every this many bytes — chunks are tiny.
const PROGRESS_EMIT_STEP: u64 = 256 * 1024;

/// In-flight downloads by `"<kind>:<id>"` — cancellation flags consumed by
/// the sources' `*_download_cancel` commands. The manager guarantees one
/// active job per track, so the branded id is the natural key (job ids stay
/// a JS concept).
#[derive(Default)]
pub struct DownloadRegistry(Mutex<HashMap<String, Arc<AtomicBool>>>);

/// A registered download. The key leaves the registry when this drops — on
/// success, error and panic alike — so no code path can leave a track stuck
/// as "already in progress".
pub struct DownloadSlot<'a> {
    registry: &'a DownloadRegistry,
    key: String,
    pub cancelled: Arc<AtomicBool>,
}

impl Drop for DownloadSlot<'_> {
    fn drop(&mut self) {
        if let Ok(mut map) = self.registry.0.lock() {
            map.remove(&self.key);
        }
    }
}

impl DownloadRegistry {
    pub fn register(&self, key: &str) -> Result<DownloadSlot<'_>, String> {
        let mut map = self.0.lock().map_err(|_| "registry poisoned".to_string())?;
        if map.contains_key(key) {
            return Err("download already in progress".into());
        }
        let cancelled = Arc::new(AtomicBool::new(false));
        map.insert(key.to_owned(), Arc::clone(&cancelled));
        Ok(DownloadSlot {
            registry: self,
            key: key.to_owned(),
            cancelled,
        })
    }

    /// Flags the download; the copy loop notices between chunks. False for
    /// an unknown key — cancelling a finished download is a routine race.
    pub fn cancel(&self, key: &str) -> bool {
        let Ok(map) = self.0.lock() else {
            return false;
        };
        match map.get(key) {
            Some(flag) => {
                flag.store(true, Ordering::SeqCst);
                true
            }
            None => false,
        }
    }
}

/// The `{ type, data }` progress events the download manager consumes,
/// source-agnostically. `Processing` marks post-copy work (yt tagging).
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "type", content = "data")]
pub enum DownloadEvent {
    Progress { downloaded: u64, total: Option<u64> },
    Processing,
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadResult {
    /// Absolute path of the finished temp file.
    pub path: String,
    /// Extension the file was written with (normalized lowercase).
    pub ext: String,
}

/// What a source hands over: the upstream request and how to name the file.
pub struct DownloadRequest<'a> {
    pub url: &'a str,
    pub headers: &'a [(String, String)],
    /// File name without extension — the raw remote id (branded ids carry a
    /// `:` Windows filenames reject).
    pub file_stem: &'a str,
    /// The source's own idea of the extension; Content-Type is the fallback.
    pub suffix: Option<&'a str>,
}

pub fn tmp_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(DOWNLOAD_TMP_SUBDIR))
}

fn ext_from_content_type(content_type: &str) -> Option<&'static str> {
    match content_type.split(';').next().unwrap_or("").trim() {
        "audio/flac" | "audio/x-flac" => Some("flac"),
        "audio/mpeg" => Some("mp3"),
        "audio/mp4" | "audio/m4a" | "audio/x-m4a" => Some("m4a"),
        "audio/webm" => Some("webm"),
        "audio/ogg" | "application/ogg" => Some("ogg"),
        "audio/opus" => Some("opus"),
        "audio/wav" | "audio/x-wav" => Some("wav"),
        "audio/aac" => Some("aac"),
        _ => None,
    }
}

fn normalized_suffix(suffix: Option<&str>) -> Option<String> {
    let s = suffix?.trim().to_ascii_lowercase();
    if s.is_empty() || s.len() > 8 || !s.chars().all(|c| c.is_ascii_alphanumeric()) {
        return None;
    }
    Some(s)
}

/// Streams the whole upstream file into `<tmp_dir>/<file_stem>.<ext>` in
/// one request, reporting progress over the channel. Cancellation is polled
/// between chunks; a cancelled download removes its partial file and errors
/// with "cancelled". Errors never embed the URL (nd URLs carry auth tokens).
pub async fn fetch_to_tmp(
    client: &reqwest::Client,
    tmp_dir: &Path,
    req: DownloadRequest<'_>,
    on_progress: &Channel<DownloadEvent>,
    cancelled: &AtomicBool,
) -> Result<DownloadResult, String> {
    let mut resp = send_get(client, req.url, req.headers, None).await?;
    let status = resp.status().as_u16();
    if status != 200 {
        return Err(format!("upstream status {status}"));
    }
    let ext = ext_for(&req, &resp);
    let total = resp.content_length();
    let (path, mut file) = create_target(tmp_dir, req.file_stem, &ext).await?;
    let written = copy_body(&mut resp, &mut file, on_progress, cancelled, 0, total).await;
    finish(path, ext, file, written, on_progress).await
}

/// Like [`fetch_to_tmp`], but walks the file in `span`-byte Range requests.
/// googlevideo throttles an unranged or open-ended request on a long stream
/// to ~30 KB/s while bounded ranges come at full speed — measured 2026-09-17
/// on a 1 h mix: `bytes=0-` gave 0.9 MB in 30 s, 10 MiB ranges 2–3 s each.
pub async fn fetch_to_tmp_ranged(
    client: &reqwest::Client,
    tmp_dir: &Path,
    req: DownloadRequest<'_>,
    span: u64,
    on_progress: &Channel<DownloadEvent>,
    cancelled: &AtomicBool,
) -> Result<DownloadResult, String> {
    let mut target: Option<(PathBuf, tokio::fs::File, String)> = None;
    let mut total: Option<u64> = None;
    let mut start: u64 = 0;

    let outcome: Result<u64, String> = async {
        loop {
            if cancelled.load(Ordering::SeqCst) {
                return Err("cancelled".into());
            }
            let Some(mut resp) = get_range(client, req.url, req.headers, start, span).await? else {
                break;
            };
            let status = resp.status().as_u16();
            if target.is_none() {
                total = if status == 200 {
                    resp.content_length()
                } else {
                    resp.headers()
                        .get(reqwest::header::CONTENT_RANGE)
                        .and_then(|v| v.to_str().ok())
                        .and_then(content_range_total)
                };
                let ext = ext_for(&req, &resp);
                let (path, file) = create_target(tmp_dir, req.file_stem, &ext).await?;
                target = Some((path, file, ext));
            }
            let (_, file, _) = target.as_mut().expect("target created above");
            let written = copy_body(&mut resp, file, on_progress, cancelled, start, total).await?;
            start += written;
            // A 200 means the server ignored the range and sent everything;
            // a short chunk means it ran out before the span did.
            if status == 200 || written < span || total.is_some_and(|total| start >= total) {
                break;
            }
        }
        Ok(start)
    }
    .await;

    let Some((path, file, ext)) = target else {
        return Err(outcome
            .err()
            .unwrap_or_else(|| "upstream served no data".into()));
    };
    finish(path, ext, file, outcome, on_progress).await
}

/// GET `url` with the source's headers and an optional Range. Errors never
/// embed the URL.
async fn send_get(
    client: &reqwest::Client,
    url: &str,
    headers: &[(String, String)],
    range: Option<String>,
) -> Result<reqwest::Response, String> {
    let mut request = client.get(url);
    for (name, value) in headers {
        request = request.header(name.as_str(), value.as_str());
    }
    if let Some(range) = range {
        request = request.header(reqwest::header::RANGE, range);
    }
    request
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e.without_url()))
}

/// GETs `bytes=start-(start+span-1)`. `Ok(None)` when the server answers
/// 416 (one past the end of a total-less file); other 4xx/5xx are errors.
pub(crate) async fn get_range(
    client: &reqwest::Client,
    url: &str,
    headers: &[(String, String)],
    start: u64,
    span: u64,
) -> Result<Option<reqwest::Response>, String> {
    let range = format!("bytes={start}-{}", start + span - 1);
    let resp = send_get(client, url, headers, Some(range)).await?;
    match resp.status().as_u16() {
        416 => Ok(None),
        status if status >= 400 => Err(format!("upstream status {status}")),
        _ => Ok(Some(resp)),
    }
}

/// Total size from a `Content-Range: bytes X-Y/total` value; None for `*`.
pub(crate) fn content_range_total(value: &str) -> Option<u64> {
    value.rsplit('/').next()?.trim().parse().ok()
}

fn ext_for(req: &DownloadRequest<'_>, resp: &reqwest::Response) -> String {
    normalized_suffix(req.suffix)
        .or_else(|| {
            resp.headers()
                .get(reqwest::header::CONTENT_TYPE)
                .and_then(|v| v.to_str().ok())
                .and_then(ext_from_content_type)
                .map(str::to_owned)
        })
        .unwrap_or_else(|| "bin".to_owned())
}

async fn create_target(
    tmp_dir: &Path,
    file_stem: &str,
    ext: &str,
) -> Result<(PathBuf, tokio::fs::File), String> {
    tokio::fs::create_dir_all(tmp_dir)
        .await
        .map_err(|e| e.to_string())?;
    let path = tmp_dir.join(format!("{file_stem}.{ext}"));
    let file = tokio::fs::File::create(&path)
        .await
        .map_err(|e| e.to_string())?;
    Ok((path, file))
}

/// Closes the file and either reports the finished download or removes the
/// partial file — whatever stopped the copy (cancellation, a dropped
/// connection, a full disk), a half-written file must never survive.
async fn finish(
    path: PathBuf,
    ext: String,
    file: tokio::fs::File,
    written: Result<u64, String>,
    on_progress: &Channel<DownloadEvent>,
) -> Result<DownloadResult, String> {
    // Waits for the blocking pool's in-flight write and closes the handle —
    // Windows refuses to delete a file that is still open.
    drop(file.into_std().await);

    let downloaded = match written {
        Ok(downloaded) => downloaded,
        Err(e) => {
            let _ = tokio::fs::remove_file(&path).await;
            return Err(e);
        }
    };

    let _ = on_progress.send(DownloadEvent::Progress {
        downloaded,
        total: Some(downloaded),
    });
    Ok(DownloadResult {
        path: path.to_string_lossy().into_owned(),
        ext,
    })
}

/// Streams the response body into `file`, polling `cancelled` between
/// chunks; returns the bytes this call wrote, reporting `offset + written`
/// so a ranged walk shows one growing number. Async fs on purpose: a 250 MB
/// FLAC landing on a slow disk through `std::fs` would pin a runtime worker
/// for seconds — the same runtime the loopback media server answers the
/// player from.
async fn copy_body(
    resp: &mut reqwest::Response,
    file: &mut tokio::fs::File,
    on_progress: &Channel<DownloadEvent>,
    cancelled: &AtomicBool,
    offset: u64,
    total: Option<u64>,
) -> Result<u64, String> {
    let mut written: u64 = 0;
    let mut last_emitted: u64 = 0;

    loop {
        if cancelled.load(Ordering::SeqCst) {
            return Err("cancelled".into());
        }
        let chunk = match resp.chunk().await {
            Ok(Some(chunk)) => chunk,
            Ok(None) => break,
            Err(e) => return Err(format!("download failed: {}", e.without_url())),
        };
        file.write_all(&chunk).await.map_err(|e| e.to_string())?;
        written += chunk.len() as u64;
        if written - last_emitted >= PROGRESS_EMIT_STEP {
            last_emitted = written;
            let _ = on_progress.send(DownloadEvent::Progress {
                downloaded: offset + written,
                total,
            });
        }
    }

    file.flush().await.map_err(|e| e.to_string())?;
    Ok(written)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_server::test_support::spawn_upstream;
    use tauri::ipc::InvokeResponseBody;

    fn test_tmp_dir() -> PathBuf {
        std::env::temp_dir().join(format!(
            "remote-download-test-{}",
            crate::media_server::new_token()
        ))
    }

    /// A channel that collects every progress event as JSON.
    fn collecting_channel() -> (Channel<DownloadEvent>, Arc<Mutex<Vec<String>>>) {
        let seen = Arc::new(Mutex::new(Vec::new()));
        let sink = Arc::clone(&seen);
        let channel = Channel::new(move |body| {
            if let InvokeResponseBody::Json(json) = body {
                sink.lock().expect("sink").push(json);
            }
            Ok(())
        });
        (channel, seen)
    }

    #[test]
    fn a_slot_blocks_a_second_download_of_the_same_key_until_dropped() {
        let registry = DownloadRegistry::default();

        let slot = registry.register("nd:s1").expect("first registration");
        assert!(registry.register("nd:s1").is_err());
        assert!(registry.register("nd:s2").is_ok());
        // Same raw id under another source is another download.
        assert!(registry.register("ym:s1").is_ok());

        drop(slot);
        assert!(registry.register("nd:s1").is_ok());
    }

    #[test]
    fn cancel_flips_the_slot_flag_and_reports_unknown_keys() {
        let registry = DownloadRegistry::default();
        let slot = registry.register("nd:s1").expect("registration");

        assert!(registry.cancel("nd:s1"));
        assert!(slot.cancelled.load(Ordering::SeqCst));
        assert!(!registry.cancel("nd:nope"));
    }

    #[test]
    fn ext_falls_back_from_suffix_to_content_type() {
        assert_eq!(normalized_suffix(Some(" FLAC ")).as_deref(), Some("flac"));
        assert_eq!(normalized_suffix(Some("way-too-long")), None);
        assert_eq!(normalized_suffix(Some("../x")), None);
        assert_eq!(normalized_suffix(None), None);
        assert_eq!(
            ext_from_content_type("audio/flac; charset=binary"),
            Some("flac")
        );
        assert_eq!(ext_from_content_type("text/html"), None);
    }

    #[tokio::test]
    async fn streams_the_file_with_progress_and_names_it_by_stem_and_content_type() {
        let body: Vec<u8> = (0..(600 * 1024)).map(|i| (i % 251) as u8).collect();
        let served = body.clone();
        let upstream = spawn_upstream(move |req| {
            assert_eq!(req.headers()["X-Auth"], "secret");
            http::Response::builder()
                .status(200)
                .header("Content-Type", "audio/mpeg")
                .header("Content-Length", served.len())
                .body(http_body_util::Full::new(bytes::Bytes::from(
                    served.clone(),
                )))
                .expect("upstream response")
        })
        .await;
        let tmp = test_tmp_dir();
        let (channel, seen) = collecting_channel();

        let result = fetch_to_tmp(
            &reqwest::Client::new(),
            &tmp,
            DownloadRequest {
                url: &format!("{upstream}/track"),
                headers: &[("X-Auth".into(), "secret".into())],
                file_stem: "40144",
                suffix: None,
            },
            &channel,
            &AtomicBool::new(false),
        )
        .await
        .expect("download");

        assert_eq!(result.ext, "mp3");
        assert_eq!(
            Path::new(&result.path).file_name().and_then(|n| n.to_str()),
            Some("40144.mp3")
        );
        assert_eq!(std::fs::read(&result.path).expect("file"), body);

        let events = seen.lock().expect("events").clone();
        assert!(
            events.len() >= 2,
            "progress every 256 KiB plus the final one: {events:?}"
        );
        let last: serde_json::Value =
            serde_json::from_str(events.last().expect("final")).expect("json");
        assert_eq!(last["type"], "progress");
        assert_eq!(last["data"]["downloaded"], body.len());
        assert_eq!(last["data"]["total"], body.len());

        let _ = std::fs::remove_dir_all(tmp);
    }

    #[tokio::test]
    async fn a_cancelled_download_leaves_no_partial_file_and_reports_cancelled() {
        let upstream = spawn_upstream(|_req| {
            http::Response::builder()
                .status(200)
                .header("Content-Type", "audio/flac")
                .body(http_body_util::Full::new(bytes::Bytes::from_static(
                    b"flacbody",
                )))
                .expect("upstream response")
        })
        .await;
        let tmp = test_tmp_dir();
        let (channel, _seen) = collecting_channel();

        let result = fetch_to_tmp(
            &reqwest::Client::new(),
            &tmp,
            DownloadRequest {
                url: &upstream,
                headers: &[],
                file_stem: "s1",
                suffix: Some("flac"),
            },
            &channel,
            &AtomicBool::new(true),
        )
        .await;

        assert_eq!(result.unwrap_err(), "cancelled");
        assert!(
            !tmp.join("s1.flac").exists(),
            "partial file must be removed"
        );

        let _ = std::fs::remove_dir_all(tmp);
    }

    #[tokio::test]
    async fn an_upstream_error_is_reported_before_any_file_is_created() {
        let upstream = spawn_upstream(|_req| {
            http::Response::builder()
                .status(403)
                .body(http_body_util::Full::new(bytes::Bytes::new()))
                .expect("upstream response")
        })
        .await;
        let tmp = test_tmp_dir();
        let (channel, seen) = collecting_channel();

        let result = fetch_to_tmp(
            &reqwest::Client::new(),
            &tmp,
            DownloadRequest {
                url: &upstream,
                headers: &[],
                file_stem: "s1",
                suffix: Some("flac"),
            },
            &channel,
            &AtomicBool::new(false),
        )
        .await;

        assert_eq!(result.unwrap_err(), "upstream status 403");
        assert!(!tmp.exists());
        assert!(seen.lock().expect("events").is_empty());
    }

    /// An upstream that honours `Range` over `body`, like googlevideo:
    /// 206 + Content-Range for a slice, 416 past the end.
    async fn spawn_range_upstream(body: Vec<u8>) -> String {
        spawn_upstream(move |req| {
            let len = body.len() as u64;
            let range = req
                .headers()
                .get("range")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.strip_prefix("bytes="))
                .and_then(|v| v.split_once('-'))
                .and_then(|(a, b)| Some((a.parse::<u64>().ok()?, b.parse::<u64>().ok()?)));
            match range {
                Some((start, _)) if start >= len => http::Response::builder()
                    .status(416)
                    .body(http_body_util::Full::new(bytes::Bytes::new()))
                    .expect("416"),
                Some((start, end)) => {
                    let end = end.min(len - 1);
                    http::Response::builder()
                        .status(206)
                        .header("Content-Type", "audio/mp4")
                        .header("Content-Range", format!("bytes {start}-{end}/{len}"))
                        .body(http_body_util::Full::new(bytes::Bytes::copy_from_slice(
                            &body[start as usize..=end as usize],
                        )))
                        .expect("206")
                }
                None => http::Response::builder()
                    .status(200)
                    .header("Content-Type", "audio/mp4")
                    .body(http_body_util::Full::new(bytes::Bytes::from(body.clone())))
                    .expect("200"),
            }
        })
        .await
    }

    #[test]
    fn parses_the_total_out_of_content_range() {
        assert_eq!(
            content_range_total("bytes 0-1048575/157286400"),
            Some(157_286_400)
        );
        assert_eq!(content_range_total("bytes 0-1023/*"), None);
        assert_eq!(content_range_total("garbage"), None);
    }

    #[tokio::test]
    async fn a_ranged_walk_reassembles_the_file_with_cumulative_progress() {
        let body: Vec<u8> = (0..2_500_000u32).map(|i| (i % 253) as u8).collect();
        let upstream = spawn_range_upstream(body.clone()).await;
        let tmp = test_tmp_dir();
        let (channel, seen) = collecting_channel();

        let result = fetch_to_tmp_ranged(
            &reqwest::Client::new(),
            &tmp,
            DownloadRequest {
                url: &format!("{upstream}/videoplayback"),
                headers: &[],
                file_stem: "v1",
                suffix: None,
            },
            1024 * 1024,
            &channel,
            &AtomicBool::new(false),
        )
        .await
        .expect("download");

        assert_eq!(result.ext, "m4a");
        assert_eq!(std::fs::read(&result.path).expect("file"), body);

        let events: Vec<serde_json::Value> = seen
            .lock()
            .expect("events")
            .iter()
            .map(|json| serde_json::from_str(json).expect("json"))
            .collect();
        let downloaded: Vec<u64> = events
            .iter()
            .map(|e| e["data"]["downloaded"].as_u64().unwrap())
            .collect();
        assert!(
            downloaded.windows(2).all(|pair| pair[0] <= pair[1]),
            "monotonic: {downloaded:?}"
        );
        assert_eq!(downloaded.last(), Some(&(body.len() as u64)));
        assert_eq!(events[0]["data"]["total"], body.len());

        let _ = std::fs::remove_dir_all(tmp);
    }

    #[tokio::test]
    async fn a_ranged_walk_accepts_a_server_that_ignores_the_range() {
        let body = b"whole file at once".to_vec();
        let served = body.clone();
        let upstream = spawn_upstream(move |_req| {
            http::Response::builder()
                .status(200)
                .header("Content-Type", "audio/webm")
                .body(http_body_util::Full::new(bytes::Bytes::from(
                    served.clone(),
                )))
                .expect("200")
        })
        .await;
        let tmp = test_tmp_dir();
        let (channel, _seen) = collecting_channel();

        let result = fetch_to_tmp_ranged(
            &reqwest::Client::new(),
            &tmp,
            DownloadRequest {
                url: &upstream,
                headers: &[],
                file_stem: "v1",
                suffix: None,
            },
            4,
            &channel,
            &AtomicBool::new(false),
        )
        .await
        .expect("download");

        assert_eq!(result.ext, "webm");
        assert_eq!(std::fs::read(&result.path).expect("file"), body);
        let _ = std::fs::remove_dir_all(tmp);
    }

    #[tokio::test]
    async fn a_refused_range_fails_the_walk_and_leaves_no_file() {
        let upstream = spawn_upstream(|_req| {
            http::Response::builder()
                .status(403)
                .body(http_body_util::Full::new(bytes::Bytes::new()))
                .expect("403")
        })
        .await;
        let tmp = test_tmp_dir();
        let (channel, _seen) = collecting_channel();

        let result = fetch_to_tmp_ranged(
            &reqwest::Client::new(),
            &tmp,
            DownloadRequest {
                url: &upstream,
                headers: &[],
                file_stem: "v1",
                suffix: None,
            },
            1024,
            &channel,
            &AtomicBool::new(false),
        )
        .await;

        assert_eq!(result.unwrap_err(), "upstream status 403");
        assert!(!tmp.exists());
    }
}
