# EARS Requirements Syntax Cheatsheet

Developed at Rolls-Royce, EARS (Easy Approach to Requirements Syntax) eliminates ambiguity and produces independently testable requirements.

## The 5 Core Patterns

### 1. Ubiquitous
- **Syntax**: `The <system> shall <response>.`
- **Example**: `The LanceDBIndexer shall persist all vector embeddings to disk using IVF-PQ format.`

### 2. Event-Driven
- **Syntax**: `When <trigger>, the <system> shall <response>.`
- **Example**: `When a user saves a source file, the TreeSitterWatcher shall extract AST symbols within 15 milliseconds.`

### 3. State-Driven
- **Syntax**: `While <state>, the <system> shall <response>.`
- **Example**: `While the indexing pipeline is active, the DesktopUI shall display an animated sync status indicator.`

### 4. Unwanted Behavior (Error Handling)
- **Syntax**: `If <condition>, then the <system> shall <response>.`
- **Example**: `If the openCypher query contains a syntax error, then the KuzuBridge shall return a formatted error message without panicking.`

### 5. Optional Feature
- **Syntax**: `Where <feature flag>, the <system> shall <response>.`
- **Example**: `Where hardware AVX2 acceleration is unavailable, the EmbeddingEngine shall fall back to standard scalar execution.`

## Complex Combination Pattern
When a requirement depends on both a continuous state and an event:
- **Syntax**: `While <state>, when <trigger>, the <system> shall <response>.`
- **Example**: `While offline, when an artifact is saved, the LocalVault shall queue the synchronization event.`

## Strict Rules
1. **The Modal SHALL**: Always use `shall`. Never use `must`, `should`, `will`, `can`, or `may`.
2. **One Actor**: Name exactly one `<system>` per requirement.
3. **Atomicity**: One testable behavior per statement. Split compound sentences.
4. **Active Voice**: Name who does what. Never write "Data is transmitted".
