use aico_mcp::{McpServerManager, TraceabilityTracker, VerificationStatus};

// @verifies ft-core-mcp-tools::TASK-CORE-005-4::REQ-006
// @verifies ft-core-mcp-tools::TASK-CORE-005-4::REQ-007
#[test]
fn test_traceability_and_test_before_code_gate() {
    let mut tracker = TraceabilityTracker::new();

    let req_id = "spec-ft-core-security-auth::REQ-001";
    let task_id = "TASK-AUTH-001-1";

    // 1. Attempting to verify task before any test exists should fail the test-before-code gate
    let res_no_test = tracker.verify_task(task_id, req_id);
    assert!(res_no_test.is_err(), "Must reject task when no verifying test exists");

    // 2. Add failing test (red state)
    tracker.record_verifies_edge("test_login_rejection", req_id, VerificationStatus::Failed);
    let res_failing_test = tracker.verify_task(task_id, req_id);
    assert!(res_failing_test.is_err(), "Must reject task when verifying test is failing (RED)");

    // 3. Mark test passing (green state) and add implementation
    tracker.record_verifies_edge("test_login_rejection", req_id, VerificationStatus::Passed);
    tracker.record_implements_edge("validate_credentials", req_id);

    let res_success = tracker.verify_task(task_id, req_id);
    assert!(res_success.is_ok(), "Must approve task once test passes and implements edge is present");
    let report = res_success.unwrap();
    assert_eq!(report.task_id, task_id);
    assert_eq!(report.requirement_id, req_id);
    assert_eq!(report.status, "verified");

    // 4. Test MCP tool call dispatch for verify_task
    let params = serde_json::json!({
        "task_id": task_id,
        "requirement_id": req_id,
        "test_name": "test_login_rejection",
        "symbol_name": "validate_credentials",
        "test_status": "passed"
    });
    let tool_res = McpServerManager::call_tool("verify_task", params);
    assert!(tool_res.is_ok(), "MCP verify_task call must succeed: {:?}", tool_res.err());
    let val = tool_res.unwrap();
    assert_eq!(val["status"], "verified");
}

// @verifies ft-core-mcp-tools::TASK-CORE-005-4::REQ-006
// @verifies spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-1::REQ-006
#[test]
fn test_find_dangling_requirements() {
    let mut tracker = TraceabilityTracker::new();

    tracker.register_requirement("spec-ft-core-host-runtime::REQ-001");
    tracker.register_requirement("spec-ft-core-host-runtime::REQ-002");

    // REQ-001 gets test and implementation
    tracker.record_verifies_edge("test_req1", "spec-ft-core-host-runtime::REQ-001", VerificationStatus::Passed);
    tracker.record_implements_edge("impl_req1", "spec-ft-core-host-runtime::REQ-001");

    // REQ-002 has neither
    let dangling = tracker.find_dangling_requirements();
    assert_eq!(dangling.len(), 1);
    assert_eq!(dangling[0].requirement_id, "spec-ft-core-host-runtime::REQ-002");
    assert!(!dangling[0].has_test);
    assert!(!dangling[0].has_implementation);

    // Also verify via MCP tool dispatch
    let mcp_res = McpServerManager::call_tool(
        "find_dangling_requirements",
        serde_json::json!({
            "requirements": ["spec-ft-core-host-runtime::REQ-001", "spec-ft-core-host-runtime::REQ-002"],
            "source": "// @verifies ft-core-host-runtime::TASK-CORE-001-1::REQ-001\n// @implements ft-core-host-runtime::TASK-CORE-001-1::REQ-001\n"
        }),
    )
    .expect("find_dangling_requirements tool call must succeed");

    let arr = mcp_res.as_array().unwrap();
    assert_eq!(arr.len(), 1);
    assert_eq!(arr[0]["requirement_id"], "spec-ft-core-host-runtime::REQ-002");
}
