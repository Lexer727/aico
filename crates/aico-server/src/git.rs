use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::process::Command;
use tokio::process::Command as TokioCommand;

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
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
    pub is_available: bool,
    #[serde(default)]
    pub is_cloned: bool,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectRepoEntry {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(rename = "type", default = "default_repo_entry_type")]
    pub repo_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

fn default_repo_entry_type() -> String {
    "codebase".to_string()
}

impl ProjectRepoEntry {
    pub fn resolved_path(&self) -> String {
        match &self.path {
            Some(p) if !p.trim().is_empty() => p.clone(),
            _ => {
                if self.repo_type == "specs" {
                    ".".to_string()
                } else {
                    format!("../codebase/{}", self.id)
                }
            }
        }
    }
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-1::REQ-001
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Default)]
pub struct ProjectManifest {
    #[serde(default)]
    pub project_name: Option<String>,
    #[serde(default)]
    pub id: Option<String>,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub repositories: Vec<ProjectRepoEntry>,
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-006
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-007
pub fn resolve_clone_target_dir(workspace_root: &Path, repo_id: &str, repo_type: &str) -> PathBuf {
    if repo_type == "specs" {
        workspace_root.join(repo_id)
    } else {
        workspace_root.join("codebase").join(repo_id)
    }
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
pub fn git_pull_repo(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.exists() {
        return Err(format!("Directory does not exist: {}", repo_dir.display()));
    }
    let output = Command::new("git")
        .arg("pull")
        .current_dir(repo_dir)
        .output()
        .map_err(|e| format!("Failed to execute git pull: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if err.is_empty() { "git pull failed".to_string() } else { err });
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(if stdout.is_empty() { "Already up to date.".to_string() } else { stdout })
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
pub fn git_push_repo(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.exists() {
        return Err(format!("Directory does not exist: {}", repo_dir.display()));
    }
    let output = Command::new("git")
        .arg("push")
        .current_dir(repo_dir)
        .output()
        .map_err(|e| format!("Failed to execute git push: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if err.is_empty() { "git push failed".to_string() } else { err });
    }
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    Ok(if stdout.is_empty() { "Everything up-to-date".to_string() } else { stdout })
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-008
pub fn git_commit_repo(repo_dir: &Path, message: &str) -> Result<String, String> {
    let trimmed = message.trim();
    if trimmed.is_empty() {
        return Err("Commit message cannot be empty (REQ-008)".to_string());
    }
    if !repo_dir.exists() {
        return Err(format!("Directory does not exist: {}", repo_dir.display()));
    }
    let add_output = Command::new("git")
        .args(["add", "-A"])
        .current_dir(repo_dir)
        .output()
        .map_err(|e| format!("Failed to execute git add: {}", e))?;

    if !add_output.status.success() {
        let err = String::from_utf8_lossy(&add_output.stderr).trim().to_string();
        return Err(format!("git add failed: {}", err));
    }

    let commit_output = Command::new("git")
        .args(["commit", "-m", trimmed])
        .current_dir(repo_dir)
        .output()
        .map_err(|e| format!("Failed to execute git commit: {}", e))?;

    if !commit_output.status.success() {
        let err = String::from_utf8_lossy(&commit_output.stderr).trim().to_string();
        return Err(if err.is_empty() { "git commit failed".to_string() } else { err });
    }
    Ok(String::from_utf8_lossy(&commit_output.stdout).trim().to_string())
}

// @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-4::REQ-004
pub fn git_ai_commit_repo(repo_dir: &Path) -> Result<String, String> {
    if !repo_dir.exists() {
        return Err(format!("Directory does not exist: {}", repo_dir.display()));
    }

    // Stage all changes first
    let add_output = Command::new("git")
        .args(["add", "-A"])
        .current_dir(repo_dir)
        .output()
        .map_err(|e| format!("Failed to execute git add: {}", e))?;

    if !add_output.status.success() {
        let err = String::from_utf8_lossy(&add_output.stderr).trim().to_string();
        return Err(format!("git add failed: {}", err));
    }

    // Inspect staged diff to determine message
    let diff_output = Command::new("git")
        .args(["diff", "--cached", "--name-status"])
        .current_dir(repo_dir)
        .output()
        .map_err(|e| format!("Failed to execute git diff: {}", e))?;

    let diff_str = String::from_utf8_lossy(&diff_output.stdout);
    let changed_lines: Vec<&str> = diff_str.lines().map(|l| l.trim()).filter(|l| !l.is_empty()).collect();

    if changed_lines.is_empty() {
        return Err("Working tree clean (nothing to commit)".to_string());
    }

    let repo_name = repo_dir.file_name().and_then(|n| n.to_str()).unwrap_or("repo");
    let commit_message = generate_conventional_commit_message(repo_name, &changed_lines);

    let commit_output = Command::new("git")
        .args(["commit", "-m", &commit_message])
        .current_dir(repo_dir)
        .output()
        .map_err(|e| format!("Failed to execute git commit: {}", e))?;

    if !commit_output.status.success() {
        let err = String::from_utf8_lossy(&commit_output.stderr).trim().to_string();
        return Err(if err.is_empty() { "git commit failed".to_string() } else { err });
    }

    Ok(commit_message)
}

pub fn generate_conventional_commit_message(repo_name: &str, changed_lines: &[&str]) -> String {
    let files: Vec<&str> = changed_lines.iter().filter_map(|l| {
        let parts: Vec<&str> = l.split_whitespace().collect();
        if parts.len() >= 2 {
            Some(parts[1])
        } else {
            None
        }
    }).collect();

    let all_tests = !files.is_empty() && files.iter().all(|f| {
        f.contains("test") || f.ends_with(".test.ts") || f.ends_with(".test.tsx") || f.ends_with("_test.rs")
    });
    let all_docs = !files.is_empty() && files.iter().all(|f| {
        f.ends_with(".md") || f.starts_with("epics/") || f.starts_with("adr/") || f.starts_with("docs/")
    });
    let has_frontend = files.iter().any(|f| f.contains("frontend") || f.ends_with(".tsx") || f.ends_with(".css"));
    let has_server = files.iter().any(|f| f.contains("crates") || f.ends_with(".rs"));
    let has_skills = files.iter().any(|f| f.contains("skills") || f.ends_with(".mjs"));

    if all_tests {
        format!("test({}): update test suites", repo_name)
    } else if all_docs {
        format!("docs({}): update specifications and plans", repo_name)
    } else if has_frontend && !has_server {
        "feat(ui): update dashboard and frontend components".to_string()
    } else if has_server && !has_frontend {
        "feat(server): update backend services and endpoints".to_string()
    } else if has_skills {
        "feat(skills): update agent workflow skills".to_string()
    } else {
        format!("feat({}): update components and tests", repo_name)
    }
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-006
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-007
pub fn git_clone_repo(workspace_root: &Path, repo_id: &str, url: &str, repo_type: &str) -> Result<PathBuf, String> {
    let target_dir = resolve_clone_target_dir(workspace_root, repo_id, repo_type);
    if target_dir.exists() && target_dir.join(".git").exists() {
        return Err(format!("Repository target directory already exists: {}", target_dir.display()));
    }
    if let Some(parent) = target_dir.parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("Failed to create parent directory: {}", e))?;
    }
    let output = Command::new("git")
        .args(["clone", url, &target_dir.to_string_lossy()])
        .output()
        .map_err(|e| format!("Failed to execute git clone: {}", e))?;

    if !output.status.success() {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        return Err(if err.is_empty() { "git clone failed".to_string() } else { err });
    }
    Ok(target_dir)
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-1::REQ-001
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-005
pub async fn collect_project_git_status(specs_root: &Path) -> Vec<GitRepoStatus> {
    let manifest_file = specs_root.join(".aico-project.json");
    let manifest: Option<ProjectManifest> = if manifest_file.exists() {
        std::fs::read_to_string(&manifest_file)
            .ok()
            .and_then(|c| serde_json::from_str(&c).ok())
    } else {
        None
    };

    let mut entries: Vec<ProjectRepoEntry> = Vec::new();

    if let Some(mut m) = manifest {
        let has_specs = m.repositories.iter().any(|r| r.repo_type == "specs");
        if !has_specs && (m.project_name.is_some() || m.id.is_some() || m.name.is_some()) {
            let proj_slug = m.project_name.clone().or_else(|| m.id.clone()).unwrap_or_else(|| "project".to_string());
            let specs_id = m.id.clone().unwrap_or_else(|| format!("{}-specs", proj_slug));
            let specs_name = m.name.clone().unwrap_or_else(|| "Specs".to_string());
            entries.push(ProjectRepoEntry {
                id: specs_id,
                name: specs_name,
                path: Some(".".to_string()),
                repo_type: "specs".to_string(),
                url: m.url.clone(),
            });
        }
        entries.append(&mut m.repositories);
    } else {
        let dir_name = specs_root.file_name().and_then(|n| n.to_str()).unwrap_or("project-specs");
        entries.push(ProjectRepoEntry {
            id: dir_name.to_string(),
            name: "Specs".to_string(),
            path: Some(".".to_string()),
            repo_type: "specs".to_string(),
            url: None,
        });
    }

    let mut scan_futures = Vec::new();
    for entry in entries {
        let raw_path = entry.resolved_path();
        let target_path = if Path::new(&raw_path).is_absolute() {
            PathBuf::from(&raw_path)
        } else {
            let mut resolved = specs_root.to_path_buf();
            for comp in Path::new(&raw_path).components() {
                match comp {
                    std::path::Component::ParentDir => { resolved.pop(); }
                    std::path::Component::CurDir => {}
                    _ => { resolved.push(comp.as_os_str()); }
                }
            }
            resolved
        };
        let target_path_str = target_path.to_string_lossy().to_string();

        scan_futures.push(async move {
            let is_git_dir = target_path.join(".git").exists();
            if !is_git_dir {
                GitRepoStatus {
                    id: entry.id,
                    name: entry.name,
                    path: target_path_str,
                    repo_type: entry.repo_type,
                    url: entry.url,
                    is_available: false,
                    is_cloned: false,
                    branch: Some("not cloned".to_string()),
                    upstream: None,
                    ahead: 0,
                    behind: 0,
                    staged_count: 0,
                    unstaged_count: 0,
                    untracked_count: 0,
                    is_clean: true,
                    latest_commit: None,
                    error: None,
                }
            } else {
                let mut status = GitStatusScanner::scan_repo(
                    &entry.id,
                    &entry.name,
                    &target_path_str,
                    &entry.repo_type,
                    entry.url.as_deref(),
                ).await;
                status.is_cloned = true;
                status
            }
        });
    }

    futures_util::future::join_all(scan_futures).await
}

pub struct GitStatusScanner;

impl GitStatusScanner {
    pub fn pull_repo(repo_dir: &Path) -> Result<String, String> {
        git_pull_repo(repo_dir)
    }

    pub fn push_repo(repo_dir: &Path) -> Result<String, String> {
        git_push_repo(repo_dir)
    }

    pub fn commit_repo(repo_dir: &Path, message: &str) -> Result<String, String> {
        git_commit_repo(repo_dir, message)
    }

    pub fn ai_commit_repo(repo_dir: &Path) -> Result<String, String> {
        git_ai_commit_repo(repo_dir)
    }

    pub fn clone_repo(workspace_root: &Path, repo_id: &str, url: &str, repo_type: &str) -> Result<PathBuf, String> {
        git_clone_repo(workspace_root, repo_id, url, repo_type)
    }

    pub fn resolve_clone_target(workspace_root: &Path, repo_id: &str, repo_type: &str) -> PathBuf {
        resolve_clone_target_dir(workspace_root, repo_id, repo_type)
    }

    pub fn resolve_clone_target_path(workspace_root: &Path, repo_id: &str, repo_type: &str) -> PathBuf {
        resolve_clone_target_dir(workspace_root, repo_id, repo_type)
    }

    // @implements ft-git-backend-status::TASK-GIT-001-2::REQ-003
    // @implements ft-git-backend-status::TASK-GIT-001-2::REQ-004
    // @implements ft-git-backend-status::TASK-GIT-001-2::REQ-006
    // @implements ft-git-backend-status::TASK-GIT-001-5::REQ-007
    pub async fn scan_repo(id: &str, name: &str, path: &str, repo_type: &str, url: Option<&str>) -> GitRepoStatus {
        let path_obj = Path::new(path);
        let url_owned = url.map(|u| u.to_string());
        let is_cloned = path_obj.join(".git").exists();

        if !path_obj.exists() {
            return GitRepoStatus {
                id: id.to_string(),
                name: name.to_string(),
                path: path.to_string(),
                repo_type: repo_type.to_string(),
                url: url_owned,
                is_available: false,
                is_cloned: false,
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

        let status_output = match TokioCommand::new("git")
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
                        url: url_owned.clone(),
                        is_available: false,
                        is_cloned,
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
                    url: url_owned,
                    is_available: false,
                    is_cloned,
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
        parsed.url = url_owned;
        parsed.is_available = true;
        parsed.is_cloned = is_cloned;

        if let Ok(log_output) = TokioCommand::new("git")
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
    // @implements ft-git-backend-status::TASK-GIT-001-2::REQ-003
    // @implements ft-git-backend-status::TASK-GIT-001-2::REQ-004
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
            url: None,
            is_available: true,
            is_cloned: true,
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
