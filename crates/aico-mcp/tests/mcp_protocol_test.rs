use aico_mcp::protocol::handle_json_rpc;
use serde_json::json;

// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-001
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-003
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-004
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-005
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-009
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-010
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-011

#[test]
fn test_handle_json_rpc_initialize() {
    let req = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": {
            "protocolVersion": "2024-11-05"
        }
    });

    let res = handle_json_rpc(&req, None);
    assert_eq!(res["jsonrpc"], "2.0");
    assert_eq!(res["id"], 1);
    assert_eq!(res["result"]["protocolVersion"], "2024-11-05");
    assert_eq!(res["result"]["serverInfo"]["name"], "aico");
    assert_eq!(res["result"]["capabilities"]["tools"], json!({}));
}

#[test]
fn test_handle_json_rpc_tools_list() {
    let req = json!({
        "jsonrpc": "2.0",
        "id": "req-2",
        "method": "tools/list"
    });

    let res = handle_json_rpc(&req, None);
    assert_eq!(res["jsonrpc"], "2.0");
    assert_eq!(res["id"], "req-2");
    let tools = res["result"]["tools"].as_array().expect("tools array");
    assert_eq!(tools.len(), 7);
    let names: Vec<&str> = tools
        .iter()
        .filter_map(|t| t["name"].as_str())
        .collect();
    assert!(names.contains(&"query_lineage_graph"));
    assert!(names.contains(&"search_hybrid"));
    assert!(names.contains(&"find_dangling_requirements"));
    assert!(names.contains(&"verify_task"));
    assert!(names.contains(&"extract_annotations"));
    assert!(names.contains(&"validate_ears"));
    assert!(names.contains(&"create_project"));
}

#[test]
fn test_handle_json_rpc_tools_call_success() {
    let req = json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "validate_ears",
            "arguments": {
                "req_id": "REQ-001",
                "statement": "The system shall validate strict EARS patterns."
            }
        }
    });

    let res = handle_json_rpc(&req, None);
    assert_eq!(res["jsonrpc"], "2.0");
    assert_eq!(res["id"], 3);
    assert_eq!(res["result"]["isError"], false);
    let content = res["result"]["content"].as_array().expect("content array");
    assert!(!content.is_empty());
    assert_eq!(content[0]["type"], "text");
}

#[test]
fn test_handle_json_rpc_tools_call_tool_error() {
    let req = json!({
        "jsonrpc": "2.0",
        "id": 4,
        "method": "tools/call",
        "params": {
            "name": "validate_ears",
            "arguments": {
                "req_id": "REQ-001",
                "statement": "Invalid requirement without modal keyword."
            }
        }
    });

    let res = handle_json_rpc(&req, None);
    assert_eq!(res["jsonrpc"], "2.0");
    assert_eq!(res["id"], 4);
    assert_eq!(res["result"]["isError"], true);
    assert!(res["result"]["content"][0]["text"].as_str().unwrap().contains("Missing modal keyword 'shall'"));
}

#[test]
fn test_handle_json_rpc_unknown_method() {
    let req = json!({
        "jsonrpc": "2.0",
        "id": 5,
        "method": "unknown/nonexistent"
    });

    let res = handle_json_rpc(&req, None);
    assert_eq!(res["jsonrpc"], "2.0");
    assert_eq!(res["id"], 5);
    assert_eq!(res["error"]["code"], -32601);
}

#[test]
fn test_handle_json_rpc_invalid_params() {
    let req = json!({
        "jsonrpc": "2.0",
        "id": 6,
        "method": "tools/call",
        "params": "not an object"
    });

    let res = handle_json_rpc(&req, None);
    assert_eq!(res["jsonrpc"], "2.0");
    assert_eq!(res["id"], 6);
    assert_eq!(res["error"]["code"], -32602);
}

// @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-5::REQ-010
#[test]
fn test_handle_json_rpc_create_project_tool() {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_nanos();
    let temp_dir = std::env::temp_dir().join(format!("aico-mcp-test-{}", nanos));
    let _ = std::fs::create_dir_all(&temp_dir);

    // Save and switch cwd temporarily
    let orig_cwd = std::env::current_dir().unwrap();
    std::env::set_current_dir(&temp_dir).unwrap();

    let req = json!({
        "jsonrpc": "2.0",
        "id": 7,
        "method": "tools/call",
        "params": {
            "name": "create_project",
            "arguments": {
                "project_name": "agent-scaffolded",
                "display_name": "Agent Scaffolded Project",
                "local_only": true
            }
        }
    });

    let res = handle_json_rpc(&req, None);
    assert_eq!(res["jsonrpc"], "2.0");
    assert_eq!(res["id"], 7);
    assert_eq!(res["result"]["isError"], false);
    let text = res["result"]["content"][0]["text"].as_str().unwrap();
    assert!(text.contains("agent-scaffolded"));

    // Check directory on disk
    // @verifies spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-2::REQ-005
    let scaffolded_specs = temp_dir.join("specs").join("agent-scaffolded-specs");
    assert!(scaffolded_specs.exists());
    assert!(scaffolded_specs.join(".aico-project.json").exists());

    // Restore cwd and cleanup
    std::env::set_current_dir(orig_cwd).unwrap();
    let _ = std::fs::remove_dir_all(&temp_dir);
}
