use rusqlite::{Connection, Result};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

/// Get the path to the SQLite database file
pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

    app_data_dir.join("ait.db")
}

/// Initialize the database and create tables if they don't exist
pub fn init_db(conn: &Connection) -> Result<()> {
    // Create profiles table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            user TEXT NOT NULL,
            auth_type TEXT NOT NULL,
            profile_group TEXT,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )?;

    // Create history table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS history (
            id TEXT PRIMARY KEY,
            profile_id TEXT NOT NULL,
            cmd TEXT NOT NULL,
            ts INTEGER NOT NULL,
            exit_code INTEGER,
            duration_ms INTEGER,
            FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
        )",
        [],
    )?;

    // Create settings table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        )",
        [],
    )?;

    // Create index on history for better query performance
    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_profile_id ON history(profile_id)",
        [],
    )?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_history_ts ON history(ts)",
        [],
    )?;

    Ok(())
}

/// Open a connection to the database
pub fn open_connection(app: &AppHandle) -> Result<Connection> {
    let db_path = get_db_path(app);
    let conn = Connection::open(db_path)?;
    init_db(&conn)?;
    Ok(conn)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_init_db() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        // Check that tables were created
        let mut stmt = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table'")
            .unwrap();
        let tables: Vec<String> = stmt
            .query_map([], |row| row.get(0))
            .unwrap()
            .collect::<Result<Vec<_>, _>>()
            .unwrap();

        assert!(tables.contains(&"profiles".to_string()));
        assert!(tables.contains(&"history".to_string()));
        assert!(tables.contains(&"settings".to_string()));
    }
}
