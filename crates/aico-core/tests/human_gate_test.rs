use aico_core::human_gate::{
    HumanGateError, HumanGateManager, PlanTask, TaskRole, TaskStatus,
};

// @verifies SPEC-CORE-007::REQ-008
// @verifies SPEC-CORE-007::REQ-012
#[tokio::test]
async fn test_human_gate_task_blocks_and_unblocks_agent_frontier() {
    let mut manager = HumanGateManager::new();

    // 1. Define Human Gate Task requiring an image/png asset
    let gate_task = PlanTask {
        id: "TASK-GATE-01".to_string(),
        title: "Provide UI Mockup Design".to_string(),
        role: TaskRole::User,
        task_type: "asset_delivery".to_string(),
        status: TaskStatus::Ready,
        dependencies: vec![],
        required_mime: Some("image/png".to_string()),
        delivered_asset_id: None,
    };

    // 2. Define dependent agent implementation task
    let agent_task = PlanTask {
        id: "TASK-AGENT-01".to_string(),
        title: "Implement Header Component from Mockup".to_string(),
        role: TaskRole::Agent,
        task_type: "implementation".to_string(),
        status: TaskStatus::Blocked,
        dependencies: vec!["TASK-GATE-01".to_string()],
        required_mime: None,
        delivered_asset_id: None,
    };

    // 3. Define second tier agent task
    let agent_task_2 = PlanTask {
        id: "TASK-AGENT-02".to_string(),
        title: "Verify Header Accessibility".to_string(),
        role: TaskRole::Agent,
        task_type: "verification".to_string(),
        status: TaskStatus::Blocked,
        dependencies: vec!["TASK-AGENT-01".to_string()],
        required_mime: None,
        delivered_asset_id: None,
    };

    manager.add_task(gate_task);
    manager.add_task(agent_task);
    manager.add_task(agent_task_2);

    // Initial check: active agent frontier should NOT contain TASK-AGENT-01 or 02
    let active_frontier = manager.active_agent_frontier();
    assert!(active_frontier.is_empty(), "Dependent agent tasks must be blocked");
    assert!(manager.is_blocked("TASK-AGENT-01"));
    assert!(manager.is_blocked("TASK-AGENT-02"));

    // Subscribe to unblock events
    let mut event_rx = manager.subscribe();

    // Attempt delivering with invalid MIME type (e.g. application/zip)
    let invalid_res = manager.deliver_asset(
        "TASK-GATE-01",
        "asset-zip-999",
        "application/zip",
    ).await;
    match invalid_res {
        Err(HumanGateError::InvalidMimeType { expected, received }) => {
            assert_eq!(expected, "image/png");
            assert_eq!(received, "application/zip");
        }
        other => panic!("Expected InvalidMimeType error, got {:?}", other),
    }

    // Agent task must still be blocked
    assert!(manager.is_blocked("TASK-AGENT-01"));

    // Now deliver valid asset (image/png)
    let transition = manager.deliver_asset(
        "TASK-GATE-01",
        "asset-png-12345",
        "image/png",
    ).await.expect("Valid asset delivery should succeed");

    assert_eq!(transition.gate_task_id, "TASK-GATE-01");
    assert_eq!(transition.newly_unblocked, vec!["TASK-AGENT-01".to_string()]);

    // Check status of gate task
    let updated_gate = manager.get_task("TASK-GATE-01").expect("Gate task must exist");
    assert_eq!(updated_gate.status, TaskStatus::Completed);
    assert_eq!(updated_gate.delivered_asset_id, Some("asset-png-12345".to_string()));

    // Check active agent frontier now contains TASK-AGENT-01, but NOT TASK-AGENT-02
    let unblocked_frontier = manager.active_agent_frontier();
    assert_eq!(unblocked_frontier, vec!["TASK-AGENT-01".to_string()]);
    assert!(!manager.is_blocked("TASK-AGENT-01"));
    assert!(manager.is_blocked("TASK-AGENT-02"));

    // Check event broadcast
    let received_event = event_rx.recv().await.expect("Should receive unblock event");
    assert_eq!(received_event.unblocked_task_ids, vec!["TASK-AGENT-01".to_string()]);
}
