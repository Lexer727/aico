# ADR-0002: Decoupled AICO-Specs Repository and Codebase Isolation

- **Status**: accepted
- **Date**: 2026-10-05
- **Deciders**: User, Antigravity Agent

## Context & Problem Statement
Spec-Driven Development involves numerous artifacts: brainstorms, deep dives, EARS specifications, task plans, and architectural decisions. Placing these directly inside target production codebases can pollute repository commit history, complicate repository access control, and scatter engineering knowledge across fragmented repositories.

## Decision Drivers
- Strict folder and Git repository separation between the AICO runtime, target implementation codebases, and SDD documentation.
- Support for multiple independent implementation repositories under a single parent Codebase Root.
- Clear structural hierarchy for grouping initiatives, deep dives, and specifications.

## Considered Options
1. **Option A (Chosen)**: A dedicated, standalone Git repository (`aico-specs`, e.g. `d:/dev/aico-specs/`) holding all architectural documents for all projects, organized by Project and Initiative (`<project>/initiatives/<init-slug>/`).
2. **Option B**: Project-local SDD artifacts committed directly to each target repository's root (`specs/`, `docs/`).
3. **Option C**: Centralized uncommitted data store (`~/.aico/`) without dedicated Git version control.

## Decision Outcome
Chosen option: **Option A**, because keeping a dedicated `aico-specs` repository decouples architecture planning from raw code repositories while preserving full Git version history. The Codebase Root (`d:/dev/codebase`) contains isolated implementation repositories, and the `aico-specs` repository maps each Project to its corresponding implementation repository via configuration.

### Domain Hierarchy
```
aico-specs/
├── <project-name>/
│   ├── GLOSSARY.md
│   ├── adr/
│   │   └── ADR-0001-...md
│   └── initiatives/
│       ├── init-001-<initiative-slug>/
│       │   ├── BRAIN-<slug>.md
│       │   ├── adr/
│       │   └── specs/
│       │       ├── 01-<spec-slug>/
│       │       │   ├── DEEP-<spec-slug>.md
│       │       │   ├── SPEC-<spec-slug>.md
│       │       │   └── PLAN-<spec-slug>.md
│       │       └── 02-...
│       └── init-002-<single-feature-slug>/
│           ├── BRAIN-<slug>.md
│           ├── DEEP-<slug>.md
│           ├── SPEC-<slug>.md
│           └── PLAN-<slug>.md
```

### Positive Consequences
- Target codebases remain clean of engineering process documents if desired.
- All architecture knowledge and specifications across all projects are consolidated into a single, version-controlled knowledge graph.
- Deep dives are directly scoped to the Initiative/Spec they analyze, eliminating ambiguity about their placement.

### Negative Consequences / Trade-offs
- AICO must maintain a mapping configuration between a Project in `aico-specs` and its target repository directory in Codebase Root.
- Committing artifacts requires committing to the `aico-specs` repository, while code changes are committed to the target project repository.
