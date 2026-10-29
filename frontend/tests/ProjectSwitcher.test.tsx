import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSwitcher } from '../src/components/navigation/ProjectSwitcher';
import { useTabStore } from '../src/stores/useTabStore';

// @verifies ft-core-webui-shell::TASK-CORE-006-7::REQ-003
// @verifies ft-core-webui-shell::TASK-CORE-006-7::REQ-005
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-20::REQ-026
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-21::REQ-027
// @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-21::REQ-028
describe('ProjectSwitcher', () => {
  const mockProjects = [
    { id: 'aico-specs', name: 'AICO Specs' },
    { id: 'proj-2-specs', name: 'Project Beta' },
  ];

  beforeEach(() => {
    useTabStore.getState().reset();
    vi.restoreAllMocks();
  });

  it('renders active project display name, toggles dropdown, and renders standalone New Project button outside dropdown', () => {
    render(<ProjectSwitcher projects={mockProjects} />);
    const trigger = screen.getByTestId('project-select-trigger');
    expect(trigger).toHaveTextContent('AICO Specs');

    // New Project trigger button is visible right next to the dropdown without opening the dropdown
    const newProjectBtn = screen.getByTestId('btn-new-project-trigger');
    expect(newProjectBtn).toBeInTheDocument();
    expect(screen.queryByTestId('project-select-dropdown')).not.toBeInTheDocument();

    fireEvent.click(trigger);
    expect(screen.getByTestId('project-select-dropdown')).toBeInTheDocument();
    expect(screen.getByText('Project Beta')).toBeInTheDocument();
  });

  it('switches project on item click, awaits backend active switch, and invokes onSelectProject', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    } as any);
    const onSelectProject = vi.fn();

    render(<ProjectSwitcher projects={mockProjects} onSelectProject={onSelectProject} />);
    const trigger = screen.getByTestId('project-select-trigger');
    fireEvent.click(trigger);

    const betaOption = screen.getByText('Project Beta');
    fireEvent.click(betaOption);

    await waitFor(() => {
      expect(useTabStore.getState().activeProjectId).toBe('proj-2-specs');
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/projects/active',
        expect.objectContaining({
          method: 'POST',
        })
      );
      expect(onSelectProject).toHaveBeenCalledWith('proj-2-specs');
    });
  });

  it('opens OmniSearch-style ProjectConfigModal on clicking New Project button and submits .aico-project.json configuration', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/api/v1/projects/active')) {
        return { ok: true, json: async () => ({ status: 'ok' }) } as any;
      }
      return {
        ok: true,
        status: 201,
        json: async () => ({ id: 'my-service-specs', name: 'My Service UI' }),
      } as any;
    });
    const onRefreshProjects = vi.fn();
    const onSelectProject = vi.fn();

    render(
      <ProjectSwitcher
        projects={mockProjects}
        onRefreshProjects={onRefreshProjects}
        onSelectProject={onSelectProject}
      />
    );

    fireEvent.click(screen.getByTestId('btn-new-project-trigger'));
    expect(screen.getByTestId('project-config-modal')).toBeInTheDocument();

    // Enter project_name and verify live <project_name>-specs preview
    const slugInput = screen.getByTestId('input-new-project-name');
    fireEvent.change(slugInput, { target: { value: 'my-service' } });
    expect(screen.getByTestId('preview-specs-folder')).toHaveTextContent('my-service-specs');

    // Customize display name and optional specs URL
    const displayNameInput = screen.getByTestId('input-project-display-name') as HTMLInputElement;
    expect(displayNameInput.value).toBe('My Service Specs');
    fireEvent.change(displayNameInput, { target: { value: 'My Service UI' } });

    // Add a repository and verify fixed ../codebase/<id> read-only path preview
    fireEvent.click(screen.getByTestId('btn-add-manifest-repo'));
    const repoIdInput = screen.getByTestId('input-repo-id-0') as HTMLInputElement;
    expect(repoIdInput.value).toBe('my-service');
    fireEvent.change(repoIdInput, { target: { value: 'service-backend' } });

    const repoPathPreview = screen.getByTestId('preview-repo-path-0') as HTMLInputElement;
    expect(repoPathPreview.value).toBe('../codebase/service-backend');
    expect(repoPathPreview.readOnly).toBe(true);

    // Submit form
    fireEvent.click(screen.getByTestId('btn-submit-create-project'));

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        '/api/v1/projects',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            project_name: 'my-service',
            name: 'My Service UI',
            display_name: 'My Service UI',
            url: undefined,
            repositories: [
              {
                id: 'service-backend',
                name: 'My Service Codebase',
                path: '../codebase/service-backend',
                type: 'codebase',
                url: undefined,
              },
            ],
          }),
        })
      );
      expect(onRefreshProjects).toHaveBeenCalled();
      expect(onSelectProject).toHaveBeenCalledWith('my-service-specs');
    });
  });
});
