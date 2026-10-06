// Shared feature and task definitions adhering to SDD v0.1.2
// Features use the ft- prefix and tasks declare flexible internal execution waves.

export type WaveStage = 'Scaffolding' | 'Implementation' | 'Verification' | 'Integration';

export interface TaskWave {
  waveNumber: number; // 1 | 2 | 3 | 4
  name: string; // e.g. "Wave 1: Scaffolding / Red Tests"
  stage: WaveStage;
  description: string;
  status: 'Done' | 'In Progress' | 'Pending';
}

export interface FeatureTask {
  id: string; // e.g. "TASK-CORE-004-1"
  title: string;
  status: 'Done' | 'In Progress' | 'Pending' | 'Blocked';
  seam?: string;
  deps?: string[];
  addresses?: string[];
  waves: TaskWave[];
}

export interface FeatureDefinition {
  id: string; // e.g. "ft-core-discovery"
  name: string;
  epicId?: string; // "ec-core" | "ec-specs" | undefined
  isStandalone?: boolean;
  specId: string; // "spec-ft-core-discovery"
  specTitle: string;
  planId: string; // "plan-ft-core-discovery"
  planTitle: string;
  status: 'Draft' | 'Pending' | 'In Progress' | 'Completed';
  order: number;
  description: string;
  tasks: FeatureTask[];
}

export const featureDefinitions: Record<string, FeatureDefinition> = {
  // ec-core Features
  'ft-core-host-runtime': {
    id: 'ft-core-host-runtime',
    name: 'Host Runtime & Local HTTP/WS Server',
    epicId: 'ec-core',
    specId: 'spec-ft-core-host-runtime',
    specTitle: 'Host Runtime & Local HTTP/WebSocket Server',
    planId: 'plan-ft-core-host-runtime',
    planTitle: 'Host Runtime & Local Axum Server',
    status: 'Completed',
    order: 1,
    description: 'Single-instance process lock, dynamic port binding, and WebSocket streaming.',
    tasks: [
      {
        id: 'TASK-CORE-001-1',
        title: 'Axum Server Types & Dynamic Port Binding Seam',
        status: 'Done',
        seam: 'crates/aico-server::server.rs',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Define server config structs and binding test seam', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Port range listener and socket binding logic', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Multi-instance collision and port fallback tests', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-001-2',
        title: 'HTTP Health & Project Info Endpoint Contracts',
        status: 'Done',
        seam: 'crates/aico-server::server.rs',
        deps: ['TASK-CORE-001-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Axum route contracts for /health and /info', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Status probe and uptime metric handlers', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-001-3',
        title: 'High-Throughput Bidirectional WebSocket Channel Hub',
        status: 'Done',
        seam: 'crates/aico-server::ws_hub.rs',
        deps: ['TASK-CORE-001-2'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Message envelope types and WS handshake seam', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Broadcast channel coordinator and client registry', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Concurrent client stress tests and reconnect benchmarks', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-001-4',
        title: 'Graceful Daemon Shutdown & Signal Listener',
        status: 'Done',
        seam: 'crates/aico-server::server.rs',
        deps: ['TASK-CORE-001-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'CancellationToken hooks and signal mocks', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Ctrl+C and termination listener with drain timeout', status: 'Done' },
        ],
      },
    ],
  },

  'ft-core-security-auth': {
    id: 'ft-core-security-auth',
    name: 'LAN Security & Local Authentication',
    epicId: 'ec-core',
    specId: 'spec-ft-core-security-auth',
    specTitle: 'LAN Security & Local Authentication',
    planId: 'plan-ft-core-security-auth',
    planTitle: 'LAN Security & Local Authentication',
    status: 'Completed',
    order: 2,
    description: 'Loopback binding, ephemeral bearer tokens, and auto-mode mutation gates.',
    tasks: [
      {
        id: 'TASK-CORE-002-1',
        title: 'Loopback Security Invariant & Peer Credential Validator',
        status: 'Done',
        seam: 'crates/aico-server::auth.rs',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Loopback address filter trait and mock peer fixtures', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Socket address check rejecting non-loopback IPs', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'External interface connection rejection security tests', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-002-2',
        title: 'Ephemeral LAN Bearer Token Engine & Secret Storage',
        status: 'Done',
        seam: 'crates/aico-server::auth.rs',
        deps: ['TASK-CORE-002-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Token validation seams and header extraction contracts', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'CSPRNG token generator and memory secret store', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Token replay and expiration assertion suite', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-002-3',
        title: 'Auto-Mode Capability Gate & Destructive Command Guard',
        status: 'Done',
        seam: 'crates/aico-server::auth.rs',
        deps: ['TASK-CORE-002-2'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Risk evaluation policy contract and mutation predicates', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Command interception gate and approval challenge flow', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Unauthorized filesystem write rejection tests', status: 'Done' },
          { waveNumber: 4, name: 'Wave 4 (Human Gate)', stage: 'Integration', description: 'Explicit developer interactive consent verification prompt', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-002-4',
        title: 'Security Audit Logger & Tamper-Evident Event Ring',
        status: 'Done',
        seam: 'crates/aico-server::auth.rs',
        deps: ['TASK-CORE-002-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Audit log schema and event type enum', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Append-only in-memory ring buffer with eviction policy', status: 'Done' },
        ],
      },
    ],
  },

  'ft-core-local-storage': {
    id: 'ft-core-local-storage',
    name: 'Local Storage & Embedded Engine Lifecycle',
    epicId: 'ec-core',
    specId: 'spec-ft-core-local-storage',
    specTitle: 'Local Storage & Embedded Engine Lifecycle',
    planId: 'plan-ft-core-local-storage',
    planTitle: 'Local Storage & Embedded Engine Lifecycle',
    status: 'Completed',
    order: 3,
    description: 'In-process LanceDB vector search and Kùzu graph without Docker or background daemons.',
    tasks: [
      {
        id: 'TASK-CORE-003-1',
        title: 'Embedded Storage Engine Lifecycle Interfaces',
        status: 'Done',
        seam: 'crates/aico-storage::embedded.rs',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Storage lifecycle trait definitions', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Engine manager startup and teardown hooks', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-003-2',
        title: 'LanceDB In-Process Vector Storage Integration',
        status: 'Done',
        seam: 'crates/aico-storage::lancedb.rs',
        deps: ['TASK-CORE-003-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Vector table schema and query test seams', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'LanceDB embeddings indexer and cosine query execution', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Nearest-neighbor similarity search accuracy benchmarks', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-003-3',
        title: 'Kùzu Embedded Property Graph Lifecycle',
        status: 'Done',
        seam: 'crates/aico-storage::kuzu.rs',
        deps: ['TASK-CORE-003-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Node and edge schema DDL declarations', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'In-process Cypher query executor and connection pool', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Recursive dependency traversal graph integrity tests', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-003-4',
        title: 'Hybrid Query Coordinator & Search Dispatcher',
        status: 'Done',
        seam: 'crates/aico-storage::embedded.rs',
        deps: ['TASK-CORE-003-2', 'TASK-CORE-003-3'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Unified search query contract and response envelope', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Dual vector + graph ranking synthesizer', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-003-5',
        title: 'File Watcher Ingestion & Storage Concurrency Tests',
        status: 'Done',
        seam: 'tests/storage_test.rs',
        deps: ['TASK-CORE-003-4'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Concurrency stress harnesses for storage writes', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Mutex-coordinated write pipeline with batch flushing', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'High-load concurrent ingestion stress suite', status: 'Done' },
        ],
      },
    ],
  },

  // ft-core-discovery with all 5 canonical tasks!
  'ft-core-discovery': {
    id: 'ft-core-discovery',
    name: 'Workspace & Multi-Project Discovery',
    epicId: 'ec-core',
    specId: 'spec-ft-core-discovery',
    specTitle: 'Workspace & Multi-Project Discovery',
    planId: 'plan-ft-core-discovery',
    planTitle: 'Workspace & Multi-Project Discovery',
    status: 'Completed',
    order: 4,
    description: 'Project manifest scanning and active workspace registry synchronization.',
    tasks: [
      {
        id: 'TASK-CORE-004-1',
        title: 'Project Manifest Schema Validator & Path Normalizer',
        status: 'Done',
        seam: 'tests/project_manifest_test.rs',
        deps: ['None'],
        addresses: ['REQ-002', 'REQ-003', 'REQ-007'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'ProjectManifest model & failing deserialization seams', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Serde parser and bidirectional path normalization logic', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Collision checks, malformed JSON tests, and path assertions', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-004-2',
        title: 'Root Directory Scanner & In-Memory Registry',
        status: 'Done',
        seam: 'tests/project_scanner_test.rs',
        deps: ['TASK-CORE-004-1'],
        addresses: ['REQ-001', 'REQ-005'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'RootScanner trait interface & dummy specs fixtures', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Recursive traversal & WorkspaceRegistry state store', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Git status detection and registry query operations verification', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-004-3',
        title: 'Project Management REST API',
        status: 'Done',
        seam: 'tests/project_api_test.rs',
        deps: ['TASK-CORE-004-2', 'TASK-CORE-001-1'],
        addresses: ['REQ-008'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Axum router routes & HTTP response contract tests', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Handlers for GET /projects & POST /projects/active', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Project creation endpoint integration and error tests', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-004-4',
        title: 'Dynamic Hot Discovery Filesystem Watcher',
        status: 'Done',
        seam: 'tests/project_watcher_test.rs',
        deps: ['TASK-CORE-004-2'],
        addresses: ['REQ-006'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Notify filesystem watcher stub & mock channel listener', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Hot-registration watcher and WebSocket broadcaster', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Real filesystem directory rename/deletion handling tests', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-004-5',
        title: 'Missing Codebase Detection & Initialization Wizard',
        status: 'Done',
        seam: 'tests/project_missing_test.rs',
        deps: ['TASK-CORE-004-2'],
        addresses: ['REQ-004'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Missing codebase detector interfaces and error status mocks', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'CodebaseMissing state flagging and Git clone initialization wizard logic', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Integration seam testing handling broken paths and invalid repo URLs', status: 'Done' },
        ],
      },
    ],
  },

  'ft-core-mcp-tools': {
    id: 'ft-core-mcp-tools',
    name: 'Deterministic SDD Tool Registration',
    epicId: 'ec-core',
    specId: 'spec-ft-core-mcp-tools',
    specTitle: 'Deterministic SDD Tool Registration',
    planId: 'plan-ft-core-mcp-tools',
    planTitle: 'Deterministic SDD Tool Registration',
    status: 'Completed',
    order: 5,
    description: 'In-process Model Context Protocol tool gates enforcing strict SDD contracts.',
    tasks: [
      {
        id: 'TASK-CORE-005-1',
        title: 'Deterministic MCP Protocol Schemas & Tool Dispatcher',
        status: 'Done',
        seam: 'crates/aico-mcp::registry.rs',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'MCP tool schema JSON contracts and trait dispatcher', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Deterministic in-process tool registry dispatcher', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-005-2',
        title: 'Spec Creation & Task Mutation MCP Handlers',
        status: 'Done',
        seam: 'crates/aico-mcp::handlers.rs',
        deps: ['TASK-CORE-005-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Spec creation parameter validators', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'EARS validation gate and task mutation engine', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-005-3',
        title: 'Red-to-Green Test Seam Verification Gate',
        status: 'Done',
        seam: 'crates/aico-mcp::verifier.rs',
        deps: ['TASK-CORE-005-2'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Test runner execution stub and exit code extractor', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Strict contract verifier demanding red tests before implementation', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Adversarial tests preventing premature task completion', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-005-4',
        title: 'MCP Tool Concurrency Stress Suite',
        status: 'Done',
        seam: 'tests/mcp_test.rs',
        deps: ['TASK-CORE-005-3'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Concurrent agent calling test harness', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Thread-safe lock-free tool execution dispatch', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'High-concurrency race condition verification', status: 'Done' },
        ],
      },
    ],
  },

  'ft-core-webui-shell': {
    id: 'ft-core-webui-shell',
    name: 'WebUI Workspace Shell & Dockable Layout',
    epicId: 'ec-core',
    specId: 'spec-ft-core-webui-shell',
    specTitle: 'WebUI Workspace Shell & Dockable Layout',
    planId: 'plan-ft-core-webui-shell',
    planTitle: 'WebUI Workspace Shell & Dockable Layout',
    status: 'In Progress',
    order: 6,
    description: '100vh Shell, sidebar tree search, 5 filter scopes, activity monitor, and multi-terminals.',
    tasks: [
      {
        id: 'TASK-CORE-006-1',
        title: '100vh Shell Layout with Dockable Panels & Collapsible Sidebar',
        status: 'Done',
        seam: 'frontend/src/components/layout/ShellLayout.tsx',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'ShellLayout container structure and resize handlers', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'DockablePanel component and panel collapse state', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-006-2',
        title: 'Sidebar OmniSearch Tree with 5 Instant Filter Scopes',
        status: 'Done',
        seam: 'frontend/src/components/layout/ShellLayout.tsx',
        deps: ['TASK-CORE-006-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Tree search input & 5 filter checkbox controls', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Integrated tree filtering logic across Epics, Features, Specs, Code, ADRs', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-006-3',
        title: 'Live Activity Monitor & WebSocket Connection Status',
        status: 'Done',
        seam: 'frontend/src/components/layout/ActivityMonitor.tsx',
        deps: ['TASK-CORE-006-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Connection status badge UI & latency indicator', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Real-time WebSocket event listener and log viewer', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-006-4',
        title: 'Integrated Terminals Console with Multi-Tab Creation',
        status: 'In Progress',
        seam: 'frontend/src/components/terminal/TerminalConsole.tsx',
        deps: ['TASK-CORE-006-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Multi-terminal tabs state and create terminal button', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'PTY session multiplexing and ANSI color stream renderer', status: 'In Progress' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Cross-platform shell spawn and resize verification tests', status: 'Pending' },
        ],
      },
    ],
  },

  'ft-core-epic-hub': {
    id: 'ft-core-epic-hub',
    name: 'Single-Page Epic Hub & Lineage Graph',
    epicId: 'ec-core',
    specId: 'spec-ft-core-epic-hub',
    specTitle: 'Single-Page Epic Hub & Lineage Graph',
    planId: 'plan-ft-core-epic-hub',
    planTitle: 'Single-Page Epic Hub & Lineage Graph',
    status: 'In Progress',
    order: 7,
    description: '2-column overview, visual wave-internal task plan with progress bars, and lineage graph.',
    tasks: [
      {
        id: 'TASK-CORE-007-1',
        title: 'Single-Page Consolidated Epic Hub with Sticky Overview',
        status: 'Done',
        seam: 'frontend/src/features/epic-hub/EpicHubView.tsx',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Two-column layout with Executive Summary open by default', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Accordion sections for Brainstorm, Specs, Deep Dive, Assets', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-007-2',
        title: 'Visual Task Plan with Wave Progress Bars & Task Cards',
        status: 'Done',
        seam: 'frontend/src/features/epic-hub/EpicHubView.tsx',
        deps: ['TASK-CORE-007-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Task card component with status badge and seam link', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Internal wave breakdown with task and overall progress track bars', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-007-3',
        title: 'Multimodal Drag-and-Drop Asset Gallery & Previews',
        status: 'Done',
        seam: 'frontend/src/components/common/FileDropZone.tsx',
        deps: ['TASK-CORE-007-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Drag-and-drop zone inside expanded Assets section', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Asset preview thumbnail generator and upload dispatcher', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-007-4',
        title: 'Rich FeatureViewer Hub with EARS Requirements & Test Seams',
        status: 'Done',
        seam: 'frontend/src/features/feature-viewer/FeatureViewer.tsx',
        deps: ['TASK-CORE-007-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'FeatureViewer 2-column layout matching EpicHubView', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Integration of unified task plan with flexible execution waves', status: 'Done' },
        ],
      },
      {
        id: 'TASK-CORE-007-5',
        title: 'Interactive SVG/Canvas Lineage Graph Visualizer',
        status: 'In Progress',
        seam: 'frontend/src/features/epic-hub/VisualLineageCanvas.tsx',
        deps: ['TASK-CORE-007-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Interactive canvas element with zoom & pan viewport', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Force-directed graph layout showing Epics, Specs, Tasks, Code', status: 'In Progress' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Graph layout performance with 100+ nodes and edges', status: 'Pending' },
        ],
      },
    ],
  },

  // ec-specs Features
  'ft-specs-blueprint-standards': {
    id: 'ft-specs-blueprint-standards',
    name: 'AICO SDD Blueprint Standards v0.1.2',
    epicId: 'ec-specs',
    specId: 'spec-ft-specs-blueprint-standards',
    specTitle: 'AICO SDD Blueprint Standards v0.1.2',
    planId: 'plan-ft-specs-blueprint-standards',
    planTitle: 'AICO SDD Blueprint Standards v0.1.2',
    status: 'Completed',
    order: 1,
    description: 'Normalized YAML frontmatters with order attribute, relative links, and clean metadata.',
    tasks: [
      {
        id: 'TASK-SPECS-001-1',
        title: 'SDD Blueprint Frontmatter Schema & Validation Rules',
        status: 'Done',
        seam: 'aico-specs/adr/0010.md',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'YAML schema specification for line-1 metadata', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'ADR-0010 decision record synthesis', status: 'Done' },
        ],
      },
      {
        id: 'TASK-SPECS-001-2',
        title: 'Relative Path Normalizer & Link Integrity Checker',
        status: 'Done',
        seam: 'crates/aico-core/src/scanner.rs',
        deps: ['TASK-SPECS-001-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Link resolution contracts for relative markdown links', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Link validator detecting broken relative URLs', status: 'Done' },
        ],
      },
    ],
  },

  'ft-specs-skills-evolution': {
    id: 'ft-specs-skills-evolution',
    name: 'Skills Suite Evolution & Triage System',
    epicId: 'ec-specs',
    specId: 'spec-ft-specs-skills-evolution',
    specTitle: 'Skills Suite Evolution & Triage System',
    planId: 'plan-ft-specs-skills-evolution',
    planTitle: 'Skills Suite Evolution & Triage System',
    status: 'Completed',
    order: 2,
    description: 'Front-door triage via /aico-start, atomic /aico-feature engine, and flexible wave tasks.',
    tasks: [
      {
        id: 'TASK-SPECS-002-1',
        title: 'Front-Door Triage Skill (/aico-start) & Socratic Grilling',
        status: 'Done',
        seam: 'skills/aico-start/SKILL.md',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Triage flowchart and grilling question templates', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Skill instruction markdown and routing logic', status: 'Done' },
        ],
      },
      {
        id: 'TASK-SPECS-002-2',
        title: 'Atomic Feature Engine (/aico-feature) with Flexible Waves',
        status: 'Done',
        seam: 'skills/aico-feature/SKILL.md',
        deps: ['TASK-SPECS-002-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Feature container rules and ft- prefix schema', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Unified standalone and epic child feature execution engine', status: 'Done' },
        ],
      },
      {
        id: 'TASK-SPECS-002-3',
        title: 'Non-Destructive Plan Mutation Engine (/aico-plan-amendment)',
        status: 'Done',
        seam: 'skills/aico-plan-amendment/SKILL.md',
        deps: ['TASK-SPECS-002-2'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: '6-state task transition lifecycle definitions', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Non-destructive rewrite and skip policy enforcement', status: 'Done' },
        ],
      },
    ],
  },

  'ft-specs-migration-engine': {
    id: 'ft-specs-migration-engine',
    name: 'SDD v0.1.1 to v0.1.2 Migration Engine',
    epicId: 'ec-specs',
    specId: 'spec-ft-specs-migration-engine',
    specTitle: 'SDD v0.1.1 to v0.1.2 Migration Engine',
    planId: 'plan-ft-specs-migration-engine',
    planTitle: 'SDD v0.1.1 to v0.1.2 Migration Engine',
    status: 'Completed',
    order: 3,
    description: 'Automated artifact migrator for renaming epics (ec-), features (ft-), and frontmatters.',
    tasks: [
      {
        id: 'TASK-SPECS-003-1',
        title: 'Automated Repository Scanner & Legacy Blueprint Detector',
        status: 'Done',
        seam: 'skills/aico-spec-migration/SKILL.md',
        deps: ['None'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Legacy prefix pattern matchers (001-, 01-)', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Diagnostic audit reporter outlining required migrations', status: 'Done' },
        ],
      },
      {
        id: 'TASK-SPECS-003-2',
        title: 'Safe Rename Engine & Frontmatter Upgrade Transformer',
        status: 'Done',
        seam: 'skills/aico-spec-migration/SKILL.md',
        deps: ['TASK-SPECS-003-1'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Safe transactional filesystem rename routines', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'YAML frontmatter injector with order and ft- prefixes', status: 'Done' },
        ],
      },
    ],
  },

  // Standalone Feature
  'ft-fast-trace': {
    id: 'ft-fast-trace',
    name: 'Fast-Trace Binary Parser',
    isStandalone: true,
    specId: 'spec-ft-fast-trace',
    specTitle: 'Fast Traceability Validator',
    planId: 'plan-ft-fast-trace',
    planTitle: 'Fast Traceability Validator Implementation Plan',
    status: 'Completed',
    order: 1,
    description: 'Sub-15ms source comment annotation scanner validating @implements and @verifies tags.',
    tasks: [
      {
        id: 'TASK-FAST-TRACE-001',
        title: 'Single-Pass Source Comment Annotation Scanner',
        status: 'Done',
        seam: 'crates/aico-core/src/trace.rs',
        deps: ['None'],
        addresses: ['REQ-001'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Scaffold public trait interfaces and failing red integration tests', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Minimal regex and Tree-sitter comment scanner turning tests green', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Benchmark scan latency across large repositories (< 15ms target)', status: 'Done' },
        ],
      },
      {
        id: 'TASK-FAST-TRACE-002',
        title: 'Specification Catalog Validator & Reference Matching',
        status: 'Done',
        seam: 'crates/aico-core/src/trace.rs',
        deps: ['TASK-FAST-TRACE-001'],
        addresses: ['REQ-002'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Red test cases for matching valid spec requirements', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Inverted catalog index and cross-reference validation logic', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'Test case-insensitive requirement ID matching', status: 'Done' },
        ],
      },
      {
        id: 'TASK-FAST-TRACE-003',
        title: 'Orphan Annotation Diagnostics & Broken Reference Reporter',
        status: 'Done',
        seam: 'crates/aico-core/tests/trace_test.rs',
        deps: ['TASK-FAST-TRACE-002'],
        addresses: ['REQ-003'],
        waves: [
          { waveNumber: 1, name: 'Wave 1 (Scaffolding)', stage: 'Scaffolding', description: 'Red unit tests asserting diagnostic output format for broken references', status: 'Done' },
          { waveNumber: 2, name: 'Wave 2 (Implementation)', stage: 'Implementation', description: 'Diagnostic reporter with Levenshtein fuzzy suggestion matchers', status: 'Done' },
          { waveNumber: 3, name: 'Wave 3 (Verification)', stage: 'Verification', description: 'End-to-end regression tests verifying zero false positives on clean repos', status: 'Done' },
        ],
      },
    ],
  },
};

// Helper to look up a feature with flexible normalization (with or without ft- prefix)
export function getFeatureDefinition(id: string): FeatureDefinition | undefined {
  if (featureDefinitions[id]) return featureDefinitions[id];
  const withPrefix = id.startsWith('ft-') ? id : `ft-${id}`;
  if (featureDefinitions[withPrefix]) return featureDefinitions[withPrefix];
  const withoutPrefix = id.startsWith('ft-') ? id.substring(3) : id;
  return Object.values(featureDefinitions).find(
    (f) => f.id === withoutPrefix || f.id.replace('ft-', '') === withoutPrefix
  );
}

// Helper to get all features for an epic
export function getEpicFeatures(epicId: string): FeatureDefinition[] {
  const normEpic = epicId.toLowerCase();
  return Object.values(featureDefinitions)
    .filter((f) => f.epicId?.toLowerCase() === normEpic)
    .sort((a, b) => a.order - b.order);
}
