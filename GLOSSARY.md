# Domain Glossary

## Core Concepts

### Codebase Root
- **Definition**: The configured root directory on the host machine containing all distinct implementation repositories.
- **Synonyms (Avoid)**: Workspace parent, projects folder, dev directory.
- **Example**: `d:/dev/codebase/` containing `project-a/` and `project-b/`.
- **Related Terms**: [Project](#project), [SDD Repository](#sdd-repository).

---

### Project
- **Definition**: A standalone application, library, or system codebase tracked by its own independent Git repository inside the Codebase Root.
- **Synonyms (Avoid)**: Repository, app, folder, workspace.
- **Example**: An e-commerce backend service or the AICO core engine itself.
- **Related Terms**: [Codebase Root](#codebase-root), [Initiative](#initiative), [SDD Repository](#sdd-repository).

---

### AICO-Specs Repository
- **Definition**: A single, dedicated Git repository housing all Spec-Driven Development artifacts, architecture decisions, and domain glossaries for all Projects, organized by Project and Initiative.
- **Synonyms (Avoid)**: Specs folder, documentation repo, metadata store.
- **Example**: A repository at `d:/dev/aico-specs` containing `project-a/initiatives/init-001-platform/`.
- **Related Terms**: [Project](#project), [Initiative](#initiative).

---

### Initiative
- **Definition**: A cohesive, high-level engineering effort or capability within a Project that encapsulates an idea from conception to verified code, serving as the parent container for all associated SDD artifacts (shared brainstorms, deep dives, specifications, and task plans).
- **Synonyms (Avoid)**: Feature, epic, idea container, ticket, story.
- **Example**: "Web Platform" encompassing both API server and WebUI, or a focused initiative like "CSV Export".
- **Related Terms**: [Project](#project), [Specification](#specification), [Brainstorm](#brainstorm), [Deep Dive](#deep-dive), [Plan](#plan).

---

### Initiative Hub
- **Definition**: The primary unified tab view in the UI for a specific Initiative, consolidating its high-level summary, Brainstorm, Deep Dive, Specifications, and Task Plans into clean, collapsible accordion sections.
- **Synonyms (Avoid)**: Feature overview, spec overview, dashboard view, idea page.
- **Example**: Opening the "Web Platform" tab to inspect its shared brainstorm and expand the child API spec table.
- **Related Terms**: [Initiative](#initiative), [Specification](#specification), [Plan](#plan).

---

### Brainstorm
- **Definition**: An exploratory artifact capturing problem framing, candidate approaches, rejected alternatives, and architectural trade-offs for an Initiative prior to specification.
- **Synonyms (Avoid)**: Scratchpad, design doc, RFC, ideation file.
- **Example**: `BRAIN-web-platform.md` outlining why Axum was chosen over Actix.
- **Related Terms**: [Initiative](#initiative), [Deep Dive](#deep-dive), [Specification](#specification).

---

### Deep Dive
- **Definition**: An empirical codebase analysis analyzing caller chains, imports, public seams, and blast radius within a Project for an Initiative or child Specification before drafting requirements.
- **Synonyms (Avoid)**: System audit, code review, dependency check.
- **Example**: `DEEP-api-server.md` identifying routing boundaries and existing auth middleware.
- **Related Terms**: [Initiative](#initiative), [Specification](#specification).

---

### Specification
- **Definition**: A formal, testable contract containing unambiguous EARS requirement statements with strict out-of-scope boundaries and designated public test seams.
- **Synonyms (Avoid)**: Spec sheet, PRD, requirements list, user story.
- **Example**: `SPEC-api-server.md` containing `REQ-001` through `REQ-012`.
- **Related Terms**: [Initiative](#initiative), [Plan](#plan).

---

### Plan
- **Definition**: A Directed Acyclic Graph (DAG) of dependency-ordered vertical tracer-bullet tasks derived directly from a Specification's requirements.
- **Synonyms (Avoid)**: Task list, todo list, sprint backlog, roadmap.
- **Example**: `PLAN-api-server.md` listing unblocked and blocked engineering tasks.
- **Related Terms**: [Initiative](#initiative), [Specification](#specification).

---

### Host Runtime
- **Definition**: The local-first background engine binary running embedded LanceDB and Kùzu engines, exposing an authenticated HTTP/WebSocket interface for web browsers and mobile devices.
- **Synonyms (Avoid)**: Desktop app, daemon, server, backend.
- **Example**: The `aico` executable serving `http://localhost:4242` and LAN IP.
- **Related Terms**: [Initiative Hub](#initiative-hub).
