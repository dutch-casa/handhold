mod download;
mod import;
mod progress;
mod queries;
mod source;
mod sync;
pub mod types;

use std::time::{SystemTime, UNIX_EPOCH};

fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as i64
}

// Glob re-exports forward both the public command functions and
// the hidden __cmd__ items that tauri::generate_handler! needs.
pub use import::*;
pub use progress::*;
pub use queries::*;
pub use sync::*;
