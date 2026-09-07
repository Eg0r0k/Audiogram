//! Remote routes (`nd/…`, `yt/…`) behind a trait so the HTTP core needs no
//! `AppHandle`; the production impl wraps one, tests use a stub.

use std::future::Future;

use tauri::{AppHandle, Runtime};

use super::primitives::status_response;
use super::Body;

/// Remote (non-local-file) routes: `nd/…` and `yt/…`. Split behind a trait
/// so the HTTP core needs no `AppHandle` — the production impl wraps one,
/// tests use a stub.
pub(crate) trait RemoteRoutes: Clone + Send + Sync + 'static {
    /// `None` means "no such route" → 404. `rest` arrives percent-decoded.
    fn dispatch(
        &self,
        rest: String,
        query: Option<String>,
        range: Option<String>,
        origin: Option<String>,
    ) -> impl Future<Output = Option<http::Response<Body>>> + Send;
}

/// Production remote routes backed by the tauri app (nd/yt modules read
/// their managed state and, for yt, spawn the resolver sidecar).
pub(crate) struct AppRoutes<R: Runtime>(pub AppHandle<R>);

impl<R: Runtime> Clone for AppRoutes<R> {
    fn clone(&self) -> Self {
        AppRoutes(self.0.clone())
    }
}

impl<R: Runtime> RemoteRoutes for AppRoutes<R> {
    async fn dispatch(
        &self,
        rest: String,
        query: Option<String>,
        range: Option<String>,
        origin: Option<String>,
    ) -> Option<http::Response<Body>> {
        use tauri::Manager;

        let app = &self.0;
        let origin = origin.as_deref();

        // Every remote route talks to its upstream through the shared client;
        // cache hits pay only a mutex lock for it. The one failure is an
        // unparsable proxy URL, which no route could work around anyway.
        let client = match crate::proxy::http_client(app) {
            Ok(client) => client,
            Err(e) => {
                log::warn!("media {rest}: client: {e}");
                return Some(status_response(502, origin));
            }
        };

        if let Some(id) = rest.strip_prefix("nd/song/") {
            let config = app.state::<crate::nd::NdState>().get();
            let cache = app.state::<crate::nd::NdAudioCache>();
            return Some(
                crate::nd::serve_song(config, &cache, &client, id, range.as_deref(), origin).await,
            );
        }
        if let Some(id) = rest.strip_prefix("nd/cover/") {
            let config = app.state::<crate::nd::NdState>().get();
            return Some(
                crate::nd::serve_cover(config, &client, id, query.as_deref(), origin).await,
            );
        }
        #[cfg(desktop)]
        if let Some(id) = rest.strip_prefix("yt/") {
            return Some(crate::youtube::serve_yt(app, &client, id, range, origin).await);
        }
        #[cfg(desktop)]
        if let Some(url) = rest.strip_prefix("ytimg/") {
            return Some(crate::youtube::serve_image(&client, url, origin).await);
        }
        #[cfg(not(desktop))]
        let _ = range;

        None
    }
}
