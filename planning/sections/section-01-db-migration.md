Now I have all the context I need. Here is the section content:

# Section 01: Database Migration

## Overview

This section adds all database schema changes required for the community ("소통") feature. It is the foundation that all other sections depend on. The work involves:

1. Adding `nickname` columns to existing `students` and `mentors` tables
2. Creating 10 new community tables with appropriate indexes and constraints
3. Auto-seeding `community_boards` based on existing groups and academies
4. Adding a board creation hook to the group creation endpoint

All changes go into a single file: `/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx`.

## Background

### Migration Pattern

The project uses an idempotent migration endpoint at `GET /api/migrate?key=jycc_admin_2026`. It collects SQL statements into a `stmts` array and executes them one by one inside a try/catch loop. Failures (e.g., "duplicate column" from re-running ALTER TABLE) are silently collected into an `errors` array and returned in the response but do not halt the migration.

```typescript
const errors: string[] = [];
for (const sql of stmts) {
  try { await c.env.DB.prepare(sql).run(); } catch(e: any) { errors.push(e.message || String(e)); }
}
```

`CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` are inherently idempotent. `ALTER TABLE ADD COLUMN` is not -- it throws "duplicate column name" on re-run, but the try/catch pattern handles this gracefully.

### D1 SQLite Rules

- `INTEGER PRIMARY KEY AUTOINCREMENT` (not `AUTO_INCREMENT`)
- `datetime('now','+9 hours')` for KST timestamps (not `NOW()`)
- `INTEGER` for booleans (0/1, not `BOOLEAN`)
- `?` for parameter binding
- `RETURNING *` is supported (D1 is SQLite 3.35+)
- No `MODIFY COLUMN` -- table recreation required for column type changes

### Academy Resolution Join Chain

Students do not have a direct `academy_name` field. To determine a student's academy:
```
students.group_id -> groups.mentor_id -> mentors.academy_name
```
This chain is used for board access control, friend invite validation, and nickname uniqueness.

## Tests (Manual Verification)

These tests should be verified after implementation by running the migration and inspecting the results.

### Test 1: Migration is idempotent

Run `/api/migrate?key=jycc_admin_2026` twice in succession. The second run must not produce fatal errors. Verify the response has `success: true` both times. The `errors` array on re-run will contain "duplicate column" messages for ALTER TABLE statements -- this is expected and acceptable.

```bash
# Run migration first time
curl -s "http://localhost:5173/api/migrate?key=jycc_admin_2026" | jq '.success'
# Expected: true

# Run migration second time (idempotent check)
curl -s "http://localhost:5173/api/migrate?key=jycc_admin_2026" | jq '.success'
# Expected: true
```

### Test 2: Nickname columns added

After migration, verify the `nickname` column exists on both `students` and `mentors` tables.

```bash
# Check students table has nickname column
curl -s "http://localhost:5173/api/migrate?key=jycc_admin_2026" | jq '.tableNames'
# Then verify via a direct query or PRAGMA (if you have DB access):
# PRAGMA table_info(students) should include a 'nickname' row
# PRAGMA table_info(mentors) should include a 'nickname' row
```

### Test 3: All 10 new tables created

The response from `/api/migrate` includes a `tableNames` array. Verify it contains all 10 new tables:
- `community_boards`
- `community_posts`
- `community_post_photos`
- `community_comments`
- `community_likes`
- `community_reports`
- `community_notifications`
- `friendships`
- `friend_invite_codes`
- `learning_share_settings`

### Test 4: Board auto-seeding

After migration, verify that boards were auto-created correctly.

```bash
# Check boards exist
curl -s "http://localhost:5173/api/community/boards?user_type=student&user_id=1" | jq .
# Expected: at least one academy board and one group board (if seed data exists)
```

Verify:
- Exactly 1 academy board per unique `academy_name` in the `mentors` table
- Exactly 1 group board per active group (`is_active = 1`)
- Re-running migration does NOT duplicate boards (idempotent seeding)

### Test 5: UNIQUE constraints work

After migration, verify that unique constraints prevent duplicates:
- `community_likes`: inserting two likes with the same `(post_id, user_type, user_id)` should fail on the second insert
- `friendships`: inserting two rows with the same `(student_id_1, student_id_2)` should fail on the second insert

### Test 6: Board creation hook on group creation

When a new group is created via the group creation endpoint, a corresponding `community_boards` row with `board_type = 'group'` should also be created.

```bash
# Create a new group, then verify a board was auto-created for it
curl -s -X POST "http://localhost:5173/api/groups" \
  -H "Content-Type: application/json" \
  -d '{"mentorId":1,"name":"테스트반"}' | jq .
# Note the groupId, then check community_boards for a matching group board
```

## Implementation Details

### File to Modify

`/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx`

### Step 1: Add ALTER TABLE statements for nicknames

Add these two statements to the `stmts` array inside the `/api/migrate` handler (around line 3889, before the closing `];`):

```sql
ALTER TABLE students ADD COLUMN nickname TEXT
ALTER TABLE mentors ADD COLUMN nickname TEXT
```

These will silently fail on re-run (duplicate column) and get caught by the existing error handler.

### Step 2: Add CREATE TABLE statements for all 10 new tables

Add the following `CREATE TABLE IF NOT EXISTS` statements to the `stmts` array. Each uses KST timestamps via `datetime('now','+9 hours')`.

**community_boards** -- Board definitions (group-specific and academy-wide):
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `board_type TEXT NOT NULL` -- 'group' or 'academy'
- `group_id INTEGER` -- nullable, FK to groups (for group boards)
- `academy_name TEXT` -- for academy boards
- `name TEXT NOT NULL`
- `description TEXT DEFAULT ''`
- `is_active INTEGER DEFAULT 1`
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`

**community_posts** -- User-submitted posts:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `board_id INTEGER NOT NULL` -- FK to community_boards
- `author_type TEXT NOT NULL` -- 'student' or 'mentor'
- `author_id INTEGER NOT NULL`
- `title TEXT` -- nullable, some posts may be title-less
- `content TEXT DEFAULT ''` -- rich HTML, sanitized server-side
- `like_count INTEGER DEFAULT 0` -- denormalized counter
- `comment_count INTEGER DEFAULT 0` -- denormalized counter
- `is_deleted INTEGER DEFAULT 0` -- soft delete
- `deleted_by TEXT` -- who deleted (author or mentor info)
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`
- `updated_at DATETIME DEFAULT (datetime('now','+9 hours'))`

**community_post_photos** -- Photos attached to posts:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `post_id INTEGER NOT NULL` -- FK to community_posts
- `photo_data TEXT` -- base64 fallback (R2 preferred but may not be configured)
- `r2_key TEXT` -- R2 object key when available
- `thumbnail TEXT DEFAULT ''` -- small base64 thumbnail for list view
- `mime_type TEXT DEFAULT 'image/jpeg'`
- `file_size INTEGER DEFAULT 0`
- `sort_order INTEGER DEFAULT 0`
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`

**community_comments** -- Comments on posts:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `post_id INTEGER NOT NULL` -- FK to community_posts
- `author_type TEXT NOT NULL`
- `author_id INTEGER NOT NULL`
- `content TEXT NOT NULL` -- plain text, max 1000 chars
- `is_deleted INTEGER DEFAULT 0`
- `deleted_by TEXT`
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`

**community_likes** -- Post likes (one per user per post):
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `post_id INTEGER NOT NULL`
- `user_type TEXT NOT NULL`
- `user_id INTEGER NOT NULL`
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`
- UNIQUE constraint on `(post_id, user_type, user_id)`

**community_reports** -- Content reports for moderation:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `reporter_type TEXT NOT NULL`
- `reporter_id INTEGER NOT NULL`
- `target_type TEXT NOT NULL` -- 'post' or 'comment'
- `target_id INTEGER NOT NULL`
- `reason TEXT DEFAULT ''`
- `status TEXT DEFAULT 'pending'` -- 'pending', 'resolved', 'dismissed'
- `resolved_by INTEGER` -- mentor id
- `resolved_at DATETIME`
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`

**community_notifications** -- Activity notifications:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `recipient_type TEXT NOT NULL` -- 'student' or 'mentor'
- `recipient_id INTEGER NOT NULL`
- `type TEXT NOT NULL` -- 'comment' or 'like'
- `post_id INTEGER` -- FK to community_posts
- `actor_type TEXT NOT NULL`
- `actor_id INTEGER NOT NULL`
- `is_read INTEGER DEFAULT 0`
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`

**friendships** -- Bidirectional friend relationships:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `student_id_1 INTEGER NOT NULL` -- always MIN(a, b)
- `student_id_2 INTEGER NOT NULL` -- always MAX(a, b)
- `status TEXT DEFAULT 'accepted'` -- 'pending', 'accepted', 'blocked'
- `invited_by INTEGER` -- FK to students (who sent the invite)
- `invite_code TEXT`
- `accepted_at DATETIME`
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`
- UNIQUE constraint on `(student_id_1, student_id_2)`

**friend_invite_codes** -- Invite codes for friend connections:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `student_id INTEGER NOT NULL` -- FK to students
- `code TEXT NOT NULL UNIQUE`
- `max_uses INTEGER DEFAULT 5`
- `use_count INTEGER DEFAULT 0`
- `expires_at DATETIME`
- `is_active INTEGER DEFAULT 1`
- `created_at DATETIME DEFAULT (datetime('now','+9 hours'))`

**learning_share_settings** -- Per-student sharing preferences:
- `id INTEGER PRIMARY KEY AUTOINCREMENT`
- `student_id INTEGER NOT NULL UNIQUE`
- `share_class_records INTEGER DEFAULT 0`
- `share_question_count INTEGER DEFAULT 0`
- `share_teach_count INTEGER DEFAULT 0`
- `share_mission_status INTEGER DEFAULT 0`
- `share_xp_level INTEGER DEFAULT 0`
- `updated_at DATETIME DEFAULT (datetime('now','+9 hours'))`

### Step 3: Add indexes

Add `CREATE INDEX IF NOT EXISTS` statements for performance-critical queries:

```sql
-- community_posts indexes
CREATE INDEX IF NOT EXISTS idx_cp_board_list ON community_posts(board_id, is_deleted, created_at DESC)
CREATE INDEX IF NOT EXISTS idx_cp_author ON community_posts(author_type, author_id)

-- community_post_photos index
CREATE INDEX IF NOT EXISTS idx_cpp_post ON community_post_photos(post_id, sort_order)

-- community_comments index
CREATE INDEX IF NOT EXISTS idx_cc_post ON community_comments(post_id, is_deleted, created_at ASC)

-- community_likes unique index (enforces one like per user per post)
CREATE UNIQUE INDEX IF NOT EXISTS idx_cl_unique ON community_likes(post_id, user_type, user_id)

-- community_reports index
CREATE INDEX IF NOT EXISTS idx_cr_status ON community_reports(status, created_at DESC)

-- community_notifications index
CREATE INDEX IF NOT EXISTS idx_cn_recipient ON community_notifications(recipient_type, recipient_id, is_read, created_at DESC)

-- friendships unique index (enforces no duplicate pairs)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fs_pair ON friendships(student_id_1, student_id_2)
CREATE INDEX IF NOT EXISTS idx_fs_student1 ON friendships(student_id_1, status)
CREATE INDEX IF NOT EXISTS idx_fs_student2 ON friendships(student_id_2, status)

-- friend_invite_codes indexes
CREATE INDEX IF NOT EXISTS idx_fic_student ON friend_invite_codes(student_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_fic_code ON friend_invite_codes(code)

-- learning_share_settings index
CREATE UNIQUE INDEX IF NOT EXISTS idx_lss_student ON learning_share_settings(student_id)
```

### Step 4: Add board auto-seeding logic

After the `stmts` loop (after the `for (const sql of stmts)` block, around line 3894), add board auto-seeding logic. This runs as a separate step (not in the stmts array) because it requires SELECT queries to check for existing data.

The logic should:

1. Query all unique `academy_name` values from the `mentors` table
2. For each academy, check if an academy board already exists in `community_boards` with `board_type = 'academy'` and matching `academy_name`
3. If not, INSERT a new academy board with `name = '{academy_name} 게시판'`
4. Query all active groups (`is_active = 1`) from the `groups` table
5. For each group, check if a group board already exists in `community_boards` with `board_type = 'group'` and matching `group_id`
6. If not, INSERT a new group board with `name = '{group.name} 게시판'`

Wrap the entire seeding block in a try/catch so it does not break the migration if `community_boards` table creation failed for some reason.

```typescript
// Board auto-seeding (after stmts loop)
try {
  // Academy boards
  const academies: any = await c.env.DB.prepare(
    "SELECT DISTINCT academy_name FROM mentors WHERE academy_name IS NOT NULL AND academy_name != ''"
  ).all();
  for (const row of (academies.results || [])) {
    const existing: any = await c.env.DB.prepare(
      "SELECT id FROM community_boards WHERE board_type = 'academy' AND academy_name = ?"
    ).bind(row.academy_name).first();
    if (!existing) {
      await c.env.DB.prepare(
        "INSERT INTO community_boards (board_type, academy_name, name, description) VALUES ('academy', ?, ?, '')"
      ).bind(row.academy_name, `${row.academy_name} 게시판`).run();
    }
  }
  // Group boards
  const groups: any = await c.env.DB.prepare(
    "SELECT id, name FROM groups WHERE is_active = 1"
  ).all();
  for (const grp of (groups.results || [])) {
    const existing: any = await c.env.DB.prepare(
      "SELECT id FROM community_boards WHERE board_type = 'group' AND group_id = ?"
    ).bind(grp.id).first();
    if (!existing) {
      await c.env.DB.prepare(
        "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
      ).bind(grp.id, `${grp.name} 게시판`).run();
    }
  }
} catch (e) {
  // Board seeding failed — non-fatal, boards can be created manually
  console.error('Board auto-seeding error:', e);
}
```

### Step 5: Add board creation hook to group creation endpoints

There are multiple places where groups are created in `src/index.tsx`. After each `INSERT INTO groups` that creates a new group, add a follow-up INSERT into `community_boards` to create the corresponding group board. The relevant locations are:

1. **Mentor registration** (around line 1103-1105): After inserting the default group for a new mentor
2. **External sync batch group creation** (around line 1267-1278): After batch inserting groups from external sync
3. **Manual group creation endpoint** (around line 1585-1587): The `POST /api/groups` handler

For each location, after the group INSERT succeeds, add:

```typescript
// After group creation, also create community board
try {
  await c.env.DB.prepare(
    "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
  ).bind(groupId, `${groupName} 게시판`).run();
} catch (_) { /* board may already exist */ }
```

For the batch creation case (external sync), add matching batch statements for board creation, or iterate after the batch completes and create boards for the newly created groups.

For the manual group creation endpoint (around line 1585), `result.meta.last_row_id` provides the new group ID. Use this to create the board immediately after.

## Dependencies

This section has no dependencies on other sections. All other sections (02-13) depend on this section being completed first.

## Validation Rules (to be enforced by API endpoints in later sections)

These are documented here for reference since the schema supports them via application-level validation:

- `community_posts.title`: max 100 characters
- `community_posts.content`: max 10,000 characters
- `community_comments.content`: max 1,000 characters
- `community_post_photos`: max 5 photos per post
- `friendships`: always store `student_id_1 < student_id_2` (normalize at insert time)
- `community_likes`: UNIQUE constraint prevents double-likes at DB level
- `friendships`: UNIQUE constraint prevents duplicate friend pairs at DB level

## Checklist

- [ ] Add `ALTER TABLE students ADD COLUMN nickname TEXT` to stmts array
- [ ] Add `ALTER TABLE mentors ADD COLUMN nickname TEXT` to stmts array
- [ ] Add 10 `CREATE TABLE IF NOT EXISTS` statements for all community tables
- [ ] Add all `CREATE INDEX IF NOT EXISTS` / `CREATE UNIQUE INDEX IF NOT EXISTS` statements
- [ ] Add board auto-seeding logic after the stmts loop (academy boards + group boards)
- [ ] Add board creation hook to mentor registration group creation (~line 1105)
- [ ] Add board creation hook to external sync batch group creation (~line 1277)
- [ ] Add board creation hook to manual group creation endpoint (~line 1587)
- [ ] Run migration twice and verify idempotency
- [ ] Verify all 10 new tables appear in migration response `tableNames`
- [ ] Verify nickname columns exist on students and mentors tables