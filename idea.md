# System Blueprint: Local Spec-Driven AI Co-Development Environment (AICO)

## 1. System Concept & Architectural Positioning

AICO is a local-first, zero-daemon engineering environment and development platform designed to execute Spec-Driven Development (SDD) through deterministic verification loops.

### Core Architectural Principles:
* **Zero External Host Daemons**: No Docker containers, JVM runtimes, Node.js daemons, or background databases (no Elasticsearch, no Postgres). Everything operates in-process via embedded libraries inside a single compiled binary (`aico`).
* **Headless Core with Universal Web UI**: The Rust backend (powered by `axum`) serves an embedded, responsive WebUI accessible from any desktop browser (Chrome, Firefox, Edge) with multi-tab and multi-window concurrency, and directly from mobile devices over the local Wi-Fi/LAN.
* **Separation of Concerns**: Fast lexical/vector text retrieval and deep multi-hop graph lineage are decoupled into specialized embedded engines (LanceDB and Kùzu).
* **Deterministic Tool Gates**: LLMs and agent loops never execute raw shell strings or fabricate unverified file paths. All actions pass through typed Model Context Protocol (MCP) tool gates with an enforced 3-tier security policy.
* **Decoupled Per-Project Repositories**: The AICO runtime, each target codebase, and each project's dedicated specifications reside in strictly decoupled Git repositories.

---

## 2. Repository & Workspace Topology

AICO enforces 1:1 paired repository isolation for each project:

```
[Host Machine Filesystem]
├── d:/dev/aico/                      # AICO Engine Source Code (or d:/aico/codebase/aico)
│
└── d:/aico/                          # Configured AICO Root (Defined at Installation)
    ├── codebase/                     # Default Directory for Implementation Repositories
    │   ├── project-a/                # • Project A Codebase (Independent Git Repo)
    │   └── project-b/                # • Project B Codebase (Independent Git Repo)
    │
    ├── aico-specs/                   # • AICO Engine Specs Git Repo
    │   ├── .aico-project.json        #   - Manifest linking to d:/dev/aico
    │   ├── GLOSSARY.md               #   - AICO ubiquitous language
    │   ├── adr/                      #   - Architecture decisions (ADR-0001..0008)
    │   └── epics/                    #   - Engine epics (001-aico-core...)
    │
    ├── project-a-specs/              # • Dedicated Project A Specs Git Repo
    │   ├── .aico-project.json        #   - Manifest: { "codebase_path": "../codebase/project-a" }
    │   ├── GLOSSARY.md
    │   ├── adr/
    │   └── epics/
    │       ├── 001-web-platform/     #     * Composite Epic
    │       │   ├── BRAIN-platform.md
    │       │   └── specs/
    │       └── 002-csv-export/       #     * Simple Feature Epic
    │
    └── project-b-specs/              # • Dedicated Project B Specs Git Repo
        └── .aico-project.json
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
    │ • Chunks: specs, code,    │           │ • Nodes: Epic, Spec,      │
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
        - "Epic"
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
                                   │      or active project specs folder.                │
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
│ [🏠 Home]   [📦 Project A ▼]   [🚀 001-web-platform]  [+]                               │
├──────────────────────────────┬─────────────────────────────────────────────────────────┤
│ 🔍 Omni-Search               │ 📌 EPIC HUB: 001-web-platform                           │
│ [x] Epics [x] Specs [x] Code │ Status: [In Progress]   Specs: [1/2 Verified]           │
│                              │ ─────────────────────────────────────────────────────── │
│ 📁 Tree View (Scoped)        │ ▾ 📋 Overview & Goals (Summary, dates, status badges)   │
│   ▼ 🚀 001-web-platform      │ ▸ 💡 Shared Brainstorm & Trade-offs [↗ Pop-out Tab]     │
│     • 01-api-server (Spec)   │ ▸ 🏛️ Architecture Decisions (ADRs)  [↗ Pop-out Tab]     │
│     • 02-web-ui (Spec)       │ ▾ 🔬 Specifications & Child Modules:                    │
│   ► 🚀 002-csv-export        │   ┌───────────────────────────────────────────────────┐ │
│                              │   │ 01-api-server      [Green 5/5]  [Blast: 4 modules]│ │
│ ──────────────────────────── │   │ ▸ Deep Dive  ▸ EARS Spec  ▸ Task Plan  [↗ Tab]    │ │
│ ● Agent: cargo test (100%)   │   └───────────────────────────────────────────────────┘ │
│ ⏱️ LanceDB synced (2s ago)   │   ┌───────────────────────────────────────────────────┐ │
│ [⚙️ Settings]                 │   │ 02-web-ui          [Red 1/6]    [Blast: UI root]  │ │
│                              │   │ ▸ Deep Dive  ▸ EARS Spec  ▸ Task Plan  [↗ Tab]    │ │
│                              │   └───────────────────────────────────────────────────┘ │
├──────────────────────────────┴─────────────────────────────────────────────────────────┤
│ ⇄ [Dock: Bottom | Right]   [💬 Agent Chat]   [🖥️ Terminal 1]   [📜 Audit Log]           │
│ Agent > Running behavioral tests for REQ-004...                                        │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key UI Features:
1. **Top Bar Project Dropdown & Project-Scoped Tabs**:
   - `[ 📦 Project A ▼ ]` dropdown allows switching between projects.
   - Tabs are project-scoped (clean, concise titles). Switching projects restores that project's tabs without title bloat.
   - Multi-window support allows opening Project B in a second browser window side-by-side.
2. **Full-Height Omni-Search Sidebar**:
   - Real-time LanceDB hybrid search across all levels with scope checkboxes (`Epics`, `Specs`, `Code`, `ADRs`).
   - Tree navigation is scoped directly to the active project (no redundant Project root node). Chevron toggles collapse/expand; double-click opens an internal tab.
   - Right-click context menu on search and tree items: `Open in New Tab`, `Open in New Window`, `Copy ID`, `Reveal in Git`.
   - Bottom real-time activity indicators ("What is happening right now") and Settings button.
3. **Unified Epic Hub (Accordion Workspace)**:
   - High information density with zero tab clutter: all artifacts for an epic live in clean, collapsible sections.
   - Every artifact accordion has a dedicated "Open in separate tab" icon (`↗`) to pop it out into an independent tab when desired.
   - Searching any keyword opens at the Epic Hub level and automatically scrolls/expands to the matching artifact.
4. **Dockable Chat & Terminal Panel**:
   - Moveable with 1-click between **Bottom** (wide terminal/diff view) and **Right-hand side** (split-screen assistant view).
   - Constrained to the main canvas area (never cuts beneath the left sidebar).
   - Internal tab strip: `Agent Chat`, `Terminal`, `Audit Log`.
5. **Mobile LAN Responsive Mode**:
   - Adapts to a single-column touch view with a slide-out navigation drawer.
   - Live real-time WebSocket chat and one-tap permission approval buttons (`[Approve: cargo test]`).
6. **Multi-Modal Context & Asset Drop Zones**:
   - Drag-and-drop or clipboard paste (`Ctrl+V`) directly into the Chat for instant multi-modal context (images, audio, PDFs, text guides).
   - Sidebar & Epic Hub asset drop zones: save project-wide reference documents (`<project>-specs/assets/`) or epic assets (`epics/<slug>/assets/`).
   - Text documents are automatically chunked and embedded in LanceDB for hybrid semantic search.
   - Task card drop zones: drag assets directly onto human deliverable tasks in the Plan DAG to fulfill and unblock them.

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

Every generated SDD artifact in `<project>-specs` is tagged with engine metadata and committed to Git:

```yaml
---
id: SPEC-API-001
type: spec
aico_version: "0.1.0"
epic: "001-web-platform"
created_at: "2026-10-05T17:45:00Z"
derives_from: [BRAIN-web-platform]
---
```

### Requirement Immutability:
* Requirement IDs (`REQ-###`) are immutable.
* Revisions do not delete requirement IDs; they transition their status to `deprecated` or declare `superseded_by: REQ-###`, guaranteeing historical traceability for test suites across Git history.

### Human Gate Tasks in Plan DAG:
* Tasks in `PLAN-*.md` can specify `role: user` and `type: asset_delivery`.
* Downstream automated agent tasks specify `blocked_by: [TASK-XXX]`.
* Dropping the expected asset onto the task card in the UI fulfills the requirement and unblocks downstream agent execution automatically.

### Bi-Directional Harness (Greenfield & Brownfield):
* **Forward Path (Greenfield / Idea → Shipped Code)**:
  `aico-brainstorm` → `aico-spec-creation` → `aico-planning` → `aico-test-scaffolding` → `aico-implementation` → `aico-review-loop`
* **Reverse Path (Brownfield / Code Repo → Specifications)**:
  `aico-code-to-spec`: Onboards existing codebases by parsing the AST into Kùzu/LanceDB, extracting domain entities into `GLOSSARY.md`, clustering modules into epics, and reverse-synthesizing formal EARS specifications (`SPEC-*.md`) with test seam designations and `@implements` trace tagging.

---

## 8. Distribution, Installation & Discovery

* **Zero-Dependency Single Binary**: The `aico` executable is distributed as a single self-contained binary with compiled React assets embedded directly via `rust-embed`.
* **Single Root Setup Wizard (`aico init`)**: On first launch, the wizard prompts for a single directory (e.g. `d:/aico/`). AICO automatically infers `codebase/` for implementation repositories and scans for sibling `*-specs/` folders.
* **Deterministic Project Discovery**: Every specs repository contains `.aico-project.json` declaring its linked codebase path (`"codebase_path": "../codebase/project-a"` or an external absolute path). AICO reads these manifests on startup, populates the Top Bar Project Switcher, and establishes background Tree-sitter file watchers.
* **Architecture Decision Records**: All system design trade-offs are permanently recorded in [`docs/adr/`](docs/adr/) and mirrored in `aico-specs/adr/`.