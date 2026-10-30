// @verifies spec-ft-distribution-update-check::TASK-DISTRIBUTION-006-2::REQ-002
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { UpdateBanner, UPDATE_DISMISS_KEY } from '../src/components/layout/UpdateBanner';

describe('UpdateBanner Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders update banner when a newer version is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current_version: '0.2.0',
        latest_version: '0.3.0',
        update_available: true,
        release_url: 'https://github.com/Lexer727/aico/releases/tag/v0.3.0',
        checked_at: '2026-10-30T20:00:00Z',
      }),
    } as Response);

    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('update-banner')).toBeInTheDocument();
    });

    expect(screen.getByText(/A new version of AICO is available:/i)).toBeInTheDocument();
    expect(screen.getByText('v0.3.0')).toBeInTheDocument();
    expect(screen.getByText(/current: v0\.2\.0/i)).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /View Release & Download/i });
    expect(link).toHaveAttribute('href', 'https://github.com/Lexer727/aico/releases/tag/v0.3.0');
  });

  it('does not render when update_available is false', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current_version: '0.2.0',
        latest_version: '0.2.0',
        update_available: false,
        release_url: null,
        checked_at: '2026-10-30T20:00:00Z',
      }),
    } as Response);

    const { container } = render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
    });

    expect(container.firstChild).toBeNull();
  });

  it('silently degrades and does not render when fetch fails', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    const { container } = render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
    });

    expect(container.firstChild).toBeNull();
  });

  it('dismisses banner and persists to localStorage on dismiss click', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current_version: '0.2.0',
        latest_version: '0.4.0',
        update_available: true,
        release_url: 'https://github.com/Lexer727/aico/releases/tag/v0.4.0',
        checked_at: '2026-10-30T20:00:00Z',
      }),
    } as Response);

    render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.getByTestId('update-banner')).toBeInTheDocument();
    });

    const dismissBtn = screen.getByTestId('dismiss-update-banner');
    fireEvent.click(dismissBtn);

    expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
    expect(localStorage.getItem(UPDATE_DISMISS_KEY)).toBe('0.4.0');
  });

  it('does not render if the latest version is already dismissed in localStorage', async () => {
    localStorage.setItem(UPDATE_DISMISS_KEY, '0.5.0');

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        current_version: '0.2.0',
        latest_version: '0.5.0',
        update_available: true,
        release_url: 'https://github.com/Lexer727/aico/releases/tag/v0.5.0',
        checked_at: '2026-10-30T20:00:00Z',
      }),
    } as Response);

    const { container } = render(<UpdateBanner />);

    await waitFor(() => {
      expect(screen.queryByTestId('update-banner')).not.toBeInTheDocument();
    });

    expect(container.firstChild).toBeNull();
  });
});
