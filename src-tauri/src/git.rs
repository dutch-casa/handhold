use serde::Serialize;
use std::process::Command;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LineChange {
    pub line: u32,
    pub kind: &'static str, // "added" | "modified" | "deleted"
}

/// Get per-line git diff status for a file.
/// Returns empty vec if the file isn't tracked or git isn't available.
#[tauri::command]
pub async fn git_line_diff(path: String) -> Result<Vec<LineChange>, String> {
    // git diff --unified=0 shows only changed hunks with no context
    let output = Command::new("git")
        .args(["diff", "--unified=0", "--no-color", "--", &path])
        .output()
        .map_err(|e| format!("git not available: {e}"))?;

    if !output.status.success() {
        // Not a git repo or file not tracked — not an error, just no changes
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_unified_diff(&stdout))
}

/// Get per-line diff against HEAD (staged + unstaged changes).
#[tauri::command]
pub async fn git_line_diff_head(path: String) -> Result<Vec<LineChange>, String> {
    let output = Command::new("git")
        .args(["diff", "HEAD", "--unified=0", "--no-color", "--", &path])
        .output()
        .map_err(|e| format!("git not available: {e}"))?;

    if !output.status.success() {
        return Ok(vec![]);
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    Ok(parse_unified_diff(&stdout))
}

fn parse_unified_diff(diff: &str) -> Vec<LineChange> {
    let mut changes = Vec::new();

    for line in diff.lines() {
        // Hunk headers: @@ -old_start[,old_count] +new_start[,new_count] @@
        if !line.starts_with("@@ ") {
            continue;
        }

        let Some(hunk) = parse_hunk_header(line) else {
            continue;
        };

        let kind = match (hunk.old_count, hunk.new_count) {
            (0, _) => "added",
            (_, 0) => "deleted",
            _ => "modified",
        };

        if kind == "deleted" {
            // Deleted lines: mark the line *after* the deletion point
            changes.push(LineChange {
                line: hunk.new_start,
                kind,
            });
        } else {
            for i in 0..hunk.new_count {
                changes.push(LineChange {
                    line: hunk.new_start + i,
                    kind,
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
    // @@ -7,3 +7,5 @@ or @@ -7 +7 @@ (count defaults to 1)
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
