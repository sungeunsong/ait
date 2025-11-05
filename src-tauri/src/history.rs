use rusqlite::{params, Connection, Result};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

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
}
