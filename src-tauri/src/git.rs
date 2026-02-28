use serde::Serialize;

#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ChangeKind {
    Added,
    Modified,
    Deleted,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineChange {
    pub line: u32,
    pub kind: ChangeKind,
}

#[tauri::command]
pub async fn git_line_diff(path: String, workspace: String) -> Result<Vec<LineChange>, String> {
    let mut cmd = crate::cmd("git");
    cmd.current_dir(&workspace);
    cmd.args(["diff", "--unified=0", "--no-color", "--", &path]);
    crate::shell_env::inject(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("git not available: {e}"))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_unified_diff(&stdout))
}

#[tauri::command]
pub async fn git_line_diff_head(
    path: String,
    workspace: String,
) -> Result<Vec<LineChange>, String> {
    let mut cmd = crate::cmd("git");
    cmd.current_dir(&workspace);
    cmd.args(["diff", "HEAD", "--unified=0", "--no-color", "--", &path]);
    crate::shell_env::inject(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("git not available: {e}"))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_unified_diff(&stdout))
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum FileStatus {
    Untracked,
    Renamed,
    Added,
    Deleted,
    Modified,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatusEntry {
    pub path: String,
    pub status: FileStatus,
}

#[tauri::command]
pub async fn git_status_files(workspace: String) -> Result<Vec<GitStatusEntry>, String> {
    let mut cmd = crate::cmd("git");
    cmd.current_dir(&workspace);
    cmd.args(["status", "--porcelain", "-uall"]);
    crate::shell_env::inject(&mut cmd);
    let output = cmd
        .output()
        .map_err(|e| format!("git not available: {e}"))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_porcelain(&stdout))
}

fn parse_porcelain(output: &str) -> Vec<GitStatusEntry> {
    let mut entries = Vec::new();
    for line in output.lines() {
        if line.len() < 4 {
            continue;
        }
        let xy = &line[..2];
        let path = &line[3..];

        let path = if let Some((_old, new)) = path.split_once(" -> ") {
            new
        } else {
            path
        };

        let status = match xy {
            "??" => FileStatus::Untracked,
            s if s.starts_with('R') || s.ends_with('R') => FileStatus::Renamed,
            s if s.starts_with('A') || s.ends_with('A') => FileStatus::Added,
            s if s.starts_with('D') || s.ends_with('D') => FileStatus::Deleted,
            s if s.starts_with('M') || s.ends_with('M') || s.starts_with('U') => {
                FileStatus::Modified
            }
            _ => continue,
        };

        entries.push(GitStatusEntry {
            path: path.to_string(),
            status,
        });
    }
    entries
}

fn parse_unified_diff(diff: &str) -> Vec<LineChange> {
    let mut changes = Vec::new();

    for line in diff.lines() {
        if !line.starts_with("@@ ") {
            continue;
        }

        let Some(hunk) = parse_hunk_header(line) else {
            continue;
        };

        let kind = match (hunk.old_count, hunk.new_count) {
            (0, _) => ChangeKind::Added,
            (_, 0) => ChangeKind::Deleted,
            _ => ChangeKind::Modified,
        };

        if matches!(kind, ChangeKind::Deleted) {
            changes.push(LineChange {
                line: hunk.new_start,
                kind,
            });
        } else {
            for i in 0..hunk.new_count {
                changes.push(LineChange {
                    line: hunk.new_start + i,
                    kind: kind.clone(),
                });
            }
        }
    }

    changes
}

struct HunkRange {
    old_count: u32,
    new_start: u32,
    new_count: u32,
}

fn parse_hunk_header(line: &str) -> Option<HunkRange> {
    let stripped = line.strip_prefix("@@ ")?;
    let end = stripped.find(" @@")?;
    let range_str = &stripped[..end];

    let mut parts = range_str.split(' ');
    let old_part = parts.next()?.strip_prefix('-')?;
    let new_part = parts.next()?.strip_prefix('+')?;

    let old_count = if let Some((_start, count)) = old_part.split_once(',') {
        count.parse().ok()?
    } else {
        1u32
    };

    let (new_start, new_count) = if let Some((start, count)) = new_part.split_once(',') {
        (start.parse().ok()?, count.parse().ok()?)
    } else {
        (new_part.parse().ok()?, 1u32)
    };

    Some(HunkRange {
        old_count,
        new_start,
        new_count,
    })
}
