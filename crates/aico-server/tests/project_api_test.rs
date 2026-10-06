use aico_core::{DiscoveredProject, ProjectManifest, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use std::path::PathBuf;
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies spec-ft-core-discovery::REQ-008
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
    // @verifies spec-ft-core-webui-shell::REQ-012
    let stats_res = client
        .get(format!("http://{}/api/v1/stats", addr))
        .send()
        .await
        .expect("Stats request should succeed");
    assert_eq!(stats_res.status(), 200);

    // 5. GET /api/v1/epics
    // @verifies spec-ft-core-epic-hub::REQ-001
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
}
