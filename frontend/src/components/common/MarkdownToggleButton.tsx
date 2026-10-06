import React from 'react';
import clsx from 'clsx';

interface MarkdownToggleButtonProps {
  active: boolean;
  onClick: () => void;
  title?: string;
  className?: string;
}

export const MarkdownToggleButton: React.FC<MarkdownToggleButtonProps> = ({
  active,
  onClick,
  title,
  className,
}) => {
  return (
    <button
      type="button"
      onClick={onClick}
      title={
        title ||
        (active ? 'Switch to structured view' : 'View raw Markdown document')
      }
      data-testid="toggle-raw-markdown"
      className={clsx(
        'p-1.5 rounded-lg border transition-all flex items-center justify-center cursor-pointer select-none group',
        active
          ? 'bg-indigo-600/25 text-indigo-300 border-indigo-500/80 shadow-sm ring-1 ring-indigo-500/30'
          : 'bg-zinc-850 bg-zinc-800/80 text-zinc-400 border-zinc-700/80 hover:text-zinc-200 hover:bg-zinc-700 hover:border-zinc-600',
        className
      )}
    >
      <svg
        className={clsx(
          'w-4 h-4 transition-transform group-hover:scale-105',
          active ? 'text-indigo-400' : 'text-zinc-400 group-hover:text-zinc-200'
        )}
        viewBox="0 0 16 16"
        fill="currentColor"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="Markdown"
      >
        <path d="M14.85 3H1.15C.52 3 0 3.52 0 4.15v7.69C0 12.48.52 13 1.15 13h13.69c.64 0 1.15-.52 1.15-1.15V4.15C16 3.52 15.48 3 14.85 3zM9 11H7V8l-1.5 1.9L4 8v3H2V5h2l1.5 2L7 5h2v6zm2.99.5L9.5 8H11V5h2v3h1.5l-2.51 3.5z" />
      </svg>
    </button>
  );
};
