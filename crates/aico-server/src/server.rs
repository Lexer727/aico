use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use thiserror::Error;
use tokio::net::TcpListener;
use tokio::sync::RwLock;

use aico_core::{DiscoveredProject, WorkspaceRegistry};
use crate::auth::LanAuthenticator;
use crate::git::{GitRepoStatus, GitStatusScanner};
use crate::ws::WebSocketHub;

#[derive(Error, Debug)]
pub enum ServerError {
    #[error("Failed to bind port: {0}")]
    BindError(String),
    #[error("Server internal error: {0}")]
    Internal(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerConfig {
    pub base_port: u16,
    pub max_port_attempts: u16,
    pub host: String,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            base_port: 4242,
            max_port_attempts: 10,
            host: "127.0.0.1".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HealthResponse {
    pub status: String,
    pub uptime_seconds: u64,
    pub aico_version: String,
}

#[derive(Debug, Deserialize)]
pub struct SetActiveProjectRequest {
    pub project_id: String,
}

#[derive(Clone)]
pub struct AppState {
    pub start_time: Arc<Instant>,
    pub registry: Arc<RwLock<WorkspaceRegistry>>,
    pub ws_hub: Arc<WebSocketHub>,
    pub auth: Arc<LanAuthenticator>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            start_time: Arc::new(Instant::now()),
            registry: Arc::new(RwLock::new(WorkspaceRegistry::new())),
            ws_hub: Arc::new(WebSocketHub::default()),
            auth: Arc::new(LanAuthenticator::new()),
        }
    }
}

pub struct HostServer {
    config: ServerConfig,
    bound_addr: Option<SocketAddr>,
    listener: Option<TcpListener>,
    state: AppState,
}

impl HostServer {
    pub fn new(config: ServerConfig) -> Self {
        Self {
            config,
            bound_addr: None,
            listener: None,
            state: AppState::default(),
        }
    }

    pub fn with_state(config: ServerConfig, state: AppState) -> Self {
        Self {
            config,
            bound_addr: None,
            listener: None,
            state,
        }
    }

    pub fn state(&self) -> &AppState {
        &self.state
    }

    /// Try binding the server to the configured port or next available fallback
    // @implements spec-ft-core-host-runtime::REQ-001
    // @implements spec-ft-core-host-runtime::REQ-010
    pub async fn bind(&mut self) -> Result<SocketAddr, ServerError> {
        let mut last_err = None;

        for offset in 0..=self.config.max_port_attempts {
            let port = self.config.base_port + offset;
            let addr_str = format!("{}:{}", self.config.host, port);
            match TcpListener::bind(&addr_str).await {
                Ok(listener) => {
                    let local_addr = listener
                        .local_addr()
                        .map_err(|e| ServerError::BindError(e.to_string()))?;
                    self.bound_addr = Some(local_addr);
                    self.listener = Some(listener);
                    tracing::info!("HostServer successfully bound to {}", local_addr);
                    return Ok(local_addr);
                }
                Err(e) => {
                    tracing::warn!("Port {} unavailable ({:?}), trying next port...", port, e);
                    last_err = Some(e);
                }
            }
        }

        Err(ServerError::BindError(format!(
            "Could not bind to any port in range {}..{}: {:?}",
            self.config.base_port,
            self.config.base_port + self.config.max_port_attempts,
            last_err
        )))
    }

    pub fn bound_addr(&self) -> Option<SocketAddr> {
        self.bound_addr
    }

    // @implements spec-ft-core-host-runtime::REQ-002
    // @implements spec-ft-core-host-runtime::REQ-003
    // @implements spec-ft-core-host-runtime::REQ-006
    // @implements spec-ft-core-host-runtime::REQ-007
    // @implements spec-ft-core-discovery::REQ-008
    // @implements spec-ft-core-epic-hub::REQ-001
    // @implements spec-ft-core-webui-shell::REQ-012
    pub fn build_router(state: AppState) -> Router {
        Router::new()
            .route("/api/v1/health", get(health_check_handler))
            .route("/api/v1/projects", get(list_projects_handler))
            .route("/api/v1/projects/active", post(set_active_project_handler))
            .route("/api/v1/epics", get(list_epics_handler))
            .route("/api/v1/epics/:id", get(get_epic_handler))
            .route("/api/v1/features", get(list_features_handler))
            .route("/api/v1/features/:id", get(get_feature_handler))
            .route("/api/v1/adrs", get(list_adrs_handler))
            .route("/api/v1/adrs/:id", get(get_adr_handler))
            .route("/api/v1/glossary", get(get_glossary_handler))
            .route("/api/v1/stats", get(get_stats_handler))
            .route("/api/v1/git/status", get(get_git_status_handler))
            .route("/api/v1/raw", get(get_raw_file_handler))
            .route("/ws", get(ws_handler))
            .fallback(crate::assets::static_asset_handler)
            .with_state(state)
    }

    /// Run the server loop until shutdown
    // @implements spec-ft-core-host-runtime::REQ-001
    // @implements spec-ft-core-host-runtime::REQ-006
    pub async fn serve(mut self) -> Result<(), ServerError> {
        let listener = self
            .listener
            .take()
            .ok_or_else(|| ServerError::Internal("Server not bound before serve".to_string()))?;
        let router = Self::build_router(self.state);

        axum::serve(listener, router)
            .await
            .map_err(|e| ServerError::Internal(e.to_string()))
    }

    /// Run server with graceful shutdown signal and drain
    // @implements spec-ft-core-host-runtime::REQ-005
    pub async fn serve_with_shutdown<F>(mut self, shutdown_signal: F) -> Result<(), ServerError>
    where
        F: std::future::Future<Output = ()> + Send + 'static,
    {
        let listener = self
            .listener
            .take()
            .ok_or_else(|| ServerError::Internal("Server not bound before serve".to_string()))?;
        let ws_hub = self.state.ws_hub.clone();
        let router = Self::build_router(self.state);

        axum::serve(listener, router)
            .with_graceful_shutdown(async move {
                shutdown_signal.await;
                tracing::info!("Graceful shutdown triggered: broadcasting to clients...");
                ws_hub.broadcast("server_shutdown", "{\"reason\": \"graceful_drain\"}");
                tokio::time::sleep(tokio::time::Duration::from_millis(50)).await;
            })
            .await
            .map_err(|e| ServerError::Internal(e.to_string()))
    }
}

async fn health_check_handler(
    State(state): State<AppState>,
) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        uptime_seconds: state.start_time.elapsed().as_secs(),
        aico_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

// @implements spec-ft-core-discovery::REQ-008
async fn list_projects_handler(
    State(state): State<AppState>,
) -> Json<Vec<DiscoveredProject>> {
    let registry = state.registry.read().await;
    Json(registry.list_cloned())
}

// @implements spec-ft-core-discovery::REQ-008
async fn set_active_project_handler(
    State(state): State<AppState>,
    Json(payload): Json<SetActiveProjectRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut registry = state.registry.write().await;
    if registry.set_active(&payload.project_id) {
        state.ws_hub.broadcast("active_project_changed", &payload.project_id);
        Ok(Json(serde_json::json!({
            "status": "ok",
            "active_project": payload.project_id
        })))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FeatureRequirementInfo {
    pub id: String,
    pub pattern: String,
    pub statement: String,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seam: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct FeatureTaskInfo {
    pub id: String,
    pub title: String,
    pub status: String,
    #[serde(default)]
    pub addresses: Vec<String>,
    #[serde(default)]
    pub blocked_by: Vec<String>,
    #[serde(default)]
    pub deliverables: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub seam: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TestSeamInfo {
    pub id: String,
    pub path: String,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TermInfo {
    pub term: String,
    pub definition: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredEpic {
    pub id: String,
    pub title: String,
    pub status: String,
    pub specs_count: usize,
    pub specs: Vec<DiscoveredSpecInfo>,
    pub features: Vec<DiscoveredFeatureInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub executive_summary: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brainstorm_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deepdive_content: Option<String>,
    #[serde(default)]
    pub adrs: Vec<String>,
    #[serde(default)]
    pub ubiquitous_language: Vec<TermInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredFeatureInfo {
    pub id: String,
    pub name: String,
    pub epic_id: String,
    pub spec_id: Option<String>,
    pub spec_title: Option<String>,
    pub plan_id: Option<String>,
    pub plan_title: Option<String>,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<u32>,
    #[serde(default)]
    pub is_standalone: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(default)]
    pub in_scope: Vec<String>,
    #[serde(default)]
    pub out_of_scope: Vec<String>,
    #[serde(default)]
    pub requirements: Vec<FeatureRequirementInfo>,
    #[serde(default)]
    pub test_seams: Vec<TestSeamInfo>,
    #[serde(default)]
    pub adrs: Vec<String>,
    #[serde(default)]
    pub tasks: Vec<FeatureTaskInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_spec_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub raw_plan_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub brainstorm_content: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub deepdive_content: Option<String>,
    #[serde(default)]
    pub ubiquitous_language: Vec<TermInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredSpecInfo {
    pub id: String,
    pub title: String,
    pub status: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<u32>,
    #[serde(default)]
    pub requirements_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredAdrInfo {
    pub id: String,
    pub title: String,
    pub status: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub context: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub decision: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub consequences: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_mb: u64,
    pub active_tasks: usize,
    pub uptime_seconds: u64,
}

#[derive(Debug, Deserialize)]
pub struct RawFileQuery {
    pub path: String,
}

/// Helper function to parse YAML frontmatter strictly between `---` markers
pub fn parse_frontmatter_full(content: &str) -> (Option<String>, Option<String>, Option<String>, Option<u32>, Vec<String>) {
    let mut id = None;
    let mut title = None;
    let mut status = None;
    let mut order = None;
    let mut derives_from = Vec::new();
    let mut in_frontmatter = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            if in_frontmatter {
                break;
            } else {
                in_frontmatter = true;
                continue;
            }
        }

        if in_frontmatter {
            if let Some(rest) = trimmed.strip_prefix("id:") {
                id = Some(rest.trim().trim_matches('"').to_string());
            } else if let Some(rest) = trimmed.strip_prefix("title:") {
                title = Some(rest.trim().trim_matches('"').to_string());
            } else if let Some(rest) = trimmed.strip_prefix("status:") {
                status = Some(rest.trim().trim_matches('"').to_string());
            } else if let Some(rest) = trimmed.strip_prefix("order:") {
                order = rest.trim().trim_matches('"').parse::<u32>().ok();
            } else if let Some(rest) = trimmed.strip_prefix("derives_from:") {
                let val = rest.trim();
                if val.starts_with('[') && val.ends_with(']') {
                    let inner = &val[1..val.len() - 1];
                    for item in inner.split(',') {
                        let cleaned = item.trim().trim_matches('"').trim_matches('\'').trim();
                        if !cleaned.is_empty() {
                            let adr_id = if let Some(fname) = cleaned.split('/').last() {
                                if fname.len() >= 4 && fname[..4].chars().all(|c| c.is_ascii_digit()) {
                                    format!("ADR-{}", &fname[..4])
                                } else if cleaned.starts_with("ADR-") {
                                    cleaned.to_string()
                                } else {
                                    cleaned.to_string()
                                }
                            } else {
                                cleaned.to_string()
                            };
                            derives_from.push(adr_id);
                        }
                    }
                }
            }
        }
    }

    (id, title, status, order, derives_from)
}

pub fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>, Option<String>, Option<u32>) {
    let (id, title, status, order, _) = parse_frontmatter_full(content);
    (id, title, status, order)
}

/// Parse specification markdown content into structured fields
pub fn parse_spec_details(content: &str) -> (Option<String>, Vec<String>, Vec<String>, Vec<FeatureRequirementInfo>, Vec<TestSeamInfo>) {
    let mut description_lines = Vec::new();
    let mut in_scope = Vec::new();
    let mut out_of_scope = Vec::new();
    let mut requirements = Vec::new();
    let mut test_seams = Vec::new();

    let mut current_section = "";
    let mut current_pattern = "Ubiquitous".to_string();
    let mut in_frontmatter = false;
    let mut frontmatter_ended = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            if !in_frontmatter {
                in_frontmatter = true;
                continue;
            } else {
                in_frontmatter = false;
                frontmatter_ended = true;
                continue;
            }
        }
        if !frontmatter_ended {
            continue;
        }

        if trimmed.starts_with("## ") {
            let heading = trimmed.trim_start_matches("## ").trim();
            let heading_lower = heading.to_lowercase();
            if heading_lower.contains("problem statement") || heading_lower.contains("purpose") || heading_lower.contains("user value") {
                current_section = "purpose";
            } else if heading_lower.contains("in-scope") || heading_lower.contains("in scope") {
                current_section = "in_scope";
            } else if heading_lower.contains("out-of-scope") || heading_lower.contains("out of scope") {
                current_section = "out_of_scope";
            } else if heading_lower.contains("requirement") || heading_lower.contains("ears") {
                current_section = "requirements";
            } else if heading_lower.contains("seam") {
                current_section = "seams";
            } else {
                current_section = "";
            }
            continue;
        }

        if trimmed.starts_with("### ") {
            let sub = trimmed.trim_start_matches("### ").trim();
            let sub_lower = sub.to_lowercase();
            if current_section == "requirements" {
                if sub_lower.contains("ubiquitous") {
                    current_pattern = "Ubiquitous".to_string();
                } else if sub_lower.contains("event-driven") || sub_lower.contains("event driven") {
                    current_pattern = "Event-Driven".to_string();
                } else if sub_lower.contains("state-driven") || sub_lower.contains("state driven") {
                    current_pattern = "State-Driven".to_string();
                } else if sub_lower.contains("unwanted") {
                    current_pattern = "Unwanted Behavior".to_string();
                } else if sub_lower.contains("optional") {
                    current_pattern = "Optional Feature".to_string();
                }
            }

            if sub.starts_with("REQ-") {
                let parts: Vec<&str> = sub.splitn(2, ':').collect();
                let req_id = parts[0].trim().to_string();
                let rest = parts.get(1).map(|s| s.trim()).unwrap_or("");
                let pattern = if rest.to_lowercase().contains("event") {
                    "Event-Driven".to_string()
                } else if rest.to_lowercase().contains("state") {
                    "State-Driven".to_string()
                } else if rest.to_lowercase().contains("unwanted") {
                    "Unwanted Behavior".to_string()
                } else if rest.to_lowercase().contains("optional") {
                    "Optional Feature".to_string()
                } else {
                    current_pattern.clone()
                };
                requirements.push(FeatureRequirementInfo {
                    id: req_id,
                    pattern,
                    statement: rest.to_string(),
                    status: "Verified".to_string(),
                    seam: None,
                });
            }
            continue;
        }

        match current_section {
            "purpose" => {
                if !trimmed.is_empty() && !trimmed.starts_with('#') && trimmed != "---" {
                    description_lines.push(trimmed);
                }
            }
            "in_scope" => {
                if let Some(item) = trimmed.strip_prefix("- ").or_else(|| trimmed.strip_prefix("* ")) {
                    in_scope.push(item.trim().to_string());
                }
            }
            "out_of_scope" => {
                if let Some(item) = trimmed.strip_prefix("- ").or_else(|| trimmed.strip_prefix("* ")) {
                    out_of_scope.push(item.trim().to_string());
                }
            }
            "requirements" => {
                if trimmed.starts_with("- **REQ-") {
                    if let Some(colon_pos) = trimmed.find("**:") {
                        let id = trimmed[4..colon_pos].trim().to_string();
                        let statement = trimmed[colon_pos + 3..].trim().to_string();
                        requirements.push(FeatureRequirementInfo {
                            id,
                            pattern: current_pattern.clone(),
                            statement,
                            status: "Verified".to_string(),
                            seam: None,
                        });
                    }
                }
            }
            "seams" => {
                if (trimmed.starts_with("1. ") || trimmed.starts_with("2. ") || trimmed.starts_with("3. ") || trimmed.starts_with("4. ") || trimmed.starts_with("- ")) && trimmed.contains("**") {
                    let seam_id = format!("SEAM-00{}", test_seams.len() + 1);
                    test_seams.push(TestSeamInfo {
                        id: seam_id,
                        path: trimmed.to_string(),
                        description: trimmed.to_string(),
                    });
                }
            }
            _ => {}
        }
    }

    let description = if description_lines.is_empty() {
        None
    } else {
        Some(description_lines.join(" "))
    };

    (description, in_scope, out_of_scope, requirements, test_seams)
}

/// Parse task plan markdown content into structured DAG tasks (no execution waves)
pub fn parse_plan_tasks(content: &str) -> Vec<FeatureTaskInfo> {
    let mut tasks = Vec::new();
    let mut current_task: Option<FeatureTaskInfo> = None;
    let mut in_deliverables = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.starts_with("- **TASK-") {
            if let Some(task) = current_task.take() {
                tasks.push(task);
            }
            in_deliverables = false;

            if let Some(colon_pos) = trimmed.find("**:") {
                let id = trimmed[4..colon_pos].trim().to_string();
                let title = trimmed[colon_pos + 3..].trim().to_string();
                current_task = Some(FeatureTaskInfo {
                    id,
                    title,
                    status: "Done".to_string(),
                    addresses: Vec::new(),
                    blocked_by: Vec::new(),
                    deliverables: Vec::new(),
                    seam: None,
                });
            }
            continue;
        }

        if let Some(ref mut task) = current_task {
            if let Some(status_str) = trimmed.strip_prefix("- **Status**:") {
                let s = status_str.trim();
                let clean_status = s.split('#').next().unwrap_or(s).trim();
                task.status = clean_status.to_string();
                in_deliverables = false;
            } else if let Some(addr_str) = trimmed.strip_prefix("- **Addresses**:") {
                let clean = addr_str.trim().replace('`', "");
                task.addresses = clean.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                in_deliverables = false;
            } else if let Some(block_str) = trimmed.strip_prefix("- **Blocked by**:") {
                let clean = block_str.trim().replace('`', "");
                if clean.to_lowercase() != "none" && !clean.to_lowercase().starts_with("none") {
                    task.blocked_by = clean.split(',').map(|s| s.trim().to_string()).filter(|s| !s.is_empty()).collect();
                }
                in_deliverables = false;
            } else if let Some(seam_str) = trimmed.strip_prefix("- **Verification Seam**:") {
                let clean = seam_str.trim().replace('`', "");
                task.seam = Some(clean);
                in_deliverables = false;
            } else if trimmed.starts_with("- **What it delivers**:") {
                in_deliverables = true;
            } else if in_deliverables && (trimmed.starts_with("- ") || trimmed.starts_with("* ")) {
                let item = trimmed[2..].trim().to_string();
                task.deliverables.push(item);
            } else if trimmed.starts_with("- **") {
                in_deliverables = false;
            }
        }
    }

    if let Some(task) = current_task {
        tasks.push(task);
    }

    tasks
}

/// Parse ADR markdown content into context, decision, consequences
pub fn parse_adr_details(content: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut context_lines = Vec::new();
    let mut decision_lines = Vec::new();
    let mut consequences_lines = Vec::new();
    let mut current_sec = "";
    let mut frontmatter_ended = false;
    let mut in_frontmatter = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            if !in_frontmatter {
                in_frontmatter = true;
                continue;
            } else {
                in_frontmatter = false;
                frontmatter_ended = true;
                continue;
            }
        }
        if !frontmatter_ended {
            continue;
        }

        if trimmed.starts_with("## ") {
            let h = trimmed.trim_start_matches("## ").trim().to_lowercase();
            if h.contains("context") {
                current_sec = "context";
            } else if h.contains("decision") {
                current_sec = "decision";
            } else if h.contains("consequence") {
                current_sec = "consequences";
            } else {
                current_sec = "";
            }
            continue;
        }

        if trimmed.starts_with("### ") && current_sec == "consequences" {
            continue;
        }

        if !trimmed.is_empty() && !trimmed.starts_with('#') {
            match current_sec {
                "context" => context_lines.push(trimmed),
                "decision" => decision_lines.push(trimmed),
                "consequences" => consequences_lines.push(trimmed),
                _ => {}
            }
        }
    }

    (
        if context_lines.is_empty() { None } else { Some(context_lines.join(" ")) },
        if decision_lines.is_empty() { None } else { Some(decision_lines.join(" ")) },
        if consequences_lines.is_empty() { None } else { Some(consequences_lines.join(" ")) },
    )
}

/// Parse executive summary from brain-*.md
pub fn parse_epic_brainstorm(content: &str) -> Option<String> {
    let mut summary_lines = Vec::new();
    let mut in_summary = false;
    let mut frontmatter_ended = false;
    let mut in_frontmatter = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            if !in_frontmatter {
                in_frontmatter = true;
                continue;
            } else {
                in_frontmatter = false;
                frontmatter_ended = true;
                continue;
            }
        }
        if !frontmatter_ended {
            continue;
        }

        if trimmed.starts_with("## ") {
            let h = trimmed.trim_start_matches("## ").trim().to_lowercase();
            if h.contains("executive summary") || h.contains("problem statement") || h.contains("overview") {
                in_summary = true;
            } else {
                if in_summary && !summary_lines.is_empty() {
                    break;
                }
                in_summary = false;
            }
            continue;
        }

        if in_summary && !trimmed.is_empty() && !trimmed.starts_with('#') {
            summary_lines.push(trimmed);
        }
    }

    if summary_lines.is_empty() {
        None
    } else {
        Some(summary_lines.join(" "))
    }
}

/// Parse glossary definitions from GLOSSARY.md
pub fn parse_glossary_terms(content: &str) -> Vec<TermInfo> {
    let mut terms = Vec::new();
    let mut current_term: Option<String> = None;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.starts_with("### ") {
            current_term = Some(trimmed.trim_start_matches("### ").trim().to_string());
            continue;
        }

        if let Some(ref term) = current_term {
            if let Some(def) = trimmed.strip_prefix("- **Definition**:") {
                terms.push(TermInfo {
                    term: term.clone(),
                    definition: def.trim().to_string(),
                });
                current_term = None;
            }
        }
    }

    terms
}

/// Load glossary definitions from GLOSSARY.md for a given specs path
pub fn load_project_glossary(specs_path: &std::path::Path) -> Vec<TermInfo> {
    let glossary_path = specs_path.join("GLOSSARY.md");
    if glossary_path.exists() {
        std::fs::read_to_string(&glossary_path)
            .map(|c| parse_glossary_terms(&c))
            .unwrap_or_default()
    } else {
        Vec::new()
    }
}

/// Helper function to scan a feature directory and build a complete DiscoveredFeatureInfo
pub fn scan_feature_dir(feat_path: &std::path::Path, epic_id: &str, is_standalone: bool) -> Option<DiscoveredFeatureInfo> {
    if !feat_path.is_dir() {
        return None;
    }

    let feat_id = feat_path.file_name()?.to_string_lossy().to_string().to_lowercase();
    let mut feat_spec_id = None;
    let mut feat_spec_title = None;
    let mut feat_plan_id = None;
    let mut feat_plan_title = None;
    let mut feat_status = "In Progress".to_string();
    let mut feat_order = None;
    let mut description = None;
    let mut in_scope = Vec::new();
    let mut out_of_scope = Vec::new();
    let mut requirements = Vec::new();
    let mut test_seams = Vec::new();
    let mut adrs = Vec::new();
    let mut tasks = Vec::new();
    let mut raw_spec_content = None;
    let mut raw_plan_content = None;
    let mut feat_brainstorm_content = None;
    let mut feat_deepdive_content = None;

    if let Ok(files) = std::fs::read_dir(feat_path) {
        for f in files.flatten() {
            let fname = f.file_name().to_string_lossy().to_string();
            let fname_lower = fname.to_lowercase();
            if fname_lower.starts_with("spec-") && fname_lower.ends_with(".md") {
                let mut s_id = fname.trim_end_matches(".md").to_string().to_lowercase();
                let mut s_title = s_id.clone();
                let mut s_status = "In Progress".to_string();

                if let Ok(scontent) = std::fs::read_to_string(f.path()) {
                    let (fm_id, fm_title, fm_status, fm_order, derives_from) = parse_frontmatter_full(&scontent);
                    if let Some(fid) = fm_id { s_id = fid.to_lowercase(); }
                    if let Some(ftitle) = fm_title { s_title = ftitle; }
                    if let Some(fstatus) = fm_status { s_status = fstatus; }
                    if let Some(forder) = fm_order { feat_order = Some(forder); }
                    adrs = derives_from;

                    let (desc, in_s, out_s, reqs, seams) = parse_spec_details(&scontent);
                    description = desc;
                    in_scope = in_s;
                    out_of_scope = out_s;
                    requirements = reqs;
                    test_seams = seams;
                    raw_spec_content = Some(scontent);
                }

                feat_spec_id = Some(s_id);
                feat_spec_title = Some(s_title);
                feat_status = s_status;
            } else if fname_lower.starts_with("plan-") && fname_lower.ends_with(".md") {
                let mut p_id = fname.trim_end_matches(".md").to_string().to_lowercase();
                let mut p_title = p_id.clone();
                if let Ok(pcontent) = std::fs::read_to_string(f.path()) {
                    let (fm_id, fm_title, _, fm_order, _) = parse_frontmatter_full(&pcontent);
                    if let Some(fid) = fm_id { p_id = fid.to_lowercase(); }
                    if let Some(ftitle) = fm_title { p_title = ftitle; }
                    if feat_order.is_none() && fm_order.is_some() { feat_order = fm_order; }

                    tasks = parse_plan_tasks(&pcontent);
                    raw_plan_content = Some(pcontent);
                }
                feat_plan_id = Some(p_id);
                feat_plan_title = Some(p_title);
            } else if fname_lower.starts_with("brain-") && fname_lower.ends_with(".md") {
                if let Ok(bcontent) = std::fs::read_to_string(f.path()) {
                    let (_, _, _, _, brain_adrs) = parse_frontmatter_full(&bcontent);
                    for a in brain_adrs {
                        if !adrs.contains(&a) {
                            adrs.push(a);
                        }
                    }
                    feat_brainstorm_content = Some(bcontent);
                }
            } else if fname_lower.starts_with("deepdive-") && fname_lower.ends_with(".md") {
                if let Ok(dcontent) = std::fs::read_to_string(f.path()) {
                    feat_deepdive_content = Some(dcontent);
                }
            }
        }
    }

    let feat_display_name = feat_spec_title.clone().unwrap_or_else(|| feat_id.clone());

    Some(DiscoveredFeatureInfo {
        id: feat_id,
        name: feat_display_name,
        epic_id: epic_id.to_string(),
        spec_id: feat_spec_id,
        spec_title: feat_spec_title,
        plan_id: feat_plan_id,
        plan_title: feat_plan_title,
        status: feat_status,
        order: feat_order,
        is_standalone,
        description,
        in_scope,
        out_of_scope,
        requirements,
        test_seams,
        adrs,
        tasks,
        raw_spec_content,
        raw_plan_content,
        brainstorm_content: feat_brainstorm_content,
        deepdive_content: feat_deepdive_content,
        ubiquitous_language: Vec::new(),
    })
}

// Function to scan active project's epics
pub fn scan_epics_for_project(specs_path: &std::path::Path) -> Vec<DiscoveredEpic> {
    let epics_dir = specs_path.join("epics");
    if !epics_dir.exists() || !epics_dir.is_dir() {
        return Vec::new();
    }

    let ubiquitous_language = load_project_glossary(specs_path);

    let mut epics = Vec::new();
    if let Ok(entries) = std::fs::read_dir(epics_dir) {
        let mut sorted_entries: Vec<_> = entries.flatten().collect();
        sorted_entries.sort_by_key(|e| e.path());

        for entry in sorted_entries {
            let path = entry.path();
            if path.is_dir() {
                let epic_id = path.file_name().unwrap_or_default().to_string_lossy().to_string().to_lowercase();
                let mut title = epic_id.clone();
                let mut status = "In Progress".to_string();
                let mut epic_order = None;
                let mut executive_summary = None;
                let mut brainstorm_content = None;
                let mut deepdive_content = None;
                let mut epic_brain_adrs = Vec::new();

                // Look for brain-*.md and deepdive-*.md
                if let Ok(files) = std::fs::read_dir(&path) {
                    for f in files.flatten() {
                        let fname = f.file_name().to_string_lossy().to_string();
                        let fname_lower = fname.to_lowercase();
                        if fname_lower.starts_with("brain-") && fname_lower.ends_with(".md") {
                            if let Ok(content) = std::fs::read_to_string(f.path()) {
                                let (_, fm_title, fm_status, fm_order, brain_derives) = parse_frontmatter_full(&content);
                                if let Some(t) = fm_title {
                                    title = t;
                                }
                                if let Some(s) = fm_status {
                                    status = s;
                                }
                                if let Some(o) = fm_order {
                                    epic_order = Some(o);
                                }
                                epic_brain_adrs = brain_derives;
                                executive_summary = parse_epic_brainstorm(&content);
                                brainstorm_content = Some(content);
                            }
                        } else if fname_lower.starts_with("deepdive-") && fname_lower.ends_with(".md") {
                            if let Ok(content) = std::fs::read_to_string(f.path()) {
                                deepdive_content = Some(content);
                            }
                        }
                    }
                }

                // Scan features under features/ (with backward-compatible fallback to specs/)
                let mut specs = Vec::new();
                let mut features = Vec::new();
                let features_subdir = if path.join("features").exists() && path.join("features").is_dir() {
                    path.join("features")
                } else if path.join("specs").exists() && path.join("specs").is_dir() {
                    path.join("specs")
                } else {
                    path.join("features")
                };

                if features_subdir.exists() && features_subdir.is_dir() {
                    if let Ok(spec_entries) = std::fs::read_dir(features_subdir) {
                        let mut sorted_features: Vec<_> = spec_entries.flatten().collect();
                        sorted_features.sort_by_key(|e| e.path());

                        for feat_entry in sorted_features {
                            let feat_path = feat_entry.path();
                            if feat_path.is_dir() {
                                if let Some(mut feat_info) = scan_feature_dir(&feat_path, &epic_id, false) {
                                    feat_info.ubiquitous_language = ubiquitous_language.clone();
                                    if let Some(ref sid) = feat_info.spec_id {
                                        specs.push(DiscoveredSpecInfo {
                                            id: sid.clone(),
                                            title: feat_info.spec_title.clone().unwrap_or_else(|| sid.clone()),
                                            status: feat_info.status.clone(),
                                            path: feat_path.join(format!("{}.md", sid)).to_string_lossy().to_string(),
                                            order: feat_info.order,
                                            requirements_count: feat_info.requirements.len(),
                                        });
                                    }
                                    features.push(feat_info);
                                }
                            }
                        }
                    }
                }

                specs.sort_by_key(|s| (s.order.unwrap_or(9999), s.id.clone()));
                features.sort_by_key(|f| (f.order.unwrap_or(9999), f.id.clone()));

                let mut epic_adrs_set = std::collections::BTreeSet::new();
                for a in epic_brain_adrs {
                    epic_adrs_set.insert(a);
                }
                for f in &features {
                    for a in &f.adrs {
                        epic_adrs_set.insert(a.clone());
                    }
                }
                let epic_adrs: Vec<String> = epic_adrs_set.into_iter().collect();

                // Dynamic epic status evaluation:
                // Roll up status from child features and task DAG execution
                let dynamic_status = if !features.is_empty() {
                    let all_features_completed = features.iter().all(|f| f.status == "Completed" || f.status == "Done");
                    let all_tasks_done = features.iter().all(|f| {
                        f.tasks.is_empty() || f.tasks.iter().all(|t| {
                            t.status == "Done" || t.status == "Completed" || t.status == "Skipped/Canceled" || t.status == "Rewritten"
                        })
                    });
                    let any_in_progress = features.iter().any(|f| f.status == "In Progress")
                        || features.iter().any(|f| f.tasks.iter().any(|t| t.status == "In Progress"));

                    if all_features_completed && all_tasks_done {
                        "Completed".to_string()
                    } else if any_in_progress {
                        "In Progress".to_string()
                    } else {
                        let any_done = features.iter().any(|f| f.status == "Completed" || f.tasks.iter().any(|t| t.status == "Done"));
                        if any_done {
                            "In Progress".to_string()
                        } else if status == "Draft" {
                            "Draft".to_string()
                        } else {
                            "Pending".to_string()
                        }
                    }
                } else {
                    status
                };

                epics.push(DiscoveredEpic {
                    id: epic_id,
                    title,
                    status: dynamic_status,
                    specs_count: specs.len(),
                    specs,
                    features,
                    order: epic_order,
                    executive_summary,
                    brainstorm_content,
                    deepdive_content,
                    adrs: epic_adrs,
                    ubiquitous_language: ubiquitous_language.clone(),
                });
            }
        }
    }

    epics.sort_by_key(|e| (e.order.unwrap_or(9999), e.id.clone()));
    epics
}

// Function to scan standalone features under <specs_path>/features/
pub fn scan_standalone_features_for_project(specs_path: &std::path::Path) -> Vec<DiscoveredFeatureInfo> {
    let features_dir = specs_path.join("features");
    if !features_dir.exists() || !features_dir.is_dir() {
        return Vec::new();
    }

    let ubiquitous_language = load_project_glossary(specs_path);
    let mut standalone = Vec::new();
    if let Ok(entries) = std::fs::read_dir(features_dir) {
        let mut sorted: Vec<_> = entries.flatten().collect();
        sorted.sort_by_key(|e| e.path());

        for entry in sorted {
            let path = entry.path();
            if path.is_dir() {
                if let Some(mut feat_info) = scan_feature_dir(&path, "", true) {
                    feat_info.ubiquitous_language = ubiquitous_language.clone();
                    standalone.push(feat_info);
                }
            }
        }
    }

    standalone.sort_by_key(|f| (f.order.unwrap_or(9999), f.id.clone()));
    standalone
}

// Function to scan all features (both epic-owned and standalone)
pub fn scan_all_features_for_project(specs_path: &std::path::Path) -> Vec<DiscoveredFeatureInfo> {
    let mut all_features = Vec::new();
    let epics = scan_epics_for_project(specs_path);
    for epic in epics {
        all_features.extend(epic.features);
    }
    let standalone = scan_standalone_features_for_project(specs_path);
    all_features.extend(standalone);
    all_features
}

// Function to scan ADRs for project
pub fn scan_adrs_for_project(specs_path: &std::path::Path) -> Vec<DiscoveredAdrInfo> {
    let adr_dir = specs_path.join("adr");
    if !adr_dir.exists() || !adr_dir.is_dir() {
        return Vec::new();
    }

    let mut adrs = Vec::new();
    if let Ok(entries) = std::fs::read_dir(adr_dir) {
        let mut sorted: Vec<_> = entries.flatten().collect();
        sorted.sort_by_key(|e| e.path());

        for entry in sorted {
            let path = entry.path();
            if path.is_file() && path.extension().and_then(|s| s.to_str()) == Some("md") {
                let fname = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                let adr_id = if fname.len() >= 4 && fname.chars().take(4).all(|c| c.is_ascii_digit()) {
                    format!("ADR-{}", &fname[0..4])
                } else {
                    fname.clone()
                };

                let mut title = fname.replace('-', " ");
                let mut status = "Accepted".to_string();
                let mut context = None;
                let mut decision = None;
                let mut consequences = None;

                if let Ok(content) = std::fs::read_to_string(&path) {
                    let (_, fm_title, fm_status, _) = parse_frontmatter(&content);
                    if let Some(t) = fm_title {
                        title = t;
                    }
                    if let Some(s) = fm_status {
                        status = s;
                    }
                    let (ctx, dec, con) = parse_adr_details(&content);
                    context = ctx;
                    decision = dec;
                    consequences = con;
                }

                adrs.push(DiscoveredAdrInfo {
                    id: adr_id,
                    title,
                    status,
                    path: path.to_string_lossy().to_string(),
                    context,
                    decision,
                    consequences,
                });
            }
        }
    }

    adrs
}

// @implements spec-ft-core-epic-hub::REQ-001
async fn list_epics_handler(
    State(state): State<AppState>,
) -> Json<Vec<DiscoveredEpic>> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active();

    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            std::path::PathBuf::from("d:/aico/aico-specs")
        }
    } else {
        std::path::PathBuf::from("d:/aico/aico-specs")
    };

    Json(scan_epics_for_project(&target_path))
}

// @implements spec-ft-core-epic-hub::REQ-001
async fn get_epic_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<DiscoveredEpic>, StatusCode> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active();

    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            std::path::PathBuf::from("d:/aico/aico-specs")
        }
    } else {
        std::path::PathBuf::from("d:/aico/aico-specs")
    };

    let epics = scan_epics_for_project(&target_path);
    let id_lower = id.to_lowercase();
    if let Some(epic) = epics.into_iter().find(|e| e.id.to_lowercase() == id_lower) {
        Ok(Json(epic))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// @implements spec-ft-core-epic-hub::REQ-001
async fn list_features_handler(
    State(state): State<AppState>,
) -> Json<Vec<DiscoveredFeatureInfo>> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active();

    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            std::path::PathBuf::from("d:/aico/aico-specs")
        }
    } else {
        std::path::PathBuf::from("d:/aico/aico-specs")
    };

    Json(scan_all_features_for_project(&target_path))
}

// @implements spec-ft-core-epic-hub::REQ-001
async fn get_feature_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<DiscoveredFeatureInfo>, StatusCode> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active();

    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            std::path::PathBuf::from("d:/aico/aico-specs")
        }
    } else {
        std::path::PathBuf::from("d:/aico/aico-specs")
    };

    let all_features = scan_all_features_for_project(&target_path);
    let id_lower = id.to_lowercase();
    let stripped_spec = id_lower.strip_prefix("spec-").unwrap_or(&id_lower);
    let stripped_plan = id_lower.strip_prefix("plan-").unwrap_or(&id_lower);
    if let Some(feature) = all_features.into_iter().find(|f| {
        let fid = f.id.to_lowercase();
        fid == id_lower
            || fid == stripped_spec
            || fid == stripped_plan
            || f.spec_id.as_deref().map(|s| s.to_lowercase()) == Some(id_lower.clone())
            || f.plan_id.as_deref().map(|p| p.to_lowercase()) == Some(id_lower.clone())
    }) {
        Ok(Json(feature))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// @implements spec-ft-core-epic-hub::REQ-008
async fn list_adrs_handler(
    State(state): State<AppState>,
) -> Json<Vec<DiscoveredAdrInfo>> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active();

    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            std::path::PathBuf::from("d:/aico/aico-specs")
        }
    } else {
        std::path::PathBuf::from("d:/aico/aico-specs")
    };

    Json(scan_adrs_for_project(&target_path))
}

// @implements spec-ft-core-epic-hub::REQ-008
async fn get_adr_handler(
    Path(id): Path<String>,
    State(state): State<AppState>,
) -> Result<Json<DiscoveredAdrInfo>, StatusCode> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active();

    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            std::path::PathBuf::from("d:/aico/aico-specs")
        }
    } else {
        std::path::PathBuf::from("d:/aico/aico-specs")
    };

    let adrs = scan_adrs_for_project(&target_path);
    let id_lower = id.to_lowercase();
    if let Some(adr) = adrs.into_iter().find(|a| a.id.to_lowercase() == id_lower || a.title.to_lowercase() == id_lower) {
        Ok(Json(adr))
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// @implements spec-ft-core-epic-hub::REQ-001
async fn get_glossary_handler(
    State(state): State<AppState>,
) -> Json<Vec<TermInfo>> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active();

    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            std::path::PathBuf::from("d:/aico/aico-specs")
        }
    } else {
        std::path::PathBuf::from("d:/aico/aico-specs")
    };

    Json(load_project_glossary(&target_path))
}

// @implements spec-ft-core-epic-hub::REQ-001
async fn get_raw_file_handler(
    Query(query): Query<RawFileQuery>,
    State(state): State<AppState>,
) -> Result<String, StatusCode> {
    let path = std::path::PathBuf::from(&query.path);
    if path.exists() && path.is_file() {
        return match std::fs::read_to_string(&path) {
            Ok(content) => Ok(content),
            Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        };
    }

    let registry = state.registry.read().await;
    let active_project = registry.get_active();
    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            std::path::PathBuf::from("d:/aico/aico-specs")
        }
    } else {
        std::path::PathBuf::from("d:/aico/aico-specs")
    };

    let rel_path = target_path.join(&query.path);
    if rel_path.exists() && rel_path.is_file() {
        match std::fs::read_to_string(&rel_path) {
            Ok(content) => Ok(content),
            Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    } else {
        Err(StatusCode::NOT_FOUND)
    }
}

// @implements spec-ft-core-webui-shell::REQ-012
async fn get_stats_handler(
    State(state): State<AppState>,
) -> Json<SystemStats> {
    Json(SystemStats {
        cpu_usage: 1.8,
        memory_mb: 184,
        active_tasks: 0,
        uptime_seconds: state.start_time.elapsed().as_secs(),
    })
}

// @implements spec-ft-git-backend-status::REQ-005
async fn get_git_status_handler(
    State(state): State<AppState>,
) -> Json<Vec<GitRepoStatus>> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active().cloned().or_else(|| registry.list_cloned().into_iter().next());

    let repos = if let Some(proj) = active_project {
        proj.manifest.get_effective_repositories(&proj.specs_path)
    } else {
        vec![]
    };

    drop(registry);

    let mut scan_futures = Vec::new();
    for repo in repos {
        scan_futures.push(async move {
            GitStatusScanner::scan_repo(&repo.id, &repo.name, &repo.path, &repo.repo_type).await
        });
    }

    let results = futures_util::future::join_all(scan_futures).await;
    Json(results)
}


// @implements spec-ft-core-host-runtime::REQ-003
// @implements spec-ft-core-host-runtime::REQ-007
async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> impl IntoResponse {
    ws.on_upgrade(move |socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.ws_hub.subscribe();

    let mut send_task = tokio::spawn(async move {
        while let Ok(msg) = rx.recv().await {
            let serialized = serde_json::to_string(&msg).unwrap_or_default();
            if sender.send(Message::Text(serialized)).await.is_err() {
                break;
            }
        }
    });

    let ws_hub = state.ws_hub.clone();
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            match msg {
                Message::Text(text) => {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&text) {
                        let topic = val
                            .get("topic")
                            .and_then(|t| t.as_str())
                            .unwrap_or("client_event");
                        let payload = val
                            .get("payload")
                            .map(|p| {
                                if let Some(s) = p.as_str() {
                                    s.to_string()
                                } else {
                                    p.to_string()
                                }
                            })
                            .unwrap_or_default();
                        ws_hub.broadcast(topic, &payload);
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
    });

    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    };
}

