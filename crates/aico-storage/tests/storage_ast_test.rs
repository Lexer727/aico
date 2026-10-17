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
