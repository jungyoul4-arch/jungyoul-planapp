Now I have enough context. Let me produce the section content.

# Section 04: Comment and Like API Endpoints

## Overview

This section implements the comment CRUD and like toggle endpoints for the community feature. These endpoints use `DB.batch()` for atomic counter updates (comment_count, like_count on posts) and create notifications when users interact with each other's posts.

**File to modify**: `/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx`

## Dependencies

- **section-01-db-migration** must be completed first. This section assumes the following tables exist:
  - `community_posts` (with `comment_count` and `like_count` columns)
  - `community_comments` (id, post_id, author_type, author_id, content, is_deleted, deleted_by, created_at)
  - `community_likes` (id, post_id, user_type, user_id, created_at) with UNIQUE constraint on `(post_id, user_type, user_id)`
  - `community_notifications` (id, recipient_type, recipient_id, type, post_id, actor_type, actor_id, is_read, created_at)
  - `students` and `mentors` tables with `nickname` column

## Manual Test Script (Tests FIRST)

All tests use curl against the local dev server (`npm run dev`). Run migration and seed data first. These tests assume at least one post exists (id=1) authored by student 1, and a second student (id=2) exists.

```bash
BASE="http://localhost:5173"

# === COMMENT TESTS ===

# Test 1: POST comment — creates comment and increments comment_count
curl -s -X POST "$BASE/api/community/posts/1/comments" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":2,"content":"좋은 질문이에요!"}' | jq .
# Expected: { success: true, data: { commentId: N } }

# Test 2: GET comments — returns paginated results in chronological order
curl -s "$BASE/api/community/posts/1/comments?page=1&limit=20" | jq .
# Expected: { success: true, data: { comments: [...], hasMore: false } }
# Comments should be sorted by created_at ASC

# Test 3: POST comment with content > 1,000 chars — rejected
LONG_CONTENT=$(python3 -c "print('가' * 1001)")
curl -s -X POST "$BASE/api/community/posts/1/comments" \
  -H "Content-Type: application/json" \
  -d "{\"author_type\":\"student\",\"author_id\":2,\"content\":\"$LONG_CONTENT\"}" | jq .
# Expected: { success: false, error: "..." }, status 400

# Test 4: POST comment creates notification for post author (author != commenter)
# After Test 1, check notifications for student 1 (post author):
curl -s "$BASE/api/community/notifications/unread-count?user_type=student&user_id=1" | jq .
# Expected: unreadCount >= 1

# Test 5: POST comment does NOT create notification if commenter IS the post author
curl -s -X POST "$BASE/api/community/posts/1/comments" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":1,"content":"내가 쓴 글에 내 댓글"}' | jq .
# Verify: unread count for student 1 should NOT increase from this

# Test 6: DELETE comment — soft deletes and decrements comment_count
# Use commentId from Test 1
curl -s -X DELETE "$BASE/api/community/comments/1" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":2}' | jq .
# Expected: { success: true }
# Verify: GET comments excludes deleted comment, post comment_count decremented

# Test 7: DELETE comment — only author or mentor can delete
curl -s -X DELETE "$BASE/api/community/comments/1" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":99}' | jq .
# Expected: { success: false, error: "..." }, status 403

# === LIKE TESTS ===

# Test 8: POST like on unliked post — liked=true, likeCount increments
curl -s -X POST "$BASE/api/community/posts/1/like" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":2}' | jq .
# Expected: { success: true, data: { liked: true, likeCount: 1 } }

# Test 9: POST like on already-liked post — toggle to unlike, likeCount decrements
curl -s -X POST "$BASE/api/community/posts/1/like" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":2}' | jq .
# Expected: { success: true, data: { liked: false, likeCount: 0 } }

# Test 10: Like creates notification for post author
# Like again (so it's a like, not unlike):
curl -s -X POST "$BASE/api/community/posts/1/like" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":2}' | jq .
# Check notifications for student 1:
curl -s "$BASE/api/community/notifications?user_type=student&user_id=1&limit=5" | jq '.data.notifications[0].type'
# Expected: "like"

# Test 11: Unlike does NOT create notification
curl -s -X POST "$BASE/api/community/posts/1/like" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":2}' | jq .
# This is an unlike — no new notification should be created
```

### Validation Checks to Build Into the Code

- Comment content must be non-empty and max 1,000 characters
- `author_type` must be 'student' or 'mentor'
- `author_id` must be a valid integer
- `post_id` from URL param must reference an existing, non-deleted post
- Like toggle must use `DB.batch()` for atomicity (INSERT/DELETE like + UPDATE post counter)
- Comment creation must use `DB.batch()` for atomicity (INSERT comment + UPDATE post counter + INSERT notification)

## Implementation Details

### Endpoint 1: GET /api/community/posts/:postId/comments

**Route**: `app.get('/api/community/posts/:postId/comments', async (c) => { ... })`

**Query params**: `page` (default 1), `limit` (default 20)

**Logic**:
1. Parse `postId` from URL params
2. Calculate offset: `(page - 1) * limit`
3. Query `community_comments` WHERE `post_id = ?` AND `is_deleted = 0`, ORDER BY `created_at ASC`, with LIMIT and OFFSET
4. JOIN with `students` and `mentors` to get author nickname and emoji
5. Count total non-deleted comments for `hasMore` calculation
6. Return `{ comments: [...], hasMore: boolean }`

**Author resolution**: Use a LEFT JOIN pattern — join on `students` where `author_type = 'student'` and on `mentors` where `author_type = 'mentor'`, then use COALESCE to pick the matching nickname/emoji.

**Response shape per comment**:
```typescript
{
  id: number,
  content: string,
  authorNickname: string,
  authorEmoji: string,
  authorType: 'student' | 'mentor',
  authorId: number,
  createdAt: string
}
```

### Endpoint 2: POST /api/community/posts/:postId/comments

**Route**: `app.post('/api/community/posts/:postId/comments', async (c) => { ... })`

**Body**: `{ author_type, author_id, content }`

**Logic**:
1. Validate content: non-empty, max 1,000 chars. Return 400 if invalid.
2. Validate `author_type` is 'student' or 'mentor'
3. Verify the post exists and is not deleted: `SELECT id, author_type, author_id FROM community_posts WHERE id = ? AND is_deleted = 0`
4. Build batch statements:
   - **Statement A**: INSERT into `community_comments` (post_id, author_type, author_id, content, is_deleted, created_at) VALUES (?, ?, ?, ?, 0, datetime('now','+9 hours'))
   - **Statement B**: UPDATE `community_posts` SET comment_count = comment_count + 1 WHERE id = ?
   - **Statement C** (conditional): If commenter is NOT the post author (`author_type != post.author_type OR author_id != post.author_id`), INSERT into `community_notifications` (recipient_type, recipient_id, type, post_id, actor_type, actor_id, is_read, created_at) VALUES (post.author_type, post.author_id, 'comment', postId, author_type, author_id, 0, datetime('now','+9 hours'))
5. Execute all statements with `c.env.DB.batch(statements)`
6. Return `{ commentId }` from the batch result (first statement's `last_row_id`)

**Notification skip logic**: Compare the commenter's identity (author_type + author_id) with the post's author (post.author_type + post.author_id). Only create a notification if they differ.

### Endpoint 3: DELETE /api/community/comments/:commentId

**Route**: `app.delete('/api/community/comments/:commentId', async (c) => { ... })`

**Body**: `{ user_type, user_id }`

**Logic**:
1. Fetch the comment: `SELECT id, post_id, author_type, author_id FROM community_comments WHERE id = ? AND is_deleted = 0`
2. Return 404 if not found
3. Authorization check:
   - If `user_type === comment.author_type && user_id === comment.author_id` — allowed (author deleting own comment)
   - If `user_type === 'mentor'` — check if mentor manages a group that has access to the post's board. This requires joining: `community_posts.board_id → community_boards.group_id → groups.mentor_id`. If the mentor's ID matches, allow deletion.
   - Otherwise return 403
4. Build batch statements:
   - **Statement A**: UPDATE `community_comments` SET is_deleted = 1, deleted_by = ? WHERE id = ?
   - **Statement B**: UPDATE `community_posts` SET comment_count = MAX(comment_count - 1, 0) WHERE id = ?
5. Execute with `c.env.DB.batch(statements)`
6. Return `{ success: true }`

Use `MAX(comment_count - 1, 0)` to prevent negative counts from race conditions.

### Endpoint 4: POST /api/community/posts/:postId/like (Toggle)

**Route**: `app.post('/api/community/posts/:postId/like', async (c) => { ... })`

**Body**: `{ user_type, user_id }`

**Logic**:
1. Validate `user_type` and `user_id`
2. Verify the post exists and is not deleted; also fetch `author_type` and `author_id` for notification
3. Check existing like: `SELECT id FROM community_likes WHERE post_id = ? AND user_type = ? AND user_id = ?`
4. **If like exists (unlike)**:
   - Build batch:
     - DELETE FROM `community_likes` WHERE id = ?
     - UPDATE `community_posts` SET like_count = MAX(like_count - 1, 0) WHERE id = ?
   - Execute batch
   - Fetch updated like_count: `SELECT like_count FROM community_posts WHERE id = ?`
   - Return `{ liked: false, likeCount: N }`
5. **If like does not exist (like)**:
   - Build batch:
     - INSERT INTO `community_likes` (post_id, user_type, user_id, created_at) VALUES (?, ?, ?, datetime('now','+9 hours'))
     - UPDATE `community_posts` SET like_count = like_count + 1 WHERE id = ?
     - (Conditional) If liker is NOT the post author, INSERT notification with type 'like'
   - Execute batch
   - Fetch updated like_count
   - Return `{ liked: true, likeCount: N }`

**Important**: The like_count fetch after batch is needed because `DB.batch()` returns raw D1 results, and extracting the updated count from the UPDATE statement is unreliable. A separate SELECT after the batch is the safest approach.

**UNIQUE constraint safety**: The `community_likes` table has a UNIQUE constraint on `(post_id, user_type, user_id)`. The check-then-insert pattern has a theoretical race condition, but given the single-user nature of the app and D1's serialized writes, this is acceptable. If a duplicate INSERT somehow occurs, the UNIQUE constraint will throw an error — wrap in try/catch and return the current state.

## Response Format

All endpoints follow the existing project convention:

```typescript
// Success
return c.json({ success: true, data: { ... } });

// Failure
return c.json({ success: false, error: "메시지" }, 400);  // or 403, 404
```

## KST Timestamps

All `created_at` values use `datetime('now','+9 hours')` for Korean Standard Time, consistent with the rest of the application.

## Error Messages (Korean)

- Content too long: `"댓글은 1,000자 이내로 작성해주세요"`
- Post not found: `"게시글을 찾을 수 없습니다"`
- Comment not found: `"댓글을 찾을 수 없습니다"`
- Not authorized to delete: `"삭제 권한이 없습니다"`
- Missing required fields: `"필수 항목을 입력해주세요"`

## Integration Notes

- The notification INSERT statements created here follow the same schema used in **section-05-notification-api**. The notification `type` field is either `'comment'` or `'like'`.
- The post detail endpoint in **section-03-post-api** returns `isLikedByMe` by checking `community_likes` for the current user. The like toggle here is what creates/removes those rows.
- Frontend consumption of these endpoints is handled in **section-10-frontend-board-posts**, which renders the comment list and like button.