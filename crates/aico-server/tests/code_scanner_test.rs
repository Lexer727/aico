use aico_core::{DiscoveredProject, ProjectManifest, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies ft-core-omni-search-fulltext::TASK-CORE-009-7::REQ-010
// @verifies ft-core-omni-search-fulltext::TASK-CORE-009-8::REQ-011
// @verifies ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-1::REQ-001
// @verifies ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-1::REQ-002
#[tokio::test]
async fn test_codebase_scanner_and_raw_file_api() {
    let mut config = ServerConfig::default();
    config.base_port = 4253;

    let mut registry = WorkspaceRegistry::new();
    let project = DiscoveredProject {
        id: "aico".to_string(),
        name: "aico".to_string(),
        specs_path: PathBuf::from("d:/aico/aico-specs"),
        codebase_path: Some(PathBuf::from("d:/aico/codebase/aico")),
        manifest: ProjectManifest {
            name: "aico".to_string(),
            id: None,
            version: Some("0.1.1".to_string()),
            codebase_path: Some("d:/aico/codebase/aico".to_string()),
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::Active,
    };
    registry.register(project);
    registry.set_active("aico");

    let state = AppState {
        registry: Arc::new(RwLock::new(registry)),
        ..Default::default()
    };

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let _server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run");
    });

    let client = reqwest::Client::new();

    // 1. Query /api/v1/code/files
    let files_res = client
        .get(format!("http://{}/api/v1/code/files", addr))
        .send()
        .await
        .expect("Request to /api/v1/code/files should succeed");

    assert_eq!(files_res.status(), 200);
    let files_json: serde_json::Value = files_res.json().await.expect("Should parse JSON");
    assert!(files_json.is_array());
    let files = files_json.as_array().unwrap();
    assert!(!files.is_empty(), "Codebase scanner should discover files");

    // Assert that files containing @implements are discovered and have repository-relative paths (REQ-001)
    let annotated_file = files.iter().find(|f| {
        f.get("implements_count").and_then(|v| v.as_u64()).unwrap_or(0) > 0
    });
    assert!(annotated_file.is_some(), "Should find files with @implements annotations");
    let server_file = files.iter().find(|f| {
        f.get("relative_path").and_then(|p| p.as_str()) == Some("aico/crates/aico-server/src/server.rs")
    }).expect("Should find server.rs in discovered code files with aico/ prefix");

    assert_eq!(
        server_file.get("path").and_then(|p| p.as_str()),
        Some("aico/crates/aico-server/src/server.rs"),
        "Discovered path must be repository-relative with repo prefix without codebase/ prefix"
    );

    // Assert that all discovered files have at least one valid annotation (REQ-005)
    for f in files {
        let impl_count = f.get("implements_count").and_then(|v| v.as_u64()).unwrap_or(0);
        let ver_count = f.get("verifies_count").and_then(|v| v.as_u64()).unwrap_or(0);
        assert!(impl_count > 0 || ver_count > 0, "Discovered file must have valid annotations: {:?}", f.get("relative_path"));
    }

    // 2. Query /api/v1/raw with multi-repo path (REQ-002)
    let raw_res = client
        .get(format!("http://{}/api/v1/raw?path=aico/crates/aico-server/src/server.rs", addr))
        .send()
        .await
        .expect("Request to /api/v1/raw should succeed");

    assert_eq!(raw_res.status(), 200);
    let raw_content = raw_res.text().await.expect("Should read text content");
    assert!(raw_content.contains("pub struct HostServer"), "Should stream complete server.rs content");
    assert!(raw_content.contains("@implements"), "Should contain @implements annotations");

    // 3. Query /api/v1/raw with canonical workspace-relative path (backward compatibility)
    let ws_raw_res = client
        .get(format!("http://{}/api/v1/raw?path=codebase/aico/crates/aico-server/src/server.rs", addr))
        .send()
        .await
        .expect("Request to /api/v1/raw with workspace path should succeed");

    assert_eq!(ws_raw_res.status(), 200);
    let ws_raw_content = ws_raw_res.text().await.expect("Should read text content");
    assert!(ws_raw_content.contains("pub struct HostServer"), "Should stream complete server.rs content via workspace path");
}

// @verifies ft-core-workspace-path-normalization::TASK-CORE-014-1::REQ-001
// @verifies ft-core-workspace-path-normalization::TASK-CORE-014-1::REQ-002
// @verifies ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-1::REQ-001
// @verifies ft-core-multirepo-code-path-normalization::TASK-CORE-016-1::REQ-001
// @verifies ft-core-multirepo-code-path-normalization::TASK-CORE-016-1::REQ-002

// @verifies ft-specs-traceability-syntax-evolution::TASK-SPECS-006-4::REQ-004
// @verifies ft-specs-traceability-syntax-evolution::TASK-SPECS-006-4::REQ-005
#[test]
fn test_scan_codebase_files_strict_filtering() {
    let temp_dir = std::env::temp_dir().join(format!("aico_test_scanner_{}", rand::random::<u32>()));
    std::fs::create_dir_all(&temp_dir).unwrap();

    // 1. Valid source file with 3-segment implements
    let valid_code = temp_dir.join("service.rs");
    std::fs::write(&valid_code, "// @implements ft-auth-tokens::TASK-AUTH-001::REQ-001\npub fn auth() {}\n").unwrap();

    // 2. Valid test file with 3-segment verifies
    let valid_test = temp_dir.join("service_test.rs");
    std::fs::write(&valid_test, "// @verifies ft-auth-tokens::TASK-AUTH-001::REQ-001\n#[test]\nfn test() {}\n").unwrap();

    // 3. Documentation file with placeholder annotations (should be excluded)
    let doc_file = temp_dir.join("guide.md");
    std::fs::write(&doc_file, "# Guide\nExample: `// @implements ft-<feature>::TASK-###::REQ-###`\n").unwrap();

    // 4. Non-comment occurrence of @implements (should be excluded)
    let prose_file = temp_dir.join("notes.txt");
    std::fs::write(&prose_file, "This discusses @implements in text\n").unwrap();

    // 5. Normal source file without annotations (should be excluded)
    let unannotated = temp_dir.join("utils.rs");
    std::fs::write(&unannotated, "pub fn add(a: i32, b: i32) -> i32 { a + b }\n").unwrap();

    let scanned = aico_server::scan_codebase_files(&temp_dir);

    // Only service.rs and service_test.rs should be included
    assert_eq!(scanned.len(), 2, "Only files with valid 3-segment annotations must be returned");

    let service = scanned.iter().find(|f| f.name == "service.rs").expect("service.rs found");
    assert_eq!(service.implements_count, 1);
    assert_eq!(service.verifies_count, 0);
    assert_eq!(service.annotations[0].target, "ft-auth-tokens::TASK-AUTH-001::REQ-001");

    let test = scanned.iter().find(|f| f.name == "service_test.rs").expect("service_test.rs found");
    assert_eq!(test.implements_count, 0);
    assert_eq!(test.verifies_count, 1);
    assert_eq!(test.annotations[0].target, "ft-auth-tokens::TASK-AUTH-001::REQ-001");

    let _ = std::fs::remove_dir_all(&temp_dir);
}
