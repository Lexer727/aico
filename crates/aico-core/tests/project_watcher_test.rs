use std::fs;
use std::sync::Arc;
use tokio::sync::RwLock;
use aico_core::{DiscoveryWatcher, DiscoveryEvent, WorkspaceRegistry};

// @verifies SPEC-CORE-004::REQ-006
// @verifies SPEC-CORE-004::REQ-008
#[tokio::test]
async fn test_hot_discovery_watcher() {
    let temp_dir = std::env::temp_dir().join("aico_watcher_test_1");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let registry = Arc::new(RwLock::new(WorkspaceRegistry::new()));
    let (watcher, mut event_rx) = DiscoveryWatcher::new(&temp_dir, registry.clone());

    // Initially 0 projects
    let initial_count = watcher.poll_and_sync().await.unwrap();
    assert_eq!(initial_count, 0);

    // Create a new project directory dynamically
    let new_specs_dir = temp_dir.join("live-specs");
    fs::create_dir_all(&new_specs_dir).unwrap();
    let manifest_json = r#"{
        "name": "live-app",
        "version": "0.1.0",
        "codebase_path": "../codebase/live-app"
    }"#;
    fs::write(new_specs_dir.join(".aico-project.json"), manifest_json).unwrap();

    // Hot-sync watcher
    let updated_count = watcher.poll_and_sync().await.unwrap();
    assert_eq!(updated_count, 1);

    // Verify registry was automatically updated
    let reg = registry.read().await;
    let projects = reg.list();
    assert_eq!(projects.len(), 1);
    assert_eq!(projects[0].name, "live-app");

    // Verify broadcast event was received
    let event = event_rx.recv().await.expect("Must receive DiscoveryEvent");
    match event {
        DiscoveryEvent::RegistryUpdated(ids) => {
            assert_eq!(ids, vec!["live-app".to_string()]);
        }
    }
}
