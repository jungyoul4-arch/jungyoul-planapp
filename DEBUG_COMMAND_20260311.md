# Claude Code 디버깅 지시문 — AI 분석 실패 + 수업 기록 미저장

아래를 Claude Code에 그대로 붙여넣으세요.

---

## 긴급 버그: '수업 기록하기'에서 AI 분석 실패 → 기록이 DB에 저장 안 됨

### 현상
1. 메인 화면 '오늘의 수업'에서 영어를 수업 기록했는데 기록 완료(✅) 표시가 안 남
2. 수업 기록 상세에서 'PDF 인쇄하기' 버튼이 안 보임
3. `GET /api/student/68251/class-records` → `{"records":[]}` (DB에 기록 0건)
4. 사용자는 기록 완료했다고 확신 → UI에서는 완료처럼 보였지만 실제 DB 저장 실패

### 조사 완료된 원인 분석 (확률순)

#### 🔴 원인1 (40%): saveCreditLog() silent fail — DB 저장 실패해도 에러 안 보임
**파일**: `public/modules/records/views/ai-credit-log.js` 의 `saveCreditLog()` (line 135~211)

문제: `record.done = true` + dashboard 네비게이션이 DB 저장 **성공 확인 전에** 실행됨.
`DB.saveClassRecord()`가 `null`을 반환해도 콘솔 로그만 찍고 사용자에게 에러 토스트를 안 보여줌.

```
// 문제 코드 패턴 (추정):
record.done = true;        // ← DB 저장 전에 done 설정
navigate('dashboard');      // ← 바로 대시보드로 이동
const recordId = await DB.saveClassRecord(...);  // ← 이게 null이면?
if (!recordId) console.error('저장 실패');        // ← 사용자 모름!
```

**수정 방향**:
1. DB 저장 성공을 먼저 확인한 후에만 `done = true` 설정
2. 실패 시 `showToast('⚠️', '기록 저장에 실패했습니다. 다시 시도해주세요.')` 표시
3. 실패 시 dashboard로 이동하지 않고 현재 화면 유지

#### 🟡 원인2 (30%): AI 분석 JSON 파싱 실패 → 빈 데이터로 성공 처리
**파일**: `src/index.tsx` 의 `/api/ai/credit-log` 엔드포인트 (line 689~692)

문제: Gemini가 JSON이 아닌 텍스트를 반환하면, catch 블록에서 빈 기본값으로 `success: true` 응답을 보냄.
프론트엔드는 이걸 유효한 AI 결과로 받아들여 빈 레코드 저장 시도.

```
// 문제 코드 (추정):
catch (parseError) {
  return c.json({ success: true, data: { topic: '', keywords: [], ... } });
  // ↑ 빈 데이터인데 success: true → 프론트엔드가 정상으로 판단
}
```

**수정 방향**:
1. JSON 파싱 실패 시 `success: false` + 에러 메시지 반환
2. 프론트엔드에서 `data.topic`이 비어있으면 "AI 분석 결과가 없습니다" 경고 표시

#### 🟡 원인3 (20%): Gemini 모델명 불일치 → 404 에러
**파일**: `src/index.tsx` 의 AI 호출부

문제: 코드에서 `gemini-3-flash-preview` 사용하는데, CLAUDE.md 실수노트에 따르면 정확한 모델명은 `gemini-3.0-flash`. 잘못된 모델명은 Gemini API에서 404 반환.

**수정 방향**: 모든 Gemini 모델 호출에서 모델명을 `gemini-3.0-flash`로 통일

#### 🟢 원인4 (10%): 네트워크 타임아웃
AI 분석이 90초 이상 걸려서 Cloudflare Workers 타임아웃.

### 수정 우선순위

1. **즉시**: `saveCreditLog()`에서 DB 저장 실패 시 에러 토스트 + 화면 유지 (silent fail 제거)
2. **즉시**: Gemini 모델명 확인 및 통일 (`gemini-3.0-flash`)
3. **즉시**: AI JSON 파싱 실패 시 `success: false` 반환
4. **다음**: 저장 성공 후에만 `done = true` 설정 + `_dbRecordId` 설정
5. **다음**: `syncTodayRecords()` 호출하여 DB 상태와 UI 동기화

### 수정 대상 파일 (3개)

| 파일 | 수정 내용 |
|------|---------|
| `public/modules/records/views/ai-credit-log.js` | `saveCreditLog()` 에러 처리 강화, done 설정 순서 변경 |
| `public/modules/records/core/api.js` | `saveClassRecord()` 반환값 검증, `analyzePhotos()` 에러 처리 |
| `src/index.tsx` | AI 엔드포인트 JSON 파싱 실패 시 success:false, Gemini 모델명 확인 |

### 디버깅 순서

1. `src/index.tsx`에서 Gemini 모델명 검색 → `gemini-3.0-flash`가 아닌 것 모두 수정
2. `src/index.tsx`에서 AI 엔드포인트의 JSON 파싱 catch 블록 → `success: false` 반환으로 수정
3. `ai-credit-log.js`의 `saveCreditLog()` 전체 읽기 → DB 저장 실패 시 에러 표시 추가
4. `api.js`의 `saveClassRecord()` 전체 읽기 → null 반환 시 프론트에서 처리
5. 수정 후 `npm run dev`로 로컬 테스트
6. 배포는 반드시 `npm run deploy` 사용

### 주의사항 (CLAUDE.md 규칙)
- 반드시 CLAUDE.md를 먼저 읽고 시작할 것
- Gemini 모델명: `gemini-3.0-flash`만 사용 (3.1, 2.5 등 금지)
- D1 SQLite 문법 (NOW() 금지 → datetime('now'))
- 수정 후 반드시 브라우저에서 시각적 확인 (코드만 보고 완료 선언 금지!)
- 배포: `npm run deploy` (wrangler pages deploy public 직접 실행 금지!)
- 수정 완료 후 CLAUDE.md [실수 노트] 업데이트
