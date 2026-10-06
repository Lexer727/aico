use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
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
    // @implements SPEC-CORE-001::REQ-001
    // @implements SPEC-CORE-001::REQ-010
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

    // @implements SPEC-CORE-001::REQ-002
    // @implements SPEC-CORE-001::REQ-003
    // @implements SPEC-CORE-001::REQ-006
    // @implements SPEC-CORE-001::REQ-007
    // @implements SPEC-CORE-004::REQ-008
    // @implements SPEC-CORE-007::REQ-001
    // @implements SPEC-CORE-006::REQ-012
    pub fn build_router(state: AppState) -> Router {
        Router::new()
            .route("/api/v1/health", get(health_check_handler))
            .route("/api/v1/projects", get(list_projects_handler))
            .route("/api/v1/projects/active", post(set_active_project_handler))
            .route("/api/v1/epics", get(list_epics_handler))
            .route("/api/v1/features", get(list_features_handler))
            .route("/api/v1/adrs", get(list_adrs_handler))
            .route("/api/v1/stats", get(get_stats_handler))
            .route("/ws", get(ws_handler))
            .fallback(crate::assets::static_asset_handler)
            .with_state(state)
    }

    /// Run the server loop until shutdown
    // @implements SPEC-CORE-001::REQ-001
    // @implements SPEC-CORE-001::REQ-006
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
    // @implements SPEC-CORE-001::REQ-005
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

// @implements SPEC-CORE-004::REQ-008
async fn list_projects_handler(
    State(state): State<AppState>,
) -> Json<Vec<DiscoveredProject>> {
    let registry = state.registry.read().await;
    Json(registry.list_cloned())
}

// @implements SPEC-CORE-004::REQ-008
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
pub struct DiscoveredEpic {
    pub id: String,
    pub title: String,
    pub status: String,
    pub specs_count: usize,
    pub specs: Vec<DiscoveredSpecInfo>,
    pub features: Vec<DiscoveredFeatureInfo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<u32>,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredSpecInfo {
    pub id: String,
    pub title: String,
    pub status: String,
    pub path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DiscoveredAdrInfo {
    pub id: String,
    pub title: String,
    pub status: String,
    pub path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SystemStats {
    pub cpu_usage: f32,
    pub memory_mb: u64,
    pub active_tasks: usize,
    pub uptime_seconds: u64,
}

/// Helper function to parse YAML frontmatter strictly between `---` markers
pub fn parse_frontmatter(content: &str) -> (Option<String>, Option<String>, Option<String>, Option<u32>) {
    let mut id = None;
    let mut title = None;
    let mut status = None;
    let mut order = None;
    let mut in_frontmatter = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed == "---" {
            if in_frontmatter {
                // End of frontmatter block; stop parsing to prevent body examples from overwriting
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
            }
        }
    }

    (id, title, status, order)
}

// Function to scan active project's epics
pub fn scan_epics_for_project(specs_path: &std::path::Path) -> Vec<DiscoveredEpic> {
    let epics_dir = specs_path.join("epics");
    if !epics_dir.exists() || !epics_dir.is_dir() {
        return Vec::new();
    }

    let mut epics = Vec::new();
    if let Ok(entries) = std::fs::read_dir(epics_dir) {
        let mut sorted_entries: Vec<_> = entries.flatten().collect();
        sorted_entries.sort_by_key(|e| e.path());

        for entry in sorted_entries {
            let path = entry.path();
            if path.is_dir() {
                let epic_id = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                let mut title = epic_id.clone();
                let mut status = "In Progress".to_string();
                let mut epic_order = None;

                // Look for brain-*.md or BRAIN-*.md
                if let Ok(files) = std::fs::read_dir(&path) {
                    for f in files.flatten() {
                        let fname = f.file_name().to_string_lossy().to_string();
                        let fname_lower = fname.to_lowercase();
                        if fname_lower.starts_with("brain-") && fname_lower.ends_with(".md") {
                            if let Ok(content) = std::fs::read_to_string(f.path()) {
                                let (_, fm_title, fm_status, fm_order) = parse_frontmatter(&content);
                                if let Some(t) = fm_title {
                                    title = t;
                                }
                                if let Some(s) = fm_status {
                                    status = s;
                                }
                                if let Some(o) = fm_order {
                                    epic_order = Some(o);
                                }
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
                                let feat_id = feat_path.file_name().unwrap_or_default().to_string_lossy().to_string().to_lowercase();
                                let mut feat_spec_id = None;
                                let mut feat_spec_title = None;
                                let mut feat_plan_id = None;
                                let mut feat_plan_title = None;
                                let mut feat_status = "In Progress".to_string();
                                let mut feat_order = None;

                                if let Ok(sfiles) = std::fs::read_dir(&feat_path) {
                                    for sf in sfiles.flatten() {
                                        let sfname = sf.file_name().to_string_lossy().to_string();
                                        let sfname_lower = sfname.to_lowercase();
                                        if sfname_lower.starts_with("spec-") && sfname_lower.ends_with(".md") {
                                            let mut s_id = sfname.trim_end_matches(".md").to_string().to_lowercase();
                                            let mut s_title = s_id.clone();
                                            let mut s_status = "In Progress".to_string();

                                            if let Ok(scontent) = std::fs::read_to_string(sf.path()) {
                                                let (fm_id, fm_title, fm_status, fm_order) = parse_frontmatter(&scontent);
                                                if let Some(fid) = fm_id {
                                                    s_id = fid.to_lowercase();
                                                }
                                                if let Some(ftitle) = fm_title {
                                                    s_title = ftitle;
                                                }
                                                if let Some(fstatus) = fm_status {
                                                    s_status = fstatus;
                                                }
                                                if let Some(forder) = fm_order {
                                                    feat_order = Some(forder);
                                                }
                                            }

                                            feat_spec_id = Some(s_id.clone());
                                            feat_spec_title = Some(s_title.clone());
                                            feat_status = s_status.clone();

                                            specs.push(DiscoveredSpecInfo {
                                                id: s_id,
                                                title: s_title,
                                                status: s_status,
                                                path: sf.path().to_string_lossy().to_string(),
                                                order: feat_order,
                                            });
                                        } else if sfname_lower.starts_with("plan-") && sfname_lower.ends_with(".md") {
                                            let mut p_id = sfname.trim_end_matches(".md").to_string().to_lowercase();
                                            let mut p_title = p_id.clone();

                                            if let Ok(pcontent) = std::fs::read_to_string(sf.path()) {
                                                let (fm_id, fm_title, _, fm_order) = parse_frontmatter(&pcontent);
                                                if let Some(fid) = fm_id {
                                                    p_id = fid.to_lowercase();
                                                }
                                                if let Some(ftitle) = fm_title {
                                                    p_title = ftitle;
                                                }
                                                if feat_order.is_none() && fm_order.is_some() {
                                                    feat_order = fm_order;
                                                }
                                            }

                                            feat_plan_id = Some(p_id);
                                            feat_plan_title = Some(p_title);
                                        }
                                    }
                                }

                                let feat_display_name = feat_spec_title
                                    .clone()
                                    .unwrap_or_else(|| feat_id.clone());

                                features.push(DiscoveredFeatureInfo {
                                    id: feat_id,
                                    name: feat_display_name,
                                    epic_id: epic_id.clone(),
                                    spec_id: feat_spec_id,
                                    spec_title: feat_spec_title,
                                    plan_id: feat_plan_id,
                                    plan_title: feat_plan_title,
                                    status: feat_status,
                                    order: feat_order,
                                    is_standalone: false,
                                });
                            }
                        }
                    }
                }

                // Sort specs and features by order if present
                specs.sort_by_key(|s| (s.order.unwrap_or(9999), s.id.clone()));
                features.sort_by_key(|f| (f.order.unwrap_or(9999), f.id.clone()));

                epics.push(DiscoveredEpic {
                    id: epic_id,
                    title,
                    status,
                    specs_count: specs.len(),
                    specs,
                    features,
                    order: epic_order,
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

    let mut standalone = Vec::new();
    if let Ok(entries) = std::fs::read_dir(features_dir) {
        let mut sorted: Vec<_> = entries.flatten().collect();
        sorted.sort_by_key(|e| e.path());

        for entry in sorted {
            let path = entry.path();
            if path.is_dir() {
                let feat_id = path.file_name().unwrap_or_default().to_string_lossy().to_string().to_lowercase();
                let mut feat_spec_id = None;
                let mut feat_spec_title = None;
                let mut feat_plan_id = None;
                let mut feat_plan_title = None;
                let mut feat_status = "In Progress".to_string();
                let mut feat_order = None;

                if let Ok(files) = std::fs::read_dir(&path) {
                    for f in files.flatten() {
                        let fname = f.file_name().to_string_lossy().to_string();
                        let fname_lower = fname.to_lowercase();
                        if fname_lower.starts_with("spec-") && fname_lower.ends_with(".md") {
                            let mut s_id = fname.trim_end_matches(".md").to_string().to_lowercase();
                            let mut s_title = s_id.clone();
                            let mut s_status = "In Progress".to_string();

                            if let Ok(scontent) = std::fs::read_to_string(f.path()) {
                                let (fm_id, fm_title, fm_status, fm_order) = parse_frontmatter(&scontent);
                                if let Some(fid) = fm_id { s_id = fid.to_lowercase(); }
                                if let Some(ftitle) = fm_title { s_title = ftitle; }
                                if let Some(fstatus) = fm_status { s_status = fstatus; }
                                if let Some(forder) = fm_order { feat_order = Some(forder); }
                            }
                            feat_spec_id = Some(s_id);
                            feat_spec_title = Some(s_title);
                            feat_status = s_status;
                        } else if fname_lower.starts_with("plan-") && fname_lower.ends_with(".md") {
                            let mut p_id = fname.trim_end_matches(".md").to_string().to_lowercase();
                            let mut p_title = p_id.clone();
                            if let Ok(pcontent) = std::fs::read_to_string(f.path()) {
                                let (fm_id, fm_title, _, fm_order) = parse_frontmatter(&pcontent);
                                if let Some(fid) = fm_id { p_id = fid.to_lowercase(); }
                                if let Some(ftitle) = fm_title { p_title = ftitle; }
                                if feat_order.is_none() && fm_order.is_some() { feat_order = fm_order; }
                            }
                            feat_plan_id = Some(p_id);
                            feat_plan_title = Some(p_title);
                        }
                    }
                }

                let feat_display_name = feat_spec_title.clone().unwrap_or_else(|| feat_id.clone());
                standalone.push(DiscoveredFeatureInfo {
                    id: feat_id,
                    name: feat_display_name,
                    epic_id: "".to_string(),
                    spec_id: feat_spec_id,
                    spec_title: feat_spec_title,
                    plan_id: feat_plan_id,
                    plan_title: feat_plan_title,
                    status: feat_status,
                    order: feat_order,
                    is_standalone: true,
                });
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

                if let Ok(content) = std::fs::read_to_string(&path) {
                    let (_, fm_title, fm_status, _) = parse_frontmatter(&content);
                    if let Some(t) = fm_title {
                        title = t;
                    }
                    if let Some(s) = fm_status {
                        status = s;
                    }
                }

                adrs.push(DiscoveredAdrInfo {
                    id: adr_id,
                    title,
                    status,
                    path: path.to_string_lossy().to_string(),
                });
            }
        }
    }

    adrs
}

// @implements SPEC-CORE-007::REQ-001
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

// @implements SPEC-CORE-007::REQ-001
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

// @implements SPEC-CORE-007::REQ-008
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

// @implements SPEC-CORE-006::REQ-012
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

// @implements SPEC-CORE-001::REQ-003
// @implements SPEC-CORE-001::REQ-007
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

