---
name: aico-retro
description: "Conduct a retrospective on an agent coding session. Inspects session logs and upgrades the agent's environment with deterministic checks, linter rules, and navigation pointers."
disable-model-invocation: true
---

# AICO Retrospective: Environment & Guardrail Evolution

Conduct a retrospective after completing a feature build or debugging a difficult issue. 

The goal of `/aico-retro` is **not to critique the code**, but to **upgrade the agent's environment** (navigation pointers, automated checks, linter rules, and steering files) so the next run starts from a tighter, smarter baseline.

---

## Retrospective Categories

Analyze the primary session logs across 6 improvement vectors:

1. **Navigation**:
   - Did the agent struggle to locate the right files?
   - *Fix*: Add navigation pointers to `AGENTS.md` or domain glossaries.
2. **Automated Checks vs. Prompt Rules**:
   - Did the agent make a mechanical mistake (wrong import shape, banned API, missing `@implements` tag)?
   - *Fix*: Build a deterministic check! Add a custom linter rule, a Tree-sitter query check, or a pre-commit hook. Never rely on prompting what a tool can deterministically enforce.
3. **Coding Standards**:
   - Did the review agent miss a subjective smell or pattern?
   - *Fix*: Refine `CODING_STANDARDS.md` with concrete good/bad code examples.
4. **Tool Economy & Context Pressure**:
   - Did the agent execute expensive, redundant tool calls or flood the context window?
   - *Fix*: Introduce targeted MCP helper queries or refine tool definitions.
5. **No-Ops & Sediment**:
   - Are there instructions in `AGENTS.md` or skills that the model already obeys by default, paying token load for zero behavioral change?
   - *Fix*: Prune no-ops ruthlessly.
6. **Information Access**:
   - Was crucial context (like build logs, database schemas, or test error traces) hidden from the agent?
   - *Fix*: Wire automatic log capture or provide read-only query access.

---

## Process

1. **Inspect Session Log**: Read transcript or history of the current or specified session.
2. **Categorize Failures**: Map any hallucination, rework, or manual human correction to the categories above.
3. **Draft Environment Enhancements**:
   - If mechanical $\to$ draft a script, linter config, or git hook.
   - If informational $\to$ draft a compact pointer.
   - If prompt-steering $\to$ prune or sharpen.
4. **Present Recommendations**: Present proposals ordered by impact and ask the developer for permission to commit them.

---

## Completion Criteria
- [ ] Session log inspected.
- [ ] Candidate environment improvements formulated.
- [ ] Approved deterministic checks or pointers added to repository.
