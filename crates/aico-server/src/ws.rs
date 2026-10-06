use serde::{Deserialize, Serialize};
use tokio::sync::broadcast;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct HubMessage {
    pub topic: String,
    pub payload: String,
}

pub struct WebSocketHub {
    sender: broadcast::Sender<HubMessage>,
}

impl Default for WebSocketHub {
    fn default() -> Self {
        Self::new(128)
    }
}

impl WebSocketHub {
    pub fn new(capacity: usize) -> Self {
        let (sender, _) = broadcast::channel(capacity);
        Self { sender }
    }

    pub fn subscribe(&self) -> broadcast::Receiver<HubMessage> {
        self.sender.subscribe()
    }

    /// Broadcast an event message to all connected WebSocket clients
    // @implements spec-ft-core-host-runtime::REQ-003
    // @implements spec-ft-core-host-runtime::REQ-007
    pub fn broadcast(&self, topic: &str, payload: &str) -> usize {
        let message = HubMessage {
            topic: topic.to_string(),
            payload: payload.to_string(),
        };
        self.sender.send(message).unwrap_or(0)
    }
}
