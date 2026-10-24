use std::path::{Path, PathBuf};
use serde::{Deserialize, Serialize};
use aico_storage::{CodeChunker, EmbeddingPipeline, StorageManager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlReport {
    pub status: String,
    pub project_id: String,
    pub files_scanned: usize,
    pub chunks_upserted: usize,
    pub total_chunks: usize,
}

pub struct WorkspaceCrawler;

impl WorkspaceCrawler {
    /// Recursively traverse specifications and codebase files, chunking and upserting into LanceDB
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-2::REQ-002
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-2::REQ-003
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-5::REQ-003
    pub async fn crawl_and_index(
        storage: &StorageManager,
        specs_path: &Path,
        codebase_path: Option<&Path>,
    ) -> Result<CrawlReport, aico_storage::StorageError> {
        let chunker = CodeChunker::new();
        let pipeline = EmbeddingPipeline::new();

        let mut files_scanned = 0;
        let mut chunks_upserted = 0;
        let mut records_buffer: Vec<aico_storage::VectorRecordInput> = Vec::with_capacity(512);

        let project_id = storage.project_id().to_string();

        // 0. Clear previous chunks for this project to ensure idempotent indexing
        let _ = storage
            .vector_store()
            .read()
            .await
            .delete_by_project(&project_id)
            .await;

        // 1. Crawl specs markdown files (epics, features, adr, glossary)
        let mut spec_files = Vec::new();
        Self::collect_spec_files(specs_path, &mut spec_files);

        for file_path in spec_files {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                files_scanned += 1;
                let rel_path = file_path
                    .strip_prefix(specs_path)
                    .unwrap_or(&file_path)
                    .to_string_lossy()
                    .replace('\\', "/");
                let chunks = chunker.chunk_file(&rel_path, &content);
                for chunk in chunks {
                    let vec = pipeline.embed_text(&chunk.content);
                    let id = if project_id == "default" {
                        format!("{}:{}", chunk.file_path, chunk.start_line)
                    } else {
                        format!("{}::{}:{}", project_id, chunk.file_path, chunk.start_line)
                    };
                    records_buffer.push(aico_storage::VectorRecordInput {
                        id,
                        content: chunk.content,
                        file_path: chunk.file_path,
                        start_line: chunk.start_line,
                        end_line: chunk.end_line,
                        language: "markdown".to_string(),
                        vector: vec,
                        doc_type: "spec".to_string(),
                        project_id: project_id.clone(),
                    });

                    if records_buffer.len() >= 500 {
                        let count = storage
                            .vector_store()
                            .read()
                            .await
                            .upsert_records(&records_buffer)
                            .await?;
                        chunks_upserted += count;
                        records_buffer.clear();
                    }
                }
            }
        }

        // 2. Crawl codebase files if present
        if let Some(cb_path) = codebase_path {
            if cb_path.is_dir() {
                let mut code_files = Vec::new();
                Self::collect_code_files(cb_path, &mut code_files);

                for file_path in code_files {
                    if let Ok(content) = std::fs::read_to_string(&file_path) {
                        files_scanned += 1;
                        let rel_path = file_path
                            .strip_prefix(cb_path)
                            .unwrap_or(&file_path)
                            .to_string_lossy()
                            .replace('\\', "/");
                        let ext = file_path
                            .extension()
                            .and_then(|e| e.to_str())
                            .unwrap_or("");
                        let lang = match ext.to_ascii_lowercase().as_str() {
                            "rs" => "rust",
                            "ts" | "tsx" | "js" | "jsx" | "mjs" => "typescript",
                            "py" => "python",
                            _ => "text",
                        };
                        let chunks = chunker.chunk_file(&rel_path, &content);
                        for chunk in chunks {
                            let vec = pipeline.embed_text(&chunk.content);
                            let id = if project_id == "default" {
                                format!("{}:{}", chunk.file_path, chunk.start_line)
                            } else {
                                format!("{}::{}:{}", project_id, chunk.file_path, chunk.start_line)
                            };
                            records_buffer.push(aico_storage::VectorRecordInput {
                                id,
                                content: chunk.content,
                                file_path: chunk.file_path,
                                start_line: chunk.start_line,
                                end_line: chunk.end_line,
                                language: lang.to_string(),
                                vector: vec,
                                doc_type: "code".to_string(),
                                project_id: project_id.clone(),
                            });

                            if records_buffer.len() >= 500 {
                                let count = storage
                                    .vector_store()
                                    .read()
                                    .await
                                    .upsert_records(&records_buffer)
                                    .await?;
                                chunks_upserted += count;
                                records_buffer.clear();
                            }
                        }
                    }
                }
            }
        }

        // 3. Flush remaining buffer
        if !records_buffer.is_empty() {
            let count = storage
                .vector_store()
                .read()
                .await
                .upsert_records(&records_buffer)
                .await?;
            chunks_upserted += count;
            records_buffer.clear();
        }

        // 4. Train IVF-PQ vector index ONCE at the end of the crawl
        let _ = storage
            .vector_store()
            .read()
            .await
            .create_vector_index()
            .await;

        let total_chunks = storage
            .vector_store()
            .read()
            .await
            .record_count_for_project(storage.project_id());

        Ok(CrawlReport {
            status: "ok".to_string(),
            project_id: storage.project_id().to_string(),
            files_scanned,
            chunks_upserted,
            total_chunks,
        })
    }

    fn collect_spec_files(specs_path: &Path, files: &mut Vec<PathBuf>) {
        let subdirs = ["adr", "epics", "features"];
        for sub in subdirs {
            let dir = specs_path.join(sub);
            if dir.is_dir() {
                Self::walk_dir_ext(&dir, &["md"], files);
            }
        }
        let glossary = specs_path.join("glossary.md");
        if glossary.is_file() {
            files.push(glossary);
        }
    }

    fn collect_code_files(codebase_path: &Path, files: &mut Vec<PathBuf>) {
        Self::walk_dir_ext(
            codebase_path,
            &["rs", "ts", "tsx", "js", "jsx", "mjs", "py"],
            files,
        );
    }

    fn walk_dir_ext(dir: &Path, extensions: &[&str], files: &mut Vec<PathBuf>) {
        if let Ok(entries) = std::fs::read_dir(dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                let file_name = path.file_name().and_then(|n| n.to_str()).unwrap_or("");
                if path.is_dir() {
                    // Ignore common build and dependency folders
                    if file_name == "target"
                        || file_name == "dist"
                        || file_name == "node_modules"
                        || file_name == ".git"
                        || file_name == ".turbo"
                        || file_name == ".next"
                        || file_name == ".aico"
                    {
                        continue;
                    }
                    Self::walk_dir_ext(&path, extensions, files);
                } else if path.is_file() {
                    if let Some(ext) = path.extension().and_then(|e| e.to_str()) {
                        if extensions.iter().any(|&e| e.eq_ignore_ascii_case(ext)) {
                            files.push(path);
                        }
                    }
                }
            }
        }
    }
}
