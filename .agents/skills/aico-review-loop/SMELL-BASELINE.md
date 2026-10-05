# Code Smell Baseline Reference

Derived from Martin Fowler's *Refactoring* (Chapter 3). Evaluated during the Standards axis of `/aico-review-loop`.

1. **Mysterious Name**: Functions, variables, or types whose names do not reveal what they do.
   - *Fix*: Rename immediately; if no clear name comes, the module's seam is murky.
2. **Duplicated Code**: Identical or nearly identical logic structure in multiple hunks or files.
   - *Fix*: Extract into a shared helper or deep module.
3. **Feature Envy**: A function or method that reaches into another object's fields more than its own.
   - *Fix*: Move the logic onto the module holding the data.
4. **Data Clumps**: The same 3–4 primitive parameters passed around together across function signatures.
   - *Fix*: Bundle into a typed domain struct or interface.
5. **Primitive Obsession**: Raw primitives (strings, numbers) representing domain concepts with invariants (emails, IDs, monetary amounts).
   - *Fix*: Wrap in a small typed value object.
6. **Speculative Generality**: Generic abstractions, unneeded plug-in hooks, or configurable parameters not required by the spec.
   - *Fix*: Delete ruthlessly; inline back to simple code.
7. **Message Chains**: Chained traversals (`a.b().c().d()`) coupling the caller to an internal hierarchy.
   - *Fix*: Hide behind a single method on the root module.
8. **Middle Man**: A function or module that does nothing but delegate to another.
   - *Fix*: Cut the middleman; call the target directly.
