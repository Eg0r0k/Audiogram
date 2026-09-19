//! Request handling and the server lifecycle: token check + dispatch, bind,
//! accept loop, spawn.

use std::sync::Arc;

use tauri::{AppHandle, Runtime};

use super::local::serve_local;
use super::primitives::{cors, empty_body, new_token, split_token_route, status_response};
use super::remote::{AppRoutes, RemoteRoutes};
use super::{Body, MediaServerState};

/// Token check + dispatch on the first path segment. Every error path is a
/// plain status response; upstream URLs never leak into errors.
pub(crate) async fn handle<T: RemoteRoutes>(
    remote: T,
    token: &str,
    transcode_cache: Option<&std::path::Path>,
    req: http::Request<hyper::body::Incoming>,
) -> http::Response<Body> {
    let origin = req
        .headers()
        .get("Origin")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);

    // CORS preflight: suffix ranges (`bytes=-N`) are not safelisted, so a
    // scripted fetch OPTIONS-probes first. Answered for any path — it leaks
    // nothing and the GET itself still 404s without the token.
    if req.method() == http::Method::OPTIONS {
        return cors(http::Response::builder().status(204), origin.as_deref())
            .header("Access-Control-Allow-Methods", "GET")
            .header("Access-Control-Allow-Headers", "Range")
            .body(empty_body())
            .unwrap_or_default();
    }

    if req.method() != http::Method::GET {
        return status_response(405, origin.as_deref());
    }

    let Some(rest) = split_token_route(req.uri().path(), token) else {
        // The path is not logged: it would carry whatever token was tried.
        log::debug!("media server: request rejected, token missing or stale");
        return status_response(404, origin.as_deref());
    };
    let rest = percent_encoding::percent_decode_str(rest)
        .decode_utf8()
        .map_or_else(|_| rest.to_owned(), |s| s.into_owned());

    let range = req
        .headers()
        .get("Range")
        .and_then(|v| v.to_str().ok())
        .map(str::to_owned);

    let query = req.uri().query().map(str::to_owned);

    if let Some(local_path) = rest.strip_prefix("local/") {
        // `raw` asks for the file itself rather than something playable — the
        // import's tag parser and fingerprint read through this route. Matched
        // on the key alone: a spelling that fell through to the rendition would
        // be a silently wrong answer rather than an error.
        let raw = query
            .as_deref()
            .is_some_and(|q| q.split('&').any(|pair| pair.split('=').next() == Some("raw")));
        return serve_local(
            local_path,
            range.as_deref(),
            origin.as_deref(),
            transcode_cache,
            raw,
        )
        .await;
    }

    match remote.dispatch(rest, query, range, origin.clone()).await {
        Some(response) => response,
        None => status_response(404, origin.as_deref()),
    }
}

// ── Server lifecycle ─────────────────────────────────────────────────

/// Binds `127.0.0.1:0` twice (audio, images) and mints the token. Called
/// BEFORE the webview exists so the frontend can never observe a
/// non-listening server.
pub fn bind_on_loopback() -> std::io::Result<(
    std::net::TcpListener,
    std::net::TcpListener,
    MediaServerState,
)> {
    let listener = std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))?;
    let image_listener = std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0))?;
    let port = listener.local_addr()?.port();
    let image_port = image_listener.local_addr()?.port();
    Ok((
        listener,
        image_listener,
        MediaServerState {
            port,
            image_port,
            token: new_token(),
        },
    ))
}

/// Accept loop: one http1 connection task per client. Runs until the
/// process dies — the socket's lifetime IS the app's lifetime.
pub(crate) async fn run_accept_loop<T: RemoteRoutes>(
    remote: T,
    token: String,
    transcode_cache: Option<std::path::PathBuf>,
    listener: tokio::net::TcpListener,
) {
    let transcode_cache = transcode_cache.map(Arc::new);
    loop {
        let stream = match listener.accept().await {
            Ok((stream, _addr)) => stream,
            Err(e) => {
                // Transient accept errors (EMFILE, aborted handshakes) must
                // not turn into a hot spin.
                log::warn!("media server accept: {e}");
                tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                continue;
            }
        };

        let remote = remote.clone();
        let token = token.clone();
        let transcode_cache = transcode_cache.clone();
        tokio::spawn(async move {
            let service = hyper::service::service_fn(move |req| {
                let remote = remote.clone();
                let token = token.clone();
                let transcode_cache = transcode_cache.clone();
                async move {
                    let cache = transcode_cache.as_deref().map(|p| p.as_path());
                    Ok::<_, std::convert::Infallible>(handle(remote, &token, cache, req).await)
                }
            });
            let io = hyper_util::rt::TokioIo::new(stream);
            if let Err(e) = hyper::server::conn::http1::Builder::new()
                .serve_connection(io, service)
                .await
            {
                // Media elements abort connections on every seek — routine.
                log::debug!("media server conn: {e}");
            }
        });
    }
}

fn into_tokio(listener: std::net::TcpListener) -> Option<tokio::net::TcpListener> {
    if let Ok(addr) = listener.local_addr() {
        log::info!("media server listening on {addr}");
    }
    if let Err(e) = listener.set_nonblocking(true) {
        log::error!("media server: set_nonblocking failed: {e}");
        return None;
    }
    match tokio::net::TcpListener::from_std(listener) {
        Ok(listener) => Some(listener),
        Err(e) => {
            log::error!("media server: listener conversion failed: {e}");
            None
        }
    }
}

/// Entry point for `lib.rs`: wraps the app handle and spawns one accept loop
/// per listener on tauri's async runtime. Both serve every route; only the
/// origin the frontend uses for each kind of resource differs. The listeners
/// are already bound (before the webview existed), so requests can never
/// race server readiness.
pub fn spawn<R: Runtime>(
    app: AppHandle<R>,
    token: String,
    listener: std::net::TcpListener,
    image_listener: std::net::TcpListener,
) {
    tauri::async_runtime::spawn(async move {
        let (Some(listener), Some(image_listener)) =
            (into_tokio(listener), into_tokio(image_listener))
        else {
            return;
        };
        use tauri::Manager;
        let transcode_cache = app
            .path()
            .app_cache_dir()
            .map(|dir| dir.join("transcode"))
            .ok();
        if let Some(cache) = &transcode_cache {
            crate::transcode::clean_stale_tmp(cache);
        }
        let routes = AppRoutes(app);
        tauri::async_runtime::spawn(run_accept_loop(
            routes.clone(),
            token.clone(),
            transcode_cache.clone(),
            image_listener,
        ));
        run_accept_loop(routes, token, transcode_cache, listener).await;
    });
}
