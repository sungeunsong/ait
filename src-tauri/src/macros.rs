use rusqlite::{params, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroCommand {
    pub key: String,      // "1" ~ "10" (Ctrl+0은 10번)
    pub command: String,  // 실행할 명령어
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroSet {
    pub profile_id: Option<String>, // None이면 global
    pub macros: HashMap<String, String>, // key -> command
}

/// Get macros for a specific profile (or global if profile_id is None)
pub fn get_macros(
    conn: &rusqlite::Connection,
    profile_id: Option<String>,
) -> Result<HashMap<String, String>> {
    let key = match profile_id {
        Some(id) => format!("macros_{}", id),
        None => "macros_global".to_string(),
    };

    let value: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = ?1",
            params![key],
            |row| row.get(0),
        )
        .unwrap_or_default();

    if value.is_empty() {
        return Ok(HashMap::new());
    }

    // Parse JSON
    let macros: HashMap<String, String> = serde_json::from_str(&value).unwrap_or_default();
    Ok(macros)
}

/// Set a single macro
pub fn set_macro(
    conn: &rusqlite::Connection,
    profile_id: Option<String>,
    macro_key: String,
    command: String,
) -> Result<()> {
    let settings_key = match profile_id.clone() {
        Some(id) => format!("macros_{}", id),
        None => "macros_global".to_string(),
    };

    // Get existing macros
    let mut macros = get_macros(conn, profile_id)?;

    // Update or insert
    if command.is_empty() {
        macros.remove(&macro_key);
    } else {
        macros.insert(macro_key, command);
    }

    // Save back to settings
    let json = serde_json::to_string(&macros).unwrap_or_default();
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?1, ?2)",
        params![settings_key, json],
    )?;

    Ok(())
}

/// Delete all macros for a profile
pub fn delete_macros(conn: &rusqlite::Connection, profile_id: Option<String>) -> Result<()> {
    let key = match profile_id {
        Some(id) => format!("macros_{}", id),
        None => "macros_global".to_string(),
    };

    conn.execute("DELETE FROM settings WHERE key = ?1", params![key])?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_get_set_macros() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute(
            "CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT)",
            [],
        )
        .unwrap();

        // Set global macro
        set_macro(&conn, None, "1".to_string(), "ls -la".to_string()).unwrap();
        set_macro(&conn, None, "2".to_string(), "docker ps".to_string()).unwrap();

        // Get global macros
        let macros = get_macros(&conn, None).unwrap();
        assert_eq!(macros.get("1"), Some(&"ls -la".to_string()));
        assert_eq!(macros.get("2"), Some(&"docker ps".to_string()));

        // Set profile-specific macro
        set_macro(
            &conn,
            Some("profile1".to_string()),
            "1".to_string(),
            "kubectl get pods".to_string(),
        )
        .unwrap();

        let profile_macros = get_macros(&conn, Some("profile1".to_string())).unwrap();
        assert_eq!(profile_macros.get("1"), Some(&"kubectl get pods".to_string()));

        // Delete macro
        set_macro(&conn, None, "1".to_string(), "".to_string()).unwrap();
        let macros = get_macros(&conn, None).unwrap();
        assert_eq!(macros.get("1"), None);
    }
}
