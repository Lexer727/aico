import { describe, it, expect } from 'vitest';
import {
  createSearchIndex,
  fuzzyScore,
  searchWorkspace,
  type SearchableEntity,
} from '../src/utils/searchEngine';
import type { DiscoveredEpic, DiscoveredFeature, DiscoveredAdr } from '../src/features/feature-task-data';

describe('searchEngine: In-Memory Full-Text Fuzzy Engine', () => {
  const mockEpic: DiscoveredEpic = {
    id: 'ec-core',
    title: 'AICO Core SDD Platform',
    status: 'Completed',
    specs_count: 1,
    executive_summary: 'Host runtime, Axum local HTTP daemon, LAN auth, and WebUI shell.',
    brainstorm_content: '# Brainstorm\nWe chose embedded SQLite and LanceDB for high-throughput vector store.',
    deepdive_content: '# Deep Dive\nInvestigated axum routing and async Tokio boundaries.',
    ubiquitous_language: [
      { term: 'Host Runtime', definition: 'The background daemon hosting embedded databases.' }
    ],
  };

  const mockFeature: DiscoveredFeature = {
    id: 'ft-core-host-runtime',
    name: 'Host Runtime & Network Daemon',
    epic_id: 'ec-core',
    status: 'Completed',
    description: 'Implements Axum server lifecycle and WebSocket event multiplexing.',
    in_scope: ['Local HTTP server', 'LAN authentication tokens'],
    out_of_scope: ['Cloud proxy tunneling'],
    requirements: [
      {
        id: 'REQ-001',
        pattern: 'State-Driven',
        statement: 'When started, the daemon shall bind to port 4242 and listen for HTTP connections.',
        status: 'Verified',
      },
    ],
    tasks: [
      {
        id: 'TASK-CORE-001-1',
        title: 'Axum Server Skeleton',
        description: 'Configure tokio multi-thread runtime and graceful drain listener.',
        status: 'Done',
      },
    ],
    brainstorm_content: 'Decided to embed web assets for single-binary distribution.',
  };

  const mockAdr: DiscoveredAdr = {
    id: 'ADR-0001',
    title: 'Host Runtime & Network Topology',
    status: 'Completed',
    path: 'adr/0001-host-runtime.md',
    context: 'We require a lightweight, zero-dependency local daemon.',
    decision: 'Use Rust Axum with tower-http CORS middleware.',
    consequences: 'Guarantees memory safety and minimal resource overhead.',
  };

  // @verifies spec-ft-core-omni-search-fulltext::REQ-001
  it('fuzzy matches entities despite typos (e.g. ft-cor-host-runtime matches ft-core-host-runtime)', () => {
    // Exact or typo distance <= 2
    const score1 = fuzzyScore('ft-core-host-runtime', 'ft-core-host-runtime');
    expect(score1).toBeGreaterThan(0.9);

    // Minor typo: 'cor' instead of 'core'
    const score2 = fuzzyScore('ft-core-host-runtime', 'ft-cor-host-runtime');
    expect(score2).toBeGreaterThan(0.6);

    // Test with index search
    const index = createSearchIndex({
      epics: [mockEpic],
      features: [mockFeature],
      adrs: [mockAdr],
      codeFiles: ['ShellLayout.tsx'],
    });

    const results = searchWorkspace(index, 'ft-cor-host-runtime');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('ft-core-host-runtime');
  });

  // @verifies spec-ft-core-omni-search-fulltext::REQ-002
  it('finds parent entities when querying terms present only in associated document content', () => {
    const index = createSearchIndex({
      epics: [mockEpic],
      features: [mockFeature],
      adrs: [mockAdr],
      codeFiles: ['ShellLayout.tsx'],
    });

    // 1. Term inside Epic executive summary: 'LAN auth'
    const resSummary = searchWorkspace(index, 'LAN auth');
    expect(resSummary.some((r) => r.id === 'ec-core')).toBe(true);

    // 2. Term inside Epic brainstorm: 'LanceDB'
    const resBrainstorm = searchWorkspace(index, 'LanceDB');
    expect(resBrainstorm.some((r) => r.id === 'ec-core')).toBe(true);

    // 3. Term inside Feature requirement statement: 'port 4242'
    const resReq = searchWorkspace(index, 'port 4242');
    expect(resReq.some((r) => r.id === 'ft-core-host-runtime')).toBe(true);

    // 4. Term inside Task description: 'graceful drain listener'
    const resTask = searchWorkspace(index, 'graceful drain');
    expect(resTask.some((r) => r.id === 'ft-core-host-runtime')).toBe(true);

    // 5. Term inside ADR decision: 'tower-http CORS'
    const resAdr = searchWorkspace(index, 'tower-http');
    expect(resAdr.some((r) => r.id === 'ADR-0001')).toBe(true);

    // 6. Term inside Epic glossary definition: 'background daemon hosting'
    const resGlossary = searchWorkspace(index, 'background daemon');
    expect(resGlossary.some((r) => r.id === 'ec-core')).toBe(true);
  });

  // @verifies spec-ft-core-omni-search-fulltext::REQ-002
  // @verifies spec-ft-core-omni-search-fulltext::REQ-009
  it('dual-matches both Specification (scope: specs) and Feature (scope: features) for terms within spec content', () => {
    const mockFeatureWithSpec: DiscoveredFeature = {
      ...mockFeature,
      raw_spec_content: '# Feature Specification\nRemote public internet hosting requires reverse proxy binding.',
    };

    const index = createSearchIndex({
      epics: [
        {
          ...mockEpic,
          specs: [
            {
              id: 'spec-ft-core-host-runtime',
              title: 'Host Runtime & Local HTTP/WS Server',
              status: 'Completed',
              path: 'epics/ec-core/features/ft-core-host-runtime/spec-ft-core-host-runtime.md',
              requirements_count: 1,
            },
          ],
        },
      ],
      features: [mockFeatureWithSpec],
      adrs: [mockAdr],
    });

    const results = searchWorkspace(index, 'Remote public internet hosting');
    expect(results.length).toBeGreaterThanOrEqual(2);

    const specHit = results.find((r) => r.scope === 'specs');
    const featHit = results.find((r) => r.scope === 'features');

    expect(specHit).toBeDefined();
    expect(specHit?.id).toBe('spec-ft-core-host-runtime');
    expect(featHit).toBeDefined();
    expect(featHit?.id).toBe('ft-core-host-runtime');
  });
});
