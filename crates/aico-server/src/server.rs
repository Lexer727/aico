use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        Path, Query, State,
    },
    http::StatusCode,
    response::IntoResponse,
    routing::{delete, get, post},
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

use aico_core::{AicoConfig, DiscoveredProject, ProjectStatus, WorkspaceRegistry};
use crate::auth::LanAuthenticator;
use crate::git::{
    collect_project_git_status, git_ai_commit_repo, git_clone_repo, git_commit_repo, git_pull_repo, git_push_repo,
    GitRepoStatus,
};
use crate::ws::WebSocketHub;
use std::path::{Path as StdPath, PathBuf};

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
    pub terminal_sessions: Arc<crate::terminal::TerminalSessionRegistry>,
    pub quota_service: Arc<crate::quotas::QuotaDiscoveryService>,
    pub bound_port: Arc<std::sync::atomic::AtomicU16>,
    pub storage: Arc<RwLock<Option<aico_storage::StorageManager>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            start_time: Arc::new(Instant::now()),
            registry: Arc::new(RwLock::new(WorkspaceRegistry::new())),
            ws_hub: Arc::new(WebSocketHub::default()),
            auth: Arc::new(LanAuthenticator::new()),
            terminal_sessions: Arc::new(crate::terminal::TerminalSessionRegistry::default()),
            quota_service: Arc::new(crate::quotas::QuotaDiscoveryService::default()),
            bound_port: Arc::new(std::sync::atomic::AtomicU16::new(4242)),
            storage: Arc::new(RwLock::new(None)),
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
    // @implements ft-core-host-runtime::TASK-CORE-001-1::REQ-001
    // @implements ft-core-host-runtime::TASK-CORE-001-1::REQ-010
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
                    self.state.bound_port.store(local_addr.port(), std::sync::atomic::Ordering::Relaxed);
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

    // @implements ft-core-host-runtime::TASK-CORE-001-2::REQ-002
    // @implements ft-core-host-runtime::TASK-CORE-001-6::REQ-003
    // @implements ft-core-host-runtime::TASK-CORE-001-1::REQ-006
    // @implements ft-core-host-runtime::TASK-CORE-001-6::REQ-007
    // @implements ft-core-discovery::TASK-CORE-004-3::REQ-008
    // @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-001
    // @implements ft-core-webui-shell::TASK-CORE-006-8::REQ-012
    pub fn build_router(state: AppState) -> Router {
        Router::new()
            .route("/api/v1/health", get(health_check_handler))
            // @implements ft-core-webui-shell::TASK-CORE-006-17::REQ-019
            .route("/api/v1/auth/pairing", get(get_pairing_handler))
            // @implements ft-core-assets-manager::TASK-ASSET-009::REQ-013
            .route("/api/v1/config", get(get_config_handler))
            // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
            // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-007
            .route("/api/v1/projects", get(list_projects_handler).post(handle_create_project))
            .route("/api/v1/projects/active", post(set_active_project_handler))
            // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
            .route("/api/v1/graph", get(handle_get_graph))
            .route("/api/v1/epics", get(list_epics_handler))
            .route("/api/v1/epics/:id", get(get_epic_handler))
            .route("/api/v1/features", get(list_features_handler))
            .route("/api/v1/features/:id", get(get_feature_handler))
            .route("/api/v1/adrs", get(list_adrs_handler))
            .route("/api/v1/adrs/:id", get(get_adr_handler))
            .route("/api/v1/glossary", get(get_glossary_handler))
            .route("/api/v1/stats", get(get_stats_handler))
            .route("/api/v1/git/status", get(get_git_status_handler))
            // @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
            .route("/api/v1/git/pull", post(handle_git_pull))
            // @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
            .route("/api/v1/git/push", post(handle_git_push))
            // @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
            // @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-008
            .route("/api/v1/git/commit", post(handle_git_commit))
            // @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-4::REQ-004
            .route("/api/v1/git/ai-commit", post(handle_git_ai_commit))
            // @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
            // @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-006
            // @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-007
            .route("/api/v1/git/clone", post(handle_git_clone))
            // @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
            .route("/api/v1/notifications/popup", post(handle_popup_notification))
            // @implements ft-core-omni-search-fulltext::TASK-CORE-009-7::REQ-010
            .route("/api/v1/code/files", get(list_code_files_handler))
            .route("/api/v1/raw", get(get_raw_file_handler))
            .route("/api/v1/search", get(search_handler))
            // @implements ft-core-assets-manager::TASK-ASSET-004::REQ-004
            .route("/api/v1/epics/:id/assets", get(crate::assets::list_epic_assets_handler))
            // @implements ft-core-assets-manager::TASK-ASSET-004::REQ-005
            .route("/api/v1/features/:id/assets", get(crate::assets::list_feature_assets_handler))
            // @implements ft-core-assets-manager::TASK-ASSET-003::REQ-001
            // @implements ft-core-assets-manager::TASK-ASSET-001::REQ-002
            .route("/api/v1/assets/upload", post(crate::assets::upload_asset_handler))
            // @implements ft-core-assets-manager::TASK-ASSET-007::REQ-003
            .route("/api/v1/assets/raw", get(crate::assets::get_asset_raw_handler))
            // @implements ft-core-assets-manager::TASK-ASSET-006::REQ-008
            .route("/api/v1/assets/open-system", post(crate::assets::open_system_handler))
            // @implements ft-core-assets-manager::TASK-ASSET-007::REQ-003
            // @implements ft-core-assets-manager::TASK-ASSET-007::REQ-009
            .route("/api/v1/assets", delete(crate::assets::delete_asset_handler))
            // @implements ft-terminal-backend-stream-bridge::TASK-TERM-001-3::REQ-001
            .route("/api/v1/terminal/ws", get(crate::terminal::terminal_ws_handler))
            // @implements ft-terminal-conpty-bridge::TASK-PTY-003::REQ-008
            .route("/api/v1/terminal/sessions", get(crate::terminal::terminal_sessions_handler))
            // @implements ft-terminal-ai-quota-monitor::TASK-QUOTA-005::REQ-001
            .route("/api/v1/ai/quotas", get(crate::quotas::get_ai_quotas_handler))
            // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-002
            // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-002
            // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-012
            .route("/mcp", post(mcp_post_handler).get(mcp_get_handler).options(mcp_options_handler))
            .route("/ws", get(ws_handler))
            .fallback(crate::assets::static_asset_handler)
            .with_state(state)
    }

    /// Run the server loop until shutdown
    // @implements ft-core-host-runtime::TASK-CORE-001-1::REQ-001
    // @implements ft-core-host-runtime::TASK-CORE-001-1::REQ-006
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
    // @implements ft-core-host-runtime::TASK-CORE-001-5::REQ-005
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct PairingResponse {
    pub lan_ip: String,
    pub port: u16,
    pub token: String,
    pub pairing_url: String,
}

pub fn get_lan_ip() -> String {
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                let ip = addr.ip().to_string();
                if ip != "0.0.0.0" {
                    return ip;
                }
            }
        }
    }
    "127.0.0.1".to_string()
}

// @implements ft-core-webui-shell::TASK-CORE-006-17::REQ-019
async fn get_pairing_handler(
    State(state): State<AppState>,
) -> Json<PairingResponse> {
    let port = state.bound_port.load(std::sync::atomic::Ordering::Relaxed);
    let lan_ip = get_lan_ip();
    let pairing_url = state.auth.pairing_url(&lan_ip, port);
    Json(PairingResponse {
        lan_ip,
        port,
        token: state.auth.token().to_string(),
        pairing_url,
    })
}

// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-002
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-006
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-008
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-012
async fn mcp_post_handler(
    State(state): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let storage_guard = state.storage.read().await;
    let storage_ref = storage_guard.as_ref();
    let res = aico_mcp::protocol::handle_json_rpc(&payload, storage_ref);
    (
        StatusCode::OK,
        [
            ("access-control-allow-origin", "*"),
            ("access-control-allow-headers", "content-type, authorization, mcp-session-id"),
            ("content-type", "application/json"),
        ],
        Json(res),
    )
}

// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-002
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-007
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-012
async fn mcp_get_handler(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let tools = aico_mcp::McpServerManager::list_tools();
    let registry = state.registry.read().await;
    let active_project = registry.get_active().map(|p| p.id.clone()).unwrap_or_else(|| "none".to_string());

    let payload = serde_json::json!({
        "status": "ok",
        "transport": "streamable-http",
        "protocolVersion": "2024-11-05",
        "server": {
            "name": "aico",
            "version": env!("CARGO_PKG_VERSION")
        },
        "active_project": active_project,
        "tools_count": tools.len(),
        "tools": tools.into_iter().map(|t| t.name).collect::<Vec<_>>()
    });

    (
        StatusCode::OK,
        [
            ("access-control-allow-origin", "*"),
            ("access-control-allow-headers", "content-type, authorization, mcp-session-id"),
            ("content-type", "application/json"),
        ],
        Json(payload),
    )
}

// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-002
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-012
async fn mcp_options_handler() -> impl IntoResponse {
    (
        StatusCode::OK,
        [
            ("access-control-allow-origin", "*"),
            ("access-control-allow-methods", "GET, POST, OPTIONS"),
            ("access-control-allow-headers", "content-type, authorization, mcp-session-id"),
        ],
        "",
    )
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

// @implements ft-core-assets-manager::TASK-ASSET-009::REQ-013
async fn get_config_handler(
    State(state): State<AppState>,
) -> Json<AicoConfig> {
    let config = crate::assets::get_active_config(&state).await;
    Json(config)
}

// @implements ft-core-discovery::TASK-CORE-004-3::REQ-008
async fn list_projects_handler(
    State(state): State<AppState>,
) -> Json<Vec<DiscoveredProject>> {
    let registry = state.registry.read().await;
    Json(registry.list_cloned())
}

// @implements ft-core-discovery::TASK-CORE-004-3::REQ-008
async fn set_active_project_handler(
    State(state): State<AppState>,
    Json(payload): Json<SetActiveProjectRequest>,
) -> Result<Json<serde_json::Value>, StatusCode> {
    let mut registry = state.registry.write().await;
    if registry.set_active(&payload.project_id) {
        if let Some(active) = registry.get_active() {
            if let Ok(sm) = aico_storage::StorageManager::open(&active.specs_path) {
                let mut st = state.storage.write().await;
                *st = Some(sm);
            }
        }
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
    #[serde(default)]
    pub repositories: Vec<String>,
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
    #[serde(default)]
    pub repositories: Vec<String>,
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

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CodeFileInfo {
    pub path: String,
    pub relative_path: String,
    pub name: String,
    pub extension: String,
    pub implements_count: usize,
    #[serde(default)]
    pub verifies_count: usize,
    pub annotations: Vec<CodeAnnotationInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct CodeAnnotationInfo {
    pub line: usize,
    pub tag: String,
    pub target: String,
}

fn get_annotation_regex() -> &'static regex::Regex {
    static RE: std::sync::OnceLock<regex::Regex> = std::sync::OnceLock::new();
    RE.get_or_init(|| {
        regex::Regex::new(
            r"^\s*(?://|#|/\*|\{/\*)\s*@(implements|verifies)\s+((?:spec-)?ft-[a-z0-9\-]+)::(TASK-[A-Za-z0-9\-]+)::(REQ-[0-9]{3,4})"
        ).expect("Valid annotation regex")
    })
}

pub fn resolve_workspace_root() -> std::path::PathBuf {
    std::env::var("AICO_ROOT")
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| {
            if std::path::Path::new("d:/aico").exists() {
                std::path::PathBuf::from("d:/aico")
            } else if std::path::Path::new("../..").exists() {
                std::path::PathBuf::from("../..")
            } else {
                std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."))
            }
        })
}

/// Recursively scan codebase directory for source files and parse @implements and @verifies annotations
// @implements ft-core-omni-search-fulltext::TASK-CORE-009-7::REQ-010
// @implements ft-specs-traceability-syntax-evolution::TASK-SPECS-006-4::REQ-004
// @implements ft-specs-traceability-syntax-evolution::TASK-SPECS-006-4::REQ-005
// @implements ft-core-workspace-path-normalization::TASK-CORE-014-1::REQ-001
// @implements ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-1::REQ-001
// @implements ft-core-multirepo-code-path-normalization::TASK-CORE-016-1::REQ-001
pub fn scan_codebase_files(codebase_path: &std::path::Path) -> Vec<CodeFileInfo> {
    let mut files = Vec::new();
    if !codebase_path.exists() || !codebase_path.is_dir() {
        return files;
    }

    let mut stack = vec![codebase_path.to_path_buf()];

    const IGNORED_DIRS: &[&str] = &[
        ".git", "target", "node_modules", "dist", ".gemini", "coverage", "tmp", ".vscode", ".idea", "vendor"
    ];

    const ALLOWED_EXTS: &[&str] = &[
        "rs", "ts", "tsx", "js", "jsx", "json", "toml", "md", "css", "html", "sql", "yaml", "yml", "sh", "ps1"
    ];

    let re = get_annotation_regex();

    while let Some(dir) = stack.pop() {
        if let Ok(entries) = std::fs::read_dir(&dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();

                if path.is_dir() {
                    if !IGNORED_DIRS.contains(&file_name.as_str()) && !file_name.starts_with('.') {
                        stack.push(path);
                    }
                } else if path.is_file() {
                    let ext = path.extension().unwrap_or_default().to_string_lossy().to_lowercase();
                    if ALLOWED_EXTS.contains(&ext.as_str()) {
                        let norm_path = path.to_string_lossy().replace('\\', "/");
                        let relative_path = if let Some(pos) = norm_path.find("/codebase/") {
                            norm_path[pos + "/codebase/".len()..].to_string()
                        } else if norm_path.starts_with("codebase/") {
                            norm_path["codebase/".len()..].to_string()
                        } else {
                            let repo_name = codebase_path.file_name().unwrap_or_default().to_string_lossy().to_string();
                            let sub = path
                                .strip_prefix(codebase_path)
                                .unwrap_or(&path)
                                .to_string_lossy()
                                .replace('\\', "/");
                            if !repo_name.is_empty() && !sub.starts_with(&format!("{}/", repo_name)) {
                                format!("{}/{}", repo_name, sub.trim_start_matches('/'))
                            } else {
                                sub
                            }
                        };

                        let mut implements_count = 0;
                        let mut verifies_count = 0;
                        let mut annotations = Vec::new();

                        if let Ok(content) = std::fs::read_to_string(&path) {
                            for (idx, line) in content.lines().enumerate() {
                                // Ignore placeholder lines containing <...> or ###
                                if line.contains('<') || line.contains('>') || line.contains("###") {
                                    continue;
                                }

                                if let Some(caps) = re.captures(line) {
                                    let tag_name = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
                                    let feature = caps.get(2).map(|m| m.as_str()).unwrap_or_default();
                                    let task = caps.get(3).map(|m| m.as_str()).unwrap_or_default();
                                    let req = caps.get(4).map(|m| m.as_str()).unwrap_or_default();

                                    if tag_name == "implements" {
                                        implements_count += 1;
                                    } else if tag_name == "verifies" {
                                        verifies_count += 1;
                                    }

                                    annotations.push(CodeAnnotationInfo {
                                        line: idx + 1,
                                        tag: format!("@{}", tag_name),
                                        target: format!("{}::{}::{}", feature, task, req),
                                    });
                                }
                            }
                        }

                        // REQ-005: exclude files with zero valid annotations from the sidebar tree Code section
                        if implements_count > 0 || verifies_count > 0 {
                            files.push(CodeFileInfo {
                                path: relative_path.clone(),
                                relative_path,
                                name: file_name,
                                extension: ext,
                                implements_count,
                                verifies_count,
                                annotations,
                            });
                        }
                    }
                }
            }
        }
    }

    files.sort_by(|a, b| {
        (b.implements_count + b.verifies_count)
            .cmp(&(a.implements_count + a.verifies_count))
            .then_with(|| a.relative_path.cmp(&b.relative_path))
    });

    files
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

pub fn parse_frontmatter_repositories(content: &str) -> Vec<String> {
    let mut repos = Vec::new();
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
            if let Some(rest) = trimmed.strip_prefix("repositories:") {
                let val = rest.trim();
                if val.starts_with('[') && val.ends_with(']') {
                    let inner = &val[1..val.len() - 1];
                    for item in inner.split(',') {
                        let cleaned = item.trim().trim_matches('"').trim_matches('\'').trim();
                        if !cleaned.is_empty() {
                            repos.push(cleaned.to_string());
                        }
                    }
                }
            }
        }
    }
    repos
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
    let mut feat_repositories = Vec::new();
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

                    feat_repositories = parse_frontmatter_repositories(&pcontent);
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

    // Dynamic feature status resolution based on task execution DAG
    if !tasks.is_empty() {
        let all_tasks_done = tasks.iter().all(|t| {
            t.status == "Done" || t.status == "Completed" || t.status == "Skipped/Canceled" || t.status == "Rewritten"
        });
        if all_tasks_done {
            feat_status = "Completed".to_string();
        } else if tasks.iter().any(|t| t.status == "In Progress") {
            feat_status = "In Progress".to_string();
        }
    }

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
        repositories: feat_repositories,
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
                    let all_features_completed = features.iter().all(|f| {
                        f.status == "Completed"
                            || f.status == "Done"
                            || (!f.tasks.is_empty()
                                && f.tasks.iter().all(|t| {
                                    t.status == "Done"
                                        || t.status == "Completed"
                                        || t.status == "Skipped/Canceled"
                                        || t.status == "Rewritten"
                                }))
                    });
                    let all_tasks_done = features.iter().all(|f| {
                        f.tasks.is_empty() || f.tasks.iter().all(|t| {
                            t.status == "Done" || t.status == "Completed" || t.status == "Skipped/Canceled" || t.status == "Rewritten"
                        })
                    });
                    let has_tasks = features.iter().any(|f| !f.tasks.is_empty());
                    let any_in_progress = features.iter().any(|f| f.status == "In Progress")
                        || features.iter().any(|f| f.tasks.iter().any(|t| t.status == "In Progress"));

                    if (all_features_completed && all_tasks_done) || (has_tasks && all_tasks_done) {
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

                let mut epic_repositories = Vec::new();
                for f in &features {
                    for r in &f.repositories {
                        if !epic_repositories.contains(r) {
                            epic_repositories.push(r.clone());
                        }
                    }
                }

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
                    repositories: epic_repositories,
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

// @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-001
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

// @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-001
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

// @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-001
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

// @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-001
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

// @implements ft-core-epic-hub::TASK-CORE-007-3::REQ-008
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

// @implements ft-core-epic-hub::TASK-CORE-007-3::REQ-008
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

// @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-001
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

// @implements ft-core-omni-search-fulltext::TASK-CORE-009-7::REQ-010
async fn list_code_files_handler(
    State(state): State<AppState>,
) -> Json<Vec<CodeFileInfo>> {
    let registry = state.registry.read().await;
    let active = registry.get_active().or_else(|| registry.list().into_iter().next());
    if let Some(proj) = active {
        if let Some(code_path) = &proj.codebase_path {
            if code_path.exists() {
                return Json(scan_codebase_files(code_path));
            }
        }
    }
    Json(Vec::new())
}

// @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-001
// @implements ft-core-omni-search-fulltext::TASK-CORE-009-8::REQ-011
// @implements ft-core-workspace-path-normalization::TASK-CORE-014-1::REQ-002
// @implements ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-1::REQ-002
// @implements ft-core-multirepo-code-path-normalization::TASK-CORE-016-1::REQ-002
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

    let root_dir = resolve_workspace_root();

    // Check relative to codebase container under workspace root: <root>/codebase/<query.path>
    let codebase_rel = root_dir.join("codebase").join(&query.path);
    if codebase_rel.exists() && codebase_rel.is_file() {
        return match std::fs::read_to_string(&codebase_rel) {
            Ok(content) => Ok(content),
            Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        };
    }

    let root_rel = root_dir.join(&query.path);
    if root_rel.exists() && root_rel.is_file() {
        return match std::fs::read_to_string(&root_rel) {
            Ok(content) => Ok(content),
            Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        };
    }

    let registry = state.registry.read().await;
    let active_project = registry.get_active().or_else(|| registry.list().into_iter().next());
    let target_path = if let Some(proj) = active_project {
        if proj.specs_path.exists() {
            proj.specs_path.clone()
        } else {
            root_dir.join(format!("{}-specs", proj.name))
        }
    } else {
        root_dir.join("aico-specs")
    };

    let rel_path = target_path.join(&query.path);
    if rel_path.exists() && rel_path.is_file() {
        match std::fs::read_to_string(&rel_path) {
            Ok(content) => Ok(content),
            Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
        }
    } else {
        // Also resolve relative to project codebase_path if available
        if let Some(proj) = active_project {
            if let Some(code_path) = &proj.codebase_path {
                let code_rel = code_path.join(&query.path);
                if code_rel.exists() && code_rel.is_file() {
                    return match std::fs::read_to_string(&code_rel) {
                        Ok(content) => Ok(content),
                        Err(_) => Err(StatusCode::INTERNAL_SERVER_ERROR),
                    };
                }
            }
        }
        Err(StatusCode::NOT_FOUND)
    }
}

// @implements ft-core-webui-shell::TASK-CORE-006-8::REQ-012
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

// @implements ft-git-backend-status::TASK-GIT-001-3::REQ-005
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-1::REQ-001
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-005
async fn get_git_status_handler(
    State(state): State<AppState>,
) -> Json<Vec<GitRepoStatus>> {
    let registry = state.registry.read().await;
    let active_project = registry.get_active().cloned().or_else(|| registry.list_cloned().into_iter().next());
    drop(registry);

    let results = if let Some(proj) = active_project {
        collect_project_git_status(&proj.specs_path).await
    } else {
        vec![]
    };

    Json(results)
}


// @implements ft-core-host-runtime::TASK-CORE-001-6::REQ-003
// @implements ft-core-host-runtime::TASK-CORE-001-6::REQ-007
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

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: Option<String>,
    pub project: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub id: String,
    pub title: String,
    pub scope: String,
    pub project_id: String,
    pub project_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub snippet: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
}

// @implements ft-core-omni-search-fulltext::TASK-CORE-009-5::REQ-008
async fn search_handler(
    State(state): State<AppState>,
    Query(params): Query<SearchQuery>,
) -> Json<Vec<SearchHit>> {
    let q = params.q.unwrap_or_default().trim().to_lowercase();
    if q.is_empty() {
        return Json(Vec::new());
    }

    let registry = state.registry.read().await;
    let mut hits = Vec::new();

    let projects_to_search: Vec<_> = if let Some(target_p) = &params.project {
        registry.list().into_iter().filter(|p| &p.id == target_p).cloned().collect()
    } else {
        registry.list().into_iter().cloned().collect()
    };

    for project in projects_to_search {
        let epics = scan_epics_for_project(&project.specs_path);
        for epic in epics {
            let mut matched = false;
            let mut snippet = None;

            if epic.id.to_lowercase().contains(&q) || epic.title.to_lowercase().contains(&q) {
                matched = true;
            } else if let Some(exec) = &epic.executive_summary {
                if exec.to_lowercase().contains(&q) {
                    matched = true;
                    snippet = Some(exec.clone());
                }
            } else if let Some(brain) = &epic.brainstorm_content {
                if brain.to_lowercase().contains(&q) {
                    matched = true;
                    snippet = Some("Matched in brainstorm notes".to_string());
                }
            }

            if matched {
                hits.push(SearchHit {
                    id: epic.id.clone(),
                    title: epic.title.clone(),
                    scope: "epics".to_string(),
                    project_id: project.id.clone(),
                    project_name: project.name.clone(),
                    snippet,
                    path: None,
                });
            }

            // Specs under epic
            // @implements ft-core-omni-search-fulltext::TASK-CORE-009-6::REQ-009
            for spec in epic.specs {
                let mut s_matched = false;
                let mut s_snippet = None;
                if spec.id.to_lowercase().contains(&q) || spec.title.to_lowercase().contains(&q) {
                    s_matched = true;
                } else if let Ok(content) = std::fs::read_to_string(&spec.path) {
                    if let Some(pos) = content.to_lowercase().find(&q) {
                        s_matched = true;
                        let start = pos.saturating_sub(40);
                        let end = (pos + q.len() + 40).min(content.len());
                        s_snippet = Some(format!("...{}...", &content[start..end].replace('\n', " ").trim()));
                    }
                }
                if s_matched {
                    hits.push(SearchHit {
                        id: spec.id.clone(),
                        title: spec.title.clone(),
                        scope: "specs".to_string(),
                        project_id: project.id.clone(),
                        project_name: project.name.clone(),
                        snippet: s_snippet,
                        path: Some(spec.path),
                    });
                }
            }

            // Features under epic
            for feat in epic.features {
                let mut f_matched = false;
                let mut f_snippet = None;
                if feat.id.to_lowercase().contains(&q) || feat.name.to_lowercase().contains(&q) {
                    f_matched = true;
                } else if let Some(desc) = &feat.description {
                    if desc.to_lowercase().contains(&q) {
                        f_matched = true;
                        f_snippet = Some(desc.clone());
                    }
                } else if let Some(scontent) = &feat.raw_spec_content {
                    if let Some(pos) = scontent.to_lowercase().find(&q) {
                        f_matched = true;
                        let start = pos.saturating_sub(40);
                        let end = (pos + q.len() + 40).min(scontent.len());
                        f_snippet = Some(format!("...{}...", &scontent[start..end].replace('\n', " ").trim()));
                    }
                }
                if f_matched {
                    hits.push(SearchHit {
                        id: feat.id.clone(),
                        title: feat.name.clone(),
                        scope: "features".to_string(),
                        project_id: project.id.clone(),
                        project_name: project.name.clone(),
                        snippet: f_snippet,
                        path: None,
                    });
                }
            }
        }

        // Standalone features
        let feat_dir = project.specs_path.join("features");
        if feat_dir.is_dir() {
            if let Ok(entries) = std::fs::read_dir(feat_dir) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(feat) = scan_feature_dir(&path, "", true) {
                            let mut f_matched = false;
                            let mut f_snippet = None;
                            if feat.id.to_lowercase().contains(&q) || feat.name.to_lowercase().contains(&q) {
                                f_matched = true;
                            } else if let Some(desc) = &feat.description {
                                if desc.to_lowercase().contains(&q) {
                                    f_matched = true;
                                    f_snippet = Some(desc.clone());
                                }
                            } else if let Some(scontent) = &feat.raw_spec_content {
                                if let Some(pos) = scontent.to_lowercase().find(&q) {
                                    f_matched = true;
                                    let start = pos.saturating_sub(40);
                                    let end = (pos + q.len() + 40).min(scontent.len());
                                    f_snippet = Some(format!("...{}...", &scontent[start..end].replace('\n', " ").trim()));
                                }
                            }
                            if f_matched {
                                hits.push(SearchHit {
                                    id: feat.id.clone(),
                                    title: feat.name.clone(),
                                    scope: "features".to_string(),
                                    project_id: project.id.clone(),
                                    project_name: project.name.clone(),
                                    snippet: f_snippet,
                                    path: None,
                                });
                            }

                            // Also index standalone spec if present
                            if let Some(ref sid) = feat.spec_id {
                                let mut s_matched = false;
                                let mut s_snippet = None;
                                let spec_title = feat.spec_title.clone().unwrap_or_else(|| sid.clone());
                                if sid.to_lowercase().contains(&q) || spec_title.to_lowercase().contains(&q) {
                                    s_matched = true;
                                } else if let Some(scontent) = &feat.raw_spec_content {
                                    if let Some(pos) = scontent.to_lowercase().find(&q) {
                                        s_matched = true;
                                        let start = pos.saturating_sub(40);
                                        let end = (pos + q.len() + 40).min(scontent.len());
                                        s_snippet = Some(format!("...{}...", &scontent[start..end].replace('\n', " ").trim()));
                                    }
                                }
                                if s_matched {
                                    hits.push(SearchHit {
                                        id: sid.clone(),
                                        title: spec_title,
                                        scope: "specs".to_string(),
                                        project_id: project.id.clone(),
                                        project_name: project.name.clone(),
                                        snippet: s_snippet,
                                        path: Some(path.join(format!("{}.md", sid)).to_string_lossy().to_string()),
                                    });
                                }
                            }
                        }
                    }
                }
            }
        }

        // Codebase search across project codebase_path
        // @implements ft-core-omni-search-fulltext::TASK-CORE-009-10::REQ-012
        // @implements ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-1::REQ-003
        // @implements ft-core-multirepo-code-path-normalization::TASK-CORE-016-1::REQ-003
        if let Some(code_path) = &project.codebase_path {
            if code_path.exists() {
                let code_files = scan_codebase_files(code_path);
                for file in code_files {
                    let mut matched = false;
                    let mut snippet = None;

                    if file.name.to_lowercase().contains(&q) || file.relative_path.to_lowercase().contains(&q) {
                        matched = true;
                    }

                    let full_file_path = if let Some(codebase_root) = code_path.parent() {
                        let p = codebase_root.join(&file.relative_path);
                        if p.exists() {
                            p
                        } else {
                            code_path.join(&file.relative_path)
                        }
                    } else {
                        code_path.join(&file.relative_path)
                    };

                    if let Ok(content) = std::fs::read_to_string(&full_file_path) {
                        if let Some(pos) = content.to_lowercase().find(&q) {
                            matched = true;
                            let line_num = content[..pos].lines().count().max(1);
                            let start = pos.saturating_sub(40);
                            let end = (pos + q.len() + 40).min(content.len());
                            snippet = Some(format!("Line {}: ...{}...", line_num, &content[start..end].replace('\n', " ").trim()));
                        }
                    }

                    if matched {
                        hits.push(SearchHit {
                            id: file.relative_path.clone(),
                            title: file.relative_path.clone(),
                            scope: "code".to_string(),
                            project_id: project.id.clone(),
                            project_name: project.name.clone(),
                            snippet,
                            path: Some(file.relative_path),
                        });
                    }
                }
            }
        }
    }

    Json(hits)
}

// ---------------------------------------------------------------------------
// PROJECT CREATOR, LINEAGE GRAPH & GIT OPERATIONS ENDPOINTS
// ---------------------------------------------------------------------------

pub fn get_workspace_root(registry: &WorkspaceRegistry) -> PathBuf {
    if let Ok(root_env) = std::env::var("AICO_ROOT") {
        return PathBuf::from(root_env);
    }
    if let Some(active) = registry.get_active() {
        if let Some(parent) = StdPath::new(&active.specs_path).parent() {
            return parent.to_path_buf();
        }
    }
    if let Some(first) = registry.list_cloned().first() {
        if let Some(parent) = StdPath::new(&first.specs_path).parent() {
            return parent.to_path_buf();
        }
    }
    if StdPath::new("d:/aico").exists() {
        PathBuf::from("d:/aico")
    } else {
        std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."))
    }
}

fn format_rfc3339_utc(secs: u64) -> String {
    let sec = (secs % 60) as u32;
    let min = ((secs / 60) % 60) as u32;
    let hour = ((secs / 3600) % 24) as u32;
    let mut days = (secs / 86400) as i64;

    let mut year = 1970;
    loop {
        let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
        let days_in_year = if leap { 366 } else { 365 };
        if days < days_in_year {
            break;
        }
        days -= days_in_year;
        year += 1;
    }

    let leap = (year % 4 == 0 && year % 100 != 0) || (year % 400 == 0);
    let days_in_months = [
        31, if leap { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,
    ];
    let mut month = 1;
    for &dim in &days_in_months {
        if days < dim {
            break;
        }
        days -= dim;
        month += 1;
    }
    let day = days + 1;
    format!("{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z", year, month, day, hour, min, sec)
}

#[derive(Debug, Deserialize)]
pub struct CreateProjectRequest {
    pub name: String,
}

// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-007
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-2::REQ-010
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-2::REQ-012
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-009
async fn handle_create_project(
    State(state): State<AppState>,
    Json(payload): Json<CreateProjectRequest>,
) -> impl IntoResponse {
    let raw = payload.name.trim();
    let raw_stripped = raw.strip_suffix("-specs").unwrap_or(raw).trim();
    let slug = raw_stripped.to_lowercase().replace(' ', "-").replace('_', "-");

    if slug.is_empty()
        || !slug.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-')
        || slug.starts_with('-')
        || slug.ends_with('-')
    {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "Invalid project name: must be non-empty lowercase alphanumeric with hyphens"
            })),
        ).into_response();
    }

    let registry = state.registry.read().await;
    let ws_root = get_workspace_root(&registry);
    drop(registry);

    let target_specs_dir = ws_root.join(format!("{}-specs", slug));
    if target_specs_dir.exists() {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({
                "error": format!("Project specifications directory already exists: {}", target_specs_dir.display())
            })),
        ).into_response();
    }

    let subdirs = [".aico", "adr", "epics", "features"];
    for sub in &subdirs {
        if let Err(e) = std::fs::create_dir_all(target_specs_dir.join(sub)) {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": format!("Failed to create directory {}: {}", sub, e) })),
            ).into_response();
        }
    }

    let title = slug
        .split('-')
        .map(|word| {
            let mut chars = word.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect::<Vec<_>>()
        .join(" ");

    let secs = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let now = format_rfc3339_utc(secs);

    let manifest_json = serde_json::json!({
        "project_name": slug,
        "id": format!("{}-specs", slug),
        "name": format!("{} Specs", title),
        "url": "",
        "created_at": now,
        "repositories": [
            {
                "id": slug,
                "name": format!("{} Codebase", title),
                "path": format!("../codebase/{}", slug),
                "url": "",
                "type": "codebase"
            }
        ]
    });
    if let Err(e) = std::fs::write(
        target_specs_dir.join(".aico-project.json"),
        serde_json::to_string_pretty(&manifest_json).unwrap_or_default(),
    ) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to write .aico-project.json: {}", e) })),
        ).into_response();
    }

    let glossary_content = format!(
        "---\nid: glossary-{slug}\ntype: glossary\naico_skills_version: \"0.1.2\"\ntitle: \"{title} Ubiquitous Domain Glossary\"\nstatus: \"Draft\"\nderives_from: []\ncreated_at: \"{now}\"\n---\n\n# {title} Ubiquitous Domain Glossary\n\n## 1. Core Domain Terms\n"
    );
    if let Err(e) = std::fs::write(target_specs_dir.join("glossary.md"), glossary_content) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": format!("Failed to write glossary.md: {}", e) })),
        ).into_response();
    }

    let _ = std::process::Command::new("git")
        .arg("init")
        .current_dir(&target_specs_dir)
        .output();

    let codebase_dir = ws_root.join("codebase").join(&slug);
    let codebase_path = if codebase_dir.exists() { Some(codebase_dir) } else { None };
    let proj_status = if codebase_path.is_some() {
        ProjectStatus::Active
    } else {
        ProjectStatus::CodebaseMissing
    };

    let mut reg = state.registry.write().await;
    let proj = DiscoveredProject {
        id: format!("{}-specs", slug),
        name: format!("{} Specs", title),
        specs_path: target_specs_dir.clone(),
        codebase_path,
        manifest: aico_core::ProjectManifest {
            name: slug.clone(),
            version: Some("0.1.0".to_string()),
            codebase_path: Some(format!("../codebase/{}", slug)),
            created_at: Some(now),
            repositories: Some(vec![
                aico_core::ProjectRepository {
                    id: slug.clone(),
                    name: format!("{} Codebase", title),
                    path: format!("../codebase/{}", slug),
                    repo_type: "codebase".to_string(),
                    url: None,
                }
            ]),
        },
        status: proj_status,
    };
    reg.register(proj.clone());
    reg.set_active(&proj.id);
    drop(reg);

    state.ws_hub.broadcast("active_project_changed", &proj.id);

    (StatusCode::CREATED, Json(proj)).into_response()
}

#[derive(Debug, Deserialize)]
pub struct GraphQuery {
    pub project: Option<String>,
    pub epic: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LineageNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub label: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub status: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub epic: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LineageEdge {
    pub source: String,
    pub target: String,
    pub relation: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LineageGraphResponse {
    pub nodes: Vec<LineageNode>,
    pub edges: Vec<LineageEdge>,
}

// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-005
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-14::REQ-023
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
async fn handle_get_graph(
    State(state): State<AppState>,
    Query(query): Query<GraphQuery>,
) -> impl IntoResponse {
    let registry = state.registry.read().await;
    let active_project = if let Some(ref pid) = query.project {
        registry.list_cloned().into_iter().find(|p| p.id == *pid || p.name == *pid)
    } else {
        registry.get_active().cloned().or_else(|| registry.list_cloned().into_iter().next())
    };
    drop(registry);

    let proj = match active_project {
        Some(p) => p,
        None => return (StatusCode::OK, Json(LineageGraphResponse { nodes: vec![], edges: vec![] })).into_response(),
    };

    let full_graph = build_specs_lineage_graph(&proj.specs_path);

    // Persist snapshot to <specs_root>/.aico/storage/graph/lineage_graph.json
    let graph_storage_dir = proj.specs_path.join(".aico").join("storage").join("graph");
    let _ = std::fs::create_dir_all(&graph_storage_dir);
    let snapshot_file = graph_storage_dir.join("lineage_graph.json");
    if let Ok(serialized) = serde_json::to_string_pretty(&full_graph) {
        let _ = std::fs::write(snapshot_file, serialized);
    }

    // Optional filtering by epic
    let epic_filter = query.epic.as_deref().unwrap_or("all");
    let response_graph = if epic_filter != "all" && !epic_filter.trim().is_empty() {
        let mut matching_node_ids = std::collections::HashSet::new();

        for node in &full_graph.nodes {
            if node.id == epic_filter || node.epic.as_deref() == Some(epic_filter) {
                matching_node_ids.insert(node.id.clone());
            }
        }

        // Include connected ADR nodes (outgoing edge into this epic's nodes) and code seam nodes
        let mut extra_node_ids = std::collections::HashSet::new();
        for edge in &full_graph.edges {
            if matching_node_ids.contains(&edge.target) {
                if let Some(src_node) = full_graph.nodes.iter().find(|n| n.id == edge.source) {
                    if src_node.node_type == "adr" {
                        extra_node_ids.insert(edge.source.clone());
                    }
                }
            }
            if matching_node_ids.contains(&edge.source) {
                if let Some(tgt_node) = full_graph.nodes.iter().find(|n| n.id == edge.target) {
                    if tgt_node.node_type == "code" {
                        extra_node_ids.insert(edge.target.clone());
                    }
                }
            }
        }
        matching_node_ids.extend(extra_node_ids);

        let filtered_nodes: Vec<LineageNode> = full_graph
            .nodes
            .into_iter()
            .filter(|n| matching_node_ids.contains(&n.id))
            .collect();

        let filtered_edges: Vec<LineageEdge> = full_graph
            .edges
            .into_iter()
            .filter(|e| matching_node_ids.contains(&e.source) && matching_node_ids.contains(&e.target))
            .collect();

        LineageGraphResponse {
            nodes: filtered_nodes,
            edges: filtered_edges,
        }
    } else {
        full_graph
    };

    (StatusCode::OK, Json(response_graph)).into_response()
}

fn normalize_artifact_id(raw: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.to_ascii_lowercase().starts_with("adr-") {
        trimmed.to_ascii_uppercase()
    } else {
        trimmed.to_string()
    }
}

fn parse_graph_frontmatter(content: &str) -> (std::collections::HashMap<String, String>, Vec<String>) {
    let mut fields = std::collections::HashMap::new();
    let mut derives_from = Vec::new();

    if !content.starts_with("---") {
        return (fields, derives_from);
    }

    let end_idx = match content[3..].find("---") {
        Some(idx) => idx + 3,
        None => return (fields, derives_from),
    };

    let fm_block = &content[3..end_idx];
    for line in fm_block.lines() {
        let line = line.trim();
        if line.starts_with("derives_from:") {
            let list_part = line["derives_from:".len()..].trim();
            if list_part.starts_with('[') && list_part.ends_with(']') {
                let inner = &list_part[1..list_part.len() - 1];
                for item in inner.split(',') {
                    let cleaned = item.trim().trim_matches('"').trim_matches('\'').trim();
                    if !cleaned.is_empty() {
                        derives_from.push(normalize_artifact_id(cleaned));
                    }
                }
            }
        } else if let Some((k, v)) = line.split_once(':') {
            let key = k.trim().to_string();
            let val = v.trim().trim_matches('"').trim_matches('\'').to_string();
            fields.insert(key, val);
        }
    }

    (fields, derives_from)
}

// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-005
// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-14::REQ-023
fn build_specs_lineage_graph(specs_dir: &StdPath) -> LineageGraphResponse {
    let mut nodes_map: std::collections::HashMap<String, LineageNode> = std::collections::HashMap::new();
    let mut edges: Vec<LineageEdge> = Vec::new();

    // 1. ADRs: <specs_dir>/adr/*.md
    let adr_dir = specs_dir.join("adr");
    if adr_dir.exists() {
        if let Ok(entries) = std::fs::read_dir(adr_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) == Some("md") {
                    if let Ok(content) = std::fs::read_to_string(&path) {
                        let (fm, derives) = parse_graph_frontmatter(&content);
                        let file_stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or("ADR");
                        let raw_adr_id = fm.get("id").cloned().unwrap_or_else(|| {
                            if file_stem.starts_with("000") || file_stem.starts_with("001") {
                                format!("ADR-{}", &file_stem[..4.min(file_stem.len())])
                            } else {
                                file_stem.to_string()
                            }
                        });
                        let adr_id = normalize_artifact_id(&raw_adr_id);
                        let title = fm.get("title").cloned().unwrap_or_else(|| file_stem.to_string());
                        let status = fm.get("status").cloned();
                        let rel_path = path.strip_prefix(specs_dir).map(|p| p.to_string_lossy().replace('\\', "/")).ok();

                        nodes_map.insert(adr_id.clone(), LineageNode {
                            id: adr_id.clone(),
                            node_type: "adr".to_string(),
                            label: format!("{}: {}", adr_id, title),
                            path: rel_path,
                            status,
                            epic: None,
                        });

                        for d in derives {
                            edges.push(LineageEdge {
                                source: d,
                                target: adr_id.clone(),
                                relation: "derives_from".to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    // 2. Epics: <specs_dir>/epics/ec-*
    let epics_dir = specs_dir.join("epics");
    if epics_dir.exists() {
        if let Ok(epic_entries) = std::fs::read_dir(epics_dir) {
            for epic_entry in epic_entries.flatten() {
                let epic_path = epic_entry.path();
                if epic_path.is_dir() {
                    let epic_id = epic_path.file_name().and_then(|n| n.to_str()).unwrap_or("").to_string();
                    if epic_id.starts_with("ec-") {
                        let rel_path = epic_path.strip_prefix(specs_dir).map(|p| p.to_string_lossy().replace('\\', "/")).ok();
                        nodes_map.insert(epic_id.clone(), LineageNode {
                            id: epic_id.clone(),
                            node_type: "epic".to_string(),
                            label: format!("Epic {}", epic_id),
                            path: rel_path,
                            status: Some("Active".to_string()),
                            epic: Some(epic_id.clone()),
                        });

                        if let Ok(files) = std::fs::read_dir(&epic_path) {
                            for f in files.flatten() {
                                let fpath = f.path();
                                let fname = fpath.file_name().and_then(|n| n.to_str()).unwrap_or("");
                                if fname.starts_with("brain-") && fname.ends_with(".md") {
                                    if let Ok(content) = std::fs::read_to_string(&fpath) {
                                        let (fm, derives) = parse_graph_frontmatter(&content);
                                        let b_id = fm.get("id").cloned().unwrap_or_else(|| fpath.file_stem().unwrap().to_string_lossy().to_string());
                                        let b_title = fm.get("title").cloned().unwrap_or_else(|| b_id.clone());
                                        let b_status = fm.get("status").cloned();
                                        let b_rel = fpath.strip_prefix(specs_dir).map(|p| p.to_string_lossy().replace('\\', "/")).ok();

                                        nodes_map.insert(b_id.clone(), LineageNode {
                                            id: b_id.clone(),
                                            node_type: "brainstorm".to_string(),
                                            label: format!("{}: {}", b_id, b_title),
                                            path: b_rel,
                                            status: b_status,
                                            epic: Some(epic_id.clone()),
                                        });

                                        edges.push(LineageEdge {
                                            source: epic_id.clone(),
                                            target: b_id.clone(),
                                            relation: "brainstorm".to_string(),
                                        });

                                        for d in derives {
                                            if d.starts_with("ADR-") {
                                                edges.push(LineageEdge {
                                                    source: d.clone(),
                                                    target: epic_id.clone(),
                                                    relation: "governs".to_string(),
                                                });
                                            }
                                            edges.push(LineageEdge {
                                                source: d,
                                                target: b_id.clone(),
                                                relation: "derives_from".to_string(),
                                            });
                                        }
                                    }
                                } else if fname.starts_with("deepdive-") && fname.ends_with(".md") {
                                    if let Ok(content) = std::fs::read_to_string(&fpath) {
                                        let (fm, derives) = parse_graph_frontmatter(&content);
                                        let dd_id = fm.get("id").cloned().unwrap_or_else(|| fpath.file_stem().unwrap().to_string_lossy().to_string());
                                        let dd_title = fm.get("title").cloned().unwrap_or_else(|| dd_id.clone());
                                        let dd_status = fm.get("status").cloned();
                                        let dd_rel = fpath.strip_prefix(specs_dir).map(|p| p.to_string_lossy().replace('\\', "/")).ok();

                                        nodes_map.insert(dd_id.clone(), LineageNode {
                                            id: dd_id.clone(),
                                            node_type: "deepdive".to_string(),
                                            label: format!("{}: {}", dd_id, dd_title),
                                            path: dd_rel,
                                            status: dd_status,
                                            epic: Some(epic_id.clone()),
                                        });

                                        edges.push(LineageEdge {
                                            source: epic_id.clone(),
                                            target: dd_id.clone(),
                                            relation: "deepdive".to_string(),
                                        });

                                        for d in derives {
                                            if d.starts_with("ADR-") {
                                                edges.push(LineageEdge {
                                                    source: d.clone(),
                                                    target: epic_id.clone(),
                                                    relation: "governs".to_string(),
                                                });
                                            }
                                            edges.push(LineageEdge {
                                                source: d,
                                                target: dd_id.clone(),
                                                relation: "derives_from".to_string(),
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        let feats_dir = epic_path.join("features");
                        if feats_dir.exists() {
                            scan_features_for_graph(&feats_dir, Some(&epic_id), specs_dir, &mut nodes_map, &mut edges);
                        }
                    }
                }
            }
        }
    }

    // 3. Standalone features: <specs_dir>/features/ft-*
    let standalone_feats = specs_dir.join("features");
    if standalone_feats.exists() {
        scan_features_for_graph(&standalone_feats, None, specs_dir, &mut nodes_map, &mut edges);
    }

    // Deduplicate edges while preserving insertion order
    let mut seen_edges = std::collections::HashSet::new();
    let dedup_edges: Vec<LineageEdge> = edges
        .into_iter()
        .filter(|e| seen_edges.insert((e.source.clone(), e.target.clone(), e.relation.clone())))
        .collect();

    let mut nodes: Vec<LineageNode> = nodes_map.into_values().collect();
    nodes.sort_by(|a, b| a.id.cmp(&b.id));

    LineageGraphResponse {
        nodes,
        edges: dedup_edges,
    }
}

fn scan_features_for_graph(
    features_dir: &StdPath,
    epic_id: Option<&str>,
    specs_dir: &StdPath,
    nodes_map: &mut std::collections::HashMap<String, LineageNode>,
    edges: &mut Vec<LineageEdge>,
) {
    let entries = match std::fs::read_dir(features_dir) {
        Ok(e) => e,
        Err(_) => return,
    };

    for entry in entries.flatten() {
        let feat_path = entry.path();
        if !feat_path.is_dir() {
            continue;
        }
        let feat_id = match feat_path.file_name().and_then(|n| n.to_str()) {
            Some(name) if name.starts_with("ft-") => name.to_string(),
            _ => continue,
        };

        let feat_rel = feat_path.strip_prefix(specs_dir).map(|p| p.to_string_lossy().replace('\\', "/")).ok();
        nodes_map.insert(feat_id.clone(), LineageNode {
            id: feat_id.clone(),
            node_type: "feature".to_string(),
            label: format!("Feature {}", feat_id),
            path: feat_rel,
            status: Some("Active".to_string()),
            epic: epic_id.map(|s| s.to_string()),
        });

        if let Some(eid) = epic_id {
            edges.push(LineageEdge {
                source: eid.to_string(),
                target: feat_id.clone(),
                relation: "contains".to_string(),
            });
        }

        let mut spec_id_opt: Option<String> = None;
        let mut plan_id_opt: Option<String> = None;

        if let Ok(files) = std::fs::read_dir(&feat_path) {
            let mut file_paths: Vec<PathBuf> = files.flatten().map(|f| f.path()).collect();
            // Process spec-*.md before plan-*.md so spec_id_opt is populated when resolving task Addresses
            file_paths.sort_by(|a, b| {
                let a_name = a.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let b_name = b.file_name().and_then(|n| n.to_str()).unwrap_or("");
                let a_is_spec = a_name.starts_with("spec-");
                let b_is_spec = b_name.starts_with("spec-");
                b_is_spec.cmp(&a_is_spec).then_with(|| a_name.cmp(b_name))
            });

            for fpath in file_paths {
                let fname = fpath.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if fname.starts_with("spec-") && fname.ends_with(".md") {
                    if let Ok(content) = std::fs::read_to_string(&fpath) {
                        let (fm, derives) = parse_graph_frontmatter(&content);
                        let s_id = fm.get("id").cloned().unwrap_or_else(|| fpath.file_stem().unwrap().to_string_lossy().to_string());
                        let s_title = fm.get("title").cloned().unwrap_or_else(|| s_id.clone());
                        let s_status = fm.get("status").cloned();
                        let s_rel = fpath.strip_prefix(specs_dir).map(|p| p.to_string_lossy().replace('\\', "/")).ok();

                        nodes_map.insert(s_id.clone(), LineageNode {
                            id: s_id.clone(),
                            node_type: "spec".to_string(),
                            label: format!("{}: {}", s_id, s_title),
                            path: s_rel,
                            status: s_status,
                            epic: epic_id.map(|s| s.to_string()),
                        });

                        edges.push(LineageEdge {
                            source: feat_id.clone(),
                            target: s_id.clone(),
                            relation: "specifies".to_string(),
                        });

                        for d in derives {
                            if d.starts_with("ADR-") {
                                if let Some(eid) = epic_id {
                                    edges.push(LineageEdge {
                                        source: d.clone(),
                                        target: eid.to_string(),
                                        relation: "governs".to_string(),
                                    });
                                }
                            }
                            edges.push(LineageEdge {
                                source: d,
                                target: s_id.clone(),
                                relation: "derives_from".to_string(),
                            });
                        }

                        for line in content.lines() {
                            let line = line.trim();
                            if let Some(pos) = line.find("REQ-") {
                                let rem = &line[pos..];
                                let req_code: String = rem.chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
                                if req_code.starts_with("REQ-") && req_code.len() >= 5 {
                                    let req_node_id = format!("{}::{}", s_id, req_code);
                                    nodes_map.entry(req_node_id.clone()).or_insert_with(|| LineageNode {
                                        id: req_node_id.clone(),
                                        node_type: "requirement".to_string(),
                                        label: req_code.clone(),
                                        path: None,
                                        status: None,
                                        epic: epic_id.map(|s| s.to_string()),
                                    });
                                    edges.push(LineageEdge {
                                        source: s_id.clone(),
                                        target: req_node_id.clone(),
                                        relation: "specifies".to_string(),
                                    });
                                    // REQ-020: Direct Feature -> Requirement edge
                                    edges.push(LineageEdge {
                                        source: feat_id.clone(),
                                        target: req_node_id,
                                        relation: "specifies".to_string(),
                                    });
                                }
                            }
                        }

                        spec_id_opt = Some(s_id);
                    }
                } else if fname.starts_with("plan-") && fname.ends_with(".md") {
                    if let Ok(content) = std::fs::read_to_string(&fpath) {
                        let (fm, derives) = parse_graph_frontmatter(&content);
                        let p_id = fm.get("id").cloned().unwrap_or_else(|| fpath.file_stem().unwrap().to_string_lossy().to_string());
                        let p_title = fm.get("title").cloned().unwrap_or_else(|| p_id.clone());
                        let p_status = fm.get("status").cloned();
                        let p_rel = fpath.strip_prefix(specs_dir).map(|p| p.to_string_lossy().replace('\\', "/")).ok();

                        nodes_map.insert(p_id.clone(), LineageNode {
                            id: p_id.clone(),
                            node_type: "plan".to_string(),
                            label: format!("{}: {}", p_id, p_title),
                            path: p_rel,
                            status: p_status,
                            epic: epic_id.map(|s| s.to_string()),
                        });

                        edges.push(LineageEdge {
                            source: feat_id.clone(),
                            target: p_id.clone(),
                            relation: "contains".to_string(),
                        });

                        for d in derives {
                            if d.starts_with("ADR-") {
                                if let Some(eid) = epic_id {
                                    edges.push(LineageEdge {
                                        source: d.clone(),
                                        target: eid.to_string(),
                                        relation: "governs".to_string(),
                                    });
                                }
                            }
                            edges.push(LineageEdge {
                                source: d,
                                target: p_id.clone(),
                                relation: "derives_from".to_string(),
                            });
                        }

                        let mut current_task_id: Option<String> = None;
                        for line in content.lines() {
                            let line = line.trim();
                            // REQ-023: Strict task declaration parsing (starts with - **TASK-, * **TASK-, ### TASK-, or **TASK-)
                            let is_task_decl = (line.starts_with("- **TASK-")
                                || line.starts_with("* **TASK-")
                                || line.starts_with("### TASK-")
                                || line.starts_with("**TASK-"))
                                && line.contains("TASK-");
                            if is_task_decl {
                                if let Some(pos) = line.find("TASK-") {
                                    let rem = &line[pos..];
                                    let task_code: String = rem.chars().take_while(|c| c.is_ascii_alphanumeric() || *c == '-').collect();
                                    if task_code.starts_with("TASK-") && task_code.len() >= 6 {
                                        current_task_id = Some(task_code.clone());
                                        nodes_map.entry(task_code.clone()).or_insert_with(|| LineageNode {
                                            id: task_code.clone(),
                                            node_type: "task".to_string(),
                                            label: task_code.clone(),
                                            path: None,
                                            status: None,
                                            epic: epic_id.map(|s| s.to_string()),
                                        });
                                        edges.push(LineageEdge {
                                            source: p_id.clone(),
                                            target: task_code.clone(),
                                            relation: "contains".to_string(),
                                        });
                                        // REQ-020: Direct Feature -> Task edge
                                        edges.push(LineageEdge {
                                            source: feat_id.clone(),
                                            target: task_code,
                                            relation: "contains".to_string(),
                                        });
                                    }
                                }
                            } else if let Some(ref tid) = current_task_id {
                                if line.contains("Addresses") && line.contains("REQ-") {
                                    for word in line.split(&[' ', ',', '`', '"', '[', ']', '*'][..]) {
                                        let w = word.trim();
                                        if w.starts_with("REQ-") {
                                            let target_req = if let Some(ref sid) = spec_id_opt {
                                                format!("{}::{}", sid, w)
                                            } else {
                                                w.to_string()
                                            };
                                            edges.push(LineageEdge {
                                                source: tid.clone(),
                                                target: target_req,
                                                relation: "addresses".to_string(),
                                            });
                                        }
                                    }
                                } else if line.contains("Verification Seam") {
                                    if let Some((_, seam)) = line.split_once(':') {
                                        let seam_clean = seam
                                            .trim()
                                            .trim_start_matches('*')
                                            .trim()
                                            .trim_matches('`')
                                            .trim();
                                        if !seam_clean.is_empty() {
                                            let code_id = format!("code:{}", seam_clean);
                                            nodes_map.entry(code_id.clone()).or_insert_with(|| LineageNode {
                                                id: code_id.clone(),
                                                node_type: "code".to_string(),
                                                label: seam_clean.to_string(),
                                                path: Some(seam_clean.to_string()),
                                                status: None,
                                                epic: epic_id.map(|s| s.to_string()),
                                            });
                                            edges.push(LineageEdge {
                                                source: tid.clone(),
                                                target: code_id.clone(),
                                                relation: "verifies".to_string(),
                                            });
                                            // Also emit rolled-up Plan -> Code edge for clean lineage view
                                            edges.push(LineageEdge {
                                                source: p_id.clone(),
                                                target: code_id.clone(),
                                                relation: "verifies".to_string(),
                                            });
                                            // REQ-020: Direct Feature -> Code edge
                                            edges.push(LineageEdge {
                                                source: feat_id.clone(),
                                                target: code_id,
                                                relation: "verifies".to_string(),
                                            });
                                        }
                                    }
                                }
                            }
                        }

                        plan_id_opt = Some(p_id);
                    }
                }
            }
        }

        if let (Some(sid), Some(pid)) = (spec_id_opt, plan_id_opt) {
            edges.push(LineageEdge {
                source: sid,
                target: pid,
                relation: "derives_from".to_string(),
            });
        }
    }
}

async fn resolve_repo_dir(state: &AppState, repo_id: Option<&str>, path: Option<&str>) -> Result<PathBuf, String> {
    if let Some(p) = path {
        if !p.trim().is_empty() {
            let path_buf = PathBuf::from(p);
            if path_buf.exists() {
                return Ok(path_buf);
            }
        }
    }

    let registry = state.registry.read().await;
    let active = registry.get_active().cloned().or_else(|| registry.list_cloned().into_iter().next());
    drop(registry);

    let proj = active.ok_or_else(|| "No active project registered".to_string())?;

    if let Some(rid) = repo_id {
        if rid == proj.id || rid == format!("{}-specs", proj.manifest.name) {
            return Ok(proj.specs_path);
        }

        let effective = proj.manifest.get_effective_repositories(&proj.specs_path);
        for r in effective {
            if r.id == rid {
                return Ok(PathBuf::from(r.path));
            }
        }
        return Err(format!("Repository '{}' not found in active project", rid));
    }

    Ok(proj.specs_path)
}

#[derive(Debug, Deserialize)]
pub struct GitActionRequest {
    pub repo_id: Option<String>,
    pub path: Option<String>,
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
async fn handle_git_pull(
    State(state): State<AppState>,
    Json(payload): Json<GitActionRequest>,
) -> impl IntoResponse {
    let repo_dir = match resolve_repo_dir(&state, payload.repo_id.as_deref(), payload.path.as_deref()).await {
        Ok(dir) => dir,
        Err(err) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": err }))).into_response(),
    };

    match git_pull_repo(&repo_dir) {
        Ok(msg) => (StatusCode::OK, Json(serde_json::json!({ "status": "ok", "message": msg }))).into_response(),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": err }))).into_response(),
    }
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
async fn handle_git_push(
    State(state): State<AppState>,
    Json(payload): Json<GitActionRequest>,
) -> impl IntoResponse {
    let repo_dir = match resolve_repo_dir(&state, payload.repo_id.as_deref(), payload.path.as_deref()).await {
        Ok(dir) => dir,
        Err(err) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": err }))).into_response(),
    };

    match git_push_repo(&repo_dir) {
        Ok(msg) => (StatusCode::OK, Json(serde_json::json!({ "status": "ok", "message": msg }))).into_response(),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": err }))).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct GitCommitRequest {
    pub repo_id: Option<String>,
    pub path: Option<String>,
    #[serde(default)]
    pub message: String,
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-008
async fn handle_git_commit(
    State(state): State<AppState>,
    Json(payload): Json<GitCommitRequest>,
) -> impl IntoResponse {
    let trimmed = payload.message.trim();
    if trimmed.is_empty() {
        return (
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "Commit message cannot be empty (REQ-008)" })),
        ).into_response();
    }

    let repo_dir = match resolve_repo_dir(&state, payload.repo_id.as_deref(), payload.path.as_deref()).await {
        Ok(dir) => dir,
        Err(err) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": err }))).into_response(),
    };

    match git_commit_repo(&repo_dir, trimmed) {
        Ok(msg) => (StatusCode::OK, Json(serde_json::json!({ "status": "ok", "message": msg }))).into_response(),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": err }))).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct GitAiCommitRequest {
    #[serde(default)]
    pub project: Option<String>,
    #[serde(default)]
    pub repo_id: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
}

// @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-4::REQ-004
async fn handle_git_ai_commit(
    State(state): State<AppState>,
    Json(payload): Json<GitAiCommitRequest>,
) -> impl IntoResponse {
    let repo_dir = match resolve_repo_dir(&state, payload.repo_id.as_deref(), payload.path.as_deref()).await {
        Ok(dir) => dir,
        Err(err) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": err }))).into_response(),
    };

    match git_ai_commit_repo(&repo_dir) {
        Ok(msg) => (StatusCode::OK, Json(serde_json::json!({ "status": "ok", "message": msg }))).into_response(),
        Err(err) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": err }))).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct GitCloneRequest {
    pub repo_id: String,
    pub url: String,
    #[serde(rename = "type", default)]
    pub repo_type: Option<String>,
    #[serde(default)]
    pub workspace_root: Option<String>,
}

// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-006
// @implements spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-007
async fn handle_git_clone(
    State(state): State<AppState>,
    Json(payload): Json<GitCloneRequest>,
) -> impl IntoResponse {
    let registry = state.registry.read().await;
    let ws_root = match payload.workspace_root {
        Some(ref r) if !r.trim().is_empty() => PathBuf::from(r),
        _ => get_workspace_root(&registry),
    };
    drop(registry);

    let repo_type = payload.repo_type.as_deref().unwrap_or("codebase");
    match git_clone_repo(&ws_root, &payload.repo_id, &payload.url, repo_type) {
        Ok(target) => (
            StatusCode::OK,
            Json(serde_json::json!({
                "status": "ok",
                "target_dir": target.to_string_lossy().to_string(),
            })),
        ).into_response(),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": err })),
        ).into_response(),
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct PopupNotificationRequest {
    pub title: String,
    pub message: String,
    #[serde(default)]
    pub status: Option<String>,
}

// @implements spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
async fn handle_popup_notification(
    Json(payload): Json<PopupNotificationRequest>,
) -> impl IntoResponse {
    #[cfg(target_os = "windows")]
    {
        if std::env::var("AICO_DISABLE_OS_POPUP").unwrap_or_default() != "1" {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x08000000;
            let safe_title = payload.title.replace('"', "`\"");
            let safe_message = payload.message.replace('"', "`\"");
            let script = format!(
                "[void] [System.Reflection.Assembly]::LoadWithPartialName('System.Windows.Forms'); \
                 $notify = New-Object System.Windows.Forms.NotifyIcon; \
                 $notify.Icon = [System.Drawing.SystemIcons]::Information; \
                 $notify.BalloonTipTitle = \"{}\"; \
                 $notify.BalloonTipText = \"{}\"; \
                 $notify.Visible = $True; \
                 $notify.ShowBalloonTip(5000); \
                 Start-Sleep -Seconds 6; \
                 $notify.Dispose()",
                safe_title, safe_message
            );
            let _ = std::process::Command::new("powershell")
                .args(["-NoProfile", "-NonInteractive", "-Command", &script])
                .creation_flags(CREATE_NO_WINDOW)
                .spawn();
        }
    }

    (
        StatusCode::OK,
        Json(serde_json::json!({
            "status": "sent",
            "title": payload.title,
            "message": payload.message,
        })),
    )
}



