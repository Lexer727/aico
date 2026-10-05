---
name: aico-wayfinder
description: "Plan a massive, high-fog engineering epic or greenfield system as a shared map of decision tickets, clearing the fog one decision at a time until ready for specification."
disable-model-invocation: true
---

# AICO Wayfinder: High-Fog Greenfield Navigation

When an effort is too large or ambiguous for a single session, do not charge into writing a detailed specification. Wayfinding charts a **shared map of decision tickets** and works through the unblocked frontier, producing **decisions, not deliverables**, until the route is clear.

---

## The Philosophy: Plan, Don't Build

- **Destination**: What reaching the end of this effort looks like (e.g. *"A ratified architecture and storage schema for AICO's embedded engines ready for EARS specification"*).
- **Decisions, not deliverables**: Each ticket resolves an open architectural question or investigation.
- **The Fog of War**: The map separates what can be ticketed now from what is in the "fog" (*Not yet specified*). Resolving tickets clears the fog ahead, graduating items into fresh tickets.
- **Handoff**: When the route is clear, wayfinder hands off to **`/aico-spec-creation`**.

---

## Ticket Types

1. **Research (AFK)**: Background agent investigates external docs, crates, libraries, or protocols. Produces a cited markdown brief.
2. **Prototype (HITL)**: Spikes a cheap, rough artifact (calling `/aico-prototype`) to answer *"Does this state machine feel right?"* or *"What should this UI look like?"*.
3. **Grilling (HITL)**: Relentless Socratic interview with the human developer across the decision tree, providing recommended options. Calls `aico-domain-modeling` to update vocabulary.
4. **Task (HITL or AFK)**: Necessary prerequisite action that unblocks a decision (provisioning a key, moving fixture data).

---

## Process

### Phase 1: Chart the Map
1. **Name the Destination**: Interview the user to lock down the exact end goal of this epic.
2. **Map the Frontier (Breadth-First)**: Fan out across the domain. Surface the open decisions and first actionable steps.
   - *If no fog is uncovered* (the path is already obvious and small): Stop immediately and recommend `/aico-brainstorm` or `/aico-spec-creation`.
3. **Initialize the Wayfinder Map**:
   Write the map index (in `.scratch/wayfinder/{epic-slug}/map.md` or the issue tracker):
   ```markdown
   # Wayfinder Map: {Epic Name}
   
   ## Destination
   {1-2 sentences defining what done looks like}
   
   ## Notes & Principles
   {Standing constraints, relevant ADRs, performance targets}
   
   ## Decisions So Far
   <!-- Index of closed decision tickets with 1-line answer -->
   
   ## Active Frontier (Unblocked)
   - [ ] {Ticket Name} (Type: Grilling | Research | Prototype)
   
   ## Blocked Tickets
   - [ ] {Ticket Name} (Blocked by: ...)
   
   ## Not Yet Specified (The Fog of War)
   <!-- In-scope topics not yet sharp enough to ticket -->
   
   ## Out of Scope
   <!-- Work explicitly ruled outside the destination -->
   ```

### Phase 2: Work Through the Map
1. Load the low-resolution map.
2. Pick an unblocked ticket from the **Active Frontier**.
3. Claim it and resolve it (run the research subagent, build the spike prototype, or conduct the grilling round).
4. Post the resolution summary in the ticket, close it, and record a one-line decision in `Decisions So Far`.
5. Clear the fog: Graduate newly specifiable items from `Not Yet Specified` into active/blocked tickets.
6. Check for completion: When the fog is cleared and all decision tickets are resolved, hand off to **`/aico-spec-creation`**.

---

## Completion Criteria
- [ ] Destination fully reached with zero unresolved decision tickets on the frontier.
- [ ] All foundational architectural decisions captured in `docs/adr/`.
- [ ] Ready for `/aico-spec-creation`.
