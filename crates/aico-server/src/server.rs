use axum::{extract::State, routing::get, Json, Router};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use thiserror::Error;
use tokio::net::TcpListener;

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

pub struct HostServer {
    config: ServerConfig,
    bound_addr: Option<SocketAddr>,
    listener: Option<TcpListener>,
    start_time: Instant,
}

impl HostServer {
    pub fn new(config: ServerConfig) -> Self {
        Self {
            config,
            bound_addr: None,
            listener: None,
            start_time: Instant::now(),
        }
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

    /// Builds the internal Axum router with health and core endpoints
    // @implements SPEC-CORE-001::REQ-006
    pub fn build_router(start_time: Instant) -> Router {
        let state = Arc::new(start_time);
        Router::new()
            .route("/api/v1/health", get(health_check_handler))
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
        let router = Self::build_router(self.start_time);

        axum::serve(listener, router)
            .await
            .map_err(|e| ServerError::Internal(e.to_string()))
    }
}

async fn health_check_handler(
    State(start_time): State<Arc<Instant>>,
) -> Json<HealthResponse> {
    Json(HealthResponse {
        status: "ok".to_string(),
        uptime_seconds: start_time.elapsed().as_secs(),
        aico_version: env!("CARGO_PKG_VERSION").to_string(),
    })
}
