# Implementation Plan: 플랜앱 교학상장 소통창구

## 1. Overview

### What We're Building
A community bulletin board system integrated into an existing high school credit planner app (고교학점플래너). The app currently serves ~150 students and ~10 mentors across multiple class groups within an academy (학원). Students use it to track class records, questions, teaching activities, exams, and assignments.

The new "소통" (Communication) feature adds an **Everytime-style bulletin board** where students and mentors can post, comment, like, and interact. It also includes a **friend invite system** for connecting students across class groups, and **selective learning profile sharing** between friends.

### Why This Approach
- **Board over chat**: The stakeholder chose asynchronous posts+comments over real-time chat. This eliminates the need for Durable Objects/WebSocket infrastructure — D1 alone handles all persistence.
- **Tab replacement**: A "community" tab already exists in the app but currently redirects to an external URL (`jungyoul-academy.pages.dev/community`). This plan **replaces** that stub with a fully in-app bulletin board.
- **Nicknames**: Students use nicknames instead of real names, encouraging freer participation while maintaining accountability through mentor moderation.
- **No XP integration**: The board is purely for communication — no gamification incentives.
- **Notifications**: An unread badge on the community tab alerts users to new comments on their posts and new likes.

### Tech Stack (Unchanged)
- **Backend**: Hono + TypeScript on Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Frontend**: Vanilla JS SPA + TailwindCSS CDN
- **Deployment**: Cloudflare Pages via `npm run deploy`
- **HTML Sanitization**: DOMPurify via CDN for safe rich text rendering

### Key Constraints
- TailwindCSS CDN only — no arbitrary values, no custom config
- D1 SQLite syntax — `INTEGER PRIMARY KEY AUTOINCREMENT`, `datetime('now','+9 hours')`, no MySQL
- Vanilla JS — no React/Vue, innerHTML-based rendering, global state proxy
- Follow existing patterns: `goScreen()`, `renderScreen()`, `DB` object, `{ success, data/error }` API response format
- Glassmorphism design system already in use
- Authentication follows existing pattern (user_type + user_id in request params). No dedicated auth middleware exists in the current app — this is a known limitation across the entire system, not specific to community features. Full auth hardening is a separate project.

### Academy Resolution Path
Students don't have a direct `academy_name` field. To determine a student's academy:
```
students.group_id → groups.mentor_id → mentors.academy_name
```
This join chain is used throughout the community feature for: board access control, friend invite validation, and nickname uniqueness checks.

---

## 2. Database Schema

### Existing Table Modifications

Add `nickname` column to both `students` and `mentors` tables:

```sql
ALTER TABLE students ADD COLUMN nickname TEXT;
ALTER TABLE mentors ADD COLUMN nickname TEXT;
```

### New Tables (10 total)

**community_boards** — Defines available boards (group-specific and academy-wide).
- Fields: `id`, `board_type` ('group'|'academy'), `group_id` (nullable FK to groups), `academy_name` (for academy boards), `name`, `description`, `is_active`, `created_at`
- Auto-created during migration: one 'academy' board per academy, one 'group' board per active group
- **Lifecycle**: When new groups are created (via mentor/admin), a corresponding 'group' board must also be created. The board creation logic should be added to the group creation endpoint, and the migration must be idempotent (check before insert).

**community_posts** — User-submitted posts.
- Fields: `id`, `board_id` (FK), `author_type` ('student'|'mentor'), `author_id`, `title` (nullable — some posts may be title-less), `content` (rich text as HTML, sanitized with DOMPurify), `like_count` (denormalized counter), `comment_count` (denormalized counter), `is_deleted` (soft delete flag), `deleted_by` (who deleted — self or moderator mentor), `created_at`, `updated_at`
- Indexes: `(board_id, is_deleted, created_at DESC)` for listing, `(author_type, author_id)` for "my posts"
- **Content limits**: title max 100 chars, content max 10,000 chars. Enforce both client-side and server-side.

**community_post_photos** — Photos attached to posts. Uses R2 storage pattern (not raw base64) to avoid performance issues with large payloads.
- Fields: `id`, `post_id` (FK), `r2_key` (R2 object key), `thumbnail` (base64 small thumbnail for list view), `mime_type`, `file_size`, `sort_order`, `created_at`
- Limit: max 5 photos per post
- Upload flow: Client compresses → base64 → API → store to R2 → save r2_key to DB
- If R2 is not yet configured, fall back to `photo_data` (base64) with a clear TODO to migrate to R2

**community_comments** — Comments on posts.
- Fields: `id`, `post_id` (FK), `author_type`, `author_id`, `content` (plain text, max 1,000 chars), `is_deleted`, `deleted_by`, `created_at`
- Index: `(post_id, is_deleted, created_at ASC)` for chronological display

**community_likes** — Post likes (one per user per post).
- Fields: `id`, `post_id` (FK), `user_type`, `user_id`, `created_at`
- Unique constraint: `(post_id, user_type, user_id)` — prevents double-likes
- Toggle behavior: INSERT on like, DELETE on unlike
- **All counter updates (like_count, comment_count) must use `DB.batch()`** for atomicity

**community_reports** — Content reports for moderation.
- Fields: `id`, `reporter_type`, `reporter_id`, `target_type` ('post'|'comment'), `target_id`, `reason`, `status` ('pending'|'resolved'|'dismissed'), `resolved_by` (mentor id), `resolved_at`, `created_at`

**community_notifications** — Notifications for community activity.
- Fields: `id`, `recipient_type` ('student'|'mentor'), `recipient_id`, `type` ('comment'|'like'), `post_id` (FK), `actor_type`, `actor_id`, `is_read` (0/1), `created_at`
- Index: `(recipient_type, recipient_id, is_read, created_at DESC)` for unread count + listing

**friendships** — Bidirectional friend relationships between students.
- Fields: `id`, `student_id_1`, `student_id_2`, `status` ('pending'|'accepted'|'blocked'), `invited_by` (FK students), `invite_code`, `accepted_at`, `created_at`
- Unique constraint: `(student_id_1, student_id_2)` — always store with smaller id first to prevent duplicates
- Convention: `student_id_1 = MIN(a, b)`, `student_id_2 = MAX(a, b)` enforced at insert time
- **Query pattern**: Always normalize IDs before lookup. For finding friendship between user A and B: `WHERE student_id_1 = MIN(A,B) AND student_id_2 = MAX(A,B)`. For listing all friends of user A: `WHERE (student_id_1 = A OR student_id_2 = A) AND status = 'accepted'`
- Hard delete for unfriending. Blocking creates a new row with status='blocked' (or updates existing).

**friend_invite_codes** — Invite codes for friend connections.
- Fields: `id`, `student_id` (FK), `code` (unique), `max_uses` (default 5), `use_count`, `expires_at`, `is_active`, `created_at`
- Code format: reuse existing `generateInviteCode()` pattern (`JYCC-XXXX-XXXX`)
- **Collision handling**: On unique constraint violation, retry code generation up to 3 times

**learning_share_settings** — Per-student sharing preferences.
- Fields: `id`, `student_id` (FK, unique), `share_class_records` (0/1), `share_question_count` (0/1), `share_teach_count` (0/1), `share_mission_status` (0/1), `share_xp_level` (0/1), `updated_at`
- Default: all sharing off (0)

---

## 3. API Design

All endpoints follow the existing pattern: `{ success: true, data: {...} }` on success, `{ success: false, error: "msg" }` on failure. All timestamps use `datetime('now','+9 hours')` for KST.

### 3.1 Board Endpoints

**GET /api/community/boards**
- Query params: `user_type`, `user_id`
- Logic: Return boards the user can access. For students: their group board + academy board. For mentors: all their managed group boards + academy board.
- Academy resolution: student → group → mentor → academy_name
- Response: `{ boards: [{ id, board_type, name, group_id, postCount }] }`

**GET /api/community/boards/:boardId/posts**
- Query params: `page` (default 1), `limit` (default 20), `user_type`, `user_id`
- Authorization: Verify user belongs to the board's group or academy
- Offset-based pagination: `OFFSET = (page - 1) * limit`
- Response: `{ posts: [{ id, title, contentPreview, authorNickname, authorEmoji, likeCount, commentCount, hasPhotos, createdAt }], hasMore, totalCount }`
- Content preview: first 100 chars of plain text (strip HTML)

**POST /api/community/boards/:boardId/posts**
- Body: `{ author_type, author_id, title, content, photos: [{ data, mime_type }] }`
- Authorization: Verify user can post to this board
- Validation: title max 100 chars, content max 10,000 chars, max 5 photos
- Sanitize content with DOMPurify-equivalent server-side stripping before storage
- Transaction: Insert post, then insert photos if any (use `DB.batch()`)
- Response: `{ postId }`

**GET /api/community/posts/:postId**
- Include: author info (nickname, emoji), photos, whether current user liked it
- Response: `{ post: { id, title, content, authorNickname, authorEmoji, authorType, likeCount, commentCount, photos: [...], isLikedByMe, createdAt, updatedAt } }`

**PUT /api/community/posts/:postId**
- Body: `{ author_type, author_id, title, content }` — only the author can edit
- Explicitly set `updated_at = datetime('now','+9 hours')`
- Photo editing: delete all existing photos and re-insert (simpler than differential update)

**DELETE /api/community/posts/:postId**
- Body: `{ user_type, user_id }` (using body, not query params)
- Authorization: Author can delete own post, mentors can delete any post in their boards
- Soft delete: set `is_deleted = 1`, `deleted_by`

### 3.2 Comment Endpoints

**GET /api/community/posts/:postId/comments**
- Query params: `page` (default 1), `limit` (default 20)
- Response: `{ comments: [{ id, content, authorNickname, authorEmoji, authorType, createdAt }], hasMore }`
- Paginated, chronological order, non-deleted only

**POST /api/community/posts/:postId/comments**
- Body: `{ author_type, author_id, content }`
- Validation: content max 1,000 chars
- Use `DB.batch()` for atomic: comment INSERT + post comment_count UPDATE + notification INSERT
- Creates notification for post author (if commenter ≠ post author)

**DELETE /api/community/comments/:commentId**
- Body: `{ user_type, user_id }`
- Authorization: same as post deletion (author or mentor)
- Use `DB.batch()` for atomic: comment soft-delete + post comment_count decrement

### 3.3 Like Endpoint

**POST /api/community/posts/:postId/like**
- Body: `{ user_type, user_id }`
- Toggle behavior: Check if like exists → DELETE if yes (unlike), INSERT if no (like)
- Use `DB.batch()` for atomic: like INSERT/DELETE + post like_count UPDATE (+1 or -1) + optional notification INSERT
- Creates notification for post author on like (not on unlike)
- Response: `{ liked: true/false, likeCount: N }`

### 3.4 Notification Endpoints

**GET /api/community/notifications**
- Query params: `user_type`, `user_id`, `limit` (default 20)
- Response: `{ notifications: [{ id, type, postId, postTitle, actorNickname, isRead, createdAt }], unreadCount }`

**GET /api/community/notifications/unread-count**
- Query params: `user_type`, `user_id`
- Response: `{ unreadCount: N }` — used for tab badge

**PUT /api/community/notifications/read-all**
- Body: `{ user_type, user_id }`
- Mark all unread notifications as read

### 3.5 Report Endpoints

**POST /api/community/report**
- Body: `{ reporter_type, reporter_id, target_type, target_id, reason }`
- Duplicate check: prevent same user reporting same target twice

**GET /api/mentor/:mentorId/community-reports**
- Returns pending reports for boards the mentor manages
- Join with posts/comments to show context

**PUT /api/community/reports/:reportId**
- Body: `{ status, resolved_by }` — mentor resolves or dismisses
- If resolved: optionally soft-delete the reported content

### 3.6 Friend Endpoints

**POST /api/student/:studentId/friends/invite-code**
- Generate invite code using existing `generateInviteCode()` pattern
- Collision handling: retry up to 3 times on unique constraint violation
- Store in `friend_invite_codes` with default 5 uses, 7-day expiry
- Response: `{ code, expiresAt }`

**POST /api/student/:studentId/friends/accept-code**
- Body: `{ code }`
- Validate: code exists, active, not expired, not max uses
- Academy check: resolve both students' academy_name via group → mentor join chain
- Self-invite prevention: check inviter ≠ accepter
- Normalize IDs: `student_id_1 = MIN(inviter, accepter)`, `student_id_2 = MAX(...)`
- Check for existing friendship (any status) before creating
- Create friendship with status 'accepted'
- Increment use_count
- Response: `{ friendId, friendNickname }`

**GET /api/student/:studentId/friends**
- Query: `WHERE (student_id_1 = ? OR student_id_2 = ?) AND status = 'accepted'`
- Join with students table to get friend details
- Response: `{ friends: [{ friendshipId, studentId, nickname, emoji, schoolName }] }`

**DELETE /api/student/:studentId/friends/:friendshipId**
- Remove friendship (hard delete)

### 3.7 Nickname & Settings Endpoints

**PUT /api/student/:studentId/nickname**
- Body: `{ nickname }`
- Validation: 2-12 chars, Korean/alphanumeric/spaces only, basic profanity blocklist, unique within academy
- Academy uniqueness check: join student → group → mentor to get academy_name, then check all students in that academy
- Update `students.nickname`

**PUT /api/mentor/:mentorId/nickname**
- Same pattern for mentors

**GET /api/student/:studentId/share-settings**
- Return current sharing preferences
- Create default row if none exists (all 0)

**PUT /api/student/:studentId/share-settings**
- Body: `{ share_class_records, share_question_count, share_teach_count, share_mission_status, share_xp_level }`
- Upsert pattern: `INSERT OR REPLACE`

**GET /api/student/:studentId/learning-profile**
- Query param: `viewer_id` — the student requesting the profile
- Authorization: viewer must be friends with target student (check friendships table with normalized IDs)
- Return only fields the target has enabled in share_settings
- Aggregate data from existing tables (COUNT of class_records, question_records, teach_records, etc.)

---

## 4. Frontend Architecture

### 4.1 Navigation Integration

The app already has a 'community' tab that redirects to an external URL. **Replace** the existing `renderCommunityTab()` function (currently at ~line 12890 in app.js) with the new in-app community implementation. Remove the `openCommunityNewTab()` function and the external URL reference.

The tab order remains: `home`, `community`, `my`, `growth`, `archive`.

### 4.2 Screen Map

New screens to replace/add in `renderScreen()`:

| Screen Name | Renderer | Description |
|-------------|----------|-------------|
| `community-home` | `renderCommunityHome()` | Board list + recent posts preview |
| `community-board` | `renderCommunityBoard(boardId)` | Post list for a specific board |
| `community-post-detail` | `renderPostDetail(postId)` | Full post + comments |
| `community-post-editor` | `renderPostEditor(boardId, postId?)` | Write/edit post (rich text) |
| `community-friends` | `renderFriendsList()` | Friend list + invite code |
| `community-friend-profile` | `renderFriendProfile(studentId)` | Friend's shared learning data |
| `community-share-settings` | `renderShareSettings()` | Toggle sharing preferences |
| `community-nickname-setup` | `renderNicknameSetup()` | Set/change nickname |
| `community-reports` | `renderReportList()` | Mentor-only: pending reports |
| `community-notifications` | `renderNotificationList()` | Activity notifications |

### 4.3 State Additions

Add to the global `state` object:

```javascript
// Community state
_communityBoards: [],
_communityPosts: [],
_communityCurrentBoard: null,
_communityCurrentPost: null,
_communityComments: [],
_communityFriends: [],
_communityShareSettings: null,
_communityPage: 1,
_communityHasMore: false,
_communityUnreadCount: 0,
_communityNotifications: [],
```

### 4.4 DB API Layer Additions

Add community methods to the `DB` object following existing patterns:

```javascript
DB.loadCommunityBoards()
DB.loadCommunityPosts(boardId, page)
DB.loadPostDetail(postId)
DB.savePost(boardId, postData)
DB.updatePost(postId, postData)
DB.deletePost(postId)
DB.loadComments(postId, page)
DB.saveComment(postId, content)
DB.deleteComment(commentId)
DB.toggleLike(postId)
DB.reportContent(targetType, targetId, reason)
DB.loadFriends()
DB.generateFriendInviteCode()
DB.acceptFriendCode(code)
DB.removeFriend(friendshipId)
DB.loadShareSettings()
DB.updateShareSettings(settings)
DB.loadFriendProfile(studentId)
DB.setNickname(nickname)
DB.loadNotifications()
DB.getUnreadNotificationCount()
DB.markNotificationsRead()
```

### 4.5 Rich Text Editor

For post content editing, implement a simple rich text approach:

- Use a `contenteditable` div (not textarea) for WYSIWYG editing
- Toolbar buttons for: **Bold**, *Italic*, Link, List
- Store content as sanitized HTML in the database
- **Sanitization**: Include DOMPurify via CDN (`<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.x.x/purify.min.js">`). Sanitize on save (before sending to API) and on render (before innerHTML assignment). This handles `<script>`, `javascript:` URIs, `on*` event handlers, CSS attacks, SVG vectors, and encoded payloads.
- For rendering in post list, strip HTML tags for preview text using a helper function

### 4.6 Photo Upload

Follow the existing photo handling pattern with R2 storage preference:
1. User selects photos (max 5) via `<input type="file" accept="image/*" multiple>`
2. Compress client-side using Canvas API (resize to max 1200px width, JPEG quality 0.7)
3. Convert to base64 for transmission
4. API stores to R2 (if available) or falls back to DB storage
5. Store R2 key (or base64 fallback) in `community_post_photos` table
6. Generate small thumbnail (200px width) for list view

Display: Show thumbnails in post list, full-size in post detail with tap-to-zoom.

### 4.7 Nickname First-Time Setup

When a user first enters the community tab and has no nickname set:
1. Show `community-nickname-setup` screen
2. Input field with validation (2-12 chars, Korean/alphanumeric)
3. Academy-wide uniqueness check via API (debounced as user types)
4. After setting, redirect to `community-home`

### 4.8 Pagination (Offset-Based)

For post lists and comment lists:
- Load 20 items initially
- When user scrolls near bottom, load next 20
- Use Intersection Observer on a sentinel element at the bottom
- Update `_communityPage` and `_communityHasMore` state
- API uses offset-based pagination: `OFFSET = (page - 1) * limit`

### 4.9 Notification Badge

- On app init and community tab focus, call `DB.getUnreadNotificationCount()`
- Display badge number on community tab icon when unreadCount > 0
- Poll for new notifications every 30 seconds when app is active
- Entering notification list marks all as read

---

## 5. UI Design

### 5.1 Community Home Screen

Layout:
- Top: "소통" header with bell icon (notifications, with badge) and gear icon (settings)
- Board selector: Horizontal chips showing available boards (반 게시판, 전체 게시판)
- Post feed: List of post cards from selected board
- FAB (Floating Action Button): "+" button for new post at bottom-right
- Bottom: Standard tab bar (community tab shows unread badge)

### 5.2 Post Card (in list)

Each card uses glassmorphism container:
```
┌─────────────────────────────────────┐
│ 🐱 닉네임123          3분 전        │
│                                     │
│ 물리 2단원 이해가 안돼요...          │
│ 혹시 누가 쉽게 설명해줄 수 있나요?   │
│ 뉴턴의 제2법칙이 특히...            │
│                                     │
│ [📷 사진 2장]                       │
│                                     │
│ ♡ 5   💬 3                          │
└─────────────────────────────────────┘
```

TailwindCSS classes: `bg-white bg-opacity-70 backdrop-blur-sm rounded-2xl shadow-sm p-4 mb-3`

### 5.3 Post Detail Screen

- Back button + board name in header
- Full post content (rich HTML rendered via DOMPurify sanitization)
- Photo gallery (horizontal scroll if multiple, tap to zoom)
- Like button (filled heart if liked, outline if not) + count
- Share/Report buttons in "⋮" menu
- Comments section below (paginated, load 20 at a time)
- Comment input fixed at bottom (like messaging apps)

### 5.4 Post Editor Screen

- Title input (optional, max 100 chars with counter)
- Rich text toolbar: B, I, Link, List
- Contenteditable area (max 10,000 chars with counter)
- Photo attachment strip (horizontal, max 5)
- "게시" (Post) button in header

### 5.5 Friends Screen

- Tab-like toggle: "내 친구" / "초대하기"
- Friend list: Nickname + emoji + school name cards
- Tap friend → view their shared learning profile
- Invite tab: Show current invite code, copy button, share button
- Input field to enter a friend's invite code

### 5.6 Notification Screen

- List of notifications: "[닉네임]님이 내 게시글에 댓글을 달았습니다", "[닉네임]님이 내 게시글을 좋아합니다"
- Tap notification → navigate to the relevant post
- All marked as read on screen entry

---

## 6. Migration & Deployment

### 6.1 Migration Endpoint

Add to the existing `/api/migrate` handler:
1. ALTER TABLE for nickname columns (idempotent: check column exists before ALTER)
2. CREATE TABLE IF NOT EXISTS for all 10 new tables with indexes
3. Auto-seed `community_boards`:
   - One 'academy' board per unique `academy_name` in mentors table
   - One 'group' board per active group
   - Idempotent: check before insert to avoid duplicates on re-run
4. Add board creation hook to group creation endpoint: when a new group is created, also create its community_board

### 6.2 Deployment Steps

1. Add migration SQL to `src/index.tsx`
2. Add all API endpoints to `src/index.tsx`
3. Replace existing `renderCommunityTab()` and related functions in `public/static/app.js`
4. Add DOMPurify CDN script tag to HTML
5. Add community styles to `public/static/app.css` (minimal — mostly Tailwind utilities)
6. Deploy with `npm run deploy`
7. Run migration: `GET /api/migrate?key=jycc_admin_2026`
8. Test: Login as student, navigate to 소통 tab

### 6.3 Seed Data

Extend existing `/api/seed-test-data` to include:
- Set nicknames for seeded students/mentors
- Create sample community posts with comments and likes
- Create sample friendships
- Create learning share settings
- Create sample notifications

---

## 7. Edge Cases & Error Handling

### Board Access
- Student tries to access another group's board → 403 error
- Student's group is deactivated → hide group board, keep academy board access
- Mentor accessing board of a group they don't manage → check academy match
- New group created → auto-create board

### Content
- Empty post (no title, no content) → frontend validation prevents submit
- Post with only photos (no text) → allowed
- Content exceeds limits → server rejects with "내용이 너무 깁니다" (title 100, content 10,000, comment 1,000 chars)
- HTML injection in rich text → DOMPurify sanitization both client-side and server-side

### Friends
- Invite code expired → "초대 코드가 만료되었습니다" error
- Invite code max uses reached → "초대 코드 사용 횟수가 초과되었습니다"
- Already friends → "이미 친구입니다" (409)
- Different academy → "같은 학원 학생만 친구 추가가 가능합니다" (403)
- Self-invite → prevent at API level
- Code generation collision → retry up to 3 times, then return error

### Moderation
- Mentor deletes post → post.is_deleted = 1, post.deleted_by = mentorId
- All comments on deleted post → still visible but post shows "[삭제된 게시글]"
- Reported content already deleted → auto-dismiss report

---

## 8. Security Considerations

### Input Sanitization
- Rich text content: **DOMPurify** for comprehensive HTML sanitization (handles script, javascript: URIs, event handlers, CSS attacks, SVG vectors, encoded payloads)
- Nicknames: Korean + alphanumeric + spaces only, basic profanity blocklist
- Photo uploads: Validate mime type (image/* only), enforce size limit (2MB per photo), max 5 per post
- Content length limits enforced server-side: title 100, content 10,000, comment 1,000 chars

### Authorization
- Every community API endpoint must verify the user has access to the relevant board
- For group boards: check student.group_id matches board.group_id, or mentor manages that group
- For academy boards: resolve user's academy via join chain, verify match
- Post/comment deletion: verify author or mentor role
- Friend profile access: verify friendship exists

### Authentication Note
The current app does not have session/token verification middleware. Community endpoints follow the same pattern (user_type + user_id in params). This means theoretically a user could impersonate another. This is a system-wide limitation, not specific to community features. A proper auth middleware should be added as a separate project.

---

## 9. File Changes Summary

| File | Changes |
|------|---------|
| `src/index.tsx` | Migration SQL (ALTER + 10 CREATE TABLEs), ~18 new API endpoints, board auto-seed logic, board creation hook in group endpoint |
| `public/static/app.js` | Replace existing `renderCommunityTab()`, add ~11 new screen renderers, DB API methods, state additions, rich text editor with DOMPurify, photo upload, infinite scroll, notification badge |
| `public/static/app.css` | Minimal additions for contenteditable styling, community-specific layout helpers |
| `public/index.html` (or equivalent) | Add DOMPurify CDN script tag |

The community feature is implemented directly in `app.js` as per stakeholder preference for tab integration. If the feature grows significantly, it could be extracted into a standalone module following the `public/modules/records/` pattern in the future.
