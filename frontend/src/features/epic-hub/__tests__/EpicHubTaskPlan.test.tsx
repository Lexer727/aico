import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';
import { EpicHubView } from '../EpicHubView';
import { ShellLayout } from '../../../components/layout/ShellLayout';
import { ProjectSwitcher } from '../../../components/navigation/ProjectSwitcher';
import { useAccordionStore } from '../../../stores/useAccordionStore';

// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-1::REQ-001
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-2::REQ-002
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-2::REQ-005
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-2::REQ-008
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-3::REQ-009
describe('EpicHub Task Plan & ShellLayout Refinements', () => {
  beforeEach(() => {
    useAccordionStore.setState({ collapsedByEntity: {} });
    vi.restoreAllMocks();
  });

  const mockEpicWithFeatures = {
    id: 'ec-core',
    title: 'Core Platform Epic',
    status: 'In Progress',
    sections: {
      overview: 'Overview',
      taskPlan: 'Task Plan',
    },
    features: [
      {
        id: 'ft-completed-01',
        name: 'Completed Feature 01',
        status: 'Completed',
        tasks: [
          { id: 'TASK-01', title: 'Task 1', status: 'Done' },
          { id: 'TASK-02', title: 'Task 2', status: 'Done' },
        ],
      },
      {
        id: 'ft-active-02',
        name: 'Active Feature 02',
        status: 'In Progress',
        tasks: [
          { id: 'TASK-03', title: 'Task 3', status: 'In Progress' },
          { id: 'TASK-04', title: 'Task 4', status: 'Pending' },
        ],
      },
    ],
  };

  it('verifies REQ-001: ShellLayout renders AICO WORKSPACE header without pulsing status dot', () => {
    const { container } = render(
      <ShellLayout>
        <div>Content</div>
      </ShellLayout>
    );

    const header = screen.getByText('AICO WORKSPACE');
    expect(header).toBeInTheDocument();

    // Verify there is no pulsing blue status dot in the header container
    const headerParent = header.parentElement;
    expect(headerParent).toBeInTheDocument();
    const pulseDots = container.querySelectorAll('.animate-pulse');
    // Ensure no child next to AICO WORKSPACE has animate-pulse with bg-indigo-500
    const dotNearHeader = headerParent?.querySelector('.bg-indigo-500.animate-pulse');
    expect(dotNearHeader).toBeNull();
  });

  it('verifies REQ-002: View Feature button is omitted and ft-* badge triggers onOpenFeature', () => {
    const onOpenFeature = vi.fn();

    render(
      <EpicHubView
        epic={mockEpicWithFeatures}
        onOpenFeature={onOpenFeature}
      />
    );

    // 1. "View Feature" buttons must NOT be rendered in the document
    expect(screen.queryByText('View Feature')).toBeNull();

    // 2. The feature badge ft-completed-01 is a clickable button that triggers onOpenFeature
    const featBadge = screen.getByTestId('feature-badge-ft-completed-01');
    expect(featBadge).toBeInTheDocument();
    expect(featBadge.tagName.toLowerCase()).toBe('button');

    fireEvent.click(featBadge);
    expect(onOpenFeature).toHaveBeenCalledWith('ft-completed-01', 'Completed Feature 01');
  });

  it('verifies REQ-005 & REQ-008: 100% completed feature auto-collapses by default and can be toggled', () => {
    render(<EpicHubView epic={mockEpicWithFeatures} />);

    // Incomplete feature (ft-active-02) must be expanded initially
    const activeTaskList = screen.getByTestId('feature-task-list-ft-active-02');
    expect(activeTaskList).not.toHaveClass('hidden');

    // 100% completed feature (ft-completed-01) must be collapsed initially
    const completedTaskList = screen.getByTestId('feature-task-list-ft-completed-01');
    expect(completedTaskList).toHaveClass('hidden');

    // Clicking header of completed feature expands its tasks
    const completedHeader = screen.getByTestId('feature-header-ft-completed-01');
    fireEvent.click(completedHeader);
    expect(completedTaskList).not.toHaveClass('hidden');

    // Clicking header again collapses its tasks
    fireEvent.click(completedHeader);
    expect(completedTaskList).toHaveClass('hidden');
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-4::REQ-004
  it('verifies REQ-004: ProjectSwitcher allows creating a new project via POST /api/v1/projects', async () => {
    const mockProjects = [
      { id: 'proj-1', name: 'Project Alpha' },
    ];
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'proj-new', name: 'Project New' }),
    } as any);

    const onRefreshProjects = vi.fn();
    const onSelectProject = vi.fn();

    render(
      <ProjectSwitcher
        projects={mockProjects}
        onRefreshProjects={onRefreshProjects}
        onSelectProject={onSelectProject}
      />
    );

    // Open dropdown
    const trigger = screen.getByTestId('project-select-trigger');
    fireEvent.click(trigger);

    // Click "+ New Project"
    const newProjectBtn = screen.getByTestId('btn-new-project-trigger');
    expect(newProjectBtn).toBeInTheDocument();
    fireEvent.click(newProjectBtn);

    // Input form is visible
    const input = screen.getByTestId('input-new-project-name');
    expect(input).toBeInTheDocument();

    // Type new project name and submit
    fireEvent.change(input, { target: { value: 'Project New' } });
    const createBtn = screen.getByTestId('btn-submit-create-project');
    fireEvent.click(createBtn);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            project_name: 'project-new',
            name: 'Project New Specs',
            display_name: 'Project New Specs',
          }),
        })
      );
    });

    expect(onRefreshProjects).toHaveBeenCalled();
  });
});
