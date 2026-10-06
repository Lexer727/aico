import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Layers, BookOpen, FileCode, Scale } from 'lucide-react';

export type SearchScope = 'epics' | 'specs' | 'code' | 'adrs';

export interface SearchResultItem {
  id: string;
  title: string;
  scope: SearchScope;
  subtitle?: string;
}

interface OmniSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (item: SearchResultItem) => void;
  mockResults?: SearchResultItem[];
}

// @implements spec-ft-core-webui-shell::REQ-007
export const OmniSearchModal: React.FC<OmniSearchModalProps> = ({
  isOpen,
  onClose,
  onSelect,
  mockResults = [],
}) => {
  const [query, setQuery] = useState('');
  const [scopes, setScopes] = useState<Record<SearchScope, boolean>>({
    epics: true,
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

  const filteredResults = useMemo(() => {
    return mockResults.filter((item) => {
      // Must match active scope checkbox
      if (!scopes[item.scope]) return false;
      // Must match search query
      if (!query.trim()) return true;
      return (
        item.title.toLowerCase().includes(query.toLowerCase()) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(query.toLowerCase()))
      );
    });
  }, [mockResults, scopes, query]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // toggle modal if needed
      } else if (e.key === 'Escape' && isOpen) {
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
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search Epics, Specs, Code, ADRs..."
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
          {(['epics', 'specs', 'code', 'adrs'] as SearchScope[]).map((scope) => (
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
                key={item.id}
                onClick={() => {
                  onSelect(item);
                  onClose();
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 cursor-pointer transition-colors"
              >
                <div className="p-1.5 rounded bg-zinc-800 text-zinc-400">
                  {getScopeIcon(item.scope)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-200 truncate">
                    {item.title}
                  </div>
                  {item.subtitle && (
                    <div className="text-[11px] text-zinc-500 truncate">
                      {item.subtitle}
                    </div>
                  )}
                </div>
                <span className="text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
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
