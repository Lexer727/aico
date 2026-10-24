use aico_storage::{CodeSymbolParser, SymbolKind, LanguageKind, StorageManager};

// @verifies ft-core-local-storage::TASK-CORE-003-3::REQ-005
#[tokio::test]
async fn test_treesitter_symbol_and_callgraph_ingestion() {
    let temp_dir = std::env::temp_dir().join("aico_ast_test_1");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).unwrap();
    let parser = CodeSymbolParser::new();

    // 1. Rust code parsing
    let rust_code = r#"
/// Authenticates the user session
pub fn authenticate_session(token: &str) -> bool {
    validate_jwt(token);
    true
}

pub struct UserProfile {
    pub id: String,
}
"#;
    let rust_symbols = parser.parse_symbols(rust_code, LanguageKind::Rust);
    assert_eq!(rust_symbols.len(), 2);

    let fn_symbol = &rust_symbols[0];
    assert_eq!(fn_symbol.name, "authenticate_session");
    assert_eq!(fn_symbol.kind, SymbolKind::Function);
    assert_eq!(fn_symbol.doc_comment.as_deref(), Some("Authenticates the user session"));
    assert!(fn_symbol.calls.contains(&"validate_jwt".to_string()));

    let struct_symbol = &rust_symbols[1];
    assert_eq!(struct_symbol.name, "UserProfile");
    assert_eq!(struct_symbol.kind, SymbolKind::Struct);

    // 2. TypeScript code parsing
    let ts_code = r#"
/** Handles user login */
export function handleLogin(req: Request) {
    parseAuthHeader(req);
}

export interface UserSession {
    token: string;
}
"#;
    let ts_symbols = parser.parse_symbols(ts_code, LanguageKind::TypeScript);
    assert_eq!(ts_symbols.len(), 2);
    assert_eq!(ts_symbols[0].name, "handleLogin");
    assert_eq!(ts_symbols[0].kind, SymbolKind::Function);
    assert!(ts_symbols[0].calls.contains(&"parseAuthHeader".to_string()));
    assert_eq!(ts_symbols[1].name, "UserSession");
    assert_eq!(ts_symbols[1].kind, SymbolKind::Interface);

    // 3. Batch ingestion into property graph
    let res = parser.ingest_symbols_into_graph(&storage_mgr, "crates/auth/src/lib.rs", &rust_symbols).await;
    assert!(res.is_ok());
}

// @verifies spec-ft-storage-aico-graph-and-incremental-cache::TASK-STORAGE-001-4::REQ-009
#[tokio::test]
async fn test_symbol_ingestion_and_graph_linkage() {
    let temp_dir = std::env::temp_dir().join("aico_ast_graph_linkage_test");
    let _ = std::fs::remove_dir_all(&temp_dir);
    std::fs::create_dir_all(&temp_dir).unwrap();

    let storage_mgr = StorageManager::open(&temp_dir).unwrap();
    let parser = CodeSymbolParser::new();

    let code = r#"
/// Validates user session token
/// @implements:spec-ft-core-auth::REQ-001
/// @verifies:spec-ft-core-auth::REQ-002
pub fn validate_session(token: &str) -> bool {
    decode_jwt(token);
    true
}

pub fn decode_jwt(raw: &str) -> String {
    raw.to_string()
}
"#;

    let symbols = parser.parse_symbols(code, LanguageKind::Rust);
    assert_eq!(symbols.len(), 2);

    let count = parser.ingest_symbols_into_graph(&storage_mgr, "crates/auth/src/session.rs", &symbols).await.expect("ingest symbols");
    assert_eq!(count, 2);

    // Read graph and verify nodes and edges
    let gstore = storage_mgr.graph_store().read().await;
    let snapshot = gstore.load_snapshot().expect("load snapshot");

    assert!(snapshot.nodes.iter().any(|n| n.id == "crates/auth/src/session.rs:validate_session"));
    assert!(snapshot.nodes.iter().any(|n| n.id == "crates/auth/src/session.rs:decode_jwt"));

    // Verify calls edge
    assert!(snapshot.edges.iter().any(|e| {
        e.source == "crates/auth/src/session.rs:validate_session"
            && e.target == "crates/auth/src/session.rs:decode_jwt"
            && e.relation == "calls"
    }));

    // Verify in-band @implements and @verifies edges
    assert!(snapshot.edges.iter().any(|e| {
        e.source == "crates/auth/src/session.rs:validate_session"
            && e.target == "spec-ft-core-auth::REQ-001"
            && e.relation == "implements"
    }));
    assert!(snapshot.edges.iter().any(|e| {
        e.source == "crates/auth/src/session.rs:validate_session"
            && e.target == "spec-ft-core-auth::REQ-002"
            && e.relation == "verifies"
    }));

    // Verify BFS query lineage from validate_session
    let downstream = gstore.query_lineage("crates/auth/src/session.rs:validate_session", "downstream", 2).expect("query lineage");
    assert!(!downstream.is_empty());
}
