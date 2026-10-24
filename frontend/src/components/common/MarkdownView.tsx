import React, { useMemo } from 'react';
import { marked } from 'marked';

// Configure marked with GFM, line breaks, and table support
marked.setOptions({
  gfm: true,
  breaks: true,
});

/**
 * Strips YAML frontmatter and the top Executive Summary / Problem Statement section
 * from brainstorm markdown, leaving only the remaining exploration sections
 * (e.g., Trade-Off Matrix, Architectural Decisions, Key Decisions, Decomposition).
 */
export function stripExecutiveSummary(markdown?: string): string {
  if (!markdown) return '';
  let content = markdown;

  // 1. Strip YAML frontmatter between `---` markers
  if (content.startsWith('---')) {
    const secondMarker = content.indexOf('---', 3);
    if (secondMarker !== -1) {
      content = content.substring(secondMarker + 3).trim();
    }
  }

  // 2. Strip top H1 title (# ...) and any leading dividers
  const lines = content.split('\n');
  let startIdx = 0;
  while (
    startIdx < lines.length &&
    (lines[startIdx].trim().startsWith('# ') ||
      lines[startIdx].trim() === '' ||
      lines[startIdx].trim() === '---')
  ) {
    startIdx++;
  }

  const remainingLines = lines.slice(startIdx);

  // 3. Skip the Executive Summary / Problem Statement section until the next section
  let inExecSummary = false;
  const resultLines: string[] = [];

  for (let i = 0; i < remainingLines.length; i++) {
    const line = remainingLines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('## ')) {
      const heading = trimmed.substring(3).toLowerCase();
      if (
        heading.includes('executive summary') ||
        heading.includes('problem statement') ||
        heading.includes('problem space') ||
        heading.includes('overview')
      ) {
        inExecSummary = true;
        continue;
      } else {
        inExecSummary = false;
        resultLines.push(line);
        continue;
      }
    }

    if (!inExecSummary) {
      resultLines.push(line);
    }
  }

  return resultLines.join('\n').trim();
}

/**
 * Strips YAML frontmatter and the top H1 document header/title (# ...)
 * preserving all content sections beneath.
 */
export function stripDocumentHeader(markdown?: string): string {
  if (!markdown) return '';
  let content = markdown;

  // 1. Strip YAML frontmatter between `---` markers
  if (content.startsWith('---')) {
    const secondMarker = content.indexOf('---', 3);
    if (secondMarker !== -1) {
      content = content.substring(secondMarker + 3).trim();
    }
  }

  // 2. Strip top H1 title (# ...) and any leading blank lines or dividers
  const lines = content.split('\n');
  let startIdx = 0;
  while (
    startIdx < lines.length &&
    (lines[startIdx].trim().startsWith('# ') ||
      lines[startIdx].trim() === '' ||
      lines[startIdx].trim() === '---')
  ) {
    startIdx++;
  }

  return lines.slice(startIdx).join('\n').trim();
}

/**
 * Extracts the Executive Summary / Problem Statement section from brainstorm markdown
 */
export function extractExecutiveSummary(markdown?: string): string {
  if (!markdown) return '';
  let content = markdown;

  if (content.startsWith('---')) {
    const secondMarker = content.indexOf('---', 3);
    if (secondMarker !== -1) {
      content = content.substring(secondMarker + 3).trim();
    }
  }

  const lines = content.split('\n');
  let inExec = false;
  const summaryLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('## ')) {
      const heading = trimmed.substring(3).toLowerCase();
      if (
        heading.includes('executive summary') ||
        heading.includes('problem statement') ||
        heading.includes('problem space') ||
        heading.includes('purpose') ||
        heading.includes('overview')
      ) {
        inExec = true;
        continue;
      } else {
        if (inExec) break;
      }
    }

    if (inExec) {
      if (trimmed === '---') break;
      summaryLines.push(line);
    }
  }

  return summaryLines.join('\n').trim();
}

interface MarkdownViewProps {
  content?: string;
  className?: string;
}

export const MarkdownView: React.FC<MarkdownViewProps> = ({ content = '', className = '' }) => {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      return marked.parse(content) as string;
    } catch {
      return content;
    }
  }, [content]);

  if (!content) {
    return null;
  }

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

interface InlineMarkdownProps {
  content?: string;
  className?: string;
  as?: 'span' | 'p' | 'div' | 'li';
}

// @implements ft-core-dashboard-and-repo-card-refinement::TASK-CORE-018-8::REQ-011
export const InlineMarkdown: React.FC<InlineMarkdownProps> = ({
  content = '',
  className = '',
  as: Component = 'span',
}) => {
  const html = useMemo(() => {
    if (!content) return '';
    try {
      const normalized = content
        .split(/\r?\n/)
        .map((line) => line.trim().replace(/^[-*]\s+/, ''))
        .filter(Boolean)
        .join(' ');
      return marked.parseInline(normalized) as string;
    } catch {
      return content;
    }
  }, [content]);

  if (!content) {
    return null;
  }

  return (
    <Component
      className={`markdown-inline ${className}`.trim()}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};
