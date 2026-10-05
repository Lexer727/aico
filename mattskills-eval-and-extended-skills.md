# MattSkills Evaluation & Extended Skills Architecture for AICO

## 1. Context & Motivation

In `./aico/idea.md`, the initial blueprint proposed a linear 7-skill SDD pipeline:
`brainstorm` $\to$ `deep-dive` $\to$ `spec-creation` $\to$ `planning` $\to$ `test-scaffolding` $\to$ `implementation` $\to$ `review-loop`.

However, examining the full catalog of **Matt Pocock's skills** (`mattskills`) reveals that real-world engineering is not strictly a single forward pipeline. Real development frequently encounters:
- **Uncertainty & Routing**: Developers/agents not knowing which skill fits the current problem (`ask-matt`).
- **Linguistic Ambiguity & ADRs**: Vocabulary drift and unrecorded architectural tradeoffs (`domain-modeling`).
- **Architectural Shape & Seams**: Designing deep modules with high leverage rather than shallow pass-throughs (`codebase-design`).
- **Foggy Greenfield Epics**: Efforts too large or foggy for a single session (`wayfinder`).
- **Defects & Regressions**: Broken behavior that does not require a full spec lifecycle (`diagnosing-bugs`).
- **Exploratory Spikes**: Unclear state transitions or UI layouts that require throwaway code before specifying (`prototype`).
- **Codebase Health**: Proactive refactoring based on structural friction (`improve-codebase-architecture`).
- **Continuous Learning**: Upgrading agent steering, linters, and tools after things go sideways (`retro`).

---

## 2. Evaluation of MattSkills Candidates for AICO

| Skill in `mattskills` | Role & Key Levers | Relevance to AICO (1-5) | Recommendation for AICO |
| :--- | :--- | :--- | :--- |
| **`ask-matt`** | Router over all skills. Diagnoses developer situation; selects entry point or on-ramp. | ⭐⭐⭐⭐⭐ (5/5) | **ADD as `aico-guide`**: Serves as the global Omnibar (`Cmd+K`) entry point and chat router. Guides users/agents to the exact right skill. |
| **`domain-modeling`** | Actively challenges fuzzy terms; maintains `GLOSSARY.md`; records ADRs for hard-to-reverse tradeoffs. | ⭐⭐⭐⭐⭐ (5/5) | **ADD as `aico-domain-modeling`**: Directly populates AICO's glossary and ADR graph in Kùzu. Runs underneath brainstorm and spec creation. |
| **`codebase-design`** | Vocabulary for deep modules (module, interface, depth, seam, adapter, leverage, locality). | ⭐⭐⭐⭐⭐ (5/5) | **INTEGRATE as shared reference**: The foundational design vocabulary for `aico-deep-dive` and `aico-test-scaffolding`. |
| **`diagnosing-bugs`** | Discipline for hard bugs: refuses to theorize without a tight red-capable feedback loop; minimises repro; regression tests at seams. | ⭐⭐⭐⭐⭐ (5/5) | **ADD as `aico-diagnosing-bugs`**: Critical on-ramp for bug fixing without forcing an unnecessary full-feature spec cycle. |
| **`prototype`** | Throwaway code to answer a design question: Logic branch (HTML state machine) vs UI branch (variant switcher). | ⭐⭐⭐⭐ (4/5) | **ADD as `aico-prototype`**: Essential detour between brainstorm and spec creation for complex UI/state mechanics. |
| **`wayfinder`** | Maps massive, foggy greenfield efforts as decision tickets; works the frontier of decisions, not deliverables. | ⭐⭐⭐⭐ (4/5) | **ADD as `aico-wayfinder`**: Ideal for architecting AICO itself and for massive new modules before they collapse into specs. |
| **`improve-codebase-architecture`** | Scans codebase for deepening opportunities (shallow $\to$ deep); presents visual HTML report with Mermaid. | ⭐⭐⭐⭐⭐ (5/5) | **ADD as `aico-codebase-health`**: In AICO, this is supercharged by querying Kùzu for fan-in/fan-out and circular dependencies! |
| **`retro`** | Retrospective on agent runs; upgrades the *environment* (navigation pointers, deterministic linters, steering). | ⭐⭐⭐⭐ (4/5) | **ADD as `aico-retro`**: Closes the loop on agent failures; ensures the AICO harness continuously improves. |
| **`triage`** | Moves external/unstructured bug reports and requests into agent-ready tickets. | ⭐⭐⭐ (3/5) | **DEFER**: AICO is local-first; triage is only needed once multi-user issue intake is integrated. |
| **`handoff`** | Writes portable markdown across directories, harnesses, or colleagues. | ⭐⭐⭐ (3/5) | **INTEGRATE into MCP session gates**: Can be handled natively by AICO workspace state serialization. |

---

## 3. The Unified AICO Harness Architecture

By integrating the highest-leverage skills from `mattskills`, AICO's harness expands from a rigid 7-skill pipeline into a **complete engineering operating system**:

```
                       ┌─────────────────────────┐
                       │       aico-guide        │  (Router / Omnibar Entry Point)
                       └────────────┬────────────┘
                                    │
       ┌────────────────────────────┼────────────────────────────┐
       ▼                            ▼                            ▼
 [Greenfield / Big Fog]     [Feature Creation]           [Bug / Broken State]
   aico-wayfinder           aico-brainstorm              aico-diagnosing-bugs
 (Decision Tree Map)        (Socratic Grilling)          (Tight Loop Repro)
       │                            │                            │
       │                            ├──────► aico-prototype      │
       │                            │        (Spike State/UI)    │
       │                            ▼                            │
       └───────────────────► aico-spec-creation ◄────────────────┘
                             (EARS Requirements)
                                    │
                                    ▼
                              aico-planning
                           (Task DAG & Frontier)
                                    │
                                    ▼
                          aico-test-scaffolding
                          (Red Tests @ Public Seams)
                                    │
                                    ▼
                           aico-implementation
                          (Green Code + In-band Tags)
                                    │
                                    ▼
                            aico-review-loop
                       (Two-Axis Review + Convergence)
                                    │
                     ┌──────────────┴──────────────┐
                     ▼                             ▼
                aico-retro               aico-codebase-health
         (Environment Evolution)          (Kùzu Deepening Scan)
```

---

## 4. Specification of the Recommended Additions

### 4.1 `aico-guide` (Skill & Flow Router)
* **Trigger**: Invoked when the user or agent is unsure what step to take next, or via `Cmd+K` global search in the AICO desktop app.
* **Function**: Analyzes user intent, checks the current project state (clean git status, active spec, failing tests, or unstarted idea), and maps the user to the fastest effective skill path.

### 4.2 `aico-domain-modeling` (Ubiquitous Language & ADR Engine)
* **Trigger**: Model-invoked during brainstorming and spec authoring, or user-invoked when discussing naming and architecture.
* **Function**: Actively challenges fuzzy synonyms ("Does 'session' mean auth token or browser connection?"). Updates `GLOSSARY.md`. Enforces the 3-part ADR rule (hard to reverse, surprising without context, real tradeoff) and records decisions under `docs/adr/`.
* **AICO Native Integration**: Automatically commits glossary nodes and ADR edges into the embedded Kùzu graph and LanceDB index.

### 4.3 `aico-diagnosing-bugs` (Tight-Loop Defect Resolution)
* **Trigger**: When behavior is broken, tests fail intermittently, or performance regresses.
* **Function**: 
  1. *Refuses to hypothesize* without a tight, red-capable command.
  2. Minimises reproduction to load-bearing lines.
  3. Formulates 3-5 falsifiable hypotheses.
  4. Instruments code with unique `[DEBUG-xxxx]` grep tags.
  5. Fixes the defect and adds a regression test at a verified public seam with `// @verifies SPEC-XXX::BUG-YYY`.
  6. Cleans up all debug tags.

### 4.4 `aico-prototype` (Spike & Hypothesis Testing)
* **Trigger**: When a design question in brainstorming cannot be settled by conversation alone.
* **Function**:
  - *Logic Branch*: Builds an interactive HTML state-machine walkthrough to test state transitions.
  - *UI Branch*: Generates visual UI variants with switchable parameters.
  - Keeps code throwaway, surfaces full state after every action, and captures findings as a primary source reference before writing specs.

### 4.5 `aico-wayfinder` (High-Fog Greenfield Chartering)
* **Trigger**: Major architectural initiatives that cannot fit in a single session or spec (e.g. building AICO's own desktop storage layer).
* **Function**: Establishes a shared map of decision tickets. Distinguishes between what can be specified now, the "fog of war" (not yet specified), and what is out of scope. Resolves decisions one by one, then hands off to `aico-spec-creation`.

### 4.6 `aico-codebase-health` (Graph-Assisted Deepening & Refactoring)
* **Trigger**: Upkeep sessions or when modules become brittle.
* **Function**: Queries Kùzu for structural smell metrics (modules with shallow implementations, high fan-out, high coupling). Applies the *deletion test* and presents candidates as visual before/after HTML/Mermaid diagrams. Guides deepening refactors.

### 4.7 `aico-retro` (Harness & Environment Evolution)
* **Trigger**: After completing a feature or resolving a difficult bug.
* **Function**: Evaluates the session to see why mistakes happened. Proposes mechanical fixes (custom linter rules, pre-commit hooks, Tree-sitter tag rules) rather than fuzzy prompt steering, and prunes stale instructions from `AGENTS.md`.
