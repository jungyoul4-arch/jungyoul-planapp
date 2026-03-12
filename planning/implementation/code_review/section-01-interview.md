# Section 01 Code Review Interview

## Auto-fixes Applied
1. **Removed redundant UNIQUE indexes** — `idx_friend_invite_codes_code` and `idx_learning_share_settings_student` (SQLite already creates implicit unique indexes from inline UNIQUE constraints)
2. **Added null checks** — `last_row_id` guard before board INSERT in all 3 hook locations
3. **Added console.error** — All 5 board creation catch blocks now log errors instead of silently swallowing

## Let Go (Not Fixed)
- N+1 queries in migration seeding — acceptable for rare migration/login paths
- Missing FOREIGN KEY clauses — D1 doesn't enforce FKs, consistent with existing code
- No HTML sanitization — handled in Section 03 (post API)
- photo_data base64 — R2 fallback per plan design
- Index name divergence from plan — actual names are more descriptive
- No academy board hook on mentor registration — migration handles this
- No group deactivation → board deactivation hook — future enhancement
