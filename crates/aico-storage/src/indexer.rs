use std::collections::HashMap;
use std::path::{Path, PathBuf};
use sha2::{Digest, Sha256};
use crate::chunker::{CodeChunker, EmbeddingPipeline};
use crate::error::StorageError;
use crate::manager::StorageManager;
use crate::parser::{CodeSymbolParser, LanguageKind};

#[derive(Default)]
pub struct DifferentialIndexer {
    file_hashes: HashMap<PathBuf, String>,
    symbol_parser: CodeSymbolParser,
    chunker: CodeChunker,
    embedding_pipeline: EmbeddingPipeline,
}

impl DifferentialIndexer {
    pub fn new() -> Self {
        Self::default()
    }

    /// Incrementally re-index file if content hash has changed
    // @implements spec-ft-core-local-storage::REQ-010
    pub async fn index_file(
        &mut self,
        storage: &StorageManager,
        file_path: &Path,
        content: &str,
        lang: LanguageKind,
    ) -> Result<bool, StorageError> {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        let hash = format!("{:x}", hasher.finalize());

        let path_buf = file_path.to_path_buf();
        if let Some(existing) = self.file_hashes.get(&path_buf) {
            if *existing == hash {
                return Ok(false); // Unchanged, skip reindexing
            }
        }

        // Parse and ingest symbols into Kùzu property graph
        let symbols = self.symbol_parser.parse_symbols(content, lang);
        self.symbol_parser.ingest_symbols_into_graph(storage, file_path.to_str().unwrap(), &symbols).await?;

        // Semantic chunking and vector indexing into LanceDB
        let chunks = self.chunker.chunk_file(file_path.to_str().unwrap(), content);
        self.embedding_pipeline.ingest_chunks(storage, &chunks).await?;

        self.file_hashes.insert(path_buf, hash);
        Ok(true)
    }
}
