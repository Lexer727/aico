# Wayfinder Map: AICO Core Architecture Blueprint

## Destination
A ratified, unambiguous architectural blueprint, system specification, and repository layout for AICO (a local-first Spec-Driven Development environment with embedded LanceDB & Kùzu engines, multi-window & mobile LAN access, fine-grained permission auto-mode, decoupled workspace tracking, and a reusable design system), ready for formal EARS specification in `/aico-spec-creation`.

---

## Notes & Standing Constraints
- **Local-First & Embedded**: Zero external host daemons (no Docker, JVM, external Postgres). Engines (LanceDB, Kùzu) run in-process within the backend binary.
- **SDD Integrity**: LLMs interact with artifacts and graphs strictly through deterministic MCP tool gates.
- **Git Separation**: A dedicated `aico-specs` Git repository tracks all specs and architectural decisions across projects; implementation codebases live in independent Git repositories under Codebase Root.
- **Cross-Device Access**: WebUI accessible via any desktop browser (with internal tabs and multi-window support) and mobile devices on local Wi-Fi/LAN.

---

## Decisions So Far
- **DEC-01 (Host Runtime & Network Topology)**: Embedded Rust Axum HTTP/WebSocket server in `aico` binary; WebUI in browser of choice on desktop and mobile LAN. (See [ADR-0001](file:///d:/dev/aico/docs/adr/0001-host-runtime-and-network-topology.md))
- **DEC-02 (Workspace & Git Isolation)**: Dedicated `aico-specs` repository for all specs structured by `<project>/initiatives/<init-slug>/`, decoupled from individual implementation repos in `codebase/`. (See [ADR-0002](file:///d:/dev/aico/docs/adr/0002-decoupled-sdd-and-codebase-repositories.md))
- **DEC-02B (Domain & Initiative Hierarchy)**: Established hierarchy: `Codebase Root -> Project -> Initiative (Initiative Hub) -> [Shared Brainstorm, Deep Dives, Specifications, Plans, Verification Progress]`. (See [GLOSSARY.md](file:///d:/dev/aico/GLOSSARY.md))
- **DEC-03 (Security & Auto-Mode Boundaries)**: 3-Tier Security Policy Engine in Rust Axum backend; path canonicalization strictly enforcing write boundaries; shell AST whitelist for harmless commands; pairing QR token for mobile LAN. (See [ADR-0003](file:///d:/dev/aico/docs/adr/0003-security-and-auto-mode-enforcement.md))
- **DEC-04 (Frontend Stack & Reusable Design System)**: React + Vite + Tailwind CSS + Radix UI; standalone `@aico/ui` component library and Tailwind tokens reusable across user projects. (See [ADR-0004](file:///d:/dev/aico/docs/adr/0004-react-frontend-and-reusable-design-system.md))
- **DEC-05 (Unified Workspace & Dockable Layout)**: Full-height omni-search sidebar with checkbox filters (`[x] Projects`, `[x] Initiatives`, `[x] Specs`, `[x] Code`, `[x] ADRs`); main canvas with collapsible accordion sections for all Initiative artifacts plus "Open in separate tab" buttons; dockable (Bottom/Right) Chat & Terminal panel constrained to the main canvas. (See [ADR-0005](file:///d:/dev/aico/docs/adr/0005-unified-accordion-workspace-and-dockable-panels.md))
- **DEC-06 (Application Packaging, Installation & Spec Versioning)**: Single pre-compiled binary with embedded React assets (`rust-embed`); `aico init` setup wizard; startup DB migrations for Kùzu and LanceDB; mandatory `aico_version` YAML frontmatter tags on all SDD artifacts. (See [ADR-0006](file:///d:/dev/aico/docs/adr/0006-packaging-aico-specs-and-version-tagging.md))

---

## Active Frontier (Unblocked)
*Cleared — All architectural decision tickets on the frontier have been resolved.*

---

## Blocked Tickets
*None.*

---

## Completion Status
- [x] Destination reached: Architectural blueprint and decision map fully ratified.
- [x] All foundational architectural decisions captured in `docs/adr/` (ADR-0001 through ADR-0006).
- [x] Canonical domain terminology ratified in `GLOSSARY.md`.
- [x] Ready to update `idea.md` and hand off to `/aico-spec-creation`.
