use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::sync::broadcast;
use crate::manifest::ManifestError;
use crate::registry::WorkspaceRegistry;
use crate::scanner::RootScanner;

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DiscoveryEvent {
    RegistryUpdated(Vec<String>),
}

pub struct DiscoveryWatcher {
    root_path: PathBuf,
    registry: Arc<RwLock<WorkspaceRegistry>>,
    event_tx: broadcast::Sender<DiscoveryEvent>,
    last_ids: Arc<RwLock<Vec<String>>>,
}

impl DiscoveryWatcher {
    pub fn new(root_path: impl AsRef<Path>, registry: Arc<RwLock<WorkspaceRegistry>>) -> (Self, broadcast::Receiver<DiscoveryEvent>) {
        let (event_tx, rx) = broadcast::channel(16);
        (
            Self {
                root_path: root_path.as_ref().to_path_buf(),
                registry,
                event_tx,
                last_ids: Arc::new(RwLock::new(Vec::new())),
            },
            rx,
        )
    }

    /// Rescan root and synchronize into registry, broadcasting update if changed
    // @implements SPEC-CORE-004::REQ-006
    // @implements SPEC-CORE-004::REQ-008
    pub async fn poll_and_sync(&self) -> Result<usize, ManifestError> {
        let discovered = RootScanner::scan(&self.root_path)?;
        let count = discovered.len();
        let mut ids: Vec<String> = discovered.iter().map(|p| p.id.clone()).collect();
        ids.sort();

        {
            let mut reg = self.registry.write().await;
            for p in discovered {
                reg.register(p);
            }
        }

        let mut last = self.last_ids.write().await;
        if *last != ids {
            *last = ids.clone();
            let _ = self.event_tx.send(DiscoveryEvent::RegistryUpdated(ids));
        }

        Ok(count)
    }
}
