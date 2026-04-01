# Architecture

**Analysis Date:** 2026-03-29

## Pattern Overview

**Overall:** Layered MVC with modular SPA frontend + Hono backend on Cloudflare Workers/Pages

**Key Characteristics:**
- Monolithic API backend in `src/index.tsx` (280K+) routed via modular route handlers
- Multi-view SPA frontend with vanilla JavaScript and state management via Proxy
- Independent, pluggable records module (`public/modules/records/`) with isolated state/router
- Cloudflare Workers runtime with D1 (SQLite) persistence and R2 photo storage
- Full-stack TypeScript (backend) + vanilla JS (frontend) architecture

## Layers

**Backend API Layer:**
- Purpose: HTTP request handling, database operations, AI integrations, authentication
- Location: `src/index.tsx` (main router) + `src/routes/*.ts` (route modules)
- Contains: Hono route definitions, query builders, middleware (CORS, caching), AI prompt logic
- Depends on: `src/types.ts`, `src/helpers.ts`, Cloudflare bindings (DB, R2, KV)
- Used by: Frontend SPA via `/api/*` endpoints

**Helper & Utility Layer:**
- Purpose: Reusable functions for cryptography, API calls, date/time, validation
- Location: `src/helpers.ts` (backend helpers), `public/modules/records/core/utils.js` (frontend utils)
- Contains: Password hashing, token generation, KST time handling, Gemini/Claude API wrappers, HTML sanitization, nickname validation
- Depends on: External APIs (Google Gemini, OpenAI, Anthropic), Node crypto APIs
- Used by: Route handlers and frontend views

**Frontend Application Layer (Main App):**
- Purpose: Core app shell, authentication, navigation, global state
- Location: `public/static/app.js` (700K+), `public/static/app.css`
- Contains: Global state object, screen routing, form handlers, localStorage cache, API bindings
- Depends on: TailwindCSS CDN, API layer
- Used by: Student/mentor users accessing main interface

**Frontend Module Layer (Records Module):**
- Purpose: Isolated SPA for recording class sessions, exams, activities, assignments
- Location: `public/modules/records/`
- Contains: Modular views (dashboard, forms, galleries), centralized state management, API client, router, event bus
- Depends on: Core utilities, API layer
- Used by: Main app or standalone via `dev.html`
- Structure: `core/` (state, router, API, events), `views/` (38+ screen renderers), `components/` (reusables like photo upload)

**Database Layer:**
- Purpose: Persistent data storage across users, groups, records, exams
- Location: Cloudflare D1 (remote SQLite), schema at `schema/full_database_schema.sql`
- Contains: 14+ tables (users, groups, records, exams, activities, assignments, etc.)
- Accessed by: Backend API via `c.env.DB` binding
- Data flow: API constructs SQL → D1 executes → returns results

**Storage Layer:**
- Purpose: Photo/document persistence
- Location: Cloudflare R2 bucket (`credit-planner-photos`)
- Contains: Base64-encoded photos from class records, exam corrections, activity logs
- Accessed by: Backend API via `c.env.R2` binding, referenced from DB via `ref:ID`

## Data Flow

**Student Login & Record Creation:**

1. Student enters credentials → frontend `loginAsStudent()` calls `/api/auth/student/login`
2. Backend validates password hash → returns `{ success: true, token, user, preloadedData }`
3. Frontend stores token in `window._token`, initializes state with user info + preloaded records
4. Frontend calls `recordsModule.init({ preloadedData })` to hydrate records module state
5. Records module builds derived state (`todayRecords[]`) from `timetable` + `_dbClassRecords`
6. Records module renders dashboard showing today's classes + pending records

**Class Recording Workflow:**

1. User clicks "수업 기록" button → `navigate('record-class')`
2. `renderRecordClass()` displays class selection + form inputs (photos, notes, keywords)
3. User uploads photos → `photo-upload-v2.js` stores base64 in `state._classPhotos[]`
4. User submits form → `saveClassRecordFromForm()` (in `class-record.js`)
5. Frontend calls `DB.saveClassRecord()` (API layer in `records/core/api.js`)
6. `POST /api/student/:id/class-records` → backend saves metadata to D1, returns `recordId`
7. Photos separately POST to `/api/student/:id/class-record-photos` → R2 storage → returns photo IDs
8. Frontend updates main record with photo ID references → `state._dbClassRecords` refreshes
9. User sees confirmation + XP award → state rerenders dashboard

**AI Analysis Pipeline:**

1. User submits photo + subject for AI credit log → frontend calls `callGeminiMultiImage()`
2. Frontend-to-backend bridge: `POST /api/analyze` with base64 images + prompt
3. Backend helper `callGeminiMultiImage()` sends to Gemini API
4. Gemini returns JSON (3-expert analysis: teaching points, research questions, exam problems)
5. Frontend displays results → user can accept/reject/edit
6. `saveAiCreditLog()` stores analysis JSON in `class_records.ai_credit_log`

**State Management (Records Module):**

- Central `state` object (Proxy) with 80+ properties tracking UI/data state
- All mutations via `setState(key, value)` trigger validation + `events.emit(EVENTS.STATE_CHANGED)`
- Views listen to events → re-render only affected sections
- Derived state (`todayRecords`, mission progress) computed on demand from `_db*` sources + config

## Key Abstractions

**Route Handler Pattern (Backend):**
- Purpose: Organize API endpoints by domain (auth, student, mentor, analysis)
- Examples: `src/routes/mentor-auth.ts`, `src/routes/mentor-student.ts`, `src/routes/mentor-feedback.ts`
- Pattern: Each route file is a `new Hono<{ Bindings }>()` instance, exported, then mounted via `app.route('/', moduleRouter)`
- Usage: Keeps main `index.tsx` modular; each route file handles ~5-10 related endpoints

**View Renderer Pattern (Frontend - Records Module):**
- Purpose: Screen-specific HTML generation + event handler registration
- Examples: `views/class-record.js`, `views/dashboard.js`, `views/exam-list.js`
- Pattern: Each file exports:
  - `registerHandlers()` — attaches event listeners to DOM elements
  - `render*()` — returns HTML template string (template literals)
- Usage: Router calls `renderFn()` to get HTML, injects into container, calls `registerHandlers()` to bind logic

**API Client Abstraction (Frontend - Records Module):**
- Purpose: Single source for all backend API calls with consistent error handling
- Location: `public/modules/records/core/api.js`
- Pattern: `export const DB = { loadClassRecords, saveClassRecord, loadQuestionRecords, ... }`
- Usage: Views import `{ DB }` and call `DB.saveClassRecord(data)` — no direct fetch in views

**Event Bus (Frontend - Records Module):**
- Purpose: Decouple state changes from view updates
- Location: `public/modules/records/core/events.js`
- Pattern: Central event dispatcher; views emit events (`events.emit(EVENTS.RECORD_SAVED)`), other views listen
- Usage: When quiz record completes, it emits event → dashboard listener refreshes mission counter without direct call

**Router State Machine (Frontend - Records Module):**
- Purpose: Track screen navigation history + support back button
- Location: `public/modules/records/core/router.js`
- Pattern: `navigate(screen)` pushes to history, `goBack()` pops; prevents infinite loops with `_screenHistory`
- Usage: Ensures deep linking, prevents accidental premature backs

## Entry Points

**Backend - Main Router:**
- Location: `src/index.tsx` (lines 28-72)
- Triggers: HTTP request to Cloudflare Pages Functions
- Responsibilities:
  - Mount all route modules (auth, student, mentor, etc.)
  - Apply global middleware (CORS, cache headers for `sw.js`, `app.js`, `app.css`)
  - Serve static files from `public/` via `serveStatic()`

**Backend - Individual Route Modules:**
- Location: `src/routes/mentor-auth.ts` (and others)
- Triggers: Request to `/api/auth/*`, `/api/mentor/*`, `/api/student/*` paths
- Responsibilities: Validate input, query D1, return JSON responses
- Example: `/api/auth/mentor/login` → hash validation → return token + user metadata

**Frontend - Main App Shell:**
- Location: `public/static/app.js` (entry point defined in index.html)
- Triggers: Page load or hard refresh
- Responsibilities:
  - Initialize global app state
  - Show login screen or restore user session
  - Load preloaded data (user, records, groups)
  - Mount and initialize records module

**Frontend - Records Module Entry:**
- Location: `public/modules/records/records.js` (export `{ init, navigate, getState, setState }`)
- Triggers: Called by main app via `recordsModule.init({ preloadedData })`
- Responsibilities:
  - Register all views in router
  - Hydrate state from preloaded data
  - Build derived state (todayRecords, missions)
  - Render initial screen (dashboard) and attach handlers

## Error Handling

**Strategy:** Cascading fallbacks with user feedback

**Patterns:**

- **API Errors:** Responses always return `{ success: bool, data/error, code }` structure. Frontend checks `success` and shows toast/alert with `error` message.
- **AI Fallback:** Gemini API → Claude API → OpenAI fallback chain in `callGeminiWithFallback()`. If all fail, throw error with all failure reasons.
- **DB Constraints:** D1 query errors caught in try-catch, return 400 with sanitized error message. Never expose raw SQL errors to client.
- **Photo Upload:** Concurrent photo uploads wrapped in Promise.all with reject handling. Partial upload (1 of 3 photos fails) → show warning but save record anyway.
- **Validation:** Input validation before DB ops (length checks, type coercion, regex patterns). Failed validation returns 400 with field error.

## Cross-Cutting Concerns

**Logging:**
- Backend: `console.error()` for exceptions, `console.log()` for fallback events
- Frontend: Global error handler attached to Records Module, logs to browser console
- No persistent log storage (design trade-off)

**Validation:**
- Backend: Validator functions for password strength, invite code format, nickname content (NICKNAME_BLOCKLIST in helpers)
- Frontend: Client-side form validation before submit; server-side re-validates all inputs

**Authentication:**
- Token-based: `/api/auth/*/login` returns JWT-like token, frontend stores in `window._token`
- Every API request checked server-side: mentor endpoints verify token matches mentor ID in path
- Student endpoints: verify student ID matches logged-in student (frontend passes `studentId` in URL)
- No refresh token mechanism; tokens don't expire in this design (security gap noted in CLAUDE.md)

**Authorization:**
- Mentor: Can view own groups, students, feedback — checked via token + ID match
- Student: Can only view own records, classmates, time slots — checked via student ID in path
- Admin: Special `ADMIN_KEY` env var for `/api/admin/*` endpoints
- Community board: Checked via `canAccessBoard()` helper (student must be in group or enrolled class)

**Caching:**
- Backend: Cache headers set to `no-cache` for `sw.js`, `app.js`, `app.css` to ensure latest version
- Frontend: Records module state is in-memory only; page refresh reloads from server
- localStorage used only for timetable (non-critical, can diverge from DB)

**Rate Limiting:**
- Not implemented; relies on Cloudflare's default protections
- Photo uploads timeout after 10 minutes; AI requests timeout after 10 minutes

---

*Architecture analysis: 2026-03-29*
