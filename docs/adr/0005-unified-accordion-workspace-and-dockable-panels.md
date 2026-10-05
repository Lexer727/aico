# ADR-0005: Unified Accordion Workspace & Dockable Panel Layout

- **Status**: accepted
- **Date**: 2026-10-05
- **Deciders**: User, Antigravity Agent

## Context & Problem Statement
Developers need to navigate seamlessly across systems, large initiatives, and targeted specifications without cognitive overload. Fragmenting an initiative into multiple disconnected tabs forces excessive context switching. Simultaneously, users need omni-search with scope filtering, real-time background execution status, and flexible chat/terminal docking that preserves the unbroken left navigation rail.

## Decision Drivers
- High information density without visual clutter (folding/accordions).
- Fast navigation and omni-search spanning Projects, Initiatives, Specs, and Code symbols with fine-grained checkbox filters.
- Ergonomic workspace customization: moveable chat/terminal between right-side and bottom layouts, without clipping the full-height sidebar.
- Consistent interaction: tree expansion vs. opening in tabs, right-click context menus for multi-window/multi-tab workflows.

## Decision Outcome
Chosen design layout and interaction model:

### 1. Structural Grid & Shell:
- **Top Bar**:
  - `[ 🏠 Home ]` button: returns to project catalog and global health overview.
  - **Internal Tabs Strip**: displays currently open tabs (e.g., `[ 📦 Project A ]`, `[ 🚀 Web Platform ]`).
- **Left Sidebar (Full Height)**:
  - Extends top-to-bottom of the application viewport (the bottom chat/terminal panel never stretches under the sidebar).
  - **Omni-Search Bar**: Real-time LanceDB hybrid search with explicit scope checkboxes:
    - `[x] Projects` `[x] Initiatives` `[x] Specs` `[x] Code` `[x] ADRs`
  - **Search & Tree Interaction**:
    - **Single-click on chevron**: Expands or collapses folders/nodes in the tree.
    - **Double-click on item name**: Opens the item as an internal tab.
    - **Search Result Navigation**: Clicking any search hit opens at the **Initiative Hub level** (expanding and scrolling directly to the matching artifact/requirement). If the result is a standalone single-feature initiative, it opens that feature directly.
    - **Right-Click Context Menu**: Available on all search results and tree entries:
      - `Open in New Tab`
      - `Open in New Window`
      - `Copy Link / ID`
      - `Reveal in Explorer / Git`
  - **Status & Activity Monitor (Bottom of Sidebar)**:
    - Real-time background indicators ("Agent: cargo test (12 passed)", "LanceDB synced 2s ago", CPU & active task counters).
    - `[ ⚙️ Settings ]` button (API keys, Auto-Mode permissions, mobile QR pairing).

### 2. Main Content Canvas (Initiative Hub):
- Consolidated single-page view with collapsible accordion sections:
  - ▾ **Overview & Status**: Title, goal, dates, test pass/fail metrics.
  - ▸ **💡 Shared Brainstorm & Architectural Trade-offs** (expandable)
  - ▸ **🔬 Deep Dive & Blast Radius Graph** (expandable)
  - ▸ **📋 Specifications (EARS Requirements Table)** (expandable)
  - ▸ **🗺️ Plans & Task DAGs** (expandable)
- **Detached Tab Action**: Every artifact accordion has a dedicated "Open in separate tab" icon (`↗`) allowing users to pop out any individual brainstorm, deep dive, spec, or plan into its own full tab if desired.

### 3. Dockable Chat & Terminal Panel:
- Docks strictly within the main canvas area (between the right edge of the sidebar and the right edge of the screen).
- Switchable with 1 click between **Bottom** (wide terminal/diff view) and **Right-hand side** (split-screen assistant view).
- Internal tabs: `[ 💬 Agent Chat ]`, `[ 🖥️ Terminal ]`, `[ 📜 Audit Log ]`.
