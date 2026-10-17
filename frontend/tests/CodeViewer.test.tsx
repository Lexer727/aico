import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeViewer } from '../src/features/code-viewer/CodeViewer';

// @verifies ft-core-omni-search-fulltext::TASK-CORE-009-8::REQ-011
describe('CodeViewer Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches full file content from /api/v1/raw and renders lines with @implements highlight', async () => {
    const mockFileContent = [
      '// File: crates/aico-server/src/server.rs',
      '// @implements ft-core-host-runtime::TASK-CORE-001-1::REQ-001',
      'pub struct HostServer {',
      '    pub port: u16,',
      '}',
    ].join('\n');

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => mockFileContent,
    } as any);

    render(<CodeViewer filePath="crates/aico-server/src/server.rs" />);

    expect(screen.getByTestId('code-viewer-filename')).toHaveTextContent('crates/aico-server/src/server.rs');

    await waitFor(() => {
      expect(screen.getByText('5 lines')).toBeInTheDocument();
      expect(screen.getByText('pub struct HostServer {')).toBeInTheDocument();
      expect(screen.getByText('@implements Verified')).toBeInTheDocument();
    });
  });

  it('falls back to mock or default when API call fails', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    render(<CodeViewer filePath="unknown/test.ts" />);

    await waitFor(() => {
      expect(screen.getByTestId('code-viewer-filename')).toHaveTextContent('unknown/test.ts');
      expect(screen.getByText('export default function SourceModule() {')).toBeInTheDocument();
    });
  });

  // @verifies ft-specs-traceability-syntax-evolution::TASK-SPECS-006-5::REQ-008
  // @verifies ft-core-code-navigation-and-search::TASK-CORE-013-1::REQ-001
  // @verifies ft-core-code-navigation-and-search::TASK-CORE-013-1::REQ-002
  // @verifies ft-core-code-navigation-and-search::TASK-CORE-013-1::REQ-003
  it('parses 3-segment annotations and renders single clickable feature pill with tooltip metadata', async () => {
    const handleSelectFeature = vi.fn();
    const mockFileContent = [
      '// @implements ft-webui-shell::TASK-SHELL-001::REQ-001',
      '// @verifies ft-webui-shell::TASK-SHELL-002::REQ-002',
      '// Example placeholder: @implements ft-<feature>::TASK-###::REQ-###',
      'export const active = true;',
    ].join('\n');

    vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => mockFileContent,
    } as any);

    render(<CodeViewer filePath="frontend/src/active.ts" onSelectFeature={handleSelectFeature} />);

    await waitFor(() => {
      expect(screen.getByText('@implements Verified')).toBeInTheDocument();
      expect(screen.getByText('@verifies Verified')).toBeInTheDocument();

      const badge0 = screen.getByTestId('annotation-badge-0');
      expect(badge0).toBeInTheDocument();
      const btn0 = badge0.querySelector('button');
      expect(btn0).toBeInTheDocument();
      expect(btn0).toHaveTextContent('ft-webui-shell');
      expect(btn0).toHaveAttribute('title', 'Feature: ft-webui-shell | Task: TASK-SHELL-001 | Req: REQ-001');

      // Task and req should NOT be rendered as standalone inline text elements
      expect(screen.queryByText('TASK-SHELL-001')).not.toBeInTheDocument();
      expect(screen.queryByText('REQ-001')).not.toBeInTheDocument();

      // Click badge0 and verify onSelectFeature called with feature ID
      fireEvent.click(btn0!);
      expect(handleSelectFeature).toHaveBeenCalledWith('ft-webui-shell');

      const badge1 = screen.getByTestId('annotation-badge-1');
      expect(badge1).toBeInTheDocument();
      const btn1 = badge1.querySelector('button');
      expect(btn1).toHaveAttribute('title', 'Feature: ft-webui-shell | Task: TASK-SHELL-002 | Req: REQ-002');

      // Placeholder annotation at line 2 must NOT render badge
      expect(screen.queryByTestId('annotation-badge-2')).not.toBeInTheDocument();
    });
  });

  // @verifies ft-core-workspace-path-normalization::TASK-CORE-014-2::REQ-005
  // @verifies ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-3::REQ-005
  // @verifies ft-core-multirepo-code-path-normalization::TASK-CORE-016-3::REQ-004
  it('normalizes various input path formats to clean multi-repository code path without hardcoded root assumption', async () => {
    const { normalizeWorkspacePath } = await import('../src/utils/pathUtils');

    // 1. Host absolute path with drive letter (current machine)
    expect(normalizeWorkspacePath('d:/aico/codebase/aico/crates/aico-server/src/server.rs'))
      .toBe('aico/crates/aico-server/src/server.rs');
    expect(normalizeWorkspacePath('D:\\aico\\codebase\\aico\\crates\\aico-server\\src\\server.rs'))
      .toBe('aico/crates/aico-server/src/server.rs');

    // 2. Custom installation root path (arbitrary user folder on another drive)
    expect(normalizeWorkspacePath('C:/Users/dev/workspace/codebase/aico-standalone/src/main.rs'))
      .toBe('aico-standalone/src/main.rs');

    // 3. Workspace-relative codebase path
    expect(normalizeWorkspacePath('codebase/aico/crates/aico-server/src/server.rs'))
      .toBe('aico/crates/aico-server/src/server.rs');
    expect(normalizeWorkspacePath('codebase/aico-standalone/src/main.rs'))
      .toBe('aico-standalone/src/main.rs');

    // 4. Already multi-repo relative path
    expect(normalizeWorkspacePath('aico/crates/aico-server/src/server.rs'))
      .toBe('aico/crates/aico-server/src/server.rs');
    expect(normalizeWorkspacePath('aico-standalone/src/main.rs'))
      .toBe('aico-standalone/src/main.rs');
  });

  // @verifies ft-core-workspace-path-normalization::TASK-CORE-014-2::REQ-005
  // @verifies ft-core-code-path-simplification-and-omnisearch::TASK-CORE-015-3::REQ-006
  // @verifies ft-core-multirepo-code-path-normalization::TASK-CORE-016-3::REQ-005
  it('renders multi-repo relative path in CodeViewer header and queries raw api', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      text: async () => 'pub fn run() {}',
    } as any);

    render(<CodeViewer filePath="aico/crates/aico-server/src/server.rs" />);

    expect(screen.getByTestId('code-viewer-filename')).toHaveTextContent('aico/crates/aico-server/src/server.rs');
    expect(fetchSpy).toHaveBeenCalledWith('/api/v1/raw?path=aico%2Fcrates%2Faico-server%2Fsrc%2Fserver.rs');
  });
});
