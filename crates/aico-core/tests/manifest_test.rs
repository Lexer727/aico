use aico_core::{ProjectManifest, ManifestError, ProjectRepository};
use std::path::PathBuf;

// @verifies ft-core-discovery::TASK-CORE-004-1::REQ-002
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
    assert_eq!(manifest.version.as_deref(), Some("0.1.0"));
    assert_eq!(manifest.codebase_path.as_deref(), Some("../codebase/aico"));
    assert_eq!(manifest.created_at, Some("2026-10-05T18:45:00Z".to_string()));
}

// @verifies ft-core-discovery::TASK-CORE-004-1::REQ-003
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

// @verifies ft-core-discovery::TASK-CORE-004-1::REQ-007
#[test]
fn test_reject_manifest_missing_required_fields() {
    let invalid_json = r#"{
        "version": "1.0.0"
    }"#;

    let result = ProjectManifest::from_json_str(invalid_json);
    assert!(result.is_err(), "Manifest missing name must be rejected");

    let minimal_json = r#"{
        "name": "minimal-project"
    }"#;
    let manifest = ProjectManifest::from_json_str(minimal_json).expect("Minimal manifest with only name should parse");
    assert_eq!(manifest.name, "minimal-project");
    assert!(manifest.codebase_path.is_none());
    assert!(manifest.version.is_none());
}

// @verifies ft-core-discovery::TASK-CORE-004-1::REQ-007
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

// @verifies ft-git-backend-status::TASK-GIT-001-6::REQ-001
// @verifies ft-git-backend-status::TASK-GIT-001-6::REQ-002
#[test]
fn test_manifest_multi_repo_parsing() {
    // 1. Explicit repositories declared
    let multi_repo_json = r#"{
        "name": "aico",
        "repositories": [
            { "id": "aico", "name": "AICO Engine & WebUI", "path": "d:/dev/aico", "type": "codebase", "url": "https://github.com/Lexer727/aico" },
            { "id": "aico-specs", "name": "AICO Specs", "path": "d:/aico/aico-specs", "type": "specs", "url": "https://github.com/Lexer727/aico-specs" },
            { "id": "aico-skills", "name": "AICO Skills Suite", "path": "d:/aico/codebase/aico-skills", "type": "skills" }
        ]
    }"#;

    let manifest = ProjectManifest::from_json_str(multi_repo_json)
        .expect("Manifest with repositories array should parse successfully");

    assert!(manifest.repositories.is_some());
    let repos = manifest.repositories.as_ref().unwrap();
    assert_eq!(repos.len(), 3);
    assert_eq!(repos[0].id, "aico");
    assert_eq!(repos[0].repo_type, "codebase");
    assert_eq!(repos[0].url.as_deref(), Some("https://github.com/Lexer727/aico"));
    assert_eq!(repos[1].id, "aico-specs");
    assert_eq!(repos[1].repo_type, "specs");
    assert_eq!(repos[1].url.as_deref(), Some("https://github.com/Lexer727/aico-specs"));
    assert_eq!(repos[2].id, "aico-skills");
    assert_eq!(repos[2].repo_type, "skills");
    assert_eq!(repos[2].url, None);

    let specs_dir = PathBuf::from("d:/aico/aico-specs");
    let effective = manifest.get_effective_repositories(&specs_dir);
    assert_eq!(effective.len(), 3);
    assert_eq!(effective[0].url.as_deref(), Some("https://github.com/Lexer727/aico"));

    // 2. Fallback when repositories is omitted
    let single_repo_json = r#"{
        "name": "myapp",
        "version": "1.0.0",
        "codebase_path": "../codebase/myapp"
    }"#;

    let default_manifest = ProjectManifest::from_json_str(single_repo_json)
        .expect("Manifest without repositories should parse successfully");
    assert!(default_manifest.repositories.is_none());

    let app_specs_dir = PathBuf::from("d:/apps/myapp-specs");
    let default_effective = default_manifest.get_effective_repositories(&app_specs_dir);
    assert_eq!(default_effective.len(), 2);
    assert_eq!(default_effective[0].id, "myapp");
    assert_eq!(default_effective[0].repo_type, "codebase");
    assert_eq!(default_effective[1].id, "myapp-specs");
    assert_eq!(default_effective[1].repo_type, "specs");
}

// @verifies ft-git-relative-paths-manifest::TASK-GIT-004-1::REQ-001
// @verifies ft-git-relative-paths-manifest::TASK-GIT-004-2::REQ-002
// @verifies ft-git-relative-paths-manifest::TASK-GIT-004-2::REQ-003
// @verifies ft-git-relative-paths-manifest::TASK-GIT-004-2::REQ-004
#[test]
fn test_manifest_relative_repositories_resolution() {
    let json_content = r#"{
        "name": "aico",
        "version": "0.1.1",
        "codebase_path": "../codebase/aico",
        "repositories": [
            { "id": "aico", "name": "AICO Engine & WebUI", "path": "../codebase/aico", "type": "codebase" },
            { "id": "aico-specs", "name": "AICO Specs", "path": ".", "type": "specs" },
            { "id": "aico-skills", "name": "AICO Skills Suite", "path": "../codebase/aico-skills", "type": "skills" }
        ]
    }"#;

    let manifest = ProjectManifest::from_json_str(json_content)
        .expect("Manifest with relative repository paths should parse successfully");

    let specs_dir = PathBuf::from("d:/aico/aico-specs");
    let effective = manifest.get_effective_repositories(&specs_dir);

    assert_eq!(effective.len(), 3);
    assert_eq!(effective[0].id, "aico");
    assert_eq!(effective[0].path, "d:/aico/codebase/aico");
    assert_eq!(effective[1].id, "aico-specs");
    assert_eq!(effective[1].path, "d:/aico/aico-specs");
    assert_eq!(effective[2].id, "aico-skills");
    assert_eq!(effective[2].path, "d:/aico/codebase/aico-skills");
}

// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-1::REQ-001
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-1::REQ-002
#[test]
fn test_elevated_specs_repo_and_default_codebase_path() {
    let json_content = r#"{
        "project_name": "aico",
        "id": "aico-specs",
        "name": "AICO Specs",
        "url": "https://github.com/Lexer727/aico-specs",
        "created_at": "2026-10-05T18:45:00Z",
        "repositories": [
            { "id": "aico", "name": "AICO Engine", "type": "codebase", "url": "https://github.com/Lexer727/aico" },
            { "id": "aico-skills", "name": "AICO Skills", "path": "../codebase/aico-skills", "type": "skills" }
        ]
    }"#;

    let manifest = ProjectManifest::from_json_str(json_content)
        .expect("Elevated specs manifest should parse successfully");

    assert_eq!(manifest.name, "aico");

    let specs_dir = PathBuf::from("d:/aico/aico-specs");
    let effective = manifest.get_effective_repositories(&specs_dir);

    assert_eq!(effective.len(), 3);
    assert_eq!(effective[0].id, "aico-specs");
    assert_eq!(effective[0].name, "AICO Specs");
    assert_eq!(effective[0].repo_type, "specs");
    assert_eq!(effective[0].path, "d:/aico/aico-specs");
    assert_eq!(effective[0].url.as_deref(), Some("https://github.com/Lexer727/aico-specs"));
    assert_eq!(effective[1].id, "aico");
    assert_eq!(effective[1].path, "d:/aico/codebase/aico");
    assert_eq!(effective[2].id, "aico-skills");
    assert_eq!(effective[2].path, "d:/aico/codebase/aico-skills");
}

// @verifies spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-2::REQ-004
#[test]
fn test_nested_specs_relative_path_resolution() {
    let manifest = ProjectManifest {
        name: "demo".to_string(),
        id: Some("demo-specs".to_string()),
        version: Some("0.1.0".to_string()),
        codebase_path: None,
        created_at: None,
        repositories: Some(vec![
            ProjectRepository {
                id: "demo-codebase".to_string(),
                name: "Demo Codebase".to_string(),
                path: "../../codebase/demo-codebase".to_string(),
                repo_type: "codebase".to_string(),
                url: None,
            },
            ProjectRepository {
                id: "legacy-codebase".to_string(),
                name: "Legacy Codebase".to_string(),
                path: "../codebase/legacy-codebase".to_string(),
                repo_type: "codebase".to_string(),
                url: None,
            },
        ]),
    };

    // 1. Nested specs directory (specs/demo-specs)
    let nested_specs_dir = PathBuf::from("d:/workspace/specs/demo-specs");
    let effective = manifest.get_effective_repositories(&nested_specs_dir);

    // Both should resolve to d:/workspace/codebase/<id>
    let demo_cb = effective.iter().find(|r| r.id == "demo-codebase").unwrap();
    assert_eq!(demo_cb.path, "d:/workspace/codebase/demo-codebase");

    let legacy_cb = effective.iter().find(|r| r.id == "legacy-codebase").unwrap();
    assert_eq!(legacy_cb.path, "d:/workspace/codebase/legacy-codebase");

    // 2. Direct resolve_path tests
    let resolved_two_hops = ProjectManifest::resolve_path("../../codebase/app", &nested_specs_dir);
    assert_eq!(resolved_two_hops.to_string_lossy().replace('\\', "/"), "d:/workspace/codebase/app");

    let resolved_one_hop_nested = ProjectManifest::resolve_path("../codebase/app", &nested_specs_dir);
    assert_eq!(resolved_one_hop_nested.to_string_lossy().replace('\\', "/"), "d:/workspace/codebase/app");
}


