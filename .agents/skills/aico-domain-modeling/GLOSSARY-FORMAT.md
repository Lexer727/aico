# Glossary Format Specification

A clean, non-technical glossary format readable by humans and agents, and indexable by LanceDB.

## Schema

```markdown
# Domain Glossary

## Core Concepts

### <Canonical Term>
- **Definition**: A clear, precise definition from the domain perspective.
- **Synonyms (Avoid)**: List of confusing, deprecated, or colloquial terms that should not be used.
- **Example**: A concrete domain instance illustrating the term.
- **Related Terms**: Links to other canonical terms.

---

### <Next Term>
...
```

## Rules
1. Zero implementation details: no code types, function names, database tables, or framework terms.
2. Canonical naming only: pick one word and ban the synonyms.
3. Keep definitions atomic and under 3 sentences.
