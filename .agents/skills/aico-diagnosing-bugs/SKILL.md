---
name: aico-diagnosing-bugs
description: "Diagnosis and repair loop for hard bugs and regressions. Refuses to theorize without a tight red-capable feedback loop, minimises repro, and locks down with seam-tested regressions."
disable-model-invocation: false
---

# AICO Diagnosing Bugs: Tight-Loop Bug Resolution

A disciplined, structured process for hard bugs, intermittent flakes, and performance regressions.

---

## Phase 1: Build a Feedback Loop
**This is the core skill.** Never jump straight into code reading or speculation. Construct a single command that reliably goes **Red** on this bug and will turn **Green** when fixed.

### Acceptable Feedback Loops
1. A failing test at a public seam.
2. A curl/HTTP script against a local server.
3. A headless browser test reproducing the UI issue.
4. A CLI command with snapshot comparison.
5. Replaying a captured event trace or payload.

### The Completion Criterion for Phase 1
You must execute and demonstrate a single command that is:
- [ ] **Red-capable**: Fails precisely on the user's reported symptom.
- [ ] **Deterministic**: Returns the same verdict every run (for non-deterministic bugs, stress/loop until reproduction rate is >50%).
- [ ] **Fast**: Runs in seconds, not minutes.
- [ ] **Agent-runnable**: Can run unattended.

---

## Phase 2: Reproduce + Minimise
1. Run the loop and watch it go **Red**.
2. **Minimise**: Remove lines, data, callers, and configuration one at a time, re-running the loop.
3. Keep only what is load-bearing: removing any remaining element makes the loop go green.

---

## Phase 3: Formulate Hypotheses
Generate **3 to 5 ranked, falsifiable hypotheses** before changing any production code:
> *"If `<cause>` is true, then changing `<variable Y>` will make the bug disappear / changing `<variable Z>` will trigger it immediately."*

Show the ranked list to the user before testing.

---

## Phase 4: Instrument
- Probe predictions one variable at a time.
- Tag every debug log with a unique search prefix: e.g. `[DEBUG-bf41]`.
- For performance regressions, establish a baseline measurement before touching code.

---

## Phase 5: Fix + Regression Test
1. Turn the minimised reproduction into a permanent regression test at a public seam.
2. Tag the test:
   ```typescript
   // @verifies SPEC-CORE-001::BUG-042
   test("handles concurrent cache eviction without panic", async () => { ... });
   ```
3. Watch the test fail.
4. Apply the minimal fix in production code.
5. Watch the test pass.
6. Re-run the Phase 1 loop against the original un-minimised scenario.

---

## Phase 6: Cleanup
- [ ] Grep and remove all `[DEBUG-...]` instrumentation lines.
- [ ] Verify regression test passes clean.
- [ ] Commit fix and explain the verified hypothesis in the commit message.
