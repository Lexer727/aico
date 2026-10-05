# ADR-0006: Packaging, Dedicated Project Specs & Version Tagging

- **Status**: accepted
- **Date**: 2026-10-05
- **Deciders**: User, Antigravity Agent

## Context & Problem Statement
AICO must be simple to install and maintain across development machines without requiring external runtime dependencies like Node.js or Docker. Furthermore, as the application evolves over time, both internal embedded database schemas (Kùzu and LanceDB) and generated Spec-Driven Development artifacts must remain strictly version-tracked and backward-compatible.

## Decision Drivers
- Zero-dependency installation: single binary executable.
- Deterministic tracking of AICO engine versions against generated specifications.
- Clean Git-backed separation for specifications in per-project specs repositories (`<project>-specs`).
- Safe, automated migrations for internal embedded storage.

## Considered Options
1. **Option A (Chosen)**: Standalone Rust binary with embedded React assets (`rust-embed`), dedicated per-project specs Git repositories (`<project>-specs`), startup DB migration runner, and mandatory `aico_version` frontmatter tagging on all generated artifacts.
2. **Option B**: Multi-process package requiring separate Node.js server and native backend processes.
3. **Option C**: Unversioned markdown artifacts without AICO release metadata.

## Decision Outcome
Chosen option: **Option A**.

### 1. Binary Packaging & Setup
- Built as a single self-contained binary (`aico.exe` / `aico`) compiling the Axum HTTP/WebSocket server and in-process LanceDB/Kùzu engines.
- The compiled React WebUI bundle is embedded directly inside the binary using `rust-embed`.
- On first launch, `aico init` prompts for:
  - `Codebase Root` (e.g. `d:/dev/codebase/`)
  - Configures default specs location pattern (e.g. `d:/dev/<project>-specs/`)

### 2. Artifact Version Tagging
Every generated SDD artifact (Brainstorms, Deep Dives, Specs, Plans) must include the generating AICO version in its YAML frontmatter:
```yaml
---
id: SPEC-API-001
type: spec
aico_version: "0.1.0"
epic: "001-web-platform"
created_at: "2026-10-05T17:45:00Z"
---
```
This enables backward compatibility detection, automated schema migrations, and provenance tracking across tool updates.

### 3. Database Schema Migrations
- The embedded Kùzu graph and LanceDB vector tables maintain an internal `_schema_version` metadata table.
- When a newer AICO binary boots, it executes idempotent migration scripts before serving API requests.

### 4. Requirement Immutability
- Requirements generated in specifications receive immutable IDs (`REQ-###`).
- Modified or deprecated requirements are marked `status: deprecated` or `superseded_by: REQ-###`, ensuring historical test trace tags (`// @verifies SPEC-ID::REQ-ID`) remain valid in Git commit history.
