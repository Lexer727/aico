use aico_storage::{StorageManager, HybridQueryEngine, CodeChunker, EmbeddingPipeline};

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
