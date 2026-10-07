use serde::{Deserialize, Serialize};
use std::path::Path;
use tokio::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitCommitInfo {
    pub hash: String,
    pub message: String,
    pub author: String,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GitRepoStatus {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "type")]
    pub repo_type: String,
    pub is_available: bool,
    pub branch: Option<String>,
    pub upstream: Option<String>,
    pub ahead: u32,
    pub behind: u32,
    pub staged_count: usize,
    pub unstaged_count: usize,
    pub untracked_count: usize,
    pub is_clean: bool,
    pub latest_commit: Option<GitCommitInfo>,
    pub error: Option<String>,
}

pub struct GitStatusScanner;

impl GitStatusScanner {
    // @implements spec-ft-git-backend-status::REQ-003
    // @implements spec-ft-git-backend-status::REQ-004
    // @implements spec-ft-git-backend-status::REQ-006
    pub async fn scan_repo(id: &str, name: &str, path: &str, repo_type: &str) -> GitRepoStatus {
        let path_obj = Path::new(path);
        if !path_obj.exists() {
            return GitRepoStatus {
                id: id.to_string(),
                name: name.to_string(),
                path: path.to_string(),
                repo_type: repo_type.to_string(),
                is_available: false,
                branch: None,
                upstream: None,
                ahead: 0,
                behind: 0,
                staged_count: 0,
                unstaged_count: 0,
                untracked_count: 0,
                is_clean: true,
                latest_commit: None,
                error: Some(format!("Directory does not exist: {}", path)),
            };
        }

        let status_output = match Command::new("git")
            .arg("status")
            .arg("--porcelain=v2")
            .arg("--branch")
            .current_dir(path_obj)
            .output()
            .await
        {
            Ok(output) => {
                if !output.status.success() {
                    let stderr = String::from_utf8_lossy(&output.stderr).to_string();
                    return GitRepoStatus {
                        id: id.to_string(),
                        name: name.to_string(),
                        path: path.to_string(),
                        repo_type: repo_type.to_string(),
                        is_available: false,
                        branch: None,
                        upstream: None,
                        ahead: 0,
                        behind: 0,
                        staged_count: 0,
                        unstaged_count: 0,
                        untracked_count: 0,
                        is_clean: true,
                        latest_commit: None,
                        error: Some(stderr.trim().to_string()),
                    };
                }
                String::from_utf8_lossy(&output.stdout).to_string()
            }
            Err(e) => {
                return GitRepoStatus {
                    id: id.to_string(),
                    name: name.to_string(),
                    path: path.to_string(),
                    repo_type: repo_type.to_string(),
                    is_available: false,
                    branch: None,
                    upstream: None,
                    ahead: 0,
                    behind: 0,
                    staged_count: 0,
                    unstaged_count: 0,
                    untracked_count: 0,
                    is_clean: true,
                    latest_commit: None,
                    error: Some(format!("Failed to execute git process: {}", e)),
                };
            }
        };

        let mut parsed = Self::parse_porcelain_v2(&status_output);
        parsed.id = id.to_string();
        parsed.name = name.to_string();
        parsed.path = path.to_string();
        parsed.repo_type = repo_type.to_string();
        parsed.is_available = true;

        if let Ok(log_output) = Command::new("git")
            .arg("log")
            .arg("-1")
            .arg("--format=%H|%s|%an|%cI")
            .current_dir(path_obj)
            .output()
            .await
        {
            if log_output.status.success() {
                let stdout = String::from_utf8_lossy(&log_output.stdout).trim().to_string();
                if let Some(commit) = Self::parse_commit_line(&stdout) {
                    parsed.latest_commit = Some(commit);
                }
            }
        }

        parsed
    }

    /// Parse porcelain v2 format output
    // @implements spec-ft-git-backend-status::REQ-003
    // @implements spec-ft-git-backend-status::REQ-004
    pub fn parse_porcelain_v2(output: &str) -> GitRepoStatus {
        let mut branch = None;
        let mut upstream = None;
        let mut ahead = 0;
        let mut behind = 0;
        let mut staged_count = 0;
        let mut unstaged_count = 0;
        let mut untracked_count = 0;

        for line in output.lines() {
            if line.starts_with("# branch.head ") {
                let val = line["# branch.head ".len()..].trim();
                branch = Some(val.to_string());
            } else if line.starts_with("# branch.upstream ") {
                let val = line["# branch.upstream ".len()..].trim();
                upstream = Some(val.to_string());
            } else if line.starts_with("# branch.ab ") {
                let ab = line["# branch.ab ".len()..].trim();
                for part in ab.split_whitespace() {
                    if let Some(pos) = part.strip_prefix('+') {
                        ahead = pos.parse().unwrap_or(0);
                    } else if let Some(neg) = part.strip_prefix('-') {
                        behind = neg.parse().unwrap_or(0);
                    }
                }
            } else if line.starts_with("1 ") || line.starts_with("2 ") {
                let parts: Vec<&str> = line.split_whitespace().collect();
                if parts.len() >= 2 {
                    let xy = parts[1];
                    let staged_char = xy.chars().next().unwrap_or('.');
                    let unstaged_char = xy.chars().nth(1).unwrap_or('.');
                    if staged_char != '.' {
                        staged_count += 1;
                    }
                    if unstaged_char != '.' {
                        unstaged_count += 1;
                    }
                }
            } else if line.starts_with("u ") {
                staged_count += 1;
            } else if line.starts_with("? ") {
                untracked_count += 1;
            }
        }

        let is_clean = staged_count == 0 && unstaged_count == 0 && untracked_count == 0;

        GitRepoStatus {
            id: String::new(),
            name: String::new(),
            path: String::new(),
            repo_type: "codebase".to_string(),
            is_available: true,
            branch,
            upstream,
            ahead,
            behind,
            staged_count,
            unstaged_count,
            untracked_count,
            is_clean,
            latest_commit: None,
            error: None,
        }
    }

    pub fn parse_commit_line(line: &str) -> Option<GitCommitInfo> {
        let parts: Vec<&str> = line.split('|').collect();
        if parts.len() >= 4 {
            Some(GitCommitInfo {
                hash: parts[0].to_string(),
                message: parts[1].to_string(),
                author: parts[2].to_string(),
                timestamp: parts[3].to_string(),
            })
        } else {
            None
        }
    }
}
