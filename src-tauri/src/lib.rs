use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};
use std::process::Command;
use std::net::TcpStream;
use std::time::Duration;

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

fn is_port_open(port: u16) -> bool {
    let addr = format!("127.0.0.1:{}", port);
    if let Ok(socket_addr) = addr.parse() {
        TcpStream::connect_timeout(&socket_addr, Duration::from_millis(300)).is_ok()
    } else {
        false
    }
}

fn start_cctv_supervisor_process() -> Result<bool, String> {
    if is_port_open(3080) || is_port_open(8085) {
        return Ok(true);
    }

    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_default();
    
    let candidates = [
        (
            format!("{}/cctv-ceova/services/supervisor.js", home),
            format!("{}/cctv-ceova/runtime/bin/node", home),
            format!("{}/cctv-ceova", home),
            vec!["start"],
        ),
        (
            format!("{}/cctv-ceova/server.js", home),
            format!("{}/cctv-ceova/runtime/bin/node", home),
            format!("{}/cctv-ceova", home),
            vec![],
        ),
        (
            format!("{}/.ceova/apps/ceova-cctv/current/services/supervisor.js", home),
            format!("{}/.ceova/apps/ceova-cctv/current/runtime/bin/node", home),
            format!("{}/.ceova/apps/ceova-cctv/current", home),
            vec!["start"],
        ),
        (
            format!("{}/.ceova/apps/ceova-cctv/current/server.js", home),
            format!("{}/.ceova/apps/ceova-cctv/current/runtime/bin/node", home),
            format!("{}/.ceova/apps/ceova-cctv/current", home),
            vec![],
        ),
    ];

    let fallback_nodes = [
        format!("{}/.nvm/versions/node/v24.14.1/bin/node", home),
        "/opt/homebrew/bin/node".to_string(),
        "/usr/local/bin/node".to_string(),
        "node".to_string(),
    ];

    for (script, node, cwd, args) in candidates.iter() {
        if std::path::Path::new(script).exists() {
            let mut node_bin = node.clone();
            if !std::path::Path::new(&node_bin).exists() {
                for fb in fallback_nodes.iter() {
                    if std::path::Path::new(fb).exists() || fb == "node" {
                        node_bin = fb.clone();
                        break;
                    }
                }
            }

            let mut cmd = Command::new(&node_bin);
            cmd.arg(script);
            for arg in args {
                cmd.arg(arg);
            }
            cmd.current_dir(cwd);

            match cmd.spawn() {
                Ok(_) => {
                    println!("[CEOVA-TAURI] CCTV supervisor/server started automatically.");
                    return Ok(true);
                }
                Err(e) => {
                    println!("[CEOVA-TAURI] Warning starting CCTV: {}", e);
                }
            }
        }
    }

    Ok(false)
}

#[tauri::command]
fn start_cctv_service() -> Result<bool, String> {
    start_cctv_supervisor_process()
}

#[tauri::command]
fn get_cctv_service_status() -> Result<bool, String> {
    Ok(is_port_open(3080) || is_port_open(8085))
}

#[tauri::command]
fn open_cctv_window(app: tauri::AppHandle) -> Result<(), String> {
    let _ = start_cctv_supervisor_process();

    if let Some(cctv_win) = app.get_webview_window("cctv") {
        let _ = cctv_win.unminimize();
        let _ = cctv_win.show();
        let _ = cctv_win.set_focus();
        let _ = cctv_win.eval("if (!window.location.href.includes('3080') || document.body.innerHTML.trim() === '') { window.location.href = 'http://127.0.0.1:3080'; }");
        return Ok(());
    }

    if !is_port_open(3080) {
        for _ in 0..15 {
            std::thread::sleep(Duration::from_millis(200));
            if is_port_open(3080) {
                break;
            }
        }
    }

    let url_str = "http://127.0.0.1:3080";
    let url = tauri::Url::parse(url_str).map_err(|e| e.to_string())?;
    let cctv_url = tauri::WebviewUrl::External(url);

    let win_builder = tauri::WebviewWindowBuilder::new(&app, "cctv", cctv_url)
        .title("CEOVA CCTV")
        .inner_size(1280.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .devtools(true)
        .visible(true)
        .focused(true);

    let win = win_builder.build().map_err(|e| e.to_string())?;
    let _ = win.unminimize();
    let _ = win.show();
    let _ = win.set_focus();

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            save_desktop_session,
            load_desktop_session,
            clear_desktop_session,
            start_cctv_service,
            get_cctv_service_status,
            open_cctv_window
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
            // Automatically launch CCTV background service on app startup
            std::thread::spawn(|| {
                std::thread::sleep(Duration::from_millis(500));
                let _ = start_cctv_supervisor_process();
            });

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
                // Keep main window in background when closed; destroy auxiliary windows like cctv on close
                WindowEvent::CloseRequested { api, .. } => {
                    if window.label() == "main" {
                        api.prevent_close();
                        let _ = window.hide();
                    } else if window.label() == "cctv" {
                        let _ = window.destroy();
                    }
                }
                _ => {}
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
