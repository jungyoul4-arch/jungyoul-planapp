Now I have all the context needed. Let me generate the section content.

# Section 05: Notification API

## Overview

This section implements the notification system for the community feature. Notifications are created automatically when another user comments on or likes a post, and are consumed by both the notification list screen and the unread badge on the community tab.

**Dependencies**: Section 01 (DB migration must be complete -- `community_notifications` table and its index must exist).

**Blocks**: Section 09 (frontend navigation needs `getUnreadNotificationCount` for the tab badge), Section 10 (frontend board/posts uses notification list).

## Database Context

The `community_notifications` table (created in Section 01) has this schema:

```sql
CREATE TABLE IF NOT EXISTS community_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL,       -- 'student' | 'mentor'
  recipient_id INTEGER NOT NULL,
  type TEXT NOT NULL,                 -- 'comment' | 'like'
  post_id INTEGER NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  is_read INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now','+9 hours'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_recipient
  ON community_notifications(recipient_type, recipient_id, is_read, created_at DESC);
```

Notifications are **created** by the comment and like endpoints (Section 04), not by the notification endpoints themselves. This section only handles **reading** and **marking as read**.

## Tests (Manual API Verification)

Run these curl commands after migration and seed data are in place. All tests assume `BASE="http://localhost:5173"`.

### Test 1: GET notifications returns user's notifications sorted by createdAt DESC

```bash
# Prerequisite: seed data must have created notifications for student 1
curl -s "$BASE/api/community/notifications?user_type=student&user_id=1&limit=20" | jq .
# Expected: { success: true, data: { notifications: [...], unreadCount: N } }
# Notifications should be ordered newest first
# Each notification has: id, type, postId, postTitle, actorNickname, isRead, createdAt
```

### Test 2: GET unread-count returns correct count

```bash
curl -s "$BASE/api/community/notifications/unread-count?user_type=student&user_id=1" | jq .
# Expected: { success: true, data: { unreadCount: N } }
# N should match the count of is_read=0 notifications for this user
```

### Test 3: PUT read-all marks all unread as read, subsequent unread-count returns 0

```bash
# Mark all as read
curl -s -X PUT "$BASE/api/community/notifications/read-all" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":1}' | jq .
# Expected: { success: true, data: { markedCount: N } }

# Verify unread count is now 0
curl -s "$BASE/api/community/notifications/unread-count?user_type=student&user_id=1" | jq .
# Expected: { success: true, data: { unreadCount: 0 } }
```

### Test 4: Notifications include post title and actor nickname

```bash
# After creating a comment on a post (done in Section 04 tests), check notification content
curl -s "$BASE/api/community/notifications?user_type=student&user_id=1&limit=5" | jq '.data.notifications[0]'
# Expected: postTitle is not null/empty, actorNickname is not null/empty
```

### Test 5: Pagination works correctly

```bash
# Request with small limit
curl -s "$BASE/api/community/notifications?user_type=student&user_id=1&limit=2" | jq .
# Expected: notifications array has at most 2 items
# If there are more, you can paginate by using offset or the last notification's id
```

### Validation Checks to Build In

- `user_type` must be `'student'` or `'mentor'` -- reject others with 400
- `user_id` must be a positive integer
- `limit` query param should default to 20, cap at 50

## Implementation Details

### File to Modify

`/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx`

Add three new endpoints to the Hono router. All follow the existing response pattern `{ success: true, data: {...} }` or `{ success: false, error: "msg" }`.

### Endpoint 1: GET /api/community/notifications

**Query params**: `user_type`, `user_id`, `limit` (default 20, max 50)

**Logic**:
1. Validate `user_type` is `'student'` or `'mentor'`, validate `user_id` is a positive integer.
2. Parse and clamp `limit` (default 20, max 50).
3. Query `community_notifications` filtered by `recipient_type` and `recipient_id`, ordered by `created_at DESC`, limited to `limit` rows.
4. For each notification, JOIN with `community_posts` to get `post.title` (for display text like "your post titled X").
5. For each notification, resolve the actor's nickname: JOIN with `students` or `mentors` table based on `actor_type`. If no nickname is set, use a fallback like "익명" (anonymous).
6. Also compute `unreadCount` as a separate `SELECT COUNT(*)` query where `is_read = 0` for this recipient.
7. Return the combined result.

**SQL for notification list** (conceptual):

```sql
SELECT 
  n.id, n.type, n.post_id, n.actor_type, n.actor_id, n.is_read, n.created_at,
  p.title AS post_title,
  CASE 
    WHEN n.actor_type = 'student' THEN s.nickname
    WHEN n.actor_type = 'mentor' THEN m.nickname
  END AS actor_nickname
FROM community_notifications n
LEFT JOIN community_posts p ON n.post_id = p.id
LEFT JOIN students s ON n.actor_type = 'student' AND n.actor_id = s.id
LEFT JOIN mentors m ON n.actor_type = 'mentor' AND n.actor_id = m.id
WHERE n.recipient_type = ? AND n.recipient_id = ?
ORDER BY n.created_at DESC
LIMIT ?
```

**SQL for unread count**:

```sql
SELECT COUNT(*) as cnt FROM community_notifications
WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0
```

**Response shape**:

```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "type": "comment",
        "postId": 42,
        "postTitle": "물리 2단원 질문",
        "actorNickname": "닉네임123",
        "isRead": false,
        "createdAt": "2026-03-12 14:30:00"
      }
    ],
    "unreadCount": 3
  }
}
```

Field mapping from DB columns to response JSON:
- `n.id` -> `id`
- `n.type` -> `type`
- `n.post_id` -> `postId`
- `p.title` -> `postTitle` (use empty string if null)
- actor nickname -> `actorNickname` (use "익명" if null)
- `n.is_read` -> `isRead` (convert 0/1 to boolean)
- `n.created_at` -> `createdAt`

### Endpoint 2: GET /api/community/notifications/unread-count

**Query params**: `user_type`, `user_id`

**Logic**:
1. Validate params (same as above).
2. Run a single COUNT query on `community_notifications` where `recipient_type = ?`, `recipient_id = ?`, and `is_read = 0`.
3. Return the count.

This is the lightweight endpoint used for the tab badge. It should be fast -- the index on `(recipient_type, recipient_id, is_read, created_at DESC)` covers this query.

**Response shape**:

```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

### Endpoint 3: PUT /api/community/notifications/read-all

**Body (JSON)**: `{ user_type, user_id }`

**Logic**:
1. Validate `user_type` and `user_id` from the request body.
2. Run an UPDATE query setting `is_read = 1` for all notifications matching this recipient that are currently unread.
3. Return the number of rows affected (for debugging/confirmation).

**SQL**:

```sql
UPDATE community_notifications
SET is_read = 1
WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0
```

**Response shape**:

```json
{
  "success": true,
  "data": {
    "markedCount": 3
  }
}
```

The `markedCount` comes from `result.meta.changes` (D1's way of reporting affected rows).

### Route Registration Order

These endpoints must be registered **before** any catch-all or wildcard routes in the Hono router. The recommended placement is near other community endpoints (after board/post/comment/like endpoints from Sections 02-04).

Important: The `unread-count` route must be registered **before** the general `notifications` route to prevent path conflicts:

```typescript
// Register more-specific path first
app.get('/api/community/notifications/unread-count', async (c) => { ... });
app.put('/api/community/notifications/read-all', async (c) => { ... });
app.get('/api/community/notifications', async (c) => { ... });
```

### Error Handling

All three endpoints should wrap their logic in try/catch and return:

```typescript
return c.json({ success: false, error: '알림을 불러오는 중 오류가 발생했습니다' }, 500);
```

For invalid params (missing user_type, invalid user_id), return 400:

```typescript
return c.json({ success: false, error: 'user_type과 user_id가 필요합니다' }, 400);
```

## How Notifications Are Created (Reference Only)

This section does NOT create notifications -- that is Section 04's responsibility. For context, notifications are created in two places:

1. **Comment creation** (`POST /api/community/posts/:postId/comments`): When a user comments on a post, a notification is inserted for the post author (if the commenter is not the post author). The `type` is `'comment'`.

2. **Like toggle** (`POST /api/community/posts/:postId/like`): When a user likes a post (not unlikes), a notification is inserted for the post author. The `type` is `'like'`.

Both use `DB.batch()` to atomically insert the notification alongside the counter update. The notification row contains: `recipient_type` and `recipient_id` (from the post's author), `actor_type` and `actor_id` (the commenter/liker), `post_id`, and `type`.

## Checklist

- [ ] Add `GET /api/community/notifications` endpoint with JOIN for post title and actor nickname
- [ ] Add `GET /api/community/notifications/unread-count` endpoint (lightweight COUNT query)
- [ ] Add `PUT /api/community/notifications/read-all` endpoint (bulk UPDATE)
- [ ] Validate `user_type` and `user_id` on all three endpoints
- [ ] Register routes in correct order (specific paths before general)
- [ ] Map DB column names to camelCase response fields
- [ ] Convert `is_read` integer to boolean in response
- [ ] Handle null nicknames with "익명" fallback
- [ ] Handle null post titles with empty string fallback
- [ ] Cap `limit` param at 50
- [ ] Wrap all handlers in try/catch with Korean error messages
- [ ] Verify with curl tests above