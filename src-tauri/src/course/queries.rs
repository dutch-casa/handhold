use crate::db::Db;
use rusqlite::params;
use std::path::PathBuf;
use tauri::State;

use super::types::{CourseManifest, CourseRecord, LabData, Manifest, RawLabConfig};
use crate::paths::workspaces_dir;

pub(super) fn read_course_row(
    conn: &rusqlite::Connection,
    id: &str,
) -> Result<CourseRecord, String> {
    let completed_steps: i64 = conn
        .query_row(
            "SELECT count(*) FROM step_completion WHERE course_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .map_err(|e| e.to_string())?;

    let mut tag_stmt = conn
        .prepare("SELECT name FROM tag WHERE course_id = ?1 ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tags: Vec<String> = tag_stmt
        .query_map(params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    conn.query_row(
        "SELECT id, source_url, local_path, title, description, step_count, added_at
         FROM course WHERE id = ?1",
        params![id],
        |row| {
            Ok(CourseRecord {
                id: row.get(0)?,
                source_url: row.get(1)?,
                local_path: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                step_count: row.get(5)?,
                added_at: row.get(6)?,
                completed_steps,
                tags: tags.clone(),
            })
        },
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn course_list(db: State<'_, Db>) -> Result<Vec<CourseRecord>, String> {
    let conn = db.0.lock();
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.source_url, c.local_path, c.title, c.description,
                    c.step_count, c.added_at, count(sc.step_index) as completed
             FROM course c
             LEFT JOIN step_completion sc ON sc.course_id = c.id
             GROUP BY c.id
             ORDER BY c.added_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let mut courses: Vec<CourseRecord> = stmt
        .query_map([], |row| {
            Ok(CourseRecord {
                id: row.get(0)?,
                source_url: row.get(1)?,
                local_path: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                step_count: row.get(5)?,
                added_at: row.get(6)?,
                completed_steps: row.get(7)?,
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut tag_stmt = conn
        .prepare("SELECT course_id, name FROM tag ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tag_rows: Vec<(String, String)> = tag_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    for course in &mut courses {
        course.tags = tag_rows
            .iter()
            .filter(|(cid, _)| cid == &course.id)
            .map(|(_, name)| name.clone())
            .collect();
    }

    Ok(courses)
}

#[tauri::command]
pub async fn course_search(db: State<'_, Db>, query: String) -> Result<Vec<CourseRecord>, String> {
    let conn = db.0.lock();
    let mut stmt = conn
        .prepare(
            "SELECT c.id FROM course_search cs
             JOIN course c ON c.rowid = cs.rowid
             WHERE course_search MATCH ?1",
        )
        .map_err(|e| e.to_string())?;

    let ids: Vec<String> = stmt
        .query_map(params![&query], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for id in &ids {
        results.push(read_course_row(&conn, id)?);
    }
    Ok(results)
}

#[tauri::command]
pub async fn course_tags(db: State<'_, Db>) -> Result<Vec<String>, String> {
    let conn = db.0.lock();
    let mut stmt = conn
        .prepare("SELECT DISTINCT name FROM tag ORDER BY name")
        .map_err(|e| e.to_string())?;

    let tags = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(tags)
}

#[tauri::command]
pub async fn course_by_tag(db: State<'_, Db>, tag: String) -> Result<Vec<CourseRecord>, String> {
    let conn = db.0.lock();
    let mut stmt = conn
        .prepare(
            "SELECT c.id FROM tag t
             JOIN course c ON c.id = t.course_id
             WHERE t.name = ?1",
        )
        .map_err(|e| e.to_string())?;

    let ids: Vec<String> = stmt
        .query_map(params![&tag], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;

    let mut results = Vec::new();
    for id in &ids {
        results.push(read_course_row(&conn, id)?);
    }
    Ok(results)
}

#[tauri::command]
pub async fn course_delete(
    db: State<'_, Db>,
    id: String,
    delete_workspaces: bool,
) -> Result<(), String> {
    // Collect paths and delete from DB while holding the lock.
    // Release lock BEFORE filesystem I/O.
    let local_path = {
        let conn = db.0.lock();
        let path: Option<String> = conn
            .query_row(
                "SELECT local_path FROM course WHERE id = ?1",
                params![&id],
                |row| row.get(0),
            )
            .ok();
        conn.execute("DELETE FROM course WHERE id = ?1", params![&id])
            .map_err(|e| format!("Failed to delete course: {e}"))?;
        path
    };

    if let Some(path) = local_path {
        let _ = std::fs::remove_dir_all(&path);
    }

    if delete_workspaces {
        let ws = workspaces_dir().join(&id);
        if ws.exists() {
            let _ = std::fs::remove_dir_all(&ws);
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn course_get(db: State<'_, Db>, id: String) -> Result<CourseRecord, String> {
    let conn = db.0.lock();
    read_course_row(&conn, &id)
}

#[tauri::command]
pub async fn course_manifest(db: State<'_, Db>, id: String) -> Result<CourseManifest, String> {
    let local_path = {
        let conn = db.0.lock();
        conn.query_row(
            "SELECT local_path FROM course WHERE id = ?1",
            params![&id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| format!("Course not found: {e}"))?
    };

    let manifest_path = std::path::Path::new(&local_path).join("handhold.yaml");
    let content = std::fs::read_to_string(&manifest_path)
        .map_err(|e| format!("Failed to read manifest: {e}"))?;
    let manifest: Manifest =
        serde_yml::from_str(&content).map_err(|e| format!("Failed to parse manifest: {e}"))?;

    Ok(manifest.into_public())
}

#[tauri::command]
pub async fn course_read_step(
    db: State<'_, Db>,
    id: String,
    step_path: String,
) -> Result<String, String> {
    let local_path = {
        let conn = db.0.lock();
        conn.query_row(
            "SELECT local_path FROM course WHERE id = ?1",
            params![&id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| format!("Course not found: {e}"))?
    };

    let resolved = std::path::Path::new(&local_path).join(&step_path);

    if resolved.is_dir() {
        let mut entries: Vec<_> = std::fs::read_dir(&resolved)
            .map_err(|e| format!("Failed to read directory {step_path}: {e}"))?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().is_some_and(|ext| ext == "md"))
            .collect();
        entries.sort_by_key(|e| e.file_name());

        let mut content = String::new();
        for entry in &entries {
            let part = std::fs::read_to_string(entry.path())
                .map_err(|e| format!("Failed to read {}: {e}", entry.path().display()))?;
            if !content.is_empty() {
                content.push_str("\n\n");
            }
            content.push_str(&part);
        }
        Ok(content)
    } else {
        std::fs::read_to_string(&resolved)
            .map_err(|e| format!("Failed to read step file {step_path}: {e}"))
    }
}

#[tauri::command]
pub async fn course_read_lab(
    db: State<'_, Db>,
    id: String,
    step_path: String,
) -> Result<LabData, String> {
    let local_path = {
        let conn = db.0.lock();
        conn.query_row(
            "SELECT local_path FROM course WHERE id = ?1",
            params![&id],
            |row| row.get::<_, String>(0),
        )
        .map_err(|e| format!("Course not found: {e}"))?
    };

    let lab_dir = PathBuf::from(&local_path).join(&step_path);
    if !lab_dir.is_dir() {
        return Err(format!("Lab directory not found: {step_path}"));
    }

    let instructions_path = lab_dir.join("INSTRUCTIONS.md");
    let instructions = std::fs::read_to_string(&instructions_path)
        .map_err(|e| format!("Missing INSTRUCTIONS.md in {step_path}: {e}"))?;

    let config_path = lab_dir.join("lab.yaml");
    let config: RawLabConfig = if config_path.exists() {
        let raw = std::fs::read_to_string(&config_path)
            .map_err(|e| format!("Failed to read lab.yaml: {e}"))?;
        serde_yml::from_str(&raw).map_err(|e| format!("Failed to parse lab.yaml: {e}"))?
    } else {
        RawLabConfig::default()
    };

    let scaffold_dir = lab_dir.join("scaffold");
    let has_scaffold = scaffold_dir.is_dir();
    let scaffold_path = scaffold_dir.to_string_lossy().to_string();

    let solution_dir = lab_dir.join("solution");
    let has_solution = solution_dir.is_dir();
    let solution_path = solution_dir.to_string_lossy().to_string();

    let lab_dir_path = lab_dir.to_string_lossy().to_string();

    // Each lab gets its own workspace subdirectory so scaffolds don't collide.
    let lab_slug = PathBuf::from(&step_path)
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| step_path.replace('/', "_"));
    let workspace_path = workspaces_dir().join(&id).join(&lab_slug);
    std::fs::create_dir_all(&workspace_path)
        .map_err(|e| format!("Failed to create workspace directory: {e}"))?;
    let workspace_path = workspace_path.to_string_lossy().to_string();

    Ok(LabData {
        instructions,
        has_scaffold,
        scaffold_path,
        has_solution,
        solution_path,
        lab_dir_path,
        workspace_path,
        config,
    })
}
