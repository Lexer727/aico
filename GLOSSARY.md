# Domain Glossary

## Core Concepts

### Codebase Root
- **Definition**: The configured root directory on the host machine containing all distinct implementation repositories.
- **Synonyms (Avoid)**: Workspace parent, projects folder, dev directory.
- **Example**: `d:/aico/codebase/` containing `project-a/` and `project-b/`.
- **Related Terms**: [Project](#project), [Project Specs Repository](#project-specs-repository).

---

### Project
- **Definition**: A standalone application, library, or system codebase tracked by its own independent Git repository inside the Codebase Root, paired with its dedicated Specs Repository.
- **Synonyms (Avoid)**: Repository, app, folder, workspace.
- **Example**: An e-commerce backend service or the AICO core engine itself.
- **Related Terms**: [Codebase Root](#codebase-root), [Epic](#epic), [Project Specs Repository](#project-specs-repository).

---

### Project Specs Repository
- **Definition**: A dedicated, per-project Git repository (`<project>-specs`) housing all Spec-Driven Development artifacts, architecture decisions, and domain glossaries for a specific Project, organized by Epic.
- **Synonyms (Avoid)**: Specs folder, global specs repo, metadata store.
- **Example**: A repository at `d:/aico/project-a-specs/` containing `epics/001-platform/`.
- **Related Terms**: [Project](#project), [Epic](#epic).

---

### Epic
- **Definition**: A cohesive, overarching engineering effort or capability within a Project that encapsulates an idea from conception to verified code, serving as the parent container for all associated SDD artifacts (shared brainstorms, deep dives, specifications, and task plans).
- **Synonyms (Avoid)**: Feature, initiative, idea container, ticket, story.
- **Example**: "Web Platform" encompassing both API server and WebUI, or a focused epic like "CSV Export".
- **Related Terms**: [Project](#project), [Specification](#specification), [Brainstorm](#brainstorm), [Deep Dive](#deep-dive), [Plan](#plan).

---

### Epic Hub
- **Definition**: The primary unified tab view in the UI for a specific Epic, consolidating its high-level summary, Brainstorm, Deep Dive, Specifications, and Task Plans into clean, collapsible accordion sections.
- **Synonyms (Avoid)**: Feature overview, spec overview, dashboard view, idea page.
- **Example**: Opening the "Web Platform" tab to inspect its shared brainstorm and expand the child API spec table.
- **Related Terms**: [Epic](#epic), [Specification](#specification), [Plan](#plan).

---

### Context Asset
- **Definition**: Any multi-modal file (documentation, UI inspiration image, audio effect, video, or data schema) dropped into the project, epic, or chat to provide context or assets for implementation.
- **Synonyms (Avoid)**: Upload, file attachment, media file.
- **Example**: An inspiration image `nav-bar-mockup.png` dropped into an epic's assets folder.
- **Related Terms**: [Epic](#epic), [Human Gate Task](#human-gate-task).

---

### Human Gate Task
- **Definition**: A designated task within a Plan's Directed Acyclic Graph (DAG) requiring human developer action (such as delivering an asset, approving a design, or providing credentials) that explicitly blocks subsequent automated agent tasks until fulfilled.
- **Synonyms (Avoid)**: User ticket, manual blocker, prompt task.
- **Example**: `TASK-004: User delivers sound effect file (Blocks: TASK-005 Audio Integration)`.
- **Related Terms**: [Plan](#plan), [Context Asset](#context-asset).

---

### Brainstorm
- **Definition**: An exploratory artifact capturing problem framing, candidate approaches, rejected alternatives, and architectural trade-offs for an Epic prior to specification.
- **Synonyms (Avoid)**: Scratchpad, design doc, RFC, ideation file.
- **Example**: `BRAIN-web-platform.md` outlining why Axum was chosen over Actix.
- **Related Terms**: [Epic](#epic), [Deep Dive](#deep-dive), [Specification](#specification).

---

### Deep Dive
- **Definition**: An empirical codebase analysis analyzing caller chains, imports, public seams, and blast radius within a Project for an Epic or child Specification before drafting requirements.
- **Synonyms (Avoid)**: System audit, code review, dependency check.
- **Example**: `DEEP-api-server.md` identifying routing boundaries and existing auth middleware.
- **Related Terms**: [Epic](#epic), [Specification](#specification).

---

### Specification
- **Definition**: A formal, testable contract containing unambiguous EARS requirement statements with strict out-of-scope boundaries and designated public test seams.
- **Synonyms (Avoid)**: Spec sheet, PRD, requirements list, user story.
- **Example**: `SPEC-api-server.md` containing `REQ-001` through `REQ-012`.
- **Related Terms**: [Epic](#epic), [Plan](#plan).

---

### Plan
- **Definition**: A Directed Acyclic Graph (DAG) of dependency-ordered vertical tracer-bullet tasks derived directly from a Specification's requirements.
- **Synonyms (Avoid)**: Task list, todo list, sprint backlog, roadmap.
- **Example**: `PLAN-api-server.md` listing unblocked and blocked engineering tasks.
- **Related Terms**: [Epic](#epic), [Specification](#specification).

---

### Host Runtime
- **Definition**: The local-first background engine binary running embedded LanceDB and Kùzu engines, exposing an authenticated HTTP/WebSocket interface for web browsers and mobile devices.
- **Synonyms (Avoid)**: Desktop app, daemon, server, backend.
- **Example**: The `aico` executable serving `http://localhost:4242` and LAN IP.
- **Related Terms**: [Epic Hub](#epic-hub).
