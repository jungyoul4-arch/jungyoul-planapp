Now I have enough context to write the section.

# Section 02: Board API Endpoints

## Overview

This section implements the board listing and post listing API endpoints that serve as the entry point for the community feature. Two endpoints are created:

1. **GET /api/community/boards** -- Returns the boards a user can access based on their group/academy membership.
2. **GET /api/community/boards/:boardId/posts** -- Returns paginated posts for a specific board, with authorization checks.

Both endpoints are added to `src/index.tsx` (the single backend file containing all Hono routes).

**Depends on**: section-01-db-migration (the `community_boards` and `community_posts` tables must exist, and boards must be seeded during migration).

**Blocks**: section-09-frontend-navigation, section-10-frontend-board-posts (frontend needs these APIs to render board lists and post feeds).

---

## Academy Resolution Join Chain

Students do not have a direct `academy_name` field. To determine which academy a student belongs to, the following join chain is used:

```
students.group_id -> groups.mentor_id -> mentors.academy_name
```

This pattern is critical for:
- Determining which boards a student can see (their group board + their academy-wide board)
- Determining which boards a mentor can see (all group boards they manage + their academy board)
- Authorization checks when accessing board posts

For mentors, `academy_name` is directly on the `mentors` table, so no join is needed.

---

## Tests (Manual curl Verification)

These tests must pass before this section is considered complete. All tests assume the migration from section-01 has been run and boards have been auto-seeded.

### Test 1: Student gets only accessible boards

```bash
# Student should see: their own group board + academy-wide board
curl -s "$BASE/api/community/boards?user_type=student&user_id=1" | jq .
# Expected: { success: true, data: { boards: [ { board_type: "group", ... }, { board_type: "academy", ... } ] } }
# Verify: exactly 2 boards returned (1 group + 1 academy)
```

### Test 2: Mentor gets all managed group boards + academy board

```bash
curl -s "$BASE/api/community/boards?user_type=mentor&user_id=1" | jq .
# Expected: boards array includes all groups managed by mentor + academy board
```

### Test 3: Missing or invalid user_type/user_id returns error

```bash
curl -s "$BASE/api/community/boards" | jq .
# Expected: { success: false, error: "..." }

curl -s "$BASE/api/community/boards?user_type=student&user_id=99999" | jq .
# Expected: { success: false, error: "..." } or empty boards array
```

### Test 4: Board post listing returns paginated results

```bash
# Assuming board_id=1 exists and has posts (from seed data or manual creation)
curl -s "$BASE/api/community/boards/1/posts?page=1&limit=5&user_type=student&user_id=1" | jq .
# Expected: { success: true, data: { posts: [...], hasMore: true/false, totalCount: N } }
# Verify: posts array length <= 5, posts ordered by created_at DESC
```

### Test 5: Deleted posts excluded from listing

```bash
# After soft-deleting a post (is_deleted=1), it should not appear in the listing
curl -s "$BASE/api/community/boards/1/posts?page=1&limit=20&user_type=student&user_id=1" | jq '.data.posts | length'
# Verify: count does not include soft-deleted posts
```

### Test 6: Student cannot access another group's board (403)

```bash
# Student belongs to group 1, tries to access board for group 2
curl -s "$BASE/api/community/boards/2/posts?page=1&limit=20&user_type=student&user_id=1" | jq .
# Expected: { success: false, error: "..." } with 403 status
# (Only if board 2 is a group board for a different group)
```

### Test 7: Content preview is plain text, max 100 chars

```bash
# Create a post with HTML content, then list posts
# Verify: contentPreview field has HTML stripped and is truncated to 100 chars
```

### Test 8: Post listing includes postCount on board objects

```bash
curl -s "$BASE/api/community/boards?user_type=student&user_id=1" | jq '.data.boards[].postCount'
# Verify: each board has a numeric postCount field
```

---

## Implementation Details

### File to Modify

**`/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx`**

Add two new route handlers. Place them after the existing API endpoints (suggested location: after the mentor/admin endpoints, before or near where community-related routes would logically group).

### Endpoint 1: GET /api/community/boards

**Purpose**: Return all boards the authenticated user can access.

**Query parameters**: `user_type` ('student' | 'mentor'), `user_id` (integer)

**Logic flow**:

1. Validate `user_type` and `user_id` are present. Return 400 if missing.
2. Resolve the user's academy_name:
   - For students: Query `SELECT s.group_id, m.academy_name FROM students s JOIN groups g ON s.group_id = g.id JOIN mentors m ON g.mentor_id = m.id WHERE s.id = ?`. If no result, return error (student not found or not in a group).
   - For mentors: Query `SELECT academy_name FROM mentors WHERE id = ?`. If no result, return error.
3. Fetch accessible boards:
   - For students: Get the student's group board (`board_type='group' AND group_id = ?`) plus the academy board (`board_type='academy' AND academy_name = ?`).
   - For mentors: Get all group boards for groups they manage (`board_type='group' AND group_id IN (SELECT id FROM groups WHERE mentor_id = ?)`) plus the academy board.
4. For each board, include a `postCount` via a subquery or join: `SELECT COUNT(*) FROM community_posts WHERE board_id = ? AND is_deleted = 0`.
5. Return response: `{ success: true, data: { boards: [...] } }`

**Response shape per board object**:
```typescript
{
  id: number,
  board_type: 'group' | 'academy',
  name: string,
  group_id: number | null,
  description: string,
  postCount: number
}
```

**Key implementation notes**:
- Use a single query with LEFT JOIN to get post counts efficiently rather than N+1 queries.
- Example combined query pattern:
  ```sql
  SELECT b.*, COALESCE(pc.cnt, 0) as postCount
  FROM community_boards b
  LEFT JOIN (
    SELECT board_id, COUNT(*) as cnt FROM community_posts WHERE is_deleted = 0 GROUP BY board_id
  ) pc ON b.id = pc.board_id
  WHERE b.is_active = 1
    AND (
      (b.board_type = 'group' AND b.group_id = ?)
      OR (b.board_type = 'academy' AND b.academy_name = ?)
    )
  ```
- For mentors, the WHERE clause changes to use `b.group_id IN (SELECT id FROM groups WHERE mentor_id = ?)` for the group board condition.

### Endpoint 2: GET /api/community/boards/:boardId/posts

**Purpose**: Return paginated posts for a specific board, with authorization.

**Query parameters**: `page` (default 1), `limit` (default 20), `user_type`, `user_id`

**Logic flow**:

1. Parse `boardId` from URL params. Parse `page` and `limit` from query (with defaults).
2. Validate `user_type` and `user_id`. Return 400 if missing.
3. Fetch the board: `SELECT * FROM community_boards WHERE id = ? AND is_active = 1`. Return 404 if not found.
4. **Authorization check** -- verify the user can access this board:
   - If `board_type = 'group'`: For students, verify `students.group_id = board.group_id`. For mentors, verify the mentor manages the board's group (join `groups.mentor_id`).
   - If `board_type = 'academy'`: Resolve user's academy_name (same join chain as above) and verify it matches `board.academy_name`.
   - Return 403 with `"이 게시판에 접근할 수 없습니다"` if unauthorized.
5. Get total count: `SELECT COUNT(*) FROM community_posts WHERE board_id = ? AND is_deleted = 0`.
6. Fetch posts with offset pagination:
   ```sql
   SELECT p.id, p.title, p.content, p.like_count, p.comment_count, p.created_at,
          p.author_type, p.author_id,
          CASE WHEN p.author_type = 'student' THEN s.nickname ELSE m.nickname END as authorNickname,
          CASE WHEN p.author_type = 'student' THEN s.profile_emoji ELSE '🎓' END as authorEmoji,
          (SELECT COUNT(*) FROM community_post_photos WHERE post_id = p.id) as photoCount
   FROM community_posts p
   LEFT JOIN students s ON p.author_type = 'student' AND p.author_id = s.id
   LEFT JOIN mentors m ON p.author_type = 'mentor' AND p.author_id = m.id
   WHERE p.board_id = ? AND p.is_deleted = 0
   ORDER BY p.created_at DESC
   LIMIT ? OFFSET ?
   ```
   Where `OFFSET = (page - 1) * limit`.
7. For each post, generate `contentPreview`: strip HTML tags from `content`, truncate to 100 characters, append "..." if truncated.
8. Calculate `hasMore`: `totalCount > page * limit`.

**Response shape**:
```typescript
{
  success: true,
  data: {
    posts: [{
      id: number,
      title: string | null,
      contentPreview: string,
      authorNickname: string,
      authorEmoji: string,
      likeCount: number,
      commentCount: number,
      hasPhotos: boolean,
      createdAt: string
    }],
    hasMore: boolean,
    totalCount: number
  }
}
```

**Key implementation notes**:
- HTML stripping for content preview should be a simple server-side function. A basic approach: `content.replace(/<[^>]*>/g, '')` then trim and truncate. This does not need to be as robust as DOMPurify since it is only for preview text, not rendering.
- The `hasPhotos` field is derived from `photoCount > 0` -- this avoids sending full photo data in the list view.
- Default emoji for mentors is `'🎓'` since mentors may not have `profile_emoji` in the same way students do.
- Nickname fallback: if a user has no nickname set, use `'익명'` (anonymous) as the display name.

### Helper Function: stripHtmlTags

Add a small utility function near the top of `src/index.tsx` (alongside the existing `generateInviteCode` helper):

```typescript
/** Strip HTML tags and return plain text, truncated to maxLen chars */
function stripHtmlForPreview(html: string, maxLen: number = 100): string {
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}
```

### API Response Format

Follow the existing project convention strictly:

```typescript
// Success
return c.json({ success: true, data: { boards: [...] } });

// Error
return c.json({ success: false, error: "에러 메시지" }, 400);
```

### D1 SQLite Reminders

- Use `datetime('now','+9 hours')` for KST timestamps (not `NOW()`)
- Use `?` for parameter binding
- `COALESCE()` for handling NULL counts
- `LEFT JOIN` for optional author info (in case of deleted authors)

---

## Existing Code Patterns to Follow

The existing `generateInviteCode()` function at approximately line 1075 of `src/index.tsx` demonstrates the project's utility function pattern. The board API endpoints should follow the same style as existing endpoints such as `app.get('/api/mentor/:mentorId/groups', ...)` at line 1601.

The group creation endpoint at `app.post('/api/mentor/groups', ...)` (line 1579) is important context because section-01 adds a board creation hook here -- after creating a group, it should also create a corresponding `community_boards` row. This section does not modify that endpoint (section-01 handles it), but the board listing API depends on those boards existing.

---

## Checklist

1. Add `stripHtmlForPreview` helper function to `src/index.tsx`
2. Implement `GET /api/community/boards` with academy resolution join chain
3. Implement `GET /api/community/boards/:boardId/posts` with authorization and pagination
4. Run migration to ensure boards are seeded
5. Verify all 8 manual tests pass via curl
6. Confirm no TypeScript compilation errors (`npm run build` succeeds)