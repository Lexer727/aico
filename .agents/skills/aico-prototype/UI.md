# UI Prototype Specification

Build UI variations within the project's existing frontend framework or a standalone prototype view.

## Core Rules
1. **Multiple Radical Variants**:
   - Provide 2–3 noticeably different UI designs (e.g. Variant A: Dense sidebar list; Variant B: Visual node canvas; Variant C: Split master-detail).
2. **Switchable Controls**:
   - Provide a persistent floating bottom bar or query parameter (`?variant=A|B|C`) to toggle between variants instantly without rebuilding.
3. **Realistic Mock Data**:
   - Use representative data fixtures from the domain glossary rather than placeholder "Lorem Ipsum".
4. **Interactive Seams**:
   - Wire key interactions (clicks, drag-and-drop, search input) to local component state to test feel and latency.
