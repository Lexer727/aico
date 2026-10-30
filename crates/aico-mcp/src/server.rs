use serde::{Deserialize, Serialize};
use thiserror::Error;

use crate::annotation::{AnnotationExtractor, AnnotationKind};
use crate::ears::EarsValidator;
use crate::graph_tools::{GraphToolHandler, HybridToolHandler};
use crate::traceability::{TraceabilityTracker, VerificationStatus};
use aico_storage::StorageManager;

#[derive(Error, Debug, PartialEq, Eq)]
pub enum ToolError {
    #[error("Unknown tool: '{0}'. Available tools: query_lineage_graph, search_hybrid, find_dangling_requirements, verify_task, extract_annotations, validate_ears")]
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
    #[serde(rename = "inputSchema", alias = "input_schema")]
    pub input_schema: serde_json::Value,
}

pub struct McpServerManager;

impl McpServerManager {
    /// List all registered SDD & Stateful Graph/Vector MCP tools
    // @implements ft-core-mcp-tools::TASK-CORE-005-2::REQ-001
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-1::REQ-001
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-001
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-004
    pub fn list_tools() -> Vec<ToolDefinition> {
        vec![
            ToolDefinition {
                name: "query_lineage_graph".to_string(),
                description: "Execute a 1-to-4 hop AICO property graph lineage and caller query".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "symbol": { "type": "string" },
                        "hops": { "type": "integer", "minimum": 1, "maximum": 4 }
                    },
                    "required": ["symbol"]
                }),
            },
            ToolDefinition {
                name: "search_hybrid".to_string(),
                description: "Execute hybrid semantic vector (LanceDB) and graph (Kùzu) context search".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" },
                        "top_k": { "type": "integer", "minimum": 1 }
                    },
                    "required": ["query"]
                }),
            },
            ToolDefinition {
                name: "find_dangling_requirements".to_string(),
                description: "Identify declared requirements missing @verifies tests or @implements code annotations".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "requirements": { "type": "array", "items": { "type": "string" } },
                        "source": { "type": "string" }
                    },
                    "required": ["requirements"]
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
            // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-5::REQ-010
            ToolDefinition {
                name: "create_project".to_string(),
                description: "Scaffold a new AICO project specifications directory and configure .aico-project.json".to_string(),
                input_schema: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "project_name": { "type": "string", "description": "The kebab-case name of the project" },
                        "display_name": { "type": "string", "description": "Optional human-readable title" },
                        "url": { "type": "string", "description": "Optional remote Git URL" },
                        "local_only": { "type": "boolean", "description": "Whether to skip GitHub remote creation" },
                        "private": { "type": "boolean", "description": "Whether the GitHub repository is private" }
                    },
                    "required": ["project_name"]
                }),
            },
        ]
    }

    /// Dispatch a tool call with input validation and error guidance
    // @implements ft-core-mcp-tools::TASK-CORE-005-2::REQ-008
    // @implements ft-core-mcp-tools::TASK-CORE-005-2::REQ-009
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-1::REQ-006
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-004
    // @implements spec-ft-tooling-mcp-repurpose::TASK-TOOL-002-2::REQ-005
    pub fn call_tool(name: &str, params: serde_json::Value) -> Result<serde_json::Value, ToolError> {
        Self::call_tool_with_storage(name, params, None)
    }

    /// Dispatch a tool call with optional StorageManager context
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-005
    // @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-2::REQ-006
    pub fn call_tool_with_storage(
        name: &str,
        params: serde_json::Value,
        storage: Option<&StorageManager>,
    ) -> Result<serde_json::Value, ToolError> {
        match name {
            "query_lineage_graph" => {
                let symbol = params
                    .get("symbol")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::InvalidParameters(name.to_string(), "Missing 'symbol' string".to_string()))?;
                let hops = params
                    .get("hops")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(2) as usize;
                let payload = GraphToolHandler::query_lineage_graph_with_storage(symbol, hops, storage)?;
                Ok(serde_json::to_value(payload).unwrap())
            }
            "search_hybrid" => {
                let query = params
                    .get("query")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::InvalidParameters(name.to_string(), "Missing 'query' string".to_string()))?;
                let top_k = params
                    .get("top_k")
                    .and_then(|v| v.as_u64())
                    .unwrap_or(5) as usize;
                let res = HybridToolHandler::search_hybrid_with_storage(query, top_k, storage)?;
                Ok(serde_json::to_value(res).unwrap())
            }
            "find_dangling_requirements" => {
                let req_arr = params
                    .get("requirements")
                    .and_then(|v| v.as_array())
                    .ok_or_else(|| ToolError::InvalidParameters(name.to_string(), "Missing 'requirements' array".to_string()))?;
                let source = params
                    .get("source")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                let mut tracker = TraceabilityTracker::new();
                for req_val in req_arr {
                    if let Some(req_str) = req_val.as_str() {
                        tracker.register_requirement(req_str);
                    }
                }
                for ann in AnnotationExtractor::extract(source) {
                    let key = format!("{}::{}", ann.spec_id, ann.req_id);
                    match ann.kind {
                        AnnotationKind::Verifies => {
                            tracker.record_verifies_edge("test_seam", &key, VerificationStatus::Passed);
                        }
                        AnnotationKind::Implements => {
                            tracker.record_implements_edge("impl_symbol", &key);
                        }
                    }
                }
                let dangling = tracker.find_dangling_requirements();
                Ok(serde_json::to_value(dangling).unwrap())
            }
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
            "verify_task" => {
                let task_id = params
                    .get("task_id")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::InvalidParameters(name.to_string(), "Missing 'task_id'".to_string()))?;
                let req_id = params
                    .get("requirement_id")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");
                let test_name = params
                    .get("test_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("test_seam");
                let symbol_name = params
                    .get("symbol_name")
                    .and_then(|v| v.as_str())
                    .unwrap_or("symbol");
                let test_status_str = params
                    .get("test_status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("passed");

                let status = match test_status_str {
                    "passed" => VerificationStatus::Passed,
                    _ => VerificationStatus::Failed,
                };

                let mut tracker = TraceabilityTracker::new();
                tracker.record_verifies_edge(test_name, req_id, status);
                tracker.record_implements_edge(symbol_name, req_id);

                match tracker.verify_task(task_id, req_id) {
                    Ok(report) => Ok(serde_json::to_value(report).unwrap()),
                    Err(e) => Err(ToolError::ExecutionFailed(e.to_string())),
                }
            }
            // @implements spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-5::REQ-010
            "create_project" => {
                let project_name = params
                    .get("project_name")
                    .and_then(|v| v.as_str())
                    .ok_or_else(|| ToolError::InvalidParameters(name.to_string(), "Missing 'project_name'".to_string()))?;
                let ws_root = std::env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from("."));
                match aico_core::wizard::CodebaseWizard::scaffold_project_specs(&ws_root, project_name) {
                    Ok(path) => Ok(serde_json::json!({
                        "status": "created",
                        "project_name": project_name,
                        "specs_path": path.to_string_lossy().to_string(),
                    })),
                    Err(e) => Err(ToolError::ExecutionFailed(e.to_string())),
                }
            }
            _ => Err(ToolError::UnknownTool(name.to_string())),
        }
    }
}
