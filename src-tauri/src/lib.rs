mod ai;
mod commands_dict;
mod db;
mod history;
mod macros;
mod profile;
mod settings;
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
            // Setup logging to file in production
            #[cfg(not(debug_assertions))]
            {
                use std::fs::OpenOptions;
                use std::io::Write;

                if let Some(app_data) = app.path().app_data_dir().ok() {
                    let log_path = app_data.join("ait.log");

                    // Create a simple logger that writes to file
                    if let Ok(mut file) = OpenOptions::new()
                        .create(true)
                        .append(true)
                        .open(&log_path)
                    {
                        let timestamp = chrono::Local::now().format("%Y-%m-%d %H:%M:%S");
                        let _ = writeln!(file, "\n========== AIT Started at {} ==========", timestamp);
                        println!("[Setup] Logging to: {:?}", log_path);
                    }
                }
            }

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
            ssh::ssh_resize,
            ssh::ssh_close,
            ssh::ssh_exec,
            profile_create,
            profile_list,
            profile_get,
            profile_update,
            profile_delete,
            profile_get_password,
            profile_set_password,
            test_keyring,
            history_save,
            history_search,
            history_suggestions,
            history_clear,
            history_clear_all,
            settings_get,
            settings_set,
            settings_get_all,
            ai_ask,
            ai_extract_commands,
            macros_get,
            macros_set,
            macros_delete,
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

/// Test keyring functionality (for debugging)
#[tauri::command]
fn test_keyring() -> Result<String, String> {
    use keyring::Entry;

    let test_service = "ait-test";
    let test_user = "test-user";
    let test_password = "test-password-123";

    println!("[Keyring Test] Starting keyring test...");

    // Step 1: Create entry
    let entry = match Entry::new(test_service, test_user) {
        Ok(e) => {
            println!("[Keyring Test] ✓ Entry created successfully");
            e
        }
        Err(e) => {
            return Err(format!("Failed to create entry: {}", e));
        }
    };

    // Step 2: Set password
    match entry.set_password(test_password) {
        Ok(_) => println!("[Keyring Test] ✓ Password set successfully"),
        Err(e) => {
            return Err(format!("Failed to set password: {}", e));
        }
    }

    // Step 3: Get password
    let retrieved = match entry.get_password() {
        Ok(pwd) => {
            println!("[Keyring Test] ✓ Password retrieved successfully");
            pwd
        }
        Err(e) => {
            return Err(format!("Failed to get password: {}", e));
        }
    };

    // Step 4: Verify password
    if retrieved == test_password {
        println!("[Keyring Test] ✓ Password matches!");
    } else {
        return Err(format!("Password mismatch! Expected: {}, Got: {}", test_password, retrieved));
    }

    // Step 5: Delete password
    match entry.delete_credential() {
        Ok(_) => println!("[Keyring Test] ✓ Password deleted successfully"),
        Err(e) => {
            return Err(format!("Failed to delete password: {}", e));
        }
    }

    // Step 6: Verify deletion
    match entry.get_password() {
        Ok(_) => {
            return Err("Password still exists after deletion!".to_string());
        }
        Err(keyring::Error::NoEntry) => {
            println!("[Keyring Test] ✓ Password deletion verified");
        }
        Err(e) => {
            return Err(format!("Unexpected error after deletion: {}", e));
        }
    }

    Ok("Keyring test passed successfully! ✓".to_string())
}

#[tauri::command]
fn profile_get_password(state: State<AppState>, profile_id: String) -> Result<Option<String>, String> {
    // First, try to get password from keyring
    match profile::get_password(&profile_id) {
        Ok(Some(password)) => {
            // Found in keyring
            Ok(Some(password))
        }
        Ok(None) | Err(_) => {
            // Not found in keyring or keyring unavailable, try database fallback
            let db_guard = state.db.lock().unwrap();
            let conn = db_guard.as_ref().ok_or("Database not initialized")?;

            match profile::get_profile(conn, &profile_id) {
                Ok(Some(profile)) if profile.password.is_some() => {
                    println!("[Profile] Using database fallback for password (profile: {})", profile_id);
                    Ok(profile.password)
                }
                Ok(Some(_)) => {
                    println!("[Profile] No password found in keyring or database for profile: {}", profile_id);
                    Ok(None)
                }
                Ok(None) => {
                    Err(format!("Profile not found: {}", profile_id))
                }
                Err(e) => {
                    Err(format!("Database error: {}", e))
                }
            }
        }
    }
}

#[tauri::command]
fn profile_set_password(state: State<AppState>, profile_id: String, password: String) -> Result<(), String> {
    // Try to store in keyring first
    match profile::store_password(&profile_id, &password) {
        Ok(()) => {
            // Successfully stored in keyring, clear from database
            let db_guard = state.db.lock().unwrap();
            let conn = db_guard.as_ref().ok_or("Database not initialized")?;

            conn.execute(
                "UPDATE profiles SET password = NULL WHERE id = ?1",
                [&profile_id]
            ).map_err(|e| format!("Failed to clear password from database: {}", e))?;

            Ok(())
        }
        Err(_) => {
            // Keyring unavailable, store in database as fallback
            println!("[Profile] Keyring unavailable, storing password in database for profile: {}", profile_id);

            let db_guard = state.db.lock().unwrap();
            let conn = db_guard.as_ref().ok_or("Database not initialized")?;

            conn.execute(
                "UPDATE profiles SET password = ?1 WHERE id = ?2",
                rusqlite::params![&password, &profile_id]
            ).map_err(|e| format!("Failed to store password in database: {}", e))?;

            Ok(())
        }
    }
}

#[tauri::command]
fn history_save(
    state: State<AppState>,
    input: history::SaveHistoryInput,
) -> Result<history::HistoryEntry, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    history::save_history(conn, input).map_err(|e| e.to_string())
}

#[tauri::command]
fn history_search(
    state: State<AppState>,
    profile_id: String,
    prefix: String,
    limit: Option<usize>,
) -> Result<Vec<history::CommandSuggestion>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    let limit = limit.unwrap_or(10);
    history::search_history(conn, &profile_id, &prefix, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn history_suggestions(
    state: State<AppState>,
    profile_id: String,
    prefix: String,
    limit: Option<usize>,
) -> Result<Vec<history::CommandSuggestion>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    let limit = limit.unwrap_or(10);
    history::search_suggestions(conn, &profile_id, &prefix, limit).map_err(|e| e.to_string())
}

#[tauri::command]
fn history_clear(state: State<AppState>, profile_id: String) -> Result<usize, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    history::clear_history(conn, &profile_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn history_clear_all(state: State<AppState>) -> Result<usize, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    history::clear_all_history(conn).map_err(|e| e.to_string())
}

#[tauri::command]
fn settings_get(state: State<AppState>, key: String) -> Result<Option<String>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    settings::get_setting(conn, &key).map_err(|e| e.to_string())
}

#[tauri::command]
fn settings_set(state: State<AppState>, key: String, value: String) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    settings::set_setting(conn, &key, &value).map_err(|e| e.to_string())
}

#[tauri::command]
fn settings_get_all(state: State<AppState>) -> Result<Vec<settings::Setting>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    settings::get_all_settings(conn).map_err(|e| e.to_string())
}

// ============================================================================
// AI Commands
// ============================================================================

#[tauri::command]
async fn ai_ask(
    prompt: String,
    context: Option<String>,
    server_url: Option<String>,
    model: Option<String>,
) -> Result<ai::AIResponse, String> {
    let mut config = ai::AIConfig::default();

    if let Some(url) = server_url {
        config.server_url = url;
    }
    if let Some(m) = model {
        config.model = m;
    }

    ai::ask_ollama(&config, &prompt, context.as_deref())
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn ai_extract_commands(response: String) -> Result<Vec<String>, String> {
    Ok(ai::extract_commands(&response))
}

// ============================================================================
// Macros Commands
// ============================================================================

#[tauri::command]
fn macros_get(
    state: State<AppState>,
    profile_id: Option<String>,
) -> Result<std::collections::HashMap<String, String>, String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    macros::get_macros(conn, profile_id).map_err(|e| e.to_string())
}

#[tauri::command]
fn macros_set(
    state: State<AppState>,
    profile_id: Option<String>,
    macro_key: String,
    command: String,
) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    macros::set_macro(conn, profile_id, macro_key, command).map_err(|e| e.to_string())
}

#[tauri::command]
fn macros_delete(state: State<AppState>, profile_id: Option<String>) -> Result<(), String> {
    let db_guard = state.db.lock().unwrap();
    let conn = db_guard.as_ref().ok_or("Database not initialized")?;
    macros::delete_macros(conn, profile_id).map_err(|e| e.to_string())
}
