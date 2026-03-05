# 세션 요약 — 2026-03-06

## 완료 사항

### 1. DB 마이그레이션 (4개 테이블 추가)
- `semesters` (id, student_id, year, term, created_at)
- `subjects` (id, semester_id, name, teacher, created_at)
- `timetable_slots` (id, semester_id, subject_id, day_of_week, period, created_at)
- `exam_subjects` (id, exam_id, subject_id, exam_date, period, scope, created_at)

### 2. 백엔드 API (4개 엔드포인트)
- `GET /api/student/:id/semesters` — 학생 학기 목록
- `GET /api/student/:id/subjects?year=&term=` — 학기별 과목+시간표 슬롯
- `POST /api/student/:id/timetable/photo` — 시간표 사진 AI 분석 (Gemini 3 Flash Preview)
- `POST /api/student/:id/timetable/confirm` — 분석 결과 확인 후 DB 저장

### 3. 프론트엔드 — 시간표 온보딩 플로우
- 로그인 후 semesters가 비어있으면 자동으로 `timetable-onboarding` 화면 이동
- 5단계 흐름: intro → photo → loading → confirm → done
- 인라인 onclick + 전역 함수 패턴 사용 (initStudentEvents 방식은 동작 안 함)
- 모든 `renderScreen()` 호출을 `renderScreen(true)`로 변경 (skipFullRender 우회)

### 4. 시간표 관리 화면 연동
- AI 분석 저장 시 `state.timetable.school`, `teachers`, `subjectColors` 동기화
- `DB.saveTimetable()` 호출로 localStorage/API 저장
- "시간표 사진으로 자동 입력" 버튼 추가 (시간표 관리 화면에서 바로 사진 촬영 가능)
- 완료 후 시간표 관리 화면으로 자동 복귀

### 5. 편집/완료 버튼 수정
- `selectTtCell`, `setTtSubject`, 편집/완료 토글 → `renderScreen(true)` 적용

## 핵심 버그 및 해결

| 문제 | 원인 | 해결 |
|------|------|------|
| 온보딩 버튼 클릭 무반응 | `renderScreen()`의 `skipFullRender` 최적화. `renderKey`에 서브상태(`_ttOnboardingStep` 등) 미포함 → DOM 업데이트 스킵 | `renderScreen(true)` (force) 사용 |
| 라우터 충돌 (undefined 표시) | `startsWith('onboarding')`이 `'timetable-onboarding'`도 매칭 | 구체적 매칭을 앞에 배치 |
| AI 분석 502 에러 | `.dev.vars`에 `ANTHROPIC_API_KEY` 미설정 | Claude Vision → Gemini Vision 전환 |
| AI 분석 404 에러 | `gemini-3-flash` 모델명 오류 | `gemini-3-flash-preview`로 수정 |
| 시간표 관리에 반영 안 됨 | DB 저장만 하고 `state.timetable.school` 미업데이트 | 저장 시 state 동기화 + `DB.saveTimetable()` 추가 |

## 변경 파일
- `src/index.tsx` — DB 마이그레이션, API 4개, Gemini Vision 연동
- `public/static/app.js` — 온보딩 플로우, 시간표 관리 연동, renderScreen(true) 수정
- `CLAUDE.md` — 실수 노트 업데이트
- `.dev.vars` — GEMINI_API_KEY 추가

## 미완료 / 다음 할 일
- 프로덕션 배포 (wrangler pages deploy)
- 프로덕션 환경변수 설정 (GEMINI_API_KEY)
- 실제 학생 시간표 사진으로 AI 분석 정확도 테스트
- 온보딩 완료 후 재진입 방지 (이미 semesters 있으면 스킵)
- 학원 시간표 사진 분석 기능 (현재 수동 입력만 가능)

## 브랜치
- `feature/timetable-subjects`
