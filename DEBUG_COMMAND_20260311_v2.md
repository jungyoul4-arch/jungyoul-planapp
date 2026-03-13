# Claude Code 디버깅 지시문 v2 — 근본 원인 확정

아래를 Claude Code에 그대로 붙여넣으세요.

---

## 확정된 버그: 아카이브에서 AI 분석 내용 없음 + PDF 버튼 없음 + 오늘의 시간표 기록완료 미표시

### 증상
1. 수업 기록 완료 후, 아카이브 '나의 수업 다시 보기'에서 기록은 보이지만 **AI 분석 내용이 사라지고 PDF 버튼이 없음**
2. 메인 화면 '오늘의 수업'에서 **기록완료(✅) 표시가 안 남**
3. DB에는 정상 저장됨 — `GET /api/student/1573/class-records` 응답에 `ai_credit_log` 정상 포함

### ✅ 근본 원인 확정 (100% 확인됨)

#### 🔴 원인: `app.js` `DB.loadClassRecords()` 에서 `ai_credit_log` 필드 매핑 누락

**파일**: `public/static/app.js` line 2049~2062

```javascript
// 현재 코드 (버그):
state._dbClassRecords = (data.records || []).map(r => ({
  id: r.id,
  subject: r.subject,
  date: r.date,
  content: r.content,
  keywords: ...,
  understanding: r.understanding,
  memo: r.memo,
  topic: r.topic || '',
  pages: r.pages || '',
  photos: ...,
  teacher_note: r.teacher_note || '',
  created_at: r.created_at || '',
  // ❌ ai_credit_log 누락!!!
  // ❌ photo_tags 누락!!!
  // ❌ photo_count 누락!!!
}));
```

#### 영향 체인:
1. `loadClassRecords()` → `ai_credit_log` 없이 `state._dbClassRecords`에 저장
2. `_showArchiveModule()` (line 265-266) → 이 불완전한 데이터를 `preloadedData.classRecords`로 Records 모듈에 전달
3. Records 모듈 `init()` (line 277) → `state._dbClassRecords = preloaded.classRecords` → `ai_credit_log` 없음
4. Records 모듈이 자체 `DB.loadAll()`를 건너뜀 (preloadedData가 있으므로)
5. `class-detail.js` line 550: `record.ai_credit_log ? _renderDetailCreditLog(...) : ''` → **항상 빈 문자열**
6. → PDF 버튼 안 보임, AI 분석 내용 없음

### 수정 방법 (1분 소요)

#### 수정 1: `app.js` line 2049~2062 — 누락 필드 추가

```javascript
state._dbClassRecords = (data.records || []).map(r => ({
  id: r.id,
  subject: r.subject,
  date: r.date,
  content: r.content,
  keywords: (() => { try { return JSON.parse(r.keywords || '[]'); } catch(e) { return []; } })(),
  understanding: r.understanding,
  memo: r.memo,
  topic: r.topic || '',
  pages: r.pages || '',
  photos: (() => { try { return JSON.parse(r.photos || '[]'); } catch(e) { return []; } })(),
  teacher_note: r.teacher_note || '',
  created_at: r.created_at || '',
  // ✅ 추가해야 할 필드 3개:
  ai_credit_log: (() => { try { return r.ai_credit_log ? JSON.parse(r.ai_credit_log) : null; } catch(e) { return null; } })(),
  photo_tags: (() => { try { return JSON.parse(r.photo_tags || '[]'); } catch(e) { return []; } })(),
  photo_count: r.photo_count || 0,
}));
```

### 수정 확인 방법

1. `npm run dev`로 로컬 서버 실행
2. `http://localhost:5173/?user_id=68251&device_mode=3` 접속
3. 아카이브 → 나의 수업 다시보기 → 영어 기록 선택
4. ✅ AI 분석 내용(키워드, 세특 질문, 퀴즈 등)이 보이는지 확인
5. ✅ 'PDF로 저장' 버튼이 보이는지 확인
6. ✅ 메인 화면 → 오늘의 수업에서 영어 옆에 기록완료 표시 확인

### 주의사항 (CLAUDE.md 규칙)
- 반드시 CLAUDE.md를 먼저 읽고 시작할 것
- 수정 후 반드시 브라우저에서 시각적 확인 (코드만 보고 완료 선언 금지!)
- 배포: `npm run deploy` (wrangler pages deploy public 직접 실행 금지!)
- 수정 완료 후 CLAUDE.md [실수 노트] 업데이트:
  `[2026-03-11] 메인앱↔모듈 데이터 전달 시 필드 동기화: app.js의 loadClassRecords()와 records 모듈의 api.js loadClassRecords()가 매핑하는 필드가 다르면, preloadedData로 전달 시 누락 발생. 두 곳의 필드 목록을 반드시 동기화할 것`
