use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum ManifestError {
    #[error("Failed to parse manifest JSON: {0}")]
    JsonParseError(String),
    #[error("Manifest missing required field: {0}")]
    MissingField(String),
    #[error("Invalid project identifier '{0}': must be lowercase alphanumeric with hyphens or underscores")]
    InvalidIdentifier(String),
    #[error("Invalid codebase path: {0}")]
    InvalidPath(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectManifest {
    pub name: String,
    pub version: String,
    pub codebase_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
}

impl ProjectManifest {
    /// Validates whether a project name meets identifier requirements
    fn is_valid_identifier(name: &str) -> bool {
        if name.is_empty() {
            return false;
        }
        name.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '-' || c == '_')
    }

    /// Parse from a JSON string and validate required invariants
    // @implements spec-ft-core-discovery::REQ-002
    // @implements spec-ft-core-discovery::REQ-007
    pub fn from_json_str(json: &str) -> Result<Self, ManifestError> {
        let manifest: ProjectManifest = serde_json::from_str(json)
            .map_err(|e| ManifestError::JsonParseError(e.to_string()))?;

        if !Self::is_valid_identifier(&manifest.name) {
            return Err(ManifestError::InvalidIdentifier(manifest.name));
        }

        if manifest.version.trim().is_empty() {
            return Err(ManifestError::MissingField("version".to_string()));
        }

        if manifest.codebase_path.trim().is_empty() {
            return Err(ManifestError::MissingField("codebase_path".to_string()));
        }

        Ok(manifest)
    }

    /// Resolve codebase path relative to specs repository directory
    // @implements spec-ft-core-discovery::REQ-003
    pub fn resolve_codebase_path<P: AsRef<Path>>(&self, specs_dir: P) -> Result<PathBuf, ManifestError> {
        let raw_path = Path::new(&self.codebase_path);
        let resolved = if raw_path.is_absolute() {
            raw_path.to_path_buf()
        } else {
            specs_dir.as_ref().join(raw_path)
        };

        // Normalize path components (resolve .. and .)
        let mut normalized = PathBuf::new();
        for component in resolved.components() {
            match component {
                std::path::Component::ParentDir => {
                    normalized.pop();
                }
                std::path::Component::CurDir => {}
                _ => {
                    normalized.push(component.as_os_str());
                }
            }
        }

        Ok(normalized)
    }
}
