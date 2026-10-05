---
name: aico-test-scaffolding
description: "Generate red (failing) behavioral and contract tests at public seams with @verifies tags before writing implementation code."
disable-model-invocation: false
---

# AICO Test Scaffolding: Red Contract Generation

Test scaffolding is the first half of the red-to-green loop. It produces verifiable, failing behavioral tests before any production code is written.

---

## 1. Testing Rules (What Makes a Good Test)

- **Test only at agreed public seams**: Never write tests against private functions or internal module state. Test the public interface.
- **Never mock internal collaborators**: Only mock genuine external boundaries (third-party HTTP APIs, hardware timers). Internal components must interact realistically.
- **Anti-tautological tests**: Never recompute the assertion using the code's own logic. Expected values must come from independent ground truth (spec literals, fixed fixtures).
- **One slice at a time**: Write only the test needed for the active ticket on the frontier.

---

## 2. In-Band Verification Tagging

Every test case must include an in-band annotation linking it to its target EARS requirement:

```typescript
// @verifies SPEC-AUTH-001::REQ-002
test("rejects expired bearer token with 401 Unauthorized", async () => {
  // test implementation
});
```

In Python:
```python
# @verifies SPEC-AUTH-001::REQ-002
def test_rejects_expired_bearer_token():
    ...
```

In Rust:
```rust
// @verifies SPEC-AUTH-001::REQ-002
#[test]
fn test_rejects_expired_bearer_token() {
    ...
}
```

AICO's Tree-sitter background watcher automatically parses these annotations and creates the graph edge in Kùzu:
```cypher
MERGE (t:Test {name: $test_name})
MERGE (r:Requirement {id: $req_id})
MERGE (t)-[:VERIFIES]->(r)
```

---

## 3. Process

1. **Grab Frontier Task**: Select an unblocked task from `PLAN-*.md`.
2. **Review Spec & Seam**: Confirm the designated public seam from `SPEC-*.md` or `DIVE-*.md`.
3. **Scaffold Test Suite**: Write the test file at the public seam exercising the requirement.
4. **Execute Test Runner**:
   - Run the project test suite (`cargo test`, `pnpm test`, `pytest`).
   - Verify that the test fails **RED** due to missing capability, not syntax errors or broken imports.
5. **Handoff**: Pass the failing test to **`/aico-implementation`**.

---

## Completion Criteria
- [ ] Test written strictly against the agreed public seam.
- [ ] In-band `// @verifies SPEC-ID::REQ-ID` tag attached.
- [ ] Local test runner executed and confirms **RED** state.
