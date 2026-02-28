use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::process::Stdio;
use tauri::State;
use tauri::ipc::Channel;

pub struct ActiveComposes(Mutex<HashSet<String>>);

impl ActiveComposes {
    pub fn new() -> Self {
        Self(Mutex::new(HashSet::new()))
    }

    pub fn teardown_all(&self) {
        let paths: Vec<String> = self.0.lock().drain().collect();
        let Ok(binary) = resolve_binary() else { return };
        for path in &paths {
            let mut cmd = crate::cmd(&binary);
            cmd.args(["compose", "-f", path, "down"]);
            crate::shell_env::inject(&mut cmd);
            let _ = cmd.output();
        }
    }
}

// Cached full path to the container runtime binary.
// Mutex instead of OnceLock so "Check again" can re-probe after the user
// installs a runtime without restarting the app.
static CACHED_BINARY: Mutex<Option<String>> = Mutex::new(None);

/// Well-known install locations per platform. macOS .app bundles and Windows
/// .msi installs don't inherit the user's shell PATH.
fn search_dirs() -> Vec<String> {
    let mut dirs = Vec::new();

    if cfg!(target_os = "macos") {
        dirs.extend([
            "/opt/homebrew/bin".to_string(),
            "/usr/local/bin".to_string(),
        ]);
    } else if cfg!(target_os = "linux") {
        dirs.extend(["/usr/bin".to_string(), "/usr/local/bin".to_string()]);
    } else if cfg!(target_os = "windows") {
        // Docker Desktop system install
        if let Ok(pf) = std::env::var("ProgramFiles") {
            dirs.push(format!("{pf}\\Docker\\Docker\\resources\\bin"));
        }
        // Docker Desktop newer per-user install (Docker 4.x+)
        if let Ok(profile) = std::env::var("USERPROFILE") {
            dirs.push(format!("{profile}\\.docker\\bin"));
        }
        // Podman Desktop
        if let Ok(pf) = std::env::var("ProgramFiles") {
            dirs.push(format!("{pf}\\RedHat\\Podman"));
        }
        // User-level installs via winget/scoop
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            dirs.push(format!("{local}\\Microsoft\\WinGet\\Packages"));
        }
    }

    dirs
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeInfo {
    pub binary: String,
    pub version: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContainerInfo {
    pub id: String,
    pub name: String,
    pub image: String,
    pub status: String,
    pub health: String,
    pub ports: String,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum ServiceEvent {
    ServiceStarting { name: String },
    ServiceHealthy { name: String },
    ServiceFailed { name: String, error: String },
    AllHealthy,
    Error { message: String },
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase", tag = "event")]
pub enum LogEvent {
    Line { data: String },
    End,
    Error { message: String },
}

/// Pre-flight check result — discriminated union for the frontend.
#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum RuntimeCheck {
    Ready { binary: String, version: String },
    Missing,
}

/// Run a binary with --version, return the output if it succeeds.
fn probe_version(binary: &str) -> Option<String> {
    let mut cmd = crate::cmd(binary);
    cmd.arg("--version");
    crate::shell_env::inject(&mut cmd);
    cmd.output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// Find a container runtime by name. Tries PATH first, then well-known
/// absolute paths for production builds where PATH is restricted.
fn find_binary(name: &str) -> Option<(String, String)> {
    let exe_name = if cfg!(windows) {
        format!("{name}.exe")
    } else {
        name.to_string()
    };

    if let Some(version) = probe_version(&exe_name) {
        return Some((exe_name, version));
    }
    for dir in search_dirs() {
        let sep = if cfg!(windows) { "\\" } else { "/" };
        let candidate = format!("{dir}{sep}{exe_name}");
        if let Some(version) = probe_version(&candidate) {
            return Some((candidate, version));
        }
    }
    None
}

/// Fresh probe: check podman then docker. Returns (full_path, version).
fn detect_binary() -> Option<(String, String)> {
    find_binary("podman").or_else(|| find_binary("docker"))
}

/// Resolve the container runtime, using the cache if available.
/// Returns the full path to the binary (e.g. "/opt/homebrew/bin/podman").
pub(crate) fn resolve_binary() -> Result<String, String> {
    let mut guard = CACHED_BINARY.lock();
    if let Some(ref path) = *guard {
        return Ok(path.clone());
    }
    let (path, _) = detect_binary().ok_or_else(|| "No container runtime found".to_string())?;
    *guard = Some(path.clone());
    Ok(path)
}

fn runtime_name(path: &str) -> &'static str {
    if path.contains("podman") {
        "podman"
    } else {
        "docker"
    }
}

fn refresh_binary() -> RuntimeCheck {
    let mut guard = CACHED_BINARY.lock();
    match detect_binary() {
        Some((path, version)) => {
            let name = runtime_name(&path);
            *guard = Some(path);
            RuntimeCheck::Ready {
                binary: name.to_string(),
                version,
            }
        }
        None => {
            *guard = None;
            RuntimeCheck::Missing
        }
    }
}

#[tauri::command]
pub async fn detect_container_runtime() -> Result<RuntimeInfo, String> {
    let path = resolve_binary()?;
    let version = probe_version(&path).unwrap_or_default();
    Ok(RuntimeInfo {
        binary: runtime_name(&path).to_string(),
        version,
    })
}

/// Pre-flight check called by the frontend. Always does a fresh probe
/// so "Check again" works after the user installs a runtime.
#[tauri::command]
pub async fn check_container_runtime() -> RuntimeCheck {
    refresh_binary()
}

/// Start services via compose, streaming health status per service.
#[tauri::command]
pub async fn compose_up(
    compose_path: String,
    on_event: Channel<ServiceEvent>,
    active: State<'_, ActiveComposes>,
) -> Result<(), String> {
    let binary = resolve_binary()?;

    let mut up_cmd = crate::cmd(&binary);
    up_cmd.args([
        "compose",
        "-f",
        &compose_path,
        "up",
        "-d",
        "--force-recreate",
    ]);
    crate::shell_env::inject(&mut up_cmd);
    let up = up_cmd
        .output()
        .map_err(|e| format!("compose up failed: {e}"))?;

    if !up.status.success() {
        let stderr = String::from_utf8_lossy(&up.stderr);
        let _ = on_event.send(ServiceEvent::Error {
            message: stderr.to_string(),
        });
        return Err(stderr.to_string());
    }

    active.0.lock().insert(compose_path.clone());

    const HEALTH_POLL_INTERVAL_SECS: u64 = 2;
    const HEALTH_POLL_ATTEMPTS: usize = 30; // 60s total

    for _ in 0..HEALTH_POLL_ATTEMPTS {
        tokio::time::sleep(std::time::Duration::from_secs(HEALTH_POLL_INTERVAL_SECS)).await;

        let mut ps_cmd = crate::cmd(&binary);
        ps_cmd.args(["compose", "-f", &compose_path, "ps", "--format", "json"]);
        crate::shell_env::inject(&mut ps_cmd);
        let ps = ps_cmd
            .output()
            .map_err(|e| format!("compose ps failed: {e}"))?;

        let stdout = String::from_utf8_lossy(&ps.stdout);
        let containers = parse_compose_ps(&stdout);

        let mut all_healthy = true;
        for c in &containers {
            match c.health.as_str() {
                "healthy" => {
                    let _ = on_event.send(ServiceEvent::ServiceHealthy {
                        name: c.name.clone(),
                    });
                }
                "unhealthy" => {
                    let _ = on_event.send(ServiceEvent::ServiceFailed {
                        name: c.name.clone(),
                        error: format!("Container {} is unhealthy", c.name),
                    });
                }
                _ => {
                    let _ = on_event.send(ServiceEvent::ServiceStarting {
                        name: c.name.clone(),
                    });
                    all_healthy = false;
                }
            }
        }

        if all_healthy && !containers.is_empty() {
            let _ = on_event.send(ServiceEvent::AllHealthy);
            return Ok(());
        }
    }

    let _ = on_event.send(ServiceEvent::Error {
        message: "Timed out waiting for services to become healthy".to_string(),
    });
    Err("Timed out waiting for services to become healthy".to_string())
}

/// Tear down compose services.
#[tauri::command]
pub async fn compose_down(
    compose_path: String,
    remove_volumes: bool,
    active: State<'_, ActiveComposes>,
) -> Result<(), String> {
    let binary = resolve_binary()?;

    let mut down_args = vec!["compose", "-f", &compose_path, "down"];
    if remove_volumes {
        down_args.push("-v");
    }

    let mut cmd = crate::cmd(&binary);
    cmd.args(&down_args);
    crate::shell_env::inject(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("compose down failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }

    active.0.lock().remove(&compose_path);
    Ok(())
}

/// List containers for a compose project.
#[tauri::command]
pub async fn container_list(compose_path: String) -> Result<Vec<ContainerInfo>, String> {
    let binary = resolve_binary()?;

    let mut cmd = crate::cmd(&binary);
    cmd.args(["compose", "-f", &compose_path, "ps", "--format", "json"]);
    crate::shell_env::inject(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("container list failed: {e}"))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_compose_ps(&stdout))
}

/// Stream logs for a specific container. Sends lines via Channel.
#[tauri::command]
pub async fn container_logs(
    container_name: String,
    on_log: Channel<LogEvent>,
) -> Result<(), String> {
    let binary = resolve_binary()?;

    let mut cmd = crate::cmd(&binary);
    cmd.args(["logs", "-f", "--tail", "500", &container_name]);
    crate::shell_env::inject(&mut cmd);
    cmd.stdout(Stdio::piped());
    cmd.stderr(Stdio::piped());
    let mut child = cmd
        .spawn()
        .map_err(|e| format!("container logs failed: {e}"))?;

    if let Some(stdout) = child.stdout.take() {
        let ch = on_log.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(data) => {
                        let _ = ch.send(LogEvent::Line { data });
                    }
                    Err(e) => {
                        let _ = ch.send(LogEvent::Error {
                            message: format!("stdout read error: {e}"),
                        });
                        break;
                    }
                }
            }
            let _ = ch.send(LogEvent::End);
        });
    }

    if let Some(stderr) = child.stderr.take() {
        let ch = on_log.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(data) => {
                        let _ = ch.send(LogEvent::Line { data });
                    }
                    Err(e) => {
                        let _ = ch.send(LogEvent::Error {
                            message: format!("stderr read error: {e}"),
                        });
                        break;
                    }
                }
            }
        });
    }

    Ok(())
}

#[derive(Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ContainerAction {
    Start,
    Stop,
    Restart,
}

impl ContainerAction {
    fn as_str(&self) -> &'static str {
        match self {
            Self::Start => "start",
            Self::Stop => "stop",
            Self::Restart => "restart",
        }
    }
}

#[tauri::command]
pub async fn container_action(
    container_name: String,
    action: ContainerAction,
) -> Result<(), String> {
    let binary = resolve_binary()?;
    let verb = action.as_str();

    let mut cmd = crate::cmd(&binary);
    cmd.args([verb, &container_name]);
    crate::shell_env::inject(&mut cmd);
    let output = cmd.output().map_err(|e| format!("{verb} failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(stderr.to_string());
    }
    Ok(())
}

/// Parse `compose ps --format json` output into ContainerInfo vec.
/// Both Podman and Docker emit one JSON object per line.
fn parse_compose_ps(output: &str) -> Vec<ContainerInfo> {
    output
        .lines()
        .filter(|line| line.starts_with('{'))
        .filter_map(|line| {
            let v: serde_json::Value = serde_json::from_str(line).ok()?;
            Some(ContainerInfo {
                id: json_str(&v, "ID"),
                name: json_str(&v, "Name"),
                image: json_str(&v, "Image"),
                status: json_str(&v, "Status"),
                health: json_str(&v, "Health"),
                ports: json_str(&v, "Ports"),
            })
        })
        .collect()
}

fn json_str(v: &serde_json::Value, key: &str) -> String {
    v.get(key)
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_string()
}
