use std::fs;
use aico_core::{RootScanner, ProjectStatus, CodebaseWizard};

// @verifies SPEC-CORE-004::REQ-004
// @verifies SPEC-CORE-004::REQ-011
#[test]
fn test_missing_codebase_handling() {
    let temp_dir = std::env::temp_dir().join("aico_missing_codebase_test_1");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let specs_dir = temp_dir.join("missing-app-specs");
    fs::create_dir_all(&specs_dir).unwrap();

    // Manifest pointing to a non-existent codebase path
    let manifest_json = r#"{
        "name": "missing-app",
        "version": "0.1.0",
        "codebase_path": "../codebase/non-existent-app"
    }"#;
    fs::write(specs_dir.join(".aico-project.json"), manifest_json).unwrap();

    // Scan root directory
    let projects = RootScanner::scan(&temp_dir).expect("Scan should succeed even with missing codebase");
    assert_eq!(projects.len(), 1);
    let project = &projects[0];

    // Status must be flagged as CodebaseMissing
    assert_eq!(project.status, ProjectStatus::CodebaseMissing);
    assert!(!project.codebase_path.exists());

    // Use CodebaseWizard to initialize empty codebase
    let wizard = CodebaseWizard::new();
    wizard.initialize_codebase(&project.codebase_path).expect("Failed to initialize empty codebase");

    assert!(project.codebase_path.exists());
    assert!(project.codebase_path.join(".git").exists());

    // Rescan: status should now be Active
    let rescanned = RootScanner::scan(&temp_dir).unwrap();
    assert_eq!(rescanned[0].status, ProjectStatus::Active);
}
