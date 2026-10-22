#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{net::TcpListener, path::PathBuf, process::{Child, Command, Stdio}, sync::{Arc, Mutex}};
use tauri::Manager;

#[derive(Clone, serde::Serialize)]
struct Connection { origin: String, key: String }
struct Backend { child: Arc<Mutex<Option<Child>>>, connection: Connection }
struct BackendCleanup(Arc<Mutex<Option<Child>>>);
impl tauri::Resource for BackendCleanup {}
impl Drop for BackendCleanup {
    fn drop(&mut self) {
        if let Ok(mut child) = self.0.lock() {
            if let Some(mut process) = child.take() { let _ = process.kill(); let _ = process.wait(); }
        }
    }
}
impl Backend {
    fn stop(&self) {
        if let Ok(mut child) = self.child.lock() {
            if let Some(mut process) = child.take() { let _ = process.kill(); let _ = process.wait(); }
        }
    }
}
#[tauri::command]
fn backend_connection(state: tauri::State<'_, Backend>) -> Connection { state.connection.clone() }

fn main() {
    let builder = tauri::Builder::default();
    // Les tests utilisent une base dédiée et ne doivent pas activer la fenêtre
    // d'une installation personnelle déjà ouverte sur le même poste.
    let isolated_test = std::env::var("IMMO_DESKTOP_TEST_INSTANCE").as_deref() == Ok("1")
        && std::env::var_os("IMMO_DESKTOP_DATA_DIR").is_some();
    let builder = if isolated_test { builder } else {
        builder.plugin(tauri_plugin_single_instance::init(|app, _, _| {
            if let Some(window) = app.get_webview_window("main") { let _ = window.show(); let _ = window.set_focus(); }
        }))
    };
    let app = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![backend_connection])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.manage(Backend { child: Arc::new(Mutex::new(None)), connection: Connection { origin: "http://127.0.0.1:8000".into(), key: String::new() } });
                return Ok(());
            }
            let dir: PathBuf = std::env::var_os("IMMO_DESKTOP_DATA_DIR").map(PathBuf::from).unwrap_or(app.path().app_local_data_dir()?);
            std::fs::create_dir_all(&dir)?;
            let socket = TcpListener::bind("127.0.0.1:0")?;
            let port = socket.local_addr()?.port();
            drop(socket);
            let key = uuid::Uuid::new_v4().to_string() + &uuid::Uuid::new_v4().to_string();
            let executable = app.path().resource_dir()?.join("backend").join("immo-backend.exe");
            let mut command = Command::new(executable);
            command.args(["--port", &port.to_string(), "--parent-pid", &std::process::id().to_string()])
                .arg("--data-dir").arg(&dir).env("IMMO_DESKTOP_KEY", &key)
                .current_dir(&dir).stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null());
            #[cfg(windows)] {
                use std::os::windows::process::CommandExt;
                command.creation_flags(0x08000000);
            }
            let child = command.spawn()?;
            let child = Arc::new(Mutex::new(Some(child)));
            // L’updater appelle cleanup_before_exit, qui vide cette table avant l’installation.
            app.resources_table().add(BackendCleanup(child.clone()));
            app.manage(Backend { child, connection: Connection { origin: format!("http://127.0.0.1:{port}"), key } });
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("Impossible de démarrer IMMO PILOT AI");
    app.run(|app, event| { if matches!(event, tauri::RunEvent::Exit) { app.state::<Backend>().stop(); } });
}
