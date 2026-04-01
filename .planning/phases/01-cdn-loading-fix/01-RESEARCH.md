# Phase 1: CDN Loading Fix - Research

**Researched:** 2026-03-29
**Domain:** KaTeX CDN loading, version upgrade, graceful degradation
**Confidence:** HIGH

## Summary

Phase 1 fixes math rendering in the production app by upgrading KaTeX from v0.16.9 to v0.16.44 and adding a CDN failure fallback. Codebase investigation reveals that KaTeX CDN tags are **already present** in all three HTML entry points (`src/index.tsx` template, `records/index.html`, `records/dev.html`) and **survive the Vite build** into `dist/_worker.js`. The `renderMath()` function in `core/utils.js` already gracefully degrades when `window.katex` is undefined (returns raw text). This means the CDN loading is architecturally correct -- the fix is a version bump plus adding an explicit CDN failure handler with console warning.

The two existing call sites (`ai-credit-log.js` and `aha-report-result.js`) already use `renderMath()`. Both have call-ordering issues (`renderMath(nl2br(...))` and `renderMath(markKeywords(...))`) but those are Phase 2 scope (SEC-01, SEC-03). Phase 1 only needs to ensure KaTeX loads and renders math in these two views.

**Primary recommendation:** Update all KaTeX CDN URLs from `0.16.9` to `0.16.44` across 3 files, add an `onerror` handler on the KaTeX script tag that logs a console warning, and verify the production build output contains the updated tags.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CDN-01 | Production `index.html`에 KaTeX CSS + JS CDN tags, app load 시 정상 로드 | KaTeX tags already present in `src/index.tsx` (line 5827-5828), `records/index.html` (line 15-16), `records/dev.html` (line 11-12). Verified they survive Vite build in `dist/_worker.js` (line 921-922). Fix: version upgrade only. |
| CDN-02 | KaTeX version upgraded to v0.16.44 | npm registry confirms 0.16.44 is latest. Change is a URL string replacement from `@0.16.9` to `@0.16.44` in 3 source files. |
| CDN-03 | CDN load failure: console warning, app functions normally with raw text | `renderMath()` already returns raw text when `katex` is undefined. Need to add `onerror` attribute on script tag to log explicit console warning. |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

**Mandatory directives affecting this phase:**
- **Tech stack is frozen**: Vanilla JS + Hono + Cloudflare Pages. No React/Vue.
- **KaTeX via CDN (not bundled)**: Already decided in STATE.md. Do not npm-install KaTeX.
- **Deploy with `npm run deploy` only**: Never `wrangler pages deploy public` directly.
- **Build verification required**: `npm run build` then check `dist/` output.
- **Browser verification required**: Must verify in browser, never declare done from code alone.
- **ES Module imports require `.js` extension**: Relevant if adding any new utility files.
- **`_RM` namespace**: All inline onclick handlers in records module must use `_RM.xxx()`.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| KaTeX | 0.16.44 | Math rendering (CDN) | Already integrated, fastest math renderer, 35 patch releases of fixes since 0.16.9 |
| jsDelivr CDN | - | KaTeX delivery | Already in use, immutable versioned URLs, global edge network |

### CDN URLs (after upgrade)
```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.js"></script>
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jsDelivr CDN | Self-hosted in `public/lib/katex/` | Eliminates CDN dependency but increases bundle size; deferred to v2 (ENH-01) |
| KaTeX | MathJax | Out of scope per REQUIREMENTS.md |

## Architecture Patterns

### Files That Need Changes

```
src/index.tsx          # Line 5827-5828: KaTeX CDN tags (main app template)
public/modules/records/index.html   # Line 15-16: KaTeX CDN tags (standalone records)
public/modules/records/dev.html     # Line 11-12: KaTeX CDN tags (dev testing)
public/modules/records/core/utils.js # Line 84-107: renderMath() -- add console.warn on CDN fail
```

### Pattern 1: Version Upgrade (CDN-01, CDN-02)
**What:** Replace `katex@0.16.9` with `katex@0.16.44` in all CDN URLs
**When to use:** All 3 HTML entry points
**Example:**
```html
<!-- Before -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>

<!-- After -->
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.js" onerror="console.warn('[KaTeX] CDN load failed. Math will display as plain text.')"></script>
```

### Pattern 2: CDN Failure Graceful Degradation (CDN-03)
**What:** Add `onerror` handler to KaTeX script tag + ensure `renderMath()` logs warning on first call when KaTeX unavailable
**When to use:** Production resilience against CDN blocking (Korean school networks)
**Example:**
```javascript
// In renderMath() -- add one-time console warning
export function renderMath(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (typeof katex === 'undefined') {
    if (!renderMath._warned) {
      console.warn('[KaTeX] Library not loaded. Math formulas will display as plain text.');
      renderMath._warned = true;
    }
    return text;
  }
  // ... existing rendering logic unchanged
}
```

### Anti-Patterns to Avoid
- **Do NOT npm-install KaTeX**: This is a CDN-loaded library. Adding it to package.json would conflict with the architecture.
- **Do NOT use KaTeX auto-render extension**: The SPA uses explicit `renderMath()` calls. Auto-render causes false positives with Korean text containing `$`.
- **Do NOT change `renderMath()` call ordering**: Fixing `renderMath(nl2br(...))` to `nl2br(renderMath(...))` is Phase 2 (SEC-01). Phase 1 only ensures KaTeX loads.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Math rendering | Custom LaTeX parser | KaTeX CDN | Already integrated, battle-tested |
| CDN fallback | Complex loader with retry logic | Simple `onerror` attribute + graceful `typeof` check | KISS -- existing `renderMath()` already handles missing KaTeX |

## Common Pitfalls

### Pitfall 1: Forgetting to Update All 3 Files
**What goes wrong:** Version mismatch between entry points -- `src/index.tsx` says 0.16.44 but `records/index.html` still says 0.16.9
**Why it happens:** 3 separate HTML files all contain the same CDN tags
**How to avoid:** grep for `katex@0.16` after changes to confirm zero instances of old version remain
**Warning signs:** `grep -r "katex@0.16.9" src/ public/` returns results

### Pitfall 2: Vite Build Doesn't Reflect Changes
**What goes wrong:** Edit `src/index.tsx` but forget to rebuild; production still serves old version
**Why it happens:** `src/index.tsx` is a template string inside TypeScript, compiled by Vite into `dist/_worker.js`
**How to avoid:** Run `npm run build` then verify `dist/_worker.js` contains `katex@0.16.44`
**Warning signs:** `grep "katex@0.16.9" dist/_worker.js` returns results

### Pitfall 3: CSS Version Mismatch with JS
**What goes wrong:** Update JS CDN URL but not CSS CDN URL (or vice versa)
**Why it happens:** Two separate tags per entry point, easy to miss one
**How to avoid:** Always update CSS and JS tags together; they share the same version
**Warning signs:** KaTeX renders but fonts look wrong, or specific symbol rendering fails

### Pitfall 4: `onerror` Handler Syntax in JSX Template
**What goes wrong:** `onerror` in the `src/index.tsx` template string may need escaping
**Why it happens:** `src/index.tsx` uses JSX/template literal HTML, not raw HTML
**How to avoid:** Check if the template string is raw HTML or JSX -- in this case, line 5828 shows it's a raw template string inside backticks, so standard HTML attributes work
**Warning signs:** Build error or malformed HTML in production

## Code Examples

### Current renderMath() (from `core/utils.js` lines 84-107)
```javascript
export function renderMath(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (typeof katex === 'undefined') return text;

  // Block: $$...$$
  text = text.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: true, throwOnError: false, output: 'html'
      });
    } catch { return match; }
  });

  // Inline: $...$
  text = text.replace(/\$([^$\n]+)\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false, throwOnError: false, output: 'html'
      });
    } catch { return match; }
  });

  return text;
}
```

### Existing Call Sites (Phase 1 scope -- verify these work after fix)
- `ai-credit-log.js`: Lines 411, 437, 442, 443, 461, 522, 533, 590 -- renders math in credit log views
- `aha-report-result.js`: Lines 361, 377, 396, 407, 425, 426, 441 -- renders math in aha report views

### All KaTeX CDN Tag Locations (must ALL be updated)
1. `src/index.tsx` lines 5827-5828 (main app template)
2. `public/modules/records/index.html` lines 15-16 (standalone test)
3. `public/modules/records/dev.html` lines 11-12 (dev test)

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| KaTeX 0.16.9 | KaTeX 0.16.44 | 35 patch releases between versions | Bug fixes, zero breaking changes |

**Deprecated/outdated:**
- KaTeX 0.16.9: Still functional but missing 35 patch releases of bug fixes. Upgrade is safe and free.

## Open Questions

1. **Does the production build actually load KaTeX successfully?**
   - What we know: CDN tags exist in `dist/_worker.js`. Build output is correct.
   - What's unclear: Whether Korean school networks block `cdn.jsdelivr.net`
   - Recommendation: Phase 1 adds `onerror` handler as detection mechanism. Self-hosting is v2 scope (ENH-01).

2. **Is there a timing race between `defer` script loading and view rendering?**
   - What we know: `renderMath()` already handles `typeof katex === 'undefined'` by returning raw text.
   - What's unclear: Whether the first render happens before KaTeX loads, showing raw text briefly before re-render.
   - Recommendation: Out of scope for Phase 1. The existing graceful degradation handles this. If it proves to be a UX issue, a `waitForKaTeX()` guard can be added in a future phase.

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection of `src/index.tsx`, `records/index.html`, `records/dev.html`, `core/utils.js` -- verified all CDN tags and renderMath logic
- `dist/` build output inspection -- confirmed KaTeX tags survive Vite build
- npm registry (`npm view katex version`) -- confirmed 0.16.44 is latest
- `.planning/research/SUMMARY.md` -- project-level research with HIGH confidence assessment

### Secondary (MEDIUM confidence)
- KaTeX changelog (0.16.9 to 0.16.44) -- 35 patch releases, no breaking changes (from project research summary)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - KaTeX already integrated, just version bump
- Architecture: HIGH - All file locations verified by direct inspection, build output confirmed
- Pitfalls: HIGH - All pitfalls derived from direct codebase analysis, not speculation

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable domain, KaTeX versioning is slow-moving)
