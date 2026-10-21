//! The error envelope every command rejects with; mirrors `AppError` in `src/lib/errors/app-error.ts`.

use crate::remote_download::DownloadError;
#[cfg(desktop)]
use crate::updater::{UpdateError, UpdateErrorKind};
use crate::ym::{YmError, YmErrorKind};
use crate::youtube::{YtError, YtErrorKind};

#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum SourceId {
    Nd,
    Ym,
    Yt,
}

/// One-to-one with the frontend's `SourceErrorKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum SourceErrorKind {
    Unavailable,
    Auth,
    Forbidden,
    Network,
    NotFound,
    RateLimited,
    // Only the frontend produces it; listed so the enum spells the whole union.
    #[allow(dead_code)]
    Parse,
    Cancelled,
    InvalidInput,
    Unknown,
}

/// One-to-one with the frontend's `NativeErrorKind`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub(crate) enum NativeErrorKind {
    InvalidInput,
    Network,
    Io,
    // Only the frontend produces it; listed so the enum spells the whole union.
    #[allow(dead_code)]
    Unavailable,
    Unknown,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(tag = "domain", rename_all = "lowercase")]
pub(crate) enum AppError {
    Source {
        source: SourceId,
        kind: SourceErrorKind,
        message: String,
        #[serde(rename = "retryAfterMs", skip_serializing_if = "Option::is_none")]
        retry_after_ms: Option<u64>,
    },
    Native {
        kind: NativeErrorKind,
        message: String,
    },
    #[cfg(desktop)]
    Update {
        kind: UpdateErrorKind,
        message: String,
    },
    // A cancelled download is a source CANCELLED; this domain is the frontend's.
    #[allow(dead_code)]
    Cancelled { message: String },
}

impl AppError {
    pub(crate) fn source(
        source: SourceId,
        kind: SourceErrorKind,
        message: impl Into<String>,
    ) -> Self {
        Self::Source {
            source,
            kind,
            message: message.into(),
            retry_after_ms: None,
        }
    }

    pub(crate) fn native(kind: NativeErrorKind, message: impl Into<String>) -> Self {
        Self::Native {
            kind,
            message: message.into(),
        }
    }

    pub(crate) fn invalid_input(message: impl Into<String>) -> Self {
        Self::native(NativeErrorKind::InvalidInput, message)
    }

    pub(crate) fn io(message: impl Into<String>) -> Self {
        Self::native(NativeErrorKind::Io, message)
    }

    pub(crate) fn network(message: impl Into<String>) -> Self {
        Self::native(NativeErrorKind::Network, message)
    }

    pub(crate) fn unknown(message: impl Into<String>) -> Self {
        Self::native(NativeErrorKind::Unknown, message)
    }

    pub(crate) fn from_download(source: SourceId, error: DownloadError) -> Self {
        let kind = match &error {
            DownloadError::Cancelled => SourceErrorKind::Cancelled,
            DownloadError::Network(_) => SourceErrorKind::Network,
            DownloadError::Upstream(status) => kind_for_status(*status),
            DownloadError::Io(_) | DownloadError::Other(_) => SourceErrorKind::Unknown,
        };
        Self::source(source, kind, error.to_string())
    }
}

/// The kind an upstream HTTP status means for a source request.
pub(crate) fn kind_for_status(status: u16) -> SourceErrorKind {
    match status {
        401 | 403 => SourceErrorKind::Auth,
        404 => SourceErrorKind::NotFound,
        429 => SourceErrorKind::RateLimited,
        500..=599 => SourceErrorKind::Unavailable,
        _ => SourceErrorKind::Unknown,
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let message = match self {
            Self::Source { message, .. }
            | Self::Native { message, .. }
            | Self::Cancelled { message } => message,
            #[cfg(desktop)]
            Self::Update { message, .. } => message,
        };
        f.write_str(message)
    }
}

impl std::error::Error for AppError {}

/// Helper errors (locks, paths, IPC) arrive as strings.
impl From<String> for AppError {
    fn from(message: String) -> Self {
        Self::unknown(message)
    }
}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        Self::io(error.to_string())
    }
}

impl From<tauri::Error> for AppError {
    fn from(error: tauri::Error) -> Self {
        Self::unknown(error.to_string())
    }
}

impl From<YmError> for AppError {
    fn from(error: YmError) -> Self {
        let kind = match error.kind {
            YmErrorKind::Auth => SourceErrorKind::Auth,
            YmErrorKind::Forbidden => SourceErrorKind::Forbidden,
            YmErrorKind::RateLimited => SourceErrorKind::RateLimited,
            YmErrorKind::NotFound => SourceErrorKind::NotFound,
            YmErrorKind::Network => SourceErrorKind::Network,
            YmErrorKind::Unavailable => SourceErrorKind::Unavailable,
            YmErrorKind::Cancelled => SourceErrorKind::Cancelled,
            YmErrorKind::Unknown => SourceErrorKind::Unknown,
        };
        Self::Source {
            source: SourceId::Ym,
            kind,
            message: error.message,
            retry_after_ms: error.retry_after_ms,
        }
    }
}

impl From<YtError> for AppError {
    fn from(error: YtError) -> Self {
        let kind = match error.kind {
            YtErrorKind::NotFound => SourceErrorKind::NotFound,
            YtErrorKind::Network => SourceErrorKind::Network,
            YtErrorKind::InvalidInput => SourceErrorKind::InvalidInput,
            YtErrorKind::Cancelled => SourceErrorKind::Cancelled,
            YtErrorKind::Unknown => SourceErrorKind::Unknown,
        };
        Self::source(SourceId::Yt, kind, error.message)
    }
}

#[cfg(desktop)]
impl From<UpdateError> for AppError {
    fn from(error: UpdateError) -> Self {
        Self::Update {
            kind: error.kind,
            message: error.message,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn wire(error: &AppError) -> String {
        serde_json::to_string(error).expect("json")
    }

    #[test]
    fn a_source_error_serialises_with_the_domain_tag_and_camel_case_retry() {
        let limited = AppError::Source {
            source: SourceId::Ym,
            kind: SourceErrorKind::RateLimited,
            message: "slow down".into(),
            retry_after_ms: Some(1500),
        };
        assert_eq!(
            wire(&limited),
            r#"{"domain":"source","source":"ym","kind":"RATE_LIMITED","message":"slow down","retryAfterMs":1500}"#
        );

        let plain = AppError::source(
            SourceId::Nd,
            SourceErrorKind::Unavailable,
            "nd source is not configured",
        );
        assert_eq!(
            wire(&plain),
            r#"{"domain":"source","source":"nd","kind":"UNAVAILABLE","message":"nd source is not configured"}"#
        );
    }

    #[test]
    fn native_update_and_cancelled_errors_serialise_in_the_frontend_vocabulary() {
        for (error, kind) in [
            (AppError::invalid_input("m"), "INVALID_INPUT"),
            (AppError::network("m"), "NETWORK"),
            (AppError::io("m"), "IO"),
            (
                AppError::native(NativeErrorKind::Unavailable, "m"),
                "UNAVAILABLE",
            ),
            (AppError::unknown("m"), "UNKNOWN"),
        ] {
            assert_eq!(
                wire(&error),
                format!(r#"{{"domain":"native","kind":"{kind}","message":"m"}}"#)
            );
        }

        #[cfg(desktop)]
        {
            use crate::updater::{UpdateError, UpdateErrorKind};
            let update = AppError::from(UpdateError {
                kind: UpdateErrorKind::InstallFailed,
                message: "bad signature".into(),
            });
            assert_eq!(
                wire(&update),
                r#"{"domain":"update","kind":"INSTALL_FAILED","message":"bad signature"}"#
            );
            let none = AppError::from(UpdateError {
                kind: UpdateErrorKind::NoUpdateAvailable,
                message: "no update available".into(),
            });
            assert_eq!(
                serde_json::to_value(&none).expect("json")["kind"],
                "NO_UPDATE_AVAILABLE"
            );
        }

        let cancelled = AppError::Cancelled {
            message: "stopped".into(),
        };
        assert_eq!(
            wire(&cancelled),
            r#"{"domain":"cancelled","message":"stopped"}"#
        );
        assert_eq!(cancelled.to_string(), "stopped");
    }

    #[test]
    fn ym_and_yt_errors_keep_their_kind_and_retry_after() {
        let limited = AppError::from(YmError::from_status(429, "", Some(1500)));
        assert_eq!(
            serde_json::to_value(&limited).expect("json"),
            json!({
                "domain": "source",
                "source": "ym",
                "kind": "RATE_LIMITED",
                "message": "upstream status 429",
                "retryAfterMs": 1500,
            })
        );

        for (kind, wire_kind) in [
            (YmErrorKind::Auth, "AUTH"),
            (YmErrorKind::Forbidden, "FORBIDDEN"),
            (YmErrorKind::RateLimited, "RATE_LIMITED"),
            (YmErrorKind::NotFound, "NOT_FOUND"),
            (YmErrorKind::Network, "NETWORK"),
            (YmErrorKind::Unavailable, "UNAVAILABLE"),
            (YmErrorKind::Cancelled, "CANCELLED"),
            (YmErrorKind::Unknown, "UNKNOWN"),
        ] {
            assert_eq!(
                serde_json::to_value(AppError::from(YmError::new(kind, "m"))).expect("json"),
                json!({ "domain": "source", "source": "ym", "kind": wire_kind, "message": "m" })
            );
        }

        for (kind, wire_kind) in [
            (YtErrorKind::NotFound, "NOT_FOUND"),
            (YtErrorKind::Network, "NETWORK"),
            (YtErrorKind::InvalidInput, "INVALID_INPUT"),
            (YtErrorKind::Cancelled, "CANCELLED"),
            (YtErrorKind::Unknown, "UNKNOWN"),
        ] {
            assert_eq!(
                serde_json::to_value(AppError::from(YtError::new(kind, "m"))).expect("json"),
                json!({ "domain": "source", "source": "yt", "kind": wire_kind, "message": "m" })
            );
        }
    }

    #[test]
    fn string_and_io_errors_become_native() {
        assert_eq!(
            serde_json::to_value(AppError::from("lock poisoned".to_owned())).expect("json"),
            json!({ "domain": "native", "kind": "UNKNOWN", "message": "lock poisoned" })
        );

        let io = std::io::Error::new(std::io::ErrorKind::NotFound, "no such file");
        assert_eq!(
            serde_json::to_value(AppError::from(io)).expect("json"),
            json!({ "domain": "native", "kind": "IO", "message": "no such file" })
        );

        let tauri = AppError::from(tauri::Error::UnknownPath);
        assert_eq!(
            serde_json::to_value(&tauri).expect("json")["kind"],
            "UNKNOWN"
        );
        assert_eq!(tauri.to_string(), tauri::Error::UnknownPath.to_string());
    }

    #[test]
    fn download_errors_map_upstream_statuses_to_source_kinds() {
        for (error, kind, message) in [
            (DownloadError::Upstream(401), "AUTH", "upstream status 401"),
            (DownloadError::Upstream(403), "AUTH", "upstream status 403"),
            (
                DownloadError::Upstream(404),
                "NOT_FOUND",
                "upstream status 404",
            ),
            (
                DownloadError::Upstream(429),
                "RATE_LIMITED",
                "upstream status 429",
            ),
            (
                DownloadError::Upstream(503),
                "UNAVAILABLE",
                "upstream status 503",
            ),
            (
                DownloadError::Upstream(418),
                "UNKNOWN",
                "upstream status 418",
            ),
            (DownloadError::Cancelled, "CANCELLED", "cancelled"),
            (
                DownloadError::Network("request failed: timed out".into()),
                "NETWORK",
                "request failed: timed out",
            ),
            (
                DownloadError::Io("disk full".into()),
                "UNKNOWN",
                "disk full",
            ),
            (
                DownloadError::Other("download already in progress".into()),
                "UNKNOWN",
                "download already in progress",
            ),
        ] {
            assert_eq!(
                serde_json::to_value(AppError::from_download(SourceId::Nd, error)).expect("json"),
                json!({ "domain": "source", "source": "nd", "kind": kind, "message": message })
            );
        }
    }

    #[test]
    fn download_errors_reach_the_envelope_through_ym_and_yt_errors() {
        let ym = |error: DownloadError| {
            serde_json::to_value(AppError::from(YmError::from(error))).expect("json")["kind"]
                .clone()
        };
        assert_eq!(ym(DownloadError::Cancelled), "CANCELLED");
        assert_eq!(ym(DownloadError::Network("m".into())), "NETWORK");
        assert_eq!(ym(DownloadError::Upstream(401)), "AUTH");
        assert_eq!(ym(DownloadError::Upstream(403)), "FORBIDDEN");
        assert_eq!(ym(DownloadError::Upstream(404)), "NOT_FOUND");
        assert_eq!(ym(DownloadError::Upstream(429)), "RATE_LIMITED");
        assert_eq!(ym(DownloadError::Upstream(502)), "UNAVAILABLE");
        assert_eq!(ym(DownloadError::Io("m".into())), "UNKNOWN");

        let yt = |error: DownloadError| {
            serde_json::to_value(AppError::from(YtError::from(error))).expect("json")["kind"]
                .clone()
        };
        assert_eq!(yt(DownloadError::Cancelled), "CANCELLED");
        assert_eq!(yt(DownloadError::Network("m".into())), "NETWORK");
        assert_eq!(yt(DownloadError::Upstream(404)), "NOT_FOUND");
        // YtErrorKind has no UNAVAILABLE: a 5xx is the transport class it documents.
        assert_eq!(yt(DownloadError::Upstream(503)), "NETWORK");
        assert_eq!(yt(DownloadError::Upstream(403)), "UNKNOWN");
        assert_eq!(yt(DownloadError::Other("m".into())), "UNKNOWN");

        let message = AppError::from(YtError::from(DownloadError::Upstream(403))).to_string();
        assert_eq!(message, "upstream status 403");
    }
}
