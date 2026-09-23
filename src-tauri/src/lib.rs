use tauri::{
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Emitter, Manager, WindowEvent,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

#[tauri::command]
fn open_main_window_with_prompt(app: tauri::AppHandle, prompt: String) {
    if let Some(quickbar) = app.get_webview_window("quickbar") {
        let _ = quickbar.hide();
    }
    if let Some(main) = app.get_webview_window("main") {
        let _ = main.unminimize();
        let _ = main.show();
        let _ = main.set_focus();
        let _ = main.emit("quick-prompt-submit", serde_json::json!({ "prompt": prompt }));
    }
}

#[tauri::command]
fn hide_quickbar(app: tauri::AppHandle) {
    if let Some(quickbar) = app.get_webview_window("quickbar") {
        let _ = quickbar.hide();
    }
}

fn toggle_quickbar_window(app: &tauri::AppHandle) {
    if let Some(quickbar) = app.get_webview_window("quickbar") {
        if quickbar.is_visible().unwrap_or(false) {
            let _ = quickbar.hide();
        } else {
            let _ = quickbar.center();
            let _ = quickbar.show();
            let _ = quickbar.set_focus();
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    if event.state() == ShortcutState::Pressed {
                        let opt_space: Shortcut = "Option+Space".parse().unwrap();
                        let cmd_shift_space: Shortcut = "Command+Shift+Space".parse().unwrap();
                        if shortcut == &opt_space || shortcut == &cmd_shift_space {
                            toggle_quickbar_window(app);
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Register global shortcut
            let handle = app.handle();
            let _ = handle.global_shortcut().register("Option+Space".parse::<Shortcut>().unwrap());
            let _ = handle.global_shortcut().register("Command+Shift+Space".parse::<Shortcut>().unwrap());

            // Build Tray Menu
            let toggle_quickbar_item = MenuItem::with_id(app, "toggle_quickbar", "Quick Bar (⌥ Space)", true, None::<&str>)?;
            let open_main_item = MenuItem::with_id(app, "open_main", "Open CEOVA", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit CEOVA", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&toggle_quickbar_item, &open_main_item, &quit_item])?;

            // Load Tray Icon
            let icon = tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png"))
                .unwrap_or_else(|_| app.default_window_icon().unwrap().clone());

            let _tray = TrayIconBuilder::with_id("ceova-tray")
                .icon(icon)
                .icon_as_template(true)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "toggle_quickbar" => {
                            toggle_quickbar_window(app);
                        }
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
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_quickbar_window(tray.app_handle());
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            match event {
                WindowEvent::CloseRequested { api, .. } => {
                    api.prevent_close();
                    let _ = window.hide();
                }
                WindowEvent::Focused(false) => {
                    if window.label() == "quickbar" {
                        let _ = window.hide();
                    }
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            open_main_window_with_prompt,
            hide_quickbar
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
