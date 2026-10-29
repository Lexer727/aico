use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::time::SystemTime;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use aico_storage::{CodeChunker, EmbeddingPipeline, StorageManager};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrawlReport {
    pub status: String,
    pub project_id: String,
    pub files_scanned: usize,
    pub chunks_upserted: usize,
    pub total_chunks: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VectorFileManifestEntry {
    pub mtime_nanos: u128,
    pub sha256: String,
}

pub struct WorkspaceCrawler;

impl WorkspaceCrawler {
    fn manifest_path(storage: &StorageManager) -> PathBuf {
        storage
            .base_path()
            .join(".aico")
            .join("storage")
            .join("vector")
            .join(format!("manifest_{}.json", storage.project_id()))
    }

    fn get_mtime_nanos(path: &Path) -> u128 {
        std::fs::metadata(path)
            .and_then(|m| m.modified())
            .map(|t| {
                t.duration_since(SystemTime::UNIX_EPOCH)
                    .unwrap_or_default()
                    .as_nanos()
            })
            .unwrap_or(0)
    }

    fn compute_sha256(content: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(content.as_bytes());
        format!("{:x}", hasher.finalize())
    }

    fn discover_project_files(
        specs_path: &Path,
        codebase_path: Option<&Path>,
    ) -> Vec<(PathBuf, String, String, String)> {
        let mut discovered = Vec::new();

        let mut spec_files = Vec::new();
        Self::collect_spec_files(specs_path, &mut spec_files);
        for file_path in spec_files {
            let rel_path = file_path
                .strip_prefix(specs_path)
                .unwrap_or(&file_path)
                .to_string_lossy()
                .replace('\\', "/");
            discovered.push((
                file_path,
                rel_path,
                "markdown".to_string(),
                "spec".to_string(),
            ));
        }

        if let Some(cb_path) = codebase_path {
            if cb_path.is_dir() {
                let mut code_files = Vec::new();
                Self::collect_code_files(cb_path, &mut code_files);
                for file_path in code_files {
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
                    discovered.push((
                        file_path,
                        rel_path,
                        lang.to_string(),
                        "code".to_string(),
                    ));
                }
            }
        }

        discovered
    }

    /// Incrementally crawl and index workspace files on startup using a persisted `mtime`/`sha256` manifest,
    /// skipping unchanged files and compacting/pruning LanceDB versions when mutations occur.
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-004
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-013
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-014
    pub async fn crawl_and_index_incremental(
        storage: &StorageManager,
        specs_path: &Path,
        codebase_path: Option<&Path>,
    ) -> Result<CrawlReport, aico_storage::StorageError> {
        let project_id = storage.project_id().to_string();

        // 1. Hydrate in-memory cache from persistent LanceDB table on disk (REQ-012)
        let _ = storage
            .vector_store()
            .read()
            .await
            .hydrate_from_disk()
            .await;

        let existing_count = storage
            .vector_store()
            .read()
            .await
            .record_count_for_project(&project_id);

        let manifest_file = Self::manifest_path(storage);
        let old_manifest: Option<HashMap<String, VectorFileManifestEntry>> = if manifest_file.is_file() {
            std::fs::read_to_string(&manifest_file)
                .ok()
                .and_then(|s| serde_json::from_str(&s).ok())
        } else {
            None
        };

        // If no manifest exists yet or the project has 0 indexed chunks, run a full clean crawl
        let Some(old_manifest) = old_manifest.filter(|_| existing_count > 0) else {
            return Self::crawl_and_index(storage, specs_path, codebase_path).await;
        };

        let chunker = CodeChunker::new();
        let pipeline = EmbeddingPipeline::new();
        let discovered = Self::discover_project_files(specs_path, codebase_path);

        let mut files_scanned = 0;
        let mut new_manifest: HashMap<String, VectorFileManifestEntry> =
            HashMap::with_capacity(discovered.len());
        let mut paths_to_delete: Vec<String> = Vec::new();
        let mut records_buffer: Vec<aico_storage::VectorRecordInput> = Vec::new();

        for (file_path, rel_path, language, doc_type) in discovered {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                files_scanned += 1;
                let mtime_nanos = Self::get_mtime_nanos(&file_path);
                let sha256 = Self::compute_sha256(&content);

                let is_unchanged = old_manifest
                    .get(&rel_path)
                    .map(|entry| entry.sha256 == sha256)
                    .unwrap_or(false);

                new_manifest.insert(
                    rel_path.clone(),
                    VectorFileManifestEntry {
                        mtime_nanos,
                        sha256,
                    },
                );

                if is_unchanged {
                    continue;
                }

                if old_manifest.contains_key(&rel_path) {
                    paths_to_delete.push(rel_path.clone());
                }

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
                        language: language.clone(),
                        vector: vec,
                        doc_type: doc_type.clone(),
                        project_id: project_id.clone(),
                    });
                }
            }
        }

        // Check for files that were in old_manifest but deleted from disk
        for old_rel_path in old_manifest.keys() {
            if !new_manifest.contains_key(old_rel_path) {
                paths_to_delete.push(old_rel_path.clone());
            }
        }

        let mutated = !paths_to_delete.is_empty() || !records_buffer.is_empty();
        if !paths_to_delete.is_empty() {
            let _ = storage
                .vector_store()
                .read()
                .await
                .delete_by_project_and_paths(&project_id, &paths_to_delete)
                .await?;
        }

        let chunks_upserted = if !records_buffer.is_empty() {
            storage
                .vector_store()
                .read()
                .await
                .upsert_records(&records_buffer)
                .await?
        } else {
            0
        };

        if mutated {
            if let Some(parent) = manifest_file.parent() {
                let _ = std::fs::create_dir_all(parent);
            }
            if let Ok(json) = serde_json::to_string_pretty(&new_manifest) {
                let _ = std::fs::write(&manifest_file, json);
            }
            let _ = storage
                .vector_store()
                .read()
                .await
                .create_vector_index()
                .await;
            let _ = storage
                .vector_store()
                .read()
                .await
                .compact_and_prune()
                .await;
        } else {
            // Even when 0 files changed, prune any stale historical versions left on disk
            let vcount = storage
                .vector_store()
                .read()
                .await
                .version_count()
                .await
                .unwrap_or(1);
            if vcount > 1 {
                let _ = storage
                    .vector_store()
                    .read()
                    .await
                    .compact_and_prune()
                    .await;
            }
        }

        let total_chunks = storage
            .vector_store()
            .read()
            .await
            .record_count_for_project(&project_id);

        Ok(CrawlReport {
            status: "ok".to_string(),
            project_id,
            files_scanned,
            chunks_upserted,
            total_chunks,
        })
    }

    /// Recursively traverse specifications and codebase files, performing a full project reindex into LanceDB
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-2::REQ-002
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-2::REQ-003
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-5::REQ-003
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-013
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-7::REQ-014
    pub async fn crawl_and_index(
        storage: &StorageManager,
        specs_path: &Path,
        codebase_path: Option<&Path>,
    ) -> Result<CrawlReport, aico_storage::StorageError> {
        let chunker = CodeChunker::new();
        let pipeline = EmbeddingPipeline::new();

        let mut files_scanned = 0;
        let mut records_buffer: Vec<aico_storage::VectorRecordInput> = Vec::with_capacity(1024);

        let project_id = storage.project_id().to_string();

        // Hydrate cache for other projects before clearing this project's chunks
        let _ = storage
            .vector_store()
            .read()
            .await
            .hydrate_from_disk()
            .await;

        // 0. Clear previous chunks for this project to ensure idempotent full reindexing
        let _ = storage
            .vector_store()
            .read()
            .await
            .delete_by_project(&project_id)
            .await;

        let discovered = Self::discover_project_files(specs_path, codebase_path);
        let mut new_manifest: HashMap<String, VectorFileManifestEntry> =
            HashMap::with_capacity(discovered.len());

        for (file_path, rel_path, language, doc_type) in discovered {
            if let Ok(content) = std::fs::read_to_string(&file_path) {
                files_scanned += 1;
                let mtime_nanos = Self::get_mtime_nanos(&file_path);
                let sha256 = Self::compute_sha256(&content);
                new_manifest.insert(
                    rel_path.clone(),
                    VectorFileManifestEntry {
                        mtime_nanos,
                        sha256,
                    },
                );

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
                        language: language.clone(),
                        vector: vec,
                        doc_type: doc_type.clone(),
                        project_id: project_id.clone(),
                    });
                }
            }
        }

        // 3. Flush buffer in a single consolidated Arrow RecordBatch transaction
        let chunks_upserted = if !records_buffer.is_empty() {
            storage
                .vector_store()
                .read()
                .await
                .upsert_records(&records_buffer)
                .await?
        } else {
            0
        };

        // Persist file manifest for subsequent incremental startup crawls (REQ-013)
        let manifest_file = Self::manifest_path(storage);
        if let Some(parent) = manifest_file.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        if let Ok(json) = serde_json::to_string_pretty(&new_manifest) {
            let _ = std::fs::write(&manifest_file, json);
        }

        // 4. Train IVF-PQ vector index ONCE and compact/prune old LanceDB versions (REQ-014)
        let _ = storage
            .vector_store()
            .read()
            .await
            .create_vector_index()
            .await;
        let _ = storage
            .vector_store()
            .read()
            .await
            .compact_and_prune()
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
