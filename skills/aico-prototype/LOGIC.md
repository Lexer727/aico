# Logic Prototype Specification

Build a standalone HTML file (`.scratch/prototypes/{slug}.html`) that can be opened directly in any browser.

## Layout Structure
1. **Interactive Controls**: Buttons that dispatch actions into the state machine (e.g. `Login`, `ExpireToken`, `RefreshSession`, `NetworkTimeout`).
2. **State Inspector**: A live JSON preview of the full internal state updated after every action.
3. **Transition Log**: A scrolling chronological log showing: `[Action] -> State A -> State B`.
4. **Scenario Walkthroughs**: Preset buttons that run a 4-step sequence simulating a complex edge case.

## Template
```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Logic Prototype: State Machine</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="p-8 bg-slate-900 text-slate-100 font-mono">
  <h1 class="text-xl font-bold mb-4">State Transition Spike</h1>
  <!-- Controls & State Display -->
</body>
</html>
```
