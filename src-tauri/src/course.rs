use crate::db::Db;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseRecord {
    pub id: String,
    pub github_url: String,
    pub local_path: String,
    pub title: String,
    pub description: String,
    pub step_count: i64,
    pub added_at: i64,
    pub completed_steps: i64,
    pub tags: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum ImportResult {
    Ok { course: CourseRecord },
    InvalidUrl,
    NotFound,
    NoManifest,
    BadManifest { reason: String },
    AlreadyExists,
    CloneFailed { reason: String },
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum Route {
    Browser,
    #[serde(rename_all = "camelCase")]
    Course {
        course_id: String,
        step_index: i64,
    },
}

#[derive(Deserialize)]
struct Manifest {
    title: String,
    description: String,
    #[serde(default)]
    tags: Vec<String>,
    steps: Vec<ManifestStep>,
}

impl Manifest {
    fn into_public(self) -> CourseManifest {
        CourseManifest {
            title: self.title,
            description: self.description,
            tags: self.tags,
            steps: self.steps,
        }
    }
}

/// Validated during import to reject malformed courses at the boundary.
/// Re-read from disk when opening a course to resolve step file paths.
#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ManifestStep {
    pub kind: String,
    pub title: String,
    pub path: String,
}

/// Returned to the frontend when opening a course — step metadata without file contents.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseManifest {
    pub title: String,
    pub description: String,
    pub tags: Vec<String>,
    pub steps: Vec<ManifestStep>,
}

fn course_id(github_url: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(github_url.as_bytes());
    let hash = hasher.finalize();
    format!("{:x}", hash)[..16].to_string()
}

fn courses_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".handhold")
        .join("courses")
}

fn workspaces_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".handhold")
        .join("workspaces")
}

#[derive(Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct RawLabConfig {
    #[serde(default)]
    pub workspace: String,
    #[serde(default)]
    pub test: String,
    #[serde(default)]
    pub open: Vec<String>,
    #[serde(default)]
    pub services: Vec<serde_json::Value>,
    #[serde(default)]
    pub setup: Vec<String>,
    #[serde(default)]
    pub start: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LabData {
    pub instructions: String,
    pub has_scaffold: bool,
    pub scaffold_path: String,
    pub lab_dir_path: String,
    pub workspace_path: String,
    pub config: RawLabConfig,
}

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

/// Parse "https://github.com/owner/repo" into (owner, repo).
fn parse_github_url(url: &str) -> Option<(String, String)> {
    let url = url.trim().trim_end_matches('/').trim_end_matches(".git");
    let parts: Vec<&str> = url.split('/').collect();
    let len = parts.len();
    if len < 2 {
        return None;
    }
    let owner = parts.get(len - 2)?;
    let repo = parts.get(len - 1)?;
    if owner.is_empty() || repo.is_empty() {
        return None;
    }
    Some((owner.to_string(), repo.to_string()))
}

fn read_course_row(conn: &rusqlite::Connection, id: &str) -> Result<CourseRecord, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, github_url, local_path, title, description, step_count, added_at
             FROM course WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut course = stmt
        .query_row(params![id], |row| {
            Ok(CourseRecord {
                id: row.get(0)?,
                github_url: row.get(1)?,
                local_path: row.get(2)?,
                title: row.get(3)?,
                description: row.get(4)?,
                step_count: row.get(5)?,
                added_at: row.get(6)?,
                completed_steps: 0,
                tags: Vec::new(),
            })
        })
        .map_err(|e| e.to_string())?;

    course.completed_steps = conn
        .query_row(
            "SELECT count(*) FROM step_completion WHERE course_id = ?1",
            params![id],
            |row| row.get(0),
        )
        .unwrap_or(0);

    let mut tag_stmt = conn
        .prepare("SELECT name FROM tag WHERE course_id = ?1 ORDER BY name")
        .map_err(|e| e.to_string())?;
    course.tags = tag_stmt
        .query_map(params![id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(course)
}

#[tauri::command]
pub async fn course_import(db: State<'_, Db>, github_url: String) -> Result<ImportResult, String> {
    let (owner, repo) = match parse_github_url(&github_url) {
        Some(pair) => pair,
        None => return Ok(ImportResult::InvalidUrl),
    };

    let id = course_id(&github_url);

    {
        let conn = db.0.lock();
        let exists: bool = conn
            .query_row(
                "SELECT count(*) > 0 FROM course WHERE id = ?1",
                params![&id],
                |row| row.get(0),
            )
            .unwrap_or(false);
        if exists {
            return Ok(ImportResult::AlreadyExists);
        }
    }

    // Validate manifest via raw GitHub fetch — reject before wasting bandwidth on a full clone
    let raw_url = format!("https://raw.githubusercontent.com/{owner}/{repo}/HEAD/handhold.yaml");
    let manifest_text = match reqwest::get(&raw_url).await {
        Ok(resp) if resp.status().is_success() => match resp.text().await {
            Ok(text) => text,
            Err(e) => {
                return Ok(ImportResult::BadManifest {
                    reason: e.to_string(),
                })
            }
        },
        Ok(resp) if resp.status().as_u16() == 404 => return Ok(ImportResult::NoManifest),
        Ok(_) => return Ok(ImportResult::NotFound),
        Err(_) => return Ok(ImportResult::NotFound),
    };

    let manifest: Manifest = match serde_yml::from_str(&manifest_text) {
        Ok(m) => m,
        Err(e) => {
            return Ok(ImportResult::BadManifest {
                reason: e.to_string(),
            })
        }
    };

    if manifest.steps.is_empty() {
        return Ok(ImportResult::BadManifest {
            reason: "Manifest has no steps".to_string(),
        });
    }

    let dest = courses_dir().join(format!("{owner}--{repo}"));
    if dest.exists() {
        std::fs::remove_dir_all(&dest)
            .map_err(|e| format!("Failed to clean existing directory: {e}"))?;
    }
    std::fs::create_dir_all(&dest)
        .map_err(|e| format!("Failed to create course directory: {e}"))?;

    let clone_url = format!("https://github.com/{owner}/{repo}.git");
    let output = Command::new("git")
        .args([
            "clone",
            "--depth",
            "1",
            &clone_url,
            dest.to_str().unwrap_or(""),
        ])
        .output()
        .map_err(|e| format!("Failed to run git: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(ImportResult::CloneFailed {
            reason: stderr.to_string(),
        });
    }

    let local_path = dest.to_string_lossy().to_string();
    let now = now_ms();
    let step_count = manifest.steps.len() as i64;
    let title = manifest.title.clone();
    let description = manifest.description.clone();
    let tags = manifest.tags.clone();

    {
        let conn = db.0.lock();
        conn.execute(
            "INSERT INTO course (id, github_url, local_path, title, description, step_count, added_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&id, &github_url, &local_path, &title, &description, step_count, now],
        )
        .map_err(|e| format!("Failed to insert course: {e}"))?;

        for tag in &tags {
            conn.execute(
                "INSERT INTO tag (course_id, name) VALUES (?1, ?2)",
                params![&id, tag],
            )
            .map_err(|e| format!("Failed to insert tag: {e}"))?;
        }
    }

    let conn = db.0.lock();
    let course = read_course_row(&conn, &id)?;
    Ok(ImportResult::Ok { course })
}

#[tauri::command]
pub async fn course_list(db: State<'_, Db>) -> Result<Vec<CourseRecord>, String> {
    let conn = db.0.lock();
    let mut stmt = conn
        .prepare(
            "SELECT c.id, c.github_url, c.local_path, c.title, c.description,
                    c.step_count, c.added_at, count(sc.step_index) as completed
             FROM course c
             LEFT JOIN step_completion sc ON sc.course_id = c.id
             GROUP BY c.id
             ORDER BY c.added_at DESC",
        )
        .map_err(|e| e.to_string())?;

    let courses: Vec<CourseRecord> = stmt
        .query_map([], |row| {
            Ok(CourseRecord {
                id: row.get(0)?,
                github_url: row.get(1)?,
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
        .filter_map(|r| r.ok())
        .collect();

    // Single query for all tags — avoids N+1 when listing courses
    let mut tag_stmt = conn
        .prepare("SELECT course_id, name FROM tag ORDER BY name")
        .map_err(|e| e.to_string())?;
    let tag_rows: Vec<(String, String)> = tag_stmt
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    let mut result = courses;
    for course in &mut result {
        course.tags = tag_rows
            .iter()
            .filter(|(cid, _)| cid == &course.id)
            .map(|(_, name)| name.clone())
            .collect();
    }

    Ok(result)
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
        .filter_map(|r| r.ok())
        .collect();

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

    let tags: Vec<String> = stmt
        .query_map([], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

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
        .filter_map(|r| r.ok())
        .collect();

    let mut results = Vec::new();
    for id in &ids {
        results.push(read_course_row(&conn, id)?);
    }
    Ok(results)
}

#[tauri::command]
pub async fn course_delete(db: State<'_, Db>, id: String) -> Result<(), String> {
    let conn = db.0.lock();

    // Grab path before deletion cascades the row away
    let local_path: Option<String> = conn
        .query_row(
            "SELECT local_path FROM course WHERE id = ?1",
            params![&id],
            |row| row.get(0),
        )
        .ok();

    conn.execute("DELETE FROM course WHERE id = ?1", params![&id])
        .map_err(|e| format!("Failed to delete course: {e}"))?;

    // Best-effort filesystem cleanup — not critical if it fails
    if let Some(path) = local_path {
        let _ = std::fs::remove_dir_all(&path);
    }

    Ok(())
}

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

    let indices: Vec<i64> = stmt
        .query_map(params![&course_id], |row| row.get(0))
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(indices)
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlidePosition {
    pub slide_index: i64,
    pub slide_count: Option<i64>,
}

/// Save which slide the user is on within a lesson.
/// Also stores total slide count on first save so the browser card
/// can show per-slide progress without re-parsing the lesson.
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
            let course_id = match row.1 {
                Some(id) => id,
                None => return Ok(Route::Browser),
            };
            let step_index = row.2.unwrap_or(0);

            // Validate course still exists
            let exists: bool = conn
                .query_row(
                    "SELECT count(*) > 0 FROM course WHERE id = ?1",
                    params![&course_id],
                    |row| row.get(0),
                )
                .unwrap_or(false);

            if exists {
                Ok(Route::Course {
                    course_id,
                    step_index,
                })
            } else {
                Ok(Route::Browser)
            }
        }
        _ => Ok(Route::Browser),
    }
}

#[tauri::command]
pub async fn course_get(db: State<'_, Db>, id: String) -> Result<CourseRecord, String> {
    let conn = db.0.lock();
    read_course_row(&conn, &id)
}

/// Read the handhold.yaml from a course's local_path on disk.
/// The manifest was validated at import time — if it's missing or corrupt,
/// the course was tampered with externally.
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

/// Read a step's source content from disk, relative to the course's local_path.
/// If the path is a directory, concatenates all .md files in sorted order —
/// this supports multi-file lessons (e.g. steps/01.md, steps/02.md → one lesson).
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
    let lab_dir_path = lab_dir.to_string_lossy().to_string();

    let workspace_path = workspaces_dir().join(&id);
    std::fs::create_dir_all(&workspace_path)
        .map_err(|e| format!("Failed to create workspace directory: {e}"))?;
    let workspace_path = workspace_path.to_string_lossy().to_string();

    Ok(LabData {
        instructions,
        has_scaffold,
        scaffold_path,
        lab_dir_path,
        workspace_path,
        config,
    })
}

// --- Lab provision tracking ---

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
