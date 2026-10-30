use aico_server::{HostServer, ServerConfig};
use serde_json::json;

// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-002
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-006
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-007
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-3::REQ-008
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-002
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-012
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-5::REQ-013
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-7::REQ-002
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-7::REQ-012
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-7::REQ-014
#[tokio::test]
async fn test_mcp_options_cors() {
    let mut config = ServerConfig::default();
    config.base_port = 4320;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("bind");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();
    let res = client
        .request(reqwest::Method::OPTIONS, format!("http://{}/mcp", addr))
        .send()
        .await
        .expect("send options /mcp");

    assert_eq!(res.status(), 200);
    assert_eq!(
        res.headers().get("access-control-allow-origin").unwrap().to_str().unwrap(),
        "*"
    );
    assert!(res
        .headers()
        .get("access-control-allow-methods")
        .unwrap()
        .to_str()
        .unwrap()
        .contains("POST"));

    server_task.abort();
}

#[tokio::test]
async fn test_mcp_get_discovery() {
    let mut config = ServerConfig::default();
    config.base_port = 4310;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("bind");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();
    let res = client
        .get(format!("http://{}/mcp", addr))
        .send()
        .await
        .expect("send get /mcp");

    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.expect("parse json");
    assert_eq!(body["status"], "ok");
    assert_eq!(body["transport"], "streamable-http");
    assert_eq!(body["server"]["name"], "aico");
    assert_eq!(body["tools_count"], 7);

    server_task.abort();
}

#[tokio::test]
async fn test_mcp_post_json_rpc_flow() {
    let mut config = ServerConfig::default();
    config.base_port = 4312;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("bind");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();
    let mcp_url = format!("http://{}/mcp", addr);

    // 1. initialize
    let init_req = json!({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "initialize",
        "params": { "protocolVersion": "2024-11-05" }
    });
    let res = client.post(&mcp_url).json(&init_req).send().await.expect("post init");
    assert_eq!(res.status(), 200);
    let init_res: serde_json::Value = res.json().await.expect("init json");
    assert_eq!(init_res["id"], 1);
    assert_eq!(init_res["result"]["serverInfo"]["name"], "aico");

    // 2. tools/list
    let list_req = json!({
        "jsonrpc": "2.0",
        "id": 2,
        "method": "tools/list"
    });
    let res = client.post(&mcp_url).json(&list_req).send().await.expect("post tools/list");
    assert_eq!(res.status(), 200);
    let list_res: serde_json::Value = res.json().await.expect("list json");
    let tools = list_res["result"]["tools"].as_array().expect("tools array");
    assert_eq!(tools.len(), 7);

    // 3. tools/call
    let call_req = json!({
        "jsonrpc": "2.0",
        "id": 3,
        "method": "tools/call",
        "params": {
            "name": "validate_ears",
            "arguments": {
                "req_id": "REQ-001",
                "statement": "The system shall respond over Streamable HTTP."
            }
        }
    });
    let res = client.post(&mcp_url).json(&call_req).send().await.expect("post call");
    assert_eq!(res.status(), 200);
    let call_res: serde_json::Value = res.json().await.expect("call json");
    assert_eq!(call_res["result"]["isError"], false);
    assert_eq!(call_res["result"]["content"][0]["type"], "text");

    // 4. unknown method
    let unknown_req = json!({
        "jsonrpc": "2.0",
        "id": 4,
        "method": "custom/not_found"
    });
    let res = client.post(&mcp_url).json(&unknown_req).send().await.expect("post unknown");
    assert_eq!(res.status(), 200);
    let unknown_res: serde_json::Value = res.json().await.expect("unknown json");
    assert_eq!(unknown_res["error"]["code"], -32601);

    server_task.abort();
}

// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-4::REQ-002
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-4::REQ-003
// @verifies spec-ft-tooling-mcp-streamable-http::TASK-TOOL-004-4::REQ-004
#[tokio::test]
async fn test_mcp_discovery_roundtrip() {
    let mut config = ServerConfig::default();
    config.base_port = 4316;

    let mut server = HostServer::new(config);
    let addr = server.bind().await.expect("bind");

    let server_task = tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();
    let res = client.get(format!("http://{}/mcp", addr)).send().await.expect("get /mcp");
    assert_eq!(res.status(), 200);

    let init_req = json!({
        "jsonrpc": "2.0",
        "id": "init-1",
        "method": "initialize",
        "params": { "protocolVersion": "2024-11-05" }
    });
    let res = client.post(format!("http://{}/mcp", addr)).json(&init_req).send().await.expect("post init");
    assert_eq!(res.status(), 200);

    let tools_req = json!({
        "jsonrpc": "2.0",
        "id": "tools-1",
        "method": "tools/list"
    });
    let res = client.post(format!("http://{}/mcp", addr)).json(&tools_req).send().await.expect("post tools");
    assert_eq!(res.status(), 200);
    let list_res: serde_json::Value = res.json().await.expect("json");
    assert_eq!(list_res["result"]["tools"].as_array().unwrap().len(), 7);

    server_task.abort();
}
