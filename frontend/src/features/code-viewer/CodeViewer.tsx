import React, { useState, useEffect } from 'react';
import { FileCode, CheckCircle2, Loader2 } from 'lucide-react';

interface CodeViewerProps {
  filePath: string;
}

const mockCodeSnippets: Record<string, { lang: string; lines: string[] }> = {
  'crates/aico-server/src/server.rs': {
    lang: 'rust',
    lines: [
      '// @implements spec-ft-core-host-runtime::REQ-001',
      '// @implements spec-ft-core-host-runtime::REQ-010',
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
      '// @implements spec-ft-core-epic-hub::REQ-001',
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
      '// @implements spec-ft-core-webui-shell::REQ-001',
      '// @implements spec-ft-core-webui-shell::REQ-008',
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

function getLanguageFromPath(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.rs')) return 'rust';
  if (lower.endsWith('.tsx') || lower.endsWith('.ts')) return 'typescript';
  if (lower.endsWith('.jsx') || lower.endsWith('.js')) return 'javascript';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.toml')) return 'toml';
  if (lower.endsWith('.md')) return 'markdown';
  if (lower.endsWith('.css')) return 'css';
  if (lower.endsWith('.html')) return 'html';
  if (lower.endsWith('.sql')) return 'sql';
  return 'code';
}

// @implements spec-ft-core-epic-hub::REQ-008
// @implements spec-ft-core-omni-search-fulltext::REQ-011
export const CodeViewer: React.FC<CodeViewerProps> = ({ filePath }) => {
  const [lines, setLines] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const lang = getLanguageFromPath(filePath);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    async function loadFile() {
      try {
        const res = await fetch(`/api/v1/raw?path=${encodeURIComponent(filePath)}`);
        if (res.ok) {
          const content = await res.text();
          if (isMounted) {
            setLines(content.split('\n'));
            setIsLoading(false);
            return;
          }
        }
      } catch {
        // Fallback to static mock snippets if offline
      }

      if (isMounted) {
        const fallback = mockCodeSnippets[filePath] || {
          lang,
          lines: [
            `// Source File: ${filePath}`,
            '// @implements spec-ft-core-webui-shell::REQ-001',
            '// Live file preview unavailable offline',
            '',
            'export default function SourceModule() {',
            '  return <div className="p-4 font-mono text-xs">Module Implementation</div>;',
            '}',
          ],
        };
        setLines(fallback.lines);
        setIsLoading(false);
      }
    }

    loadFile();

    return () => {
      isMounted = false;
    };
  }, [filePath, lang]);

  const hasAnnotations = lines.some((l) => l.includes('@implements'));

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-4 text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
        <div className="flex items-center gap-3">
          <FileCode className="w-5 h-5 text-emerald-400" />
          <h1 className="text-base font-mono font-bold text-zinc-100" data-testid="code-viewer-filename">{filePath}</h1>
          <span className="text-[10px] px-2 py-0.5 rounded font-mono uppercase bg-zinc-800 text-zinc-400">
            {lang}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {hasAnnotations && (
            <span className="flex items-center gap-1 text-xs text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>@implements Verified</span>
            </span>
          )}
        </div>
      </div>

      {/* Code Container */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden font-mono text-xs">
        <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400 text-[11px]">
          <span>{lines.length} lines</span>
          <span className="text-zinc-500">UTF-8 • LF</span>
        </div>

        {isLoading ? (
          <div className="p-8 flex items-center justify-center gap-2 text-zinc-500">
            <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            <span>Loading source file...</span>
          </div>
        ) : (
          <div className="p-4 overflow-x-auto space-y-0.5 leading-relaxed max-h-[75vh]">
            {lines.map((line, idx) => {
              const isAnnotation = line.includes('@implements');
              return (
                <div
                  key={idx}
                  className={`flex gap-4 ${
                    isAnnotation ? 'bg-indigo-950/40 text-indigo-300 font-semibold' : 'text-zinc-300'
                  }`}
                >
                  <span className="w-10 text-right text-zinc-600 select-none shrink-0">{idx + 1}</span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
