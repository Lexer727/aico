---
name: aico-code-to-spec
description: "Reverse-engineer an existing codebase (brownfield repo) into formal AICO Spec-Driven Design artifacts: extract ubiquitous domain terms, reconstruct epics, generate EARS specifications, and designate test seams."
disable-model-invocation: false
---

# AICO Code-to-Spec: Brownfield Reverse Engineering

Transform an existing code repository into a fully specified, verifiable AICO project. Reconstruct architecture epics, synthesize EARS requirement specifications, extract ubiquitous language, and connect source symbols to requirements in the Kùzu graph.

---

## Process

```
Existing Codebase ────> AST & Graph Ingestion ────> Domain Terms ────> Epic Breakdown ────> EARS Synthesis ────> Trace Tagging
(d:/dev/my-app)        (Tree-sitter -> Kùzu)       (GLOSSARY.md)      (epics/)            (SPEC-*.md)          (@implements)
```

### Step 1: Project Registration & Graph Ingestion
1. Identify the target codebase path (`<codebase-path>`) and project name (`<project-name>`).
2. Scaffold the dedicated specs repository:
   - Path: `<aico-root>/<project-name>-specs/`
   - Create `<aico-root>/<project-name>-specs/.aico-project.json`:
     ```json
     {
       "name": "<project-name>",
       "version": "0.1.0",
       "codebase_path": "<codebase-path>",
       "created_at": "<ISO-timestamp>"
     }
     ```
3. Trigger Tree-sitter AST extraction on the codebase:
   - Ingest all modules, functions, classes, and call edges into **Kùzu**.
   - Chunk docstrings, comments, and public interfaces into **LanceDB**.

### Step 2: Ubiquitous Language & Domain Modeling
1. Analyze class names, structs, database models, and route definitions across the AST.
2. Synthesize an initial domain glossary conforming to `GLOSSARY-FORMAT.md`:
   - Identify core entities (e.g. `Account`, `Session`, `Order`).
   - Flag overloaded or ambiguous terms for user review.
3. Write the ratified terms to `<project-name>-specs/GLOSSARY.md`.

### Step 3: Subsystem & Epic Decomposition
1. Run Kùzu openCypher queries to identify module clusters, package boundaries, and API route groups:
   ```cypher
   MATCH (m:Module)-[:IMPORTS]->(dep:Module)
   RETURN m.name, count(dep) ORDER BY count(dep) DESC
   ```
2. Group the existing codebase into a logical sequence of **Epics**:
   - e.g. `001-core-storage`, `002-authentication`, `003-rest-api`.
3. Present the proposed epic breakdown to the user for confirmation.
4. Scaffold the selected epic container:
   - `<project-name>-specs/epics/<seq>-<slug>/`

### Step 4: EARS Contract Reverse-Synthesis
For each epic to be specified:
1. **Analyze Existing Tests First**:
   - Inspect existing unit, integration, and contract tests.
   - Each assertion (`assert_eq!`, `expect(...)`) represents an existing requirement.
2. **Analyze Public Entry Points & Error Branches**:
   - Inspect public functions, route handlers, input validation, and error returns (`400`, `404`, `500`, `Err(...)`).
3. **Formulate EARS Requirements**:
   - Translate observed behaviors into strict EARS grammar with sequential stable IDs (`REQ-001`, `REQ-002`, ...):
     - **Ubiquitous**: `The <system> shall <behavior>.`
     - **Event-Driven**: `When <trigger>, the <system> shall <behavior>.`
     - **Unwanted / Error**: `If <condition>, then the <system> shall <behavior>.`
   - Use the mandatory modal **shall** exactly once per requirement.
4. **Designate Public Test Seams**:
   - Point to the public interfaces where these requirements are observed (e.g. `tests/api_tests.rs`, `src/auth/service.ts`).
5. Write the specification to `<project-name>-specs/initiatives/<seq>-<slug>/specs/<subpart>/SPEC-<slug>.md`.

### Step 5: In-Band Trace Tagging (HITL Option)
1. Match existing source functions and classes to the newly synthesized `REQ-###` IDs.
2. Propose in-band annotations:
   - On implementation symbols: `// @implements SPEC-<slug>::REQ-001`
   - On existing tests: `// @verifies SPEC-<slug>::REQ-001`
3. With human approval, insert the annotations or allow AICO's AST watcher to ingest them into Kùzu:
   ```cypher
   MERGE (c:CodeSymbol {name: "validate_token"})
   MERGE (r:Requirement {id: "SPEC-AUTH-001::REQ-001"})
   MERGE (c)-[:IMPLEMENTS]->(r)
   ```

---

## Completion Criteria
- [ ] `<project-name>-specs` initialized with `.aico-project.json` linking to codebase.
- [ ] Codebase AST fully ingested into Kùzu and LanceDB.
- [ ] `GLOSSARY.md` populated with discovered domain concepts.
- [ ] At least one baseline `SPEC-*.md` generated with EARS requirements derived from code and tests.
- [ ] Designated public test seams documented.
- [ ] Brownfield project registered and visible in AICO UI project switcher.
