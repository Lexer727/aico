use std::time::Duration;
use aico_security::{
    ApprovalGateManager, ApprovalError, AutoModeState, CommandTier, PolicyEngine,
};

// @verifies SPEC-CORE-002::REQ-008
// @verifies SPEC-CORE-002::REQ-009
#[tokio::test]
async fn test_interactive_approval_gate_approved() {
    let gate_mgr = ApprovalGateManager::new();

    let (gate_id, rx) = gate_mgr
        .create_gate("git push origin main", "Push to remote repository", Duration::from_secs(5))
        .expect("Failed to create gate");

    // Simulate user approving via UI/WebSocket
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        gate_mgr.respond_approval(&gate_id, true).expect("Failed to respond approval");
    });

    let result = rx.await;
    assert_eq!(result, Ok(true));
}

// @verifies SPEC-CORE-002::REQ-010
#[tokio::test]
async fn test_interactive_approval_gate_denied() {
    let gate_mgr = ApprovalGateManager::new();

    let (gate_id, rx) = gate_mgr
        .create_gate("rm -rf target", "Dangerous recursive removal", Duration::from_secs(5))
        .expect("Failed to create gate");

    // Simulate user denying via UI/WebSocket
    tokio::spawn(async move {
        tokio::time::sleep(Duration::from_millis(50)).await;
        gate_mgr.respond_approval(&gate_id, false).expect("Failed to respond denial");
    });

    let result = rx.await;
    assert_eq!(result, Ok(false));
}

// @verifies SPEC-CORE-002::REQ-012
#[tokio::test]
async fn test_interactive_approval_gate_timeout() {
    let gate_mgr = ApprovalGateManager::new();

    // Enforce 100ms timeout
    let (gate_id, rx) = gate_mgr
        .create_gate("git push --force", "Force push to main", Duration::from_millis(100))
        .expect("Failed to create gate");

    // Don't respond, wait for timeout
    let result = gate_mgr.wait_for_gate(&gate_id, rx, Duration::from_millis(100)).await;
    assert!(result.is_err());
    match result.unwrap_err() {
        ApprovalError::Timeout => {}
        other => panic!("Expected Timeout error, got {:?}", other),
    }

    // Verify gate was cleaned up
    assert!(!gate_mgr.has_gate(&gate_id));
}

// @verifies SPEC-CORE-002::REQ-011
#[test]
fn test_auto_mode_state_enforcement() {
    let engine = PolicyEngine::default();

    // When AutoMode is Off, Tier 2 commands are gated
    let decision_off = engine.evaluate_with_mode(
        "cargo add serde",
        std::path::Path::new("d:/aico/codebase"),
        AutoModeState::Off,
    );
    assert_eq!(decision_off.tier, CommandTier::Tier2WorkspaceWrite);
    assert!(decision_off.requires_gate, "Under AutoMode::Off, Tier 2 must require gate");

    // When AutoMode is Autonomous, Tier 2 commands proceed without prompt
    let decision_auto = engine.evaluate_with_mode(
        "cargo add serde",
        std::path::Path::new("d:/aico/codebase"),
        AutoModeState::Autonomous,
    );
    assert_eq!(decision_auto.tier, CommandTier::Tier2WorkspaceWrite);
    assert!(!decision_auto.requires_gate, "Under AutoMode::Autonomous, Tier 2 must auto-allow");

    // Tier 3 always requires gate regardless of AutoMode
    let decision_tier3 = engine.evaluate_with_mode(
        "git push origin main",
        std::path::Path::new("d:/aico/codebase"),
        AutoModeState::Autonomous,
    );
    assert_eq!(decision_tier3.tier, CommandTier::Tier3DangerousOrEgress);
    assert!(decision_tier3.requires_gate, "Tier 3 must always require gate");
}
