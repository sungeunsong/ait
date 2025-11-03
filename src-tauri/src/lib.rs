mod db;
mod profile;
mod ssh;

use std::sync::Mutex;
use tauri::{Manager, State};

pub struct AppState {
    db: Mutex<Option<rusqlite::Connection>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            // Initialize database
            let conn = db::open_connection(app.handle())?;
            app.manage(AppState {
                db: Mutex::new(Some(conn)),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            ssh::ssh_open_shell,
            ssh::ssh_write,
            ssh::ssh_close,
            profile_create,
            profile_list,
            profile_get,
            profile_update,
            profile_delete,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn profile_create(
    state: State<AppState>,
    input: profile::CreateProfileInput,
) -> Result<profile::Profile, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    profile::create_profile(conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn profile_list(state: State<AppState>) -> Result<Vec<profile::Profile>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    profile::list_profiles(conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn profile_get(state: State<AppState>, id: String) -> Result<Option<profile::Profile>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    profile::get_profile(conn, &id).map_err(|e| e.to_string())
}

#[tauri::command]
fn profile_update(
    state: State<AppState>,
    input: profile::UpdateProfileInput,
) -> Result<profile::Profile, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    profile::update_profile(conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn profile_delete(state: State<AppState>, id: String) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    profile::delete_profile(conn, &id).map_err(|e| e.to_string())
}
