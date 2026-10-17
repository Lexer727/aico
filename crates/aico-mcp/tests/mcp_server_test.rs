use aico_mcp::{McpServerManager, ToolError};

// @verifies ft-core-mcp-tools::TASK-CORE-005-2::REQ-001
#[test]
fn test_list_tools_returns_sdd_core_tools() {
    let tools = McpServerManager::list_tools();
    assert!(tools.len() >= 4);

    let names: Vec<String> = tools.into_iter().map(|t| t.name).collect();
    assert!(names.contains(&"create_sdd_artifact".to_string()));
    assert!(names.contains(&"verify_task".to_string()));
    assert!(names.contains(&"extract_annotations".to_string()));
    assert!(names.contains(&"validate_ears".to_string()));
}

// @verifies ft-core-mcp-tools::TASK-CORE-005-2::REQ-008
#[test]
fn test_call_tool_dispatch_and_execution() {
    let source_code = "// @verifies ft-core-host-runtime::TASK-CORE-001-1::REQ-001\nfn test_port() {}";
    let params = serde_json::json!({ "source": source_code });

    let result = McpServerManager::call_tool("extract_annotations", params)
        .expect("Tool call should succeed");

    assert!(result.is_array());
    assert_eq!(result.as_array().unwrap().len(), 1);
}

// @verifies ft-core-mcp-tools::TASK-CORE-005-2::REQ-009
#[test]
fn test_call_tool_error_handling_and_guidance() {
    // 1. Unknown tool
    let err = McpServerManager::call_tool("invalid_unknown_tool", serde_json::json!({}));
    assert!(matches!(err, Err(ToolError::UnknownTool(_))));

    // 2. Missing parameters
    let missing_param_err = McpServerManager::call_tool("extract_annotations", serde_json::json!({}));
    assert!(matches!(missing_param_err, Err(ToolError::InvalidParameters(_, _))));
}
