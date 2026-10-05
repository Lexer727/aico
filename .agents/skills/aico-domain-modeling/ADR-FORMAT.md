# Architecture Decision Record (ADR) Format

File path convention: `docs/adr/{NNNN}-{kebab-case-title}.md` (e.g., `docs/adr/0001-embedded-kuzu-graph-storage.md`).

```markdown
# ADR-{NNNN}: {Decision Title}

- **Status**: {proposed | accepted | deprecated | superseded by ADR-XXXX}
- **Date**: {YYYY-MM-DD}
- **Deciders**: {Agent, Human Developer}

## Context & Problem Statement
What is the situation and problem we are facing? State the forces at play (technical, organizational, performance).

## Decision Drivers
- Driver 1 (e.g. Zero-daemon footprint, must run in-process)
- Driver 2 (e.g. Sub-10ms graph path traversals)
- Driver 3 (e.g. Apache 2.0 or MIT license)

## Considered Options
1. {Option A}
2. {Option B}
3. {Option C}

## Decision Outcome
Chosen option: "{Option A}", because {core rationale addressing drivers}.

### Positive Consequences
- {Benefit 1}
- {Benefit 2}

### Negative Consequences / Trade-offs
- {Trade-off 1}
- {Trade-off 2}

## Pros and Cons of the Options

### {Option A} (Chosen)
- Good, because {pro}
- Bad, because {con}

### {Option B}
- Good, because {pro}
- Bad, because {con}
```
