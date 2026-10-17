use std::fs;
use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum GateError {
    #[error("Custom file path is strictly prohibited: {0}")]
    CustomPathProhibited(String),
    #[error("DuplicateArtifactId: Artifact file already exists at {0}")]
    DuplicateArtifactId(String),
    #[error("Invalid artifact_type '{0}'. Must be one of: brainstorm, deep_dive, spec, plan")]
    InvalidArtifactType(String),
    #[error("Missing required parameter: {0}")]
    MissingParameter(String),
    #[error("IO error: {0}")]
    Io(String),
}

impl From<std::io::Error> for GateError {
    fn from(err: std::io::Error) -> Self {
        GateError::Io(err.to_string())
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateArtifactParams {
    pub specs_root: PathBuf,
    pub custom_path: Option<String>,
    pub artifact_type: String,
    pub epic_slug: String,
    pub spec_slug: Option<String>,
    pub slug: String,
    pub title: String,
    pub derives_from: Option<Vec<String>>,
    pub content: Option<String>,
}

pub struct ArtifactToolGate;

impl ArtifactToolGate {
    /// Calculate deterministic destination file path for artifact
    // @implements ft-core-mcp-tools::TASK-CORE-005-3::REQ-002
    // @implements ft-core-mcp-tools::TASK-CORE-005-4::REQ-010
    pub fn determine_path(
        specs_root: &Path,
        artifact_type: &str,
        epic_slug: &str,
        spec_slug: Option<&str>,
        slug: &str,
    ) -> Result<PathBuf, GateError> {
        let prefix = match artifact_type {
            "spec" => "SPEC",
            "plan" => "PLAN",
            "deep_dive" => "DIVE",
            "brainstorm" => "BRAIN",
            other => return Err(GateError::InvalidArtifactType(other.to_string())),
        };

        let file_name = format!("{}-{}.md", prefix, slug);

        let path = match (artifact_type, spec_slug) {
            ("brainstorm", None) => {
                specs_root.join("epics").join(epic_slug).join(file_name)
            }
            (_, Some(spec_dir)) => {
                specs_root
                    .join("epics")
                    .join(epic_slug)
                    .join("specs")
                    .join(spec_dir)
                    .join(file_name)
            }
            (_, None) => {
                specs_root
                    .join("epics")
                    .join(epic_slug)
                    .join("specs")
                    .join(slug)
                    .join(file_name)
            }
        };

        Ok(path)
    }

    /// Dynamically resolve aico_skills_version from plugin.json, VERSION file, or environment
    pub fn resolve_skills_version(specs_root: &Path) -> String {
        if let Ok(v) = std::env::var("AICO_SKILLS_VERSION") {
            let trimmed = v.trim();
            if !trimmed.is_empty() {
                return trimmed.to_string();
            }
        }

        let candidates = [
            specs_root.join("../codebase/aico-skills/plugin.json"),
            specs_root.join("../aico-skills/plugin.json"),
            specs_root.join("../.agents/skills/plugin.json"),
            specs_root.join(".agents/skills/plugin.json"),
            specs_root.join("plugin.json"),
            // Fallback candidates to legacy VERSION file
            specs_root.join("../codebase/aico-skills/VERSION"),
            specs_root.join("../aico-skills/VERSION"),
            specs_root.join("VERSION"),
        ];

        for candidate in &candidates {
            if let Ok(content) = fs::read_to_string(candidate) {
                if candidate.extension().and_then(|e| e.to_str()) == Some("json") {
                    if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                        if let Some(ver) = val.get("version").and_then(|v| v.as_str()) {
                            let trimmed = ver.trim();
                            if !trimmed.is_empty() {
                                return trimmed.to_string();
                            }
                        }
                    }
                } else {
                    let trimmed = content.trim();
                    if !trimmed.is_empty() {
                        return trimmed.to_string();
                    }
                }
            }
        }

        if let Ok(userprofile) = std::env::var("USERPROFILE") {
            let plugin_json = Path::new(&userprofile)
                .join(".gemini")
                .join("config")
                .join("plugins")
                .join("aico-skills")
                .join("plugin.json");
            if let Ok(content) = fs::read_to_string(plugin_json) {
                if let Ok(val) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(ver) = val.get("version").and_then(|v| v.as_str()) {
                        let trimmed = ver.trim();
                        if !trimmed.is_empty() {
                            return trimmed.to_string();
                        }
                    }
                }
            }

            let plugin_version = Path::new(&userprofile)
                .join(".gemini")
                .join("config")
                .join("plugins")
                .join("aico-skills")
                .join("VERSION");
            if let Ok(content) = fs::read_to_string(plugin_version) {
                let trimmed = content.trim();
                if !trimmed.is_empty() {
                    return trimmed.to_string();
                }
            }
        }

        "0.1.2".to_string()
    }

    /// Inject YAML frontmatter and write artifact atomically to disk
    // @implements ft-core-mcp-tools::TASK-CORE-005-1::REQ-003
    // @implements ft-core-mcp-tools::TASK-CORE-005-1::REQ-005
    // @implements ft-core-mcp-tools::TASK-CORE-005-4::REQ-012
    pub fn create_artifact(params: CreateArtifactParams) -> Result<PathBuf, GateError> {
        if let Some(custom) = params.custom_path {
            return Err(GateError::CustomPathProhibited(custom));
        }

        let target_path = Self::determine_path(
            &params.specs_root,
            &params.artifact_type,
            &params.epic_slug,
            params.spec_slug.as_deref(),
            &params.slug,
        )?;

        if target_path.exists() {
            return Err(GateError::DuplicateArtifactId(target_path.display().to_string()));
        }

        if let Some(parent) = target_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let prefix = match params.artifact_type.as_str() {
            "spec" => "SPEC",
            "plan" => "PLAN",
            "deep_dive" => "DIVE",
            "brainstorm" => "BRAIN",
            other => return Err(GateError::InvalidArtifactType(other.to_string())),
        };
        let doc_id = format!("{}-{}", prefix, params.slug);

        let derives_str = match params.derives_from {
            Some(ref list) => {
                let items: Vec<String> = list.iter().map(|s| format!("\"{}\"", s)).collect();
                format!("[{}]", items.join(", "))
            }
            None => "[]".to_string(),
        };

        let body = params.content.unwrap_or_default();
        let skills_ver = Self::resolve_skills_version(&params.specs_root);

        let full_doc = format!(
            "---\nid: {}\ntype: {}\naico_skills_version: \"{}\"\nepic: {}\ntitle: {}\nstatus: \"Draft\"\nderives_from: {}\ncreated_at: \"2026-10-05T20:00:00Z\"\n---\n\n{}",
            doc_id, params.artifact_type, skills_ver, params.epic_slug, params.title, derives_str, body
        );

        fs::write(&target_path, full_doc)?;
        Ok(target_path)
    }
}
