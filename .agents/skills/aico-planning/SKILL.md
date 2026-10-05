---
name: aico-planning
description: "Decompose specifications into a Directed Acyclic Graph (DAG) of vertical tracer-bullet tasks, declaring explicit blocking dependencies and computing the active frontier."
disable-model-invocation: false
---

# AICO Planning: Task Graph & Frontier Decomposition

Decompose specifications into an executable **task graph (DAG)** of vertical tracer bullets, mapping each task to specific EARS requirements and computing the active unblocked frontier.

---

## 1. Vertical Tracer-Bullet Rules

Break the work down using tracer-bullet vertical slices:
- **Vertical, not horizontal**: Each slice cuts a narrow path through every necessary layer (schema $\to$ logic $\to$ API $\to$ test), rather than doing "all schemas first, then all APIs".
- **Self-contained context**: Sized to fit comfortably in a single agent context window.
- **Traceable**: Every task must explicitly declare which `REQ-###` identifiers it addresses.
- **Prefactoring first**: "Make the change easy, then make the easy change." Prefactoring tasks are scheduled before feature tasks.

### Wide Refactor Exception: Expand–Contract
For widespread mechanical changes (renaming types, altering core IPC protocols), do not attempt a single vertical slice:
1. **Expand**: Add the new interface alongside the old form so nothing breaks.
2. **Migrate**: Migrate call sites in batches (per module/directory), each batch a separate task blocked by the expand.
3. **Contract**: Remove the old interface in a final task blocked by all migration batches.

---

## 2. Process

### Step 1: Draft Vertical Slices
Examine `SPEC-*.md` and identify the end-to-end paths required to satisfy all `REQ-###` items.

### Step 2: Establish Blocking Edges (DAG)
Assign explicit dependency prerequisites (`blocked_by: [TASK-001, ...]`).
- A task with no blockers can start immediately.
- Never introduce circular dependencies.

### Step 3: Register Task Graph
In AICO, task nodes and blocking edges are committed to Kùzu:
```cypher
MERGE (t:Task {id: $task_id, title: $title, status: "ready"})
MERGE (r:Requirement {id: $req_id})
MERGE (t)-[:ADDRESSES]->(r)
WITH t
UNWIND $blockers AS b_id
MATCH (b:Task {id: b_id})
MERGE (b)-[:BLOCKS]->(t)
```

### Step 4: Compute the Active Frontier
Query the unblocked tasks ready for immediate execution:
```cypher
MATCH (t:Task)
WHERE t.status = "ready" AND NOT ()-[:BLOCKS]->(t)
RETURN t
```

### Step 5: Commit Artifact via MCP Gate
Commit `PLAN-{domain}-{slug}.md` via `create_sdd_artifact`:
```yaml
mcp_call:
  tool_name: "create_sdd_artifact"
  parameters:
    artifact_type: "plan"
    domain: "<domain>"
    slug: "<slug>"
    derives_from_ids: ["SPEC-..."]
    title: "Plan: <Title>"
    content_body: <Formatted using PLAN-TEMPLATE.md>
```

---

## Completion Criteria
- [ ] 100% of EARS `REQ-###` mapped to at least one task.
- [ ] Explicit `blocked_by` dependencies declared for all tasks.
- [ ] Initial active frontier computed and displayed.
- [ ] Artifact committed.
