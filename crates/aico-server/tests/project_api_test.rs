use aico_core::{DiscoveredProject, ProjectManifest, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies ft-core-discovery::TASK-CORE-004-3::REQ-008
#[tokio::test]
async fn test_project_management_rest_api() {
    let mut config = ServerConfig::default();
    config.base_port = 4250;

    let mut registry = WorkspaceRegistry::new();
    let project = DiscoveredProject {
        id: "core-project".to_string(),
        name: "core-project".to_string(),
        specs_path: PathBuf::from("d:/aico/aico-specs"),
        codebase_path: Some(PathBuf::from("d:/aico/codebase/core")),
        manifest: ProjectManifest {
            name: "core-project".to_string(),
            id: None,
            version: Some("0.1.0".to_string()),
            codebase_path: Some("../codebase/core".to_string()),
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::Active,
    };
    registry.register(project);

    let test_storage = std::env::temp_dir().join(format!("aico-test-{}", rand::random::<u64>()));
    let _ = std::fs::create_dir_all(&test_storage);

    let state = AppState {
        registry: Arc::new(RwLock::new(registry)),
        storage_federation: Arc::new(aico_storage::StorageFederationManager::with_workspace_root(test_storage.clone())),
        ..Default::default()
    };

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run");
    });

    let client = reqwest::Client::new();

    // 1. GET /api/v1/projects
    let list_res = client
        .get(format!("http://{}/api/v1/projects", addr))
        .send()
        .await
        .expect("Request should succeed");
    assert_eq!(list_res.status(), 200);

    let projects: Vec<DiscoveredProject> = list_res.json().await.expect("Should parse as JSON");
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].name, "core-project");

    // 2. POST /api/v1/projects/active (Valid project)
    let active_res = client
        .post(format!("http://{}/api/v1/projects/active", addr))
        .json(&serde_json::json!({ "project_id": "core-project" }))
        .send()
        .await
        .expect("Active request should succeed");
    assert_eq!(active_res.status(), 200);

    // 3. POST /api/v1/projects/active (Nonexistent project -> 404)
    let not_found_res = client
        .post(format!("http://{}/api/v1/projects/active", addr))
        .json(&serde_json::json!({ "project_id": "nonexistent" }))
        .send()
        .await
        .expect("Request should complete");
    assert_eq!(not_found_res.status(), 404);

    // 4. GET /api/v1/stats
    // @verifies ft-core-webui-shell::TASK-CORE-006-8::REQ-012
    let stats_res = client
        .get(format!("http://{}/api/v1/stats", addr))
        .send()
        .await
        .expect("Stats request should succeed");
    assert_eq!(stats_res.status(), 200);

    // 5. GET /api/v1/epics
    // @verifies ft-core-epic-hub::TASK-CORE-007-12::REQ-001
    let epics_res = client
        .get(format!("http://{}/api/v1/epics", addr))
        .send()
        .await
        .expect("Epics request should succeed");
    assert_eq!(epics_res.status(), 200);

    let epics: Vec<serde_json::Value> = epics_res.json().await.expect("Should parse as JSON");
    assert!(epics.iter().any(|e| e["id"] == "ec-core"));
    assert!(epics.iter().any(|e| e["id"] == "ec-specs"));

    // 6. GET /api/v1/features
    let feat_res = client
        .get(format!("http://{}/api/v1/features", addr))
        .send()
        .await
        .expect("Features request should succeed");
    assert_eq!(feat_res.status(), 200);

    let features: Vec<serde_json::Value> = feat_res.json().await.expect("Should parse as JSON");
    assert!(features.iter().any(|f| f["id"] == "ft-core-host-runtime" || f["id"] == "core-host-runtime"));
    assert!(features.iter().any(|f| f["id"] == "ft-specs-blueprint-standards" || f["id"] == "specs-blueprint-standards"));
    assert!(features.iter().any(|f| f["id"] == "ft-fast-trace" || f["id"] == "fast-trace"));

    // 7. GET /api/v1/epics/ec-core
    let single_epic_res = client
        .get(format!("http://{}/api/v1/epics/ec-core", addr))
        .send()
        .await
        .expect("Single epic request should succeed");
    assert_eq!(single_epic_res.status(), 200);
    let epic_obj: serde_json::Value = single_epic_res.json().await.expect("Should parse as JSON");
    assert_eq!(epic_obj["id"], "ec-core");
    assert!(epic_obj["executive_summary"].is_string());
    assert!(!epic_obj["ubiquitous_language"].as_array().unwrap().is_empty());

    // 8. GET /api/v1/features/ft-fast-trace
    let single_feat_res = client
        .get(format!("http://{}/api/v1/features/ft-fast-trace", addr))
        .send()
        .await
        .expect("Single feature request should succeed");
    assert_eq!(single_feat_res.status(), 200);
    let feat_obj: serde_json::Value = single_feat_res.json().await.expect("Should parse as JSON");
    assert_eq!(feat_obj["id"], "ft-fast-trace");
    assert!(feat_obj["description"].is_string());
    assert!(!feat_obj["requirements"].as_array().unwrap().is_empty());
    assert!(!feat_obj["tasks"].as_array().unwrap().is_empty());
    assert!(!feat_obj["ubiquitous_language"].as_array().unwrap().is_empty());
    assert!(feat_obj["brainstorm_content"].is_string(), "Brainstorm content was: {:?}", feat_obj["brainstorm_content"]);

    // 9. GET /api/v1/glossary
    let glossary_res = client
        .get(format!("http://{}/api/v1/glossary", addr))
        .send()
        .await
        .expect("Glossary request should succeed");
    assert_eq!(glossary_res.status(), 200);
    let glossary_arr: Vec<serde_json::Value> = glossary_res.json().await.expect("Should parse as JSON");
    assert!(!glossary_arr.is_empty());
    assert!(glossary_arr.iter().any(|t| t["term"] == "Codebase Root" || t["term"] == "Epic"));

    // 10. GET /api/v1/adrs/ADR-0001
    let single_adr_res = client
        .get(format!("http://{}/api/v1/adrs/ADR-0001", addr))
        .send()
        .await
        .expect("Single adr request should succeed");
    assert_eq!(single_adr_res.status(), 200);
    let adr_obj: serde_json::Value = single_adr_res.json().await.expect("Should parse as JSON");
    assert_eq!(adr_obj["id"], "ADR-0001");
    assert!(adr_obj["context"].is_string());

    // 11. GET /api/v1/raw
    let raw_res = client
        .get(format!("http://{}/api/v1/raw?path=features/ft-fast-trace/spec-ft-fast-trace.md", addr))
        .send()
        .await
        .expect("Raw request should succeed");
    assert_eq!(raw_res.status(), 200);
    let raw_text = raw_res.text().await.expect("Should read text");
    assert!(raw_text.contains("spec-ft-fast-trace"));

    server_task.abort();
    let _ = std::fs::remove_dir_all(&test_storage);
}

// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-19::REQ-027
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-19::REQ-028
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-19::REQ-029
#[tokio::test]
async fn test_create_and_update_project_manifest_api() {
    let temp_ws = std::env::temp_dir().join(format!("aico-manifest-api-{}", rand::random::<u64>()));
    std::fs::create_dir_all(&temp_ws).unwrap();

    // Seed an initial project so get_workspace_root(&registry) resolves to temp_ws
    let seed_specs = temp_ws.join("seed-specs");
    std::fs::create_dir_all(&seed_specs).unwrap();

    let mut registry = WorkspaceRegistry::new();
    registry.register(DiscoveredProject {
        id: "seed-specs".to_string(),
        name: "Seed Specs".to_string(),
        specs_path: seed_specs,
        codebase_path: None,
        manifest: ProjectManifest {
            name: "seed".to_string(),
            id: Some("seed-specs".to_string()),
            version: None,
            codebase_path: None,
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::CodebaseMissing,
    });
    registry.set_active("seed-specs");

    let mut config = ServerConfig::default();
    config.base_port = 4280;

    let state = AppState {
        registry: Arc::new(RwLock::new(registry)),
        storage_federation: Arc::new(aico_storage::StorageFederationManager::with_workspace_root(
            temp_ws.clone(),
        )),
        ..Default::default()
    };

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind");
    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();

    // 1. Create a new project with custom display name, optional empty URL, and custom repositories
    let create_res = client
        .post(format!("http://{}/api/v1/projects", addr))
        .json(&serde_json::json!({
            "project_name": "demo-app",
            "name": "Demo App Specs",
            "url": "",
            "repositories": [
                {
                    "id": "demo-core",
                    "name": "Demo Core Engine",
                    "type": "codebase",
                    "url": ""
                }
            ]
        }))
        .send()
        .await
        .expect("Create project request should succeed");
    assert_eq!(create_res.status(), 201);
    let created_proj: serde_json::Value = create_res.json().await.unwrap();
    assert_eq!(created_proj["id"], "demo-app-specs");
    assert_eq!(created_proj["name"], "Demo App Specs");

    // 2. GET /api/v1/projects/manifest
    let get_manifest_res = client
        .get(format!("http://{}/api/v1/projects/manifest", addr))
        .send()
        .await
        .expect("Get manifest should succeed");
    assert_eq!(get_manifest_res.status(), 200);
    let manifest_cfg: serde_json::Value = get_manifest_res.json().await.unwrap();
    assert_eq!(manifest_cfg["project_name"], "demo-app");
    assert_eq!(manifest_cfg["id"], "demo-app-specs");
    assert_eq!(manifest_cfg["name"], "Demo App Specs");
    assert!(manifest_cfg.get("url").is_none() || manifest_cfg["url"].is_null());
    let repos = manifest_cfg["repositories"].as_array().unwrap();
    assert_eq!(repos.len(), 1);
    assert_eq!(repos[0]["id"], "demo-core");
    assert_eq!(repos[0]["name"], "Demo Core Engine");
    assert_eq!(repos[0]["path"], "../codebase/demo-core");
    assert!(repos[0].get("url").is_none() || repos[0]["url"].is_null());

    // 3. GET /api/v1/git/status -> URLs should be null/absent when not set
    let git_res = client
        .get(format!("http://{}/api/v1/git/status", addr))
        .send()
        .await
        .expect("Git status should succeed");
    assert_eq!(git_res.status(), 200);
    let git_repos: Vec<serde_json::Value> = git_res.json().await.unwrap();
    assert_eq!(git_repos.len(), 2);
    assert!(git_repos[0].get("url").is_none() || git_repos[0]["url"].is_null());
    assert!(git_repos[1].get("url").is_none() || git_repos[1]["url"].is_null());

    // 4. PUT /api/v1/projects/manifest -> update display name, URLs, and add skills repo
    let put_res = client
        .put(format!("http://{}/api/v1/projects/manifest", addr))
        .json(&serde_json::json!({
            "name": "Demo App Updated",
            "url": "https://github.com/example/demo-app-specs",
            "repositories": [
                {
                    "id": "demo-core",
                    "name": "Demo Core Engine",
                    "type": "codebase",
                    "url": "https://github.com/example/demo-core"
                },
                {
                    "id": "demo-skills",
                    "name": "Demo Skills",
                    "type": "skills",
                    "url": ""
                }
            ]
        }))
        .send()
        .await
        .expect("Update manifest should succeed");
    assert_eq!(put_res.status(), 200);
    let updated_proj: serde_json::Value = put_res.json().await.unwrap();
    assert_eq!(updated_proj["name"], "Demo App Updated");

    // 5. Verify GET /api/v1/projects/manifest reflects updated values and fixed ../codebase/<id> paths
    let get_manifest_res2 = client
        .get(format!("http://{}/api/v1/projects/manifest", addr))
        .send()
        .await
        .unwrap();
    let manifest_cfg2: serde_json::Value = get_manifest_res2.json().await.unwrap();
    assert_eq!(manifest_cfg2["name"], "Demo App Updated");
    assert_eq!(manifest_cfg2["url"], "https://github.com/example/demo-app-specs");
    let repos2 = manifest_cfg2["repositories"].as_array().unwrap();
    assert_eq!(repos2.len(), 2);
    assert_eq!(repos2[0]["path"], "../codebase/demo-core");
    assert_eq!(repos2[0]["url"], "https://github.com/example/demo-core");
    assert_eq!(repos2[1]["id"], "demo-skills");
    assert_eq!(repos2[1]["path"], "../codebase/demo-skills");
    assert_eq!(repos2[1]["type"], "skills");
    assert!(repos2[1].get("url").is_none() || repos2[1]["url"].is_null());

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_ws);
}

// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-23::REQ-030
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-26::REQ-030
#[tokio::test]
async fn test_multi_tab_project_context_resolution() {
    let mut config = ServerConfig::default();
    config.base_port = 4310;

    let temp_ws = std::env::temp_dir().join(format!("aico-multi-tab-{}", rand::random::<u64>()));
    let proj2_dir = temp_ws.join("isolated-app-specs");
    std::fs::create_dir_all(&proj2_dir).unwrap();

    let manifest2_content = serde_json::json!({
        "project_name": "isolated-app",
        "id": "isolated-app-specs",
        "name": "Isolated App Specs",
        "repositories": []
    });
    std::fs::write(
        proj2_dir.join(".aico-project.json"),
        serde_json::to_string_pretty(&manifest2_content).unwrap(),
    )
    .unwrap();

    let mut registry = WorkspaceRegistry::new();
    let project1 = DiscoveredProject {
        id: "core-project".to_string(),
        name: "Core Project".to_string(),
        specs_path: PathBuf::from("d:/aico/aico-specs"),
        codebase_path: Some(PathBuf::from("d:/aico/codebase/core")),
        manifest: ProjectManifest {
            name: "Core Project".to_string(),
            id: None,
            version: Some("0.1.0".to_string()),
            codebase_path: Some("../codebase/core".to_string()),
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::Active,
    };
    let project2 = DiscoveredProject {
        id: "isolated-app-specs".to_string(),
        name: "Isolated App Specs".to_string(),
        specs_path: proj2_dir.clone(),
        codebase_path: None,
        manifest: ProjectManifest {
            name: "Isolated App Specs".to_string(),
            id: Some("isolated-app-specs".to_string()),
            version: Some("0.1.0".to_string()),
            codebase_path: None,
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::Active,
    };

    registry.register(project1);
    registry.register(project2);
    registry.set_active("core-project");

    let test_storage = temp_ws.join(".storage");
    let _ = std::fs::create_dir_all(&test_storage);

    let state = AppState {
        registry: Arc::new(RwLock::new(registry)),
        storage_federation: Arc::new(aico_storage::StorageFederationManager::with_workspace_root(test_storage.clone())),
        ..Default::default()
    };

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        server.serve().await.expect("Server should run");
    });

    let client = reqwest::Client::new();

    // 1. GET /api/v1/epics without project header -> falls back to active project ("core-project")
    let epics_default = client
        .get(format!("http://{}/api/v1/epics", addr))
        .send()
        .await
        .unwrap()
        .json::<Vec<serde_json::Value>>()
        .await
        .unwrap();
    assert!(!epics_default.is_empty(), "Default epics should come from core-project");

    // 2. GET /api/v1/epics with X-Aico-Project: isolated-app-specs -> isolated empty project
    let epics_tab2 = client
        .get(format!("http://{}/api/v1/epics", addr))
        .header("X-Aico-Project", "isolated-app-specs")
        .send()
        .await
        .unwrap()
        .json::<Vec<serde_json::Value>>()
        .await
        .unwrap();
    assert_eq!(epics_tab2.len(), 0, "Tab 2 request with X-Aico-Project should see 0 epics");

    // 3. GET /api/v1/epics?project=isolated-app-specs -> query parameter resolution
    let epics_query = client
        .get(format!("http://{}/api/v1/epics?project=isolated-app-specs", addr))
        .send()
        .await
        .unwrap()
        .json::<Vec<serde_json::Value>>()
        .await
        .unwrap();
    assert_eq!(epics_query.len(), 0, "Query param ?project= should see 0 epics");

    // 4. GET /api/v1/projects/manifest with X-Aico-Project header
    let manifest_tab2 = client
        .get(format!("http://{}/api/v1/projects/manifest", addr))
        .header("X-Aico-Project", "isolated-app-specs")
        .send()
        .await
        .unwrap()
        .json::<serde_json::Value>()
        .await
        .unwrap();
    assert_eq!(manifest_tab2["project_name"], "isolated-app");
    assert_eq!(manifest_tab2["name"], "Isolated App Specs");

    // 5. Verify server active project was NOT mutated by Tab 2 requests
    let _epics_default_after = client
        .get(format!("http://{}/api/v1/epics", addr))
        .send()
        .await
        .unwrap()
        .json::<Vec<serde_json::Value>>()
        .await
        .unwrap();
    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_ws);
}

// @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-4::REQ-006
// @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-4::REQ-002
#[tokio::test]
async fn test_create_project_local_only_no_ghost_repositories() {
    let mut config = ServerConfig::default();
    config.base_port = 4340;

    let temp_ws = std::env::temp_dir().join(format!("aico-local-only-test-{}", rand::random::<u64>()));
    let _ = std::fs::create_dir_all(&temp_ws);

    let seed_specs = temp_ws.join("seed-specs");
    let _ = std::fs::create_dir_all(&seed_specs);

    let mut registry = WorkspaceRegistry::new();
    registry.register(DiscoveredProject {
        id: "seed-specs".to_string(),
        name: "Seed Specs".to_string(),
        specs_path: seed_specs.clone(),
        codebase_path: None,
        manifest: ProjectManifest {
            name: "seed".to_string(),
            id: Some("seed-specs".to_string()),
            version: Some("0.1.0".to_string()),
            codebase_path: None,
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::CodebaseMissing,
    });
    registry.set_active("seed-specs");

    let state = AppState {
        registry: Arc::new(RwLock::new(registry)),
        storage_federation: Arc::new(aico_storage::StorageFederationManager::with_workspace_root(temp_ws.clone())),
        ..Default::default()
    };

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");
    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();

    // Create project with local_only = true and empty repositories
    let res = client
        .post(format!("http://{}/api/v1/projects", addr))
        .json(&serde_json::json!({
            "project_name": "clean-local-project",
            "local_only": true,
            "repositories": []
        }))
        .send()
        .await
        .expect("Create local project request should succeed");

    assert_eq!(res.status(), 201);
    let created_proj: serde_json::Value = res.json().await.unwrap();
    assert_eq!(created_proj["id"], "clean-local-project-specs");

    // Check .aico-project.json on disk
    let manifest_path = temp_ws.join("clean-local-project-specs").join(".aico-project.json");
    assert!(manifest_path.exists());
    let manifest_raw = std::fs::read_to_string(&manifest_path).unwrap();
    let manifest_json: serde_json::Value = serde_json::from_str(&manifest_raw).unwrap();

    // Verify repositories list is empty — NO ghost codebase was injected!
    let repos = manifest_json["repositories"].as_array().unwrap();
    assert!(repos.is_empty(), "Repositories array must be empty, no ghost codebase created");

    // Verify glossary.md exists
    assert!(temp_ws.join("clean-local-project-specs").join("glossary.md").exists());
    // Verify standard dirs exist
    assert!(temp_ws.join("clean-local-project-specs").join("adr").exists());
    assert!(temp_ws.join("clean-local-project-specs").join("epics").exists());
    assert!(temp_ws.join("clean-local-project-specs").join("features").exists());

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_ws);
}
