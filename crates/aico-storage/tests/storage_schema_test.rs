use std::fs;
use aico_storage::{StorageManager, SchemaMigrator, GraphNodeType, GraphRelationType};

// @verifies ft-core-local-storage::TASK-CORE-003-2::REQ-006
// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-1::REQ-001
#[tokio::test]
async fn test_graph_schema_migration_and_traceability() {
    let temp_dir = std::env::temp_dir().join("aico_schema_test_1");
    let _ = fs::remove_dir_all(&temp_dir);
    fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).expect("Failed to open StorageManager");
    let migrator = SchemaMigrator::new();

    // Run migration
    let migration_result = migrator.apply_migrations(&storage_mgr).await;
    assert!(migration_result.is_ok(), "Migration must succeed");

    // Verify all 8 core node tables are registered
    let node_tables = migrator.registered_node_tables();
    assert!(node_tables.contains(&GraphNodeType::Project));
    assert!(node_tables.contains(&GraphNodeType::Epic));
    assert!(node_tables.contains(&GraphNodeType::Spec));
    assert!(node_tables.contains(&GraphNodeType::Requirement));
    assert!(node_tables.contains(&GraphNodeType::Task));
    assert!(node_tables.contains(&GraphNodeType::Symbol));
    assert!(node_tables.contains(&GraphNodeType::File));
    assert!(node_tables.contains(&GraphNodeType::AuditEvent));

    // Verify all 7 core relationship tables are registered
    let rel_tables = migrator.registered_relation_tables();
    assert!(rel_tables.contains(&GraphRelationType::BelongsTo));
    assert!(rel_tables.contains(&GraphRelationType::ContainsSpec));
    assert!(rel_tables.contains(&GraphRelationType::HasRequirement));
    assert!(rel_tables.contains(&GraphRelationType::Addresses));
    assert!(rel_tables.contains(&GraphRelationType::Blocks));
    assert!(rel_tables.contains(&GraphRelationType::Calls));
    assert!(rel_tables.contains(&GraphRelationType::DefinesSymbol));
}

// @verifies ft-core-local-storage::TASK-CORE-003-2::REQ-008
#[tokio::test]
async fn test_schema_version_compatibility_verification() {
    let migrator = SchemaMigrator::new();

    // Compatible version
    assert!(migrator.is_version_compatible("0.1.0"));

    // Incompatible major versions
    assert!(!migrator.is_version_compatible("1.0.0"));
    assert!(!migrator.is_version_compatible("invalid_version"));
}
