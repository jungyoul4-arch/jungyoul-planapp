# Coding Conventions

**Analysis Date:** 2026-03-29

## Naming Patterns

**Files:**
- Backend (TypeScript): `camelCase.ts` — `src/index.tsx`, `src/helpers.ts`, `src/types.ts`
- Backend routes: kebab-case in filename — `src/routes/mentor-auth.ts`, `src/routes/mentor-groups.ts`
- Frontend (JavaScript): `camelCase.js` or kebab-case — `public/static/app.js`, `public/modules/records/core/state.js`, `public/modules/records/views/class-record.js`
- Module files follow descriptive kebab-case — `photo-upload-v2.js`, `aha-report-input.js`

**Functions:**
- camelCase for all function definitions: `getKSTNow()`, `recordXp()`, `callGeminiWithFallback()`, `renderDashboard()`
- Data fetching functions: `load*` prefix (e.g., `loadClassRecords()`, `loadQuestionRecords()`) in `core/api.js`
- Event handlers: `on*` prefix in handler names or `*FromData()` for XSS-safe onclick wrappers (e.g., `startBackfillRecordFromData()`, `viewRecordFromData()`)
- Prefix `_` for private/internal functions: `_showArchiveModule()`, `_hideArchiveModule()`, `_buildTodayRecords()`
- View renderers in modules: `render*` prefix (e.g., `renderDashboard`, `renderClassRecordDetail`, `renderExamAdd`)

**Variables:**
- State properties: camelCase for public state (`state.currentScreen`, `state.studentTab`, `state.todayRecords`)
- Private state properties: prefix `_` (e.g., `state._authUser`, `state._classPhotos`, `state._viewingDbRecord`)
- Constants: UPPER_SNAKE_CASE for true constants: `GEMINI_MODEL`, `AI_API_BASE`, `NICKNAME_BLOCKLIST`, `_SIMPLE_KW`, `_COMPLEX_KW`
- Prefix `_` for temporary/intermediate variables: `_classPhotos`, `_editorPhotos`, `_classAssignmentText`

**Types:**
- TypeScript interfaces/types: PascalCase — `type Bindings`, `type D1Database`
- Database types (JavaScript comments): describe raw field names in snake_case as returned from DB — `{ id, subject, date, content, keywords, understanding, ... }`

**Screen/Route Names:**
- kebab-case in screen registry: `'dashboard'`, `'record-class'`, `'class-record-detail'`, `'photo-upload'`, `'ai-loading'`, `'activity-result'`
- Map registry in `SCREEN_MAP` object associates names to renderer functions

## Code Style

**Formatting:**
- No explicit `.prettierrc` or `.eslintrc` detected — codebase uses loose formatting
- Indentation: 2 spaces (observed in TypeScript and JavaScript files)
- Template literals: used heavily for HTML strings and XSS-safe rendering: ``` html`<div>${escapeHtml(str)}</div>` ```
- Object spread: `{ ...recordData }` for shallow copies

**Linting:**
- No linting config files detected (`.eslintrc*`, `biome.json`)
- No formatter config detected
- Formatting is loose and not enforced; style depends on developer discipline

**String formatting:**
- Double quotes for strings (observed in JSON, TypeScript, JavaScript)
- Template literals for multi-line or dynamic content
- XSS mitigation: all user input wrapped with `escapeHtml()` before insertion into HTML
- Korean comments and logging throughout (this is a Korean-language educational app)

## Import Organization

**Order (TypeScript backends):**
1. External packages: `import { Hono } from 'hono'`
2. Internal type imports: `import type { Bindings } from '../types'`
3. Helper/utility imports: `import { hashPassword, generateToken } from '../helpers'`
4. Route/module imports: `import mentorAuth from './routes/mentor-auth'`

**Order (Frontend JavaScript modules):**
1. Core module imports: `import { state, getState, setState, resetState } from './core/state.js'`
2. Utility/helper imports: `import { kstToday } from './core/utils.js'`
3. View imports: `import { renderDashboard } from './views/dashboard.js'`
4. Component imports: `import { initCarousel } from './components/photo-upload.js'`

**Path Aliases:**
- No path aliases configured (no `jsconfig.paths` or TypeScript `compilerOptions.paths`)
- Relative imports used throughout: `./core/state.js`, `../helpers`, `../types`
- Module entry point isolation: records module uses `_RM` global namespace to avoid conflicts with main app

## Error Handling

**Patterns:**
- Try-catch at API boundary (route handlers): `try { ... } catch (e: any) { return c.json({ error: e.message }, 500) }`
- Silent error suppression with logging for non-critical operations: `catch (e) { console.error('loadClassRecords:', e); }`
- Nested try-catch for optional operations: Database hooks (e.g., community board creation) wrapped in separate try-catch to not block main operation
- Validation before operations: `if (!loginId || !password) return c.json({ error: 'message' }, 400);`
- Timeouts on external API calls: `fetchWithTimeout(url, init, 60000)` with AbortController

**Response format (unified API):**
- Success: `c.json({ success: true, data: { ... } })` (or just `data` object directly)
- Failure: `c.json({ error: "메시지" }, status_code)` or `c.json({ success: false, error: "..." })`
- Status codes: 400 (validation), 401 (auth), 409 (conflict), 500 (server error)

## Logging

**Framework:** Direct `console` calls (no logging library)

**Patterns:**
- Informational: `console.log('[OCR] 완료 (${ocrText.length}자)')`
- Errors: `console.error('loadClassRecords:', e)`
- Prefixed context: `[OCR]`, `[분석]`, `[API]` — square brackets for operation scope
- Fallback decisions logged: `console.log('Gemini API 실패 (${geminiRes.status}), Claude로 폴백')`
- Silent failures for non-critical operations (XP recording, board creation hooks) — logged but don't block main flow

**Note:** Logging is sparse in frontend rendering to avoid console spam; mostly used for AI API interactions, fetch failures, and backend state changes.

## Comments

**When to Comment:**
- Section headers: `// ==================== XSS 방지 헬퍼 ====================` (thick divider for major sections)
- Function purposes: Comments above non-obvious functions
- Business logic notes: e.g., `// Gemini API가 할당량 초과(429) 등으로 실패할 경우 OpenAI gpt-4o-mini로 자동 폴백`
- Data structure notes: e.g., comments explaining state shape in `_initialState`
- Database rules (CLAUDE.md): SQL-specific gotchas like `AUTO_INCREMENT 금지 → INTEGER PRIMARY KEY AUTOINCREMENT 사용`

**JSDoc/TSDoc:**
- Not systematically used; minimal type documentation
- Function signatures in TypeScript provide type hints implicitly
- Complex functions document parameters as inline comments

**Comment Style:**
- English and Korean mixed depending on context
- Large block comments use `/* */` format; section headers use `// ==...==` pattern
- Inline comments explain "why" not "what" (following common best practices)

## Function Design

**Size:**
- Frontend: Large functions (100-300+ lines) common in render functions and event handlers (e.g., `renderDashboard`, `renderClassRecordEdit`)
- Backend: Functions typically 30-80 lines per route handler
- No strict size limits; complexity managed through modular organization and helper extraction

**Parameters:**
- Backend routes: destructure from `c.req.json()` directly in handler
- Frontend callbacks: often passed `el` (DOM element) for onclick handlers to extract `dataset` attributes
- API functions: accept options objects `{ geminiKey, openaiKey, prompt, ... }`
- Optional parameters with defaults: `function showToast(msg, type = 'info')`

**Return Values:**
- Backend: always return `c.json()` response (never bare values)
- API functions: return `Promise<Response>` or Promise of parsed data
- Frontend DB layer (`DB.load*`): side-effect based — updates `state` directly, no return value
- Render functions: return HTML string (template literal)

## Module Design

**Exports:**
- Backend: export named functions and constants: `export function getKSTNow()`, `export const GEMINI_MODEL`
- Frontend records module: exports default object `export const DB = { loadClassRecords() { ... }, saveClassRecord() { ... } }`
- View functions: named exports: `export { renderDashboard, registerHandlers as dashboardHandlers }`
- Handlers: exported as `registerHandlers` function that attaches event listeners

**Barrel Files:**
- No barrel files (`index.js` re-exports) detected
- Each module imported explicitly: `import { DB } from './core/api.js'`
- Records module has flat import structure in main `records.js` file

**Namespacing:**
- Records module isolated with `_RM` global namespace (e.g., `_RM.fn()`, `_RM.state`) to avoid conflicts with main app global scope
- Main app uses top-level globals: `state`, `goScreen()`, `renderScreen()`
- No module bundler (Vite serves ES modules directly in dev, builds with Hono for production)

## Database Naming

**Table names:** snake_case, plural: `mentors`, `students`, `groups`, `class_records`, `question_records`, `activity_logs`

**Column names:** snake_case: `login_id`, `password_hash`, `created_at`, `updated_at`, `is_active`, `mentor_id`, `student_id`

**Data types:**
- Dates stored as `YYYY-MM-DD` strings for date-only fields
- Timestamps as `YYYY-MM-DD HH:MM:SS` for `*_at` columns
- JSON stored as TEXT: `photos`, `keywords`, `ai_credit_log`, `photo_tags`
- Booleans as INTEGER (0/1): `is_active`, `is_public`

## Special Patterns

**XSS Prevention:**
- All user input escaped with `escapeHtml()` before HTML insertion
- onclick handlers wrap user data in `data-*` attributes: `onclick="viewRecordFromData(this)"` then extract via `el.dataset.*`
- Never use `innerHTML` with user input

**State Management:**
- Vanilla JavaScript: mutable `state` object with Proxy-based reactivity in records module
- Side-effect based: `DB.load*()` functions update `state` directly
- No immutable patterns or Redux-style reducers

**Async Patterns:**
- Async/await consistently used for API calls
- Promise chains avoided in favor of await
- AbortController for fetch timeouts

**Responsive Design:**
- TailwindCSS CDN (no custom config)
- Mobile-first: separate `#app-content` (mobile) and `#tablet-content` (tablet) containers
- Media query breakpoints not explicitly documented; appears to be based on layout requirements

---

*Convention analysis: 2026-03-29*
