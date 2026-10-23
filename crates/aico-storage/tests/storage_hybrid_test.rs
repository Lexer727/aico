use aico_storage::{
    CodeChunker, EmbeddingPipeline, GraphEdge, GraphNode, HybridQueryEngine, KuzuGraphStore,
    StorageManager,
};

// @verifies ft-core-local-storage::TASK-CORE-003-6::REQ-007
#[tokio::test]
async fn test_hybrid_vector_and_graph_query() {
    let temp_dir = std::env::temp_dir().join("aico_hybrid_test_1");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).unwrap();
    let chunker = CodeChunker::new();
    let pipeline = EmbeddingPipeline::new();

    // Populate vector store
    let code = "pub fn verify_token(token: &str) -> bool { true }";
    let chunks = chunker.chunk_file("crates/auth/src/lib.rs", code);
    pipeline.ingest_chunks(&storage_mgr, &chunks).await.unwrap();

    // Populate graph store
    {
        let mut gstore = storage_mgr.graph_store().write().await;
        gstore.execute_query("CREATE (s:Symbol {name: 'verify_token'})").unwrap();
    }

    // Hybrid search
    let engine = HybridQueryEngine::new();
    let result = engine.search(&storage_mgr, "verify token signature", 3).await.expect("Hybrid query failed");

    assert!(!result.vector_matches.is_empty(), "Must return vector matches");
    assert_eq!(result.query, "verify token signature");
}

// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
#[tokio::test]
async fn test_kuzu_graph_store_persistence_and_traversal() {
    let temp_dir = std::env::temp_dir().join("aico_kuzu_lineage_persistence_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let graph_dir = temp_dir.join(".aico").join("storage").join("graph");
    {
        let mut store = KuzuGraphStore::open(&graph_dir).expect("open KuzuGraphStore");

        // 1. Insert ADR, Epic, Feature, Spec, Plan via upsert_node / upsert_edge
        store
            .upsert_node(GraphNode::new("ADR-0004", "ADR", "React Frontend", "Accepted"))
            .unwrap();
        store
            .upsert_node(GraphNode::new("ec-core", "Epic", "Core Architecture", "In Progress"))
            .unwrap();
        store
            .upsert_node(GraphNode::new(
                "ft-core-workspace-graph-and-project-creator",
                "Feature",
                "Workspace UI & Lineage Graph",
                "In Progress",
            ))
            .unwrap();
        store
            .upsert_node(GraphNode::new(
                "spec-ft-core-workspace-graph-and-project-creator",
                "Spec",
                "Feature Specification",
                "In Progress",
            ))
            .unwrap();
        store
            .upsert_node(GraphNode::new(
                "plan-ft-core-workspace-graph-and-project-creator",
                "Plan",
                "Implementation Plan",
                "In Progress",
            ))
            .unwrap();

        store
            .upsert_edge(GraphEdge::new("ADR-0004", "ec-core", "GOVERNS"))
            .unwrap();
        store
            .upsert_edge(GraphEdge::new(
                "ec-core",
                "ft-core-workspace-graph-and-project-creator",
                "CONTAINS",
            ))
            .unwrap();
        store
            .upsert_edge(GraphEdge::new(
                "ft-core-workspace-graph-and-project-creator",
                "spec-ft-core-workspace-graph-and-project-creator",
                "SPECIFIED_BY",
            ))
            .unwrap();
        store
            .upsert_edge(GraphEdge::new(
                "ft-core-workspace-graph-and-project-creator",
                "plan-ft-core-workspace-graph-and-project-creator",
                "PLANNED_BY",
            ))
            .unwrap();

        // 2. Insert Requirement, Task, and Code nodes + directed edges via Cypher
        store
            .execute_query(
                "MERGE (r:Requirement {id: 'REQ-004', title: 'Kuzu Property Graph Persistence', status: 'Verified'})",
            )
            .unwrap();
        store
            .execute_query(
                "MERGE (t:Task {id: 'TASK-CORE-017-4', title: 'Implement Persistent KuzuGraphStore', status: 'In Progress'})",
            )
            .unwrap();
        store
            .execute_query(
                "CREATE (c:Code {id: 'crates/aico-storage/src/graph.rs', title: 'graph.rs', status: 'Implemented'})",
            )
            .unwrap();

        store
            .execute_query(
                "MATCH (s:Spec {id: 'spec-ft-core-workspace-graph-and-project-creator'}), (r:Requirement {id: 'REQ-004'}) CREATE (s)-[:DEFINES]->(r)",
            )
            .unwrap();
        store
            .execute_query(
                "MATCH (p:Plan {id: 'plan-ft-core-workspace-graph-and-project-creator'}), (t:Task {id: 'TASK-CORE-017-4'}) MERGE (p)-[:HAS_TASK]->(t)",
            )
            .unwrap();
        store
            .execute_query(
                "MATCH (t:Task {id: 'TASK-CORE-017-4'}), (r:Requirement {id: 'REQ-004'}) CREATE (t)-[:ADDRESSES]->(r)",
            )
            .unwrap();
        store
            .execute_query(
                "MATCH (t:Task {id: 'TASK-CORE-017-4'}), (c:Code {id: 'crates/aico-storage/src/graph.rs'}) CREATE (t)-[:IMPLEMENTED_BY]->(c)",
            )
            .unwrap();

        assert_eq!(store.node_count(), 8);
        assert_eq!(store.edge_count(), 8);
    }

    // 3. Verify lineage_graph.json exists on disk and re-open store
    let json_path = graph_dir.join("lineage_graph.json");
    assert!(json_path.exists(), "lineage_graph.json must be persisted to disk");

    let reopened = KuzuGraphStore::open(&graph_dir).expect("reopen KuzuGraphStore");
    assert_eq!(reopened.node_count(), 8);
    assert_eq!(reopened.edge_count(), 8);

    // 4. Query downstream lineage from ADR-0004 (up to 4 hops)
    let downstream = reopened
        .query_lineage("ADR-0004", "downstream", 4)
        .expect("downstream query_lineage");
    let downstream_ids: Vec<&str> = downstream
        .iter()
        .filter_map(|v| v.get("id").and_then(|s| s.as_str()))
        .collect();
    assert!(downstream_ids.contains(&"ec-core"));
    assert!(downstream_ids.contains(&"ft-core-workspace-graph-and-project-creator"));
    assert!(downstream_ids.contains(&"spec-ft-core-workspace-graph-and-project-creator"));
    assert!(downstream_ids.contains(&"REQ-004"));

    // 5. Query upstream lineage from crates/aico-storage/src/graph.rs (up to 3 hops)
    let upstream = reopened
        .query_lineage("crates/aico-storage/src/graph.rs", "upstream", 3)
        .expect("upstream query_lineage");
    let upstream_ids: Vec<&str> = upstream
        .iter()
        .filter_map(|v| v.get("id").and_then(|s| s.as_str()))
        .collect();
    assert!(upstream_ids.contains(&"TASK-CORE-017-4"));
    assert!(upstream_ids.contains(&"plan-ft-core-workspace-graph-and-project-creator"));
    assert!(upstream_ids.contains(&"ft-core-workspace-graph-and-project-creator"));

    // 6. Query via execute_cypher MATCH with multi-hop pattern
    let cypher_res = reopened
        .execute_cypher("MATCH (n {id: 'ec-core'})-[*1..2]->(m) RETURN m")
        .expect("execute_cypher MATCH");
    let cypher_ids: Vec<&str> = cypher_res
        .iter()
        .filter_map(|v| v.get("id").and_then(|s| s.as_str()))
        .collect();
    assert!(cypher_ids.contains(&"ft-core-workspace-graph-and-project-creator"));
    assert!(cypher_ids.contains(&"spec-ft-core-workspace-graph-and-project-creator"));
}

