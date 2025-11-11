use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;
use keyring::Entry;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub auth_type: String, // "password" or "key"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub password: Option<String>, // Fallback storage when keyring unavailable
    pub profile_group: Option<String>,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateProfileInput {
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub auth_type: String,
    pub password: Option<String>,
    pub profile_group: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateProfileInput {
    pub id: String,
    pub name: Option<String>,
    pub host: Option<String>,
    pub port: Option<u16>,
    pub user: Option<String>,
    pub auth_type: Option<String>,
    pub profile_group: Option<String>,
}

/// Check if keyring should be used based on environment
fn is_keyring_available() -> bool {
    // Check environment variable first
    if let Ok(env) = std::env::var("AIT_ENV") {
        if env.to_lowercase() == "dev" || env.to_lowercase() == "development" {
            println!("[Keyring] AIT_ENV={} detected - using database fallback", env);
            return false;
        }
    }

    // In production, try to use keyring
    match Entry::new("ait", "__test__") {
        Ok(entry) => {
            // Try to set/get a test password
            match entry.set_password("test") {
                Ok(_) => {
                    // Verify we can actually retrieve it
                    match entry.get_password() {
                        Ok(retrieved) if retrieved == "test" => {
                            let _ = entry.delete_credential();
                            true
                        }
                        _ => {
                            let _ = entry.delete_credential();
                            false
                        }
                    }
                }
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

lazy_static::lazy_static! {
    static ref KEYRING_AVAILABLE: bool = {
        let available = is_keyring_available();
        if available {
            println!("[Keyring] OS Keychain available - using secure storage");
        } else {
            println!("[Keyring] OS Keychain NOT available - using database fallback");
        }
        available
    };
}

/// Get keyring entry for a profile
fn get_keyring_entry(profile_id: &str) -> Result<Entry, String> {
    Entry::new("ait", profile_id).map_err(|e| format!("Failed to access keyring: {}", e))
}

/// Store password (keyring or database fallback)
pub fn store_password(profile_id: &str, password: &str) -> Result<(), String> {
    if *KEYRING_AVAILABLE {
        // Use OS keychain
        println!("[Keyring] Storing password in OS keychain for profile: {}", profile_id);
        let entry = get_keyring_entry(profile_id)?;
        match entry.set_password(password) {
            Ok(_) => {
                println!("[Keyring] ✓ Password stored in keychain");
                Ok(())
            }
            Err(e) => {
                eprintln!("[Keyring] ✗ Failed to store in keychain: {}", e);
                Err(format!("Failed to store password: {}", e))
            }
        }
    } else {
        // Fallback: Return Ok (password will be stored in database by caller)
        println!("[Keyring] Using database fallback for profile: {}", profile_id);
        Ok(())
    }
}

/// Retrieve password (keyring or database fallback)
pub fn get_password(profile_id: &str) -> Result<Option<String>, String> {
    if *KEYRING_AVAILABLE {
        // Use OS keychain
        println!("[Keyring] Retrieving password from OS keychain for profile: {}", profile_id);
        let entry = get_keyring_entry(profile_id)?;
        match entry.get_password() {
            Ok(password) => {
                println!("[Keyring] ✓ Password retrieved from keychain");
                Ok(Some(password))
            }
            Err(keyring::Error::NoEntry) => {
                println!("[Keyring] ⚠ No password in keychain");
                Ok(None)
            }
            Err(e) => {
                eprintln!("[Keyring] ✗ Failed to retrieve from keychain: {}", e);
                Err(format!("Failed to retrieve password: {}", e))
            }
        }
    } else {
        // Fallback: Return None (password should be in database)
        println!("[Keyring] Using database fallback for profile: {}", profile_id);
        Ok(None)
    }
}

/// Delete password from OS keychain
pub fn delete_password(profile_id: &str) -> Result<(), String> {
    let entry = get_keyring_entry(profile_id)?;
    match entry.delete_credential() {
        Ok(_) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()), // Already deleted
        Err(e) => Err(format!("Failed to delete password: {}", e)),
    }
}

/// Create a new profile
pub fn create_profile(conn: &Connection, input: CreateProfileInput) -> Result<Profile> {
    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();

    let db_password = if let Some(ref password) = input.password {
        if *KEYRING_AVAILABLE {
            // Store in keychain, don't store in DB
            store_password(&id, password)
                .map_err(|e| rusqlite::Error::ToSqlConversionFailure(Box::new(std::io::Error::new(std::io::ErrorKind::Other, e))))?;
            None
        } else {
            // Store in database (fallback)
            Some(password.clone())
        }
    } else {
        None
    };

    let profile = Profile {
        id: id.clone(),
        name: input.name,
        host: input.host,
        port: input.port,
        user: input.user,
        auth_type: input.auth_type,
        password: db_password.clone(),
        profile_group: input.profile_group,
        created_at: now,
        updated_at: now,
    };

    conn.execute(
        "INSERT INTO profiles (id, name, host, port, user, auth_type, password, profile_group, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
        params![
            &profile.id,
            &profile.name,
            &profile.host,
            profile.port,
            &profile.user,
            &profile.auth_type,
            &db_password,
            &profile.profile_group,
            profile.created_at,
            profile.updated_at,
        ],
    )?;

    Ok(profile)
}

/// Get all profiles
pub fn list_profiles(conn: &Connection) -> Result<Vec<Profile>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, host, port, user, auth_type, password, profile_group, created_at, updated_at
         FROM profiles
         ORDER BY profile_group, name",
    )?;

    let profiles = stmt
        .query_map([], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                port: row.get(3)?,
                user: row.get(4)?,
                auth_type: row.get(5)?,
                password: row.get(6)?,
                profile_group: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(profiles)
}

/// Get a profile by ID
pub fn get_profile(conn: &Connection, id: &str) -> Result<Option<Profile>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, host, port, user, auth_type, password, profile_group, created_at, updated_at
         FROM profiles
         WHERE id = ?1",
    )?;

    let profile = stmt
        .query_row([id], |row| {
            Ok(Profile {
                id: row.get(0)?,
                name: row.get(1)?,
                host: row.get(2)?,
                port: row.get(3)?,
                user: row.get(4)?,
                auth_type: row.get(5)?,
                password: row.get(6)?,
                profile_group: row.get(7)?,
                created_at: row.get(8)?,
                updated_at: row.get(9)?,
            })
        })
        .optional()?;

    Ok(profile)
}

/// Update a profile
pub fn update_profile(conn: &Connection, input: UpdateProfileInput) -> Result<Profile> {
    let now = chrono::Utc::now().timestamp();

    // First, get the existing profile
    let existing = get_profile(conn, &input.id)?
        .ok_or_else(|| rusqlite::Error::QueryReturnedNoRows)?;

    let updated = Profile {
        id: existing.id.clone(),
        name: input.name.unwrap_or(existing.name),
        host: input.host.unwrap_or(existing.host),
        port: input.port.unwrap_or(existing.port),
        user: input.user.unwrap_or(existing.user),
        auth_type: input.auth_type.unwrap_or(existing.auth_type),
        password: existing.password, // Keep existing password
        profile_group: input.profile_group.or(existing.profile_group),
        created_at: existing.created_at,
        updated_at: now,
    };

    conn.execute(
        "UPDATE profiles
         SET name = ?1, host = ?2, port = ?3, user = ?4, auth_type = ?5, profile_group = ?6, updated_at = ?7
         WHERE id = ?8",
        params![
            &updated.name,
            &updated.host,
            updated.port,
            &updated.user,
            &updated.auth_type,
            &updated.profile_group,
            updated.updated_at,
            &updated.id,
        ],
    )?;

    Ok(updated)
}

/// Delete a profile
pub fn delete_profile(conn: &Connection, id: &str) -> Result<()> {
    // Delete password from keychain first
    let _ = delete_password(id); // Ignore errors if password doesn't exist

    conn.execute("DELETE FROM profiles WHERE id = ?1", [id])?;
    Ok(())
}
