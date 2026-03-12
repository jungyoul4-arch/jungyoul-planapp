diff --git a/planning/implementation/deep_implement_config.json b/planning/implementation/deep_implement_config.json
index 4c83c98..4ed56b6 100644
--- a/planning/implementation/deep_implement_config.json
+++ b/planning/implementation/deep_implement_config.json
@@ -30,5 +30,5 @@
     "may_modify_files": false,
     "detected_formatters": []
   },
-  "created_at": "2026-03-12T08:07:11.505707+00:00"
+  "created_at": "2026-03-12T08:22:36.602316+00:00"
 }
\ No newline at end of file
diff --git a/src/index.tsx b/src/index.tsx
index 58560d4..d6060e2 100644
--- a/src/index.tsx
+++ b/src/index.tsx
@@ -1100,12 +1100,18 @@ app.post('/api/auth/mentor/register', async (c) => {
 
     // 기본 반 1개 자동 생성
     const inviteCode = generateInviteCode();
-    await c.env.DB.prepare(
+    const groupResult = await c.env.DB.prepare(
       'INSERT INTO groups (mentor_id, name, invite_code, description) VALUES (?, ?, ?, ?)'
     ).bind(mentorId, `${name} 선생님 반`, inviteCode, '').run();
+    // 커뮤니티 보드 자동 생성
+    try {
+      await c.env.DB.prepare(
+        "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
+      ).bind(groupResult.meta.last_row_id, `${name} 선생님 반 게시판`).run();
+    } catch (_) { /* board may already exist */ }
 
-    return c.json({ 
-      success: true, 
+    return c.json({
+      success: true,
       mentorId,
       message: '멘토 등록이 완료되었습니다',
       defaultGroupInviteCode: inviteCode
@@ -1275,13 +1281,34 @@ app.get('/api/auth/external-login', async (c) => {
           }
           if (groupStmts.length > 0) {
             await c.env.DB.batch(groupStmts);
+            // 배치 생성된 그룹들에 대해 커뮤니티 보드 생성
+            try {
+              const newGroups: any = await c.env.DB.prepare(
+                'SELECT id, name FROM groups WHERE mentor_id = ? AND is_active = 1'
+              ).bind(mentorId).all();
+              for (const g of (newGroups.results || [])) {
+                const boardExists: any = await c.env.DB.prepare(
+                  "SELECT id FROM community_boards WHERE board_type = 'group' AND group_id = ?"
+                ).bind(g.id).first();
+                if (!boardExists) {
+                  await c.env.DB.prepare(
+                    "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
+                  ).bind(g.id, `${g.name} 게시판`).run();
+                }
+              }
+            } catch (_) { /* board creation non-fatal */ }
           }
         } else {
           // 반/학생 정보 없으면 기본 반 생성
           const inviteCode = generateInviteCode();
-          await c.env.DB.prepare(
+          const defaultGrpResult = await c.env.DB.prepare(
             'INSERT INTO groups (mentor_id, name, invite_code, description) VALUES (?, ?, ?, ?)'
           ).bind(mentorId, `${name} 선생님 반`, inviteCode, '').run();
+          try {
+            await c.env.DB.prepare(
+              "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
+            ).bind(defaultGrpResult.meta.last_row_id, `${name} 선생님 반 게시판`).run();
+          } catch (_) { /* board may already exist */ }
         }
 
         mentor = await c.env.DB.prepare('SELECT * FROM mentors WHERE id = ?').bind(mentorId).first();
@@ -1351,6 +1378,24 @@ app.get('/api/auth/external-login', async (c) => {
               // 배치 실행 (그룹 동기화만, 학생은 별도)
               if (batchStmts.length > 0) {
                 await c.env.DB.batch(batchStmts);
+                // 새로 생성된 그룹에 커뮤니티 보드 자동 생성
+                if (newGroups.length > 0) {
+                  try {
+                    const allGroups: any = await c.env.DB.prepare(
+                      'SELECT id, name FROM groups WHERE mentor_id = ? AND is_active = 1'
+                    ).bind(mentor.id).all();
+                    for (const g of (allGroups.results || [])) {
+                      const boardExists: any = await c.env.DB.prepare(
+                        "SELECT id FROM community_boards WHERE board_type = 'group' AND group_id = ?"
+                      ).bind(g.id).first();
+                      if (!boardExists) {
+                        await c.env.DB.prepare(
+                          "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
+                        ).bind(g.id, `${g.name} 게시판`).run();
+                      }
+                    }
+                  } catch (_) { /* board creation non-fatal */ }
+                }
               }
             }
           }
@@ -1585,6 +1630,12 @@ app.post('/api/mentor/groups', async (c) => {
     const result = await c.env.DB.prepare(
       'INSERT INTO groups (mentor_id, name, invite_code, description, max_students) VALUES (?, ?, ?, ?, ?)'
     ).bind(mentorId, name, inviteCode, description || '', maxStudents || 30).run();
+    // 커뮤니티 보드 자동 생성
+    try {
+      await c.env.DB.prepare(
+        "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
+      ).bind(result.meta.last_row_id, `${name} 게시판`).run();
+    } catch (_) { /* board may already exist */ }
 
     return c.json({
       success: true,
@@ -3887,12 +3938,73 @@ app.get('/api/migrate', async (c) => {
       // ===== 진로 프로파일 (앱티핏 전공적성 검사 결과) =====
       `CREATE TABLE IF NOT EXISTS career_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL UNIQUE, test_provider TEXT DEFAULT 'aptifit', test_date TEXT, raw_data TEXT DEFAULT '{}', top_departments TEXT DEFAULT '[]', dream_department TEXT DEFAULT '{}', field_profile TEXT DEFAULT '{}', major_profile TEXT DEFAULT '{}', career_advice TEXT DEFAULT '', careers TEXT DEFAULT '[]', pdf_r2_key TEXT DEFAULT NULL, parse_status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
       `CREATE INDEX IF NOT EXISTS idx_career_profiles_student ON career_profiles(student_id)`,
+      // ===== 커뮤니티(소통) 테이블 =====
+      `ALTER TABLE students ADD COLUMN nickname TEXT`,
+      `ALTER TABLE mentors ADD COLUMN nickname TEXT`,
+      `CREATE TABLE IF NOT EXISTS community_boards (id INTEGER PRIMARY KEY AUTOINCREMENT, board_type TEXT NOT NULL, group_id INTEGER, academy_name TEXT, name TEXT NOT NULL, description TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS community_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER NOT NULL, author_type TEXT NOT NULL, author_id INTEGER NOT NULL, title TEXT, content TEXT DEFAULT '', like_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, deleted_by TEXT, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS community_post_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, photo_data TEXT, r2_key TEXT, thumbnail TEXT DEFAULT '', mime_type TEXT DEFAULT 'image/jpeg', file_size INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS community_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, author_type TEXT NOT NULL, author_id INTEGER NOT NULL, content TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, deleted_by TEXT, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS community_likes (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, user_type TEXT NOT NULL, user_id INTEGER NOT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS community_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_type TEXT NOT NULL, reporter_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, reason TEXT DEFAULT '', status TEXT DEFAULT 'pending', resolved_by INTEGER, resolved_at DATETIME, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS community_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_type TEXT NOT NULL, recipient_id INTEGER NOT NULL, type TEXT NOT NULL, post_id INTEGER, actor_type TEXT NOT NULL, actor_id INTEGER NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS friendships (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id_1 INTEGER NOT NULL, student_id_2 INTEGER NOT NULL, status TEXT DEFAULT 'accepted', invited_by INTEGER, invite_code TEXT, accepted_at DATETIME, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS friend_invite_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, code TEXT NOT NULL UNIQUE, max_uses INTEGER DEFAULT 5, use_count INTEGER DEFAULT 0, expires_at DATETIME, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      `CREATE TABLE IF NOT EXISTS learning_share_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL UNIQUE, share_class_records INTEGER DEFAULT 0, share_question_count INTEGER DEFAULT 0, share_teach_count INTEGER DEFAULT 0, share_mission_status INTEGER DEFAULT 0, share_xp_level INTEGER DEFAULT 0, updated_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
+      // 커뮤니티 인덱스
+      `CREATE INDEX IF NOT EXISTS idx_community_posts_board ON community_posts(board_id, is_deleted, created_at DESC)`,
+      `CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_type, author_id)`,
+      `CREATE INDEX IF NOT EXISTS idx_community_post_photos_post ON community_post_photos(post_id, sort_order)`,
+      `CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, is_deleted, created_at ASC)`,
+      `CREATE UNIQUE INDEX IF NOT EXISTS idx_community_likes_unique ON community_likes(post_id, user_type, user_id)`,
+      `CREATE INDEX IF NOT EXISTS idx_community_reports_status ON community_reports(status, created_at DESC)`,
+      `CREATE INDEX IF NOT EXISTS idx_community_notifications_recipient ON community_notifications(recipient_type, recipient_id, is_read, created_at DESC)`,
+      `CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair ON friendships(student_id_1, student_id_2)`,
+      `CREATE INDEX IF NOT EXISTS idx_friendships_student1 ON friendships(student_id_1, status)`,
+      `CREATE INDEX IF NOT EXISTS idx_friendships_student2 ON friendships(student_id_2, status)`,
+      `CREATE INDEX IF NOT EXISTS idx_friend_invite_codes_student ON friend_invite_codes(student_id)`,
+      `CREATE UNIQUE INDEX IF NOT EXISTS idx_friend_invite_codes_code ON friend_invite_codes(code)`,
+      `CREATE UNIQUE INDEX IF NOT EXISTS idx_learning_share_settings_student ON learning_share_settings(student_id)`,
     ];
     const errors: string[] = [];
     for (const sql of stmts) {
       try { await c.env.DB.prepare(sql).run(); } catch(e: any) { errors.push(e.message || String(e)); }
     }
 
+    // ===== 커뮤니티 보드 자동 시딩 =====
+    try {
+      // 학원별 게시판
+      const academies: any = await c.env.DB.prepare(
+        "SELECT DISTINCT academy_name FROM mentors WHERE academy_name IS NOT NULL AND academy_name != ''"
+      ).all();
+      for (const row of (academies.results || [])) {
+        const existing: any = await c.env.DB.prepare(
+          "SELECT id FROM community_boards WHERE board_type = 'academy' AND academy_name = ?"
+        ).bind(row.academy_name).first();
+        if (!existing) {
+          await c.env.DB.prepare(
+            "INSERT INTO community_boards (board_type, academy_name, name, description) VALUES ('academy', ?, ?, '')"
+          ).bind(row.academy_name, `${row.academy_name} 게시판`).run();
+        }
+      }
+      // 반별 게시판
+      const activeGroups: any = await c.env.DB.prepare(
+        "SELECT id, name FROM groups WHERE is_active = 1"
+      ).all();
+      for (const grp of (activeGroups.results || [])) {
+        const existing: any = await c.env.DB.prepare(
+          "SELECT id FROM community_boards WHERE board_type = 'group' AND group_id = ?"
+        ).bind(grp.id).first();
+        if (!existing) {
+          await c.env.DB.prepare(
+            "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
+          ).bind(grp.id, `${grp.name} 게시판`).run();
+        }
+      }
+    } catch (e) {
+      console.error('Board auto-seeding error:', e);
+    }
+
     // croquet_points 테이블 마이그레이션: mentor_id를 nullable로 변경 (자동 지급 지원)
     try {
       const tableInfo: any = await c.env.DB.prepare("PRAGMA table_info(croquet_points)").all();
