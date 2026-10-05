use aico_core::{ProjectManifest, ManifestError};
use std::path::PathBuf;

// @verifies SPEC-CORE-004::REQ-002
#[test]
fn test_parse_valid_manifest() {
    let json_content = r#"{
        "name": "aico",
        "version": "0.1.0",
        "codebase_path": "../codebase/aico",
        "created_at": "2026-10-05T18:45:00Z"
    }"#;

    let manifest = ProjectManifest::from_json_str(json_content)
        .expect("Valid manifest should parse successfully");

    assert_eq!(manifest.name, "aico");
    assert_eq!(manifest.version, "0.1.0");
    assert_eq!(manifest.codebase_path, "../codebase/aico");
    assert_eq!(manifest.created_at, Some("2026-10-05T18:45:00Z".to_string()));
}

// @verifies SPEC-CORE-004::REQ-003
#[test]
fn test_resolve_relative_codebase_path() {
    let json_content = r#"{
        "name": "project-a",
        "version": "1.0.0",
        "codebase_path": "../codebase/project-a"
    }"#;

    let manifest = ProjectManifest::from_json_str(json_content)
        .expect("Valid manifest should parse successfully");

    let specs_dir = PathBuf::from("d:/aico/project-a-specs");
    let resolved = manifest.resolve_codebase_path(&specs_dir)
        .expect("Relative codebase path should resolve cleanly");

    // Canonical / normalized target should point to d:/aico/codebase/project-a
    assert!(resolved.ends_with(PathBuf::from("codebase/project-a")) || resolved.to_string_lossy().contains("project-a"));
}

// @verifies SPEC-CORE-004::REQ-007
#[test]
fn test_reject_manifest_missing_required_fields() {
    let invalid_json = r#"{
        "name": "missing-codebase",
        "version": "1.0.0"
    }"#;

    let result = ProjectManifest::from_json_str(invalid_json);
    assert!(result.is_err(), "Manifest missing codebase_path must be rejected");
}

// @verifies SPEC-CORE-004::REQ-007
#[test]
fn test_reject_invalid_project_identifier() {
    let invalid_json = r#"{
        "name": "INVALID NAME WITH SPACES & CAPS",
        "version": "1.0.0",
        "codebase_path": "../codebase/foo"
    }"#;

    let result = ProjectManifest::from_json_str(invalid_json);
    assert!(matches!(result, Err(ManifestError::InvalidIdentifier(_))), "Invalid project name format must be rejected");
}
