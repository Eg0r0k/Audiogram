//! Yandex Music. Everything that talks to Yandex lives here: the device-flow
//! sign-in, the authenticated request proxy (`ym_request`), the track link
//! resolver behind the `ym/track` media-server route, the
//! prefetch cache and the offline download. The OAuth token never reaches
//! the webview — the frontend only learns `{loggedIn, uid, hasPlus, displayName}`.
//! Covers load in the webview straight from the avatars hosts, which send
//! `Access-Control-Allow-Origin: *`.

mod api;
mod auth;
mod download;
mod resolve;
mod state;
mod stream;

// Glob re-exports: `generate_handler!` resolves the hidden `__cmd__*` items
// through `ym::`, which explicit re-exports would have to list by hand.
pub use api::*;
pub use auth::*;
pub use download::*;
pub use resolve::YmLinkCache;
pub(crate) use state::load_session_if_needed;
pub use state::YmState;
pub use stream::*;
