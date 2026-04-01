# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

# 고교학점플래너 (HS CreditPlanner)

## 공통 명령어 (Common Commands)

```bash
# 개발 서버 실행 (Vite + Hono)
npm run dev

# 프로덕션 빌드
npm run build

# 배포 (반드시 이 명령어 사용! wrangler pages deploy 직접 실행 금지)
npm run deploy

# 로컬 프리뷰
npm run preview

# Cloudflare bindings 타입 생성
npm run cf-typegen

# 기록 모듈 독립 테스트 (로그인 불필요)
# 브라우저에서 http://localhost:5173/modules/records/dev.html 접속
```

---

## 🧠 Claude Code 운영 원칙 (Boris 방식 기반)

### 1. 코딩 전 반드시 계획 먼저
- 구현 시작 전 Plan 모드로 전체 구조와 접근 방식을 설계한다.
- 계획이 완성되면 별도 Claude 인스턴스가 시니어 개발자 관점에서 해당 계획을 비판적으로 검토한다.
- "일단 만들어" 지시는 금지. 반드시 계획 → 검토 → 구현 순서를 지킨다.

### 2. 작업 완료 후 자기 검증 필수
- 코드 작성 후 반드시 직접 실행하여 결과를 확인한다.
- UI가 포함된 경우 브라우저를 열어 화면 렌더링을 눈으로 검증한다.
- 검증 단계 없이 "완료"를 선언하지 않는다.

### 3. 실수는 이 파일에 즉시 기록
- 같은 실수를 두 번 하지 않는다.
- 실수 발생 시 수정에 그치지 않고, CLAUDE.md의 [실수 노트] 섹션을 업데이트한다.
- 패턴이 반복되는 실수는 별도 규칙으로 격상하여 명문화한다.

### 4. 항상 가장 높은 모델을 사용
- 속도보다 정확도 우선. 느리더라도 최고 모델을 선택한다.
- 수정 반복 비용 > 최고 모델 사용 비용임을 항상 인식한다.

### 5. 멀티 인스턴스 병렬 운영
- 독립적인 작업은 별도 창에서 동시에 진행한다.
- 작업 완료 시 Hook(알림)을 설정하여 흐름 단절 없이 결과를 수신한다.

### 6. 세션 전환 전 반드시 요약 저장
- 컨텍스트 한계에 도달하기 전, 또는 주요 작업 완료 시점에 진행 내용을 요약하여 파일로 저장한다.
- 다음 세션 시작 시 해당 요약 파일을 첨부하여 맥락을 복원한다.
- 저장 파일명 규칙: `SESSION_SUMMARY_YYYYMMDD.md`

### 7. 도메인별 책임 분리
- 결제, 인증, API, UI 등 기능 영역은 폴더 단위로 분리한다.
- 각 영역은 담당 Claude 인스턴스가 전담하며, 다른 영역을 무단 수정하지 않는다.
- 영역 간 의존성 변경 시 반드시 계획 단계에서 먼저 명시한다.

---

## 1. 프로젝트 개요

- **이름**: 고교학점플래너 (HS CreditPlanner)
- **목적**: 고교학점제 시대, 학교생활의 모든 순간을 날짜별로 기록하고 생기부 경쟁력으로 전환
- **대상**: ~150명 학생, ~10명 멘토, 다중 반 지원
- **운영**: 정율사관학원 (부천-인천 지역 42개 고등학교 대상)
- **핵심 철학**: 교학상장(敎學相長) — 학생이 서로 가르치며 함께 성장
- **Production**: https://credit-planner-v8-359.pages.dev

---

## 2. 기술 스택 (절대 변경 금지)

| 영역 | 기술 | 주의사항 |
|------|------|---------|
| 백엔드 | **Hono + TypeScript** | Cloudflare Workers 런타임 |
| DB | **Cloudflare D1 (SQLite)** | MySQL/PostgreSQL 문법 사용 금지 |
| 프론트엔드 | **Vanilla JS + TailwindCSS (CDN)** | React/Vue 아님! CDN이라 커스텀 클래스 불가 |
| 배포 | **Cloudflare Pages** | `wrangler` 사용 |
| AI | OpenAI, Claude, Gemini, Perplexity | 각 기능별 다른 모델 사용 |

### ⚠️ AI API 호출 규칙 (절대 준수)

**모든 AI API(Gemini, Claude, OpenAI)는 반드시 `jungyoul.com` 프록시 서버를 경유해야 한다. 직접 API 호출 금지.**

- **이유**: CF Workers 아시아 엣지에서 Gemini/OpenAI/Anthropic 3개 서비스 모두 지역 차단됨
- **프록시 URL**: `https://jungyoul.com/api/ai-proxy/planner`
- **인증**: `Authorization: Bearer ${c.env.AI_PROXY_SECRET}` 헤더
- **엔드포인트**: `/gemini`, `/claude`, `/openai`
- **헬퍼 함수** (`src/helpers.ts`):
  - `callProxyGemini()` — Gemini 호출
  - `callProxyClaude()` — Claude 호출 (멀티턴 messages 지원, system 필드 지원)
  - `callProxyOpenAI()` — OpenAI 호출
  - `callGeminiWithFallback()` — Gemini → Claude 폴백 체인
  - `callGeminiMultiImage()` — 다중 이미지 OCR + 분석 파이프라인
- **추적 필드**: 모든 호출에 `externalId`(유저 ID)와 `task`(기능명) 전달 필수
- **JSON 모드**: 프록시는 `responseMimeType` 미지원 → `jsonMode: true` 옵션 사용 (프롬프트에 JSON 지시 자동 추가)
- **응답 형식**: `{ok: true, text: "..."}` 또는 `{ok: false, error: "..."}`
- **타임아웃**: 프록시 제한 5분(300초). `timeoutMs: 300000` 이하로 설정

```typescript
// ✅ 올바른 사용법
const text = await callProxyGemini({
  proxySecret: c.env.AI_PROXY_SECRET,
  prompt: '...',
  externalId: String(studentId),
  task: 'credit-log',
})

// ❌ 절대 금지 — 직접 API 호출
fetch('https://generativelanguage.googleapis.com/...')
fetch('https://api.anthropic.com/...')
fetch('https://api.openai.com/...')
```

---

## 3. 폴더 구조

```
jungyoul-planapp/
├── src/
│   ├── index.tsx         # Hono 라우터 (모든 API 엔드포인트 — 단일 파일 280K+)
│   └── renderer.tsx      # Vite 빌드용 렌더러
├── public/
│   ├── static/
│   │   ├── app.js        # 메인 앱 프론트엔드 로직 (700K+)
│   │   ├── app.css       # 메인 앱 스타일
│   │   └── app-mentor.js # 멘토 대시보드 전용
│   ├── modules/
│   │   └── records/      # 기록 모듈 (독립 SPA)
│   │       ├── records.js
│   │       ├── records.css
│   │       ├── core/     # 상태관리, API, 라우터
│   │       ├── views/    # 각 화면별 렌더러
│   │       └── dev.html  # 모듈 독립 테스트용
│   └── styles/           # 추가 스타일
├── dist/                 # 빌드 출력 (vite build)
├── wrangler.jsonc        # Cloudflare Pages 설정
└── CLAUDE.md             # ← 이 파일
```

### 아키텍처 노트
- **백엔드 (src/index.tsx)**: 단일 파일에 모든 API 엔드포인트 정의. Hono 라우터 사용
- **프론트엔드 (public/static/app.js)**: Vanilla JS SPA. 글로벌 상태 + 함수 기반
- **기록 모듈 (public/modules/records/)**: ES Module 기반 독립 SPA. `_RM` 네임스페이스로 격리
- **빌드**: Vite가 src/index.tsx를 Cloudflare Pages Functions로 빌드 → dist/ 출력

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


### R2/사진 관련
- [2026-03-31] **wrangler.jsonc에 R2 바인딩 누락 → 사진 전체 깨짐**: `r2_buckets` 설정이 없으면 `c.env.R2`가 undefined가 되어, `photo_data`에 저장된 `r2:photos/...` 키를 R2에서 읽지 못함. fallback 코드가 R2 키 문자열을 base64 데이터로 잘못 감싸서 `data:image/jpeg;base64,r2:photos/...` (무효 URL) 반환. 사진이 있는 모든 화면에서 이미지 깨짐. **해결**: ① wrangler.jsonc에 `r2_buckets` 추가 ② fallback에서 `r2:` 시작 데이터는 절대 base64로 감싸지 않고 에러 반환 ③ 프론트엔드에서 `r2:` 포함 응답 필터링. **교훈**: 바인딩 설정 변경 시 관련 런타임 동작을 반드시 확인. R2 키를 base64로 감싸는 것은 silent failure — 에러 없이 깨진 이미지만 표시됨

### Cloudflare Workers 지역 제한 (AI API)
- [2026-03-31] **Cloudflare Workers 엣지 지역 → AI API 전체 차단 (다수 학생 장애)**: Cloudflare Workers는 사용자에게 가장 가까운 엣지에서 실행되는데, 일부 엣지(아시아 특정 지역)에서 Gemini(`User location is not supported`), OpenAI(`unsupported_country_region_territory`), Anthropic(`Request not allowed`) 3개 AI 서비스가 모두 차단됨. AI 수업기록(사진→OCR→분석) 플로우가 완전 불능. **해결**: ① `wrangler.jsonc`에 `placement: { mode: "smart" }` 추가하여 Worker를 AI API 서버 근처(미국/유럽) 데이터센터에서 실행 ② `callGeminiMultiImage`에 OpenAI Vision 폴백 추가 (Gemini OCR 실패 시 OpenAI OCR → Sonnet/Gemini/OpenAI 분석 폴백 체인). **교훈**: 외부 API에 의존하는 Worker는 반드시 `placement.mode = "smart"` 설정 필수. 지역 제한은 간헐적으로 발생하므로 로컬 테스트에서는 잡히지 않음. 3개 이상의 AI 서비스 폴백 체인 유지 필수

### API 관련
- [2026-03-11] 메인앱↔모듈 데이터 전달 시 필드 동기화: app.js의 `DB.loadClassRecords()`와 records 모듈의 `api.js loadClassRecords()`가 매핑하는 필드가 달라 `preloadedData` 전달 시 누락 발생. 두 곳의 필드 목록을 반드시 동기화할 것
- [2026-03-04] SELECT 필드 누락: `class_records` INSERT에 `photos, ai_credit_log, photo_tags`를 저장하지만 GET SELECT에서 해당 필드 누락 → 프론트에서 항상 빈 값. INSERT와 SELECT 필드 목록을 반드시 동기화할 것
- [2026-03-04] 프론트-백엔드 필드명 불일치: 프론트엔드 `imageData`(base64) → 백엔드 DB 컬럼 `image_key`. api.js에서 반드시 매핑 `payload.imageKey = payload.imageData; delete payload.imageData;` 처리. 필드명 불일치는 데이터가 사라지는 원인
- [2026-03-04] 응답 필드 체이닝: 백엔드가 `{ questionId: N }` 반환 시 api.js에서 `d.data?.id || d.questionId || d.id`처럼 가능한 모든 형태를 체인으로 처리할 것. 엔드포인트마다 응답 구조가 미묘하게 다를 수 있음
- [2026-03-04] async 이벤트 핸들러: 필터 변경 → API 호출 → 렌더 순서에서, 핸들러가 sync면 API 응답 전에 render()가 실행되어 빈 화면 표시. `setMyQuestionFilter`처럼 `async/await`로 데이터 로딩 완료 후 렌더해야 함
- [2026-03-04] subject vs source 분리: `my_questions` 테이블에서 `subject`는 과목(국어/영어 등), `source`는 출처(수업/독서 등)로 분리. 기존 데이터는 `subject`에 출처가 들어있을 수 있으므로 `_getSubjectCategory()` 매핑 필수
- [2026-03-04] 카테고리 필터링: 세부 과목명(물리학Ⅰ 등)을 대분류(과학)로 매핑 필요 시 클라이언트 사이드 `_getSubjectCategory()` 사용. 백엔드 `?subject=` 파라미터로는 정확 매칭만 가능


### 프론트엔드 관련
<!-- 실수 발생 시 아래에 추가 -->
- [2026-03-11] 아카이브 모듈 탭 재진입 시 DB 새로고침 필수: `_showArchiveModule()`에서 `_archiveModuleActive`가 true이면 `init()`을 건너뛰고 `navigate('dashboard')`만 호출하는데, `navigate()`는 화면만 바꾸고 DB 데이터를 다시 불러오지 않음. 반드시 `ArchiveModule.refresh()`를 호출하여 `DB.loadAll()` + `_buildTodayRecords()` + `render()` 실행해야 함. 모듈이 stateful 재진입을 지원할 때는 항상 데이터 새로고침 로직을 포함할 것
- [2026-03-06] 모듈 임베드 시 CSS 셀렉터 스코프 불일치: Records 모듈을 `#records-container-tablet`에 마운트하면, 메인앱 `app.css`의 `#tablet-content .xxx` 셀렉터가 매칭되지 않아 레이아웃이 깨짐. 모듈을 별도 컨테이너에 넣을 때는 반드시 새 컨테이너 ID를 타겟하는 CSS 룰을 추가할 것. 미디어쿼리보다 ID 셀렉터 + `!important`가 확실. 코드만 보고 "완료" 선언하지 말고 반드시 브라우저에서 시각적 확인 필수
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
- [2026-03-14] Gemini 모델 버전 주의: 프로젝트 전체에서 `gemini-3-flash-preview` 사용 (GEMINI_MODEL 상수 + 직접 URL 7곳). `gemini-3.0-flash`는 404 반환하므로 사용 금지. `gemini-2.5-flash`도 작동하지만 OCR 품질이 낮으므로 `gemini-3-flash-preview` 유지. 모델명 변경 시 반드시 API로 테스트 후 변경할 것
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
- [2026-03-06] 인쇄물/PDF 미리보기에서 자동 print() 호출 금지: `_openPrintWindow`에서 `window.print()`를 `onload`에 자동 호출하면, 페이지 렌더링 전에 인쇄 다이얼로그가 떠서 사용자에게 빈 페이지로 보임. "인쇄물 보기" 기능은 `_openPreviewWindow`(미리보기 전용)를 사용하고, 페이지 내에 인쇄 버튼을 배치할 것. 자동 인쇄가 필요한 경우에만 `_openPrintWindow` 사용
- [2026-03-06] 인쇄물 템플릿 변경 후 반드시 목데이터로 렌더링 검증: 새 HTML 템플릿을 작성하면 dev.html에 테스트 버튼 + 목데이터를 추가하여 모든 섹션이 데이터와 함께 실제로 렌더링되는지 확인할 것. 템플릿 문법 오류, 조건부 렌더링 누락, CSS 표시 문제는 실제 브라우저에서만 발견됨
- [2026-03-06] **절대 규칙 — 코드만 보고 완료 선언 금지**: UI/렌더링/인쇄물 등 시각적 출력이 있는 변경은 반드시 브라우저에서 실제 동작을 확인한 후에만 "완료"라고 말할 것. 기존 함수를 다른 용도로 재사용할 때(예: 자동 print() 호출하는 함수를 미리보기용으로) 동작 차이를 반드시 검토할 것. 이 실수가 10회 이상 반복됨 — 절대 재발 금지

### 개발 서버 관련
<!-- 실수 발생 시 아래에 추가 -->
- [2026-03-05] 개발 서버 실행: `wrangler pages dev public`이 아니라 `npm run dev` (Vite)가 올바른 로컬 개발 서버. Vite가 src/index.tsx를 Functions로 처리함. `wrangler pages dev public`은 Functions shimming 없이 정적 파일만 서빙하므로 API 404 발생
- [2026-03-05] 기록 모듈 테스트: 메인 앱(`/`)이 아니라 `/modules/records/dev.html`에서 기록 모듈 독립 테스트. 로그인 없이 바로 모듈 확인 가능. 경로를 `/dev.html`로 착각하지 말 것
- [2026-03-14] Gemini 모델명 확인 (API 테스트 기준):
  작동하는 모델명: `gemini-3-flash-preview` (프로젝트 기본), `gemini-2.5-flash`, `gemini-2.0-flash`
  404 반환하는 모델명: `gemini-3.0-flash`, `gemini-3.1-flash`, `gemini-3.2-flash`
  → 모델명 변경 전 반드시 `curl`로 API 테스트 필수. Google이 모델명을 변경할 수 있으므로 CLAUDE.md 기록보다 실제 API 응답을 신뢰할 것.
### 배포/설정 관련
<!-- 실수 발생 시 아래에 추가 -->
- [2026-03-04] `.dev.vars` 키 범위: 로컬 개발 시 `.dev.vars`에 필요한 API 키가 모두 있는지 확인. `callGeminiMultiImage`는 `GEMINI_API_KEY` + `OPENAI_API_KEY` 둘 다 필요 (Gemini 실패 시 OpenAI 폴백). 프로덕션은 `wrangler pages secret put`으로 별도 설정
- [2026-03-04] git merge 충돌 해결: `src/index.tsx`와 `public/static/app.js`에서 충돌 발생 시, main의 에러 메시지/UI 문구는 main 채택, feature 브랜치의 신규 API/기능은 feature 채택. stash → merge → stash pop 순서로 안전하게 진행
- [2026-03-11] **절대 규칙 — 배포는 반드시 `npm run deploy` 사용**: `wrangler pages deploy public` 직접 실행 금지! 이 프로젝트는 Vite 빌드(`vite build`)가 필수 — `public/`에는 `index.html`과 `_worker.js`가 없고, 빌드 후 `dist/`에 생성됨. `npm run deploy` = `vite build` + `wrangler pages deploy`가 올바른 배포 명령. 빌드 없이 `public/`을 직접 배포하면 사이트 전체 404 발생 (프로덕션 장애)


---

## 9. 테스트 계정

| 역할 | 정보 |
|------|------|
| 
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

*마지막 업데이트: 2026-03-31*
*이 파일은 프로젝트와 함께 계속 성장합니다.*

<!-- GSD:project-start source:PROJECT.md -->
## Project

**고교학점제 맞춤형 학생 플래너 — 수식 렌더링 수정**

고교학점제 학생을 위한 맞춤형 학습 플래너 앱. 수업 탐구 기록, 세특 질문, 퀴즈, 성장 분석 등을 AI로 분석하고 기록하는 웹앱(Cloudflare Pages + Hono + Vanilla JS SPA). 현재 물리/수학 등 과목에서 LaTeX 수식이 렌더링되지 않고 raw 텍스트로 노출되는 문제를 해결해야 한다.

**Core Value:** 학생이 작성한 수업 기록에서 수식과 기호가 교과서처럼 깔끔하게 렌더링되어, 과학/수학 과목의 탐구 기록이 전문적이고 가독성 높게 표시되는 것.

### Constraints

- **Tech Stack**: Cloudflare Pages + Hono, Vanilla JS (React/Vue 없음)
- **라이브러리**: KaTeX v0.16.9 사용 (이미 통합됨)
- **호환성**: 모바일(Android/iOS) 및 태블릿에서 정상 작동해야 함
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- TypeScript ESNext - Backend API handlers and type definitions (`src/index.tsx`, `src/helpers.ts`, `src/types.ts`)
- JavaScript (Vanilla ES Modules) - Frontend SPA (`public/static/app.js`, `public/static/app-mentor.js`)
- HTML/CSS - UI with TailwindCSS CDN (`public/index.html`)
- JSX - Hono server-side rendering (`src/renderer.tsx`, Hono components in TSX files)
- SQL - Cloudflare D1 queries (embedded in TypeScript)
## Runtime
- Node.js 18+ (implied by wrangler config)
- Cloudflare Workers (serverless execution via Hono)
- Cloudflare Pages Functions (`pages_build_output_dir: "./dist"`)
- npm 10+ (evidenced by package-lock.json v3)
- Lockfile: `package-lock.json` (present)
## Frameworks
- Hono 4.11.9 - Lightweight web framework for Cloudflare Workers (`src/index.tsx`)
- Vite 6.3.5 - Build bundler and dev server (`vite.config.ts`)
- Wrangler 4.4.0 - Cloudflare CLI for deployment and local testing
- Not detected in package.json (unit tests not configured)
## Key Dependencies
- hono 4.11.9 - All API endpoints depend on Hono router and middleware
- @hono/vite-build 1.2.0 - Required for building to Cloudflare Pages Functions format
- @hono/vite-dev-server 0.18.2 - Enables local dev with Cloudflare bindings
- wrangler 4.4.0 - Deploys to production and manages secrets/environment
- @cloudflare/workerd-darwin-64 (optional) - Local Workers runtime emulation on macOS x64
- @cloudflare/workerd-darwin-arm64 (optional) - Local Workers runtime on macOS ARM64
- @cloudflare/workerd-linux-64 (optional) - Local Workers runtime on Linux x64
- @cloudflare/workerd-linux-arm64 (optional) - Local Workers runtime on Linux ARM64
- @cloudflare/unenv-preset 2.14.0 - Polyfills for Workers environment
- @cloudflare/kv-asset-handler 0.4.2 - Serves static assets from Cloudflare KV
## Configuration
- `.dev.vars` - Local development secrets (contains GEMINI_API_KEY for local testing)
- `wrangler.jsonc` - Cloudflare configuration:
- `vite.config.ts` - Configures @hono/vite-build and @hono/vite-dev-server
- `tsconfig.json`:
- `package.json` - "type": "module" (ES Module imports)
## TypeScript Configuration
## Platform Requirements
- Node.js 18+
- npm (with package-lock.json v3)
- macOS/Linux/Windows with npm installed
- `.dev.vars` file with at least GEMINI_API_KEY set
- Cloudflare Pages (deployment target)
- Cloudflare Workers (serverless runtime)
- Cloudflare D1 SQLite database
- Cloudflare R2 object storage
- Cloudflare KV namespace (optional, for caching)
## Build Commands
- Source: `src/index.tsx` (Hono app entry point)
- Output: `dist/` (Cloudflare Pages Functions)
- Static assets: `public/` (served by Cloudflare Pages)
## Environment Variables Required
- GEMINI_API_KEY - Google Gemini API key
- OPENAI_API_KEY - OpenAI API key
- ANTHROPIC_API_KEY - Claude API key
- PERPLEXITY_API_KEY - Perplexity API key
- JYSK_API_URL - Remote DB proxy URL (default: https://jungyoul.com/api/jysk-api.php)
- JYSK_API_KEY - Remote DB API authentication key
- Same as above, set via `wrangler pages secret put KEY VALUE`
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Backend (TypeScript): `camelCase.ts` — `src/index.tsx`, `src/helpers.ts`, `src/types.ts`
- Backend routes: kebab-case in filename — `src/routes/mentor-auth.ts`, `src/routes/mentor-groups.ts`
- Frontend (JavaScript): `camelCase.js` or kebab-case — `public/static/app.js`, `public/modules/records/core/state.js`, `public/modules/records/views/class-record.js`
- Module files follow descriptive kebab-case — `photo-upload-v2.js`, `aha-report-input.js`
- camelCase for all function definitions: `getKSTNow()`, `recordXp()`, `callGeminiWithFallback()`, `renderDashboard()`
- Data fetching functions: `load*` prefix (e.g., `loadClassRecords()`, `loadQuestionRecords()`) in `core/api.js`
- Event handlers: `on*` prefix in handler names or `*FromData()` for XSS-safe onclick wrappers (e.g., `startBackfillRecordFromData()`, `viewRecordFromData()`)
- Prefix `_` for private/internal functions: `_showArchiveModule()`, `_hideArchiveModule()`, `_buildTodayRecords()`
- View renderers in modules: `render*` prefix (e.g., `renderDashboard`, `renderClassRecordDetail`, `renderExamAdd`)
- State properties: camelCase for public state (`state.currentScreen`, `state.studentTab`, `state.todayRecords`)
- Private state properties: prefix `_` (e.g., `state._authUser`, `state._classPhotos`, `state._viewingDbRecord`)
- Constants: UPPER_SNAKE_CASE for true constants: `GEMINI_MODEL`, `AI_API_BASE`, `NICKNAME_BLOCKLIST`, `_SIMPLE_KW`, `_COMPLEX_KW`
- Prefix `_` for temporary/intermediate variables: `_classPhotos`, `_editorPhotos`, `_classAssignmentText`
- TypeScript interfaces/types: PascalCase — `type Bindings`, `type D1Database`
- Database types (JavaScript comments): describe raw field names in snake_case as returned from DB — `{ id, subject, date, content, keywords, understanding, ... }`
- kebab-case in screen registry: `'dashboard'`, `'record-class'`, `'class-record-detail'`, `'photo-upload'`, `'ai-loading'`, `'activity-result'`
- Map registry in `SCREEN_MAP` object associates names to renderer functions
## Code Style
- No explicit `.prettierrc` or `.eslintrc` detected — codebase uses loose formatting
- Indentation: 2 spaces (observed in TypeScript and JavaScript files)
- Template literals: used heavily for HTML strings and XSS-safe rendering: ``` html`<div>${escapeHtml(str)}</div>` ```
- Object spread: `{ ...recordData }` for shallow copies
- No linting config files detected (`.eslintrc*`, `biome.json`)
- No formatter config detected
- Formatting is loose and not enforced; style depends on developer discipline
- Double quotes for strings (observed in JSON, TypeScript, JavaScript)
- Template literals for multi-line or dynamic content
- XSS mitigation: all user input wrapped with `escapeHtml()` before insertion into HTML
- Korean comments and logging throughout (this is a Korean-language educational app)
## Import Organization
- No path aliases configured (no `jsconfig.paths` or TypeScript `compilerOptions.paths`)
- Relative imports used throughout: `./core/state.js`, `../helpers`, `../types`
- Module entry point isolation: records module uses `_RM` global namespace to avoid conflicts with main app
## Error Handling
- Try-catch at API boundary (route handlers): `try { ... } catch (e: any) { return c.json({ error: e.message }, 500) }`
- Silent error suppression with logging for non-critical operations: `catch (e) { console.error('loadClassRecords:', e); }`
- Nested try-catch for optional operations: Database hooks (e.g., community board creation) wrapped in separate try-catch to not block main operation
- Validation before operations: `if (!loginId || !password) return c.json({ error: 'message' }, 400);`
- Timeouts on external API calls: `fetchWithTimeout(url, init, 60000)` with AbortController
- Success: `c.json({ success: true, data: { ... } })` (or just `data` object directly)
- Failure: `c.json({ error: "메시지" }, status_code)` or `c.json({ success: false, error: "..." })`
- Status codes: 400 (validation), 401 (auth), 409 (conflict), 500 (server error)
## Logging
- Informational: `console.log('[OCR] 완료 (${ocrText.length}자)')`
- Errors: `console.error('loadClassRecords:', e)`
- Prefixed context: `[OCR]`, `[분석]`, `[API]` — square brackets for operation scope
- Fallback decisions logged: `console.log('Gemini API 실패 (${geminiRes.status}), Claude로 폴백')`
- Silent failures for non-critical operations (XP recording, board creation hooks) — logged but don't block main flow
## Comments
- Section headers: `// ==================== XSS 방지 헬퍼 ====================` (thick divider for major sections)
- Function purposes: Comments above non-obvious functions
- Business logic notes: e.g., `// Gemini API가 할당량 초과(429) 등으로 실패할 경우 OpenAI gpt-4o-mini로 자동 폴백`
- Data structure notes: e.g., comments explaining state shape in `_initialState`
- Database rules (CLAUDE.md): SQL-specific gotchas like `AUTO_INCREMENT 금지 → INTEGER PRIMARY KEY AUTOINCREMENT 사용`
- Not systematically used; minimal type documentation
- Function signatures in TypeScript provide type hints implicitly
- Complex functions document parameters as inline comments
- English and Korean mixed depending on context
- Large block comments use `/* */` format; section headers use `// ==...==` pattern
- Inline comments explain "why" not "what" (following common best practices)
## Function Design
- Frontend: Large functions (100-300+ lines) common in render functions and event handlers (e.g., `renderDashboard`, `renderClassRecordEdit`)
- Backend: Functions typically 30-80 lines per route handler
- No strict size limits; complexity managed through modular organization and helper extraction
- Backend routes: destructure from `c.req.json()` directly in handler
- Frontend callbacks: often passed `el` (DOM element) for onclick handlers to extract `dataset` attributes
- API functions: accept options objects `{ geminiKey, openaiKey, prompt, ... }`
- Optional parameters with defaults: `function showToast(msg, type = 'info')`
- Backend: always return `c.json()` response (never bare values)
- API functions: return `Promise<Response>` or Promise of parsed data
- Frontend DB layer (`DB.load*`): side-effect based — updates `state` directly, no return value
- Render functions: return HTML string (template literal)
## Module Design
- Backend: export named functions and constants: `export function getKSTNow()`, `export const GEMINI_MODEL`
- Frontend records module: exports default object `export const DB = { loadClassRecords() { ... }, saveClassRecord() { ... } }`
- View functions: named exports: `export { renderDashboard, registerHandlers as dashboardHandlers }`
- Handlers: exported as `registerHandlers` function that attaches event listeners
- No barrel files (`index.js` re-exports) detected
- Each module imported explicitly: `import { DB } from './core/api.js'`
- Records module has flat import structure in main `records.js` file
- Records module isolated with `_RM` global namespace (e.g., `_RM.fn()`, `_RM.state`) to avoid conflicts with main app global scope
- Main app uses top-level globals: `state`, `goScreen()`, `renderScreen()`
- No module bundler (Vite serves ES modules directly in dev, builds with Hono for production)
## Database Naming
- Dates stored as `YYYY-MM-DD` strings for date-only fields
- Timestamps as `YYYY-MM-DD HH:MM:SS` for `*_at` columns
- JSON stored as TEXT: `photos`, `keywords`, `ai_credit_log`, `photo_tags`
- Booleans as INTEGER (0/1): `is_active`, `is_public`
## Special Patterns
- All user input escaped with `escapeHtml()` before HTML insertion
- onclick handlers wrap user data in `data-*` attributes: `onclick="viewRecordFromData(this)"` then extract via `el.dataset.*`
- Never use `innerHTML` with user input
- Vanilla JavaScript: mutable `state` object with Proxy-based reactivity in records module
- Side-effect based: `DB.load*()` functions update `state` directly
- No immutable patterns or Redux-style reducers
- Async/await consistently used for API calls
- Promise chains avoided in favor of await
- AbortController for fetch timeouts
- TailwindCSS CDN (no custom config)
- Mobile-first: separate `#app-content` (mobile) and `#tablet-content` (tablet) containers
- Media query breakpoints not explicitly documented; appears to be based on layout requirements
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- Monolithic API backend in `src/index.tsx` (280K+) routed via modular route handlers
- Multi-view SPA frontend with vanilla JavaScript and state management via Proxy
- Independent, pluggable records module (`public/modules/records/`) with isolated state/router
- Cloudflare Workers runtime with D1 (SQLite) persistence and R2 photo storage
- Full-stack TypeScript (backend) + vanilla JS (frontend) architecture
## Layers
- Purpose: HTTP request handling, database operations, AI integrations, authentication
- Location: `src/index.tsx` (main router) + `src/routes/*.ts` (route modules)
- Contains: Hono route definitions, query builders, middleware (CORS, caching), AI prompt logic
- Depends on: `src/types.ts`, `src/helpers.ts`, Cloudflare bindings (DB, R2, KV)
- Used by: Frontend SPA via `/api/*` endpoints
- Purpose: Reusable functions for cryptography, API calls, date/time, validation
- Location: `src/helpers.ts` (backend helpers), `public/modules/records/core/utils.js` (frontend utils)
- Contains: Password hashing, token generation, KST time handling, Gemini/Claude API wrappers, HTML sanitization, nickname validation
- Depends on: External APIs (Google Gemini, OpenAI, Anthropic), Node crypto APIs
- Used by: Route handlers and frontend views
- Purpose: Core app shell, authentication, navigation, global state
- Location: `public/static/app.js` (700K+), `public/static/app.css`
- Contains: Global state object, screen routing, form handlers, localStorage cache, API bindings
- Depends on: TailwindCSS CDN, API layer
- Used by: Student/mentor users accessing main interface
- Purpose: Isolated SPA for recording class sessions, exams, activities, assignments
- Location: `public/modules/records/`
- Contains: Modular views (dashboard, forms, galleries), centralized state management, API client, router, event bus
- Depends on: Core utilities, API layer
- Used by: Main app or standalone via `dev.html`
- Structure: `core/` (state, router, API, events), `views/` (38+ screen renderers), `components/` (reusables like photo upload)
- Purpose: Persistent data storage across users, groups, records, exams
- Location: Cloudflare D1 (remote SQLite), schema at `schema/full_database_schema.sql`
- Contains: 14+ tables (users, groups, records, exams, activities, assignments, etc.)
- Accessed by: Backend API via `c.env.DB` binding
- Data flow: API constructs SQL → D1 executes → returns results
- Purpose: Photo/document persistence
- Location: Cloudflare R2 bucket (`credit-planner-photos`)
- Contains: Base64-encoded photos from class records, exam corrections, activity logs
- Accessed by: Backend API via `c.env.R2` binding, referenced from DB via `ref:ID`
## Data Flow
- Central `state` object (Proxy) with 80+ properties tracking UI/data state
- All mutations via `setState(key, value)` trigger validation + `events.emit(EVENTS.STATE_CHANGED)`
- Views listen to events → re-render only affected sections
- Derived state (`todayRecords`, mission progress) computed on demand from `_db*` sources + config
## Key Abstractions
- Purpose: Organize API endpoints by domain (auth, student, mentor, analysis)
- Examples: `src/routes/mentor-auth.ts`, `src/routes/mentor-student.ts`, `src/routes/mentor-feedback.ts`
- Pattern: Each route file is a `new Hono<{ Bindings }>()` instance, exported, then mounted via `app.route('/', moduleRouter)`
- Usage: Keeps main `index.tsx` modular; each route file handles ~5-10 related endpoints
- Purpose: Screen-specific HTML generation + event handler registration
- Examples: `views/class-record.js`, `views/dashboard.js`, `views/exam-list.js`
- Pattern: Each file exports:
- Usage: Router calls `renderFn()` to get HTML, injects into container, calls `registerHandlers()` to bind logic
- Purpose: Single source for all backend API calls with consistent error handling
- Location: `public/modules/records/core/api.js`
- Pattern: `export const DB = { loadClassRecords, saveClassRecord, loadQuestionRecords, ... }`
- Usage: Views import `{ DB }` and call `DB.saveClassRecord(data)` — no direct fetch in views
- Purpose: Decouple state changes from view updates
- Location: `public/modules/records/core/events.js`
- Pattern: Central event dispatcher; views emit events (`events.emit(EVENTS.RECORD_SAVED)`), other views listen
- Usage: When quiz record completes, it emits event → dashboard listener refreshes mission counter without direct call
- Purpose: Track screen navigation history + support back button
- Location: `public/modules/records/core/router.js`
- Pattern: `navigate(screen)` pushes to history, `goBack()` pops; prevents infinite loops with `_screenHistory`
- Usage: Ensures deep linking, prevents accidental premature backs
## Entry Points
- Location: `src/index.tsx` (lines 28-72)
- Triggers: HTTP request to Cloudflare Pages Functions
- Responsibilities:
- Location: `src/routes/mentor-auth.ts` (and others)
- Triggers: Request to `/api/auth/*`, `/api/mentor/*`, `/api/student/*` paths
- Responsibilities: Validate input, query D1, return JSON responses
- Example: `/api/auth/mentor/login` → hash validation → return token + user metadata
- Location: `public/static/app.js` (entry point defined in index.html)
- Triggers: Page load or hard refresh
- Responsibilities:
- Location: `public/modules/records/records.js` (export `{ init, navigate, getState, setState }`)
- Triggers: Called by main app via `recordsModule.init({ preloadedData })`
- Responsibilities:
## Error Handling
- **API Errors:** Responses always return `{ success: bool, data/error, code }` structure. Frontend checks `success` and shows toast/alert with `error` message.
- **AI Fallback:** Gemini API → Claude API → OpenAI fallback chain in `callGeminiWithFallback()`. If all fail, throw error with all failure reasons.
- **DB Constraints:** D1 query errors caught in try-catch, return 400 with sanitized error message. Never expose raw SQL errors to client.
- **Photo Upload:** Concurrent photo uploads wrapped in Promise.all with reject handling. Partial upload (1 of 3 photos fails) → show warning but save record anyway.
- **Validation:** Input validation before DB ops (length checks, type coercion, regex patterns). Failed validation returns 400 with field error.
## Cross-Cutting Concerns
- Backend: `console.error()` for exceptions, `console.log()` for fallback events
- Frontend: Global error handler attached to Records Module, logs to browser console
- No persistent log storage (design trade-off)
- Backend: Validator functions for password strength, invite code format, nickname content (NICKNAME_BLOCKLIST in helpers)
- Frontend: Client-side form validation before submit; server-side re-validates all inputs
- Token-based: `/api/auth/*/login` returns JWT-like token, frontend stores in `window._token`
- Every API request checked server-side: mentor endpoints verify token matches mentor ID in path
- Student endpoints: verify student ID matches logged-in student (frontend passes `studentId` in URL)
- No refresh token mechanism; tokens don't expire in this design (security gap noted in CLAUDE.md)
- Mentor: Can view own groups, students, feedback — checked via token + ID match
- Student: Can only view own records, classmates, time slots — checked via student ID in path
- Admin: Special `ADMIN_KEY` env var for `/api/admin/*` endpoints
- Community board: Checked via `canAccessBoard()` helper (student must be in group or enrolled class)
- Backend: Cache headers set to `no-cache` for `sw.js`, `app.js`, `app.css` to ensure latest version
- Frontend: Records module state is in-memory only; page refresh reloads from server
- localStorage used only for timetable (non-critical, can diverge from DB)
- Not implemented; relies on Cloudflare's default protections
- Photo uploads timeout after 10 minutes; AI requests timeout after 10 minutes
<!-- GSD:architecture-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd:quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd:debug` for investigation and bug fixing
- `/gsd:execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd:profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
