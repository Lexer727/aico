import React, { useState, useEffect } from 'react';
import { BookOpen, Search, ArrowLeft } from 'lucide-react';
import { fetchGlossary, type TermInfo } from '../feature-task-data';

interface GlossaryViewerProps {
  terms?: TermInfo[];
  onBack?: () => void;
}

// @implements SPEC-CORE-007::REQ-001
export const GlossaryViewer: React.FC<GlossaryViewerProps> = ({ terms: initialTerms, onBack }) => {
  const [terms, setTerms] = useState<TermInfo[]>(initialTerms || []);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (initialTerms && initialTerms.length > 0) {
      setTerms(initialTerms);
    } else {
      fetchGlossary().then((data) => {
        if (data && data.length > 0) {
          setTerms(data);
        }
      });
    }
  }, [initialTerms]);

  const q = search.trim().toLowerCase();
  const filtered = terms.filter(
    (t) => !q || t.term.toLowerCase().includes(q) || t.definition.toLowerCase().includes(q)
  );

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-800 pb-5 space-y-3">
        {onBack && (
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        )}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm px-2.5 py-1 rounded bg-zinc-800 text-amber-400 font-bold border border-zinc-700">
              GLOSSARY.md
            </span>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Ubiquitous Domain Glossary
            </h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-emerald-950 text-emerald-400 border border-emerald-800">
              AICO v0.1.2 Standard
            </span>
          </div>
          <span className="text-xs text-zinc-400 font-mono">
            {terms.length} Defined Domain Terms
          </span>
        </div>
      </div>

      {/* Search Filter */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search domain concepts, terms, definitions..."
            className="w-full pl-9 pr-3 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-amber-500/60"
          />
        </div>
        <span className="text-xs text-zinc-500 font-mono">
          Showing {filtered.length} of {terms.length} terms
        </span>
      </div>

      {/* Terms Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filtered.map((t, idx) => (
          <div
            key={idx}
            className="p-4 bg-zinc-900/70 rounded-xl border border-zinc-800/90 space-y-2 hover:border-zinc-700 transition-colors"
          >
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-amber-400" />
              <h3 className="font-bold text-amber-400 text-sm">{t.term}</h3>
            </div>
            <p className="text-zinc-300 text-xs leading-relaxed">{t.definition}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
