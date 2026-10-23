use std::sync::{Arc, Mutex};

use discord_rich_presence::{DiscordIpc, DiscordIpcClient};
use serde::Deserialize;

use crate::app_error::AppError;
use crate::discord_utils::build_activity;

pub type DiscordPresenceState = Arc<Mutex<DiscordPresence>>;

#[derive(Default)]
pub struct DiscordPresence {
    client_id: Option<String>,
    client: Option<DiscordIpcClient>,
}

#[derive(Debug, thiserror::Error)]
pub(crate) enum DiscordError {
    #[error("Discord Client ID is not configured")]
    NotConfigured,
    #[error("{0}")]
    Ipc(String),
    #[error("poisoned lock: another task failed inside")]
    Poisoned,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiscordActivityPayload {
    pub(crate) client_id: String,
    pub(crate) title: String,
    pub(crate) artist: Option<String>,
    pub(crate) album: Option<String>,
    pub(crate) duration: Option<f64>,
    pub(crate) position: Option<f64>,
}

#[tauri::command]
pub async fn discord_set_activity(
    state: tauri::State<'_, DiscordPresenceState>,
    payload: DiscordActivityPayload,
) -> Result<(), AppError> {
    let presence = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || {
        presence
            .lock()
            .map_err(|_| DiscordError::Poisoned)?
            .set_activity(payload)
    })
    .await?
    .map_err(AppError::from)
}

#[tauri::command]
pub async fn discord_clear_activity(
    state: tauri::State<'_, DiscordPresenceState>,
) -> Result<(), AppError> {
    let presence = Arc::clone(state.inner());
    tauri::async_runtime::spawn_blocking(move || {
        presence
            .lock()
            .map_err(|_| DiscordError::Poisoned)?
            .clear_activity();
        Ok::<(), DiscordError>(())
    })
    .await?
    .map_err(AppError::from)
}

impl DiscordPresence {
    pub(crate) fn set_activity(
        &mut self,
        payload: DiscordActivityPayload,
    ) -> Result<(), DiscordError> {
        let client_id = payload.client_id.trim().to_owned();
        if client_id.is_empty() {
            return Err(DiscordError::NotConfigured);
        }

        let activity = build_activity(payload);
        let client = self.ensure_client(&client_id)?;

        match client.set_activity(activity.clone()) {
            Ok(()) => Ok(()),
            Err(_) => {
                client
                    .reconnect()
                    .map_err(|e| DiscordError::Ipc(e.to_string()))?;
                client
                    .set_activity(activity)
                    .map_err(|e| DiscordError::Ipc(e.to_string()))
            }
        }
    }

    /// Infallible by design: a failed clear means the IPC socket is gone, and
    /// dropping the client (so the next set_activity reconnects) is the
    /// whole recovery.
    fn clear_activity(&mut self) {
        let Some(client) = self.client.as_mut() else {
            return;
        };

        if client.clear_activity().is_err() {
            self.client = None;
            self.client_id = None;
        }
    }

    fn ensure_client(&mut self, client_id: &str) -> Result<&mut DiscordIpcClient, DiscordError> {
        let should_recreate = self.client.is_none() || self.client_id.as_deref() != Some(client_id);

        if should_recreate {
            if let Some(client) = self.client.as_mut() {
                let _ = client.close();
            }

            let mut client = DiscordIpcClient::new(client_id);
            client
                .connect()
                .map_err(|e| DiscordError::Ipc(e.to_string()))?;

            self.client = Some(client);
            self.client_id = Some(client_id.to_owned());
        }

        self.client
            .as_mut()
            .ok_or_else(|| DiscordError::Ipc("Discord IPC client is not initialized".into()))
    }
}
