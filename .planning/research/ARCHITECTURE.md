# Architecture Patterns: KaTeX Integration in Multi-Module Vanilla JS SPA

**Domain:** Math rendering in a multi-entry-point Vanilla JS application
**Researched:** 2026-03-29
**Confidence:** HIGH (based on direct codebase analysis + KaTeX documentation)

## Current State Analysis

### Entry Points That Need KaTeX

| Entry Point | File | KaTeX Loaded? | Math Content? |
|-------------|------|---------------|---------------|
| Main app (production) | `src/index.tsx` HTML template | YES (CDN in `<head>`) | YES (via records module) |
| Records standalone test | `public/modules/records/index.html` | YES (CDN in `<head>`) | YES |
| Records dev test | `public/modules/records/dev.html` | YES (CDN in `<head>`) | YES |

### Current renderMath() Architecture

```
src/index.tsx (main HTML)
  |-- <script defer> KaTeX CDN --> window.katex (global)
  |-- <script type="module"> imports ArchiveModule from records.js
        |
        v
public/modules/records/records.js
  |-- imports from core/utils.js { renderMath }
  |-- imports from views/ai-credit-log.js { renderAiLoading, renderAiResult }
  |-- imports from views/aha-report-result.js { renderAhaLoading, renderAhaResult }
        |
        v
public/modules/records/core/utils.js
  |-- renderMath() checks: typeof katex === 'undefined'
  |   If undefined: returns raw text (graceful degradation)
  |   If available: renders $$...$$ (block) and $...$ (inline)
```

**Key observation:** `renderMath()` lives in the records module (`core/utils.js`) but depends on `window.katex` being a global set by the CDN `<script>` tag in the HTML. This is a coupling between the HTML entry point and the module internals.

### Consumers of renderMath()

Only 2 view files currently call `renderMath()`:

1. **`views/ai-credit-log.js`** -- AI-generated credit log analysis (physics/math formulas in AI output)
2. **`views/aha-report-result.js`** -- Aha report AI results (formulas in analysis text)

The main `app.js` (700KB+) does NOT use `renderMath()` or reference KaTeX at all. Math rendering is entirely within the records module scope.

## Recommended Architecture

### Pattern: CDN Global + Module-Scoped Utility (Current, Keep It)

The current architecture is correct for this project. Do NOT change it. Here is why:

1. **KaTeX is already loaded via CDN in all entry points.** All three HTML files include the same CDN tags. This is consistent.
2. **`renderMath()` gracefully degrades.** If KaTeX fails to load, text passes through unmodified. This is the right defensive pattern.
3. **The records module is the only consumer.** No other module needs math rendering. Keeping `renderMath()` in `core/utils.js` is correct scoping.
4. **No build step for the frontend.** This is a Vanilla JS project with no bundler for client-side code. Dynamic `import()` of KaTeX as an ES module would add complexity for zero benefit when CDN loading already works.

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| **HTML Entry Points** (`src/index.tsx`, `records/index.html`, `records/dev.html`) | Load KaTeX CSS + JS via CDN `<script defer>` tags. Set `window.katex` global. | Browser global scope |
| **`core/utils.js` :: renderMath()** | Convert `$...$` and `$$...$$` LaTeX strings to HTML via `katex.renderToString()`. Graceful fallback if katex undefined. | Reads `window.katex` (global). Called by view renderers. |
| **View renderers** (`ai-credit-log.js`, `aha-report-result.js`) | Call `renderMath(text)` on AI-generated content before inserting into DOM. | Import `renderMath` from `core/utils.js`. |
| **AI Backend** (`src/index.tsx` API routes) | Returns text containing LaTeX notation (`$...$`, `$$...$$`). | HTTP JSON responses to frontend. |

### Data Flow

```
AI API Response (JSON with LaTeX strings)
    |
    v
View Renderer (ai-credit-log.js / aha-report-result.js)
    |
    | calls renderMath(text)
    v
core/utils.js :: renderMath()
    |
    | checks window.katex exists
    | runs katex.renderToString() for each $...$ and $$...$$ match
    v
HTML string with rendered math (KaTeX spans + inline styles)
    |
    | inserted via innerHTML
    v
DOM (KaTeX CSS from CDN styles the rendered output)
```

**Critical dependency:** KaTeX CSS must be loaded BEFORE rendered math is inserted into DOM. The `<link>` tag in `<head>` ensures this. The JS is `defer`ed which means it loads after HTML parsing but before DOMContentLoaded. Since the records module is loaded via `<script type="module">` (which is also deferred), KaTeX JS will be available by the time any view calls `renderMath()`.

### Why NOT Lazy Load KaTeX

Lazy loading KaTeX was considered and rejected:

1. **KaTeX is small.** The minified JS is ~90KB gzipped. The CSS is ~25KB gzipped. This is comparable to a single icon font.
2. **Math content is unpredictable.** Any class record for physics, chemistry, or math subjects may contain formulas. You cannot know in advance which records will have math.
3. **The `defer` attribute already optimizes loading.** It does not block HTML parsing. The browser downloads it in parallel with other resources.
4. **Complexity cost is high.** Lazy loading would require either: (a) an async `renderMath()` that returns a promise, breaking all current call sites, or (b) a two-pass render that first shows raw text then re-renders after KaTeX loads, causing visual flicker.
5. **CDN caching makes repeat visits instant.** After first load, KaTeX is served from browser cache (or CDN edge cache via jsDelivr).

### What Needs Fixing (The Actual Problem)

Based on PROJECT.md, the problem is NOT architecture. The problem is that `renderMath()` works correctly but KaTeX was previously not loaded in the production `index.html`. Per the codebase analysis, **KaTeX CDN tags now exist in `src/index.tsx`** (the production HTML template, lines 5827-5828). This means the fix may already be partially in place.

The remaining work is verification:

1. **Verify KaTeX loads in production build.** Run `npm run build` and check `dist/` output includes the KaTeX CDN tags.
2. **Verify `renderMath()` is called in all views that display AI-generated content.** Currently only 2 views call it. Check if other views (class-detail.js, class-history.js, question-record.js) also display AI text that could contain formulas.
3. **Verify the `defer` ordering.** KaTeX JS (`defer`) must execute before `renderMath()` is first called. Since records module is `type="module"` (implicitly deferred), and `defer` scripts execute in order, KaTeX will be ready.

### Views That May Need renderMath() But Currently Do Not Call It

| View File | Displays AI Content? | Should Call renderMath()? |
|-----------|---------------------|--------------------------|
| `class-detail.js` | YES (AI credit log, summary) | **YES - likely missing** |
| `class-history.js` | YES (shows past records with AI analysis) | **YES - likely missing** |
| `question-record.js` | YES (AI-analyzed questions) | **MAYBE - check if physics/math questions have formulas** |
| `exam-result.js` | Possibly (exam analysis) | **MAYBE** |
| `growth-analysis.js` | Possibly (growth report) | **MAYBE** |
| `activity-result.js` | YES (activity AI analysis) | **LOW priority - activities less likely to have math** |

This is the real architectural gap: `renderMath()` exists and works, but is not applied in all views that display potentially formula-containing text.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Bundling KaTeX into the App
**What:** Import KaTeX as an ES module and bundle it with the app code.
**Why bad:** This project has no client-side bundler. `public/` files are served directly. Adding a bundler for one library would be a massive architectural change prohibited by project constraints (Vanilla JS, no React/Vue).
**Instead:** Keep CDN loading. It is the correct pattern for this stack.

### Anti-Pattern 2: Dynamic import() for KaTeX
**What:** Use `const katex = await import('https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.mjs')` at runtime.
**Why bad:** KaTeX's CDN does not serve an ES module version. The UMD script sets `window.katex`. Dynamic import would require a different distribution or a shim. Also makes `renderMath()` async, breaking all call sites.
**Instead:** Keep synchronous `renderMath()` with `typeof katex === 'undefined'` guard.

### Anti-Pattern 3: Duplicating renderMath() in app.js
**What:** Copy `renderMath()` into the main `app.js` for use outside the records module.
**Why bad:** Code duplication. If the regex or KaTeX options change, both copies must be updated.
**Instead:** If the main app ever needs math rendering, extract `renderMath()` to a shared utility file (e.g., `public/static/math-utils.js`) and import it from both `app.js` and `records/core/utils.js`. But currently, only the records module needs it.

### Anti-Pattern 4: Using MathJax Instead
**What:** Switch to MathJax for "better compatibility."
**Why bad:** PROJECT.md explicitly excludes this. KaTeX is already integrated, renders 10-100x faster than MathJax, and produces identical output for the formulas used in high school physics/math.
**Instead:** Stay with KaTeX v0.16.9.

## Patterns to Follow

### Pattern 1: Defensive renderMath() Guard
**What:** Always check `typeof katex === 'undefined'` before calling KaTeX APIs.
**When:** Every call site that processes text potentially containing LaTeX.
**Why:** If CDN fails (network issue, blocked by school firewall), the app still works -- users see raw `$E=mc^2$` text instead of a crash.
**Already implemented:** Yes, in `core/utils.js` line 86.

### Pattern 2: CSS-First Loading
**What:** KaTeX CSS `<link>` must appear before KaTeX JS `<script defer>` in the HTML.
**When:** All entry points.
**Why:** If JS executes before CSS loads, rendered math elements flash unstyled (FOUC) before snapping into correct layout. CSS-first prevents this.
**Already implemented:** Yes, in all three HTML files.

### Pattern 3: Centralized renderMath() Utility
**What:** One `renderMath()` function in one file, imported by all consumers.
**When:** Any view that displays AI-generated or user-entered text that may contain `$...$` notation.
**Why:** Consistent regex patterns, consistent KaTeX options (`throwOnError: false`), single point of maintenance.
**Already implemented:** Yes, in `core/utils.js`. Just needs more consumers.

## Build Order (Dependencies Between Components)

Phase structure implication for the milestone:

```
Step 1: Verify KaTeX CDN loads in production build
        (No code changes -- just run build and check output)
        |
Step 2: Audit all views for missing renderMath() calls
        (Grep for innerHTML/template literals that insert AI content)
        |
Step 3: Add renderMath() calls to views that display AI-generated text
        (Import from core/utils.js, wrap text before DOM insertion)
        |
Step 4: Test across all entry points
        (Main app via /, standalone via /modules/records/index.html, dev via dev.html)
```

**Step 1 must come first** because if KaTeX does not load in production, adding more `renderMath()` calls is pointless (they will all gracefully degrade to raw text).

**Step 2 before Step 3** because you need to know which views to modify before modifying them.

**Step 4 is integration testing** across all entry points to verify the CDN + module interaction works in each context.

## Scalability Considerations

| Concern | Current (records module only) | If math needed in app.js too |
|---------|------------------------------|------------------------------|
| renderMath() location | `records/core/utils.js` -- correct | Extract to `public/static/math-utils.js`, import from both |
| KaTeX loading | CDN in `<head>` -- correct | Same, already loaded globally |
| Performance | Negligible (regex + katex.renderToString per text block) | Same -- KaTeX is synchronous and fast |
| Bundle size impact | 0 (CDN, not bundled) | 0 (still CDN) |

## Sources

- Direct codebase analysis of all files in `/Users/jungyoulkwak/jungyoul-planapp/`
- KaTeX documentation: https://katex.org/docs/api (renderToString API, autorender extension)
- KaTeX v0.16.9 CDN: https://cdn.jsdelivr.net/npm/katex@0.16.9/ (distribution format: UMD global)
- Project constraints from CLAUDE.md and PROJECT.md
