//! `local/<abs path>`: streams a local file (or its transcoded rendition)
//! honoring Range.

use http_body_util::{BodyExt, StreamBody};

use super::primitives::{
    audio_base, empty_body, is_safe_abs_path, mime_for_path, resolve_range, status_response,
    RangeOutcome,
};
use super::Body;

/// Body that streams `len` bytes of an already-positioned file in 64 KiB
/// chunks — the full file is never in memory on any platform.
fn file_stream_body(file: tokio::fs::File, len: u64) -> Body {
    use futures_util::TryStreamExt;
    let reader = tokio::io::AsyncReadExt::take(file, len);
    let stream = tokio_util::io::ReaderStream::with_capacity(reader, 64 * 1024);
    StreamBody::new(stream.map_ok(hyper::body::Frame::data)).boxed()
}

/// `local/<abs path>`: opens the file, seeks to the requested range and
/// streams the span. ALAC-in-mp4 sources (undecodable by any Chromium
/// webview) are transparently swapped for their cached WAV rendition —
/// the response then carries `audio/wav` and ranges resolve against it.
pub(super) async fn serve_local(
    path: &str,
    range: Option<&str>,
    origin: Option<&str>,
    transcode_cache: Option<&std::path::Path>,
) -> http::Response<Body> {
    if !is_safe_abs_path(path) {
        return status_response(403, origin);
    }

    let mut path = std::borrow::Cow::Borrowed(path);
    if crate::transcode::is_transcode_candidate(&path) {
        if let Some(cache) = transcode_cache {
            let src = std::path::PathBuf::from(path.as_ref());
            let cache = cache.to_path_buf();
            let rendition =
                tokio::task::spawn_blocking(move || crate::transcode::rendition_path(&src, &cache))
                    .await
                    .ok()
                    .flatten();
            if let Some(rendition) = rendition {
                path = std::borrow::Cow::Owned(rendition.to_string_lossy().replace('\\', "/"));
            }
        }
    }
    let path = path.as_ref();

    let mut file = match tokio::fs::File::open(path).await {
        Ok(file) => file,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            return status_response(404, origin);
        }
        Err(e) => {
            log::warn!("media local: open failed for {path}: {e}");
            return status_response(500, origin);
        }
    };
    let total = match file.metadata().await {
        Ok(meta) => meta.len(),
        Err(e) => {
            log::warn!("media local: metadata failed for {path}: {e}");
            return status_response(500, origin);
        }
    };
    let content_type = mime_for_path(path);

    match resolve_range(range, total) {
        RangeOutcome::Unsatisfiable => audio_base(416, content_type, origin)
            .header("Content-Range", format!("bytes */{total}"))
            .body(empty_body())
            .unwrap_or_else(|_| status_response(500, origin)),
        RangeOutcome::Full => audio_base(200, content_type, origin)
            .header("Content-Length", total.to_string())
            .body(file_stream_body(file, total))
            .unwrap_or_else(|_| status_response(500, origin)),
        RangeOutcome::Slice { start, end } => {
            use tokio::io::AsyncSeekExt;
            if let Err(e) = file.seek(std::io::SeekFrom::Start(start)).await {
                log::warn!("media local: seek to {start} failed for {path}: {e}");
                return status_response(500, origin);
            }
            let len = end - start + 1;
            audio_base(206, content_type, origin)
                .header("Content-Range", format!("bytes {start}-{end}/{total}"))
                .header("Content-Length", len.to_string())
                .body(file_stream_body(file, len))
                .unwrap_or_else(|_| status_response(500, origin))
        }
    }
}
