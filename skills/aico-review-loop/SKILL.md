---
name: aico-review-loop
description: "Perform adversarial two-axis verification (Standards vs Spec) and structural graph convergence checks before merging."
disable-model-invocation: false
---

# AICO Review Loop: Two-Axis Review & Convergence

Adversarial verification of changes against two independent axes, followed by a structural Kùzu graph convergence audit.

---

## 1. Why Two Axes?

A code change can pass one axis and fail the other:
- *Follows every standard but implements the wrong feature* $\to$ **Standards Pass, Spec Fail**.
- *Does what the spec asked but introduces spaghetti and code smells* $\to$ **Spec Pass, Standards Fail**.

Running both axes independently stops one from masking the other.

---

## 2. Process

### Axis 1: Standards Review
Inspect the git diff against documented repo rules (`CODING_STANDARDS.md`) and the **Fowler Smell Baseline** ([`SMELL-BASELINE.md`](SMELL-BASELINE.md)):
- Mysterious Names
- Duplicated Code
- Feature Envy / Data Clumps
- Speculative Generality
- Leaky Seams / Middle Men

### Axis 2: Spec Conformance & Scope Creep
Compare the git diff directly against `SPEC-*.md`:
- **Missing**: Any `REQ-###` item not addressed.
- **Partial**: Requirements implemented incompletely or failing edge conditions.
- **Unrequested (Scope Creep)**: Code, abstractions, or features added in the diff that were not requested by the spec.

### Axis 3: Kùzu Graph Traceability Closure
Query Kùzu to ensure every requirement has complete graph closure:
```cypher
// Find un-implemented requirements
MATCH (r:Requirement)
WHERE NOT ()-[:IMPLEMENTS]->(r)
RETURN r.id AS unimplemented_req;

// Find un-verified requirements
MATCH (r:Requirement)
WHERE NOT ()-[:VERIFIES]->(r)
RETURN r.id AS unverified_req;
```

---

## 3. Convergence Decision

### Outcome A: Gaps Detected (`tasks_appended`)
Append a new `## Phase N: Convergence` section to `PLAN-*.md` with tasks for each finding:
```markdown
## Phase N: Convergence
- [ ] TASK-090 Fix incomplete error handling in session validation per REQ-004 (partial)
- [ ] TASK-091 Remove unrequested telemetry configuration hook (unrequested)
```
Recommend running `/aico-test-scaffolding` and `/aico-implementation` to complete the appended tasks.

### Outcome B: Fully Converged (`converged`)
If zero critical/high findings exist and Kùzu graph closure is 100%:
> **"✅ Converged: Implementation completely satisfies spec, coding standards, and graph traceability."**

---

## Completion Criteria
- [ ] Standards review and Spec review reported separately.
- [ ] Kùzu graph traceability checked (zero dangling requirements).
- [ ] Convergence verdict emitted (either clean or tasks appended).
