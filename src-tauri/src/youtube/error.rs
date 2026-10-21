//! The YouTube commands' internal error; the frontend receives it as a
//! source `AppError` with the same kind.

/// Failure class; maps onto the envelope's `SourceErrorKind`.
#[derive(Debug, Clone, Copy)]
pub enum YtErrorKind {
    /// No stream is registered for the video (or it expired).
    NotFound,
    /// Transport-level failure (offline, proxy down, HTTP 5xx).
    Network,
    /// Malformed input (bad id, empty query).
    InvalidInput,
    /// The operation was cancelled by the user.
    Cancelled,
    Unknown,
}

#[derive(Debug, Clone)]
pub struct YtError {
    pub kind: YtErrorKind,
    pub message: String,
}

impl YtError {
    pub fn new(kind: YtErrorKind, message: impl Into<String>) -> Self {
        Self {
            kind,
            message: message.into(),
        }
    }

    pub fn unknown(message: impl Into<String>) -> Self {
        Self::new(YtErrorKind::Unknown, message)
    }

    pub fn invalid_input(message: impl Into<String>) -> Self {
        Self::new(YtErrorKind::InvalidInput, message)
    }

    pub fn cancelled(message: impl Into<String>) -> Self {
        Self::new(YtErrorKind::Cancelled, message)
    }
}

impl std::fmt::Display for YtError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}", self.message)
    }
}

/// String errors from internal helpers (fs, the shared download machinery, …).
impl From<String> for YtError {
    fn from(message: String) -> Self {
        Self::unknown(message)
    }
}
