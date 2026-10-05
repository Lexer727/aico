use crate::manifest::{ManifestError, ProjectManifest};
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct DiscoveredProject {
    pub id: String,
    pub name: String,
    pub specs_path: PathBuf,
    pub codebase_path: PathBuf,
    pub manifest: ProjectManifest,
}

pub struct RootScanner;

impl RootScanner {
    /// Scan root directory for `*-specs` folders containing `.aico-project.json`
    // @implements SPEC-CORE-004::REQ-001
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
                    let codebase_path = manifest.resolve_codebase_path(&path)?;

                    discovered.push(DiscoveredProject {
                        id: manifest.name.clone(),
                        name: manifest.name.clone(),
                        specs_path: path,
                        codebase_path,
                        manifest,
                    });
                }
            }
        }

        Ok(discovered)
    }
}
