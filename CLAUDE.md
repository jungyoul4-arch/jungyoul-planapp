# CLAUDE.md — 고교학점플래너 (HS CreditPlanner)

> 이 파일은 Claude Code가 프로젝트를 이해하고 작업하기 위한 **상시 가이드**입니다.
> 실수가 발생할 때마다 [실수 노트] 섹션을 업데이트하여 같은 실수를 반복하지 않습니다.

---

## 1. 프로젝트 개요

- **이름**: 고교학점플래너 (HS CreditPlanner)
- **목적**: 고교학점제 시대, 학교생활의 모든 순간을 날짜별로 기록하고 생기부 경쟁력으로 전환
- **대상**: ~150명 학생, ~10명 멘토, 다중 반 지원
- **운영**: 정율사관학원 (부천-인천 지역 42개 고등학교 대상)
- **핵심 철학**: 교학상장(敎學相長) — 학생이 서로 가르치며 함께 성장
- **Production**: https://credit-planner-v8.pages.dev

---

## 2. 기술 스택 (절대 변경 금지)

| 영역 | 기술 | 주의사항 |
|------|------|---------|
| 백엔드 | **Hono + TypeScript** | Cloudflare Workers 런타임 |
| DB | **Cloudflare D1 (SQLite)** | MySQL/PostgreSQL 문법 사용 금지 |
| 프론트엔드 | **Vanilla JS + TailwindCSS (CDN)** | React/Vue 아님! CDN이라 커스텀 클래스 불가 |
| 배포 | **Cloudflare Pages** | `wrangler` 사용 |
| AI | OpenAI, Claude, Gemini, Perplexity | 각 기능별 다른 모델 사용 |

---

## 3. 폴더 구조

```
credit-planner-v8/
├── src/
│   ├── index.ts          # Hono 라우터 (모든 API 엔드포인트)
│   ├── migrate.ts        # D1 마이그레이션 (14개 테이블)
│   └── ...
├── public/
│   ├── index.html        # 메인 SPA (단일 HTML)
│   ├── app.js            # 프론트엔드 핵심 로직
│   ├── styles.css        # 커스텀 스타일
│   ├── manifest.json     # PWA 매니페스트
│   └── sw.js             # 서비스워커
├── wrangler.toml         # Cloudflare 설정
└── CLAUDE.md             # ← 이 파일
```

---

## 4. DB 스키마 (14개 테이블)

```
mentors, groups, students,
exams, exam_results, wrong_answers, wrong_answer_images,
assignments, class_records, question_records, teach_records,
activity_records, activity_logs, report_records
```

### D1 SQLite 핵심 규칙
- `AUTO_INCREMENT` 금지 → `INTEGER PRIMARY KEY AUTOINCREMENT` 사용
- `NOW()` 금지 → `datetime('now')` 사용
- `BOOLEAN` 타입 없음 → `INTEGER` (0/1) 사용
- `MODIFY COLUMN` 금지 → 테이블 재생성 필요
- 바인딩은 `?` 사용 (named parameter `:name` 도 가능하지만 `?` 통일)
- JSON 함수: `json_extract()`, `json_array()` 사용 가능
- `ILIKE` 금지 → `LIKE` 사용 (SQLite는 기본 대소문자 무시)
- `RETURNING *` 지원됨 (D1은 SQLite 3.35+ 기반)

---

## 5. API 엔드포인트 규칙

### 경로 패턴
```
인증:     /api/auth/mentor/...  |  /api/auth/student/...
학생:     /api/student/:id/...
멘토:     /api/mentor/:id/...  |  /api/mentor/student/:id/...
관리자:   /api/admin/...
AI:       /api/analyze  |  /api/coaching  |  /api/deep-analyze  등
```

### 응답 형식 (통일 — 절대 변경 금지)
```typescript
// 성공
return c.json({ success: true, data: { ... } });

// 실패
return c.json({ success: false, error: "메시지" }, 400);
```

### 날짜 처리
- 프론트엔드 → 백엔드: `YYYY-MM-DD` 형식
- DB 저장: `created_at`은 `datetime('now')` 자동, `date` 필드는 명시적
- 조회 필터: `?from=YYYY-MM-DD&to=YYYY-MM-DD`

---

## 6. 프론트엔드 규칙

### TailwindCSS CDN 제약
- ✅ `class="bg-blue-500 text-white p-4 rounded-lg"` (기본 유틸리티)
- ❌ `@apply`, `tailwind.config.js` 커스텀 확장 불가
- ❌ JIT 모드 없음 → `bg-[#1a2b3c]` 같은 임의값(arbitrary values) 불가
- 커스텀 스타일이 필요하면 `styles.css`에 직접 작성

### UI/UX 원칙
- 글래스모피즘 디자인 시스템 적용 중
- 패드(iPad) 가로/세로 반응형 필수 지원
- PWA: 서비스워커, manifest, 오프라인 캐싱 고려
- 모든 데이터 저장은 DB API 우선, localStorage는 시간표 등 임시 데이터만

### 주요 프론트엔드 → DB 연결 패턴
```javascript
// 모든 save 함수는 반드시 DB API를 호출해야 함
saveClassRecordFromForm()  → DB.saveClassRecord()
saveQuestionToDB()         → DB.saveQuestionRecord()
saveTeachRecordFromForm()  → DB.saveTeachRecord()
saveAssignment()           → DB.saveAssignment()
saveNewExam()              → DB.saveExam()
saveExamResult()           → DB.saveExamResult()
saveNewActivity()          → DB.saveActivityRecord()
saveActivityLog()          → DB.updateActivityRecord() + DB.saveActivityLog()
```

---

## 7. 작업 프로토콜 (보리스 5원칙)

### 🔵 팁1 — 새 작업 시작 전: 계획 먼저
1. 이 CLAUDE.md를 반드시 먼저 읽는다
2. 관련 소스 파일을 분석한다 (코드 수정 전!)
3. **작업 계획을 먼저 작성**하고 사용자 확인을 받는다
4. 승인 후 코드 작업 시작

### 🟢 팁2 — 작업 완료 후: 자기 검증
1. 변경한 API → 직접 호출 테스트 시뮬레이션
2. 프론트엔드 변경 → 주요 사용자 흐름 점검
3. D1 쿼리 변경 → SQLite 문법 재확인
4. TypeScript 컴파일 에러 확인
5. 기존 기능이 깨지지 않았는지 확인

### 📝 팁3 — 실수 발생 시: 실수 노트 업데이트
- 실수를 고친 후 반드시 [섹션 8: 실수 노트]에 기록
- "같은 실수 두 번 하지 않기"가 목표

### ⚡ 팁4 — 효율적 작업
- 한 번에 정확하게 끝내기 (여러 번 수정보다 나음)
- 관련 없는 파일 건드리지 않기
- 변경 범위를 최소화하여 사이드이펙트 방지

### 🟡 팁5 — 세션 종료 시: 문맥 저장
1. 작업 요약 파일 생성 (`SESSION_SUMMARY_YYYYMMDD.md`)
2. 포함 내용: 완료 사항, 미완료 사항, 다음 할 일, 주의점
3. 다음 세션에서 해당 파일 + 이 CLAUDE.md 함께 제공

---

## 8. 실수 노트 📝

> **규칙**: 실수가 발생하면 여기에 추가. 절대 같은 실수를 반복하지 않는다.
> **형식**: `[날짜] 카테고리: 실수 내용 → 올바른 방법`

### D1/SQLite 관련
<!-- 실수 발생 시 아래에 추가 -->


### API 관련
<!-- 실수 발생 시 아래에 추가 -->


### 프론트엔드 관련
<!-- 실수 발생 시 아래에 추가 -->
- [2026-03-03] 프로젝트 경로: `/jungyoul/` ≠ `/jungyoul-planapp/` → 작업 전 반드시 `jungyoul-planapp` 경로인지 확인. 비슷한 이름의 다른 폴더에서 작업하면 시간 낭비
- [2026-03-03] 모듈 분리 시 CSS 스코핑: 독립 모듈 CSS는 반드시 `.records-module` 같은 래퍼 클래스로 스코핑. `@keyframes`도 접두사(`rm-`) 부여하여 호스트 앱과 충돌 방지
- [2026-03-03] 인라인 onclick 네임스페이스: 독립 모듈의 인라인 핸들러는 `_RM.xxx()` 같은 전용 네임스페이스 사용. 글로벌 함수명(`saveClassRecordFromForm` 등)과 충돌 방지
- [2026-03-03] ES Module import 경로: 상대경로에 `.js` 확장자 반드시 포함 (브라우저 ES Module은 확장자 생략 불가)
- [2026-03-04] 중첩 템플릿 리터럴: `renderDashboard()` 같은 함수 안에서 IIFE로 동적 섹션을 만들 때, 내부 `.map()` 콜백의 템플릿 리터럴이 3단 이상 중첩되면 `\`` 이스케이프 오류 발생. 대신 별도 함수(`_renderUpcomingExams()` 등)로 추출하여 1단 중첩으로 유지할 것
- [2026-03-04] 동적 state 프로퍼티: `state._examAddMode` 등 `_initialState`에 없는 프로퍼티도 Proxy 덕분에 동작하지만, 명시적으로 초기값을 정의해두는 것이 디버깅에 유리. 시험 추가 화면의 임시 상태(`_eaMidtermType`, `_eaPeriodPicker*` 등)는 현재 동적 프로퍼티로 처리 중
- [2026-03-04] assignment-list.js 다중 export: 하나의 뷰 파일에서 `renderAssignmentPlan` + `renderAssignmentList` 2개 렌더러를 export하여 SCREEN_MAP에 `assignment-plan`과 `assignment-list` 2개 화면 등록. records.js import 시 `{ renderAssignmentPlan, renderAssignmentList }` 구조분해 필요

### 배포/설정 관련
<!-- 실수 발생 시 아래에 추가 -->


---

## 9. 테스트 계정

| 역할 | 정보 |
|------|------|
| 멘토 로그인 | ID: `jycc_admin` / PW: `jycc2026` |
| 초대코드 | `JYCC-X2Z8-2ND7` |
| 학생 로그인 | 이름: `곽정율` / PW: `1234` |

---

## 10. 향후 과제 (우선순위)

1. ⬜ 시간표 데이터 DB 연동 (현재 localStorage만 사용)
2. ⬜ 멘토 대시보드 실시간 데이터 연동
3. ⬜ 학생 프로필 이미지 업로드 (R2 연동)
4. ⬜ 오프라인 모드 강화 (Service Worker 캐싱)
5. ⬜ 알림 푸시 (Web Push API)

---

## 11. 절대 하지 말 것 ⛔

1. 기술 스택 변경 제안 (React 전환 등)
2. D1에 MySQL/PostgreSQL 문법 사용
3. localStorage를 주 저장소로 사용 (DB 우선!)
4. TailwindCSS CDN에서 지원하지 않는 기능 사용 (arbitrary values 등)
5. API 응답 형식 변경 (`{ success, data/error }` 패턴 유지)
6. 기존 API 경로 임의 변경 (프론트엔드 연결 깨짐)
7. 테스트/검증 없이 작업 완료 선언
8. 이 CLAUDE.md를 읽지 않고 작업 시작

---

*마지막 업데이트: 2026-03-03*
*이 파일은 프로젝트와 함께 계속 성장합니다.*
