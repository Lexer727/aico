import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { SettingsModal } from '../src/components/settings/SettingsModal';

// @verifies ft-core-webui-shell::TASK-CORE-006-1::REQ-008
// @verifies ft-core-webui-shell::TASK-CORE-006-8::REQ-012
describe('SettingsModal Component', () => {
  it('renders settings dialog and triggers close on close button click', () => {
    const onClose = vi.fn();

    render(<SettingsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByTestId('settings-modal')).toBeInTheDocument();
    expect(screen.getByText('Workspace & System Settings')).toBeInTheDocument();
    expect(screen.getByText(/4242 \(Axum Embedded\)/i)).toBeInTheDocument();
    expect(screen.getByText('AICO Skills')).toBeInTheDocument();
    expect(screen.getByText('AICO Skills Version')).toBeInTheDocument();

    const closeBtn = screen.getByTestId('settings-close-btn');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  it('does not render when isOpen is false', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={false} onClose={onClose} />);
    expect(screen.queryByTestId('settings-modal')).not.toBeInTheDocument();
  });

  // @verifies ft-core-workspace-path-normalization::TASK-CORE-014-3::REQ-006
  it('renders Workspace Architecture & Topology section noting d:/aico as root', () => {
    const onClose = vi.fn();
    render(<SettingsModal isOpen={true} onClose={onClose} />);

    const topologySection = screen.getByTestId('section-workspace-topology');
    expect(topologySection).toBeInTheDocument();
    expect(screen.getByText('Workspace Architecture & Topology')).toBeInTheDocument();
    expect(screen.getByText('d:/aico')).toBeInTheDocument();
    expect(screen.getByText('d:/aico/*-specs/')).toBeInTheDocument();
    expect(screen.getByText('d:/aico/codebase/*/')).toBeInTheDocument();
  });

  // @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-4::REQ-009
  // @verifies spec-ft-storage-workspace-crawler-and-reindexing::TASK-STORAGE-004-4::REQ-010
  it('renders storage maintenance buttons and executes rebuild-graph and reindex API calls', async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url === '/api/v1/storage/rebuild-graph') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', project_id: 'aico-specs', nodes_count: 50, edges_count: 90 }),
        });
      }
      if (url === '/api/v1/storage/reindex') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', project_id: 'aico-specs', files_scanned: 12, chunks_upserted: 45, total_chunks: 45 }),
        });
      }
      return Promise.reject(new Error(`Unhandled URL: ${url}`));
    });

    globalThis.fetch = fetchMock;

    render(<SettingsModal isOpen={true} onClose={onClose} />);

    const rebuildBtn = screen.getByTestId('rebuild-graph-btn');
    const reindexBtn = screen.getByTestId('reindex-vectors-btn');
    expect(rebuildBtn).toBeInTheDocument();
    expect(reindexBtn).toBeInTheDocument();

    // Trigger rebuild graph
    fireEvent.click(rebuildBtn);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/storage/rebuild-graph', expect.objectContaining({ method: 'POST' }));

    const graphBadge = await screen.findByTestId('graph-status-badge');
    expect(graphBadge).toHaveTextContent(/Rebuilt: 50 nodes, 90 edges/i);

    // Trigger reindex vectors
    fireEvent.click(reindexBtn);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/storage/reindex', expect.objectContaining({ method: 'POST' }));

    const vectorBadge = await screen.findByTestId('vector-status-badge');
    expect(vectorBadge).toHaveTextContent(/Indexed: 12 files, 45 chunks/i);
  });

  // @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-6::REQ-004
  it('renders GitHub Integration card and supports token input and status verification', async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/v1/github/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: false,
            username: null,
            source: 'none',
            scopes: [],
          }),
        });
      }
      if (url === '/api/v1/github/token' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', username: 'testuser' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = fetchMock;

    render(<SettingsModal isOpen={true} onClose={onClose} />);

    expect(screen.getByTestId('section-github-integration')).toBeInTheDocument();
    expect(screen.getByText('GitHub Integration')).toBeInTheDocument();

    const tokenInput = screen.getByTestId('github-token-input');
    const verifyBtn = screen.getByTestId('verify-github-token-btn');
    expect(tokenInput).toBeInTheDocument();
    expect(verifyBtn).toBeInTheDocument();

    fireEvent.change(tokenInput, { target: { value: 'ghp_fakeToken12345' } });
    fireEvent.click(verifyBtn);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/github/token',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'ghp_fakeToken12345' }),
      })
    );

    const successMsg = await screen.findByTestId('github-success-msg');
    expect(successMsg).toHaveTextContent(/Connected successfully as @testuser/i);
  });

  // @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-4::REQ-007
  // @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-4::REQ-008
  it('detects GitHub CLI and syncs credentials via sync button', async () => {
    const onClose = vi.fn();
    const fetchMock = vi.fn().mockImplementation((url: string, opts?: any) => {
      if (url === '/api/v1/github/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            authenticated: false,
            username: null,
            source: 'none',
            scopes: [],
          }),
        });
      }
      if (url === '/api/v1/github/cli/status') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            installed: true,
            binary_path: 'C:\\Program Files\\GitHub CLI\\gh.exe',
            logged_in: true,
            username: 'ghuser',
          }),
        });
      }
      if (url === '/api/v1/github/cli/sync' && opts?.method === 'POST') {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ status: 'ok', username: 'ghuser' }),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    });
    globalThis.fetch = fetchMock;

    render(<SettingsModal isOpen={true} onClose={onClose} />);

    // REQ-008: Displays detected GitHub CLI card and binary path
    const cliCard = await screen.findByTestId('github-cli-card');
    expect(cliCard).toBeInTheDocument();
    expect(screen.getByTestId('gh-cli-path')).toHaveTextContent('C:\\Program Files\\GitHub CLI\\gh.exe');
    expect(screen.getByText(/Detected active CLI session for @ghuser/i)).toBeInTheDocument();

    // REQ-007: Clicks sync button calling POST /api/v1/github/cli/sync
    const syncBtn = screen.getByTestId('sync-github-cli-btn');
    expect(syncBtn).toBeInTheDocument();
    fireEvent.click(syncBtn);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/v1/github/cli/sync',
      expect.objectContaining({ method: 'POST' })
    );

    const successMsg = await screen.findByTestId('github-success-msg');
    expect(successMsg).toHaveTextContent(/Connected successfully with GitHub CLI as @ghuser/i);
  });
});
