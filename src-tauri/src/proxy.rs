//! The user-configured network proxy shared by every Rust HTTP layer: the
//! remote routes of the loopback media server (YouTube, Navidrome and Yandex
//! alike), prefetch and downloads. The webview's Innertube engine reads the
//! same URL from the frontend side of `set_proxy`.
//!
//! The shared [`reqwest::Client`] lives here too: the media element opens a
//! fresh Range request per seek and every ~1 MiB of a YouTube stream, and a
//! client built per request means a new connection pool — and a new TLS
//! handshake — every time. One client per proxy configuration keeps the
//! connections alive across requests.

use std::sync::Mutex;
use std::time::Duration;

use tauri::{AppHandle, Manager, Runtime};

use crate::app_error::AppError;

/// Reaching the server at all.
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);
/// Gap between two reads of the body. NOT a total request timeout: a whole
/// track legitimately takes minutes to stream, but a source that goes quiet
/// mid-body must not hang forever — an upstream that stalls after sending its
/// headers leaves the media element waiting for bytes that never arrive, with
/// nothing on this side ever giving up. If that happens before the element has
/// metadata the engine's own readiness timeout eventually errors out; if it
/// happens mid-playback nothing does, and playback simply stops.
const READ_TIMEOUT: Duration = Duration::from_secs(30);

/// A proxy-config failure; never carries a request URL.
#[derive(Debug, thiserror::Error)]
pub(crate) enum ProxyError {
    #[error("{0}")]
    InvalidUrl(String),
    #[error("{0}")]
    Build(#[from] reqwest::Error),
    #[error("proxy state poisoned")]
    Poisoned,
}

#[derive(Default)]
struct ProxyInner {
    /// `scheme://[user:pass@]host:port`; `None` means "direct".
    url: Option<String>,
    /// Built lazily for the current `url`, dropped whenever it changes.
    client: Option<reqwest::Client>,
}

/// The proxy URL pushed from the frontend via `set_proxy`, plus the shared
/// HTTP client honoring it.
#[derive(Default)]
pub struct ProxyState(Mutex<ProxyInner>);

impl ProxyState {
    pub(crate) fn set(&self, url: Option<String>) {
        if let Ok(mut inner) = self.0.lock() {
            if inner.url != url {
                inner.url = url;
                inner.client = None;
            }
        }
    }

    /// The shared client for the current proxy, built on first use after
    /// every proxy change. `reqwest::Client` is an `Arc` inside, so the clone
    /// is a refcount bump and every caller shares one connection pool.
    /// Errors are proxy-config errors — they never carry request URLs.
    pub(crate) fn client(&self) -> Result<reqwest::Client, ProxyError> {
        let mut inner = self.0.lock().map_err(|_| ProxyError::Poisoned)?;
        if let Some(client) = &inner.client {
            return Ok(client.clone());
        }
        let client = client_builder(inner.url.as_deref())?
            .connect_timeout(CONNECT_TIMEOUT)
            .read_timeout(READ_TIMEOUT)
            .build()?;
        inner.client = Some(client.clone());
        Ok(client)
    }
}

/// A reqwest builder with the proxy applied — the one place a proxy URL is
/// parsed, so every client agrees on what an invalid URL means: an error,
/// never a silent direct connection.
pub(crate) fn client_builder(proxy: Option<&str>) -> Result<reqwest::ClientBuilder, ProxyError> {
    let builder = reqwest::Client::builder();
    let Some(url) = proxy else {
        // Otherwise reqwest falls back to HTTP_PROXY/ALL_PROXY from the environment.
        return Ok(builder.no_proxy());
    };
    let proxy = reqwest::Proxy::all(url)
        .map_err(|e| ProxyError::InvalidUrl(e.without_url().to_string()))?;
    Ok(builder.proxy(proxy))
}

/// The proxy URL with its credentials dropped — the only form that may reach
/// a log line.
fn redacted(url: &str) -> String {
    let Ok(mut parsed) = tauri::Url::parse(url) else {
        return "<unparsable url>".into();
    };
    let _ = parsed.set_username("");
    let _ = parsed.set_password(None);
    // `http://host:3128` serializes with a trailing `/`; drop it so the line
    // reads like what the user typed.
    parsed.to_string().trim_end_matches('/').to_owned()
}

/// The shared client honoring the proxy state — see [`ProxyState::client`].
pub(crate) fn http_client<R: Runtime>(app: &AppHandle<R>) -> Result<reqwest::Client, ProxyError> {
    app.state::<ProxyState>().client()
}

/// Stores the proxy URL for later streaming use. An empty/blank URL clears it.
#[tauri::command]
pub fn set_proxy<R: Runtime>(app: AppHandle<R>, url: Option<String>) {
    let normalized = url.map(|u| u.trim().to_owned()).filter(|u| !u.is_empty());
    match &normalized {
        Some(url) => log::info!("proxy set to {}", redacted(url)),
        None => log::info!("proxy cleared, connecting directly"),
    }
    app.state::<ProxyState>().set(normalized);
}

/// Verifies the proxy actually connects by fetching a lightweight endpoint
/// through it. Returns the round-trip latency in milliseconds on success.
#[tauri::command]
pub async fn proxy_check(url: String) -> Result<u64, AppError> {
    let url = url.trim().to_owned();
    if url.is_empty() {
        return Err(AppError::invalid_input("empty proxy url"));
    }

    // Proxy::all fails only on an unparsable URL or unknown scheme: the user's input.
    let client = client_builder(Some(&url))?
        .timeout(Duration::from_secs(10))
        .build()
        .map_err(|e| AppError::network(e.to_string()))?;

    let started = std::time::Instant::now();
    let response = client
        .get("https://www.youtube.com/generate_204")
        .header(reqwest::header::USER_AGENT, "Mozilla/5.0")
        .send()
        .await
        .map_err(|e| AppError::network(e.to_string()))?;

    let status = response.status().as_u16();
    if !(200..=399).contains(&status) {
        return Err(AppError::network(format!(
            "proxy responded with status {status}"
        )));
    }

    Ok(u64::try_from(started.elapsed().as_millis()).unwrap_or(u64::MAX))
}

#[cfg(test)]
mod tests {
    use std::ffi::OsString;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    use bytes::Bytes;
    use http_body_util::Full;

    use super::{redacted, ProxyError, ProxyState};
    use crate::media_server::test_support::spawn_upstream;

    /// Puts the overridden variables back on drop, also when an assert panics.
    struct EnvOverride(Vec<(&'static str, Option<OsString>)>);

    impl EnvOverride {
        fn set(vars: &[(&'static str, &str)]) -> Self {
            let saved = vars
                .iter()
                .map(|&(name, value)| {
                    let previous = std::env::var_os(name);
                    std::env::set_var(name, value);
                    (name, previous)
                })
                .collect();
            Self(saved)
        }
    }

    impl Drop for EnvOverride {
        fn drop(&mut self) {
            for (name, previous) in self.0.drain(..).rev() {
                match previous {
                    Some(value) => std::env::set_var(name, value),
                    None => std::env::remove_var(name),
                }
            }
        }
    }

    #[tokio::test]
    async fn a_cleared_proxy_ignores_the_environment() {
        let hits = Arc::new(AtomicUsize::new(0));
        let seen = Arc::clone(&hits);
        let upstream = spawn_upstream(move |_req| {
            seen.fetch_add(1, Ordering::SeqCst);
            http::Response::new(Full::new(Bytes::from_static(b"ok")))
        })
        .await;
        let dead_proxy = {
            let listener = std::net::TcpListener::bind("127.0.0.1:0").expect("bind");
            format!("http://{}", listener.local_addr().expect("addr"))
        };

        // Parallel tests use 127.0.0.1, which NO_PROXY keeps direct; only
        // `localhost` would reach the dead proxy.
        let _env = EnvOverride::set(&[("NO_PROXY", "127.0.0.1"), ("HTTP_PROXY", &dead_proxy)]);
        let client = ProxyState::default().client().expect("direct client");
        let response = client
            .get(upstream.replacen("127.0.0.1", "localhost", 1))
            .send()
            .await
            .expect("a direct request, not one through the dead proxy");

        assert_eq!(response.status(), 200);
        assert_eq!(hits.load(Ordering::SeqCst), 1);
    }

    #[test]
    fn redacted_drops_credentials_and_keeps_the_endpoint() {
        assert_eq!(
            redacted("socks5://user:s3cret@127.0.0.1:1080"),
            "socks5://127.0.0.1:1080"
        );
        assert_eq!(
            redacted("http://proxy.example:3128"),
            "http://proxy.example:3128"
        );
        assert_eq!(redacted("not a url"), "<unparsable url>");
    }

    #[test]
    fn client_is_shared_until_the_proxy_changes() {
        let state = ProxyState::default();

        // `reqwest::Client` has no identity API, so the cache slot itself is
        // what the test observes.
        state.client().expect("direct client");
        assert!(state.0.lock().unwrap().client.is_some());

        state.set(Some("socks5://127.0.0.1:1080".into()));
        assert!(
            state.0.lock().unwrap().client.is_none(),
            "proxy change drops the client"
        );

        state.client().expect("proxied client");
        state.set(Some("socks5://127.0.0.1:1080".into()));
        assert!(
            state.0.lock().unwrap().client.is_some(),
            "same url keeps the client"
        );
    }

    #[test]
    fn an_invalid_proxy_url_is_an_error_not_a_direct_connection() {
        let state = ProxyState::default();
        state.set(Some("not a url".into()));

        assert!(matches!(state.client(), Err(ProxyError::InvalidUrl(_))));
    }
}
