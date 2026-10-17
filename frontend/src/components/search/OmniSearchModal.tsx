import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Layers, BookOpen, FileCode, Scale, Package } from 'lucide-react';
import { searchWorkspace, type SearchableEntity, type SearchScope } from '../../utils/searchEngine';

export type { SearchScope };

export interface SearchResultItem {
  id: string;
  title: string;
  scope: SearchScope;
  subtitle?: string;
  projectId?: string;
  projectName?: string;
  epicId?: string;
  score?: number;
  matchedField?: string;
  matchedSnippet?: string;
}

interface OmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: SearchResultItem) => void;
  mockResults?: SearchResultItem[];
  searchIndex?: SearchableEntity[];
}

// @implements ft-core-webui-shell::TASK-CORE-006-11::REQ-007
// @implements ft-core-omni-search-fulltext::TASK-CORE-009-3::REQ-005
// @implements ft-core-omni-search-fulltext::TASK-CORE-009-3::REQ-006
// @implements ft-core-omni-search-fulltext::TASK-CORE-009-3::REQ-007
// @implements ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-2::REQ-004
// @implements ft-core-multirepo-code-path-normalization::TASK-CORE-016-2::REQ-005
export const OmniSearchModal: React.FC<OmniSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  mockResults = [],
  searchIndex,
}) => {
  const [query, setQuery] = useState('');
  const [scopes, setScopes] = useState<Record<SearchScope, boolean>>({
    epics: true,
    features: true,
    specs: true,
    code: true,
    adrs: true,
  });

  const toggleScope = (scope: SearchScope) => {
    setScopes((prev) => ({
      ...prev,
      [scope]: !prev[scope],
    }));
  };

  const [backendHits, setBackendHits] = useState<SearchResultItem[]>([]);

  useEffect(() => {
    const q = query.trim();
    if (!q || !isOpen) {
      setBackendHits([]);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/v1/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data) && isMounted) {
            setBackendHits(
              data.map((item: any) => ({
                id: item.id,
                title: item.title,
                scope: item.scope as SearchScope,
                subtitle: item.snippet,
                projectId: item.project_id,
                projectName: item.project_name,
                matchedSnippet: item.snippet,
                score: 0.85,
              }))
            );
          }
        }
      } catch {
        // Offline
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [query, isOpen]);

  const filteredResults: SearchResultItem[] = useMemo(() => {
    if (searchIndex && searchIndex.length > 0) {
      if (!query.trim()) {
        // When query is empty, show initial top items
        return searchIndex
          .filter((item) => scopes[item.scope])
          .slice(0, 15)
          .map((item) => ({
            id: item.id,
            title: item.title,
            scope: item.scope,
            projectId: item.projectId,
            projectName: item.projectName,
            epicId: item.epicId,
          }));
      }

      const matches: SearchResultItem[] = searchWorkspace(searchIndex, query, { scopes }).map((m) => ({
        id: m.id,
        title: m.title,
        scope: m.scope,
        subtitle: m.matchedSnippet,
        projectId: m.projectId,
        projectName: m.projectName,
        epicId: m.epicId,
        score: m.score,
        matchedField: m.matchedField,
        matchedSnippet: m.matchedSnippet,
      }));

      // Merge backend hits (e.g. codebase search line hits with snippets)
      const existingKey = new Set(matches.map((m) => `${m.scope}-${m.id.toLowerCase()}`));
      for (const b of backendHits) {
        if (!scopes[b.scope]) continue;
        const key = `${b.scope}-${b.id.toLowerCase()}`;
        if (!existingKey.has(key)) {
          matches.push(b);
          existingKey.add(key);
        } else {
          const existing = matches.find((m) => `${m.scope}-${m.id.toLowerCase()}` === key);
          if (existing && !existing.subtitle && b.subtitle) {
            existing.subtitle = b.subtitle;
            existing.matchedSnippet = b.matchedSnippet;
          }
        }
      }

      return matches;
    }

    return mockResults.filter((item) => {
      // Must match active scope checkbox
      if (!scopes[item.scope]) return false;
      // Must match search query
      if (!query.trim()) return true;
      return (
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        item.id.toLowerCase().includes(query.toLowerCase()) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
      );
    });
  }, [searchIndex, mockResults, scopes, query, backendHits]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const getScopeIcon = (scope: SearchScope) => {
    switch (scope) {
      case 'epics':
        return <Layers className="w-4 h-4 text-indigo-400" />;
      case 'features':
        return <Package className="w-4 h-4 text-purple-400" />;
      case 'specs':
        return <BookOpen className="w-4 h-4 text-sky-400" />;
      case 'code':
        return <FileCode className="w-4 h-4 text-emerald-400" />;
      case 'adrs':
        return <Scale className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="omnisearch-modal"
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-zinc-900 border border-zinc-700/80 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-zinc-800 gap-3">
          <Search className="w-5 h-5 text-zinc-400" />
          <input
            autoFocus
            type="text"
            data-testid="omnisearch-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across all projects, epics, specs, code, ADRs..."
            className="flex-1 bg-transparent border-none outline-none text-zinc-100 placeholder-zinc-500 text-sm"
          />
          <button
            onClick={onClose}
            className="p-1 rounded text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scope Checkboxes Filter Bar */}
        <div className="flex items-center gap-4 px-4 py-2 border-b border-zinc-800 bg-zinc-950/40 text-xs">
          <span className="text-zinc-500 font-medium">Scopes:</span>
          {(['epics', 'features', 'specs', 'code', 'adrs'] as SearchScope[]).map((scope) => (
            <label
              key={scope}
              className="flex items-center gap-1.5 cursor-pointer text-zinc-300 hover:text-white capitalize"
            >
              <input
                type="checkbox"
                aria-label={scope}
                checked={scopes[scope]}
                onChange={() => toggleScope(scope)}
                className="rounded border-zinc-700 bg-zinc-800 text-indigo-500 focus:ring-0 cursor-pointer"
              />
              <span>{scope}</span>
            </label>
          ))}
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-zinc-800/40">
          {filteredResults.length === 0 ? (
            <div className="py-8 text-center text-xs text-zinc-500">
              No results found for active filters.
            </div>
          ) : (
            filteredResults.map((item) => (
              <div
                key={`${item.projectId || ''}-${item.scope}-${item.id}`}
                data-testid={`search-result-${item.id}`}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors"
              >
                <div className="p-1.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                  {getScopeIcon(item.scope)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-medium text-zinc-200 truncate ${item.scope === 'code' ? 'font-mono' : ''}`}>
                      {item.title}
                    </span>
                    {item.projectName && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-950/80 text-indigo-300 border border-indigo-800/60 font-mono shrink-0">
                        {item.projectName}
                      </span>
                    )}
                  </div>
                  {item.subtitle && (
                    <div className="text-[11px] text-zinc-500 truncate mt-0.5">
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 shrink-0">
                  {item.scope}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
