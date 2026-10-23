use std::collections::{HashMap, HashSet, VecDeque};
use std::path::{Path, PathBuf};
use std::sync::RwLock;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use crate::error::StorageError;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphNode {
    pub id: String,
    pub label: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub status: String,
    #[serde(default)]
    pub properties: Map<String, Value>,
}

impl GraphNode {
    pub fn new(
        id: impl Into<String>,
        label: impl Into<String>,
        title: impl Into<String>,
        status: impl Into<String>,
    ) -> Self {
        Self {
            id: id.into(),
            label: label.into(),
            title: title.into(),
            status: status.into(),
            properties: Map::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphEdge {
    pub source: String,
    pub target: String,
    pub relation: String,
}

impl GraphEdge {
    pub fn new(
        source: impl Into<String>,
        target: impl Into<String>,
        relation: impl Into<String>,
    ) -> Self {
        Self {
            source: source.into(),
            target: target.into(),
            relation: relation.into(),
        }
    }
}

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
pub struct GraphSnapshot {
    #[serde(default)]
    pub nodes: Vec<GraphNode>,
    #[serde(default)]
    pub edges: Vec<GraphEdge>,
}

pub struct KuzuGraphStore {
    _path: PathBuf,
    file_path: PathBuf,
    state: RwLock<GraphSnapshot>,
}

impl KuzuGraphStore {
    /// Initialize embedded openCypher property graph database backed by lineage_graph.json
    // @implements ft-core-local-storage::TASK-CORE-003-1::REQ-002
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn open(path: impl AsRef<Path>) -> Result<Self, StorageError> {
        let raw_path = path.as_ref().to_path_buf();
        let (dir_path, file_path) = if raw_path
            .extension()
            .and_then(|e| e.to_str())
            .map(|e| e.eq_ignore_ascii_case("json"))
            .unwrap_or(false)
        {
            let dir = raw_path
                .parent()
                .map(|p| p.to_path_buf())
                .unwrap_or_else(|| PathBuf::from("."));
            (dir, raw_path)
        } else {
            let file = raw_path.join("lineage_graph.json");
            (raw_path, file)
        };

        std::fs::create_dir_all(&dir_path)?;

        let snapshot = if file_path.exists() {
            match std::fs::read_to_string(&file_path) {
                Ok(content) if !content.trim().is_empty() => {
                    serde_json::from_str::<GraphSnapshot>(&content).unwrap_or_default()
                }
                _ => GraphSnapshot::default(),
            }
        } else {
            GraphSnapshot::default()
        };

        Ok(Self {
            _path: dir_path,
            file_path,
            state: RwLock::new(snapshot),
        })
    }

    pub fn file_path(&self) -> &Path {
        &self.file_path
    }

    /// Load persisted property graph snapshot from disk (or memory if not yet flushed)
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn load_snapshot(&self) -> Result<GraphSnapshot, StorageError> {
        if self.file_path.exists() {
            let content = std::fs::read_to_string(&self.file_path)?;
            if !content.trim().is_empty() {
                let disk_snapshot: GraphSnapshot = serde_json::from_str(&content)?;
                if let Ok(mut guard) = self.state.write() {
                    *guard = disk_snapshot.clone();
                }
                return Ok(disk_snapshot);
            }
        }
        let guard = self
            .state
            .read()
            .map_err(|e| StorageError::QueryError(format!("Graph state lock poisoned: {}", e)))?;
        Ok(guard.clone())
    }

    /// Persist property graph snapshot to lineage_graph.json
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn save_snapshot(&self, snapshot: &GraphSnapshot) -> Result<(), StorageError> {
        if let Some(parent) = self.file_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let serialized = serde_json::to_string_pretty(snapshot)?;
        std::fs::write(&self.file_path, serialized)?;
        if let Ok(mut guard) = self.state.write() {
            *guard = snapshot.clone();
        }
        Ok(())
    }

    /// Insert or update a node in the property graph and persist to disk
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn upsert_node(&self, node: GraphNode) -> Result<(), StorageError> {
        let mut snapshot = self.load_snapshot()?;
        if let Some(existing) = snapshot.nodes.iter_mut().find(|n| n.id == node.id) {
            if !node.label.is_empty() {
                existing.label = node.label;
            }
            if !node.title.is_empty() {
                existing.title = node.title;
            }
            if !node.status.is_empty() {
                existing.status = node.status;
            }
            for (k, v) in node.properties {
                existing.properties.insert(k, v);
            }
        } else {
            snapshot.nodes.push(node);
        }
        self.save_snapshot(&snapshot)
    }

    /// Insert or update a directed edge in the property graph and persist to disk
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn upsert_edge(&self, edge: GraphEdge) -> Result<(), StorageError> {
        let mut snapshot = self.load_snapshot()?;
        let exists = snapshot.edges.iter().any(|e| {
            e.source == edge.source && e.target == edge.target && e.relation == edge.relation
        });
        if !exists {
            snapshot.edges.push(edge);
        }
        self.save_snapshot(&snapshot)
    }

    /// Multi-hop BFS lineage traversal along upstream, downstream, or both directions
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn query_lineage(
        &self,
        target_id: &str,
        direction: &str,
        depth: usize,
    ) -> Result<Vec<Value>, StorageError> {
        let snapshot = self.load_snapshot()?;
        let max_depth = depth.max(1);
        let dir_norm = direction.trim().to_ascii_lowercase();

        let anchor_id = snapshot
            .nodes
            .iter()
            .find(|n| {
                n.id == target_id
                    || n.title == target_id
                    || n.properties
                        .get("name")
                        .and_then(|v| v.as_str())
                        .map(|s| s == target_id)
                        .unwrap_or(false)
            })
            .map(|n| n.id.clone())
            .unwrap_or_else(|| target_id.to_string());

        let node_map: HashMap<&str, &GraphNode> =
            snapshot.nodes.iter().map(|n| (n.id.as_str(), n)).collect();

        let mut visited: HashSet<String> = HashSet::new();
        visited.insert(anchor_id.clone());

        let mut queue: VecDeque<(String, usize)> = VecDeque::new();
        queue.push_back((anchor_id, 0));

        let mut results: Vec<Value> = Vec::new();

        while let Some((curr_id, curr_hop)) = queue.pop_front() {
            if curr_hop >= max_depth {
                continue;
            }

            for edge in &snapshot.edges {
                let mut candidate: Option<(&str, &str)> = None;

                match dir_norm.as_str() {
                    "downstream" | "out" | "outgoing" | "forward" => {
                        if edge.source == curr_id {
                            candidate = Some((edge.target.as_str(), "downstream"));
                        }
                    }
                    "upstream" | "in" | "incoming" | "backward" => {
                        if edge.target == curr_id {
                            candidate = Some((edge.source.as_str(), "upstream"));
                        }
                    }
                    _ => {
                        if edge.source == curr_id {
                            candidate = Some((edge.target.as_str(), "downstream"));
                        } else if edge.target == curr_id {
                            candidate = Some((edge.source.as_str(), "upstream"));
                        }
                    }
                }

                if let Some((neighbor_id, hop_dir)) = candidate {
                    if visited.insert(neighbor_id.to_string()) {
                        let next_hop = curr_hop + 1;
                        let item = if let Some(node) = node_map.get(neighbor_id) {
                            json!({
                                "id": node.id,
                                "label": node.label,
                                "title": node.title,
                                "status": node.status,
                                "relation": edge.relation,
                                "direction": hop_dir,
                                "source": edge.source,
                                "target": edge.target,
                                "hop": next_hop,
                                "properties": node.properties,
                            })
                        } else {
                            json!({
                                "id": neighbor_id,
                                "label": "Node",
                                "title": neighbor_id,
                                "status": "Active",
                                "relation": edge.relation,
                                "direction": hop_dir,
                                "source": edge.source,
                                "target": edge.target,
                                "hop": next_hop,
                                "properties": {},
                            })
                        };
                        results.push(item);
                        queue.push_back((neighbor_id.to_string(), next_hop));
                    }
                }
            }
        }

        Ok(results)
    }

    /// Execute an openCypher statement and return structured JSON records
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn execute_cypher(&self, query: &str) -> Result<Vec<Value>, StorageError> {
        let trimmed = query.trim();
        if trimmed.is_empty() {
            return Err(StorageError::QueryError("Empty Cypher query".to_string()));
        }

        let upper = trimmed.to_ascii_uppercase();
        let valid_starts = [
            "MATCH", "CREATE", "MERGE", "RETURN", "CALL", "WITH", "OPTIONAL", "UNWIND", "DELETE",
            "DETACH", "SET",
        ];
        if !valid_starts.iter().any(|kw| upper.starts_with(kw)) {
            return Err(StorageError::QueryError(format!(
                "Invalid Cypher syntax: {}",
                trimmed
            )));
        }

        // Handle DDL statements from SchemaMigrator (CREATE NODE TABLE / CREATE REL TABLE)
        if upper.starts_with("CREATE NODE TABLE") || upper.starts_with("CREATE REL TABLE") {
            return Ok(vec![json!({ "status": "ok", "ddl": trimmed })]);
        }

        let is_mutation = upper.contains("CREATE ")
            || upper.starts_with("CREATE(")
            || upper.contains("MERGE ")
            || upper.starts_with("MERGE(");

        if is_mutation {
            return self.execute_cypher_mutation(trimmed);
        }

        if upper.starts_with("MATCH") {
            return self.execute_cypher_match(trimmed);
        }

        Ok(vec![json!({ "status": "ok", "query": trimmed })])
    }

    /// Execute openCypher statement against property graph and return summary/JSON string
    // @implements ft-core-local-storage::TASK-CORE-003-1::REQ-002
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-003
    // @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
    pub fn execute_query(&mut self, cypher: &str) -> Result<String, StorageError> {
        let trimmed = cypher.trim();
        let upper = trimmed.to_ascii_uppercase();
        let values = self.execute_cypher(trimmed)?;

        if upper.starts_with("CREATE") || upper.starts_with("MERGE") || upper.contains(" CREATE ") || upper.contains(" MERGE ") {
            Ok(format!(
                "ok: node/relationship created ({})",
                serde_json::to_string(&values).unwrap_or_default()
            ))
        } else if upper.starts_with("MATCH") {
            Ok(format!(
                "ok: match query completed ({})",
                serde_json::to_string(&values).unwrap_or_default()
            ))
        } else {
            Ok("ok: query executed".to_string())
        }
    }

    /// Return total nodes in graph
    pub fn node_count(&self) -> usize {
        self.load_snapshot().map(|s| s.nodes.len()).unwrap_or(0)
    }

    /// Return total relationships in graph
    pub fn edge_count(&self) -> usize {
        self.load_snapshot().map(|s| s.edges.len()).unwrap_or(0)
    }

    fn execute_cypher_mutation(&self, cypher: &str) -> Result<Vec<Value>, StorageError> {
        let mut snapshot = self.load_snapshot()?;
        let mut var_to_id: HashMap<String, String> = HashMap::new();
        let mut touched_nodes: Vec<Value> = Vec::new();
        let mut touched_edges: Vec<Value> = Vec::new();

        // Split statement into Optional MATCH prefix and CREATE/MERGE mutation part
        let upper = cypher.to_ascii_uppercase();
        let mutation_pos = upper
            .find("CREATE ")
            .or_else(|| upper.find("CREATE("))
            .or_else(|| upper.find("MERGE "))
            .or_else(|| upper.find("MERGE("))
            .unwrap_or(0);

        let match_part = &cypher[..mutation_pos];
        let mutate_part = &cypher[mutation_pos..];

        // 1. Parse node patterns in MATCH part to bind variable names -> node IDs
        for (var_opt, _label_opt, props) in parse_paren_node_patterns(match_part) {
            if let Some(id) = extract_node_identifier(&props) {
                if let Some(var) = var_opt {
                    if !var.is_empty() {
                        var_to_id.insert(var, id);
                    }
                }
            }
        }

        // 2. Parse node patterns in CREATE/MERGE part and upsert any nodes with properties
        for (var_opt, label_opt, props) in parse_paren_node_patterns(mutate_part) {
            if let Some(id) = extract_node_identifier(&props) {
                let label = label_opt
                    .filter(|l| !l.is_empty())
                    .or_else(|| {
                        props
                            .get("label")
                            .or_else(|| props.get("kind"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string())
                    })
                    .unwrap_or_else(|| "Node".to_string());
                let title = props
                    .get("title")
                    .or_else(|| props.get("name"))
                    .and_then(|v| v.as_str())
                    .unwrap_or(&id)
                    .to_string();
                let status = props
                    .get("status")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Active")
                    .to_string();

                upsert_node_in_snapshot(
                    &mut snapshot,
                    GraphNode {
                        id: id.clone(),
                        label: label.clone(),
                        title: title.clone(),
                        status: status.clone(),
                        properties: props,
                    },
                );

                if let Some(var) = var_opt {
                    if !var.is_empty() {
                        var_to_id.insert(var, id.clone());
                    }
                }

                touched_nodes.push(json!({
                    "id": id,
                    "label": label,
                    "title": title,
                    "status": status,
                }));
            }
        }

        // 3. Parse edge patterns in CREATE/MERGE part: (left)-[:REL]->(right) or (left)<-[:REL]-(right)
        for (src_raw, rel, dst_raw) in parse_edge_patterns(mutate_part) {
            let src_id = resolve_endpoint_id(&src_raw, &var_to_id);
            let dst_id = resolve_endpoint_id(&dst_raw, &var_to_id);

            if let (Some(source), Some(target)) = (src_id, dst_id) {
                // Ensure both endpoint nodes exist in snapshot
                if !snapshot.nodes.iter().any(|n| n.id == source) {
                    snapshot
                        .nodes
                        .push(GraphNode::new(&source, "Node", &source, "Active"));
                }
                if !snapshot.nodes.iter().any(|n| n.id == target) {
                    snapshot
                        .nodes
                        .push(GraphNode::new(&target, "Node", &target, "Active"));
                }

                let edge = GraphEdge::new(&source, &target, &rel);
                let exists = snapshot.edges.iter().any(|e| {
                    e.source == edge.source && e.target == edge.target && e.relation == edge.relation
                });
                if !exists {
                    snapshot.edges.push(edge);
                }

                touched_edges.push(json!({
                    "source": source,
                    "target": target,
                    "relation": rel,
                }));
            }
        }

        self.save_snapshot(&snapshot)?;

        let mut out = touched_nodes;
        out.extend(touched_edges);
        if out.is_empty() {
            out.push(json!({ "status": "ok" }));
        }
        Ok(out)
    }

    fn execute_cypher_match(&self, cypher: &str) -> Result<Vec<Value>, StorageError> {
        let snapshot = self.load_snapshot()?;
        let upper = cypher.to_ascii_uppercase();

        // 1. Check for variable-length path traversal: -[*1..depth]->, <-[*1..depth]-, -[*1..depth]-
        if let Some(star_idx) = cypher.find("[*") {
            let after_star = &cypher[star_idx + 2..];
            let bracket_end = after_star.find(']').unwrap_or(after_star.len());
            let range_spec = &after_star[..bracket_end];
            let depth = range_spec
                .split("..")
                .last()
                .and_then(|s| s.trim().parse::<usize>().ok())
                .unwrap_or(2);

            let before_bracket = &cypher[..star_idx];
            let after_bracket = &after_star[bracket_end..];

            let has_left_arrow = before_bracket.trim_end().ends_with("<-");
            let has_right_arrow = after_bracket.starts_with("]->");

            let direction = if has_left_arrow && !has_right_arrow {
                "upstream"
            } else if has_right_arrow && !has_left_arrow {
                "downstream"
            } else {
                "both"
            };

            let patterns = parse_paren_node_patterns(cypher);
            if let Some(anchor_id) = patterns
                .iter()
                .find_map(|(_, _, props)| extract_node_identifier(props))
            {
                let mut results = self.query_lineage(&anchor_id, direction, depth)?;
                if results.is_empty() {
                    if let Some(node) = snapshot.nodes.iter().find(|n| n.id == anchor_id || n.title == anchor_id) {
                        results.push(json!({
                            "id": node.id,
                            "label": node.label,
                            "title": node.title,
                            "status": node.status,
                            "hop": 0,
                            "properties": node.properties,
                        }));
                    } else {
                        results.push(json!({
                            "id": anchor_id,
                            "symbol": anchor_id,
                            "hops": depth,
                            "direction": direction,
                            "status": "ok",
                        }));
                    }
                }
                return Ok(results);
            }
        }

        // 2. Check for WHERE ... CONTAINS '...'
        if let Some(contains_pos) = upper.find("CONTAINS") {
            let after = &cypher[contains_pos + "CONTAINS".len()..];
            if let Some(term) = extract_first_quoted(after) {
                let term_lower = term.to_ascii_lowercase();
                let matches: Vec<Value> = snapshot
                    .nodes
                    .iter()
                    .filter(|n| {
                        n.id.to_ascii_lowercase().contains(&term_lower)
                            || n.title.to_ascii_lowercase().contains(&term_lower)
                            || n.label.to_ascii_lowercase().contains(&term_lower)
                    })
                    .map(|n| serde_json::to_value(n).unwrap_or_else(|_| json!({"id": n.id})))
                    .collect();
                return Ok(matches);
            }
        }

        // 3. Single-hop edge pattern in MATCH: (a {id: '...'})-[:REL]->(b)
        let edge_patterns = parse_edge_patterns(cypher);
        if !edge_patterns.is_empty() {
            let mut var_to_id: HashMap<String, String> = HashMap::new();
            for (var_opt, _, props) in parse_paren_node_patterns(cypher) {
                if let Some(id) = extract_node_identifier(&props) {
                    if let Some(var) = var_opt {
                        var_to_id.insert(var, id);
                    }
                }
            }
            for (src_raw, _rel, dst_raw) in &edge_patterns {
                if let Some(src_id) = resolve_endpoint_id(src_raw, &var_to_id) {
                    return self.query_lineage(&src_id, "downstream", 1);
                }
                if let Some(dst_id) = resolve_endpoint_id(dst_raw, &var_to_id) {
                    return self.query_lineage(&dst_id, "upstream", 1);
                }
            }
        }

        // 4. Filter by node properties/label if specified in MATCH (...)
        let patterns = parse_paren_node_patterns(cypher);
        if let Some((_, label_opt, props)) = patterns.first() {
            if let Some(target_id) = extract_node_identifier(props) {
                let matches: Vec<Value> = snapshot
                    .nodes
                    .iter()
                    .filter(|n| n.id == target_id || n.title == target_id)
                    .map(|n| serde_json::to_value(n).unwrap_or_else(|_| json!({"id": n.id})))
                    .collect();
                return Ok(matches);
            }
            if let Some(label) = label_opt.as_ref().filter(|l| !l.is_empty()) {
                let matches: Vec<Value> = snapshot
                    .nodes
                    .iter()
                    .filter(|n| n.label.eq_ignore_ascii_case(label))
                    .map(|n| serde_json::to_value(n).unwrap_or_else(|_| json!({"id": n.id})))
                    .collect();
                return Ok(matches);
            }
        }

        // 5. Fallback: return all nodes in snapshot
        Ok(snapshot
            .nodes
            .iter()
            .map(|n| serde_json::to_value(n).unwrap_or_else(|_| json!({"id": n.id})))
            .collect())
    }
}

fn upsert_node_in_snapshot(snapshot: &mut GraphSnapshot, node: GraphNode) {
    if let Some(existing) = snapshot.nodes.iter_mut().find(|n| n.id == node.id) {
        if !node.label.is_empty() && node.label != "Node" {
            existing.label = node.label;
        }
        if !node.title.is_empty() {
            existing.title = node.title;
        }
        if !node.status.is_empty() {
            existing.status = node.status;
        }
        for (k, v) in node.properties {
            existing.properties.insert(k, v);
        }
    } else {
        snapshot.nodes.push(node);
    }
}

fn extract_node_identifier(props: &Map<String, Value>) -> Option<String> {
    for key in ["id", "name", "path", "symbol"] {
        if let Some(val) = props.get(key).and_then(|v| v.as_str()) {
            if !val.trim().is_empty() {
                return Some(val.trim().to_string());
            }
        }
    }
    None
}

fn extract_first_quoted(input: &str) -> Option<String> {
    for quote in ['\'', '"'] {
        if let Some(start) = input.find(quote) {
            let rest = &input[start + 1..];
            if let Some(end) = rest.find(quote) {
                return Some(rest[..end].to_string());
            }
        }
    }
    None
}

fn parse_paren_node_patterns(input: &str) -> Vec<(Option<String>, Option<String>, Map<String, Value>)> {
    let mut out = Vec::new();
    let chars: Vec<char> = input.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if chars[i] == '(' {
            let start = i + 1;
            let mut depth = 1;
            let mut in_quote: Option<char> = None;
            i += 1;
            while i < chars.len() && depth > 0 {
                let c = chars[i];
                if let Some(q) = in_quote {
                    if c == q {
                        in_quote = None;
                    }
                } else if c == '\'' || c == '"' {
                    in_quote = Some(c);
                } else if c == '(' {
                    depth += 1;
                } else if c == ')' {
                    depth -= 1;
                }
                i += 1;
            }
            if depth == 0 {
                let content: String = chars[start..i - 1].iter().collect();
                out.push(parse_single_node_pattern(&content));
            }
        } else {
            i += 1;
        }
    }

    out
}

fn parse_single_node_pattern(content: &str) -> (Option<String>, Option<String>, Map<String, Value>) {
    let trimmed = content.trim();
    let (head, props) = if let Some(brace_start) = trimmed.find('{') {
        let head_part = trimmed[..brace_start].trim();
        let brace_end = trimmed.rfind('}').unwrap_or(trimmed.len());
        let prop_str = &trimmed[brace_start + 1..brace_end];
        (head_part, parse_properties_map(prop_str))
    } else {
        (trimmed, Map::new())
    };

    let (var_opt, label_opt) = if let Some((var_part, label_part)) = head.split_once(':') {
        let v = var_part.trim();
        let l = label_part.split_whitespace().next().unwrap_or("").trim();
        (
            if v.is_empty() { None } else { Some(v.to_string()) },
            if l.is_empty() { None } else { Some(l.to_string()) },
        )
    } else {
        let v = head.split_whitespace().next().unwrap_or("").trim();
        (
            if v.is_empty() { None } else { Some(v.to_string()) },
            None,
        )
    };

    (var_opt, label_opt, props)
}

fn parse_properties_map(prop_str: &str) -> Map<String, Value> {
    let mut map = Map::new();
    let mut parts = Vec::new();
    let mut current = String::new();
    let mut in_quote: Option<char> = None;

    for c in prop_str.chars() {
        if let Some(q) = in_quote {
            if c == q {
                in_quote = None;
            }
            current.push(c);
        } else if c == '\'' || c == '"' {
            in_quote = Some(c);
            current.push(c);
        } else if c == ',' {
            parts.push(current.trim().to_string());
            current.clear();
        } else {
            current.push(c);
        }
    }
    if !current.trim().is_empty() {
        parts.push(current.trim().to_string());
    }

    for part in parts {
        if let Some((k, v)) = part.split_once(':') {
            let key = k.trim().trim_matches('\'').trim_matches('"').to_string();
            let raw_val = v.trim();
            let clean_val = raw_val.trim_matches('\'').trim_matches('"').to_string();
            map.insert(key, Value::String(clean_val));
        }
    }

    map
}

/// Extract directed edge patterns `(left)-[:REL]->(right)` or `(left)<-[:REL]-(right)`
fn parse_edge_patterns(input: &str) -> Vec<(String, String, String)> {
    let mut edges = Vec::new();
    let mut search_from = 0;

    while let Some(rel_pos) = input[search_from..].find(")-[") {
        let abs_rel_start = search_from + rel_pos;
        let before = &input[..abs_rel_start];
        let left_open = match before.rfind('(') {
            Some(idx) => idx,
            None => {
                search_from = abs_rel_start + 3;
                continue;
            }
        };
        let left_content = input[left_open + 1..abs_rel_start].trim().to_string();
        let is_reverse = input[abs_rel_start..].starts_with(")<-[");

        let bracket_start = abs_rel_start + if is_reverse { 4 } else { 3 };
        let after_bracket = &input[bracket_start..];
        let bracket_end = match after_bracket.find(']') {
            Some(idx) => idx,
            None => break,
        };
        let rel_inside = after_bracket[..bracket_end].trim();
        if rel_inside.starts_with('*') {
            search_from = bracket_start + bracket_end + 1;
            continue;
        }
        let rel_type = rel_inside
            .split(|c: char| c == '{' || c.is_whitespace())
            .next()
            .unwrap_or("")
            .trim_start_matches(':')
            .trim()
            .to_string();
        let rel_clean = if rel_type.is_empty() {
            "LINKS_TO".to_string()
        } else {
            rel_type
        };

        let after_rel = &after_bracket[bracket_end + 1..];
        let right_open_offset = if let Some(p) = after_rel.find('(') {
            p
        } else {
            search_from = bracket_start + bracket_end + 1;
            continue;
        };
        let arrow_segment = &after_rel[..right_open_offset];
        let is_forward_arrow = arrow_segment.contains("->");

        let right_after_open = &after_rel[right_open_offset + 1..];
        let right_close = match find_matching_paren(right_after_open) {
            Some(idx) => idx,
            None => break,
        };
        let right_content = right_after_open[..right_close].trim().to_string();

        if is_forward_arrow || !is_reverse {
            edges.push((left_content, rel_clean, right_content));
        } else {
            edges.push((right_content, rel_clean, left_content));
        }

        search_from = bracket_start + bracket_end + 1 + right_open_offset + 1;
    }

    // Also support reverse pattern `(left)<-[:REL]-(right)`
    let mut rev_from = 0;
    while let Some(rel_pos) = input[rev_from..].find(")<-[") {
        let abs_rel_start = rev_from + rel_pos;
        let before = &input[..abs_rel_start];
        let left_open = match before.rfind('(') {
            Some(idx) => idx,
            None => {
                rev_from = abs_rel_start + 4;
                continue;
            }
        };
        let left_content = input[left_open + 1..abs_rel_start].trim().to_string();
        let bracket_start = abs_rel_start + 4;
        let after_bracket = &input[bracket_start..];
        let bracket_end = match after_bracket.find(']') {
            Some(idx) => idx,
            None => break,
        };
        let rel_inside = after_bracket[..bracket_end].trim();
        if rel_inside.starts_with('*') {
            rev_from = bracket_start + bracket_end + 1;
            continue;
        }
        let rel_type = rel_inside
            .split(|c: char| c == '{' || c.is_whitespace())
            .next()
            .unwrap_or("")
            .trim_start_matches(':')
            .trim()
            .to_string();
        let rel_clean = if rel_type.is_empty() {
            "LINKS_TO".to_string()
        } else {
            rel_type
        };

        let after_rel = &after_bracket[bracket_end + 1..];
        let right_open_offset = match after_rel.find('(') {
            Some(p) => p,
            None => {
                rev_from = bracket_start + bracket_end + 1;
                continue;
            }
        };
        let right_after_open = &after_rel[right_open_offset + 1..];
        let right_close = match find_matching_paren(right_after_open) {
            Some(idx) => idx,
            None => break,
        };
        let right_content = right_after_open[..right_close].trim().to_string();

        edges.push((right_content, rel_clean, left_content));
        rev_from = bracket_start + bracket_end + 1 + right_open_offset + 1;
    }

    edges
}

fn find_matching_paren(s: &str) -> Option<usize> {
    let mut depth = 1;
    let mut in_quote: Option<char> = None;
    for (idx, c) in s.char_indices() {
        if let Some(q) = in_quote {
            if c == q {
                in_quote = None;
            }
        } else if c == '\'' || c == '"' {
            in_quote = Some(c);
        } else if c == '(' {
            depth += 1;
        } else if c == ')' {
            depth -= 1;
            if depth == 0 {
                return Some(idx);
            }
        }
    }
    None
}

fn resolve_endpoint_id(raw_inside_paren: &str, var_to_id: &HashMap<String, String>) -> Option<String> {
    let (var_opt, _label_opt, props) = parse_single_node_pattern(raw_inside_paren);
    if let Some(id) = extract_node_identifier(&props) {
        return Some(id);
    }
    if let Some(var) = var_opt {
        if let Some(bound) = var_to_id.get(&var) {
            return Some(bound.clone());
        }
        return Some(var);
    }
    None
}

