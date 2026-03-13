Now I have all the context. Let me extract the relevant content for section-08-moderation-api.

# Section 08: Moderation API

## Overview

This section implements the moderation system for the community feature: report creation by users, report listing for mentors, report resolution, and mentor authority to delete posts/comments. These endpoints allow mentors to manage content in boards they oversee.

**Dependencies**: Section 01 (DB migration must be complete -- `community_reports`, `community_posts`, `community_comments` tables must exist).

**Blocks**: Section 10 (frontend board/posts UI will consume report and mentor-delete functionality).

---

## Database Context

This section uses the following tables created in Section 01:

**community_reports** -- Content reports for moderation.
- Fields: `id` (INTEGER PRIMARY KEY AUTOINCREMENT), `reporter_type` (TEXT), `reporter_id` (INTEGER), `target_type` (TEXT -- 'post' or 'comment'), `target_id` (INTEGER), `reason` (TEXT), `status` (TEXT -- 'pending', 'resolved', 'dismissed'), `resolved_by` (INTEGER, nullable -- mentor id), `resolved_at` (TEXT, nullable), `created_at` (TEXT)

**community_posts** -- Relevant fields for moderation:
- `is_deleted` (INTEGER 0/1), `deleted_by` (TEXT, nullable)

**community_comments** -- Relevant fields for moderation:
- `is_deleted` (INTEGER 0/1), `deleted_by` (TEXT, nullable)

**Academy resolution path** (used to verify mentor authority over boards):
```
students.group_id -> groups.mentor_id -> mentors.academy_name
```
For mentors, the `academy_name` field is directly on the `mentors` table. A mentor has authority over boards belonging to groups they manage or academy boards matching their `academy_name`.

---

## Tests (Manual API Verification)

All tests are manual curl commands. Run migration and seed data first.

### Test Setup

```bash
BASE="http://localhost:5173"
STUDENT_ID=1
STUDENT_ID_2=2
MENTOR_ID=1
```

### 8.1 Report Creation

**Test: POST report creates pending report**

```bash
curl -s -X POST "$BASE/api/community/report" \
  -H "Content-Type: application/json" \
  -d '{"reporter_type":"student","reporter_id":1,"target_type":"post","target_id":1,"reason":"부적절한 내용"}' | jq .
```
Expected: `{ success: true, data: { reportId: <number> } }`

**Test: Duplicate report by same user on same target is rejected**

```bash
# Run the same curl again
curl -s -X POST "$BASE/api/community/report" \
  -H "Content-Type: application/json" \
  -d '{"reporter_type":"student","reporter_id":1,"target_type":"post","target_id":1,"reason":"다시 신고"}' | jq .
```
Expected: `{ success: false, error: "이미 신고한 콘텐츠입니다" }` with status 409.

**Test: Report on a comment works**

```bash
curl -s -X POST "$BASE/api/community/report" \
  -H "Content-Type: application/json" \
  -d '{"reporter_type":"student","reporter_id":2,"target_type":"comment","target_id":1,"reason":"욕설 포함"}' | jq .
```
Expected: `{ success: true, data: { reportId: <number> } }`

### 8.2 Mentor Report Listing

**Test: GET mentor reports returns only reports for managed boards**

```bash
curl -s "$BASE/api/mentor/$MENTOR_ID/community-reports" | jq .
```
Expected: `{ success: true, data: { reports: [...] } }` where each report includes contextual information (post title or comment content, reporter info, target info). Only reports for boards the mentor manages should appear.

### 8.3 Report Resolution

**Test: PUT report with status='resolved' works**

```bash
curl -s -X PUT "$BASE/api/community/reports/1" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","resolved_by":1}' | jq .
```
Expected: `{ success: true, data: { reportId: 1, status: "resolved" } }`. The `resolved_at` field should be set to the current KST timestamp.

**Test: PUT report with status='resolved' and delete_content=true soft-deletes the target**

```bash
curl -s -X PUT "$BASE/api/community/reports/2" \
  -H "Content-Type: application/json" \
  -d '{"status":"resolved","resolved_by":1,"delete_content":true}' | jq .
```
Expected: The report is resolved AND the target post/comment has `is_deleted = 1`.

**Test: PUT report with status='dismissed' works**

```bash
curl -s -X PUT "$BASE/api/community/reports/1" \
  -H "Content-Type: application/json" \
  -d '{"status":"dismissed","resolved_by":1}' | jq .
```
Expected: `{ success: true, data: { reportId: 1, status: "dismissed" } }`

### 8.4 Mentor Delete Authority

Mentor delete for posts and comments is implemented in Section 03 (post API) and Section 04 (comment API) respectively. The authorization logic is:

**Test: DELETE posts/:postId works for mentor on managed boards**

```bash
curl -s -X DELETE "$BASE/api/community/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"mentor","user_id":1}' | jq .
```
Expected: `{ success: true }`. Post's `is_deleted = 1`, `deleted_by` set to mentor identifier.

**Test: DELETE comments/:commentId works for mentor**

```bash
curl -s -X DELETE "$BASE/api/community/comments/1" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"mentor","user_id":1}' | jq .
```
Expected: `{ success: true }`. Comment's `is_deleted = 1`, `deleted_by` set to mentor identifier.

Note: The actual delete endpoints are defined in sections 03 and 04. This section ensures the mentor authorization check is correct and documents the expected behavior.

---

## Implementation Details

All endpoints are added to `/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx`.

### API Response Format

All endpoints follow the existing pattern:
```typescript
// Success
return c.json({ success: true, data: { ... } });
// Failure
return c.json({ success: false, error: "메시지" }, 400);
```

### Endpoint 1: POST /api/community/report

**Purpose**: Allow students and mentors to report inappropriate posts or comments.

**Request body**:
```typescript
{
  reporter_type: 'student' | 'mentor',
  reporter_id: number,
  target_type: 'post' | 'comment',
  target_id: number,
  reason: string
}
```

**Logic**:
1. Validate required fields (`reporter_type`, `reporter_id`, `target_type`, `target_id`, `reason`).
2. Validate `target_type` is either `'post'` or `'comment'`.
3. Check the target exists and is not already deleted. If `target_type === 'post'`, query `community_posts` where `id = target_id AND is_deleted = 0`. If `target_type === 'comment'`, query `community_comments`.
4. Check for duplicate report: `SELECT id FROM community_reports WHERE reporter_type = ? AND reporter_id = ? AND target_type = ? AND target_id = ?`. If found, return 409 with `"이미 신고한 콘텐츠입니다"`.
5. Insert report with `status = 'pending'` and `created_at = datetime('now', '+9 hours')`.
6. Return `{ reportId }`.

### Endpoint 2: GET /api/mentor/:mentorId/community-reports

**Purpose**: List pending reports for boards the mentor manages.

**Logic**:
1. Get the mentor's `academy_name` from the `mentors` table.
2. Get all board IDs the mentor manages:
   - Group boards: `SELECT cb.id FROM community_boards cb JOIN groups g ON cb.group_id = g.id WHERE g.mentor_id = :mentorId AND cb.board_type = 'group'`
   - Academy boards: `SELECT id FROM community_boards WHERE board_type = 'academy' AND academy_name = :academyName`
3. For each report with `status = 'pending'`, join with the target content to provide context:
   - If `target_type = 'post'`: join with `community_posts` to get `board_id`, `title`, `content` (preview). Filter to only posts on the mentor's boards.
   - If `target_type = 'comment'`: join with `community_comments` then `community_posts` to get the `board_id`. Filter similarly.
4. Include reporter info (nickname) via join with `students` or `mentors` table based on `reporter_type`.
5. Return `{ reports: [...] }` sorted by `created_at DESC`.

**Response shape for each report**:
```typescript
{
  id: number,
  reporterNickname: string,
  targetType: 'post' | 'comment',
  targetId: number,
  targetPreview: string,  // first 100 chars of content
  postTitle: string | null,  // title of the post (or parent post for comments)
  reason: string,
  status: string,
  createdAt: string
}
```

### Endpoint 3: PUT /api/community/reports/:reportId

**Purpose**: Mentor resolves or dismisses a report, optionally deleting the reported content.

**Request body**:
```typescript
{
  status: 'resolved' | 'dismissed',
  resolved_by: number,  // mentor ID
  delete_content?: boolean  // if true and status='resolved', soft-delete the target
}
```

**Logic**:
1. Validate the report exists and is currently `'pending'`.
2. Verify `resolved_by` is a valid mentor who manages the relevant board (same authority check as endpoint 2).
3. Update the report: `SET status = ?, resolved_by = ?, resolved_at = datetime('now', '+9 hours')`.
4. If `status === 'resolved'` and `delete_content === true`:
   - Fetch the report to get `target_type` and `target_id`.
   - If `target_type === 'post'`: `UPDATE community_posts SET is_deleted = 1, deleted_by = 'mentor:' || ? WHERE id = ?`
   - If `target_type === 'comment'`: `UPDATE community_comments SET is_deleted = 1, deleted_by = 'mentor:' || ? WHERE id = ?`
   - For comments, also decrement the parent post's `comment_count` using `DB.batch()`.
5. Return `{ reportId, status }`.

### Mentor Delete Authority in Other Endpoints

Sections 03 and 04 implement `DELETE /api/community/posts/:postId` and `DELETE /api/community/comments/:commentId` respectively. The authorization check for mentor deletion should follow this pattern:

```typescript
// Pseudocode for mentor authorization check
async function canMentorModerateBoard(db, mentorId: number, boardId: number): Promise<boolean> {
  // Get mentor's academy
  const mentor = await db.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(mentorId).first();
  if (!mentor) return false;

  // Check if board belongs to mentor's group or academy
  const board = await db.prepare('SELECT * FROM community_boards WHERE id = ?').bind(boardId).first();
  if (!board) return false;

  if (board.board_type === 'academy') {
    return board.academy_name === mentor.academy_name;
  }
  if (board.board_type === 'group') {
    const group = await db.prepare('SELECT mentor_id FROM groups WHERE id = ?').bind(board.group_id).first();
    return group?.mentor_id === mentorId;
  }
  return false;
}
```

This helper function (or equivalent inline logic) should be used in:
- `DELETE /api/community/posts/:postId` (Section 03)
- `DELETE /api/community/comments/:commentId` (Section 04)
- `GET /api/mentor/:mentorId/community-reports` (this section)
- `PUT /api/community/reports/:reportId` (this section)

---

## Edge Cases

1. **Reported content already deleted**: If a mentor tries to resolve a report with `delete_content: true` but the target is already `is_deleted = 1`, the resolve should still succeed (update report status) but skip the delete step. Do not return an error.

2. **Report on non-existent target**: If `target_id` does not exist in the corresponding table, return 404 with `"신고 대상을 찾을 수 없습니다"`.

3. **Mentor resolving report outside their boards**: Return 403 with `"권한이 없습니다"`.

4. **Report already resolved/dismissed**: If a mentor tries to update a report that is not `'pending'`, return 400 with `"이미 처리된 신고입니다"`.

5. **Deleted post's comments**: When a post is soft-deleted via report resolution, its comments remain in the DB. The post detail view (Section 10) should show `"[삭제된 게시글]"` placeholder but comments can still be visible.

---

## Files to Modify

| File | Changes |
|------|---------|
| `/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx` | Add 3 new endpoints: `POST /api/community/report`, `GET /api/mentor/:mentorId/community-reports`, `PUT /api/community/reports/:reportId`. Add or share `canMentorModerateBoard()` helper. |

---

## Validation Checklist

Before marking this section complete, verify:

- [ ] POST report creates a pending report in `community_reports`
- [ ] Duplicate report by same user on same target returns 409
- [ ] GET mentor reports only returns reports for boards the mentor manages
- [ ] GET mentor reports includes context (post title, content preview, reporter nickname)
- [ ] PUT report with resolved status updates `resolved_at` timestamp
- [ ] PUT report with `delete_content: true` soft-deletes the target content
- [ ] PUT report on already-resolved report returns 400
- [ ] Mentor authority check correctly uses academy resolution path
- [ ] All responses follow `{ success: true/false, data/error }` format
- [ ] All timestamps use `datetime('now', '+9 hours')` for KST