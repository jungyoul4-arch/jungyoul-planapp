# Roadmap: KaTeX Math Rendering Fix

## Overview

Fix broken math rendering in the HS CreditPlanner production app. KaTeX is already integrated but fails to load in production, leaving LaTeX formulas as raw text. Three phases in strict dependency order: get KaTeX loading, harden security and call ordering, then expand coverage to all views.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: CDN Loading Fix** - Get KaTeX loading and rendering in production builds
- [ ] **Phase 2: Security & Call Order** - Fix utility call ordering and regex to prevent XSS and false positives
- [ ] **Phase 3: Coverage & Mobile Polish** - Expand renderMath() to all AI-generated content views and fix mobile overflow

## Phase Details

### Phase 1: CDN Loading Fix
**Goal**: Students see math formulas rendered correctly in the 2 existing call sites on the production app
**Depends on**: Nothing (first phase)
**Requirements**: CDN-01, CDN-02, CDN-03
**Success Criteria** (what must be TRUE):
  1. Opening the production app shows KaTeX CSS and JS loaded in browser DevTools Network tab (no 404s, no missing resources)
  2. Navigating to ai-credit-log or aha-report-result views renders inline `$...$` and block `$$...$$` math as formatted equations, not raw text
  3. If CDN fails to load (simulated by blocking jsdelivr), the app still functions normally with math shown as plain text and a console warning logged
**Plans:** 1 plan

Plans:
- [ ] 01-01-PLAN.md — Upgrade KaTeX CDN to v0.16.44, add onerror handlers, add renderMath() fallback warning, verify build

### Phase 2: Security & Call Order
**Goal**: Math rendering is secure and correct -- no XSS vectors from call ordering, no false positives on dollar amounts
**Depends on**: Phase 1
**Requirements**: SEC-01, SEC-02, SEC-03
**Success Criteria** (what must be TRUE):
  1. In views that call renderMath(), the processing order is escapeHtml -> renderMath -> nl2br -> markKeywords, verified by code inspection and testing with adversarial input like `<img src=x onerror=alert(1)>`
  2. Text containing `$20` or `$50 to $100` does NOT trigger math rendering -- only proper LaTeX delimiters are matched
  3. AI-generated text with non-standard LaTeX commands (e.g., `\ce{}`, `\cancel{}`) renders with best-effort output instead of throwing errors
**Plans**: TBD

### Phase 3: Coverage & Mobile Polish
**Goal**: Every view displaying AI-generated text renders math, and long equations display correctly on mobile devices
**Depends on**: Phase 2
**Requirements**: COV-01, COV-02, COV-03
**Success Criteria** (what must be TRUE):
  1. Navigating to class-detail, class-history, and any other views that display AI-generated text shows math rendered (not raw LaTeX)
  2. A long physics equation like `$$\sum_{n=1}^{\infty} \frac{1}{n^2} = \frac{\pi^2}{6}$$` on a mobile screen does not cause horizontal page scroll -- it either wraps or shows a contained scrollbar within the math block
  3. Selecting and copying a rendered equation puts the LaTeX source text in the clipboard
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 -> 2 -> 3

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. CDN Loading Fix | 0/1 | Not started | - |
| 2. Security & Call Order | 0/0 | Not started | - |
| 3. Coverage & Mobile Polish | 0/0 | Not started | - |
