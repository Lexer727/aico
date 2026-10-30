use aico_core::{DiscoveredProject, ProjectManifest, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies ft-core-omni-search-fulltext::TASK-CORE-009-5::REQ-008
// @verifies ft-core-omni-search-fulltext::TASK-CORE-009-6::REQ-009
// @verifies ft-core-omni-search-fulltext::TASK-CORE-009-10::REQ-012
// @verifies ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-1::REQ-003
// @verifies ft-core-multirepo-code-path-normalization::TASK-CORE-016-1::REQ-003
#[tokio::test]
async fn test_filesystem_search_rest_api() {
    let mut config = ServerConfig::default();
    config.base_port = 4252;

    let mut registry = WorkspaceRegistry::new();
    let project = DiscoveredProject {
        id: "aico-specs".to_string(),
        name: "aico-specs".to_string(),
        specs_path: PathBuf::from("d:/aico/specs/aico-specs"),
        codebase_path: Some(PathBuf::from("d:/aico/codebase/aico")),
        manifest: ProjectManifest {
            name: "aico".to_string(),
            id: None,
            version: Some("0.1.1".to_string()),
            codebase_path: Some("../codebase/aico".to_string()),
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

    // 2. Query code full-text search: /api/v1/search?q=SocketAddr (REQ-012)
    let code_search_res = client
        .get(format!("http://{}/api/v1/search?q=SocketAddr", addr))
        .send()
        .await
        .expect("Code search request should succeed");

    assert_eq!(code_search_res.status(), 200);
    let code_results: serde_json::Value = code_search_res.json().await.expect("Should parse JSON");
    assert!(code_results.is_array());
    let code_list = code_results.as_array().unwrap();
    assert!(!code_list.is_empty(), "Should find code hits for 'SocketAddr'");
    let code_hit = code_list.iter().find(|item| {
        item.get("scope").and_then(|s| s.as_str()) == Some("code")
    });
    assert!(code_hit.is_some(), "Should return a result with scope: code");
    let hit = code_hit.unwrap();
    assert_eq!(
        hit.get("title").and_then(|s| s.as_str()),
        Some("aico/crates/aico-server/src/server.rs"),
        "Code search hit title must be multi-repo relative path"
    );
    assert_eq!(
        hit.get("id").and_then(|s| s.as_str()),
        Some("aico/crates/aico-server/src/server.rs"),
        "Code search hit id must be multi-repo relative path"
    );
    let snippet = hit.get("snippet").and_then(|s| s.as_str());
    assert!(snippet.is_some() && snippet.unwrap().contains("Line "), "Code snippet should contain line number");

    // 3. Query spec full-text search: /api/v1/search?q=Remote+public+internet+hosting (REQ-009)
    let spec_search_res = client
        .get(format!("http://{}/api/v1/search?q=Remote+public+internet+hosting", addr))
        .send()
        .await
        .expect("Spec search request should succeed");

    assert_eq!(spec_search_res.status(), 200);
    let spec_results: serde_json::Value = spec_search_res.json().await.expect("Should parse JSON");
    assert!(spec_results.is_array());
    let spec_list = spec_results.as_array().unwrap();
    assert!(!spec_list.is_empty(), "Should find spec hits for full-text spec content");
    assert!(spec_list.iter().any(|item| {
        item.get("scope").and_then(|s| s.as_str()) == Some("specs")
    }), "Should return specification hit under scope: specs");
}
