use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Runtime};
use tauri_plugin_updater::UpdaterExt;
use time::format_description::well_known::Rfc3339;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub version: String,
    pub current_version: String,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct UpdateError(String);

impl From<tauri_plugin_updater::Error> for UpdateError {
    fn from(e: tauri_plugin_updater::Error) -> Self {
        UpdateError(e.to_string())
    }
}

fn build_updater<R: Runtime>(
    app: &AppHandle<R>,
) -> Result<tauri_plugin_updater::Updater, UpdateError> {
    app.updater_builder().build().map_err(UpdateError::from)
}

#[tauri::command]
pub async fn check_update<R: Runtime>(
    app: AppHandle<R>,
) -> Result<Option<UpdateInfo>, UpdateError> {
    let updater = build_updater(&app)?;

    match updater.check().await {
        Ok(Some(update)) => Ok(Some(UpdateInfo {
            version: update.version.clone(),
            current_version: update.current_version.clone(),
            body: update.body.clone(),
            date: update.date.and_then(|d| d.format(&Rfc3339).ok()),
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(UpdateError::from(e)),
    }
}

#[tauri::command]
pub async fn install_update<R: Runtime>(app: AppHandle<R>) -> Result<(), UpdateError> {
    let updater = build_updater(&app)?;

    let update = updater
        .check()
        .await
        .map_err(UpdateError::from)?
        .ok_or_else(|| UpdateError("no update available".into()))?;

    let app_handle = app.clone();

    update
        .download_and_install(
            |chunk_length, content_length| {
                let _ = app_handle.emit(
                    "update://download-progress",
                    serde_json::json!({
                        "chunkLength": chunk_length,
                        "contentLength": content_length,
                    }),
                );
            },
            || {
                let _ = app_handle.emit("update://install-started", ());
            },
        )
        .await
        .map_err(UpdateError::from)?;

    let _ = app.emit("update://finished", ());
    app.restart();
}
