---
name: aico-codebase-design
description: "Shared vocabulary and principles for designing deep modules, high-leverage interfaces, and testable seams. Reference for aico-deep-dive, aico-test-scaffolding, and aico-codebase-health."
disable-model-invocation: false
---

# AICO Codebase Design: Deep Modules & Seams

Design **deep modules**: significant behavior behind a compact interface, located at an agreed public seam, and tested through that interface. 

The goal is **leverage** for callers, **locality** for maintainers, and **testability** for everyone.

---

## Canonical Glossary

Use these terms exactly: do not substitute "service", "component", or "boundary".

- **Module**: Anything with an interface and an implementation (scale-agnostic: function, class, Rust crate, package, or vertical slice).
- **Interface**: Everything a caller must know to use the module correctly: type signature, invariants, ordering constraints, error modes, configuration, and performance characteristics.
- **Implementation**: What is inside a module; its internal code.
- **Depth**: Leverage at the interface. A module is **deep** when substantial capability sits behind a simple interface; it is **shallow** when the interface is nearly as complex as the implementation.
- **Seam** *(Michael Feathers)*: A place where you can observe or alter behavior without editing in that place; the location where an interface lives.
- **Adapter**: A concrete construct that satisfies an interface at a seam (e.g. SQLite adapter, in-memory fake).
- **Leverage**: Capability per unit of interface learned. One deep implementation pays back across $N$ callers and $M$ tests.
- **Locality**: Concentration of change, logic, and verification in one place. Fix once, fixed everywhere.

---

## Deep vs. Shallow

```
       DEEP MODULE (Target)                    SHALLOW MODULE (Anti-pattern)
      ┌─────────────────────┐                   ┌─────────────────────────────┐
      │   Small Interface   │                   │       Large Interface       │
      ├─────────────────────┤                   ├─────────────────────────────┤
      │                     │                   │ Thin Implementation (Pass-  │
      │ Deep Implementation │                   │ through / anemic logic)     │
      │                     │                   └─────────────────────────────┘
      └─────────────────────┘
```

When evaluating or designing an interface, ask:
1. Can I reduce the number of public methods?
2. Can I simplify the parameters and configuration?
3. Can I hide intermediate states and complexity inside?

---

## Core Principles

1. **The interface is the test surface**: Callers and tests cross the same public seam. If a test reaches inside to mock internal collaborators or inspect private state, the module seam is poorly placed.
2. **The deletion test**: Imagine deleting the module. If complexity vanishes, it was a shallow pass-through. If complexity reappears scattered across $N$ callers, it was earning its keep.
3. **One adapter = hypothetical seam; two adapters = real seam**: Do not introduce abstraction layers or interfaces unless there are multiple implementations or a verified testing seam.
4. **Design for testability**:
   - Accept dependencies, do not instantiate them internally.
   - Return values/results, avoid hidden side-effects.
   - Keep surface area minimal.

---

## Design-It-Twice Pattern

When designing a critical module, interface, or schema, generate at least **two radically different interface sketches**:
- **Variation A**: Emphasizes minimal method count and declarative input.
- **Variation B**: Emphasizes composable pipeline operators or event-driven emission.

Compare them on:
1. Interface surface area (fewer methods/parameters is better).
2. Seam clarity (is it obvious where the test hooks in?).
3. Caller leverage (how much work does the caller save?).
