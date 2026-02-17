use regex::Regex;
use serde::Serialize;
use std::fs;
use std::path::Path;

const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    "dist",
    "build",
    "target",
    ".next",
    "__pycache__",
    ".cache",
    "coverage",
    ".turbo",
];

const MAX_MATCHES: usize = 1000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchMatch {
    pub path: String,
    pub line_number: u32,
    pub column: u32,
    pub line_content: String,
    pub match_len: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResult {
    pub matches: Vec<SearchMatch>,
    pub truncated: bool,
}

fn is_binary(path: &Path) -> bool {
    let Ok(bytes) = fs::read(path) else {
        return true;
    };
    let check_len = bytes.len().min(512);
    bytes[..check_len].contains(&0)
}

fn walk_and_search(
    dir: &Path,
    pattern: &dyn Fn(&str) -> Vec<(usize, usize)>,
    matches: &mut Vec<SearchMatch>,
) -> bool {
    let Ok(read_dir) = fs::read_dir(dir) else {
        return false;
    };

    for entry in read_dir.flatten() {
        if matches.len() >= MAX_MATCHES {
            return true;
        }

        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };

        // Skip hidden files/dirs
        if name.starts_with('.') {
            continue;
        }

        if path.is_dir() {
            if IGNORED_DIRS.contains(&name) {
                continue;
            }
            if walk_and_search(&path, pattern, matches) {
                return true;
            }
            continue;
        }

        if is_binary(&path) {
            continue;
        }

        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let path_str = path.to_string_lossy().to_string();

        for (line_idx, line) in content.lines().enumerate() {
            if matches.len() >= MAX_MATCHES {
                return true;
            }

            for (col, len) in pattern(line) {
                if matches.len() >= MAX_MATCHES {
                    return true;
                }
                matches.push(SearchMatch {
                    path: path_str.clone(),
                    line_number: (line_idx + 1) as u32,
                    column: (col + 1) as u32,
                    line_content: line.to_string(),
                    match_len: len as u32,
                });
            }
        }
    }

    false
}

#[tauri::command]
pub async fn search_workspace(
    root: String,
    query: String,
    case_sensitive: bool,
    regex_mode: bool,
    whole_word: bool,
) -> Result<SearchResult, String> {
    if query.is_empty() {
        return Ok(SearchResult {
            matches: vec![],
            truncated: false,
        });
    }

    let mut matches = Vec::new();

    let truncated = if regex_mode {
        let flags = if case_sensitive { "" } else { "(?i)" };
        let pattern_str = if whole_word {
            format!("{flags}\\b{query}\\b")
        } else {
            format!("{flags}{query}")
        };
        let re = Regex::new(&pattern_str).map_err(|e| format!("Invalid regex: {e}"))?;

        walk_and_search(
            Path::new(&root),
            &|line: &str| re.find_iter(line).map(|m| (m.start(), m.len())).collect(),
            &mut matches,
        )
    } else {
        let search_query = if case_sensitive {
            query.clone()
        } else {
            query.to_lowercase()
        };

        walk_and_search(
            Path::new(&root),
            &|line: &str| {
                let haystack = if case_sensitive {
                    line.to_string()
                } else {
                    line.to_lowercase()
                };
                let mut results = Vec::new();
                let mut start = 0;
                while let Some(pos) = haystack[start..].find(&search_query) {
                    let abs_pos = start + pos;
                    if whole_word {
                        let before_ok = abs_pos == 0
                            || !haystack.as_bytes()[abs_pos - 1].is_ascii_alphanumeric();
                        let after_pos = abs_pos + search_query.len();
                        let after_ok = after_pos >= haystack.len()
                            || !haystack.as_bytes()[after_pos].is_ascii_alphanumeric();
                        if before_ok && after_ok {
                            results.push((abs_pos, search_query.len()));
                        }
                    } else {
                        results.push((abs_pos, search_query.len()));
                    }
                    start = abs_pos + 1;
                }
                results
            },
            &mut matches,
        )
    };

    Ok(SearchResult { matches, truncated })
}
