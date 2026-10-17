import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import React from 'react';
import { MobilePairingModal } from '../src/components/navigation/MobilePairingModal';
import { TerminalConsole } from '../src/components/terminal/TerminalConsole';
import { MainWorkspace } from '../src/App';
import { useTabStore, getWindowId } from '../src/stores/useTabStore';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  configurable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

vi.mock('@xterm/xterm', () => {
  class Terminal {
    cols = 120;
    rows = 30;
    options: Record<string, unknown> = {};
    element: HTMLElement | null = null;
    loadAddon(addon: any) {
      addon?.activate?.(this);
    }
    open(container: HTMLElement) {
      const root = document.createElement('div');
      root.className = 'xterm';
      container.appendChild(root);
      this.element = root;
    }
    write() {}
    clear() {}
    reset() {}
    focus() {}
    dispose() {
      this.element?.remove();
    }
    onData() {
      return { dispose: () => {} };
    }
    onResize() {
      return { dispose: () => {} };
    }
    attachCustomKeyEventHandler() {}
  }
  return { Terminal };
});

vi.mock('@xterm/addon-fit', () => {
  class FitAddon {
    fit() {}
    activate() {}
    dispose() {}
  }
  return { FitAddon };
});

const mockSendMessage = vi.fn();
let currentLastMessage: any = null;
let currentStatus: 'connected' | 'reconnecting' | 'offline' = 'connected';

vi.mock('../src/context/WebSocketContext', async () => {
  const actual = await vi.importActual<any>('../src/context/WebSocketContext');
  return {
    ...actual,
    useWebSocket: () => ({
      status: currentStatus,
      reconnect: vi.fn(),
      sendMessage: mockSendMessage,
      lastMessage: currentLastMessage,
    }),
  };
});

// @verifies ft-core-webui-shell::TASK-CORE-006-17::REQ-019
// @verifies ft-core-webui-shell::TASK-CORE-006-26::REQ-020
// @verifies ft-core-webui-shell::TASK-CORE-006-31::REQ-023
// @verifies ft-terminal-xterm-ui::TASK-XTERM-012::REQ-015
describe('Mobile Pairing and Window/Terminal Synchronization', () => {
  beforeEach(() => {
    sessionStorage.clear();
    useTabStore.getState().reset();
    vi.restoreAllMocks();
    mockSendMessage.mockClear();
    currentLastMessage = null;
    currentStatus = 'connected';
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1200 });
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-17::REQ-019
  it('renders MobilePairingModal with SVG QR code and copyable pairing URL containing windowId', async () => {
    const mockPairingData = {
      lan_ip: '192.168.1.50',
      port: 4242,
      token: 'test-token-xyz',
      pairing_url: 'http://192.168.1.50:4242/?token=test-token-xyz',
    };

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPairingData,
    });
    vi.stubGlobal('fetch', mockFetch);

    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText: writeTextMock },
      configurable: true,
    });

    const onClose = vi.fn();
    render(
      <MobilePairingModal
        isOpen={true}
        onClose={onClose}
        windowId="win-desktop-test-1"
      />
    );

    expect(screen.getByTestId('mobile-pairing-modal')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('qr-code-svg-container')).toBeInTheDocument();
    });

    const input = screen.getByTestId('pairing-url-input') as HTMLInputElement;
    expect(input.value).toBe('http://192.168.1.50:4242/?token=test-token-xyz&win=win-desktop-test-1');

    // Test copy button
    const copyBtn = screen.getByTestId('copy-pairing-url-btn');
    fireEvent.click(copyBtn);
    expect(writeTextMock).toHaveBeenCalledWith('http://192.168.1.50:4242/?token=test-token-xyz&win=win-desktop-test-1');

    // Test close button
    const closeBtn = screen.getByTestId('close-pairing-modal-btn');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-17::REQ-019
  it('automatically dismisses desktop pairing modal when companion_paired message is received', async () => {
    const mockPairingData = {
      lan_ip: '192.168.1.50',
      port: 4242,
      token: 'token-123',
      pairing_url: 'http://192.168.1.50:4242/?token=token-123',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockPairingData,
    }));

    const { rerender } = render(<MainWorkspace />);

    // Open desktop QR pairing modal
    const pairBtn = screen.getByTestId('qr-pairing-btn');
    fireEvent.click(pairBtn);

    expect(screen.getByTestId('mobile-pairing-modal')).toBeInTheDocument();

    // Companion connects and desktop receives companion_paired for this window
    currentLastMessage = {
      topic: 'companion_paired',
      payload: { windowId: getWindowId() },
    };

    await act(async () => {
      rerender(<MainWorkspace />);
    });

    // Pairing modal should have automatically dismissed
    expect(screen.queryByTestId('mobile-pairing-modal')).not.toBeInTheDocument();
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-17::REQ-019
  it('notifies desktop with companion_paired on mobile connection when win query param is present', async () => {
    window.history.replaceState({}, '', '/?companion=true&win=win-desktop-99');

    render(<MainWorkspace />);

    // Mobile companion should immediately dispatch companion_paired with windowId
    expect(mockSendMessage).toHaveBeenCalledWith('companion_paired', {
      windowId: 'win-desktop-99',
    });
    // And request desktop windows
    expect(mockSendMessage).toHaveBeenCalledWith('request_desktop_windows', {
      from: 'companion',
    });
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-26::REQ-020
  it('synchronizes main view tabs bidirectionally between desktop and mobile with echo suppression', async () => {
    window.history.replaceState({}, '', '/?companion=true&win=win-desktop-99');

    const { rerender } = render(<MainWorkspace />);

    // 1. Companion receives desktop_window_state from targeted desktop window
    currentLastMessage = {
      topic: 'desktop_window_state',
      payload: {
        windowId: 'win-desktop-99',
        title: 'Spec Auth',
        activeTabId: 'spec-auth',
        tabs: [{ id: 'spec-auth', title: 'spec-auth', type: 'spec' }],
        activeProject: 'default',
      },
    };

    await act(async () => {
      rerender(<MainWorkspace />);
    });

    // Companion tab store should be populated with desktop's tab
    expect(useTabStore.getState().activeTabId).toBe('spec-auth');
    expect(useTabStore.getState().getProjectTabs('default')).toHaveLength(1);

    mockSendMessage.mockClear();

    // 2. Open a new tab on mobile companion
    await act(async () => {
      useTabStore.getState().openTab('default', {
        id: 'plan-auth',
        title: 'plan-auth',
        type: 'plan',
      });
    });

    // Companion should have dispatched companion_tabs_update to desktop window
    expect(mockSendMessage).toHaveBeenCalledWith(
      'companion_tabs_update',
      expect.objectContaining({
        targetWindowId: 'win-desktop-99',
        activeTabId: 'plan-auth',
        activeProject: 'default',
        tabs: expect.arrayContaining([
          expect.objectContaining({ id: 'spec-auth' }),
          expect.objectContaining({ id: 'plan-auth' }),
        ]),
      })
    );

    // 3. Desktop broadcasts back updated state, mobile absorbs without echo
    mockSendMessage.mockClear();
    currentLastMessage = {
      topic: 'desktop_window_state',
      payload: {
        windowId: 'win-desktop-99',
        title: 'Plan Auth',
        activeTabId: 'plan-auth',
        tabs: [
          { id: 'spec-auth', title: 'spec-auth', type: 'spec' },
          { id: 'plan-auth', title: 'plan-auth', type: 'plan' },
        ],
        activeProject: 'default',
      },
    };

    await act(async () => {
      rerender(<MainWorkspace />);
    });

    // Tabs should remain intact and not rolled back or closed
    expect(useTabStore.getState().getProjectTabs('default')).toHaveLength(2);
    expect(useTabStore.getState().activeTabId).toBe('plan-auth');
    // Echo suppression prevents duplicate companion_tabs_update
    expect(mockSendMessage).not.toHaveBeenCalledWith('companion_tabs_update', expect.anything());
  });

  // @verifies ft-terminal-xterm-ui::TASK-XTERM-012::REQ-015
  it('synchronizes terminal tabs from desktop to mobile companion and sends updates on click', async () => {
    // 1. Mount Desktop TerminalConsole
    const { unmount: unmountDesktop } = render(
      <TerminalConsole isMobile={false} />
    );

    // Desktop should have broadcasted terminal state
    expect(mockSendMessage).toHaveBeenCalledWith('companion_terminals_sync', expect.objectContaining({
      tabs: expect.any(Array),
      activeTabId: expect.any(String),
    }));

    unmountDesktop();
    mockSendMessage.mockClear();

    // 2. Mount Mobile Companion TerminalConsole
    const { rerender } = render(
      <TerminalConsole isMobile={true} targetWindowId="win-target-42" />
    );

    // Companion requests terminal state on mount
    expect(mockSendMessage).toHaveBeenCalledWith('request_companion_terminals', {
      targetWindowId: 'win-target-42',
    });

    // Simulate receiving companion_terminals_sync from target desktop window
    const syncedTabs = [
      { id: 'agy', name: 'Antigravity', shortName: 'AGY', shell: 'agy' as const },
      { id: 'term-remote-1', name: 'PowerShell 1', shortName: 'ps 1', shell: 'powershell' as const },
    ];

    currentLastMessage = {
      topic: 'companion_terminals_sync',
      payload: {
        windowId: 'win-target-42',
        tabs: syncedTabs,
        activeTabId: 'term-remote-1',
      },
    };

    await act(async () => {
      rerender(
        <TerminalConsole isMobile={true} targetWindowId="win-target-42" />
      );
    });

    // Mobile receives tabs matching targetWindowId
    expect(screen.getByText('Antigravity')).toBeInTheDocument();
    expect(screen.getByText('PowerShell 1')).toBeInTheDocument();

    // 3. User switches tab on mobile companion
    mockSendMessage.mockClear();
    const agyTab = screen.getByText('Antigravity');
    fireEvent.click(agyTab);

    // Mobile dispatches companion_terminals_update to target window
    expect(mockSendMessage).toHaveBeenCalledWith('companion_terminals_update', {
      targetWindowId: 'win-target-42',
      activeTabId: 'agy',
    });
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-22::REQ-013
  // @verifies ft-core-webui-shell::TASK-CORE-006-26::REQ-020
  // @verifies ft-core-webui-shell::TASK-CORE-006-26::REQ-022
  it('renders adaptive multi-line top header and supports swappable full-screen views on mobile companion', async () => {
    window.history.replaceState({}, '', '/?companion=true&win=win-desktop-mobile-1');

    render(<MainWorkspace />);

    // Header has two-line flex-col styling with far-right icon-only connection status
    const header = screen.getByRole('banner');
    expect(header.className).toContain('flex-col');
    expect(header.className).toContain('min-h-12');
    expect(screen.getByTestId('connection-status-icon')).toBeInTheDocument();

    // Controls are present in header
    expect(screen.getByTestId('mobile-window-switcher')).toBeInTheDocument();
    expect(screen.getByTestId('header-omnisearch-btn')).toBeInTheDocument();
    expect(screen.getByTestId('history-back-btn')).toBeInTheDocument();

    // Bottom navbar is present with all 3 view triggers
    const navbar = screen.getByTestId('mobile-bottom-navbar');
    expect(navbar).toBeInTheDocument();

    // Default view is 'main': TabBar is present
    expect(screen.getByTestId('mobile-tab-main')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-terminal-fullscreen')).not.toBeInTheDocument();

    // Switch to Terminal view
    const termTab = screen.getByTestId('mobile-tab-terminal');
    fireEvent.click(termTab);

    // Full-screen terminal console is rendered
    expect(screen.getByTestId('mobile-terminal-fullscreen')).toBeInTheDocument();

    // Switch to Tree view
    const treeTab = screen.getByTestId('mobile-tab-tree');
    fireEvent.click(treeTab);

    // Full-screen tree view is rendered
    expect(screen.getByTestId('mobile-tree-view')).toBeInTheDocument();
    expect(screen.queryByTestId('mobile-terminal-fullscreen')).not.toBeInTheDocument();
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-26::REQ-020
  // @verifies ft-terminal-xterm-ui::TASK-XTERM-012::REQ-015
  it('toggles custom desktop window switcher dropdown and propagates kill terminal to desktop window', async () => {
    window.history.replaceState({}, '', '/?companion=true&win=win-desktop-mobile-1');

    const { rerender } = render(<MainWorkspace />);

    // Populate desktop windows
    currentLastMessage = {
      topic: 'desktop_window_state',
      payload: {
        windowId: 'win-desktop-2',
        title: 'Editor Window',
        activeTabId: 'spec-1',
        tabs: [{ id: 'spec-1', title: 'Spec 1', type: 'spec' }],
        activeProject: 'default',
      },
    };

    await act(async () => {
      rerender(<MainWorkspace />);
    });

    // Custom dropdown trigger should open floating menu
    const trigger = screen.getByTestId('mobile-window-switcher');
    fireEvent.click(trigger);

    expect(screen.getByTestId('mobile-window-dropdown-menu')).toBeInTheDocument();
    expect(screen.getByTestId('window-option-win-desktop-2')).toBeInTheDocument();

    // Select window option
    fireEvent.click(screen.getByTestId('window-option-win-desktop-2'));
    expect(screen.queryByTestId('mobile-window-dropdown-menu')).not.toBeInTheDocument();

    // Now switch to Terminal view on mobile companion
    const termTab = screen.getByTestId('mobile-tab-terminal');
    fireEvent.click(termTab);

    // Send companion terminals sync to populate tabs
    currentLastMessage = {
      topic: 'companion_terminals_sync',
      payload: {
        windowId: 'win-desktop-2',
        tabs: [{ id: 'term-to-kill', name: 'PowerShell', shortName: 'ps', shell: 'powershell' }],
        activeTabId: 'term-to-kill',
      },
    };

    await act(async () => {
      rerender(<MainWorkspace />);
    });

    expect(screen.getByText('PowerShell')).toBeInTheDocument();

    // Click kill terminal button
    mockSendMessage.mockClear();
    const killBtn = screen.getByTestId('kill-terminal-btn');
    fireEvent.click(killBtn);

    // Must dispatch companion_terminals_update with killTabId
    expect(mockSendMessage).toHaveBeenCalledWith('companion_terminals_update', expect.objectContaining({
      targetWindowId: 'win-desktop-2',
      killTabId: 'term-to-kill',
      tabs: [],
    }));
  });

  // @verifies ft-core-webui-shell::TASK-CORE-006-31::REQ-023
  it('renders centered omni-search bar trigger on desktop header with Ctrl+K shortcut indicator (REQ-023)', () => {
    window.history.replaceState({}, '', '/');
    render(<MainWorkspace />);

    const searchBtn = screen.getByTestId('header-omnisearch-btn');
    expect(searchBtn).toBeInTheDocument();
    expect(searchBtn).toHaveTextContent('Search workspace, epics, specs...');
    expect(searchBtn).toHaveTextContent('Ctrl+K');

    // Global viewport centered container
    const parentContainer = searchBtn.parentElement;
    expect(parentContainer?.className).toContain('fixed');
    expect(parentContainer?.className).toContain('inset-x-0');
    expect(parentContainer?.className).toContain('justify-center');

    // Clicking trigger opens OmniSearchModal
    fireEvent.click(searchBtn);
    expect(screen.getByPlaceholderText(/search across all projects/i)).toBeInTheDocument();
  });
});
