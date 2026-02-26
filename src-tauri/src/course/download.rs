use std::process::Command;

use super::types::Manifest;

/// Clone a GitHub repo (shallow, with LFS) and copy the course subpath to dest.
/// LFS files (pre-baked audio cache) are fetched automatically if git-lfs is installed.
pub(super) fn download_github_course(
    owner: &str,
    repo: &str,
    branch: &str,
    subpath: &str,
    dest: &std::path::Path,
) -> Result<(), String> {
    let url = format!("https://github.com/{owner}/{repo}.git");
    let tmp = std::env::temp_dir().join(format!("handhold-clone-{owner}-{repo}-{}", std::process::id()));

    if tmp.exists() {
        let _ = std::fs::remove_dir_all(&tmp);
    }

    let mut cmd = Command::new("git");
    cmd.args(["clone", "--depth", "1"]);
    if branch != "HEAD" {
        cmd.args(["--branch", branch]);
    }
    cmd.arg(&url)
        .arg(&tmp)
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped());

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to run git clone (is git installed?): {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let _ = std::fs::remove_dir_all(&tmp);
        return Err(format!("git clone failed: {stderr}"));
    }

    // Copy the course subpath (or repo root) into dest, excluding .git.
    let source = if subpath.is_empty() { tmp.clone() } else { tmp.join(subpath) };
    if !source.exists() {
        let _ = std::fs::remove_dir_all(&tmp);
        return Err(format!("Subpath '{subpath}' not found in repository"));
    }

    copy_dir_recursive(&source, dest)?;

    let _ = std::fs::remove_dir_all(&tmp);
    Ok(())
}

/// Recursively copy `src` into `dest`, skipping `.git` directories.
fn copy_dir_recursive(src: &std::path::Path, dest: &std::path::Path) -> Result<(), String> {
    let entries = std::fs::read_dir(src)
        .map_err(|e| format!("Failed to read {}: {e}", src.display()))?;

    for entry in entries {
        let entry = entry.map_err(|e| format!("Directory entry error: {e}"))?;
        let name = entry.file_name();
        if name == ".git" {
            continue;
        }

        let src_path = entry.path();
        let dest_path = dest.join(&name);
        let ft = entry.file_type().map_err(|e| format!("File type error: {e}"))?;

        if ft.is_dir() {
            std::fs::create_dir_all(&dest_path)
                .map_err(|e| format!("Failed to create {}: {e}", dest_path.display()))?;
            copy_dir_recursive(&src_path, &dest_path)?;
        } else {
            std::fs::copy(&src_path, &dest_path)
                .map_err(|e| format!("Failed to copy {}: {e}", src_path.display()))?;
        }
    }

    Ok(())
}

pub(super) fn download_http_course(
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
        let bytes = resp
            .bytes()
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
