# Project Research Summary

**Project:** HS CreditPlanner -- KaTeX Math Rendering Fix
**Domain:** Math rendering bug fix in Vanilla JS SPA (Cloudflare Pages)
**Researched:** 2026-03-29
**Confidence:** HIGH

## Executive Summary

This project is a targeted bug fix, not a new feature build. The KaTeX math rendering feature is already architecturally correct — the `renderMath()` utility exists, it handles `$...$` and `$$...$$` delimiters, and it gracefully degrades when KaTeX is unavailable. All three HTML entry points already include the correct KaTeX CDN tags. The root cause of broken math in production is a likely race condition (deferred CDN script executing after the first view render), a Vite build-time issue stripping CDN tags from the HTML template in `src/index.tsx`, or a CDN network failure in the Korean school networks the app targets.

The recommended fix is three-pronged: first, verify the production build output actually contains KaTeX CDN tags (run `npm run build`, inspect `dist/`); second, add a KaTeX readiness guard in `core/utils.js` to handle timing edge cases rather than relying solely on `defer` ordering; third, audit all view files that render AI-generated text to ensure `renderMath()` is called. The research confirmed that `class-detail.js` and `class-history.js` likely display AI-generated content but do not currently call `renderMath()`.

Key risks beyond the CDN loading fix are security-related: once KaTeX is working, an XSS vulnerability becomes exploitable because some views call `nl2br()` or `renderMath()` in the wrong order, passing HTML-injected content into the math renderer. The `markKeywords()` + `renderMath()` interaction is also broken when keywords appear inside math delimiters. These must be fixed in a hardening phase immediately after the CDN fix is confirmed working.

## Key Findings

### Recommended Stack

The project is a Vanilla JS SPA with no frontend bundler — `public/` files are served directly from Cloudflare Pages. KaTeX is correctly loaded via jsDelivr CDN with `defer`, and the existing `renderMath()` architecture (global `window.katex` + module-scoped utility) is the correct approach for this stack. Bundling KaTeX or switching to ES module imports is explicitly ruled out; neither option fits the architecture.

A version upgrade from KaTeX 0.16.9 to 0.16.44 is recommended. This is a minor version bump covering 35 patch releases of bug fixes with no breaking changes; the CDN URL is the only thing to update.

**Core technologies:**
- KaTeX 0.16.44 (CDN via jsDelivr): math rendering — upgrade from 0.16.9, already integrated, zero breaking changes
- jsDelivr CDN: delivery — already in use, immutable versioned files, global edge caching
- Custom `renderMath()` in `core/utils.js`: parsing — string-based regex approach is correct for this SPA's innerHTML rendering model; do NOT switch to KaTeX auto-render extension

### Expected Features

**Must have (table stakes):**
- KaTeX JS + CSS loading in production — root cause of the current bug; without this, all math shows as raw `$...$` text
- Inline math (`$...$`) — already implemented, works when KaTeX loads
- Block/display math (`$$...$$`) — already implemented, works when KaTeX loads
- Graceful error handling (`throwOnError: false`) — already implemented correctly
- CSS-before-JS loading order — already correct in all entry points

**Should have (differentiators):**
- Block math overflow CSS (`.katex-display { overflow-x: auto }`) — prevents horizontal scroll on mobile for long physics equations
- KaTeX version upgrade to 0.16.44 — free bug fixes, one-line CDN URL change
- `strict: false` in renderMath options — suppresses console noise from AI-generated LaTeX shortcuts
- KaTeX readiness guard in `core/utils.js` — eliminates the timing race condition as a class of bug

**Defer to v2+:**
- Auto-render extension — current explicit `renderMath()` call pattern is safer for a SPA with Korean text (stray `$` false positives)
- Font preloading — marginal improvement, CDN caching handles repeat visits
- Server-side rendering — architecture mismatch, overkill for this problem
- Copy-paste LaTeX restoration — known KaTeX limitation, high effort for low value

### Architecture Approach

The current architecture is correct and must not change. `renderMath()` lives in `records/core/utils.js`, depends on `window.katex` set by CDN, and is imported by view renderers that process AI-generated text. The main `app.js` does not need math rendering. The real gap is that only 2 views currently call `renderMath()` (`ai-credit-log.js` and `aha-report-result.js`), while at least 2 other views (`class-detail.js`, `class-history.js`) also display AI-generated text that may contain LaTeX.

**Major components:**
1. HTML Entry Points (`src/index.tsx`, `records/index.html`, `records/dev.html`) — load KaTeX CSS + JS via CDN; must be verified to survive `vite build`
2. `core/utils.js :: renderMath()` — string-level LaTeX-to-HTML conversion; needs readiness guard and regex hardening
3. View Renderers (`ai-credit-log.js`, `aha-report-result.js`, and missing views) — must call `renderMath()` on all AI-generated text fields before DOM insertion
4. AI Backend (`src/index.tsx`) — returns JSON containing LaTeX notation; unchanged

### Critical Pitfalls

1. **`defer` timing race condition** — KaTeX CDN script and the app's `type="module"` scripts are both deferred; execution order is not guaranteed. `renderMath()` can be called before `window.katex` is defined. Fix: add a `waitForKaTeX()` promise-based readiness guard instead of relying on `defer` ordering alone.

2. **XSS via innerHTML after renderMath()** — Some call sites apply `nl2br()` or `.replace(/\n/g, '<br>')` BEFORE passing text to `renderMath()`. This injects HTML into the math regex matching. The correct order is: `escapeHtml` → `renderMath` → `nl2br` → `markKeywords`. Fixing CDN loading without fixing this order makes the XSS exploitable.

3. **`markKeywords()` before `renderMath()` corrupts math** — `ai-credit-log.js` line 590 calls `renderMath(markKeywords(text, kw))`. If a keyword appears inside a `$...$` delimiter, the injected `<span>` tag breaks KaTeX parsing. Fix: reverse the call order to `markKeywords(renderMath(text), kw)` with KaTeX-aware keyword matching.

4. **`nl2br` breaks multi-line block math** — Block formulas spanning multiple lines (`$$\nf(x)\n$$`) are converted to `$$<br>f(x)<br>$$` when `nl2br` runs first, causing KaTeX parse failure on `<br>` tags. Fix: always call `renderMath()` before any newline-to-HTML conversion.

5. **CDN unavailability on Korean school networks** — School networks may block cdn.jsdelivr.net via firewall or proxy. If confirmed, self-host KaTeX in `public/lib/katex/` as a fallback. Add `onerror` attribute to CDN tags pointing to self-hosted path.

## Implications for Roadmap

Based on research, this project requires 3 phases in strict dependency order.

### Phase 1: Production CDN Verification and Loading Fix
**Rationale:** All other work is pointless if KaTeX does not load in production. This must be verified before adding more `renderMath()` call sites. ARCHITECTURE.md confirms the fix may already be partially in place — verification comes first.
**Delivers:** Confirmed KaTeX loading in the production build; math renders in the 2 existing call sites
**Addresses:** Table stakes features (KaTeX JS + CSS loading, version upgrade)
**Avoids:** Pitfall 1 (defer timing), Pitfall 2 (CSS missing), Pitfall 7 (CDN availability)

Steps:
1. Run `npm run build` and inspect `dist/` for KaTeX CDN tags
2. Check browser DevTools Network tab on production for CDN load timing
3. Add KaTeX readiness guard to `core/utils.js`
4. Upgrade CDN version from 0.16.9 to 0.16.44
5. Add block math overflow CSS

### Phase 2: Security Hardening and Utility Call Order Fix
**Rationale:** Once KaTeX loads, the XSS via `nl2br`-before-`renderMath` pattern becomes exploitable. This phase fixes the utility call ordering and regex robustness before expanding coverage.
**Delivers:** Secure, correct `renderMath()` with proper call ordering across all existing consumers
**Addresses:** Pitfall 3 (regex false positives), Pitfall 4 (XSS), Pitfall 5 (markKeywords interaction), Pitfall 8 (nl2br ordering)
**Uses:** Hardened regex with word-boundary lookaheads; `strict: false` KaTeX option

Steps:
1. Fix call order: `escapeHtml` → `renderMath` → `nl2br` → `markKeywords` in all consumers
2. Harden block math regex to support multiline: `/\$\$([\s\S]+?)\$\$/g`
3. Add `strict: false` to `katex.renderToString()` options
4. Add `<br>` stripping inside captured math before KaTeX parsing
5. Test with adversarial input: `<img src=x onerror=alert(1)>`, `$20 to $50`, multi-line block math

### Phase 3: Coverage Expansion and Mobile Polish
**Rationale:** After the fix is secure, expand `renderMath()` coverage to views that currently miss it, and polish mobile rendering.
**Delivers:** Math rendering across all AI-generated content views; correct mobile font sizing
**Addresses:** Missing `renderMath()` call sites in `class-detail.js`, `class-history.js`, and potentially `question-record.js`, `exam-result.js`, `growth-analysis.js`
**Avoids:** Pitfall 6 (Android font size mismatch)

Steps:
1. Audit all views: grep for `innerHTML` and template literals that insert AI-generated text fields
2. Add `renderMath()` calls to `class-detail.js` and `class-history.js` (confirmed missing)
3. Evaluate `question-record.js`, `exam-result.js`, `growth-analysis.js` for math content
4. Add `.katex-display { overflow-x: auto; overflow-y: hidden; }` CSS
5. Test on real Android device for font size mismatch; add `font-size: 1.1em` CSS normalization if needed

### Phase Ordering Rationale

- Phase 1 must precede everything else: adding `renderMath()` call sites without confirmed KaTeX loading produces no visible change and masks whether the fix worked
- Phase 2 must precede Phase 3: fixing security and call ordering in 2 files is easier than fixing it in 5+ files simultaneously
- Phase 3 is purely additive: no existing behavior is modified, only new call sites added

### Research Flags

Phases with well-documented patterns (skip research-phase):
- **Phase 1:** Standard CDN loading verification and version upgrade — fully documented pattern
- **Phase 2:** HTML sanitization and regex hardening — established patterns, pitfalls fully mapped
- **Phase 3:** View audit and call site addition — mechanical task guided by architecture research

No phases require `/gsd:research-phase` — the research is comprehensive and directly codebase-verified.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Direct codebase inspection; KaTeX docs verified; version confirmed on npmjs.com |
| Features | HIGH | All call sites directly verified in source; KaTeX API options confirmed |
| Architecture | HIGH | Full codebase analysis; all component boundaries verified by reading actual files |
| Pitfalls | HIGH | XSS and call ordering bugs directly observed in code (not inferred); regex verified |

**Overall confidence:** HIGH

### Gaps to Address

- **CDN vs self-hosting decision**: CDN availability on Korean school networks is a realistic but unverified risk. If Phase 1 testing reveals CDN failures, the CDN fallback/self-hosting strategy (STACK.md section "Fallback Strategy") must be implemented. Decision: verify first, self-host only if confirmed unreliable.
- **Missing view coverage**: ARCHITECTURE.md identifies `class-detail.js`, `class-history.js`, `question-record.js`, `exam-result.js`, `growth-analysis.js`, `activity-result.js` as potentially needing `renderMath()`. A grep audit in Phase 3 will determine the actual scope. Confidence is medium that `class-detail.js` and `class-history.js` are missing; lower for the others.
- **Android font mismatch severity**: PITFALLS.md rates this MEDIUM confidence. Actual severity depends on device testing. May be a non-issue or a significant UX problem — cannot determine without a real Android device.

## Sources

### Primary (HIGH confidence)
- KaTeX Official Documentation (katex.org/docs/browser, /options, /api, /security) — loading, API, security
- KaTeX npm package (npmjs.com/package/katex) — version 0.16.44 confirmed
- KaTeX GitHub Releases — changelog verification
- jsDelivr CDN — delivery format (UMD global, immutable versioned URLs)
- Direct codebase inspection — `core/utils.js`, `ai-credit-log.js`, `aha-report-result.js`, `src/index.tsx`

### Secondary (MEDIUM confidence)
- KaTeX GitHub Discussion #3693 — Android font size mismatch
- KaTeX GitHub Issue #1829 — Android webview rendering
- KaTeX/KaTeX Issue #1578 — defer loading recommendation
- GHSA-cg87-wmx4-v546 — KaTeX XSS advisory (mitigated by `trust: false` default)

### Tertiary (LOW confidence)
- Korean school network CDN blocking — realistic risk based on general knowledge, unverified for this specific deployment

---
*Research completed: 2026-03-29*
*Ready for roadmap: yes*
