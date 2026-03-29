# External Integrations

**Analysis Date:** 2026-03-29

## APIs & External Services

**AI/LLM Services:**
- **Google Gemini** (Primary)
  - Model: `gemini-3-flash-preview` (defined in `src/helpers.ts` as `GEMINI_MODEL`)
  - SDK/Client: Fetch API (no SDK)
  - Auth: `GEMINI_API_KEY` env var
  - Used for: Image OCR on class records, credit log analysis, multi-image processing
  - Functions: `callGeminiOcrSingle()`, `callGeminiWithFallback()`, `callGeminiMultiImage()`
  - Endpoint: `https://generativelanguage.googleapis.com/v1beta/models/{model}/generateContent`

- **OpenAI GPT-4o-mini** (Fallback)
  - Model: gpt-4o-mini
  - SDK/Client: Fetch API
  - Auth: `OPENAI_API_KEY` env var (Bearer token)
  - Used for: Fallback when Gemini rate-limited or fails (429, 500 errors)
  - Function: Fallback handler in `callGeminiWithFallback()`
  - Endpoint: `https://api.openai.com/v1/chat/completions`

- **Anthropic Claude (Sonnet 3)** (Fallback)
  - Model: claude-3-5-sonnet-20241022
  - SDK/Client: Fetch API
  - Auth: `ANTHROPIC_API_KEY` env var (x-api-key header)
  - Used for: Question analysis, question level classification (2축 9단계 system)
  - Function: `callSonnetAnalysis()` in `src/helpers.ts`
  - Endpoint: `https://api.anthropic.com/v1/messages`

- **Perplexity API** (Research/Context)
  - SDK/Client: Fetch API
  - Auth: `PERPLEXITY_API_KEY` env var (Bearer token)
  - Used for: Web search and context gathering (exact usage TBD in codebase)
  - Endpoint: `https://api.perplexity.ai/...` (specific endpoint in `src/index.tsx` line 688)

## Data Storage

**Databases:**
- **Cloudflare D1 (SQLite)**
  - Database name: credit-planner-db
  - Binding: `DB` in Hono context (`c.env.DB`)
  - Connection: Native D1 API (no ORM)
  - Client: D1Database (Cloudflare Workers binding)
  - Schema: 14 main tables + 30+ supporting tables (see CREATE TABLE statements in `src/index.tsx` lines 1030-1180+)
  - Key tables: mentors, students, groups, exams, exam_results, class_records, assignments, question_records, teach_records, activity_records, xp_history, community_boards, career_profiles, relay_wordbooks
  - SQLite constraints:
    - AUTO_INCREMENT → INTEGER PRIMARY KEY AUTOINCREMENT
    - NOW() → datetime('now', '+9 hours')
    - BOOLEAN → INTEGER (0/1)
    - No MODIFY COLUMN (table recreation required)
    - Binding placeholder: `?` (named params `:name` also supported)
    - Timezone offset: +9 hours (KST)

**File Storage:**
- **Cloudflare R2** (Primary)
  - Bucket name: credit-planner-photos
  - Binding: `R2` in Hono context (`c.env.R2`)
  - Used for: Class record photos, community post photos, PDF uploads
  - Fallback: DB base64 storage if R2 fails
  - R2 key format: `r2:` prefix in database indicates R2 storage
  - Upload endpoints: `/api/student/:id/class-record/:id/photos` (POST)
  - Metadata: MIME type and file size tracked in `class_record_photos` table

**Caching:**
- **Cloudflare KV** (Optional)
  - Binding: `KV` in Hono context (`c.env.KV`)
  - Status: Defined in types.ts but usage not detected in current codebase
  - Potential use: Session caching, rate limiting

## Authentication & Identity

**Auth Provider:**
- Custom implementation (no third-party auth service)
  - Local password hashing via Web Crypto API
  - Functions: `hashPassword()`, `verifyPassword()` in `src/helpers.ts`
  - Token generation: `generateToken()` - random string for session
  - Invite codes: `generateInviteCode()` - for group invitations

**External User Sync:**
- **Remote DB API** (jungyoul.com proxy)
  - URL: `https://jungyoul.com/api/jysk-api.php` (configurable via `JYSK_API_URL`)
  - Auth: `JYSK_API_KEY` (query param, default: `jysk-planner-2026`)
  - Actions:
    - `?action=get_user&user_id={id}` - Fetch user from remote DB
    - `?action=get_mentor_students&user_id={id}` - Fetch mentor's student list
  - Flow: External login → fetch from remote → sync to local D1 → return local token
  - External ID mapping: `external_user_id` field in mentors/students/groups tables

**Login Endpoints:**
- POST `/api/auth/student/login` - Student login
- POST `/api/auth/mentor/login` - Mentor login
- POST `/api/auth/director/login` - Director login
- POST `/api/auth/student/register` - Student registration
- POST `/api/auth/mentor/register` - Mentor registration
- GET `/api/auth/external-login?user_id={id}` - External user sync + auto-login

## Monitoring & Observability

**Error Tracking:**
- Not detected (no Sentry/Bugsnag integration)

**Logs:**
- Console logging only (`console.log()`, `console.error()`)
- No structured logging framework
- No log aggregation service detected
- Logs available via Cloudflare Pages function logs (wrangler tail)

## CI/CD & Deployment

**Hosting:**
- Cloudflare Pages (primary)
- URL: https://credit-planner-v8-359.pages.dev
- Build output directory: `./dist`

**CI Pipeline:**
- Not detected (no GitHub Actions/GitLab CI config)
- Manual deployment via `npm run deploy`

**Deployment Command:**
```bash
npm run deploy  # Equivalent to: npm run build && wrangler pages deploy
```

## Environment Configuration

**Required Environment Variables:**

| Variable | Purpose | Example/Format |
|----------|---------|----------------|
| GEMINI_API_KEY | Google Gemini API authentication | AIza... (API key) |
| OPENAI_API_KEY | OpenAI API authentication | sk-... (Bearer token) |
| ANTHROPIC_API_KEY | Claude API authentication | sk-ant-... (x-api-key header) |
| PERPLEXITY_API_KEY | Perplexity API authentication | pplx-... (Bearer token) |
| JYSK_API_URL | Remote user DB proxy | https://jungyoul.com/api/jysk-api.php |
| JYSK_API_KEY | Remote DB authentication | jysk-planner-2026 |
| QA_APP_SECRET | Q&A app integration secret | (Not found in codebase usage) |
| ADMIN_KEY | Admin API access token | (Not found in codebase usage) |

**Secrets Location:**
- Development: `.dev.vars` file (local, not committed)
- Production: Cloudflare Pages Secrets (via `wrangler pages secret put`)

## API Response Format

All API endpoints follow unified response format:

**Success:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error:**
```json
{
  "success": false,
  "error": "Error message"
}
```

## Webhooks & Callbacks

**Incoming:**
- Not detected (no webhook endpoints for external services)

**Outgoing:**
- Not detected (app does not push data to external services)

## API Endpoints Overview

**Authentication:**
- POST `/api/auth/student/login` - Student login
- POST `/api/auth/student/register` - Student registration
- POST `/api/auth/mentor/login` - Mentor login
- POST `/api/auth/mentor/register` - Mentor registration
- GET `/api/auth/external-login?user_id={id}` - External user sync

**AI Analysis:**
- POST `/api/analyze` - Analyze class record photos (Gemini multi-image)
- POST `/api/coaching` - Generate coaching questions (Claude)
- POST `/api/deep-analyze` - Deep analysis with career context (Gemini with fallback)

**Class Records:**
- GET `/api/student/:id/class-records` - List class records
- POST `/api/student/:id/class-record` - Create class record
- POST `/api/student/:id/class-record/:id/photos` - Upload class record photos (R2)
- DELETE `/api/student/:id/class-record/:id` - Delete class record + R2 photos

**Database Migration:**
- GET `/api/migrate` - Initialize/migrate D1 schema

**Data Sync:**
- POST `/api/mentor/:id/sync-students` - Sync students from external DB
- GET `/api/student/:id/semesters` - Get/create semesters from timetable

---

*Integration audit: 2026-03-29*
