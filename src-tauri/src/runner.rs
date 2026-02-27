use serde::Serialize;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use tauri::ipc::Channel;

// Returns (program, flag) for the platform's non-interactive shell.
#[cfg(target_os = "windows")]
fn shell() -> (&'static str, &'static str) {
    ("cmd", "/C")
}
#[cfg(not(target_os = "windows"))]
fn shell() -> (&'static str, &'static str) {
    ("sh", "-c")
}

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
    env: Vec<(String, String)>,
    on_output: Channel<RunnerEvent>,
) -> Result<RunResult, String> {
    let (prog, flag) = shell();
    let mut cmd = Command::new(prog);
    cmd.args([flag, &command]);
    cmd.current_dir(&cwd);
    crate::shell_env::inject(&mut cmd);
    cmd.envs(env);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {e}"))?;

    // Stream stdout
    if let Some(stdout) = child.stdout.take() {
        let on_out = on_output.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines().map_while(Result::ok) {
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
            for line in reader.lines().map_while(Result::ok) {
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

/// Probes whether a CLI tool is available — returns true if exit code is 0.
/// Silent: stdout and stderr are discarded.
#[tauri::command]
pub async fn check_dependency(cmd: String) -> bool {
    let (prog, flag) = shell();
    dirs::home_dir()
        .map(|home| {
            let mut command = Command::new(prog);
            command.args([flag, &cmd]);
            command.current_dir(&home);
            crate::shell_env::inject(&mut command);
            command.stdout(Stdio::null());
            command.stderr(Stdio::null());
            command.status().map(|s| s.success()).unwrap_or(false)
        })
        .unwrap_or(false)
}
