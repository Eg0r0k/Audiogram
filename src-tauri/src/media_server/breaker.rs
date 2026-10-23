//! Per-host circuit breaker for proxied images: a host that keeps failing is
//! answered at once for a cooldown instead of holding a webview connection.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::{Duration, Instant};

const DEFAULT_THRESHOLD: u32 = 3;
const DEFAULT_COOLDOWN: Duration = Duration::from_secs(15);

#[derive(Default)]
struct HostState {
    failures: u32,
    open_until: Option<Instant>,
}

/// Keyed by host, not host:port. A poisoned lock reads as closed.
pub struct UpstreamBreaker {
    threshold: u32,
    cooldown: Duration,
    hosts: Mutex<HashMap<String, HostState>>,
}

impl Default for UpstreamBreaker {
    fn default() -> Self {
        Self::new(DEFAULT_THRESHOLD, DEFAULT_COOLDOWN)
    }
}

impl UpstreamBreaker {
    pub fn new(threshold: u32, cooldown: Duration) -> Self {
        Self {
            threshold,
            cooldown,
            hosts: Mutex::new(HashMap::new()),
        }
    }

    pub fn is_open(&self, host: &str) -> bool {
        let Ok(mut hosts) = self.hosts.lock() else {
            return false;
        };
        let Some(until) = hosts.get(host).and_then(|state| state.open_until) else {
            return false;
        };
        if Instant::now() < until {
            return true;
        }
        hosts.remove(host);
        false
    }

    pub fn record_success(&self, host: &str) {
        if let Ok(mut hosts) = self.hosts.lock() {
            hosts.remove(host);
        }
    }

    pub fn record_failure(&self, host: &str) {
        let Ok(mut hosts) = self.hosts.lock() else {
            return;
        };
        let state = hosts.entry(host.to_owned()).or_default();
        state.failures = state.failures.saturating_add(1);
        if state.failures >= self.threshold {
            state.open_until = Some(Instant::now() + self.cooldown);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const LONG: Duration = Duration::from_secs(60);

    #[test]
    fn opens_after_the_threshold_of_consecutive_failures() {
        let breaker = UpstreamBreaker::new(3, LONG);

        breaker.record_failure("i.ytimg.com");
        breaker.record_failure("i.ytimg.com");
        assert!(!breaker.is_open("i.ytimg.com"));

        breaker.record_failure("i.ytimg.com");
        assert!(breaker.is_open("i.ytimg.com"));
        assert!(!breaker.is_open("yt3.ggpht.com"), "other hosts stay closed");
    }

    #[test]
    fn a_success_resets_the_failure_count() {
        let breaker = UpstreamBreaker::new(3, LONG);

        breaker.record_failure("i.ytimg.com");
        breaker.record_failure("i.ytimg.com");
        breaker.record_success("i.ytimg.com");
        breaker.record_failure("i.ytimg.com");
        breaker.record_failure("i.ytimg.com");
        assert!(!breaker.is_open("i.ytimg.com"));

        breaker.record_failure("i.ytimg.com");
        assert!(breaker.is_open("i.ytimg.com"));
    }

    #[test]
    fn closes_again_once_the_cooldown_has_passed() {
        let breaker = UpstreamBreaker::new(1, Duration::from_millis(20));

        breaker.record_failure("i.ytimg.com");
        assert!(breaker.is_open("i.ytimg.com"));

        std::thread::sleep(Duration::from_millis(40));
        assert!(!breaker.is_open("i.ytimg.com"));
    }
}
