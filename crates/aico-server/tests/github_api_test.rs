use aico_core::WorkspaceRegistry;
use aico_server::{AppState, HostServer, ServerConfig};
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-1::REQ-004
// @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-2::REQ-008
// @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-3::REQ-003
#[tokio::test]
async fn test_github_api_and_workspace_folders() {
    let mut config = ServerConfig::default();
    config.base_port = 4320;

    let registry = WorkspaceRegistry::new();
    let test_storage = std::env::temp_dir().join(format!("aico-gh-test-{}", rand::random::<u64>()));
    let _ = std::fs::create_dir_all(&test_storage);

    let state = AppState {
        registry: Arc::new(RwLock::new(registry)),
        storage_federation: Arc::new(aico_storage::StorageFederationManager::with_workspace_root(test_storage.clone())),
        ..Default::default()
    };

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    tokio::spawn(async move {
        server.serve().await.expect("Server should run");
    });

    let client = reqwest::Client::new();

    // 1. GET /api/v1/github/status
    let status_res = client
        .get(format!("http://{}/api/v1/github/status", addr))
        .send()
        .await
        .expect("Status request should succeed");
    assert_eq!(status_res.status(), 200);

    let status_json: serde_json::Value = status_res.json().await.expect("Should parse status JSON");
    assert!(status_json.get("authenticated").is_some());
    assert!(status_json.get("source").is_some());

    // 2. POST /api/v1/github/token with invalid token -> 400 Bad Request
    let bad_token_res = client
        .post(format!("http://{}/api/v1/github/token", addr))
        .json(&serde_json::json!({
            "token": "invalid_fake_token_for_testing"
        }))
        .send()
        .await
        .expect("Token request should complete");
    assert_eq!(bad_token_res.status(), 400);

    // 3. DELETE /api/v1/github/token -> 200 OK
    let del_token_res = client
        .delete(format!("http://{}/api/v1/github/token", addr))
        .send()
        .await
        .expect("Delete token request should complete");
    assert_eq!(del_token_res.status(), 200);

    // 4. POST /api/v1/github/check-repo with invalid URL
    let check_bad_res = client
        .post(format!("http://{}/api/v1/github/check-repo", addr))
        .json(&serde_json::json!({
            "url": "not-a-valid-url"
        }))
        .send()
        .await
        .expect("Check repo request should complete");
    assert_eq!(check_bad_res.status(), 200);
    let check_bad_json: serde_json::Value = check_bad_res.json().await.expect("Parse check JSON");
    assert_eq!(check_bad_json["exists"], false);
    assert!(check_bad_json["error"].as_str().is_some());

    // 5. GET /api/v1/workspace/codebase-folders
    let folders_res = client
        .get(format!("http://{}/api/v1/workspace/codebase-folders", addr))
        .send()
        .await
        .expect("Folders request should succeed");
    assert_eq!(folders_res.status(), 200);

    let folders: Vec<serde_json::Value> = folders_res.json().await.expect("Parse folders JSON");
    // Ensure folders array has the expected shape
    for folder in folders {
        assert!(folder.get("id").is_some());
        assert!(folder.get("name").is_some());
        assert!(folder.get("path").is_some());
        assert!(folder.get("is_git").is_some());
    }

    let _ = std::fs::remove_dir_all(&test_storage);
}
