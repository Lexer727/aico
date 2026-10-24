import React, { useState, useEffect } from 'react';
import { BookOpen, Search } from 'lucide-react';
import { fetchGlossary, type TermInfo } from '../feature-task-data';
import { InlineMarkdown } from '../../components/common/MarkdownView';

export interface GlossaryViewerProps {
  terms?: TermInfo[];
  onBack?: () => void;
}

// @implements ft-core-epic-hub::TASK-CORE-007-12::REQ-001
export const GlossaryViewer: React.FC<GlossaryViewerProps> = ({ terms: initialTerms }) => {
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
        {/* TOP ROW: Tag + Title on Left | Status & aico_version on Right */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              data-testid="glossary-viewer-tag"
              className="font-mono text-sm px-2.5 py-1 rounded bg-amber-950/70 text-amber-400 font-bold border border-amber-800/80"
            >
              GLOSSARY.md
            </span>
            <h1 className="text-xl font-bold tracking-tight text-zinc-100">
              Ubiquitous Domain Glossary
            </h1>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span className="text-xs px-3 py-1 rounded-full font-mono font-semibold bg-emerald-950/70 text-emerald-400 border border-emerald-800">
              AICO v0.1.2 Standard
            </span>
            <span className="text-[11px] font-mono text-zinc-400">
              aico_skills_version: 0.1.2
            </span>
          </div>
        </div>

        {/* SECOND ROW: Terms Count */}
        <div className="flex items-center justify-between text-xs text-zinc-400 font-mono pt-1">
          <span>Domain Model Vocabulary: <strong className="text-zinc-200">{terms.length} Defined Terms</strong></span>
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
            {/* @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-8::REQ-011 */}
            <InlineMarkdown
              as="p"
              className="text-zinc-300 text-xs leading-relaxed"
              content={t.definition}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
