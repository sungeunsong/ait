use rusqlite::{Connection, Result};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const CURRENT_DB_VERSION: i32 = 2; // Updated for keyring migration

/// Get the path to the SQLite database file
pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data directory");

    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data directory");

    app_data_dir.join("ait.db")
}

/// Get current database version
fn get_db_version(conn: &Connection) -> Result<i32> {
    // Create db_version table if it doesn't exist
    conn.execute(
        "CREATE TABLE IF NOT EXISTS db_version (
            version INTEGER PRIMARY KEY
        )",
        [],
    )?;

    // Get current version
    let version: Result<i32> = conn.query_row(
        "SELECT version FROM db_version LIMIT 1",
        [],
        |row| row.get(0),
    );

    match version {
        Ok(v) => Ok(v),
        Err(_) => {
            // No version found, this is a new database or version 1
            // Check if profiles table exists to determine
            let table_exists: Result<bool> = conn.query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='profiles'",
                [],
                |row| {
                    let count: i32 = row.get(0)?;
                    Ok(count > 0)
                },
            );

            if table_exists.unwrap_or(false) {
                // Existing database, assume version 1
                conn.execute("INSERT INTO db_version (version) VALUES (1)", [])?;
                Ok(1)
            } else {
                // New database, start at current version
                conn.execute(
                    "INSERT INTO db_version (version) VALUES (?1)",
                    [CURRENT_DB_VERSION],
                )?;
                Ok(CURRENT_DB_VERSION)
            }
        }
    }
}

/// Update database version
fn set_db_version(conn: &Connection, version: i32) -> Result<()> {
    conn.execute("UPDATE db_version SET version = ?1", [version])?;
    Ok(())
}

/// Initialize the database and create tables if they don't exist
pub fn init_db(conn: &Connection) -> Result<()> {
    // Create profiles table (version 2: with password column for fallback)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            host TEXT NOT NULL,
            port INTEGER NOT NULL,
            user TEXT NOT NULL,
            auth_type TEXT NOT NULL,
            password TEXT,
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

    // Create macros table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS macros (
            id TEXT PRIMARY KEY,
            profile_id TEXT,
            macro_key TEXT NOT NULL,
            command TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            UNIQUE(profile_id, macro_key)
        )",
        [],
    )?;

    Ok(())
}

/// Migrate from version 1 to version 2 (move passwords to keychain if available)
fn migrate_v1_to_v2(conn: &Connection) -> Result<()> {
    println!("[Migration] Starting v1 → v2 migration (hybrid keyring/database approach)");

    // Check if password column exists
    let has_password_column: bool = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('profiles') WHERE name='password'",
        [],
        |row| {
            let count: i32 = row.get(0)?;
            Ok(count > 0)
        },
    )?;

    if !has_password_column {
        println!("[Migration] No password column found, adding it for fallback support");
        conn.execute("ALTER TABLE profiles ADD COLUMN password TEXT", [])?;
        println!("[Migration] Password column added successfully");
        return Ok(());
    }

    // Get all profiles with passwords
    let mut stmt = conn.prepare("SELECT id, password FROM profiles WHERE password IS NOT NULL")?;
    let profiles: Vec<(String, String)> = stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))?
        .collect::<Result<Vec<_>, _>>()?;

    println!("[Migration] Found {} profiles with passwords", profiles.len());

    // Try to move passwords to keychain (only if keyring is available)
    let mut migrated = 0;
    let mut kept_in_db = 0;

    for (profile_id, password) in profiles {
        match crate::profile::store_password(&profile_id, &password) {
            Ok(_) => {
                // Successfully stored in keychain, clear from database
                match conn.execute("UPDATE profiles SET password = NULL WHERE id = ?1", [&profile_id]) {
                    Ok(_) => {
                        println!("[Migration] ✓ Migrated password to keychain for profile {}", profile_id);
                        migrated += 1;
                    }
                    Err(e) => {
                        eprintln!("[Migration] ✗ Failed to clear password from DB for profile {}: {}", profile_id, e);
                    }
                }
            }
            Err(_) => {
                // Keyring unavailable, keep password in database
                println!("[Migration] ℹ Keeping password in database for profile {} (keyring unavailable)", profile_id);
                kept_in_db += 1;
            }
        }
    }

    println!("[Migration] Migrated to keychain: {}, Kept in database: {}", migrated, kept_in_db);
    println!("[Migration] v1 → v2 migration completed successfully");
    Ok(())
}

/// Run all necessary migrations
pub fn run_migrations(conn: &Connection) -> Result<()> {
    let current_version = get_db_version(conn)?;
    println!("[Migration] Current DB version: {}", current_version);

    if current_version >= CURRENT_DB_VERSION {
        println!("[Migration] Database is up to date");
        return Ok(());
    }

    // Run migrations sequentially
    if current_version < 2 {
        migrate_v1_to_v2(conn)?;
        set_db_version(conn, 2)?;
    }

    println!("[Migration] All migrations completed. DB version: {}", CURRENT_DB_VERSION);
    Ok(())
}

/// Open a connection to the database
pub fn open_connection(app: &AppHandle) -> Result<Connection> {
    let db_path = get_db_path(app);
    println!("[DB] Opening database at: {:?}", db_path);

    let conn = Connection::open(db_path)?;

    // Initialize tables
    init_db(&conn)?;

    // Run migrations
    run_migrations(&conn)?;

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
