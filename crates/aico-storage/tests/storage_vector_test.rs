use aico_storage::{CodeChunker, EmbeddingPipeline, StorageManager};

// @verifies ft-core-local-storage::TASK-CORE-003-4::REQ-004
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

// @verifies ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-001
// @verifies ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-002
// @verifies ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-010
#[tokio::test]
async fn test_lancedb_disk_table_creation_and_upsert() {
    let temp_dir = std::env::temp_dir().join("aico_lance_vector_test_disk");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let vector_dir = temp_dir.join("vector_db");

    // 1. Open store & verify schema
    let store = aico_storage::LanceVectorStore::open_async(&vector_dir)
        .await
        .expect("open_async LanceVectorStore");
    let schema = aico_storage::LanceVectorStore::table_schema();
    assert_eq!(schema.fields().len(), 9);
    assert_eq!(schema.field(0).name(), "id");
    assert_eq!(schema.field(1).name(), "content");
    assert_eq!(schema.field(2).name(), "file_path");
    assert_eq!(schema.field(6).name(), "vector");

    // 2. Insert records
    let mut vec1 = vec![0.0f32; 384];
    vec1[0] = 1.0;
    let mut vec2 = vec![0.0f32; 384];
    vec2[1] = 1.0;
    let mut vec3 = vec![0.0f32; 384];
    vec3[2] = 1.0;

    let records = vec![
        aico_storage::VectorRecordInput {
            id: "chunk-01".to_string(),
            content: "pub fn login() {}".to_string(),
            file_path: "src/auth.rs".to_string(),
            start_line: 1,
            end_line: 10,
            language: "rust".to_string(),
            vector: vec1.clone(),
            doc_type: "code".to_string(),
            project_id: "proj1".to_string(),
        },
        aico_storage::VectorRecordInput {
            id: "chunk-02".to_string(),
            content: "pub fn logout() {}".to_string(),
            file_path: "src/auth.rs".to_string(),
            start_line: 12,
            end_line: 20,
            language: "rust".to_string(),
            vector: vec2,
            doc_type: "code".to_string(),
            project_id: "proj1".to_string(),
        },
        aico_storage::VectorRecordInput {
            id: "chunk-03".to_string(),
            content: "pub struct UserSession {}".to_string(),
            file_path: "src/session.rs".to_string(),
            start_line: 1,
            end_line: 15,
            language: "rust".to_string(),
            vector: vec3,
            doc_type: "code".to_string(),
            project_id: "proj1".to_string(),
        },
    ];

    let count = store.upsert_records(&records).await.expect("upsert_records");
    assert_eq!(count, 3);
    assert_eq!(store.count_rows().await.unwrap(), 3);

    // 3. Search nearest
    let query_res = store.query_nearest_lance(&vec1, 1).await.expect("query_nearest_lance");
    assert_eq!(query_res.len(), 1);
    assert_eq!(query_res[0].id, "chunk-01");
    assert!(query_res[0].score > 0.9);

    // 4. Persistence verification: drop store and re-open from same directory
    drop(store);
    let reloaded_store = aico_storage::LanceVectorStore::open_async(&vector_dir)
        .await
        .expect("re-open LanceVectorStore");
    assert_eq!(reloaded_store.count_rows().await.unwrap(), 3);

    // 5. Delete by path
    let _ = reloaded_store.delete_by_path("src/session.rs").await.expect("delete_by_path");
    assert_eq!(reloaded_store.count_rows().await.unwrap(), 2);
}

// @verifies ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-2::REQ-003
// @verifies ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-2::REQ-011
#[test]
fn test_embedding_pipeline_and_fallback() {
    let pipeline = aico_storage::EmbeddingPipeline::new();

    // 1. 384-dimensional dense vectors
    let vec1 = pipeline.embed_text("authenticate user credentials");
    assert_eq!(vec1.len(), 384);
    let mag: f32 = vec1.iter().map(|x| x * x).sum::<f32>().sqrt();
    assert!((mag - 1.0).abs() < 1e-4);

    // 2. Fallback on empty / whitespace input (REQ-011)
    let fallback = pipeline.embed_text("   \n\t  ");
    assert_eq!(fallback.len(), 384);
    assert!(!fallback.iter().all(|&x| x == 0.0));

    // 3. Tokenizer extracts camelCase and requirement tokens
    let tokens = aico_storage::EmbeddingPipeline::tokenize_lexical(
        "pub fn authenticateUser(session: &UserSession) -> Result<REQ-001>",
    );
    assert!(tokens.contains(&"authenticate".to_string()));
    assert!(tokens.contains(&"user".to_string()));
    assert!(tokens.contains(&"session".to_string()));
    assert!(tokens.contains(&"req-001".to_string()));

    // 4. BM25 scoring
    let doc_tokens = aico_storage::EmbeddingPipeline::tokenize_lexical("authenticate user login session");
    let query_match = vec!["authenticate".to_string(), "user".to_string()];
    let score_match = aico_storage::EmbeddingPipeline::calculate_bm25(&query_match, &doc_tokens, 10.0, 100, 5);
    assert!(score_match > 0.0);

    let query_nomatch = vec!["unrelated".to_string(), "geometry".to_string()];
    let score_nomatch = aico_storage::EmbeddingPipeline::calculate_bm25(&query_nomatch, &doc_tokens, 10.0, 100, 5);
    assert_eq!(score_nomatch, 0.0);

    // 5. Semantic subword / token similarity
    let auth_code = pipeline.embed_text("pub fn authenticate(user: &str)");
    let geom_code = pipeline.embed_text("pub fn calculate_matrix_geometry()");
    let query_vec = pipeline.embed_text("authenticate user");

    let sim_auth: f32 = auth_code.iter().zip(query_vec.iter()).map(|(a, b)| a * b).sum();
    let sim_geom: f32 = geom_code.iter().zip(query_vec.iter()).map(|(a, b)| a * b).sum();
    assert!(sim_auth > sim_geom, "auth sim ({sim_auth}) should exceed geom sim ({sim_geom})");
}

// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-6::REQ-012
// @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-6::REQ-014
#[tokio::test]
async fn test_lancedb_hydration_and_compaction_pruning() {
    let temp_dir = std::env::temp_dir().join(format!(
        "aico_lance_compact_test_{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_nanos()
    ));
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let vector_dir = temp_dir.join("vector_db");
    let store = aico_storage::LanceVectorStore::open_async(&vector_dir)
        .await
        .expect("open_async LanceVectorStore");

    let mut vec1 = vec![0.0f32; 384];
    vec1[0] = 1.0;

    // Perform 4 separate batch appends to create multiple LanceDB versions & fragments
    for batch_idx in 0..4 {
        let rec = aico_storage::VectorRecordInput {
            id: format!("proj1::src/file_{batch_idx}.rs:1"),
            content: format!("pub fn func_{batch_idx}() {{}}"),
            file_path: format!("src/file_{batch_idx}.rs"),
            start_line: 1,
            end_line: 5,
            language: "rust".to_string(),
            vector: vec1.clone(),
            doc_type: "code".to_string(),
            project_id: "proj1".to_string(),
        };
        store.upsert_records(&[rec]).await.expect("upsert batch");
    }

    // Delete one specific file in proj1 to create a deletion version
    store
        .delete_by_project_and_path("proj1", "src/file_3.rs")
        .await
        .expect("delete_by_project_and_path");

    let versions_before = store.version_count().await.expect("version_count before");
    assert!(
        versions_before > 1,
        "Multiple appends and delete should create > 1 LanceDB versions (got {versions_before})"
    );

    // Compact fragments and prune old versions (REQ-014)
    store.compact_and_prune().await.expect("compact_and_prune");

    let versions_after = store.version_count().await.expect("version_count after");
    assert_eq!(
        versions_after, 1,
        "compact_and_prune should prune old versions leaving 1 active version"
    );
    assert_eq!(store.count_rows().await.unwrap(), 3);

    // Drop and reopen store: verify in-memory cache is hydrated from disk (REQ-012)
    drop(store);
    let reopened = aico_storage::LanceVectorStore::open_async(&vector_dir)
        .await
        .expect("reopen LanceVectorStore");
    assert_eq!(
        reopened.record_count_for_project("proj1"),
        3,
        "In-memory cache should hydrate 3 records from disk on open_async"
    );

    let _ = std::fs::remove_dir_all(&temp_dir);
}



