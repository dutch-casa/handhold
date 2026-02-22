use std::path::{Path, PathBuf};

pub(super) fn resolve_koko_binary() -> Result<PathBuf, String> {
    let target_triple = env!("TARGET");
    let exe_suffix = if cfg!(windows) { ".exe" } else { "" };

    let mut searched: Vec<PathBuf> = Vec::new();

    let dev_candidate = Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("binaries")
        .join(format!("koko-{target_triple}{exe_suffix}"));
    searched.push(dev_candidate.clone());
    if dev_candidate.exists() {
        return Ok(dev_candidate);
    }

    if let Ok(exe) = std::env::current_exe() {
        let dir = exe.parent().unwrap_or(Path::new("."));
        for name in [
            format!("koko-{target_triple}{exe_suffix}"),
            format!("koko{exe_suffix}"),
        ] {
            let candidate = dir.join(&name);
            searched.push(candidate.clone());
            if candidate.exists() {
                return Ok(candidate);
            }
        }
    }

    let searched_list = searched
        .iter()
        .map(|p| p.to_string_lossy())
        .collect::<Vec<_>>()
        .join(", ");

    Err(format!(
        "koko binary not found (target: {target_triple}). Searched: {searched_list}. \
        Run scripts/download-sidecars.sh for this target before building."
    ))
}

fn models_dir_has_required_files(dir: &Path) -> bool {
    dir.join("kokoro-v1.0.onnx").is_file() && dir.join("voices-v1.0.bin").is_file()
}

pub(super) fn resolve_models_dir() -> Result<PathBuf, String> {
    let dev_models = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/models");
    if models_dir_has_required_files(&dev_models) {
        return Ok(dev_models);
    }

    let dev_legacy = Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/piper");
    if models_dir_has_required_files(&dev_legacy) {
        return Ok(dev_legacy);
    }

    if let Ok(exe) = std::env::current_exe() {
        let exe_dir = exe.parent().unwrap_or(Path::new("."));

        let macos_candidate = exe_dir
            .parent()
            .unwrap_or(exe_dir)
            .join("Resources/resources/models");
        if models_dir_has_required_files(&macos_candidate) {
            return Ok(macos_candidate);
        }

        let flat_candidate = exe_dir.join("resources/models");
        if models_dir_has_required_files(&flat_candidate) {
            return Ok(flat_candidate);
        }
    }

    let app_dir = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("handhold/models");
    std::fs::create_dir_all(&app_dir).map_err(|e| format!("Failed to create models dir: {e}"))?;
    Ok(app_dir)
}

pub(super) fn cache_dir() -> PathBuf {
    dirs::cache_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("handhold/tts")
}

pub(super) fn resolve_espeak_data_dir() -> Option<PathBuf> {
    let dev_candidate =
        Path::new(env!("CARGO_MANIFEST_DIR")).join("resources/piper/espeak-ng-data");
    if dev_candidate.is_dir() {
        return Some(dev_candidate);
    }

    if let Ok(exe) = std::env::current_exe() {
        let exe_dir = exe.parent().unwrap_or(Path::new("."));

        let macos_candidate = exe_dir
            .parent()
            .unwrap_or(exe_dir)
            .join("Resources/resources/piper/espeak-ng-data");
        if macos_candidate.is_dir() {
            return Some(macos_candidate);
        }

        let flat_candidate = exe_dir.join("resources/piper/espeak-ng-data");
        if flat_candidate.is_dir() {
            return Some(flat_candidate);
        }
    }

    None
}
