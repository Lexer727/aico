use aico_storage::{StorageManager, DifferentialIndexer, LanguageKind};

// @verifies spec-ft-core-local-storage::REQ-010
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
