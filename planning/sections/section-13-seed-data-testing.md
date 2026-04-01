Now I have all the context needed. Let me generate the section content.

# Section 13: Seed Data and Testing

## Overview

This section extends the existing `/api/seed-test-data` endpoint in `src/index.tsx` with community-specific seed data and provides a comprehensive manual API test script for verifying all community features end-to-end.

**Dependencies**: Sections 01 through 08 must be implemented first. All 10 community tables must exist (section-01), and all community API endpoints must be functional (sections 02-08).

## Background

The project has no automated test framework (no Jest, Vitest, or equivalent). Testing relies on:
- Manual API testing via curl/browser
- Seed data endpoints (`/api/seed-test-data`)
- Module dev pages (`dev.html`)
- Browser console inspection

The existing seed data endpoint at `/api/seed-test-data` uses a step-based approach (`?step=0` through `?step=4`) with admin key authentication (`?key=jycc_admin_2026`). Each step creates a category of test data: students (step 0), class records (step 1), photos/questions/teach records (step 2), assignments/points/XP (step 3), and feedback/activities/exams (step 4).

Community seed data will be added as **step 5**.

## File to Modify

- `/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx` -- add step 5 to the existing `/api/seed-test-data` handler

## Tests (Manual Verification Script)

All tests are manual curl commands. Run these after deploying/starting the dev server (`npm run dev`) and executing migration + seed data.

### Pre-requisite: Migration and Seed Steps 0-4

```bash
BASE="http://localhost:5173"
KEY="jycc_admin_2026"

# Run migration (creates community tables)
curl -s "$BASE/api/migrate?key=$KEY" | jq .

# Seed base data (steps 0-4)
for i in 0 1 2 3 4; do
  curl -s "$BASE/api/seed-test-data?key=$KEY&step=$i" | jq .
done
```

### Test: Step 5 seeds community data without errors

```bash
curl -s "$BASE/api/seed-test-data?key=$KEY&step=5" | jq .
# Expected: { success: true, step: 5, message: "Community seed data complete!", counts: { community_posts: N, community_comments: N, ... } }
```

### Test: Step 5 is idempotent (running twice does not duplicate or error)

```bash
curl -s "$BASE/api/seed-test-data?key=$KEY&step=5" | jq .
# Expected: success: true, same or similar counts (deletes before reinserting)
```

### Test: Nicknames are set for seeded students

```bash
STUDENT_ID=1  # adjust based on step 0 output
curl -s "$BASE/api/student/$STUDENT_ID/nickname" | jq .
# Or check via: verify nickname field is non-null
```

### Test: Boards exist and are accessible

```bash
curl -s "$BASE/api/community/boards?user_type=student&user_id=$STUDENT_ID" | jq .
# Expected: { success: true, data: { boards: [{ board_type: "group", ... }, { board_type: "academy", ... }] } }
```

### Test: Seeded posts appear in board listing

```bash
BOARD_ID=1  # use board id from previous response
curl -s "$BASE/api/community/boards/$BOARD_ID/posts?page=1&limit=20&user_type=student&user_id=$STUDENT_ID" | jq .
# Expected: posts array with seeded posts, totalCount > 0
```

### Test: Seeded comments appear on posts

```bash
POST_ID=1  # use post id from previous response
curl -s "$BASE/api/community/posts/$POST_ID/comments?page=1&limit=20" | jq .
# Expected: comments array with seeded comments
```

### Test: Seeded likes are reflected in post detail

```bash
curl -s "$BASE/api/community/posts/$POST_ID?user_type=student&user_id=$STUDENT_ID" | jq .
# Expected: post.likeCount > 0
```

### Test: Seeded friendships appear in friend list

```bash
curl -s "$BASE/api/student/$STUDENT_ID/friends" | jq .
# Expected: friends array with at least one accepted friendship
```

### Test: Seeded notifications exist

```bash
curl -s "$BASE/api/community/notifications?user_type=student&user_id=$STUDENT_ID&limit=20" | jq .
# Expected: notifications array with comment/like notifications
```

### Test: Seeded share settings exist

```bash
curl -s "$BASE/api/student/$STUDENT_ID/share-settings" | jq .
# Expected: share settings with some fields enabled
```

### Test: Full end-to-end API verification script

```bash
BASE="http://localhost:5173"
KEY="jycc_admin_2026"
STUDENT_ID=1
MENTOR_ID=1

# 1. Migration
curl -s "$BASE/api/migrate?key=$KEY" | jq .

# 2. Seed all steps
for i in 0 1 2 3 4 5; do
  echo "=== Step $i ==="
  curl -s "$BASE/api/seed-test-data?key=$KEY&step=$i" | jq .
done

# 3. Set nickname (may already be set by step 5)
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스터123"}' | jq .

# 4. Get boards
curl -s "$BASE/api/community/boards?user_type=student&user_id=$STUDENT_ID" | jq .

# 5. Create a new post
curl -s -X POST "$BASE/api/community/boards/1/posts" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":'$STUDENT_ID',"title":"수동 테스트 게시글","content":"<b>이것은 테스트입니다</b>"}' | jq .

# 6. List posts
curl -s "$BASE/api/community/boards/1/posts?page=1&limit=20&user_type=student&user_id=$STUDENT_ID" | jq .

# 7. Like a post
curl -s -X POST "$BASE/api/community/posts/1/like" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":'$STUDENT_ID'}' | jq .

# 8. Add a comment
curl -s -X POST "$BASE/api/community/posts/1/comments" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":2,"content":"좋은 질문이에요!"}' | jq .

# 9. Check notifications (for post author after comment/like)
curl -s "$BASE/api/community/notifications/unread-count?user_type=student&user_id=1" | jq .

# 10. Generate friend invite code
curl -s -X POST "$BASE/api/student/$STUDENT_ID/friends/invite-code" | jq .

# 11. Get friends list
curl -s "$BASE/api/student/$STUDENT_ID/friends" | jq .

# 12. Check share settings
curl -s "$BASE/api/student/$STUDENT_ID/share-settings" | jq .

# 13. Mentor: check boards
curl -s "$BASE/api/community/boards?user_type=mentor&user_id=$MENTOR_ID" | jq .

# 14. Mentor: check reports
curl -s "$BASE/api/mentor/$MENTOR_ID/community-reports" | jq .
```

## Implementation Details

### Step 5: Community Seed Data

Add a new `if (step === 5)` block to the existing `/api/seed-test-data` handler in `src/index.tsx`, positioned after step 4 and before the invalid-step error response.

The step should perform the following operations in order:

#### 5a. Clean existing community data

Delete existing seeded community data to ensure idempotency. Delete in correct order to respect foreign key relationships (notifications first, then comments, likes, photos, posts, friendships, invite codes, share settings).

```
DELETE FROM community_notifications WHERE recipient_id IN (studentIds)
DELETE FROM community_comments WHERE author_id IN (studentIds)
DELETE FROM community_likes WHERE user_id IN (studentIds)
DELETE FROM community_post_photos WHERE post_id IN (select from community_posts by author_id)
DELETE FROM community_posts WHERE author_id IN (studentIds)
DELETE FROM friendships WHERE student_id_1 IN (studentIds) OR student_id_2 IN (studentIds)
DELETE FROM friend_invite_codes WHERE student_id IN (studentIds)
DELETE FROM learning_share_settings WHERE student_id IN (studentIds)
```

#### 5b. Set nicknames for seeded students

Update the `nickname` column on the students table for each seeded student. Use creative Korean nicknames that match the student personas (e.g., the student named "홍길동" with emoji "🐱" gets nickname "길동이냥", etc.). Also set a nickname for the mentor.

Nickname list (one per seeded student in `studentsInfo` order):
- 홍길동 → "길동이냥"
- 이서연 → "서연이여우"
- 박준호 → "준호사자"
- 김하은 → "하은토끼"
- 최민재 → "민재곰돌"
- 장예린 → "예린유니콘"

For the mentor: "멘토선생님"

#### 5c. Verify community boards exist

After migration, boards should already exist (auto-seeded by section-01 migration). Verify at least one board exists. If not, log a warning but do not fail -- boards are created by the migration step, not the seed step.

Query the board IDs needed for post creation:
```sql
SELECT id, board_type FROM community_boards WHERE group_id = ? OR academy_name = ?
```

#### 5d. Create sample posts

Create 8-12 posts spread across the group board and academy board. Posts should have realistic Korean high school student content -- questions about subjects, study tips, school life discussions. Mix of students as authors.

Sample post content themes:
- Study questions ("물리 2단원 이해가 안 돼요...")
- Study tips ("영어 단어 외우는 꿀팁 공유합니다!")
- School life ("다음 주 체육대회 준비 어떻게 하고 계세요?")
- Exam prep ("중간고사 시간표 정리해봤어요")
- Teaching moments ("수학 치환적분 제가 이해한 방식으로 설명해볼게요")

Each post should have:
- `board_id`: alternating between group and academy board
- `author_type`: 'student'
- `author_id`: randomly selected from `studentIds`
- `title`: realistic Korean title (max 100 chars)
- `content`: HTML content with occasional `<b>` and `<br>` tags (max 10,000 chars)
- `created_at`: spread over the last 14 days using the `kstTs()` helper
- `like_count` and `comment_count`: set to 0 initially, updated after likes/comments are inserted

Use `DB.batch()` with prepared statements for efficient insertion.

#### 5e. Create sample comments

For each post, create 1-4 comments from different students (not the post author). Comment content should be contextually relevant responses.

Sample comment patterns:
- Helpful responses ("저도 그거 헷갈렸는데, 교과서 p.45 보면 이해돼요!")
- Agreement ("맞아요, 저도 같은 생각이에요")
- Follow-up questions ("그러면 이 부분은 어떻게 되는 건가요?")
- Encouragement ("화이팅! 같이 공부해요")

After inserting comments, update each post's `comment_count` to match actual comment count using:
```sql
UPDATE community_posts SET comment_count = (SELECT COUNT(*) FROM community_comments WHERE post_id = ? AND is_deleted = 0) WHERE id = ?
```

#### 5f. Create sample likes

For a subset of posts, create likes from random students. Each student should like 3-5 posts randomly. Enforce the unique constraint (no duplicate likes per student per post).

After inserting likes, update each post's `like_count`:
```sql
UPDATE community_posts SET like_count = (SELECT COUNT(*) FROM community_likes WHERE post_id = ?) WHERE id = ?
```

#### 5g. Create sample friendships

Create 3-4 friendships between seeded students. Always normalize IDs so `student_id_1 < student_id_2`. Set all friendships to `status = 'accepted'`.

Example pairings (using studentIds array indices):
- studentIds[0] and studentIds[1]
- studentIds[0] and studentIds[2]
- studentIds[1] and studentIds[3]
- studentIds[2] and studentIds[4]

#### 5h. Create sample invite codes

Generate 1-2 active invite codes for the first student. Use the `JYCC-XXXX-XXXX` format. Set `max_uses = 5`, `use_count = 0`, `expires_at` to 7 days from now.

#### 5i. Create learning share settings

For each student, insert a `learning_share_settings` row with varying configurations. Some students share more, others share less.

Example pattern:
- Student 0: all sharing on (1,1,1,1,1)
- Student 1: partial (1,1,0,0,0)
- Student 2: partial (0,0,1,1,0)
- Student 3: all off (0,0,0,0,0)
- Student 4: partial (1,0,1,0,1)
- Student 5: all on (1,1,1,1,1)

#### 5j. Create sample notifications

Create 5-8 notifications for the first 2-3 students. Mix of 'comment' and 'like' types, some read and some unread.

Notification fields:
- `recipient_type`: 'student'
- `recipient_id`: the post author's student ID
- `type`: 'comment' or 'like'
- `post_id`: reference to a seeded post
- `actor_type`: 'student'
- `actor_id`: the commenter/liker student ID
- `is_read`: mix of 0 and 1
- `created_at`: recent timestamps

#### 5k. Return counts

After all insertions, query counts for all community tables and return them in the response:

```javascript
const communityTables = [
  'community_boards', 'community_posts', 'community_comments',
  'community_likes', 'community_notifications', 'community_reports',
  'friendships', 'friend_invite_codes', 'learning_share_settings'
];
const counts = {};
for (const t of communityTables) {
  const r = await DB.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).first();
  counts[t] = r?.cnt || 0;
}
return c.json({ success: true, step: 5, message: 'Community seed data complete!', counts });
```

### Update the invalid-step error message

Change the error message to include step 5:

```javascript
return c.json({ error: 'Invalid step. Use step=0,1,2,3,4,5', usage: 'Call /api/seed-test-data?step=0 then step=1,2,3,4,5 in order' }, 400);
```

## Key Implementation Notes

1. **Idempotency**: Step 5 must delete all community seed data before reinserting. This prevents duplicate records when the endpoint is called multiple times.

2. **Board dependency**: Posts require board IDs that are created during migration (section-01), not during seeding. The seed step should query existing boards rather than creating them.

3. **Counter consistency**: After inserting comments and likes, always update the denormalized `comment_count` and `like_count` on `community_posts` to match actual row counts.

4. **Friendship ID normalization**: Always store `student_id_1 = MIN(a, b)` and `student_id_2 = MAX(a, b)` to prevent duplicate friendships.

5. **DB.batch() usage**: Group related INSERT statements into batches of up to 80 statements (matching the existing pattern in steps 1-4) to stay within D1 batch limits.

6. **Timestamp spread**: Use the existing `kstTs(offset)` helper with negative offsets to spread seed data over the past 14 days, making the community feed look realistic.

7. **Admin key required**: Step 5 uses the same admin key authentication as steps 0-4 (`?key=jycc_admin_2026`).