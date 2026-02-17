use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::Arc;
use tauri::ipc::Channel;

use crate::container;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum LspEvent {
    Message { data: String },
    Exit { code: i32 },
    Error { message: String },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LspSession {
    pub session_id: String,
}

struct SessionEntry {
    stdin: std::process::ChildStdin,
}

type SessionMap = Arc<Mutex<HashMap<String, SessionEntry>>>;

fn sessions() -> &'static SessionMap {
    use std::sync::OnceLock;
    static SESSIONS: OnceLock<SessionMap> = OnceLock::new();
    SESSIONS.get_or_init(|| Arc::new(Mutex::new(HashMap::new())))
}

fn read_lsp_messages(reader: impl Read, channel: Channel<LspEvent>) {
    let mut reader = BufReader::new(reader);
    let mut line = String::new();
    loop {
        let mut content_length: Option<usize> = None;
        loop {
            line.clear();
            if reader.read_line(&mut line).unwrap_or(0) == 0 {
                return;
            }
            let trimmed = line.trim();
            if trimmed.is_empty() {
                break;
            }
            if let Some(v) = trimmed.strip_prefix("Content-Length: ") {
                content_length = v.parse().ok();
            }
        }
        let Some(len) = content_length else {
            continue;
        };
        let mut body = vec![0u8; len];
        if reader.read_exact(&mut body).is_err() {
            return;
        }
        let data = String::from_utf8_lossy(&body).to_string();
        let _ = channel.send(LspEvent::Message { data });
    }
}

#[tauri::command]
pub async fn lsp_spawn(
    container_name: String,
    server_binary: String,
    server_args: Vec<String>,
    on_event: Channel<LspEvent>,
) -> Result<LspSession, String> {
    let binary = container::resolve_binary()?;

    let mut cmd = Command::new(binary);
    cmd.args(["exec", "-i", &container_name, &server_binary]);
    cmd.args(&server_args);
    cmd.stdin(Stdio::piped());
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());

    let mut child: Child = cmd.spawn().map_err(|e| format!("LSP spawn failed: {e}"))?;

    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| "Failed to capture LSP stdin".to_string())?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| "Failed to capture LSP stdout".to_string())?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| "Failed to capture LSP stderr".to_string())?;

    let session_id = uuid::Uuid::new_v4().to_string();

    {
        let mut map = sessions().lock();
        map.insert(session_id.clone(), SessionEntry { stdin });
    }

    // Stdout reader — parses Content-Length framed JSON-RPC messages
    let sid = session_id.clone();
    let stdout_channel = on_event.clone();
    let stderr_channel = on_event.clone();
    let exit_channel = on_event;
    std::thread::spawn(move || {
        read_lsp_messages(stdout, stdout_channel);

        // stdout closed — wait for child, send exit, cleanup
        let code = child
            .wait()
            .map(|s| s.code().unwrap_or(-1))
            .unwrap_or(-1);
        let _ = exit_channel.send(LspEvent::Exit { code });
        sessions().lock().remove(&sid);
    });

    // Stderr reader — language servers log diagnostics/info to stderr
    std::thread::spawn(move || {
        let reader = BufReader::new(stderr);
        for line in reader.lines() {
            match line {
                Ok(msg) => {
                    let _ = stderr_channel.send(LspEvent::Error { message: msg });
                }
                Err(_) => break,
            }
        }
    });

    Ok(LspSession { session_id })
}

#[tauri::command]
pub async fn lsp_send(session_id: String, data: String) -> Result<(), String> {
    let mut map = sessions().lock();
    let entry = map
        .get_mut(&session_id)
        .ok_or_else(|| format!("No LSP session: {session_id}"))?;

    entry
        .stdin
        .write_all(data.as_bytes())
        .map_err(|e| format!("LSP write failed: {e}"))?;

    entry
        .stdin
        .flush()
        .map_err(|e| format!("LSP flush failed: {e}"))
}

#[tauri::command]
pub async fn lsp_kill(session_id: String) -> Result<(), String> {
    let entry = sessions().lock().remove(&session_id);
    if entry.is_none() {
        return Err(format!("No LSP session: {session_id}"));
    }
    Ok(())
}
