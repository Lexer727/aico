System Blueprint: Local Spec-Driven AI Co-Development Environment

1. System Concept & Architectural Positioning

This platform is a local-first, zero-daemon desktop engineering environment (built with Tauri / Rust + React/TypeScript) designed to execute Spec-Driven Development (SDD) using deterministic verification loops.

Core Rules:

* Zero Host Daemon Overhead: No Docker containers, JVM services, or background network port bindings (no Elasticsearch, no external Postgres). Everything operates in-process via embedded libraries directly inside the application binary.
* Separation of Concerns: Text retrieval and deep multi-hop graph lineage are decoupled into specialized embedded engines.
* Deterministic Tool Gates: LLMs and CLI agents are strictly barred from generating raw file paths, fabricating IDs, or mutating relationship graphs via plain text. All structural side effects pass through typed Model Context Protocol (MCP) tool gates.

---

2. Storage & Engine Architecture

Dual Embedded Storage Topology:

```
                              Desktop Application
                 (Tauri / Rust Backend + React / WebGL UI)
                                     │
                 ┌───────────────────┴───────────────────┐
                 ▼                                       ▼
       1. Hybrid Search Layer                  2. Relational Graph Layer
             (LanceDB)                                  (Kùzu)
   ┌───────────────────────────┐           ┌───────────────────────────┐
   │ • Embedded columnar store │           │ • Embedded property graph │
   │ • BM25 inverted index     │           │ • Native openCypher       │
   │ • Disk-backed IVF-PQ ANN  │           │ • Columnar CSR storage    │
   │ • Built-in RRF score fuse │           │ • Sub-10ms N-hop paths    │
   │ • Chunks: specs, code,    │           │ • Nodes: Spec, Module,    │
   │   brainstorm docs, plans  │           │   Function, Test, Artifact│
   └─────────────▲─────────────┘           └─────────────▲─────────────┘
                 │                                       │
                 └───────────────────┬───────────────────┘
                                     │
                         Local Tree-sitter Watcher
                         & Embedding Pipeline (ONNX)

```

Engine Specifications:

```yaml
storage_engines:
  search_layer:
    engine: "LanceDB"
    mode: "In-process (Apache Arrow / Rust)"
    index_types:
      lexical: "BM25 inverted index"
      vector: "Disk-backed IVF-PQ Approximate Nearest Neighbor"
    scoring: "Built-in Reciprocal Rank Fusion (RRF)"
    license: "Apache 2.0 (Permissive commercial use)"
    target_data:
      - "Brainstorming notes"
      - "EARS specifications"
      - "Architecture deep-dives"
      - "AST-derived code chunks"

  graph_layer:
    engine: "Kùzu"
    mode: "In-process (C++ / Rust)"
    query_interface: "openCypher"
    storage_model: "Columnar Compressed Sparse Row (CSR)"
    traversal_performance: "<10ms for 3-6 hop dependency walks"
    license: "MIT (Permissive commercial use)"
    graph_schema:
      node_labels:
        - "Brainstorm"
        - "Spec"
        - "Requirement"
        - "Module"
        - "CodeSymbol"
        - "Test"
      relationship_types:
        - "DERIVED_FROM"
        - "IMPLEMENTS"
        - "CALLS"
        - "IMPORTS"
        - "VERIFIES"

  vector_embedding:
    engine: "ONNX Runtime"
    execution_target: "Local CPU (AVX2 / NEON acceleration)"
    default_model: "bge-small-en-v1.5 (int8 quantized)"
    vector_dimension: 384
    latency_profile: "<5ms per search query"
    cloud_fallback_optional: true

```

---

3. Deterministic Ingestion & AST Graph Pipeline

A background AST watcher continuously parses changes upon file save to prevent graph and index drift without requiring manual registry files.

```
[File Saved: *.ts / *.rs / *.py / *.md]
               │
               ▼
   [Local Tree-sitter Watcher]
   Extracts AST symbols, calls, imports, and doc-tags (<10ms)
               │
       ┌───────┴────────────────────────┐
       ▼                                ▼
[Update Kùzu Graph]             [Update LanceDB Index]
• MERGE (c:CodeSymbol)          • AST-aware chunking
• MERGE (c)-[:IMPLEMENTS]->(s)  • Local ONNX vector embedding
• MERGE (c)-[:CALLS]->(target)  • Upsert BM25 & vector index

```

Code Tagging Schema:

```yaml
in_band_annotations:
  implementation_link:
    syntax_ts_rust: "// @implements SPEC-AUTH-001::REQ-042"
    syntax_python: "# @implements SPEC-AUTH-001::REQ-042"
    parser_action: "Creates (CodeSymbol)-[:IMPLEMENTS]->(Requirement) edge in Kùzu"

  verification_link:
    syntax_ts_rust: "// @verifies SPEC-AUTH-001::REQ-042"
    syntax_python: "# @verifies SPEC-AUTH-001::REQ-042"
    parser_action: "Creates (Test)-[:VERIFIES]->(Requirement) edge in Kùzu"

  spec_provenance:
    format: "YAML Frontmatter in Markdown"
    example: |
      ---
      id: SPEC-AUTH-001
      type: module-spec
      derives_from: [BRAIN-AUTH-SESSION]
      ---
    parser_action: "Creates (Spec)-[:DERIVED_FROM]->(Brainstorm) edge in Kùzu"

```

---

4. Unified Skills System & Execution Model

The environment maintains a single, standardized set of skills conforming to the open Agent Skills format (`SKILL.md`). Rather than adopting bulky frameworks like BMAD or Superpowers, the IDE uses thin custom skills pairing **SpecKit/EARS grammar** directly with **local MCP tool gates**.

Skill Distribution Flow:

```
                         Canonical Project Skills
                            (.agents/skills/)
                                    │
              ┌─────────────────────┼─────────────────────┐
              ▼                     ▼                     ▼
       Claude Code           Antigravity CLI        Direct API Loop
  (.claude/skills/ symlink)  (.agents/skills/)   (Injected into Prompt)

```

The 7 Core SDD Skills:

```yaml
sdd_skills:
  - name: "brainstorm"
    role: "Problem exploration and trade-off analysis"
    actions: "Queries LanceDB for existing architectural rules; generates candidate approaches."

  - name: "deep-dive"
    role: "System boundary and blast-radius analysis"
    actions: "Executes Kùzu graph walks to locate all transitive callers and dependents."

  - name: "spec-creation"
    role: "Contract synthesis"
    actions: "Drafts formal EARS criteria with strict out-of-scope boundaries; invokes MCP tool gates."

  - name: "planning"
    role: "Task breakdown"
    actions: "Decomposes specs into dependency-ordered work units mapped directly to requirement IDs."

  - name: "test-scaffolding"
    role: "Red-to-Green contract generation"
    actions: "Generates behavioral and contract tests with @verifies tags before code is written."

  - name: "implementation"
    role: "Deterministic code generation"
    actions: "Writes source to make tests pass; attaches @implements tags; executes local test runner."

  - name: "review-loop"
    role: "Adversarial verification"
    actions: "Compares git diffs against spec requirements; checks for scope creep; enforces linter passing."

```

Deterministic Tool Gates (MCP):

```yaml
mcp_tool_gate:
  tool_name: "create_sdd_artifact"
  description: "Enforces deterministic file paths and graph linkages for new documents"
  parameters:
    artifact_type: "enum [brainstorm, spec, plan, deep_dive]"
    domain: "string (e.g., auth, billing, telemetry)"
    slug: "string (kebab-case identifier)"
    derives_from_ids: "list[string] (parent document IDs)"
    title: "string"
    content_body: "string"
  app_side_effects:
    1_path_resolution: "Calculates path deterministically (e.g., specs/{domain}/SPEC-{seq}-{slug}.md)"
    2_frontmatter_injection: "Generates immutable UUID, timestamps, and parent references"
    3_atomic_write: "Writes file to disk"
    4_graph_commit: "Executes Cypher: MERGE (s:Spec)-[:DERIVED_FROM]->(p:Brainstorm)"
    5_search_indexing: "Chunks content and generates ONNX embeddings into LanceDB"

```

---

5. Search Interface & Visual Lineage UX

The user experience coordinates text retrieval with dynamic graph inspection in an integrated view.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 🔍 Cmd+K: validateSession                                       [Scope: All]│
├─────────────────────────────────────┬───────────────────────────────────────┤
│ Text & Semantic Hits (LanceDB)      │ Relational Lineage Canvas (Kùzu)      │
│                                     │                                       │
│ [Code] validateSession()            │   [Brainstorm: Session Architecture]  │
│   src/auth/session.ts               │                 │                     │
│   "Validates JWT token and..."      │                 ▼                     │
│                                     │      [Spec 1: Auth Lifecycles]        │
│ [Spec] SPEC-001: REQ-AUTH-03        │                 │                     │
│   specs/auth/lifecycle.md           │                 ▼ (implements)        │
│   "Tokens must validate expiry..."  │       ★ validateSession()             │
│                                     │         ▲              ▲              │
│ [Code] useAuthClient()              │  (calls)│              │(imports)     │
│   packages/client/api.ts            │   [Tool: SDK]     [AppView.tsx]       │
└─────────────────────────────────────┴───────────────────────────────────────┘

```

Interaction Model:

* Global Omnibar: Accessible via `Cmd+K`. Dispatches hybrid queries (BM25 + Dense Vector RRF) across LanceDB. Supports prefix scopes like `@specs`, `@code`, `@brainstorm`, and `@plans`.
* Upstream Traversal: Selecting any node shows the structural rationale (tracing a function back through its implementing requirement to the original brainstorm).
* Downstream Blast Radius: Traces all forward dependencies (which modules call the function, what frontend views consume it, and which unit/integration tests verify it).
* Subgraph Agent Context: When an agent is prompted to refactor or implement code, the desktop app executes a 2-to-4-hop Cypher traversal in Kùzu to bundle the exact structural subgraph alongside top LanceDB text chunks, providing a clean, hallucination-resistant context payload.