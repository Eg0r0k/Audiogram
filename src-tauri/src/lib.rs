use std::{fs, path::Path};

use tauri::Manager;

#[cfg(desktop)]
use tauri::Emitter;

#[cfg(desktop)]
mod updater;

#[cfg(desktop)]
mod thumbbar;
#[cfg(desktop)]
mod tray;
#[cfg(desktop)]
mod webview_visibility;

#[cfg(desktop)]
mod discord;

#[cfg(desktop)]
mod discord_utils;

mod youtube;

mod audio_cache;

mod ids;

mod media_server;

mod nd;

mod remote_download;

mod transcode;

mod ym;

mod proxy;

/// Passed by the autostart entry, so a launch at login can be told apart.
#[cfg(desktop)]
const AUTOSTART_FLAG: &str = "--autostart";

/// Whether the OS started this process at login. `args` is the whole argv.
#[cfg(desktop)]
fn is_autostart_launch(args: &[String]) -> bool {
    args.iter().skip(1).any(|arg| arg == AUTOSTART_FLAG)
}

/// Paths to open: every argument after the exe except the autostart flag.
#[cfg(desktop)]
fn files_to_open(args: &[String]) -> Vec<String> {
    args.iter()
        .skip(1)
        .filter(|arg| *arg != AUTOSTART_FLAG)
        .cloned()
        .collect()
}

#[cfg(desktop)]
#[derive(serde::Serialize)]
struct LaunchContext {
    autostart: bool,
}

/// The window stays hidden on an autostart launch until the frontend has
/// read its "Launch minimized" and "Close to tray" settings.
#[cfg(desktop)]
#[tauri::command]
fn launch_context() -> LaunchContext {
    LaunchContext {
        autostart: is_autostart_launch(&std::env::args().collect::<Vec<_>>()),
    }
}

fn dir_size(path: &Path) -> u64 {
    let mut total = 0;

    let Ok(entries) = fs::read_dir(path) else {
        return 0;
    };

    for entry in entries.flatten() {
        let Ok(metadata) = entry.metadata() else {
            continue;
        };

        if metadata.is_dir() {
            total += dir_size(&entry.path());
        } else {
            total += metadata.len();
        }
    }

    total
}

#[tauri::command]
async fn app_data_folder_size(app: tauri::AppHandle, folder: String) -> Result<u64, String> {
    match folder.as_str() {
        "tracks" | "lyrics" | "offline" | "offline/nd" | "offline/yt" | "offline/ym" => {}
        _ => return Err("unsupported app data folder".into()),
    }

    let target = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(folder);

    tauri::async_runtime::spawn_blocking(move || dir_size(&target))
        .await
        .map_err(|e| e.to_string())
}

/// True when `rel` can be safely joined under app-data: relative, and made of
/// plain components only (no `..`, no roots, no prefixes).
fn is_safe_import_target(rel: &Path) -> bool {
    !rel.as_os_str().is_empty()
        && rel
            .components()
            .all(|c| matches!(c, std::path::Component::Normal(_)))
}

/// Native-side copy for track import. The JS fallback streams Android SAF
/// sources (`content://`, unreachable by std::fs) through the WebView bridge
/// in 1 MiB chunks — ~500 IPC crossings for a 250 MB file, which takes
/// minutes on a phone. Here the SAF URI resolves to a raw fd once and the
/// whole `io::copy` stays native.
#[tauri::command]
async fn import_local_file(
    app: tauri::AppHandle,
    source: String,
    target_rel: String,
) -> Result<u64, String> {
    use std::str::FromStr;
    use tauri_plugin_fs::{FilePath, FsExt, OpenOptions};

    let rel = std::path::PathBuf::from(&target_rel);
    if !is_safe_import_target(&rel) {
        return Err("invalid target path".into());
    }

    let target = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join(rel);
    let source_path = FilePath::from_str(&source).map_err(|e| e.to_string())?;

    tauri::async_runtime::spawn_blocking(move || {
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        let mut options = OpenOptions::new();
        options.read(true);
        let mut src = app
            .fs()
            .open(source_path, options)
            .map_err(|e| e.to_string())?;
        let mut dst = std::fs::File::create(&target).map_err(|e| e.to_string())?;
        std::io::copy(&mut src, &mut dst).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Bound BEFORE any webview exists so the frontend can never observe a
    // non-listening media server. Binding loopback:0 only fails on a broken
    // network stack — without the playback transport the app is useless, so
    // failing fast beats limping on.
    let (media_listener, image_listener, media_state) =
        media_server::bind_on_loopback().expect("failed to bind the loopback media server");
    let media_token = media_state.token.clone();

    let builder = tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::new()
                // Trace is the plugin default and on Android the jni crate
                // traces every native call — thousands of lines per second of
                // audio, drowning app messages and hammering the log file.
                .level(log::LevelFilter::Info)
                // rustypipe instruments every client call with a span at
                // ERROR level (`music_details; video_id=…`) — the tracing→log
                // bridge prints those on success too. Its real failures reach
                // this crate as `Err` and are logged with context here.
                .filter(|metadata| !metadata.target().starts_with("rustypipe::client"))
                .max_file_size(5 * 1_024 * 1_024) // 5 MB per log file
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .manage(proxy::ProxyState::default())
        .manage(nd::NdState::default())
        .manage(nd::NdAudioCache::default())
        .manage(remote_download::DownloadRegistry::default())
        .manage(ym::YmState::default())
        .manage(ym::YmLinkCache::default())
        .manage(ym::YmAudioCache::default())
        .manage(youtube::YtStreamCache::default())
        .manage(youtube::YtAudioCache::default())
        .manage(media_state);

    #[cfg(desktop)]
    let builder = builder
        .manage(discord::DiscordPresenceState::default())
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            // A second launch (Start menu, shortcut) means "show me the app",
            // also when it sits in the tray or on the taskbar.
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }

            let files = files_to_open(&args);
            if !files.is_empty() {
                log::info!("second instance opened with files: {files:?}");
                let _ = app.emit("files-opened", files);
            }
        }))
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .arg(AUTOSTART_FLAG)
                .build(),
        )
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        // Visibility is not restored: the window is created hidden and shown
        // by setup (or, on an autostart launch, by the frontend); a session
        // quit from the tray would otherwise start every later one hidden.
        .plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::all()
                        - tauri_plugin_window_state::StateFlags::VISIBLE,
                )
                .build(),
        );

    #[cfg(desktop)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_data_folder_size,
        import_local_file,
        media_server::media_server_base,
        media_server::image_server_base,
        discord::discord_set_activity,
        discord::discord_clear_activity,
        thumbbar::thumbbar_set_state,
        launch_context,
        updater::check_update,
        updater::install_update,
        youtube::yt_register_stream,
        youtube::yt_prefetch,
        youtube::yt_download,
        youtube::yt_download_cancel,
        proxy::set_proxy,
        proxy::proxy_check,
        nd::nd_set_config,
        nd::nd_prefetch,
        nd::nd_download,
        nd::nd_download_cancel,
        ym::ym_auth_status,
        ym::ym_auth_start,
        ym::ym_auth_cancel,
        ym::ym_auth_logout,
        ym::ym_request,
        ym::ym_prefetch,
        ym::ym_download,
        ym::ym_download_cancel,
    ]);

    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        app_data_folder_size,
        import_local_file,
        media_server::media_server_base,
        media_server::image_server_base,
        proxy::set_proxy,
        proxy::proxy_check,
        nd::nd_set_config,
        nd::nd_prefetch,
        nd::nd_download,
        nd::nd_download_cancel,
        ym::ym_auth_status,
        ym::ym_auth_start,
        ym::ym_auth_cancel,
        ym::ym_auth_logout,
        ym::ym_request,
        ym::ym_prefetch,
        ym::ym_download,
        ym::ym_download_cancel,
        youtube::yt_register_stream,
        youtube::yt_prefetch,
        youtube::yt_download,
        youtube::yt_download_cancel,
    ]);

    builder
        .setup(move |app| {
            // The config windows are created after setup returns, so the
            // accept loop is live before the first frontend request (and the
            // bound socket's backlog would hold early connections anyway).
            media_server::spawn(
                app.handle().clone(),
                media_token,
                media_listener,
                image_listener,
            );

            #[cfg(desktop)]
            {
                tray::setup_tray(app)?;
                thumbbar::setup(app)?;
                webview_visibility::setup(app)?;

                let args: Vec<String> = std::env::args().collect();
                if !is_autostart_launch(&args) {
                    if let Some(window) = app.get_webview_window("main") {
                        window.show()?;
                        window.set_focus()?;
                    }
                }

                // An entry written by an older version has no flag.
                {
                    use tauri_plugin_autostart::ManagerExt;
                    let autolaunch = app.autolaunch();
                    if autolaunch.is_enabled().unwrap_or(false) {
                        if let Err(e) = autolaunch.enable() {
                            log::warn!("autostart: refreshing the entry failed: {e}");
                        }
                    }
                }

                let files = files_to_open(&args);
                if !files.is_empty() {
                    let app_handle = app.handle().clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_millis(500));
                        let _ = app_handle.emit("files-opened", files);
                    });
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod import_target_tests {
    use super::is_safe_import_target;
    use std::path::Path;

    #[test]
    fn accepts_plain_relative_paths() {
        assert!(is_safe_import_target(Path::new("tracks/a.flac")));
        assert!(is_safe_import_target(Path::new("offline/nd/x.mp3")));
    }

    #[test]
    fn rejects_traversal_roots_and_empty() {
        assert!(!is_safe_import_target(Path::new("../x")));
        assert!(!is_safe_import_target(Path::new("tracks/../../x")));
        assert!(!is_safe_import_target(Path::new("/abs/path")));
        assert!(!is_safe_import_target(Path::new("")));
    }
}

#[cfg(all(test, desktop))]
mod launch_args_tests {
    use super::{files_to_open, is_autostart_launch};

    fn args(list: &[&str]) -> Vec<String> {
        list.iter().map(|s| (*s).to_string()).collect()
    }

    #[test]
    fn detects_the_autostart_flag_after_the_exe() {
        assert!(is_autostart_launch(&args(&[
            "audiogram.exe",
            "--autostart"
        ])));
        assert!(!is_autostart_launch(&args(&["audiogram.exe"])));
        assert!(!is_autostart_launch(&args(&["--autostart"])));
    }

    #[test]
    fn opens_every_argument_but_the_flag() {
        assert_eq!(
            files_to_open(&args(&["audiogram.exe", "--autostart", "a.flac", "b.mp3"])),
            args(&["a.flac", "b.mp3"])
        );
        assert!(files_to_open(&args(&["audiogram.exe", "--autostart"])).is_empty());
        assert!(files_to_open(&args(&["audiogram.exe"])).is_empty());
    }
}
