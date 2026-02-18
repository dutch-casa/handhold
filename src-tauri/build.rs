fn main() {
    let target = std::env::var("TARGET").unwrap();
    let profile = std::env::var("PROFILE").unwrap_or_default();

    if profile == "release" {
        let exe_suffix = if target.contains("windows") { ".exe" } else { "" };
        let bin_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join(format!("koko-{target}{exe_suffix}"));

        let bin_ok = bin_path
            .metadata()
            .map(|m| m.is_file() && m.len() > 0)
            .unwrap_or(false);

        if !bin_ok {
            panic!(
                "Missing or empty koko sidecar for {target}. Expected: {}",
                bin_path.display()
            );
        }

        let models_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("resources")
            .join("models");
        let onnx_ok = models_dir.join("kokoro-v1.0.onnx").is_file();
        let voices_ok = models_dir.join("voices-v1.0.bin").is_file();

        if !(onnx_ok && voices_ok) {
            println!(
                "cargo:warning=Kokoro model files not found in {}. Release will rely on runtime download.",
                models_dir.display()
            );
        }
    }

    // Expose target triple so tts.rs can resolve the sidecar binary path in dev mode.
    println!(
        "cargo:rustc-env=TARGET={}",
        target
    );
    tauri_build::build()
}
