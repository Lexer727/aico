use aico_storage::{StorageManager, DifferentialIndexer, LanguageKind};

// @verifies ft-core-local-storage::TASK-CORE-003-5::REQ-010
#[tokio::test]
async fn test_incremental_file_reindexing() {
    let temp_dir = std::env::temp_dir().join("aico_diff_indexer_test_1");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).unwrap();
    let mut indexer = DifferentialIndexer::new();

    let file_path = std::path::Path::new("crates/core/src/lib.rs");
    let code_v1 = "pub fn execute() { println!(\"v1\"); }";

    // First indexing pass: file is new, should index
    let indexed_first = indexer.index_file(&storage_mgr, file_path, code_v1, LanguageKind::Rust).await.unwrap();
    assert!(indexed_first, "First pass must index new file");

    // Second indexing pass with exact same content: should skip
    let indexed_second = indexer.index_file(&storage_mgr, file_path, code_v1, LanguageKind::Rust).await.unwrap();
    assert!(!indexed_second, "Unchanged file must be skipped");

    // Third indexing pass with modified content: should re-index
    let code_v2 = "pub fn execute() { println!(\"v2 modified\"); }";
    let indexed_third = indexer.index_file(&storage_mgr, file_path, code_v2, LanguageKind::Rust).await.unwrap();
    assert!(indexed_third, "Modified file must be re-indexed");
}

// @verifies ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-4::REQ-005
// @verifies ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-4::REQ-006
#[tokio::test]
async fn test_differential_chunk_indexing() {
    let temp_dir = std::env::temp_dir().join("aico_diff_chunk_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).unwrap();
    let mut indexer = DifferentialIndexer::new();

    let file_path = std::path::Path::new("crates/auth/src/lib.rs");
    let code_v1 = r#"
pub fn fn_alpha() -> i32 {
    42
}

pub fn fn_beta() -> i32 {
    100
}
"#;

    // 1. Initial indexing: 2 chunks upserted
    let report1 = indexer
        .index_file_detailed(&storage_mgr, file_path, code_v1, LanguageKind::Rust)
        .await
        .unwrap();
    assert!(report1.file_indexed);
    assert_eq!(report1.chunks_total, 2);
    assert_eq!(report1.chunks_upserted, 2);
    assert_eq!(report1.chunks_unchanged, 0);

    // 2. Modify only fn_beta (fn_alpha content is untouched)
    let code_v2 = r#"
pub fn fn_alpha() -> i32 {
    42
}

pub fn fn_beta() -> i32 {
    999 // modified
}
"#;
    let report2 = indexer
        .index_file_detailed(&storage_mgr, file_path, code_v2, LanguageKind::Rust)
        .await
        .unwrap();
    assert!(report2.file_indexed);
    assert_eq!(report2.chunks_total, 2);
    assert_eq!(report2.chunks_upserted, 1, "Only fn_beta should be re-upserted");
    assert_eq!(report2.chunks_unchanged, 1, "fn_alpha should be skipped as unchanged");

    // 3. Delete file
    let deleted = indexer.remove_file(&storage_mgr, file_path).await.unwrap();
    assert!(deleted > 0, "Chunks must be deleted from vector store");
}

