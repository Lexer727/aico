use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use thiserror::Error;

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
}

impl HostServer {
    pub fn new(config: ServerConfig) -> Self {
        Self {
            config,
            bound_addr: None,
        }
    }

    /// Try binding the server to the configured port or next available fallback
    pub async fn bind(&mut self) -> Result<SocketAddr, ServerError> {
        // Red test scaffold: stub returning dummy error
        Err(ServerError::BindError("Not implemented".to_string()))
    }

    pub fn bound_addr(&self) -> Option<SocketAddr> {
        self.bound_addr
    }
}
