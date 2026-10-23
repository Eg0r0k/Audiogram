//! The `/{token}/ytimg/<encoded https url>` route of the loopback media
//! server: YouTube cover art fetched by the Rust side.
//!
//! `<img>` loads in the webview go straight to the network and bypass the app
//! proxy (it only covers the Rust-side clients), so on a network where
//! YouTube is blocked thumbnails never render; this routes them through the
//! shared proxy-aware client instead. The original https URL rides as one
//! percent-encoded path segment (built by `ytImageUrl` on the frontend) and
//! `media_server::handle` decodes it.
//!
//! No server-side cache: responses carry `Cache-Control: public, max-age=86400`
//! and the transport is plain HTTP, so the webview's own HTTP cache serves
//! repeat loads without reaching this route. (An in-memory cache lived here
//! while this was the `ytimg://` custom scheme, whose responses WebView2
//! refuses to HTTP-cache.)

use crate::media_server::{forward_image, status_response, Body, ImageError, UpstreamBreaker};

/// Hosts the route may fetch from (video thumbnails, channel art, YT Music
/// covers). Exact googleusercontent hosts only — the wildcard domain hosts
/// arbitrary user content.
pub(super) fn is_allowed_image_host(host: &str) -> bool {
    host == "ytimg.com"
        || host.ends_with(".ytimg.com")
        || host == "yt3.ggpht.com"
        || host == "lh3.googleusercontent.com"
        || host == "yt3.googleusercontent.com"
}

/// The URL is frontend-supplied: without `https` + the host allowlist this
/// route would be an open proxy for whatever the webview asks.
fn is_allowed_image_url(url: &str) -> bool {
    tauri::Url::parse(url)
        .is_ok_and(|u| u.scheme() == "https" && u.host_str().is_some_and(is_allowed_image_host))
}

/// `ytimg/<https url>`: 403 outside the allowlist, 502 at once while the
/// host's breaker is open, otherwise the image streams through with
/// cacheable headers.
pub(crate) async fn serve_image(
    client: &reqwest::Client,
    breaker: &UpstreamBreaker,
    url: &str,
    origin: Option<&str>,
) -> http::Response<Body> {
    if !is_allowed_image_url(url) {
        return status_response(403, origin);
    }
    proxy_image(client, breaker, url, origin).await
}

/// The pass-through itself, allowlist already applied — split off so tests
/// can point it at a local upstream.
async fn proxy_image(
    client: &reqwest::Client,
    breaker: &UpstreamBreaker,
    url: &str,
    origin: Option<&str>,
) -> http::Response<Body> {
    let host = tauri::Url::parse(url)
        .ok()
        .and_then(|u| u.host_str().map(str::to_owned))
        .unwrap_or_default();
    if breaker.is_open(&host) {
        log::debug!("media ytimg: breaker open for {host}");
        return status_response(502, origin);
    }
    match forward_image(client, url, origin).await {
        Ok(response) => {
            breaker.record_success(&host);
            response
        }
        // Debug on both: with YouTube unreachable every card on a search page
        // would log a line, and the search itself already reports the fault.
        Err(ImageError::Request(e)) => {
            breaker.record_failure(&host);
            log::debug!("media ytimg: request failed: {e}");
            status_response(502, origin)
        }
        Err(ImageError::Status(status)) => {
            breaker.record_success(&host);
            log::debug!("media ytimg: upstream status {status} for {url}");
            status_response(502, origin)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_server::test_support::spawn_upstream;
    use http_body_util::BodyExt;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;
    use std::time::Duration;

    const LONG: Duration = Duration::from_secs(60);

    fn direct() -> reqwest::Client {
        reqwest::Client::builder()
            .no_proxy()
            .build()
            .expect("client")
    }

    fn image_response(status: u16) -> http::Response<http_body_util::Full<bytes::Bytes>> {
        http::Response::builder()
            .status(status)
            .header("Content-Type", "image/png")
            .body(http_body_util::Full::new(bytes::Bytes::from_static(b"img")))
            .expect("upstream response")
    }

    async fn counting_upstream(status: u16) -> (String, Arc<AtomicUsize>) {
        let hits = Arc::new(AtomicUsize::new(0));
        let seen = Arc::clone(&hits);
        let base = spawn_upstream(move |_req| {
            seen.fetch_add(1, Ordering::SeqCst);
            image_response(status)
        })
        .await;
        (base, hits)
    }

    #[test]
    fn allows_https_on_known_hosts_only() {
        assert!(is_allowed_image_url(
            "https://i.ytimg.com/vi/x/hqdefault.jpg"
        ));
        assert!(is_allowed_image_url(
            "https://lh3.googleusercontent.com/c=w544-h544"
        ));
        assert!(!is_allowed_image_url(
            "http://i.ytimg.com/vi/x/hqdefault.jpg"
        ));
        assert!(!is_allowed_image_url(
            "https://evil.example/i.ytimg.com/x.jpg"
        ));
        assert!(!is_allowed_image_url(
            "https://user.googleusercontent.com/x.jpg"
        ));
        assert!(!is_allowed_image_url("not a url"));
    }

    #[tokio::test]
    async fn serve_image_refuses_urls_outside_the_allowlist_with_403() {
        let resp = serve_image(
            &reqwest::Client::new(),
            &UpstreamBreaker::default(),
            "https://evil.example/x.jpg",
            None,
        )
        .await;

        assert_eq!(resp.status(), 403);
    }

    #[tokio::test]
    async fn streams_the_image_through_with_cache_headers() {
        let upstream = spawn_upstream(|req| {
            assert_eq!(req.uri().path(), "/vi/x/hqdefault.jpg");
            http::Response::builder()
                .status(200)
                .header("Content-Type", "image/png")
                .body(http_body_util::Full::new(bytes::Bytes::from_static(b"img")))
                .expect("upstream response")
        })
        .await;

        let resp = proxy_image(
            &reqwest::Client::new(),
            &UpstreamBreaker::default(),
            &format!("{upstream}/vi/x/hqdefault.jpg"),
            Some("http://tauri.localhost"),
        )
        .await;

        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers()["Content-Type"], "image/png");
        assert_eq!(resp.headers()["Cache-Control"], "public, max-age=86400");
        assert_eq!(
            resp.headers()["Access-Control-Allow-Origin"],
            "http://tauri.localhost"
        );
        let body = resp.into_body().collect().await.expect("body").to_bytes();
        assert_eq!(body.as_ref(), b"img");
    }

    #[tokio::test]
    async fn maps_upstream_errors_to_502() {
        let upstream = spawn_upstream(|_req| {
            http::Response::builder()
                .status(404)
                .body(http_body_util::Full::new(bytes::Bytes::new()))
                .expect("upstream response")
        })
        .await;

        let resp = proxy_image(
            &reqwest::Client::new(),
            &UpstreamBreaker::default(),
            &upstream,
            None,
        )
        .await;

        assert_eq!(resp.status(), 502);
    }

    #[tokio::test]
    async fn an_open_breaker_answers_502_without_reaching_the_upstream() {
        let breaker = UpstreamBreaker::new(1, LONG);
        let client = direct();
        let closed_port = std::net::TcpListener::bind("127.0.0.1:0")
            .expect("bind")
            .local_addr()
            .expect("addr")
            .port();

        let refused = proxy_image(
            &client,
            &breaker,
            &format!("http://127.0.0.1:{closed_port}/x.jpg"),
            None,
        )
        .await;
        assert_eq!(refused.status(), 502);

        let (upstream, hits) = counting_upstream(200).await;
        let resp = proxy_image(&client, &breaker, &format!("{upstream}/x.jpg"), None).await;

        assert_eq!(resp.status(), 502);
        assert_eq!(hits.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn an_upstream_error_status_does_not_trip_the_breaker() {
        let breaker = UpstreamBreaker::new(1, LONG);
        let client = direct();
        let (missing, _) = counting_upstream(404).await;

        for _ in 0..2 {
            let resp = proxy_image(&client, &breaker, &format!("{missing}/x.jpg"), None).await;
            assert_eq!(resp.status(), 502);
        }

        let (upstream, hits) = counting_upstream(200).await;
        let resp = proxy_image(&client, &breaker, &format!("{upstream}/x.jpg"), None).await;

        assert_eq!(resp.status(), 200);
        assert_eq!(hits.load(Ordering::SeqCst), 1);
    }
}
