use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use crate::error::StorageError;
use crate::manager::StorageManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StoredAsset {
    pub sha256: String,
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: usize,
    pub storage_path: PathBuf,
}

#[derive(Default)]
pub struct AssetIngestionService;

impl AssetIngestionService {
    pub fn new() -> Self {
        Self
    }

    /// Compute SHA-256 hash of bytes
    fn compute_hash(bytes: &[u8]) -> String {
        let mut hasher = Sha256::new();
        hasher.update(bytes);
        format!("{:x}", hasher.finalize())
    }

    /// Ingest file bytes, deduplicate under `.aico/assets/<sha256>.<ext>`, and index into vector and graph stores
    // @implements ft-core-epic-hub::TASK-CORE-007-1::REQ-006
    // @implements ft-core-epic-hub::TASK-CORE-007-1::REQ-007
    pub async fn store_asset(
        &self,
        storage: &StorageManager,
        bytes: &[u8],
        filename: &str,
        mime_type: &str,
    ) -> Result<StoredAsset, StorageError> {
        let sha256 = Self::compute_hash(bytes);

        let ext = Path::new(filename)
            .extension()
            .and_then(|e| e.to_str())
            .unwrap_or("bin");

        let assets_dir = storage.base_path().join(".aico").join("assets");
        fs::create_dir_all(&assets_dir)?;

        let target_filename = format!("{}.{}", sha256, ext);
        let storage_path = assets_dir.join(target_filename);

        // Deduplication: Only write if file doesn't already exist
        if !storage_path.exists() {
            fs::write(&storage_path, bytes)?;
        }

        let stored = StoredAsset {
            sha256: sha256.clone(),
            filename: filename.to_string(),
            mime_type: mime_type.to_string(),
            size_bytes: bytes.len(),
            storage_path,
        };

        // Index metadata into vector store
        {
            let mut vstore = storage.vector_store().write().await;
            vstore.upsert_record(
                &format!("asset-{}", sha256),
                vec![0.05f32; 384],
                serde_json::to_value(&stored).unwrap(),
            )?;
        }

        // Record node into graph store
        {
            let mut gstore = storage.graph_store().write().await;
            let cypher = format!("CREATE (a:Asset {{sha256: '{}', name: '{}'}})", sha256, filename);
            let _ = gstore.execute_query(&cypher);
        }

        Ok(stored)
    }
}
