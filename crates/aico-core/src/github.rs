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
        if let Ok(output) = std::process::Command::new("gh").arg("auth").arg("token").output() {
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
