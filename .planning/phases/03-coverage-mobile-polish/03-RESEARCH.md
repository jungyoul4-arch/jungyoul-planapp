# Phase 3: Coverage & Mobile Polish - Research

**Researched:** 2026-03-29
**Domain:** KaTeX math rendering coverage, mobile CSS, copy-paste
**Confidence:** HIGH

## Summary

Phase 3 requires three things: (1) ensure every view displaying AI-generated text calls `safeMathHtml()` instead of raw `nl2br()`/`markKeywords()`, (2) add CSS to prevent long KaTeX equations from causing horizontal page scroll on mobile, and (3) enable copy-paste of LaTeX source from rendered equations using KaTeX's official `copy-tex` contrib extension.

The audit of all 36 view files identified **5 files** that display AI-generated text without calling `safeMathHtml()` or `renderMath()`. The main app `app.js` also displays AI text (exam coach plans, AI feedback) without math rendering, but this is out of scope since it operates in a separate codebase from the records module. The records module is the primary target.

**Primary recommendation:** Add `safeMathHtml` import and replace raw `nl2br()`/`markKeywords()` calls in the 5 identified view files, add KaTeX overflow CSS to `records.css`, and include the `copy-tex` CDN script in `index.html`/`dev.html`.

## Project Constraints (from CLAUDE.md)

### Key Directives
- **Tech Stack:** Vanilla JS + TailwindCSS CDN. No React/Vue. No bundler for frontend.
- **KaTeX via CDN:** Already using KaTeX v0.16.44 via cdn.jsdelivr.net
- **Module isolation:** Records module uses `_RM` namespace, scoped CSS with `.archive-module`
- **CSS scoping:** All records module CSS must be scoped under `.archive-module`
- **No code-only completion:** Must verify in browser after UI changes
- **safeMathHtml pattern (Phase 2 decision):** All AI-generated text must go through `safeMathHtml()`, not raw `renderMath()`
- **ES Module imports:** Must include `.js` extension in import paths

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| COV-01 | All views displaying AI text call renderMath/safeMathHtml | Audit found 5 files in records module needing fix; see "Audit Results" section |
| COV-02 | Long equations on mobile don't cause horizontal page scroll | KaTeX overflow CSS pattern documented; use `overflow-x: auto` on wrapper, `overflow-y: hidden` to prevent double scrollbar |
| COV-03 | Copying rendered equation puts LaTeX source in clipboard | KaTeX `copy-tex` contrib extension handles this; one CDN script tag |
</phase_requirements>

## Audit Results: Files Needing safeMathHtml

### Files Already Using safeMathHtml (NO CHANGES NEEDED)
| File | Call Sites |
|------|-----------|
| `views/ai-credit-log.js` | 10 sites (Phase 2) |
| `views/aha-report-result.js` | 7 sites (Phase 2) |

### Files That Display AI Text WITHOUT safeMathHtml (MUST FIX)

| File | AI Text Fields Displayed Raw | Fix Required |
|------|------------------------------|-------------|
| `views/class-detail.js` | `log.highlights`, `log.summary`, `log.teacher_insight`, `q.q`, `q.reason`, exam items, active recall Q&A, assignment text | Import `safeMathHtml` from utils.js, replace `nl2br()` and raw string insertions with `safeMathHtml()` calls |
| `views/aha-report-list.js` | `detail.section_sa`, `detail.section_da`, `detail.section_poa`, `detail.section_ppa` | Import `safeMathHtml`, replace `nl2br()` calls |
| `views/question-record.js` | `q.aiImproved` (line 996) | Import `safeMathHtml`, wrap `aiImproved` display |
| `views/exam-detail.js` | `ex.aiPlan` (line 197) - AI-generated study plan HTML | This is pre-formatted HTML from the server; needs `renderMath()` post-processing on the container element, not `safeMathHtml` |
| `views/class-history.js` | Does NOT display AI text content directly in cards (only shows topic, keywords, date) | **NO FIX NEEDED** - card view is summary-only |

### Files That Reference AI Data but Don't Display Text (NO FIX NEEDED)
| File | Why No Fix |
|------|-----------|
| `views/period-select.js` | Only reads `ai_credit_log` to check existence (boolean check) |
| `views/photo-album.js` | Only reads photos array, not text content |
| `views/exam-add.js` | Only reads `ai_credit_log` to check existence |
| `views/growth-analysis.js` | Displays numeric scores and chart data, no AI text |

### Out of Scope (Main App)
| File | AI Text Fields | Why Out of Scope |
|------|---------------|-----------------|
| `public/static/app.js` | `ex.aiPlan`, `r.ai_feedback` | Separate codebase (700K+ monolith), different rendering pipeline, no `safeMathHtml` available |

## Architecture Patterns

### Pattern 1: safeMathHtml Adoption in View Files
**What:** Replace raw text insertion with `safeMathHtml()` call
**When to use:** Any view displaying AI-generated text that could contain LaTeX

**Before (class-detail.js line 354):**
```javascript
${log.highlights ? `...${markKeywords(nl2br(log.highlights), keywords)}...` : ''}
```

**After:**
```javascript
${log.highlights ? `...${safeMathHtml(log.highlights, { keywords })}...` : ''}
```

Import change needed:
```javascript
// Before
import { kstToday, getSubjectColor, tryParseJSON, markKeywords, getAssignmentDisplayText, skeletonDetail, showToast } from '../core/utils.js';
// After
import { kstToday, getSubjectColor, tryParseJSON, markKeywords, safeMathHtml, getAssignmentDisplayText, skeletonDetail, showToast } from '../core/utils.js';
```

### Pattern 2: Post-render Math Processing for Pre-formatted HTML
**What:** For content that arrives as pre-formatted HTML (like `ex.aiPlan`), use `renderMath()` on the raw text before inserting into DOM
**When to use:** When server returns HTML with embedded LaTeX but no KaTeX rendering

```javascript
// exam-detail.js: aiPlan is HTML from server that may contain $...$ LaTeX
import { renderMath } from '../core/utils.js';
// ...
<div class="exam-ai-plan-content">${renderMath(ex.aiPlan)}</div>
```

Note: `safeMathHtml` would double-escape the HTML since `aiPlan` is already HTML. Use `renderMath()` directly for pre-formatted HTML content.

### Pattern 3: KaTeX Mobile Overflow CSS
**What:** Wrap KaTeX display equations in a scrollable container
**Where:** Add to `records.css`

```css
/* KaTeX mobile overflow prevention */
.archive-module .katex-display {
  overflow-x: auto;
  overflow-y: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 4px 0;
}

.archive-module .katex-display > .katex {
  white-space: nowrap;
}
```

This approach:
- Adds horizontal scroll only when equation exceeds container width
- `overflow-y: hidden` prevents the known KaTeX vertical scrollbar bug (KaTeX's vertical alignment workaround creates extra height)
- Scoped under `.archive-module` per project CSS convention

### Pattern 4: copy-tex Extension
**What:** Include KaTeX's official `copy-tex` contrib script
**Where:** Add to `index.html` and `dev.html` after the main KaTeX script

```html
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/contrib/copy-tex.min.js"></script>
```

This extension automatically:
- Intercepts copy events on KaTeX elements
- Replaces rendered math in clipboard with LaTeX source
- Uses `$...$` for inline and `$$...$$` for display math delimiters
- Extends partial selections to include full formula

Optional CSS for better selection UX:
```css
/* Make KaTeX formulas select all-or-nothing */
.archive-module .katex {
  user-select: all;
  -webkit-user-select: all;
}
```

### Anti-Patterns to Avoid
- **Raw `renderMath()` on AI text:** Always use `safeMathHtml()` to enforce escapeHtml -> renderMath -> nl2br -> markKeywords ordering. Using raw `renderMath()` on unescaped user/AI text is an XSS risk.
- **`safeMathHtml()` on pre-formatted HTML:** Don't use it on content that's already HTML (like `aiPlan`). It will double-escape `<` and `>`. Use `renderMath()` directly.
- **`overflow: auto` on `.katex` element directly:** This causes a vertical scrollbar. Put it on `.katex-display` (the wrapper div) instead.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| LaTeX copy-paste | Custom clipboard event handler | KaTeX `copy-tex` extension | Handles edge cases (partial selection, nested elements, delimiter mapping) |
| Math overflow on mobile | Custom JS resize observer | CSS `overflow-x: auto` on `.katex-display` | Pure CSS, zero JS, handles all cases |
| Call-order safety | Inline escapeHtml/renderMath/nl2br chains | `safeMathHtml()` helper | Already exists, enforces correct order, prevents XSS |

## Common Pitfalls

### Pitfall 1: Double-escaping Pre-formatted HTML
**What goes wrong:** Using `safeMathHtml()` on `ex.aiPlan` which is already HTML turns `<strong>` into `&lt;strong&gt;`
**Why it happens:** `safeMathHtml()` calls `escapeHtml()` first, which is correct for raw text but wrong for pre-formatted HTML
**How to avoid:** Use `renderMath()` directly for content that is already HTML. Only use `safeMathHtml()` for raw AI text strings.
**Warning signs:** Rendered output shows literal HTML tags as text

### Pitfall 2: Missing import causes silent failure
**What goes wrong:** Forgetting to add `safeMathHtml` to the import statement, causing a ReferenceError at runtime
**Why it happens:** ES module imports must explicitly list each function
**How to avoid:** Always update the import line when adding `safeMathHtml` usage
**Warning signs:** Blank sections or JS console errors about undefined functions

### Pitfall 3: KaTeX vertical scrollbar on overflow-x
**What goes wrong:** Adding `overflow-x: auto` to `.katex` or `.katex-display` causes an unwanted vertical scrollbar
**Why it happens:** KaTeX uses CSS tricks for vertical alignment that create extra height
**How to avoid:** Add `overflow-y: hidden` alongside `overflow-x: auto`
**Warning signs:** Equations get a small vertical scrollbar on mobile

### Pitfall 4: copy-tex script load order
**What goes wrong:** copy-tex script loads before KaTeX main script, fails silently
**Why it happens:** Both scripts have `defer` but copy-tex depends on KaTeX being loaded
**How to avoid:** Place copy-tex `<script>` tag after the KaTeX `<script>` tag in HTML. With `defer`, scripts execute in document order.
**Warning signs:** Copying equations yields rendered text instead of LaTeX source

### Pitfall 5: class-detail.js has a local nl2br function
**What goes wrong:** class-detail.js defines `function nl2br(t) { return (t || '').replace(/\n/g, '<br>'); }` locally inside `_renderDetailCreditLog`. When switching to `safeMathHtml`, this local function becomes unused but may cause confusion.
**How to avoid:** Remove the local `nl2br` definition when switching to `safeMathHtml` (which handles newline conversion internally).

## Code Examples

### class-detail.js: Full _renderDetailCreditLog Fix Pattern

The function `_renderDetailCreditLog` (line 294-366) needs the most changes. Key lines to modify:

```javascript
// Line 312: seteuk question text
// Before: ${q.q}
// After:  ${safeMathHtml(q.q)}

// Line 313: seteuk reason
// Before: + q.reason +
// After:  + safeMathHtml(q.reason) +

// Line 318: legacy question text (markKeywords on improved)
// Before: markKeywords(q.improved, keywords)
// After:  safeMathHtml(q.improved, { keywords })

// Line 354: highlights
// Before: ${markKeywords(nl2br(log.highlights), keywords)}
// After:  ${safeMathHtml(log.highlights, { keywords })}

// Line 356: exam items
// Before: + item +
// After:  + safeMathHtml(item) +

// Line 359: summary
// Before: ${nl2br(log.summary)}
// After:  ${safeMathHtml(log.summary)}

// Line 360: teacher_insight
// Before: ${nl2br(log.teacher_insight)}
// After:  ${safeMathHtml(log.teacher_insight)}

// Line 361: active recall question and answer
// Before: + item.question + ... + item.answer +
// After:  + safeMathHtml(item.question) + ... + safeMathHtml(item.answer) +
```

### aha-report-list.js: Section Display Fix Pattern

```javascript
// Before (line 345):
<div class="aha-section-content">${nl2br(detail.section_sa)}</div>

// After:
<div class="aha-section-content">${safeMathHtml(detail.section_sa)}</div>

// Same for section_da (line 365), section_poa (line 374)
```

### question-record.js: AI Improved Display Fix

```javascript
// Before (line 996):
? `<div class="qb-ai-improved">${aiImproved}</div>`

// After:
? `<div class="qb-ai-improved">${safeMathHtml(aiImproved)}</div>`
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Raw nl2br + markKeywords | safeMathHtml() helper | Phase 2 (2026-03-29) | Enforces safe call order, prevents XSS |
| No KaTeX copy support | copy-tex contrib extension | KaTeX 0.10+ | Official solution, zero custom code |
| Fixed-width equations | overflow-x: auto on container | CSS standard | Works across all browsers |

## Open Questions

1. **app.js AI text rendering**
   - What we know: `app.js` displays `ex.aiPlan` and `ai_feedback` without math rendering in at least 5 locations
   - What's unclear: Whether these AI-generated texts actually contain LaTeX (they might not, since exam coaching prompts ask for HTML formatting)
   - Recommendation: Out of scope for Phase 3 (separate 700K codebase). Can be addressed in a future phase if needed.

2. **aha-report-list.js PPA section rendering**
   - What we know: The PPA section has `ppa.change` and `ppa.lacking` sub-fields displayed with `nl2br()`
   - What's unclear: Full extent of the detail view rendering (need to check remaining lines)
   - Recommendation: Include PPA sub-fields in the fix scope

## Sources

### Primary (HIGH confidence)
- KaTeX copy-tex extension: [GitHub README](https://github.com/KaTeX/KaTeX/blob/main/contrib/copy-tex/README.md) - CDN URL, usage, behavior
- KaTeX overflow discussion: [GitHub Discussion #2942](https://github.com/KaTeX/KaTeX/discussions/2942) - overflow-y: hidden fix for vertical scrollbar
- KaTeX responsiveness: [GitHub Issue #455](https://github.com/KaTeX/KaTeX/issues/455) - overflow-x approach for mobile

### Secondary (MEDIUM confidence)
- Project source code audit: Direct reading of all 36 view files in `public/modules/records/views/`
- Phase 2 summary: `safeMathHtml` pattern and 17 call site fixes documented

## Metadata

**Confidence breakdown:**
- Audit results: HIGH - direct code reading of all view files
- KaTeX overflow CSS: HIGH - well-documented community solution
- copy-tex extension: HIGH - official KaTeX contrib, verified CDN URL matches project's KaTeX version (0.16.44)
- Scope boundaries: MEDIUM - app.js analysis limited to grep (file too large to read fully)

**Research date:** 2026-03-29
**Valid until:** 2026-04-28 (stable domain, KaTeX rarely changes)
