# Claude Code 최종 디버깅 지시문 (2026-03-11)

CLAUDE.md를 먼저 읽고 아래 3개 버그를 순서대로 수정해줘.

---

## 버그 1: 아카이브에서 AI 분석 내용 없음 + PDF 버튼 없음

### 근본 원인
`public/static/app.js`의 `DB.loadClassRecords()` (line 2049~2062)에서 `ai_credit_log`, `photo_tags`, `photo_count` 3개 필드를 매핑하지 않음. 이 불완전한 데이터가 `_showArchiveModule()`의 `preloadedData`로 Records 모듈에 전달되어 AI 분석, PDF 버튼이 안 보임.

### 수정 위치
`public/static/app.js` — `DB.loadClassRecords()` 안의 `.map(r => ({...}))` 블록 (line 2049~2062)

`created_at: r.created_at || '',` 줄 뒤에 아래 3줄 추가:
```js
ai_credit_log: (() => { try { return r.ai_credit_log ? JSON.parse(r.ai_credit_log) : null; } catch(e) { return null; } })(),
photo_tags: (() => { try { return JSON.parse(r.photo_tags || '[]'); } catch(e) { return []; } })(),
photo_count: r.photo_count || 0,
```

---

## 버그 2: "나의 수업 다시보기"에 유령 레코드 중복 표시

### 증상
영어를 1번만 기록했는데 카드가 2개 나옴. 왼쪽 카드는 "단원 미입력", 삭제도 안 됨.

### 근본 원인
`public/modules/records/views/class-history.js`의 `_buildRecords()` (line 106~118) 중복 체크 로직 결함:
- `saveCreditLog()`에서 `record.done = true` + `record._dbRecordId = recordId` 설정하지만, `record._topic`은 설정 안 함
- 중복 체크가 `r._topic`(빈 문자열)과 DB의 `db.topic`("Lesson 1...")을 비교 → 불일치 → 유령 레코드 생성
- 유령 레코드는 `id: 'today-0'`이라 DB에 없어서 삭제 불가

### 수정 2곳

#### 수정 2-A: `saveCreditLog`에서 `_topic` 설정 추가
`public/modules/records/views/ai-credit-log.js` — `saveCreditLog()` 함수 안, `record.done = true;` 이후 (line 188~190)

현재:
```js
record.done = true;
record._dbRecordId = recordId;
record.summary = log.topic || log.keywords?.join(', ') || '수업 기록 완료';
```

수정:
```js
record.done = true;
record._dbRecordId = recordId;
record._topic = log.topic || '';
record._pages = log.pages || '';
record._keywords = log.keywords || [];
record._teacherNote = log.highlights || '';
record.summary = log.topic || log.keywords?.join(', ') || '수업 기록 완료';
```

#### 수정 2-B: `_buildRecords` 중복 체크 강화
`public/modules/records/views/class-history.js` — `_buildRecords()` 함수 (line 106~109)

현재:
```js
const todayDone = (state.todayRecords || []).filter(r => r.done).map((r, idx) => {
    const topic = r._topic || '';
    const alreadyInDb = dbRecords.some(db => db.date === today && db.subject === r.subject && (db.topic === topic || db.content === topic));
    if (alreadyInDb) return null;
```

수정:
```js
const todayDone = (state.todayRecords || []).filter(r => r.done).map((r, idx) => {
    // _dbRecordId가 있으면 DB에 이미 저장된 것 → 무조건 중복
    if (r._dbRecordId && dbRecords.some(db => String(db.id) === String(r._dbRecordId))) return null;
    const topic = r._topic || '';
    const alreadyInDb = dbRecords.some(db => db.date === today && db.subject === r.subject && (db.topic === topic || db.content === topic));
    if (alreadyInDb) return null;
```

---

## 버그 3: 기존 유령 레코드 정리

현재 메모리에 남아있는 유령 레코드("단원 미입력")는 페이지 새로고침하면 사라짐. 하지만 사용자 경험을 위해 `_hideArchiveModule()`에서 돌아올 때 todayRecords를 DB와 동기화하는 로직이 이미 있는지 확인. `app.js`의 `_hideArchiveModule()` (line 304~312)에서 `DB.loadClassRecords()` → `syncTodayRecords()`를 이미 호출하고 있으므로 버그 1 수정 후 자연스럽게 해결됨.

---

## 확인 방법

1. 수정 후 `npm run dev` 실행
2. `http://localhost:5173/?user_id=68251&device_mode=3` 접속
3. 아카이브 → 나의 수업 다시보기:
   - ✅ 카드가 1개만 보이는지 (유령 레코드 없음)
   - ✅ AI 분석 내용(키워드, 세특 질문, 퀴즈)이 보이는지
   - ✅ 'PDF로 저장' 버튼이 보이는지
4. 홈 화면 → 오늘의 수업:
   - ✅ 영어 옆에 기록완료 표시가 되어 있는지
5. **반드시 브라우저에서 시각적 확인 후** `npm run deploy` 배포

## CLAUDE.md 실수 노트 추가

```
- [2026-03-11] 메인앱↔모듈 데이터 전달 시 필드 동기화: app.js의 DB.loadClassRecords()와 records 모듈의 api.js loadClassRecords()가 매핑하는 필드가 달라 preloadedData 전달 시 누락 발생. 두 곳의 필드 목록을 반드시 동기화할 것
- [2026-03-11] saveCreditLog 후 todayRecords 파생 필드 설정 누락: record.done=true 설정 시 _topic, _pages, _keywords, _teacherNote도 함께 설정해야 _buildRecords() 중복 체크가 정상 작동함
```
