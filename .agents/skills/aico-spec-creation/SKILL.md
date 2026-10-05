---
name: aico-spec-creation
description: "Draft unambiguous, testable feature specifications using strict EARS syntax patterns, immutable requirement IDs, and explicit out-of-scope boundaries."
disable-model-invocation: false
---

# AICO Spec Creation: Contract Synthesis & EARS Grammar

Transform brainstorms and deep-dives into an immutable, verifiable contract specification (`SPEC-{domain}-{slug}.md`).

---

## 1. The EARS Requirements Grammar

Every functional requirement **must strictly conform** to one of the 5 canonical EARS patterns and use the mandatory modal **shall** exactly once:

| Pattern | Template | When to Use |
| :--- | :--- | :--- |
| **Ubiquitous** | The `<system>` shall `<response>`. | Always-active capability with no precondition. |
| **Event-Driven** | When `<trigger>`, the `<system>` shall `<response>`. | Discrete event or user action. |
| **State-Driven** | While `<state>`, the `<system>` shall `<response>`. | Behavior holding during a continuous state. |
| **Unwanted Behavior** | If `<condition>`, then the `<system>` shall `<response>`. | Error handling, timeouts, invalid input. |
| **Optional Feature** | Where `<feature>`, the `<system>` shall `<response>`. | Behavior tied to an optional/configurable flag. |

*See [`EARS-CHEATSHEET.md`](EARS-CHEATSHEET.md) for full examples, complex combinations, and anti-patterns.*

---

## 2. Process

### Step 1: Ingest Context
Load the parent brainstorm (`BRAIN-*.md`), deep-dive (`DIVE-*.md`), and `GLOSSARY.md`. Verify that all domain terms match the canonical glossary.

### Step 2: Formulate EARS Requirements
- Translate each user story into atomic, testable requirements assigned sequential, stable identifiers (`REQ-001`, `REQ-002`, ...).
- **Split compound requirements**: If a statement contains "and" or multiple responses, split it into separate `REQ-###` items.
- Ensure every `<system>` is explicitly named (e.g. `The StorageWatcher shall...`, never passive `Files are watched`).
- If an aspect is genuinely unknown, append `[NEEDS CLARIFICATION: <question>]`.

### Step 3: Enforce Quality & Ambiguity Linting
Audit your draft against the ambiguity checklist:
- ❌ **No weak verbs**: Replace `handle`, `manage`, `process`, `support` with observable actions (`persist`, `render`, `emit`, `reject`).
- ❌ **No unmeasurable adjectives**: Replace `fast`, `user-friendly`, `scalable` with concrete bounds (`under 10ms`, `within 1 second`).
- ❌ **No non-EARS modals**: Reject `must`, `should`, `will`, `can`. Use only `shall`.

### Step 4: Define Scope & Test Seams
- Populate the **Out of Scope** section with everything explicitly rejected during brainstorming.
- Explicitly document the designated **Public Test Seams** identified during `/aico-deep-dive`.
- **Do not include ephemeral code snippets or file paths in the spec** (they rot quickly).

### Step 5: Commit Artifact via MCP Gate
Commit the artifact using `create_sdd_artifact`:
```yaml
mcp_call:
  tool_name: "create_sdd_artifact"
  parameters:
    artifact_type: "spec"
    domain: "<domain>"
    slug: "<slug>"
    derives_from_ids: ["BRAIN-...", "DIVE-..."]
    title: "<Feature Title>"
    content_body: <Formatted using SPEC-TEMPLATE.md>
```

---

## Completion Criteria
- [ ] 100% of functional requirements conform to EARS grammar with stable IDs (`REQ-###`).
- [ ] Out of Scope section populated with explicit boundaries.
- [ ] Designated test seams documented.
- [ ] Artifact committed with provenance references to brainstorm and deep-dive.
