use std::fs;
use std::sync::Arc;
use aico_storage::{StorageManager, StorageFederationManager, StorageError};

// @verifies ft-core-local-storage::TASK-CORE-003-1::REQ-001
// @verifies ft-core-local-storage::TASK-CORE-003-1::REQ-002
// @verifies ft-core-local-storage::TASK-CORE-003-1::REQ-009
#[tokio::test]
async fn test_embedded_databases_init_and_concurrency() {
    let temp_dir = std::env::temp_dir().join("aico_storage_test_1");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).expect("Failed to initialize StorageManager");

    // Verify directories created
    let vector_dir = temp_dir.join(".aico").join("storage").join("vector");
    let graph_dir = temp_dir.join(".aico").join("storage").join("graph");
    assert!(vector_dir.exists(), "Vector directory must exist");
    assert!(graph_dir.exists(), "Graph directory must exist");

    // Verify pure in-process flag
    assert!(storage_mgr.is_in_process(), "Must be pure in-process with zero daemons");

    // Test concurrent reads and writes using tokio tasks
    let mgr = Arc::new(storage_mgr);
    let mut handles = Vec::new();

    // Spawn 5 writer tasks to vector store
    for i in 0..5 {
        let m = mgr.clone();
        handles.push(tokio::spawn(async move {
            let mut vstore = m.vector_store().write().await;
            vstore.upsert_record(
                &format!("rec-{}", i),
                vec![0.1 * i as f32; 384],
                serde_json::json!({ "doc_id": format!("doc-{}", i) }),
            ).unwrap();
        }));
    }

    // Spawn 5 concurrent reader tasks
    for _ in 0..5 {
        let m = mgr.clone();
        handles.push(tokio::spawn(async move {
            let vstore = m.vector_store().read().await;
            let _ = vstore.record_count();
        }));
    }

    for h in handles {
        h.await.unwrap();
    }

    // Verify vector count
    let vstore = mgr.vector_store().read().await;
    assert_eq!(vstore.record_count(), 5);

    // Test graph store Cypher execution
    let mut gstore = mgr.graph_store().write().await;
    let res = gstore.execute_query("CREATE (p:Project {id: 'proj-1'})").unwrap();
    assert!(res.contains("ok") || res.contains("created") || res.contains("success"));
}

// @verifies ft-core-local-storage::TASK-CORE-003-1::REQ-003
#[tokio::test]
async fn test_vector_similarity_search() {
    let temp_dir = std::env::temp_dir().join("aico_storage_test_2");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).unwrap();
    let mut vstore = storage_mgr.vector_store().write().await;

    // Insert 2 records with 384-dimensional embeddings
    let mut v1 = vec![0.0f32; 384];
    v1[0] = 1.0;
    let mut v2 = vec![0.0f32; 384];
    v2[1] = 1.0;

    vstore.upsert_record("target-1", v1.clone(), serde_json::json!({"tag": "match"})).unwrap();
    vstore.upsert_record("target-2", v2.clone(), serde_json::json!({"tag": "other"})).unwrap();

    // Query nearest to v1
    let results = vstore.query_nearest(&v1, 1).unwrap();
    assert_eq!(results.len(), 1);
    assert_eq!(results[0].id, "target-1");
}

// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-1::REQ-001
// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-1::REQ-002
// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-1::REQ-007
// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-6::REQ-001
// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-6::REQ-002
// @verifies ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-6::REQ-011
#[tokio::test]
async fn test_federation_handle_pooling_and_isolation() {
    let base_temp = std::env::temp_dir().join("aico_storage_federation_test");
    let _ = fs::remove_dir_all(&base_temp);

    let proj_a_dir = base_temp.join("proj_alpha");
    let proj_b_dir = base_temp.join("proj_beta");
    fs::create_dir_all(&proj_a_dir).unwrap();
    fs::create_dir_all(&proj_b_dir).unwrap();

    let federation = StorageFederationManager::new();

    // Register project A and project B
    let mgr_a = federation.register_project("proj-a", &proj_a_dir).await.expect("proj A should register");
    let mgr_b = federation.register_project("proj-b", &proj_b_dir).await.expect("proj B should register");

    // REQ-002 & REQ-011: Storage is located under workspace root `<base_temp>/.aico/storage/`, NOT inside project specs dirs
    let shared_vector_dir = base_temp.join(".aico").join("storage").join("vector");
    let a_graph_dir = base_temp.join(".aico").join("storage").join("graph").join("proj-a");
    let b_graph_dir = base_temp.join(".aico").join("storage").join("graph").join("proj-b");
    assert!(shared_vector_dir.exists(), "Unified workspace vector storage dir must exist at workspace root");
    assert!(a_graph_dir.exists(), "Proj A graph storage dir must exist at workspace root");
    assert!(b_graph_dir.exists(), "Proj B graph storage dir must exist at workspace root");
    assert!(!proj_a_dir.join(".aico").exists(), "Proj A specs dir must remain free of .aico");
    assert!(!proj_b_dir.join(".aico").exists(), "Proj B specs dir must remain free of .aico");

    // REQ-001: Both projects share the single unified LanceVectorStore handle, but have separate AicoGraphStore handles
    assert!(Arc::ptr_eq(&mgr_a.vector_store_arc(), &mgr_b.vector_store_arc()), "Projects must share the single workspace LanceVectorStore");
    assert!(!Arc::ptr_eq(&mgr_a.graph_store_arc(), &mgr_b.graph_store_arc()), "Projects must have isolated per-project AicoGraphStore handles");

    // Populate project A and project B records tagged with project_id
    {
        let mut v_a = mgr_a.vector_store().write().await;
        v_a.upsert_record("doc-a", vec![0.5f32; 384], serde_json::json!({"project_id": "proj-a"})).unwrap();
    }
    {
        let mut v_b = mgr_b.vector_store().write().await;
        v_b.upsert_record("doc-b", vec![0.9f32; 384], serde_json::json!({"project_id": "proj-b"})).unwrap();
    }

    // Verify per-project and unified counts in the shared vector store
    {
        let v = mgr_a.vector_store().read().await;
        assert_eq!(v.record_count(), 2, "Unified LanceVectorStore holds both projects' records");
        assert_eq!(v.record_count_for_project("proj-a"), 1);
        assert_eq!(v.record_count_for_project("proj-b"), 1);
    }

    // Handle pooling: calling register_project again returns the existing handle
    let mgr_a2 = federation.register_project("proj-a", &proj_a_dir).await.expect("re-register should return pooled handle");
    {
        let v_a2 = mgr_a2.vector_store().read().await;
        assert_eq!(v_a2.record_count_for_project("proj-a"), 1);
    }

    // Active project swap
    assert_eq!(federation.get_active_project_id().await, Some("proj-a".to_string()));
    let switched = federation.switch_project("proj-b").await.expect("switching to proj-b should succeed");
    assert_eq!(switched.project_id, "proj-b");
    assert_eq!(federation.get_active_project_id().await, Some("proj-b".to_string()));

    // REQ-010: Switch to invalid project
    let invalid_res = federation.switch_project("non-existent-proj").await;
    match invalid_res {
        Err(StorageError::ProjectNotFound(id)) => assert_eq!(id, "non-existent-proj"),
        _ => panic!("Expected StorageError::ProjectNotFound"),
    }
    // Active project remains proj-b
    assert_eq!(federation.get_active_project_id().await, Some("proj-b".to_string()));

    // REQ-008: Concurrency across handles
    let fed = Arc::new(federation);
    let mut handles = Vec::new();
    for i in 0..10 {
        let f = fed.clone();
        handles.push(tokio::spawn(async move {
            let pid = if i % 2 == 0 { "proj-a" } else { "proj-b" };
            let mgr = f.get_project(pid).await.expect("Project must exist");
            let v = mgr.vector_store().read().await;
            assert_eq!(v.record_count_for_project(pid), 1);
        }));
    }
    for h in handles {
        h.await.unwrap();
    }

    let _ = fs::remove_dir_all(&base_temp);
}
