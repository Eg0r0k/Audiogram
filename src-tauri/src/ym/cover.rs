//! The `/{token}/ym/cover/<cover uri>?size=<px>` route: Yandex cover art
//! fetched by the Rust side, so `<img>` loads honour the app proxy and the
//! canvas stays untainted for palette extraction.

use crate::media_server::{forward_image, status_response, Body, ImageError};

/// Hosts a cover ref may name. The ref is frontend-supplied: without this
/// allowlist the route would be an open proxy.
const ALLOWED_HOSTS: &[&str] = &["avatars.yandex.net", "avatars.mds.yandex.net"];

/// Renditions Yandex serves; a request is rounded up to the next one.
const SIZES: &[u32] = &[100, 200, 300, 400, 500, 700, 1000];
const DEFAULT_SIZE: u32 = 300;

fn rendition(requested: Option<u32>) -> Option<u32> {
    let wanted = requested.unwrap_or(DEFAULT_SIZE);
    SIZES.iter().copied().find(|size| *size >= wanted)
}

fn size_of(query: Option<&str>) -> Option<u32> {
    query?
        .split('&')
        .find_map(|pair| pair.strip_prefix("size="))?
        .parse()
        .ok()
}

/// The https URL for a cover ref (`avatars.yandex.net/…/%%[?ver]`) at a
/// size — or `None` when the ref names another host, carries a scheme or
/// has no size placeholder to fill.
pub fn cover_url(cover_ref: &str, size: Option<u32>) -> Option<String> {
    if cover_ref.contains("://") {
        return None;
    }
    let (host, _) = cover_ref.split_once('/')?;
    if !ALLOWED_HOSTS.contains(&host) {
        return None;
    }
    if !cover_ref.contains("%%") {
        return None;
    }
    let px = rendition(size)?;
    Some(format!(
        "https://{}",
        cover_ref.replace("%%", &format!("{px}x{px}"))
    ))
}

/// `ym/cover/<ref>`: 404 outside the allowlist or for an unknown size,
/// otherwise the image streams through with cacheable headers.
pub(crate) async fn serve_cover(
    client: &reqwest::Client,
    cover_ref: &str,
    query: Option<&str>,
    origin: Option<&str>,
) -> http::Response<Body> {
    let size = match query {
        // A size that does not parse is a bad request, not "no size".
        Some(q) if q.contains("size=") => match size_of(Some(q)) {
            Some(px) => Some(px),
            None => return status_response(404, origin),
        },
        _ => None,
    };
    let Some(url) = cover_url(cover_ref, size) else {
        return status_response(404, origin);
    };
    match forward_image(client, &url, origin).await {
        Ok(response) => response,
        // Debug on both: a missing cover 404s on every remount and a dead
        // network already shows up on the track route.
        Err(ImageError::Request(e)) => {
            log::debug!("media ym/cover: request failed: {e}");
            status_response(502, origin)
        }
        Err(ImageError::Status(status)) => {
            log::debug!("media ym/cover: upstream status {status}");
            status_response(502, origin)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn builds_https_urls_for_allowed_hosts_at_a_served_rendition() {
        assert_eq!(
            cover_url(
                "avatars.yandex.net/get-music-content/95061/4f3808a0.a.5307396-3/%%",
                Some(226)
            )
            .as_deref(),
            Some("https://avatars.yandex.net/get-music-content/95061/4f3808a0.a.5307396-3/300x300")
        );
        assert_eq!(
            cover_url("avatars.mds.yandex.net/get-music-content/1/x/%%", None).as_deref(),
            Some("https://avatars.mds.yandex.net/get-music-content/1/x/300x300")
        );
        // Playlist covers carry a cache-busting query after the placeholder.
        assert_eq!(
            cover_url("avatars.yandex.net/get-music-user-playlist/10311229/s9xdf1jvxpHCJj/%%?1709726510822", Some(1000)).as_deref(),
            Some("https://avatars.yandex.net/get-music-user-playlist/10311229/s9xdf1jvxpHCJj/1000x1000?1709726510822")
        );
    }

    #[test]
    fn refuses_other_hosts_schemes_missing_placeholders_and_oversized_requests() {
        assert_eq!(
            cover_url("evil.example/avatars.yandex.net/%%", Some(300)),
            None
        );
        assert_eq!(
            cover_url("https://avatars.yandex.net/x/%%", Some(300)),
            None
        );
        assert_eq!(
            cover_url("avatars.yandex.net.evil.example/x/%%", Some(300)),
            None
        );
        assert_eq!(cover_url("avatars.yandex.net/x/300x300", Some(300)), None);
        assert_eq!(cover_url("avatars.yandex.net", Some(300)), None);
        assert_eq!(cover_url("avatars.yandex.net/x/%%", Some(4000)), None);
    }

    #[tokio::test]
    async fn the_route_answers_404_before_any_request_for_a_bad_ref_or_size() {
        let client = reqwest::Client::new();

        let foreign = serve_cover(&client, "evil.example/x/%%", Some("size=300"), None).await;
        assert_eq!(foreign.status(), 404);

        let bad_size =
            serve_cover(&client, "avatars.yandex.net/x/%%", Some("size=big"), None).await;
        assert_eq!(bad_size.status(), 404);

        let too_big =
            serve_cover(&client, "avatars.yandex.net/x/%%", Some("size=9999"), None).await;
        assert_eq!(too_big.status(), 404);
    }
}
