use serde::Serialize;
use std::fs;
use std::path::Path;
use std::ffi::OsStr;

#[derive(Serialize)]
#[serde(tag = "kind", rename_all = "camelCase")]
pub enum FsEntry {
    #[serde(rename_all = "camelCase")]
    File {
        path: String,
        name: String,
        ext: String,
    },
    #[serde(rename_all = "camelCase")]
    Dir { path: String, name: String },
}

#[tauri::command]
pub async fn read_file(path: String) -> Result<String, String> {
    fs::read_to_string(&path).map_err(|e| format!("Failed to read {path}: {e}"))
}

#[tauri::command]
pub async fn write_file(path: String, content: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent dirs for {path}: {e}"))?;
    }
    fs::write(&path, content).map_err(|e| format!("Failed to write {path}: {e}"))
}

#[tauri::command]
pub async fn create_file(path: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent dirs for {path}: {e}"))?;
    }
    fs::write(&path, "").map_err(|e| format!("Failed to create {path}: {e}"))
}

#[tauri::command]
pub async fn create_dir(path: String) -> Result<(), String> {
    fs::create_dir_all(&path).map_err(|e| format!("Failed to create dir {path}: {e}"))
}

#[tauri::command]
pub async fn delete_path(path: String) -> Result<(), String> {
    let meta = fs::metadata(&path).map_err(|e| format!("Failed to stat {path}: {e}"))?;
    if meta.is_dir() {
        fs::remove_dir_all(&path).map_err(|e| format!("Failed to remove dir {path}: {e}"))
    } else {
        fs::remove_file(&path).map_err(|e| format!("Failed to remove file {path}: {e}"))
    }
}

#[tauri::command]
pub async fn rename_path(from: String, to: String) -> Result<(), String> {
    fs::rename(&from, &to).map_err(|e| format!("Failed to rename {from} → {to}: {e}"))
}

#[tauri::command]
pub async fn move_path(from: String, to: String) -> Result<(), String> {
    if let Some(parent) = Path::new(&to).parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent dirs for {to}: {e}"))?;
    }
    fs::rename(&from, &to).map_err(|e| format!("Failed to move {from} → {to}: {e}"))
}

#[tauri::command]
pub async fn path_exists(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
pub async fn wipe_dir(path: String) -> Result<(), String> {
    let dir = Path::new(&path);
    if dir.exists() {
        fs::remove_dir_all(dir).map_err(|e| format!("wipe failed: {e}"))?;
    }
    fs::create_dir_all(dir).map_err(|e| format!("recreate failed: {e}"))?;
    Ok(())
}

#[tauri::command]
pub async fn copy_scaffold(source_dir: String, target_dir: String) -> Result<(), String> {
    let src = Path::new(&source_dir);
    let dst = Path::new(&target_dir);

    if !src.exists() {
        return Err(format!("Scaffold directory does not exist: {source_dir}"));
    }

    fs::create_dir_all(dst)
        .map_err(|e| format!("Failed to create target dir {target_dir}: {e}"))?;

    copy_dir_recursive(src, dst)
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read dir {}: {e}", src.display()))? {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());

        if src_path.is_dir() {
            fs::create_dir_all(&dst_path)
                .map_err(|e| format!("Failed to create dir {}: {e}", dst_path.display()))?;
            copy_dir_recursive(&src_path, &dst_path)?;
        } else {
            fs::copy(&src_path, &dst_path).map_err(|e| {
                format!(
                    "Failed to copy {} → {}: {e}",
                    src_path.display(),
                    dst_path.display()
                )
            })?;
        }
    }
    Ok(())
}

#[tauri::command]
pub async fn read_dir_recursive(path: String) -> Result<Vec<FsEntry>, String> {
    let root = Path::new(&path);
    if !root.exists() {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    collect_entries(root, &mut entries)?;
    Ok(entries)
}

const IGNORED_DIRS: &[&str] = &[
    "node_modules", "dist", "build", "target", ".next",
    "__pycache__", ".cache", "coverage", ".turbo",
];

fn collect_entries(dir: &Path, entries: &mut Vec<FsEntry>) -> Result<(), String> {
    let read_dir =
        fs::read_dir(dir).map_err(|e| format!("Failed to read dir {}: {e}", dir.display()))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let path = entry.path();
        let name = entry
            .file_name()
            .to_string_lossy()
            .to_string();

        // Skip hidden files and directories
        if name.starts_with('.') {
            continue;
        }

        let path_str = path.to_string_lossy().to_string();

        if path.is_dir() {
            if IGNORED_DIRS.contains(&name.as_str()) {
                continue;
            }
            entries.push(FsEntry::Dir {
                path: path_str,
                name,
            });
            collect_entries(&path, entries)?;
        } else {
            let ext = path
                .extension()
                .map(|e| e.to_string_lossy().to_string())
                .unwrap_or_default();
            entries.push(FsEntry::File {
                path: path_str,
                name,
                ext,
            });
        }
    }

    Ok(())
}

// --- Bulk TS project file reading for Monaco IntelliSense ---

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileContent {
    pub path: String,
    pub content: String,
}

const TS_EXTENSIONS: &[&str] = &["ts", "tsx", "js", "jsx", "mjs", "cjs"];
const MAX_TS_FILES: usize = 2000;
const MAX_TS_BYTES: usize = 30 * 1024 * 1024; // 30 MB

#[tauri::command]
pub async fn read_ts_project_files(root: String) -> Result<Vec<FileContent>, String> {
    let root_path = Path::new(&root);
    if !root_path.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    let mut total_bytes: usize = 0;
    collect_ts_files(root_path, &mut files, &mut total_bytes)?;
    Ok(files)
}

fn collect_ts_files(
    dir: &Path,
    files: &mut Vec<FileContent>,
    total_bytes: &mut usize,
) -> Result<(), String> {
    if files.len() >= MAX_TS_FILES || *total_bytes >= MAX_TS_BYTES {
        return Ok(());
    }

    let read_dir =
        fs::read_dir(dir).map_err(|e| format!("Failed to read dir {}: {e}", dir.display()))?;

    for entry in read_dir {
        let entry = entry.map_err(|e| format!("Failed to read entry: {e}"))?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();

        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            if IGNORED_DIRS.contains(&name.as_str()) || name == "node_modules" {
                continue;
            }
            collect_ts_files(&path, files, total_bytes)?;
            continue;
        }

        if name.ends_with(".d.ts") {
            continue;
        }

        let ext = path.extension().and_then(OsStr::to_str).unwrap_or("");
        if !TS_EXTENSIONS.contains(&ext) {
            continue;
        }

        if files.len() >= MAX_TS_FILES || *total_bytes >= MAX_TS_BYTES {
            break;
        }

        let content = match fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => continue,
        };

        *total_bytes += content.len();
        files.push(FileContent {
            path: path.to_string_lossy().to_string(),
            content,
        });
    }

    Ok(())
}

const MAX_TYPE_BYTES: usize = 10 * 1024 * 1024; // 10 MB

#[tauri::command]
pub async fn read_type_definitions(root: String) -> Result<Vec<FileContent>, String> {
    let root_path = Path::new(&root);
    let node_modules = root_path.join("node_modules");
    if !node_modules.exists() {
        return Ok(Vec::new());
    }

    let mut files = Vec::new();
    let mut total_bytes: usize = 0;

    // @types packages
    let at_types = node_modules.join("@types");
    if at_types.exists() {
        if let Ok(entries) = fs::read_dir(&at_types) {
            for entry in entries.flatten() {
                if total_bytes >= MAX_TYPE_BYTES {
                    break;
                }
                let index_dts = entry.path().join("index.d.ts");
                if index_dts.exists() {
                    if let Ok(content) = fs::read_to_string(&index_dts) {
                        total_bytes += content.len();
                        files.push(FileContent {
                            path: index_dts.to_string_lossy().to_string(),
                            content,
                        });
                    }
                }
            }
        }
    }

    // Regular packages: package.json → types/typings field
    if let Ok(entries) = fs::read_dir(&node_modules) {
        for entry in entries.flatten() {
            if total_bytes >= MAX_TYPE_BYTES {
                break;
            }
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with('.') || name == "@types" {
                continue;
            }

            let pkg_json_path = entry.path().join("package.json");
            let pkg_content = match fs::read_to_string(&pkg_json_path) {
                Ok(c) => c,
                Err(_) => continue,
            };

            let pkg: serde_json::Value = match serde_json::from_str(&pkg_content) {
                Ok(v) => v,
                Err(_) => continue,
            };

            let types_field = pkg
                .get("types")
                .or_else(|| pkg.get("typings"))
                .and_then(|v| v.as_str());

            if let Some(types_rel) = types_field {
                let types_path = entry.path().join(types_rel);
                if types_path.exists() {
                    if let Ok(content) = fs::read_to_string(&types_path) {
                        total_bytes += content.len();
                        files.push(FileContent {
                            path: types_path.to_string_lossy().to_string(),
                            content,
                        });
                    }
                }
            }
        }
    }

    Ok(files)
}
