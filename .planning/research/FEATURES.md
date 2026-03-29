# Feature Landscape: KaTeX Math Rendering

**Domain:** Math rendering in a Korean high school student planner (Vanilla JS SPA)
**Researched:** 2026-03-29
**KaTeX version in project:** v0.16.9 (latest stable: v0.16.44)

## Table Stakes

Features users expect. Missing = math shows as raw LaTeX text, breaking the core value proposition.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **KaTeX JS + CSS loading in production** | Without it, `renderMath()` silently returns raw text (line 86: `typeof katex === 'undefined'` guard) | Low | Root cause of current bug: `index.html` missing CDN tags that `dev.html` has |
| **Inline math (`$...$`)** | Physics/math formulas like `$F=ma$` appear throughout AI analysis results | Low | Already implemented in `renderMath()` via regex replacement |
| **Block/display math (`$$...$$`)** | Multi-line equations, derivations in quiz answers and summaries | Low | Already implemented in `renderMath()` with `displayMode: true` |
| **Graceful error handling** | AI-generated LaTeX often contains invalid commands; must not crash the page | Low | Already using `throwOnError: false` -- correct approach |
| **KaTeX CSS (font + layout)** | Without the stylesheet, rendered math has no fonts and breaks layout completely | Low | Must load `katex.min.css` before any rendering occurs |
| **Font loading without FOUT** | KaTeX uses custom fonts (KaTeX_Main, KaTeX_Math, etc.); missing fonts = broken symbols | Low | KaTeX CSS uses `font-display: block` by default, which prevents FOUT. CDN serves WOFF2 with good caching. |
| **Mobile rendering** | Students use phones/tablets; math must be legible on small screens | Low | KaTeX renders to HTML/CSS (not canvas), so it reflows naturally. May need `overflow-x: auto` on block math containers. |

## Differentiators

Features that improve UX beyond "it works." Not expected, but valued.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Version upgrade (0.16.9 -> 0.16.44)** | 35 patch versions of bug fixes, new LaTeX commands (`\underbracket`, `\overbracket`, `\sout`), improved rendering | Low | Just change CDN URL version number. Low risk, high value. |
| **Auto-render extension** | Would allow rendering math in any HTML without manual `renderMath()` calls; useful for future views that forget to call it | Medium | Requires additional `contrib/auto-render.min.js` script. Current manual approach works fine for this codebase since all render points already call `renderMath()`. Consider only if new views keep forgetting. |
| **Font preloading** | Eliminates the brief invisible-text period while KaTeX fonts download on first visit | Low | Add `<link rel="preload">` for 2-3 key WOFF2 fonts (KaTeX_Main-Regular, KaTeX_Math-Italic). Only worth doing for above-fold math content. |
| **Block math overflow handling** | Long equations (common in physics) don't break mobile layout | Low | CSS: `.katex-display { overflow-x: auto; overflow-y: hidden; }` on the container. Prevents horizontal page scroll. |
| **`strict: false` configuration** | Suppresses console warnings for LaTeX-convenient shortcuts AI might generate (e.g., `\R` for reals) | Low | Add `strict: false` to `katex.renderToString()` options. Currently not set, which means `"warn"` default logs to console. |
| **Copy-paste producing LaTeX source** | When students copy rendered math, they get the original LaTeX instead of garbled text | High | KaTeX's copy-paste is known to be poor (duplicates content from MathML + HTML). Would require custom clipboard handling. Not worth the effort for this use case. |
| **Server-side pre-rendering** | Render math on the Hono backend so it arrives as HTML, eliminating client-side flash | High | KaTeX supports Node.js rendering. But adds backend complexity, increases response size, and current architecture (AI returns JSON, frontend renders) doesn't align. Overkill. |

## Anti-Features

Features to explicitly NOT build.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Switch to MathJax** | PROJECT.md explicitly rules this out. KaTeX is already integrated, 10x faster than MathJax for rendering. MathJax's advantage (better accessibility, equation numbering) is irrelevant for this student planner. | Fix KaTeX loading. The rendering code is already correct. |
| **LaTeX equation editor UI** | PROJECT.md marks this out of scope. Students don't write LaTeX -- AI generates it from photo analysis. Adding an editor adds complexity for zero user value. | Keep current flow: AI generates LaTeX in responses, `renderMath()` renders it. |
| **Auto-render on `document.body`** | Dangerous in a SPA. Auto-render scans ALL text nodes, including UI labels, button text, and data attributes. A stray `$` in Korean text (e.g., price "$5,000") would trigger false positive rendering. | Keep explicit `renderMath()` calls on specific content fields. The current approach is correct and safer. |
| **KaTeX npm bundle** | Would require Vite bundling changes, increases JS bundle size (~300KB), adds build complexity. CDN approach is simpler, leverages browser caching across sites, and matches the existing architecture. | Keep CDN loading. Fix production `index.html` to include the same CDN tags as `dev.html`. |
| **Custom KaTeX macros/extensions** | Adding `\newcommand` definitions for convenience macros adds maintenance burden and coupling between AI prompt and frontend rendering. | Let AI output standard LaTeX. KaTeX supports most standard commands out of the box. |
| **Accessibility enhancements (ARIA, MathML speech)** | KaTeX's MathML output has known screen reader issues (VoiceOver can't access `aria-hidden` visual math). Fixing this properly requires MathJax-level effort. User base is sighted students using mobile devices. | Accept KaTeX's default MathML output. If accessibility becomes a requirement later, that's a separate project. |
| **Equation numbering / cross-referencing** | KaTeX doesn't support `\label` and `\eqref`. AI-generated content doesn't use equation references anyway. | Not needed. Content is discrete formulas, not academic papers. |

## Feature Dependencies

```
KaTeX JS loaded ──> renderMath() works ──> All math-containing views render correctly
     |
KaTeX CSS loaded ──> Fonts available ──> Math displays with correct typography
     |
     v
(Optional) Font preload ──> Faster first-paint for math content

Version upgrade (independent) ──> More LaTeX commands supported
Block overflow CSS (independent) ──> Better mobile experience
strict:false config (independent) ──> Cleaner console output
```

Key dependency chain: **CSS must load before JS renders.** If JS fires before CSS is ready, math renders with wrong fonts and layout. The `defer` attribute on the script tag and stylesheet `<link>` ordering handle this correctly in the existing `dev.html` pattern.

## MVP Recommendation

For this milestone (fixing broken math rendering), prioritize in this order:

1. **Add KaTeX CDN tags to production `index.html`** (Table stakes -- this is the root cause)
   - Copy exact pattern from `dev.html`: CSS link + deferred JS script
   - This single change fixes all `renderMath()` calls across the entire app

2. **Verify all `renderMath()` call sites work** (Table stakes -- validation)
   - ai-credit-log.js: 8 call sites (highlights, seteuk questions, quiz Q/A/explanation, exam items, summary, teacher insight)
   - aha-report-result.js: 8 call sites (SA, PA questions, DA, POA, PPA change/lacking, feedback)
   - Verify with actual AI-generated content containing `$...$` and `$$...$$`

3. **Add block math overflow CSS** (Differentiator -- prevents mobile layout break)
   - Simple CSS addition, high impact for physics equations on phones

4. **Upgrade to v0.16.44** (Differentiator -- free bug fixes)
   - Change version in CDN URL from `0.16.9` to `0.16.44`

5. **Add `strict: false` to renderMath options** (Differentiator -- cleaner console)
   - One-line change in `utils.js`

**Defer:**
- Auto-render extension: Current explicit `renderMath()` pattern is correct and safer
- Font preloading: Marginal improvement, CDN caching handles repeat visits
- Server-side rendering: Architecture mismatch, overkill for the problem
- Copy-paste fixes: Known KaTeX limitation, not fixable without major effort

## Sources

- [KaTeX Official Site](https://katex.org/) - HIGH confidence
- [KaTeX Auto-render Extension Docs](https://katex.org/docs/autorender.html) - HIGH confidence
- [KaTeX Options Documentation](https://katex.org/docs/options.html) - HIGH confidence
- [KaTeX Browser Integration](https://katex.org/docs/browser.html) - HIGH confidence
- [KaTeX GitHub Issues #820 - VoiceOver MathML](https://github.com/KaTeX/KaTeX/issues/820) - MEDIUM confidence
- [KaTeX GitHub Issues #645 - Copy/paste support](https://github.com/KaTeX/KaTeX/issues/645) - MEDIUM confidence
- [KaTeX vs MathJax Comparison](https://biggo.com/news/202511040733_KaTeX_MathJax_Web_Rendering_Comparison) - MEDIUM confidence
- [KaTeX npm - version info](https://www.npmjs.com/package/katex) - HIGH confidence
