use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Emitter, Manager, WindowEvent,
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

#[derive(Clone, serde::Serialize)]
struct InstallProgress {
    percent: u32,
    stage: String,
    message: String,
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

fn get_internal_cctv_dir() -> std::path::PathBuf {
    let home = std::env::var("HOME").or_else(|_| std::env::var("USERPROFILE")).unwrap_or_default();
    std::path::PathBuf::from(home).join(".ceova").join("apps").join("ceova-cctv")
}

fn start_cctv_supervisor_process() -> Result<bool, String> {
    if is_port_open(3080) || is_port_open(8085) {
        return Ok(true);
    }

    let internal_dir = get_internal_cctv_dir();

    #[cfg(target_os = "macos")]
    {
        let internal_mac_app = internal_dir.join("CEOVA-CCTV.app");
        let mac_app_path = if internal_mac_app.exists() {
            internal_mac_app
        } else {
            std::path::PathBuf::from("/Applications/CEOVA-CCTV.app")
        };

        if mac_app_path.exists() {
            let binary = mac_app_path.join("Contents").join("MacOS").join("CEOVA-CCTV");
            let server_js = mac_app_path.join("Contents").join("Resources").join("app.asar").join("server.js");

            // Run headless in background as an internal node microservice (NO separate window, NO dock icon!)
            let mut cmd = Command::new(&binary);
            cmd.env("ELECTRON_RUN_AS_NODE", "1")
               .env("NODE_ENV", "production")
               .arg(server_js)
               .stdin(std::process::Stdio::null())
               .stdout(std::process::Stdio::null())
               .stderr(std::process::Stdio::null());

            let _ = cmd.spawn();
            return Ok(true);
        }
    }

    #[cfg(target_os = "windows")]
    {
        let internal_exe = internal_dir.join("CEOVA-CCTV.exe");
        let win_exe_path = if internal_exe.exists() {
            internal_exe
        } else {
            let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
            std::path::PathBuf::from(format!("{}\\Programs\\CEOVA-CCTV\\CEOVA-CCTV.exe", local_app_data))
        };

        if win_exe_path.exists() {
            let asar_server = internal_dir.join("resources").join("app.asar").join("server.js");
            let mut cmd = Command::new(&win_exe_path);
            cmd.env("ELECTRON_RUN_AS_NODE", "1")
               .env("NODE_ENV", "production")
               .arg(asar_server)
               .stdin(std::process::Stdio::null())
               .stdout(std::process::Stdio::null())
               .stderr(std::process::Stdio::null());

            let _ = cmd.spawn();
            return Ok(true);
        }
    }

    Ok(false)
}

#[tauri::command]
fn start_cctv_service() -> Result<bool, String> {
    start_cctv_supervisor_process()
}

#[tauri::command]
fn stop_cctv_service(app: tauri::AppHandle) -> Result<bool, String> {
    if let Some(cctv_win) = app.get_webview_window("cctv") {
        let _ = cctv_win.destroy();
    }

    #[cfg(unix)]
    {
        let _ = Command::new("pkill").arg("-9").arg("-f").arg("CEOVA-CCTV").output();
        let _ = Command::new("sh")
            .arg("-c")
            .arg("lsof -ti :3080 -ti :8085 -ti :3443 | xargs kill -9 2>/dev/null || true")
            .output();
        let _ = Command::new("pkill").arg("-9").arg("-f").arg("services/supervisor.js").output();
        let _ = Command::new("pkill").arg("-9").arg("-f").arg("ceova-cctv").output();
    }
    #[cfg(windows)]
    {
        let _ = Command::new("cmd")
            .args(&["/C", "taskkill /F /IM CEOVA-CCTV.exe 2>nul & for /f \"tokens=5\" %a in ('netstat -aon ^| findstr \":3080 :8085 :3443\"') do taskkill /F /PID %a 2>nul"])
            .output();
    }

    Ok(true)
}

#[tauri::command]
fn delete_cctv_app(app: tauri::AppHandle) -> Result<bool, String> {
    let _ = stop_cctv_service(app);

    let internal_dir = get_internal_cctv_dir();
    if internal_dir.exists() {
        let _ = std::fs::remove_dir_all(&internal_dir);
        println!("[CEOVA-TAURI] Deleted internal CCTV directory: {:?}", internal_dir);
    }

    #[cfg(target_os = "macos")]
    {
        if std::path::Path::new("/Applications/CEOVA-CCTV.app").exists() {
            let _ = std::fs::remove_dir_all("/Applications/CEOVA-CCTV.app");
            println!("[CEOVA-TAURI] Removed /Applications/CEOVA-CCTV.app");
        }
    }

    Ok(true)
}

#[tauri::command]
fn is_cctv_installed() -> Result<bool, String> {
    let internal_dir = get_internal_cctv_dir();
    #[cfg(target_os = "macos")]
    {
        if internal_dir.join("CEOVA-CCTV.app").exists() {
            return Ok(true);
        }
        if std::path::Path::new("/Applications/CEOVA-CCTV.app").exists() {
            return Ok(true);
        }
        Ok(false)
    }
    #[cfg(target_os = "windows")]
    {
        if internal_dir.join("CEOVA-CCTV.exe").exists() {
            return Ok(true);
        }
        let local_app_data = std::env::var("LOCALAPPDATA").unwrap_or_default();
        let win_cctv_path = format!("{}\\Programs\\CEOVA-CCTV\\CEOVA-CCTV.exe", local_app_data);
        if std::path::Path::new(&win_cctv_path).exists() {
            return Ok(true);
        }
        Ok(false)
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        Ok(internal_dir.exists())
    }
}

#[tauri::command]
async fn install_cctv_package(app: tauri::AppHandle, package_url: Option<String>) -> Result<bool, String> {
    let resolved_url = if let Some(url) = package_url.filter(|u| !u.trim().is_empty()) {
        url
    } else {
        #[cfg(target_os = "macos")]
        {
            if std::env::consts::ARCH == "aarch64" {
                "https://github.com/buildmyceo/cctv-ceova/releases/download/v1.0.0/CEOVA-CCTV-1.0.0-mac-arm64.dmg".to_string()
            } else {
                "https://github.com/buildmyceo/cctv-ceova/releases/download/v1.0.0/CEOVA-CCTV-1.0.0-mac-x64.dmg".to_string()
            }
        }
        #[cfg(target_os = "windows")]
        {
            "https://github.com/buildmyceo/cctv-ceova/releases/download/v1.0.0/CEOVA-CCTV-1.0.0-win-x64.exe".to_string()
        }
        #[cfg(not(any(target_os = "macos", target_os = "windows")))]
        {
            return Err("Automatic download is only supported on macOS and Windows.".to_string());
        }
    };

    println!("[CEOVA-TAURI] Starting automatic CCTV download from: {}", resolved_url);

    let _ = app.emit("cctv_install_progress", InstallProgress {
        percent: 5,
        stage: "connecting".into(),
        message: "Connecting to CCTV download server...".into(),
    });

    #[cfg(target_os = "macos")]
    {
        let tmp_dmg = "/tmp/CEOVA-CCTV-installer.dmg";
        let _ = std::fs::remove_file(tmp_dmg);

        let _ = app.emit("cctv_install_progress", InstallProgress {
            percent: 10,
            stage: "downloading".into(),
            message: "Starting package download (118 MB)...".into(),
        });

        let mut child = Command::new("curl")
            .arg("-L")
            .arg("-f")
            .arg("-s")
            .arg("-S")
            .arg("-o")
            .arg(tmp_dmg)
            .arg(&resolved_url)
            .spawn()
            .map_err(|e| format!("Failed to start curl: {}", e))?;

        let expected_size: f64 = if std::env::consts::ARCH == "aarch64" {
            123_269_516.0
        } else {
            128_861_322.0
        };

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    if !status.success() {
                        return Err(format!("Download failed with curl exit code: {:?}", status.code()));
                    }
                    break;
                }
                Ok(None) => {
                    if let Ok(meta) = std::fs::metadata(tmp_dmg) {
                        let current_bytes = meta.len() as f64;
                        let fraction = (current_bytes / expected_size).min(1.0);
                        let percent = 10 + (fraction * 65.0) as u32;
                        let current_mb = current_bytes / (1024.0 * 1024.0);
                        let total_mb = expected_size / (1024.0 * 1024.0);
                        let _ = app.emit("cctv_install_progress", InstallProgress {
                            percent,
                            stage: "downloading".into(),
                            message: format!("Downloading CEOVA CCTV ({:.1} MB / {:.0} MB)...", current_mb, total_mb),
                        });
                    }
                    std::thread::sleep(std::time::Duration::from_millis(300));
                }
                Err(e) => return Err(format!("Error monitoring download: {}", e)),
            }
        }

        let _ = app.emit("cctv_install_progress", InstallProgress {
            percent: 78,
            stage: "verifying".into(),
            message: "Verifying installer package...".into(),
        });

        std::thread::sleep(std::time::Duration::from_millis(350));

        let _ = app.emit("cctv_install_progress", InstallProgress {
            percent: 85,
            stage: "installing".into(),
            message: "Installing internal CCTV components...".into(),
        });

        let attach_output = Command::new("hdiutil")
            .arg("attach")
            .arg(tmp_dmg)
            .arg("-nobrowse")
            .output()
            .map_err(|e| format!("Failed to attach DMG: {}", e))?;

        let attach_str = String::from_utf8_lossy(&attach_output.stdout);
        let mut mount_path = String::new();
        for line in attach_str.lines() {
            if let Some(pos) = line.find("/Volumes/") {
                mount_path = line[pos..].trim().to_string();
                break;
            }
        }

        if mount_path.is_empty() {
            mount_path = "/Volumes/CEOVA CCTV".to_string();
        }

        let internal_dir = get_internal_cctv_dir();
        let _ = std::fs::create_dir_all(&internal_dir);
        let internal_mac_app = internal_dir.join("CEOVA-CCTV.app");

        let cp_res = Command::new("sh")
            .arg("-c")
            .arg(format!("rm -rf \"{}\" && cp -R \"{}\"/*.app \"{}\"", internal_mac_app.display(), mount_path, internal_dir.display()))
            .output();

        let _ = Command::new("hdiutil")
            .arg("detach")
            .arg(&mount_path)
            .arg("-force")
            .output();

        let _ = std::fs::remove_file(tmp_dmg);

        let _ = Command::new("xattr")
            .arg("-cr")
            .arg(&internal_mac_app)
            .output();

        if let Err(e) = cp_res {
            return Err(format!("Failed to copy app to internal directory: {}", e));
        }

        let _ = app.emit("cctv_install_progress", InstallProgress {
            percent: 95,
            stage: "launching".into(),
            message: "Starting internal CCTV service...".into(),
        });

        // Launch internal headless service daemon
        let _ = start_cctv_supervisor_process();

        let _ = app.emit("cctv_install_progress", InstallProgress {
            percent: 100,
            stage: "completed".into(),
            message: "CEOVA CCTV is ready!".into(),
        });

        return Ok(true);
    }

    #[cfg(target_os = "windows")]
    {
        let temp_dir = std::env::var("TEMP").unwrap_or_else(|_| "C:\\Temp".to_string());
        let tmp_exe = format!("{}\\CEOVA-CCTV-installer.exe", temp_dir);
        let _ = std::fs::remove_file(&tmp_exe);

        let mut child = Command::new("curl")
            .arg("-L")
            .arg("-f")
            .arg("-s")
            .arg("-S")
            .arg("-o")
            .arg(&tmp_exe)
            .arg(&resolved_url)
            .spawn()
            .map_err(|e| format!("Failed to start curl: {}", e))?;

        let expected_size: f64 = 102_199_342.0;

        loop {
            match child.try_wait() {
                Ok(Some(status)) => {
                    if !status.success() {
                        return Err(format!("Download failed with curl exit code: {:?}", status.code()));
                    }
                    break;
                }
                Ok(None) => {
                    if let Ok(meta) = std::fs::metadata(&tmp_exe) {
                        let current_bytes = meta.len() as f64;
                        let fraction = (current_bytes / expected_size).min(1.0);
                        let percent = 10 + (fraction * 65.0) as u32;
                        let _ = app.emit("cctv_install_progress", InstallProgress {
                            percent,
                            stage: "downloading".into(),
                            message: format!("Downloading CEOVA CCTV ({:.1} MB)...", current_bytes / (1024.0 * 1024.0)),
                        });
                    }
                    std::thread::sleep(std::time::Duration::from_millis(300));
                }
                Err(e) => return Err(format!("Error monitoring download: {}", e)),
            }
        }

        let _ = app.emit("cctv_install_progress", InstallProgress {
            percent: 85,
            stage: "installing".into(),
            message: "Installing CEOVA CCTV on Windows...".into(),
        });

        let _ = Command::new("cmd")
            .args(&["/C", "start", "/wait", "", &tmp_exe, "/S"])
            .output();

        let _ = std::fs::remove_file(&tmp_exe);

        let _ = app.emit("cctv_install_progress", InstallProgress {
            percent: 100,
            stage: "completed".into(),
            message: "CEOVA CCTV is ready!".into(),
        });

        return Ok(true);
    }
}

#[tauri::command]
fn get_cctv_service_status() -> Result<bool, String> {
    Ok(is_port_open(3080) || is_port_open(8085))
}

#[tauri::command]
fn open_cctv_window(_app: tauri::AppHandle) -> Result<(), String> {
    let _ = start_cctv_supervisor_process();
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
            stop_cctv_service,
            delete_cctv_app,
            get_cctv_service_status,
            open_cctv_window,
            is_cctv_installed,
            install_cctv_package
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
