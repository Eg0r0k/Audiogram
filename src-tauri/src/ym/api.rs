//! `ym_request`: the one door from the webview to `api.music.yandex.net`.
//! The token is attached here and only here; the path must match the
//! allowlist, a 401 gets one refresh, a 429 comes back with its wait.

use std::collections::BTreeMap;

use tauri::{AppHandle, Manager, Runtime};

use super::auth::{drop_session, expires_at_from, persist_session, refresh_access_token};
use super::state::{YmSession, YmState, CLIENT_HEADER_NAME, CLIENT_HEADER_VALUE};

/// Failure class, serialized SCREAMING_SNAKE_CASE — one-to-one with the
/// frontend's `SourceErrorKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum YmErrorKind {
    /// Not signed in, or the token stopped working and could not be refreshed.
    Auth,
    /// Signed in, but the account lacks the right (no Plus for a download).
    Forbidden,
    RateLimited,
    NotFound,
    Network,
    /// The endpoint is off-limits here, or Yandex answered 5xx.
    Unavailable,
    /// A download the user cancelled — the manager drops the job on this.
    Cancelled,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YmError {
    pub kind: YmErrorKind,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after_ms: Option<u64>,
}

impl YmError {
    pub fn new(kind: YmErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
            retry_after_ms: None,
        }
    }

    pub fn auth(message: impl Into<String>) -> Self {
        Self::new(YmErrorKind::Auth, message)
    }

    pub fn network(message: impl Into<String>) -> Self {
        Self::new(YmErrorKind::Network, message)
    }

    pub fn unavailable(message: impl Into<String>) -> Self {
        Self::new(YmErrorKind::Unavailable, message)
    }

    pub fn unknown(message: impl Into<String>) -> Self {
        Self::new(YmErrorKind::Unknown, message)
    }

    /// Classifies an upstream answer. `body` is the raw text: the API wraps
    /// its errors as `{"error": {"name", "message"}}`, which is the message
    /// worth showing; anything else falls back to the status.
    pub fn from_status(status: u16, body: &str, retry_after_ms: Option<u64>) -> Self {
        let message =
            api_error_message(body).unwrap_or_else(|| format!("upstream status {status}"));
        let kind = match status {
            401 => YmErrorKind::Auth,
            403 => YmErrorKind::Forbidden,
            404 => YmErrorKind::NotFound,
            429 => YmErrorKind::RateLimited,
            500..=599 => YmErrorKind::Unavailable,
            _ => YmErrorKind::Unknown,
        };
        Self {
            kind,
            message,
            retry_after_ms: if status == 429 { retry_after_ms } else { None },
        }
    }
}

impl std::fmt::Display for YmError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

/// Helper errors (proxy config, paths) arrive as strings.
impl From<String> for YmError {
    fn from(message: String) -> Self {
        Self::unknown(message)
    }
}

fn api_error_message(body: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(body).ok()?;
    let error = json.get("error")?;
    error["message"]
        .as_str()
        .filter(|message| !message.is_empty())
        .or_else(|| error["name"].as_str())
        .or_else(|| error.as_str())
        .map(str::to_owned)
}

/// A request as the frontend describes it. `{uid}` in the path stands for
/// the signed-in account; the frontend never learns or passes the uid.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YmRequest {
    #[serde(default = "default_method")]
    pub method: String,
    pub path: String,
    #[serde(default)]
    pub query: BTreeMap<String, String>,
    #[serde(default)]
    pub form: Option<BTreeMap<String, String>>,
    /// A JSON body; rotor feedback is validated as one and refuses a form.
    #[serde(default)]
    pub json: Option<serde_json::Value>,
}

fn default_method() -> String {
    "GET".into()
}

/// Paths `ym_request` may reach. `{uid}` must be the signed-in account,
/// `{*}` any single segment. Nothing else passes — the webview must not be
/// able to point the user's token at an arbitrary endpoint.
const ALLOWED_PATHS: &[&str] = &[
    "/account/status",
    "/users/{uid}/likes/tracks",
    "/users/{uid}/likes/albums",
    "/users/{uid}/likes/artists",
    "/users/{uid}/likes/playlists",
    "/users/{uid}/likes/tracks/add-multiple",
    "/users/{uid}/likes/tracks/remove",
    "/users/{uid}/likes/artists/add-multiple",
    "/users/{uid}/likes/artists/remove",
    "/users/{uid}/likes/albums/add-multiple",
    "/users/{uid}/likes/albums/remove",
    "/users/{uid}/likes/playlists/add-multiple",
    "/users/{uid}/likes/playlists/remove",
    "/users/{uid}/playlists/{*}/delete",
    "/users/{uid}/playlists/list",
    "/users/{*}/playlists/{*}",
    "/albums/{*}/with-tracks",
    "/artists/{*}/brief-info",
    "/artists/{*}/direct-albums",
    "/tracks",
    "/tracks/{*}/download-info",
    "/tracks/{*}/lyrics",
    "/search",
    "/search/suggest",
    "/rotor/station/{*}/tracks",
    "/rotor/station/{*}/feedback",
];

/// Yandex ids are numeric, stations look like `user:onyourwave` — no dots,
/// so `.` and `..` never pass as an id.
fn is_plain_segment(segment: &str) -> bool {
    !segment.is_empty()
        && segment
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || matches!(b, b'_' | b'-' | b':'))
}

fn matches_template(template: &str, path: &str, uid: &str) -> bool {
    let mut expected = template.split('/');
    let mut actual = path.split('/');
    loop {
        match (expected.next(), actual.next()) {
            (None, None) => return true,
            (Some("{uid}"), Some(segment)) if segment == uid => {}
            (Some("{*}"), Some(segment)) if is_plain_segment(segment) => {}
            (Some(literal), Some(segment)) if literal == segment && !literal.starts_with('{') => {}
            _ => return false,
        }
    }
}

/// The path with `{uid}` filled in, or `None` when it is off the allowlist.
pub fn allowed_path(path: &str, uid: u64) -> Option<String> {
    let uid = uid.to_string();
    let resolved = path.replace("{uid}", &uid);
    ALLOWED_PATHS
        .iter()
        .any(|template| matches_template(template, &resolved, &uid))
        .then_some(resolved)
}

/// How a call left the session behind, for the command to persist.
#[derive(Debug)]
pub enum SessionChange {
    Unchanged,
    Refreshed(YmSession),
    Lost,
}

pub struct CallOutcome {
    pub result: Result<serde_json::Value, YmError>,
    pub session: SessionChange,
}

fn retry_after_ms(headers: &reqwest::header::HeaderMap) -> Option<u64> {
    headers
        .get(reqwest::header::RETRY_AFTER)?
        .to_str()
        .ok()?
        .trim()
        .parse::<u64>()
        .ok()
        .map(|secs| secs * 1000)
}

async fn send(
    client: &reqwest::Client,
    api_base: &str,
    session: &YmSession,
    req: &YmRequest,
    path: &str,
) -> Result<serde_json::Value, YmError> {
    let url = format!("{api_base}{path}");
    let mut request = if req.method.eq_ignore_ascii_case("POST") {
        client.post(&url)
    } else {
        client.get(&url)
    };
    request = request
        .header(reqwest::header::AUTHORIZATION, session.authorization())
        .header(CLIENT_HEADER_NAME, CLIENT_HEADER_VALUE);
    if !req.query.is_empty() {
        request = request.query(&req.query);
    }
    if let Some(form) = &req.form {
        request = request.form(form);
    }
    if let Some(body) = &req.json {
        request = request.json(body);
    }

    let resp = request
        .send()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    let status = resp.status().as_u16();
    let retry_after = retry_after_ms(resp.headers());
    let body = resp
        .text()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    log::debug!("ym {} {path}: {status}", req.method);

    if !(200..300).contains(&status) {
        return Err(YmError::from_status(status, &body, retry_after));
    }
    let mut json: serde_json::Value =
        serde_json::from_str(&body).map_err(|e| YmError::unknown(format!("response: {e}")))?;
    Ok(match json.get_mut("result") {
        Some(result) => result.take(),
        None => json,
    })
}

/// The whole exchange for one request against a live state: allowlist,
/// uid substitution, the concurrency gate, one refresh on 401.
pub async fn call(state: &YmState, client: &reqwest::Client, req: &YmRequest) -> CallOutcome {
    let unchanged = |result| CallOutcome {
        result,
        session: SessionChange::Unchanged,
    };

    let Some(session) = state.session() else {
        return unchanged(Err(YmError::auth("not signed in to Yandex Music")));
    };
    let Some(path) = allowed_path(&req.path, session.uid) else {
        return unchanged(Err(YmError::unavailable(format!(
            "endpoint is not allowed: {}",
            req.path
        ))));
    };

    let _permit = state.permits.acquire().await;
    let api_base = &state.endpoints.api;
    let first = send(client, api_base, &session, req, &path).await;
    let Err(error) = &first else {
        return unchanged(first);
    };
    if error.kind != YmErrorKind::Auth {
        return unchanged(first);
    }

    // One refresh, one retry; a session that still fails is over.
    let Some(refresh) = session.refresh_token() else {
        state.set_session(None);
        return CallOutcome {
            result: Err(YmError::auth("session expired")),
            session: SessionChange::Lost,
        };
    };
    let refreshed = match refresh_access_token(client, &state.endpoints.oauth, refresh).await {
        Ok(token) => session.with_tokens(
            &token.access_token,
            token.refresh_token.as_deref(),
            expires_at_from(token.expires_in),
        ),
        Err(_) => {
            state.set_session(None);
            return CallOutcome {
                result: Err(YmError::auth("session expired")),
                session: SessionChange::Lost,
            };
        }
    };
    state.set_session(Some(refreshed.clone()));

    let second = send(client, api_base, &refreshed, req, &path).await;
    match &second {
        Err(e) if e.kind == YmErrorKind::Auth => {
            state.set_session(None);
            CallOutcome {
                result: Err(YmError::auth("session expired")),
                session: SessionChange::Lost,
            }
        }
        _ => CallOutcome {
            result: second,
            session: SessionChange::Refreshed(refreshed),
        },
    }
}

/// Runs an allowlisted API request with the signed-in account's token and
/// returns the `result` of the response envelope.
#[tauri::command]
pub async fn ym_request<R: Runtime>(
    app: AppHandle<R>,
    req: YmRequest,
) -> Result<serde_json::Value, YmError> {
    super::state::load_session_if_needed(&app);
    let client = crate::proxy::http_client(&app)?;
    let state = app.state::<YmState>();
    let outcome = call(&state, &client, &req).await;
    match outcome.session {
        SessionChange::Unchanged => {}
        SessionChange::Refreshed(session) => persist_session(&app, &session),
        SessionChange::Lost => drop_session(&app),
    }
    outcome.result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::media_server::test_support::spawn_upstream;
    use http_body_util::Full;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    fn json(status: u16, body: &'static str) -> http::Response<Full<bytes::Bytes>> {
        http::Response::builder()
            .status(status)
            .header("Content-Type", "application/json")
            .body(Full::new(bytes::Bytes::from_static(body.as_bytes())))
            .expect("response")
    }

    fn signed_in(upstream: &str) -> YmState {
        let state = YmState::with_endpoints(upstream, upstream);
        state.set_session(Some(YmSession::new(
            42,
            true,
            "Tester",
            "tok-old",
            Some("refresh-1"),
            None,
        )));
        state
    }

    fn get(path: &str) -> YmRequest {
        YmRequest {
            method: "GET".into(),
            path: path.into(),
            query: BTreeMap::new(),
            form: None,
            json: None,
        }
    }

    const LIKES: &str =
        r#"{"invocationInfo":{"req-id":"1"},"result":{"library":{"uid":42,"tracks":[]}}}"#;
    const NEW_TOKEN: &str =
        r#"{"access_token":"tok-new","refresh_token":"refresh-2","expires_in":3600}"#;

    #[test]
    fn the_allowlist_fills_in_the_uid_and_refuses_everything_else() {
        assert_eq!(
            allowed_path("/users/{uid}/likes/tracks", 42).as_deref(),
            Some("/users/42/likes/tracks")
        );
        assert_eq!(
            allowed_path("/albums/5307396/with-tracks", 42).as_deref(),
            Some("/albums/5307396/with-tracks")
        );
        assert_eq!(
            allowed_path("/rotor/station/user:onyourwave/tracks", 42).as_deref(),
            Some("/rotor/station/user:onyourwave/tracks")
        );
        assert_eq!(
            allowed_path("/artists/41075/direct-albums", 42).as_deref(),
            Some("/artists/41075/direct-albums")
        );
        assert_eq!(
            allowed_path("/users/457553308/playlists/41075", 42).as_deref(),
            Some("/users/457553308/playlists/41075")
        );
        for path in [
            "/users/{uid}/likes/artists/add-multiple",
            "/users/{uid}/likes/artists/remove",
            "/users/{uid}/likes/albums/add-multiple",
            "/users/{uid}/likes/albums/remove",
            "/users/{uid}/likes/playlists/add-multiple",
            "/users/{uid}/likes/playlists/remove",
        ] {
            assert_eq!(
                allowed_path(path, 42).as_deref(),
                Some(path.replace("{uid}", "42").as_str()),
                "{path}"
            );
        }
        assert_eq!(
            allowed_path("/users/{uid}/playlists/1000/delete", 42).as_deref(),
            Some("/users/42/playlists/1000/delete")
        );
        // Deleting under someone else's uid is not this account's playlist.
        assert_eq!(allowed_path("/users/7/playlists/1000/delete", 42), None);

        // Another account's likes, arbitrary endpoints, traversal, trailing junk.
        assert_eq!(allowed_path("/users/7/likes/tracks", 42), None);
        assert_eq!(allowed_path("/account/settings", 42), None);
        assert_eq!(allowed_path("/albums/../with-tracks", 42), None);
        assert_eq!(allowed_path("/albums//with-tracks", 42), None);
        assert_eq!(allowed_path("/tracks/1/download-info/extra", 42), None);
        assert_eq!(
            allowed_path("/albums/{uid}/with-tracks/../../account/x", 42),
            None
        );
    }

    #[tokio::test]
    async fn a_path_outside_the_allowlist_never_reaches_the_network() {
        let hits = Arc::new(AtomicUsize::new(0));
        let seen = Arc::clone(&hits);
        let upstream = spawn_upstream(move |_req| {
            seen.fetch_add(1, Ordering::SeqCst);
            json(200, LIKES)
        })
        .await;
        let state = signed_in(&upstream);

        let outcome = call(&state, &reqwest::Client::new(), &get("/account/settings")).await;

        assert_eq!(outcome.result.unwrap_err().kind, YmErrorKind::Unavailable);
        assert_eq!(hits.load(Ordering::SeqCst), 0);
    }

    #[tokio::test]
    async fn without_a_session_the_call_is_an_auth_error_before_any_request() {
        let upstream = spawn_upstream(|_req| json(200, LIKES)).await;
        let state = YmState::with_endpoints(&upstream, &upstream);

        let outcome = call(&state, &reqwest::Client::new(), &get("/tracks")).await;

        assert_eq!(outcome.result.unwrap_err().kind, YmErrorKind::Auth);
    }

    #[tokio::test]
    async fn the_uid_is_filled_in_and_the_token_and_client_headers_travel() {
        let upstream = spawn_upstream(|req| {
            assert_eq!(req.uri().path(), "/users/42/likes/tracks");
            assert_eq!(req.uri().query(), Some("rich=true"));
            assert_eq!(req.headers()["Authorization"], "OAuth tok-old");
            assert_eq!(
                req.headers()["X-Yandex-Music-Client"],
                "YandexMusicAndroid/24023621"
            );
            json(200, LIKES)
        })
        .await;
        let state = signed_in(&upstream);
        let mut req = get("/users/{uid}/likes/tracks");
        req.query.insert("rich".into(), "true".into());

        let outcome = call(&state, &reqwest::Client::new(), &req).await;

        // The envelope is unwrapped: callers get `result`.
        assert_eq!(outcome.result.expect("result")["library"]["uid"], 42);
        assert!(matches!(outcome.session, SessionChange::Unchanged));
    }

    // Rotor feedback is validated as JSON: the same fields as a form come
    // back as 400 "condition is not met" with an empty message.
    #[tokio::test]
    async fn a_post_sends_a_json_body() {
        let upstream = spawn_upstream(|req| {
            assert_eq!(req.method(), http::Method::POST);
            assert_eq!(req.uri().path(), "/rotor/station/user:onyourwave/feedback");
            assert_eq!(req.headers()["Content-Type"], "application/json");
            json(200, r#"{"result":"ok"}"#)
        })
        .await;
        let state = signed_in(&upstream);
        let req = YmRequest {
            method: "POST".into(),
            path: "/rotor/station/user:onyourwave/feedback".into(),
            query: BTreeMap::new(),
            form: None,
            json: Some(
                serde_json::json!({ "type": "radioStarted", "timestamp": "2026-09-16T00:00:00Z" }),
            ),
        };

        let outcome = call(&state, &reqwest::Client::new(), &req).await;

        assert_eq!(outcome.result.expect("result"), "ok");
    }

    #[tokio::test]
    async fn a_post_sends_the_form_body() {
        let upstream = spawn_upstream(|req| {
            assert_eq!(req.method(), http::Method::POST);
            assert_eq!(req.uri().path(), "/users/42/likes/tracks/add-multiple");
            assert_eq!(
                req.headers()["Content-Type"],
                "application/x-www-form-urlencoded"
            );
            json(200, r#"{"result":"ok"}"#)
        })
        .await;
        let state = signed_in(&upstream);
        let req = YmRequest {
            method: "POST".into(),
            path: "/users/{uid}/likes/tracks/add-multiple".into(),
            query: BTreeMap::new(),
            form: Some(BTreeMap::from([("track-ids".to_owned(), "1,2".to_owned())])),
            json: None,
        };

        let outcome = call(&state, &reqwest::Client::new(), &req).await;

        assert_eq!(outcome.result.expect("result"), "ok");
    }

    #[tokio::test]
    async fn a_401_is_refreshed_once_and_the_request_retried_with_the_new_token() {
        let upstream = spawn_upstream(|req| match req.uri().path() {
            "/token" => json(200, NEW_TOKEN),
            _ if req.headers()["Authorization"] == "OAuth tok-old" => json(
                401,
                r#"{"error":{"name":"session-expired","message":"expired"}}"#,
            ),
            _ => json(200, LIKES),
        })
        .await;
        let state = signed_in(&upstream);

        let outcome = call(
            &state,
            &reqwest::Client::new(),
            &get("/users/{uid}/likes/tracks"),
        )
        .await;

        assert!(outcome.result.is_ok());
        let SessionChange::Refreshed(session) = outcome.session else {
            panic!("expected a refreshed session");
        };
        assert_eq!(session.authorization(), "OAuth tok-new");
        assert_eq!(session.refresh_token(), Some("refresh-2"));
        assert_eq!(session.uid, 42);
        assert_eq!(
            state.session().expect("live session").authorization(),
            "OAuth tok-new"
        );
    }

    #[tokio::test]
    async fn a_second_401_after_the_refresh_drops_the_session() {
        let upstream = spawn_upstream(|req| match req.uri().path() {
            "/token" => json(200, NEW_TOKEN),
            _ => json(
                401,
                r#"{"error":{"name":"session-expired","message":"expired"}}"#,
            ),
        })
        .await;
        let state = signed_in(&upstream);

        let outcome = call(
            &state,
            &reqwest::Client::new(),
            &get("/users/{uid}/likes/tracks"),
        )
        .await;

        assert_eq!(outcome.result.unwrap_err().kind, YmErrorKind::Auth);
        assert!(matches!(outcome.session, SessionChange::Lost));
        assert!(state.session().is_none());
    }

    #[tokio::test]
    async fn a_failed_refresh_drops_the_session_without_a_retry() {
        let calls = Arc::new(AtomicUsize::new(0));
        let seen = Arc::clone(&calls);
        let upstream = spawn_upstream(move |req| match req.uri().path() {
            "/token" => json(400, r#"{"error":"invalid_grant"}"#),
            _ => {
                seen.fetch_add(1, Ordering::SeqCst);
                json(401, "{}")
            }
        })
        .await;
        let state = signed_in(&upstream);

        let outcome = call(&state, &reqwest::Client::new(), &get("/tracks")).await;

        assert_eq!(outcome.result.unwrap_err().kind, YmErrorKind::Auth);
        assert!(matches!(outcome.session, SessionChange::Lost));
        assert!(state.session().is_none());
        assert_eq!(calls.load(Ordering::SeqCst), 1);
    }

    #[tokio::test]
    async fn a_429_carries_the_retry_after_as_milliseconds() {
        let upstream = spawn_upstream(|_req| {
            http::Response::builder()
                .status(429)
                .header("Retry-After", "3")
                .body(Full::new(bytes::Bytes::new()))
                .expect("response")
        })
        .await;
        let state = signed_in(&upstream);

        let error = call(&state, &reqwest::Client::new(), &get("/tracks"))
            .await
            .result
            .unwrap_err();

        assert_eq!(error.kind, YmErrorKind::RateLimited);
        assert_eq!(error.retry_after_ms, Some(3000));
        assert!(
            state.session().is_some(),
            "a rate limit is not a lost session"
        );
    }

    #[tokio::test]
    async fn status_codes_map_onto_the_shared_error_kinds_with_the_api_message() {
        for (status, body, kind, message) in [
            (
                403,
                r#"{"error":{"name":"not-allowed","message":"premium only"}}"#,
                YmErrorKind::Forbidden,
                "premium only",
            ),
            (404, "{}", YmErrorKind::NotFound, "upstream status 404"),
            (
                400,
                r#"{"error":{"name":"validate","message":"Parameters requirements are not met"}}"#,
                YmErrorKind::Unknown,
                "Parameters requirements are not met",
            ),
            // An empty message hides the cause; the name is the next best thing.
            (
                400,
                r#"{"error":{"name":"condition is not met","message":""}}"#,
                YmErrorKind::Unknown,
                "condition is not met",
            ),
            (
                502,
                "<html>bad gateway</html>",
                YmErrorKind::Unavailable,
                "upstream status 502",
            ),
        ] {
            let upstream = spawn_upstream(move |_req| json(status, body)).await;
            let state = signed_in(&upstream);

            let error = call(&state, &reqwest::Client::new(), &get("/tracks"))
                .await
                .result
                .unwrap_err();

            assert_eq!(error.kind, kind, "status {status}");
            assert_eq!(error.message, message, "status {status}");
            assert!(
                state.session().is_some(),
                "status {status} keeps the session"
            );
        }
    }

    #[test]
    fn the_error_serializes_in_the_frontend_vocabulary() {
        let error = YmError::from_status(429, "", Some(1500));
        let json = serde_json::to_value(&error).expect("json");

        assert_eq!(json["kind"], "RATE_LIMITED");
        assert_eq!(json["retryAfterMs"], 1500);

        let plain = serde_json::to_value(YmError::auth("nope")).expect("json");
        assert_eq!(plain["kind"], "AUTH");
        assert!(plain.get("retryAfterMs").is_none());
    }
}
