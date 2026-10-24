use std::collections::HashMap;
use serde::{Deserialize, Serialize};
use crate::chunker::EmbeddingPipeline;
use crate::error::StorageError;
use crate::manager::StorageManager;
use crate::vector::VectorQueryResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SearchScope {
    Active,
    All,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchHit {
    pub id: String,
    pub file_path: String,
    pub start_line: usize,
    pub end_line: usize,
    pub content: String,
    pub rrf_score: f32,
    pub vector_rank: Option<usize>,
    pub lexical_rank: Option<usize>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HybridQueryResult {
    pub query: String,
    pub hits: Vec<SearchHit>,
    pub vector_matches: Vec<VectorQueryResult>,
    pub graph_context: Vec<String>,
}

#[derive(Default)]
pub struct HybridQueryEngine {
    pipeline: EmbeddingPipeline,
}

impl HybridQueryEngine {
    pub fn new() -> Self {
        Self::default()
    }

    /// Perform unified hybrid search fusing dense vectors and BM25 using Reciprocal Rank Fusion (RRF)
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-3::REQ-004
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-3::REQ-008
    // @implements ft-storage-lancedb-hybrid-search::TASK-STORAGE-002-3::REQ-009
    pub async fn search(
        &self,
        storage: &StorageManager,
        query: &str,
        top_k: usize,
    ) -> Result<HybridQueryResult, StorageError> {
        let filter = if storage.project_id() == "default" {
            None
        } else {
            Some(storage.project_id())
        };
        self.search_internal(storage, query, top_k, filter).await
    }

    async fn search_internal(
        &self,
        storage: &StorageManager,
        query: &str,
        top_k: usize,
        project_filter: Option<&str>,
    ) -> Result<HybridQueryResult, StorageError> {
        let vstore = storage.vector_store().read().await;

        // 1. Dense vector nearest neighbor query via unified LanceDB table
        let query_vec = self.pipeline.embed_text(query);
        let vector_candidates = match vstore
            .query_nearest_lance_filtered(&query_vec, top_k * 4, project_filter)
            .await
        {
            Ok(res) if !res.is_empty() => res,
            _ => vstore
                .query_nearest_filtered(&query_vec, top_k * 4, project_filter)
                .unwrap_or_default(),
        };

        let mut vector_ranks: HashMap<String, usize> = HashMap::new();
        for (idx, hit) in vector_candidates.iter().enumerate() {
            vector_ranks.insert(hit.id.clone(), idx + 1);
        }

        // 2. Lexical BM25 token matching
        let query_tokens = EmbeddingPipeline::tokenize_lexical(query);
        let mut lexical_scores: Vec<(String, f32, String, String, usize, usize, Option<String>)> = Vec::new();

        // Examine candidates from vector store cache
        let all_records = vstore
            .query_nearest_filtered(&query_vec, 1000, project_filter)
            .unwrap_or_default();
        let total_docs = all_records.len().max(1);

        for rec in &all_records {
            let content = rec.metadata.get("content").and_then(|c| c.as_str()).unwrap_or("");
            let file_path = rec.metadata.get("file_path").and_then(|f| f.as_str()).unwrap_or("");
            let start_line = rec.metadata.get("start_line").and_then(|s| s.as_u64()).unwrap_or(1) as usize;
            let end_line = rec.metadata.get("end_line").and_then(|e| e.as_u64()).unwrap_or(1) as usize;
            let rec_pid = rec
                .metadata
                .get("project_id")
                .and_then(|p| p.as_str())
                .filter(|p| !p.is_empty() && *p != "default")
                .map(|p| p.to_string())
                .or_else(|| project_filter.map(|p| p.to_string()));

            let doc_tokens = EmbeddingPipeline::tokenize_lexical(content);
            let score = EmbeddingPipeline::calculate_bm25(
                &query_tokens,
                &doc_tokens,
                15.0,
                total_docs,
                query_tokens.len().max(1),
            );

            // Exact keyword bonus for requirement IDs or exact function names
            let exact_match_bonus = if query_tokens.iter().any(|q| content.to_lowercase().contains(q)) {
                2.0f32
            } else {
                0.0f32
            };

            let total_score = score + exact_match_bonus;
            if total_score > 0.0 {
                lexical_scores.push((
                    rec.id.clone(),
                    total_score,
                    file_path.to_string(),
                    content.to_string(),
                    start_line,
                    end_line,
                    rec_pid,
                ));
            }
        }

        lexical_scores.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let mut lexical_ranks: HashMap<String, usize> = HashMap::new();
        for (idx, (id, _, _, _, _, _, _)) in lexical_scores.iter().enumerate() {
            lexical_ranks.insert(id.clone(), idx + 1);
        }

        // 3. Reciprocal Rank Fusion (RRF): RRF(d) = (0.6 / (60 + r_vec)) + (0.4 / (60 + r_lex))
        let k = 60.0f32;
        let w_vec = 0.6f32;
        let w_lex = 0.4f32;

        let mut fused_map: HashMap<String, SearchHit> = HashMap::new();

        // Process vector candidates
        for hit in &vector_candidates {
            let r_vec = *vector_ranks.get(&hit.id).unwrap_or(&999);
            let r_lex = lexical_ranks.get(&hit.id).copied();

            let vec_score = w_vec / (k + r_vec as f32);
            let lex_score = r_lex.map(|r| w_lex / (k + r as f32)).unwrap_or(0.0);
            let rrf = vec_score + lex_score;

            let file_path = hit.metadata.get("file_path").and_then(|f| f.as_str()).unwrap_or("").to_string();
            let start_line = hit.metadata.get("start_line").and_then(|s| s.as_u64()).unwrap_or(1) as usize;
            let end_line = hit.metadata.get("end_line").and_then(|e| e.as_u64()).unwrap_or(1) as usize;
            let content = hit.metadata.get("content").and_then(|c| c.as_str()).unwrap_or("").to_string();
            let hit_pid = hit
                .metadata
                .get("project_id")
                .and_then(|p| p.as_str())
                .filter(|p| !p.is_empty() && *p != "default")
                .map(|p| p.to_string())
                .or_else(|| project_filter.map(|p| p.to_string()));

            fused_map.insert(
                hit.id.clone(),
                SearchHit {
                    id: hit.id.clone(),
                    file_path,
                    start_line,
                    end_line,
                    content,
                    rrf_score: rrf,
                    vector_rank: Some(r_vec),
                    lexical_rank: r_lex,
                    project_id: hit_pid,
                },
            );
        }

        // Process lexical hits not already in vector candidates
        for (id, _, file_path, content, start_line, end_line, rec_pid) in lexical_scores {
            if let std::collections::hash_map::Entry::Vacant(e) = fused_map.entry(id.clone()) {
                let r_lex = *lexical_ranks.get(&id).unwrap_or(&999);
                let lex_score = w_lex / (k + r_lex as f32);
                e.insert(SearchHit {
                    id,
                    file_path,
                    start_line,
                    end_line,
                    content,
                    rrf_score: lex_score,
                    vector_rank: None,
                    lexical_rank: Some(r_lex),
                    project_id: rec_pid,
                });
            }
        }

        let mut hits: Vec<SearchHit> = fused_map.into_values().collect();
        hits.sort_by(|a, b| b.rrf_score.partial_cmp(&a.rrf_score).unwrap_or(std::cmp::Ordering::Equal));
        hits.truncate(top_k);

        // 4. Graph context query
        let mut graph_context = Vec::new();
        let mut gstore = storage.graph_store().write().await;
        let cypher = format!(
            "MATCH (s:Symbol) WHERE s.name CONTAINS '{}' RETURN s.name",
            query.split_whitespace().next().unwrap_or("")
        );
        if let Ok(res) = gstore.execute_query(&cypher) {
            graph_context.push(res);
        }

        Ok(HybridQueryResult {
            query: query.to_string(),
            hits,
            vector_matches: vector_candidates,
            graph_context,
        })
    }

    /// Perform search across the unified workspace LanceVectorStore (filtered to active project or workspace-wide)
    // @implements ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-3::REQ-006
    // @implements ft-storage-multi-project-federation-and-telemetry::TASK-STORAGE-003-6::REQ-006
    pub async fn search_federated(
        &self,
        federation: &crate::manager::StorageFederationManager,
        query: &str,
        top_k: usize,
        scope: SearchScope,
    ) -> Result<Vec<SearchHit>, StorageError> {
        match scope {
            SearchScope::Active => {
                if let Some(active_id) = federation.get_active_project_id().await {
                    if let Some(mgr) = federation.get_project(&active_id).await {
                        let res = self
                            .search_internal(&mgr, query, top_k, Some(&active_id))
                            .await?;
                        return Ok(res.hits);
                    }
                }
                Ok(Vec::new())
            }
            SearchScope::All => {
                // Single unified LanceDB query across all projects (project_filter = None)
                let mgr_opt = match federation.get_active().await {
                    Some(m) => Some(m),
                    None => federation
                        .list_projects()
                        .await
                        .into_iter()
                        .next()
                        .map(|c| c.storage_manager),
                };
                if let Some(mgr) = mgr_opt {
                    let res = self.search_internal(&mgr, query, top_k, None).await?;
                    Ok(res.hits)
                } else {
                    Ok(Vec::new())
                }
            }
        }
    }
}
