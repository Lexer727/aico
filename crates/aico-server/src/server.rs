use axum::{
    extract::State,
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
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

    /// Builds the internal Axum router with health, project discovery, and core endpoints
    // @implements SPEC-CORE-001::REQ-006
    // @implements SPEC-CORE-004::REQ-008
    pub fn build_router(state: AppState) -> Router {
        Router::new()
            .route("/api/v1/health", get(health_check_handler))
            .route("/api/v1/projects", get(list_projects_handler))
            .route("/api/v1/projects/active", post(set_active_project_handler))
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
