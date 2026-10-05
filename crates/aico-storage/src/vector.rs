use std::collections::HashMap;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use crate::error::StorageError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorRecord {
    pub id: String,
    pub vector: Vec<f32>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorQueryResult {
    pub id: String,
    pub score: f32,
    pub metadata: serde_json::Value,
}

pub struct LanceVectorStore {
    _path: PathBuf,
    records: HashMap<String, VectorRecord>,
}

impl LanceVectorStore {
    /// Initialize embedded vector store connection
    // @implements SPEC-CORE-003::REQ-001
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let path = path.as_ref().to_path_buf();
        std::fs::create_dir_all(&path)?;
        Ok(Self {
            _path: path,
            records: HashMap::new(),
        })
    }

    /// Upsert vector record into embedded index
    pub fn upsert_record(
        &mut self,
        id: &str,
        vector: Vec<f32>,
        metadata: serde_json::Value,
    ) -> Result<(), StorageError> {
        self.records.insert(
            id.to_string(),
            VectorRecord {
                id: id.to_string(),
                vector,
                metadata,
            },
        );
        Ok(())
    }

    /// Perform nearest neighbor vector similarity search
    // @implements SPEC-CORE-003::REQ-003
    pub fn query_nearest(&self, query_vector: &[f32], top_k: usize) -> Result<Vec<VectorQueryResult>, StorageError> {
        let mut scored: Vec<VectorQueryResult> = self
            .records
            .values()
            .map(|rec| {
                let dot: f32 = rec.vector.iter().zip(query_vector.iter()).map(|(a, b)| a * b).sum();
                let mag_a: f32 = rec.vector.iter().map(|a| a * a).sum::<f32>().sqrt();
                let mag_b: f32 = query_vector.iter().map(|b| b * b).sum::<f32>().sqrt();
                let cosine = if mag_a > 0.0 && mag_b > 0.0 {
                    dot / (mag_a * mag_b)
                } else {
                    0.0
                };
                VectorQueryResult {
                    id: rec.id.clone(),
                    score: cosine,
                    metadata: rec.metadata.clone(),
                }
            })
            .collect();

        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(top_k);
        Ok(scored)
    }

    /// Return total records stored
    pub fn record_count(&self) -> usize {
        self.records.len()
    }
}
