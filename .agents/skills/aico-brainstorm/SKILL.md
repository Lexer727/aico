---
name: aico-brainstorm
description: "Explore problem spaces, clarify ambiguous requirements, analyze trade-offs, and establish domain terminology before drafting specifications. Queries LanceDB and runs Socratic grilling."
disable-model-invocation: false
---

# AICO Brainstorm: Problem Exploration & Socratic Grilling

The first step of the feature flow. Transform raw feature ideas, rough user notes, or business requests into a sharp architectural framing document (`BRAIN-{domain}-{slug}.md`).

---

## Process

### 1. Hybrid Context Retrieval
Before asking questions, retrieve prior context from **LanceDB** (or local docs in meta-mode):
- Search for related existing ADRs in `docs/adr/`.
- Search for related brainstorms in `brainstorms/` and existing specifications in `specs/`.
- Inspect `GLOSSARY.md` for relevant terminology.

### 2. Socratic Grilling Loop
Map the problem space as a **design tree**. Identify the **decision frontier**: the questions that can be asked *now* without guessing future answers.

Present questions in **rounds** (maximum 3–4 high-impact questions per round). **Never ask a question without providing your recommended answer and reasoning**:

```markdown
❓ **Q1** - **<Decision Title>**: <Context and question, including concrete options>

➡️ **Recommended**: Option [A] - <1-2 sentences explaining why this best balances performance, maintainability, and safety>
```

- When a question requires a fact from the filesystem, codebase, or documentation, dispatch a subagent or tool call to find it; **never ask the user for facts you can look up yourself**.
- If a question reveals a need to test a complex UI layout or state transition machine with runnable code, pause the interview and detour to **`/aico-prototype`**.

### 3. Inline Domain Modeling
Call `aico-domain-modeling` during the conversation:
- Challenge vague or overloaded words immediately.
- Update `GLOSSARY.md` inline as canonical terms crystallize.
- If a major irreversible architectural trade-off is settled, record an ADR in `docs/adr/`.

### 4. Artifact Generation via MCP Gate
Once the decision frontier is settled, format the output document and commit it via the AICO MCP tool gate:

```yaml
mcp_call:
  tool_name: "create_sdd_artifact"
  parameters:
    artifact_type: "brainstorm"
    domain: "<domain>"
    slug: "<kebab-slug>"
    derives_from_ids: []
    title: "<Descriptive Title>"
    content_body: |
      # Brainstorm: <Title>
      
      ## Problem Statement
      <From the user's perspective>
      
      ## Explored Approaches & Trade-offs
      <Alternatives considered and rejected>
      
      ## Selected Architecture & Strategy
      <The consensus direction>
      
      ## Key Decisions
      <Numbered summary of settled decisions>
```

*(In meta-mode while bootstrapping AICO, write the file directly to `brainstorms/{domain}/BRAIN-{seq}-{slug}.md` with YAML frontmatter `id`, `type: brainstorm`, `title`).*

---

## Completion Criteria
- [ ] Decision frontier empty (all critical architectural questions settled).
- [ ] Domain terms updated in `GLOSSARY.md`.
- [ ] Brainstorm artifact generated and committed.
- [ ] Ready for `/aico-deep-dive` or `/aico-spec-creation`.
