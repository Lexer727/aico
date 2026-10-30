use serde::{Deserialize, Serialize};
use std::path::PathBuf;

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-1::REQ-004
#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
pub struct GitHubConfig {
    #[serde(default)]
    pub github_token: Option<String>,
    #[serde(default)]
    pub github_username: Option<String>,
}

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-1::REQ-004
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TokenSource {
    Environment,
    GhCli,
    ConfigFile,
    None,
}

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-1::REQ-004
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ResolvedGitHubToken {
    pub token: String,
    pub source: TokenSource,
}

// @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-1::REQ-002
pub fn find_gh_binary() -> Option<PathBuf> {
    // 1. Check if "where gh" (Windows) or "which gh" (Unix) resolves it
    #[cfg(windows)]
    let lookup_cmd = "where.exe";
    #[cfg(not(windows))]
    let lookup_cmd = "which";

    if let Ok(output) = std::process::Command::new(lookup_cmd).arg("gh").output() {
        if output.status.success() {
            let out_str = String::from_utf8_lossy(&output.stdout);
            for line in out_str.lines() {
                let candidate = PathBuf::from(line.trim());
                if candidate.is_file() {
                    return Some(candidate);
                }
            }
        }
    }

    // 2. Standard Windows installation locations
    #[cfg(windows)]
    {
        let standard_paths = [
            r"C:\Program Files\GitHub CLI\gh.exe",
            r"C:\Program Files (x86)\GitHub CLI\gh.exe",
        ];
        for path_str in &standard_paths {
            let p = PathBuf::from(path_str);
            if p.is_file() {
                return Some(p);
            }
        }

        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let p = PathBuf::from(local_app_data)
                .join("Programs")
                .join("GitHub CLI")
                .join("gh.exe");
            if p.is_file() {
                return Some(p);
            }
        }
    }

    // 3. Fallback check: attempt direct execution of "gh"
    if let Ok(output) = std::process::Command::new("gh").arg("--version").output() {
        if output.status.success() {
            return Some(PathBuf::from("gh"));
        }
    }

    None
}

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-1::REQ-004
pub struct GitHubCredentialManager;

impl GitHubCredentialManager {
    pub fn get_config_path() -> PathBuf {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .unwrap_or_else(|_| ".".to_string());
        PathBuf::from(home).join(".aico").join("config.json")
    }

    pub fn load_config() -> GitHubConfig {
        let path = Self::get_config_path();
        if path.is_file() {
            if let Ok(content) = std::fs::read_to_string(&path) {
                if let Ok(cfg) = serde_json::from_str::<GitHubConfig>(&content) {
                    return cfg;
                }
            }
        }
        GitHubConfig::default()
    }

    pub fn save_token(token: &str, username: Option<&str>) -> std::io::Result<()> {
        let path = Self::get_config_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let mut cfg = Self::load_config();
        cfg.github_token = Some(token.trim().to_string());
        if let Some(u) = username {
            cfg.github_username = Some(u.trim().to_string());
        }
        let content = serde_json::to_string_pretty(&cfg)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
        std::fs::write(&path, content)
    }

    pub fn delete_token() -> std::io::Result<()> {
        let path = Self::get_config_path();
        if path.is_file() {
            let mut cfg = Self::load_config();
            cfg.github_token = None;
            cfg.github_username = None;
            let content = serde_json::to_string_pretty(&cfg)
                .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))?;
            std::fs::write(&path, content)?;
        }
        Ok(())
    }

    pub fn resolve_token() -> Option<ResolvedGitHubToken> {
        // 1. Environment variable override
        if let Ok(tok) = std::env::var("GITHUB_TOKEN").or_else(|_| std::env::var("GH_TOKEN")) {
            let trimmed = tok.trim();
            if !trimmed.is_empty() {
                return Some(ResolvedGitHubToken {
                    token: trimmed.to_string(),
                    source: TokenSource::Environment,
                });
            }
        }

        // 2. gh auth token
        // @implements spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-1::REQ-002
        if let Some(gh_path) = find_gh_binary() {
            if let Ok(output) = std::process::Command::new(gh_path).arg("auth").arg("token").output() {
                if output.status.success() {
                    let token_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                    if !token_str.is_empty() {
                        return Some(ResolvedGitHubToken {
                            token: token_str,
                            source: TokenSource::GhCli,
                        });
                    }
                }
            }
        }

        // 3. User config file (~/.aico/config.json)
        let cfg = Self::load_config();
        if let Some(tok) = cfg.github_token {
            let trimmed = tok.trim();
            if !trimmed.is_empty() {
                return Some(ResolvedGitHubToken {
                    token: trimmed.to_string(),
                    source: TokenSource::ConfigFile,
                });
            }
        }

        None
    }
}
