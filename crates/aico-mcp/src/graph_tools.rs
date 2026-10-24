use aico_storage::{AicoGraphStore, HybridQueryEngine, HybridQueryResult, StorageManager};
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
    /// Execute a 1-to-4 hop lineage query against AICO property graph
    // @implements spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-1::REQ-001
    // @implements ft-core-mcp-tools::TASK-CORE-005-2::REQ-006
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-004
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-007
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-005
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-006
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn query_lineage_graph(symbol: &str, hops: usize) -> Result<LineageSubgraphPayload, ToolError> {
        Self::query_lineage_graph_with_storage(symbol, hops, None)
    }

    /// Execute lineage query using active StorageManager or temp fallback
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-005
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-006
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn query_lineage_graph_with_storage(
        symbol: &str,
        hops: usize,
        storage: Option<&StorageManager>,
    ) -> Result<LineageSubgraphPayload, ToolError> {
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

        let cypher = format!(
            "MATCH path = (s:Symbol {{name: '{}'}})-[*1..{}]-(neighbor) RETURN path",
            trimmed, hops
        );

        let records = match storage {
            Some(mgr) => {
                if let Ok(gstore) = mgr.graph_store().try_read() {
                    gstore
                        .execute_cypher(&cypher)
                        .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?
                } else if let Ok(gstore) = mgr.graph_store().try_write() {
                    gstore
                        .execute_cypher(&cypher)
                        .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?
                } else {
                    let temp_path = std::env::temp_dir().join("aico_mcp_graph_query");
                    let gstore = AicoGraphStore::open(&temp_path)
                        .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;
                    gstore
                        .execute_cypher(&cypher)
                        .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?
                }
            }
            None => {
                let temp_path = std::env::temp_dir().join("aico_mcp_graph_query");
                let gstore = AicoGraphStore::open(&temp_path)
                    .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;
                gstore
                    .execute_cypher(&cypher)
                    .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?
            }
        };

        let results: Vec<String> = if records.is_empty() {
            vec![format!("ok: match query completed for {}", trimmed)]
        } else {
            records
                .into_iter()
                .map(|v| serde_json::to_string(&v).unwrap_or_else(|_| v.to_string()))
                .collect()
        };

        Ok(LineageSubgraphPayload {
            symbol: trimmed.to_string(),
            hops,
            cypher,
            results,
        })
    }
}

pub struct HybridToolHandler;

impl HybridToolHandler {
    /// Execute a hybrid vector + property graph query via aico-storage
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-005
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-008
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-005
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-006
    pub fn search_hybrid(query: &str, top_k: usize) -> Result<HybridQueryResult, ToolError> {
        Self::search_hybrid_with_storage(query, top_k, None)
    }

    /// Execute hybrid search using active StorageManager or temp fallback
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-005
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-006
    pub fn search_hybrid_with_storage(
        query: &str,
        top_k: usize,
        storage: Option<&StorageManager>,
    ) -> Result<HybridQueryResult, ToolError> {
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

        let engine = HybridQueryEngine::new();

        let execute_search = |mgr: &StorageManager| -> Result<HybridQueryResult, ToolError> {
            if let Ok(handle) = tokio::runtime::Handle::try_current() {
                tokio::task::block_in_place(|| {
                    handle.block_on(engine.search(mgr, trimmed, top_k))
                })
                .map_err(|e| ToolError::ExecutionFailed(e.to_string()))
            } else {
                let rt = tokio::runtime::Builder::new_current_thread()
                    .enable_all()
                    .build()
                    .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;
                rt.block_on(engine.search(mgr, trimmed, top_k))
                    .map_err(|e| ToolError::ExecutionFailed(e.to_string()))
            }
        };

        match storage {
            Some(mgr) => execute_search(mgr),
            None => {
                let temp_path = std::env::temp_dir().join("aico_mcp_hybrid_store");
                let fallback = StorageManager::open(&temp_path)
                    .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;
                execute_search(&fallback)
            }
        }
    }

    /// Asynchronous hybrid search against StorageManager
    pub async fn search_hybrid_async(
        query: &str,
        top_k: usize,
        storage: Option<&StorageManager>,
    ) -> Result<HybridQueryResult, ToolError> {
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

        let engine = HybridQueryEngine::new();
        match storage {
            Some(mgr) => engine.search(mgr, trimmed, top_k).await.map_err(|e| ToolError::ExecutionFailed(e.to_string())),
            None => {
                let temp_path = std::env::temp_dir().join("aico_mcp_hybrid_store");
                let fallback = StorageManager::open(&temp_path)
                    .map_err(|e| ToolError::ExecutionFailed(e.to_string()))?;
                engine.search(&fallback, trimmed, top_k).await.map_err(|e| ToolError::ExecutionFailed(e.to_string()))
            }
        }
    }
}
