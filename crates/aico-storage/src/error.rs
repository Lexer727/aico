use thiserror::Error;

#[derive(Error, Debug)]
pub enum StorageError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),
    #[error("LanceDB error: {0}")]
    LanceDb(#[from] lancedb::Error),
    #[error("Arrow error: {0}")]
    Arrow(#[from] arrow_schema::ArrowError),
    #[error("Project not found: {0}")]
    ProjectNotFound(String),
    #[error("Query error: {0}")]
    QueryError(String),
}
