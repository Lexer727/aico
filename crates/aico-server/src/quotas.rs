use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use crate::server::AppState;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QuotaAccountInfo {
    pub email: String,
    pub tier: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct QuotaProviderStatus {
    pub id: String,
    pub name: String,
    pub cli: String,
    pub connected: bool,
    pub weekly_remaining_pct: u8,
    pub weekly_reset: String,
    pub five_hour_remaining_pct: u8,
    pub five_hour_reset: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct AiQuotasResponse {
    pub ai_state: String,
    pub account: Option<QuotaAccountInfo>,
    pub providers: Vec<QuotaProviderStatus>,
}

#[derive(Debug, Clone)]
enum DiscoveryMode {
    LiveHost,
    CredentialFiles {
        agy_path: PathBuf,
        claude_path: PathBuf,
    },
}

#[derive(Debug)]
struct CachedQuotaResult {
    fetched_at: Instant,
    account: Option<QuotaAccountInfo>,
    providers: Vec<QuotaProviderStatus>,
}

#[derive(Debug)]
pub struct QuotaDiscoveryService {
    mode: DiscoveryMode,
    cache: Mutex<Option<CachedQuotaResult>>,
}

impl Default for QuotaDiscoveryService {
    fn default() -> Self {
        Self {
            mode: DiscoveryMode::LiveHost,
            cache: Mutex::new(None),
        }
    }
}

impl QuotaDiscoveryService {
    // @implements spec-ft-terminal-ai-quota-monitor::REQ-002
    // @implements spec-ft-terminal-ai-quota-monitor::REQ-009
    pub fn with_credential_paths(agy_path: PathBuf, claude_path: PathBuf) -> Self {
        Self {
            mode: DiscoveryMode::CredentialFiles {
                agy_path,
                claude_path,
            },
            cache: Mutex::new(None),
        }
    }

    // @implements spec-ft-terminal-ai-quota-monitor::REQ-001
    // @implements spec-ft-terminal-ai-quota-monitor::REQ-002
    // @implements spec-ft-terminal-ai-quota-monitor::REQ-009
    // @implements spec-ft-terminal-ai-quota-monitor::REQ-011
    pub async fn discover(&self) -> (Option<QuotaAccountInfo>, Vec<QuotaProviderStatus>) {
        match &self.mode {
            DiscoveryMode::CredentialFiles {
                agy_path,
                claude_path,
            } => Self::discover_from_files(agy_path, claude_path),
            DiscoveryMode::LiveHost => {
                if let Ok(guard) = self.cache.lock() {
                    if let Some(cached) = guard.as_ref() {
                        if cached.fetched_at.elapsed() < Duration::from_secs(10) {
                            return (cached.account.clone(), cached.providers.clone());
                        }
                    }
                }

                let (account, providers) = Self::discover_live_host().await;

                if let Ok(mut guard) = self.cache.lock() {
                    *guard = Some(CachedQuotaResult {
                        fetched_at: Instant::now(),
                        account: account.clone(),
                        providers: providers.clone(),
                    });
                }

                (account, providers)
            }
        }
    }

    fn discover_from_files(
        agy_path: &PathBuf,
        claude_path: &PathBuf,
    ) -> (Option<QuotaAccountInfo>, Vec<QuotaProviderStatus>) {
        let mut account: Option<QuotaAccountInfo> = None;
        let mut providers: Vec<QuotaProviderStatus> = Vec::new();

        if let Ok(raw) = std::fs::read_to_string(agy_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                if let Some(email) = val.get("email").and_then(|v| v.as_str()) {
                    if !email.trim().is_empty() {
                        account = Some(QuotaAccountInfo {
                            email: email.to_string(),
                            tier: val
                                .get("tier")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                        });
                    }
                }
                let weekly_pct = val
                    .get("weekly_remaining_pct")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(100)
                    .min(100) as u8;
                let weekly_reset = val
                    .get("weekly_reset")
                    .and_then(|v| v.as_str())
                    .unwrap_or("7d 0h")
                    .to_string();
                let five_hour_pct = val
                    .get("five_hour_remaining_pct")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(weekly_pct as u64)
                    .min(100) as u8;
                let five_hour_reset = val
                    .get("five_hour_reset")
                    .and_then(|v| v.as_str())
                    .unwrap_or("5h 0m")
                    .to_string();

                providers.push(QuotaProviderStatus {
                    id: "gemini".to_string(),
                    name: "Gemini".to_string(),
                    cli: "agy".to_string(),
                    connected: true,
                    weekly_remaining_pct: weekly_pct,
                    weekly_reset,
                    five_hour_remaining_pct: five_hour_pct,
                    five_hour_reset,
                });
            }
        }

        if let Ok(raw) = std::fs::read_to_string(claude_path) {
            if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                let has_token = val
                    .get("claudeAiOauth")
                    .and_then(|o| o.get("accessToken"))
                    .and_then(|t| t.as_str())
                    .map(|s| !s.trim().is_empty())
                    .unwrap_or(false)
                    || val
                        .get("connected")
                        .and_then(|b| b.as_bool())
                        .unwrap_or(false)
                    || val
                        .get("loggedIn")
                        .and_then(|b| b.as_bool())
                        .unwrap_or(false);

                if has_token {
                    let weekly_pct = val
                        .get("weekly_remaining_pct")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(100)
                        .min(100) as u8;
                    let weekly_reset = val
                        .get("weekly_reset")
                        .and_then(|v| v.as_str())
                        .unwrap_or("7d 0h")
                        .to_string();
                    let five_hour_pct = val
                        .get("five_hour_remaining_pct")
                        .and_then(|v| v.as_u64())
                        .unwrap_or(100)
                        .min(100) as u8;
                    let five_hour_reset = val
                        .get("five_hour_reset")
                        .and_then(|v| v.as_str())
                        .unwrap_or("5h 0m")
                        .to_string();

                    providers.push(QuotaProviderStatus {
                        id: "claude".to_string(),
                        name: "Claude".to_string(),
                        cli: "claude".to_string(),
                        connected: true,
                        weekly_remaining_pct: weekly_pct,
                        weekly_reset,
                        five_hour_remaining_pct: five_hour_pct,
                        five_hour_reset,
                    });
                }
            }
        }

        providers.retain(|p| p.connected);
        (account, providers)
    }

    async fn discover_live_host() -> (Option<QuotaAccountInfo>, Vec<QuotaProviderStatus>) {
        let mut account: Option<QuotaAccountInfo> = None;
        let mut providers: Vec<QuotaProviderStatus> = Vec::new();

        // 1. Try querying running Antigravity language_server on localhost for Gemini (agy) quotas
        if let Some((csrf_token, ports)) = Self::probe_language_server_process().await {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_millis(1200))
                .build()
                .unwrap_or_default();

            let body = r#"{"metadata":{"ideName":"antigravity","extensionName":"antigravity","locale":"en"}}"#;

            for port in ports {
                let summary_url = format!(
                    "http://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary",
                    port
                );
                let status_url = format!(
                    "http://127.0.0.1:{}/exa.language_server_pb.LanguageServerService/GetUserStatus",
                    port
                );

                let summary_res = client
                    .post(&summary_url)
                    .header("Content-Type", "application/json")
                    .header("Connect-Protocol-Version", "1")
                    .header("x-codeium-csrf-token", &csrf_token)
                    .body(body)
                    .send()
                    .await;

                let mut gemini_from_port: Option<QuotaProviderStatus> = None;
                if let Ok(resp) = summary_res {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            gemini_from_port = parse_language_server_quota_summary(&json);
                        }
                    }
                }

                let status_res = client
                    .post(&status_url)
                    .header("Content-Type", "application/json")
                    .header("Connect-Protocol-Version", "1")
                    .header("x-codeium-csrf-token", &csrf_token)
                    .body(body)
                    .send()
                    .await;

                if let Ok(resp) = status_res {
                    if resp.status().is_success() {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            let (parsed_account, fallback_providers) =
                                parse_language_server_user_status(&json);
                            if parsed_account.is_some() {
                                account = parsed_account;
                            }
                            if gemini_from_port.is_none() {
                                gemini_from_port = fallback_providers
                                    .into_iter()
                                    .find(|p| p.id == "gemini" && p.connected);
                            }
                        }
                    }
                }

                if let Some(gemini) = gemini_from_port {
                    providers.push(gemini);
                    break;
                }
            }
        }

        // 2. Fallback for agy if language_server is not running but agy CLI is installed
        if !providers.iter().any(|p| p.id == "gemini") && Self::is_agy_installed() {
            providers.push(QuotaProviderStatus {
                id: "gemini".to_string(),
                name: "Gemini".to_string(),
                cli: "agy".to_string(),
                connected: true,
                weekly_remaining_pct: 100,
                weekly_reset: "7d 0h".to_string(),
                five_hour_remaining_pct: 100,
                five_hour_reset: "5h 0m".to_string(),
            });
        }

        // 3. Independently check standalone Claude Code CLI login & quotas (REQ-005, REQ-006)
        if let Some(claude) = Self::discover_claude_live().await {
            providers.push(claude);
        }

        providers.retain(|p| p.connected);
        (account, providers)
    }

    async fn probe_language_server_process() -> Option<(String, Vec<u16>)> {
        #[cfg(target_os = "windows")]
        {
            let output = tokio::process::Command::new("powershell.exe")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-Command",
                    "$procs = Get-CimInstance Win32_Process -Filter \"Name LIKE 'language_server%'\"; foreach ($p in $procs) { if ($p.CommandLine -match '--csrf_token\\s+([^\\s]+)') { $t = $Matches[1]; $ports = Get-NetTCPConnection -OwningProcess $p.ProcessId -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty LocalPort; if ($ports) { Write-Output \"$t|$($ports -join ',')\"; break } } }",
                ])
                .output()
                .await
                .ok()?;

            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let (token, ports_str) = stdout.split_once('|')?;
            let ports: Vec<u16> = ports_str
                .split(',')
                .filter_map(|s| s.trim().parse::<u16>().ok())
                .collect();
            if !token.is_empty() && !ports.is_empty() {
                return Some((token.to_string(), ports));
            }
            None
        }
        #[cfg(not(target_os = "windows"))]
        {
            None
        }
    }

    fn is_agy_installed() -> bool {
        if let Ok(local_app_data) = std::env::var("LOCALAPPDATA") {
            let candidate = PathBuf::from(local_app_data)
                .join("agy")
                .join("bin")
                .join("agy.exe");
            if candidate.exists() {
                return true;
            }
        }
        false
    }

    // @implements spec-ft-terminal-ai-quota-monitor::REQ-005
    // @implements spec-ft-terminal-ai-quota-monitor::REQ-006
    async fn discover_claude_live() -> Option<QuotaProviderStatus> {
        let home = std::env::var("USERPROFILE")
            .or_else(|_| std::env::var("HOME"))
            .ok();

        let mut oauth_token: Option<String> = None;
        let mut cred_status: Option<QuotaProviderStatus> = None;

        if let Some(ref home_dir) = home {
            let cred_path = PathBuf::from(home_dir)
                .join(".claude")
                .join(".credentials.json");
            if let Ok(raw) = std::fs::read_to_string(&cred_path) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&raw) {
                    oauth_token = val
                        .get("claudeAiOauth")
                        .and_then(|o| o.get("accessToken"))
                        .and_then(|t| t.as_str())
                        .map(|s| s.trim().to_string())
                        .filter(|s| !s.is_empty());

                    if oauth_token.is_some() {
                        cred_status = Some(QuotaProviderStatus {
                            id: "claude".to_string(),
                            name: "Claude".to_string(),
                            cli: "claude".to_string(),
                            connected: true,
                            weekly_remaining_pct: 100,
                            weekly_reset: "7d 0h".to_string(),
                            five_hour_remaining_pct: 100,
                            five_hour_reset: "5h 0m".to_string(),
                        });
                    }
                }
            }
        }

        // If no OAuth token in ~/.claude/.credentials.json, check `claude auth status --json`
        let mut cli_logged_in = oauth_token.is_some();
        if !cli_logged_in {
            if let Some(claude_bin) = Self::resolve_claude_binary() {
                if let Ok(output) = tokio::process::Command::new(claude_bin)
                    .args(["auth", "status", "--json"])
                    .output()
                    .await
                {
                    let stdout = String::from_utf8_lossy(&output.stdout);
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&stdout) {
                        cli_logged_in = val
                            .get("loggedIn")
                            .and_then(|b| b.as_bool())
                            .unwrap_or(false);
                    }
                }
            }
        }

        if !cli_logged_in {
            return None;
        }

        // If we have an OAuth access token, query Anthropic OAuth usage endpoint for live 7d & 5h percentages
        if let Some(token) = oauth_token {
            let client = reqwest::Client::builder()
                .timeout(Duration::from_millis(1200))
                .build()
                .unwrap_or_default();
            if let Ok(resp) = client
                .get("https://api.anthropic.com/api/oauth/usage")
                .header("Authorization", format!("Bearer {}", token))
                .header("anthropic-beta", "oauth-2025-04-20")
                .send()
                .await
            {
                if resp.status().is_success() {
                    if let Ok(json) = resp.json::<serde_json::Value>().await {
                        if let Some(parsed) = parse_claude_oauth_usage(&json) {
                            return Some(parsed);
                        }
                    }
                }
            }
        }

        cred_status.or_else(|| {
            Some(QuotaProviderStatus {
                id: "claude".to_string(),
                name: "Claude".to_string(),
                cli: "claude".to_string(),
                connected: true,
                weekly_remaining_pct: 100,
                weekly_reset: "7d 0h".to_string(),
                five_hour_remaining_pct: 100,
                five_hour_reset: "5h 0m".to_string(),
            })
        })
    }

    fn resolve_claude_binary() -> Option<PathBuf> {
        if let Ok(user_profile) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
            let native_win = PathBuf::from(&user_profile)
                .join(".local")
                .join("bin")
                .join("claude.exe");
            if native_win.exists() {
                return Some(native_win);
            }
            let native_unix = PathBuf::from(&user_profile)
                .join(".local")
                .join("bin")
                .join("claude");
            if native_unix.exists() {
                return Some(native_unix);
            }
        }
        None
    }
}

// @implements spec-ft-terminal-ai-quota-monitor::REQ-005
pub fn parse_claude_oauth_usage(json: &serde_json::Value) -> Option<QuotaProviderStatus> {
    let parse_window = |key: &str, default_reset: &str| -> (u8, String) {
        if let Some(w) = json.get(key) {
            let utilization = w
                .get("utilization")
                .and_then(|u| u.as_f64())
                .unwrap_or(0.0);
            let remaining = (100.0 - utilization).round().clamp(0.0, 100.0) as u8;
            let reset_str = w
                .get("resets_at")
                .and_then(|r| r.as_str())
                .and_then(seconds_until_rfc3339)
                .map(format_reset_countdown)
                .unwrap_or_else(|| default_reset.to_string());
            (remaining, reset_str)
        } else {
            (100, default_reset.to_string())
        }
    };

    if json.get("seven_day").is_none() && json.get("five_hour").is_none() {
        return None;
    }

    let (weekly_pct, weekly_reset) = parse_window("seven_day", "7d 0h");
    let (five_hour_pct, five_hour_reset) = parse_window("five_hour", "5h 0m");

    Some(QuotaProviderStatus {
        id: "claude".to_string(),
        name: "Claude".to_string(),
        cli: "claude".to_string(),
        connected: true,
        weekly_remaining_pct: weekly_pct,
        weekly_reset,
        five_hour_remaining_pct: five_hour_pct,
        five_hour_reset,
    })
}

// @implements spec-ft-terminal-ai-quota-monitor::REQ-004
pub fn parse_language_server_quota_summary(
    json: &serde_json::Value,
) -> Option<QuotaProviderStatus> {
    let groups = json
        .get("response")
        .and_then(|r| r.get("groups"))
        .or_else(|| json.get("groups"))
        .and_then(|g| g.as_array())?;

    let gemini_group = groups.iter().find(|g| {
        let is_gemini_title = g
            .get("displayName")
            .and_then(|d| d.as_str())
            .map(|s| s.to_lowercase().contains("gemini"))
            .unwrap_or(false);
        let has_gemini_bucket = g
            .get("buckets")
            .and_then(|b| b.as_array())
            .map(|arr| {
                arr.iter().any(|b| {
                    b.get("bucketId")
                        .and_then(|id| id.as_str())
                        .map(|id| id.starts_with("gemini-"))
                        .unwrap_or(false)
                })
            })
            .unwrap_or(false);
        is_gemini_title || has_gemini_bucket
    })?;

    let buckets = gemini_group.get("buckets")?.as_array()?;

    let extract_bucket = |target_bucket_id: &str, target_window: &str, default_reset: &str| -> (u8, String) {
        let bucket = buckets.iter().find(|b| {
            let id_match = b
                .get("bucketId")
                .and_then(|v| v.as_str())
                .map(|id| id == target_bucket_id)
                .unwrap_or(false);
            let window_match = b
                .get("window")
                .and_then(|v| v.as_str())
                .map(|w| w == target_window)
                .unwrap_or(false);
            id_match || window_match
        });

        if let Some(b) = bucket {
            let remaining_fraction = b
                .get("remainingFraction")
                .and_then(|f| f.as_f64())
                .unwrap_or(1.0);
            let pct = (remaining_fraction * 100.0).round().clamp(0.0, 100.0) as u8;
            let reset_str = b
                .get("resetTime")
                .and_then(|r| r.as_str())
                .and_then(seconds_until_rfc3339)
                .map(format_reset_countdown)
                .unwrap_or_else(|| default_reset.to_string());
            (pct, reset_str)
        } else {
            (100, default_reset.to_string())
        }
    };

    let (weekly_pct, weekly_reset) = extract_bucket("gemini-weekly", "weekly", "7d 0h");
    let (five_hour_pct, five_hour_reset) = extract_bucket("gemini-5h", "5h", "5h 0m");

    Some(QuotaProviderStatus {
        id: "gemini".to_string(),
        name: "Gemini".to_string(),
        cli: "agy".to_string(),
        connected: true,
        weekly_remaining_pct: weekly_pct,
        weekly_reset,
        five_hour_remaining_pct: five_hour_pct,
        five_hour_reset,
    })
}

// @implements spec-ft-terminal-ai-quota-monitor::REQ-004
// @implements spec-ft-terminal-ai-quota-monitor::REQ-011
pub fn parse_language_server_user_status(
    json: &serde_json::Value,
) -> (Option<QuotaAccountInfo>, Vec<QuotaProviderStatus>) {
    let user_status = match json.get("userStatus") {
        Some(us) => us,
        None => return (None, Vec::new()),
    };

    let account = user_status
        .get("email")
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(|email| QuotaAccountInfo {
            email: email.to_string(),
            tier: user_status
                .get("userTier")
                .and_then(|t| t.get("name"))
                .and_then(|n| n.as_str())
                .map(|s| s.to_string()),
        });

    let mut providers = Vec::new();

    if let Some(configs) = user_status
        .get("cascadeModelConfigData")
        .and_then(|c| c.get("clientModelConfigs"))
        .and_then(|arr| arr.as_array())
    {
        // Only extract Gemini quota info from agy (ignore 3p/Claude/GPT models)
        let gemini_models: Vec<&serde_json::Value> = configs
            .iter()
            .filter(|m| {
                m.get("modelId")
                    .and_then(|id| id.as_str())
                    .map(|id| id.starts_with("gemini-"))
                    .unwrap_or(false)
            })
            .collect();

        if !gemini_models.is_empty() {
            let first = gemini_models[0];
            let quota_info = first.get("quotaInfo");
            let remaining_fraction = quota_info
                .and_then(|q| q.get("remainingFraction"))
                .and_then(|f| f.as_f64())
                .unwrap_or(1.0);
            let pct = (remaining_fraction * 100.0).round().clamp(0.0, 100.0) as u8;
            let reset_str = quota_info
                .and_then(|q| q.get("resetTime"))
                .and_then(|r| r.as_str())
                .and_then(seconds_until_rfc3339)
                .map(format_reset_countdown)
                .unwrap_or_else(|| "7d 0h".to_string());

            providers.push(QuotaProviderStatus {
                id: "gemini".to_string(),
                name: "Gemini".to_string(),
                cli: "agy".to_string(),
                connected: true,
                weekly_remaining_pct: pct,
                weekly_reset: reset_str.clone(),
                five_hour_remaining_pct: pct,
                five_hour_reset: reset_str,
            });
        }
    }

    (account, providers)
}

pub fn format_reset_countdown(secs: u64) -> String {
    if secs >= 86400 {
        let days = secs / 86400;
        let hours = (secs % 86400) / 3600;
        format!("{}d {}h", days, hours)
    } else if secs >= 3600 {
        let hours = secs / 3600;
        let mins = (secs % 3600) / 60;
        format!("{}h {}m", hours, mins)
    } else {
        let mins = (secs / 60).max(1);
        format!("{}m", mins)
    }
}

fn seconds_until_rfc3339(ts: &str) -> Option<u64> {
    // Parse "YYYY-MM-DDTHH:MM:SSZ" or "YYYY-MM-DDTHH:MM:SS.sssZ"
    let ts = ts.trim().strip_suffix('Z')?;
    let (date_part, time_part) = ts.split_once('T')?;
    let mut date_iter = date_part.splitn(3, '-');
    let year: i64 = date_iter.next()?.parse().ok()?;
    let month: i64 = date_iter.next()?.parse().ok()?;
    let day: i64 = date_iter.next()?.parse().ok()?;

    let time_clean = time_part.split('.').next()?;
    let mut time_iter = time_clean.splitn(3, ':');
    let hour: i64 = time_iter.next()?.parse().ok()?;
    let min: i64 = time_iter.next()?.parse().ok()?;
    let sec: i64 = time_iter.next()?.parse().ok()?;

    let days = days_from_civil(year, month, day);
    let target_unix = days * 86400 + hour * 3600 + min * 60 + sec;
    if target_unix <= 0 {
        return Some(0);
    }

    let now_unix = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64;

    Some((target_unix - now_unix).max(0) as u64)
}

fn days_from_civil(y: i64, m: i64, d: i64) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let doy = (153 * (if m > 2 { m - 3 } else { m + 9 }) + 2) / 5 + d - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146097 + doe - 719468
}

// @implements spec-ft-terminal-ai-quota-monitor::REQ-001
// @implements spec-ft-terminal-ai-quota-monitor::REQ-006
// @implements spec-ft-terminal-ai-quota-monitor::REQ-007
// @implements spec-ft-terminal-ai-quota-monitor::REQ-008
pub async fn get_ai_quotas_handler(State(state): State<AppState>) -> Json<AiQuotasResponse> {
    let sessions = state.terminal_sessions.list();
    let ai_sessions: Vec<_> = sessions.into_iter().filter(|s| s.is_ai).collect();

    let ai_state = if ai_sessions.is_empty() {
        "inactive".to_string()
    } else if ai_sessions.iter().any(|s| s.state == "working") {
        "working".to_string()
    } else {
        "waiting_for_input".to_string()
    };

    let (account, providers) = state.quota_service.discover().await;

    Json(AiQuotasResponse {
        ai_state,
        account,
        providers,
    })
}
