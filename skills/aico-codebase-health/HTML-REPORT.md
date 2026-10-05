# Visual Architecture Report Template

HTML template utilizing Tailwind CSS and Mermaid via CDN for standalone local viewing.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>AICO Architecture Health Review</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'dark' });</script>
</head>
<body class="bg-slate-950 text-slate-100 p-8 max-w-6xl mx-auto font-sans">
  <header class="mb-8 border-b border-slate-800 pb-4">
    <h1 class="text-3xl font-extrabold text-indigo-400">Codebase Architecture & Deepening Report</h1>
    <p class="text-slate-400 mt-1">Generated via Kùzu structural graph analysis</p>
  </header>

  <main class="space-y-8">
    <!-- Candidate Card -->
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-bold text-slate-100">{Candidate Title}</h2>
        <span class="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-semibold rounded-full border border-emerald-500/30">Strong</span>
      </div>
      
      <p class="text-slate-300 mb-4">{Problem & Friction}</p>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4 my-4">
        <div class="bg-slate-950 p-4 rounded-lg border border-slate-800">
          <h3 class="text-xs uppercase tracking-wider text-rose-400 font-bold mb-2">Before: Shallow Coupling</h3>
          <pre class="mermaid">
          graph TD
            Caller1 --> ShallowModule
            Caller2 --> ShallowModule
            ShallowModule --> Core1
            ShallowModule --> Core2
          </pre>
        </div>
        <div class="bg-slate-950 p-4 rounded-lg border border-slate-800">
          <h3 class="text-xs uppercase tracking-wider text-emerald-400 font-bold mb-2">After: Deep Seam</h3>
          <pre class="mermaid">
          graph TD
            Caller1 --> DeepModule
            Caller2 --> DeepModule
            subgraph Internal
              DeepModule --- Logic[Hidden Implementation]
            end
          </pre>
        </div>
      </div>
    </div>
  </main>
</body>
</html>
```
