// SDD v0.1.2 Dynamic Feature, Epic, and Task Contracts
// Pure vertical tracer-bullet tasks organized in a Directed Acyclic Graph (DAG) with explicit dependencies (blocked_by)
// Source of truth is entirely read and parsed from the SDD markdown artifacts on disk via the local Axum API.

export interface FeatureTask {
  id: string; // e.g. "TASK-CORE-001"
  title: string;
  status: 'Done' | 'Completed' | 'In Progress' | 'Pending' | 'Blocked' | 'Skipped/Canceled' | 'Rewritten';
  seam?: string;
  blocked_by?: string[];
  blockedBy?: string[];
  deliverables?: string[];
  addresses?: string[];
}

export interface FeatureRequirement {
  id: string; // e.g. "REQ-001"
  pattern: string;
  statement: string;
  status: string;
  seam?: string;
}

export interface TestSeamInfo {
  id: string;
  path: string;
  description: string;
}

export interface TermInfo {
  term: string;
  definition: string;
}

export interface DiscoveredFeature {
  id: string; // e.g. "ft-core-host-runtime"
  name: string;
  epic_id?: string;
  epicId?: string;
  spec_id?: string;
  specId?: string;
  spec_title?: string;
  specTitle?: string;
  plan_id?: string;
  planId?: string;
  plan_title?: string;
  planTitle?: string;
  status: string;
  order?: number;
  is_standalone?: boolean;
  isStandalone?: boolean;
  description?: string;
  in_scope?: string[];
  inScope?: string[];
  out_of_scope?: string[];
  outOfScope?: string[];
  requirements?: FeatureRequirement[];
  test_seams?: TestSeamInfo[];
  testSeams?: TestSeamInfo[];
  adrs?: string[];
  tasks?: FeatureTask[];
  raw_spec_content?: string;
  rawSpecContent?: string;
  raw_plan_content?: string;
  rawPlanContent?: string;
  brainstorm_content?: string;
  brainstormContent?: string;
  deepdive_content?: string;
  deepdiveContent?: string;
  ubiquitous_language?: TermInfo[];
  ubiquitousLanguage?: TermInfo[];
  repositories?: string[];
}

export interface DiscoveredEpic {
  id: string; // e.g. "ec-core"
  title: string;
  status: string;
  order?: number;
  specs_count?: number;
  specsCount?: number;
  executive_summary?: string;
  executiveSummary?: string;
  brainstorm_content?: string;
  brainstormContent?: string;
  deepdive_content?: string;
  deepdiveContent?: string;
  adrs?: string[];
  ubiquitous_language?: TermInfo[];
  ubiquitousLanguage?: TermInfo[];
  repositories?: string[];
  features?: DiscoveredFeature[];
  specs?: Array<{
    id: string;
    title: string;
    status: string;
    path: string;
    order?: number;
    requirements_count?: number;
    requirementsCount?: number;
  }>;
}

export interface DiscoveredAdr {
  id: string;
  title: string;
  status: string;
  path: string;
  context?: string;
  decision?: string;
  consequences?: string;
}

// In-memory cache for fast lookups
const featureCache = new Map<string, DiscoveredFeature>();
const epicCache = new Map<string, DiscoveredEpic>();
const adrCache = new Map<string, DiscoveredAdr>();

function getApiUrl(endpoint: string): string {
  if (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null') {
    return `${window.location.origin}${endpoint}`;
  }
  return `http://localhost${endpoint}`;
}

/**
 * Normalizes an identifier by converting to lowercase and stripping common prefixes
 */
export function normalizeId(id: string): string {
  return id.trim().toLowerCase();
}

/**
 * Normalizes an ADR identifier to ADR-#### format
 */
export function normalizeAdrId(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  const matchNum = trimmed.match(/(?:ADR-)?(\d{4})/i);
  if (matchNum) {
    return `ADR-${matchNum[1]}`;
  }
  return trimmed;
}

/**
 * Fetch all ADRs from the Axum backend dynamically
 */
export async function fetchAllAdrs(): Promise<DiscoveredAdr[]> {
  try {
    const res = await fetch(getApiUrl('/api/v1/adrs'));
    if (res.ok) {
      const data: DiscoveredAdr[] = await res.json();
      for (const a of data) {
        adrCache.set(normalizeId(a.id), a);
      }
      return data;
    }
  } catch {
    // Graceful offline fallback
  }
  return [];
}

/**
 * Normalizes a feature identifier by stripping document prefixes/suffixes (e.g., spec-, plan-, -taskplan)
 */
export function normalizeFeatureId(id: string): string {
  let norm = id.trim().toLowerCase();
  if (norm.startsWith('spec-')) norm = norm.substring(5);
  else if (norm.startsWith('plan-')) norm = norm.substring(5);
  else if (norm.startsWith('brain-')) norm = norm.substring(6);
  else if (norm.startsWith('deepdive-')) norm = norm.substring(9);

  if (norm.endsWith('-specifications')) norm = norm.substring(0, norm.length - 15);
  else if (norm.endsWith('-taskplan')) norm = norm.substring(0, norm.length - 9);
  else if (norm.endsWith('-brainstorm')) norm = norm.substring(0, norm.length - 11);
  else if (norm.endsWith('-deepdive')) norm = norm.substring(0, norm.length - 9);

  return norm;
}

/**
 * Extract canonical TASK-ID from a dependency string
 * (e.g. "TASK-CORE-001-3 (WebSocket Hub)" -> "TASK-CORE-001-3")
 */
export function extractTaskId(dep: string): string | null {
  if (!dep) return null;
  const match = dep.match(/TASK-[A-Za-z0-9-]+/i);
  return match ? match[0].toUpperCase() : null;
}

/**
 * Computes the active task frontier dynamically from task statuses and DAG dependencies.
 * A task is on the active frontier if it is 'Pending' or 'In Progress' and all of its
 * blocking dependencies are 'Done' or 'Completed'.
 */
export function computeActiveFrontier(
  tasks: FeatureTask[],
  allWorkspaceTasks?: FeatureTask[]
): FeatureTask[] {
  if (!tasks || tasks.length === 0) return [];

  const taskMap = new Map<string, FeatureTask>();
  // If workspace-wide tasks are provided, index them first for cross-feature resolution
  if (allWorkspaceTasks) {
    for (const t of allWorkspaceTasks) {
      taskMap.set(t.id.toUpperCase(), t);
      taskMap.set(t.id.toLowerCase(), t);
    }
  }
  for (const t of tasks) {
    taskMap.set(t.id.toUpperCase(), t);
    taskMap.set(t.id.toLowerCase(), t);
  }

  return tasks.filter((t) => {
    if (t.status !== 'Pending' && t.status !== 'In Progress') {
      return false;
    }

    const blockedList = t.blocked_by || t.blockedBy || [];
    if (blockedList.length === 0) {
      return true;
    }

    // Every blocker must be Done / Completed
    return blockedList.every((dep) => {
      const depNorm = dep.trim().toUpperCase();
      if (!depNorm || depNorm === 'NONE' || depNorm.startsWith('NONE')) {
        return true;
      }
      const taskId = extractTaskId(dep);
      const blocker = taskId
        ? taskMap.get(taskId) || taskMap.get(taskId.toLowerCase())
        : taskMap.get(depNorm) || taskMap.get(dep.trim().toLowerCase());
      return blocker && (blocker.status === 'Done' || blocker.status === 'Completed');
    });
  });
}

/**
 * Fetch all features from the Axum backend dynamically
 */
export async function fetchAllFeatures(): Promise<DiscoveredFeature[]> {
  try {
    const res = await fetch(getApiUrl('/api/v1/features'));
    if (res.ok) {
      const data: DiscoveredFeature[] = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch {
    // Graceful offline fallback
  }
  return [];
}

/**
 * Fetch a single feature from the Axum backend dynamically
 */
export async function fetchFeature(featureId: string): Promise<DiscoveredFeature | null> {
  const norm = normalizeId(featureId);
  const cleanId = normalizeFeatureId(norm);

  if (featureCache.has(norm)) {
    return featureCache.get(norm)!;
  }
  if (featureCache.has(cleanId)) {
    return featureCache.get(cleanId)!;
  }

  const candidateIds = Array.from(new Set([
    norm,
    cleanId,
    cleanId.startsWith('ft-') ? cleanId.substring(3) : `ft-${cleanId}`,
  ]));

  for (const idToTry of candidateIds) {
    try {
      const res = await fetch(getApiUrl(`/api/v1/features/${encodeURIComponent(idToTry)}`));
      if (res.ok) {
        const data: DiscoveredFeature = await res.json();
        featureCache.set(norm, data);
        featureCache.set(cleanId, data);
        featureCache.set(normalizeId(data.id), data);
        return data;
      }
    } catch {
      // Continue trying candidates
    }
  }

  return null;
}

/**
 * Fetch a single epic from the Axum backend dynamically
 */
export async function fetchEpic(epicId: string): Promise<DiscoveredEpic | null> {
  const norm = normalizeId(epicId);
  if (epicCache.has(norm)) {
    return epicCache.get(norm)!;
  }

  try {
    const res = await fetch(getApiUrl(`/api/v1/epics/${encodeURIComponent(norm)}`));
    if (res.ok) {
      const data: DiscoveredEpic = await res.json();
      epicCache.set(norm, data);
      epicCache.set(normalizeId(data.id), data);
      return data;
    }

    const alt = norm.startsWith('ec-') ? norm.substring(3) : `ec-${norm}`;
    const altRes = await fetch(getApiUrl(`/api/v1/epics/${encodeURIComponent(alt)}`));
    if (altRes.ok) {
      const data: DiscoveredEpic = await altRes.json();
      epicCache.set(norm, data);
      epicCache.set(alt, data);
      return data;
    }
  } catch {
    // Graceful offline fallback
  }

  return null;
}

/**
 * Fetch a single ADR from the Axum backend dynamically
 */
export async function fetchAdr(adrId: string): Promise<DiscoveredAdr | null> {
  const norm = normalizeId(adrId);
  if (adrCache.has(norm)) {
    return adrCache.get(norm)!;
  }

  try {
    const res = await fetch(getApiUrl(`/api/v1/adrs/${encodeURIComponent(norm)}`));
    if (res.ok) {
      const data: DiscoveredAdr = await res.json();
      adrCache.set(norm, data);
      adrCache.set(normalizeId(data.id), data);
      return data;
    }
  } catch {
    // Graceful offline fallback
  }

  return null;
}

/**
 * Fetch the complete project glossary from the Axum backend dynamically
 */
export async function fetchGlossary(): Promise<TermInfo[]> {
  try {
    const res = await fetch(getApiUrl('/api/v1/glossary'));
    if (res.ok) {
      const data: TermInfo[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data;
      }
    }
  } catch {
    // Graceful offline fallback
  }

  return [];
}

export interface GitCommitInfo {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
}

export interface GitRepoStatus {
  id: string;
  name: string;
  path: string;
  type: string;
  url?: string | null;
  is_available: boolean;
  branch: string | null;
  upstream: string | null;
  ahead: number;
  behind: number;
  staged_count: number;
  unstaged_count: number;
  untracked_count: number;
  is_clean: boolean;
  latest_commit?: GitCommitInfo | null;
  error?: string | null;
}

/**
 * Fetch Git repository statuses for the active project from Axum backend
 * @implements ft-git-dashboard-ui::TASK-GIT-003-1::REQ-001
 * @implements ft-git-dashboard-ui::TASK-GIT-003-1::REQ-005
 */
export async function fetchGitStatus(): Promise<GitRepoStatus[]> {
  try {
    const res = await fetch(getApiUrl('/api/v1/git/status'));
    if (res.ok) {
      const data: GitRepoStatus[] = await res.json();
      if (Array.isArray(data)) {
        return data;
      }
    }
  } catch (err) {
    console.error('Error fetching git status:', err);
  }
  return [];
}


