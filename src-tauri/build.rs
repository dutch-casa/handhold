fn main() {
    // Expose target triple so tts.rs can resolve the sidecar binary path in dev mode.
    println!(
        "cargo:rustc-env=TARGET={}",
        std::env::var("TARGET").unwrap()
    );
    tauri_build::build()
}
