# AICO Skills Specification: Architecture & Mechanics

This document specifies the exact structure, triggers, execution flows, and guardrails for the **AICO Spec-Driven Design Harness**, following the Agent Skills format (`SKILL.md`) and the authoring rules from `mattskills/writing-for-agents`.

---

## 1. Skill Architecture Overview

AICO operates with two mirrors of the skill harness:

1. **Meta-Harness (Developing AICO)**:
   - Used *today* to build AICO's desktop platform (Tauri, Rust, React, Kùzu, LanceDB, Tree-sitter, MCP).
   - Relies on file-based conventions and local CLI/test tooling while AICO's embedded engines are being constructed.
2. **Product-Harness (In-App Runtime)**:
   - Embedded into AICO for end-user projects.
   - Enforced by AICO's deterministic **MCP Tool Gates** (`create_sdd_artifact`, `query_graph`, `search_hybrid`).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            7 Core SDD Skills                                │
├───────────────┬─────────────────────────────────────────────────────────────┤
│ 1. Brainstorm │ Problem exploration, Socratic grilling, LanceDB retrieval   │
│ 2. Deep-Dive  │ Kùzu graph walks, blast-radius analysis, seam selection     │
│ 3. Spec       │ 5 EARS patterns, mandatory "shall", out-of-scope boundaries │
│ 4. Plan       │ Task DAG with blocking edges, tracer bullets, frontier      │
│ 5. Test-Scaff │ Failing contract tests at public seams with @verifies tags  │
│ 6. Implement  │ Minimal code to pass tests with @implements tags            │
│ 7. Review     │ Two-axis review (Standards vs Spec) + Kùzu graph convergence│
└───────────────┴─────────────────────────────────────────────────────────────┘
```

---

## 2. Detailed Skill Specifications

### 2.1 `aico-brainstorm`

```yaml
---
name: aico-brainstorm
description: "Explore problem spaces, clarify ambiguous requirements, analyze trade-offs, and establish domain terminology before drafting specifications."
disable-model-invocation: false
---
```

#### Goal
Transform raw ideas, feature requests, or developer discussions into a coherent architectural framing document (`BRAIN-{domain}-{slug}.md`) and aligned domain vocabulary in `GLOSSARY.md`.

#### Process
1. **Context Retrieval**:
   - Query hybrid search (LanceDB / local docs) for prior brainstorms, existing ADRs, and relevant architectural principles.
2. **Socratic Grilling Loop**:
   - Construct an internal decision tree.
   - Identify the unblocked decision frontier (questions that can be asked now without guessing future answers).
   - Present questions in rounds (maximum 3-5 high-impact questions per round), always pairing each question with a recommended option and rationale.
3. **Glossary Alignment**:
   - Identify overloaded or ambiguous terms.
   - Propose canonical terms and record them in `GLOSSARY.md`.
4. **Artifact Generation**:
   - In Meta-Mode: Write to `brainstorms/{domain}/BRAIN-{seq}-{slug}.md`.
   - In Product-Mode: Call MCP tool `create_sdd_artifact(artifact_type='brainstorm', domain=..., slug=..., derives_from_ids=[...], title=..., content_body=...)`.

#### Completion Criteria
- [ ] No unanswered high-impact questions remaining on the decision frontier.
- [ ] All new domain terms captured in `GLOSSARY.md`.
- [ ] Brainstorm document generated with explicit Problem Statement, Explored Approaches, and Decision Rationale.

---

### 2.2 `aico-deep-dive`

```yaml
---
name: aico-deep-dive
description: "Perform system boundary, dependency graph traversal, and blast-radius analysis before designing or refactoring modules."
disable-model-invocation: false
---
```

#### Goal
Determine the exact structural impact of a proposed change, evaluate existing module depth, and designate public test seams.

#### Process
1. **Graph Traversal**:
   - Query Kùzu property graph (or Tree-sitter code index in meta-mode):
     ```cypher
     MATCH path = (m:Module {name: $target_module})<-[:IMPORTS|CALLS*1..4]-(dependent)
     RETURN path
     ```
   - Identify all upstream callers, downstream dependencies, and existing verifying tests (`[:VERIFIES]`).
2. **Blast Radius Classification**:
   - **Tracer Bullet**: Contained blast radius; changes can be executed end-to-end within existing module boundaries.
   - **Wide Refactor**: Cross-cutting change affecting multiple callers simultaneously. Must be scheduled as **Expand-Contract**:
     1. *Expand*: Add the new interface alongside the old.
     2. *Migrate*: Shift callers across batches.
     3. *Contract*: Remove deprecated interface once callers are cleared.
3. **Seam Designation**:
   - Identify the highest public interface where behavior can be observed without reaching inside (`codebase-design`).
   - Confirm test seams with the developer.
4. **Artifact Generation**:
   - Call `create_sdd_artifact(artifact_type='deep_dive', ...)`.

#### Completion Criteria
- [ ] Dependency path and affected callers explicitly enumerated.
- [ ] Execution pattern chosen (Tracer bullet vs Expand-Contract).
- [ ] Testing seams confirmed.

---

### 2.3 `aico-spec-creation`

```yaml
---
name: aico-spec-creation
description: "Synthesize unambiguous, testable specifications using strict EARS patterns, clear out-of-scope boundaries, and traceability links."
disable-model-invocation: false
---
```

#### Goal
Synthesize architectural decisions into formal contract specifications with immutable requirement identifiers (`REQ-###`).

#### Process
1. **EARS Requirements Formulation**:
   - Every functional requirement must strictly adhere to one of the 5 EARS patterns:
     - **Ubiquitous**: `The <system> shall <response>.`
     - **Event-Driven**: `When <trigger>, the <system> shall <response>.`
     - **State-Driven**: `While <state>, the <system> shall <response>.`
     - **Unwanted Behavior**: `If <condition>, then the <system> shall <response>.`
     - **Optional Feature**: `Where <feature>, the <system> shall <response>.`
   - Use the mandatory modal **shall** exactly once per requirement.
   - Split compound statements into atomic requirements.
2. **EARS Linting Pass**:
   - Audit requirements against ambiguity signals:
     - Error: Missing modal (`should`, `must`, `will`), missing trigger, compound sentences.
     - Warning: Weak verbs (`handle`, `support`, `process`), unmeasurable adjectives (`fast`, `scalable`).
     - Mark unresolved points as `[NEEDS CLARIFICATION: <question>]`.
3. **Scope and Seam Constraints**:
   - Document explicit Out-of-Scope boundaries.
   - Document agreed testing seams and public interfaces.
   - Avoid transient file paths or premature code snippets.
4. **Artifact Generation**:
   - Invoke `create_sdd_artifact(artifact_type='spec', derives_from_ids=['BRAIN-...', 'DIVE-...'], ...)`.

#### Completion Criteria
- [ ] 100% of functional requirements conform to EARS syntax.
- [ ] Zero unquantified adjectives in acceptance criteria.
- [ ] Out-of-scope section populated.

---

### 2.4 `aico-planning`

```yaml
---
name: aico-planning
description: "Decompose specifications into a Directed Acyclic Graph (DAG) of vertical tracer-bullet tasks with explicit blocking relationships."
disable-model-invocation: false
---
```

#### Goal
Generate an executable task plan where each task is a self-contained vertical slice mapped directly to EARS requirement IDs.

#### Process
1. **Vertical Slicing**:
   - Break work into vertical tracer bullets (schema $\to$ logic $\to$ API $\to$ test), sized to fit a single context window.
   - Map each task directly to one or more `REQ-###` IDs.
2. **Dependency Modeling**:
   - Assign explicit blocking prerequisites (`blocked_by: [TASK-001, ...]`).
   - Ensure prefactoring tasks ("make the change easy") are sequenced before implementation.
3. **Graph Registration**:
   - Register task nodes and dependency edges in Kùzu:
     ```cypher
     MERGE (t:Task {id: $task_id, title: $title})
     MERGE (r:Requirement {id: $req_id})
     MERGE (t)-[:ADDRESSES]->(r)
     ```
4. **Compute Active Frontier**:
   - Query unblocked tasks (`WHERE NOT ()-[:BLOCKS]->(t)`).
   - Generate `PLAN-{domain}-{slug}.md`.

#### Completion Criteria
- [ ] Every EARS requirement mapped to at least one task.
- [ ] No circular dependencies in the task graph.
- [ ] Initial active frontier identified.

---

### 2.5 `aico-test-scaffolding`

```yaml
---
name: aico-test-scaffolding
description: "Generate red (failing) behavioral and contract tests against designated public seams before writing implementation code."
disable-model-invocation: false
---
```

#### Goal
Create deterministic verification gates that establish the contract and fail for the correct behavioral reason.

#### Process
1. **Target Selection**:
   - Pick an unblocked task from the frontier and its associated `REQ-###`.
2. **Test Generation at Public Seams**:
   - Write tests exercising the public interface without mocking internal collaborators.
   - Tag test suites/cases with in-band verification annotations:
     ```typescript
     // @verifies SPEC-AUTH-001::REQ-002
     ```
3. **Red Verification**:
   - Execute local test runner.
   - Verify tests fail because the behavior is missing, not due to compilation/syntax errors.

#### Completion Criteria
- [ ] Tests written strictly against public seams.
- [ ] In-band `@verifies` tag present.
- [ ] Test runner executed and confirms RED state.

---

### 2.6 `aico-implementation`

```yaml
---
name: aico-implementation
description: "Implement minimal code to turn red tests green, tagging source symbols with requirement links."
disable-model-invocation: false
---
```

#### Goal
Produce clean, production-grade code that satisfies the test contract without scope creep or unrequested features.

#### Process
1. **Minimal Implementation**:
   - Write only enough code to pass the scaffolded red tests.
   - Do not anticipate unrequested features or add speculative abstractions.
2. **In-Band Annotation**:
   - Tag implementing functions, classes, or modules:
     ```typescript
     // @implements SPEC-AUTH-001::REQ-002
     ```
3. **Green Verification**:
   - Run the local test runner until the suite passes (GREEN).
   - Run linters and type checkers.
4. **Watcher Ingestion**:
   - AICO's Tree-sitter background watcher detects saved files and commits edges to Kùzu:
     ```cypher
     MERGE (c:CodeSymbol {name: $symbol})
     MERGE (r:Requirement {id: $req_id})
     MERGE (c)-[:IMPLEMENTS]->(r)
     ```
5. **Advance Frontier**:
   - Mark task completed and recalculate the unblocked frontier.

#### Completion Criteria
- [ ] All scaffolded tests pass (GREEN).
- [ ] `@implements` tags attached to public symbols.
- [ ] Linters and typechecks pass clean.

---

### 2.7 `aico-review-loop`

```yaml
---
name: aico-review-loop
description: "Perform adversarial two-axis verification (Standards vs Spec) and structural graph convergence checks."
disable-model-invocation: false
---
```

#### Goal
Ensure zero scope creep, complete specification coverage, and adherence to codebase quality standards.

#### Process
1. **Two-Axis Diff Analysis**:
   - **Standards Axis**: Scan git diff against documented repo rules and Fowler code smells (Mysterious Name, Duplicated Code, Feature Envy, Primitive Obsession, Speculative Generality).
   - **Spec Axis**: Compare git diff against `SPEC-*.md`. Check for missing requirements, partial implementations, or unrequested code.
2. **Kùzu Graph Lineage Verification**:
   - Verify that all `Requirement` nodes in the spec have at least one incoming `[:IMPLEMENTS]` edge from a `CodeSymbol` and at least one incoming `[:VERIFIES]` edge from a `Test`.
3. **Convergence Decision**:
   - **If Gaps Found**: Append a new `Phase N: Convergence` task set to the plan, categorizing gaps as `missing`, `partial`, `contradicts`, or `unrequested`. Re-enter implementation.
   - **If Clean**: Declare **Converged**.

#### Completion Criteria
- [ ] Zero unaddressed CRITICAL or HIGH findings across both axes.
- [ ] 100% Kùzu requirement-to-code-and-test graph closure.
- [ ] Clean convergence report issued.
