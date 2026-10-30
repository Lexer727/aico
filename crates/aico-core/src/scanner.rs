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
    // @implements spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-1::REQ-001
    // @implements spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-1::REQ-002
    pub fn scan<P: AsRef<Path>>(root: P) -> Result<Vec<DiscoveredProject>, ManifestError> {
        let root_path = root.as_ref();
        if !root_path.exists() || !root_path.is_dir() {
            return Err(ManifestError::InvalidPath(format!(
                "Root directory does not exist: {:?}",
                root_path
            )));
        }

        let mut discovered = Vec::new();
        let mut seen_ids = std::collections::HashSet::new();

        // 1. Primary: Scan root_path/specs/ container if it exists
        let specs_container = root_path.join("specs");
        if specs_container.is_dir() {
            if let Ok(entries) = fs::read_dir(&specs_container) {
                for entry in entries.flatten() {
                    let path = entry.path();
                    if path.is_dir() {
                        if let Some(proj) = Self::try_load_project(&path)? {
                            seen_ids.insert(proj.id.clone());
                            discovered.push(proj);
                        }
                    }
                }
            }
        }

        // 2. Fallback: Scan root_path directly for legacy specifications repositories
        let entries = fs::read_dir(root_path)
            .map_err(|e| ManifestError::InvalidPath(e.to_string()))?;

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                // Skip the "specs" and "codebase" containers when scanning root
                if let Some(name) = path.file_name().and_then(|n| n.to_str()) {
                    if name == "specs" || name == "codebase" || name.starts_with('.') {
                        continue;
                    }
                }
                if let Some(proj) = Self::try_load_project(&path)? {
                    if !seen_ids.contains(&proj.id) {
                        seen_ids.insert(proj.id.clone());
                        discovered.push(proj);
                    }
                }
            }
        }

        Ok(discovered)
    }

    fn try_load_project(path: &Path) -> Result<Option<DiscoveredProject>, ManifestError> {
        let manifest_file = path.join(".aico-project.json");
        if manifest_file.exists() && manifest_file.is_file() {
            let content = fs::read_to_string(&manifest_file)
                .map_err(|e| ManifestError::JsonParseError(e.to_string()))?;

            let manifest = ProjectManifest::from_json_str(&content)?;
            let codebase_path = manifest.resolve_codebase_path(path);

            let status = match codebase_path {
                Some(ref cb) if !cb.exists() => ProjectStatus::CodebaseMissing,
                _ => ProjectStatus::Active,
            };

            // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-1::REQ-001
            let project_id = manifest.id.clone().unwrap_or_else(|| {
                path.file_name()
                    .and_then(|n| n.to_str())
                    .map(|s| s.to_string())
                    .unwrap_or_else(|| format!("{}-specs", manifest.name))
            });

            // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-19::REQ-027
            let display_name = manifest.display_name();

            Ok(Some(DiscoveredProject {
                id: project_id,
                name: display_name,
                specs_path: path.to_path_buf(),
                codebase_path,
                manifest,
                status,
            }))
        } else {
            Ok(None)
        }
    }
}
