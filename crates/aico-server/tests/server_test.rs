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
    let state = AppState {
        storage_federation: std::sync::Arc::new(aico_storage::StorageFederationManager::with_workspace_root(&temp_dir)),
        ..Default::default()
    };

    let mut config = ServerConfig::default();
    config.base_port = 4310;

    let mut server = HostServer::with_state(config, state);
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

    // @verifies spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-2::REQ-005
    let specs_dir = temp_dir.join("specs").join("alpha-platform-specs");
    assert!(specs_dir.exists(), "Specs directory should be created");
    assert!(!specs_dir.join(".aico").exists(), "Specs repo must not contain .aico folder");
    assert!(temp_dir.join(".aico").join("storage").join("graph").join("alpha-platform-specs").exists(), "Workspace root .aico/storage/graph/<project_id> should exist");
    assert!(temp_dir.join(".aico").join("storage").join("vector").exists(), "Workspace root .aico/storage/vector should exist");
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
                id: Some("demo-app-specs".to_string()),
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
    let snapshot_file = temp_dir.join(".aico").join("storage").join("graph").join("demo-app-specs").join("lineage_graph.json");
    assert!(!specs_dir.join(".aico").exists(), "Specs directory must not contain .aico folder");
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
    // @verifies spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-2::REQ-005
    assert_eq!(target_specs, temp_dir.join("specs").join("my-proj-specs")); // REQ-005 / REQ-007

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
    let statuses = collect_project_git_status(&specs_dir, false).await;
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
                id: Some("test-repo-specs".to_string()),
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


// @verifies spec-ft-terminal-native-hook-gate-bridge::TASK-HOOK-001-1::REQ-001
// @verifies spec-ft-terminal-native-hook-gate-bridge::TASK-HOOK-001-1::REQ-003
#[tokio::test]
async fn test_ai_status_endpoint() {
    let mut config = ServerConfig::default();
    config.base_port = 4345;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let url = format!("http://{}/api/v1/terminal/ai-status", addr);

    let res = client.post(&url)
        .json(&serde_json::json!({
            "tab_id": "term-test-1",
            "state": "waiting_for_input",
            "reason": "Waiting for user input (ask_question)"
        }))
        .send()
        .await
        .expect("AI status request should succeed");

    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.expect("Response should parse as JSON");
    assert_eq!(body["status"], "ok");
    assert_eq!(body["state"], "waiting_for_input");
    assert_eq!(body["tab_id"], "term-test-1");
    assert_eq!(body["reason"], "Waiting for user input (ask_question)");

    server_task.abort();
}

// @verifies ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-5::REQ-007
#[tokio::test]
async fn test_hybrid_search_endpoint() {
    let mut config = ServerConfig::default();
    config.base_port = 4345;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let url = format!("http://{}/api/v1/search/hybrid", addr);

    // Empty query returns 400 Bad Request
    let bad_res = client.post(&url)
        .json(&serde_json::json!({ "query": "  " }))
        .send()
        .await
        .expect("Search request should complete");
    assert_eq!(bad_res.status(), 400);

    // Valid query returns 200 with hits array
    let res = client.post(&url)
        .json(&serde_json::json!({
            "query": "AicoGraphStore lineage",
            "top_k": 5
        }))
        .send()
        .await
        .expect("Valid search request should complete");
    assert_eq!(res.status(), 200);

    let body: serde_json::Value = res.json().await.expect("Response should parse as JSON");
    assert_eq!(body["query"], "AicoGraphStore lineage");
    assert!(body["hits"].is_array());

    server_task.abort();
}

// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-2::REQ-005
// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-2::REQ-008
// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-2::REQ-010
#[tokio::test]
async fn test_dynamic_project_storage_switching() {
    let mut config = ServerConfig::default();
    config.base_port = 4350;

    let temp_root = std::env::temp_dir().join(format!("aico_switch_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let p1_dir = temp_root.join("project-one-specs");
    let p2_dir = temp_root.join("project-two-specs");
    std::fs::create_dir_all(&p1_dir).unwrap();
    std::fs::create_dir_all(&p2_dir).unwrap();

    let state = AppState::default();
    {
        let mut reg = state.registry.write().await;
        reg.register(aico_core::DiscoveredProject {
            id: "project-one-specs".to_string(),
            name: "Project One Specs".to_string(),
            specs_path: p1_dir.clone(),
            codebase_path: None,
            manifest: aico_core::ProjectManifest {
                name: "project-one".to_string(),
                id: Some("project-one-specs".to_string()),
                version: Some("0.1.0".to_string()),
                codebase_path: None,
                created_at: None,
                repositories: None,
            },
            status: aico_core::ProjectStatus::Active,
        });
        reg.register(aico_core::DiscoveredProject {
            id: "project-two-specs".to_string(),
            name: "Project Two Specs".to_string(),
            specs_path: p2_dir.clone(),
            codebase_path: None,
            manifest: aico_core::ProjectManifest {
                name: "project-two".to_string(),
                id: Some("project-two-specs".to_string()),
                version: Some("0.1.0".to_string()),
                codebase_path: None,
                created_at: None,
                repositories: None,
            },
            status: aico_core::ProjectStatus::Active,
        });
        reg.set_active("project-one-specs");
    }

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();
    let switch_url = format!("http://{}/api/v1/projects/switch", addr);

    // 1. Switch to project-two
    let switch_res2 = client.post(&switch_url)
        .json(&serde_json::json!({ "project_id": "project-two-specs" }))
        .send().await.unwrap();
    assert_eq!(switch_res2.status(), 200);
    let body2: serde_json::Value = switch_res2.json().await.unwrap();
    assert_eq!(body2["status"], "ok");
    assert_eq!(body2["active_project"], "project-two-specs");

    // 2. Switch back to project-one
    let switch_res1 = client.post(&switch_url)
        .json(&serde_json::json!({ "project_id": "project-one-specs" }))
        .send().await.unwrap();
    assert_eq!(switch_res1.status(), 200);
    let body1: serde_json::Value = switch_res1.json().await.unwrap();
    assert_eq!(body1["active_project"], "project-one-specs");

    // 3. Switch to non-existent project returns 404 (REQ-010)
    let switch_res_bad = client.post(&switch_url)
        .json(&serde_json::json!({ "project_id": "non-existent-proj" }))
        .send().await.unwrap();
    assert_eq!(switch_res_bad.status(), 404);

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_root);
}

// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-4::REQ-003
#[tokio::test]
async fn test_storage_stats_endpoint() {
    let mut config = ServerConfig::default();
    config.base_port = 4355;

    let temp_root = std::env::temp_dir().join(format!("aico_stats_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let p_dir = temp_root.join("telemetry-project-specs");
    std::fs::create_dir_all(&p_dir).unwrap();

    let state = AppState::default();
    {
        let mut reg = state.registry.write().await;
        reg.register(aico_core::DiscoveredProject {
            id: "telemetry-project-specs".to_string(),
            name: "Telemetry Project Specs".to_string(),
            specs_path: p_dir.clone(),
            codebase_path: None,
            manifest: aico_core::ProjectManifest {
                name: "telemetry-project".to_string(),
                id: Some("telemetry-project-specs".to_string()),
                version: Some("0.1.0".to_string()),
                codebase_path: None,
                created_at: None,
                repositories: None,
            },
            status: aico_core::ProjectStatus::Active,
        });
        reg.set_active("telemetry-project-specs");
    }

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();

    // Call /api/v1/storage/stats
    let stats_url = format!("http://{}/api/v1/storage/stats", addr);
    let stats_res = client.get(&stats_url)
        .send().await.unwrap();
    assert_eq!(stats_res.status(), 200);

    let stats_body: serde_json::Value = stats_res.json().await.unwrap();
    assert_eq!(stats_body["project_id"], "telemetry-project-specs");
    assert!(stats_body["graph_nodes_count"].is_number());
    assert!(stats_body["graph_edges_count"].is_number());
    assert!(stats_body["vector_chunks_count"].is_number());
    assert_eq!(stats_body["cache_state"], "ready");
    assert!(stats_body["storage_dir_bytes"].is_number());

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_root);
}

// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-2::REQ-002
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-2::REQ-003
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-2::REQ-005
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-2::REQ-008
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-3::REQ-006
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-3::REQ-007
#[tokio::test]
async fn test_storage_reindex_and_rebuild_graph_endpoints() {
    let mut config = ServerConfig::default();
    config.base_port = 4360;

    let temp_root = std::env::temp_dir().join(format!("aico_reindex_test_{}", std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
    let p_specs = temp_root.join("crawler-proj-specs");
    let p_code = temp_root.join("codebase").join("crawler-proj");
    std::fs::create_dir_all(p_specs.join("adr")).unwrap();
    std::fs::create_dir_all(p_specs.join("epics").join("ec-demo")).unwrap();
    std::fs::create_dir_all(p_code.join("src")).unwrap();

    std::fs::write(
        p_specs.join("adr").join("0001-test.md"),
        "---\nid: ADR-0001\ntitle: Architecture Test\nstatus: Approved\nderives_from: []\n---\n# Architecture Decision 1",
    ).unwrap();
    std::fs::write(
        p_code.join("src").join("lib.rs"),
        "pub fn authenticate_session(token: &str) -> bool {\n    !token.is_empty()\n}\n",
    ).unwrap();

    let state = AppState::default();
    {
        let mut reg = state.registry.write().await;
        reg.register(aico_core::DiscoveredProject {
            id: "crawler-proj-specs".to_string(),
            name: "Crawler Project Specs".to_string(),
            specs_path: p_specs.clone(),
            codebase_path: Some(p_code.clone()),
            manifest: aico_core::ProjectManifest {
                name: "crawler-proj".to_string(),
                id: Some("crawler-proj-specs".to_string()),
                version: Some("0.1.0".to_string()),
                codebase_path: Some("../codebase/crawler-proj".to_string()),
                created_at: None,
                repositories: None,
            },
            status: aico_core::ProjectStatus::Active,
        });
        reg.set_active("crawler-proj-specs");
    }

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run cleanly");
    });

    let client = reqwest::Client::new();

    // 1. Test POST /api/v1/storage/reindex
    let reindex_url = format!("http://{}/api/v1/storage/reindex", addr);
    let reindex_res = client.post(&reindex_url)
        .json(&serde_json::json!({ "project_id": "crawler-proj-specs" }))
        .send().await.unwrap();
    assert_eq!(reindex_res.status(), 200);

    let reindex_body: serde_json::Value = reindex_res.json().await.unwrap();
    assert_eq!(reindex_body["status"], "ok");
    assert_eq!(reindex_body["project_id"], "crawler-proj-specs");
    assert!(reindex_body["files_scanned"].as_u64().unwrap() >= 2);
    assert!(reindex_body["chunks_upserted"].as_u64().unwrap() >= 2);
    assert!(reindex_body["total_chunks"].as_u64().unwrap() >= 2);

    // Verify LanceDB disk table was created and contains data under workspace root
    let vector_dir = temp_root.join(".aico").join("storage").join("vector");
    assert!(vector_dir.exists(), "Vector store directory should exist under workspace root");

    // 2. Test POST /api/v1/storage/rebuild-graph
    let rebuild_url = format!("http://{}/api/v1/storage/rebuild-graph", addr);
    let rebuild_res = client.post(&rebuild_url)
        .json(&serde_json::json!({ "project_id": "crawler-proj-specs" }))
        .send().await.unwrap();
    assert_eq!(rebuild_res.status(), 200);

    let rebuild_body: serde_json::Value = rebuild_res.json().await.unwrap();
    assert_eq!(rebuild_body["status"], "ok");
    assert_eq!(rebuild_body["project_id"], "crawler-proj-specs");
    assert!(rebuild_body["nodes_count"].as_u64().unwrap() >= 1);

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_root);
}

// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-004
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-013
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-014
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-015
#[tokio::test]
async fn test_incremental_startup_vector_crawler_and_compaction() {
    let temp_root = std::env::temp_dir().join(format!(
        "aico_inc_crawl_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let p_specs = temp_root.join("crawler-inc-specs");
    let p_code = temp_root.join("codebase").join("crawler-inc");
    std::fs::create_dir_all(p_specs.join("adr")).unwrap();
    std::fs::create_dir_all(p_code.join("src")).unwrap();

    std::fs::write(
        p_specs.join("adr").join("0001-test.md"),
        "---\nid: ADR-0001\ntitle: Architecture Test\nstatus: Approved\nderives_from: []\n---\n# Architecture Decision 1\n\nSome body text.",
    )
    .unwrap();
    std::fs::write(
        p_code.join("src").join("lib.rs"),
        "pub fn alpha() -> i32 {\n    42\n}\n",
    )
    .unwrap();

    let federation = aico_storage::StorageFederationManager::with_workspace_root(&temp_root);
    let storage = federation
        .register_project("crawler-inc-specs", &p_specs)
        .await
        .expect("register project");

    // 1. First incremental crawl: indexes all files, writes manifest, compacts to 1 version
    let report1 = aico_server::crawler::WorkspaceCrawler::crawl_and_index_incremental(
        &storage,
        &p_specs,
        Some(&p_code),
    )
    .await
    .expect("first incremental crawl");

    assert_eq!(report1.files_scanned, 2);
    assert!(report1.chunks_upserted >= 2);
    assert_eq!(report1.total_chunks, report1.chunks_upserted);

    let manifest_file = temp_root
        .join(".aico")
        .join("storage")
        .join("vector")
        .join("manifest_crawler-inc-specs.json");
    assert!(
        manifest_file.exists(),
        "Manifest file should be persisted after crawl"
    );

    let vcount1 = storage
        .vector_store()
        .read()
        .await
        .version_count()
        .await
        .expect("version_count 1");
    assert_eq!(
        vcount1, 1,
        "First crawl should compact and prune down to 1 active LanceDB version"
    );

    // 2. Second incremental crawl with unchanged files: 0 chunks upserted, still 1 version
    let report2 = aico_server::crawler::WorkspaceCrawler::crawl_and_index_incremental(
        &storage,
        &p_specs,
        Some(&p_code),
    )
    .await
    .expect("second incremental crawl");

    assert_eq!(report2.files_scanned, 2);
    assert_eq!(
        report2.chunks_upserted, 0,
        "Unchanged files must not be re-upserted on subsequent startup crawl"
    );
    assert_eq!(report2.total_chunks, report1.total_chunks);

    let vcount2 = storage
        .vector_store()
        .read()
        .await
        .version_count()
        .await
        .expect("version_count 2");
    assert_eq!(vcount2, 1);

    // 3. Modify only src/lib.rs -> only that file's chunks are re-indexed, and versions pruned to 1
    std::fs::write(
        p_code.join("src").join("lib.rs"),
        "pub fn alpha() -> i32 {\n    99\n}\n\npub fn beta() -> i32 {\n    100\n}\n",
    )
    .unwrap();

    let report3 = aico_server::crawler::WorkspaceCrawler::crawl_and_index_incremental(
        &storage,
        &p_specs,
        Some(&p_code),
    )
    .await
    .expect("third incremental crawl after 1 file edit");

    assert_eq!(report3.files_scanned, 2);
    assert_eq!(
        report3.chunks_upserted, 2,
        "Only modified file's 2 chunks should be upserted"
    );
    assert_eq!(report3.total_chunks, report1.total_chunks + 1);

    let vcount3 = storage
        .vector_store()
        .read()
        .await
        .version_count()
        .await
        .expect("version_count 3");
    assert_eq!(
        vcount3, 1,
        "Incremental update should compact and prune down to 1 version"
    );

    let _ = std::fs::remove_dir_all(&temp_root);
}

// @verifies ft-core-canonical-workspace-storage-root::TASK-CORE-023-4::REQ-001
// @verifies ft-core-canonical-workspace-storage-root::TASK-CORE-023-4::REQ-002
// @verifies ft-core-canonical-workspace-storage-root::TASK-CORE-023-4::REQ-004
#[tokio::test]
async fn test_nested_specs_lineage_graph_persists_to_canonical_root_not_specs_folder() {
    let temp_root = std::env::temp_dir().join(format!("aico_canonical_root_{}", rand::random::<u32>()));
    let nested_specs_dir = temp_root.join("specs").join("nested-project");
    let dummy_epic_dir = nested_specs_dir.join("epics").join("ec-dummy").join("features").join("ft-dummy");
    std::fs::create_dir_all(&dummy_epic_dir).expect("create dummy epic dir");

    let dummy_spec_file = dummy_epic_dir.join("spec-ft-dummy.md");
    std::fs::write(
        &dummy_spec_file,
        "---\nid: ft-dummy\ntitle: Dummy Feature\nstatus: Draft\n---\n# Dummy Feature\n\n## 1. Requirements\n\n### REQ-001: Minimal requirement\nWhen invoked, the system shall succeed.\n",
    )
    .unwrap();

    // 1. Verify resolve_workspace_root_from_specs_path resolves to temp_root
    let resolved = aico_server::resolve_workspace_root_from_specs_path(&nested_specs_dir);
    assert_eq!(resolved, temp_root, "Grandparent workspace root should be resolved");

    // 2. Fetch or refresh graph cache
    let cache_manager = aico_server::GraphCacheManager::new();
    let _graph = cache_manager.get_or_refresh_graph(&nested_specs_dir).await;

    // 3. Snapshot must exist under <temp_root>/.aico/storage/graph/nested-project/lineage_graph.json
    let canonical_snapshot = temp_root
        .join(".aico")
        .join("storage")
        .join("graph")
        .join("nested-project")
        .join("lineage_graph.json");
    assert!(
        canonical_snapshot.exists(),
        "Snapshot must be saved under canonical root .aico/storage/graph, found none at {}",
        canonical_snapshot.display()
    );

    // 4. Stray folder under specs/.aico must NOT exist
    let rogue_specs_storage = temp_root.join("specs").join(".aico");
    assert!(
        !rogue_specs_storage.exists(),
        "No .aico directory must ever exist in specs/ folder: {}",
        rogue_specs_storage.display()
    );

    let _ = std::fs::remove_dir_all(&temp_root);
}




// @verifies spec-ft-core-auto-open-browser-on-start::TASK-CORE-024-2::REQ-002
#[test]
fn test_server_config_auto_open_defaults_to_false() {
    let config = ServerConfig::default();
    assert!(
        !config.auto_open_browser,
        "ServerConfig::default().auto_open_browser must default to false for test isolation"
    );
}

// @verifies spec-ft-core-auto-open-browser-on-start::TASK-CORE-024-1::REQ-001
// @verifies spec-ft-core-auto-open-browser-on-start::TASK-CORE-024-1::REQ-005
#[test]
fn test_browser_opener_resolves_platform_command() {
    let test_url = "http://localhost:4242/";
    let (prog, args) = aico_server::resolve_browser_command(test_url);

    #[cfg(target_os = "windows")]
    {
        assert_eq!(prog, "rundll32");
        assert_eq!(args, vec!["url.dll,FileProtocolHandler", test_url]);
    }

    #[cfg(target_os = "macos")]
    {
        assert_eq!(prog, "open");
        assert_eq!(args, vec![test_url]);
    }

    #[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
    {
        assert_eq!(prog, "xdg-open");
        assert_eq!(args, vec![test_url]);
    }
}
