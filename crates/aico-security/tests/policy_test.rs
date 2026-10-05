use aico_security::{PolicyEngine, CommandTier};
use std::path::PathBuf;

// @verifies SPEC-CORE-002::REQ-001
#[test]
fn test_classify_tier1_read_only_commands() {
    let engine = PolicyEngine::new(PathBuf::from("d:/aico/codebase/my-project"));
    let cwd = PathBuf::from("d:/aico/codebase/my-project");

    let decision = engine.classify_command("cargo test --workspace", &cwd);
    assert_eq!(decision.tier, CommandTier::Tier1Read);
    assert_eq!(decision.requires_gate, false);

    let git_status = engine.classify_command("git status", &cwd);
    assert_eq!(git_status.tier, CommandTier::Tier1Read);
    assert_eq!(git_status.requires_gate, false);
}

// @verifies SPEC-CORE-002::REQ-001
#[test]
fn test_classify_tier2_workspace_write_commands() {
    let engine = PolicyEngine::new(PathBuf::from("d:/aico/codebase/my-project"));
    let cwd = PathBuf::from("d:/aico/codebase/my-project");

    let decision = engine.classify_command("cargo build", &cwd);
    assert_eq!(decision.tier, CommandTier::Tier2WorkspaceWrite);
    assert_eq!(decision.requires_gate, false);
}

// @verifies SPEC-CORE-002::REQ-009
#[test]
fn test_classify_tier3_dangerous_commands_require_gate() {
    let engine = PolicyEngine::new(PathBuf::from("d:/aico/codebase/my-project"));
    let cwd = PathBuf::from("d:/aico/codebase/my-project");

    let destructive = engine.classify_command("git push --force origin main", &cwd);
    assert_eq!(destructive.tier, CommandTier::Tier3DangerousOrEgress);
    assert_eq!(destructive.requires_gate, true);

    let rm_cmd = engine.classify_command("rm -rf /", &cwd);
    assert_eq!(rm_cmd.tier, CommandTier::Tier3DangerousOrEgress);
    assert_eq!(rm_cmd.requires_gate, true);
}

// @verifies SPEC-CORE-002::REQ-008
#[test]
fn test_sandbox_path_boundary_enforcement() {
    let engine = PolicyEngine::new(PathBuf::from("d:/aico/codebase/my-project"));

    // Inside project root -> safe
    let inside_path = PathBuf::from("d:/aico/codebase/my-project/src/main.rs");
    assert!(engine.is_sandboxed(&inside_path), "Paths inside workspace root must be recognized as sandboxed");

    // Traversal outside project root -> unsafe
    let escaping_path = PathBuf::from("d:/aico/codebase/my-project/../../windows/system32");
    assert!(!engine.is_sandboxed(&escaping_path), "Directory traversal escaping workspace root must be rejected");
}
