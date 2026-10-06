// SDD v0.1.2 Dynamic Feature, Epic, and Task Contracts
// Pure vertical tracer-bullet tasks organized in a Directed Acyclic Graph (DAG) with explicit dependencies (blocked_by)
// Source of truth is entirely read and parsed from the SDD markdown artifacts on disk via the local Axum API.

export interface FeatureTask {
  id: string; // e.g. "TASK-CORE-001"
  title: string;
  status: 'Done' | 'In Progress' | 'Pending' | 'Blocked' | 'Skipped/Canceled' | 'Rewritten';
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
  ubiquitous_language?: TermInfo[];
  ubiquitousLanguage?: TermInfo[];
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
 * Fetch a single feature from the Axum backend dynamically
 */
export async function fetchFeature(featureId: string): Promise<DiscoveredFeature | null> {
  const norm = normalizeId(featureId);
  if (featureCache.has(norm)) {
    return featureCache.get(norm)!;
  }

  try {
    const res = await fetch(getApiUrl(`/api/v1/features/${encodeURIComponent(norm)}`));
    if (res.ok) {
      const data: DiscoveredFeature = await res.json();
      featureCache.set(norm, data);
      featureCache.set(normalizeId(data.id), data);
      return data;
    }

    // Try without or with ft- prefix
    const alt = norm.startsWith('ft-') ? norm.substring(3) : `ft-${norm}`;
    const altRes = await fetch(getApiUrl(`/api/v1/features/${encodeURIComponent(alt)}`));
    if (altRes.ok) {
      const data: DiscoveredFeature = await altRes.json();
      featureCache.set(norm, data);
      featureCache.set(alt, data);
      return data;
    }
  } catch {
    // Graceful offline fallback in testing environments
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
