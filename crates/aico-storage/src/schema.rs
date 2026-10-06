use serde::{Deserialize, Serialize};
use crate::error::StorageError;
use crate::manager::StorageManager;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GraphNodeType {
    Project,
    Epic,
    Spec,
    Requirement,
    Task,
    Symbol,
    File,
    AuditEvent,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum GraphRelationType {
    BelongsTo,
    ContainsSpec,
    HasRequirement,
    Addresses,
    Blocks,
    Calls,
    DefinesSymbol,
}

pub struct SchemaMigrator {
    _current_version: String,
}

impl Default for SchemaMigrator {
    fn default() -> Self {
        Self {
            _current_version: "0.1.0".to_string(),
        }
    }
}

impl SchemaMigrator {
    pub fn new() -> Self {
        Self::default()
    }

    /// Check if target aico_version is compatible with current schema version
    // @implements spec-ft-core-local-storage::REQ-008
    pub fn is_version_compatible(&self, target_version: &str) -> bool {
        let parts: Vec<&str> = target_version.split('.').collect();
        if parts.len() != 3 {
            return false;
        }
        parts[0] == "0" && parts[1] == "1"
    }

    /// List all registered Kùzu node tables
    pub fn registered_node_tables(&self) -> Vec<GraphNodeType> {
        vec![
            GraphNodeType::Project,
            GraphNodeType::Epic,
            GraphNodeType::Spec,
            GraphNodeType::Requirement,
            GraphNodeType::Task,
            GraphNodeType::Symbol,
            GraphNodeType::File,
            GraphNodeType::AuditEvent,
        ]
    }

    /// List all registered Kùzu relationship tables
    pub fn registered_relation_tables(&self) -> Vec<GraphRelationType> {
        vec![
            GraphRelationType::BelongsTo,
            GraphRelationType::ContainsSpec,
            GraphRelationType::HasRequirement,
            GraphRelationType::Addresses,
            GraphRelationType::Blocks,
            GraphRelationType::Calls,
            GraphRelationType::DefinesSymbol,
        ]
    }

    /// Apply schema migrations to Kùzu property graph
    // @implements spec-ft-core-local-storage::REQ-006
    pub async fn apply_migrations(&self, storage: &StorageManager) -> Result<(), StorageError> {
        let mut gstore = storage.graph_store().write().await;

        // Execute DDL for each node table
        for node in self.registered_node_tables() {
            let cypher = format!("CREATE NODE TABLE {:?} (id STRING, PRIMARY KEY (id))", node);
            gstore.execute_query(&cypher)?;
        }

        // Execute DDL for each relationship table
        for rel in self.registered_relation_tables() {
            let cypher = format!("CREATE REL TABLE {:?}", rel);
            gstore.execute_query(&cypher)?;
        }

        Ok(())
    }
}
