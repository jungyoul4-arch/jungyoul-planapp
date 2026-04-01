# TDD Plan: 플랜앱 교학상장 소통창구

## Testing Approach

This project has **no automated test framework** (no Jest, Vitest, or equivalent). Testing relies on:
- Manual API testing via curl/browser
- Seed data endpoints (`/api/seed-test-data`)
- Module dev pages (`dev.html`)
- Browser console inspection

For this feature, we define **manual test scripts** and **API endpoint tests** (curl commands) that should be verified before each section is considered complete. We also include **validation checks** that should be built into the code itself.

---

## 2. Database Schema

### Tests Before Implementation
- Test: Migration endpoint is idempotent — running `/api/migrate` twice does not error (CREATE TABLE IF NOT EXISTS, ALTER TABLE with column existence check)
- Test: `community_boards` auto-seed creates exactly 1 academy board per unique academy_name and 1 group board per active group
- Test: Re-running migration does not duplicate boards
- Test: Nickname columns added to students and mentors tables (verify with `PRAGMA table_info(students)`)
- Test: All indexes created (verify with `.indexes` or PRAGMA)
- Test: UNIQUE constraints work — inserting duplicate like (same post+user) fails, duplicate friendship (same id pair) fails

### Validation Checks to Build In
- `community_posts.title` length <= 100, `content` length <= 10,000
- `community_comments.content` length <= 1,000
- `friendships` always stores `student_id_1 < student_id_2`

---

## 3. API Design

### 3.1 Board Endpoints

- Test: GET /api/community/boards returns only boards the student can access (own group + academy)
- Test: GET /api/community/boards for mentor returns all managed group boards + academy board
- Test: Student cannot access another group's board (403)
- Test: GET boards/:boardId/posts returns paginated results (page=1 limit=5, then page=2)
- Test: Posts from deleted posts (is_deleted=1) are excluded from listing
- Test: POST boards/:boardId/posts creates a post and returns postId
- Test: POST with title > 100 chars is rejected
- Test: POST with content > 10,000 chars is rejected
- Test: GET posts/:postId returns full post with author nickname, emoji, photo count
- Test: PUT posts/:postId only works for the original author
- Test: DELETE posts/:postId works for author (soft delete)
- Test: DELETE posts/:postId works for mentor on managed boards

### 3.2 Comment Endpoints

- Test: GET comments returns paginated results in chronological order
- Test: POST comment increments post's comment_count atomically
- Test: DELETE comment decrements post's comment_count
- Test: Comment with content > 1,000 chars is rejected
- Test: POST comment creates notification for post author (if different from commenter)
- Test: POST comment does NOT create notification if commenter is the post author

### 3.3 Like Endpoint

- Test: POST like on unliked post → liked=true, likeCount increments
- Test: POST like on already-liked post → liked=false, likeCount decrements (toggle)
- Test: Concurrent likes don't corrupt like_count (DB.batch atomicity)
- Test: Like creates notification for post author
- Test: Unlike does NOT create notification

### 3.4 Notification Endpoints

- Test: GET notifications returns user's notifications sorted by createdAt DESC
- Test: GET unread-count returns correct count
- Test: PUT read-all marks all unread as read, subsequent unread-count returns 0

### 3.5 Report Endpoints

- Test: POST report creates pending report
- Test: Duplicate report by same user on same target is rejected
- Test: GET mentor reports returns only reports for managed boards
- Test: PUT report with status='resolved' + soft-deleting content works

### 3.6 Friend Endpoints

- Test: POST invite-code generates valid code, stores with 5 max_uses and 7-day expiry
- Test: Code collision retry — if first code conflicts, retries succeed
- Test: POST accept-code with valid code creates accepted friendship
- Test: POST accept-code with expired code fails
- Test: POST accept-code with max-uses-reached code fails
- Test: POST accept-code from different academy fails (403)
- Test: Self-invite (using own code) fails
- Test: Accept code for already-friends pair fails (409)
- Test: GET friends returns only accepted friendships with correct friend details
- Test: DELETE friendship removes the record

### 3.7 Nickname & Settings Endpoints

- Test: PUT nickname with valid 2-12 char Korean/alphanumeric string succeeds
- Test: PUT nickname with < 2 chars fails
- Test: PUT nickname with > 12 chars fails
- Test: PUT nickname that already exists in same academy fails
- Test: GET share-settings creates default row (all 0) if none exists
- Test: PUT share-settings updates correctly
- Test: GET learning-profile for non-friend returns 403
- Test: GET learning-profile returns only fields enabled in share_settings

---

## 4. Frontend Architecture

### 4.1 Navigation Integration

- Test: Community tab visible in bottom tab bar
- Test: Clicking community tab shows community-home screen (not external redirect)
- Test: Previous external redirect function removed
- Test: Tab badge shows unread notification count

### 4.2 Screen Rendering

- Test: Each screen renders without JS errors (check console)
- Test: community-home shows board selector chips
- Test: community-board shows post list with correct data
- Test: community-post-detail shows full content, comments, like button
- Test: community-post-editor has rich text toolbar and photo upload
- Test: community-friends shows friend list and invite code input
- Test: community-nickname-setup enforces 2-12 char validation

### 4.5 Rich Text Editor

- Test: Bold/Italic/Link/List toolbar buttons apply formatting
- Test: DOMPurify strips `<script>` tags from content
- Test: DOMPurify strips `javascript:` URIs
- Test: DOMPurify strips `on*` event handlers
- Test: Content preview strips HTML tags correctly

### 4.6 Photo Upload

- Test: Photo selection limited to 5 images
- Test: Photos compressed to max 1200px width
- Test: Photo appears in preview strip before posting
- Test: Photos display correctly in post detail view

### 4.8 Pagination

- Test: Initial load shows first 20 posts
- Test: Scrolling to bottom triggers next page load
- Test: "No more posts" state when all loaded

### 4.9 Notifications

- Test: Badge appears on community tab when unread > 0
- Test: Badge disappears after marking all as read
- Test: Tapping notification navigates to correct post

---

## 6. Migration & Deployment

- Test: Full deployment workflow: `npm run deploy` succeeds
- Test: `/api/migrate?key=jycc_admin_2026` runs all new migrations
- Test: Login as student → community tab → board list visible
- Test: Login as mentor → community tab → all managed boards visible
- Test: Seed data creates sample posts, comments, likes, friendships

---

## 7. Edge Cases

- Test: Empty post (no title, no content, no photos) rejected by frontend
- Test: Post with only photos (no text) accepted
- Test: Deleted post shows "[삭제된 게시글]" placeholder
- Test: New group creation auto-creates community board
- Test: Friend from different academy shows appropriate error
- Test: Nickname with profanity blocked (basic blocklist test)

---

## API Test Script Template (curl)

```bash
# Set variables
BASE="http://localhost:5173"
STUDENT_ID=1
MENTOR_ID=1

# 1. Run migration
curl -s "$BASE/api/migrate?key=jycc_admin_2026" | jq .

# 2. Seed test data
curl -s "$BASE/api/seed-test-data" | jq .

# 3. Set nickname
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스터123"}' | jq .

# 4. Get boards
curl -s "$BASE/api/community/boards?user_type=student&user_id=$STUDENT_ID" | jq .

# 5. Create post (use board_id from step 4)
curl -s -X POST "$BASE/api/community/boards/1/posts" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":1,"title":"테스트 게시글","content":"<b>안녕하세요!</b>"}' | jq .

# 6. Get posts
curl -s "$BASE/api/community/boards/1/posts?page=1&limit=20&user_type=student&user_id=$STUDENT_ID" | jq .

# 7. Like post
curl -s -X POST "$BASE/api/community/posts/1/like" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":1}' | jq .

# 8. Add comment
curl -s -X POST "$BASE/api/community/posts/1/comments" \
  -H "Content-Type: application/json" \
  -d '{"author_type":"student","author_id":2,"content":"좋은 질문이에요!"}' | jq .

# 9. Check notifications
curl -s "$BASE/api/community/notifications/unread-count?user_type=student&user_id=1" | jq .

# 10. Generate friend invite code
curl -s -X POST "$BASE/api/student/$STUDENT_ID/friends/invite-code" | jq .

# 11. Accept friend code (as different student)
curl -s -X POST "$BASE/api/student/2/friends/accept-code" \
  -H "Content-Type: application/json" \
  -d '{"code":"JYCC-XXXX-XXXX"}' | jq .
```
