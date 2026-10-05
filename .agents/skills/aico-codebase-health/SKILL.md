---
name: aico-codebase-health
description: "Scan the codebase for structural friction and shallow modules using Kùzu graph metrics, presenting visual deepening refactoring candidates in an HTML report."
disable-model-invocation: true
---

# AICO Codebase Health: Graph-Assisted Deepening

Surface structural friction, shallow pass-through modules, and tangled dependencies across the codebase. Present visual refactoring candidates that deepen modules, increase caller leverage, and improve testability.

---

## Process

### 1. Kùzu Graph Structural Scan
Run graph queries to detect architectural smells:

```cypher
// 1. High Coupling / Shotgun Surgery Candidates (High fan-out)
MATCH (m:Module)-[r:IMPORTS|CALLS]->(target:Module)
WITH m, count(r) AS outgoing_edges
WHERE outgoing_edges > 10
RETURN m.name, outgoing_edges ORDER BY outgoing_edges DESC;

// 2. Circular Module Dependencies
MATCH (a:Module)-[:IMPORTS]->(b:Module)-[:IMPORTS]->(a:Module)
RETURN a.name, b.name;

// 3. Shallow Modules (High interface surface, low internal complexity)
MATCH (m:Module)-[:EXPOSES]->(s:CodeSymbol)
WITH m, count(s) AS symbol_count
WHERE symbol_count > 8 AND m.line_count < 100
RETURN m.name, symbol_count, m.line_count;
```

### 2. Apply the Deletion Test
For each candidate:
> *"If this module were deleted, would complexity vanish (shallow pass-through) or would complexity scatter across callers (real deep module)?"*

### 3. Generate Visual HTML Report
Write a self-contained HTML file to the OS temp directory (`architecture-report-<timestamp>.html`) using Tailwind CSS and Mermaid diagrams. Open the report in the developer's default browser.

Each candidate card displays:
- **Module & Files**: Paths involved.
- **Structural Friction**: Why this hurts maintenance and agent navigation.
- **Proposed Solution**: Plain English description of the deepening refactor.
- **Before / After Visual**: Mermaid diagram illustrating the reduction in seam complexity.
- **Recommendation Strength**: `Strong`, `Worth Exploring`, `Speculative`.

*(See [`HTML-REPORT.md`](HTML-REPORT.md) for full scaffold).*

### 4. Interactive Grilling on Selected Candidate
Ask the developer: *"Which candidate would you like to explore?"*
Upon selection, run a grilling round to design the deepened module's interface, confirm new public seams, and hand off to `/aico-spec-creation` or an isolated refactoring branch.

---

## Completion Criteria
- [ ] Structural scan completed across Kùzu graph.
- [ ] Visual HTML report generated and opened.
- [ ] Selected deepening candidate grilled and queued.
