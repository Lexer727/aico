---
name: aico-deep-dive
description: "Perform system boundary, dependency graph traversal, and blast-radius analysis before designing or refactoring modules. Walks Kùzu graph and designates test seams."
disable-model-invocation: false
---

# AICO Deep-Dive: System Boundaries & Blast Radius

Run before drafting formal contracts to investigate existing code structure, evaluate module depth, and calculate the blast radius of proposed changes.

---

## Process

### 1. Kùzu Graph Traversal
Execute openCypher traversals in Kùzu (or AST code search in meta-mode) across 2 to 4 hops:
```cypher
// Trace all transitive callers and dependents of the target module/symbol
MATCH path = (target:Module {name: $module_name})<-[:IMPORTS|CALLS*1..4]-(caller)
RETURN path;

// Find existing test coverage for the target module
MATCH (t:Test)-[:VERIFIES]->(req:Requirement)<-[:IMPLEMENTS]-(target:CodeSymbol)
WHERE target.module = $module_name
RETURN t, req;
```

### 2. Blast Radius Classification
Categorize the intended change into one of two patterns:

- **Pattern A: Tracer Bullet (Contained)**
  - Localized change where public module contracts remain stable or backwards-compatible.
  - Can be built end-to-end within existing seams in a single sequence.

- **Pattern B: Wide Refactor (Systemic)**
  - A mechanical change (retyping a core entity, altering an IPC interface) whose blast radius touches dozens of files simultaneously.
  - **Must be sequenced as Expand–Contract**:
    1. *Expand*: Introduce the new interface/schema alongside the legacy one.
    2. *Migrate*: Migrate callers in discrete, testable batches (per module/directory).
    3. *Contract*: Delete the legacy interface once all callers are verified on the new one.

### 3. Public Seam Designation
Consult `aico-codebase-design`:
- Identify the highest public seam where behavior can be observed without reaching into internals.
- Enforce the rule: *the interface is the test surface*.
- Confirm designated seams with the developer.

### 4. Artifact Generation via MCP Gate
Commit the deep-dive document via `create_sdd_artifact`:
```yaml
mcp_call:
  tool_name: "create_sdd_artifact"
  parameters:
    artifact_type: "deep_dive"
    domain: "<domain>"
    slug: "<kebab-slug>"
    derives_from_ids: ["BRAIN-..."]
    title: "Deep-Dive: <Title>"
    content_body: |
      # Deep-Dive Analysis: <Title>
      
      ## System Boundary & Affected Modules
      <List of affected modules and files identified via Kùzu>
      
      ## Dependency Walk & Blast Radius
      <Graph findings, transitive callers, and classified pattern (Tracer vs Expand-Contract)>
      
      ## Designated Public Seams
      <The exact interfaces and seams where tests will be anchored>
```

---

## Completion Criteria
- [ ] Transitive callers and dependents enumerated.
- [ ] Pattern classified (Tracer bullet vs Expand-Contract).
- [ ] Public test seams designated.
- [ ] Deep-dive artifact committed.
