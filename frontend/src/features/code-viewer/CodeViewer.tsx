import React from 'react';
import { FileCode, CheckCircle2 } from 'lucide-react';

interface CodeViewerProps {
  filePath: string;
}

const mockCodeSnippets: Record<string, { lang: string; lines: string[] }> = {
  'crates/aico-server/src/server.rs': {
    lang: 'rust',
    lines: [
      '// @implements SPEC-CORE-001::REQ-001',
      '// @implements SPEC-CORE-001::REQ-010',
      'pub async fn bind(&mut self) -> Result<SocketAddr, ServerError> {',
      '    for offset in 0..=self.config.max_port_attempts {',
      '        let port = self.config.base_port + offset;',
      '        let addr_str = format!("{}:{}", self.config.host, port);',
      '        match TcpListener::bind(&addr_str).await {',
      '            Ok(listener) => return Ok(listener.local_addr()?),',
      '            Err(e) => tracing::warn!("Port {} in use, fallback...", port),',
      '        }',
      '    }',
      '    Err(ServerError::BindError("All ports occupied".into()))',
      '}',
      '',
      '// @implements SPEC-CORE-007::REQ-001',
      'async fn list_epics_handler(State(state): State<AppState>) -> Json<Vec<DiscoveredEpic>> {',
      '    let registry = state.registry.read().await;',
      '    let active = registry.get_active();',
      '    Json(scan_epics_for_project(&active.specs_path))',
      '}',
    ],
  },
  'frontend/src/components/layout/ShellLayout.tsx': {
    lang: 'typescript',
    lines: [
      '// @implements SPEC-CORE-006::REQ-001',
      '// @implements SPEC-CORE-006::REQ-008',
      'export const ShellLayout: React.FC<ShellLayoutProps> = ({ children }) => {',
      '  const [searchQuery, setSearchQuery] = useState("");',
      '  const [scopeFilters, setScopeFilters] = useState({ epics: true, specs: true, code: true, adrs: true });',
      '',
      '  return (',
      '    <div className="flex h-screen w-screen bg-zinc-950">',
      '      <aside className="w-64 h-screen border-r border-zinc-800">',
      '        {/* Integrated search with persistent checkboxes */}',
      '      </aside>',
      '      <main className="flex-1">{children}</main>',
      '    </div>',
      '  );',
      '};',
    ],
  },
};

// @implements SPEC-CORE-007::REQ-008
export const CodeViewer: React.FC<CodeViewerProps> = ({ filePath }) => {
  const snippet = mockCodeSnippets[filePath] || {
    lang: filePath.endsWith('.rs') ? 'rust' : 'typescript',
    lines: [
      `// Source File: ${filePath}`,
      '// @implements SPEC-CORE-006::REQ-001',
      '// Verified via automated contract seams',
      '',
      'export default function SourceModule() {',
      '  return <div className="p-4 font-mono text-xs">Module Implementation</div>;',
      '}',
    ],
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <FileCode className="w-5 h-5 text-emerald-400" />
          <h1 className="text-base font-mono font-bold text-zinc-100">{filePath}</h1>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-zinc-800 text-zinc-400">
            {snippet.lang}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>@implements Verified</span>
          </span>
        </div>
      </div>

      {/* Code Container */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px]">
          <span>{snippet.lines.length} lines</span>
          <span className="text-zinc-500">UTF-8 • LF</span>
        </div>
        <div className="p-4 overflow-x-auto space-y-0.5 leading-relaxed">
          {snippet.lines.map((line, idx) => {
            const isAnnotation = line.includes('@implements');
            return (
              <div
                key={idx}
                className={`flex gap-4 ${
                  isAnnotation ? 'bg-indigo-950/30 text-indigo-300 font-semibold' : 'text-zinc-300'
                }`}
              >
                <span className="w-8 text-right text-zinc-600 select-none">{idx + 1}</span>
                <span className="whitespace-pre">{line}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
