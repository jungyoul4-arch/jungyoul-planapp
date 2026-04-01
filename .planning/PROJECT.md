# 고교학점제 맞춤형 학생 플래너 — 수식 렌더링 수정

## What This Is

고교학점제 학생을 위한 맞춤형 학습 플래너 앱. 수업 탐구 기록, 세특 질문, 퀴즈, 성장 분석 등을 AI로 분석하고 기록하는 웹앱(Cloudflare Pages + Hono + Vanilla JS SPA). 현재 물리/수학 등 과목에서 LaTeX 수식이 렌더링되지 않고 raw 텍스트로 노출되는 문제를 해결해야 한다.

## Core Value

학생이 작성한 수업 기록에서 수식과 기호가 교과서처럼 깔끔하게 렌더링되어, 과학/수학 과목의 탐구 기록이 전문적이고 가독성 높게 표시되는 것.

## Requirements

### Validated

- ✓ KaTeX 라이브러리가 프로덕션 환경에서 정상 로드됨 — Validated in Phase 1: CDN Loading Fix

### Active

- [ ] 앱 전체에서 `$...$` (인라인) 및 `$$...$$` (블록) LaTeX 수식이 KaTeX로 렌더링됨
- [ ] 수업 탐구 기록 페이지의 핵심 키워드, 세특 질문, 퀴즈, 요약 등 모든 영역에서 수식이 정상 표시됨
- [ ] 앱의 다른 페이지(질문, 성장 등)에서도 수식이 포함된 콘텐츠가 정상 렌더링됨

### Out of Scope

- 새로운 기능 추가 — 이번 마일스톤은 수식 렌더링 수정에만 집중
- MathJax 도입 — 이미 KaTeX가 통합되어 있으므로 KaTeX 활용
- 수식 편집기 UI — 사용자가 직접 수식을 입력하는 기능은 범위 밖

## Context

- KaTeX v0.16.9이 이미 코드에 통합되어 있음 (`renderMath()` 함수가 `core/utils.js`에 구현됨)
- `dev.html`에는 KaTeX CDN이 로드되지만 `index.html`(프로덕션)에는 누락됨
- `renderMath()`는 `katex`가 undefined이면 원본 텍스트를 반환하도록 설계됨
- 여러 뷰(ai-credit-log.js, aha-report-result.js 등)에서 이미 `renderMath()` 호출 중
- 기술 스택: Hono + Vite + Cloudflare Pages, Vanilla JS SPA, TailwindCSS

## Constraints

- **Tech Stack**: Cloudflare Pages + Hono, Vanilla JS (React/Vue 없음)
- **라이브러리**: KaTeX v0.16.9 사용 (이미 통합됨)
- **호환성**: 모바일(Android/iOS) 및 태블릿에서 정상 작동해야 함

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| KaTeX 사용 (MathJax 대신) | 이미 코드에 통합되어 있고, 렌더링 속도가 빠름 | — Pending |
| CDN 로드 방식 유지 | 번들 크기 최소화, 기존 패턴 유지 | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-03-29 after Phase 1 completion*
