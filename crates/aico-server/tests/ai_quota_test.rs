use aico_server::{
    quotas::{
        format_reset_countdown, parse_claude_oauth_usage, parse_language_server_quota_summary,
        parse_language_server_user_status, QuotaDiscoveryService, QuotaProviderStatus,
    },
    AppState, HostServer, ServerConfig, ShellType,
};
use std::sync::Arc;
use std::time::Duration;

// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-005::REQ-001
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-002
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-009
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-004::REQ-011
#[tokio::test]
async fn test_ai_quotas_endpoint_filters_connected_providers_and_detects_login() {
    let temp_dir = std::env::temp_dir().join(format!("aico_quota_test_{}", rand::random::<u32>()));
    std::fs::create_dir_all(&temp_dir).expect("create temp dir");

    let agy_cred_path = temp_dir.join("agy_auth.json");
    let claude_cred_path = temp_dir.join("claude_credentials.json");

    // Start with only agy authenticated via credential file
    std::fs::write(
        &agy_cred_path,
        r#"{
            "email": "dev@example.org",
            "tier": "Google AI Pro",
            "weekly_remaining_pct": 42,
            "weekly_reset": "2d 12h",
            "five_hour_remaining_pct": 85,
            "five_hour_reset": "3h 10m"
        }"#,
    )
    .expect("write agy auth");

    let discovery = QuotaDiscoveryService::with_credential_paths(
        agy_cred_path.clone(),
        claude_cred_path.clone(),
    );

    let mut state = AppState::default();
    state.quota_service = Arc::new(discovery);

    let config = ServerConfig {
        base_port: 4920,
        max_port_attempts: 30,
        host: "127.0.0.1".to_string(),
    };

    let mut server = HostServer::with_state(config, state);
    let addr = server.bind().await.expect("Server should bind");
    tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();
    let url = format!("http://{}/api/v1/ai/quotas", addr);

    // 1. Only Gemini should be returned while Claude is not logged in (REQ-002)
    let res = client.get(&url).send().await.expect("GET /api/v1/ai/quotas");
    assert_eq!(res.status(), 200);
    let body: serde_json::Value = res.json().await.expect("parse json");

    assert_eq!(body["ai_state"], "inactive");
    assert_eq!(body["account"]["email"], "dev@example.org");
    let providers = body["providers"].as_array().expect("providers array");
    assert_eq!(providers.len(), 1, "Only connected provider (gemini) should be returned");
    assert_eq!(providers[0]["id"], "gemini");
    assert_eq!(providers[0]["weekly_remaining_pct"], 42);
    assert_eq!(providers[0]["five_hour_remaining_pct"], 85);

    // 2. Simulate completing `claude login` in the terminal by writing Claude credentials (REQ-009)
    std::fs::write(
        &claude_cred_path,
        r#"{
            "claudeAiOauth": {
                "accessToken": "test-token",
                "subscriptionType": "pro"
            },
            "weekly_remaining_pct": 91,
            "weekly_reset": "4d 6h",
            "five_hour_remaining_pct": 76,
            "five_hour_reset": "1h 45m"
        }"#,
    )
    .expect("write claude credentials");

    let res_after = client.get(&url).send().await.expect("GET /api/v1/ai/quotas after login");
    let body_after: serde_json::Value = res_after.json().await.expect("parse json");
    let providers_after = body_after["providers"].as_array().expect("providers array");
    assert_eq!(
        providers_after.len(),
        2,
        "Both Gemini and Claude should appear after Claude credentials are created"
    );
    assert_eq!(providers_after[0]["id"], "gemini");
    assert_eq!(providers_after[1]["id"], "claude");
    assert_eq!(providers_after[1]["weekly_remaining_pct"], 91);
    assert_eq!(providers_after[1]["five_hour_remaining_pct"], 76);

    let _ = std::fs::remove_dir_all(&temp_dir);
}

// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-006
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-002::REQ-007
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-005::REQ-008
#[tokio::test]
async fn test_ai_quotas_tracks_terminal_session_state_transitions() {
    let temp_dir = std::env::temp_dir().join(format!("aico_quota_state_{}", rand::random::<u32>()));
    let discovery = QuotaDiscoveryService::with_credential_paths(
        temp_dir.join("none1.json"),
        temp_dir.join("none2.json"),
    );
    let mut state = AppState::default();
    state.quota_service = Arc::new(discovery);

    let config = ServerConfig {
        base_port: 4960,
        max_port_attempts: 30,
        host: "127.0.0.1".to_string(),
    };

    let mut server = HostServer::with_state(config, state.clone());
    let addr = server.bind().await.expect("Server should bind");
    tokio::spawn(async move {
        let _ = server.serve().await;
    });

    let client = reqwest::Client::new();
    let quotas_url = format!("http://{}/api/v1/ai/quotas", addr);

    // 1. Initially no AI terminal is open -> "inactive" (REQ-006)
    let res1: serde_json::Value = client
        .get(&quotas_url)
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(res1["ai_state"], "inactive");

    // 2. Register an AI session via TerminalSessionRegistry -> "working" then "waiting_for_input"
    let session_id = state.terminal_sessions.register_shell(ShellType::Agy);

    let res2: serde_json::Value = client
        .get(&quotas_url)
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(
        res2["ai_state"], "working",
        "Newly active AI session emitting output should report 'working'"
    );

    // Wait for idle threshold (1.6s) so session transitions to waiting_for_input (REQ-007)
    tokio::time::sleep(Duration::from_millis(1650)).await;

    let res3: serde_json::Value = client
        .get(&quotas_url)
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(
        res3["ai_state"], "waiting_for_input",
        "Idle AI session should report 'waiting_for_input'"
    );

    // 3. Emit output on the AI session -> transitions back to "working" (REQ-008)
    state.terminal_sessions.touch(session_id);
    let res4: serde_json::Value = client
        .get(&quotas_url)
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(res4["ai_state"], "working");

    // 4. Close the AI session -> transitions back to "inactive" (REQ-006)
    state.terminal_sessions.unregister(session_id);
    let res5: serde_json::Value = client
        .get(&quotas_url)
        .send()
        .await
        .unwrap()
        .json()
        .await
        .unwrap();
    assert_eq!(res5["ai_state"], "inactive");
}

// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-006::REQ-004
// @verifies ft-terminal-ai-quota-monitor::TASK-QUOTA-007::REQ-005
#[test]
fn test_parse_language_server_quota_summary_extracts_distinct_gemini_buckets_and_ignores_claude_3p() {
    let summary_json = serde_json::json!({
        "response": {
            "groups": [
                {
                    "displayName": "Gemini Models",
                    "buckets": [
                        {
                            "bucketId": "gemini-weekly",
                            "displayName": "Weekly Limit Remaining",
                            "window": "weekly",
                            "remainingFraction": 0.072,
                            "resetTime": "2099-01-03T12:00:00Z"
                        },
                        {
                            "bucketId": "gemini-5h",
                            "displayName": "Five Hour Limit Remaining",
                            "window": "5h",
                            "remainingFraction": 0.946,
                            "resetTime": "2099-01-01T05:00:00Z"
                        }
                    ]
                },
                {
                    "displayName": "Claude and GPT models",
                    "buckets": [
                        {
                            "bucketId": "3p-weekly",
                            "displayName": "Weekly Limit Remaining",
                            "window": "weekly",
                            "remainingFraction": 0.498,
                            "resetTime": "2099-01-05T12:00:00Z"
                        },
                        {
                            "bucketId": "3p-5h",
                            "displayName": "Five Hour Limit Remaining",
                            "window": "5h",
                            "remainingFraction": 1.0,
                            "resetTime": "2099-01-01T05:00:00Z"
                        }
                    ]
                }
            ]
        }
    });

    let gemini = parse_language_server_quota_summary(&summary_json)
        .expect("Gemini provider should be extracted from RetrieveUserQuotaSummary");
    assert_eq!(gemini.id, "gemini");
    assert_eq!(gemini.cli, "agy");
    assert!(gemini.connected);
    assert_eq!(gemini.weekly_remaining_pct, 7);
    assert_eq!(gemini.five_hour_remaining_pct, 95);
    assert_ne!(
        gemini.weekly_reset, gemini.five_hour_reset,
        "Weekly and 5-hour reset countdowns must be tracked independently"
    );

    // Also verify GetUserStatus only extracts account + Gemini and never emits a Claude provider from agy
    let user_status_json = serde_json::json!({
        "userStatus": {
            "email": "dynamic.user@domain.tld",
            "userTier": {
                "name": "Google AI Pro"
            },
            "cascadeModelConfigData": {
                "clientModelConfigs": [
                    {
                        "modelId": "gemini-3.8-flash-high",
                        "label": "Gemini 3.8 Flash (High)",
                        "quotaInfo": {
                            "remainingFraction": 0.072,
                            "resetTime": "2099-01-03T12:00:00Z"
                        }
                    },
                    {
                        "modelId": "claude-sonnet-5-5-high",
                        "label": "Claude Sonnet 5.5 (High)",
                        "quotaInfo": {
                            "remainingFraction": 0.5,
                            "resetTime": "2099-01-01T05:00:00Z"
                        }
                    }
                ]
            }
        }
    });

    let (account, providers): (Option<aico_server::quotas::QuotaAccountInfo>, Vec<QuotaProviderStatus>) =
        parse_language_server_user_status(&user_status_json);

    let account = account.expect("account should be extracted");
    assert_eq!(account.email, "dynamic.user@domain.tld");
    assert_eq!(account.tier.as_deref(), Some("Google AI Pro"));

    assert_eq!(
        providers.len(),
        1,
        "agy GetUserStatus must only produce Gemini and ignore 3p/Claude models"
    );
    assert_eq!(providers[0].id, "gemini");
    assert!(providers.iter().all(|p| p.id != "claude"));

    assert_eq!(format_reset_countdown(2 * 86400 + 12 * 3600), "2d 12h");
    assert_eq!(format_reset_countdown(360), "6m");

    // Verify Anthropic OAuth usage parser (REQ-005)
    let claude_usage = serde_json::json!({
        "seven_day": {
            "utilization": 18.0,
            "resets_at": "2099-01-05T12:00:00Z"
        },
        "five_hour": {
            "utilization": 35.0,
            "resets_at": "2099-01-01T04:00:00Z"
        }
    });
    let claude_status = parse_claude_oauth_usage(&claude_usage).expect("parse claude oauth usage");
    assert_eq!(claude_status.id, "claude");
    assert_eq!(claude_status.name, "Claude");
    assert!(claude_status.connected);
    assert_eq!(claude_status.weekly_remaining_pct, 82);
    assert_eq!(claude_status.five_hour_remaining_pct, 65);
}

