use aico_core::{DiscoveredProject, ProjectManifest, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies spec-ft-core-omni-search-fulltext::REQ-010
// @verifies spec-ft-core-omni-search-fulltext::REQ-011
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

    // Assert that files containing @implements are discovered
    let annotated_file = files.iter().find(|f| {
        f.get("implements_count").and_then(|v| v.as_u64()).unwrap_or(0) > 0
    });
    assert!(annotated_file.is_some(), "Should find files with @implements annotations");

    // 2. Query /api/v1/raw with relative codebase path
    let raw_res = client
        .get(format!("http://{}/api/v1/raw?path=crates/aico-server/src/server.rs", addr))
        .send()
        .await
        .expect("Request to /api/v1/raw should succeed");

    assert_eq!(raw_res.status(), 200);
    let raw_content = raw_res.text().await.expect("Should read text content");
    assert!(raw_content.contains("pub struct HostServer"), "Should stream complete server.rs content");
    assert!(raw_content.contains("@implements"), "Should contain @implements annotations");
}
