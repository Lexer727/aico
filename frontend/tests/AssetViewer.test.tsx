import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AssetViewer } from '../src/features/assets/AssetViewer';

describe('AssetViewer Component', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, opts?: RequestInit) => {
        if (url.includes('/api/v1/assets/raw?path=epics%2Fec-core%2Fassets%2Fguide.md')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve('# Comprehensive Guide\nHere is full guide content.'),
          });
        }
        if (url.includes('/api/v1/assets/raw?path=features%2Fft-sub%2Fassets%2Fmodel.py')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve('def train():\n    pass'),
          });
        }
        if (url.includes('/api/v1/assets/raw?path=features%2Fft-sub%2Fassets%2Fexperiment.ipynb')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            text: () => Promise.resolve('{"cells": [{"cell_type": "code", "source": ["import torch"]}]}'),
          });
        }
        if (url.includes('/api/v1/assets/open-system')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok', path: 'epics/ec-core/assets/mockup.png' }),
          });
        }
        if (url.includes('/api/v1/assets') && opts?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok', path: 'epics/ec-core/assets/mockup.png' }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          text: () => Promise.resolve('Not found'),
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // @verifies ft-core-assets-manager::TASK-ASSET-005::REQ-007
  it('renders image asset with preview image and zoom controls', () => {
    render(
      <AssetViewer
        assetId="epics/ec-core/assets/mockup.png"
        title="mockup.png"
        path="epics/ec-core/assets/mockup.png"
      />
    );

    expect(screen.getByText('mockup.png')).toBeInTheDocument();
    expect(screen.getByText('epics/ec-core/assets/mockup.png')).toBeInTheDocument();
    const img = screen.getByAltText('mockup.png') as HTMLImageElement;
    expect(img).toBeInTheDocument();
    expect(img.src).toContain('/api/v1/assets/raw?path=epics%2Fec-core%2Fassets%2Fmockup.png');
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  // @verifies ft-core-assets-manager::TASK-ASSET-005::REQ-007
  it('fetches and renders text document content for text/markdown asset', async () => {
    render(
      <AssetViewer
        assetId="epics/ec-core/assets/guide.md"
        title="guide.md"
        path="epics/ec-core/assets/guide.md"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Comprehensive Guide/i)).toBeInTheDocument();
      expect(screen.getByText(/Here is full guide content/i)).toBeInTheDocument();
    });
  });

  // @verifies ft-core-assets-manager::TASK-ASSET-006::REQ-008
  it('dispatches open-system request when Open on system button is clicked', async () => {
    render(
      <AssetViewer
        assetId="epics/ec-core/assets/mockup.png"
        title="mockup.png"
        path="epics/ec-core/assets/mockup.png"
      />
    );

    const openBtn = screen.getByTestId('asset-open-system-btn');
    fireEvent.click(openBtn);

    await waitFor(() => {
      expect(screen.getByText(/Opened in system default app/i)).toBeInTheDocument();
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/assets/open-system',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: 'epics/ec-core/assets/mockup.png' }),
      })
    );
  });

  // @verifies ft-core-assets-manager::TASK-ASSET-007::REQ-009
  it('opens confirmation modal when Delete toolbar button is clicked and cancels when cancel is clicked', () => {
    render(
      <AssetViewer
        assetId="epics/ec-core/assets/mockup.png"
        title="mockup.png"
        path="epics/ec-core/assets/mockup.png"
      />
    );

    const deleteBtn = screen.getByTestId('asset-delete-btn');
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId('asset-viewer-delete-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();

    const cancelBtn = screen.getByTestId('cancel-delete-modal-btn');
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('asset-viewer-delete-dialog')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(
      '/api/v1/assets',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  // @verifies ft-core-assets-manager::TASK-ASSET-007::REQ-009
  it('dispatches delete request and triggers onDelete callback upon confirmation', async () => {
    const handleDelete = vi.fn();
    render(
      <AssetViewer
        assetId="epics/ec-core/assets/mockup.png"
        title="mockup.png"
        path="epics/ec-core/assets/mockup.png"
        onDelete={handleDelete}
      />
    );

    const deleteBtn = screen.getByTestId('asset-delete-btn');
    fireEvent.click(deleteBtn);

    expect(screen.getByTestId('asset-viewer-delete-dialog')).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('confirm-delete-modal-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/assets',
        expect.objectContaining({
          method: 'DELETE',
          body: JSON.stringify({ path: 'epics/ec-core/assets/mockup.png' }),
        })
      );
    });

    expect(handleDelete).toHaveBeenCalledWith('epics/ec-core/assets/mockup.png');
  });

  // @verifies ft-core-assets-manager::TASK-ASSET-009::REQ-014
  it('renders text viewport for .py and .ipynb files', async () => {
    const { rerender } = render(
      <AssetViewer
        assetId="features/ft-sub/assets/model.py"
        title="model.py"
        path="features/ft-sub/assets/model.py"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/def train\(\):/)).toBeInTheDocument();
    });

    rerender(
      <AssetViewer
        assetId="features/ft-sub/assets/experiment.ipynb"
        title="experiment.ipynb"
        path="features/ft-sub/assets/experiment.ipynb"
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/import torch/)).toBeInTheDocument();
    });
  });
});
