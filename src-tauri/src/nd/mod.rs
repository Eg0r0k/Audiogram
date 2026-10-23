//! Navidrome (Subsonic) configuration state and the `nd/song/` route of the
//! loopback media server.
//!
//! The frontend derives `{token, salt}` from the password once per config
//! change (`nd_set_config`); the raw password never reaches Rust and the
//! token never appears in media-element URLs or logs: stream URLs are built
//! here and never logged. Covers load in the webview straight from the
//! server, which sends `Access-Control-Allow-Origin: *`.

mod config;
mod download;
mod stream;

// Glob re-exports: `generate_handler!` resolves the hidden `__cmd__*` items
// through `nd::`, which explicit re-exports would have to list by hand.
pub use config::*;
pub use download::*;
pub(crate) use stream::*;
