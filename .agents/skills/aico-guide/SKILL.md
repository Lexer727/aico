---
name: aico-guide
description: "Router and navigator over the AICO Spec-Driven Design harness. Use when you are unsure which skill or workflow fits your current task."
disable-model-invocation: true
---

# AICO Guide: Harness Router & Flow Navigator

You are the entry point and router for the AICO Spec-Driven Design harness. When the developer or agent does not know where to start, diagnose the situation and navigate to the fastest effective skill.

## Diagnostic Triage

Examine the workspace state and the user's intent to select the entry flow:

```
                                What are you starting with?
                                             │
      ┌──────────────────────┬───────────────┴───────────────┬──────────────────────┐
      ▼                      ▼                               ▼                      ▼
A loose, foggy idea    A concrete feature              Something broken       Existing codebase
or greenfield epic     or capability                   or failing             friction or upkeep
      │                      │                               │                      │
      ▼                      ▼                               ▼                      ▼
/aico-wayfinder        /aico-brainstorm                /aico-diagnosing-bugs  /aico-codebase-health
(Decision Map)         (Grilling & LanceDB)            (Tight Loop Repro)     (Kùzu Deepening Scan)
```

### 1. Main Feature Flow (Idea → Shipped)
The primary path for building new features or applications:
1. **`/aico-brainstorm`**: Sharpens the intent via Socratic grilling, queries LanceDB for prior architectural rules, and aligns domain terminology in `GLOSSARY.md`.
   - *Detour*: If a question needs a runnable visual or state model before writing specs, branch into **`/aico-prototype`** on a throwaway branch.
2. **`/aico-spec-creation`**: Synthesizes the brainstorm into formal EARS requirements (`REQ-###`) using the 5 canonical patterns. Records explicit out-of-scope boundaries and designated public test seams.
3. **`/aico-planning`**: Decomposes the specification into a Directed Acyclic Graph (DAG) of vertical tracer bullets with explicit `blocked_by` dependencies and an active unblocked frontier.
4. **`/aico-test-scaffolding`**: Scaffolds red (failing) tests at public seams tagged with `// @verifies SPEC-ID::REQ-ID`.
5. **`/aico-implementation`**: Writes minimal code to make tests green, tagging source symbols with `// @implements SPEC-ID::REQ-ID`.
6. **`/aico-review-loop`**: Two-axis adversarial verification (Standards smell baseline vs Spec fidelity) + Kùzu graph convergence closure.

### 2. High-Fog Greenfield On-Ramp
- **Situation**: A massive effort too large for one session (greenfield project, major architecture subsystem).
- **Skill**: **`/aico-wayfinder`**. Charts a shared map of decision tickets, manages the "fog of war" (*Not yet specified*), and resolves decisions one at a time. Once clear, hands off to `/aico-spec-creation`.

### 3. Defect & Regression On-Ramp
- **Situation**: A bug, flaky test, or performance regression in existing code.
- **Skill**: **`/aico-diagnosing-bugs`**. Refuses to theorize without a tight red-capable feedback loop, minimises the reproduction, formulates 3–5 falsifiable hypotheses, instruments with tagged logs, and locks down the fix with a regression test.

### 4. Codebase Upkeep & Architecture Health
- **Situation**: Spare time, code feels brittle, or preparing for a major refactor.
- **Skill**: **`/aico-codebase-health`**. Uses Kùzu openCypher queries to find shallow modules and tangled imports, presenting visual before/after deepening refactors.

### 5. Learning & Retrospective
- **Situation**: After a build went sideways or an agent made recurring mistakes.
- **Skill**: **`/aico-retro`**. Analyzes session logs to upgrade the agent environment—converting human corrections into deterministic linter rules, pre-commit hooks, or Tree-sitter queries.

---

## Foundation References (Always Available)

Two foundational skills provide vocabulary and architectural rules beneath the other skills:
- **`aico-domain-modeling`**: Ubiquitous language, `GLOSSARY.md`, and Architecture Decision Records (`docs/adr/`).
- **`aico-codebase-design`**: Deep module principles, public test seams, leverage, and locality.

---

## Router Action

When invoked:
1. Ask the user what they want to achieve if unclear.
2. Inspect the current directory (check git status, active specs, failing tests).
3. Recommend the exact next skill with a 1-2 sentence justification.
