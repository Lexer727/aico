import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { FeatureViewer } from '../src/features/feature-viewer/FeatureViewer';

// @verifies SPEC-CORE-007::REQ-001
// @verifies SPEC-CORE-007::REQ-004
describe('FeatureViewer Component', () => {
  const mockFeature = {
    id: '01-host-runtime',
    name: 'Host Runtime & Local Server',
    epicId: '001-aico-core',
    specId: 'SPEC-CORE-001',
    specTitle: 'Host Runtime & Local HTTP/WebSocket Server',
    planId: 'PLAN-CORE-001',
    planTitle: 'Host Runtime & Local Axum Server',
    status: 'Completed',
  };

  it('renders feature bundle with linked SPEC and PLAN', () => {
    const onOpenSpec = vi.fn();
    const onOpenPlan = vi.fn();

    render(
      <FeatureViewer
        feature={mockFeature}
        onOpenSpec={onOpenSpec}
        onOpenPlan={onOpenPlan}
      />
    );

    expect(screen.getByText('FEATURE: 01-host-runtime')).toBeInTheDocument();
    expect(screen.getByText('Host Runtime & Local Server')).toBeInTheDocument();
    expect(screen.getByText('SPEC-CORE-001')).toBeInTheDocument();
    expect(screen.getByText('PLAN-CORE-001')).toBeInTheDocument();

    const openSpecBtn = screen.getByText('Open Spec in Tab');
    fireEvent.click(openSpecBtn);
    expect(onOpenSpec).toHaveBeenCalledWith('SPEC-CORE-001', 'Host Runtime & Local HTTP/WebSocket Server');
  });
});
