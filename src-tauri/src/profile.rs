use rusqlite::{params, Connection, OptionalExtension, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Profile {
    pub id: String,
    pub name: String,
    pub host: String,
    pub port: u16,
    pub user: String,
    pub auth_type: String, // "password" or "key"
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

/// Create a new profile
pub fn create_profile(conn: &Connection, input: CreateProfileInput) -> Result<Profile> {
    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();

    let profile = Profile {
        id: id.clone(),
        name: input.name,
        host: input.host,
        port: input.port,
        user: input.user,
        auth_type: input.auth_type,
        profile_group: input.profile_group,
        created_at: now,
        updated_at: now,
    };

    conn.execute(
        "INSERT INTO profiles (id, name, host, port, user, auth_type, profile_group, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
        params![
            &profile.id,
            &profile.name,
            &profile.host,
            profile.port,
            &profile.user,
            &profile.auth_type,
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
        "SELECT id, name, host, port, user, auth_type, profile_group, created_at, updated_at
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
                profile_group: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;

    Ok(profiles)
}

/// Get a profile by ID
pub fn get_profile(conn: &Connection, id: &str) -> Result<Option<Profile>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, host, port, user, auth_type, profile_group, created_at, updated_at
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
                profile_group: row.get(6)?,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
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
    conn.execute("DELETE FROM profiles WHERE id = ?1", [id])?;
    Ok(())
}
