# System Blueprint: Local Spec-Driven AI Co-Development Environment (AICO)

## 1. System Concept & Architectural Positioning

AICO is a local-first, zero-daemon engineering environment and development platform designed to execute Spec-Driven Development (SDD) through deterministic verification loops.

### Core Architectural Principles:
* **Zero External Host Daemons**: No Docker containers, JVM runtimes, Node.js daemons, or background databases (no Elasticsearch, no Postgres). Everything operates in-process via embedded libraries inside a single compiled binary (`aico`).
* **Headless Core with Universal Web UI**: The Rust backend (powered by `axum`) serves an embedded, responsive WebUI accessible from any desktop browser (Chrome, Firefox, Edge) with multi-tab and multi-window concurrency, and directly from mobile devices over the local Wi-Fi/LAN.
* **Separation of Concerns**: Fast lexical/vector text retrieval and deep multi-hop graph lineage are decoupled into specialized embedded engines (LanceDB and Kùzu).
* **Deterministic Tool Gates**: LLMs and agent loops never execute raw shell strings or fabricate unverified file paths. All actions pass through typed Model Context Protocol (MCP) tool gates with an enforced 3-tier security policy.
* **Triple Repository Decoupling**: The AICO runtime, target implementation codebases, and all SDD specifications reside in strictly decoupled Git repositories.

---

## 2. Repository & Workspace Topology

AICO enforces physical folder and Git repository isolation between the engine, codebases, and specification knowledge bases:

```
[Host Machine Filesystem]
├── d:/dev/aico/                      # 1. AICO Engine Repository (Runtime, skills, core binary)
│
├── d:/dev/codebase/                  # 2. Codebase Root (Independent Git Repositories)
│   ├── project-a/                    #    • Project A implementation (clean Git repo)
│   └── project-b/                    #    • Project B implementation (clean Git repo)
│
└── d:/dev/aico-specs/                # 3. Dedicated AICO-Specs Git Repository
    ├── project-a/
    │   ├── GLOSSARY.md               #    • Project ubiquitous language
    │   ├── adr/                      #    • Project architectural decisions (ADR-0001...)
    │   └── initiatives/
    │       ├── 001-web-platform/     #    • Initiative Container (Composite Epic)
    │       │   ├── BRAIN-platform.md #      - Shared Brainstorm (big idea & trade-offs)
    │       │   ├── adr/              #      - Initiative-specific ADRs
    │       │   └── specs/
    │       │       ├── 01-api-srv/   #      - Child Spec: Webserver API
    │       │       │   ├── DEEP.md   #        * Deep Dive (API blast radius)
    │       │       │   ├── SPEC.md   #        * EARS Contract (REQ-001..010)
    │       │       │   └── PLAN.md   #        * Task DAG
    │       │       └── 02-web-ui/    #      - Child Spec: WebUI Frontend
    │       │           ├── DEEP.md   #        * Deep Dive (UI blast radius)
    │       │           ├── SPEC.md   #        * EARS Contract (REQ-011..020)
    │       │           └── PLAN.md   #        * Task DAG
    │       └── 002-csv-export/       #    • Initiative Container (Simple Single Feature)
    │           ├── BRAIN-export.md
    │           ├── DEEP-export.md
    │           ├── SPEC-export.md
    │           └── PLAN-export.md
    └── project-b/
        └── ...
```

---

## 3. Storage & Embedded Engine Architecture

Dual Embedded Storage Topology:

```
                                    AICO Binary
                         (Rust Axum Host Runtime Core)
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
    │ • Chunks: specs, code,    │           │ • Nodes: Initiative, Spec,│
    │   brainstorms, plans      │           │   Module, Symbol, Test    │
    └─────────────▲─────────────┘           └─────────────▲─────────────┘
                  │                                       │
                  └───────────────────┬───────────────────┘
                                      │
                          Local Tree-sitter Watcher
                          & Embedding Pipeline (ONNX)
```

### Engine Specifications:
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
        - "Initiative"
        - "Spec"
        - "Requirement"
        - "Module"
        - "CodeSymbol"
        - "Test"
      relationship_types:
        - "HAS_SPEC"
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

  schema_migrations:
    mechanism: "Embedded startup migration runner"
    metadata_table: "_schema_version"
```

---

## 4. Security, Auto-Mode & Authentication

AICO enables an autonomous development loop ("Auto-Mode") governed by a deterministic 3-tier security policy engine running directly in the Rust backend:

```
┌──────────────┐     Tool RPC      ┌─────────────────────────────────────────────────────┐
│  LLM Agent   │ ────────────────> │             AICO Backend (Rust / Axum)              │
└──────────────┘                   ├─────────────────────────────────────────────────────┤
                                   │ 1. Path Canonicalizer (std::fs::canonicalize)       │
                                   │    • Read: Unrestricted across host filesystem      │
                                   │    • Write: MUST reside within active project path  │
                                   │      or active initiative SDD folder.               │
                                   │      External write -> Blocked / Prompt.            │
                                   │                                                     │
                                   │ 2. Command Policy Interceptor (shlex AST parser)    │
                                   │    • Tier 1: Whitelist Match (Auto-Allowed)         │
                                   │      (git status, git diff, cargo test, npm test)   │
                                   │    • Tier 2: Workspace Mutate (Auto + Audit Log)    │
                                   │      (npm install, cargo add, git commit)           │
                                   │    • Tier 3: Blocked / Network / Destructive        │
                                   │      (git push, rm -rf, unknown scripts)            │
                                   │      -> Pauses stream; emits WebSocket prompt:      │
                                   │         [Approve] / [Deny] to desktop or mobile.   │
                                   └─────────────────────────────────────────────────────┘
```

### Access & Session Authentication:
* **Local Loopback (`localhost`)**: Desktop browsers auto-authenticate via a secure session cookie generated on startup.
* **Mobile LAN Pairing**: When opening over local Wi-Fi (`http://192.168.x.x:4242`), the CLI prints a one-time pairing QR code / numeric token to enter once on your phone, granting persistent session access.
* **CLI Authentication**: `aico login` securely manages LLM API keys in the operating system keyring.

---

## 5. User Interface Architecture & Layout

Built with **React + Vite + Tailwind CSS + Radix UI**, featuring the **`@aico/ui`** design system (tokens and components reusable across user applications).

### UI Layout Grid:
```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ [🏠 Home]   [📦 Project A]   [🚀 001-web-platform]  [+]                                │
├──────────────────────────────┬─────────────────────────────────────────────────────────┤
│ 🔍 Omni-Search               │ 📌 INITIATIVE HUB: 001-web-platform                     │
│ [x] Proj [x] Init [x] Spec   │ Status: [In Progress]   Specs: [1/2 Verified]           │
│ [x] Code [x] ADR             │ ─────────────────────────────────────────────────────── │
│                              │ ▾ 📋 Overview & Goals (Summary, dates, status badges)   │
│ 📁 Tree View                 │ ▸ 💡 Shared Brainstorm & Trade-offs [↗ Pop-out Tab]     │
│   ▼ Project A                │ ▸ 🏛️ Architecture Decisions (ADRs)  [↗ Pop-out Tab]     │
│     ▼ 🚀 001-web-platform    │ ▾ 🔬 Specifications & Child Modules:                    │
│       • 01-api-server (Spec) │   ┌───────────────────────────────────────────────────┐ │
│       • 02-web-ui (Spec)     │   │ 01-api-server      [Green 5/5]  [Blast: 4 modules]│ │
│     ► 🚀 002-csv-export      │   │ ▸ Deep Dive  ▸ EARS Spec  ▸ Task Plan  [↗ Tab]    │ │
│                              │   └───────────────────────────────────────────────────┘ │
│ ──────────────────────────── │   ┌───────────────────────────────────────────────────┐ │
│ ● Agent: cargo test (100%)   │   │ 02-web-ui          [Red 1/6]    [Blast: UI root]  │ │
│ ⏱️ LanceDB synced (2s ago)   │   │ ▸ Deep Dive  ▸ EARS Spec  ▸ Task Plan  [↗ Tab]    │ │
│ [⚙️ Settings]                 │   └───────────────────────────────────────────────────┘ │
├──────────────────────────────┴─────────────────────────────────────────────────────────┤
│ ⇄ [Dock: Bottom | Right]   [💬 Agent Chat]   [🖥️ Terminal 1]   [📜 Audit Log]           │
│ Agent > Running behavioral tests for REQ-004...                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key UI Features:
1. **Full-Height Omni-Search Sidebar**:
   - Real-time LanceDB hybrid search across all levels with scope checkboxes (`Projects`, `Initiatives`, `Specs`, `Code`, `ADRs`).
   - Tree navigation: Chevron toggles collapse/expand; double-click opens in an internal tab.
   - Right-click context menu on search and tree items: `Open in New Tab`, `Open in New Window`, `Copy ID`, `Reveal in Git`.
   - Bottom real-time activity indicators ("What is happening right now") and Settings button.
2. **Unified Initiative Hub (Accordion Workspace)**:
   - High information density with zero tab clutter: all artifacts for an initiative live in clean, collapsible sections.
   - Every artifact accordion has a dedicated "Open in separate tab" icon (`↗`) to pop it out into an independent tab when desired.
   - Searching any keyword opens at the Initiative Hub level and automatically scrolls/expands to the matching artifact.
3. **Dockable Chat & Terminal Panel**:
   - Moveable with 1-click between **Bottom** (wide terminal/diff view) and **Right-hand side** (split-screen assistant view).
   - Constrained to the main canvas area (never cuts beneath the left sidebar).
   - Internal tab strip: `Agent Chat`, `Terminal`, `Audit Log`.
4. **Mobile LAN Responsive Mode**:
   - Adapts to a single-column touch view with a slide-out navigation drawer.
   - Live real-time WebSocket chat and one-tap permission approval buttons (`[Approve: cargo test]`).

---

## 6. Deterministic Ingestion & Code Tagging Pipeline

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

### In-Band Code Annotations:
```yaml
in_band_annotations:
  implementation_link:
    syntax_ts_rust: "// @implements SPEC-API-001::REQ-042"
    syntax_python: "# @implements SPEC-API-001::REQ-042"
    parser_action: "Creates (CodeSymbol)-[:IMPLEMENTS]->(Requirement) edge in Kùzu"

  verification_link:
    syntax_ts_rust: "// @verifies SPEC-API-001::REQ-042"
    syntax_python: "# @verifies SPEC-API-001::REQ-042"
    parser_action: "Creates (Test)-[:VERIFIES]->(Requirement) edge in Kùzu"
```

---

## 7. Artifact Lifecycle & Versioning

Every generated SDD artifact in `aico-specs` is tagged with engine metadata and committed to Git:

```yaml
---
id: SPEC-API-001
type: spec
aico_version: "0.1.0"
initiative: "001-web-platform"
created_at: "2026-10-05T17:45:00Z"
derives_from: [BRAIN-web-platform]
---
```

### Requirement Immutability:
* Requirement IDs (`REQ-###`) are immutable.
* Revisions do not delete requirement IDs; they transition their status to `deprecated` or declare `superseded_by: REQ-###`, guaranteeing historical traceability for test suites across Git history.

---

## 8. Distribution & Installation

* **Zero-Dependency Single Binary**: The `aico` executable is distributed as a single self-contained binary with compiled React assets embedded directly via `rust-embed`.
* **First-Run Wizard (`aico init`)**: Launches the browser setup flow to configure `codebase/` and `aico-specs/` roots.
* **Architecture Decision Records**: All system design trade-offs are permanently recorded in [`docs/adr/`](docs/adr/).