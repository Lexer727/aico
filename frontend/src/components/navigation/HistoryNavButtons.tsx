import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTabStore } from '../../stores/useTabStore';
import clsx from 'clsx';

export const HistoryNavButtons: React.FC = () => {
  const { canGoBack, canGoForward, goBack, goForward, history, historyIndex } = useTabStore();

  const prevTab = historyIndex > 0 ? history[historyIndex - 1] : null;
  const nextTab = historyIndex < history.length - 1 ? history[historyIndex + 1] : null;

  return (
    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-750 border-zinc-800 rounded-md p-0.5">
      <button
        type="button"
        data-testid="history-back-btn"
        onClick={() => goBack()}
        disabled={!canGoBack}
        title={canGoBack ? `Back${prevTab ? ` to ${prevTab}` : ''} (Alt+Left)` : 'Back (disabled)'}
        aria-label="Navigate back"
        className={clsx(
          'p-1 rounded text-zinc-400 transition-colors select-none',
          canGoBack
            ? 'hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer active:scale-95'
            : 'opacity-30 cursor-not-allowed text-zinc-600'
        )}
      >
        <ChevronLeft className="w-4 h-4" />
      </button>

      <button
        type="button"
        data-testid="history-forward-btn"
        onClick={() => goForward()}
        disabled={!canGoForward}
        title={canGoForward ? `Forward${nextTab ? ` to ${nextTab}` : ''} (Alt+Right)` : 'Forward (disabled)'}
        aria-label="Navigate forward"
        className={clsx(
          'p-1 rounded text-zinc-400 transition-colors select-none',
          canGoForward
            ? 'hover:text-zinc-100 hover:bg-zinc-800 cursor-pointer active:scale-95'
            : 'opacity-30 cursor-not-allowed text-zinc-600'
        )}
      >
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
