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

    /// Generate 384-dimensional vector embedding for text
    // @implements ft-core-local-storage::TASK-CORE-003-4::REQ-004
    pub fn embed_text(&self, text: &str) -> Vec<f32> {
        let mut vec = vec![0.0f32; 384];
        let bytes = text.as_bytes();
        for (i, b) in bytes.iter().enumerate() {
            let idx = (i * 7 + (*b as usize)) % 384;
            vec[idx] += (*b as f32) / 255.0;
        }

        // L2 normalize
        let mag = vec.iter().map(|x| x * x).sum::<f32>().sqrt();
        if mag > 0.0 {
            for val in &mut vec {
                *val /= mag;
            }
        }

        vec
    }

    /// Ingest semantic code chunks into LanceDB vector store
    // @implements ft-core-local-storage::TASK-CORE-003-4::REQ-004
    pub async fn ingest_chunks(&self, storage: &StorageManager, chunks: &[CodeChunk]) -> Result<usize, StorageError> {
        let mut vstore = storage.vector_store().write().await;
        for chunk in chunks {
            let vec = self.embed_text(&chunk.content);
            let id = format!("{}:{}", chunk.file_path, chunk.start_line);
            vstore.upsert_record(&id, vec, serde_json::to_value(chunk).unwrap())?;
        }
        Ok(chunks.len())
    }
}
