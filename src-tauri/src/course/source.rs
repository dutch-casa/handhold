use sha2::{Digest, Sha256};

pub(super) enum CourseSource {
    GitHub {
        owner: String,
        repo: String,
        branch: String,
        path: String,
    },
    Http {
        manifest_url: String,
        base_url: String,
    },
}

pub(super) fn hash_id(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    let hash = hasher.finalize();
    format!("{:x}", hash)[..16].to_string()
}

pub(super) fn source_id(source: &CourseSource) -> String {
    match source {
        CourseSource::GitHub {
            owner, repo, path, ..
        } => {
            if path.is_empty() {
                hash_id(&format!("https://github.com/{owner}/{repo}"))
            } else {
                hash_id(&format!("https://github.com/{owner}/{repo}/{path}"))
            }
        }
        CourseSource::Http { manifest_url, .. } => hash_id(manifest_url),
    }
}

pub(super) fn manifest_url(source: &CourseSource) -> String {
    match source {
        CourseSource::GitHub {
            owner,
            repo,
            branch,
            path,
        } => {
            if path.is_empty() {
                format!(
                    "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/handhold.yaml"
                )
            } else {
                format!(
                    "https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}/handhold.yaml"
                )
            }
        }
        CourseSource::Http { manifest_url, .. } => manifest_url.clone(),
    }
}

pub(super) fn canonical_source_url(source: &CourseSource) -> String {
    match source {
        CourseSource::GitHub {
            owner, repo, path, ..
        } => {
            if path.is_empty() {
                format!("https://github.com/{owner}/{repo}")
            } else {
                format!("https://github.com/{owner}/{repo}/{path}")
            }
        }
        CourseSource::Http { manifest_url, .. } => manifest_url.clone(),
    }
}

pub(super) fn parse_source_url(url: &str) -> Option<CourseSource> {
    let url = url.trim().trim_end_matches('/');
    let parsed = reqwest::Url::parse(url).ok()?;
    let host = parsed.host_str()?;
    let segments: Vec<&str> = parsed.path_segments()?.filter(|s| !s.is_empty()).collect();

    if host == "raw.githubusercontent.com" {
        if segments.len() < 3 {
            return None;
        }
        let owner = segments[0].to_string();
        let repo = segments[1].to_string();
        let branch = segments[2].to_string();
        let remaining: Vec<&str> = segments[3..].to_vec();
        let path = if remaining.last().is_some_and(|s| *s == "handhold.yaml") {
            remaining[..remaining.len() - 1].join("/")
        } else {
            remaining.join("/")
        };
        return Some(CourseSource::GitHub {
            owner,
            repo,
            branch,
            path,
        });
    }

    if host == "github.com" {
        if segments.len() < 2 {
            return None;
        }
        let owner = segments[0].trim_end_matches(".git").to_string();
        let repo = segments[1].trim_end_matches(".git").to_string();
        if owner.is_empty() || repo.is_empty() {
            return None;
        }

        if segments.len() == 2 {
            return Some(CourseSource::GitHub {
                owner,
                repo,
                branch: "HEAD".to_string(),
                path: String::new(),
            });
        }

        if segments.len() >= 4 && (segments[2] == "blob" || segments[2] == "tree") {
            let branch = segments[3].to_string();
            let remaining: Vec<&str> = segments[4..].to_vec();
            let path = if remaining.last().is_some_and(|s| *s == "handhold.yaml") {
                remaining[..remaining.len() - 1].join("/")
            } else {
                remaining.join("/")
            };
            return Some(CourseSource::GitHub {
                owner,
                repo,
                branch,
                path,
            });
        }

        return Some(CourseSource::GitHub {
            owner,
            repo,
            branch: "HEAD".to_string(),
            path: String::new(),
        });
    }

    if url.ends_with("/handhold.yaml") {
        let base_url = url.trim_end_matches("handhold.yaml").to_string();
        return Some(CourseSource::Http {
            manifest_url: url.to_string(),
            base_url,
        });
    }

    None
}
