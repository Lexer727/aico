import { useTabStore } from '../stores/useTabStore';

// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-24::REQ-031
export function getActiveProjectId(): string | undefined {
  try {
    const storeProject = useTabStore.getState().activeProjectId;
    if (storeProject && storeProject !== 'default') {
      return storeProject;
    }
  } catch {
    // fallback if called outside react/zustand initialization
  }
  return undefined;
}

// @implements spec-ft-core-workspace-graph-and-project-creator::TASK-CORE-017-24::REQ-031
export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const activeProjectId = getActiveProjectId();
  if (!activeProjectId) {
    return init !== undefined ? fetch(input, init) : fetch(input);
  }

  let headers: HeadersInit;
  if (!init?.headers) {
    headers = { 'X-Aico-Project': activeProjectId };
  } else if (init.headers instanceof Headers) {
    headers = new Headers(init.headers);
    if (!headers.has('X-Aico-Project')) {
      headers.set('X-Aico-Project', activeProjectId);
    }
  } else if (Array.isArray(init.headers)) {
    headers = [...init.headers, ['X-Aico-Project', activeProjectId]];
  } else {
    headers = {
      ...(init.headers as Record<string, string>),
      'X-Aico-Project': activeProjectId,
    };
  }

  return fetch(input, {
    ...init,
    headers,
  });
}
