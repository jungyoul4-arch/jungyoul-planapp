diff --git a/planning/implementation/deep_implement_config.json b/planning/implementation/deep_implement_config.json
index 4ed56b6..e3ed98c 100644
--- a/planning/implementation/deep_implement_config.json
+++ b/planning/implementation/deep_implement_config.json
@@ -21,7 +21,12 @@
     "section-12-frontend-friends-settings",
     "section-13-seed-data-testing"
   ],
-  "sections_state": {},
+  "sections_state": {
+    "section-01-db-migration": {
+      "status": "complete",
+      "commit_hash": "8097a09145c58d0501c401d2430e212c73e714d7"
+    }
+  },
   "pre_commit": {
     "present": false,
     "type": "none",
diff --git a/src/index.tsx b/src/index.tsx
index 02a5a3f..bac1644 100644
--- a/src/index.tsx
+++ b/src/index.tsx
@@ -1079,6 +1079,12 @@ function generateInviteCode(): string {
   return `JYCC-${part1}-${part2}`;
 }
 
+/** HTML 태그 제거 후 plain text 미리보기 생성 */
+function stripHtmlForPreview(html: string, maxLen: number = 100): string {
+  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
+  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
+}
+
 
 // ==================== AUTH API: 멘토 회원가입 ====================
 
@@ -4052,6 +4058,148 @@ app.get('/api/migrate', async (c) => {
 });
 
 
+// ==================== 커뮤니티(소통) API ====================
+
+// GET /api/community/boards — 사용자가 접근 가능한 게시판 목록
+app.get('/api/community/boards', async (c) => {
+  const userType = c.req.query('user_type');
+  const userId = Number(c.req.query('user_id'));
+  if (!userType || !userId) return c.json({ success: false, error: 'user_type과 user_id는 필수입니다' }, 400);
+
+  try {
+    let academyName = '';
+    let groupId = 0;
+    let mentorId = 0;
+
+    if (userType === 'student') {
+      const student: any = await c.env.DB.prepare(
+        'SELECT s.group_id, m.academy_name FROM students s JOIN groups g ON s.group_id = g.id JOIN mentors m ON g.mentor_id = m.id WHERE s.id = ? AND s.is_active = 1'
+      ).bind(userId).first();
+      if (!student) return c.json({ success: false, error: '학생을 찾을 수 없습니다' }, 404);
+      academyName = student.academy_name || '';
+      groupId = student.group_id;
+    } else if (userType === 'mentor') {
+      const mentor: any = await c.env.DB.prepare('SELECT id, academy_name FROM mentors WHERE id = ?').bind(userId).first();
+      if (!mentor) return c.json({ success: false, error: '멘토를 찾을 수 없습니다' }, 404);
+      academyName = mentor.academy_name || '';
+      mentorId = mentor.id;
+    } else {
+      return c.json({ success: false, error: 'user_type은 student 또는 mentor만 가능합니다' }, 400);
+    }
+
+    let boards: any;
+    if (userType === 'student') {
+      boards = await c.env.DB.prepare(
+        `SELECT b.*, COALESCE(pc.cnt, 0) as postCount
+         FROM community_boards b
+         LEFT JOIN (SELECT board_id, COUNT(*) as cnt FROM community_posts WHERE is_deleted = 0 GROUP BY board_id) pc ON b.id = pc.board_id
+         WHERE b.is_active = 1 AND (
+           (b.board_type = 'group' AND b.group_id = ?)
+           OR (b.board_type = 'academy' AND b.academy_name = ?)
+         )`
+      ).bind(groupId, academyName).all();
+    } else {
+      boards = await c.env.DB.prepare(
+        `SELECT b.*, COALESCE(pc.cnt, 0) as postCount
+         FROM community_boards b
+         LEFT JOIN (SELECT board_id, COUNT(*) as cnt FROM community_posts WHERE is_deleted = 0 GROUP BY board_id) pc ON b.id = pc.board_id
+         WHERE b.is_active = 1 AND (
+           (b.board_type = 'group' AND b.group_id IN (SELECT id FROM groups WHERE mentor_id = ?))
+           OR (b.board_type = 'academy' AND b.academy_name = ?)
+         )`
+      ).bind(mentorId, academyName).all();
+    }
+
+    const boardList = (boards.results || []).map((b: any) => ({
+      id: b.id,
+      board_type: b.board_type,
+      name: b.name,
+      group_id: b.group_id,
+      description: b.description || '',
+      postCount: b.postCount || 0
+    }));
+
+    return c.json({ success: true, data: { boards: boardList } });
+  } catch (e: any) {
+    return c.json({ success: false, error: e.message }, 500);
+  }
+});
+
+// GET /api/community/boards/:boardId/posts — 게시판 게시글 목록 (페이지네이션)
+app.get('/api/community/boards/:boardId/posts', async (c) => {
+  const boardId = Number(c.req.param('boardId'));
+  const page = Math.max(1, Number(c.req.query('page')) || 1);
+  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));
+  const userType = c.req.query('user_type');
+  const userId = Number(c.req.query('user_id'));
+  if (!userType || !userId) return c.json({ success: false, error: 'user_type과 user_id는 필수입니다' }, 400);
+
+  try {
+    // 게시판 조회
+    const board: any = await c.env.DB.prepare('SELECT * FROM community_boards WHERE id = ? AND is_active = 1').bind(boardId).first();
+    if (!board) return c.json({ success: false, error: '게시판을 찾을 수 없습니다' }, 404);
+
+    // 접근 권한 확인
+    if (board.board_type === 'group') {
+      if (userType === 'student') {
+        const student: any = await c.env.DB.prepare('SELECT group_id FROM students WHERE id = ? AND is_active = 1').bind(userId).first();
+        if (!student || student.group_id !== board.group_id) return c.json({ success: false, error: '이 게시판에 접근할 수 없습니다' }, 403);
+      } else {
+        const group: any = await c.env.DB.prepare('SELECT mentor_id FROM groups WHERE id = ?').bind(board.group_id).first();
+        if (!group || group.mentor_id !== userId) return c.json({ success: false, error: '이 게시판에 접근할 수 없습니다' }, 403);
+      }
+    } else if (board.board_type === 'academy') {
+      let userAcademy = '';
+      if (userType === 'student') {
+        const row: any = await c.env.DB.prepare(
+          'SELECT m.academy_name FROM students s JOIN groups g ON s.group_id = g.id JOIN mentors m ON g.mentor_id = m.id WHERE s.id = ?'
+        ).bind(userId).first();
+        userAcademy = row?.academy_name || '';
+      } else {
+        const row: any = await c.env.DB.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(userId).first();
+        userAcademy = row?.academy_name || '';
+      }
+      if (userAcademy !== board.academy_name) return c.json({ success: false, error: '이 게시판에 접근할 수 없습니다' }, 403);
+    }
+
+    // 총 게시글 수
+    const countResult: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM community_posts WHERE board_id = ? AND is_deleted = 0').bind(boardId).first();
+    const totalCount = countResult?.cnt || 0;
+    const offset = (page - 1) * limit;
+
+    // 게시글 목록 조회
+    const postsResult: any = await c.env.DB.prepare(
+      `SELECT p.id, p.title, p.content, p.like_count, p.comment_count, p.created_at,
+              p.author_type, p.author_id,
+              CASE WHEN p.author_type = 'student' THEN COALESCE(s.nickname, '익명') ELSE COALESCE(m.nickname, '멘토') END as authorNickname,
+              CASE WHEN p.author_type = 'student' THEN s.profile_emoji ELSE '🎓' END as authorEmoji,
+              (SELECT COUNT(*) FROM community_post_photos WHERE post_id = p.id) as photoCount
+       FROM community_posts p
+       LEFT JOIN students s ON p.author_type = 'student' AND p.author_id = s.id
+       LEFT JOIN mentors m ON p.author_type = 'mentor' AND p.author_id = m.id
+       WHERE p.board_id = ? AND p.is_deleted = 0
+       ORDER BY p.created_at DESC
+       LIMIT ? OFFSET ?`
+    ).bind(boardId, limit, offset).all();
+
+    const posts = (postsResult.results || []).map((p: any) => ({
+      id: p.id,
+      title: p.title || null,
+      contentPreview: stripHtmlForPreview(p.content || ''),
+      authorNickname: p.authorNickname || '익명',
+      authorEmoji: p.authorEmoji || '😊',
+      likeCount: p.like_count || 0,
+      commentCount: p.comment_count || 0,
+      hasPhotos: (p.photoCount || 0) > 0,
+      createdAt: p.created_at
+    }));
+
+    return c.json({ success: true, data: { posts, hasMore: totalCount > page * limit, totalCount } });
+  } catch (e: any) {
+    return c.json({ success: false, error: e.message }, 500);
+  }
+});
+
 // ==================== 진로 프로파일 API ====================
 
 // GET /api/student/:id/career-profile — 진로 프로파일 조회
