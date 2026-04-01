# Domain Pitfalls: KaTeX Integration in Vanilla JS SPA

**Domain:** Math rendering (KaTeX) in Cloudflare Pages + Vanilla JS SPA
**Researched:** 2026-03-29
**Project:** 고교학점제 맞춤형 학생 플래너 -- Math Rendering Fix

---

## Critical Pitfalls

Mistakes that cause the feature to silently fail or create security vulnerabilities.

### Pitfall 1: `defer` Script + Early Execution = `katex` is `undefined`

**What goes wrong:** The `<script defer>` attribute means `katex.min.js` executes after HTML parsing completes but the exact timing relative to ES module execution is not guaranteed. When `renderMath()` is called from a view that renders before the deferred CDN script finishes loading, `typeof katex === 'undefined'` evaluates true and the function silently returns raw LaTeX text. The user sees `$F = ma$` instead of rendered math.

**Why it happens:** This project uses ES modules (`import { renderMath } from '../core/utils.js'`) loaded with `type="module"`. Module scripts are deferred by default. Two deferred scripts (the CDN katex.min.js and the app module) have no guaranteed relative execution order beyond document parse order. If the module script appears before katex.min.js in the HTML, or if the CDN is slow, the module can execute first.

**Consequences:** The entire math rendering feature silently degrades to raw text. Because `renderMath()` gracefully returns the original string, there is no error in the console -- the bug is invisible to developers who do not visually inspect the output.

**This project's specific exposure:** The `renderMath()` function in `core/utils.js` (line 86) explicitly checks `typeof katex === 'undefined'` and returns raw text. This is a safety net, not a solution. It masks the root problem.

**Prevention:**
1. Do NOT rely on `defer` ordering alone. Use an explicit readiness check:
   ```javascript
   function waitForKaTeX(timeout = 5000) {
     return new Promise((resolve, reject) => {
       if (typeof katex !== 'undefined') return resolve();
       const start = Date.now();
       const check = setInterval(() => {
         if (typeof katex !== 'undefined') { clearInterval(check); resolve(); }
         else if (Date.now() - start > timeout) { clearInterval(check); reject(); }
       }, 50);
     });
   }
   ```
2. Alternatively, add an `onload` callback on the KaTeX script tag to dispatch a custom event, and have views wait for that event before rendering math.
3. Consider bundling KaTeX via npm import instead of CDN to eliminate the race condition entirely.

**Detection:** Check the browser console network tab for CDN load timing vs. first `renderMath()` call. If KaTeX JS finishes loading after the first view renders, the bug is confirmed. Visually: if math appears as raw `$...$` on first page load but works after a manual re-render/navigation, this is the timing bug.

**Phase:** Must be fixed in Phase 1 (CDN loading fix). This is the root cause of the production bug.

**Confidence:** HIGH -- directly observed in the codebase and confirmed by the PROJECT.md description ("dev.html has KaTeX CDN but index.html production is missing").

---

### Pitfall 2: KaTeX CSS Missing = Broken Layout, Not Just Missing Math

**What goes wrong:** Loading `katex.min.js` without `katex.min.css` causes KaTeX to render HTML output with incorrect sizing, overlapping elements, and broken font references. It does NOT simply fail -- it produces garbled output that is worse than raw LaTeX text.

**Why it happens:** KaTeX's `renderToString()` produces HTML with specific CSS class names (`.katex`, `.katex-html`, `.mord`, `.mbin`, etc.) that rely on the stylesheet for font-face definitions, sizing, and positioning. Without the CSS, the browser renders these elements with default styling, creating visual noise.

**Consequences:** Math renders as overlapping characters, incorrect sizes, or boxes with missing font glyphs. On mobile, this can push content off-screen or break the layout of surrounding elements.

**This project's specific exposure:** The `index.html` (production) entry point is reported to be missing KaTeX CDN tags entirely. If only the JS is added without the CSS, or if the CSS link fails to load (CDN outage, CORS, CSP), the result will be worse than the current "raw text" behavior.

**Prevention:**
1. Always load CSS before JS: `<link rel="stylesheet" href="...katex.min.css">` must appear before `<script src="...katex.min.js">`.
2. Add a font-loading check: after KaTeX CSS loads, verify that KaTeX fonts are accessible by checking `document.fonts.check('1em KaTeX_Main')`.
3. Keep the `typeof katex === 'undefined'` fallback in `renderMath()` as a safety net for cases where JS fails to load.

**Detection:** Open DevTools Network tab and check for 404s or failed loads on `katex.min.css` and KaTeX font files (`.woff2`). Visually: if math characters appear but are overlapping or tiny, the CSS is missing.

**Phase:** Phase 1 -- must be verified alongside JS loading.

**Confidence:** HIGH -- well-documented KaTeX requirement.

---

### Pitfall 3: Regex False Positives with Dollar Sign Delimiters

**What goes wrong:** The current regex patterns in `renderMath()` match dollar signs that are not intended as math delimiters. The block pattern `/\$\$([^$]+)\$\$/g` and inline pattern `/\$([^$\n]+)\$/g` will match any text between dollar signs, including currency amounts like "$20 to $50" which would be interpreted as inline math containing "20 to ".

**Why it happens:** Dollar sign delimiters are inherently ambiguous. The regex uses a simple "match anything between $ signs" approach without context-awareness.

**This project's specific exposure:** This is a Korean-language educational app where dollar signs are unlikely to appear as currency. However, AI-generated content (from OpenAI/Claude/Gemini) may include dollar signs in unexpected contexts -- for example, cost references in economics content, or programming examples using `$` as a variable prefix. The AI credit log and aha report views both pass AI-generated text through `renderMath()`.

**Specific regex issues in the current code:**
- **Block regex `[^$]+` is non-greedy in effect but fragile:** If content contains `$$a$$ text $$b$$`, the `[^$]+` correctly matches individual blocks. But `$$a $ b$$` (dollar inside block) will break -- the `[^$]+` stops at the inner `$`, producing a malformed match.
- **Inline regex does not check word boundaries:** `$x$` in the middle of a URL like `api/$x$/endpoint` would be matched.
- **No escaped dollar sign support:** There is no way to use a literal `$` in content without triggering the regex.

**Prevention:**
1. Add lookahead/lookbehind to avoid matching currency: `/(?<!\w)\$([^$\n]+?)\$(?!\d)/g` prevents matching `$20`.
2. For block math, use a more robust pattern: `/\$\$([\s\S]+?)\$\$/g` to support multi-line block formulas (the current `[^$]+` does not match newlines in block math, which is a likely requirement for displayed equations).
3. Consider pre-processing: replace `\$` escape sequences before running the regex, then restore them after.

**Detection:** Feed test content with mixed dollar signs and math through `renderMath()` and inspect the output. Test with: `"The price is $20 and $x^2$"`, `"$$\n  f(x) = x^2\n$$"`, `"Use $HOME variable"`.

**Phase:** Phase 2 (regex hardening) after basic CDN loading is fixed.

**Confidence:** HIGH -- directly verified by reading the regex in `core/utils.js` lines 89 and 98.

---

### Pitfall 4: XSS via `renderMath()` Output Injected as innerHTML

**What goes wrong:** `renderMath()` takes a string, runs KaTeX's `renderToString()`, and returns HTML. The calling code inserts this HTML directly into the DOM via template literals (which become innerHTML). If the input text contains malicious HTML outside the `$...$` delimiters, it passes through `renderMath()` unescaped.

**Why it happens:** `renderMath()` only processes the content inside `$...$` delimiters via KaTeX. Everything outside the delimiters is returned as-is. If the input contains `<script>alert(1)</script>` outside of dollar signs, `renderMath()` does not strip it.

**This project's specific exposure:** The input to `renderMath()` comes from AI-generated content stored in the database. While AI models are unlikely to produce malicious HTML, the data flow is: AI response -> stored in D1 -> loaded by frontend -> passed to `renderMath()` -> inserted as innerHTML. If the AI response is tampered with at any point (API key compromise, DB injection), the frontend has no sanitization layer.

**Specific dangerous patterns in the current code:**
- `ai-credit-log.js` line 411: `${renderMath(q.q)}` -- AI-generated question text, inserted raw into HTML
- `ai-credit-log.js` line 522: `${renderMath((log.summary || '...').replace(/\n/g, '<br>'))}` -- the `.replace(/\n/g, '<br>')` adds HTML BEFORE `renderMath` processes it, which means `<br>` tags enter the regex matching
- `aha-report-result.js` multiple locations: `${renderMath(nl2br(r.sa))}` -- same pattern of HTML injection before math rendering

**Additionally:** KaTeX itself has known XSS vectors when `trust: true` is set (which this project does NOT use, so this specific vector is mitigated). However, KaTeX error messages can expose unescaped LaTeX source. The project uses `throwOnError: false` which mitigates error-based XSS.

**Prevention:**
1. Sanitize input BEFORE passing to `renderMath()`: escape HTML entities in the non-math portions of the text. The correct order is: escapeHtml first (on the raw text, carefully preserving `$...$` delimiters), then renderMath.
2. Alternatively, use a DOM-based approach: create a text node for non-math content and only use innerHTML for KaTeX output.
3. Never set `trust: true` in KaTeX options when rendering user/AI content.
4. The `nl2br()` / `.replace(/\n/g, '<br>')` calls should happen AFTER `renderMath()`, not before -- otherwise HTML tags interfere with the dollar sign regex.

**Detection:** Test with input: `"<img src=x onerror=alert(1)> and $x^2$"`. If the image tag is rendered, XSS is possible.

**Phase:** Phase 2 (security hardening). The current production bug (CDN not loading) actually prevents this XSS vector since `renderMath()` returns raw text when KaTeX is undefined, but once KaTeX is working, this becomes exploitable.

**Confidence:** HIGH -- verified by reading the code flow in ai-credit-log.js and aha-report-result.js.

---

## Moderate Pitfalls

### Pitfall 5: `markKeywords()` Applied After `renderMath()` Breaks KaTeX HTML

**What goes wrong:** In `ai-credit-log.js` line 590, the code calls `renderMath(markKeywords(...))`. The `markKeywords()` function wraps matched keywords in `<span class="cl-mark">` tags. If a keyword appears inside a KaTeX HTML attribute or class name, it corrupts the KaTeX output.

**Wait -- re-reading the code:** Line 590 actually calls `renderMath(markKeywords(text, kw))`. This means `markKeywords` runs FIRST (on raw text), then `renderMath` processes the result. If a keyword appears inside a `$...$` delimiter, `markKeywords` will inject `<span>` tags inside the math expression, causing KaTeX to fail to parse it.

**Example:** Text = `"에너지 $E = mc^2$ 에너지"`, keyword = `"에너지"`. After `markKeywords`: `"<span class="cl-mark">에너지</span> $E = mc^2$ <span class="cl-mark">에너지</span>"`. This is fine because the span is outside the `$` delimiters. But if keyword = `"E"`, then: `"에너지 $<span class="cl-mark">E</span> = mc^2$ 에너지"` -- KaTeX will fail to parse this.

**Prevention:**
1. Apply `markKeywords` AFTER `renderMath`, not before. But this requires `markKeywords` to be aware of KaTeX HTML output and avoid modifying it. Add a check to skip content inside KaTeX elements: avoid replacing text inside `<span class="katex">...</span>` blocks.
2. Alternatively, split text at `$...$` boundaries, apply `markKeywords` only to non-math segments, then apply `renderMath` to the full result.

**Detection:** Test with a keyword that appears both inside and outside a math expression.

**Phase:** Phase 2 (interaction between utilities).

**Confidence:** HIGH -- directly verified in the code at ai-credit-log.js line 590.

---

### Pitfall 6: KaTeX Font Size Mismatch on Android Mobile

**What goes wrong:** On Android devices and webviews, KaTeX-rendered formulas can appear smaller than surrounding text. The math font size does not match the body text size, making equations hard to read.

**Why it happens:** KaTeX uses its own font metrics system. Android's text scaling and viewport settings can cause KaTeX's font sizing to diverge from the surrounding CSS font-size. This is especially problematic on high-DPI devices.

**This project's specific exposure:** The app must work on mobile Android and iOS (per project constraints). Korean text uses `Noto Sans KR` at various sizes. KaTeX renders with its own `KaTeX_Main` font. The visual mismatch between Korean body text and Latin/math KaTeX text can be jarring, especially in inline math where the two fonts appear side by side.

**Prevention:**
1. Ensure the viewport meta tag includes `width=device-width, initial-scale=1` (already present in dev.html and index.html).
2. Test on actual Android devices, not just Chrome DevTools mobile emulation.
3. Add CSS to normalize KaTeX font size relative to surrounding text:
   ```css
   .katex { font-size: 1.1em; }  /* adjust to match surrounding text */
   ```
4. For the `.hangul_fallback` CSS class that KaTeX uses for Korean characters inside math mode, set the font-family to match the app's Korean font.

**Detection:** Render `"속도 $v = \frac{d}{t}$ 입니다"` on an Android device and compare the visual size of "v = d/t" against the Korean text.

**Phase:** Phase 3 (mobile polish).

**Confidence:** MEDIUM -- based on documented KaTeX issue #3693 and general mobile rendering knowledge. Needs device testing to confirm severity.

---

### Pitfall 7: CDN Availability and Cloudflare Pages CSP Interaction

**What goes wrong:** The KaTeX CDN (cdn.jsdelivr.net) can experience outages, slowdowns, or be blocked by network policies. If the CDN fails, the entire math rendering feature breaks with no fallback.

**Why it happens:** External CDN dependency creates a single point of failure. Additionally, if Content Security Policy headers are configured on the Cloudflare Pages deployment, they may block loading scripts/styles/fonts from cdn.jsdelivr.net.

**This project's specific exposure:** The app targets Korean high school students who may be on school networks with restrictive firewalls. School networks commonly block CDN domains or have aggressive proxy caching that can serve stale/corrupted files.

**Prevention:**
1. Add a fallback mechanism: if KaTeX CDN fails to load within a timeout, try an alternative CDN (cdnjs.cloudflare.com/ajax/libs/KaTeX/0.16.9/) or load from a self-hosted copy.
2. Better: self-host KaTeX files on Cloudflare Pages by including katex.min.js, katex.min.css, and the fonts folder in the `public/` directory. This eliminates the external dependency entirely.
3. If keeping CDN: add `crossorigin="anonymous"` to script/link tags and use Subresource Integrity (SRI) hashes.
4. Check for CSP headers in the Cloudflare Pages deployment and ensure `cdn.jsdelivr.net` is allowed.

**Detection:** Test the app on a school network or behind a restrictive proxy. Check browser console for CSP violations or network errors.

**Phase:** Phase 1 (CDN fix) -- deciding CDN vs self-host is a core architectural decision.

**Confidence:** MEDIUM -- school network blocking is a realistic but unverified risk. CDN outages are documented (jsdelivr has had incidents).

---

### Pitfall 8: Block Math Regex Does Not Support Newlines

**What goes wrong:** The current block math regex `/\$\$([^$]+)\$\$/g` uses `[^$]+` which matches any character except `$`. However, in practice, block math (display mode) formulas often span multiple lines in the source text:

```
$$
f(x) = \int_0^x g(t) \, dt
$$
```

The `[^$]+` pattern DOES match newlines (unlike `.` which does not match newlines by default in JS regex). So this specific issue is not a bug -- multi-line block math IS supported by the current regex.

**However**, there is a subtlety: if the AI generates content with `$$` on separate lines with blank lines between, the `.replace(/\n/g, '<br>')` that some callers apply BEFORE `renderMath()` will convert newlines to `<br>` tags, turning `$$\nf(x)\n$$` into `$$<br>f(x)<br>$$`. The `[^$]+` will then match `<br>f(x)<br>` and pass it to KaTeX, which will fail to parse the `<br>` tags.

**Prevention:**
1. Always call `renderMath()` BEFORE any `nl2br` / newline-to-br conversion.
2. In the regex, strip `<br>` tags from the captured formula before passing to KaTeX:
   ```javascript
   formula = formula.replace(/<br\s*\/?>/g, '\n');
   ```

**Detection:** Test with multi-line block formulas where `nl2br` has been applied first.

**Phase:** Phase 2 (regex and utility ordering fix).

**Confidence:** HIGH -- verified by reading the code pattern `renderMath(text.replace(/\n/g, '<br>'))` in ai-credit-log.js.

---

## Minor Pitfalls

### Pitfall 9: DOCTYPE Missing in Embedded Contexts

**What goes wrong:** KaTeX official docs warn that missing `<!DOCTYPE html>` triggers browser quirks mode, which causes incorrect KaTeX rendering with wrong element sizes.

**Prevention:** Verify that all HTML entry points (index.html, dev.html) have `<!DOCTYPE html>`. Both already do. No action needed.

**Confidence:** HIGH -- verified both files have DOCTYPE.

---

### Pitfall 10: KaTeX Version Pinning

**What goes wrong:** The CDN URLs reference `katex@0.16.9` specifically, which is good. However, if someone changes the URL to `katex@latest` or `katex@0.16`, a breaking change in a new version could silently break math rendering.

**Prevention:** Always pin to exact version (`@0.16.9`). Add a comment in the HTML explaining why.

**Confidence:** HIGH -- already correctly pinned in the current code.

---

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Phase 1: CDN Loading Fix | Pitfall 1 (defer timing), Pitfall 2 (CSS missing), Pitfall 7 (CDN availability) | Add KaTeX tags to production HTML with proper loading order. Consider self-hosting. Add readiness check before first render. |
| Phase 2: Regex Hardening | Pitfall 3 (false positives), Pitfall 4 (XSS), Pitfall 5 (markKeywords interaction), Pitfall 8 (nl2br ordering) | Fix utility call ordering: escapeHtml -> renderMath -> nl2br -> markKeywords. Harden regex with boundaries. |
| Phase 3: Mobile Polish | Pitfall 6 (Android font mismatch) | Test on real devices. Add CSS font-size normalization. |
| All Phases | Pitfall 4 (XSS) | Never set `trust: true`. Keep `throwOnError: false`. Sanitize non-math HTML. |

---

## Sources

- [KaTeX Browser Loading Docs](https://katex.org/docs/browser.html) -- HIGH confidence
- [KaTeX Common Issues](https://katex.org/docs/issues) -- HIGH confidence
- [KaTeX Security Docs](https://katex.org/docs/security) -- HIGH confidence
- [KaTeX Options (trust)](https://katex.org/docs/options.html) -- HIGH confidence
- [KaTeX/KaTeX Issue #1578: Defer loading recommendation](https://github.com/KaTeX/KaTeX/issues/1578) -- HIGH confidence
- [KaTeX/KaTeX Discussion #3693: Android font size mismatch](https://github.com/KaTeX/KaTeX/discussions/3693) -- MEDIUM confidence
- [KaTeX/KaTeX Issue #1829: Android webview rendering](https://github.com/KaTeX/KaTeX/issues/1829) -- MEDIUM confidence
- [GHSA-cg87-wmx4-v546: htmlData XSS advisory](https://github.com/KaTeX/KaTeX/security/advisories/GHSA-cg87-wmx4-v546) -- HIGH confidence
- [Snyk: markdown-it-katex XSS](https://security.snyk.io/vuln/SNYK-JS-MARKDOWNITKATEX-597160) -- MEDIUM confidence (different package, but same pattern)
- [KaTeX/KaTeX Issue #437: Dollar sign escape in auto-render](https://github.com/KaTeX/KaTeX/issues/437) -- HIGH confidence
- Project source: `core/utils.js` renderMath() at lines 84-107 -- directly verified
- Project source: `ai-credit-log.js` renderMath usage patterns -- directly verified
- Project source: `aha-report-result.js` renderMath usage patterns -- directly verified
