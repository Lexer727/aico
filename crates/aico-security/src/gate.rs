use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tokio::sync::oneshot;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum ApprovalError {
    #[error("Gate request timed out")]
    Timeout,
    #[error("Gate not found: {0}")]
    GateNotFound(String),
    #[error("Gate channel closed")]
    ChannelClosed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateRequest {
    pub gate_id: String,
    pub command: String,
    pub reason: String,
    pub timeout_seconds: u64,
}

#[derive(Clone, Default)]
pub struct ApprovalGateManager {
    gates: Arc<Mutex<HashMap<String, oneshot::Sender<bool>>>>,
}

impl ApprovalGateManager {
    pub fn new() -> Self {
        Self::default()
    }

    /// Create a pending approval gate with an interactive channel
    // @implements spec-ft-core-security-auth::REQ-008
    pub fn create_gate(
        &self,
        command: &str,
        reason: &str,
        timeout: Duration,
    ) -> Result<(String, oneshot::Receiver<bool>), ApprovalError> {
        let gate_id = format!("gate_{}_{}", std::process::id(), rand::random::<u32>());
        let (tx, rx) = oneshot::channel();

        let mut gates = self.gates.lock().unwrap();
        gates.insert(gate_id.clone(), tx);

        let _ = GateRequest {
            gate_id: gate_id.clone(),
            command: command.to_string(),
            reason: reason.to_string(),
            timeout_seconds: timeout.as_secs(),
        };

        Ok((gate_id, rx))
    }

    /// Respond to an approval request (approve or deny)
    // @implements spec-ft-core-security-auth::REQ-009
    // @implements spec-ft-core-security-auth::REQ-010
    pub fn respond_approval(&self, gate_id: &str, approved: bool) -> Result<(), ApprovalError> {
        let mut gates = self.gates.lock().unwrap();
        if let Some(tx) = gates.remove(gate_id) {
            tx.send(approved).map_err(|_| ApprovalError::ChannelClosed)?;
            Ok(())
        } else {
            Err(ApprovalError::GateNotFound(gate_id.to_string()))
        }
    }

    /// Check if gate is currently active
    pub fn has_gate(&self, gate_id: &str) -> bool {
        let gates = self.gates.lock().unwrap();
        gates.contains_key(gate_id)
    }

    /// Wait for gate response with timeout enforcement
    // @implements spec-ft-core-security-auth::REQ-012
    pub async fn wait_for_gate(
        &self,
        gate_id: &str,
        rx: oneshot::Receiver<bool>,
        timeout: Duration,
    ) -> Result<bool, ApprovalError> {
        let res = match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(decision)) => Ok(decision),
            Ok(Err(_)) => Err(ApprovalError::ChannelClosed),
            Err(_) => Err(ApprovalError::Timeout),
        };

        // Guarantee gate cleanup from active registry
        let mut gates = self.gates.lock().unwrap();
        gates.remove(gate_id);

        res
    }
}
