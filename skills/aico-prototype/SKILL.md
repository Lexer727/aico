---
name: aico-prototype
description: "Build a throwaway prototype to answer a design question about a complex state machine or UI interaction before writing a spec."
disable-model-invocation: true
---

# AICO Prototype: Throwaway Spike Code

A prototype is **throwaway code that answers a design question**. Use it when a question in `/aico-brainstorm` or `/aico-deep-dive` cannot be settled by prose alone.

---

## The Two Branches

Identify which question you are answering:

1. **"Does this logic or state transition feel right?"** $\to$ [`LOGIC.md`](LOGIC.md)
   - Build a single, self-contained HTML file with interactive controls and a full state inspector.
2. **"What should this UI or visual interaction look like?"** $\to$ [`UI.md`](UI.md)
   - Generate several radically different UI variants on a single view, switchable via URL parameters or a floating bar.

---

## Universal Rules for Prototypes

1. **Throwaway from day one**:
   - Work on an isolated branch: `prototype/<kebab-slug>`.
   - Never commit prototype code directly to `main` or an integration branch.
2. **Trivial to launch**:
   - Zero-install or one command: double-clicking an HTML file or running `pnpm dev`.
3. **No persistence**:
   - In-memory state only. Testing the database is not the job of a prototype.
4. **Skip polish**:
   - No unit tests, no edge-case handling beyond making the prototype runnable. The goal is rapid feedback.
5. **Surface the state**:
   - After every user action or parameter toggle, render the full state so the human can immediately inspect what changed.
6. **Capture the decision**:
   - When the user confirms the interaction feels right, fold the decision into the parent brainstorm or spec, commit the prototype to its branch as primary-source evidence, and return to the main flow.
