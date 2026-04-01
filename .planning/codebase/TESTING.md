# Testing Patterns

**Analysis Date:** 2026-03-29

## Test Framework

**Runner:**
- None detected
- No `jest.config.js`, `vitest.config.js`, or test runner config files in project root
- No dev dependencies for testing (Jest, Vitest, Mocha) in `package.json`

**Assertion Library:**
- Not applicable — no test framework configured

**Run Commands:**
```bash
npm run dev                # Start Vite + Hono dev server
npm run build             # Build for production
npm run preview           # Preview locally before deploy
npm run deploy            # Deploy to Cloudflare Pages
npm run cf-typegen        # Generate Cloudflare bindings TypeScript types
```

**Note:** Project has no automated test infrastructure. Testing is manual.

## Manual Test Approach

**Development Server:**
- Uses Vite for local development: `npm run dev` starts both frontend (Vite bundling) and backend (Hono + Cloudflare Pages Functions)
- Port: typically 5173 (Vite default)
- Hot module reload (HMR) enabled for rapid iteration

**Manual Test Locations:**

**Records Module (Isolated Test):**
- Location: `/public/modules/records/dev.html`
- Purpose: Test records module without logging in to main app
- Access: `http://localhost:5173/modules/records/dev.html` (no authentication required)
- Contains: Mock data, test buttons, module initialization code
- Usage: described in CLAUDE.md as primary way to test records features independently

**Main App Testing:**
- Full flow: Must login to main app (`http://localhost:5173`)
- Test account: Name `곽정율` / Password `1234`
- Manual validation of UI rendering, navigation, API calls, and data persistence

**API Testing:**
- Direct endpoint calls via browser DevTools Network tab
- Example routes documented in CLAUDE.md: `/api/auth/mentor/login`, `/api/student/:id/class-records`, `/api/student/:id/exam-results`
- Response format validation: Ensure `{ success: true, data: { ... } }` or `{ error: "..." }` structure

## Test File Organization

**Location:**
- No centralized test directory
- No test files (`*.test.js`, `*.spec.js`, `*.test.ts`) in project (only in node_modules from dependencies)

**Structure for Manual Testing:**
- Records module dev test: `public/modules/records/dev.html` contains mock data and test fixtures
- Main app uses live data against D1 database
- Browser DevTools used for network inspection and console logging

## Test Structure

**Manual Testing Pattern:**

For backend routes, test flow is:
1. Start dev server: `npm run dev`
2. Open DevTools Network tab
3. Call endpoint via browser fetch or form submission
4. Inspect response JSON structure
5. Verify data in D1 database with `wrangler d1 execute [db] --remote --command "SELECT * FROM table"`

**Records Module Manual Tests (dev.html pattern):**
```javascript
// Mock initial state injected into module
const mockConfig = {
  studentId: 1,
  studentName: '테스트학생',
  timetable: { school: [...], teachers: {}, subjectColors: {} },
  todayRecords: [],
  todayAcademyRecords: null,
};

// Initialize module with mock data
_RM.init(mockConfig);

// Trigger individual views/features via buttons
document.getElementById('test-add-class-record').onclick = () => _RM.navigate('record-class');
```

**Frontend Pattern Validation (no unit tests):**
- Render function output checked visually in browser
- State mutations checked via browser console: `console.log(state._classPhotos)`
- Event handlers tested by clicking UI elements and checking console logs

## Mocking

**Framework:** None — manual mocking for records module only

**Patterns:**

Records module dev.html contains mock data for isolated testing:
```javascript
// Mock timetable structure
timetable: {
  school: [
    { period: 1, subject: '국어', teacher: '김선생' },
    { period: 2, subject: '영어', teacher: '이선생' },
  ],
  teachers: { '국어': '김선생' },
  subjectColors: { '국어': '#ff6b6b', '영어': '#4ecdc4' },
  periodTimes: [
    { period: 1, start: '09:00', end: '09:45' },
  ],
}

// Mock student profile
studentId: 1,
studentName: '곽정율',

// Mock DB records
todayRecords: [
  {
    date: '2026-03-29',
    period: 1,
    subject: '국어',
    done: false,
    _virtual: true
  },
],

_dbClassRecords: [
  {
    id: 1,
    subject: '국어',
    date: '2026-03-28',
    content: '한국 현대문학 개론',
    photos: [],
    keywords: ['현대문학', '소설'],
    created_at: '2026-03-28 15:30:00',
  },
],
```

**What to Mock:**
- External API calls: In test scenarios, can stub Gemini/OpenAI responses
- Database queries: dev.html provides preloaded data via `state._dbClassRecords`
- User authentication: Test account credentials hardcoded in dev.html

**What NOT to Mock:**
- Core state management (Proxy-based reactivity)
- DOM rendering (test actual HTML generation via browser)
- Navigation/routing (test view transitions with actual router)

## Fixtures and Factories

**Test Data (Records Module):**

Location: `public/modules/records/dev.html` contains seed data

Example fixture shape (class record):
```javascript
{
  id: 1,
  subject: '국어',
  date: '2026-03-29',
  content: '한국 현대문학 개론',
  keywords: ['현대문학', '소설'],
  understanding: 4, // 1-5 rating
  memo: '흥미로운 주제',
  topic: '소설의 구조',
  pages: '12-15',
  photos: [], // Initially empty; populated via photo upload
  photo_count: 0,
  teacher_note: '',
  ai_credit_log: null, // Populated after AI analysis
  photo_tags: [], // Tags for each photo
  created_at: '2026-03-29 15:30:00',
}
```

**Location of Fixtures:**
- `public/modules/records/dev.html`: Contains mock `_initialState` object
- `src/CLAUDE.md`: Contains test account credentials (Name: `곽정율`, PW: `1234`)
- No separate fixtures directory; data embedded in source

**Factory Functions:**
None detected; data created inline or via API responses

## Coverage

**Requirements:** No coverage requirements or tracking

**View Coverage:**
```bash
# No automated coverage tool configured
# Manual testing via browser DevTools:
# - Coverage tab shows which JS/CSS is executed
# - Network tab shows API calls made during flows
```

**Note:** Coverage is not measured; project relies on manual testing and developer discipline.

## Test Types

**Unit Tests:**
- Not implemented
- Would be candidates: utility functions in `src/helpers.ts` (date formatting, password hashing, validation)
- Helpers like `getKSTNow()`, `validateNickname()`, `stripHtmlForPreview()` could benefit from unit tests

**Integration Tests:**
- Not implemented
- Manual API integration testing via Postman or browser DevTools
- Database migrations tested by running `/api/migrate` endpoint
- Example flow: Login → Load records → Update record → Verify in database

**E2E Tests:**
- Not implemented
- No Playwright, Cypress, or similar framework configured
- Manual E2E flows tested via browser: login → navigate app → perform actions → verify results

**Note:** Playwright config detected (`.playwright-mcp/`) but not for testing — appears to be MCP server integration only.

## Common Patterns

**Frontend Manual Testing (Vanilla JS):**

To test a feature after code changes:
1. Open DevTools Console
2. Check state: `console.log(_RM.state)` or `console.log(state)`
3. Trigger function: `_RM.navigate('dashboard')` or `goScreen('login')`
4. Verify DOM: Inspect Elements panel
5. Check Network: Network tab for API calls
6. Validate data: Direct query via `_RM.DB.loadClassRecords()` then inspect state

**Backend API Testing Pattern:**

Example testing `POST /api/auth/mentor/login`:
```bash
curl -X POST http://localhost:5173/api/auth/mentor/login \
  -H "Content-Type: application/json" \
  -d '{"loginId":"test","password":"1234"}'

# Expected response:
# { "success": true, "token": "...", "role": "mentor", "user": { ... } }
```

**Async Testing in Dev.html:**

When testing async features like AI analysis or photo upload:
```javascript
// Manually trigger async operation and wait
async function testAiAnalysis() {
  const result = await _RM.analyzeClassRecordWithAi({
    subject: '국어',
    photos: [...],
  });
  console.log('AI Result:', result);
}
testAiAnalysis();
```

**Error Validation:**

Test error paths manually by:
1. Providing invalid input (e.g., missing required fields)
2. Checking API response returns correct error status (400, 401, 500)
3. Verifying error message displayed in UI toast: `showToast(error, 'error')`

## Browser DevTools Workflow

**Recommended Manual Testing Flow:**

1. Open DevTools (F12)
2. Console tab: Monitor logs for API calls and errors
3. Network tab: Inspect request/response payloads
4. Elements tab: Verify HTML structure after rendering
5. Application tab: Check localStorage (timetable data), sessionStorage (auth token)
6. Coverage tab: See which code paths executed

**Common Debug Commands:**
```javascript
// Check authentication state
console.log(_authToken, _authRole, _authUser);

// Inspect current screen/state
console.log(state.currentScreen, state.studentTab);

// Trigger navigation
goScreen('class-record-detail');

// Force re-render
renderScreen();

// Check DB records loaded
console.log(state._dbClassRecords);

// Records module state
console.log(_RM.state);
```

## Gap Analysis

**Not Tested:**
- Database schema migrations (manual execution required via `wrangler d1 execute`)
- AI API integrations (Gemini, OpenAI, Claude, Perplexity) — tested manually with real prompts
- Photo upload to R2 (tested manually via DevTools upload simulation)
- Cloudflare Workers performance and concurrency limits
- Multi-user concurrent access scenarios
- Offline mode (Service Worker caching)

**High-Risk Areas (No Test Coverage):**
- Complex state mutations in records module (`state._classPhotos`, `state._dbClassRecords` synchronization)
- Photo tag sync with records (`photo_tags` array alongside `photos`)
- AI credit log JSON parsing and display
- Multi-module interaction (main app ↔ records module bridge)

---

*Testing analysis: 2026-03-29*
