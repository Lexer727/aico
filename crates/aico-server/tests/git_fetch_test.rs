use aico_core::DiscoveredProject;
use aico_server::{AppState, HostServer, ServerConfig, GitRepoStatus};
use std::process::Command;

// Helper to run git commands in a directory
fn run_git(dir: &std::path::Path, args: &[&str]) {
    let output = Command::new("git")
        .args(args)
        .current_dir(dir)
        .output()
        .unwrap_or_else(|e| panic!("Failed to run git {:?}: {}", args, e));
    assert!(
        output.status.success(),
        "git {:?} failed: {}",
        args,
        String::from_utf8_lossy(&output.stderr)
    );
}

// @verifies spec-ft-git-remote-fetch-and-sync::TASK-GIT-006-1::REQ-001
// @verifies spec-ft-git-remote-fetch-and-sync::TASK-GIT-006-1::REQ-002
#[tokio::test]
async fn test_git_status_with_fetch_detects_remote_commits() {
    let base_path = std::env::temp_dir().join(format!(
        "aico_git_fetch_test_{}_{}",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos(),
        rand::random::<u32>()
    ));
    std::fs::create_dir_all(&base_path).unwrap();

    let bare_dir = base_path.join("bare-upstream.git");
    let work1_dir = base_path.join("work1");
    let local_specs_dir = base_path.join("my-specs");

    // 1. Initialize bare upstream
    std::fs::create_dir_all(&bare_dir).unwrap();
    run_git(&bare_dir, &["init", "--bare", "--initial-branch=main"]);

    // 2. Clone to work1, make initial commit, push to bare upstream
    run_git(&base_path, &["clone", bare_dir.to_str().unwrap(), "work1"]);
    run_git(&work1_dir, &["config", "user.name", "Tester"]);
    run_git(&work1_dir, &["config", "user.email", "tester@example.com"]);
    std::fs::write(work1_dir.join("README.md"), "# Initial\n").unwrap();
    run_git(&work1_dir, &["add", "."]);
    run_git(&work1_dir, &["commit", "-m", "initial commit"]);
    run_git(&work1_dir, &["push", "origin", "main"]);

    // 3. Clone bare upstream to local_specs_dir (our local repo)
    run_git(&base_path, &["clone", bare_dir.to_str().unwrap(), "my-specs"]);
    run_git(&local_specs_dir, &["config", "user.name", "Tester"]);
    run_git(&local_specs_dir, &["config", "user.email", "tester@example.com"]);

    // Add .aico-project.json manifest in my-specs
    let manifest = r#"{
        "project_name": "test-project",
        "id": "test-specs",
        "name": "Test Specs",
        "url": "https://github.com/example/test-specs",
        "repositories": []
    }"#;
    std::fs::write(local_specs_dir.join(".aico-project.json"), manifest).unwrap();
    run_git(&local_specs_dir, &["add", "."]);
    run_git(&local_specs_dir, &["commit", "-m", "add manifest"]);
    run_git(&local_specs_dir, &["push", "origin", "main"]);

    // Pull into work1 so both are synced
    run_git(&work1_dir, &["pull", "origin", "main"]);

    // 4. Now simulate remote changes: create a new commit in work1 and push to bare upstream
    std::fs::write(work1_dir.join("README.md"), "# Updated from remote\n").unwrap();
    run_git(&work1_dir, &["commit", "-am", "remote update to readme"]);
    run_git(&work1_dir, &["push", "origin", "main"]);

    // At this moment, local_specs_dir tracking ref refs/remotes/origin/main is stale!
    // Setup Axum test server
    let state = AppState::default();
    {
        let mut reg = state.registry.write().await;
        reg.register(DiscoveredProject {
            id: "test-specs".to_string(),
            name: "Test Specs".to_string(),
            specs_path: local_specs_dir.clone(),
            codebase_path: None,
            manifest: aico_core::ProjectManifest {
                name: "test-project".to_string(),
                id: Some("test-specs".to_string()),
                version: Some("0.1.0".to_string()),
                codebase_path: None,
                created_at: None,
                repositories: None,
            },
            status: aico_core::ProjectStatus::Active,
        });
        reg.set_active("test-specs");
    }

    let mut config = ServerConfig::default();
    config.base_port = 4370;

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();

    // Query 1: Default status without fetch (fetch=false)
    let url_no_fetch = format!("http://{}/api/v1/git/status", addr);
    let res = client.get(&url_no_fetch).send().await.expect("Request should succeed");
    assert_eq!(res.status(), 200);
    let statuses: Vec<GitRepoStatus> = res.json().await.expect("Valid JSON");
    assert!(!statuses.is_empty());
    let specs_repo = statuses.iter().find(|r| r.repo_type == "specs").expect("specs repo");
    assert_eq!(specs_repo.behind, 0, "Without fetch, behind count must be 0 (stale tracking ref)");

    // Query 2: Status with fetch=true
    let url_fetch = format!("http://{}/api/v1/git/status?fetch=true", addr);
    let res = client.get(&url_fetch).send().await.expect("Request should succeed");
    assert_eq!(res.status(), 200);
    let statuses: Vec<GitRepoStatus> = res.json().await.expect("Valid JSON");
    let specs_repo = statuses.iter().find(|r| r.repo_type == "specs").expect("specs repo");
    assert_eq!(specs_repo.behind, 1, "With fetch=true, behind count must reflect remote commit (behind: 1)");

    server_task.abort();
    let _ = std::fs::remove_dir_all(&base_path);
}

// @verifies spec-ft-git-remote-fetch-and-sync::TASK-GIT-006-1::REQ-002
#[tokio::test]
async fn test_git_status_fetch_offline_resilience() {
    let base_path = std::env::temp_dir().join(format!(
        "aico_offline_fetch_test_{}_{}",
        std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos(),
        rand::random::<u32>()
    ));
    let local_specs_dir = base_path.join("offline-specs");

    // Initialize local repo with invalid remote
    std::fs::create_dir_all(&local_specs_dir).unwrap();
    run_git(&local_specs_dir, &["init", "--initial-branch=main"]);
    run_git(&local_specs_dir, &["config", "user.name", "Tester"]);
    run_git(&local_specs_dir, &["config", "user.email", "tester@example.com"]);
    std::fs::write(local_specs_dir.join("README.md"), "# Offline\n").unwrap();
    run_git(&local_specs_dir, &["add", "."]);
    run_git(&local_specs_dir, &["commit", "-m", "local commit"]);

    // Set an unreachable remote
    run_git(
        &local_specs_dir,
        &["remote", "add", "origin", "https://127.0.0.1:59999/unreachable/repo.git"],
    );

    let state = AppState::default();
    {
        let mut reg = state.registry.write().await;
        reg.register(DiscoveredProject {
            id: "offline-specs".to_string(),
            name: "Offline Specs".to_string(),
            specs_path: local_specs_dir.clone(),
            codebase_path: None,
            manifest: aico_core::ProjectManifest {
                name: "offline-project".to_string(),
                id: Some("offline-specs".to_string()),
                version: Some("0.1.0".to_string()),
                codebase_path: None,
                created_at: None,
                repositories: None,
            },
            status: aico_core::ProjectStatus::Active,
        });
        reg.set_active("offline-specs");
    }

    let mut config = ServerConfig::default();
    config.base_port = 4375;

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let start = std::time::Instant::now();
    let url_fetch = format!("http://{}/api/v1/git/status?fetch=true", addr);
    let res = client.get(&url_fetch).send().await.expect("Request should succeed");
    let elapsed = start.elapsed();

    assert_eq!(res.status(), 200, "Unreachable remote must return 200 OK without failing request");
    assert!(elapsed.as_secs() <= 7, "Fetch timeout must bound request duration");

    let statuses: Vec<GitRepoStatus> = res.json().await.expect("Valid JSON");
    assert!(!statuses.is_empty());
    let specs_repo = statuses.iter().find(|r| r.repo_type == "specs").expect("specs repo");
    assert!(specs_repo.is_available);

    server_task.abort();
    let _ = std::fs::remove_dir_all(&base_path);
}
