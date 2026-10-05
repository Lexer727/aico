# ADR-0002: Per-Project Dedicated Specs Repository & Codebase Isolation

- **Status**: accepted
- **Date**: 2026-10-05
- **Deciders**: User, Antigravity Agent

## Context & Problem Statement
Spec-Driven Development involves numerous artifacts: brainstorms, deep dives, EARS specifications, task plans, and architectural decisions. Initially, storing all specifications across all projects in a single shared repository was considered. However, sharing a single specs repository couples unrelated projects together, complicates Git history, leaks access when sharing a single project's specs with external collaborators, and clutters the UI tree view with redundant project parent folders.

## Decision Drivers
- Strict folder and Git repository separation between code implementation and SDD documentation.
- Independent portability and version control for each individual project.
- Simplified UI hierarchy without redundant project wrapper nodes in the tree view.

## Considered Options
1. **Option A (Chosen)**: Dedicated per-project specs repositories located under a configured Specs Root (`d:/aico/<project>-specs`), paired 1:1 with each codebase repository (`codebase/<project>`).
2. **Option B**: Single monolithic `aico-specs` repository holding all projects' specifications in subfolders.
3. **Option C**: In-tree `specs/` directory inside each target code repository.

## Decision Outcome
Chosen option: **Option A**.
Each Project is tracked as a decoupled pair of independent Git repositories:
1. **Codebase Implementation Repo**: `d:/dev/codebase/<project>/` (or `d:/dev/aico/` for the engine)
2. **Dedicated Specs Repo**: `d:/aico/<project>-specs/` (e.g. `d:/aico/aico-specs/`, `d:/aico/project-a-specs/`)

### Domain Hierarchy Inside `<project>-specs`:
```
<project>-specs/
├── GLOSSARY.md
├── adr/
│   ├── ADR-0001-...md
│   └── ADR-0002-...md
└── epics/
    ├── 001-<epic-slug>/
    │   ├── BRAIN-<slug>.md
    │   ├── adr/
    │   └── specs/
    │       ├── 01-<spec-slug>/
    │       │   ├── DEEP-<spec-slug>.md
    │       │   ├── SPEC-<spec-slug>.md
    │       │   └── PLAN-<spec-slug>.md
    │       └── 02-...
    └── 002-<single-feature-slug>/
        ├── BRAIN-<slug>.md
        ├── DEEP-<slug>.md
        ├── SPEC-<slug>.md
        └── PLAN-<slug>.md
```

### Positive Consequences
- **Complete Project Isolation**: Repositories can be shared, transferred, or archived independently without exposing unrelated projects.
- **Simplified UI Tree View**: The sidebar tree view is scoped directly to the active project, displaying Epics and Specs without an unnecessary top-level Project folder wrapper.
- **Independent Git Lifecycles**: Commits to `project-a-specs` are completely decoupled from `project-b-specs`.
