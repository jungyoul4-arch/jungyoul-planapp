<!-- PROJECT_CONFIG
runtime: typescript-npm
test_command: curl -s http://localhost:5173/api/community/boards | jq .
END_PROJECT_CONFIG -->

<!-- SECTION_MANIFEST
section-01-db-migration
section-02-board-api
section-03-post-api
section-04-comment-like-api
section-05-notification-api
section-06-friend-api
section-07-nickname-sharing-api
section-08-moderation-api
section-09-frontend-navigation
section-10-frontend-board-posts
section-11-frontend-editor-photos
section-12-frontend-friends-settings
section-13-seed-data-testing
END_MANIFEST -->

# Implementation Sections Index

## Dependency Graph

| Section | Depends On | Blocks | Parallelizable |
|---------|------------|--------|----------------|
| section-01-db-migration | - | all | Yes |
| section-02-board-api | 01 | 09, 10 | Yes |
| section-03-post-api | 01 | 10, 11 | Yes |
| section-04-comment-like-api | 01 | 10 | Yes |
| section-05-notification-api | 01 | 09, 10 | Yes |
| section-06-friend-api | 01 | 12 | Yes |
| section-07-nickname-sharing-api | 01 | 09, 12 | Yes |
| section-08-moderation-api | 01 | 10 | Yes |
| section-09-frontend-navigation | 02, 05, 07 | 10, 11, 12 | No |
| section-10-frontend-board-posts | 03, 04, 05, 08, 09 | - | No |
| section-11-frontend-editor-photos | 03, 09 | - | Yes |
| section-12-frontend-friends-settings | 06, 07, 09 | - | Yes |
| section-13-seed-data-testing | 01-08 | - | No |

## Execution Order

1. **Batch 1**: section-01-db-migration (foundation — all others depend on this)
2. **Batch 2**: section-02 through section-08 (all backend APIs — can run in parallel)
3. **Batch 3**: section-09-frontend-navigation (depends on board, notification, nickname APIs)
4. **Batch 4**: section-10, section-11, section-12 (frontend features — can run in parallel after navigation)
5. **Batch 5**: section-13-seed-data-testing (final verification)

## Section Summaries

### section-01-db-migration
Database schema changes: ALTER TABLE for nicknames, CREATE TABLE for all 10 new community tables, indexes, board auto-seeding logic. Migration endpoint updates in `src/index.tsx`.

### section-02-board-api
Board listing and access control endpoints: GET /api/community/boards, GET /api/community/boards/:boardId/posts. Academy resolution join chain for authorization.

### section-03-post-api
Post CRUD endpoints: POST (create), GET (detail), PUT (edit), DELETE (soft delete). Content length validation, DOMPurify-equivalent server-side sanitization, photo storage integration.

### section-04-comment-like-api
Comment CRUD + Like toggle endpoints. DB.batch() for atomic counter updates. Notification creation on comment/like.

### section-05-notification-api
Notification endpoints: GET notifications, GET unread-count, PUT read-all. Notification table queries.

### section-06-friend-api
Friend invite code generation, accept/reject, friend listing, unfriend. Academy validation via join chain, ID normalization for friendships.

### section-07-nickname-sharing-api
Nickname set/update with validation (length, profanity, academy uniqueness). Learning share settings CRUD. Friend learning profile with selective field exposure.

### section-08-moderation-api
Report creation, mentor report listing, report resolution. Mentor delete authority for posts/comments.

### section-09-frontend-navigation
Replace existing external-redirect community tab with in-app community. Tab bar modification, community state additions, DB API methods, screen routing, nickname first-time setup flow, notification badge on tab.

### section-10-frontend-board-posts
Board selector chips, post list with glassmorphism cards, post detail view with comments, like button, infinite scroll pagination, DOMPurify for safe HTML rendering.

### section-11-frontend-editor-photos
Rich text editor (contenteditable + toolbar), photo upload with compression, post creation/editing UI, photo preview strip.

### section-12-frontend-friends-settings
Friends list screen, invite code generation/sharing, code input for adding friends, friend profile view, learning share settings toggles, notification list screen.

### section-13-seed-data-testing
Extend seed-test-data endpoint with community data: sample posts, comments, likes, friendships, nicknames, notifications. Manual API test script verification.
