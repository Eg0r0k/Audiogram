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
//! refuses to HTTP-cache — the same reason the nd cover route moved.)

use crate::media_server::{forward_image, status_response, Body, ImageError};

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

/// `ytimg/<https url>`: 403 outside the allowlist, otherwise the image
/// streams through with cacheable headers.
pub(crate) async fn serve_image(
    client: &reqwest::Client,
    url: &str,
    origin: Option<&str>,
) -> http::Response<Body> {
    if !is_allowed_image_url(url) {
        return status_response(403, origin);
    }
    proxy_image(client, url, origin).await
}

/// The pass-through itself, allowlist already applied — split off so tests
/// can point it at a local upstream.
async fn proxy_image(
    client: &reqwest::Client,
    url: &str,
    origin: Option<&str>,
) -> http::Response<Body> {
    match forward_image(client, url, origin).await {
        Ok(response) => response,
        // Debug on both: with YouTube unreachable every card on a search page
        // would log a line, and the search itself already reports the fault.
        Err(ImageError::Request(e)) => {
            log::debug!("media ytimg: request failed: {e}");
            status_response(502, origin)
        }
        Err(ImageError::Status(status)) => {
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
        let resp = serve_image(&reqwest::Client::new(), "https://evil.example/x.jpg", None).await;

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

        let resp = proxy_image(&reqwest::Client::new(), &upstream, None).await;

        assert_eq!(resp.status(), 502);
    }
}
