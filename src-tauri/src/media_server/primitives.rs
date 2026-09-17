//! HTTP primitives shared by every route: Range resolution, path and token
//! checks, CORS, response builders and upstream forwarding.

use http_body_util::{BodyExt, Full, StreamBody};

use super::Body;

/// What a `Range` header means for a resource of `total` bytes.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum RangeOutcome {
    /// Absent or malformed/unsupported spec — serve the whole body as 200.
    Full,
    /// Serve `start..=end` as 206.
    Slice { start: u64, end: u64 },
    /// Nothing satisfiable — 416 with `Content-Range: bytes */total`.
    Unsatisfiable,
}

/// Resolves a single-range `bytes=` spec against a known total length.
/// Suffix ranges (`bytes=-N`) are honored; multipart ranges and malformed
/// specs fall back to a full 200 (a valid answer per RFC 9110).
pub(crate) fn resolve_range(range: Option<&str>, total: u64) -> RangeOutcome {
    let Some(raw) = range else {
        return RangeOutcome::Full;
    };
    let Some(spec) = raw.strip_prefix("bytes=") else {
        return RangeOutcome::Full;
    };
    let Some((start, end)) = spec.split_once('-') else {
        return RangeOutcome::Full;
    };
    let (start, end) = (start.trim(), end.trim());

    if start.is_empty() {
        let Ok(suffix_len) = end.parse::<u64>() else {
            return RangeOutcome::Full;
        };
        if suffix_len == 0 || total == 0 {
            return RangeOutcome::Unsatisfiable;
        }
        return RangeOutcome::Slice {
            start: total.saturating_sub(suffix_len),
            end: total - 1,
        };
    }

    let Ok(start) = start.parse::<u64>() else {
        return RangeOutcome::Full;
    };
    if start >= total {
        return RangeOutcome::Unsatisfiable;
    }
    let end = if end.is_empty() {
        total - 1
    } else {
        match end.parse::<u64>() {
            Ok(end) => end,
            Err(_) => return RangeOutcome::Full,
        }
    };
    if end < start {
        return RangeOutcome::Full;
    }
    RangeOutcome::Slice {
        start,
        end: end.min(total - 1),
    }
}

/// Absolute path with no `..` segments and no UNC/device prefix. UNC paths
/// (`//server/share`, `\\server\share`) would make `std::fs::read` reach into
/// SMB on Windows — reject them outright.
pub(crate) fn is_safe_abs_path(path: &str) -> bool {
    if path.starts_with("//") || path.starts_with("\\\\") {
        return false;
    }
    let bytes = path.as_bytes();
    let is_absolute = path.starts_with('/')
        || (path.len() > 2 && bytes[1] == b':' && bytes[0].is_ascii_alphabetic());
    is_absolute && !path.split(['/', '\\']).any(|segment| segment == "..")
}

/// Lower-cased extension of a path string (`"/a/b.FLAC"` → `"flac"`); `None`
/// without one. Accepts both separators, since local paths arrive from the
/// frontend with `/` on every platform.
pub(crate) fn file_extension(path: &str) -> Option<String> {
    std::path::Path::new(path)
        .extension()
        .and_then(std::ffi::OsStr::to_str)
        .map(str::to_ascii_lowercase)
}

pub(crate) fn mime_for_path(path: &str) -> &'static str {
    match file_extension(path).as_deref().unwrap_or_default() {
        "mp3" => "audio/mpeg",
        "flac" => "audio/flac",
        "ogg" | "oga" | "opus" => "audio/ogg",
        "m4a" | "mp4" => "audio/mp4",
        "aac" => "audio/aac",
        "wav" => "audio/wav",
        "ape" => "audio/x-ape",
        "wma" => "audio/x-ms-wma",
        "webm" => "audio/webm",
        _ => "application/octet-stream",
    }
}

/// Strips the leading `/{token}/` from a request path; `None` when the token
/// does not match (the caller answers 404 without distinguishing why).
pub(crate) fn split_token_route<'a>(path: &'a str, token: &str) -> Option<&'a str> {
    if token.is_empty() {
        return None;
    }
    path.strip_prefix('/')?
        .strip_prefix(token)?
        .strip_prefix('/')
}

/// 32 hex chars from 16 CSPRNG bytes — the per-launch URL token.
pub(crate) fn new_token() -> String {
    let mut buf = [0u8; 16];
    getrandom::fill(&mut buf).expect("OS CSPRNG is available");
    hex::encode(buf)
}

/// The `Access-Control-Allow-Origin` value for a request `Origin`: known
/// webview origins are reflected (so `crossOrigin` elements stay untainted),
/// absent origins get `*` (headerless media probes), anything else gets
/// `"null"` so a drive-by browser page cannot read responses even with a
/// leaked token.
pub(crate) fn allow_origin(origin: Option<&str>) -> &'static str {
    match origin {
        None => "*",
        Some("http://tauri.localhost") => "http://tauri.localhost",
        Some("https://tauri.localhost") => "https://tauri.localhost",
        Some("tauri://localhost") => "tauri://localhost",
        Some("http://localhost:1420") => "http://localhost:1420",
        Some(_) => "null",
    }
}

// ── Response builders ────────────────────────────────────────────────

pub(super) fn empty_body() -> Body {
    Full::new(bytes::Bytes::new())
        .map_err(|never| match never {})
        .boxed()
}

pub(crate) fn full_body(bytes: bytes::Bytes) -> Body {
    Full::new(bytes).map_err(|never| match never {}).boxed()
}

/// CORS + Vary on every response; `Vary: Origin` whenever the value depends
/// on the request's Origin (i.e. the header was present).
pub(crate) fn cors(
    builder: http::response::Builder,
    origin: Option<&str>,
) -> http::response::Builder {
    let builder = builder.header("Access-Control-Allow-Origin", allow_origin(origin));
    if origin.is_some() {
        builder.header("Vary", "Origin")
    } else {
        builder
    }
}

pub(crate) fn status_response(code: u16, origin: Option<&str>) -> http::Response<Body> {
    cors(http::Response::builder().status(code), origin)
        .body(empty_body())
        .unwrap_or_default()
}

/// Common headers of every audio answer. `no-store`: tokenized URLs must
/// not outlive the session in the HTTP cache.
pub(super) fn audio_base(
    status: u16,
    content_type: &str,
    origin: Option<&str>,
) -> http::response::Builder {
    cors(http::Response::builder().status(status), origin)
        .header("Content-Type", content_type)
        .header("Accept-Ranges", "bytes")
        .header("Cache-Control", "no-store")
        // Content-Range/Content-Length are not CORS-safelisted; without this
        // a scripted fetch on the webview origin cannot read them.
        .header(
            "Access-Control-Expose-Headers",
            "Content-Range, Accept-Ranges, Content-Length",
        )
}

/// Serves a fully in-memory body (prefetch caches) honoring Range. `Bytes`
/// slices are refcounted views, so neither answer copies the audio.
pub(crate) fn memory_range_response(
    content_type: &str,
    bytes: &bytes::Bytes,
    range: Option<&str>,
    origin: Option<&str>,
) -> http::Response<Body> {
    let total = bytes.len() as u64;
    match resolve_range(range, total) {
        RangeOutcome::Unsatisfiable => audio_base(416, content_type, origin)
            .header("Content-Range", format!("bytes */{total}"))
            .body(empty_body())
            .unwrap_or_else(|_| status_response(500, origin)),
        RangeOutcome::Slice { start, end } => audio_base(206, content_type, origin)
            .header("Content-Range", format!("bytes {start}-{end}/{total}"))
            .body(full_body(bytes.slice(start as usize..=end as usize)))
            .unwrap_or_else(|_| status_response(500, origin)),
        RangeOutcome::Full => audio_base(200, content_type, origin)
            .body(full_body(bytes.clone()))
            .unwrap_or_else(|_| status_response(500, origin)),
    }
}

// ── Upstream forwarding ──────────────────────────────────────────────

/// Why an image could not be passed through: the request itself, or an
/// upstream that answered with something other than 200.
pub(crate) enum ImageError {
    Request(String),
    Status(u16),
}

/// GET `url` and stream the image through with cacheable headers — the body
/// every cover route shares. Covers are cacheable, unlike tokenized audio:
/// the webview may keep them for a day, which kills the `<img>` remount
/// re-fetch flicker. Errors never embed the URL.
pub(crate) async fn forward_image(
    client: &reqwest::Client,
    url: &str,
    origin: Option<&str>,
) -> Result<http::Response<Body>, ImageError> {
    use futures_util::TryStreamExt;

    let response = client
        .get(url)
        .send()
        .await
        .map_err(|e| ImageError::Request(e.without_url().to_string()))?;
    let status = response.status().as_u16();
    if status != 200 {
        return Err(ImageError::Status(status));
    }

    let content_type = response
        .headers()
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("image/jpeg")
        .to_owned();
    let content_length = response
        .headers()
        .get(reqwest::header::CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);

    let mut builder = cors(http::Response::builder().status(200), origin)
        .header("Content-Type", content_type)
        .header("Cache-Control", "public, max-age=86400");
    if let Some(len) = content_length {
        builder = builder.header("Content-Length", len);
    }

    let stream = response
        .bytes_stream()
        .map_err(|e| std::io::Error::other(e.without_url().to_string()))
        .map_ok(hyper::body::Frame::data);
    builder
        .body(StreamBody::new(stream).boxed())
        .map_err(|e| ImageError::Request(e.to_string()))
}

/// Caps any range to `max_span` bytes: `bytes=X-` (the media element's probe
/// and seek form) and over-long explicit ranges become `bytes=X-(X+span-1)`.
///
/// Sole remaining reason (the in-memory buffering one died with `stream://`):
/// googlevideo throttles open-ended ranges on long streams to a trickle
/// while bounded ones stream at full speed (see `youtube::YT_RANGE_SPAN`),
/// so the YT side stays under that. A capped 206 + Content-Range makes the
/// element stream progressively.
///
/// Absent headers and malformed/suffix specs pass through untouched.
pub(crate) fn cap_range_span(range: Option<String>, max_span: u64) -> Option<String> {
    let raw = range?;
    let capped = raw
        .strip_prefix("bytes=")
        .and_then(|spec| spec.split_once('-'))
        .and_then(|(start, end)| {
            let start: u64 = start.trim().parse().ok()?;
            let capped_end = start.saturating_add(max_span - 1);
            let end = match end.trim() {
                "" => capped_end,
                end => end.parse::<u64>().ok()?.min(capped_end),
            };
            Some(format!("bytes={start}-{end}"))
        });
    Some(capped.unwrap_or(raw))
}

/// GET `url` forwarding an optional Range header (capped to `max_span` when
/// given — see [`cap_range_span`]), propagating status, Content-Type,
/// Content-Range, Content-Length and Accept-Ranges, and passing the upstream
/// body through AS A STREAM — nothing is buffered on any platform. `headers`
/// (upstream-required request headers) are a per-source concern; `client` is
/// the shared proxy-aware one from [`crate::proxy::ProxyState::client`].
/// Errors never embed the URL (nd URLs carry auth tokens).
pub(crate) async fn forward_stream(
    client: &reqwest::Client,
    url: &str,
    headers: &[(String, String)],
    range: Option<String>,
    max_span: Option<u64>,
    origin: Option<&str>,
) -> Result<http::Response<Body>, String> {
    use futures_util::TryStreamExt;

    let range = match max_span {
        Some(span) => cap_range_span(range, span),
        None => range,
    };

    let mut req = client.get(url);
    for (name, value) in headers {
        req = req.header(name.as_str(), value.as_str());
    }
    if let Some(range) = &range {
        req = req.header(reqwest::header::RANGE, range);
    }

    let resp = req
        .send()
        .await
        .map_err(|e| format!("request failed: {}", e.without_url()))?;
    let status = resp.status().as_u16();
    let upstream_headers = resp.headers().clone();

    let content_type = upstream_headers
        .get(reqwest::header::CONTENT_TYPE)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("audio/mp4");

    let mut builder = audio_base(status, content_type, origin);
    for name in [
        reqwest::header::CONTENT_RANGE,
        reqwest::header::CONTENT_LENGTH,
    ] {
        if let Some(value) = upstream_headers.get(&name).and_then(|v| v.to_str().ok()) {
            builder = builder.header(name.as_str(), value.to_owned());
        }
    }

    let stream = resp
        .bytes_stream()
        .map_err(|e| std::io::Error::other(e.without_url().to_string()))
        .map_ok(hyper::body::Frame::data);
    builder
        .body(StreamBody::new(stream).boxed())
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    // ── resolve_range ────────────────────────────────────────────────

    #[test]
    fn no_range_serves_the_full_body() {
        assert_eq!(resolve_range(None, 100), RangeOutcome::Full);
    }

    #[test]
    fn open_range_runs_to_the_last_byte() {
        assert_eq!(
            resolve_range(Some("bytes=0-"), 100),
            RangeOutcome::Slice { start: 0, end: 99 }
        );
        assert_eq!(
            resolve_range(Some("bytes=40-"), 100),
            RangeOutcome::Slice { start: 40, end: 99 }
        );
    }

    #[test]
    fn explicit_range_is_clamped_to_the_resource() {
        assert_eq!(
            resolve_range(Some("bytes=10-49"), 100),
            RangeOutcome::Slice { start: 10, end: 49 }
        );
        assert_eq!(
            resolve_range(Some("bytes=10-500"), 100),
            RangeOutcome::Slice { start: 10, end: 99 }
        );
    }

    #[test]
    fn suffix_range_serves_the_tail() {
        assert_eq!(
            resolve_range(Some("bytes=-30"), 100),
            RangeOutcome::Slice { start: 70, end: 99 }
        );
        // A suffix longer than the file is the whole file per RFC 9110.
        assert_eq!(
            resolve_range(Some("bytes=-500"), 100),
            RangeOutcome::Slice { start: 0, end: 99 }
        );
    }

    #[test]
    fn start_past_the_end_is_unsatisfiable() {
        assert_eq!(
            resolve_range(Some("bytes=100-"), 100),
            RangeOutcome::Unsatisfiable
        );
        assert_eq!(
            resolve_range(Some("bytes=200-300"), 100),
            RangeOutcome::Unsatisfiable
        );
        assert_eq!(
            resolve_range(Some("bytes=-0"), 100),
            RangeOutcome::Unsatisfiable
        );
        assert_eq!(
            resolve_range(Some("bytes=0-"), 0),
            RangeOutcome::Unsatisfiable
        );
    }

    #[test]
    fn malformed_and_multipart_specs_fall_back_to_full() {
        assert_eq!(resolve_range(Some("items=0-1"), 100), RangeOutcome::Full);
        assert_eq!(resolve_range(Some("bytes=abc-"), 100), RangeOutcome::Full);
        assert_eq!(resolve_range(Some("bytes=50-10"), 100), RangeOutcome::Full);
        assert_eq!(
            resolve_range(Some("bytes=0-1,5-9"), 100),
            RangeOutcome::Full
        );
        assert_eq!(resolve_range(Some("bytes="), 100), RangeOutcome::Full);
    }

    // ── is_safe_abs_path ─────────────────────────────────────────────

    #[test]
    fn accepts_plain_absolute_paths() {
        assert!(is_safe_abs_path("/data/data/app/tracks/a.mp3"));
        assert!(is_safe_abs_path("C:/music/a.mp3"));
    }

    #[test]
    fn rejects_relative_and_traversal_paths() {
        assert!(!is_safe_abs_path("tracks/a.mp3"));
        assert!(!is_safe_abs_path("/data/../etc/passwd"));
        assert!(!is_safe_abs_path("C:/music/..\\secret.mp3"));
    }

    #[test]
    fn rejects_unc_and_device_prefixes() {
        assert!(!is_safe_abs_path("//server/share/a.mp3"));
        assert!(!is_safe_abs_path("\\\\server\\share\\a.mp3"));
        assert!(!is_safe_abs_path("\\\\?\\C:\\music\\a.mp3"));
        assert!(!is_safe_abs_path("//./PhysicalDrive0"));
    }

    // ── file_extension / mime_for_path ───────────────────────────────

    #[test]
    fn extension_is_lowercased_and_absent_without_a_dot() {
        assert_eq!(file_extension("/a/b.FLAC").as_deref(), Some("flac"));
        assert_eq!(
            file_extension("C:/music/x.y/track.m4a").as_deref(),
            Some("m4a")
        );
        assert_eq!(file_extension("/a/noext"), None);
        assert_eq!(file_extension("/a/.hidden"), None);
    }

    #[test]
    fn maps_common_audio_extensions() {
        assert_eq!(mime_for_path("/a/b.mp3"), "audio/mpeg");
        assert_eq!(mime_for_path("/a/b.FLAC"), "audio/flac");
        assert_eq!(mime_for_path("/a/b.opus"), "audio/ogg");
        assert_eq!(mime_for_path("/a/b.bin"), "application/octet-stream");
    }

    // ── split_token_route ────────────────────────────────────────────

    #[test]
    fn splits_the_token_off_the_route() {
        assert_eq!(
            split_token_route("/abc123/local/C%3A/x.mp3", "abc123"),
            Some("local/C%3A/x.mp3")
        );
        assert_eq!(
            split_token_route("/abc123/nd/song/s1", "abc123"),
            Some("nd/song/s1")
        );
    }

    #[test]
    fn rejects_wrong_or_missing_tokens() {
        assert_eq!(split_token_route("/evil/local/x", "abc123"), None);
        assert_eq!(split_token_route("/abc123", "abc123"), None);
        assert_eq!(split_token_route("/", "abc123"), None);
        assert_eq!(split_token_route("/abc123extra/local/x", "abc123"), None);
    }

    // ── new_token ────────────────────────────────────────────────────

    #[test]
    fn tokens_are_32_hex_chars_and_unique() {
        let a = new_token();
        let b = new_token();
        assert_eq!(a.len(), 32);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
    }

    // ── allow_origin ─────────────────────────────────────────────────

    #[test]
    fn reflects_known_webview_origins() {
        assert_eq!(
            allow_origin(Some("http://tauri.localhost")),
            "http://tauri.localhost"
        );
        assert_eq!(
            allow_origin(Some("https://tauri.localhost")),
            "https://tauri.localhost"
        );
        assert_eq!(allow_origin(Some("tauri://localhost")), "tauri://localhost");
        assert_eq!(
            allow_origin(Some("http://localhost:1420")),
            "http://localhost:1420"
        );
    }

    #[test]
    fn blocks_unknown_origins_and_wildcards_headerless_requests() {
        assert_eq!(allow_origin(Some("https://evil.example")), "null");
        assert_eq!(allow_origin(None), "*");
    }

    // ── cap_range_span ───────────────────────────────────────────────

    const SPAN: u64 = 1024;

    #[test]
    fn caps_the_open_probe_and_seek_ranges() {
        assert_eq!(
            cap_range_span(Some("bytes=0-".into()), SPAN).as_deref(),
            Some("bytes=0-1023"),
        );
        assert_eq!(
            cap_range_span(Some("bytes=5000-".into()), SPAN).as_deref(),
            Some("bytes=5000-6023"),
        );
    }

    #[test]
    fn caps_explicit_ranges_longer_than_the_span() {
        assert_eq!(
            cap_range_span(Some("bytes=100-999999".into()), SPAN).as_deref(),
            Some("bytes=100-1123"),
        );
    }

    #[test]
    fn keeps_explicit_ranges_within_the_span() {
        assert_eq!(
            cap_range_span(Some("bytes=100-200".into()), SPAN).as_deref(),
            Some("bytes=100-200"),
        );
    }

    #[test]
    fn passes_through_absent_suffix_and_malformed_specs() {
        assert_eq!(cap_range_span(None, SPAN), None);
        // Suffix ranges ("last N bytes") have no start to cap from.
        assert_eq!(
            cap_range_span(Some("bytes=-500".into()), SPAN).as_deref(),
            Some("bytes=-500")
        );
        assert_eq!(
            cap_range_span(Some("items=0-".into()), SPAN).as_deref(),
            Some("items=0-")
        );
        assert_eq!(
            cap_range_span(Some("bytes=abc-".into()), SPAN).as_deref(),
            Some("bytes=abc-")
        );
    }
}
