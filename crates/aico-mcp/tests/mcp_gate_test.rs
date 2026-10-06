use std::fs;
use aico_mcp::McpServerManager;

// @verifies spec-ft-core-mcp-tools::REQ-002
// @verifies spec-ft-core-mcp-tools::REQ-003
// @verifies spec-ft-core-mcp-tools::REQ-005
#[test]
fn test_create_sdd_artifact_gate() {
    let temp_dir = std::env::temp_dir().join("aico_mcp_gate_test_1");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let params = serde_json::json!({
        "specs_root": temp_dir.to_str().unwrap(),
        "artifact_type": "spec",
        "epic_slug": "001-aico-core",
        "spec_slug": "03-storage",
        "slug": "storage",
        "title": "Storage Engine Spec",
        "derives_from": ["ADR-0001", "ADR-0003"],
        "content": "# Storage Engine Spec\n\nContent details here."
    });

    let res = McpServerManager::call_tool("create_sdd_artifact", params);
    assert!(res.is_ok(), "Expected call_tool to succeed: {:?}", res.err());

    let val = res.unwrap();
    assert_eq!(val["status"], "created");
    let target_path = val["path"].as_str().unwrap();

    // Verify canonical path pattern: <specs>/epics/<epic>/specs/<spec-slug>/SPEC-<slug>.md
    let expected_rel = std::path::Path::new("epics")
        .join("001-aico-core")
        .join("specs")
        .join("03-storage")
        .join("SPEC-storage.md");
    assert!(target_path.ends_with(expected_rel.to_str().unwrap()) || target_path.contains("SPEC-storage.md"));

    // Verify file exists on disk and has complete YAML frontmatter
    let written = fs::read_to_string(target_path).expect("Target file must exist");
    assert!(written.starts_with("---\n"));
    assert!(written.contains("id: SPEC-storage\n"));
    assert!(written.contains("type: spec\n"));
    assert!(written.contains("aico_skills_version: \"0.1.2\"\n"));
    assert!(written.contains("epic: 001-aico-core\n"));
    assert!(written.contains("title: Storage Engine Spec\n"));
    assert!(written.contains("derives_from: [\"ADR-0001\", \"ADR-0003\"]\n"));
    assert!(written.contains("# Storage Engine Spec\n\nContent details here."));
}

// @verifies spec-ft-core-mcp-tools::REQ-010
#[test]
fn test_create_sdd_artifact_rejects_custom_path() {
    let temp_dir = std::env::temp_dir().join("aico_mcp_gate_test_2");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let params = serde_json::json!({
        "specs_root": temp_dir.to_str().unwrap(),
        "custom_path": "arbitrary/location/file.md",
        "artifact_type": "spec",
        "epic_slug": "001-aico-core",
        "spec_slug": "03-storage",
        "slug": "storage",
        "title": "Storage Engine Spec"
    });

    let res = McpServerManager::call_tool("create_sdd_artifact", params);
    assert!(res.is_err());
    let err = res.unwrap_err();
    assert!(format!("{:?}", err).contains("Custom file path is strictly prohibited"));
}

// @verifies spec-ft-core-mcp-tools::REQ-012
#[test]
fn test_create_sdd_artifact_rejects_duplicate_id() {
    let temp_dir = std::env::temp_dir().join("aico_mcp_gate_test_3");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let params = serde_json::json!({
        "specs_root": temp_dir.to_str().unwrap(),
        "artifact_type": "spec",
        "epic_slug": "001-aico-core",
        "spec_slug": "03-storage",
        "slug": "storage",
        "title": "Storage Engine Spec",
        "derives_from": ["ADR-0001"],
        "content": "Original"
    });

    let first = McpServerManager::call_tool("create_sdd_artifact", params.clone());
    assert!(first.is_ok());

    let second = McpServerManager::call_tool("create_sdd_artifact", params);
    assert!(second.is_err());
    let err = second.unwrap_err();
    assert!(format!("{:?}", err).contains("DuplicateArtifactId") || format!("{:?}", err).contains("already exists"));
}
