use aico_storage::{HybridQueryEngine, HybridQueryResult, KuzuGraphStore, StorageManager};
use serde::{Deserialize, Serialize};
use crate::server::ToolError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct LineageSubgraphPayload {
    pub symbol: String,
    pub hops: usize,
    pub cypher: String,
    pub results: Vec<String>,
}

pub struct GraphToolHandler;

impl GraphToolHandler {
    /// Execute a 1-to-4 hop lineage query against Kùzu property graph
    // @implements ft-core-mcp-tools::TASK-CORE-005-2::REQ-006
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-004
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-007
    pub fn query_lineage_graph(symbol: &str, hops: usize) -> Result<LineageSubgraphPayload, ToolError> {
        let trimmed = symbol.trim();
        if trimmed.is_empty() {
            return Err(ToolError::InvalidParameters(
                "query_lineage_graph".to_string(),
                "Parameter 'symbol' must not be empty".to_string(),
            ));
        }
        if !(1..=4).contains(&hops) {
            return Err(ToolError::InvalidParameters(
                "query_lineage_graph".to_string(),
                format!("Parameter 'hops' must be between 1 and 4 (got {})", hops),
            ));
        }

        let temp_path = std::env::temp_dir().join("aico_mcp_kuzu_query");
        let mut gstore = KuzuGraphStore::open(&temp_path)
            .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;

        let cypher = format!(
            "MATCH path = (s:Symbol {{name: '{}'}})-[*1..{}]-(neighbor) RETURN path",
            trimmed, hops
        );
        let query_res = gstore
            .execute_query(&cypher)
            .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;

        Ok(LineageSubgraphPayload {
            symbol: trimmed.to_string(),
            hops,
            cypher,
            results: vec![query_res],
        })
    }
}

pub struct HybridToolHandler;

impl HybridToolHandler {
    /// Execute a hybrid vector + property graph query via aico-storage
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-005
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-008
    pub fn search_hybrid(query: &str, top_k: usize) -> Result<HybridQueryResult, ToolError> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Err(ToolError::InvalidParameters(
                "search_hybrid".to_string(),
                "Parameter 'query' must not be empty".to_string(),
            ));
        }
        if top_k == 0 {
            return Err(ToolError::InvalidParameters(
                "search_hybrid".to_string(),
                "Parameter 'top_k' must be greater than 0".to_string(),
            ));
        }

        let temp_path = std::env::temp_dir().join("aico_mcp_hybrid_store");
        let storage = StorageManager::open(&temp_path)
            .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;
        let engine = HybridQueryEngine::new();

        let rt = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;

        rt.block_on(engine.search(&storage, trimmed, top_k))
            .map_err(|e| ToolError::ExecutionFailed(e.to_string()))
    }
}
