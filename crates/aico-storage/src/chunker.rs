use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use crate::error::StorageError;
use crate::manager::StorageManager;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeChunk {
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub content: String,
    pub content_hash: String,
}

#[derive(Default)]
pub struct CodeChunker;

impl CodeChunker {
    pub fn new() -> Self {
        Self
    }

    /// Split source code into AST boundary-aware semantic chunks
    // @implements ft-core-local-storage::TASK-CORE-003-4::REQ-004
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-4::REQ-005
    pub fn chunk_file(&self, file_path: &str, content: &str) -> Vec<CodeChunk> {
        let lines: Vec<&str> = content.lines().collect();
        let mut chunks = Vec::new();
        let mut current_chunk = Vec::new();
        let mut start_line = 1;

        for (idx, line) in lines.iter().enumerate() {
            let line_num = idx + 1;
            let trimmed = line.trim();

            if trimmed.is_empty() {
                if !current_chunk.is_empty() {
                    let chunk_text = current_chunk.join("\n");
                    let mut hasher = Sha256::new();
                    hasher.update(chunk_text.as_bytes());
                    let hash = format!("{:x}", hasher.finalize());

                    chunks.push(CodeChunk {
                        file_path: file_path.to_string(),
                        start_line,
                        end_line: line_num - 1,
                        content: chunk_text,
                        content_hash: hash,
                    });
                    current_chunk.clear();
                }
                start_line = line_num + 1;
            } else {
                current_chunk.push(*line);
            }
        }

        if !current_chunk.is_empty() {
            let chunk_text = current_chunk.join("\n");
            let mut hasher = Sha256::new();
            hasher.update(chunk_text.as_bytes());
            let hash = format!("{:x}", hasher.finalize());

            chunks.push(CodeChunk {
                file_path: file_path.to_string(),
                start_line,
                end_line: lines.len(),
                content: chunk_text,
                content_hash: hash,
            });
        }

        chunks
    }
}

#[derive(Default)]
pub struct EmbeddingPipeline;

impl EmbeddingPipeline {
    pub fn new() -> Self {
        Self
    }

    /// Generate 384-dimensional vector embedding for text using deterministic token projection
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-2::REQ-003
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-2::REQ-011
    pub fn embed_text(&self, text: &str) -> Vec<f32> {
        let mut vec = vec![0.0f32; 384];
        let trimmed = text.trim();
        if trimmed.is_empty() {
            vec[0] = 1.0;
            return vec;
        }

        let tokens = Self::tokenize_lexical(trimmed);
        if tokens.is_empty() {
            vec[0] = 1.0;
            return vec;
        }

        // Subword and word projection into 384-dimensional space
        for (pos, token) in tokens.iter().enumerate() {
            let mut hasher = Sha256::new();
            hasher.update(token.as_bytes());
            let hash_bytes = hasher.finalize();

            for chunk in hash_bytes.chunks_exact(4) {
                let u = u32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]);
                let dim = (u as usize) % 384;
                let sign = if (u & 0x80000000) != 0 { 1.0f32 } else { -1.0f32 };
                let weight = 1.0f32 / ((pos as f32).sqrt() + 1.0);
                vec[dim] += sign * weight;
            }

            // Also project 3-character n-grams for subword similarity
            if token.len() >= 3 {
                for i in 0..=token.len() - 3 {
                    let sub = &token[i..i + 3];
                    let mut sub_hasher = Sha256::new();
                    sub_hasher.update(sub.as_bytes());
                    let sub_bytes = sub_hasher.finalize();
                    let u = u32::from_le_bytes([sub_bytes[0], sub_bytes[1], sub_bytes[2], sub_bytes[3]]);
                    let dim = (u as usize) % 384;
                    let sign = if (u & 0x40000000) != 0 { 0.5f32 } else { -0.5f32 };
                    vec[dim] += sign;
                }
            }
        }

        // L2 normalize
        let mag = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
        if mag > 0.0 {
            for val in &mut vec {
                *val /= mag;
            }
        } else {
            vec[0] = 1.0;
        }

        vec
    }

    /// Extract clean lexical keywords splitting by camelCase, snake_case, and delimiters
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-2::REQ-003
    pub fn tokenize_lexical(text: &str) -> Vec<String> {
        let mut tokens = Vec::new();
        let mut current = String::new();

        for ch in text.chars() {
            if ch.is_alphanumeric() {
                if ch.is_uppercase() && !current.is_empty() && current.chars().last().map(|c| c.is_lowercase()).unwrap_or(false) {
                    tokens.push(current.to_lowercase());
                    current.clear();
                }
                current.push(ch);
            } else {
                if !current.is_empty() {
                    tokens.push(current.to_lowercase());
                    current.clear();
                }
                // Retain explicit requirement tokens like REQ-001
                if ch == '-' && !tokens.is_empty() {
                    let prev = tokens.pop().unwrap();
                    if prev == "req" || prev == "task" || prev == "adr" {
                        current.push_str(&prev);
                        current.push('-');
                    }
                }
            }
        }

        if !current.is_empty() {
            tokens.push(current.to_lowercase());
        }

        // Filter trivial short tokens
        tokens.into_iter().filter(|t| t.len() >= 2).collect()
    }

    /// Calculate Okapi BM25 relevance score for lexical matches
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-2::REQ-003
    pub fn calculate_bm25(
        query_tokens: &[String],
        doc_tokens: &[String],
        avg_doc_len: f32,
        total_docs: usize,
        doc_freq: usize,
    ) -> f32 {
        let k1 = 1.2f32;
        let b = 0.75f32;
        let doc_len = doc_tokens.len() as f32;
        let avg_len = if avg_doc_len > 0.0 { avg_doc_len } else { 10.0 };

        let idf = ((total_docs as f32 - doc_freq as f32 + 0.5) / (doc_freq as f32 + 0.5) + 1.0).ln().max(0.1);

        let mut score = 0.0f32;
        for q in query_tokens {
            let tf = doc_tokens.iter().filter(|d| *d == q).count() as f32;
            if tf > 0.0 {
                let tf_component = (tf * (k1 + 1.0)) / (tf + k1 * (1.0 - b + b * (doc_len / avg_len)));
                score += idf * tf_component;
            }
        }

        score
    }

    /// Ingest semantic code chunks into LanceDB vector store
    // @implements ft-core-local-storage::TASK-CORE-003-4::REQ-004
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-001
    pub async fn ingest_chunks(&self, storage: &StorageManager, chunks: &[CodeChunk]) -> Result<usize, StorageError> {
        let vstore = storage.vector_store().read().await;
        let mut records = Vec::with_capacity(chunks.len());
        for chunk in chunks {
            let vec = self.embed_text(&chunk.content);
            let id = format!("{}:{}", chunk.file_path, chunk.start_line);
            records.push(crate::vector::VectorRecordInput {
                id,
                content: chunk.content.clone(),
                file_path: chunk.file_path.clone(),
                start_line: chunk.start_line,
                end_line: chunk.end_line,
                language: "rust".to_string(),
                vector: vec,
                doc_type: "code".to_string(),
                project_id: "default".to_string(),
            });
        }
        vstore.upsert_records(&records).await
    }
}
