use aico_storage::StorageManager;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

use crate::server::McpServerManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    pub jsonrpc: String,
    #[serde(default)]
    pub id: Option<Value>,
    pub method: String,
    #[serde(default)]
    pub params: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcError {
    pub code: i64,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    pub jsonrpc: String,
    pub id: Value,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

/// Dispatch incoming JSON-RPC 2.0 MCP requests to handlers
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-001
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-003
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-004
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-005
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-009
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-010
// @implements spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-1::REQ-011
pub fn handle_json_rpc(request: &Value, storage: Option<&StorageManager>) -> Value {
    let req: JsonRpcRequest = match serde_json::from_value(request.clone()) {
        Ok(r) => r,
        Err(_) => {
            return json!({
                "jsonrpc": "2.0",
                "id": Value::Null,
                "error": {
                    "code": -32700,
                    "message": "Parse error: invalid JSON-RPC 2.0 request"
                }
            });
        }
    };

    let id = req.id.unwrap_or(Value::Null);

    match req.method.as_str() {
        "initialize" => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {
                        "tools": {}
                    },
                    "serverInfo": {
                        "name": "aico",
                        "version": env!("CARGO_PKG_VERSION")
                    }
                }
            })
        }
        "notifications/initialized" | "initialized" => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {}
            })
        }
        "ping" => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {}
            })
        }
        "tools/list" => {
            let tools = McpServerManager::list_tools();
            let tools_val: Vec<Value> = tools
                .into_iter()
                .map(|t| {
                    json!({
                        "name": t.name,
                        "description": t.description,
                        "inputSchema": t.input_schema
                    })
                })
                .collect();

            json!({
                "jsonrpc": "2.0",
                "id": id,
                "result": {
                    "tools": tools_val
                }
            })
        }
        "tools/call" => {
            let params = match req.params {
                Some(Value::Object(map)) => map,
                _ => {
                    return json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": {
                            "code": -32602,
                            "message": "Invalid params: expected object with 'name' and optional 'arguments'"
                        }
                    });
                }
            };

            let tool_name = match params.get("name").and_then(|v| v.as_str()) {
                Some(name) => name,
                None => {
                    return json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "error": {
                            "code": -32602,
                            "message": "Invalid params: missing tool 'name'"
                        }
                    });
                }
            };

            let arguments = params.get("arguments").cloned().unwrap_or(Value::Object(serde_json::Map::new()));

            let call_res = McpServerManager::call_tool_with_storage(tool_name, arguments, storage);

            match call_res {
                Ok(result_value) => {
                    let text = if let Some(s) = result_value.as_str() {
                        s.to_string()
                    } else {
                        serde_json::to_string_pretty(&result_value).unwrap_or_default()
                    };

                    json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "content": [
                                {
                                    "type": "text",
                                    "text": text
                                }
                            ],
                            "isError": false
                        }
                    })
                }
                Err(err) => {
                    json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "content": [
                                {
                                    "type": "text",
                                    "text": err.to_string()
                                }
                            ],
                            "isError": true
                        }
                    })
                }
            }
        }
        unknown => {
            json!({
                "jsonrpc": "2.0",
                "id": id,
                "error": {
                    "code": -32601,
                    "message": format!("Method not found: {}", unknown)
                }
            })
        }
    }
}
