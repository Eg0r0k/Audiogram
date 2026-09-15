//! Loopback HTTP media server — the transport for all audio (and proxied
//! covers) on every platform.
//!
//! Replaces the `stream://` custom protocol: wry cannot stream custom-protocol
//! bodies (on Android the whole body is materialized into one Java `byte[]`,
//! which OOMs on large files), while a real HTTP server on `127.0.0.1` gives
//! the media element honest Range semantics and true streaming.
//!
//! Bound to `127.0.0.1:0` (random port) BEFORE the webview starts; every
//! request path must begin with a per-launch random token segment:
//! `/{token}/local/<enc path>`, `/{token}/nd/song/<id>`,
//! `/{token}/nd/cover/<id>?size=<px>`, `/{token}/yt/<videoId>`,
//! `/{token}/ytimg/<enc https url>`.

mod local;
mod primitives;
mod remote;
mod server;

#[cfg(test)]
pub(crate) use primitives::new_token;
pub(crate) use primitives::{
    cors, file_extension, forward_image, forward_stream, memory_range_response, status_response,
    ImageError,
};
pub use server::{bind_on_loopback, spawn};

use http_body_util::combinators::BoxBody;

/// Response body: either a buffered chunk or a stream (local-file spans,
/// pass-through upstream bodies).
pub(crate) type Body = BoxBody<bytes::Bytes, std::io::Error>;

/// Bound addresses + the per-launch path token, managed as tauri state and
/// handed to the frontend via the `media_server_base` / `image_server_base`
/// commands.
///
/// Two ports, one server: the webview allows six HTTP/1.1 connections per
/// host, and a burst of proxied covers (a few remote pages opened in a row,
/// an upstream or a proxy that answers slowly) held all six — the media
/// element's own request for a LOCAL file then queued behind them for as
/// long as those covers took to fail. Images on their own origin get their
/// own pool; audio never waits for a cover.
pub struct MediaServerState {
    pub port: u16,
    pub image_port: u16,
    pub token: String,
}

/// The frontend prefixes every audio URL with this base:
/// `http://127.0.0.1:{port}/{token}`. Queried once at bootstrap (top-level
/// await in main.ts) — the socket is bound before the webview exists, so
/// this can never race server readiness.
#[tauri::command]
pub fn media_server_base(state: tauri::State<'_, MediaServerState>) -> String {
    format!("http://127.0.0.1:{}/{}", state.port, state.token)
}

/// Same server, same routes, second port: the base for proxied covers and
/// thumbnails (see [`MediaServerState`]).
#[tauri::command]
pub fn image_server_base(state: tauri::State<'_, MediaServerState>) -> String {
    format!("http://127.0.0.1:{}/{}", state.image_port, state.token)
}

#[cfg(test)]
pub(crate) mod test_support {
    use http_body_util::Full;

    /// Minimal in-process upstream: every request goes through `handler`,
    /// which sees the full request head. Returns the upstream's base URL.
    pub(crate) async fn spawn_upstream<F>(handler: F) -> String
    where
        F: Fn(&http::Request<hyper::body::Incoming>) -> http::Response<Full<bytes::Bytes>>
            + Clone
            + Send
            + Sync
            + 'static,
    {
        let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
            .await
            .expect("bind upstream");
        let base = format!(
            "http://127.0.0.1:{}",
            listener.local_addr().expect("addr").port()
        );
        tokio::spawn(async move {
            loop {
                let Ok((stream, _addr)) = listener.accept().await else {
                    break;
                };
                let handler = handler.clone();
                tokio::spawn(async move {
                    let service = hyper::service::service_fn(move |req| {
                        let handler = handler.clone();
                        async move { Ok::<_, std::convert::Infallible>(handler(&req)) }
                    });
                    let _ = hyper::server::conn::http1::Builder::new()
                        .serve_connection(hyper_util::rt::TokioIo::new(stream), service)
                        .await;
                });
            }
        });
        base
    }
}

#[cfg(test)]
mod integration_tests {
    use std::io::Write;

    use http_body_util::{BodyExt, Full};

    use super::remote::RemoteRoutes;
    use super::server::run_accept_loop;
    use super::*;

    /// Remote stub: knows no routes — everything lands on the core's 404,
    /// which is exactly what the core-mechanics tests need.
    #[derive(Clone)]
    struct NoRemote;

    impl RemoteRoutes for NoRemote {
        async fn dispatch(
            &self,
            _rest: String,
            _query: Option<String>,
            _range: Option<String>,
            _origin: Option<String>,
        ) -> Option<http::Response<Body>> {
            None
        }
    }

    /// Real server on `:0` + the current-runtime accept loop; returns the
    /// base URL and the token.
    async fn spawn_test_server() -> (String, String) {
        let (listener, _image_listener, state) = bind_on_loopback().expect("bind loopback");
        listener.set_nonblocking(true).expect("nonblocking");
        let tokio_listener = tokio::net::TcpListener::from_std(listener).expect("tokio listener");
        let base = format!("http://127.0.0.1:{}", state.port);
        let token = state.token.clone();
        let cache = std::env::temp_dir().join(format!("media-server-test-cache-{}", new_token()));
        tokio::spawn(run_accept_loop(
            NoRemote,
            state.token,
            Some(cache),
            tokio_listener,
        ));
        (base, token)
    }

    fn temp_audio_file(bytes: &[u8]) -> std::path::PathBuf {
        let dir = std::env::temp_dir();
        let path = dir.join(format!("media-server-test-{}.mp3", new_token()));
        let mut file = std::fs::File::create(&path).expect("create temp file");
        file.write_all(bytes).expect("write temp file");
        path
    }

    fn encode_path(path: &std::path::Path) -> String {
        let normalized = path.to_string_lossy().replace('\\', "/");
        percent_encoding::utf8_percent_encode(&normalized, percent_encoding::NON_ALPHANUMERIC)
            .to_string()
    }

    const FILE_BODY: &[u8] = b"0123456789abcdefghij"; // 20 bytes

    #[tokio::test]
    async fn serves_the_whole_file_as_200() {
        let (base, token) = spawn_test_server().await;
        let path = temp_audio_file(FILE_BODY);

        let resp = reqwest::get(format!("{base}/{token}/local/{}", encode_path(&path)))
            .await
            .expect("request");

        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers()["Content-Type"], "audio/mpeg");
        assert_eq!(resp.headers()["Accept-Ranges"], "bytes");
        assert_eq!(resp.headers()["Cache-Control"], "no-store");
        assert_eq!(resp.headers()["Access-Control-Allow-Origin"], "*");
        assert_eq!(resp.bytes().await.expect("body").as_ref(), FILE_BODY);
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn serves_an_open_range_as_206_with_content_range() {
        let (base, token) = spawn_test_server().await;
        let path = temp_audio_file(FILE_BODY);

        let client = reqwest::Client::new();
        let resp = client
            .get(format!("{base}/{token}/local/{}", encode_path(&path)))
            .header("Range", "bytes=10-")
            .send()
            .await
            .expect("request");

        assert_eq!(resp.status(), 206);
        assert_eq!(resp.headers()["Content-Range"], "bytes 10-19/20");
        // Content-Range is not CORS-safelisted — without the expose header
        // scripted readers (fetch) on the webview origin cannot see it.
        assert_eq!(
            resp.headers()["Access-Control-Expose-Headers"],
            "Content-Range, Accept-Ranges, Content-Length",
        );
        assert_eq!(resp.bytes().await.expect("body").as_ref(), &FILE_BODY[10..]);
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn serves_explicit_and_suffix_ranges() {
        let (base, token) = spawn_test_server().await;
        let path = temp_audio_file(FILE_BODY);
        let client = reqwest::Client::new();
        let url = format!("{base}/{token}/local/{}", encode_path(&path));

        let explicit = client
            .get(&url)
            .header("Range", "bytes=5-9")
            .send()
            .await
            .expect("explicit");
        assert_eq!(explicit.status(), 206);
        assert_eq!(explicit.headers()["Content-Range"], "bytes 5-9/20");
        assert_eq!(
            explicit.bytes().await.expect("body").as_ref(),
            &FILE_BODY[5..=9]
        );

        let suffix = client
            .get(&url)
            .header("Range", "bytes=-4")
            .send()
            .await
            .expect("suffix");
        assert_eq!(suffix.status(), 206);
        assert_eq!(suffix.headers()["Content-Range"], "bytes 16-19/20");
        assert_eq!(
            suffix.bytes().await.expect("body").as_ref(),
            &FILE_BODY[16..]
        );
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn range_past_eof_is_416_with_total() {
        let (base, token) = spawn_test_server().await;
        let path = temp_audio_file(FILE_BODY);

        let client = reqwest::Client::new();
        let resp = client
            .get(format!("{base}/{token}/local/{}", encode_path(&path)))
            .header("Range", "bytes=20-")
            .send()
            .await
            .expect("request");

        assert_eq!(resp.status(), 416);
        assert_eq!(resp.headers()["Content-Range"], "bytes */20");
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn answers_cors_preflight_for_range_requests() {
        // Suffix ranges (`bytes=-N`) are not CORS-safelisted, so a scripted
        // fetch preflights with OPTIONS before the GET.
        let (base, token) = spawn_test_server().await;

        let client = reqwest::Client::new();
        let resp = client
            .request(reqwest::Method::OPTIONS, format!("{base}/{token}/local/x"))
            .header("Origin", "http://tauri.localhost")
            .header("Access-Control-Request-Method", "GET")
            .header("Access-Control-Request-Headers", "range")
            .send()
            .await
            .expect("preflight");

        assert_eq!(resp.status(), 204);
        assert_eq!(
            resp.headers()["Access-Control-Allow-Origin"],
            "http://tauri.localhost"
        );
        assert_eq!(resp.headers()["Access-Control-Allow-Methods"], "GET");
        assert_eq!(resp.headers()["Access-Control-Allow-Headers"], "Range");
    }

    fn fixture(name: &str) -> std::path::PathBuf {
        std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("tests/fixtures")
            .join(name)
    }

    #[tokio::test]
    async fn alac_m4a_is_served_as_transcoded_wav() {
        let (base, token) = spawn_test_server().await;
        let url = format!(
            "{base}/{token}/local/{}",
            encode_path(&fixture("tiny-alac.m4a"))
        );

        let resp = reqwest::get(&url).await.expect("request");
        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers()["Content-Type"], "audio/wav");
        assert_eq!(resp.headers()["Accept-Ranges"], "bytes");
        let total: u64 = resp.headers()["Content-Length"]
            .to_str()
            .unwrap()
            .parse()
            .unwrap();
        let body = resp.bytes().await.expect("body");
        assert_eq!(&body[..4], b"RIFF");
        assert_eq!(body.len() as u64, total);

        let client = reqwest::Client::new();
        let tail = client
            .get(&url)
            .header("Range", format!("bytes={}-", total - 4))
            .send()
            .await
            .expect("range request");
        assert_eq!(tail.status(), 206);
        assert_eq!(
            tail.headers()["Content-Range"].to_str().unwrap(),
            format!("bytes {}-{}/{}", total - 4, total - 1, total),
        );
        assert_eq!(
            tail.bytes().await.expect("body").as_ref(),
            &body[body.len() - 4..]
        );
    }

    #[tokio::test]
    async fn ape_is_served_as_transcoded_wav() {
        let (base, token) = spawn_test_server().await;
        let url = format!(
            "{base}/{token}/local/{}",
            encode_path(&fixture("tiny-impulse.ape"))
        );

        let resp = reqwest::get(&url).await.expect("request");
        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers()["Content-Type"], "audio/wav");
        let body = resp.bytes().await.expect("body");
        assert_eq!(&body[..4], b"RIFF");
        // 1.0s of 16-bit 44.1kHz stereo PCM behind a 44-byte header.
        assert_eq!(body.len(), 44 + 44100 * 2 * 2);
    }

    #[tokio::test]
    async fn aac_m4a_is_served_raw() {
        let (base, token) = spawn_test_server().await;
        let path = fixture("tiny-aac.m4a");
        let size = std::fs::metadata(&path).expect("fixture size").len();

        let resp = reqwest::get(format!("{base}/{token}/local/{}", encode_path(&path)))
            .await
            .expect("request");
        assert_eq!(resp.status(), 200);
        assert_eq!(resp.headers()["Content-Type"], "audio/mp4");
        assert_eq!(resp.bytes().await.expect("body").len() as u64, size);
    }

    #[tokio::test]
    async fn wrong_token_is_a_plain_404() {
        let (base, _token) = spawn_test_server().await;
        let path = temp_audio_file(FILE_BODY);

        let resp = reqwest::get(format!("{base}/deadbeef/local/{}", encode_path(&path)))
            .await
            .expect("request");

        assert_eq!(resp.status(), 404);
        let _ = std::fs::remove_file(path);
    }

    #[tokio::test]
    async fn traversal_and_unc_paths_are_403() {
        let (base, token) = spawn_test_server().await;
        let client = reqwest::Client::new();

        let traversal = client
            .get(format!("{base}/{token}/local/%2Fdata%2F..%2Fetc%2Fpasswd"))
            .send()
            .await
            .expect("traversal");
        assert_eq!(traversal.status(), 403);

        let unc = client
            .get(format!("{base}/{token}/local/%2F%2Fserver%2Fshare%2Fa.mp3"))
            .send()
            .await
            .expect("unc");
        assert_eq!(unc.status(), 403);
    }

    #[tokio::test]
    async fn missing_file_is_404_and_unknown_route_is_404() {
        let (base, token) = spawn_test_server().await;
        let client = reqwest::Client::new();

        let missing = client
            .get(format!(
                "{base}/{token}/local/C%3A%2Fdoes-not-exist%2Fx.mp3"
            ))
            .send()
            .await
            .expect("missing");
        assert_eq!(missing.status(), 404);

        let unknown = client
            .get(format!("{base}/{token}/nope/what"))
            .send()
            .await
            .expect("unknown");
        assert_eq!(unknown.status(), 404);
    }

    // ── forward_stream ───────────────────────────────────────────────

    #[tokio::test]
    async fn forward_stream_propagates_status_headers_and_body() {
        let upstream = test_support::spawn_upstream(|_req| {
            http::Response::builder()
                .status(206)
                .header("Content-Type", "audio/flac")
                .header("Content-Range", "bytes 5-9/100")
                .body(Full::new(bytes::Bytes::from_static(b"56789")))
                .expect("upstream response")
        })
        .await;

        let resp = forward_stream(
            &reqwest::Client::new(),
            &format!("{upstream}/rest/stream.view"),
            &[],
            Some("bytes=5-9".into()),
            None,
            Some("http://tauri.localhost"),
        )
        .await
        .expect("forwarded");

        assert_eq!(resp.status(), 206);
        assert_eq!(resp.headers()["Content-Type"], "audio/flac");
        assert_eq!(resp.headers()["Content-Range"], "bytes 5-9/100");
        assert_eq!(resp.headers()["Accept-Ranges"], "bytes");
        assert_eq!(resp.headers()["Cache-Control"], "no-store");
        assert_eq!(
            resp.headers()["Access-Control-Allow-Origin"],
            "http://tauri.localhost"
        );
        let body = resp.into_body().collect().await.expect("body").to_bytes();
        assert_eq!(body.as_ref(), b"56789");
    }

    #[tokio::test]
    async fn forward_stream_caps_open_ranges_and_forwards_request_headers() {
        // The upstream echoes what it received so the test can see the
        // capped Range and the custom header arrive.
        let upstream = test_support::spawn_upstream(|req| {
            let range = req
                .headers()
                .get("Range")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("none")
                .to_owned();
            let marker = req
                .headers()
                .get("X-Test")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("none")
                .to_owned();
            http::Response::builder()
                .status(200)
                .body(Full::new(bytes::Bytes::from(format!("{range}|{marker}"))))
                .expect("upstream response")
        })
        .await;

        let client = reqwest::Client::new();
        let capped = forward_stream(
            &client,
            &upstream,
            &[("X-Test".into(), "1".into())],
            Some("bytes=0-".into()),
            Some(1024),
            None,
        )
        .await
        .expect("capped");
        let body = capped.into_body().collect().await.expect("body").to_bytes();
        assert_eq!(body.as_ref(), b"bytes=0-1023|1");

        let uncapped = forward_stream(&client, &upstream, &[], Some("bytes=0-".into()), None, None)
            .await
            .expect("uncapped");
        let body = uncapped
            .into_body()
            .collect()
            .await
            .expect("body")
            .to_bytes();
        assert_eq!(body.as_ref(), b"bytes=0-|none");
    }

    #[tokio::test]
    async fn reflects_a_known_origin_with_vary() {
        let (base, token) = spawn_test_server().await;
        let path = temp_audio_file(FILE_BODY);

        let client = reqwest::Client::new();
        let resp = client
            .get(format!("{base}/{token}/local/{}", encode_path(&path)))
            .header("Origin", "http://tauri.localhost")
            .send()
            .await
            .expect("request");

        assert_eq!(
            resp.headers()["Access-Control-Allow-Origin"],
            "http://tauri.localhost"
        );
        assert_eq!(resp.headers()["Vary"], "Origin");
        let _ = std::fs::remove_file(path);
    }
}
