# Opus Review

**Model:** claude-opus-4-6
**Generated:** 2026-03-12T00:00:00Z

---

## Plan Review: 플랜앱 교학상장 소통창구

### 1. Critical Issue: Community Tab Already Exists as External Redirect

The plan proposes adding a "community" tab, but one already exists in the codebase. At `app.js` line 708: `case 'community': content += renderCommunityTab(); break;`. The current implementation at lines 12890-12916 redirects to an external community site (`https://jungyoul-academy.pages.dev/community?inapp=true`). The plan does not acknowledge this existing tab or describe the migration path.

### 2. Photo Storage: Contradicts CLAUDE.md Lesson Learned

Section 2 specifies `community_post_photos.photo_data` stores base64 strings. However, CLAUDE.md Section 8 (2026-03-06) warns: "base64 photos in main table cause silent failures when loading many records." The existing `class_record_photos` actually uses R2 storage with `r2:KEY` references. The plan should mandate R2 storage.

### 3. Security: No Authentication on Community Endpoints

The existing API uses `user_type` and `user_id` passed as params — no session/token-based auth. Any user can impersonate another by sending a different `author_id`. This should be noted as a risk or mitigated.

### 4. XSS Risk with contenteditable HTML Storage

Storing `contenteditable` output as raw HTML and rendering with `innerHTML` is risky. The plan should specify a sanitization library (like DOMPurify via CDN) or switch to Markdown storage.

### 5. Denormalized Counters Without Transaction Safety

Like endpoint (Section 3.3) does not mention `DB.batch()` for the toggle-check + insert/delete + count-update. Every counter update must use `DB.batch()`.

### 6. Friendship Ordering Constraint is Error-Prone

`student_id_1 < student_id_2` enforced at insert time, but query patterns for lookups not described. Implementer may forget to handle both directions.

### 7. Missing: academy_name Concept on Students

`academy_name` is on `mentors`, not `students`. The join chain `students.group_id -> groups.mentor_id -> mentors.academy_name` should be documented for friend invite validation.

### 8. app.js is Already 700K+ — Architectural Concern

Adding ~10 renderers + rich text editor + photo upload + infinite scroll directly to app.js (already 700K+). The Records module pattern (independent ES Module SPA) is a viable alternative for this self-contained domain.

### 9. Missing: Notification System

No notification mechanism described. Users need to know when someone comments on their post or likes it. At minimum an unread badge on the community tab.

### 10. Missing: Pagination for Comments

Comments load all at once with no pagination. Popular posts could return hundreds.

### 11. Invite Code: No Collision Handling

No retry logic for invite code generation if unique constraint violation occurs.

### 12. Soft Delete Inconsistency

Posts/comments use soft delete, friendships use hard delete. This contradicts the 'blocked' status in friendships schema.

### 13. Missing: Content Length Limits

No server-side limits for post content, comment content, or titles. Define max lengths.

### 14. Board Auto-Seeding Logic is Under-Specified

No lifecycle management for boards created after initial migration (new groups added later).

### 15. Minor Issues

- `updated_at` not explicitly set in PUT endpoint
- DELETE using query params is unconventional
- "Cursor-based pagination" terminology incorrect (actually offset-based)
- KST offset (`+9 hours`) inconsistently specified in schema descriptions
