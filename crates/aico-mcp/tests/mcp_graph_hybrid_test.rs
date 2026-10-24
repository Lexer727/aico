use aico_mcp::{McpServerManager, ToolError};

// @verifies spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-001
// @verifies spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-004
// @verifies spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-007
#[test]
fn test_query_lineage_graph_tool() {
    let valid_params = serde_json::json!({
        "symbol": "validate_session_token",
        "hops": 2
    });
    let res = McpServerManager::call_tool("query_lineage_graph", valid_params)
        .expect("query_lineage_graph should succeed");

    assert_eq!(res["symbol"], "validate_session_token");
    assert_eq!(res["hops"], 2);
    assert!(res["cypher"].as_str().unwrap().contains("MATCH"));
    assert!(res["results"].is_array());

    // Invalid hop bounds (0 and 5) must return ToolError::InvalidParameters (REQ-007)
    let err_zero = McpServerManager::call_tool(
        "query_lineage_graph",
        serde_json::json!({ "symbol": "validate_session_token", "hops": 0 }),
    );
    assert!(matches!(err_zero, Err(ToolError::InvalidParameters(_, _))));

    let err_five = McpServerManager::call_tool(
        "query_lineage_graph",
        serde_json::json!({ "symbol": "validate_session_token", "hops": 5 }),
    );
    assert!(matches!(err_five, Err(ToolError::InvalidParameters(_, _))));

    // Empty symbol must return ToolError::InvalidParameters
    let err_empty = McpServerManager::call_tool(
        "query_lineage_graph",
        serde_json::json!({ "symbol": "   ", "hops": 2 }),
    );
    assert!(matches!(err_empty, Err(ToolError::InvalidParameters(_, _))));
}

// @verifies spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-005
// @verifies spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-008
#[test]
fn test_search_hybrid_tool() {
    let valid_params = serde_json::json!({
        "query": "session token authentication",
        "top_k": 3
    });
    let res = McpServerManager::call_tool("search_hybrid", valid_params)
        .expect("search_hybrid should succeed");

    assert_eq!(res["query"], "session token authentication");
    assert!(res["hits"].is_array());
    assert!(res["vector_matches"].is_array());
    assert!(res["graph_context"].is_array());

    // Empty query or top_k == 0 must return ToolError::InvalidParameters (REQ-008)
    let err_empty = McpServerManager::call_tool(
        "search_hybrid",
        serde_json::json!({ "query": "", "top_k": 3 }),
    );
    assert!(matches!(err_empty, Err(ToolError::InvalidParameters(_, _))));

    let err_zero_k = McpServerManager::call_tool(
        "search_hybrid",
        serde_json::json!({ "query": "auth", "top_k": 0 }),
    );
    assert!(matches!(err_zero_k, Err(ToolError::InvalidParameters(_, _))));
}

// @verifies spec-ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-5::REQ-007
#[tokio::test]
async fn test_mcp_search_hybrid_tool_formatted_hits() {
    use aico_mcp::HybridToolHandler;
    use aico_storage::{CodeChunker, EmbeddingPipeline, StorageManager};

    let temp_dir = std::env::temp_dir().join("aico_mcp_hybrid_hits_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage = StorageManager::open(&temp_dir).expect("open StorageManager");
    let chunker = CodeChunker::new();
    let pipeline = EmbeddingPipeline::new();

    let code = "pub fn verify_mcp_session(token: &str) -> bool { token == \"valid\" }";
    let chunks = chunker.chunk_file("crates/mcp/src/auth.rs", code);
    pipeline.ingest_chunks(&storage, &chunks).await.unwrap();

    let result = HybridToolHandler::search_hybrid_async("verify mcp session token", 5, Some(&storage))
        .await
        .expect("search_hybrid_async");

    assert_eq!(result.query, "verify mcp session token");
    assert!(!result.hits.is_empty(), "Must return formatted search hits");
    assert_eq!(result.hits[0].file_path, "crates/mcp/src/auth.rs");
    assert!(result.hits[0].rrf_score > 0.0);
}


// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-1::REQ-001
#[tokio::test]
async fn test_query_lineage_graph_with_persisted_aico_nodes_and_edges() {
    use aico_mcp::GraphToolHandler;
    use aico_storage::{GraphEdge, GraphNode, StorageManager};

    let temp_dir = std::env::temp_dir().join("aico_mcp_aico_persisted_lineage_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage = StorageManager::open(&temp_dir).expect("open StorageManager");
    {
        let gstore = storage.graph_store().write().await;
        gstore
            .upsert_node(GraphNode::new("ec-core", "Epic", "Core Epic", "In Progress"))
            .unwrap();
        gstore
            .upsert_node(GraphNode::new(
                "ft-core-workspace-graph-and-project-creator",
                "Feature",
                "Workspace Graph & Project Creator",
                "In Progress",
            ))
            .unwrap();
        gstore
            .upsert_node(GraphNode::new(
                "spec-ft-core-workspace-graph-and-project-creator",
                "Spec",
                "Workspace Graph Spec",
                "In Progress",
            ))
            .unwrap();
        gstore
            .upsert_edge(GraphEdge::new(
                "ec-core",
                "ft-core-workspace-graph-and-project-creator",
                "CONTAINS",
            ))
            .unwrap();
        gstore
            .upsert_edge(GraphEdge::new(
                "ft-core-workspace-graph-and-project-creator",
                "spec-ft-core-workspace-graph-and-project-creator",
                "SPECIFIED_BY",
            ))
            .unwrap();
    }

    let payload = GraphToolHandler::query_lineage_graph_with_storage("ec-core", 2, Some(&storage))
        .expect("query_lineage_graph_with_storage");

    assert_eq!(payload.symbol, "ec-core");
    assert_eq!(payload.hops, 2);
    assert_eq!(payload.results.len(), 2);
    let joined = payload.results.join(" ");
    assert!(joined.contains("ft-core-workspace-graph-and-project-creator"));
    assert!(joined.contains("spec-ft-core-workspace-graph-and-project-creator"));
}
