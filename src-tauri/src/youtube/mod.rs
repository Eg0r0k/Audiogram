//! YouTube integration — the transport half.
//!
//! The brain lives in the webview: `src/modules/youtube/engine` runs Innertube
//! (youtubei.js) for search, browse and stream resolution, then registers the
//! resolved googlevideo URL here (`yt_register_stream`). Rust carries the
//! bytes: the loopback `yt/` route proxies the stream (the webview cannot —
//! CORS, and the media element needs a same-origin URL), `yt_prefetch` warms
//! the memory cache, `yt_download` copies the file and tags it with lofty,
//! `ytimg/` proxies covers so the user's proxy applies to them too.
//!
//! No sidecar and no Innertube client on this side, so the module compiles
//! and is registered on every target, Android included.

mod download;
mod error;
mod image_proxy;
mod stream;

pub use download::*;
pub use error::*;
pub(crate) use image_proxy::*;
pub use stream::*;

pub(crate) use crate::proxy::http_client;

/// Trims a frontend-supplied video id and checks it is safe to embed in a
/// route path and an output file name.
fn validate_id(id: &str) -> Result<String, String> {
    let id = id.trim();
    if !crate::ids::is_plain_id(id) {
        return Err("invalid video id".into());
    }
    Ok(id.to_owned())
}
