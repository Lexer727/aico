import type {
  DiscoveredEpic,
  DiscoveredFeature,
  DiscoveredAdr,
} from '../features/feature-task-data';

export type SearchScope = 'epics' | 'features' | 'specs' | 'code' | 'adrs';

export interface SearchableEntity {
  id: string;
  title: string;
  scope: SearchScope;
  projectId?: string;
  projectName?: string;
  epicId?: string;
  searchableText: string;
  originalItem: any;
}

export interface SearchMatchResult {
  id: string;
  title: string;
  scope: SearchScope;
  projectId?: string;
  projectName?: string;
  epicId?: string;
  score: number;
  matchedField?: string;
  matchedSnippet?: string;
  originalItem: any;
}

// Compute Levenshtein edit distance between two strings
function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

// @implements spec-ft-core-omni-search-fulltext::REQ-001
export function fuzzyScore(target: string, query: string): number {
  const t = target.toLowerCase().trim();
  const q = query.toLowerCase().trim();

  if (!t || !q) return 0;
  if (t === q) return 1.0;

  // Prefix match
  if (t.startsWith(q)) {
    return 0.95;
  }

  // Exact substring match
  if (t.includes(q)) {
    return 0.85 + (q.length / t.length) * 0.1;
  }

  // Token-level check (e.g. kebab-case or space-separated tokens)
  const targetTokens = t.split(/[-_\s/.]+/).filter(Boolean);
  const queryTokens = q.split(/[-_\s/.]+/).filter(Boolean);

  let tokenMatchCount = 0;
  for (const qTok of queryTokens) {
    if (targetTokens.some((tTok) => tTok.includes(qTok))) {
      tokenMatchCount++;
    }
  }
  if (queryTokens.length > 0 && tokenMatchCount === queryTokens.length) {
    return 0.75;
  }

  // Full-string Levenshtein edit distance
  const maxLen = Math.max(t.length, q.length);
  const dist = levenshteinDistance(t, q);
  if (dist <= 2) {
    return Math.max(0.6, 1.0 - dist / maxLen);
  }

  // Check closest token distance if query is short
  for (const tTok of targetTokens) {
    const tDist = levenshteinDistance(tTok, q);
    if (tDist <= 1 && tTok.length >= 3) {
      return 0.65;
    }
  }

  return 0;
}

// @implements spec-ft-core-omni-search-fulltext::REQ-002
export function createSearchIndex(options: {
  epics?: DiscoveredEpic[];
  features?: DiscoveredFeature[];
  adrs?: DiscoveredAdr[];
  codeFiles?: string[];
  projectId?: string;
  projectName?: string;
}): SearchableEntity[] {
  const index: SearchableEntity[] = [];
  const { epics = [], features = [], adrs = [], codeFiles = [], projectId, projectName } = options;

  // 1. Index Epics
  for (const epic of epics) {
    const texts: string[] = [
      epic.id,
      epic.title,
      epic.executive_summary || '',
      epic.brainstorm_content || '',
      epic.deepdive_content || '',
    ];

    if (epic.ubiquitous_language) {
      for (const term of epic.ubiquitous_language) {
        texts.push(term.term);
        texts.push(term.definition);
      }
    }

    index.push({
      id: epic.id,
      title: epic.title,
      scope: 'epics',
      projectId,
      projectName,
      searchableText: texts.filter(Boolean).join(' '),
      originalItem: epic,
    });
  }

  // 2. Index Features
  for (const feat of features) {
    const texts: string[] = [
      feat.id,
      feat.name,
      feat.description || '',
      ...(feat.in_scope || []),
      ...(feat.out_of_scope || []),
      feat.brainstorm_content || '',
      feat.deepdive_content || '',
      feat.raw_spec_content || '',
      feat.raw_plan_content || '',
    ];

    if (feat.requirements) {
      for (const r of feat.requirements) {
        texts.push(r.id);
        texts.push(r.statement);
        texts.push(r.pattern);
      }
    }

    if (feat.tasks) {
      for (const t of feat.tasks) {
        texts.push(t.id);
        texts.push(t.title);
        texts.push((t as any).description || '');
      }
    }

    index.push({
      id: feat.id,
      title: feat.name,
      scope: 'features',
      epicId: feat.epic_id || feat.epicId,
      projectId,
      projectName,
      searchableText: texts.filter(Boolean).join(' '),
      originalItem: feat,
    });
  }

  // Pre-index features by feature ID and spec ID for rapid spec-content lookup
  const featureBySpecId = new Map<string, DiscoveredFeature>();
  const featureById = new Map<string, DiscoveredFeature>();

  const registerFeatureForLookup = (f: DiscoveredFeature) => {
    if (f.id) {
      featureById.set(f.id.toLowerCase(), f);
      featureBySpecId.set(`spec-${f.id.toLowerCase()}`, f);
    }
    const specId = (f as any).spec_id || (f as any).specId;
    if (specId) {
      featureBySpecId.set(specId.toLowerCase(), f);
    }
  };

  for (const feat of features) {
    registerFeatureForLookup(feat);
  }
  for (const epic of epics) {
    for (const feat of epic.features || []) {
      registerFeatureForLookup(feat as any);
    }
  }

  // 3. Index Specs
  // @implements spec-ft-core-omni-search-fulltext::REQ-002
  // @implements spec-ft-core-omni-search-fulltext::REQ-009
  const indexedSpecIds = new Set<string>();

  for (const epic of epics) {
    for (const spec of epic.specs || []) {
      indexedSpecIds.add(spec.id.toLowerCase());
      const linkedFeat = featureBySpecId.get(spec.id.toLowerCase());
      const specTexts: string[] = [
        spec.id,
        spec.title,
        spec.path || '',
      ];

      if (linkedFeat) {
        if (linkedFeat.raw_spec_content || (linkedFeat as any).rawSpecContent) {
          specTexts.push(linkedFeat.raw_spec_content || (linkedFeat as any).rawSpecContent);
        }
        if (linkedFeat.description) {
          specTexts.push(linkedFeat.description);
        }
        if (linkedFeat.in_scope) {
          specTexts.push(...linkedFeat.in_scope);
        }
        if (linkedFeat.out_of_scope) {
          specTexts.push(...linkedFeat.out_of_scope);
        }
        if (linkedFeat.requirements) {
          for (const r of linkedFeat.requirements) {
            specTexts.push(r.id);
            specTexts.push(r.statement);
            specTexts.push(r.pattern);
          }
        }
      }

      index.push({
        id: spec.id,
        title: spec.title,
        scope: 'specs',
        epicId: epic.id,
        projectId,
        projectName,
        searchableText: specTexts.filter(Boolean).join(' '),
        originalItem: spec,
      });
    }
  }

  // Also index specs from features (e.g. standalone features or features with spec_id not in epic.specs)
  for (const feat of features) {
    const specId = (feat as any).spec_id || (feat as any).specId || `spec-${feat.id}`;
    if (!indexedSpecIds.has(specId.toLowerCase())) {
      indexedSpecIds.add(specId.toLowerCase());
      const specTitle = (feat as any).spec_title || (feat as any).specTitle || feat.name || specId;
      const specTexts: string[] = [
        specId,
        specTitle,
        feat.raw_spec_content || (feat as any).rawSpecContent || '',
        feat.description || '',
        ...(feat.in_scope || []),
        ...(feat.out_of_scope || []),
      ];
      if (feat.requirements) {
        for (const r of feat.requirements) {
          specTexts.push(r.id);
          specTexts.push(r.statement);
          specTexts.push(r.pattern);
        }
      }

      index.push({
        id: specId,
        title: specTitle,
        scope: 'specs',
        epicId: feat.epic_id || (feat as any).epicId,
        projectId,
        projectName,
        searchableText: specTexts.filter(Boolean).join(' '),
        originalItem: {
          id: specId,
          title: specTitle,
          status: feat.status,
          path: `features/${feat.id}/${specId}.md`,
        },
      });
    }
  }

  // 4. Index ADRs
  for (const adr of adrs) {
    const texts: string[] = [
      adr.id,
      adr.title,
      adr.context || '',
      adr.decision || '',
      adr.consequences || '',
    ];

    index.push({
      id: adr.id,
      title: adr.title,
      scope: 'adrs',
      projectId,
      projectName,
      searchableText: texts.filter(Boolean).join(' '),
      originalItem: adr,
    });
  }

  // 5. Index Code Files
  for (const code of codeFiles) {
    index.push({
      id: code,
      title: code,
      scope: 'code',
      projectId,
      projectName,
      searchableText: code,
      originalItem: code,
    });
  }

  return index;
}

// Search across index with fuzzy matching and full-text scoring
// @implements spec-ft-core-omni-search-fulltext::REQ-001
// @implements spec-ft-core-omni-search-fulltext::REQ-002
export function searchWorkspace(
  index: SearchableEntity[],
  query: string,
  options?: {
    scopes?: Record<SearchScope, boolean>;
    projectId?: string;
  }
): SearchMatchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchMatchResult[] = [];

  for (const entity of index) {
    // Scope filter check
    if (options?.scopes && !options.scopes[entity.scope]) {
      continue;
    }

    // Project filter check (if requested)
    if (options?.projectId && entity.projectId && entity.projectId !== options.projectId) {
      continue;
    }

    // 1. Direct match on ID or Title
    const idScore = fuzzyScore(entity.id, q);
    const titleScore = fuzzyScore(entity.title, q);
    const headerScore = Math.max(idScore, titleScore);

    // 2. Full-text search inside associated document content
    const textLower = entity.searchableText.toLowerCase();
    let bodyScore = 0;
    let snippet: string | undefined;

    if (textLower.includes(q)) {
      bodyScore = 0.7;
      // Extract snippet around the matched term
      const idx = textLower.indexOf(q);
      const start = Math.max(0, idx - 40);
      const end = Math.min(entity.searchableText.length, idx + q.length + 40);
      snippet = `...${entity.searchableText.substring(start, end).replace(/\s+/g, ' ').trim()}...`;
    } else {
      // Check multi-token matching across body text
      const qTokens = q.split(/\s+/).filter(Boolean);
      if (qTokens.length > 1 && qTokens.every((tok) => textLower.includes(tok))) {
        bodyScore = 0.6;
      }
    }

    const finalScore = Math.max(headerScore, bodyScore);

    if (finalScore >= 0.5) {
      results.push({
        id: entity.id,
        title: entity.title,
        scope: entity.scope,
        projectId: entity.projectId,
        projectName: entity.projectName,
        epicId: entity.epicId,
        score: finalScore,
        matchedField: headerScore >= bodyScore ? (idScore > titleScore ? 'ID' : 'Title') : 'Document Content',
        matchedSnippet: snippet,
        originalItem: entity.originalItem,
      });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}
