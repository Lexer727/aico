import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CodeViewer } from '../src/features/code-viewer/CodeViewer';

// @verifies spec-ft-core-omni-search-fulltext::REQ-011
describe('CodeViewer Component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches full file content from /api/v1/raw and renders lines with @implements highlight', async () => {
    const mockFileContent = [
      '// File: crates/aico-server/src/server.rs',
      '// @implements spec-ft-core-host-runtime::REQ-001',
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
});
