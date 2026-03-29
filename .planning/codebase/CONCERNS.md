# Codebase Concerns

**Analysis Date:** 2026-03-29

## Tech Debt

**Monolithic Backend File:**
- Issue: `src/index.tsx` contains 5,966 lines with all API endpoints defined in a single file. This includes 200+ routes, 10+ AI system prompts, complex business logic, and database migrations.
- Files: `src/index.tsx`
- Impact: Difficult to maintain, test, and reason about. Changes to one endpoint risk breaking others. No logical separation of concerns.
- Fix approach: Extract routes into separate files (auth, student, mentor, dashboard, etc.) and import them modular. Use Hono's Router pattern with dedicated route files.

**Monolithic Frontend File:**
- Issue: `public/static/app.js` contains 17,188 lines with all UI logic, state management, rendering, and API calls in one file. No module system or component separation.
- Files: `public/static/app.js`
- Impact: Unmaintainable codebase. Debugging is slow. Feature addition requires navigating huge functions. No code reusability.
- Fix approach: Consider migrating to a module system (ES modules) or lightweight framework. At minimum, split into logical files (state.js, rendering.js, api.js, etc.) and use import/export.

**Inconsistent Type Safety:**
- Issue: Widespread use of `any` type throughout TypeScript code. 50+ occurrences of `const data: any = await res.json()` and `catch (e: any)`.
- Files: `src/index.tsx`, `src/helpers.ts`
- Impact: Lost TypeScript benefits. Silent failures possible. Refactoring becomes risky. IDE autocomplete unreliable.
- Fix approach: Create proper interfaces for API responses (AnalysisResponse, CoachingResponse, ClassRecordRow, etc.). Use strict tsconfig settings. Replace generic error handlers with typed error classes.

**Photo Data Storage Hybrid Approach:**
- Issue: Photos stored both as base64 in DB (`class_records.photos` TEXT field) and as separate entries in `class_record_photos` table with R2 support. Unclear which is authoritative.
- Files: `src/index.tsx` (lines 1625-1770, 2435, 2746-2755), `public/modules/records/core/api.js` (lines 20-50, 75-100)
- Impact: Data inconsistency. Some endpoints return base64, others return R2 keys. Frontend has branching logic to handle both. Migration incomplete.
- Fix approach: Complete migration to R2 + metadata-only DB storage. Remove base64 from main schema. Update all endpoints to use R2 consistently. Add migration script to move existing photos.

**Base64 Image Size Explosion:**
- Issue: Large base64-encoded photos (500KB-1MB each) are stored directly in SQLite TEXT fields. A class record with 7 photos becomes multi-MB. Loading 200 records multiplies DB response size catastrophically.
- Files: `src/index.tsx` (lines 39, 60-62, 1639, 1725-1729)
- Impact: Slow API responses. Memory exhaustion on client. "Silent failure" when responses exceed size limits.
- Fix approach: **Mandatory** — Remove all base64 from DB. Store only R2 references (`r2:bucket-key`). Fetch image URLs separately or on-demand. Implement image lazy-loading in UI.

**Field Mapping Inconsistencies:**
- Issue: API endpoints inconsistently map between frontend field names and DB column names. Example: frontend sends `imageData` (base64) but backend expects `image_key`.
- Files: `src/index.tsx` (multiple endpoints), `public/modules/records/core/api.js`
- Impact: Data loss on POST operations. Fields silently drop. Debugging requires tracing through multiple layers.
- Fix approach: Centralize field mapping in helper function. Document all transformations. Add validation middleware to ensure no unmapped fields are lost.

**Untyped JSON Parsing:**
- Issue: Frequent use of `tryParseJSON()` and optional chaining without validation. AI responses parsed as JSON with no schema enforcement.
- Files: `src/index.tsx` (lines 294, 335, 447, 456, 466, 507), `public/modules/records/core/api.js`
- Impact: Unexpected response shapes crash parsing. AI model might return different structure, silently breaking features.
- Fix approach: Use Zod or TypeBox for schema validation. Validate all AI responses before accepting. Log parsing errors with context for debugging.

**CORS Configuration Too Permissive:**
- Issue: `src/index.tsx` line 31 sets `origin: '*'` allowing requests from any domain.
- Files: `src/index.tsx` (line 31)
- Impact: CSRF attacks possible. API exposed to abuse from unrelated sites.
- Fix approach: Restrict origin to production domain (`https://credit-planner-v8-359.pages.dev`) and development domains only.

## Known Bugs

**AI Credit Log JSON Parse Error:**
- Symptoms: Console errors "credit-log JSON parse error" when saving classroom records with AI analysis. Photo-upload view crashes silently.
- Files: `src/index.tsx` (lines 507-512)
- Trigger: User uploads photos → AI generates credit log → backend saves JSON → frontend receives unexpected format
- Workaround: Retry the operation. Error is caught but not propagated to UI.
- Root cause: AI sometimes returns malformed JSON structure. Backend tries to parse without schema validation.
- Fix: Add Zod validation for SYSTEM_PROMPT_CREDIT_LOG response format. Return 400 if invalid instead of silently catching.

**Module Data Preload Sync Issue:**
- Symptoms: Records module receives `preloadedData` from main app, but field mapping differs. Fields like `ai_credit_log`, `photo_tags`, `teacher_note` are present in main app's loader but not in module's parser.
- Files: `public/static/app.js` (loadClassRecords), `public/modules/records/core/api.js` (lines 20-50)
- Trigger: User navigates from student home → clicks "View Details" → records module opens with preloaded data → fields are missing
- Workaround: Refresh the module explicitly (Module.refresh())
- Root cause: Two separate fetch functions with different SELECT field lists were not kept in sync during recent refactoring.
- Fix: Consolidate field mapping. Create shared constant for class record fields. Both loaders must select identical fields.

**Classroom Record Edit ID Confusion:**
- Symptoms: User clicks "Edit" on a classroom record → edit page loads → data matches wrong record or is missing
- Files: `public/modules/records/views/class-edit.js`, `public/modules/records/core/state.js`
- Trigger: User has multiple records for same date → clicks edit → module uses wrong index or DB ID
- Root cause: `state._editingClassRecordIdx` (array index) vs `state._viewingDbRecord` (DB id) are used inconsistently. todayRecords array index ≠ DB primary key.
- Fix: Standardize on DB ID everywhere. Remove reliance on array indices. Always fetch from DB using `_dbRecordId`.

**Gemini Model Version Hardcoding:**
- Symptoms: API calls to non-existent Gemini endpoints return 404. Features that depend on AI fail silently.
- Files: `src/index.tsx` (lines 63, 397, 402, 408, and 6 more locations), `src/helpers.ts` (line 63)
- Trigger: Google changes Gemini model API endpoint → 7 hardcoded URLs break simultaneously
- Workaround: Model names are scattered across codebase. Must update all 7 locations.
- Root cause: Model name `gemini-3-flash-preview` hardcoded as string literal instead of centralized constant. Google can deprecate endpoints without warning.
- Fix: Create `GEMINI_MODEL` constant (already exists in `src/helpers.ts` but not used everywhere). Replace all 7 hardcoded instances with this constant. Add feature flag to allow quick model switching.

**localStorage vs DB Sync Desync:**
- Symptoms: Timetable changes in one app session don't persist. User refreshes and sees old schedule.
- Files: `public/static/app.js` (timetable logic), (localStorage storage)
- Trigger: User adds class to timetable → saves in localStorage only → refreshes browser → localStorage persists but DB never updates
- Root cause: Timetable is localStorage-first, DB never syncs. `saveTimeTable()` exists but is never called.
- Impact: Timetable changes are lost on account deletion or device change.
- Fix: **Mandatory** — Integrate timetable into D1 database. Add `user_timetables` table. Call DB sync on every timetable change, not just on explicit "Save" button.

**Photo Upload Count Desync:**
- Symptoms: UI shows "5 photos saved" but when loading page again, only 3 appear. Photo metadata inconsistent with file count.
- Files: `src/index.tsx` (lines 1642, 1784), `public/modules/records/views/class-record.js`
- Trigger: User uploads photos → some uploads fail network errors → retry → duplicates created or count becomes wrong
- Root cause: `photo_count` field not updated after failed uploads. Duplicate photo entries in `class_record_photos` table.
- Fix: Implement transaction-based upload. Atomic insert or all-fail. Add cleanup for orphaned photo records.

## Security Considerations

**HTML Sanitization Incomplete:**
- Risk: Custom HTML sanitizer in `helpers.ts` (lines 361-371) removes script tags and event handlers but may miss sophisticated XSS vectors. Doesn't use established library (DOMPurify, etc).
- Files: `src/helpers.ts` (lines 361-371), `src/index.tsx` (multiple user input fields)
- Current mitigation: Basic regex-based stripping of `<script>`, `on*=`, `javascript:`, `<iframe>`, `<object>`, `<embed>`. Stored in database then rendered server-side to HTML.
- Recommendations:
  1. Replace custom sanitizer with DOMPurify library (though adds dependency).
  2. Or: Never store HTML. Store structured data (Markdown) and render safely client-side.
  3. Add Content-Security-Policy header to prevent inline script execution.

**SQL Injection via Parameter Binding:**
- Risk: Code correctly uses parameter binding (`?` in D1 queries) but trust depends on Hono/Cloudflare frameworks doing the right thing. No input type validation.
- Files: `src/index.tsx` (all DB prepare/bind calls)
- Current mitigation: Reliance on Hono's DB abstraction layer. No explicit validation.
- Recommendations: Add validation layer. Use Zod to validate request parameters before passing to DB. Document assumption that Cloudflare D1 escapes properly.

**API Authentication Weak:**
- Risk: Token validation relies on matching student/mentor ID from JWT. No expiration check, no refresh token rotation, no revocation list.
- Files: `src/index.tsx` (auth routes), `public/static/app.js` (auth state)
- Current mitigation: Tokens stored in memory during session. No persistence to localStorage (good).
- Recommendations:
  1. Add `exp` claim to JWT. Validate on every request.
  2. Implement refresh token rotation.
  3. Add token blacklist for logout (store revoked token IDs in Redis/D1).

**User ID in URL Path:**
- Risk: Routes like `/api/student/:id/class-records` accept user ID from URL. Code must verify that authenticated user owns the resource.
- Files: `src/index.tsx` (all mentor-student routes), `src/routes/mentor-student.ts`
- Current mitigation: Code checks `req.user.id === params.id` in some places, but not all.
- Recommendations: Create authentication middleware that extracts user from JWT and injects into context. Verify ownership explicitly in every route. Add audit logging for cross-user access attempts.

**Rate Limiting Missing:**
- Risk: No rate limiting on API endpoints. Malicious user could spam AI analysis requests (expensive) or brute-force API calls.
- Files: All routes in `src/index.tsx`
- Current mitigation: None
- Recommendations: Add rate limiting middleware (Cloudflare Workers KV + sliding window). Implement per-student quota for AI credit log (expensive operation).

## Performance Bottlenecks

**Synchronous Image Base64 Encoding:**
- Problem: Backend encodes R2 images to base64 on every request (`Buffer.from(..., 'base64')`). Photo loading endpoint blocks for image processing.
- Files: `src/index.tsx` (lines 1715-1729, 1758-1770)
- Cause: No caching of encoded images. Every request decodes from R2, re-encodes to base64.
- Impact: Photo-heavy pages (photo-album.js) load slowly. Database becomes bottleneck.
- Improvement path:
  1. Serve image URLs directly instead of base64 (preferred).
  2. Or: Cache base64 in Redis/D1 for 1 hour.
  3. Or: Use R2 signed URLs with 1-hour expiration (no backend processing needed).

**Class Records Query Fetches All Fields:**
- Problem: `SELECT *` in class records queries returns entire photo JSON, ai_credit_log text, etc. Response bloat when querying 200 records.
- Files: `src/index.tsx` (multiple routes)
- Cause: Premature optimization backward compatibility. Some views need all fields, others only need metadata.
- Impact: API responses 2-5MB on large datasets. Client memory usage high.
- Improvement path: Create two endpoints — `/class-records` (metadata only) and `/class-records/:id` (full details). Frontend requests metadata first, loads details on-demand.

**AI Analysis Calls Slow:**
- Problem: `/api/credit-log` calls Gemini with image OCR, then fallback to Claude if Gemini fails. 30-second timeout (fetchWithTimeout line 75). User waits up to 60 seconds total for response.
- Files: `src/index.tsx` (lines 360-512), `src/helpers.ts` (callGeminiWithFallback)
- Cause: Multiple AI model invocations sequentially. No caching.
- Impact: UI freezes while waiting. User refreshes page assuming it's broken.
- Improvement path:
  1. Implement background job queue (Cloudflare Queues). Return immediately with job ID, poll status.
  2. Cache AI responses by photo hash. Avoid re-analyzing same image.
  3. Pre-warm cache with common subjects/topics.

**Database Schema N+1 Queries:**
- Problem: Getting class records then iterating to load photos requires separate query per record if not using JOIN. Example: `getClassRecords()` then loop `getPhotosByRecordId(r.id)`.
- Files: `src/index.tsx` (routes), `public/modules/records/core/api.js`
- Cause: Not evident from this analysis, but likely in nested data loading.
- Improvement path: Use SQL JOINs to fetch related data in single query. Or: Batch load photos for multiple records at once.

## Fragile Areas

**AI Prompt System Brittle:**
- Files: `src/index.tsx` (lines 77-259: 12 system prompts)
- Why fragile: Prompts are hardcoded multiline strings with embedded JSON format expectations. If AI model behavior changes or returns unexpected nesting (e.g., `quiz` vs `exam_questions`), parsing fails silently. Multiple fallback paths to handle different response shapes (lines 447-475) indicate historical brittleness.
- Safe modification:
  1. Test prompt changes with actual API before deployment.
  2. Add Zod schema for expected response.
  3. Add CI job to validate prompt outputs daily against live model.
  4. Version prompts like `SYSTEM_PROMPT_CREDIT_LOG_v2` when changing behavior.

**Records Module State Management:**
- Files: `public/modules/records/core/state.js`, `public/modules/records/records.js`
- Why fragile: State is flat object. No clear ownership of properties. Multiple views mutate state directly (e.g., `state._editingClassRecordIdx = ...`, `state._chainInputParentId = ...`). Race conditions possible if async operations overlap.
- Safe modification: Document state schema. Use immutable updates pattern. Add state machine for screen transitions.

**Cross-Module Communication:**
- Files: `public/static/app.js` (preloadedData), `public/modules/records/records.js` (init)
- Why fragile: Main app preloads data and passes to records module. Field mismatch causes missing data. No versioning of data format.
- Safe modification: Define explicit interface for preloadedData (JSON schema). Validate on module init. Version the interface.

**PDF Generation with Dynamic Content:**
- Files: `public/modules/records/components/pdf-generator.js` (691 lines)
- Why fragile: Generates HTML from class record data, then converts to PDF. Spacing, pagination, and image embedding can break if data format changes or images are missing.
- Safe modification: Test PDF output with various data sizes and image counts. Add error handling for missing images. Use library version lock.

## Scaling Limits

**D1 SQLite 10GB Limit:**
- Current capacity: Database currently ~50MB (estimated from 15+ tables, ~10K student records)
- Limit: SQLite in production allows ~10GB per database. At growth rate of 5GB/year (if storing large photos), limit reached in 2 years.
- Scaling path: Migrate to PostgreSQL (Vercel Postgres) or MySQL (PlanetScale). Or: Externalize photos to R2 permanently (already partially done), keeping DB to metadata only.

**AI Credit Log Analysis Throughput:**
- Current capacity: Gemini 1,500 requests/minute free tier (with fallback to Claude 10K/minute)
- Limit: If 150 students each generate 1 credit log per day = 150 requests/day (well below). But if mentoring feature scales and adds real-time coaching → 10x increase possible.
- Scaling path: Implement request batching and queuing. Use Cloudflare Queues for async processing.

**localStorage Data Size:**
- Current capacity: ~5-10MB per browser (varies). Timetable + state stored here.
- Limit: If app data grows (more classes, more cache), localStorage fills up → local save operations fail silently.
- Scaling path: Move timetable to indexed D1 database NOW (before it becomes issue). Implement data cleanup/archival for old records.

## Dependencies at Risk

**Gemini API Model Deprecation:**
- Risk: Hardcoded model name `gemini-3-flash-preview` may be deprecated by Google. No fallback to production model.
- Impact: All AI features fail. Image OCR stops working.
- Migration plan: Add model version constant. Monitor Google API changelog monthly. Test model changes in staging before production.

**Cloudflare Workers Runtime Changes:**
- Risk: Reliance on Cloudflare-specific features (D1, R2, Workers). If Cloudflare changes pricing model or deprecates services, expensive to migrate.
- Impact: Vendor lock-in. Difficult to move to another platform.
- Migration plan: Maintain database export capability. Keep R2 compatible with standard S3 APIs (already does).

**Hono Framework Minor Version Bump:**
- Risk: Hono 5.x may introduce breaking changes. Current lock: `^4.11.9`
- Impact: Caret allows minor versions. Potential silent breakage on npm install.
- Migration plan: Pin exact version `4.11.9` until explicitly tested with newer version. Use CI to test against Hono 5.x before upgrading.

## Missing Critical Features

**No Admin Dashboard:**
- Problem: No way to manage users, groups, or data except through direct database access. Mentors can't disable students or reset passwords.
- Blocks: User management, support tickets, data recovery.
- Fix: Build admin panel (`/admin/dashboard`). Add role-based access control (RBAC).

**No Audit Logging:**
- Problem: No record of who modified what record and when. Impossible to investigate data discrepancies or student complaints about grades.
- Blocks: Compliance, fraud investigation, accountability.
- Fix: Add `audit_log` table. Log all data mutations (INSERT/UPDATE/DELETE). Expose audit history in UI.

**No Data Export:**
- Problem: Students can't export their own data. Mentors can't bulk export class lists or analysis reports.
- Blocks: Privacy regulations (GDPR, local regulations).
- Fix: Implement CSV/JSON export endpoints. Secure with authentication.

**No Offline Mode:**
- Problem: Service Worker exists but app doesn't work offline. User loses access if network drops.
- Blocks: Usability in weak network areas (Korea's WiFi issues).
- Fix: Implement full offline-first architecture. Cache all critical data. Queue mutations for sync when back online.

## Test Coverage Gaps

**No Unit Tests:**
- What's not tested: Helper functions (KST logic, sanitization, validation). Utility functions (tryParseJSON, etc).
- Files: `src/helpers.ts`, `public/modules/records/core/utils.js`
- Risk: Regressions in shared utilities go unnoticed. Time helpers have timezone bugs that only appear in local dev.
- Priority: High — Time-based logic especially fragile (KST offset, date boundaries).

**No API Integration Tests:**
- What's not tested: Full request/response flows. Error cases. Database state after operations.
- Files: `src/index.tsx` (all routes)
- Risk: Silent breaking changes. Breaking changes to API don't surface until user-facing feature breaks.
- Priority: High — API is critical path.

**No E2E Tests:**
- What's not tested: Full user workflows (login → add classroom record → generate AI analysis → view results).
- Files: All
- Risk: User-facing features can be broken and nobody notices until production.
- Priority: Medium — Manual QA happening but should be automated.

**Records Module Views Untested:**
- What's not tested: Individual view renderers (class-detail.js, ai-credit-log.js, exam-result.js, etc). Props validation.
- Files: `public/modules/records/views/*.js`
- Risk: Changes to data format break views in unexpected ways.
- Priority: Medium — Views are complex logic with many branches.

**Photo Upload Flow Untested:**
- What's not tested: Large file handling, upload retry logic, base64 encoding/decoding, R2 save, DB record creation.
- Files: `src/index.tsx`, `public/modules/records/views/photo-upload-v2.js`
- Risk: Photo upload silently fails. Users don't realize records are lost.
- Priority: High — This is core user-facing feature.

---

*Concerns audit: 2026-03-29*
