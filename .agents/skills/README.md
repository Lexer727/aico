# AICO Spec-Driven Design (SDD) Harness

The canonical skill harness for **AICO (Local Spec-Driven AI Co-Development Environment)**. Conforms to the open Agent Skills format (`SKILL.md`) and incorporates the rigor of **EARS-Req**, the pragmatic engineering velocity and seam-oriented design of **MattSkills**, and the lifecycle convergence of **Spec Kit**.

---

## 1. Skill Catalog

| Skill | Role | Invocation | Primary Artifact / Output |
| :--- | :--- | :--- | :--- |
| **[`aico-guide`](aico-guide/SKILL.md)** | Global router and navigator over all skills | User-invoked | Triage decision & recommended skill |
| **[`aico-wayfinder`](aico-wayfinder/SKILL.md)** | High-fog greenfield navigation & decision mapping | User-invoked | `.scratch/wayfinder/{slug}/map.md` |
| **[`aico-brainstorm`](aico-brainstorm/SKILL.md)** | Problem exploration, trade-off analysis & Socratic grilling | Model/User | `brainstorms/{domain}/BRAIN-{seq}-{slug}.md` |
| **[`aico-prototype`](aico-prototype/SKILL.md)** | Throwaway spike code for UI and state machine questions | User-invoked | `prototype/{slug}` branch & interactive HTML |
| **[`aico-deep-dive`](aico-deep-dive/SKILL.md)** | Kùzu graph walk, blast radius & public seam designation | Model/User | `deep-dives/{domain}/DIVE-{seq}-{slug}.md` |
| **[`aico-spec-creation`](aico-spec-creation/SKILL.md)** | Contract synthesis with 5 EARS patterns & out-of-scope boundaries | Model/User | `specs/{domain}/SPEC-{seq}-{slug}.md` |
| **[`aico-planning`](aico-planning/SKILL.md)** | Task graph (DAG) decomposition & active frontier calculation | Model/User | `plans/{domain}/PLAN-{seq}-{slug}.md` |
| **[`aico-test-scaffolding`](aico-test-scaffolding/SKILL.md)** | Red failing contract tests at public seams with `@verifies` tags | Model/User | Red test suite |
| **[`aico-implementation`](aico-implementation/SKILL.md)** | Minimal code to pass tests with `@implements` tags | Model/User | Green test suite |
| **[`aico-diagnosing-bugs`](aico-diagnosing-bugs/SKILL.md)** | Tight-loop defect diagnosis & seam regression locking | Model/User | Passing regression test & clean code |
| **[`aico-review-loop`](aico-review-loop/SKILL.md)** | Two-axis review (Standards vs Spec) & Kùzu graph convergence | Model/User | Convergence report & Phase N tasks |
| **[`aico-codebase-health`](aico-codebase-health/SKILL.md)** | Kùzu graph structural scan for module deepening | User-invoked | Visual HTML before/after report |
| **[`aico-retro`](aico-retro/SKILL.md)** | Session retrospective & environment evolution | User-invoked | Linter rules, pre-commit hooks, pointers |
| **[`aico-domain-modeling`](aico-domain-modeling/SKILL.md)** | Ubiquitous domain language & Architecture Decision Records | Model/User | `GLOSSARY.md` & `docs/adr/*.md` |
| **[`aico-codebase-design`](aico-codebase-design/SKILL.md)** | Deep module principles, leverage, locality & public seams | Reference | Universal design vocabulary |

---

## 2. The Main Feature Lifecycle

```
aico-brainstorm  ──►  aico-deep-dive  ──►  aico-spec-creation  ──►  aico-planning
       │                                                                  │
  (prototype spike)                                                       ▼
                                                                aico-test-scaffolding
                                                                          │
                                                                          ▼
aico-retro  ◄──  aico-review-loop  ◄──  aico-implementation
```

---

## 3. Storage & Tool Integration (In-App Runtime)

When running inside the AICO desktop application, all structural mutations pass through deterministic **Model Context Protocol (MCP)** tool gates:
- `create_sdd_artifact`: Generates deterministic paths, injects immutable IDs, writes to disk, and commits graph nodes into **Kùzu** and hybrid embeddings into **LanceDB**.
- **Tree-sitter Background Watcher**: Watches file saves for `// @implements` and `// @verifies` tags, keeping the graph synchronized in sub-15ms without manual registries.
