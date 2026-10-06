use aico_core::{DiscoveredProject, ProjectManifest, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies SPEC-CORE-004::REQ-008
#[tokio::test]
async fn test_project_management_rest_api() {
    let mut config = ServerConfig::default();
    config.base_port = 4250;

    let mut registry = WorkspaceRegistry::new();
    let project = DiscoveredProject {
        id: "core-project".to_string(),
        name: "core-project".to_string(),
        specs_path: PathBuf::from("d:/aico/aico-specs"),
        codebase_path: PathBuf::from("d:/aico/codebase/core"),
        manifest: ProjectManifest {
            name: "core-project".to_string(),
            version: "0.1.0".to_string(),
            codebase_path: "../codebase/core".to_string(),
            created_at: None,
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
    // @verifies SPEC-CORE-006::REQ-012
    let stats_res = client
        .get(format!("http://{}/api/v1/stats", addr))
        .send()
        .await
        .expect("Stats request should succeed");
    assert_eq!(stats_res.status(), 200);

    // 5. GET /api/v1/epics
    // @verifies SPEC-CORE-007::REQ-001
    let epics_res = client
        .get(format!("http://{}/api/v1/epics", addr))
        .send()
        .await
        .expect("Epics request should succeed");
    assert_eq!(epics_res.status(), 200);

    let epics: Vec<serde_json::Value> = epics_res.json().await.expect("Should parse as JSON");
    assert!(epics.iter().any(|e| e["id"] == "EC-core"));
    assert!(epics.iter().any(|e| e["id"] == "EC-specs"));

    // 6. GET /api/v1/features
    let feat_res = client
        .get(format!("http://{}/api/v1/features", addr))
        .send()
        .await
        .expect("Features request should succeed");
    assert_eq!(feat_res.status(), 200);

    let features: Vec<serde_json::Value> = feat_res.json().await.expect("Should parse as JSON");
    assert!(features.iter().any(|f| f["id"] == "core-host-runtime"));
    assert!(features.iter().any(|f| f["id"] == "specs-blueprint-standards"));

    server_task.abort();
}
