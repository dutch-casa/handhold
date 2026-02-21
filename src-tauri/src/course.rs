use crate::db::Db;
use rusqlite::{params, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseRecord {
    pub id: String,
    pub source_url: String,
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
    DownloadFailed { reason: String },
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

enum CourseSource {
    GitHub { owner: String, repo: String, branch: String, path: String },
    Http { manifest_url: String, base_url: String },
}

fn hash_id(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let hash = hasher.finalize();
    format!("{:x}", hash)[..16].to_string()
}

fn source_id(source: &CourseSource) -> String {
    match source {
        CourseSource::GitHub { owner, repo, path, .. } => {
            if path.is_empty() {
                hash_id(&format!("https://github.com/{owner}/{repo}"))
            } else {
                hash_id(&format!("https://github.com/{owner}/{repo}/{path}"))
            }
        }
        CourseSource::Http { manifest_url, .. } => hash_id(manifest_url),
    }
}

fn manifest_url(source: &CourseSource) -> String {
    match source {
        CourseSource::GitHub { owner, repo, branch, path } => {
            if path.is_empty() {
                format!("https://raw.githubusercontent.com/{owner}/{repo}/{branch}/handhold.yaml")
            } else {
                format!("https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}/handhold.yaml")
            }
        }
        CourseSource::Http { manifest_url, .. } => manifest_url.clone(),
    }
}

fn canonical_source_url(source: &CourseSource) -> String {
    match source {
        CourseSource::GitHub { owner, repo, path, .. } => {
            if path.is_empty() {
                format!("https://github.com/{owner}/{repo}")
            } else {
                format!("https://github.com/{owner}/{repo}/{path}")
            }
        }
        CourseSource::Http { manifest_url, .. } => manifest_url.clone(),
    }
}

fn parse_source_url(url: &str) -> Option<CourseSource> {
    let url = url.trim().trim_end_matches('/');
    let parsed = reqwest::Url::parse(url).ok()?;
    let host = parsed.host_str()?;
    let segments: Vec<&str> = parsed.path_segments()?.filter(|s| !s.is_empty()).collect();

    if host == "raw.githubusercontent.com" {
        // raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}/handhold.yaml
        if segments.len() < 3 { return None; }
        let owner = segments[0].to_string();
        let repo = segments[1].to_string();
        let branch = segments[2].to_string();
        let remaining: Vec<&str> = segments[3..].to_vec();
        let path = if remaining.last().is_some_and(|s| *s == "handhold.yaml") {
            remaining[..remaining.len() - 1].join("/")
        } else {
            remaining.join("/")
        };
        return Some(CourseSource::GitHub { owner, repo, branch, path });
    }

    if host == "github.com" {
        if segments.len() < 2 { return None; }
        let owner = segments[0].trim_end_matches(".git").to_string();
        let repo = segments[1].trim_end_matches(".git").to_string();
        if owner.is_empty() || repo.is_empty() { return None; }

        // github.com/{o}/{r} (root)
        if segments.len() == 2 {
            return Some(CourseSource::GitHub { owner, repo, branch: "HEAD".to_string(), path: String::new() });
        }

        // github.com/{o}/{r}/blob/{branch}/{path...}[/handhold.yaml]
        // github.com/{o}/{r}/tree/{branch}/{path...}
        if segments.len() >= 4 && (segments[2] == "blob" || segments[2] == "tree") {
            let branch = segments[3].to_string();
            let remaining: Vec<&str> = segments[4..].to_vec();
            let path = if remaining.last().is_some_and(|s| *s == "handhold.yaml") {
                remaining[..remaining.len() - 1].join("/")
            } else {
                remaining.join("/")
            };
            return Some(CourseSource::GitHub { owner, repo, branch, path });
        }

        // Fall through: unknown github.com path shape → root
        return Some(CourseSource::GitHub { owner, repo, branch: "HEAD".to_string(), path: String::new() });
    }

    // Any other URL ending in /handhold.yaml → Http source
    if url.ends_with("/handhold.yaml") {
        let base_url = url.trim_end_matches("handhold.yaml").to_string();
        return Some(CourseSource::Http { manifest_url: url.to_string(), base_url });
    }

    None
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
    pub has_solution: bool,
    pub solution_path: String,
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

fn download_github_tarball(
    owner: &str,
    repo: &str,
    branch: &str,
    subpath: &str,
    dest: &std::path::Path,
) -> Result<(), String> {
    let url = format!("https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.tar.gz");
    let resp = reqwest::blocking::get(&url)
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|e| format!("Failed to download tarball: {e}"))?;
    let bytes = resp.bytes()
        .map_err(|e| format!("Failed to read tarball: {e}"))?;

    let decoder = flate2::read::GzDecoder::new(std::io::Cursor::new(&bytes));
    let mut archive = tar::Archive::new(decoder);

    // Tarball root is "{repo}-{branch}/"
    let prefix = if subpath.is_empty() {
        format!("{repo}-{branch}/")
    } else {
        format!("{repo}-{branch}/{subpath}/")
    };

    for entry in archive.entries().map_err(|e| format!("Tar read error: {e}"))? {
        let mut entry = entry.map_err(|e| format!("Tar entry error: {e}"))?;
        let entry_path = entry.path().map_err(|e| format!("Tar path error: {e}"))?.into_owned();
        let entry_str = entry_path.to_string_lossy();

        if !entry_str.starts_with(&prefix) {
            continue;
        }

        let relative = &entry_str[prefix.len()..];
        if relative.is_empty() {
            continue;
        }

        let out_path = dest.join(relative);
        if entry.header().entry_type().is_dir() {
            std::fs::create_dir_all(&out_path)
                .map_err(|e| format!("Failed to create dir {}: {e}", out_path.display()))?;
        } else {
            if let Some(parent) = out_path.parent() {
                std::fs::create_dir_all(parent)
                    .map_err(|e| format!("Failed to create parent dir: {e}"))?;
            }
            let mut outfile = std::fs::File::create(&out_path)
                .map_err(|e| format!("Failed to create file {}: {e}", out_path.display()))?;
            std::io::copy(&mut entry, &mut outfile)
                .map_err(|e| format!("Failed to write file {}: {e}", out_path.display()))?;
        }
    }

    Ok(())
}

fn download_http_course(
    base_url: &str,
    manifest_text: &str,
    manifest: &Manifest,
    dest: &std::path::Path,
) -> Result<(), String> {
    std::fs::write(dest.join("handhold.yaml"), manifest_text)
        .map_err(|e| format!("Failed to write manifest: {e}"))?;

    for step in &manifest.steps {
        let file_url = format!("{}{}", base_url, step.path);
        let resp = reqwest::blocking::get(&file_url)
            .and_then(reqwest::blocking::Response::error_for_status)
            .map_err(|e| format!("Failed to download {}: {e}", step.path))?;
        let bytes = resp.bytes()
            .map_err(|e| format!("Failed to read {}: {e}", step.path))?;

        let out_path = dest.join(&step.path);
        if let Some(parent) = out_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create dir for {}: {e}", step.path))?;
        }
        std::fs::write(&out_path, &bytes)
            .map_err(|e| format!("Failed to write {}: {e}", step.path))?;
    }

    Ok(())
}

fn read_course_row(conn: &rusqlite::Connection, id: &str) -> Result<CourseRecord, String> {
    let mut stmt = conn
        .prepare(
            "SELECT id, source_url, local_path, title, description, step_count, added_at
             FROM course WHERE id = ?1",
        )
        .map_err(|e| e.to_string())?;

    let mut course = stmt
        .query_row(params![id], |row| {
            Ok(CourseRecord {
                id: row.get(0)?,
                source_url: row.get(1)?,
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
pub async fn course_import(db: State<'_, Db>, source_url: String) -> Result<ImportResult, String> {
    let source = match parse_source_url(&source_url) {
        Some(s) => s,
        None => return Ok(ImportResult::InvalidUrl),
    };

    let id = source_id(&source);

    {
        let conn = db.0.lock();
        let exists: bool = conn
            .query_row(
                "SELECT count(*) > 0 FROM course WHERE id = ?1 OR source_url = ?2",
                params![&id, &canonical_source_url(&source)],
                |row| row.get(0),
            )
            .unwrap_or(false);
        if exists {
            return Ok(ImportResult::AlreadyExists);
        }
    }

    let raw_url = manifest_url(&source);
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

    let dest = courses_dir().join(&id);
    if dest.exists() {
        std::fs::remove_dir_all(&dest)
            .map_err(|e| format!("Failed to clean existing directory: {e}"))?;
    }
    std::fs::create_dir_all(&dest)
        .map_err(|e| format!("Failed to create course directory: {e}"))?;

    match &source {
        CourseSource::GitHub { owner, repo, branch, path } => {
            if let Err(e) = download_github_tarball(owner, repo, branch, path, &dest) {
                let _ = std::fs::remove_dir_all(&dest);
                return Ok(ImportResult::DownloadFailed { reason: e });
            }
        }
        CourseSource::Http { base_url, .. } => {
            if let Err(e) = download_http_course(base_url, &manifest_text, &manifest, &dest) {
                let _ = std::fs::remove_dir_all(&dest);
                return Ok(ImportResult::DownloadFailed { reason: e });
            }
        }
    }

    let url_for_db = canonical_source_url(&source);
    let local_path = dest.to_string_lossy().to_string();
    let now = now_ms();
    let step_count = manifest.steps.len() as i64;
    let title = manifest.title.clone();
    let description = manifest.description.clone();
    let tags = manifest.tags.clone();

    {
        let conn = db.0.lock();
        conn.execute(
            "INSERT INTO course (id, source_url, local_path, title, description, step_count, added_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
            params![&id, &url_for_db, &local_path, &title, &description, step_count, now],
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
            "SELECT c.id, c.source_url, c.local_path, c.title, c.description,
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
pub async fn course_delete(db: State<'_, Db>, id: String, delete_workspaces: bool) -> Result<(), String> {
    let conn = db.0.lock();

    let local_path: Option<String> = conn
        .query_row(
            "SELECT local_path FROM course WHERE id = ?1",
            params![&id],
            |row| row.get(0),
        )
        .ok();

    conn.execute("DELETE FROM course WHERE id = ?1", params![&id])
        .map_err(|e| format!("Failed to delete course: {e}"))?;

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
        .collect::<Result<Vec<String>, _>>()
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

    let solution_dir = lab_dir.join("solution");
    let has_solution = solution_dir.is_dir();
    let solution_path = solution_dir.to_string_lossy().to_string();

    let lab_dir_path = lab_dir.to_string_lossy().to_string();

    let workspace_path = workspaces_dir().join(&id);
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

// --- Course directory sync ---

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub added: u32,
    pub removed: u32,
}

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

    // Scan for new courses on disk that aren't in the DB
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

        // Skip if already registered (by local_path)
        {
            let conn = db.0.lock();
            let exists: bool = conn
                .query_row(
                    "SELECT count(*) > 0 FROM course WHERE local_path = ?1",
                    params![&local_path],
                    |row| row.get(0),
                )
                .unwrap_or(false);
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

        // Skip if ID collision (unlikely but guard against it)
        let id_exists: bool = conn
            .query_row(
                "SELECT count(*) > 0 FROM course WHERE id = ?1",
                params![&id],
                |row| row.get(0),
            )
            .unwrap_or(false);
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

    // Remove DB records whose directories no longer exist
    {
        let conn = db.0.lock();
        let mut stmt = conn
            .prepare("SELECT id, local_path FROM course")
            .map_err(|e| e.to_string())?;
        let orphans: Vec<String> = stmt
            .query_map([], |row| {
                let id: String = row.get(0)?;
                let path: String = row.get(1)?;
                Ok((id, path))
            })
            .map_err(|e| e.to_string())?
            .filter_map(|r| r.ok())
            .filter(|(_, path)| !PathBuf::from(path).exists())
            .map(|(id, _)| id)
            .collect();

        for id in &orphans {
            let _ = conn.execute("DELETE FROM course WHERE id = ?1", params![id]);
            eprintln!("[sync] removed orphan: {id}");
            removed += 1;
        }
    }

    Ok(SyncResult { added, removed })
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
