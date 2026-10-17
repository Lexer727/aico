use std::fs;
use std::sync::Arc;
use aico_storage::StorageManager;

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
