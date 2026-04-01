Now I have enough context to write the section.

# Section 03: Post CRUD API Endpoints

## Overview

This section implements the four core Post CRUD endpoints for the community feature:

- **POST** `/api/community/boards/:boardId/posts` -- Create a new post
- **GET** `/api/community/posts/:postId` -- Get post detail
- **PUT** `/api/community/posts/:postId` -- Edit a post
- **DELETE** `/api/community/posts/:postId` -- Soft-delete a post

All endpoints are added to `src/index.tsx`, following the existing Hono route patterns. They depend on the database tables created in **section-01-db-migration** (specifically `community_posts`, `community_post_photos`, `community_boards`).

---

## Dependencies

- **section-01-db-migration**: Tables `community_posts`, `community_post_photos`, `community_boards`, `students`, `mentors` must exist with the schema described in the migration section.
- The `students` and `mentors` tables must already have the `nickname` column added by migration.

---

## Tests (Manual API Verification)

All tests use curl against the local dev server (`npm run dev` at `http://localhost:5173`). Run migration and seed data first.

### Test 1: Create a post successfully

```bash
# Create a basic post on board 1
curl -s -X POST "http://localhost:5173/api/community/boards/1/posts" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":1,"title":"테스트 게시글","content":"<b>안녕하세요!</b> 첫 게시글입니다."}' | jq .
# Expected: { "success": true, "data": { "postId": <number> } }
```

### Test 2: Create post rejects title > 100 chars

```bash
LONG_TITLE=$(python3 -c "print('가' * 101)")
curl -s -X POST "http://localhost:5173/api/community/boards/1/posts" \
  -H "Content-Type: application/json" \
  -d "{\"author_type\":\"student\",\"author_id\":1,\"title\":\"$LONG_TITLE\",\"content\":\"내용\"}" | jq .
# Expected: { "success": false, "error": "제목은 100자 이내로 작성해주세요" }
```

### Test 3: Create post rejects content > 10,000 chars

```bash
LONG_CONTENT=$(python3 -c "print('나' * 10001)")
curl -s -X POST "http://localhost:5173/api/community/boards/1/posts" \
  -H "Content-Type: application/json" \
  -d "{\"author_type\":\"student\",\"author_id\":1,\"title\":\"제목\",\"content\":\"$LONG_CONTENT\"}" | jq .
# Expected: { "success": false, "error": "내용은 10,000자 이내로 작성해주세요" }
```

### Test 4: Create post rejects more than 5 photos

```bash
# Build a JSON array with 6 photo objects
curl -s -X POST "http://localhost:5173/api/community/boards/1/posts" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":1,"title":"사진 테스트","content":"내용","photos":[{"data":"a","mime_type":"image/jpeg"},{"data":"b","mime_type":"image/jpeg"},{"data":"c","mime_type":"image/jpeg"},{"data":"d","mime_type":"image/jpeg"},{"data":"e","mime_type":"image/jpeg"},{"data":"f","mime_type":"image/jpeg"}]}' | jq .
# Expected: { "success": false, "error": "사진은 최대 5장까지 첨부할 수 있습니다" }
```

### Test 5: Create post with authorization check -- student must belong to board

```bash
# Student 1 tries to post on a board they do not belong to (e.g., another group's board)
# Expected: { "success": false, "error": "이 게시판에 접근 권한이 없습니다" } with status 403
```

### Test 6: Get post detail returns full post with author info and like status

```bash
curl -s "http://localhost:5173/api/community/posts/1?user_type=student&user_id=1" | jq .
# Expected: { "success": true, "data": { "post": { "id": 1, "title": "...", "content": "...",
#   "authorNickname": "...", "authorType": "student", "likeCount": 0, "commentCount": 0,
#   "photos": [...], "isLikedByMe": false, "createdAt": "...", "updatedAt": "..." } } }
```

### Test 7: Edit post -- only the original author can edit

```bash
# Author edits their own post (should succeed)
curl -s -X PUT "http://localhost:5173/api/community/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":1,"title":"수정된 제목","content":"수정된 내용"}' | jq .
# Expected: { "success": true }

# Non-author tries to edit (should fail)
curl -s -X PUT "http://localhost:5173/api/community/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":999,"title":"악의적 수정","content":"해킹"}' | jq .
# Expected: { "success": false, "error": "본인의 게시글만 수정할 수 있습니다" } with status 403
```

### Test 8: Delete post -- author soft-deletes

```bash
curl -s -X DELETE "http://localhost:5173/api/community/posts/1" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":1}' | jq .
# Expected: { "success": true }
# Verify: GET /api/community/posts/1 should show deleted indicator or 404
```

### Test 9: Delete post -- mentor can delete any post on managed boards

```bash
curl -s -X DELETE "http://localhost:5173/api/community/posts/2" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"mentor","user_id":1}' | jq .
# Expected: { "success": true } (mentor has moderation authority on their boards)
```

### Test 10: Post with photos stores photo records correctly

```bash
# Create post with 2 photos, then GET detail and verify photos array has 2 entries
curl -s -X POST "http://localhost:5173/api/community/boards/1/posts" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":1,"title":"사진 게시글","content":"내용","photos":[{"data":"base64data1","mime_type":"image/jpeg"},{"data":"base64data2","mime_type":"image/png"}]}' | jq .
# Then GET the post and verify photos array length is 2
```

### Validation checks built into the code

- Title max 100 chars (server-side, reject with 400)
- Content max 10,000 chars (server-side, reject with 400)
- Max 5 photos per post (server-side, reject with 400)
- Board access authorization before allowing post creation
- Author identity verification for edit and delete
- Mentor board ownership verification for mentor delete
- HTML content sanitization (strip dangerous tags/attributes before DB storage)

---

## Implementation Details

### File to modify

**`/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx`** -- Add four new route handlers.

### Background: Existing API Patterns

All endpoints in this project follow this structure:

```typescript
app.post('/api/some/path', async (c) => {
  try {
    const body = await c.req.json();
    // validation...
    // DB operations via c.env.DB.prepare(...).bind(...).run()
    return c.json({ success: true, data: { ... } });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});
```

- Database access: `c.env.DB` (Cloudflare D1)
- R2 storage: `c.env.R2` (for photo storage)
- KST timestamps: Use the existing `getKSTString()` helper already defined at the top of the file
- Batch operations: `c.env.DB.batch([stmt1, stmt2, ...])` for atomic multi-statement operations

### Academy Resolution Helper

Multiple endpoints need to determine which academy a student or mentor belongs to. Create a shared helper function near the top of `src/index.tsx` (after the existing helper functions):

```typescript
async function resolveAcademy(db: D1Database, userType: string, userId: number): Promise<string | null> {
  /** 
   * Resolves academy_name for a user.
   * Students: students.group_id → groups.mentor_id → mentors.academy_name
   * Mentors: direct lookup on mentors.academy_name
   */
  // Implementation: single JOIN query for students, direct SELECT for mentors
}
```

### Board Authorization Helper

Create a helper to verify a user can access a given board:

```typescript
async function canAccessBoard(db: D1Database, boardId: number, userType: string, userId: number): Promise<boolean> {
  /**
   * Checks if user can access the specified board.
   * - Group board: student must belong to that group, or mentor must manage it
   * - Academy board: user must belong to that academy (resolved via join chain)
   */
}
```

### Server-Side HTML Sanitization

Since DOMPurify is a browser/Node library and not available in Cloudflare Workers, implement a lightweight server-side sanitizer. This strips dangerous HTML elements and attributes before storing content:

```typescript
function sanitizeHTML(html: string): string {
  /**
   * Strip script tags, on* event handlers, javascript: URIs, 
   * style tags, and other dangerous HTML.
   * Allow safe formatting tags: b, i, strong, em, a (href only, no javascript:),
   * ul, ol, li, p, br, h1-h6, blockquote.
   * This is a defense-in-depth measure; DOMPurify on the client handles rendering.
   */
}
```

A regex-based approach is acceptable here since the primary sanitization happens client-side with DOMPurify. The server-side version is defense-in-depth.

### Plain Text Extraction Helper

For generating content previews in post listings (used by section-02-board-api but defined here since it relates to post content):

```typescript
function stripHTMLForPreview(html: string, maxLength: number = 100): string {
  /**
   * Remove all HTML tags and return first maxLength characters of plain text.
   * Used for post list content previews.
   */
}
```

### Endpoint 1: POST /api/community/boards/:boardId/posts

Create a new post. Key logic:

1. Parse body: `author_type`, `author_id`, `title`, `content`, `photos` (optional array)
2. **Validate**:
   - `author_type` must be 'student' or 'mentor'
   - `title` max 100 chars (title is optional/nullable, but if provided must be within limit)
   - `content` max 10,000 chars
   - `photos` array max 5 items
3. **Authorize**: Call `canAccessBoard()` to verify the user can post to this board
4. **Sanitize**: Run `sanitizeHTML(content)` before storage
5. **Insert post**: INSERT into `community_posts` with fields: `board_id`, `author_type`, `author_id`, `title`, `content`, `like_count` (0), `comment_count` (0), `is_deleted` (0), `created_at` (KST), `updated_at` (KST)
6. **Insert photos** (if any): For each photo, attempt R2 storage first (`c.env.R2.put()`). If R2 is available, store the R2 key. If not, store base64 in a `photo_data` column as fallback. Generate a small thumbnail (or store the base64 directly for now). Use `DB.batch()` to insert all photo records atomically.
7. Return `{ success: true, data: { postId } }`

Photo storage detail:
- R2 key format: `community/posts/{postId}/{sortOrder}.{ext}`
- Thumbnail: For MVP, store a truncated version of base64 (first 200px width) or store the original data and generate thumbnails client-side
- `community_post_photos` fields: `post_id`, `r2_key`, `photo_data` (fallback), `thumbnail`, `mime_type`, `file_size`, `sort_order`, `created_at`

### Endpoint 2: GET /api/community/posts/:postId

Get full post detail. Key logic:

1. Query params: `user_type`, `user_id` (for determining `isLikedByMe`)
2. **Fetch post**: SELECT from `community_posts` WHERE `id = ?` AND `is_deleted = 0`
3. **Fetch author info**: JOIN with `students` or `mentors` table based on `author_type` to get `nickname`
4. **Fetch photos**: SELECT from `community_post_photos` WHERE `post_id = ?` ORDER BY `sort_order`
5. **Check like status**: SELECT from `community_likes` WHERE `post_id = ?` AND `user_type = ?` AND `user_id = ?`
6. If R2 photos exist, generate presigned URLs or serve via a photo endpoint. For base64 fallback, return data directly.
7. Return the assembled post object with: `id`, `title`, `content`, `authorNickname`, `authorType`, `authorId`, `likeCount`, `commentCount`, `photos`, `isLikedByMe`, `createdAt`, `updatedAt`

If the post is not found or is deleted, return 404 with `{ success: false, error: "게시글을 찾을 수 없습니다" }`.

### Endpoint 3: PUT /api/community/posts/:postId

Edit a post. Key logic:

1. Parse body: `author_type`, `author_id`, `title`, `content`, `photos` (optional)
2. **Fetch existing post**: Verify it exists and is not deleted
3. **Authorize**: Only the original author can edit (`post.author_type === author_type && post.author_id === author_id`). Return 403 otherwise.
4. **Validate**: Same title/content length checks as creation
5. **Sanitize**: Run `sanitizeHTML(content)`
6. **Update post**: SET `title`, `content`, `updated_at = getKSTString()`
7. **Update photos** (if photos array provided): Delete all existing photos for this post, then re-insert the new set. This is simpler than differential updates. Use `DB.batch()` for atomicity.
8. Return `{ success: true }`

### Endpoint 4: DELETE /api/community/posts/:postId

Soft-delete a post. Key logic:

1. Parse body: `user_type`, `user_id`
2. **Fetch existing post**: Verify it exists and is not already deleted
3. **Authorize**:
   - If `user_type === post.author_type && user_id === post.author_id` -- author deleting own post (allowed)
   - If `user_type === 'mentor'` -- verify this mentor manages the board the post belongs to (check board's group or academy matches mentor). This requires joining `community_boards` with `groups`/`mentors`.
   - Otherwise return 403
4. **Soft delete**: UPDATE `community_posts` SET `is_deleted = 1`, `deleted_by = user_type + ':' + user_id`, `updated_at = getKSTString()`
5. Return `{ success: true }`

Note: Comments on a deleted post remain in the database. The frontend (section-10) handles displaying "[삭제된 게시글]" when viewing comments that reference deleted posts.

---

## Key D1/SQLite Reminders

- Use `INTEGER PRIMARY KEY AUTOINCREMENT` (not AUTO_INCREMENT)
- Use `datetime('now','+9 hours')` for KST in raw SQL, or use the `getKSTString()` TypeScript helper and bind the value
- Use `?` for parameter binding
- `result.meta.last_row_id` gives the auto-incremented ID after INSERT
- `DB.batch()` accepts an array of prepared statements for atomic execution
- `RETURNING *` is supported (D1 is SQLite 3.35+) but the existing codebase prefers `last_row_id`

---

## Response Format

All responses must follow the project standard:

```typescript
// Success
return c.json({ success: true, data: { postId: number } });

// Failure  
return c.json({ success: false, error: "한국어 에러 메시지" }, 400);  // or 403, 404, 500
```

---

## Placement in src/index.tsx

Add the helper functions (`resolveAcademy`, `canAccessBoard`, `sanitizeHTML`, `stripHTMLForPreview`) after the existing helper block (near line 70, after `fetchWithTimeout`). These helpers will also be used by section-02-board-api, section-04-comment-like-api, and section-08-moderation-api.

Add the four route handlers in a clearly commented section:

```typescript
// ==================== 커뮤니티: 게시글 CRUD ====================
```

Place this after the board endpoints (added by section-02-board-api) or in the general community API area. The exact line number depends on where section-02 places its routes, but the community endpoints should be grouped together.