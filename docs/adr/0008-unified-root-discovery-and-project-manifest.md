# ADR-0008: Unified AICO Root Discovery & Project Manifest

- **Status**: accepted
- **Date**: 2026-10-05
- **Deciders**: User, Antigravity Agent

## Context & Problem Statement
Prompting users for multiple independent configuration paths (codebase root, specs root, individual project mappings) during installation creates setup friction. Furthermore, AICO needs a deterministic discovery mechanism to scan for projects, associate each specs repository with its implementation codebase, and populate the UI project switcher on startup. Additionally, users need the ability to onboard existing codebases that may live outside the default folder.

## Decision Drivers
- Single path configuration at installation (e.g. `d:/aico/`).
- Deterministic project discovery without manual central configuration registries.
- Support for both convention-based relative paths and arbitrary external absolute paths.

## Considered Options
1. **Option A (Chosen)**: Single AICO Root (`d:/aico/`) containing `codebase/` and per-project `*-specs/` repositories, each bearing an `.aico-project.json` manifest that maps to its codebase path.
2. **Option B**: Central SQLite or JSON global registry file (`~/.aico/registry.json`).
3. **Option C**: Forcing codebases and specs to always live in rigidly named sibling folders without manifests.

## Decision Outcome
Chosen option: **Option A**.

### 1. Directory Layout & Convention
```
d:/aico/                              # Configured AICO Root at installation
├── codebase/                         # Default parent directory for implementation repositories
│   ├── project-a/                    # (Git repository)
│   └── project-b/                    # (Git repository)
│
├── aico-specs/                       # Dedicated specs repo for AICO engine
│   └── .aico-project.json            # { "name": "aico", "codebase_path": "d:/dev/aico" }
│
├── project-a-specs/                  # Dedicated specs repo for Project A
│   └── .aico-project.json            # { "name": "project-a", "codebase_path": "../codebase/project-a" }
│
└── project-b-specs/                  # Dedicated specs repo for Project B
    └── .aico-project.json            # { "name": "project-b", "codebase_path": "../codebase/project-b" }
```

### 2. The `.aico-project.json` Manifest
Every specs repository root contains a lightweight manifest:
```json
{
  "name": "project-a",
  "version": "0.1.0",
  "codebase_path": "../codebase/project-a",
  "created_at": "2026-10-05T18:45:00Z"
}
```
- `"codebase_path"` can be relative (`"../codebase/project-a"`) or absolute (`"d:/dev/aico"`), enabling developers to onboard external repositories anywhere on disk.

### 3. Startup Discovery Engine
Upon server initialization, AICO scans the configured root directory:
1. Enumerates all immediate subdirectories containing `.aico-project.json`.
2. Reads the manifest and resolves the codebase path.
3. Automatically registers the project in the in-memory registry.
4. Populates the Top Bar Project Switcher dropdown: `[ 📦 Project A ▼ ]`.
5. Starts the Tree-sitter background watcher on the resolved codebase directory.

### Positive Consequences
- Zero configuration overhead: user only provides `d:/aico/` once during installation.
- Self-contained project portability: copying or cloning `<project>-specs` preserves the codebase binding.
- Works seamlessly for both greenfield projects and existing external codebases.
