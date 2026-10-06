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

    const openSpecBtn = screen.getByText('Open Spec Document');
    fireEvent.click(openSpecBtn);
    expect(onOpenSpec).toHaveBeenCalledWith('SPEC-CORE-001', 'Host Runtime & Local HTTP/WebSocket Server');
  });

  it('renders Scope Boundaries on left accordion and Executive Summary in overview', () => {
    const featureWithScopes = {
      ...mockFeature,
      description: 'Custom Executive Summary for feature',
      in_scope: ['In-scope item 1', 'In-scope item 2'],
      out_of_scope: ['Out-of-scope item 1'],
    };

    render(<FeatureViewer feature={featureWithScopes} />);

    // Executive summary in overview is visible
    expect(screen.getByText('Custom Executive Summary for feature')).toBeInTheDocument();

    // Scope Boundaries accordion header is visible
    const scopeAccordion = screen.getByText(/Scope Boundaries \(3\)/);
    expect(scopeAccordion).toBeInTheDocument();

    // Initially closed: in-scope items not visible
    expect(screen.queryByText('In-scope item 1')).toBeNull();

    // Click to open Scope Boundaries
    fireEvent.click(scopeAccordion);

    // In-Scope and Out-of-Scope items become visible
    expect(screen.getByText('In-scope item 1')).toBeInTheDocument();
    expect(screen.getByText('In-scope item 2')).toBeInTheDocument();
    expect(screen.getByText('Out-of-scope item 1')).toBeInTheDocument();
  });
});
