use aico_mcp::protocol::handle_json_rpc;
use aico_mcp::{GraphToolHandler, HybridToolHandler};
use aico_storage::StorageManager;
use serde_json::json;

// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-005
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-006

#[test]
fn test_query_lineage_graph_with_storage() {
    let temp_dir = std::env::temp_dir().join("aico_test_storage_binding_graph");
    let _ = std::fs::remove_dir_all(&temp_dir);
    let storage = StorageManager::open(&temp_dir).expect("StorageManager::open");

    let payload = GraphToolHandler::query_lineage_graph_with_storage("AuthService", 2, Some(&storage))
        .expect("lineage query with storage should succeed");

    assert_eq!(payload.symbol, "AuthService");
    assert_eq!(payload.hops, 2);
    assert!(!payload.results.is_empty());
}

#[test]
fn test_search_hybrid_with_storage() {
    let temp_dir = std::env::temp_dir().join("aico_test_storage_binding_hybrid");
    let _ = std::fs::remove_dir_all(&temp_dir);
    let storage = StorageManager::open(&temp_dir).expect("StorageManager::open");

    let result = HybridToolHandler::search_hybrid_with_storage("authentication token", 3, Some(&storage))
        .expect("hybrid search with storage should succeed");

    assert_eq!(result.query, "authentication token");
}

#[test]
fn test_json_rpc_tools_call_with_storage() {
    let temp_dir = std::env::temp_dir().join("aico_test_storage_binding_rpc");
    let _ = std::fs::remove_dir_all(&temp_dir);
    let storage = StorageManager::open(&temp_dir).expect("StorageManager::open");

    let req = json!({
        "jsonrpc": "2.0",
        "id": 42,
        "method": "tools/call",
        "params": {
            "name": "query_lineage_graph",
            "arguments": {
                "symbol": "Router",
                "hops": 1
            }
        }
    });

    let res = handle_json_rpc(&req, Some(&storage));
    assert_eq!(res["jsonrpc"], "2.0");
    assert_eq!(res["id"], 42);
    assert_eq!(res["result"]["isError"], false);
    assert!(res["result"]["content"][0]["text"].as_str().unwrap().contains("Router"));
}
