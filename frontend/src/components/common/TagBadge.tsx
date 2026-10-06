import React from 'react';
import clsx from 'clsx';

export type TagType = 'epic' | 'feature' | 'adr' | 'spec' | 'plan' | 'neutral';

interface TagBadgeProps {
  type?: TagType;
  id: string;
  label?: string;
  onClick?: () => void;
  className?: string;
  size?: 'xs' | 'sm';
}

export const TagBadge: React.FC<TagBadgeProps> = ({
  type,
  id,
  label,
  onClick,
  className,
  size = 'xs',
}) => {
  // Auto-detect type from prefix if not explicitly passed
  const detectedType: TagType =
    type ||
    (() => {
      const lower = id.toLowerCase();
      if (lower.startsWith('ec-')) return 'epic';
      if (lower.startsWith('ft-')) return 'feature';
      if (lower.startsWith('adr-')) return 'adr';
      if (lower.startsWith('spec-')) return 'spec';
      if (lower.startsWith('plan-')) return 'plan';
      return 'neutral';
    })();

  const colorStyles = {
    epic: 'bg-indigo-950/70 text-indigo-400 border-indigo-800/80 hover:bg-indigo-900/80 hover:border-indigo-600 hover:text-indigo-300',
    feature: 'bg-purple-950/60 text-purple-300 border-purple-800/80 hover:bg-purple-900/80 hover:border-purple-600 hover:text-purple-200',
    adr: 'bg-amber-950/60 text-amber-400 border-amber-800/80 hover:bg-amber-900/80 hover:border-amber-600 hover:text-amber-300',
    spec: 'bg-sky-950/60 text-sky-400 border-sky-800/80 hover:bg-sky-900/80 hover:border-sky-600 hover:text-sky-300',
    plan: 'bg-emerald-950/60 text-emerald-400 border-emerald-800/80 hover:bg-emerald-900/80 hover:border-emerald-600 hover:text-emerald-300',
    neutral: 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white',
  }[detectedType];

  const sizeStyles =
    size === 'sm'
      ? 'text-xs px-2.5 py-1'
      : 'text-[11px] px-2 py-0.5';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={onClick ? `Click to open ${id}` : id}
      data-testid={`tag-badge-${id.toLowerCase()}`}
      className={clsx(
        'font-mono font-medium rounded border transition-colors inline-flex items-center gap-1 select-none',
        onClick ? 'cursor-pointer hover:shadow-sm' : 'cursor-default',
        colorStyles,
        sizeStyles,
        className
      )}
    >
      {label || id}
    </button>
  );
};
