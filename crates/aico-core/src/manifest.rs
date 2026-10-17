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
pub struct ProjectRepository {
    pub id: String,
    pub name: String,
    pub path: String,
    #[serde(rename = "type", default = "default_repo_type")]
    pub repo_type: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

fn default_repo_type() -> String {
    "codebase".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectManifest {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub codebase_path: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub created_at: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub repositories: Option<Vec<ProjectRepository>>,
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
    // @implements ft-core-discovery::TASK-CORE-004-1::REQ-002
    // @implements ft-core-discovery::TASK-CORE-004-1::REQ-007
    // @implements ft-git-backend-status::TASK-GIT-001-6::REQ-001
    pub fn from_json_str(json: &str) -> Result<Self, ManifestError> {
        let manifest: ProjectManifest = serde_json::from_str(json)
            .map_err(|e| ManifestError::JsonParseError(e.to_string()))?;

        if !Self::is_valid_identifier(&manifest.name) {
            return Err(ManifestError::InvalidIdentifier(manifest.name));
        }

        Ok(manifest)
    }

    /// Resolve any path relative to specs repository directory
    pub fn resolve_path<P: AsRef<Path>>(raw_path: &str, specs_dir: P) -> PathBuf {
        let p = Path::new(raw_path);
        let resolved = if p.is_absolute() {
            p.to_path_buf()
        } else {
            specs_dir.as_ref().join(p)
        };

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
        normalized
    }

    /// Resolve primary codebase path if declared or from first codebase repository
    // @implements ft-core-discovery::TASK-CORE-004-1::REQ-003
    pub fn resolve_codebase_path<P: AsRef<Path>>(&self, specs_dir: P) -> Option<PathBuf> {
        if let Some(ref cb) = self.codebase_path {
            if !cb.trim().is_empty() {
                return Some(Self::resolve_path(cb, specs_dir));
            }
        }
        if let Some(ref repos) = self.repositories {
            for r in repos {
                if r.repo_type == "codebase" {
                    return Some(Self::resolve_path(&r.path, specs_dir));
                }
            }
        }
        None
    }

    /// Returns declared repositories, or defaults to specs repository (and codebase if declared)
    // @implements ft-git-backend-status::TASK-GIT-001-6::REQ-001
    // @implements ft-git-backend-status::TASK-GIT-001-6::REQ-002
    pub fn get_effective_repositories<P: AsRef<Path>>(&self, specs_dir: P) -> Vec<ProjectRepository> {
        if let Some(ref repos) = self.repositories {
            if !repos.is_empty() {
                return repos.iter().map(|r| {
                    let mut resolved = r.clone();
                    let path_obj = Path::new(&r.path);
                    if !path_obj.is_absolute() {
                        let normalized = Self::resolve_path(&r.path, &specs_dir);
                        resolved.path = normalized.to_string_lossy().replace('\\', "/");
                    }
                    resolved
                }).collect();
            }
        }

        let specs_resolved = specs_dir.as_ref().to_string_lossy().replace('\\', "/");
        let mut result = Vec::new();

        if let Some(codebase_path) = self.resolve_codebase_path(&specs_dir) {
            result.push(ProjectRepository {
                id: self.name.clone(),
                name: self.name.clone(),
                path: codebase_path.to_string_lossy().replace('\\', "/"),
                repo_type: "codebase".to_string(),
                url: None,
            });
        }

        result.push(ProjectRepository {
            id: format!("{}-specs", self.name),
            name: format!("{} Specs", self.name),
            path: specs_resolved,
            repo_type: "specs".to_string(),
            url: None,
        });

        result
    }
}
