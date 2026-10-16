import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { AssetPanel, type DiscoveredAssetInfo } from '../src/features/assets/AssetPanel';

describe('AssetPanel Component', () => {
  const mockEpicAssets: DiscoveredAssetInfo[] = [
    {
      id: 'epics/ec-core/assets/mockup.png',
      filename: 'mockup.png',
      path: 'epics/ec-core/assets/mockup.png',
      scope_type: 'epic',
      scope_id: 'ec-core',
      source_label: 'epic',
      is_subfeature: false,
      mime_type: 'image/png',
      size_bytes: 45000,
      updated_at: '1700000000',
    },
    {
      id: 'epics/ec-core/features/ft-sub/assets/sub_spec.md',
      filename: 'sub_spec.md',
      path: 'epics/ec-core/features/ft-sub/assets/sub_spec.md',
      scope_type: 'epic',
      scope_id: 'ec-core',
      source_label: 'ft-sub',
      is_subfeature: true,
      mime_type: 'text/markdown',
      size_bytes: 1200,
      updated_at: '1700000001',
      text_preview: '# Sub Feature Architecture Overview\nThis is a preview snippet.',
    },
  ];

  const mockFeatureAssets: DiscoveredAssetInfo[] = [
    {
      id: 'features/ft-sub/assets/sub_spec.md',
      filename: 'sub_spec.md',
      path: 'features/ft-sub/assets/sub_spec.md',
      scope_type: 'feature',
      scope_id: 'ft-sub',
      source_label: 'ft-sub',
      is_subfeature: false,
      mime_type: 'text/markdown',
      size_bytes: 1200,
      updated_at: '1700000001',
      text_preview: '# Sub Feature Architecture Overview\nThis is a preview snippet.',
    },
  ];

  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, opts?: RequestInit) => {
        if (url.includes('/api/v1/epics/ec-core/assets')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockEpicAssets),
          });
        }
        if (url.includes('/api/v1/features/ft-sub/assets')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockFeatureAssets),
          });
        }
        if (url.includes('/api/v1/assets/open-system')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok', path: 'some/path' }),
          });
        }
        if (url.includes('/api/v1/assets/upload')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve(mockEpicAssets[0]),
          });
        }
        if (url.includes('/api/v1/config')) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({
              assets: {
                allow_utf8_text_fallback: true,
                allowed_image_extensions: ['png', 'jpg'],
                allowed_text_extensions: ['txt', 'md', 'py', 'ipynb'],
              },
            }),
          });
        }
        if (url.includes('/api/v1/assets') && opts?.method === 'DELETE') {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: () => Promise.resolve({ status: 'ok', path: 'some/path' }),
          });
        }
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({}),
        });
      })
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // @verifies spec-ft-core-assets-manager::REQ-004
  it('renders epic assets with origin badges for direct epic assets and sub-feature assets', async () => {
    render(<AssetPanel scopeType="epic" scopeId="ec-core" />);

    await waitFor(() => {
      expect(screen.getByText('mockup.png')).toBeInTheDocument();
      expect(screen.getByText('sub_spec.md')).toBeInTheDocument();
    });

    expect(screen.getByTestId('asset-origin-epic')).toHaveTextContent('epic');
    expect(screen.getByTestId('asset-origin-subfeature')).toHaveTextContent('ft-sub');
  });

  // @verifies spec-ft-core-assets-manager::REQ-005
  it('renders isolated feature assets without epic origin badges', async () => {
    render(<AssetPanel scopeType="feature" scopeId="ft-sub" />);

    await waitFor(() => {
      expect(screen.getByText('sub_spec.md')).toBeInTheDocument();
    });

    expect(screen.queryByTestId('asset-origin-epic')).not.toBeInTheDocument();
    expect(screen.queryByTestId('asset-origin-subfeature')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-core-assets-manager::REQ-006
  it('renders hover preview popover showing text snippet on card mouse enter', async () => {
    render(<AssetPanel scopeType="epic" scopeId="ec-core" />);

    await waitFor(() => {
      expect(screen.getByText('sub_spec.md')).toBeInTheDocument();
    });

    const card = screen.getByTestId('asset-card-sub_spec.md');
    fireEvent.mouseEnter(card);

    expect(screen.getByTestId('asset-hover-popover')).toBeInTheDocument();
    expect(screen.getByText(/Sub Feature Architecture Overview/i)).toBeInTheDocument();

    fireEvent.mouseLeave(card);
    expect(screen.queryByTestId('asset-hover-popover')).not.toBeInTheDocument();
  });

  // @verifies spec-ft-core-assets-manager::REQ-007
  it('triggers onOpenAsset callback when asset card is double clicked', async () => {
    const handleOpen = vi.fn();
    render(<AssetPanel scopeType="epic" scopeId="ec-core" onOpenAsset={handleOpen} />);

    await waitFor(() => {
      expect(screen.getByText('mockup.png')).toBeInTheDocument();
    });

    const card = screen.getByTestId('asset-card-mockup.png');
    fireEvent.doubleClick(card);

    expect(handleOpen).toHaveBeenCalledWith(mockEpicAssets[0]);
  });

  // @verifies spec-ft-core-assets-manager::REQ-008
  it('opens context menu on right click and dispatches open on system', async () => {
    render(<AssetPanel scopeType="epic" scopeId="ec-core" />);

    await waitFor(() => {
      expect(screen.getByText('mockup.png')).toBeInTheDocument();
    });

    const card = screen.getByTestId('asset-card-mockup.png');
    fireEvent.contextMenu(card);

    expect(screen.getByTestId('asset-context-menu')).toBeInTheDocument();
    const openSystemBtn = screen.getByTestId('menu-open-system');

    fireEvent.click(openSystemBtn);

    expect(fetch).toHaveBeenCalledWith(
      '/api/v1/assets/open-system',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ path: 'epics/ec-core/assets/mockup.png' }),
      })
    );
  });

  // @verifies spec-ft-core-assets-manager::REQ-009
  it('opens confirmation modal on context menu delete and dispatches DELETE on confirm', async () => {
    const handleDeleted = vi.fn();
    render(<AssetPanel scopeType="epic" scopeId="ec-core" onAssetDeleted={handleDeleted} />);

    await waitFor(() => {
      expect(screen.getByText('mockup.png')).toBeInTheDocument();
    });

    const card = screen.getByTestId('asset-card-mockup.png');
    fireEvent.contextMenu(card);

    expect(screen.getByTestId('asset-context-menu')).toBeInTheDocument();
    const deleteOption = screen.getByTestId('menu-delete-asset');

    fireEvent.click(deleteOption);

    // Confirmation dialog appears
    expect(screen.getByTestId('asset-delete-dialog')).toBeInTheDocument();
    expect(screen.getByText(/Are you sure you want to permanently delete/i)).toBeInTheDocument();

    const confirmBtn = screen.getByTestId('confirm-delete-btn');
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

    expect(handleDeleted).toHaveBeenCalledWith(mockEpicAssets[0]);
  });

  // @verifies spec-ft-core-assets-manager::REQ-009
  it('cancels deletion when cancel is clicked in confirmation dialog', async () => {
    render(<AssetPanel scopeType="epic" scopeId="ec-core" />);

    await waitFor(() => {
      expect(screen.getByText('mockup.png')).toBeInTheDocument();
    });

    const card = screen.getByTestId('asset-card-mockup.png');
    fireEvent.contextMenu(card);

    const deleteOption = screen.getByTestId('menu-delete-asset');
    fireEvent.click(deleteOption);

    expect(screen.getByTestId('asset-delete-dialog')).toBeInTheDocument();
    const cancelBtn = screen.getByTestId('cancel-delete-btn');
    fireEvent.click(cancelBtn);

    expect(screen.queryByTestId('asset-delete-dialog')).not.toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(
      '/api/v1/assets',
      expect.objectContaining({ method: 'DELETE' })
    );
  });

  // @verifies spec-ft-core-assets-manager::REQ-010
  it('clamps context menu coordinates when right clicking near viewport bottom and right edges', async () => {
    // Mock window innerWidth and innerHeight
    vi.stubGlobal('innerWidth', 1000);
    vi.stubGlobal('innerHeight', 700);

    render(<AssetPanel scopeType="epic" scopeId="ec-core" />);

    await waitFor(() => {
      expect(screen.getByText('mockup.png')).toBeInTheDocument();
    });

    const card = screen.getByTestId('asset-card-mockup.png');
    // Simulate right click near bottom right (clientX: 950, clientY: 680)
    fireEvent.contextMenu(card, { clientX: 950, clientY: 680 });

    const menu = screen.getByTestId('asset-context-menu');
    expect(menu).toBeInTheDocument();

    // MENU_WIDTH: 180, MENU_HEIGHT: 135, PADDING: 10
    // Expected x: 1000 - 180 - 10 = 810px
    // Expected y: 700 - 135 - 10 = 555px
    expect(menu.style.left).toBe('810px');
    expect(menu.style.top).toBe('555px');
  });

  // @verifies spec-ft-core-assets-manager::REQ-011
  it('calls onCountChange callback with asset count on load', async () => {
    const handleCount = vi.fn();
    render(<AssetPanel scopeType="epic" scopeId="ec-core" onCountChange={handleCount} />);

    await waitFor(() => {
      expect(handleCount).toHaveBeenCalledWith(2);
    });
  });

  // @verifies spec-ft-core-assets-manager::REQ-013
  // @verifies spec-ft-core-assets-manager::REQ-014
  it('loads config from /api/v1/config and rejects disallowed binary uploads', async () => {
    render(<AssetPanel scopeType="epic" scopeId="ec-core" />);

    await waitFor(() => {
      expect(screen.getByText('mockup.png')).toBeInTheDocument();
    });

    const dropZone = screen.getByTestId('file-drop-zone');

    // Attempt to drop disallowed binary file
    const badFile = new File([new Uint8Array([0, 1, 2])], 'payload.exe', { type: 'application/x-msdownload' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [badFile] },
    });

    // Error banner displayed and no upload network request dispatched for .exe
    expect(screen.getByText(/unsupported file type/i)).toBeInTheDocument();
    expect(fetch).not.toHaveBeenCalledWith(
      '/api/v1/assets/upload',
      expect.objectContaining({ method: 'POST', body: expect.any(FormData) })
    );

    // Drop allowed .ipynb file
    const ipynbFile = new File(['{"cells":[]}'], 'notebook.ipynb', { type: 'application/json' });
    fireEvent.drop(dropZone, {
      dataTransfer: { files: [ipynbFile] },
    });

    // Network request dispatched for allowed file
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        '/api/v1/assets/upload',
        expect.objectContaining({ method: 'POST' })
      );
    });
  });
});
