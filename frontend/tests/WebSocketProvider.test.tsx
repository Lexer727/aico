import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { ConnectionStatusBanner } from '../src/components/navigation/ConnectionStatusBanner';
import { WebSocketStatus } from '../src/context/WebSocketContext';

// @verifies SPEC-CORE-006::REQ-014
describe('ConnectionStatusBanner Component', () => {
  it('renders status indicator for connected, reconnecting, and offline states', () => {
    const { rerender } = render(
      <ConnectionStatusBanner status={WebSocketStatus.Connected} onReconnect={() => {}} />
    );
    expect(screen.getByText(/connected/i)).toBeInTheDocument();

    rerender(
      <ConnectionStatusBanner status={WebSocketStatus.Reconnecting} onReconnect={() => {}} />
    );
    expect(screen.getByText(/reconnecting/i)).toBeInTheDocument();

    rerender(
      <ConnectionStatusBanner status={WebSocketStatus.Offline} onReconnect={() => {}} />
    );
    expect(screen.getByText(/offline/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /reconnect/i })).toBeInTheDocument();
  });
});
