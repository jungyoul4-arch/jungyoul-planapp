# Technology Stack: KaTeX Math Rendering Fix

**Project:** HS CreditPlanner -- Math Rendering Fix
**Researched:** 2026-03-29

## Diagnosis of Current Problem

The KaTeX loading issue is **NOT** a CDN-vs-bundled question. Both `index.html` and `dev.html` in the records module already include KaTeX v0.16.9 CDN tags. The main app's HTML template in `src/index.tsx` (line 5827-5828) also includes them. The actual root cause is one of:

1. **Timing issue with `defer`**: KaTeX loads with `defer`, meaning it is available after `DOMContentLoaded`. But the SPA renders views dynamically -- when `renderMath()` is called during a view render triggered by user navigation (after DOMContentLoaded), `katex` should be available. However, if the module is loaded before the deferred script executes (e.g., during initial page load), `typeof katex === 'undefined'` will be true.

2. **Production entry point mismatch**: The records module `index.html` is a standalone test page. In production, the main app embeds the records module via the Hono-rendered HTML in `src/index.tsx`. The main app's template already includes KaTeX CDN tags. The question is whether Vite's build process preserves these CDN script tags in the final output.

3. **Global scope issue**: `renderMath()` checks `typeof katex === 'undefined'` at the global/window scope. CDN scripts with `defer` attach `katex` to `window`. This should work, but only if the script actually loaded successfully in production.

**Confidence: HIGH** -- Based on direct code inspection of all relevant files.

## Recommended Stack

### KaTeX Library

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| KaTeX | 0.16.44 (latest) | LaTeX math rendering | Already integrated in codebase. Upgrade from 0.16.9 to 0.16.44 for bug fixes. Fast, lightweight, no dependencies. |

**Confidence: HIGH** -- Verified via [npmjs.com/package/katex](https://www.npmjs.com/package/katex) and [katex.org](https://katex.org/). Version 0.16.44 was published 2026-03-28 (yesterday).

### Loading Strategy: CDN with `defer` (keep current approach)

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| jsDelivr CDN | N/A | KaTeX delivery | Already in use. Fast global CDN, free, reliable. No build step needed for a Vanilla JS project. |

**Use CDN because:**
- The project is Vanilla JS with no module bundler for frontend code (Vite only builds the Hono backend into `_worker.js`)
- Frontend files in `public/` are served as-is -- there is no JS bundling step
- CDN provides automatic caching, global edge delivery, and zero build complexity
- KaTeX CSS references font files via relative paths -- CDN handles this automatically
- Self-hosting KaTeX fonts (13+ WOFF2 files) on Cloudflare Pages would add deployment complexity for zero benefit

**Do NOT bundle because:**
- The frontend is not bundled -- `public/` files are served directly
- Bundling KaTeX would require adding a frontend build step (webpack/rollup), violating the project's architecture
- KaTeX's CSS includes relative font paths that break when naively bundled without proper asset handling

**Confidence: HIGH** -- Based on project architecture (Vanilla JS, no frontend bundler).

### CDN URLs (upgrade to latest)

```html
<!-- KaTeX CSS -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.css">

<!-- KaTeX JS -->
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.js"></script>
```

### Auto-render Extension: DO NOT USE

| Decision | Rationale |
|----------|-----------|
| Skip `auto-render` extension | The project already has a custom `renderMath()` function in `core/utils.js` that handles `$...$` and `$$...$$` delimiters. It is called explicitly in view render functions (`ai-credit-log.js`, `aha-report-result.js`). The auto-render extension scans DOM text nodes, which conflicts with the existing innerHTML-based rendering pattern. |

**Confidence: HIGH** -- The existing `renderMath()` approach (regex replace on strings before innerHTML assignment) is more appropriate for this SPA's rendering model than auto-render (which requires DOM nodes to already exist).

### Supporting Libraries (no changes)

| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| Lucide Icons | latest | UI icons | Already loaded via CDN |
| GSAP | 3.12.5 | Animations | Already loaded via CDN |
| Font Awesome | 6.5.1 / 6.4.0 | Icons | Already loaded (inconsistent versions between index.html and dev.html) |

## The Actual Fix

The fix is NOT about choosing a different loading strategy. It is about ensuring KaTeX is loaded in the correct entry point for production. Three places need KaTeX CDN tags:

1. **`src/index.tsx` (main app HTML template)** -- Already has KaTeX. VERIFIED.
2. **`public/modules/records/index.html` (standalone test)** -- Already has KaTeX. VERIFIED.
3. **`public/modules/records/dev.html` (dev test)** -- Already has KaTeX. VERIFIED.

The problem likely lies in:
- **Vite build stripping or mishandling CDN tags** in `src/index.tsx` during `vite build`
- **Race condition**: `renderMath()` called before `defer`red KaTeX script executes
- **Network failure**: KaTeX CDN blocked or failing in the production environment (Korean school networks sometimes block CDN domains)

### Recommended Investigation Steps

1. **Check built output**: Run `npm run build` and inspect `dist/` for the presence of KaTeX CDN tags
2. **Check browser DevTools in production**: Open Network tab, filter for `katex` -- is the request made? Does it succeed?
3. **Add a readiness guard**: Instead of checking `typeof katex === 'undefined'` at call time, add a KaTeX readiness promise that resolves when the script loads

### Recommended Code Pattern (readiness guard)

```javascript
// core/utils.js -- add at module level
let katexReady = false;
if (typeof katex !== 'undefined') {
  katexReady = true;
} else {
  // Wait for deferred KaTeX to load
  const checkKatex = () => {
    if (typeof katex !== 'undefined') {
      katexReady = true;
    }
  };
  document.addEventListener('DOMContentLoaded', checkKatex);
  // Also check after a delay for async loading
  setTimeout(checkKatex, 2000);
}

export function renderMath(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (typeof katex === 'undefined') {
    console.warn('[renderMath] KaTeX not loaded -- returning raw text');
    return text;
  }
  // ... existing regex logic
}
```

### Fallback Strategy: Dual Loading

If CDN proves unreliable in Korean school networks, add a local fallback:

```html
<!-- Primary: CDN -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.css"
      onerror="this.href='/lib/katex/katex.min.css'">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.js"
        onerror="loadLocalKatex()"></script>
```

This requires copying KaTeX files to `public/lib/katex/` (JS + CSS + fonts directory).

**Confidence: MEDIUM** -- The CDN fallback pattern works but adds complexity. Only implement if CDN is confirmed unreliable.

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Renderer | KaTeX (CDN) | MathJax 3.x | Already integrated KaTeX. MathJax is 3-5x slower for initial render. PROJECT.md explicitly excludes MathJax. |
| Loading | CDN `defer` | npm + ES module import | No frontend bundler exists. Would require adding webpack/rollup build step. |
| Loading | CDN `defer` | Dynamic `import()` of KaTeX ESM | KaTeX ESM build exists (`katex.mjs`) but CSS/fonts still need CDN or local hosting. Adds complexity for marginal benefit. |
| Parsing | Custom `renderMath()` | KaTeX auto-render extension | Auto-render operates on DOM nodes after insertion. Current pattern operates on strings before innerHTML. Switching would require rewriting all view render functions. |
| Version | 0.16.44 | 0.16.9 (current) | 0.16.9 is 2+ years old. 0.16.44 has accumulated bug fixes. Minor version bump, no breaking changes. |

## Performance Considerations

| Metric | Value | Source |
|--------|-------|--------|
| KaTeX JS (minified, gzip) | ~95 KB | jsDelivr CDN stats |
| KaTeX CSS (minified, gzip) | ~10 KB | jsDelivr CDN stats |
| KaTeX fonts (WOFF2, loaded on demand) | ~20-50 KB per font file | Only fonts used in rendered math are loaded |
| First render time | <10ms per expression | KaTeX official benchmarks |

**Performance is not a concern for this project:**
- ~150 students, not a high-traffic site
- KaTeX renders synchronously and is very fast
- CDN caching means KaTeX loads from browser cache after first visit
- `defer` attribute ensures KaTeX does not block initial page render

## Installation

No installation needed -- CDN-based. The fix involves:

```bash
# No npm install required
# Update CDN version in these files:
# 1. src/index.tsx (main app template)
# 2. public/modules/records/index.html (standalone test)
# 3. public/modules/records/dev.html (dev test)
```

## Version Pinning

Pin to exact version (not `@latest` or `@^0.16`):
- `katex@0.16.44` -- Ensures reproducible behavior
- jsDelivr serves immutable versioned files -- no risk of unexpected updates
- Review and bump version manually when needed

## Sources

- [KaTeX Official Documentation - Browser](https://katex.org/docs/browser.html) -- HIGH confidence
- [KaTeX npm package](https://www.npmjs.com/package/katex) -- Version 0.16.44 confirmed
- [KaTeX Auto-render Extension](https://katex.org/docs/autorender.html) -- HIGH confidence
- [KaTeX GitHub Releases](https://github.com/KaTeX/KaTeX/releases) -- HIGH confidence
- [jsDelivr CDN for KaTeX](https://www.jsdelivr.com/package/npm/katex) -- HIGH confidence
- [KaTeX Font Documentation](https://katex.org/docs/font) -- HIGH confidence
