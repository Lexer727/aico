# ADR-0007: Multi-Modal Context Assets & Human Gate Tasks

- **Status**: accepted
- **Date**: 2026-10-05
- **Deciders**: User, Antigravity Agent

## Context & Problem Statement
Software development frequently requires external non-code context: UI inspiration mockups, brand writing guides, audio sound effects, background videos, or reference schemas. Currently, agents lack a structured, local-first way to receive these assets. Furthermore, during implementation planning, certain steps depend directly on human delivery (e.g., "User searches and provides 3 UI inspiration mockups"), which must explicitly block automated agent execution until the asset is provided.

## Decision Drivers
- Multi-modal input support across all levels: conversational chat, project-wide context, epic-scoped assets, and task-specific deliverables.
- Automatic indexing of text/document assets into LanceDB for agent retrieval.
- Deterministic Human-in-the-Loop (HITL) task gating in the Plan DAG: agent tasks must not proceed when waiting on human deliverables.

## Considered Options
1. **Option A (Chosen)**: Tiered Multi-Modal Drop Zones (Chat, Project Shelf, Epic Accordion, Task Cards) paired with DAG Human Gate Tasks (`role: user` / `type: asset_delivery`) that block dependent agent tasks.
2. **Option B**: Chat-only file uploads without project or epic persistence.
3. **Option C**: Unstructured manual file copying directly into OS folders without indexing or DAG blocking.

## Decision Outcome
Chosen option: **Option A**.

### 1. Storage & Ingestion Pipeline
- **Project Assets**: Stored in `<project>-specs/assets/` (e.g. style guides, brand palettes).
- **Epic Assets**: Stored in `<project>-specs/epics/<epic-slug>/assets/` (e.g. `inspiration.png`, `sound_fx.wav`).
- **Text & Document Ingestion**: Text documents, Markdown, and PDFs are parsed, chunked, and embedded into **LanceDB** with BM25 + dense vectors for semantic agent retrieval.
- **Media Asset Ingestion**: Images, audio, and video files are registered with metadata (mime type, dimensions, duration) and rendered inline, with image assets passed directly to multi-modal vision models.

### 2. UI Drop Zones
1. **Chat Input**: Drag-and-drop or clipboard paste (`Ctrl+V`) for immediate conversational context.
2. **Sidebar / Project Shelf**: Drop files for global project-wide reference.
3. **Epic Hub Accordion**: Dedicated `📁 Context & Assets` accordion pane inside each Epic.
4. **Task Card Drop Zone**: Direct file drop area on human asset delivery tasks.

### 3. Human Gate Tasks in the Plan DAG
In `PLAN-*.md`, tasks can be assigned to the human developer:
```yaml
- id: TASK-004
  title: "Deliver UI inspiration mockups for navigation bar"
  role: "user"
  type: "asset_delivery"
  expected_types: ["image/png", "image/jpeg"]
  status: "pending"

- id: TASK-005
  title: "Implement responsive navigation component"
  role: "agent"
  blocked_by: [TASK-004]
  status: "blocked"
```
- The UI renders `TASK-004` with a drop zone.
- `TASK-005` remains locked on the active frontier.
- When the user drops the file onto the card, AICO stores the asset, marks `TASK-004` complete, and automatically transitions `TASK-005` to unblocked.

### Positive Consequences
- Clear demarcation between automated agent tasks and human creative input.
- Rich multi-modal context readily available to LLMs and LanceDB search.
- Plan DAG accurately reflects real-world dependencies on human assets.
