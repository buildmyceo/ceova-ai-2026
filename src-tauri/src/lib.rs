use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};

fn get_ceova_session_path() -> Option<std::path::PathBuf> {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .ok()?;
    let dir = std::path::PathBuf::from(home).join(".ceova");
    let _ = std::fs::create_dir_all(&dir);
    Some(dir.join("session.json"))
}

#[tauri::command]
fn save_desktop_session(token: String) -> Result<(), String> {
    if let Some(path) = get_ceova_session_path() {
        std::fs::write(path, token).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
fn load_desktop_session() -> Result<Option<String>, String> {
    if let Some(path) = get_ceova_session_path() {
        if path.exists() {
            let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
            return Ok(Some(content));
        }
    }
    Ok(None)
}

#[tauri::command]
fn clear_desktop_session() -> Result<(), String> {
    if let Some(path) = get_ceova_session_path() {
        if path.exists() {
            let _ = std::fs::remove_file(path);
        }
    }
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_desktop_session,
            load_desktop_session,
            clear_desktop_session
        ])
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Build Tray Menu with Open and Quit options
            let open_main_item = MenuItem::with_id(app, "open_main", "Open CEOVA", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit CEOVA", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open_main_item, &quit_item])?;

            // Load Tray Icon
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
                .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

            let _tray = TrayIconBuilder::with_id("ceova-tray")
                .icon(icon)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(true)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "open_main" => {
                            if let Some(main) = app.get_webview_window("main") {
                                let _ = main.unminimize();
                                let _ = main.show();
                                let _ = main.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                // Keep app running in background when main window is closed
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
