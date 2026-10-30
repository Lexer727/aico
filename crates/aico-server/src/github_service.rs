use aico_core::github::{GitHubCredentialManager, TokenSource};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};
use serde::{Deserialize, Serialize};

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-1::REQ-004
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitHubStatusResponse {
    pub authenticated: bool,
    pub username: Option<String>,
    pub source: String,
    #[serde(default)]
    pub scopes: Vec<String>,
    #[serde(default)]
    pub error: Option<String>,
}

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-2::REQ-008
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckRepoRequest {
    pub url: String,
}

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-2::REQ-008
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CheckRepoResponse {
    pub exists: bool,
    #[serde(default)]
    pub is_specs: bool,
    #[serde(default)]
    pub is_empty: bool,
    #[serde(default)]
    pub manifest: Option<serde_json::Value>,
    #[serde(default)]
    pub owner: Option<String>,
    #[serde(default)]
    pub repo: Option<String>,
    #[serde(default)]
    pub error: Option<String>,
}

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-2::REQ-009
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRepoRequest {
    pub name: String,
    #[serde(default = "default_true")]
    pub private: bool,
    #[serde(default)]
    pub description: Option<String>,
}

fn default_true() -> bool {
    true
}

// @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-2::REQ-009
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateRepoResponse {
    pub status: String,
    pub clone_url: String,
    pub html_url: String,
    pub name: String,
}

pub struct GitHubService;

impl GitHubService {
    fn create_client(token: Option<&str>) -> reqwest::Client {
        let mut headers = HeaderMap::new();
        headers.insert(USER_AGENT, HeaderValue::from_static("aico"));
        headers.insert(
            reqwest::header::ACCEPT,
            HeaderValue::from_static("application/vnd.github+json"),
        );
        if let Some(tok) = token {
            let auth_val = format!("Bearer {}", tok.trim());
            if let Ok(hv) = HeaderValue::from_str(&auth_val) {
                headers.insert(AUTHORIZATION, hv);
            }
        }
        reqwest::Client::builder()
            .default_headers(headers)
            .build()
            .unwrap_or_else(|_| reqwest::Client::new())
    }

    // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-1::REQ-004
    pub async fn get_status() -> GitHubStatusResponse {
        let resolved = GitHubCredentialManager::resolve_token();
        let Some(tok) = resolved else {
            return GitHubStatusResponse {
                authenticated: false,
                username: None,
                source: "none".to_string(),
                scopes: Vec::new(),
                error: None,
            };
        };

        let client = Self::create_client(Some(&tok.token));
        let res = match client.get("https://api.github.com/user").send().await {
            Ok(r) => r,
            Err(e) => {
                return GitHubStatusResponse {
                    authenticated: false,
                    username: None,
                    source: format!("{:?}", tok.source).to_lowercase(),
                    scopes: Vec::new(),
                    error: Some(format!("Failed to connect to GitHub: {}", e)),
                };
            }
        };

        if !res.status().is_success() {
            return GitHubStatusResponse {
                authenticated: false,
                username: None,
                source: format!("{:?}", tok.source).to_lowercase(),
                scopes: Vec::new(),
                error: Some(format!("GitHub authentication failed (HTTP {})", res.status())),
            };
        }

        let scopes_header = res
            .headers()
            .get("x-oauth-scopes")
            .and_then(|v| v.to_str().ok())
            .unwrap_or_default();
        let scopes: Vec<String> = scopes_header
            .split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect();

        let user_json: serde_json::Value = res.json().await.unwrap_or_default();
        let username = user_json
            .get("login")
            .and_then(|v| v.as_str())
            .map(String::from);

        if tok.source == TokenSource::ConfigFile && username.is_some() {
            let _ = GitHubCredentialManager::save_token(&tok.token, username.as_deref());
        }

        GitHubStatusResponse {
            authenticated: true,
            username,
            source: format!("{:?}", tok.source).to_lowercase(),
            scopes,
            error: None,
        }
    }

    // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-1::REQ-004
    pub async fn verify_and_save_token(token: &str) -> Result<String, String> {
        let clean_token = token.trim();
        if clean_token.is_empty() {
            return Err("Token cannot be empty".to_string());
        }

        let client = Self::create_client(Some(clean_token));
        let res = client
            .get("https://api.github.com/user")
            .send()
            .await
            .map_err(|e| format!("Failed to reach GitHub: {}", e))?;

        if !res.status().is_success() {
            return Err(format!("Invalid GitHub token (HTTP {})", res.status()));
        }

        let user_json: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse GitHub profile: {}", e))?;
        let username = user_json
            .get("login")
            .and_then(|v| v.as_str())
            .ok_or_else(|| "Could not retrieve GitHub username".to_string())?;

        GitHubCredentialManager::save_token(clean_token, Some(username))
            .map_err(|e| format!("Failed to persist token: {}", e))?;

        Ok(username.to_string())
    }

    /// Extract (owner, repo) from GitHub URL
    pub fn parse_github_owner_repo(url: &str) -> Option<(String, String)> {
        let trimmed = url.trim();
        let stripped = trimmed
            .strip_suffix(".git")
            .unwrap_or(trimmed)
            .trim_end_matches('/');

        // 1. SSH format: git@github.com:owner/repo
        if let Some(ssh_part) = stripped.strip_prefix("git@github.com:") {
            let parts: Vec<&str> = ssh_part.split('/').collect();
            if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() {
                return Some((parts[0].to_string(), parts[1].to_string()));
            }
        }

        // 2. HTTP/HTTPS format: https://github.com/owner/repo
        if let Some(idx) = stripped.find("github.com/") {
            let path_part = &stripped[idx + 11..];
            let parts: Vec<&str> = path_part.split('/').collect();
            if parts.len() >= 2 && !parts[0].is_empty() && !parts[1].is_empty() {
                return Some((parts[0].to_string(), parts[1].to_string()));
            }
        }

        // 3. Shorthand format: owner/repo
        let parts: Vec<&str> = stripped.split('/').collect();
        if parts.len() == 2 && !parts[0].is_empty() && !parts[1].is_empty() && !parts[0].contains(':') {
            return Some((parts[0].to_string(), parts[1].to_string()));
        }

        None
    }

    // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-2::REQ-008
    pub async fn check_repository(url: &str) -> CheckRepoResponse {
        let Some((owner, repo)) = Self::parse_github_owner_repo(url) else {
            return CheckRepoResponse {
                exists: false,
                is_specs: false,
                is_empty: false,
                manifest: None,
                owner: None,
                repo: None,
                error: Some("Invalid GitHub repository URL".to_string()),
            };
        };

        let resolved = GitHubCredentialManager::resolve_token();
        let client = Self::create_client(resolved.as_ref().map(|t| t.token.as_str()));

        let repo_url = format!("https://api.github.com/repos/{}/{}", owner, repo);
        let res = match client.get(&repo_url).send().await {
            Ok(r) => r,
            Err(e) => {
                return CheckRepoResponse {
                    exists: false,
                    is_specs: false,
                    is_empty: false,
                    manifest: None,
                    owner: Some(owner),
                    repo: Some(repo),
                    error: Some(format!("Network error checking GitHub: {}", e)),
                };
            }
        };

        if res.status() == reqwest::StatusCode::NOT_FOUND {
            return CheckRepoResponse {
                exists: false,
                is_specs: false,
                is_empty: false,
                manifest: None,
                owner: Some(owner),
                repo: Some(repo),
                error: None,
            };
        }

        if !res.status().is_success() {
            return CheckRepoResponse {
                exists: false,
                is_specs: false,
                is_empty: false,
                manifest: None,
                owner: Some(owner),
                repo: Some(repo),
                error: Some(format!("GitHub error (HTTP {})", res.status())),
            };
        }

        let repo_info: serde_json::Value = res.json().await.unwrap_or_default();
        let size = repo_info.get("size").and_then(|s| s.as_u64()).unwrap_or(0);
        let is_empty = size == 0;

        if is_empty {
            return CheckRepoResponse {
                exists: true,
                is_specs: false,
                is_empty: true,
                manifest: None,
                owner: Some(owner),
                repo: Some(repo),
                error: None,
            };
        }

        // Check for .aico-project.json manifest in repository contents
        let manifest_url = format!(
            "https://api.github.com/repos/{}/{}/contents/.aico-project.json",
            owner, repo
        );
        let manifest_res = client.get(&manifest_url).send().await;

        if let Ok(mres) = manifest_res {
            if mres.status().is_success() {
                if let Ok(content_json) = mres.json::<serde_json::Value>().await {
                    let decoded_manifest = if let Some(download_url) = content_json.get("download_url").and_then(|u| u.as_str()) {
                        match client.get(download_url).send().await {
                            Ok(dr) if dr.status().is_success() => dr.json::<serde_json::Value>().await.ok(),
                            _ => None,
                        }
                    } else if let Some(content_base64) = content_json.get("content").and_then(|c| c.as_str()) {
                        let clean_b64 = content_base64.replace('\n', "").replace('\r', "");
                        if let Ok(bytes) = base64_decode(&clean_b64) {
                            serde_json::from_slice(&bytes).ok()
                        } else {
                            None
                        }
                    } else {
                        None
                    };

                    if let Some(manifest) = decoded_manifest {
                        return CheckRepoResponse {
                            exists: true,
                            is_specs: true,
                            is_empty: false,
                            manifest: Some(manifest),
                            owner: Some(owner),
                            repo: Some(repo),
                            error: None,
                        };
                    }
                }
            }
        }

        CheckRepoResponse {
            exists: true,
            is_specs: false,
            is_empty: false,
            manifest: None,
            owner: Some(owner),
            repo: Some(repo),
            error: None,
        }
    }

    // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-2::REQ-009
    pub async fn create_repository(
        name: &str,
        private: bool,
        description: Option<&str>,
    ) -> Result<CreateRepoResponse, String> {
        let resolved = GitHubCredentialManager::resolve_token()
            .ok_or_else(|| "GitHub token is required to create a repository on GitHub. Please configure your token in Settings.".to_string())?;

        let client = Self::create_client(Some(&resolved.token));
        let mut body = serde_json::json!({
            "name": name,
            "private": private,
            "auto_init": false,
        });
        if let Some(desc) = description {
            body["description"] = serde_json::Value::String(desc.to_string());
        }

        let res = client
            .post("https://api.github.com/user/repos")
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("Failed to call GitHub create repo API: {}", e))?;

        if !res.status().is_success() {
            let err_body = res.text().await.unwrap_or_default();
            return Err(format!("GitHub create repo failed: {}", err_body));
        }

        let created: serde_json::Value = res
            .json()
            .await
            .map_err(|e| format!("Failed to parse GitHub response: {}", e))?;

        let clone_url = created
            .get("clone_url")
            .and_then(|s| s.as_str())
            .unwrap_or_default()
            .to_string();
        let html_url = created
            .get("html_url")
            .and_then(|s| s.as_str())
            .unwrap_or_default()
            .to_string();

        Ok(CreateRepoResponse {
            status: "ok".to_string(),
            clone_url,
            html_url,
            name: name.to_string(),
        })
    }
}

fn base64_decode(input: &str) -> Result<Vec<u8>, ()> {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let mut out = Vec::new();
    let mut buf: u32 = 0;
    let mut bits = 0;

    for &byte in input.as_bytes() {
        if byte == b'=' {
            break;
        }
        let val = TABLE.iter().position(|&c| c == byte).ok_or(())? as u32;
        buf = (buf << 6) | val;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            out.push((buf >> bits) as u8);
            buf &= (1 << bits) - 1;
        }
    }
    Ok(out)
}
