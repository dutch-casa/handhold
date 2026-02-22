use std::path::PathBuf;

pub const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "target",
    ".next",
    "__pycache__",
    ".cache",
    "coverage",
    ".turbo",
];

fn handhold_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".handhold")
}

pub fn courses_dir() -> PathBuf {
    handhold_dir().join("courses")
}

pub fn workspaces_dir() -> PathBuf {
    handhold_dir().join("workspaces")
}

pub fn db_path() -> PathBuf {
    handhold_dir().join("handhold.db")
}

pub fn settings_path() -> PathBuf {
    handhold_dir().join("settings.json")
}
