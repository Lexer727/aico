use serde::{Deserialize, Serialize};
use crate::chunker::EmbeddingPipeline;
use crate::error::StorageError;
use crate::manager::StorageManager;
use crate::vector::VectorQueryResult;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridQueryResult {
    pub query: String,
    pub vector_matches: Vec<VectorQueryResult>,
    pub graph_context: Vec<String>,
}

#[derive(Default)]
pub struct HybridQueryEngine {
    pipeline: EmbeddingPipeline,
}

impl HybridQueryEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Perform unified hybrid query across LanceDB vector store and Kùzu property graph
    // @implements ft-core-local-storage::TASK-CORE-003-6::REQ-007
    pub async fn search(
        &self,
        storage: &StorageManager,
        query: &str,
        top_k: usize,
    ) -> Result<HybridQueryResult, StorageError> {
        // 1. Vector nearest neighbor query
        let query_vec = self.pipeline.embed_text(query);
        let vstore = storage.vector_store().read().await;
        let vector_matches = vstore.query_nearest(&query_vec, top_k)?;

        // 2. Graph neighborhood lookup
        let mut graph_context = Vec::new();
        let mut gstore = storage.graph_store().write().await;
        let cypher = format!(
            "MATCH (s:Symbol) WHERE s.name CONTAINS '{}' RETURN s.name",
            query.split_whitespace().next().unwrap_or("")
        );
        if let Ok(res) = gstore.execute_query(&cypher) {
            graph_context.push(res);
        }

        Ok(HybridQueryResult {
            query: query.to_string(),
            vector_matches,
            graph_context,
        })
    }
}
