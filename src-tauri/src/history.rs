use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use uuid::Uuid;

use crate::commands_dict;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryEntry {
    pub id: String,
    pub profile_id: String,
    pub cmd: String,
    pub ts: i64,
    pub exit_code: Option<i32>,
    pub duration_ms: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct SaveHistoryInput {
    pub profile_id: String,
    pub cmd: String,
    pub exit_code: Option<i32>,
    pub duration_ms: Option<i32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CommandSuggestion {
    pub cmd: String,
    pub frequency: i32,
    pub last_used: i64,
}

/// Search command history by prefix, ordered by frequency
/// This function only returns history results (no dictionary)
pub fn search_history(conn: &Connection, profile_id: &str, prefix: &str, limit: usize) -> Result<Vec<CommandSuggestion>> {
    let query = format!("{}%", prefix);

    let mut stmt = conn.prepare(
        "SELECT cmd, COUNT(*) as frequency, MAX(ts) as last_used
         FROM history
         WHERE profile_id = ?1 AND cmd LIKE ?2
         GROUP BY cmd
         ORDER BY frequency DESC, last_used DESC
         LIMIT ?3"
    )?;

    let suggestions = stmt.query_map(params![profile_id, query, limit as i32], |row| {
        Ok(CommandSuggestion {
            cmd: row.get(0)?,
            frequency: row.get(1)?,
            last_used: row.get(2)?,
        })
    })?
    .collect::<Result<Vec<_>>>()?;

    Ok(suggestions)
}

/// Search command suggestions combining history and dictionary
/// Returns history results first (by frequency), then dictionary suggestions
/// Removes duplicates and limits to the specified number
pub fn search_suggestions(conn: &Connection, profile_id: &str, prefix: &str, limit: usize) -> Result<Vec<CommandSuggestion>> {
    // Get history suggestions
    let history_results = search_history(conn, profile_id, prefix, limit)?;

    // If we have enough history results, return them
    if history_results.len() >= limit {
        return Ok(history_results);
    }

    // Get dictionary suggestions
    let dict_limit = limit - history_results.len();
    let dict_results = commands_dict::get_dict_suggestions(prefix, dict_limit * 2);

    // Track seen commands to avoid duplicates
    let mut seen = HashSet::new();
    let mut combined = Vec::new();

    // Add history results first (they have higher priority)
    for hist in history_results {
        seen.insert(hist.cmd.clone());
        combined.push(hist);
    }

    // Add dictionary suggestions (with default frequency and timestamp)
    let now = chrono::Utc::now().timestamp();
    for dict_cmd in dict_results {
        if !seen.contains(&dict_cmd) && combined.len() < limit {
            seen.insert(dict_cmd.clone());
            combined.push(CommandSuggestion {
                cmd: dict_cmd,
                frequency: 0, // Dictionary commands have 0 frequency
                last_used: now,
            });
        }
    }

    Ok(combined)
}

/// Save a command to history
pub fn save_history(conn: &Connection, input: SaveHistoryInput) -> Result<HistoryEntry> {
    let now = chrono::Utc::now().timestamp();
    let id = Uuid::new_v4().to_string();

    let entry = HistoryEntry {
        id: id.clone(),
        profile_id: input.profile_id,
        cmd: input.cmd,
        ts: now,
        exit_code: input.exit_code,
        duration_ms: input.duration_ms,
    };

    conn.execute(
        "INSERT INTO history (id, profile_id, cmd, ts, exit_code, duration_ms)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
        params![
            &entry.id,
            &entry.profile_id,
            &entry.cmd,
            entry.ts,
            entry.exit_code,
            entry.duration_ms,
        ],
    )?;

    Ok(entry)
}

/// Clear all history for a specific profile
pub fn clear_history(conn: &Connection, profile_id: &str) -> Result<usize> {
    let count = conn.execute(
        "DELETE FROM history WHERE profile_id = ?1",
        params![profile_id],
    )?;

    Ok(count)
}

/// Clear all history (all profiles)
pub fn clear_all_history(conn: &Connection) -> Result<usize> {
    let count = conn.execute("DELETE FROM history", [])?;
    Ok(count)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::init_db;

    #[test]
    fn test_save_history() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        let input = SaveHistoryInput {
            profile_id: "test-profile".to_string(),
            cmd: "ls -la".to_string(),
            exit_code: Some(0),
            duration_ms: Some(100),
        };

        let entry = save_history(&conn, input).unwrap();
        assert_eq!(entry.cmd, "ls -la");
        assert_eq!(entry.exit_code, Some(0));

        // Verify it was saved
        let mut stmt = conn
            .prepare("SELECT cmd FROM history WHERE id = ?1")
            .unwrap();
        let cmd: String = stmt.query_row([&entry.id], |row| row.get(0)).unwrap();
        assert_eq!(cmd, "ls -la");
    }

    #[test]
    fn test_search_history() {
        let conn = Connection::open_in_memory().unwrap();
        init_db(&conn).unwrap();

        // Create a test profile first
        let profile_id = "test-profile";
        conn.execute(
            "INSERT INTO profiles (id, name, host, port, user, auth_type, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)",
            rusqlite::params![
                profile_id,
                "Test Server",
                "localhost",
                22,
                "testuser",
                "password",
                chrono::Utc::now().timestamp(),
                chrono::Utc::now().timestamp(),
            ],
        ).unwrap();

        // Save multiple commands
        save_history(&conn, SaveHistoryInput {
            profile_id: profile_id.to_string(),
            cmd: "ls -la".to_string(),
            exit_code: Some(0),
            duration_ms: Some(100),
        }).unwrap();

        save_history(&conn, SaveHistoryInput {
            profile_id: profile_id.to_string(),
            cmd: "ls -lh".to_string(),
            exit_code: Some(0),
            duration_ms: Some(100),
        }).unwrap();

        // Save same command twice to test frequency ordering
        save_history(&conn, SaveHistoryInput {
            profile_id: profile_id.to_string(),
            cmd: "ls -la".to_string(),
            exit_code: Some(0),
            duration_ms: Some(100),
        }).unwrap();

        save_history(&conn, SaveHistoryInput {
            profile_id: profile_id.to_string(),
            cmd: "cd /home".to_string(),
            exit_code: Some(0),
            duration_ms: Some(100),
        }).unwrap();

        // Search for "ls" commands
        let results = search_history(&conn, profile_id, "ls", 10).unwrap();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].cmd, "ls -la"); // Most frequent
        assert_eq!(results[0].frequency, 2);
        assert_eq!(results[1].cmd, "ls -lh");
        assert_eq!(results[1].frequency, 1);

        // Search for "cd" commands
        let results = search_history(&conn, profile_id, "cd", 10).unwrap();
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].cmd, "cd /home");
    }
}
