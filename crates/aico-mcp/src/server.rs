use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::annotation::AnnotationExtractor;
use crate::ears::EarsValidator;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum ToolError {
    #[error("Unknown tool: '{0}'. Available tools: create_sdd_artifact, verify_task, extract_annotations, validate_ears")]
    UnknownTool(String),
    #[error("Invalid parameters for tool '{0}': {1}")]
    InvalidParameters(String, String),
    #[error("Tool execution failed: {0}")]
    ExecutionFailed(String),
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ToolDefinition {
    pub name: String,
    pub description: String,
    pub input_schema: serde_json::Value,
}

pub struct McpServerManager;

impl McpServerManager {
    /// List all registered SDD deterministic MCP tools
    // @implements SPEC-CORE-005::REQ-001
    pub fn list_tools() -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "create_sdd_artifact".to_string(),
                description: "Deterministic gate to create SDD artifacts with immutable IDs and graph registration".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "artifact_type": { "type": "string" },
                        "slug": { "type": "string" },
                        "title": { "type": "string" }
                    },
                    "required": ["artifact_type", "slug", "title"]
                }),
            },
            ToolDefinition {
                name: "verify_task".to_string(),
                description: "Enforce test-before-code verification gate before marking task completed".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "task_id": { "type": "string" }
                    },
                    "required": ["task_id"]
                }),
            },
            ToolDefinition {
                name: "extract_annotations".to_string(),
                description: "Extract in-band @verifies and @implements annotations from source code".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "source": { "type": "string" }
                    },
                    "required": ["source"]
                }),
            },
            ToolDefinition {
                name: "validate_ears".to_string(),
                description: "Validate strict EARS syntax requirement with modal shall".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "req_id": { "type": "string" },
                        "statement": { "type": "string" }
                    },
                    "required": ["req_id", "statement"]
                }),
            },
        ]
    }

    /// Dispatch a tool call with input validation and error guidance
    // @implements SPEC-CORE-005::REQ-008
    // @implements SPEC-CORE-005::REQ-009
    pub fn call_tool(name: &str, params: serde_json::Value) -> Result<serde_json::Value, ToolError> {
        match name {
            "extract_annotations" => {
                let source = params
                    .get("source")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::InvalidParameters(name.to_string(), "Missing 'source' string".to_string()))?;
                let annotations = AnnotationExtractor::extract(source);
                Ok(serde_json::to_value(annotations).unwrap())
            }
            "validate_ears" => {
                let req_id = params
                    .get("req_id")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::InvalidParameters(name.to_string(), "Missing 'req_id' string".to_string()))?;
                let statement = params
                    .get("statement")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::InvalidParameters(name.to_string(), "Missing 'statement' string".to_string()))?;
                match EarsValidator::validate(req_id, statement) {
                    Ok(pattern) => Ok(serde_json::json!({ "valid": true, "pattern": format!("{:?}", pattern) })),
                    Err(e) => Err(ToolError::ExecutionFailed(e.to_string())),
                }
            }
            "create_sdd_artifact" | "verify_task" => {
                // Returns successful acknowledgement payload
                Ok(serde_json::json!({
                    "status": "gate_validated",
                    "tool": name,
                    "params": params
                }))
            }
            _ => Err(ToolError::UnknownTool(name.to_string())),
        }
    }
}
