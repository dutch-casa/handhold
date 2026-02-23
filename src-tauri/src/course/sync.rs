use crate::db::Db;
use crate::paths::courses_dir;
use rusqlite::params;
use std::path::PathBuf;
use tauri::State;

use super::now_ms;
use super::source::hash_id;
use super::types::{Manifest, SyncResult};

#[tauri::command]
pub async fn courses_dir_path() -> Result<String, String> {
    let dir = courses_dir();
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("Failed to create courses directory: {e}"))?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn course_sync(db: State<'_, Db>) -> Result<SyncResult, String> {
    let dir = courses_dir();
    if !dir.exists() {
        return Ok(SyncResult {
            added: 0,
            removed: 0,
        });
    }

    let mut added: u32 = 0;
    let mut removed: u32 = 0;

    let entries =
        std::fs::read_dir(&dir).map_err(|e| format!("Failed to read courses directory: {e}"))?;

    for entry in entries.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        let manifest_path = path.join("handhold.yaml");
        if !manifest_path.exists() {
            continue;
        }

        let local_path = path.to_string_lossy().to_string();

        {
            let conn = db.0.lock();
            let exists: bool = conn
                .query_row(
                    "SELECT count(*) > 0 FROM course WHERE local_path = ?1",
                    params![&local_path],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;
            if exists {
                continue;
            }
        }

        let manifest_text = match std::fs::read_to_string(&manifest_path) {
            Ok(t) => t,
            Err(e) => {
                eprintln!("[sync] failed to read {}: {e}", manifest_path.display());
                continue;
            }
        };

        let manifest: Manifest = match serde_yml::from_str(&manifest_text) {
            Ok(m) => m,
            Err(e) => {
                eprintln!("[sync] invalid manifest {}: {e}", manifest_path.display());
                continue;
            }
        };

        if manifest.steps.is_empty() {
            continue;
        }

        let dirname = entry.file_name().to_string_lossy().to_string();
        let synthetic_url = format!("local://{dirname}");
        let id = hash_id(&synthetic_url);
        let now = now_ms();
        let step_count = manifest.steps.len() as i64;

        let conn = db.0.lock();

        let id_exists: bool = conn
            .query_row(
                "SELECT count(*) > 0 FROM course WHERE id = ?1",
                params![&id],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if id_exists {
            continue;
        }

        if let Err(e) = conn.execute(
            "INSERT INTO course (id, source_url, local_path, title, description, step_count, added_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&id, &synthetic_url, &local_path, &manifest.title, &manifest.description, step_count, now],
        ) {
            eprintln!("[sync] failed to insert {dirname}: {e}");
            continue;
        }

        for tag in &manifest.tags {
            let _ = conn.execute(
                "INSERT OR IGNORE INTO tag (course_id, name) VALUES (?1, ?2)",
                params![&id, tag],
            );
        }

        eprintln!("[sync] registered: {dirname} → {}", manifest.title);
        added += 1;
    }

    // Collect all course rows, then release the lock before checking
    // the filesystem. This avoids holding the DB lock during I/O.
    let all_courses: Vec<(String, String)> = {
        let conn = db.0.lock();
        let mut stmt = conn
            .prepare("SELECT id, local_path FROM course")
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let path: String = row.get(1)?;
                Ok((id, path))
            })
            .map_err(|e| e.to_string())?
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| e.to_string())?;
        rows
    };

    let orphan_ids: Vec<&str> = all_courses
        .iter()
        .filter(|(_, path)| !PathBuf::from(path).exists())
        .map(|(id, _)| id.as_str())
        .collect();

    if !orphan_ids.is_empty() {
        let conn = db.0.lock();
        for id in &orphan_ids {
            conn.execute("DELETE FROM course WHERE id = ?1", params![id])
                .map_err(|e| e.to_string())?;
            eprintln!("[sync] removed orphan: {id}");
            removed += 1;
        }
    }

    Ok(SyncResult { added, removed })
}
