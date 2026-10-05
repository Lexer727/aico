# ADR-0001: Local Web Host Runtime & Multi-Device Access Topology

- **Status**: accepted
- **Date**: 2026-10-05
- **Deciders**: User, Antigravity Agent

## Context & Problem Statement
The initial blueprint in `idea.md` specified a Tauri desktop application with zero network port bindings. However, the system must support:
1. Opening the UI from mobile phones over a local Wi-Fi/LAN connection.
2. Opening multiple independent browser windows or tabs on desktop to work on different tasks concurrently.
3. Accessing the application through standard desktop web browsers (Chrome, Firefox, Edge).

## Decision Drivers
- Zero external daemon dependencies (no Docker, JVM, or cloud backend).
- In-process execution of embedded engines (LanceDB and Kùzu).
- Cross-device accessibility over local LAN without complex network configuration.
- Native multi-window and multi-session concurrency.

## Considered Options
1. **Option A (Chosen)**: A standalone Rust binary running an embedded Axum HTTP/WebSocket server, serving a responsive WebUI.
2. **Option B**: Pure Tauri native desktop app with WebView only (no network listening).
3. **Option C**: Tauri native app embedding a secondary on-demand LAN server.

## Decision Outcome
Chosen option: **Option A**, because running an embedded Axum server inside the local `aico` binary allows any browser (desktop or mobile) on the LAN to access the full UI via authenticated HTTP/WebSocket connections, while maintaining embedded in-process LanceDB and Kùzu engine instances. Desktop users can run it directly in their browser of choice without requiring native OS WebView packaging.

### Positive Consequences
- True multi-window and multi-device support: multiple desktop tabs and mobile devices can connect concurrently.
- No platform-specific native WebView bundle requirements (simpler packaging and distribution).
- Seamless mobile interaction: view streaming agent runs, inspect specs, and approve permissions from a phone.

### Negative Consequences / Trade-offs
- Requires local network port binding (e.g. `localhost:4242` and LAN interface).
- Requires authentication (e.g. local token or pairing code) to prevent unauthorized LAN access.
