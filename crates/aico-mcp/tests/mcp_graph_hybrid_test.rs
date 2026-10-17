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
