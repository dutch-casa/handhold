use std::collections::HashMap;
use std::process::Command;
use std::sync::OnceLock;

/// Resolved user shell environment — cached once at first access.
/// macOS .app bundles, Windows .msi installs, and Linux .deb/.AppImage
/// packages all launch with a stripped-down process environment that lacks
/// the user's PATH, LANG, HOME, and other vars set by login shell rc files.
/// This module queries the user's real login shell to recover that environment.
struct ShellEnv {
    path: String,
    home: String,
    vars: HashMap<String, String>,
}

static RESOLVED: OnceLock<ShellEnv> = OnceLock::new();

fn resolve() -> &'static ShellEnv {
    RESOLVED.get_or_init(query_login_shell_env)
}

/// Injects the resolved PATH (and HOME, LANG, USER) into a
/// `std::process::Command` so it can find tools installed by Homebrew,
/// nvm, pyenv, cargo, etc.
pub fn inject(cmd: &mut Command) {
    let env = resolve();
    cmd.env("PATH", &env.path);
    if !env.home.is_empty() {
        cmd.env("HOME", &env.home);
    }
    for (key, val) in &env.vars {
        cmd.env(key, val);
    }
}

/// Injects into a portable-pty CommandBuilder.
pub fn inject_pty(cmd: &mut portable_pty::CommandBuilder) {
    let env = resolve();
    cmd.env("PATH", &env.path);
    if !env.home.is_empty() {
        cmd.env("HOME", &env.home);
    }
    for (key, val) in &env.vars {
        cmd.env(key, val);
    }
}

/// Query the user's login shell for their real environment.
/// Falls back to well-known paths if the shell query fails.
fn query_login_shell_env() -> ShellEnv {
    if cfg!(windows) {
        return query_windows_env();
    }

    let shell = std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string());

    // Ask the login shell to print env vars, one per line.
    // -l = login shell (sources /etc/zprofile, ~/.zprofile, ~/.zshrc, etc.)
    // -i is NOT used — it triggers prompt-related side effects.
    // printf is more portable than echo for \n across sh/bash/zsh.
    let script = r#"printf '__PATH=%s\n__HOME=%s\n__LANG=%s\n__USER=%s\n__LOGNAME=%s\n' "$PATH" "$HOME" "$LANG" "$USER" "$LOGNAME""#;

    let output = Command::new(&shell)
        .args(["-l", "-c", script])
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::null())
        .output();

    let mut path = String::new();
    let mut home = String::new();
    let mut vars = HashMap::new();

    if let Ok(output) = output {
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if let Some(val) = line.strip_prefix("__PATH=") {
                path = val.to_string();
            } else if let Some(val) = line.strip_prefix("__HOME=") {
                home = val.to_string();
            } else if let Some(val) = line.strip_prefix("__LANG=")
                && !val.is_empty()
            {
                vars.insert("LANG".to_string(), val.to_string());
            } else if let Some(val) = line.strip_prefix("__USER=")
                && !val.is_empty()
            {
                vars.insert("USER".to_string(), val.to_string());
            } else if let Some(val) = line.strip_prefix("__LOGNAME=")
                && !val.is_empty()
            {
                vars.insert("LOGNAME".to_string(), val.to_string());
            }
        }
    }

    if path.is_empty() {
        path = fallback_path();
    }
    if home.is_empty() {
        home = std::env::var("HOME")
            .or_else(|_| {
                dirs::home_dir()
                    .map(|p| p.to_string_lossy().to_string())
                    .ok_or(())
            })
            .unwrap_or_default();
    }

    ShellEnv { path, home, vars }
}

fn query_windows_env() -> ShellEnv {
    // On Windows, GUI apps inherit a reasonable PATH from the
    // registry-defined system+user PATH via the process environment.
    let path = std::env::var("PATH").unwrap_or_else(|_| fallback_path());
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_default();
    ShellEnv {
        path,
        home,
        vars: HashMap::new(),
    }
}

fn fallback_path() -> String {
    if cfg!(target_os = "macos") {
        [
            "/opt/homebrew/bin",
            "/opt/homebrew/sbin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ]
        .join(":")
    } else if cfg!(target_os = "linux") {
        ["/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"].join(":")
    } else {
        std::env::var("PATH").unwrap_or_default()
    }
}
