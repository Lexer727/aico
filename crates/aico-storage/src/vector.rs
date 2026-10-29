use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::{Arc, RwLock};
use arrow_array::{
    FixedSizeListArray, Float32Array, RecordBatch, StringArray, UInt32Array,
    types::Float32Type,
};
use arrow_schema::{DataType, Field, Schema};
use futures::TryStreamExt;
use lancedb::query::{ExecutableQuery, QueryBase};
use serde::{Deserialize, Serialize};
use tokio::sync::Mutex as TokioMutex;
use crate::error::StorageError;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorRecordInput {
    pub id: String,
    pub content: String,
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub language: String,
    pub vector: Vec<f32>,
    pub doc_type: String,
    pub project_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorRecord {
    pub id: String,
    pub vector: Vec<f32>,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorQueryResult {
    pub id: String,
    pub score: f32,
    pub metadata: serde_json::Value,
}

pub struct LanceVectorStore {
    path: PathBuf,
    records: RwLock<HashMap<String, VectorRecord>>,
    db_conn: Arc<TokioMutex<Option<lancedb::Connection>>>,
    table: Arc<TokioMutex<Option<lancedb::Table>>>,
}

impl LanceVectorStore {
    /// Return canonical Apache Arrow table schema for code and specification chunks
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-002
    pub fn table_schema() -> Arc<Schema> {
        Arc::new(Schema::new(vec![
            Field::new("id", DataType::Utf8, false),
            Field::new("content", DataType::Utf8, false),
            Field::new("file_path", DataType::Utf8, false),
            Field::new("start_line", DataType::UInt32, false),
            Field::new("end_line", DataType::UInt32, false),
            Field::new("language", DataType::Utf8, false),
            Field::new(
                "vector",
                DataType::FixedSizeList(Arc::new(Field::new("item", DataType::Float32, true)), 384),
                false,
            ),
            Field::new("doc_type", DataType::Utf8, false),
            Field::new("project_id", DataType::Utf8, false),
        ]))
    }

    /// Initialize embedded persistent vector store connection directory
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-001
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-010
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let path = path.as_ref().to_path_buf();
        std::fs::create_dir_all(&path)?;
        Ok(Self {
            path,
            records: RwLock::new(HashMap::new()),
            db_conn: Arc::new(TokioMutex::new(None)),
            table: Arc::new(TokioMutex::new(None)),
        })
    }

    /// Asynchronously open and connect to embedded LanceDB table
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-001
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-6::REQ-012
    pub async fn open_async(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let store = Self::open(path)?;
        let _ = store.ensure_table().await?;
        let _ = store.hydrate_from_disk().await;
        Ok(store)
    }

    /// Hydrate in-memory vector and lexical cache from persisted LanceDB table on disk
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-6::REQ-012
    pub async fn hydrate_from_disk(&self) -> Result<usize, StorageError> {
        {
            let mem = self.records.read().unwrap();
            if !mem.is_empty() {
                return Ok(mem.len());
            }
        }

        let table = self.ensure_table().await?;
        let row_count = table.count_rows(None).await.unwrap_or(0);
        if row_count == 0 {
            return Ok(0);
        }

        let mut stream = table.query().execute().await?;
        let mut hydrated = HashMap::with_capacity(row_count);

        while let Some(batch) = stream.try_next().await? {
            let id_col = batch.column_by_name("id").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let content_col = batch.column_by_name("content").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let path_col = batch.column_by_name("file_path").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let start_col = batch.column_by_name("start_line").and_then(|c| c.as_any().downcast_ref::<UInt32Array>());
            let end_col = batch.column_by_name("end_line").and_then(|c| c.as_any().downcast_ref::<UInt32Array>());
            let lang_col = batch.column_by_name("language").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let doc_col = batch.column_by_name("doc_type").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let proj_col = batch.column_by_name("project_id").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let vec_col = batch.column_by_name("vector").and_then(|c| c.as_any().downcast_ref::<FixedSizeListArray>());

            for i in 0..batch.num_rows() {
                let id = id_col.map(|c| c.value(i).to_string()).unwrap_or_default();
                if id.is_empty() {
                    continue;
                }
                let vector: Vec<f32> = if let Some(fsl) = vec_col {
                    let row_arr = fsl.value(i);
                    row_arr
                        .as_any()
                        .downcast_ref::<Float32Array>()
                        .map(|fa| (0..fa.len()).map(|idx| fa.value(idx)).collect())
                        .unwrap_or_else(|| vec![0.0; 384])
                } else {
                    vec![0.0; 384]
                };

                let metadata = serde_json::json!({
                    "file_path": path_col.map(|c| c.value(i)).unwrap_or_default(),
                    "start_line": start_col.map(|c| c.value(i) as usize).unwrap_or(1),
                    "end_line": end_col.map(|c| c.value(i) as usize).unwrap_or(1),
                    "language": lang_col.map(|c| c.value(i)).unwrap_or_default(),
                    "doc_type": doc_col.map(|c| c.value(i)).unwrap_or_default(),
                    "project_id": proj_col.map(|c| c.value(i)).unwrap_or_default(),
                    "content": content_col.map(|c| c.value(i)).unwrap_or_default(),
                });

                hydrated.insert(
                    id.clone(),
                    VectorRecord {
                        id,
                        vector,
                        metadata,
                    },
                );
            }
        }

        let total = hydrated.len();
        if total > 0 {
            let mut mem = self.records.write().unwrap();
            if mem.is_empty() {
                *mem = hydrated;
            } else {
                for (k, v) in hydrated {
                    mem.entry(k).or_insert(v);
                }
            }
        }
        Ok(total)
    }

    /// Ensure table exists and return cached handle
    pub async fn ensure_table(&self) -> Result<lancedb::Table, StorageError> {
        let mut tbl_lock = self.table.lock().await;
        if let Some(ref tbl) = *tbl_lock {
            return Ok(tbl.clone());
        }

        let mut conn_lock = self.db_conn.lock().await;
        let conn = match *conn_lock {
            Some(ref c) => c.clone(),
            None => {
                let uri = self.path.to_string_lossy().to_string();
                let c = lancedb::connect(&uri).execute().await?;
                *conn_lock = Some(c.clone());
                c
            }
        };

        let table_names = conn.table_names().execute().await?;
        let table = if table_names.iter().any(|t| t == "chunks") {
            conn.open_table("chunks").execute().await?
        } else {
            conn.create_empty_table("chunks", Self::table_schema())
                .execute()
                .await?
        };

        *tbl_lock = Some(table.clone());
        Ok(table)
    }

    /// Upsert vector records into LanceDB persistent columnar table
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-001
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-002
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-008
    pub async fn upsert_records(&self, records: &[VectorRecordInput]) -> Result<usize, StorageError> {
        if records.is_empty() {
            return Ok(0);
        }

        let table = self.ensure_table().await?;

        // 1. Build Arrow Arrays
        let id_array = Arc::new(StringArray::from_iter_values(records.iter().map(|r| r.id.as_str())));
        let content_array = Arc::new(StringArray::from_iter_values(records.iter().map(|r| r.content.as_str())));
        let file_path_array = Arc::new(StringArray::from_iter_values(records.iter().map(|r| r.file_path.as_str())));
        let start_line_array = Arc::new(UInt32Array::from_iter_values(records.iter().map(|r| r.start_line as u32)));
        let end_line_array = Arc::new(UInt32Array::from_iter_values(records.iter().map(|r| r.end_line as u32)));
        let language_array = Arc::new(StringArray::from_iter_values(records.iter().map(|r| r.language.as_str())));

        let values: Vec<Option<Vec<Option<f32>>>> = records
            .iter()
            .map(|r| {
                let mut v = r.vector.clone();
                if v.len() < 384 {
                    v.resize(384, 0.0);
                } else if v.len() > 384 {
                    v.truncate(384);
                }
                Some(v.into_iter().map(Some).collect())
            })
            .collect();
        let vector_array = Arc::new(FixedSizeListArray::from_iter_primitive::<Float32Type, _, _>(values, 384));

        let doc_type_array = Arc::new(StringArray::from_iter_values(records.iter().map(|r| r.doc_type.as_str())));
        let project_id_array = Arc::new(StringArray::from_iter_values(records.iter().map(|r| r.project_id.as_str())));

        let batch = RecordBatch::try_new(
            Self::table_schema(),
            vec![
                id_array,
                content_array,
                file_path_array,
                start_line_array,
                end_line_array,
                language_array,
                vector_array,
                doc_type_array,
                project_id_array,
            ],
        )?;

        // 2. Add batch to LanceDB table
        table.add(batch).execute().await?;

        // 3. Update fast in-memory cache
        {
            let mut mem = self.records.write().unwrap();
            for r in records {
                let metadata = serde_json::json!({
                    "file_path": r.file_path,
                    "start_line": r.start_line,
                    "end_line": r.end_line,
                    "language": r.language,
                    "doc_type": r.doc_type,
                    "project_id": r.project_id,
                    "content": r.content,
                });
                mem.insert(
                    r.id.clone(),
                    VectorRecord {
                        id: r.id.clone(),
                        vector: r.vector.clone(),
                        metadata,
                    },
                );
            }
        }

        Ok(records.len())
    }

    /// Delete all chunks associated with a project ID
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-5::REQ-003
    pub async fn delete_by_project(&self, project_id: &str) -> Result<usize, StorageError> {
        let table = self.ensure_table().await?;
        let predicate = format!("project_id = '{}'", project_id.replace('\'', "''"));
        let _ = table.delete(&predicate).await;

        let mut mem = self.records.write().unwrap();
        let mut removed = 0;
        mem.retain(|_, v| {
            if let Some(pid) = v.metadata.get("project_id").and_then(|p| p.as_str()) {
                if pid == project_id {
                    removed += 1;
                    return false;
                }
            }
            true
        });
        Ok(removed)
    }

    /// Train and maintain IVF-PQ vector index on the embedded table when row count >= 10,000
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-008
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-5::REQ-003
    pub async fn create_vector_index(&self) -> Result<(), StorageError> {
        let table = self.ensure_table().await?;
        if let Ok(count) = table.count_rows(None).await {
            if count >= 10_000 {
                let _ = table.create_index(&["vector"], lancedb::index::Index::Auto).execute().await;
            }
        }
        Ok(())
    }

    /// Delete all chunks associated with a file path
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-006
    pub async fn delete_by_path(&self, file_path: &str) -> Result<usize, StorageError> {
        let table = self.ensure_table().await?;
        let predicate = format!("file_path = '{}'", file_path.replace('\'', "''"));
        let _ = table.delete(&predicate).await;

        let mut mem = self.records.write().unwrap();
        let mut removed = 0;
        mem.retain(|_, v| {
            if let Some(fp) = v.metadata.get("file_path").and_then(|f| f.as_str()) {
                if fp == file_path {
                    removed += 1;
                    return false;
                }
            }
            true
        });
        Ok(removed)
    }

    /// Delete chunks associated with a specific project_id and file_path
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-6::REQ-013
    pub async fn delete_by_project_and_path(
        &self,
        project_id: &str,
        file_path: &str,
    ) -> Result<usize, StorageError> {
        self.delete_by_project_and_paths(project_id, &[file_path.to_string()])
            .await
    }

    /// Delete chunks associated with a specific project_id and a list of file_paths in batched predicates
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-6::REQ-013
    pub async fn delete_by_project_and_paths(
        &self,
        project_id: &str,
        file_paths: &[String],
    ) -> Result<usize, StorageError> {
        if file_paths.is_empty() {
            return Ok(0);
        }
        let table = self.ensure_table().await?;
        let escaped_proj = project_id.replace('\'', "''");
        for chunk_paths in file_paths.chunks(100) {
            let quoted: Vec<String> = chunk_paths
                .iter()
                .map(|p| format!("'{}'", p.replace('\'', "''")))
                .collect();
            let predicate = format!(
                "project_id = '{}' AND file_path IN ({})",
                escaped_proj,
                quoted.join(", ")
            );
            let _ = table.delete(&predicate).await;
        }

        let path_set: std::collections::HashSet<&str> =
            file_paths.iter().map(|s| s.as_str()).collect();
        let mut mem = self.records.write().unwrap();
        let mut removed = 0;
        mem.retain(|_, v| {
            let pid_match =
                v.metadata.get("project_id").and_then(|p| p.as_str()) == Some(project_id);
            let fp_match = v
                .metadata
                .get("file_path")
                .and_then(|f| f.as_str())
                .map(|fp| path_set.contains(fp))
                .unwrap_or(false);
            if pid_match && fp_match {
                removed += 1;
                return false;
            }
            true
        });
        Ok(removed)
    }

    /// Compact LanceDB fragments and prune all superseded versions from _versions, _transactions, and data
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-6::REQ-014
    pub async fn compact_and_prune(&self) -> Result<(), StorageError> {
        let table = self.ensure_table().await?;
        let _ = table
            .optimize(lancedb::table::OptimizeAction::Compact {
                options: lancedb::table::CompactionOptions::default(),
                remap_options: None,
            })
            .await;
        let _ = table
            .optimize(lancedb::table::OptimizeAction::Prune {
                older_than: Some(lancedb::table::Duration::zero()),
                delete_unverified: Some(true),
                error_if_tagged_old_versions: None,
            })
            .await;
        Ok(())
    }

    /// Return the number of active dataset versions in the LanceDB table
    // @implements spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-6::REQ-014
    pub async fn version_count(&self) -> Result<usize, StorageError> {
        let table = self.ensure_table().await?;
        let versions = table.list_versions().await?;
        Ok(versions.len())
    }

    /// Query total row count in persistent LanceDB table
    pub async fn count_rows(&self) -> Result<usize, StorageError> {
        let table = self.ensure_table().await?;
        let count = table.count_rows(None).await?;
        Ok(count)
    }

    /// Query nearest neighbors via LanceDB vector index
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-001
    pub async fn query_nearest_lance(
        &self,
        query_vector: &[f32],
        top_k: usize,
    ) -> Result<Vec<VectorQueryResult>, StorageError> {
        self.query_nearest_lance_filtered(query_vector, top_k, None).await
    }

    /// Query nearest neighbors via LanceDB vector index with optional project_id filter
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-1::REQ-001
    // @implements ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-6::REQ-001
    // @implements ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-6::REQ-006
    pub async fn query_nearest_lance_filtered(
        &self,
        query_vector: &[f32],
        top_k: usize,
        project_id: Option<&str>,
    ) -> Result<Vec<VectorQueryResult>, StorageError> {
        let table = self.ensure_table().await?;
        let mut q = query_vector.to_vec();
        if q.len() < 384 {
            q.resize(384, 0.0);
        } else if q.len() > 384 {
            q.truncate(384);
        }

        let mut query_builder = table
            .query()
            .nearest_to(q.as_slice())?
            .distance_type(lancedb::DistanceType::Cosine);

        if let Some(pid) = project_id {
            if !pid.is_empty() && pid != "default" {
                query_builder = query_builder.only_if(format!("project_id = '{}'", pid.replace('\'', "''")));
            }
        }

        let mut stream = query_builder
            .limit(top_k)
            .execute()
            .await?;

        let mut results = Vec::new();
        while let Some(batch) = stream.try_next().await? {
            let id_col = batch.column_by_name("id").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let dist_col = batch.column_by_name("_distance").and_then(|c| c.as_any().downcast_ref::<Float32Array>());
            let content_col = batch.column_by_name("content").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let path_col = batch.column_by_name("file_path").and_then(|c| c.as_any().downcast_ref::<StringArray>());
            let start_col = batch.column_by_name("start_line").and_then(|c| c.as_any().downcast_ref::<UInt32Array>());
            let end_col = batch.column_by_name("end_line").and_then(|c| c.as_any().downcast_ref::<UInt32Array>());
            let proj_col = batch.column_by_name("project_id").and_then(|c| c.as_any().downcast_ref::<StringArray>());

            for i in 0..batch.num_rows() {
                let id = id_col.map(|c| c.value(i).to_string()).unwrap_or_default();
                let dist = dist_col.map(|c| c.value(i)).unwrap_or(1.0);
                let score = 1.0 - (dist / 2.0).clamp(0.0, 1.0);
                let metadata = serde_json::json!({
                    "content": content_col.map(|c| c.value(i)).unwrap_or_default(),
                    "file_path": path_col.map(|c| c.value(i)).unwrap_or_default(),
                    "start_line": start_col.map(|c| c.value(i)).unwrap_or_default(),
                    "end_line": end_col.map(|c| c.value(i)).unwrap_or_default(),
                    "project_id": proj_col.map(|c| c.value(i)).unwrap_or_default(),
                });
                results.push(VectorQueryResult {
                    id,
                    score,
                    metadata,
                });
            }
        }

        results.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        results.truncate(top_k);
        Ok(results)
    }

    /// Synchronous upsert into vector store cache
    pub fn upsert_record(
        &mut self,
        id: &str,
        vector: Vec<f32>,
        metadata: serde_json::Value,
    ) -> Result<(), StorageError> {
        let mut mem = self.records.write().unwrap();
        mem.insert(
            id.to_string(),
            VectorRecord {
                id: id.to_string(),
                vector,
                metadata,
            },
        );
        Ok(())
    }

    /// Perform nearest neighbor vector similarity search over in-memory cache
    pub fn query_nearest(&self, query_vector: &[f32], top_k: usize) -> Result<Vec<VectorQueryResult>, StorageError> {
        self.query_nearest_filtered(query_vector, top_k, None)
    }

    /// Perform nearest neighbor vector similarity search over in-memory cache with optional project_id filter
    pub fn query_nearest_filtered(
        &self,
        query_vector: &[f32],
        top_k: usize,
        project_id: Option<&str>,
    ) -> Result<Vec<VectorQueryResult>, StorageError> {
        let mem = self.records.read().unwrap();
        let mut scored: Vec<VectorQueryResult> = mem
            .values()
            .filter(|rec| {
                if let Some(pid) = project_id {
                    if !pid.is_empty() && pid != "default" {
                        if let Some(rec_pid) = rec.metadata.get("project_id").and_then(|v| v.as_str()) {
                            return rec_pid == pid;
                        }
                    }
                }
                true
            })
            .map(|rec| {
                let dot: f32 = rec.vector.iter().zip(query_vector.iter()).map(|(a, b)| a * b).sum();
                let mag_a: f32 = rec.vector.iter().map(|a| a * a).sum::<f32>().sqrt();
                let mag_b: f32 = query_vector.iter().map(|b| b * b).sum::<f32>().sqrt();
                let cosine = if mag_a > 0.0 && mag_b > 0.0 {
                    dot / (mag_a * mag_b)
                } else {
                    0.0
                };
                VectorQueryResult {
                    id: rec.id.clone(),
                    score: cosine,
                    metadata: rec.metadata.clone(),
                }
            })
            .collect();

        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        scored.truncate(top_k);
        Ok(scored)
    }

    /// Return total records stored in cache
    pub fn record_count(&self) -> usize {
        self.records.read().unwrap().len()
    }

    /// Return records stored in cache for a specific project_id
    pub fn record_count_for_project(&self, project_id: &str) -> usize {
        let mem = self.records.read().unwrap();
        if project_id.is_empty() || project_id == "default" {
            return mem.len();
        }
        mem.values()
            .filter(|r| r.metadata.get("project_id").and_then(|v| v.as_str()) == Some(project_id))
            .count()
    }

    /// Return underlying storage path
    pub fn path(&self) -> &Path {
        &self.path
    }
}
