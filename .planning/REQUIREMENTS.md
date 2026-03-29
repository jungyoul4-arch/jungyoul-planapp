# Requirements: 고교학점제 플래너 — 수식 렌더링 수정

**Defined:** 2026-03-29
**Core Value:** 수식과 기호가 교과서처럼 깔끔하게 렌더링되어 과학/수학 탐구 기록이 전문적으로 표시되는 것

## v1 Requirements

Requirements for math rendering fix. Each maps to roadmap phases.

### CDN Loading

- [ ] **CDN-01**: 프로덕션 `index.html`에 KaTeX CSS 및 JS CDN 태그가 포함되어 앱 로드 시 KaTeX 라이브러리가 정상 로드됨
- [ ] **CDN-02**: KaTeX 버전이 v0.16.44 (최신)으로 업그레이드됨
- [ ] **CDN-03**: CDN 로드 실패 시 콘솔 경고가 출력되고, 수식이 raw 텍스트로 표시되더라도 앱이 정상 동작함

### Security & Call Order

- [x] **SEC-01**: `renderMath()` 호출이 `nl2br`, `markKeywords` 변환보다 먼저 실행되어 HTML 태그가 LaTeX 파싱을 깨뜨리지 않음
- [x] **SEC-02**: KaTeX 옵션에 `strict: false`가 설정되어 비표준 LaTeX 명령어에도 렌더링이 시도됨
- [x] **SEC-03**: 달러 기호 regex에 경계 체크가 추가되어 `$20`과 같은 비수식 텍스트가 수식으로 오인되지 않음

### Coverage

- [x] **COV-01**: 앱 전체에서 AI 생성 텍스트를 표시하는 모든 뷰에서 `renderMath()`가 호출됨 (ai-credit-log, aha-report, class-detail, class-history 등)
- [x] **COV-02**: 모바일/태블릿에서 긴 수식이 화면을 넘지 않고, 가로 스크롤 또는 줄바꿈으로 처리됨
- [x] **COV-03**: 렌더링된 수식을 선택/복사하면 LaTeX 소스 텍스트가 클립보드에 복사됨

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Enhanced Rendering

- **ENH-01**: KaTeX를 Cloudflare Pages에 셀프 호스팅하여 CDN 의존성 제거
- **ENH-02**: HTML 새니타이징 레이어 추가 (DOMPurify 등)
- **ENH-03**: 수식 편집기 UI (사용자가 직접 LaTeX 입력)

## Out of Scope

| Feature | Reason |
|---------|--------|
| MathJax 도입 | KaTeX가 이미 통합되어 있고 더 빠름 |
| 수식 편집기 UI | 현재 수식은 AI가 생성하므로 사용자 입력 불필요 |
| 스크린리더 접근성 | 주 사용자가 시력 정상인 학생이므로 v1에서 불필요 |
| 수식 자동 감지 (auto-render) | SPA 구조와 맞지 않고 한국어 텍스트에서 오탐 위험 |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CDN-01 | Phase 1 | Pending |
| CDN-02 | Phase 1 | Pending |
| CDN-03 | Phase 1 | Pending |
| SEC-01 | Phase 2 | Complete |
| SEC-02 | Phase 2 | Complete |
| SEC-03 | Phase 2 | Complete |
| COV-01 | Phase 3 | Complete |
| COV-02 | Phase 3 | Complete |
| COV-03 | Phase 3 | Complete |

**Coverage:**
- v1 requirements: 9 total
- Mapped to phases: 9
- Unmapped: 0 ✓

---
*Requirements defined: 2026-03-29*
*Last updated: 2026-03-29 after initial definition*
