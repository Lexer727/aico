import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EpicHubView } from '../src/features/epic-hub/EpicHubView';
import { useAccordionStore } from '../src/stores/useAccordionStore';

// @verifies spec-ft-core-epic-hub::REQ-001
// @verifies spec-ft-core-epic-hub::REQ-002
// @verifies spec-ft-core-epic-hub::REQ-005
// @verifies spec-ft-core-epic-hub::REQ-011
describe('EpicHubView Component', () => {
  beforeEach(() => {
    useAccordionStore.setState({ collapsedByEntity: {} });
  });
  const mockEpic = {
    id: '001-aico-core',
    title: 'AICO Core SDD Platform',
    status: 'Active',
    verifiedCount: 4,
    totalCount: 7,
    sections: {
      overview: 'Overview content of epic',
      brainstorm: 'Brainstorm ideas and trade-offs',
      specifications: 'EARS Specifications list',
      deepDive: 'Kùzu blast radius analysis',
      taskPlan: 'DAG task plan details',
      assets: 'Multimodal drop assets',
    },
  };

  it('renders consolidated single-page view with all collapsible accordion sections', () => {
    const onPopOut = vi.fn();

    render(<EpicHubView epic={mockEpic} onPopOut={onPopOut} />);

    expect(screen.getByText('AICO Core SDD Platform')).toBeInTheDocument();
    // Summary status badge
    expect(screen.getByText('[4/7 Verified]')).toBeInTheDocument();

    // Check Executive Summary top banner and accordion headers
    expect(screen.getByText('Executive Summary')).toBeInTheDocument();
    expect(screen.getByText(/Features in this Epic/)).toBeInTheDocument();
    expect(screen.getByText('Brainstorm')).toBeInTheDocument();
    expect(screen.getByText(/Architecture Decision Records/)).toBeInTheDocument();
    expect(screen.getByText('Deep Dive')).toBeInTheDocument();
    expect(screen.getByText('Task Plan')).toBeInTheDocument();
    expect(screen.getByText('Assets')).toBeInTheDocument();

    // Pop-out button on Brainstorm accordion
    const popoutBtn = screen.getByTestId('popout-brainstorm');
    fireEvent.click(popoutBtn);
    expect(onPopOut).toHaveBeenCalledWith('001-aico-core', 'brainstorm');
  });

  it('renders overall Task Execution Progress bar in the Task Plan handle even when collapsed', () => {
    const epicWithFeatures = {
      ...mockEpic,
      features: [
        {
          id: 'ft-01',
          name: 'Feature 1',
          tasks: [
            { id: 'TASK-01', title: 'Task 1', status: 'Done' },
            { id: 'TASK-02', title: 'Task 2', status: 'In Progress' },
          ],
        },
      ],
    };

    render(<EpicHubView epic={epicWithFeatures} />);

    // Check handle has progress text
    const handleProgress = screen.getByTestId('task-plan-handle-progress');
    expect(handleProgress).toHaveTextContent('1/2');
    expect(handleProgress).toHaveTextContent('Done (50%)');

    // Collapse Task Plan by clicking handle
    const taskPlanHeader = screen.getByText('Task Plan');
    fireEvent.click(taskPlanHeader);

    // After collapsing, progress in handle is still visible!
    const collapsedHandleProgress = screen.getByTestId('task-plan-handle-progress');
    expect(collapsedHandleProgress).toBeInTheDocument();
    expect(collapsedHandleProgress).toHaveTextContent('1/2');
    expect(collapsedHandleProgress).toHaveTextContent('Done (50%)');
  });

  // @verifies spec-ft-core-assets-manager::REQ-011
  it('renders (x) count badge only when asset count is greater than zero and omits badge when zero', async () => {
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/assets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'a1',
              filename: 'diagram.png',
              path: 'assets/diagram.png',
              scope_type: 'epic',
              scope_id: '001-aico-core',
              source_label: '001-aico-core',
              is_subfeature: false,
              mime_type: 'image/png',
              size_bytes: 1024,
              updated_at: '2026-10-15T00:00:00Z',
            },
            {
              id: 'a2',
              filename: 'doc.txt',
              path: 'assets/doc.txt',
              scope_type: 'epic',
              scope_id: '001-aico-core',
              source_label: '001-aico-core',
              is_subfeature: false,
              mime_type: 'text/plain',
              size_bytes: 512,
              updated_at: '2026-10-15T00:00:00Z',
            },
          ]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }));

    const { rerender } = render(<EpicHubView epic={mockEpic} />);

    // Non-zero asset count badge appears
    const badge = await screen.findByTestId('asset-counter-badge');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('(2)');

    // Now re-render with zero assets
    vi.stubGlobal('fetch', vi.fn().mockImplementation((url: string) => {
      if (url.includes('/assets')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([]),
        });
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
    }));

    rerender(<EpicHubView epic={{ ...mockEpic, id: '002-empty-epic' }} />);
    // Badge should not be in the document
    await waitFor(() => {
      expect(screen.queryByTestId('asset-counter-badge')).toBeNull();
    });
  });
});
