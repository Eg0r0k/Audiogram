//! Yandex Music. Everything that talks to Yandex lives here: the device-flow
//! sign-in, the authenticated request proxy (`ym_request`) and the session
//! they share. The OAuth token never reaches the webview — the frontend
//! only learns `{loggedIn, uid, hasPlus, displayName}`.

mod api;
mod auth;
mod state;

// Glob re-exports: `generate_handler!` resolves the hidden `__cmd__*` items
// through `ym::`, which explicit re-exports would have to list by hand.
pub use api::*;
pub use auth::*;
pub use state::YmState;
