---
name: aico-epic
description: "Scaffold, frame, and orchestrate a new engineering epic. Coordinates shared brainstorming, decides simple vs composite multi-spec decomposition, and tracks cross-spec milestone convergence."
disable-model-invocation: false
---

# AICO Epic: Capability Framing & Multi-Spec Orchestration

An **Epic** is the top-level unit of intent and execution under a Project. It bundles a cohesive idea from conception to verified code, serving as the parent container for all associated SDD artifacts (shared brainstorms, deep dives, specifications, and task plans).

Use `/aico-epic` when starting a new capability, epic, or feature set.

---

## Process

```
New Idea ───> /aico-epic ───> Scaffold Container ───> /aico-brainstorm ───> Simple or Composite?
                              (<slug>/)              (Shared Brainstorm)    │
                                                                           ├──> Simple: 1 Spec directly
                                                                           └──> Composite: Decompose into child specs
```

### Step 1: Scope & Scaffold the Epic
1. Verify the active project (resolves `<aico-root>/<project>-specs/`).
2. Assign a sequential slug: `epics/<seq>-<epic-slug>/` (e.g. `001-web-platform`, `002-csv-export`).
3. Create the epic container directory:
   `<project>-specs/epics/<seq>-<slug>/`

### Step 2: Overarching Concept & Shared Brainstorm
1. Invoke **`/aico-brainstorm`** targeting the whole epic.
2. Socratic grilling identifies:
   - Problem statement & measurable user value.
   - Cross-cutting architectural trade-offs (e.g. communication protocol, shared data schemas).
   - Candidate approaches & rejected alternatives.
3. Write the shared brainstorm artifact:
   `<project>-specs/epics/<seq>-<slug>/BRAIN-<slug>.md`

### Step 3: Determine Epic Structure (Simple vs. Composite)
Ask the developer:
> *"Does this epic implement as a single cohesive unit, or does it decompose into distinct child specifications (e.g. Backend API vs. Frontend WebUI)?"*

- **Path A: Simple Epic (Single Spec)**:
  - Keep a flat structure inside `epics/<seq>-<slug>/`:
    - `BRAIN-<slug>.md`
    - `DEEP-<slug>.md` (blast radius analysis via `/aico-deep-dive`)
    - `SPEC-<slug>.md` (EARS requirements via `/aico-spec-creation`)
    - `PLAN-<slug>.md` (task DAG via `/aico-planning`)
- **Path B: Composite Epic (Multi-Spec)**:
  - Create child spec subdirectories under `specs/`:
    - `<project>-specs/epics/<seq>-<slug>/specs/01-<child-slug>/`
    - `<project>-specs/epics/<seq>-<slug>/specs/02-<child-slug>/`
  - For each child spec:
    - Run `/aico-deep-dive` to analyze that specific subsystem's blast radius.
    - Run `/aico-spec-creation` to draft its EARS contract (`SPEC-<child-slug>.md`).
    - Run `/aico-planning` to build its vertical tracer-bullet DAG (`PLAN-<child-slug>.md`).

### Step 4: Register in Kùzu Property Graph
Register the epic and its relationships:
```cypher
MERGE (e:Epic {id: $epic_id, title: $title, status: "active"})
MERGE (b:Brainstorm {id: $brain_id})
MERGE (e)-[:HAS_BRAINSTORM]->(b)
// For each child spec:
MERGE (s:Spec {id: $spec_id})
MERGE (e)-[:HAS_SPEC]->(s)
MERGE (s)-[:DERIVED_FROM]->(b)
```

### Step 5: Cross-Spec Milestone Convergence
An epic reaches completion only when:
- All child specifications have passing red-to-green seam tests.
- Standards vs Spec two-axis review has passed (`/aico-review-loop`).
- All human gate tasks in the Plan DAG are satisfied.

---

## Completion Criteria
- [ ] Epic folder created under `<project>-specs/epics/<seq>-<slug>/`.
- [ ] Shared brainstorm completed and saved.
- [ ] Structural path selected (Simple flat vs. Composite multi-spec).
- [ ] Child specs created or ready for `/aico-spec-creation`.
- [ ] Epic visible in the AICO UI Epic Hub.
