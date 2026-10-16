use aico_core::{DiscoveredProject, ProjectManifest, WorkspaceRegistry};
use aico_server::{AppState, HostServer, ServerConfig};
use aico_server::assets::DiscoveredAssetInfo;
use std::sync::Arc;
use tokio::sync::RwLock;

// @verifies spec-ft-core-assets-manager::REQ-001
// @verifies spec-ft-core-assets-manager::REQ-002
// @verifies spec-ft-core-assets-manager::REQ-003
// @verifies spec-ft-core-assets-manager::REQ-004
// @verifies spec-ft-core-assets-manager::REQ-005
// @verifies spec-ft-core-assets-manager::REQ-008
// @verifies spec-ft-core-assets-manager::REQ-009
// @verifies spec-ft-core-assets-manager::REQ-013
// @verifies spec-ft-core-assets-manager::REQ-014
#[tokio::test]
async fn test_assets_management_service_and_endpoints() {
    let temp_root = std::env::temp_dir().join(format!("aico_test_assets_{}", rand::random::<u32>()));
    let specs_dir = temp_root.join("specs");
    let epics_dir = specs_dir.join("epics").join("ec-demo");
    let epic_assets = epics_dir.join("assets");
    let feat_assets = epics_dir.join("features").join("ft-sub").join("assets");
    let standalone_assets = specs_dir.join("features").join("ft-standalone").join("assets");

    std::fs::create_dir_all(&epic_assets).unwrap();
    std::fs::create_dir_all(&feat_assets).unwrap();
    std::fs::create_dir_all(&standalone_assets).unwrap();

    // Seed mock assets
    std::fs::write(epic_assets.join("epic_banner.png"), b"FAKE_PNG_BYTES").unwrap();
    std::fs::write(feat_assets.join("sub_design.txt"), b"Hello from sub feature design snippet").unwrap();
    std::fs::write(standalone_assets.join("standalone_spec.md"), b"# Standalone Spec Content").unwrap();

    let mut config = ServerConfig::default();
    config.base_port = 4260;

    let mut registry = WorkspaceRegistry::new();
    let project = DiscoveredProject {
        id: "demo-project".to_string(),
        name: "demo-project".to_string(),
        specs_path: specs_dir.clone(),
        codebase_path: temp_root.join("codebase"),
        manifest: ProjectManifest {
            name: "demo-project".to_string(),
            version: "0.1.0".to_string(),
            codebase_path: "../codebase".to_string(),
            created_at: None,
            repositories: None,
        },
        status: aico_core::ProjectStatus::Active,
    };
    registry.register(project);
    registry.set_active("demo-project");

    let state = AppState {
        registry: Arc::new(RwLock::new(registry)),
        ..Default::default()
    };

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind successfully");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();

    // 1. GET /api/v1/epics/ec-demo/assets -> Returns both direct epic assets and sub-feature assets
    let epic_res = client
        .get(format!("http://{}/api/v1/epics/ec-demo/assets", addr))
        .send()
        .await
        .expect("Epic assets request should succeed");
    assert_eq!(epic_res.status(), 200);

    let epic_assets_list: Vec<DiscoveredAssetInfo> = epic_res.json().await.expect("Parse JSON");
    assert_eq!(epic_assets_list.len(), 2);

    let direct_item = epic_assets_list.iter().find(|a| a.filename == "epic_banner.png").unwrap();
    assert_eq!(direct_item.source_label, "epic");
    assert!(!direct_item.is_subfeature);

    let sub_item = epic_assets_list.iter().find(|a| a.filename == "sub_design.txt").unwrap();
    assert_eq!(sub_item.source_label, "ft-sub");
    assert!(sub_item.is_subfeature);
    assert_eq!(sub_item.text_preview.as_deref(), Some("Hello from sub feature design snippet"));

    // 2. GET /api/v1/features/ft-sub/assets -> Returns ONLY feature assets
    let feat_res = client
        .get(format!("http://{}/api/v1/features/ft-sub/assets", addr))
        .send()
        .await
        .expect("Feature assets request should succeed");
    assert_eq!(feat_res.status(), 200);

    let feat_assets_list: Vec<DiscoveredAssetInfo> = feat_res.json().await.expect("Parse JSON");
    assert_eq!(feat_assets_list.len(), 1);
    assert_eq!(feat_assets_list[0].filename, "sub_design.txt");
    assert_eq!(feat_assets_list[0].source_label, "ft-sub");
    assert!(!feat_assets_list[0].is_subfeature);

    // 3. GET /api/v1/features/ft-standalone/assets -> Standalone feature assets
    let standalone_res = client
        .get(format!("http://{}/api/v1/features/ft-standalone/assets", addr))
        .send()
        .await
        .expect("Standalone feature assets request should succeed");
    assert_eq!(standalone_res.status(), 200);
    let standalone_list: Vec<DiscoveredAssetInfo> = standalone_res.json().await.expect("Parse JSON");
    assert_eq!(standalone_list.len(), 1);
    assert_eq!(standalone_list[0].filename, "standalone_spec.md");

    // 4. GET /api/v1/assets/raw -> Serves raw file content with MIME type
    let raw_res = client
        .get(format!("http://{}/api/v1/assets/raw?path={}", addr, direct_item.path))
        .send()
        .await
        .expect("Raw asset request should succeed");
    assert_eq!(raw_res.status(), 200);
    assert_eq!(raw_res.headers().get("content-type").unwrap(), "image/png");
    let bytes = raw_res.bytes().await.unwrap();
    assert_eq!(&bytes[..], b"FAKE_PNG_BYTES");

    // 5. GET /api/v1/assets/raw -> Directory traversal rejection (REQ-003)
    let traversal_res = client
        .get(format!("http://{}/api/v1/assets/raw?path=../../etc/passwd", addr))
        .send()
        .await
        .expect("Traversal request should succeed");
    assert_eq!(traversal_res.status(), 400);

    // 6. POST /api/v1/assets/upload -> Uploads file into epic assets (REQ-001, REQ-002)
    let form = reqwest::multipart::Form::new()
        .text("scope_type", "epic")
        .text("scope_id", "ec-demo")
        .part("file", reqwest::multipart::Part::bytes(b"UPLOADED_CONTENT".to_vec()).file_name("new_drop.txt"));

    let upload_res = client
        .post(format!("http://{}/api/v1/assets/upload", addr))
        .multipart(form)
        .send()
        .await
        .expect("Upload request should succeed");
    assert_eq!(upload_res.status(), 200);

    let uploaded_info: DiscoveredAssetInfo = upload_res.json().await.unwrap();
    assert_eq!(uploaded_info.filename, "new_drop.txt");
    assert!(epic_assets.join("new_drop.txt").exists());
    assert_eq!(std::fs::read(epic_assets.join("new_drop.txt")).unwrap(), b"UPLOADED_CONTENT");

    // 7. POST /api/v1/assets/open-system -> Valid file & traversal guard (REQ-003, REQ-008)
    let open_bad_res = client
        .post(format!("http://{}/api/v1/assets/open-system", addr))
        .json(&serde_json::json!({ "path": "../bad/path" }))
        .send()
        .await
        .expect("Open system traversal check");
    assert_eq!(open_bad_res.status(), 400);

    let open_ok_res = client
        .post(format!("http://{}/api/v1/assets/open-system", addr))
        .json(&serde_json::json!({ "path": direct_item.path }))
        .send()
        .await
        .expect("Open system request should succeed");
    assert_eq!(open_ok_res.status(), 200);

    // 8. DELETE /api/v1/assets -> Path traversal guard, 404, and physical deletion (REQ-003, REQ-009)
    let del_bad_res = client
        .delete(format!("http://{}/api/v1/assets", addr))
        .json(&serde_json::json!({ "path": "../bad/path" }))
        .send()
        .await
        .expect("Delete traversal check");
    assert_eq!(del_bad_res.status(), 400);

    let del_notfound_res = client
        .delete(format!("http://{}/api/v1/assets", addr))
        .json(&serde_json::json!({ "path": "epics/ec-demo/assets/non_existent.png" }))
        .send()
        .await
        .expect("Delete not found check");
    assert_eq!(del_notfound_res.status(), 404);

    let del_ok_res = client
        .delete(format!("http://{}/api/v1/assets", addr))
        .json(&serde_json::json!({ "path": direct_item.path }))
        .send()
        .await
        .expect("Delete request should succeed");
    assert_eq!(del_ok_res.status(), 200);
    assert!(!epic_assets.join("epic_banner.png").exists());

    // 9. GET /api/v1/config -> Returns workspace config with asset upload rules (REQ-013)
    let config_res = client
        .get(format!("http://{}/api/v1/config", addr))
        .send()
        .await
        .expect("Config request should succeed");
    assert_eq!(config_res.status(), 200);
    let aico_config: aico_core::AicoConfig = config_res.json().await.expect("Parse AicoConfig JSON");
    assert!(aico_config.assets.allowed_image_extensions.contains(&"png".to_string()));
    assert!(aico_config.assets.allowed_text_extensions.contains(&"ipynb".to_string()));
    assert!(aico_config.assets.allowed_text_extensions.contains(&"py".to_string()));

    // 10. POST /api/v1/assets/upload -> File type validation (REQ-014)
    // 10a. Upload Jupyter notebook .ipynb -> allowed
    let ipynb_form = reqwest::multipart::Form::new()
        .text("scope_type", "feature")
        .text("scope_id", "ft-sub")
        .part("file", reqwest::multipart::Part::bytes(b"{\"cells\": [], \"metadata\": {}}".to_vec()).file_name("experiment.ipynb"));
    let ipynb_res = client
        .post(format!("http://{}/api/v1/assets/upload", addr))
        .multipart(ipynb_form)
        .send()
        .await
        .expect("Upload .ipynb should succeed");
    assert_eq!(ipynb_res.status(), 200);
    assert!(feat_assets.join("experiment.ipynb").exists());

    // 10b. Upload Python file .py -> allowed
    let py_form = reqwest::multipart::Form::new()
        .text("scope_type", "feature")
        .text("scope_id", "ft-sub")
        .part("file", reqwest::multipart::Part::bytes(b"print('hello world')\n".to_vec()).file_name("script.py"));
    let py_res = client
        .post(format!("http://{}/api/v1/assets/upload", addr))
        .multipart(py_form)
        .send()
        .await
        .expect("Upload .py should succeed");
    assert_eq!(py_res.status(), 200);
    assert!(feat_assets.join("script.py").exists());

    // 10c. Upload UTF-8 readable text without extension -> allowed via allow_utf8_text_fallback
    let utf8_form = reqwest::multipart::Form::new()
        .text("scope_type", "feature")
        .text("scope_id", "ft-sub")
        .part("file", reqwest::multipart::Part::bytes(b"custom plain text log without extension".to_vec()).file_name("custom_notes"));
    let utf8_res = client
        .post(format!("http://{}/api/v1/assets/upload", addr))
        .multipart(utf8_form)
        .send()
        .await
        .expect("Upload UTF-8 plain text should succeed");
    assert_eq!(utf8_res.status(), 200);
    assert!(feat_assets.join("custom_notes").exists());

    // 10d. Upload disallowed binary file (e.g. .exe with binary null bytes) -> rejected with 400 Bad Request
    let bin_form = reqwest::multipart::Form::new()
        .text("scope_type", "feature")
        .text("scope_id", "ft-sub")
        .part("file", reqwest::multipart::Part::bytes(vec![0x7f, 0x45, 0x4c, 0x46, 0x00, 0x01, 0x00]).file_name("malicious.exe"));
    let bin_res = client
        .post(format!("http://{}/api/v1/assets/upload", addr))
        .multipart(bin_form)
        .send()
        .await
        .expect("Upload binary request should be rejected");
    assert_eq!(bin_res.status(), 400);

    server_task.abort();
    let _ = std::fs::remove_dir_all(&temp_root);
}
