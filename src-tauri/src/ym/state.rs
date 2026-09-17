//! The signed-in session and everything that guards it: the managed state,
//! the on-disk token store and the device id.

use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Mutex, RwLock};

use secrecy::{ExposeSecret, SecretString};
use tauri::{AppHandle, Manager, Runtime};
use tokio::sync::Semaphore;
use tokio_util::sync::CancellationToken;

pub const API_BASE: &str = "https://api.music.yandex.net";
pub const OAUTH_BASE: &str = "https://oauth.yandex.ru";
/// Every request identifies as the Android client the credentials belong to.
pub const CLIENT_HEADER_NAME: &str = "X-Yandex-Music-Client";
pub const CLIENT_HEADER_VALUE: &str = "YandexMusicAndroid/24023621";

/// Parallel API requests. The per-IP burst that trips a 429 is unmeasured;
/// four covers a page's worth of catalog reads without fanning out.
const MAX_PARALLEL_REQUESTS: usize = 4;

const AUTH_FILE: &str = "ym-auth.json";
const DEVICE_FILE: &str = "ym-device.json";

/// A signed-in account. The tokens are `SecretString` so no `Debug`, log
/// line or error can print them by accident.
#[derive(Clone)]
pub struct YmSession {
    pub uid: u64,
    pub has_plus: bool,
    pub display_name: String,
    access_token: SecretString,
    refresh_token: Option<SecretString>,
    /// Unix seconds; `None` when the token endpoint named no lifetime.
    pub expires_at: Option<u64>,
}

impl YmSession {
    pub fn new(
        uid: u64,
        has_plus: bool,
        display_name: impl Into<String>,
        access_token: &str,
        refresh_token: Option<&str>,
        expires_at: Option<u64>,
    ) -> Self {
        Self {
            uid,
            has_plus,
            display_name: display_name.into(),
            access_token: SecretString::from(access_token.to_owned()),
            refresh_token: refresh_token.map(|t| SecretString::from(t.to_owned())),
            expires_at,
        }
    }

    /// The `Authorization` header value.
    pub fn authorization(&self) -> String {
        format!("OAuth {}", self.access_token.expose_secret())
    }

    pub fn refresh_token(&self) -> Option<&str> {
        self.refresh_token.as_ref().map(ExposeSecret::expose_secret)
    }

    /// The same account with fresh tokens.
    pub fn with_tokens(
        &self,
        access_token: &str,
        refresh_token: Option<&str>,
        expires_at: Option<u64>,
    ) -> Self {
        Self::new(
            self.uid,
            self.has_plus,
            self.display_name.clone(),
            access_token,
            refresh_token.or(self.refresh_token()),
            expires_at,
        )
    }
}

impl std::fmt::Debug for YmSession {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("YmSession")
            .field("uid", &self.uid)
            .field("has_plus", &self.has_plus)
            .finish_non_exhaustive()
    }
}

/// On-disk form of the session. Never derives `Debug`: it holds the raw tokens.
#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredAuth {
    access_token: String,
    refresh_token: Option<String>,
    expires_at: Option<u64>,
    uid: u64,
    #[serde(default)]
    has_plus: bool,
    #[serde(default)]
    display_name: String,
}

impl StoredAuth {
    pub fn from_session(session: &YmSession) -> Self {
        Self {
            access_token: session.access_token.expose_secret().to_owned(),
            refresh_token: session.refresh_token().map(str::to_owned),
            expires_at: session.expires_at,
            uid: session.uid,
            has_plus: session.has_plus,
            display_name: session.display_name.clone(),
        }
    }

    pub fn into_session(self) -> YmSession {
        YmSession::new(
            self.uid,
            self.has_plus,
            self.display_name,
            &self.access_token,
            self.refresh_token.as_deref(),
            self.expires_at,
        )
    }
}

/// Where the requests go — production Yandex, or a local upstream in tests.
pub struct Endpoints {
    pub api: String,
    pub oauth: String,
    /// Scheme of the signed track links (`https`; the test upstream is plain).
    pub link_scheme: &'static str,
}

/// The device-flow poll in progress. The id tells a finished poll from the
/// newer one that may have replaced it, so only its own slot gets cleared.
struct Poll {
    id: u64,
    token: CancellationToken,
}

pub struct YmState {
    session: RwLock<Option<YmSession>>,
    poll: Mutex<Option<Poll>>,
    next_poll_id: AtomicU64,
    loaded: AtomicBool,
    pub permits: Semaphore,
    pub endpoints: Endpoints,
}

impl Default for YmState {
    fn default() -> Self {
        Self::with_endpoints(API_BASE, OAUTH_BASE)
    }
}

impl YmState {
    pub fn with_endpoints(api: &str, oauth: &str) -> Self {
        Self {
            session: RwLock::new(None),
            poll: Mutex::new(None),
            next_poll_id: AtomicU64::new(1),
            loaded: AtomicBool::new(false),
            permits: Semaphore::new(MAX_PARALLEL_REQUESTS),
            endpoints: Endpoints {
                api: api.trim_end_matches('/').to_owned(),
                oauth: oauth.trim_end_matches('/').to_owned(),
                link_scheme: "https",
            },
        }
    }

    #[cfg(test)]
    pub fn with_link_scheme(mut self, scheme: &'static str) -> Self {
        self.endpoints.link_scheme = scheme;
        self
    }

    pub fn session(&self) -> Option<YmSession> {
        self.session.read().ok().and_then(|guard| guard.clone())
    }

    pub fn set_session(&self, session: Option<YmSession>) {
        if let Ok(mut guard) = self.session.write() {
            *guard = session;
        }
    }

    /// Installs a new poll, cancelling whatever poll was running. Returns
    /// the poll's id for [`YmState::clear_poll`].
    pub fn start_poll(&self, token: CancellationToken) -> u64 {
        let id = self.next_poll_id.fetch_add(1, Ordering::SeqCst);
        if let Ok(mut guard) = self.poll.lock() {
            if let Some(previous) = guard.take() {
                previous.token.cancel();
            }
            *guard = Some(Poll { id, token });
        }
        id
    }

    /// Cancels the running poll; false when none was.
    pub fn cancel_poll(&self) -> bool {
        let Ok(mut guard) = self.poll.lock() else {
            return false;
        };
        match guard.take() {
            Some(poll) => {
                poll.token.cancel();
                true
            }
            None => false,
        }
    }

    /// Forgets a finished poll — unless a newer one replaced it meanwhile.
    pub fn clear_poll(&self, id: u64) {
        if let Ok(mut guard) = self.poll.lock() {
            if guard.as_ref().is_some_and(|poll| poll.id == id) {
                *guard = None;
            }
        }
    }
}

/// 32 hex chars from 16 CSPRNG bytes.
fn new_device_id() -> String {
    let mut buf = [0u8; 16];
    getrandom::fill(&mut buf).expect("OS CSPRNG is available");
    hex::encode(buf)
}

// ── Storage ──────────────────────────────────────────────────────────

pub fn auth_file<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(AUTH_FILE))
}

pub fn device_file<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, String> {
    Ok(app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(DEVICE_FILE))
}

pub fn read_auth_file(path: &Path) -> Option<StoredAuth> {
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

/// Writes the session for the next launch. Unix: owner-only permissions;
/// Windows and Android app-data directories are private per user/app already.
pub fn write_auth_file(path: &Path, auth: &StoredAuth) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string(auth).map_err(|e| e.to_string())?;
    std::fs::write(path, json).map_err(|e| e.to_string())?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600));
    }
    Ok(())
}

pub fn remove_auth_file(path: &Path) {
    let _ = std::fs::remove_file(path);
}

/// Reads the stored session once per launch; later calls are free.
pub(crate) fn load_session_if_needed<R: Runtime>(app: &AppHandle<R>) {
    let state = app.state::<YmState>();
    if state.loaded.swap(true, Ordering::SeqCst) {
        return;
    }
    if let Ok(path) = auth_file(app) {
        if let Some(stored) = read_auth_file(&path) {
            log::info!("ym: restored session for uid {}", stored.uid);
            state.set_session(Some(stored.into_session()));
        }
    }
}

#[derive(serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StoredDevice {
    device_id: String,
}

/// The device Yandex lists the sign-in under. Generated once and kept across
/// sign-outs so the account's device list does not grow a new entry per login.
pub fn load_or_create_device_id(path: &Path) -> String {
    if let Some(stored) = std::fs::read_to_string(path)
        .ok()
        .and_then(|raw| serde_json::from_str::<StoredDevice>(&raw).ok())
        .filter(|stored| !stored.device_id.is_empty())
    {
        return stored.device_id;
    }
    let device_id = new_device_id();
    if let Some(parent) = path.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    if let Ok(json) = serde_json::to_string(&StoredDevice {
        device_id: device_id.clone(),
    }) {
        let _ = std::fs::write(path, json);
    }
    device_id
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_path(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("ym-state-test-{}-{name}", new_device_id()))
    }

    #[test]
    fn a_session_never_prints_its_tokens() {
        let session = YmSession::new(
            42,
            true,
            "Tester",
            "access-secret",
            Some("refresh-secret"),
            None,
        );

        let debug = format!("{session:?}");

        assert!(debug.contains("42"));
        assert!(!debug.contains("access-secret"));
        assert!(!debug.contains("refresh-secret"));
    }

    #[test]
    fn stored_auth_round_trips_through_the_file() {
        let path = temp_path("auth.json");
        let session = YmSession::new(
            42,
            true,
            "Tester",
            "access-1",
            Some("refresh-1"),
            Some(1_800_000_000),
        );

        write_auth_file(&path, &StoredAuth::from_session(&session)).expect("write");
        let restored = read_auth_file(&path).expect("read").into_session();

        assert_eq!(restored.uid, 42);
        assert!(restored.has_plus);
        assert_eq!(restored.display_name, "Tester");
        assert_eq!(restored.authorization(), "OAuth access-1");
        assert_eq!(restored.refresh_token(), Some("refresh-1"));
        assert_eq!(restored.expires_at, Some(1_800_000_000));

        remove_auth_file(&path);
        assert!(read_auth_file(&path).is_none());
    }

    #[test]
    fn a_missing_or_corrupt_file_is_no_session() {
        let path = temp_path("corrupt.json");
        assert!(read_auth_file(&path).is_none());

        std::fs::write(&path, "{not json").expect("write");
        assert!(read_auth_file(&path).is_none());
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn the_device_id_is_created_once_and_then_reused() {
        let path = temp_path("device.json");

        let first = load_or_create_device_id(&path);
        let second = load_or_create_device_id(&path);

        assert_eq!(first.len(), 32);
        assert_eq!(first, second);
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn with_tokens_keeps_the_account_and_the_old_refresh_token_when_none_is_issued() {
        let session = YmSession::new(42, false, "Tester", "old", Some("refresh-1"), None);

        let rotated = session.with_tokens("new", None, Some(7));

        assert_eq!(rotated.uid, 42);
        assert_eq!(rotated.authorization(), "OAuth new");
        assert_eq!(rotated.refresh_token(), Some("refresh-1"));
        assert_eq!(rotated.expires_at, Some(7));
    }

    #[test]
    fn starting_a_poll_cancels_the_previous_one() {
        let state = YmState::default();
        let first = CancellationToken::new();
        state.start_poll(first.clone());

        let second = CancellationToken::new();
        state.start_poll(second.clone());

        assert!(first.is_cancelled());
        assert!(!second.is_cancelled());
        assert!(state.cancel_poll());
        assert!(second.is_cancelled());
        assert!(!state.cancel_poll());
    }

    #[test]
    fn a_finished_poll_clears_only_its_own_slot() {
        let state = YmState::default();
        let first_id = state.start_poll(CancellationToken::new());
        let second = CancellationToken::new();
        let second_id = state.start_poll(second.clone());

        state.clear_poll(first_id);
        assert!(state.cancel_poll(), "the newer poll is still installed");
        assert!(second.is_cancelled());

        state.start_poll(CancellationToken::new());
        state.clear_poll(second_id);
        assert!(state.cancel_poll(), "a stale id never clears a newer poll");
    }
}
