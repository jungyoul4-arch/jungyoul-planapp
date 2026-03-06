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
- [2026-03-05] ALTER TABLE 마이그레이션 후 SELECT * 확인: 컬럼 추가(parent_id 등) 후 `SELECT *`는 자동 포함되지만, 명시적 SELECT 필드 목록을 쓰는 쿼리가 있으면 새 컬럼 누락됨. 마이그레이션 후 관련 SELECT 쿼리 전수 점검
- [2026-03-06] 새 컬럼 추가 후 INSERT/SELECT 동기화 + 마이그레이션 실행 필수: `photo_count` 컬럼을 INSERT에 추가했지만, 로컬 D1에 마이그레이션(`/api/migrate`)을 실행하지 않아 INSERT 자체가 실패. 새 컬럼 추가 시 반드시: ① ALTER TABLE 마이그레이션 코드 추가 → ② INSERT/SELECT 쿼리에 새 컬럼 반영 → ③ `/api/migrate` 호출하여 로컬 DB 스키마 적용 → ④ 동작 확인. 이 순서를 건너뛰면 저장 자체가 실패함
- [2026-03-06] base64 사진을 메인 테이블에 저장하면 안됨: `class_records.photos`에 7장의 base64 사진(각 500KB~1MB)을 JSON으로 저장하면 단일 행이 수 MB. `loadClassRecords`로 200건 조회 시 응답이 거대해져 silent failure. 사진은 반드시 별도 테이블(class_record_photos) + R2에 저장하고, 메인 테이블에는 `ref:ID` 참조만 저장할 것


### API 관련
<!-- 실수 발생 시 아래에 추가 -->
- [2026-03-04] SELECT 필드 누락: `class_records` INSERT에 `photos, ai_credit_log, photo_tags`를 저장하지만 GET SELECT에서 해당 필드 누락 → 프론트에서 항상 빈 값. INSERT와 SELECT 필드 목록을 반드시 동기화할 것
- [2026-03-04] 프론트-백엔드 필드명 불일치: 프론트엔드 `imageData`(base64) → 백엔드 DB 컬럼 `image_key`. api.js에서 반드시 매핑 `payload.imageKey = payload.imageData; delete payload.imageData;` 처리. 필드명 불일치는 데이터가 사라지는 원인
- [2026-03-04] 응답 필드 체이닝: 백엔드가 `{ questionId: N }` 반환 시 api.js에서 `d.data?.id || d.questionId || d.id`처럼 가능한 모든 형태를 체인으로 처리할 것. 엔드포인트마다 응답 구조가 미묘하게 다를 수 있음
- [2026-03-04] async 이벤트 핸들러: 필터 변경 → API 호출 → 렌더 순서에서, 핸들러가 sync면 API 응답 전에 render()가 실행되어 빈 화면 표시. `setMyQuestionFilter`처럼 `async/await`로 데이터 로딩 완료 후 렌더해야 함
- [2026-03-04] subject vs source 분리: `my_questions` 테이블에서 `subject`는 과목(국어/영어 등), `source`는 출처(수업/독서 등)로 분리. 기존 데이터는 `subject`에 출처가 들어있을 수 있으므로 `_getSubjectCategory()` 매핑 필수
- [2026-03-04] 카테고리 필터링: 세부 과목명(물리학Ⅰ 등)을 대분류(과학)로 매핑 필요 시 클라이언트 사이드 `_getSubjectCategory()` 사용. 백엔드 `?subject=` 파라미터로는 정확 매칭만 가능


### 프론트엔드 관련
<!-- 실수 발생 시 아래에 추가 -->
- [2026-03-05] 모듈 init 시 파생 상태 빌드 누락: `state.timetable`을 저장했지만 `state.todayRecords`를 빌드하지 않아 "오늘은 수업이 없습니다" 표시. config 데이터를 state에 넣을 때, 그 데이터에서 파생되는 상태(todayRecords 등)도 반드시 init 시점에 빌드해야 함
- [2026-03-05] class-record-edit vs class-record-detail 상태 키 차이: `class-record-detail`은 `state._viewingDbRecord` (DB id) 사용, `class-record-edit`는 `state._editingClassRecordIdx` (todayRecords 인덱스) + `todayRecords[idx]._dbRecordId` 사용. 수정 화면으로 이동 시 반드시 todayRecords에 DB 데이터를 로드하고 `_editingClassRecordIdx`를 설정해야 함
- [2026-03-03] 프로젝트 경로: `/jungyoul/` ≠ `/jungyoul-planapp/` → 작업 전 반드시 `jungyoul-planapp` 경로인지 확인. 비슷한 이름의 다른 폴더에서 작업하면 시간 낭비
- [2026-03-03] 모듈 분리 시 CSS 스코핑: 독립 모듈 CSS는 반드시 `.records-module` 같은 래퍼 클래스로 스코핑. `@keyframes`도 접두사(`rm-`) 부여하여 호스트 앱과 충돌 방지
- [2026-03-03] 인라인 onclick 네임스페이스: 독립 모듈의 인라인 핸들러는 `_RM.xxx()` 같은 전용 네임스페이스 사용. 글로벌 함수명(`saveClassRecordFromForm` 등)과 충돌 방지
- [2026-03-03] ES Module import 경로: 상대경로에 `.js` 확장자 반드시 포함 (브라우저 ES Module은 확장자 생략 불가)
- [2026-03-04] 중첩 템플릿 리터럴: `renderDashboard()` 같은 함수 안에서 IIFE로 동적 섹션을 만들 때, 내부 `.map()` 콜백의 템플릿 리터럴이 3단 이상 중첩되면 `\`` 이스케이프 오류 발생. 대신 별도 함수(`_renderUpcomingExams()` 등)로 추출하여 1단 중첩으로 유지할 것
- [2026-03-04] 동적 state 프로퍼티: `state._examAddMode` 등 `_initialState`에 없는 프로퍼티도 Proxy 덕분에 동작하지만, 명시적으로 초기값을 정의해두는 것이 디버깅에 유리. 시험 추가 화면의 임시 상태(`_eaMidtermType`, `_eaPeriodPicker*` 등)는 현재 동적 프로퍼티로 처리 중
- [2026-03-04] assignment-list.js 다중 export: 하나의 뷰 파일에서 `renderAssignmentPlan` + `renderAssignmentList` 2개 렌더러를 export하여 SCREEN_MAP에 `assignment-plan`과 `assignment-list` 2개 화면 등록. records.js import 시 `{ renderAssignmentPlan, renderAssignmentList }` 구조분해 필요
- [2026-03-04] ai-credit-log.js 다중 렌더러 export: `renderAiLoading` + `renderAiResult` 2개 렌더러를 export하여 SCREEN_MAP에 `ai-loading`과 `ai-result` 2개 화면 등록. assignment-list.js와 동일 패턴
- [2026-03-04] `_classPhotos`와 `_classPhotoTags` 동기화: 사진 추가/삭제 시 두 배열을 반드시 동시에 조작해야 함. `_classPhotos.push()` 시 `_classPhotoTags.push('note')`, `splice(idx,1)` 시 양쪽 모두 실행. class-record.js, class-edit.js, photo-upload-v2.js 모두 해당
- [2026-03-04] DB record의 `ai_credit_log` 타입 주의: DB에서 TEXT로 저장되어 로드 시 string일 수 있고, api.js의 `loadClassRecords`에서 `tryParseJSON`으로 파싱 후 object가 됨. 그러나 뷰에서 안전하게 `typeof === 'string'` 체크 + `tryParseJSON` 폴백 권장
- [2026-03-06] Gemini 모델 버전 주의: OCR 전담 모델은 `gemini-3.1-flash` 사용. 기존 `callGeminiWithFallback`은 `gemini-2.0-flash`, `callGeminiMultiImage` 및 아하 리포트(analyze-v2, feedback)는 `gemini-3.1-flash` 사용. `gemini-2.5-flash`는 더 이상 사용하지 않음
- [2026-03-04] AI 응답 필드 다형성: `assignment` 필드가 string/object/null 3가지 타입으로 올 수 있음. 백엔드에서 정규화하되, 프론트엔드에서도 `typeof` 분기 필수. `getAssignmentDisplayText()` 같은 공유 헬퍼로 통일 처리 권장
- [2026-03-04] 공유 로직 추출 시 import 정리: 인라인 로직을 유틸로 추출하면 기존 파일의 import가 불필요해짐. 추출 후 반드시 소비 파일의 미사용 import 확인 및 제거
- [2026-03-04] AI 프롬프트에서 날짜 기반 계산 지시: AI에게 상대 날짜("다음 주 월요일")를 YYYY-MM-DD로 변환하라고 지시할 때, 반드시 fullPrompt에 오늘 날짜를 함께 전달해야 함. 현재 `날짜: ${date}` 형태로 이미 포함됨
- [2026-03-04] 인라인 onclick에서 모듈 스코프 변수 접근 불가: `state._viewingDbRecord=...`처럼 모듈 내부 변수를 직접 참조하면 글로벌 스코프에서 undefined. 반드시 `_RM.state._viewingDbRecord=...`로 네임스페이스 경유 접근할 것
- [2026-03-05] 인라인 onclick에 문자열 전달 시 XSS/파싱 위험: `onclick="_RM.fn(${JSON.stringify(content)})"` 패턴은 content에 `"` 등이 포함되면 HTML attribute가 깨짐. 대신 `data-content="${htmlEncode(content)}"` + `this.dataset.content`로 안전하게 전달할 것
- [2026-03-05] 변수 중복 선언: 함수 앞부분에 검증 로직을 추가할 때, 아래쪽에 동일 이름의 `const` 변수가 있으면 SyntaxError 발생. 추가 전 함수 전체에서 같은 변수명이 있는지 확인할 것 (예: `const photo` 중복)
- [2026-03-05] 렌더 함수 내 조건 분기 누락: `_renderChain`에서 자식이 0개면 바로 카드만 반환하면서 체인 입력 폼을 렌더링하지 않는 버그. 상태(`_chainInputParentId`)에 따라 입력 폼이 필요한 경우를 조건에 포함해야 함
- [2026-03-06] saveCreditLog 후 todayRecords에 _dbRecordId 미설정: `record.done = true`만 하고 `record._dbRecordId`를 설정하지 않으면, 이후 `_getDbRecordForPeriod()`가 DB에서 레코드를 못 찾을 때 `{ _virtual: true }` 반환 → 기록완료인데 빈 photo-upload로 이동하는 버그. 저장 후 반드시 `record._dbRecordId = recordId` 설정
- [2026-03-06] _rebuildRecordsForDate()와 _buildTodayRecords() 로직 동기화: period-select.js의 `_rebuildRecordsForDate()`는 날짜별 시간표를 재구축하는데, records.js의 `_buildTodayRecords()`와 달리 DB 레코드를 확인하지 않아 항상 `done: false`. 같은 역할의 함수가 두 곳에 있으면 반드시 동일한 DB 조회 로직을 포함해야 함
- [2026-03-06] 사진 저장 형식 변경 시 소비 뷰 전수 점검: `class_records.photos`를 base64 → `ref:ID` 참조로 변경했을 때, 사진을 직접 `<img src>`로 쓰는 모든 뷰(photo-album.js, class-detail.js, class-history.js)를 반드시 업데이트. `ref:ID`는 유효한 URL이 아니므로 깨진 이미지 표시됨. 데이터 형식 변경 시 해당 필드를 읽는 모든 파일을 Grep으로 찾아 전수 수정할 것

### 개발 서버 관련
<!-- 실수 발생 시 아래에 추가 -->
- [2026-03-05] 개발 서버 실행: `wrangler pages dev public`이 아니라 `npm run dev` (Vite)가 올바른 로컬 개발 서버. Vite가 src/index.tsx를 Functions로 처리함. `wrangler pages dev public`은 Functions shimming 없이 정적 파일만 서빙하므로 API 404 발생
- [2026-03-05] 기록 모듈 테스트: 메인 앱(`/`)이 아니라 `/modules/records/dev.html`에서 기록 모듈 독립 테스트. 로그인 없이 바로 모듈 확인 가능. 경로를 `/dev.html`로 착각하지 말 것
- [2026-03-06] Gemini 모델명 혼동 주의:
  정확한 모델명: gemini-3.0-flash
  잘못된 모델명: gemini-3.1-flash, gemini-3.2-flash, gemini-2.5-flash
  → 3.0 이외 버전은 404 오류 발생. 절대 임의로 버전 변경 금지.
### 배포/설정 관련
<!-- 실수 발생 시 아래에 추가 -->
- [2026-03-04] `.dev.vars` 키 범위: 로컬 개발 시 `.dev.vars`에 필요한 API 키가 모두 있는지 확인. `callGeminiMultiImage`는 `GEMINI_API_KEY` + `OPENAI_API_KEY` 둘 다 필요 (Gemini 실패 시 OpenAI 폴백). 프로덕션은 `wrangler pages secret put`으로 별도 설정
- [2026-03-04] git merge 충돌 해결: `src/index.tsx`와 `public/static/app.js`에서 충돌 발생 시, main의 에러 메시지/UI 문구는 main 채택, feature 브랜치의 신규 API/기능은 feature 채택. stash → merge → stash pop 순서로 안전하게 진행


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

*마지막 업데이트: 2026-03-04*
*이 파일은 프로젝트와 함께 계속 성장합니다.*
