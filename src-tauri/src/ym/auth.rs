//! Sign-in through the OAuth device flow, the token refresh and the
//! `ym_auth_*` commands. Yandex confirms the code in a browser; this side
//! polls the token endpoint until then.

use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use tauri::{AppHandle, Emitter, Manager, Runtime};
use tokio_util::sync::CancellationToken;

use super::api::YmError;
use super::state::{
    auth_file, device_file, load_or_create_device_id, load_session_if_needed, remove_auth_file,
    write_auth_file, StoredAuth, YmSession, YmState, CLIENT_HEADER_NAME, CLIENT_HEADER_VALUE,
};

// The Android client's credentials. Yandex issues no music-scope OAuth
// credentials to third parties, so an app of our own cannot be registered;
// every unofficial client ships these same values, which is why they are a
// plain constant rather than a secret.
pub const CLIENT_ID: &str = "23cabbbdc6cd418abb4b39c32c41195d";
pub const CLIENT_SECRET: &str = "53bc75238f0c4d08a118e51fe9203300";

pub const AUTH_EVENT: &str = "ym:auth";

/// A `slow_down` answer asks for this much more between polls (RFC 8628).
const SLOW_DOWN_STEP: Duration = Duration::from_secs(5);

/// What the frontend hears about the sign-in.
#[derive(Clone, serde::Serialize)]
#[serde(rename_all = "camelCase", tag = "status")]
pub enum YmAuthEvent {
    Pending,
    Ok {
        uid: u64,
        has_plus: bool,
        display_name: String,
    },
    Cancelled,
    /// The user did not confirm before the device code expired.
    CodeExpired,
    /// The session stopped working and could not be refreshed — sign in again.
    Expired,
    Error {
        message: String,
    },
}

pub fn emit_auth<R: Runtime>(app: &AppHandle<R>, event: &YmAuthEvent) {
    if let Err(e) = app.emit(AUTH_EVENT, event) {
        log::warn!("ym: emitting {AUTH_EVENT} failed: {e}");
    }
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct YmAuthStatus {
    pub logged_in: bool,
    pub uid: Option<u64>,
    pub has_plus: bool,
    pub display_name: Option<String>,
}

impl From<Option<YmSession>> for YmAuthStatus {
    fn from(session: Option<YmSession>) -> Self {
        match session {
            Some(session) => Self {
                logged_in: true,
                uid: Some(session.uid),
                has_plus: session.has_plus,
                display_name: Some(session.display_name),
            },
            None => Self {
                logged_in: false,
                uid: None,
                has_plus: false,
                display_name: None,
            },
        }
    }
}

/// What the user needs to confirm the sign-in.
#[derive(Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YmDeviceCode {
    pub user_code: String,
    pub verification_url: String,
    pub expires_in: u64,
    pub interval: u64,
}

#[derive(serde::Deserialize)]
struct DeviceCodeResponse {
    device_code: String,
    user_code: String,
    verification_url: String,
    expires_in: u64,
    interval: u64,
}

#[derive(serde::Deserialize)]
pub struct TokenResponse {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_in: Option<u64>,
}

impl std::fmt::Debug for TokenResponse {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("TokenResponse")
            .field("expires_in", &self.expires_in)
            .field("has_refresh_token", &self.refresh_token.is_some())
            .finish_non_exhaustive()
    }
}

#[derive(serde::Deserialize)]
struct OauthError {
    error: String,
    error_description: Option<String>,
}

#[derive(Debug)]
pub struct AccountInfo {
    pub uid: u64,
    pub has_plus: bool,
    pub display_name: String,
}

/// How a poll ended without a token.
#[derive(Debug)]
pub enum PollEnd {
    Cancelled,
    Expired,
    Failed(YmError),
}

enum TokenFailure {
    Pending,
    SlowDown,
    Expired,
    Other(YmError),
}

fn device_name() -> &'static str {
    if cfg!(target_os = "android") {
        "Android"
    } else if cfg!(target_os = "ios") {
        "iOS"
    } else if cfg!(target_os = "windows") {
        "Windows"
    } else if cfg!(target_os = "macos") {
        "macOS"
    } else {
        "Linux"
    }
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

pub fn expires_at_from(expires_in: Option<u64>) -> Option<u64> {
    expires_in.map(|secs| now_secs() + secs)
}

/// `POST /device/code`: the code the user types and the one this side polls with.
pub async fn request_device_code(
    client: &reqwest::Client,
    oauth_base: &str,
    device_id: &str,
    device_name: &str,
) -> Result<(String, YmDeviceCode), YmError> {
    let resp = client
        .post(format!("{oauth_base}/device/code"))
        .form(&[
            ("client_id", CLIENT_ID),
            ("device_id", device_id),
            ("device_name", device_name),
        ])
        .send()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    let status = resp.status().as_u16();
    let body = resp
        .text()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    if status != 200 {
        return Err(YmError::unknown(oauth_error_message(&body, status)));
    }
    let parsed: DeviceCodeResponse = serde_json::from_str(&body)
        .map_err(|e| YmError::unknown(format!("device code response: {e}")))?;
    Ok((
        parsed.device_code,
        YmDeviceCode {
            user_code: parsed.user_code,
            verification_url: parsed.verification_url,
            expires_in: parsed.expires_in,
            interval: parsed.interval,
        },
    ))
}

fn oauth_error_message(body: &str, status: u16) -> String {
    serde_json::from_str::<OauthError>(body).map_or_else(
        |_| format!("oauth status {status}"),
        |e| e.error_description.unwrap_or(e.error),
    )
}

async fn post_token(
    client: &reqwest::Client,
    oauth_base: &str,
    form: &[(&str, &str)],
) -> Result<TokenResponse, TokenFailure> {
    let resp = client
        .post(format!("{oauth_base}/token"))
        .form(form)
        .send()
        .await
        .map_err(|e| TokenFailure::Other(YmError::network(e.without_url().to_string())))?;
    let status = resp.status().as_u16();
    let body = resp
        .text()
        .await
        .map_err(|e| TokenFailure::Other(YmError::network(e.without_url().to_string())))?;
    if status == 200 {
        return serde_json::from_str(&body)
            .map_err(|e| TokenFailure::Other(YmError::unknown(format!("token response: {e}"))));
    }
    let error = serde_json::from_str::<OauthError>(&body).ok();
    Err(match error.as_ref().map(|e| e.error.as_str()) {
        Some("authorization_pending") => TokenFailure::Pending,
        Some("slow_down") => TokenFailure::SlowDown,
        Some("expired_token") => TokenFailure::Expired,
        _ => TokenFailure::Other(YmError::auth(oauth_error_message(&body, status))),
    })
}

/// Polls `POST /token` every `interval` until the user confirms, the code
/// expires, the poll is cancelled or Yandex answers with a real error.
pub async fn poll_token(
    client: &reqwest::Client,
    oauth_base: &str,
    device_code: &str,
    interval: Duration,
    expires_in: Duration,
    cancel: CancellationToken,
) -> Result<TokenResponse, PollEnd> {
    let deadline = Instant::now() + expires_in;
    let mut interval = interval;
    loop {
        if cancel
            .run_until_cancelled(tokio::time::sleep(interval))
            .await
            .is_none()
        {
            return Err(PollEnd::Cancelled);
        }
        if Instant::now() >= deadline {
            return Err(PollEnd::Expired);
        }
        let form = [
            ("grant_type", "device_code"),
            ("code", device_code),
            ("client_id", CLIENT_ID),
            ("client_secret", CLIENT_SECRET),
        ];
        match post_token(client, oauth_base, &form).await {
            Ok(token) => return Ok(token),
            Err(TokenFailure::Pending) => {}
            Err(TokenFailure::SlowDown) => interval += SLOW_DOWN_STEP,
            Err(TokenFailure::Expired) => return Err(PollEnd::Expired),
            Err(TokenFailure::Other(e)) => return Err(PollEnd::Failed(e)),
        }
    }
}

/// `grant_type=refresh_token`. Any failure means the session is over.
pub async fn refresh_access_token(
    client: &reqwest::Client,
    oauth_base: &str,
    refresh_token: &str,
) -> Result<TokenResponse, YmError> {
    let form = [
        ("grant_type", "refresh_token"),
        ("refresh_token", refresh_token),
        ("client_id", CLIENT_ID),
        ("client_secret", CLIENT_SECRET),
    ];
    post_token(client, oauth_base, &form)
        .await
        .map_err(|failure| match failure {
            TokenFailure::Other(e) => e,
            _ => YmError::auth("refresh rejected"),
        })
}

/// `GET /account/status` with the token: who signed in and whether they
/// have Plus. Without a uid the token is not a signed-in account.
pub async fn fetch_account(
    client: &reqwest::Client,
    api_base: &str,
    access_token: &str,
) -> Result<AccountInfo, YmError> {
    let resp = client
        .get(format!("{api_base}/account/status"))
        .header(
            reqwest::header::AUTHORIZATION,
            format!("OAuth {access_token}"),
        )
        .header(CLIENT_HEADER_NAME, CLIENT_HEADER_VALUE)
        .send()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    let status = resp.status().as_u16();
    let body = resp
        .text()
        .await
        .map_err(|e| YmError::network(e.without_url().to_string()))?;
    if status != 200 {
        return Err(YmError::from_status(status, &body, None));
    }
    let json: serde_json::Value = serde_json::from_str(&body)
        .map_err(|e| YmError::unknown(format!("account status: {e}")))?;
    let account = &json["result"]["account"];
    let Some(uid) = account["uid"].as_u64() else {
        return Err(YmError::auth("the token names no account"));
    };
    let display_name = ["displayName", "fullName", "login"]
        .iter()
        .find_map(|key| account[key].as_str())
        .unwrap_or_default()
        .to_owned();
    // A family member of a Plus subscription gets whole tracks but reports
    // hasPlus=false; the flag is informational (settings card), never a gate.
    let has_plus = json["result"]["plus"]["hasPlus"].as_bool().unwrap_or(false)
        || account["nonOwnerFamilyMember"].as_bool().unwrap_or(false);
    Ok(AccountInfo {
        uid,
        has_plus,
        display_name,
    })
}

// ── Commands ─────────────────────────────────────────────────────────

/// The stored session, restored from disk on the first call. No network:
/// the frontend's own connection check is what proves the token still works.
#[tauri::command]
pub fn ym_auth_status<R: Runtime>(app: AppHandle<R>) -> YmAuthStatus {
    load_session_if_needed(&app);
    app.state::<YmState>().session().into()
}

/// Starts the device flow: returns the code to show and polls for the token
/// in the background until `ym:auth` reports how it ended. A second start
/// cancels the previous poll.
#[tauri::command]
pub async fn ym_auth_start<R: Runtime>(app: AppHandle<R>) -> Result<YmDeviceCode, YmError> {
    let client = crate::proxy::http_client(&app)?;
    let device_id = load_or_create_device_id(&device_file(&app)?);
    let oauth_base = app.state::<YmState>().endpoints.oauth.clone();
    let (device_code, code) =
        request_device_code(&client, &oauth_base, &device_id, device_name()).await?;

    let cancel = CancellationToken::new();
    let poll_id = app.state::<YmState>().start_poll(cancel.clone());
    emit_auth(&app, &YmAuthEvent::Pending);

    let interval = Duration::from_secs(code.interval.max(1));
    let expires_in = Duration::from_secs(code.expires_in);
    let poll_app = app.clone();
    tauri::async_runtime::spawn(async move {
        let outcome = poll_token(
            &client,
            &oauth_base,
            &device_code,
            interval,
            expires_in,
            cancel,
        )
        .await;
        let event = match outcome {
            Ok(token) => complete_sign_in(&poll_app, &client, token).await,
            Err(PollEnd::Cancelled) => YmAuthEvent::Cancelled,
            Err(PollEnd::Expired) => YmAuthEvent::CodeExpired,
            Err(PollEnd::Failed(e)) => YmAuthEvent::Error { message: e.message },
        };
        poll_app.state::<YmState>().clear_poll(poll_id);
        emit_auth(&poll_app, &event);
    });

    Ok(code)
}

/// The token is in: learn who signed in, persist, install the session.
async fn complete_sign_in<R: Runtime>(
    app: &AppHandle<R>,
    client: &reqwest::Client,
    token: TokenResponse,
) -> YmAuthEvent {
    let state = app.state::<YmState>();
    let account = match fetch_account(client, &state.endpoints.api, &token.access_token).await {
        Ok(account) => account,
        Err(e) => return YmAuthEvent::Error { message: e.message },
    };
    let session = YmSession::new(
        account.uid,
        account.has_plus,
        account.display_name.clone(),
        &token.access_token,
        token.refresh_token.as_deref(),
        expires_at_from(token.expires_in),
    );
    if let Err(e) =
        auth_file(app).and_then(|path| write_auth_file(&path, &StoredAuth::from_session(&session)))
    {
        log::warn!("ym: storing the session failed: {e}");
    }
    state.set_session(Some(session));
    log::info!(
        "ym: signed in as uid {} (plus: {})",
        account.uid,
        account.has_plus
    );
    YmAuthEvent::Ok {
        uid: account.uid,
        has_plus: account.has_plus,
        display_name: account.display_name,
    }
}

/// Stops a running poll; the poll task itself reports `cancelled`.
#[tauri::command]
pub fn ym_auth_cancel<R: Runtime>(app: AppHandle<R>) {
    app.state::<YmState>().cancel_poll();
}

/// Forgets the session here and on disk. Nothing is revoked at Yandex — the
/// device stays in the account's list until removed there.
#[tauri::command]
pub fn ym_auth_logout<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app.state::<YmState>();
    state.cancel_poll();
    state.set_session(None);
    remove_auth_file(&auth_file(&app)?);
    log::info!("ym: signed out");
    Ok(())
}

/// Persists a refreshed session (the token endpoint rotated the tokens).
pub fn persist_session<R: Runtime>(app: &AppHandle<R>, session: &YmSession) {
    if let Err(e) =
        auth_file(app).and_then(|path| write_auth_file(&path, &StoredAuth::from_session(session)))
    {
        log::warn!("ym: storing the refreshed session failed: {e}");
    }
}

/// The session stopped working: drop it everywhere and tell the frontend.
pub fn drop_session<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<YmState>();
    state.set_session(None);
    if let Ok(path) = auth_file(app) {
        remove_auth_file(&path);
    }
    log::info!("ym: session expired, signed out");
    emit_auth(app, &YmAuthEvent::Expired);
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

    const PENDING: &str = r#"{"error":"authorization_pending","error_description":"User has not yet authorized your application"}"#;
    const TOKEN: &str = r#"{"access_token":"tok-1","refresh_token":"refresh-1","expires_in":31536000,"token_type":"bearer"}"#;

    #[test]
    fn a_token_response_never_prints_its_tokens() {
        let token: TokenResponse = serde_json::from_str(TOKEN).expect("token");

        let debug = format!("{token:?}");

        assert!(!debug.contains("tok-1"));
        assert!(!debug.contains("refresh-1"));
    }

    #[tokio::test]
    async fn the_device_code_request_carries_the_device_and_parses_the_answer() {
        let upstream = spawn_upstream(|req| {
            assert_eq!(req.uri().path(), "/device/code");
            json(
                200,
                r#"{"device_code":"dc-1","expires_in":300,"interval":5,"user_code":"fzlazd3z","verification_url":"https://ya.ru/device"}"#,
            )
        })
        .await;

        let (device_code, code) =
            request_device_code(&reqwest::Client::new(), &upstream, "device-1", "Windows")
                .await
                .expect("device code");

        assert_eq!(device_code, "dc-1");
        assert_eq!(code.user_code, "fzlazd3z");
        assert_eq!(code.verification_url, "https://ya.ru/device");
        assert_eq!(code.expires_in, 300);
        assert_eq!(code.interval, 5);
    }

    #[tokio::test]
    async fn polling_returns_the_token_once_the_user_confirms() {
        let calls = Arc::new(AtomicUsize::new(0));
        let seen = Arc::clone(&calls);
        let upstream = spawn_upstream(move |req| {
            assert_eq!(req.uri().path(), "/token");
            // authorization_pending is the normal answer, not an error.
            match seen.fetch_add(1, Ordering::SeqCst) {
                0 | 1 => json(400, PENDING),
                _ => json(200, TOKEN),
            }
        })
        .await;

        let token = poll_token(
            &reqwest::Client::new(),
            &upstream,
            "dc-1",
            Duration::from_millis(10),
            Duration::from_secs(30),
            CancellationToken::new(),
        )
        .await
        .expect("token");

        assert_eq!(token.access_token, "tok-1");
        assert_eq!(token.refresh_token.as_deref(), Some("refresh-1"));
        assert_eq!(calls.load(Ordering::SeqCst), 3);
    }

    #[tokio::test]
    async fn polling_stops_when_the_code_expires() {
        let upstream = spawn_upstream(|_req| json(400, PENDING)).await;

        let outcome = poll_token(
            &reqwest::Client::new(),
            &upstream,
            "dc-1",
            Duration::from_millis(20),
            Duration::from_millis(150),
            CancellationToken::new(),
        )
        .await;

        assert!(matches!(outcome, Err(PollEnd::Expired)), "{outcome:?}");
    }

    #[tokio::test]
    async fn polling_stops_when_yandex_says_the_code_expired() {
        let upstream = spawn_upstream(|_req| json(400, r#"{"error":"expired_token"}"#)).await;

        let outcome = poll_token(
            &reqwest::Client::new(),
            &upstream,
            "dc-1",
            Duration::from_millis(10),
            Duration::from_secs(30),
            CancellationToken::new(),
        )
        .await;

        assert!(matches!(outcome, Err(PollEnd::Expired)), "{outcome:?}");
    }

    #[tokio::test]
    async fn cancelling_stops_the_poll() {
        let upstream = spawn_upstream(|_req| json(400, PENDING)).await;
        let cancel = CancellationToken::new();
        let trigger = cancel.clone();
        tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(60)).await;
            trigger.cancel();
        });

        let outcome = poll_token(
            &reqwest::Client::new(),
            &upstream,
            "dc-1",
            Duration::from_millis(20),
            Duration::from_secs(30),
            cancel,
        )
        .await;

        assert!(matches!(outcome, Err(PollEnd::Cancelled)), "{outcome:?}");
    }

    #[tokio::test]
    async fn a_real_oauth_error_ends_the_poll_with_its_description() {
        let upstream = spawn_upstream(|_req| {
            json(
                400,
                r#"{"error":"access_denied","error_description":"The user denied the request"}"#,
            )
        })
        .await;

        let outcome = poll_token(
            &reqwest::Client::new(),
            &upstream,
            "dc-1",
            Duration::from_millis(10),
            Duration::from_secs(30),
            CancellationToken::new(),
        )
        .await;

        match outcome {
            Err(PollEnd::Failed(e)) => assert_eq!(e.message, "The user denied the request"),
            other => panic!("expected a failure, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn refreshing_sends_the_refresh_grant_and_rejects_invalid_grants() {
        let upstream = spawn_upstream(|req| {
            assert_eq!(req.uri().path(), "/token");
            json(
                400,
                r#"{"error":"invalid_grant","error_description":"expired"}"#,
            )
        })
        .await;

        let error = refresh_access_token(&reqwest::Client::new(), &upstream, "refresh-1")
            .await
            .unwrap_err();

        assert_eq!(error.kind, super::super::api::YmErrorKind::Auth);
    }

    #[tokio::test]
    async fn account_status_reads_uid_plus_and_name() {
        let upstream = spawn_upstream(|req| {
            assert_eq!(req.uri().path(), "/account/status");
            assert_eq!(req.headers()["Authorization"], "OAuth tok-1");
            json(
                200,
                r#"{"result":{"account":{"uid":42,"login":"tester","displayName":"Tester"},"plus":{"hasPlus":true}},"invocationInfo":{}}"#,
            )
        })
        .await;

        let account = fetch_account(&reqwest::Client::new(), &upstream, "tok-1")
            .await
            .expect("account");

        assert_eq!(account.uid, 42);
        assert!(account.has_plus);
        assert_eq!(account.display_name, "Tester");
    }

    #[tokio::test]
    async fn a_family_member_counts_as_plus() {
        // Recorded 2026-09-15: whole tracks are served, yet plus.hasPlus is false.
        let upstream = spawn_upstream(|_req| {
            json(
                200,
                r#"{"result":{"account":{"uid":42,"login":"tester","nonOwnerFamilyMember":true},"plus":{"hasPlus":false,"isTutorialCompleted":true}},"invocationInfo":{}}"#,
            )
        })
        .await;

        let account = fetch_account(&reqwest::Client::new(), &upstream, "tok-1")
            .await
            .expect("account");

        assert!(account.has_plus);
    }

    #[tokio::test]
    async fn an_anonymous_account_status_is_not_a_sign_in() {
        // The recorded shape Yandex returns without a token: 200, no uid.
        let upstream = spawn_upstream(|_req| {
            json(
                200,
                r#"{"result":{"account":{"now":"2026-09-15T18:58:33+03:00","region":225,"serviceAvailable":true},"permissions":{"values":["landing-play"]}},"invocationInfo":{}}"#,
            )
        })
        .await;

        let error = fetch_account(&reqwest::Client::new(), &upstream, "tok-1")
            .await
            .unwrap_err();

        assert_eq!(error.kind, super::super::api::YmErrorKind::Auth);
    }
}
