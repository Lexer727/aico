use aico_core::{DiscoveredProject, ProjectManifest, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies spec-ft-core-omni-search-fulltext::REQ-008
#[tokio::test]
async fn test_filesystem_search_rest_api() {
    let mut config = ServerConfig::default();
    config.base_port = 4252;

    let mut registry = WorkspaceRegistry::new();
    let project = DiscoveredProject {
        id: "aico-specs".to_string(),
        name: "aico-specs".to_string(),
        specs_path: PathBuf::from("d:/aico/aico-specs"),
        codebase_path: PathBuf::from("d:/aico/codebase/aico"),
        manifest: ProjectManifest {
            name: "aico".to_string(),
            version: "0.1.1".to_string(),
            codebase_path: "../codebase/aico".to_string(),
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::Active,
    };
    registry.register(project);

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

    // 1. Query /api/v1/search?q=runtime
    let search_res = client
        .get(format!("http://{}/api/v1/search?q=runtime", addr))
        .send()
        .await
        .expect("Request should succeed");

    assert_eq!(search_res.status(), 200);

    let results: serde_json::Value = search_res.json().await.expect("Should parse JSON");
    assert!(results.is_array());
    let list = results.as_array().unwrap();
    assert!(!list.is_empty(), "Search should find artifacts containing 'runtime'");
    assert!(list.iter().any(|item| {
        item.get("id").and_then(|v| v.as_str()).map(|s| s.contains("runtime")).unwrap_or(false)
            || item.get("title").and_then(|v| v.as_str()).map(|s| s.to_lowercase().contains("runtime")).unwrap_or(false)
    }));
}
