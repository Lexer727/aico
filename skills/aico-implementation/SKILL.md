---
name: aico-implementation
description: "Implement minimal code to turn scaffolded red tests green, tagging source symbols with @implements annotations and advancing the task frontier."
disable-model-invocation: false
---

# AICO Implementation: Deterministic Green Loop

The second half of the red-to-green loop. Implement only enough production code to pass the scaffolded red tests, attach in-band traceability annotations, and advance the task frontier.

---

## 1. Implementation Discipline

- **Red before Green**: Never write code without a failing test already in place.
- **Minimal Implementation**: Write only enough code to satisfy the test. Do not anticipate speculative future requirements or add unrequested configuration knobs.
- **Respect Seams**: Implement behind the public interface agreed upon in the deep-dive and spec.
- **In-band Annotations**: Tag implementing functions, classes, or modules with the requirement they satisfy.

---

## 2. In-Band Implementation Tagging

Every public symbol satisfying an EARS requirement must include an in-band annotation:

```typescript
// @implements SPEC-AUTH-001::REQ-002
export function validateSessionToken(token: string): SessionVerdict {
  // minimal implementation
}
```

In Python:
```python
# @implements SPEC-AUTH-001::REQ-002
def validate_session_token(token: str) -> SessionVerdict:
    ...
```

In Rust:
```rust
// @implements SPEC-AUTH-001::REQ-002
pub fn validate_session_token(token: &str) -> Result<SessionVerdict, AuthError> {
    ...
}
```

AICO's Tree-sitter background watcher extracts these tags upon file save and commits the edge to Kùzu:
```cypher
MERGE (c:CodeSymbol {name: $symbol_name, file: $file_path})
MERGE (r:Requirement {id: $req_id})
MERGE (c)-[:IMPLEMENTS]->(r)
```

---

## 3. Process

1. **Pick the Active Red Test**: Focus strictly on the test file produced by `/aico-test-scaffolding`.
2. **Write Minimal Code**: Implement the logic behind the designated seam.
3. **Attach `@implements` Tags**: Annotate the relevant public symbols.
4. **Execute Verification**:
   - Run the local test runner until the suite turns **GREEN**.
   - Run local linters and typecheckers.
5. **Update Task & Advance Frontier**:
   - Mark the current task completed in `PLAN-*.md`.
   - Update Kùzu task state (`SET t.status = 'completed'`).
   - Query Kùzu for newly unblocked tasks:
     ```cypher
     MATCH (t:Task)
     WHERE t.status = "ready" 
       AND NOT EXISTS { MATCH (b:Task)-[:BLOCKS]->(t) WHERE b.status <> "completed" }
     RETURN t
     ```
6. **Next Step**:
   - If tasks remain on the frontier: Repeat with `/aico-test-scaffolding`.
   - If all tasks are completed: Advance to **`/aico-review-loop`**.

---

## Completion Criteria
- [ ] All tests pass (GREEN).
- [ ] Linter and compiler checks pass clean.
- [ ] In-band `@implements` annotations attached.
- [ ] Task marked completed and active frontier updated.
