use crate::manifest::{ManifestError, ProjectManifest};
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProjectStatus {
    Active,
    CodebaseMissing,
    MalformedManifest,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiscoveredProject {
    pub id: String,
    pub name: String,
    pub specs_path: PathBuf,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub codebase_path: Option<PathBuf>,
    pub manifest: ProjectManifest,
    pub status: ProjectStatus,
}

pub struct RootScanner;

impl RootScanner {
    /// Scan root directory for `*-specs` folders containing `.aico-project.json`
    // @implements ft-core-discovery::TASK-CORE-004-2::REQ-001
    // @implements ft-core-discovery::TASK-CORE-004-5::REQ-011
    pub fn scan<P: AsRef<Path>>(root: P) -> Result<Vec<DiscoveredProject>, ManifestError> {
        let root_path = root.as_ref();
        if !root_path.exists() || !root_path.is_dir() {
            return Err(ManifestError::InvalidPath(format!(
                "Root directory does not exist: {:?}",
                root_path
            )));
        }

        let mut discovered = Vec::new();

        let entries = fs::read_dir(root_path)
            .map_err(|e| ManifestError::InvalidPath(e.to_string()))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let manifest_file = path.join(".aico-project.json");
                if manifest_file.exists() && manifest_file.is_file() {
                    let content = fs::read_to_string(&manifest_file)
                        .map_err(|e| ManifestError::JsonParseError(e.to_string()))?;

                    let manifest = ProjectManifest::from_json_str(&content)?;
                    let codebase_path = manifest.resolve_codebase_path(&path);

                    let status = match codebase_path {
                        Some(ref cb) if !cb.exists() => ProjectStatus::CodebaseMissing,
                        _ => ProjectStatus::Active,
                    };

                    discovered.push(DiscoveredProject {
                        id: manifest.name.clone(),
                        name: manifest.name.clone(),
                        specs_path: path,
                        codebase_path,
                        manifest,
                        status,
                    });
                }
            }
        }

        Ok(discovered)
    }
}
