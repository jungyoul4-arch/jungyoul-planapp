# SESSION_SUMMARY_20260305_QB_STEP2.md

> 이전 세션: SESSION_SUMMARY_20260305_QB_STEP1.md
> 날짜: 2026-03-05
> 작업자: Claude Code (Opus 4.6)

---

## 완료 사항

### 나의 질문함 STEP 2 — 전체 구현

#### 1. 백엔드 API 추가 (src/index.tsx)
- `PUT /api/my-questions/:qid/answer/:aid` — 답변 수정
- `DELETE /api/my-questions/:qid/answer/:aid` — 답변 삭제 (남은 답변 없으면 상태를 '미답변'으로 자동 복원)

#### 2. 프론트엔드 API 계층 (api.js)
- `DB.updateMyAnswer(questionId, answerId, content)` 추가
- `DB.deleteMyAnswer(questionId, answerId)` 추가

#### 3. 질문 입력 화면 (question-record.js)
- `state._qbInputMode` → 전체 화면 전환 (카카오 "나에게 보내기" 스타일)
- textarea (필수, 2자 이상)
- 사진 촬영/갤러리 → 1200px 리사이즈 → base64 → 미리보기 + 삭제
- 과목 태그: 0~1개 토글 선택
- 출처 태그: 1개 이상 필수, 중복 가능 (배열 → 쉼표 구분 저장)
- 등록 시 +3 XP → 목록 복귀 → 새 카드 맨 위 표시

#### 4. 카드 펼침 (expand)
- 기존 별도 상세 화면(`viewMyQuestion`) → 카드 인라인 펼침(`toggleQuestionExpand`)으로 변경
- `state._expandedQuestionId` 토글로 같은 목록에서 확장/축소
- 펼침 시: 전체 텍스트 + 사진 전체 + 답변 영역 + AI 추천 + 해결 버튼
- 상세 정보 비동기 로드 → `state._qbDetailCache[id]`에 캐시

#### 5. 답변 작성/수정/삭제
- 펼침 카드에서 [답변 작성하기] → 인라인 textarea → 저장 (+5 XP)
- 기존 답변 [수정] → textarea 전환 → 수정 저장
- 기존 답변 [삭제] → confirm → API 호출
- content 전달 시 `data-content` attribute 사용 (XSS 방지)

#### 6. 해결완료 처리
- 답변 유무와 관계없이 해결 가능
- 해결 시: `resolved=1`, 금색 테두리 2px (#f59e0b), aha-glow 애니메이션, +5 XP
- 해결 취소: confirm 대화상자 → `resolved=0`, 금색 테두리 제거

#### 7. 출처 태그 복수 지원
- 필터링: `q.source.split(',')` 후 includes 체크
- 카드 표시: 복수 출처 칩 모두 표시

#### 8. 수업 기록 → 질문 자동 연동
- `ai-credit-log.js`의 `saveCreditLog()` line 186-202에 **이미 구현되어 있음** 확인
- `DB.saveMyQuestion({ subject, source:'수업', skipXp:true })` 호출 정상

---

## 변경된 파일 목록

| 파일 | 변경 내용 |
|------|-----------|
| `src/index.tsx` | 답변 수정(PUT), 삭제(DELETE) 엔드포인트 2개 추가 |
| `public/modules/records/core/api.js` | `updateMyAnswer`, `deleteMyAnswer` 메서드 추가 |
| `public/modules/records/views/question-record.js` | STEP 2 전면 리라이트 (입력 + 펼침 + 답변 + 해결) |
| `public/modules/records/records.css` | 카드 펼침, 답변 영역, AI 섹션, 질문 입력 화면 스타일 추가 |
| `CLAUDE.md` | 실수 노트 추가 (인라인 onclick 문자열 전달 XSS 방지) |

---

## 미완료 / 다음 할 일

### STEP 3: 연결 질문 (체이닝)
1. parent_id 기반 질문 체이닝
2. 원본 질문에서 "연결 질문 달기" 기능

### 기타
3. 메인 앱(app.js) ↔ records 모듈 연동 (현재 미연결)
4. 배포: `npm run deploy` 실행 필요
5. 브라우저 실제 테스트 (dev.html)

---

## 핵심 아키텍처 메모

### 카드 펼침 방식 변경
- STEP 1: `viewMyQuestion(id)` → 별도 상세 화면 (전체 화면 전환)
- STEP 2: `toggleQuestionExpand(id)` → 인라인 펼침 (목록 내 확장)
- `state._qbDetailCache` 객체로 상세 데이터 캐시 (불필요한 재요청 방지)

### 출처 태그 저장 형식
- DB: `source TEXT` 컬럼에 쉼표 구분 문자열 (예: "수업,독서")
- 프론트: `split(',')` 파싱, 필터링 시 `includes` 체크

### 새로 추가된 state 프로퍼티
- `_qbInputMode`: 질문 입력 화면 표시 여부
- `_qbInputSubject`: 입력 화면 선택된 과목
- `_qbInputSources`: 입력 화면 선택된 출처 배열
- `_qbInputPhoto`: 입력 화면 첨부 사진 base64
- `_expandedQuestionId`: 현재 펼쳐진 카드 ID
- `_qbDetailCache`: 질문 상세 캐시 {id: detail}
- `_qbAnswerEditing`: 답변 작성/수정 중인 질문 ID
- `_qbEditingAnswerId`: 수정 중인 답변 ID
- `_qbEditingAnswerContent`: 수정 중인 답변 내용

---

*작성: 2026-03-05 Claude Code (Opus 4.6)*
