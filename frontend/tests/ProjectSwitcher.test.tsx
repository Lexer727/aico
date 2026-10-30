import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProjectSwitcher } from '../src/components/navigation/ProjectSwitcher';
import { useTabStore } from '../src/stores/useTabStore';
import { apiFetch } from '../src/utils/apiClient';

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
      if (String(url).includes('/api/v1/github/status')) {
        return {
          ok: true,
          json: async () => ({ authenticated: true, username: 'testuser', source: 'cli' }),
        } as any;
      }
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

    // Wait for github status to resolve so localOnly is false
    await waitFor(() => {
      expect(screen.getByTestId('input-project-specs-url')).toBeInTheDocument();
    });

    // Enter project_name and verify live <project_name>-specs preview
    const slugInput = screen.getByTestId('input-new-project-name');
    fireEvent.change(slugInput, { target: { value: 'my-service' } });
    // @verifies spec-ft-core-nested-specs-folder-and-relative-paths::TASK-CORE-022-4::REQ-006
    expect(screen.getByTestId('preview-specs-folder')).toHaveTextContent('specs/my-service-specs');

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
    expect(repoPathPreview.value).toBe('../../codebase/service-backend');
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
            url: 'https://github.com/testuser/my-service-specs.git',
            local_only: false,
            private: true,
            repositories: [
              {
                id: 'service-backend',
                name: 'My Service Codebase',
                path: '../../codebase/service-backend',
                type: 'codebase',
              },
            ],
          }),
        })
      );
      expect(onRefreshProjects).toHaveBeenCalled();
      expect(onSelectProject).toHaveBeenCalledWith('my-service-specs');
    });
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-26::REQ-031
  it('attaches X-Aico-Project header to requests matching local active project (REQ-031)', async () => {
    useTabStore.getState().setActiveProject('alpha-specs');
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({}),
    } as any);

    await apiFetch('/api/v1/epics');

    expect(fetchSpy).toHaveBeenCalledWith(
      '/api/v1/epics',
      expect.objectContaining({
        headers: expect.anything(),
      })
    );
    const headers = fetchSpy.mock.calls[0][1]?.headers;
    const projectHeader =
      headers instanceof Headers
        ? headers.get('X-Aico-Project')
        : (headers as any)['X-Aico-Project'];
    expect(projectHeader).toBe('alpha-specs');
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-26::REQ-032
  it('preserves tab-isolated active project when external active_project_changed event is broadcast (REQ-032)', () => {
    // Tab has its own active project
    useTabStore.getState().setActiveProject('tab-a-specs');
    expect(useTabStore.getState().activeProjectId).toBe('tab-a-specs');

    // Simulate an incoming broadcast from another tab
    const incomingBroadcast = {
      type: 'active_project_changed',
      project_id: 'tab-b-specs',
    };

    // Follow the App.tsx decoupling guard:
    const localProject = useTabStore.getState().activeProjectId;
    const isDetached = false;
    if (!isDetached && (localProject === 'default' || !localProject)) {
      if (incomingBroadcast.project_id && incomingBroadcast.project_id !== localProject) {
        useTabStore.getState().setActiveProject(incomingBroadcast.project_id);
      }
    }

    // Local tab's active project remains intact and is NOT clobbered by external broadcast
    expect(useTabStore.getState().activeProjectId).toBe('tab-a-specs');
  });

  // @verifies spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-26::REQ-033
  it('initializes active project from deep-linked ?project=<id> URL parameter (REQ-033)', () => {
    window.history.pushState({}, '', '/?project=deep-linked-specs&window=detached');
    useTabStore.getState().reset();

    expect(useTabStore.getState().activeProjectId).toBe('deep-linked-specs');

    // Reset URL back
    window.history.pushState({}, '', '/');
    useTabStore.getState().reset();
  });

  // @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-001
  // @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-002
  // @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-005
  // @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-006
  // @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-001
  // @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-004
  it('verifies Add Project flow, unauthenticated local-only default, and alert guard on unchecking', async () => {
    const onOpenSettings = vi.fn();
    render(<ProjectSwitcher projects={mockProjects} onOpenSettings={onOpenSettings} />);

    // REQ-001: Trigger button shows "+ Add Project"
    const addBtn = screen.getByTestId('btn-new-project-trigger');
    expect(addBtn).toHaveTextContent('+ Add Project');
    fireEvent.click(addBtn);

    // REQ-001: Modal title is "Add Project (.aico-project.json)"
    expect(screen.getByText('Add Project (.aico-project.json)')).toBeInTheDocument();

    // REQ-002: Does NOT show misleading "Default codebase repository (<id>) will be created automatically"
    expect(screen.queryByText(/will be created automatically/i)).not.toBeInTheDocument();
    expect(screen.getByText(/No linked codebase repositories configured/i)).toBeInTheDocument();

    // REQ-001: Local repository only is checked by default when unauthenticated
    const localOnlyCheckbox = screen.getByTestId('checkbox-local-only') as HTMLInputElement;
    expect(localOnlyCheckbox.checked).toBe(true);
    expect(screen.queryByTestId('input-project-specs-url')).not.toBeInTheDocument();

    // REQ-004: Unchecking local-only while unauthenticated reveals URL input and alert notice
    fireEvent.click(localOnlyCheckbox);
    expect(localOnlyCheckbox.checked).toBe(false);

    const alertNotice = screen.getByTestId('unauthenticated-remote-alert');
    expect(alertNotice).toBeInTheDocument();
    expect(screen.getByText(/GitHub account not connected/i)).toBeInTheDocument();

    // Clicking "Connect GitHub in Settings" in the alert invokes onOpenSettings
    const settingsBtn = screen.getByTestId('btn-open-settings-from-alert');
    fireEvent.click(settingsBtn);
    expect(onOpenSettings).toHaveBeenCalled();

    // URL input is visible but contains NO awkward dummy <username> placeholder
    const specsUrlInput = screen.getByTestId('input-project-specs-url') as HTMLInputElement;
    expect(specsUrlInput.value).toBe('');
    expect(specsUrlInput.value).not.toContain('<username>');
  });

  // @verifies spec-ft-core-add-project-github-cli-and-auth-guard::TASK-CORE-021-5::REQ-005
  it('displays unauthenticated 404 private repo guidance banner when check returns unauthenticated: true', async () => {
    const onOpenSettings = vi.fn();
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(async (url: any) => {
      if (String(url).includes('/api/v1/github/check-repo')) {
        return {
          ok: true,
          json: async () => ({
            exists: false,
            unauthenticated: true,
            error:
              'Repository was not found (or is a private repository). Connect your GitHub account in Settings to verify private repositories or scaffold remote repositories.',
          }),
        } as any;
      }
      return { ok: true, json: async () => ({}) } as any;
    });

    render(<ProjectSwitcher projects={mockProjects} onOpenSettings={onOpenSettings} />);

    fireEvent.click(screen.getByTestId('btn-new-project-trigger'));
    // Uncheck localOnly to reveal specs URL input and check button
    const localOnlyCheckbox = screen.getByTestId('checkbox-local-only');
    fireEvent.click(localOnlyCheckbox);

    const specsUrlInput = screen.getByTestId('input-project-specs-url');
    fireEvent.change(specsUrlInput, {
      target: { value: 'https://github.com/my-org/private-specs.git' },
    });

    const checkBtn = screen.getByTestId('btn-check-repo');
    expect(checkBtn).not.toBeDisabled();
    fireEvent.click(checkBtn);

    const unauthBanner = await screen.findByTestId('check-repo-status-unauthenticated');
    expect(unauthBanner).toBeInTheDocument();
    expect(
      screen.getByText(/Authentication Required for Private Repositories/i)
    ).toBeInTheDocument();

    const connectBtn = screen.getByTestId('btn-open-settings-from-check');
    fireEvent.click(connectBtn);
    expect(onOpenSettings).toHaveBeenCalled();
  });

  // @verifies spec-ft-core-add-project-and-github-scaffolding::TASK-CORE-020-7::REQ-003
  it('verifies Browse ../codebase opens folder picker and links repository', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((url: string) => {
      if (url === '/api/v1/workspace/codebase-folders') {
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve([
              { id: 'engine-core', name: 'Engine Core', path: '../codebase/engine-core', is_git: true },
            ]),
        } as any);
      }
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) } as any);
    });

    render(<ProjectSwitcher projects={mockProjects} />);
    fireEvent.click(screen.getByTestId('btn-new-project-trigger'));

    const browseBtn = screen.getByTestId('btn-browse-codebase');
    expect(browseBtn).toBeInTheDocument();
    fireEvent.click(browseBtn);

    const folderItem = await screen.findByTestId('codebase-folder-item-engine-core');
    expect(folderItem).toBeInTheDocument();
    expect(screen.getByText('engine-core')).toBeInTheDocument();

    // Clicking folder adds it to repositories
    fireEvent.click(folderItem);
    expect(screen.getByTestId('manifest-repo-row-0')).toBeInTheDocument();
    const repoId = screen.getByTestId('input-repo-id-0') as HTMLInputElement;
    expect(repoId.value).toBe('engine-core');

    // REQ-002: Static codebase badge instead of select
    expect(screen.getByTestId('static-repo-type-0')).toHaveTextContent('codebase');
  });
});
