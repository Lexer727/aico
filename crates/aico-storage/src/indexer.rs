use std::collections::HashMap;
use std::path::{Path, PathBuf};
use sha2::{Digest, Sha256};
use crate::chunker::{CodeChunker, EmbeddingPipeline};
use crate::error::StorageError;
use crate::manager::StorageManager;
use crate::parser::{CodeSymbolParser, LanguageKind};

#[derive(Debug, Clone, Default)]
pub struct IndexReport {
    pub file_indexed: bool,
    pub chunks_total: usize,
    pub chunks_upserted: usize,
    pub chunks_unchanged: usize,
}

#[derive(Default)]
pub struct DifferentialIndexer {
    file_hashes: HashMap<PathBuf, String>,
    chunk_hashes: HashMap<String, String>,
    symbol_parser: CodeSymbolParser,
    chunker: CodeChunker,
    embedding_pipeline: EmbeddingPipeline,
}

impl DifferentialIndexer {
    pub fn new() -> Self {
        Self::default()
    }

    /// Incrementally re-index file if content hash has changed
    // @implements ft-core-local-storage::TASK-CORE-003-5::REQ-010
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-4::REQ-005
    pub async fn index_file(
        &mut self,
        storage: &StorageManager,
        file_path: &Path,
        content: &str,
        lang: LanguageKind,
    ) -> Result<bool, StorageError> {
        let report = self.index_file_detailed(storage, file_path, content, lang).await?;
        Ok(report.file_indexed)
    }

    /// Detailed differential indexing with per-chunk SHA-256 change detection
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-4::REQ-005
    pub async fn index_file_detailed(
        &mut self,
        storage: &StorageManager,
        file_path: &Path,
        content: &str,
        lang: LanguageKind,
    ) -> Result<IndexReport, StorageError> {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        let file_hash = format!("{:x}", hasher.finalize());

        let path_buf = file_path.to_path_buf();
        if let Some(existing) = self.file_hashes.get(&path_buf) {
            if *existing == file_hash {
                return Ok(IndexReport {
                    file_indexed: false,
                    chunks_total: 0,
                    chunks_upserted: 0,
                    chunks_unchanged: 0,
                });
            }
        }

        // 1. Ingest symbols into AICO property graph
        let path_str = file_path.to_str().unwrap_or_default();
        let symbols = self.symbol_parser.parse_symbols(content, lang);
        self.symbol_parser.ingest_symbols_into_graph(storage, path_str, &symbols).await?;

        // 2. Chunk source code
        let chunks = self.chunker.chunk_file(path_str, content);
        let total_chunks = chunks.len();
        let mut new_or_changed_chunks = Vec::new();
        let mut unchanged_count = 0;

        for chunk in &chunks {
            let chunk_id = format!("{}:{}", chunk.file_path, chunk.start_line);
            if let Some(existing_hash) = self.chunk_hashes.get(&chunk_id) {
                if *existing_hash == chunk.content_hash {
                    unchanged_count += 1;
                    continue;
                }
            }
            new_or_changed_chunks.push(chunk.clone());
        }

        // 3. Upsert only changed chunks into LanceDB
        let upserted_count = new_or_changed_chunks.len();
        if !new_or_changed_chunks.is_empty() {
            self.embedding_pipeline.ingest_chunks(storage, &new_or_changed_chunks).await?;
            for chunk in &new_or_changed_chunks {
                let chunk_id = format!("{}:{}", chunk.file_path, chunk.start_line);
                self.chunk_hashes.insert(chunk_id, chunk.content_hash.clone());
            }
        }

        self.file_hashes.insert(path_buf, file_hash);
        Ok(IndexReport {
            file_indexed: true,
            chunks_total: total_chunks,
            chunks_upserted: upserted_count,
            chunks_unchanged: unchanged_count,
        })
    }

    /// Remove deleted file and purge all associated chunks from LanceDB and graph
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-4::REQ-006
    pub async fn remove_file(
        &mut self,
        storage: &StorageManager,
        file_path: &Path,
    ) -> Result<usize, StorageError> {
        let path_str = file_path.to_str().unwrap_or_default();
        let vstore = storage.vector_store().read().await;
        let deleted = vstore.delete_by_path(path_str).await?;

        self.file_hashes.remove(file_path);
        let prefix = format!("{}:", path_str);
        self.chunk_hashes.retain(|k, _| !k.starts_with(&prefix));

        Ok(deleted)
    }
}
