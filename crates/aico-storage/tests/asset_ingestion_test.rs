use std::fs;
use aico_storage::{StorageManager, AssetIngestionService};

// @verifies ft-core-epic-hub::TASK-CORE-007-1::REQ-006
// @verifies ft-core-epic-hub::TASK-CORE-007-1::REQ-007
#[tokio::test]
async fn test_asset_storage_deduplication_and_indexing() {
    let temp_dir = std::env::temp_dir().join("aico_asset_test_1");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).expect("Failed to initialize StorageManager");
    let asset_service = AssetIngestionService::new();

    let test_bytes = b"Hello, this is a mock image or design mock asset byte stream.";
    let filename = "mockup.png";
    let mime_type = "image/png";

    // 1. Ingest asset first time
    let asset1 = asset_service
        .store_asset(&storage_mgr, test_bytes, filename, mime_type)
        .await
        .expect("Failed to store asset");

    assert_eq!(asset1.filename, filename);
    assert_eq!(asset1.mime_type, mime_type);
    assert_eq!(asset1.size_bytes, test_bytes.len());
    assert!(asset1.storage_path.exists(), "Stored file must exist on disk");

    // 2. Ingest duplicate asset (same bytes, different filename)
    let asset2 = asset_service
        .store_asset(&storage_mgr, test_bytes, "another_copy.png", mime_type)
        .await
        .expect("Failed to store duplicate asset");

    // Must deduplicate by SHA-256 to the exact same storage path
    assert_eq!(asset1.sha256, asset2.sha256);
    assert_eq!(asset1.storage_path, asset2.storage_path);

    // Verify only one physical file was created under .aico/assets/
    let assets_dir = temp_dir.join(".aico").join("assets");
    let file_count = fs::read_dir(&assets_dir).unwrap().count();
    assert_eq!(file_count, 1, "Expected exactly 1 deduplicated asset file");

    // 3. Verify vector search and graph records exist
    let vstore = storage_mgr.vector_store().read().await;
    assert!(vstore.record_count() >= 1, "Asset should be indexed into vector store");
}
