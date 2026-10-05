use aico_storage::{CodeChunker, EmbeddingPipeline, StorageManager};

// @verifies SPEC-CORE-003::REQ-004
#[tokio::test]
async fn test_semantic_chunking_and_vector_search() {
    let temp_dir = std::env::temp_dir().join("aico_vector_test_1");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).unwrap();
    let chunker = CodeChunker::new();
    let pipeline = EmbeddingPipeline::new();

    let source = r#"
pub fn authenticate(user: &str) -> bool {
    // Check credentials
    true
}

pub fn authorize(role: &str) -> bool {
    // Check role access
    role == "admin"
}
"#;

    // 1. Chunk source code
    let chunks = chunker.chunk_file("crates/auth/src/lib.rs", source);
    assert_eq!(chunks.len(), 2);
    assert!(chunks[0].content.contains("pub fn authenticate"));
    assert!(chunks[1].content.contains("pub fn authorize"));
    assert!(!chunks[0].content_hash.is_empty());

    // 2. Ingest chunks into vector store
    let ingested = pipeline.ingest_chunks(&storage_mgr, &chunks).await.expect("Failed to ingest chunks");
    assert_eq!(ingested, 2);

    // 3. Search nearest
    let query_vector = pipeline.embed_text("authenticate user credentials");
    assert_eq!(query_vector.len(), 384);

    let vstore = storage_mgr.vector_store().read().await;
    let results = vstore.query_nearest(&query_vector, 1).unwrap();
    assert_eq!(results.len(), 1);
    assert!(results[0].id.contains("crates/auth/src/lib.rs:"));
}
