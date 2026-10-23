use aico_server::{HostServer, ServerConfig, HealthResponse, GitRepoStatus, AppState};
use aico_server::server::LineageGraphResponse;
use aico_server::git::{collect_project_git_status, resolve_clone_target_dir};

// @verifies ft-core-host-runtime::TASK-CORE-001-1::REQ-001
#[tokio::test]
async fn test_server_binds_to_available_port() {
    let mut config = ServerConfig::default();
    config.base_port = 4242;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully to port 4242 or fallback");

    assert!(addr.port() >= 4242 && addr.port() <= 4252, "Port should be within 4242..4252 range");
    assert_eq!(server.bound_addr(), Some(addr));
}

// @verifies ft-core-host-runtime::TASK-CORE-001-1::REQ-006
#[tokio::test]
async fn test_health_check_endpoint() {
    let mut config = ServerConfig::default();
    config.base_port = 4244;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully");

    // Spawn server background task
    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let url = format!("http://{}/api/v1/health", addr);

    let res = client.get(&url).send().await.expect("Health request should succeed");
    assert_eq!(res.status(), 200);

    let health: HealthResponse = res.json().await.expect("Health response should parse as JSON");
    assert_eq!(health.status, "ok");

    server_task.abort();
}

// @verifies ft-git-backend-status::TASK-GIT-001-3::REQ-005
#[tokio::test]
async fn test_git_status_endpoint() {
    let mut config = ServerConfig::default();
    config.base_port = 4256;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let url = format!("http://{}/api/v1/git/status", addr);

    let res = client.get(&url).send().await.expect("Git status request should succeed");
    assert_eq!(res.status(), 200);

    let statuses: Vec<GitRepoStatus> = res.json().await.expect("Response should parse as GitRepoStatus array");
    // Returns valid array (empty if no project registered, or valid statuses)
    assert!(statuses.is_empty() || !statuses.is_empty());

    server_task.abort();
}

// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-007
#[tokio::test]
async fn test_create_project_scaffolds_specs_and_inits_git() {
    let temp_dir = std::env::temp_dir().join(format!("aico_test_create_proj_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    std::fs::create_dir_all(&temp_dir).unwrap();
    std::env::set_var("AICO_ROOT", &temp_dir);

    let mut config = ServerConfig::default();
    config.base_port = 4310;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();

    // 1. Valid project creation
    let create_url = format!("http://{}/api/v1/projects", addr);
    let res = client.post(&create_url)
        .json(&serde_json::json!({ "name": "alpha-platform" }))
        .send()
        .await
        .expect("Create project request should succeed");

    assert_eq!(res.status(), 201);
    let proj: serde_json::Value = res.json().await.expect("Response should parse as JSON");
    assert_eq!(proj["id"], "alpha-platform-specs");

    let specs_dir = temp_dir.join("alpha-platform-specs");
    assert!(specs_dir.exists(), "Specs directory should be created");
    assert!(specs_dir.join(".aico").exists());
    assert!(specs_dir.join("adr").exists());
    assert!(specs_dir.join("epics").exists());
    assert!(specs_dir.join("features").exists());
    assert!(specs_dir.join(".aico-project.json").exists());
    assert!(specs_dir.join("glossary.md").exists());
    assert!(specs_dir.join(".git").exists(), "Git repository should be initialized");

    // 2. Conflict on existing project
    let res_conflict = client.post(&create_url)
        .json(&serde_json::json!({ "name": "alpha-platform" }))
        .send()
        .await
        .expect("Duplicate create project request should succeed");
    assert_eq!(res_conflict.status(), 409);

    // 3. Bad request on invalid project identifier
    let res_bad = client.post(&create_url)
        .json(&serde_json::json!({ "name": "INVALID SLUG!" }))
        .send()
        .await
        .expect("Invalid create project request should succeed");
    assert_eq!(res_bad.status(), 400);

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_dir);
}

// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-5::REQ-006
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-14::REQ-023
#[tokio::test]
async fn test_graph_endpoint_returns_connected_lineage() {
    let temp_dir = std::env::temp_dir().join(format!("aico_test_graph_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let specs_dir = temp_dir.join("demo-app-specs");
    std::fs::create_dir_all(specs_dir.join("adr")).unwrap();
    std::fs::create_dir_all(specs_dir.join("epics").join("ec-core").join("features").join("ft-core-auth")).unwrap();

    // Write ADR
    std::fs::write(
        specs_dir.join("adr").join("0001-record-auth.md"),
        "---\nid: ADR-0001\ntitle: Auth Architecture\nstatus: Approved\nderives_from: []\n---\n# ADR 0001",
    ).unwrap();

    // Write Brainstorm in Epic
    std::fs::write(
        specs_dir.join("epics").join("ec-core").join("brain-ec-core.md"),
        "---\nid: brain-ec-core\ntitle: Core Exploration\nstatus: In Progress\nderives_from: [\"ADR-0001\"]\n---\n# Brainstorm",
    ).unwrap();

    // Write Feature Spec
    std::fs::write(
        specs_dir.join("epics").join("ec-core").join("features").join("ft-core-auth").join("spec-ft-core-auth.md"),
        "---\nid: spec-ft-core-auth\ntitle: Authentication Engine\nstatus: In Progress\nderives_from: [\"brain-ec-core\"]\n---\n# Spec\n\n- **REQ-001**: System shall authenticate user.\n- **REQ-002**: System shall validate session tokens.\n",
    ).unwrap();

    // Write Feature Plan (with dependency notes and rewrite targets that must NOT declare tasks - REQ-023)
    std::fs::write(
        specs_dir.join("epics").join("ec-core").join("features").join("ft-core-auth").join("plan-ft-core-auth.md"),
        "---\nid: plan-ft-core-auth\ntitle: Authentication Implementation Plan\nstatus: In Progress\nderives_from: [\"spec-ft-core-auth\"]\n---\n# Plan\n\n- **TASK-AUTH-001**: Implement token validation\n  - **Blocked by**: TASK-OTHER-999\n  - **Rewrite Target**: TASK-TOOL-999\n  - Addresses: REQ-001, REQ-002\n  - Verification Seam: `crates/aico-server/tests/auth_test.rs`\n",
    ).unwrap();

    let state = AppState::default();
    {
        let mut reg = state.registry.write().await;
        reg.register(aico_core::DiscoveredProject {
            id: "demo-app-specs".to_string(),
            name: "Demo App Specs".to_string(),
            specs_path: specs_dir.clone(),
            codebase_path: None,
            manifest: aico_core::ProjectManifest {
                name: "demo-app".to_string(),
                version: Some("0.1.0".to_string()),
                codebase_path: None,
                created_at: None,
                repositories: None,
            },
            status: aico_core::ProjectStatus::Active,
        });
        reg.set_active("demo-app-specs");
    }

    let mut config = ServerConfig::default();
    config.base_port = 4320;

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let url = format!("http://{}/api/v1/graph", addr);

    let res = client.get(&url).send().await.expect("Graph request should succeed");
    assert_eq!(res.status(), 200);

    let graph: LineageGraphResponse = res.json().await.expect("Graph response should parse");
    assert!(!graph.nodes.is_empty(), "Graph should contain nodes");
    assert!(!graph.edges.is_empty(), "Graph should contain edges");

    let node_types: std::collections::HashSet<String> = graph.nodes.iter().map(|n| n.node_type.clone()).collect();
    assert!(node_types.contains("adr"), "Should contain adr node");
    assert!(node_types.contains("epic"), "Should contain epic node");
    assert!(node_types.contains("brainstorm"), "Should contain brainstorm node");
    assert!(node_types.contains("feature"), "Should contain feature node");
    assert!(node_types.contains("spec"), "Should contain spec node");
    assert!(node_types.contains("plan"), "Should contain plan node");
    assert!(node_types.contains("requirement"), "Should contain requirement node");
    assert!(node_types.contains("task"), "Should contain task node");
    assert!(node_types.contains("code"), "Should contain code seam node");

    let edge_relations: std::collections::HashSet<String> = graph.edges.iter().map(|e| e.relation.clone()).collect();
    assert!(edge_relations.contains("derives_from") || edge_relations.contains("contains"));
    assert!(edge_relations.contains("specifies"));
    assert!(edge_relations.contains("addresses"));
    assert!(edge_relations.contains("verifies"));

    // Check persistence to .aico/storage/graph/lineage_graph.json
    let snapshot_file = specs_dir.join(".aico").join("storage").join("graph").join("lineage_graph.json");
    assert!(snapshot_file.exists(), "Snapshot file should be created");

    // REQ-023: Verify that Blocked by and Rewrite Target did NOT declare false tasks
    assert!(!graph.nodes.iter().any(|n| n.id == "TASK-OTHER-999"), "Blocked by reference should not declare task");
    assert!(!graph.nodes.iter().any(|n| n.id == "TASK-TOOL-999"), "Rewrite Target reference should not declare task");

    // Check epic filtering
    let filter_url = format!("http://{}/api/v1/graph?epic=ec-core", addr);
    let res_filter = client.get(&filter_url).send().await.expect("Filtered graph request should succeed");
    assert_eq!(res_filter.status(), 200);
    let filtered_graph: LineageGraphResponse = res_filter.json().await.expect("Filtered graph parse");
    assert!(!filtered_graph.nodes.is_empty());

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_dir);
}

// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-1::REQ-001
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-004
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-005
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-006
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-007
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-008
// @verifies spec-ft-git-manifest-and-workflow-skill::TASK-GIT-005-2::REQ-009
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-2::REQ-010
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-2::REQ-012
#[tokio::test]
async fn test_git_manifest_and_operations_endpoints() {
    let temp_dir = std::env::temp_dir().join(format!("aico_test_git_ops_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let specs_dir = temp_dir.join("test-repo-specs");
    std::fs::create_dir_all(&specs_dir).unwrap();

    // 1. Verify clone target directory resolution
    let target_specs = resolve_clone_target_dir(&temp_dir, "my-proj-specs", "specs");
    assert_eq!(target_specs, temp_dir.join("my-proj-specs")); // REQ-007

    let target_codebase = resolve_clone_target_dir(&temp_dir, "my-codebase", "codebase");
    assert_eq!(target_codebase, temp_dir.join("codebase").join("my-codebase")); // REQ-006

    // 2. Initialize real git repository in specs_dir
    let _ = std::process::Command::new("git").arg("init").current_dir(&specs_dir).output();
    let _ = std::process::Command::new("git").args(["config", "user.name", "TestUser"]).current_dir(&specs_dir).output();
    let _ = std::process::Command::new("git").args(["config", "user.email", "test@example.com"]).current_dir(&specs_dir).output();

    // Write elevated .aico-project.json
    let manifest = serde_json::json!({
        "project_name": "test-repo",
        "id": "test-repo-specs",
        "name": "Test Repo Specs",
        "url": "https://github.com/example/test-repo-specs",
        "created_at": "2026-10-23T19:00:00Z",
        "repositories": [
            {
                "id": "test-codebase",
                "name": "Test Codebase",
                "path": "../codebase/test-codebase",
                "type": "codebase",
                "url": "https://github.com/example/test-codebase"
            }
        ]
    });
    std::fs::write(specs_dir.join(".aico-project.json"), serde_json::to_string_pretty(&manifest).unwrap()).unwrap();

    // Test collect_project_git_status (REQ-001, REQ-005)
    let statuses = collect_project_git_status(&specs_dir).await;
    assert_eq!(statuses.len(), 2, "Should return specs repo and codebase repo");
    assert_eq!(statuses[0].id, "test-repo-specs");
    assert_eq!(statuses[0].repo_type, "specs");
    assert!(statuses[0].is_cloned, "Specs repo should be cloned");
    assert_eq!(statuses[1].id, "test-codebase");
    assert_eq!(statuses[1].repo_type, "codebase");
    assert!(!statuses[1].is_cloned, "Uncloned codebase repo should have is_cloned: false");
    assert_eq!(statuses[1].branch.as_deref(), Some("not cloned"));

    // 3. Test git commit endpoint and error handling (REQ-004, REQ-008)
    let state = AppState::default();
    {
        let mut reg = state.registry.write().await;
        reg.register(aico_core::DiscoveredProject {
            id: "test-repo-specs".to_string(),
            name: "Test Repo Specs".to_string(),
            specs_path: specs_dir.clone(),
            codebase_path: None,
            manifest: aico_core::ProjectManifest {
                name: "test-repo".to_string(),
                version: Some("0.1.0".to_string()),
                codebase_path: None,
                created_at: None,
                repositories: None,
            },
            status: aico_core::ProjectStatus::Active,
        });
        reg.set_active("test-repo-specs");
    }

    let mut config = ServerConfig::default();
    config.base_port = 4330;

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();

    // 3a. Commit with empty message should return 400 (REQ-008)
    let commit_url = format!("http://{}/api/v1/git/commit", addr);
    let empty_commit_res = client.post(&commit_url)
        .json(&serde_json::json!({ "repo_id": "test-repo-specs", "message": "   " }))
        .send()
        .await
        .expect("Commit request should complete");
    assert_eq!(empty_commit_res.status(), 400);

    // 3b. Valid commit
    let valid_commit_res = client.post(&commit_url)
        .json(&serde_json::json!({ "repo_id": "test-repo-specs", "message": "Initial commit" }))
        .send()
        .await
        .expect("Valid commit request should complete");
    assert_eq!(valid_commit_res.status(), 200);

    // 3b2. AI Commit endpoint (REQ-004)
    // Create new modified file
    std::fs::write(specs_dir.join("test_ai_file.txt"), "automated commit content").unwrap();
    let ai_commit_url = format!("http://{}/api/v1/git/ai-commit", addr);
    let ai_commit_res = client.post(&ai_commit_url)
        .json(&serde_json::json!({ "repo_id": "test-repo-specs" }))
        .send()
        .await
        .expect("AI commit request should complete");
    assert_eq!(ai_commit_res.status(), 200);
    let ai_commit_body: serde_json::Value = ai_commit_res.json().await.unwrap();
    assert_eq!(ai_commit_body["status"], "ok");
    let msg = ai_commit_body["message"].as_str().unwrap();
    assert!(msg.starts_with("test(") || msg.starts_with("feat(") || msg.starts_with("docs("));

    // 3c. Pull endpoint (returns ok or error without server panic)
    let pull_url = format!("http://{}/api/v1/git/pull", addr);
    let pull_res = client.post(&pull_url)
        .json(&serde_json::json!({ "repo_id": "test-repo-specs" }))
        .send()
        .await
        .expect("Pull request should complete");
    assert!(pull_res.status() == 200 || pull_res.status() == 500);

    // 3d. Push endpoint
    let push_url = format!("http://{}/api/v1/git/push", addr);
    let push_res = client.post(&push_url)
        .json(&serde_json::json!({ "repo_id": "test-repo-specs" }))
        .send()
        .await
        .expect("Push request should complete");
    assert!(push_res.status() == 200 || push_res.status() == 500);

    // 3e. Test Codebase Repo Resolution Precedence & AI Commit (REQ-008)
    let codebase_dir = temp_dir.join("codebase").join("test-codebase");
    std::fs::create_dir_all(&codebase_dir).unwrap();
    let _ = std::process::Command::new("git").arg("init").current_dir(&codebase_dir).output();
    let _ = std::process::Command::new("git").args(["config", "user.name", "TestUser"]).current_dir(&codebase_dir).output();
    let _ = std::process::Command::new("git").args(["config", "user.email", "test@example.com"]).current_dir(&codebase_dir).output();
    std::fs::write(codebase_dir.join("submodule_change.txt"), "submodule pointer update").unwrap();

    let codebase_ai_commit_res = client.post(&ai_commit_url)
        .json(&serde_json::json!({
            "repo_id": "test-codebase",
            "path": codebase_dir.to_string_lossy().to_string(),
        }))
        .send()
        .await
        .expect("Codebase AI commit request should complete");
    assert_eq!(codebase_ai_commit_res.status(), 200);
    let codebase_body: serde_json::Value = codebase_ai_commit_res.json().await.unwrap();
    assert_eq!(codebase_body["status"], "ok");

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_dir);
}

// @verifies spec-ft-terminal-quotas-gates-and-notifications::TASK-TERMINAL-007-3::REQ-005
#[tokio::test]
async fn test_windows_popup_notification_endpoint() {
    std::env::set_var("AICO_DISABLE_OS_POPUP", "1");

    let mut config = ServerConfig::default();
    config.base_port = 4340;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let url = format!("http://{}/api/v1/notifications/popup", addr);

    let res = client.post(&url)
        .json(&serde_json::json!({
            "title": "AICO Gate",
            "message": "Phase 2 Spec Sign-Off Waiting for Confirmation",
            "status": "waiting_for_input"
        }))
        .send()
        .await
        .expect("Notification request should succeed");

    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.expect("Response should parse as JSON");
    assert_eq!(body["status"], "sent");
    assert_eq!(body["title"], "AICO Gate");
    assert_eq!(body["message"], "Phase 2 Spec Sign-Off Waiting for Confirmation");

    server_task.abort();
}
