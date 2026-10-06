use aico_core::{RootScanner, WorkspaceRegistry, ProjectManifest, DiscoveredProject};
use std::fs;
use std::path::PathBuf;

// @verifies spec-ft-core-discovery::REQ-001
#[test]
fn test_root_scanner_discovers_specs_and_codebases() {
    let temp_root = std::env::temp_dir().join(format!("aico_test_root_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let project_specs = temp_root.join("alpha-specs");
    let codebase_dir = temp_root.join("codebase").join("alpha");

    fs::create_dir_all(&project_specs).unwrap();
    fs::create_dir_all(&codebase_dir).unwrap();

    let manifest_content = r#"{
        "name": "alpha",
        "version": "0.1.0",
        "codebase_path": "../codebase/alpha"
    }"#;
    fs::write(project_specs.join(".aico-project.json"), manifest_content).unwrap();

    let discovered = RootScanner::scan(&temp_root).expect("Scanner should discover projects");
    assert_eq!(discovered.len(), 1, "Should discover exactly 1 project");
    assert_eq!(discovered[0].name, "alpha");
    assert_eq!(discovered[0].specs_path, project_specs);
    assert_eq!(discovered[0].codebase_path, codebase_dir);

    // Cleanup
    let _ = fs::remove_dir_all(temp_root);
}

// @verifies spec-ft-core-discovery::REQ-005
#[test]
fn test_workspace_registry_tracks_active_project() {
    let mut registry = WorkspaceRegistry::new();

    let project = DiscoveredProject {
        id: "alpha".to_string(),
        name: "alpha".to_string(),
        specs_path: PathBuf::from("d:/aico/alpha-specs"),
        codebase_path: PathBuf::from("d:/aico/codebase/alpha"),
        manifest: ProjectManifest {
            name: "alpha".to_string(),
            version: "0.1.0".to_string(),
            codebase_path: "../codebase/alpha".to_string(),
            created_at: None,
        },
        status: aico_core::ProjectStatus::Active,
    };

    registry.register(project.clone());
    assert_eq!(registry.list().len(), 1);

    let activated = registry.set_active("alpha");
    assert!(activated, "Setting existing project active should return true");

    let active = registry.get_active().expect("Active project should be set");
    assert_eq!(active.id, "alpha");
}
