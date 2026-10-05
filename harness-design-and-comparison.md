# SDD Harness: Cross-Library Synthesis & Architecture Design for AICO

## 1. Executive Summary

This document provides a comparative analysis of three foundational developer tooling repositories—**EARS-Req** (`ears-req`), **MattSkills** (`mattskills`), and **Spec Kit** (`speckit`)—and synthesizes their strengths into a **Spec-Driven Design (SDD) Harness** for **AICO** (`Local Spec-Driven AI Co-Development Environment`).

The design addresses two distinct operational contexts:
1. **Meta-Harness (Developing AICO)**: The skill chain, tooling, and governance needed to build AICO itself (Tauri/Rust, Kùzu property graph, LanceDB hybrid search, Tree-sitter watcher, and local MCP tool gates).
2. **Product-Harness (In-App Runtime)**: The canonical skills bundled into AICO (`.agents/skills/`), driven by agents and humans through MCP gates, openCypher graph traversals, and hybrid search.

---

## 2. Comparative Matrix: EARS-Req vs. MattSkills vs. Spec Kit

| Dimension | `ears-req` (dhruv-15-03/spec-kit-ears) | `mattskills` (Matt Pocock) | `speckit` (GitHub Spec Kit) |
| :--- | :--- | :--- | :--- |
| **Primary Philosophy** | Rigorous linguistic syntax for testable, unambiguous requirements based on Rolls-Royce EARS. | Pragmatic engineering velocity: deep modules, testable seams, vertical tracer-bullets, and relentless grilling. | Structured lifecycle methodology: from constitution to spec, plan, tasks, and deterministic convergence. |
| **Requirements Authoring** | **5 EARS Patterns** (Ubiquitous, Event-Driven, State-Driven, Unwanted, Optional). Strict modal `shall`. Atomic rules. | Problem Statement + User Stories (`As an <actor>, I want...`) + Implementation Decisions. | User Scenarios (P1..P3) with Given/When/Then acceptance criteria + Functional Requirements (`FR-###`). |
| **Ambiguity & Quality Gates** | Read-only **Linting**: flags weak verbs (`handle`, `support`), unmeasurable terms (`fast`), missing triggers/modals. | Socratic **Grilling**: design tree, rounds of questions on the active frontier, recommended answers provided. | Structured **Clarification**: max 5 questions, taxonomy coverage map (Status: Clear/Partial/Missing), spec integration. |
| **Architecture & Decomposition** | N/A (Focuses strictly on requirements definition & traceability). | **Deep Modules**: small interfaces, testable seams, vertical tracer-bullet tickets with explicit blocking edges (DAG). | **Technical Plan & Tasks**: architecture choices, phased tasks, parallel markers `[P]`, requirement mapping. |
| **Verification & Testing** | Traceability matrix (Original text $\to$ EARS statement). | **Seam-oriented TDD**: agreed public seams, red $\to$ green loop, anti-tautological test rules, two-axis review (Standards vs Spec). | **Convergence**: append-only phase N verification loop (`missing`, `partial`, `contradicts`, `unrequested`), constitution checks. |
| **Execution Topology** | Single-pass command files (`speckit.ears.*`). | **Task Graph Frontier**: concurrent implementer subagents in isolated worktrees, merger subagents, PR integration. | Linear phase progression: `specify` $\to$ `clarify` $\to$ `plan` $\to$ `tasks` $\to$ `implement` $\to$ `converge`. |
| **Skill Authoring Mechanics** | Markdown command prompts with variable substitution. | **Agent Skills Masterclass (`writing-for-agents`)**: context vs cognitive load, progressive disclosure, leading words, positive framing. | Multi-agent extension hooks (`before_*`, `after_*`), script execution (`bash`, `powershell`, `python`). |

---

## 3. Deep-Dive Comparison on Overlapping Domains

### 3.1 Requirements Authoring & Quality (EARS vs. SpecKit Specify/Clarify vs. MattSkills to-spec)
* **EARS-Req**: Excels at syntactic precision. Eliminates subjective prose by constraining requirements to 5 patterns with mandatory "shall". Its linting signals (weak verbs, unmeasurable adjectives, compound sentences) provide automated quality heuristics.
* **SpecKit**: Excels at holistic feature framing. Couples prioritized user journeys (P1..P3) with technology-agnostic functional requirements and measurable success criteria (`SC-###`). Its `clarify` command prevents premature planning by actively interrogating underspecified taxonomy areas.
* **MattSkills**: Excels at contextual synthesis and seam identification. Avoids premature file/code snippets in specs to prevent staleness, but demands that testing seams be explicitly identified and agreed upon before writing the spec.
* **Synthesis for AICO**: 
  - AICO specifications must mandate **EARS syntax** for all functional requirements (`REQ-###`).
  - Feature specifications must define **test seams** up front (`codebase-design`).
  - Ambiguity must be gated by interactive **Grilling/Clarification** with recommended choices before tasks are generated.

### 3.2 Task Decomposition & Architecture (MattSkills to-tickets vs. SpecKit plan/tasks)
* **SpecKit**: Uses phased Markdown checklists (`tasks.md`) with parallel markers `[P]`. Relies on linear sequencing or simple user-story groupings.
* **MattSkills**: Treats tasks as a **Directed Acyclic Graph (DAG)** of vertical tracer bullets. Each ticket cuts through every layer (schema $\to$ logic $\to$ API $\to$ tests) and explicitly declares `Blocked by:` edges. Identifies "wide refactors" as exceptions handled via an **expand-contract** pattern. Maintains an active **frontier** of unblocked tickets.
* **Synthesis for AICO**:
  - AICO already leverages a graph database (**Kùzu**). Task decomposition should natively model tasks as a DAG with explicit dependency edges (`[:BLOCKS]`), allowing the agent or UI to query the active unblocked frontier dynamically (`MATCH (t:Task) WHERE NOT ()-[:BLOCKS]->(t) RETURN t`).

### 3.3 Implementation & Test-Driven Development (MattSkills tdd/implement-spec vs. SpecKit implement)
* **SpecKit**: Iterates through checklist items in `tasks.md`, updating checkmarks upon completion.
* **MattSkills**: Strictly enforces **Seam-Oriented TDD**:
  1. No test at an unagreed seam.
  2. Public interface verification only (no testing internals or mocking internal collaborators).
  3. Red-to-green minimal implementation.
  4. Parallel implementer subagents running in isolated git worktrees, merged back via a dedicated merger subagent.
* **Synthesis for AICO**:
  - Implementers work along the active task graph frontier.
  - Test files are scaffolded with in-band verification tags (`// @verifies SPEC-ID::REQ-ID`).
  - Source code is generated to turn tests green with implementation tags (`// @implements SPEC-ID::REQ-ID`).

### 3.4 Verification, Review & Convergence (SpecKit converge/analyze vs. MattSkills code-review vs. EARS lint)
* **SpecKit**:
  - `analyze`: Strictly read-only pre-implementation cross-check across spec, plan, tasks, and constitution.
  - `converge`: Append-only post-implementation audit. Classifies gaps into `missing`, `partial`, `contradicts`, `unrequested` with severity grading (`CRITICAL`, `HIGH`, `MEDIUM`, `LOW`), appending remediations as `Phase N: Convergence`.
* **MattSkills**:
  - `code-review`: Two-axis independent evaluation running in parallel sub-agents: **Standards** (Fowler smells + repo conventions) vs. **Spec** (omissions, wrong behavior, scope creep). Prevents one axis from masking the other.
* **EARS-Req**:
  - `lint`: Evaluates whether written requirements conform to atomic grammar and flags ambiguity.
* **Synthesis for AICO**:
  - AICO combines both: A two-axis review comparing git diffs against the spec and coding standards, coupled with SpecKit's formal `converge` gap taxonomy, while querying Kùzu to ensure 100% of requirement nodes have corresponding `(:CodeSymbol)-[:IMPLEMENTS]->(:Requirement)` and `(:Test)-[:VERIFIES]->(:Requirement)` graph edges.

---

## 4. Developed Skills Architecture for AICO

In accordance with `./aico/idea.md`, AICO requires **7 Core SDD Skills**, enriched by the lessons of `mattskills`, `speckit`, and `ears-req`. Furthermore, these skills exist in two operational tiers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        AICO SDD SKILL HARNESS                          │
├───────────────────────────────────┬────────────────────────────────────┤
│ Tier 1: Meta-Harness (Dogfooding) │ Tier 2: Product-Harness (Runtime)  │
│ To architect & build AICO itself  │ Built into AICO for end-users      │
│ • Local CLI / Agent workflows     │ • Local Tauri / In-Process Engine  │
│ • Filesystem & Git worktrees      │ • Native LanceDB + Kùzu Cypher     │
│ • Mock / Initial MCP Server       │ • Deterministic MCP Tool Gates     │
└───────────────────────────────────┴────────────────────────────────────┘
```

### 4.1 Skill 1: `aico-brainstorm` (Problem Exploration & Architectural Framing)
* **Inspiration**: SpecKit `assess`, MattSkills `grilling`, `domain-modeling`.
* **Purpose**: Explores user intent, stress-tests assumptions, resolves domain terminology, and discovers existing architectural constraints.
* **Mechanics**:
  1. Queries **LanceDB** via hybrid search (`BM25` + vector `bge-small-en-v1.5`) for existing ADRs, brainstorms, and architecture notes.
  2. Runs a **relentless Socratic interview** (`grilling` style) across the decision frontier, presenting numbered questions with recommended answers.
  3. Updates domain terminology in `GLOSSARY.md`.
  4. Invokes MCP gate `create_sdd_artifact(artifact_type='brainstorm', domain=..., slug=..., derives_from_ids=[...])`.
* **Output**: `brainstorms/{domain}/BRAIN-{seq}-{slug}.md`.

### 4.2 Skill 2: `aico-deep-dive` (System Boundary & Blast-Radius Analysis)
* **Inspiration**: MattSkills `codebase-design`, SpecKit `analyze`, MattSkills expand-contract wide refactors.
* **Purpose**: Analyzes the structural impact of the proposed feature or refactor before drafting contractual specs.
* **Mechanics**:
  1. Executes **Kùzu openCypher queries** (2-to-4-hop walks) to locate all modules, functions, and tests that import, call, or verify the affected domain.
  2. Identifies proposed **test seams** (public module boundaries) and classifies the change:
     - *Tracer bullet* (contained blast radius)
     - *Wide refactor* (systemic blast radius requiring expand-contract sequencing).
  3. Invokes MCP gate `create_sdd_artifact(artifact_type='deep_dive', ...)`.
* **Output**: `deep-dives/{domain}/DIVE-{seq}-{slug}.md`.

### 4.3 Skill 3: `aico-spec-creation` (Contract Synthesis & EARS Specification)
* **Inspiration**: EARS-Req (`author`, `lint`), SpecKit (`specify`, `clarify`), MattSkills (`to-spec`).
* **Purpose**: Synthesizes the brainstorm and deep-dive into an unambiguous, testable contract.
* **Mechanics**:
  1. Translates user stories into formal **EARS requirements** (`REQ-001`, `REQ-002`...) using the 5 canonical patterns:
     - *Ubiquitous*: `The <system> shall <response>.`
     - *Event-Driven*: `When <trigger>, the <system> shall <response>.`
     - *State-Driven*: `While <state>, the <system> shall <response>.`
     - *Unwanted Behavior*: `If <condition>, then the <system> shall <response>.`
     - *Optional Feature*: `Where <feature>, the <system> shall <response>.`
  2. Runs internal EARS linting (no weak verbs, no unmeasurable adjectives, single modal `shall`).
  3. Explicitly declares **Out of Scope** boundaries and **Agreed Test Seams**.
  4. Invokes MCP gate `create_sdd_artifact(artifact_type='spec', derives_from_ids=['BRAIN-...', 'DIVE-...'])`.
* **Output**: `specs/{domain}/SPEC-{seq}-{slug}.md`.

### 4.4 Skill 4: `aico-planning` (Task Graph & Frontier Decomposition)
* **Inspiration**: MattSkills `to-tickets`, SpecKit `plan` & `tasks`.
* **Purpose**: Breaks the specification down into a Directed Acyclic Graph (DAG) of vertical tracer bullets.
* **Mechanics**:
  1. Decomposes each EARS requirement into end-to-end vertical slices.
  2. Assigns explicit dependency links (`blocked_by: [TASK-001, ...]`).
  3. For wide refactors, structures tasks into expand $\to$ migrate-batches $\to$ contract phases.
  4. Invokes MCP gate `create_sdd_artifact(artifact_type='plan', derives_from_ids=['SPEC-...'])`.
  5. Computes the initial **unblocked task frontier** ready for agent execution.
* **Output**: `plans/{domain}/PLAN-{seq}-{slug}.md` and associated task graph nodes in Kùzu.

### 4.5 Skill 5: `aico-test-scaffolding` (Red Contract Generation)
* **Inspiration**: MattSkills `tdd`, `codebase-design`.
* **Purpose**: Scaffolds failing tests strictly against agreed seams before application code is written.
* **Mechanics**:
  1. Reads `SPEC-*.md` and target task from the frontier.
  2. Generates test files at designated public seams (avoiding mocks of internal collaborators).
  3. Tags each test with in-band traceability annotations:
     ```typescript
     // @verifies SPEC-AUTH-001::REQ-002
     ```
  4. Executes the local test runner to verify tests are **Red** (failing for the expected behavioral reason, not syntax/import error).
* **Output**: Test suite with `@verifies` annotations in a failing state.

### 4.6 Skill 6: `aico-implementation` (Deterministic Code Generation)
* **Inspiration**: MattSkills `implement-spec`, SpecKit `implement`.
* **Purpose**: Implements the minimal code required to turn red tests green, linking code to requirements.
* **Mechanics**:
  1. Takes an unblocked ticket from the frontier.
  2. Writes minimal implementation code crossing only approved seams.
  3. Adds in-band implementation annotations:
     ```typescript
     // @implements SPEC-AUTH-001::REQ-002
     ```
  4. Runs the local test suite until all tests turn **Green**.
  5. Tree-sitter background watcher automatically indexes code symbols and creates graph edges in Kùzu (`(CodeSymbol)-[:IMPLEMENTS]->(Requirement)`).
  6. Updates task status and advances the active frontier.
* **Output**: Green test suite, passing linter, updated task status.

### 4.7 Skill 7: `aico-review-loop` (Adversarial Verification & Convergence)
* **Inspiration**: MattSkills `code-review`, SpecKit `converge`, EARS `lint`.
* **Purpose**: Performs multi-axis verification to guarantee spec fidelity, zero scope creep, and architectural convergence.
* **Mechanics**:
  1. **Two-Axis Diff Analysis**:
     - *Standards Axis*: Evaluates code smells (Fowler baseline) and repo conventions.
     - *Spec Axis*: Compares git diff directly against `SPEC-*.md` requirements to flag missing items and scope creep.
  2. **Graph Traceability Check (Kùzu)**:
     - Queries Kùzu to ensure 100% of `Requirement` nodes in the spec have corresponding `[:IMPLEMENTS]` and `[:VERIFIES]` edges.
  3. **Convergence Evaluation**:
     - If gaps remain: Appends findings (`missing`, `partial`, `contradicts`, `unrequested`) as a new Convergence phase in the plan/task graph.
     - If clean: Issues the official **Converged** verdict.
* **Output**: Structured convergence and review report.
