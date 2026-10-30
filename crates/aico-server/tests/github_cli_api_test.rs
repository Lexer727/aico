use aico_core::{find_gh_binary, GitHubCredentialManager, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-1::REQ-002
// @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-1::REQ-003
// @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-2::REQ-006
// @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-3::REQ-005
#[tokio::test]
async fn test_github_cli_status_and_unauthenticated_guard() {
    // 1. Verify find_gh_binary()
    let bin = find_gh_binary();
    // On systems with GitHub CLI installed, it should be resolved
    if let Some(ref path) = bin {
        assert!(path.is_file() || path.to_string_lossy() == "gh");
    }

    let mut config = ServerConfig::default();
    config.base_port = 4330;

    let registry = WorkspaceRegistry::new();
    let test_storage = std::env::temp_dir().join(format!("aico-gh-cli-test-{}", rand::random::<u64>()));
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

    // 2. GET /api/v1/github/cli/status
    let cli_status_res = client
        .get(format!("http://{}/api/v1/github/cli/status", addr))
        .send()
        .await
        .expect("CLI status request should succeed");
    assert_eq!(cli_status_res.status(), 200);

    let cli_json: serde_json::Value = cli_status_res.json().await.expect("Parse cli status JSON");
    assert!(cli_json.get("installed").is_some());
    assert!(cli_json.get("logged_in").is_some());

    // If binary was found, installed must be true
    if bin.is_some() {
        assert_eq!(cli_json["installed"], true);
        assert!(cli_json["binary_path"].as_str().is_some());
    }

    // 3. Unauthenticated private / non-existent repo check -> unauthenticated: true
    // Ensure no token in env for this check
    std::env::remove_var("GITHUB_TOKEN");
    std::env::remove_var("GH_TOKEN");
    let _ = GitHubCredentialManager::delete_token();

    let check_res = client
        .post(format!("http://{}/api/v1/github/check-repo", addr))
        .json(&serde_json::json!({
            "url": "https://github.com/aico-test-org-nonexistent/private-or-missing-repo-12345"
        }))
        .send()
        .await
        .expect("Check repo request should succeed");
    assert_eq!(check_res.status(), 200);

    let check_json: serde_json::Value = check_res.json().await.expect("Parse check JSON");
    assert_eq!(check_json["exists"], false);
    assert_eq!(check_json["unauthenticated"], true);
    assert!(
        check_json["error"]
            .as_str()
            .unwrap_or_default()
            .contains("private repository"),
        "Error message should explain private repository possibility"
    );

    // 4. POST /api/v1/github/cli/sync
    let sync_res = client
        .post(format!("http://{}/api/v1/github/cli/sync", addr))
        .send()
        .await
        .expect("CLI sync request should complete");

    let sync_status = sync_res.status();
    // The endpoint should either succeed (if gh is logged in) or return 400 (if gh is not logged in)
    assert!(
        sync_status == 200 || sync_status == 400,
        "CLI sync should return 200 or 400 depending on gh auth state"
    );
    let sync_json: serde_json::Value = sync_res.json().await.expect("Parse sync JSON");
    if sync_status == 200 {
        assert_eq!(sync_json["status"], "ok");
        assert!(sync_json["username"].as_str().is_some());
    } else {
        assert!(sync_json["error"].as_str().is_some());
    }
}
