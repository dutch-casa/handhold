use super::types::Manifest;

pub(super) fn download_github_tarball(
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
    let bytes = resp
        .bytes()
        .map_err(|e| format!("Failed to read tarball: {e}"))?;

    let decoder = flate2::read::GzDecoder::new(std::io::Cursor::new(&bytes));
    let mut archive = tar::Archive::new(decoder);

    let prefix = if subpath.is_empty() {
        format!("{repo}-{branch}/")
    } else {
        format!("{repo}-{branch}/{subpath}/")
    };

    for entry in archive
        .entries()
        .map_err(|e| format!("Tar read error: {e}"))?
    {
        let mut entry = entry.map_err(|e| format!("Tar entry error: {e}"))?;
        let entry_path = entry
            .path()
            .map_err(|e| format!("Tar path error: {e}"))?
            .into_owned();
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
