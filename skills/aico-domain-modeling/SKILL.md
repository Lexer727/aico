---
name: aico-domain-modeling
description: "Build and sharpen a project's domain model, ubiquitous language, and Architecture Decision Records (ADRs). Use when discussing terminology, maintaining GLOSSARY.md, or recording architectural trade-offs."
disable-model-invocation: false
---

# AICO Domain Modeling

Actively build and sharpen the project's domain model as you design. This is the **active discipline**: challenging fuzzy language inline, resolving overloaded words, and capturing hard-to-reverse tradeoffs into ADRs the moment they crystallize.

In AICO, domain definitions in `GLOSSARY.md` and `docs/adr/` are automatically ingested into **LanceDB** for hybrid semantic search and committed as nodes and edges in the **Kùzu** property graph:
```cypher
MERGE (t:DomainTerm {name: $term, context: $context})
MERGE (a:ADR {id: $adr_id, title: $title, status: "accepted"})
```

---

## Process

### 1. Challenge Against the Glossary
When the developer or an agent uses a term that conflicts with or duplicates an existing entry in `GLOSSARY.md`, call it out immediately:
> *"Your glossary defines 'Session' as the cryptographic JWT token, but you're using it to mean the active WebSocket connection. Which canonical term should we use?"*

### 2. Sharpen Fuzzy and Overloaded Language
Replace overloaded words with precise domain terms:
- Vague: *"The user's account"*
- Sharp: *"The Organization profile (billing context) or the User Identity (auth context)?"*

### 3. Update GLOSSARY.md Inline
Capture new terms the moment they are resolved. Do not batch them at the end.
- Use the schema specified in [`GLOSSARY-FORMAT.md`](GLOSSARY-FORMAT.md).
- Keep `GLOSSARY.md` strictly focused on domain meaning. It must contain zero implementation details, zero framework names, and zero file paths.

### 4. Record ADRs Sparingly
Offer to create an Architecture Decision Record (ADR) under `docs/adr/` **only when all three conditions are met**:
1. **Hard to reverse**: The cost of changing your mind later is significant.
2. **Surprising without context**: A future developer or agent will wonder *"Why was it done this way?"*
3. **Real tradeoff**: There were genuine, viable alternatives, and you chose one for documented reasons.

If any of the three is missing, skip the ADR. When writing an ADR, follow [`ADR-FORMAT.md`](ADR-FORMAT.md).

---

## Multi-Context Repositories

Most projects start with a single root `GLOSSARY.md`. When a project grows into bounded contexts (e.g. `storage`, `ui`, `watcher`), maintain a `GLOSSARY-MAP.md` at root linking to context-specific glossaries:

```
/
├── GLOSSARY-MAP.md
├── docs/adr/               # System-wide ADRs
└── src/
    ├── storage/
    │   ├── GLOSSARY.md     # Storage-specific terms
    │   └── docs/adr/
    └── ui/
        ├── GLOSSARY.md     # UI-specific terms
        └── docs/adr/
```

---

## Completion Criteria
- [ ] No unclarified, overloaded domain terms left in discussion.
- [ ] Any resolved terms immediately written to `GLOSSARY.md`.
- [ ] ADRs created for any irreversible architectural tradeoffs.
