use crate::db::Db;
use crate::paths::courses_dir;
use rusqlite::params;
use tauri::State;

use super::download::{download_github_course, download_http_course};
use super::now_ms;
use super::queries::read_course_row;
use super::source::{
    canonical_source_url, manifest_url, parse_source_url, source_id, CourseSource,
};
use super::types::{ImportResult, Manifest};

#[tauri::command]
pub async fn course_import(db: State<'_, Db>, source_url: String) -> Result<ImportResult, String> {
    let Some(source) = parse_source_url(&source_url) else {
        return Ok(ImportResult::InvalidUrl);
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
            .map_err(|e| e.to_string())?;
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
        CourseSource::GitHub {
            owner,
            repo,
            branch,
            path,
        } => {
            if let Err(e) = download_github_course(owner, repo, branch, path, &dest) {
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
