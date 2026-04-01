-- ==================== 멘토 (선생님) ====================
CREATE TABLE IF NOT EXISTS mentors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  login_id TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  academy_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ==================== 그룹 (반) ====================
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mentor_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  invite_code TEXT UNIQUE NOT NULL,
  description TEXT DEFAULT '',
  max_students INTEGER DEFAULT 30,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mentor_id) REFERENCES mentors(id)
);

-- ==================== 학생 ====================
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  school_name TEXT DEFAULT '',
  grade INTEGER DEFAULT 1,
  profile_emoji TEXT DEFAULT '😊',
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,
  last_login_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES groups(id)
);

-- ==================== 시험 ====================
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'midterm',
  start_date TEXT NOT NULL,
  subjects TEXT NOT NULL DEFAULT '[]',
  status TEXT DEFAULT 'upcoming',
  memo TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ==================== 시험 결과 ====================
CREATE TABLE IF NOT EXISTS exam_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL UNIQUE,
  student_id INTEGER NOT NULL,
  total_score INTEGER,
  grade INTEGER,
  subjects_data TEXT NOT NULL DEFAULT '[]',
  overall_reflection TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_id) REFERENCES exams(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ==================== 오답 기록 ====================
CREATE TABLE IF NOT EXISTS wrong_answers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_result_id INTEGER NOT NULL,
  student_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  question_number INTEGER,
  topic TEXT DEFAULT '',
  error_type TEXT DEFAULT '',
  my_answer TEXT DEFAULT '',
  correct_answer TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  reflection TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (exam_result_id) REFERENCES exam_results(id),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ==================== 오답 사진 ====================
CREATE TABLE IF NOT EXISTS wrong_answer_images (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wrong_answer_id INTEGER NOT NULL,
  image_data TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (wrong_answer_id) REFERENCES wrong_answers(id)
);

-- ==================== 과제 ====================
CREATE TABLE IF NOT EXISTS assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  teacher_name TEXT DEFAULT '',
  due_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  progress INTEGER DEFAULT 0,
  color TEXT DEFAULT '#6C5CE7',
  plan_data TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ==================== 수업 기록 ====================
CREATE TABLE IF NOT EXISTS class_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  date TEXT NOT NULL,
  content TEXT DEFAULT '',
  keywords TEXT DEFAULT '[]',
  understanding INTEGER DEFAULT 3,
  memo TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ==================== 질문 코칭 기록 ====================
CREATE TABLE IF NOT EXISTS question_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  question_text TEXT NOT NULL,
  question_level TEXT DEFAULT '',
  question_label TEXT DEFAULT '',
  axis TEXT DEFAULT 'curiosity',
  coaching_messages TEXT DEFAULT '[]',
  xp_earned INTEGER DEFAULT 0,
  is_complete INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ==================== 교학상장 (가르침 기록) ====================
CREATE TABLE IF NOT EXISTS teach_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  subject TEXT NOT NULL,
  topic TEXT NOT NULL,
  taught_to TEXT DEFAULT '',
  content TEXT DEFAULT '',
  reflection TEXT DEFAULT '',
  xp_earned INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ==================== 창의적 체험활동 ====================
CREATE TABLE IF NOT EXISTS activity_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  activity_type TEXT DEFAULT '',
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  start_date TEXT,
  end_date TEXT,
  status TEXT DEFAULT 'in-progress',
  progress INTEGER DEFAULT 0,
  reflection TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- ==================== 인덱스 ====================
CREATE INDEX IF NOT EXISTS idx_groups_mentor ON groups(mentor_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_students_group ON students(group_id);
CREATE INDEX IF NOT EXISTS idx_students_name_group ON students(name, group_id);
CREATE INDEX IF NOT EXISTS idx_exams_student ON exams(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id);
CREATE INDEX IF NOT EXISTS idx_wrong_answers_result ON wrong_answers(exam_result_id);
CREATE INDEX IF NOT EXISTS idx_assignments_student ON assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_class_records_student ON class_records(student_id);
CREATE INDEX IF NOT EXISTS idx_question_records_student ON question_records(student_id);
CREATE INDEX IF NOT EXISTS idx_teach_records_student ON teach_records(student_id);
CREATE INDEX IF NOT EXISTS idx_activity_records_student ON activity_records(student_id);
