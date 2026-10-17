use serde::{Deserialize, Serialize};
use crate::error::StorageError;
use crate::manager::StorageManager;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LanguageKind {
    Rust,
    TypeScript,
    Python,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum SymbolKind {
    Function,
    Struct,
    Class,
    Trait,
    Interface,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeSymbol {
    pub name: String,
    pub kind: SymbolKind,
    pub start_line: usize,
    pub end_line: usize,
    pub doc_comment: Option<String>,
    pub calls: Vec<String>,
}

#[derive(Default)]
pub struct CodeSymbolParser;

impl CodeSymbolParser {
    pub fn new() -> Self {
        Self
    }

    /// Extract symbols and call sites from source code according to language grammar
    // @implements ft-core-local-storage::TASK-CORE-003-3::REQ-005
    pub fn parse_symbols(&self, code: &str, lang: LanguageKind) -> Vec<CodeSymbol> {
        let lines: Vec<&str> = code.lines().collect();
        let mut symbols = Vec::new();
        let mut current_doc = None;

        for (idx, raw_line) in lines.iter().enumerate() {
            let line = raw_line.trim();
            let line_num = idx + 1;

            // Extract doc comment
            if line.starts_with("///") || line.starts_with("/**") || line.starts_with('#') {
                let doc = line
                    .trim_start_matches("///")
                    .trim_start_matches("/**")
                    .trim_end_matches("*/")
                    .trim_start_matches('#')
                    .trim();
                if !doc.is_empty() {
                    current_doc = Some(doc.to_string());
                }
                continue;
            }

            match lang {
                LanguageKind::Rust => {
                    if (line.starts_with("fn ") || line.starts_with("pub fn ")) && line.contains('(') {
                        let name_part = line.split("fn ").nth(1).unwrap();
                        let name = name_part.split('(').next().unwrap().trim();

                        // Extract function calls in subsequent lines
                        let mut calls = Vec::new();
                        for inner in lines.iter().skip(idx + 1) {
                            let t = inner.trim();
                            if t.contains('(') && t.ends_with(';') {
                                let c_name = t.split('(').next().unwrap().trim();
                                if !c_name.contains(' ') && !c_name.is_empty() {
                                    calls.push(c_name.to_string());
                                }
                            }
                            if t == "}" {
                                break;
                            }
                        }

                        symbols.push(CodeSymbol {
                            name: name.to_string(),
                            kind: SymbolKind::Function,
                            start_line: line_num,
                            end_line: line_num + 5,
                            doc_comment: current_doc.take(),
                            calls,
                        });
                    } else if line.starts_with("struct ") || line.starts_with("pub struct ") {
                        let name_part = line.split("struct ").nth(1).unwrap();
                        let name = name_part.split(|c| c == '{' || c == ';').next().unwrap().trim();
                        symbols.push(CodeSymbol {
                            name: name.to_string(),
                            kind: SymbolKind::Struct,
                            start_line: line_num,
                            end_line: line_num + 3,
                            doc_comment: current_doc.take(),
                            calls: Vec::new(),
                        });
                    }
                }
                LanguageKind::TypeScript => {
                    if (line.starts_with("function ") || line.starts_with("export function ")) && line.contains('(') {
                        let name_part = line.split("function ").nth(1).unwrap();
                        let name = name_part.split('(').next().unwrap().trim();

                        let mut calls = Vec::new();
                        for inner in lines.iter().skip(idx + 1) {
                            let t = inner.trim();
                            if t.contains('(') && t.ends_with(';') {
                                let c_name = t.split('(').next().unwrap().trim();
                                if !c_name.contains(' ') && !c_name.is_empty() {
                                    calls.push(c_name.to_string());
                                }
                            }
                            if t == "}" {
                                break;
                            }
                        }

                        symbols.push(CodeSymbol {
                            name: name.to_string(),
                            kind: SymbolKind::Function,
                            start_line: line_num,
                            end_line: line_num + 5,
                            doc_comment: current_doc.take(),
                            calls,
                        });
                    } else if line.starts_with("interface ") || line.starts_with("export interface ") {
                        let name_part = line.split("interface ").nth(1).unwrap();
                        let name = name_part.split('{').next().unwrap().trim();
                        symbols.push(CodeSymbol {
                            name: name.to_string(),
                            kind: SymbolKind::Interface,
                            start_line: line_num,
                            end_line: line_num + 3,
                            doc_comment: current_doc.take(),
                            calls: Vec::new(),
                        });
                    }
                }
                LanguageKind::Python => {
                    if line.starts_with("def ") && line.contains('(') {
                        let name_part = line.split("def ").nth(1).unwrap();
                        let name = name_part.split('(').next().unwrap().trim();
                        symbols.push(CodeSymbol {
                            name: name.to_string(),
                            kind: SymbolKind::Function,
                            start_line: line_num,
                            end_line: line_num + 5,
                            doc_comment: current_doc.take(),
                            calls: Vec::new(),
                        });
                    }
                }
            }
        }

        symbols
    }

    /// Batch ingest parsed symbols and call graph relationships into Kùzu property graph
    // @implements ft-core-local-storage::TASK-CORE-003-3::REQ-005
    pub async fn ingest_symbols_into_graph(
        &self,
        storage: &StorageManager,
        file_path: &str,
        symbols: &[CodeSymbol],
    ) -> Result<usize, StorageError> {
        let mut gstore = storage.graph_store().write().await;
        for s in symbols {
            let cypher_node = format!(
                "CREATE (s:Symbol {{name: '{}', file: '{}', kind: '{:?}'}})",
                s.name, file_path, s.kind
            );
            gstore.execute_query(&cypher_node)?;

            for callee in &s.calls {
                let cypher_rel = format!(
                    "MATCH (caller:Symbol {{name: '{}'}}), (callee:Symbol {{name: '{}'}}) CREATE (caller)-[:CALLS]->(callee)",
                    s.name, callee
                );
                let _ = gstore.execute_query(&cypher_rel);
            }
        }
        Ok(symbols.len())
    }
}
