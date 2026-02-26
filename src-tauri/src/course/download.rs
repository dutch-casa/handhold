use std::io::Read;
use std::path::Path;

use flate2::read::GzDecoder;
use tar::Archive;

use super::types::Manifest;

/// Download a course from a GitHub repo via tarball, extracting only the subpath.
pub(super) fn download_github_course(
    owner: &str,
    repo: &str,
    branch: &str,
    subpath: &str,
    dest: &Path,
) -> Result<(), String> {
    let tarball_url =
        format!("https://github.com/{owner}/{repo}/archive/refs/heads/{branch}.tar.gz");

    let resp = reqwest::blocking::get(&tarball_url)
        .and_then(reqwest::blocking::Response::error_for_status)
        .map_err(|e| format!("Failed to download tarball: {e}"))?;

    let decoder = GzDecoder::new(resp);
    let mut archive = Archive::new(decoder);

    // GitHub tarballs have a top-level prefix dir like `{repo}-{branch}/`.
    // We strip that prefix and match entries under `{prefix}/{subpath}/`.
    let prefix_with_subpath = if subpath.is_empty() {
        String::new()
    } else {
        format!("/{subpath}/")
    };

    for entry in archive
        .entries()
        .map_err(|e| format!("Failed to read tarball: {e}"))?
    {
        let mut entry = entry.map_err(|e| format!("Tarball entry error: {e}"))?;
        let raw_path = entry
            .path()
            .map_err(|e| format!("Invalid path in tarball: {e}"))?
            .to_path_buf();

        let raw_str = raw_path.to_string_lossy();

        // Strip the top-level prefix directory (everything before the first `/`).
        let after_prefix = match raw_str.find('/') {
            Some(i) => &raw_str[i..],
            None => continue,
        };

        // Match entries under the subpath (or all entries if subpath is empty).
        let relative = if subpath.is_empty() {
            // Strip leading `/`
            &after_prefix[1..]
        } else if let Some(rest) = after_prefix.strip_prefix(&prefix_with_subpath) {
            rest
        } else {
            continue;
        };

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
                    .map_err(|e| format!("Failed to create dir for {}: {e}", out_path.display()))?;
            }
            let mut buf = Vec::new();
            entry
                .read_to_end(&mut buf)
                .map_err(|e| format!("Failed to read {}: {e}", relative))?;
            std::fs::write(&out_path, &buf)
                .map_err(|e| format!("Failed to write {}: {e}", out_path.display()))?;
        }
    }

    Ok(())
}

pub(super) fn download_http_course(
    base_url: &str,
    manifest_text: &str,
    manifest: &Manifest,
    dest: &Path,
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
