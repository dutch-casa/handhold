use serde::{Deserialize, Serialize};

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
    #[serde(rename_all = "camelCase")]
    Editor {
        course_id: String,
    },
}

#[derive(Deserialize)]
pub(super) struct Manifest {
    pub title: String,
    pub description: String,
    #[serde(default)]
    pub tags: Vec<String>,
    pub steps: Vec<ManifestStep>,
}

impl Manifest {
    pub fn into_public(self) -> CourseManifest {
        CourseManifest {
            title: self.title,
            description: self.description,
            tags: self.tags,
            steps: self.steps,
        }
    }
}

#[derive(Clone, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StepKind {
    Lesson,
    Lab,
}

#[derive(Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ManifestStep {
    pub kind: StepKind,
    pub title: String,
    pub path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CourseManifest {
    pub title: String,
    pub description: String,
    pub tags: Vec<String>,
    pub steps: Vec<ManifestStep>,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SlidePosition {
    pub slide_index: i64,
    pub slide_count: Option<i64>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncResult {
    pub added: u32,
    pub removed: u32,
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
