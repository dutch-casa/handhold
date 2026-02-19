use notify::{Config, Event, RecommendedWatcher, RecursiveMode, Watcher};
use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::ipc::Channel;

// File system watcher — streams change events to the frontend via Channel.
// Each watcher gets a numeric ID for cleanup.

type WatcherMap = HashMap<u32, RecommendedWatcher>;

static WATCHERS: OnceLock<Mutex<WatcherMap>> = OnceLock::new();
static NEXT_ID: OnceLock<Mutex<u32>> = OnceLock::new();

fn watchers() -> &'static Mutex<WatcherMap> {
    WATCHERS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn next_id() -> u32 {
    let counter = NEXT_ID.get_or_init(|| Mutex::new(0));
    let mut id = counter.lock();
    *id += 1;
    *id
}

#[derive(Clone, Serialize)]
#[serde(tag = "event", rename_all = "camelCase")]
pub enum WatchEvent {
    Changed,
}

#[tauri::command]
pub async fn watch_dir(path: String, on_event: Channel<WatchEvent>) -> Result<u32, String> {
    let watch_path = PathBuf::from(&path);
    if !watch_path.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    let watched = path.clone();
    let watcher = notify::recommended_watcher(move |res: Result<Event, notify::Error>| {
        match &res {
            Ok(ev) => eprintln!("[watcher] {watched}: {ev:?}"),
            Err(e) => eprintln!("[watcher] {watched}: error: {e}"),
        }
        if res.is_ok() {
            let _ = on_event.send(WatchEvent::Changed);
        }
    })
    .map_err(|e| format!("Failed to create watcher: {e}"))?;

    let id = next_id();
    let mut map = watchers().lock();

    let w = map.entry(id).or_insert(watcher);
    w.watch(&watch_path, RecursiveMode::Recursive)
        .map_err(|e| format!("Failed to watch {path}: {e}"))?;
    w.configure(Config::default())
        .map_err(|e| format!("Failed to configure watcher: {e}"))?;

    eprintln!("[watcher] watching id={id}: {path}");
    Ok(id)
}

#[tauri::command]
pub async fn unwatch_dir(watcher_id: u32) -> Result<(), String> {
    let mut map = watchers().lock();
    map.remove(&watcher_id);
    Ok(())
}
