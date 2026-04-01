-- ============================================================
--  고교학점플래너 (HS CreditPlanner) — 전체 통합 DB 스키마
--  작성일: 2026-02-23
--  대상: PostgreSQL / MySQL / SQLite 호환 (SQLite 기준 작성)
--
--  ★ = 기존 D1 테이블 (이미 운영 중)
--  ● = 신규 테이블 (하드코딩 → DB 이관 필요)
-- ============================================================


-- ============================================================
--  카테고리 1: 사용자 & 인증
-- ============================================================

-- ★ 멘토(선생님) 계정
CREATE TABLE IF NOT EXISTS mentors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id        TEXT    UNIQUE NOT NULL,          -- 로그인 아이디
  password_hash   TEXT    NOT NULL,                 -- bcrypt 해시
  name            TEXT    NOT NULL,                 -- 실명
  academy_name    TEXT    DEFAULT '',               -- 소속 학원명
  phone           TEXT    DEFAULT '',               -- 연락처
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ★ 학원/반 그룹
CREATE TABLE IF NOT EXISTS groups (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id       INTEGER NOT NULL,                 -- FK → mentors.id
  name            TEXT    NOT NULL,                 -- 그룹명 (예: "고2 수학반")
  invite_code     TEXT    UNIQUE NOT NULL,          -- 학생 초대 코드
  description     TEXT    DEFAULT '',
  max_students    INTEGER DEFAULT 30,
  is_active       INTEGER DEFAULT 1,               -- 0=비활성
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id)
);

-- ★ 학생 계정
CREATE TABLE IF NOT EXISTS students (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id        INTEGER NOT NULL,                 -- FK → groups.id
  name            TEXT    NOT NULL,
  password_hash   TEXT    NOT NULL,
  school_name     TEXT    DEFAULT '',               -- 학교명
  grade           INTEGER DEFAULT 1,               -- 학년 (1,2,3)
  class_number    TEXT    DEFAULT '',               -- ● 반 (예: "2-3")
  profile_emoji   TEXT    DEFAULT '😊',
  xp              INTEGER DEFAULT 0,               -- 누적 경험치
  level           INTEGER DEFAULT 1,               -- 레벨 (XP/100+1)
  streak          INTEGER DEFAULT 0,               -- ● 연속 기록 일수
  streak_last_date TEXT   DEFAULT '',               -- ● 마지막 기록 날짜 (YYYY-MM-DD)
  mood            TEXT    DEFAULT '',               -- ● 오늘의 기분 이모지
  mood_date       TEXT    DEFAULT '',               -- ● 기분 기록 날짜
  is_active       INTEGER DEFAULT 1,
  last_login_at   DATETIME,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id)
);


-- ============================================================
--  카테고리 2: 학교 시간표 & 학원 스케줄 (● 전부 신규)
-- ============================================================

-- ● 학교 시간표 (학생별, 요일×교시)
-- 예: student_id=1, day_index=0(월), period=1, subject='국어'
CREATE TABLE IF NOT EXISTS student_timetable (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  day_index       INTEGER NOT NULL,                 -- 0=월, 1=화, 2=수, 3=목, 4=금
  period          INTEGER NOT NULL,                 -- 교시 (1~9)
  subject         TEXT    NOT NULL DEFAULT '',      -- 과목명 (빈 문자열 = 공강)
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, day_index, period)             -- 학생+요일+교시 유니크
);

-- ● 과목별 선생님 매핑 (학생별)
CREATE TABLE IF NOT EXISTS student_teachers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  subject         TEXT    NOT NULL,                 -- 과목명
  teacher_name    TEXT    NOT NULL DEFAULT '',      -- 선생님 이름
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject)
);

-- ● 과목 색상 (학생별 커스텀)
CREATE TABLE IF NOT EXISTS student_subject_colors (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  subject         TEXT    NOT NULL,
  color           TEXT    NOT NULL DEFAULT '#6C5CE7', -- HEX 색상
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject)
);

-- ● 교시별 시간 설정 (학교별 상이 → 학생별 저장)
CREATE TABLE IF NOT EXISTS student_period_times (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  period          INTEGER NOT NULL,                 -- 교시 번호 (1~9)
  start_time      TEXT    NOT NULL,                 -- 'HH:MM' (예: '08:30')
  end_time        TEXT    NOT NULL,                 -- 'HH:MM' (예: '09:20')
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, period)
);

-- ● 학원 스케줄
CREATE TABLE IF NOT EXISTS student_academy (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  name            TEXT    NOT NULL,                 -- 수업명 (예: "수학 심화반")
  academy_name    TEXT    NOT NULL DEFAULT '',      -- 학원명 (예: "대치 수학학원")
  day             TEXT    NOT NULL,                 -- 요일 ('월','화','수','목','금','토','일')
  slot            INTEGER NOT NULL DEFAULT 1,       -- 같은 요일 내 순서 (1,2,3...)
  start_time      TEXT    NOT NULL,                 -- 'HH:MM'
  end_time        TEXT    NOT NULL,                 -- 'HH:MM'
  subject         TEXT    NOT NULL DEFAULT '',      -- 과목
  color           TEXT    NOT NULL DEFAULT '#E056A0',
  memo            TEXT    DEFAULT '',
  is_active       INTEGER DEFAULT 1,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 3: 급우 (교학상장 대상) (● 신규)
-- ============================================================

CREATE TABLE IF NOT EXISTS student_classmates (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,                 -- 등록한 학생
  classmate_name  TEXT    NOT NULL,                 -- 급우 이름
  classmate_grade TEXT    DEFAULT '',               -- 급우 학년-반 (예: "2-3")
  memo            TEXT    DEFAULT '',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 4: 수업 기록 & 사진
-- ============================================================

-- ★ 수업 기록 (학교 + 학원 통합)
CREATE TABLE IF NOT EXISTS class_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  subject         TEXT    NOT NULL,                 -- 과목
  date            TEXT    NOT NULL,                 -- 'YYYY-MM-DD'
  period          INTEGER DEFAULT NULL,             -- ● 교시 번호 (학원이면 NULL)
  is_academy      INTEGER DEFAULT 0,               -- ● 0=학교, 1=학원
  academy_id      INTEGER DEFAULT NULL,             -- ● FK → student_academy.id (학원 기록 시)
  content         TEXT    DEFAULT '',               -- 수업 내용 요약
  keywords        TEXT    DEFAULT '[]',             -- JSON 배열: ["키워드1","키워드2"]
  understanding   INTEGER DEFAULT 3,               -- 이해도 (1~5)
  memo            TEXT    DEFAULT '',
  topic           TEXT    DEFAULT '',               -- 단원/주제
  pages           TEXT    DEFAULT '',               -- 교재 페이지
  photos          TEXT    DEFAULT '[]',             -- JSON: 사진 ID 배열
  teacher_note    TEXT    DEFAULT '',               -- 선생님 메모
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (academy_id) REFERENCES student_academy(id) ON DELETE SET NULL
);

-- ★ 수업 기록 사진 (별도 저장)
CREATE TABLE IF NOT EXISTS class_record_photos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  class_record_id INTEGER,                          -- FK → class_records.id
  photo_data      TEXT    NOT NULL,                 -- base64 인코딩 이미지
  thumbnail       TEXT    DEFAULT '',               -- 썸네일 base64
  mime_type       TEXT    DEFAULT 'image/jpeg',
  file_size       INTEGER DEFAULT 0,               -- 바이트
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_record_id) REFERENCES class_records(id) ON DELETE SET NULL
);


-- ============================================================
--  카테고리 5: 과제 관리
-- ============================================================

-- ★ 과제
CREATE TABLE IF NOT EXISTS assignments (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  subject         TEXT    NOT NULL,
  title           TEXT    NOT NULL,
  description     TEXT    DEFAULT '',
  type            TEXT    DEFAULT '과제',            -- ● 유형 (문제풀이/보고서/감상문/...)
  teacher_name    TEXT    DEFAULT '',
  due_date        TEXT    NOT NULL,                 -- 'YYYY-MM-DD'
  created_date    TEXT    DEFAULT '',               -- ● 생성일
  status          TEXT    DEFAULT 'pending',        -- 'pending'|'in-progress'|'completed'
  progress        INTEGER DEFAULT 0,               -- 0~100
  color           TEXT    DEFAULT '#6C5CE7',
  plan_data       TEXT    DEFAULT '[]',             -- JSON: [{step,title,date,done}]
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 6: 시험 관리
-- ============================================================

-- ★ 시험 일정
CREATE TABLE IF NOT EXISTS exams (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  name            TEXT    NOT NULL,                 -- "1학기 중간고사"
  type            TEXT    NOT NULL DEFAULT 'midterm', -- 'midterm'|'final'|'mock'|'performance'
  start_date      TEXT    NOT NULL,                 -- 시작일
  end_date        TEXT    DEFAULT '',               -- ● 종료일
  subjects        TEXT    NOT NULL DEFAULT '[]',    -- JSON: [{subject,date,time,range,readiness,notes,color}]
  status          TEXT    DEFAULT 'upcoming',       -- 'upcoming'|'in-progress'|'completed'
  memo            TEXT    DEFAULT '',
  ai_plan         TEXT    DEFAULT '',               -- ● 정율 AI 학습계획 JSON
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ★ 시험 결과
CREATE TABLE IF NOT EXISTS exam_results (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id         INTEGER NOT NULL UNIQUE,
  student_id      INTEGER NOT NULL,
  total_score     INTEGER,
  grade           INTEGER,                          -- 등급 (1~9)
  subjects_data   TEXT    NOT NULL DEFAULT '[]',    -- JSON: [{subject,score,grade,reflection,wrongAnswers}]
  overall_reflection TEXT DEFAULT '',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ★ 오답 기록
CREATE TABLE IF NOT EXISTS wrong_answers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_result_id  INTEGER NOT NULL,
  student_id      INTEGER NOT NULL,
  subject         TEXT    NOT NULL,
  question_number INTEGER,
  topic           TEXT    DEFAULT '',
  error_type      TEXT    DEFAULT '',               -- 오답 유형 (계산실수/개념부족/...)
  my_answer       TEXT    DEFAULT '',
  correct_answer  TEXT    DEFAULT '',
  reason          TEXT    DEFAULT '',               -- 틀린 이유
  reflection      TEXT    DEFAULT '',               -- 반성/다짐
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_result_id) REFERENCES exam_results(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ★ 오답 이미지
CREATE TABLE IF NOT EXISTS wrong_answer_images (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  wrong_answer_id INTEGER NOT NULL,
  image_data      TEXT    NOT NULL,                 -- base64
  sort_order      INTEGER DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wrong_answer_id) REFERENCES wrong_answers(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 7: 질문 코칭 & 교학상장
-- ============================================================

-- ★ 질문 코칭 기록 (소크라테스식 AI 대화)
CREATE TABLE IF NOT EXISTS question_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  subject         TEXT    NOT NULL,
  question_text   TEXT    NOT NULL,                 -- 학생 질문 원문
  question_level  TEXT    DEFAULT '',               -- 'A-1', 'B-2', 'C-3' 등
  question_label  TEXT    DEFAULT '',               -- 수준 라벨 (표면적/구조적/...)
  axis            TEXT    DEFAULT 'curiosity',      -- 'curiosity'|'meta' (2축 코칭)
  coaching_messages TEXT  DEFAULT '[]',             -- JSON: AI 코칭 대화 전체 배열
  xp_earned       INTEGER DEFAULT 0,
  is_complete     INTEGER DEFAULT 0,               -- 0=진행중, 1=완료
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ★ 교학상장 (가르치기) 기록
CREATE TABLE IF NOT EXISTS teach_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  subject         TEXT    NOT NULL,
  topic           TEXT    NOT NULL,                 -- 가르친 주제
  taught_to       TEXT    DEFAULT '',               -- 누구에게 가르쳤는지
  content         TEXT    DEFAULT '',               -- 가르친 내용
  reflection      TEXT    DEFAULT '',               -- 가르친 후 성찰
  xp_earned       INTEGER DEFAULT 0,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 8: 비교과 활동 (창체/독서/탐구보고서)
-- ============================================================

-- ★ 활동 기록 (마스터)
CREATE TABLE IF NOT EXISTS activity_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  activity_type   TEXT    DEFAULT '',               -- 'club'|'career'|'self'|'report'|'reading'
  sub_type        TEXT    DEFAULT '',               -- ● 세부 유형
  title           TEXT    NOT NULL,
  subject         TEXT    DEFAULT '',               -- ● 관련 과목
  description     TEXT    DEFAULT '',
  start_date      TEXT,
  end_date        TEXT,
  status          TEXT    DEFAULT 'in-progress',    -- 'pending'|'in-progress'|'completed'
  progress        INTEGER DEFAULT 0,               -- 0~100
  color           TEXT    DEFAULT '#00CEC9',        -- ● HEX 색상
  reflection      TEXT    DEFAULT '',
  career_link     TEXT    DEFAULT '',               -- ● 진로 연계 설명
  memo            TEXT    DEFAULT '',               -- ● 메모
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ★ 활동 로그 (날짜별 세부 기록)
CREATE TABLE IF NOT EXISTS activity_logs (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  activity_record_id INTEGER NOT NULL,
  student_id        INTEGER NOT NULL,
  date              TEXT    NOT NULL,               -- 'YYYY-MM-DD'
  content           TEXT    NOT NULL DEFAULT '',
  reflection        TEXT    DEFAULT '',
  duration          TEXT    DEFAULT '',             -- '1시간', '~50쪽' 등
  xp_earned         INTEGER DEFAULT 0,
  created_at        DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (activity_record_id) REFERENCES activity_records(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ★ 탐구보고서
CREATE TABLE IF NOT EXISTS report_records (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  activity_id     INTEGER DEFAULT NULL,             -- ● FK → activity_records.id (연결)
  title           TEXT    NOT NULL,
  subject         TEXT    DEFAULT '',
  current_phase   INTEGER DEFAULT 0,               -- ● 현재 Phase (0~4)
  phases          TEXT    DEFAULT '[]',             -- ● JSON: [{id,name,status}]
  timeline        TEXT    DEFAULT '[]',             -- JSON: 타임라인 이벤트 배열
  questions       TEXT    DEFAULT '[]',             -- JSON: 질문 기록 배열
  total_xp        INTEGER DEFAULT 0,
  status          TEXT    DEFAULT 'in-progress',
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES activity_records(id) ON DELETE SET NULL
);


-- ============================================================
--  카테고리 9: 나만의 질문방
-- ============================================================

-- ★ 질문 게시
CREATE TABLE IF NOT EXISTS my_questions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  subject         TEXT    DEFAULT '기타',
  class_record_id INTEGER DEFAULT NULL,             -- 수업 기록에서 파생된 질문
  title           TEXT    NOT NULL,
  content         TEXT    DEFAULT '',
  image_key       TEXT    DEFAULT NULL,             -- 이미지 스토리지 키
  thumbnail_key   TEXT    DEFAULT NULL,
  status          TEXT    DEFAULT '미답변',          -- '미답변'|'답변완료'
  question_level  TEXT    DEFAULT NULL,             -- 질문 수준
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (class_record_id) REFERENCES class_records(id) ON DELETE SET NULL
);

-- ★ 답변
CREATE TABLE IF NOT EXISTS my_answers (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  question_id     INTEGER NOT NULL,
  student_id      INTEGER NOT NULL,                 -- 답변한 학생 (멘토일 수도)
  content         TEXT    DEFAULT '',
  image_key       TEXT    DEFAULT NULL,
  resolve_hours   REAL    DEFAULT NULL,             -- 해결까지 걸린 시간
  resolve_days    INTEGER DEFAULT NULL,             -- 해결까지 걸린 일수
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (question_id) REFERENCES my_questions(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 10: XP & 게이미피케이션
-- ============================================================

-- ★ XP 내역 기록
CREATE TABLE IF NOT EXISTS xp_history (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  amount          INTEGER NOT NULL,                 -- 획득 XP
  source          TEXT    NOT NULL,                 -- '수업 기록'|'질문 코칭'|'교학상장'|...
  source_detail   TEXT    DEFAULT '',               -- 상세 (과목명 등)
  ref_table       TEXT    DEFAULT NULL,             -- 참조 테이블명
  ref_id          INTEGER DEFAULT NULL,             -- 참조 레코드 ID
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);

-- ● 미션 (일일/주간 미션 정의 & 달성)
CREATE TABLE IF NOT EXISTS student_missions (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  date            TEXT    NOT NULL,                 -- 'YYYY-MM-DD'
  mission_key     TEXT    NOT NULL,                 -- 'class_record_3'|'question_1'|'teach_1'
  mission_text    TEXT    NOT NULL,                 -- '수업 기록 3개 이상'
  icon            TEXT    DEFAULT '📝',
  target          INTEGER NOT NULL DEFAULT 1,       -- 목표 수치
  current         INTEGER DEFAULT 0,               -- 현재 달성 수치
  is_done         INTEGER DEFAULT 0,               -- 0/1
  xp_reward       INTEGER DEFAULT 0,               -- 미션 완료 시 보상 XP
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, date, mission_key)
);


-- ============================================================
--  카테고리 11: 플래너 일정 (● 신규)
-- ============================================================

-- ● 통합 플래너 아이템
CREATE TABLE IF NOT EXISTS planner_items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  date            TEXT    NOT NULL,                 -- 'YYYY-MM-DD'
  start_time      TEXT    NOT NULL,                 -- 'HH:MM'
  end_time        TEXT    NOT NULL,                 -- 'HH:MM'
  title           TEXT    NOT NULL,
  category        TEXT    NOT NULL DEFAULT 'class', -- 'routine'|'class'|'assignment'|'explore'|'study'|'activity'|'teach'|'personal'
  color           TEXT    DEFAULT '#6C5CE7',
  icon            TEXT    DEFAULT '📝',
  detail          TEXT    DEFAULT '',               -- 부가 설명
  is_done         INTEGER DEFAULT 0,               -- 0/1
  is_ai_generated INTEGER DEFAULT 0,               -- 0/1 (정율 AI 배치 여부)
  assignment_id   INTEGER DEFAULT NULL,             -- FK → assignments.id (과제 연동 시)
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  FOREIGN KEY (assignment_id) REFERENCES assignments(id) ON DELETE SET NULL
);

-- ● 플래너 AI 대화 기록
CREATE TABLE IF NOT EXISTS planner_ai_messages (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  role            TEXT    NOT NULL DEFAULT 'ai',    -- 'ai'|'user'
  message_text    TEXT    NOT NULL,
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 12: 알림 (● 신규)
-- ============================================================

CREATE TABLE IF NOT EXISTS notifications (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  icon            TEXT    DEFAULT '🔔',
  title           TEXT    NOT NULL,
  description     TEXT    DEFAULT '',
  bg_color        TEXT    DEFAULT 'rgba(108,92,231,0.15)',
  is_read         INTEGER DEFAULT 0,               -- 0=안읽음, 1=읽음
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 13: Quick Todo (● 신규 — localStorage → DB 이관)
-- ============================================================

CREATE TABLE IF NOT EXISTS student_quick_todos (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  text            TEXT    NOT NULL,
  is_done         INTEGER DEFAULT 0,
  sort_order      INTEGER DEFAULT 0,               -- 정렬 순서
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
);


-- ============================================================
--  카테고리 14: 주간/통계 데이터 (● 신규 — 집계 캐시)
-- ============================================================

-- ● 일별 기록 집계 (대시보드 빠른 조회용)
CREATE TABLE IF NOT EXISTS daily_stats (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id      INTEGER NOT NULL,
  date            TEXT    NOT NULL,                 -- 'YYYY-MM-DD'
  class_records_count   INTEGER DEFAULT 0,          -- 수업 기록 수
  questions_count       INTEGER DEFAULT 0,          -- 질문 수
  teach_count           INTEGER DEFAULT 0,          -- 교학상장 수
  assignments_done      INTEGER DEFAULT 0,          -- 과제 완료 수
  total_xp_earned       INTEGER DEFAULT 0,          -- 해당일 획득 XP
  created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
  UNIQUE(student_id, date)
);


-- ============================================================
--  인덱스 (성능 최적화)
-- ============================================================

-- 사용자/그룹
CREATE INDEX IF NOT EXISTS idx_groups_mentor        ON groups(mentor_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite         ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_students_group        ON students(group_id);
CREATE INDEX IF NOT EXISTS idx_students_name_group   ON students(name, group_id);

-- 시간표/학원
CREATE INDEX IF NOT EXISTS idx_timetable_student     ON student_timetable(student_id);
CREATE INDEX IF NOT EXISTS idx_timetable_student_day ON student_timetable(student_id, day_index);
CREATE INDEX IF NOT EXISTS idx_teachers_student      ON student_teachers(student_id);
CREATE INDEX IF NOT EXISTS idx_period_times_student  ON student_period_times(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_student       ON student_academy(student_id);
CREATE INDEX IF NOT EXISTS idx_academy_student_day   ON student_academy(student_id, day);

-- 급우
CREATE INDEX IF NOT EXISTS idx_classmates_student    ON student_classmates(student_id);

-- 수업 기록
CREATE INDEX IF NOT EXISTS idx_class_records_student      ON class_records(student_id);
CREATE INDEX IF NOT EXISTS idx_class_records_date         ON class_records(date);
CREATE INDEX IF NOT EXISTS idx_class_records_student_date ON class_records(student_id, date);
CREATE INDEX IF NOT EXISTS idx_crp_student                ON class_record_photos(student_id);
CREATE INDEX IF NOT EXISTS idx_crp_record                 ON class_record_photos(class_record_id);

-- 과제
CREATE INDEX IF NOT EXISTS idx_assignments_student         ON assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_due             ON assignments(due_date);
CREATE INDEX IF NOT EXISTS idx_assignments_student_created ON assignments(student_id, created_at);

-- 시험
CREATE INDEX IF NOT EXISTS idx_exams_student         ON exams(student_id);
CREATE INDEX IF NOT EXISTS idx_exams_start           ON exams(start_date);
CREATE INDEX IF NOT EXISTS idx_exam_results_student  ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam     ON exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_result  ON wrong_answers(exam_result_id);

-- 질문/교학상장
CREATE INDEX IF NOT EXISTS idx_question_records_student  ON question_records(student_id);
CREATE INDEX IF NOT EXISTS idx_question_records_created  ON question_records(created_at);
CREATE INDEX IF NOT EXISTS idx_teach_records_student     ON teach_records(student_id);
CREATE INDEX IF NOT EXISTS idx_teach_records_created     ON teach_records(created_at);

-- 비교과 활동
CREATE INDEX IF NOT EXISTS idx_activity_records_student      ON activity_records(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_activity        ON activity_logs(activity_record_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_student_date    ON activity_logs(student_id, date);
CREATE INDEX IF NOT EXISTS idx_report_records_student        ON report_records(student_id);

-- 나만의 질문방
CREATE INDEX IF NOT EXISTS idx_my_questions_student   ON my_questions(student_id);
CREATE INDEX IF NOT EXISTS idx_my_questions_status    ON my_questions(student_id, status);
CREATE INDEX IF NOT EXISTS idx_my_questions_subject   ON my_questions(student_id, subject);
CREATE INDEX IF NOT EXISTS idx_my_answers_question    ON my_answers(question_id);

-- XP & 미션
CREATE INDEX IF NOT EXISTS idx_xp_history_student     ON xp_history(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_missions_student_date  ON student_missions(student_id, date);

-- 플래너
CREATE INDEX IF NOT EXISTS idx_planner_student        ON planner_items(student_id);
CREATE INDEX IF NOT EXISTS idx_planner_student_date   ON planner_items(student_id, date);
CREATE INDEX IF NOT EXISTS idx_planner_ai_student     ON planner_ai_messages(student_id);

-- 알림
CREATE INDEX IF NOT EXISTS idx_notifications_student  ON notifications(student_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_unread   ON notifications(student_id, is_read);

-- Quick Todo
CREATE INDEX IF NOT EXISTS idx_quick_todos_student    ON student_quick_todos(student_id);

-- 일별 통계
CREATE INDEX IF NOT EXISTS idx_daily_stats_student_date ON daily_stats(student_id, date);
