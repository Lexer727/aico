use std::path::PathBuf;
use aico_security::{AuditLogger, AuditEvent, CommandTier};

// @verifies SPEC-CORE-002::REQ-004
#[tokio::test]
async fn test_audit_trail_logging_and_persistence() {
    let temp_dir = std::env::temp_dir().join("aico_audit_test_1");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();
    let audit_file = temp_dir.join("audit.jsonl");

    let logger = AuditLogger::new(&audit_file).expect("Failed to initialize AuditLogger");

    let event = AuditEvent {
        timestamp: "2026-10-05T20:00:00Z".to_string(),
        agent_id: Some("agent-builder-1".to_string()),
        command: "cargo add serde".to_string(),
        tier: CommandTier::Tier2WorkspaceWrite,
        working_dir: PathBuf::from("d:/aico/codebase"),
        exit_code: Some(0),
        duration_ms: 1540,
        diff_hash: Some("sha256:abc12345".to_string()),
    };

    logger.log_event(&event).expect("Failed to log audit event");

    let events = logger.get_events().expect("Failed to read audit events");
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].command, "cargo add serde");
    assert_eq!(events[0].tier, CommandTier::Tier2WorkspaceWrite);
    assert_eq!(events[0].exit_code, Some(0));

    // Verify persisted on disk as append-only JSONL
    let file_content = std::fs::read_to_string(&audit_file).expect("Audit file missing");
    assert!(file_content.contains("cargo add serde"));
    assert!(file_content.contains("agent-builder-1"));
}

// @verifies SPEC-CORE-002::REQ-007
#[tokio::test]
async fn test_audit_logger_enforces_synchronous_write_before_mutation() {
    let temp_dir = std::env::temp_dir().join("aico_audit_test_2");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();
    let audit_file = temp_dir.join("audit.jsonl");

    let logger = AuditLogger::new(&audit_file).expect("Failed to initialize AuditLogger");

    let mut executed = false;
    let res = logger.record_and_execute(
        "agent-builder-1",
        "git commit -m 'feat: initial'",
        CommandTier::Tier2WorkspaceWrite,
        &temp_dir,
        || {
            executed = true;
            Ok::<i32, String>(0)
        },
    );

    assert!(res.is_ok());
    assert!(executed);

    let events = logger.get_events().unwrap();
    assert_eq!(events.len(), 1);
    assert_eq!(events[0].command, "git commit -m 'feat: initial'");
    assert_eq!(events[0].exit_code, Some(0));
}
