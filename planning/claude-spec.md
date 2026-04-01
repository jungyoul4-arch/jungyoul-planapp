# 플랜앱 교학상장 소통창구 — 통합 스펙

## 1. 프로젝트 개요

### 목적
플랜앱(고교학점플래너) 사용 학생들이 서로 소통하고, 교학상장(서로 가르치고 배우는) 문화를 자연스럽게 형성할 수 있는 게시판 기반 소통 공간을 만든다.

### 대상 사용자
- **학생**: ~150명, 정율사관학원 소속, 여러 반(그룹)에 분산
- **멘토**: ~10명, 각 반 담당. 게시판에 전체 참여 가능

### 핵심 결정사항
- **소통 형태**: 게시판 (에브리타임 스타일, 비동기 글+댓글)
- **실시간 채팅 없음**: Durable Objects/WebSocket 불필요. D1만으로 구현
- **XP 연동 없음**: 게시판은 순수 소통 목적
- **닉네임 사용**: 실명 대신 닉네임으로 활동

## 2. 기능 상세

### 2.1 게시판 시스템

#### 게시판 구조
- **반(그룹)별 게시판**: 각 그룹에 전용 게시판. 해당 반 학생+담당 멘토만 접근
- **학원 전체 게시판**: 같은 학원(academy) 모든 학생+멘토 접근 가능
- 학생은 자신의 반 게시판 + 전체 게시판 접근
- 멘토는 자신이 관리하는 모든 반 게시판 + 전체 게시판 접근

#### 게시글 기능
- **리치 텍스트 작성**: 굵은 글씨, 기울임, 링크, 줄바꿈 등 기본 서식
- **사진 첨부**: 이미지 업로드 지원 (기존 R2/base64 패턴 활용)
- **좋아요**: 게시글에 좋아요 기능
- **댓글**: 게시글에 댓글 작성 (텍스트만 또는 텍스트+이미지)
- **작성자 표시**: 닉네임 + 프로필 이모지

#### 게시글 목록
- 최신순 정렬
- 게시글 미리보기 (제목, 내용 일부, 좋아요 수, 댓글 수)
- 무한 스크롤 또는 페이지네이션

### 2.2 닉네임 시스템

- 학생/멘토가 별도 닉네임 설정
- 게시판 활동 시 닉네임 + 프로필 이모지로 표시
- 닉네임 미설정 시 기본값 (예: "학생123", "멘토_이름")
- 닉네임 중복 허용 여부: 학원 내 유니크 권장

### 2.3 친구 초대

- **초대 범위**: 같은 학원(academy) 내 다른 반 학생도 초대 가능
- **초대 방식**: 초대 코드 또는 링크
- **초대 수락/거절**: 받는 사람이 수락 또는 거절
- **친구 목록**: 연결된 친구 목록 관리
- **용도**: 친구의 선택적 학습 현황 공유 열람, 향후 DM 등 확장 가능

### 2.4 학습 현황 공유

- **선택적 공유**: 사용자가 공유할 항목을 직접 지정
- **공유 가능 항목 예시**:
  - 수업 기록 요약 (과목, 기록 수)
  - 교학상장 활동 (가르친 횟수)
  - 미션 달성 현황
  - XP/레벨
- **공유 대상**: 친구로 연결된 사람만 열람 가능
- **프로필 형태**: 간단한 학습 프로필 카드

### 2.5 모더레이션

- **멘토 삭제권**: 멘토가 부적절한 게시글/댓글 삭제 가능
- **학생 신고**: 학생이 부적절한 콘텐츠 신고 가능
- **신고 처리**: 멘토가 신고된 콘텐츠 검토 후 조치
- **본인 삭제**: 자신이 작성한 글/댓글 삭제 가능

## 3. 기술 아키텍처

### 기술 스택 (기존과 동일)
- **백엔드**: Hono + TypeScript (Cloudflare Workers)
- **DB**: Cloudflare D1 (SQLite)
- **프론트엔드**: Vanilla JS + TailwindCSS CDN
- **이미지 저장**: class_record_photos 테이블 패턴 재활용 또는 R2

### UI 위치
- 기존 앱 하단 탭바에 **'소통' 탭** 추가
- 현재 탭: home, my, growth, archive → **home, community, my, growth, archive**
- app.js 내 `studentTab` 상태에 `'community'` 추가

### DB 스키마 (신규 테이블)

```sql
-- 닉네임 관리 (students/mentors 테이블에 nickname 컬럼 추가)
ALTER TABLE students ADD COLUMN nickname TEXT;
ALTER TABLE mentors ADD COLUMN nickname TEXT;

-- 게시판 정의
CREATE TABLE community_boards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_type TEXT NOT NULL,        -- 'group' | 'academy'
  group_id INTEGER,                 -- group 게시판일 경우 FK
  academy_name TEXT,                -- academy 게시판일 경우
  name TEXT NOT NULL,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','+9 hours'))
);

-- 게시글
CREATE TABLE community_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  board_id INTEGER NOT NULL,
  author_type TEXT NOT NULL,        -- 'student' | 'mentor'
  author_id INTEGER NOT NULL,
  title TEXT,
  content TEXT NOT NULL,            -- 리치 텍스트 (HTML or Markdown)
  like_count INTEGER DEFAULT 0,
  comment_count INTEGER DEFAULT 0,
  is_deleted INTEGER DEFAULT 0,     -- soft delete
  deleted_by INTEGER,               -- 삭제한 사람 (본인 또는 멘토)
  created_at TEXT DEFAULT (datetime('now','+9 hours')),
  updated_at TEXT DEFAULT (datetime('now','+9 hours'))
);

-- 게시글 사진
CREATE TABLE community_post_photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  photo_data TEXT NOT NULL,          -- base64 또는 R2 key
  thumbnail TEXT,
  mime_type TEXT,
  file_size INTEGER,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','+9 hours')),
  FOREIGN KEY (post_id) REFERENCES community_posts(id)
);

-- 댓글
CREATE TABLE community_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  author_type TEXT NOT NULL,        -- 'student' | 'mentor'
  author_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  is_deleted INTEGER DEFAULT 0,
  deleted_by INTEGER,
  created_at TEXT DEFAULT (datetime('now','+9 hours')),
  FOREIGN KEY (post_id) REFERENCES community_posts(id)
);

-- 좋아요
CREATE TABLE community_likes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_type TEXT NOT NULL,
  user_id INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now','+9 hours')),
  UNIQUE(post_id, user_type, user_id),
  FOREIGN KEY (post_id) REFERENCES community_posts(id)
);

-- 신고
CREATE TABLE community_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reporter_type TEXT NOT NULL,      -- 'student' | 'mentor'
  reporter_id INTEGER NOT NULL,
  target_type TEXT NOT NULL,         -- 'post' | 'comment'
  target_id INTEGER NOT NULL,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',     -- 'pending' | 'resolved' | 'dismissed'
  resolved_by INTEGER,              -- 처리한 멘토 ID
  resolved_at TEXT,
  created_at TEXT DEFAULT (datetime('now','+9 hours'))
);

-- 친구 관계
CREATE TABLE friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id_1 INTEGER NOT NULL,
  student_id_2 INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',     -- 'pending' | 'accepted' | 'blocked'
  invited_by INTEGER NOT NULL,       -- 초대를 보낸 student_id
  invite_code TEXT,                  -- 초대에 사용된 코드
  accepted_at TEXT,
  created_at TEXT DEFAULT (datetime('now','+9 hours')),
  UNIQUE(student_id_1, student_id_2),
  FOREIGN KEY (student_id_1) REFERENCES students(id),
  FOREIGN KEY (student_id_2) REFERENCES students(id)
);

-- 친구 초대 코드
CREATE TABLE friend_invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL,
  code TEXT NOT NULL UNIQUE,
  max_uses INTEGER DEFAULT 5,
  use_count INTEGER DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now','+9 hours')),
  FOREIGN KEY (student_id) REFERENCES students(id)
);

-- 학습 현황 공유 설정
CREATE TABLE learning_share_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  student_id INTEGER NOT NULL UNIQUE,
  share_class_records INTEGER DEFAULT 0,
  share_question_count INTEGER DEFAULT 0,
  share_teach_count INTEGER DEFAULT 0,
  share_mission_status INTEGER DEFAULT 0,
  share_xp_level INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now','+9 hours')),
  FOREIGN KEY (student_id) REFERENCES students(id)
);
```

### API 엔드포인트

```
# 게시판
GET    /api/community/boards                    -- 접근 가능한 게시판 목록
GET    /api/community/boards/:boardId/posts     -- 게시글 목록 (페이지네이션)
POST   /api/community/boards/:boardId/posts     -- 게시글 작성
GET    /api/community/posts/:postId             -- 게시글 상세
PUT    /api/community/posts/:postId             -- 게시글 수정
DELETE /api/community/posts/:postId             -- 게시글 삭제

# 댓글
GET    /api/community/posts/:postId/comments    -- 댓글 목록
POST   /api/community/posts/:postId/comments    -- 댓글 작성
DELETE /api/community/comments/:commentId       -- 댓글 삭제

# 좋아요
POST   /api/community/posts/:postId/like        -- 좋아요 토글
GET    /api/community/posts/:postId/likes       -- 좋아요한 사람 목록

# 신고
POST   /api/community/report                    -- 신고
GET    /api/mentor/:mentorId/reports             -- 멘토용 신고 목록
PUT    /api/community/reports/:reportId          -- 신고 처리

# 친구
POST   /api/student/:studentId/friends/invite   -- 친구 초대 코드 생성
POST   /api/student/:studentId/friends/accept   -- 초대 수락
POST   /api/student/:studentId/friends/reject   -- 초대 거절
GET    /api/student/:studentId/friends           -- 친구 목록
DELETE /api/student/:studentId/friends/:friendId -- 친구 삭제

# 닉네임
PUT    /api/student/:studentId/nickname          -- 닉네임 설정
PUT    /api/mentor/:mentorId/nickname            -- 멘토 닉네임 설정

# 학습 공유
GET    /api/student/:studentId/share-settings    -- 공유 설정 조회
PUT    /api/student/:studentId/share-settings    -- 공유 설정 업데이트
GET    /api/student/:studentId/learning-profile  -- 공개된 학습 프로필
```

### 프론트엔드 구조

기존 app.js에 직접 추가 (별도 모듈이 아닌 탭 추가 방식):

```
app.js 추가 영역:
├── renderCommunityTab()           -- 소통 탭 메인
├── renderBoardList()              -- 게시판 목록
├── renderPostList(boardId)        -- 게시글 목록
├── renderPostDetail(postId)       -- 게시글 상세 + 댓글
├── renderPostEditor()             -- 글 작성/수정
├── renderFriendsList()            -- 친구 목록/초대
├── renderFriendProfile(friendId)  -- 친구 학습 프로필
├── renderShareSettings()          -- 학습 공유 설정
├── renderNicknameSetup()          -- 닉네임 설정
└── renderReportList()             -- 멘토용 신고 관리
```

## 4. 디자인 가이드

### 글래스모피즘 디자인 시스템 (기존 유지)
- 반투명 카드: `bg-white bg-opacity-70 backdrop-blur-sm rounded-2xl`
- 그림자: `shadow-sm` 또는 `shadow-md`
- 모바일 우선 레이아웃

### 게시글 카드 디자인
- 작성자 닉네임 + 이모지 + 작성 시간
- 제목 (굵게) + 내용 미리보기 (2-3줄)
- 사진 썸네일 (있는 경우)
- 좋아요 수 + 댓글 수 하단 표시

### 댓글 디자인
- 닉네임 + 이모지 + 시간
- 댓글 내용
- 신고 버튼 (⋮ 메뉴)

## 5. 보안 고려사항

- 게시판 접근 권한 검증: 학생은 자기 반 + 전체 게시판만
- 멘토 삭제 시 로그 기록
- 신고 누적 시 멘토에게 알림
- 닉네임에 비속어 필터링 (기본적)
- 사진 업로드 크기 제한

## 6. 제약사항

- TailwindCSS CDN: arbitrary values 불가 → 기본 유틸리티만 사용
- D1 SQLite: `AUTO_INCREMENT` 금지, `datetime('now')` 사용
- Vanilla JS: 프레임워크 없음, innerHTML 기반 렌더링
- 기존 app.js 패턴 준수: `goScreen()`, `renderScreen()`, `DB` 객체
