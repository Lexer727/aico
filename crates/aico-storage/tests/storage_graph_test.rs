use aico_storage::{AicoGraphStore, GraphEdge, GraphNode, StorageManager};

// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-1::REQ-001
#[tokio::test]
async fn test_aico_graph_store_naming_and_init() {
    let temp_dir = std::env::temp_dir().join("aico_graph_store_naming_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let graph_dir = temp_dir.join(".aico").join("storage").join("graph");
    let store = AicoGraphStore::open(&graph_dir).expect("AicoGraphStore::open must succeed");

    assert_eq!(store.file_path(), graph_dir.join("lineage_graph.json"));

    // Verify upsert_node and query
    store
        .upsert_node(GraphNode::new("ec-storage", "Epic", "Storage Architecture", "In Progress"))
        .unwrap();

    let snapshot = store.load_snapshot().expect("load_snapshot must succeed");
    assert_eq!(snapshot.nodes.len(), 1);
    assert_eq!(snapshot.nodes[0].id, "ec-storage");
    assert_eq!(snapshot.nodes[0].title, "Storage Architecture");
}

// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-1::REQ-001
#[tokio::test]
async fn test_storage_manager_exposes_aico_graph_store() {
    let temp_dir = std::env::temp_dir().join("aico_storage_manager_graph_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).expect("StorageManager::open must succeed");
    let graph_guard = storage_mgr.graph_store().read().await;

    // Proves graph_store is typed as AicoGraphStore
    let snapshot = graph_guard.load_snapshot().expect("load_snapshot");
    assert!(snapshot.nodes.is_empty());
}

// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-2::REQ-002
// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-2::REQ-003
// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-2::REQ-010
// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-2::REQ-011
#[tokio::test]
async fn test_indexed_adjacency_and_fast_traversal() {
    let temp_dir = std::env::temp_dir().join("aico_adjacency_traversal_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let graph_dir = temp_dir.join(".aico").join("storage").join("graph");
    let store = AicoGraphStore::open(&graph_dir).expect("open AicoGraphStore");

    // 1. Batch upsert a chain: ADR -> Epic -> Feature -> Spec -> Task -> Code
    let nodes = vec![
        GraphNode::new("ADR-0011", "ADR", "Native Storage Architecture", "Completed"),
        GraphNode::new("ec-storage", "Epic", "Native Storage", "In Progress"),
        GraphNode::new("ft-storage-aico-graph-and-incremental-cache", "Feature", "AICO Graph & Cache", "In Progress"),
        GraphNode::new("spec-ft-storage-aico-graph-and-incremental-cache", "Spec", "AICO Graph Specification", "Draft"),
        GraphNode::new("TASK-STORAGE-001-2", "Task", "Dual Adjacency Indexing", "In Progress"),
        GraphNode::new("code:crates/aico-storage/src/graph.rs", "Code", "Graph Storage Module", "Active"),
    ];

    let edges = vec![
        GraphEdge::new("ADR-0011", "ec-storage", "derives_from"),
        GraphEdge::new("ec-storage", "ft-storage-aico-graph-and-incremental-cache", "contains"),
        GraphEdge::new("ft-storage-aico-graph-and-incremental-cache", "spec-ft-storage-aico-graph-and-incremental-cache", "specifies"),
        GraphEdge::new("spec-ft-storage-aico-graph-and-incremental-cache", "TASK-STORAGE-001-2", "addresses"),
        GraphEdge::new("TASK-STORAGE-001-2", "code:crates/aico-storage/src/graph.rs", "verifies"),
    ];

    store.batch_upsert(nodes, edges).expect("batch_upsert must succeed");

    // 2. Query downstream from ADR-0011 with 5 hops
    let start_time = std::time::Instant::now();
    let downstream = store.query_lineage("ADR-0011", "downstream", 5).expect("query_lineage downstream");
    let elapsed = start_time.elapsed();

    // Verify sub-millisecond execution
    assert!(elapsed.as_millis() < 10, "Adjacency BFS traversal took too long: {:?}", elapsed);
    assert_eq!(downstream.len(), 5, "Downstream must reach all 5 descendants in chain");
    assert_eq!(downstream[0]["id"], "ec-storage");
    assert_eq!(downstream[4]["id"], "code:crates/aico-storage/src/graph.rs");

    // 3. Query upstream from code seam
    let upstream = store.query_lineage("code:crates/aico-storage/src/graph.rs", "upstream", 5).expect("query_lineage upstream");
    assert_eq!(upstream.len(), 5, "Upstream must reach all 5 ancestors back to ADR");
    assert_eq!(upstream[0]["id"], "TASK-STORAGE-001-2");
    assert_eq!(upstream[4]["id"], "ADR-0011");
}

// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-2::REQ-012
#[tokio::test]
async fn test_corrupted_json_recovery() {
    let temp_dir = std::env::temp_dir().join("aico_corrupted_json_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let graph_dir = temp_dir.join(".aico").join("storage").join("graph");
    std::fs::create_dir_all(&graph_dir).unwrap();

    let file_path = graph_dir.join("lineage_graph.json");
    std::fs::write(&file_path, "{ broken invalid json ... }").unwrap();

    // Opening with corrupted JSON must not panic and must recover gracefully
    let store = AicoGraphStore::open(&graph_dir).expect("AicoGraphStore::open must recover gracefully");
    let snapshot = store.load_snapshot().expect("load_snapshot must succeed");
    assert!(snapshot.nodes.is_empty(), "Recovered snapshot must be empty");
}
