use tauri::Emitter;

#[cfg(desktop)]
mod updater;

#[cfg(desktop)]
mod tray;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init());

    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_single_instance::init(|app, args, _cwd| {
            let files: Vec<String> = args.into_iter().skip(1).collect();

            if !files.is_empty() {
                println!("Second instance files: {:?}", files);

                let _ = app.emit("files-opened", files);
            }
        }))
        .plugin(tauri_plugin_autostart::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build());

    #[cfg(desktop)]
    let builder = builder.invoke_handler(tauri::generate_handler![
        greet,
        updater::check_update,
        updater::install_update,
    ]);

    #[cfg(mobile)]
    let builder = builder.invoke_handler(tauri::generate_handler![greet]);

    builder
        .setup(|app| {
            #[cfg(desktop)]
            {
                tray::setup_tray(app)?;

                let files: Vec<String> = std::env::args().skip(1).collect();
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
