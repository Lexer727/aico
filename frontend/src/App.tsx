import React, { useState } from 'react';
import { ShellLayout } from './components/layout/ShellLayout';
import { DockablePanel } from './components/layout/DockablePanel';
import { TabBar } from './components/navigation/TabBar';
import { ProjectSwitcher } from './components/navigation/ProjectSwitcher';
import { ConnectionStatusBanner } from './components/navigation/ConnectionStatusBanner';
import { OmniSearchModal, type SearchResultItem } from './components/search/OmniSearchModal';
import { FileDropZone } from './components/common/FileDropZone';
import { EpicHubView, type EpicData } from './features/epic-hub/EpicHubView';
import { VisualLineageCanvas, type GraphNode, type GraphEdge } from './features/epic-hub/VisualLineageCanvas';
import { WebSocketProvider, useWebSocket } from './context/WebSocketContext';
import { useTabStore } from './stores/useTabStore';
import { Search, Terminal, MessageSquare } from 'lucide-react';

const mockProjects = [
  { id: 'aico-core', name: 'AICO Core SDD' },
  { id: 'aico-specs', name: 'AICO Specs' },
];

const mockEpic: EpicData = {
  id: '001-aico-core',
  title: 'AICO Core SDD Platform',
  status: 'Active',
  verifiedCount: 42,
  totalCount: 42,
  sections: {
    overview: 'Autonomous Intelligent Code Orchestrator (AICO) host runtime and embedded databases.',
    brainstorm: 'Local-first architecture, LanceDB + Kùzu embedded engines, zero external services.',
    specifications: '7 Approved EARS Specifications: Host Runtime, Security, Storage, Discovery, MCP, WebUI, Epic Hub.',
    deepDive: 'Dependency graph traversal and module boundary designations.',
    taskPlan: 'DAG of vertical tracer-bullet tasks advancing active frontiers.',
    assets: 'Multi-modal reference designs, mockups, and assets.',
  },
};

const mockNodes: GraphNode[] = [
  { id: 'epic-1', type: 'epic', label: 'Epic 001', isFrontier: false },
  { id: 'spec-1', type: 'spec', label: 'SPEC-CORE-001', isFrontier: false },
  { id: 'spec-6', type: 'spec', label: 'SPEC-CORE-006', isFrontier: false },
  { id: 'task-1', type: 'task', label: 'TASK-CORE-006-1', isFrontier: true },
  { id: 'code-1', type: 'code', label: 'ShellLayout.tsx', isFrontier: false },
];

const mockEdges: GraphEdge[] = [
  { id: 'e1', source: 'epic-1', target: 'spec-1' },
  { id: 'e2', source: 'epic-1', target: 'spec-6' },
  { id: 'e3', source: 'spec-6', target: 'task-1' },
  { id: 'e4', source: 'task-1', target: 'code-1' },
];

const MainWorkspace: React.FC = () => {
  const { status, reconnect } = useWebSocket();
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const { openTab, activeProjectId } = useTabStore();

  const handleFileUpload = (file: File) => {
    setUploadedFiles((prev) => [...prev, file.name]);
  };

  const handleSearchSelect = (item: SearchResultItem) => {
    openTab(activeProjectId, {
      id: item.id,
      title: item.title,
      type: item.scope === 'specs' ? 'spec' : item.scope === 'epics' ? 'epic' : 'code',
    });
  };

  return (
    <ShellLayout>
      {/* Top Application Bar */}
      <header className="h-12 bg-zinc-900 border-b border-zinc-800 flex items-center justify-between px-4 gap-4">
        <div className="flex items-center gap-3">
          <ProjectSwitcher projects={mockProjects} />
          <button
            onClick={() => setIsSearchOpen(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 bg-zinc-950/60 border border-zinc-800 rounded-md hover:border-zinc-700 hover:text-zinc-200 transition-colors"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search (Ctrl+K)</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <ConnectionStatusBanner status={status} onReconnect={reconnect} />
        </div>
      </header>

      {/* Project Tab Bar */}
      <TabBar />

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-84px)] overflow-hidden">
        {/* Central Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <EpicHubView
            epic={mockEpic}
            onPopOut={(epicId, section) => {
              openTab(activeProjectId, {
                id: `${epicId}-${section}`,
                title: `${section.toUpperCase()} (${epicId})`,
                type: 'spec',
              });
            }}
          />

          {/* Visual Lineage Graph Canvas */}
          <div className="max-w-5xl mx-auto space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Interactive Lineage Graph
            </h3>
            <VisualLineageCanvas nodes={mockNodes} edges={mockEdges} />
          </div>

          {/* Multi-modal Asset Drop Zone */}
          <div className="max-w-5xl mx-auto space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Multimodal Reference Assets
            </h3>
            <FileDropZone onFileUpload={handleFileUpload}>
              <span>Drag & drop design mockups, audio files, or specifications here</span>
            </FileDropZone>
            {uploadedFiles.length > 0 && (
              <div className="text-xs text-zinc-400 mt-2">
                Attached assets: {uploadedFiles.join(', ')}
              </div>
            )}
          </div>
        </div>

        {/* Dockable Bottom/Right Auxiliary Panel */}
        <DockablePanel title="Agent Chat & Terminals">
          <div className="flex flex-col h-full space-y-4 text-xs font-mono">
            <div className="flex items-center gap-2 text-zinc-400 border-b border-zinc-800 pb-2">
              <MessageSquare className="w-4 h-4 text-indigo-400" />
              <span className="font-semibold">Agent Conversation</span>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto">
              <div className="p-2 rounded bg-zinc-900 border border-zinc-800 text-zinc-300">
                <span className="text-indigo-400 font-bold">AICO Agent:</span> Ready to advance active frontiers. All test suites verified.
              </div>
            </div>
            <div className="flex items-center gap-2 border-t border-zinc-800 pt-2 text-zinc-500">
              <Terminal className="w-4 h-4" />
              <span>Embedded Axum Host Server active on port 4242</span>
            </div>
          </div>
        </DockablePanel>
      </div>

      {/* Global OmniSearch Modal */}
      <OmniSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        onSelect={handleSearchSelect}
        mockResults={[
          { id: '1', title: '001-aico-core', scope: 'epics', subtitle: 'Epic: Core SDD Platform' },
          { id: '2', title: 'SPEC-CORE-001 Host Runtime', scope: 'specs', subtitle: 'Embedded Axum & WS Server' },
          { id: '3', title: 'SPEC-CORE-006 WebUI Shell', scope: 'specs', subtitle: 'Accordion & Dockable Layout' },
          { id: '4', title: 'crates/aico-server/src/server.rs', scope: 'code', subtitle: 'Axum HostServer implementation' },
          { id: '5', title: 'ADR-0005 Unified Accordion', scope: 'adrs', subtitle: 'UI Architecture Decision Record' },
        ]}
      />
    </ShellLayout>
  );
};

export const App: React.FC = () => {
  return (
    <WebSocketProvider>
      <MainWorkspace />
    </WebSocketProvider>
  );
};

export default App;
