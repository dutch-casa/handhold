use parking_lot::Mutex;
use portable_pty::{native_pty_system, CommandBuilder, MasterPty, PtySize};
use serde::Serialize;
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::Arc;
use tauri::ipc::Channel;

/// Events streamed from PTY to frontend
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum PtyEvent {
    Data { data: String },
    Exit { code: i32 },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PtySession {
    pub session_id: String,
    pub pid: u32,
}

struct SessionEntry {
    master: Box<dyn MasterPty + Send>,
    writer: Box<dyn Write + Send>,
}

type SessionMap = Arc<Mutex<HashMap<String, SessionEntry>>>;

fn sessions() -> &'static SessionMap {
    use std::sync::OnceLock;
    static SESSIONS: OnceLock<SessionMap> = OnceLock::new();
    SESSIONS.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

/// Spawn a new PTY session. Returns session info, streams output via Channel.
#[tauri::command]
pub async fn pty_spawn(
    cwd: String,
    shell: String,
    args: Vec<String>,
    rows: u16,
    cols: u16,
    env: Vec<(String, String)>,
    on_data: Channel<PtyEvent>,
) -> Result<PtySession, String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {e}"))?;

    // Determine shell binary
    let shell_bin = if shell.is_empty() {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    } else {
        shell
    };

    let mut cmd = CommandBuilder::new(&shell_bin);
    cmd.cwd(&cwd);

    for arg in &args {
        cmd.arg(arg);
    }

    for (key, value) in &env {
        cmd.env(key, value);
    }

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {e}"))?;

    let pid = child.process_id().unwrap_or(0);
    let session_id = uuid::Uuid::new_v4().to_string();

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to take PTY writer: {e}"))?;

    // Store session
    {
        let mut map = sessions().lock();
        map.insert(
            session_id.clone(),
            SessionEntry {
                master: pair.master,
                writer,
            },
        );
    }

    // Spawn reader thread — streams PTY output to frontend via Channel
    let sid = session_id.clone();
    std::thread::spawn(move || {
        let mut reader = {
            let map = sessions().lock();
            match map.get(&sid) {
                Some(entry) => match entry.master.try_clone_reader() {
                    Ok(r) => r,
                    Err(_) => return,
                },
                None => return,
            }
        };

        let mut buf = [0u8; 4096];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = on_data.send(PtyEvent::Data { data });
                }
                Err(_) => break,
            }
        }

        // Wait for child exit
        let mut child = child;
        let code = child
            .wait()
            .map(|s| if s.success() { 0 } else { s.exit_code() as i32 })
            .unwrap_or(-1);

        let _ = on_data.send(PtyEvent::Exit { code });

        // Cleanup session
        sessions().lock().remove(&sid);
    });

    Ok(PtySession {
        session_id,
        pid: pid as u32,
    })
}

/// Write data to PTY stdin (keystrokes from xterm.js)
#[tauri::command]
pub async fn pty_write(session_id: String, data: String) -> Result<(), String> {
    let mut map = sessions().lock();
    let entry = map
        .get_mut(&session_id)
        .ok_or_else(|| format!("No PTY session: {session_id}"))?;

    entry
        .writer
        .write_all(data.as_bytes())
        .map_err(|e| format!("PTY write failed: {e}"))?;

    entry
        .writer
        .flush()
        .map_err(|e| format!("PTY flush failed: {e}"))
}

/// Resize PTY
#[tauri::command]
pub async fn pty_resize(session_id: String, rows: u16, cols: u16) -> Result<(), String> {
    let map = sessions().lock();
    let entry = map
        .get(&session_id)
        .ok_or_else(|| format!("No PTY session: {session_id}"))?;

    entry
        .master
        .resize(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("PTY resize failed: {e}"))
}

/// Kill PTY session
#[tauri::command]
pub async fn pty_kill(session_id: String) -> Result<(), String> {
    let entry = sessions().lock().remove(&session_id);
    if entry.is_none() {
        return Err(format!("No PTY session: {session_id}"));
    }
    // Dropping the entry closes the master PTY, which signals the child to exit
    Ok(())
}
