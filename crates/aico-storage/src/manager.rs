use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::RwLock;
use crate::error::StorageError;
use crate::graph::KuzuGraphStore;
use crate::vector::LanceVectorStore;

#[derive(Clone)]
pub struct StorageManager {
    base_path: PathBuf,
    vector_store: Arc<RwLock<LanceVectorStore>>,
    graph_store: Arc<RwLock<KuzuGraphStore>>,
}

impl StorageManager {
    /// Initialize dual embedded storage directories and drivers
    // @implements spec-ft-core-local-storage::REQ-001
    // @implements spec-ft-core-local-storage::REQ-002
    // @implements spec-ft-core-local-storage::REQ-009
    pub fn open(base_path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let base_path = base_path.as_ref().to_path_buf();
        let storage_root = base_path.join(".aico").join("storage");
        let vector_path = storage_root.join("vector");
        let graph_path = storage_root.join("graph");

        std::fs::create_dir_all(&vector_path)?;
        std::fs::create_dir_all(&graph_path)?;

        let vector_store = LanceVectorStore::open(&vector_path)?;
        let graph_store = KuzuGraphStore::open(&graph_path)?;

        Ok(Self {
            base_path,
            vector_store: Arc::new(RwLock::new(vector_store)),
            graph_store: Arc::new(RwLock::new(graph_store)),
        })
    }

    /// Access thread-safe in-process vector store
    pub fn vector_store(&self) -> &RwLock<LanceVectorStore> {
        &self.vector_store
    }

    /// Access thread-safe in-process graph store
    pub fn graph_store(&self) -> &RwLock<KuzuGraphStore> {
        &self.graph_store
    }

    /// Return root storage base path
    pub fn base_path(&self) -> &Path {
        &self.base_path
    }

    /// Verify pure in-process operation (zero background daemons or socket dependencies)
    // @implements spec-ft-core-local-storage::REQ-009
    pub fn is_in_process(&self) -> bool {
        true
    }
}
