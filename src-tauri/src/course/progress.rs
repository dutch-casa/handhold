use crate::db::Db;
use rusqlite::{params, OptionalExtension};
use tauri::State;

use super::now_ms;
use super::types::{Route, SlidePosition};

#[tauri::command]
pub async fn step_complete(
    db: State<'_, Db>,
    course_id: String,
    step_index: i64,
) -> Result<(), String> {
    let conn = db.0.lock();
    conn.execute(
        "INSERT OR IGNORE INTO step_completion (course_id, step_index, completed_at)
         VALUES (?1, ?2, ?3)",
        params![&course_id, step_index, now_ms()],
    )
    .map_err(|e| format!("Failed to mark step complete: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn step_progress(db: State<'_, Db>, course_id: String) -> Result<Vec<i64>, String> {
    let conn = db.0.lock();
    let mut stmt = conn
        .prepare(
            "SELECT step_index FROM step_completion
             WHERE course_id = ?1 ORDER BY step_index",
        )
        .map_err(|e| e.to_string())?;

    let indices = stmt
        .query_map(params![&course_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())?;
    Ok(indices)
}

#[tauri::command]
pub async fn slide_position_save(
    db: State<'_, Db>,
    course_id: String,
    step_index: i64,
    slide_index: i64,
    slide_count: Option<i64>,
) -> Result<(), String> {
    let conn = db.0.lock();
    conn.execute(
        "INSERT INTO step_position (course_id, step_index, slide_index, slide_count)
         VALUES (?1, ?2, ?3, ?4)
         ON CONFLICT (course_id, step_index) DO UPDATE SET
           slide_index = excluded.slide_index,
           slide_count = COALESCE(excluded.slide_count, step_position.slide_count)",
        params![&course_id, step_index, slide_index, slide_count],
    )
    .map_err(|e| format!("Failed to save slide position: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn slide_position_load(
    db: State<'_, Db>,
    course_id: String,
    step_index: i64,
) -> Result<Option<SlidePosition>, String> {
    let conn = db.0.lock();
    conn.query_row(
        "SELECT slide_index, slide_count FROM step_position WHERE course_id = ?1 AND step_index = ?2",
        params![&course_id, step_index],
        |row| {
            Ok(SlidePosition {
                slide_index: row.get(0)?,
                slide_count: row.get(1)?,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn slide_complete(
    db: State<'_, Db>,
    course_id: String,
    step_index: i64,
    slide_id: String,
) -> Result<(), String> {
    let conn = db.0.lock();
    conn.execute(
        "INSERT OR IGNORE INTO slide_completion (course_id, step_index, slide_id)
         VALUES (?1, ?2, ?3)",
        params![&course_id, step_index, &slide_id],
    )
    .map_err(|e| format!("Failed to save slide completion: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn slide_completions(
    db: State<'_, Db>,
    course_id: String,
    step_index: i64,
) -> Result<Vec<String>, String> {
    let conn = db.0.lock();
    let mut stmt = conn
        .prepare("SELECT slide_id FROM slide_completion WHERE course_id = ?1 AND step_index = ?2")
        .map_err(|e| format!("Failed to query slide completions: {e}"))?;
    let ids = stmt
        .query_map(params![&course_id, step_index], |row| row.get(0))
        .map_err(|e| format!("Failed to read slide completions: {e}"))?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|e| format!("Failed to collect slide completions: {e}"))?;
    Ok(ids)
}

#[tauri::command]
pub async fn route_save(db: State<'_, Db>, route: Route) -> Result<(), String> {
    let conn = db.0.lock();
    match &route {
        Route::Browser => {
            conn.execute(
                "UPDATE app_route SET kind = 'browser', course_id = NULL, step_index = NULL WHERE id = 1",
                [],
            )
            .map_err(|e| e.to_string())?;
        }
        Route::Course {
            course_id,
            step_index,
        } => {
            conn.execute(
                "UPDATE app_route SET kind = 'course', course_id = ?1, step_index = ?2 WHERE id = 1",
                params![course_id, step_index],
            )
            .map_err(|e| e.to_string())?;
        }
        Route::Editor { course_id } => {
            conn.execute(
                "UPDATE app_route SET kind = 'editor', course_id = ?1, step_index = NULL WHERE id = 1",
                params![course_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn route_load(db: State<'_, Db>) -> Result<Route, String> {
    let conn = db.0.lock();
    let row = conn
        .query_row(
            "SELECT kind, course_id, step_index FROM app_route WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, Option<String>>(1)?,
                    row.get::<_, Option<i64>>(2)?,
                ))
            },
        )
        .map_err(|e| e.to_string())?;

    match row.0.as_str() {
        "course" => {
            let Some(course_id) = row.1 else {
                return Ok(Route::Browser);
            };
            let step_index = row.2.unwrap_or(0);

            let exists: bool = conn
                .query_row(
                    "SELECT count(*) > 0 FROM course WHERE id = ?1",
                    params![&course_id],
                    |row| row.get(0),
                )
                .map_err(|e| e.to_string())?;

            if exists {
                Ok(Route::Course {
                    course_id,
                    step_index,
                })
            } else {
                Ok(Route::Browser)
            }
        }
        "editor" => {
            let Some(course_id) = row.1 else {
                return Ok(Route::Browser);
            };
            Ok(Route::Editor { course_id })
        }
        _ => Ok(Route::Browser),
    }
}

#[tauri::command]
pub async fn lab_is_provisioned(db: State<'_, Db>, workspace_path: String) -> Result<bool, String> {
    let conn = db.0.lock();
    conn.query_row(
        "SELECT count(*) > 0 FROM lab_provision WHERE workspace_path = ?1",
        params![&workspace_path],
        |row| row.get(0),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn lab_mark_provisioned(db: State<'_, Db>, workspace_path: String) -> Result<(), String> {
    let conn = db.0.lock();
    conn.execute(
        "INSERT INTO lab_provision (workspace_path, provisioned_at) VALUES (?1, ?2)
         ON CONFLICT (workspace_path) DO UPDATE SET provisioned_at = excluded.provisioned_at",
        params![&workspace_path, now_ms()],
    )
    .map_err(|e| format!("Failed to mark provisioned: {e}"))?;
    Ok(())
}
