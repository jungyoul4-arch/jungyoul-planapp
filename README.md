# 고교학점플래너 - 정율사관학원

## 프로젝트 개요
- **이름**: 고교학점플래너 (HS CreditPlanner)
- **목표**: 고교학점제 시대, 학교생활의 모든 순간을 날짜별로 기록하고 생기부 경쟁력으로 전환
- **대상**: ~150명 학생, ~10명 멘토, 다중 반 지원
- **핵심 철학**: 학생이 기록한 모든 데이터는 DB에 날짜별로 차곡차곡 저장, 관리자가 언제든지 조회 가능

## URLs
- **Production**: https://credit-planner-v8.pages.dev
- **GitHub**: 배포 완료

## 완료된 기능

### 인증 시스템
- 멘토 회원가입/로그인 (`/api/auth/mentor/register`, `/api/auth/mentor/login`)
- 학생 초대코드 기반 회원가입/로그인 (`/api/auth/student/register`, `/api/auth/student/login`)
- 초대코드 검증 (`/api/auth/verify-invite/:code`)
- PWA 지원 (서비스워커, manifest, 아이콘)
- 자동 로그인 (localStorage + 서버 프로필 검증)
- 비밀번호 리셋 (`/api/admin/reset-password`)

### 학생 데이터 기록 (모두 날짜별 DB 저장)
| 기능 | API 엔드포인트 | 날짜 필드 | 비고 |
|------|---------------|-----------|------|
| 수업 기록 | `GET/POST /api/student/:id/class-records` | `date` (YYYY-MM-DD) | 과목, 키워드, 이해도, 메모 |
| 질문 코칭 | `GET/POST /api/student/:id/question-records` | `created_at` | 2축 9단계 분류, XP |
| 교학상장 | `GET/POST /api/student/:id/teach-records` | `created_at` | 가르친 학생, 주제, 성찰 |
| 과제 관리 | `GET/POST /api/student/:id/assignments` | `created_at`, `due_date` | 계획 단계별 진행률 |
| 과제 수정 | `PUT /api/student/assignments/:id` | `updated_at` | 상태, 진행률, 계획 업데이트 |
| 시험 등록 | `GET/POST /api/student/:id/exams` | `start_date`, `created_at` | 과목별 시험 범위 |
| 시험 결과 | `GET/POST /api/student/:id/exam-results` | `created_at` | 총점, 등급, 오답 분석 |
| 시험 삭제 | `DELETE /api/student/exams/:id` | - | 관련 결과/오답/이미지 cascade 삭제 |
| 활동 기록 | `GET/POST/PUT /api/student/:id/activity-records` | `created_at` | 동아리, 독서, 탐구 활동 |
| 활동 로그 | `GET/POST /api/student/:id/activity-logs` | `date` (YYYY-MM-DD) | 날짜별 개별 활동 기록 |
| 탐구보고서 | `GET/POST/PUT /api/student/:id/report-records` | `created_at` | 타임라인, 질문목록, XP |
| XP 동기화 | `POST /api/student/:id/xp-sync` | - | 디바운스 XP 동기화 + 자동 레벨 계산 |
| 프로필 조회 | `GET /api/student/:id/profile` | - | 통계 포함 (수업/질문/교학상장/활동로그 카운트) |

### 관리자/멘토 조회 API
| 기능 | API 엔드포인트 | 설명 |
|------|---------------|------|
| 학생 전체 기록 | `GET /api/mentor/student/:id/all-records?from=&to=` | 날짜별 통합 조회 (모든 기록 유형) |
| 그룹 요약 | `GET /api/mentor/groups/:id/summary?from=&to=` | 학생별 기간 내 활동 통계 |
| 테이블 내보내기 | `GET /api/admin/export/:table?from=&to=` | 14개 테이블 개별 내보내기 |
| 그룹 관리 | `GET/POST /api/mentor/:id/groups` | 반 생성, 초대코드 발급 |
| 학생 목록 | `GET /api/mentor/groups/:id/students` | 그룹별 학생 조회 |

### AI 기능
- 2축 9단계 질문 분석 (`/api/analyze` - OpenAI GPT-4o-mini)
- 소크라테스식 코칭 (`/api/coaching` - Claude)
- 이미지 분석 (`/api/image-analyze` - Gemini Flash)
- 고난도 문제 분석 (`/api/deep-analyze` - Claude)
- 시험 대비 코칭 (`/api/exam-coach` - Gemini)
- 탐구보고서 질문 진단 (`/api/report-diagnose` - Gemini)
- 탐구보고서 AI 멘토 (`/api/report-mentor` - Perplexity)

## 데이터 아키텍처

### DB 테이블 (14개)
```
mentors              - 멘토 정보
groups               - 반 정보 (초대코드)
students             - 학생 정보 (XP, 레벨)
exams                - 시험 등록
exam_results         - 시험 결과
wrong_answers        - 오답 기록
wrong_answer_images  - 오답 사진
assignments          - 과제
class_records        - 수업 기록 (날짜별)
question_records     - 질문 코칭 기록
teach_records        - 교학상장 기록
activity_records     - 활동 기록
activity_logs        - 활동 로그 (날짜별 개별 기록)
report_records       - 탐구보고서
```

### 인덱스 (날짜 기반 조회 최적화)
- `idx_class_records_date` / `idx_class_records_student_date`
- `idx_question_records_created` / `idx_teach_records_created`
- `idx_assignments_due` / `idx_assignments_student_created`
- `idx_exams_start`
- `idx_activity_logs_activity` / `idx_activity_logs_student_date`
- `idx_report_records_student`
- 외래키 기반 인덱스 (student_id, group_id 등)

### 저장소
- **D1 SQLite**: 모든 구조화된 데이터 (자동 마이그레이션)
- **이미지**: wrong_answer_images 테이블에 base64 저장 (R2 전환 가능)

## 프론트엔드 → DB 연결 현황

### 모든 저장 포인트 DB 연결 완료
- `saveClassRecordFromForm()` → `DB.saveClassRecord()`
- `completeClassRecord()` → `DB.saveClassRecord()`
- `saveQuestionToDB()` → `DB.saveQuestionRecord()`
- `saveTeachRecordFromForm()` → `DB.saveTeachRecord()`
- `saveAssignment()` → `DB.saveAssignment()`
- `togglePlanStep()` / `completeAssignment()` → `DB.updateAssignment()`
- `saveNewExam()` → `DB.saveExam()`
- `saveExamResult()` → `DB.saveExamResult()` + `DB.updateExam()`
- `deleteExam()` → `DB.deleteExam()`
- `saveNewActivity()` → `DB.saveActivityRecord()`
- `saveActivityLog()` → `DB.updateActivityRecord()` + `DB.saveActivityLog()`
- `completeActivity()` → `DB.updateActivityRecord()`
- `updateActivityProgress()` → `DB.updateActivityRecord()`
- `updateActivityStatus()` → `DB.updateActivityRecord()`
- 탐구보고서 생성 → `DB.saveReportRecord()` + `DB.saveActivityRecord()`
- 탐구보고서 질문 → `DB.updateReportRecord()`
- `showXpPopup()` → XP 디바운스 동기화 → `/api/student/:id/xp-sync`

## 테스트 계정
- **멘토**: ID `jycc_admin` / PW `jycc2026`
- **초대코드**: `JYCC-X2Z8-2ND7`
- **학생**: 이름 `곽정율` / PW `1234`

## UI/UX 기능

### 수업 기록 수정
- 완료된 수업 행 클릭 → 수정 화면 (키워드, 내용, 이해도 5단계, 메모)
- `PUT /api/student/class-records/:recordId` API로 DB 업데이트
- 수정 완료 시 "수업 기록이 수정되었어요!" 피드백

### 자동 수업 종료 감지 시스템
- `startClassEndChecker()`: 1분마다 시간표 기반 수업 종료 감지
- 수업 종료 후 0~30분: 시간표 행 glow + "기록하기" 버튼 빛나는 효과
- 인앱 알림 배너: 상단에 10초 노출, "기록하기" 바로가기
- Quick Action "수업종료 팝업" 버튼에 미기록 수 badge
- 홈 시간표 상단 미기록 경고 배너
- 저녁 시간(19~23시) "저녁 루틴" 버튼 glow

### 패드 가로/세로 반응형 UI
| 항목 | 세로모드 (Portrait) | 가로모드 (Landscape) |
|------|-------------------|---------------------|
| 네비게이션 | 하단 탭바 | 좌측 72~80px 사이드바 |
| 상태바 | 상단 표시 | 숨김 (세로공간 확보) |
| 홈 카드 | 2컬럼 | 3컬럼 (시간표 2칸 span) |
| 상세화면 | max-width 720px | max-width 900~960px |
| 기록 타입 | 2~3컬럼 | 3컬럼 넓게 |
| 성장 통계 | 2~4컬럼 | 4컬럼 |
| FAB | 우하단 | 사이드바 하단 |
| 전환 | 자동 (orientation API + resize) | CSS transition 0.35s |

**지원 기기:** iPad 10.2", iPad Air, iPad Pro 11", iPad Pro 12.9"

## 배포
- **플랫폼**: Cloudflare Pages
- **상태**: ✅ Active
- **기술스택**: Hono + TypeScript + TailwindCSS (CDN) + D1 SQLite
- **자동 마이그레이션**: `/api/migrate` 호출 시 14개 테이블 자동 생성
- **최종 업데이트**: 2026-02-21

## 향후 과제
- 시간표 데이터 DB 연동 (현재 localStorage만 사용)
- 학생 프로필 이미지 업로드 (R2 연동)
- 멘토 대시보드 실시간 데이터 연동
- 오프라인 모드 (Service Worker 캐싱 강화)
- 알림 푸시 (Web Push API)
