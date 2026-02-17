use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::ipc::Channel;

/// Events streamed during command execution
#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event", content = "data")]
pub enum RunnerEvent {
    Stdout { data: String },
    Stderr { data: String },
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunResult {
    pub exit_code: i32,
}

/// Run a shell command non-interactively, streaming output via Channel.
/// Used for setup scripts, teardown, and test execution.
#[tauri::command]
pub async fn run_command(
    command: String,
    cwd: String,
    _env: Vec<(String, String)>,
    on_output: Channel<RunnerEvent>,
) -> Result<RunResult, String> {
    let mut child = Command::new("sh")
        .args(["-c", &command])
        .current_dir(&cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {e}"))?;

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let on_out = on_output.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().flatten() {
                let _ = on_out.send(RunnerEvent::Stdout {
                    data: format!("{line}\n"),
                });
            }
        });
    }

    // Stream stderr
    if let Some(stderr) = child.stderr.take() {
        let on_err = on_output.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines().flatten() {
                let _ = on_err.send(RunnerEvent::Stderr {
                    data: format!("{line}\n"),
                });
            }
        });
    }

    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for command: {e}"))?;

    Ok(RunResult {
        exit_code: status.code().unwrap_or(-1),
    })
}
