use parking_lot::Mutex;
use serde::Serialize;
use std::collections::HashSet;
use std::io::{BufRead, BufReader};
use std::process::{Command, Stdio};
use std::sync::OnceLock;
use tauri::ipc::Channel;
use tauri::State;

pub struct ActiveComposes(Mutex<HashSet<String>>);

impl ActiveComposes {
    pub fn new() -> Self {
        Self(Mutex::new(HashSet::new()))
    }

    pub fn teardown_all(&self) {
        let paths: Vec<String> = self.0.lock().drain().collect();
        let Ok(binary) = resolve_binary() else { return };
        for path in &paths {
            let _ = Command::new(binary)
                .args(["compose", "-f", path, "down"])
                .output();
        }
    }
}

// Cached runtime binary path — detected once per process lifetime
fn cached_binary() -> &'static OnceLock<String> {
    static BINARY: OnceLock<String> = OnceLock::new();
    &BINARY
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

/// Try a binary, return its version string if it exists.
fn probe_runtime(binary: &str) -> Option<String> {
    Command::new(binary)
        .arg("--version")
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
}

/// Resolve the container runtime binary, caching the result.
pub(crate) fn resolve_binary() -> Result<&'static str, String> {
    let binary = cached_binary().get_or_init(|| {
        // Prefer podman (daemonless), fall back to docker
        if probe_runtime("podman").is_some() {
            "podman".to_string()
        } else if probe_runtime("docker").is_some() {
            "docker".to_string()
        } else {
            String::new()
        }
    });

    if binary.is_empty() {
        return Err("No container runtime found. Install Podman: brew install podman".to_string());
    }
    Ok(binary.as_str())
}

/// Detect which container runtime is available.
#[tauri::command]
pub async fn detect_container_runtime() -> Result<RuntimeInfo, String> {
    let binary = resolve_binary()?;
    let version = probe_runtime(binary).unwrap_or_default();
    Ok(RuntimeInfo {
        binary: binary.to_string(),
        version,
    })
}

/// Pre-flight check: is a container runtime available?
/// Returns a discriminated union so the frontend can show install instructions
/// instead of a generic error when no runtime exists.
#[derive(Serialize)]
#[serde(rename_all = "camelCase", tag = "kind")]
pub enum RuntimeCheck {
    Ready { binary: String, version: String },
    Missing,
}

#[tauri::command]
pub async fn check_container_runtime() -> RuntimeCheck {
    match resolve_binary() {
        Ok(binary) => {
            let version = probe_runtime(binary).unwrap_or_default();
            RuntimeCheck::Ready {
                binary: binary.to_string(),
                version,
            }
        }
        Err(_) => RuntimeCheck::Missing,
    }
}

/// Start services via compose, streaming health status per service.
#[tauri::command]
pub async fn compose_up(
    compose_path: String,
    on_event: Channel<ServiceEvent>,
    active: State<'_, ActiveComposes>,
) -> Result<(), String> {
    let binary = resolve_binary()?;

    // Bring up all services in detached mode
    let up = Command::new(binary)
        .args([
            "compose",
            "-f",
            &compose_path,
            "up",
            "-d",
            "--force-recreate",
        ])
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
        std::thread::sleep(std::time::Duration::from_secs(HEALTH_POLL_INTERVAL_SECS));

        let ps = Command::new(binary)
            .args(["compose", "-f", &compose_path, "ps", "--format", "json"])
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

    let mut args = vec!["compose", "-f", &compose_path, "down"];
    if remove_volumes {
        args.push("-v");
    }

    let output = Command::new(binary)
        .args(&args)
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

    let output = Command::new(binary)
        .args(["compose", "-f", &compose_path, "ps", "--format", "json"])
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

    let mut child = Command::new(binary)
        .args(["logs", "-f", "--tail", "500", &container_name])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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

    // Merge stderr into the same stream
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

/// Start, stop, or restart a single container.
#[tauri::command]
pub async fn container_action(container_name: String, action: String) -> Result<(), String> {
    let binary = resolve_binary()?;

    let output = Command::new(binary)
        .args([&action, &container_name])
        .output()
        .map_err(|e| format!("{action} failed: {e}"))?;

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
