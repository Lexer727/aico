import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProjectSwitcher } from '../src/components/navigation/ProjectSwitcher';
import { useTabStore } from '../src/stores/useTabStore';

// @verifies SPEC-CORE-006::REQ-003
// @verifies SPEC-CORE-006::REQ-005
describe('ProjectSwitcher', () => {
  const mockProjects = [
    { id: 'proj-1', name: 'Project Alpha' },
    { id: 'proj-2', name: 'Project Beta' },
  ];

  beforeEach(() => {
    useTabStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('renders active project name and toggles dropdown', () => {
    render(<ProjectSwitcher projects={mockProjects} />);
    const trigger = screen.getByTestId('project-select-trigger');
    expect(trigger).toHaveTextContent('Project Alpha');

    fireEvent.click(trigger);
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('switches project on item click and notifies backend', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as any);

    render(<ProjectSwitcher projects={mockProjects} />);
    const trigger = screen.getByTestId('project-select-trigger');
    fireEvent.click(trigger);

    const betaOption = screen.getByText('Project Beta');
    fireEvent.click(betaOption);

    expect(useTabStore.getState().activeProjectId).toBe('proj-2');
    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/projects/active',
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});
