I now have sufficient understanding. Let me produce the section content.

# Section 09: Frontend Navigation Integration

## Overview

This section replaces the existing external-redirect community tab with an in-app community experience. It covers: modifying the tab bar behavior, adding community state properties, creating DB API wrapper methods for all community endpoints, implementing the screen routing system for community screens, the nickname first-time setup flow, and the notification badge on the tab.

**This section does NOT implement the actual screen renderers** (those are in sections 10, 11, and 12). It provides the navigation scaffolding, state management, and API layer that those sections depend on.

## Dependencies

- **section-01-db-migration**: All community tables must exist (nickname column on students/mentors, community_boards, community_posts, community_notifications, etc.)
- **section-02-board-api**: `GET /api/community/boards` must be available for loading boards on tab entry
- **section-05-notification-api**: `GET /api/community/notifications/unread-count` must be available for badge display
- **section-07-nickname-sharing-api**: `PUT /api/student/:id/nickname` must be available for nickname setup flow

## Files to Modify

| File | Changes |
|------|---------|
| `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.js` | Remove old community functions, add state properties, add DB API methods, modify tab handler, add screen routing, add nickname setup renderer, add notification badge |
| `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.css` | Minimal styles for nickname setup screen and notification badge on tab |

## Tests (Manual Verification)

These tests should be verified before this section is considered complete.

### Navigation Tests

```bash
# Test: Community tab visible in both sidebar and mobile bottom tab bar
# Action: Login as student, verify "커뮤니티" tab appears in sidebar (desktop) and bottom tab bar (mobile)

# Test: Clicking community tab shows in-app community screen (not external redirect)
# Action: Click community tab → should NOT open a new browser tab
# Expected: renders community-home screen inline (or nickname setup if first time)

# Test: Previous external redirect function removed
# Action: Verify openCommunityNewTab() and getCommunityUrl() are removed from app.js
# Verify: No references to 'jungyoul-academy.pages.dev/community' remain

# Test: Tab badge shows unread notification count
# After seeding notifications:
curl -s "http://localhost:5173/api/community/notifications/unread-count?user_type=student&user_id=1" | jq .
# Expected: { success: true, data: { unreadCount: N } }
# Verify: Badge number N appears on community tab icon when N > 0
```

### Screen Routing Tests

```bash
# Test: community-home screen renders without JS errors
# Action: Click community tab → check browser console for errors

# Test: goScreen('community-board') navigates correctly
# Action: In console, run: goScreen('community-board')
# Expected: Screen changes, no errors

# Test: goScreen('community-nickname-setup') shows nickname input
# Action: Ensure student has no nickname, click community tab
# Expected: Redirected to nickname setup screen automatically
```

### Nickname First-Time Setup Tests

```bash
# Test: Student without nickname is redirected to nickname setup
# Prerequisite: Student's nickname column is NULL
# Action: Click community tab
# Expected: community-nickname-setup screen shown

# Test: Nickname validation enforces 2-12 chars
# Action: Try submitting 1-char nickname → error shown
# Action: Try submitting 13-char nickname → error shown
# Action: Submit valid 5-char nickname → success, redirected to community-home

# Test: After setting nickname, community tab shows community-home
# Action: Set nickname successfully, then navigate away and back to community tab
# Expected: community-home shown (not nickname setup again)
```

### DB API Layer Tests

```bash
# Test: DB.loadCommunityBoards() returns boards
curl -s "http://localhost:5173/api/community/boards?user_type=student&user_id=1" | jq .
# Expected: { success: true, data: { boards: [...] } }

# Test: DB.getUnreadNotificationCount() returns count
curl -s "http://localhost:5173/api/community/notifications/unread-count?user_type=student&user_id=1" | jq .
# Expected: { success: true, data: { unreadCount: 0 } }

# Test: DB.setNickname() sets nickname
curl -s -X PUT "http://localhost:5173/api/student/1/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스터123"}' | jq .
# Expected: { success: true }
```

### Validation Checks to Build In

- `DB.setNickname()` must validate 2-12 chars client-side before API call
- `DB.getUnreadNotificationCount()` must handle network errors gracefully (return 0)
- All DB community methods must check `DB.studentId()` is truthy before making API calls
- Notification badge polling must stop when app is not on community tab (avoid unnecessary requests)

## Implementation Details

### 1. Remove Old Community Functions

Remove or replace these three functions in `app.js` (currently around line 12887-12921):

- `getCommunityUrl()` -- returns external URL, no longer needed
- `openCommunityNewTab()` -- opens external tab, no longer needed
- `renderCommunityTab()` -- currently shows landing page + auto-opens external tab

The old `renderCommunityTab()` will be replaced with new logic that checks for nickname and routes to the appropriate community screen.

### 2. Add Community State Properties

Add these properties to the `state` object (currently defined around line 89 in `app.js`):

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
_communityNicknameInput: '',
_communityNicknameError: '',
_communityScreen: 'home',  // sub-screen within community tab
```

The `_communityScreen` property controls which community sub-screen is displayed when the community tab is active. Valid values: `'home'`, `'board'`, `'post-detail'`, `'post-editor'`, `'friends'`, `'friend-profile'`, `'share-settings'`, `'nickname-setup'`, `'reports'`, `'notifications'`.

### 3. Modify Tab Click Handler

In `_handleNavTabClick()` (around line 15284), the current behavior for community is:

```javascript
if (tab === 'community') { openCommunityNewTab(); return; }
```

Replace with:

```javascript
if (tab === 'community') {
  state.studentTab = 'community';
  state.currentScreen = 'main';
  // Check nickname on first entry
  const user = state._authUser;
  if (user && !user.nickname) {
    state._communityScreen = 'nickname-setup';
  } else if (state._communityScreen === 'nickname-setup') {
    state._communityScreen = 'home';
  }
  renderScreen();
  // Load boards and notification count
  DB.loadCommunityBoards();
  DB.getUnreadNotificationCount();
  return;
}
```

Also remove the line `state._communityOpened = false;` that currently sits after the community check (around line 15287), since `_communityOpened` is no longer used.

### 4. Replace renderCommunityTab()

The new `renderCommunityTab()` function acts as a router for community sub-screens. It delegates to specific renderers based on `state._communityScreen`:

```javascript
function renderCommunityTab() {
  // Nickname gate: if no nickname, force setup
  if (state._authUser && !state._authUser.nickname && state._communityScreen !== 'nickname-setup') {
    state._communityScreen = 'nickname-setup';
  }

  switch (state._communityScreen) {
    case 'nickname-setup':
      return renderCommunityNicknameSetup();
    case 'home':
      return renderCommunityHome();
    case 'board':
      return renderCommunityBoard();
    case 'post-detail':
      return renderPostDetail();
    case 'post-editor':
      return renderPostEditor();
    case 'friends':
      return renderFriendsList();
    case 'friend-profile':
      return renderFriendProfile();
    case 'share-settings':
      return renderShareSettings();
    case 'reports':
      return renderReportList();
    case 'notifications':
      return renderNotificationList();
    default:
      return renderCommunityHome();
  }
}
```

The individual `renderCommunityHome()`, `renderCommunityBoard()`, etc. are **stub functions** in this section. They return placeholder HTML. Sections 10, 11, and 12 fill in the real implementations.

Stub example for each (implement all as simple placeholders):

```javascript
function renderCommunityHome() {
  return `<div class="tab-content animate-in">
    <div style="text-align:center;padding:40px">
      <div style="font-size:48px;margin-bottom:16px">💬</div>
      <h2>소통</h2>
      <p style="color:var(--text-muted)">커뮤니티 홈 (구현 예정)</p>
    </div>
  </div>`;
}
```

Create similar stubs for: `renderCommunityBoard`, `renderPostDetail`, `renderPostEditor`, `renderFriendsList`, `renderFriendProfile`, `renderShareSettings`, `renderReportList`, `renderNotificationList`.

### 5. Implement renderCommunityNicknameSetup()

This is the one screen fully implemented in this section, since it gates access to the entire community feature:

- Input field with character counter (2-12 chars)
- Korean/alphanumeric/spaces validation with regex: `/^[가-힣a-zA-Z0-9\s]{2,12}$/`
- Submit button that calls `DB.setNickname()`
- On success: updates `state._authUser.nickname`, sets `state._communityScreen = 'home'`, calls `renderScreen()`
- On error: displays error message below input (e.g., "이미 사용 중인 닉네임입니다")
- Glassmorphism card styling consistent with the app design

Key validation logic:

```javascript
// Client-side validation before API call
const nickname = state._communityNicknameInput.trim();
if (nickname.length < 2 || nickname.length > 12) {
  state._communityNicknameError = '닉네임은 2~12자여야 합니다';
  renderScreen(); return;
}
if (!/^[가-힣a-zA-Z0-9\s]+$/.test(nickname)) {
  state._communityNicknameError = '한글, 영문, 숫자, 공백만 사용 가능합니다';
  renderScreen(); return;
}
```

### 6. Add DB API Methods for Community

Add these methods to the `DB` object (around line 1771 in `app.js`). All follow the existing pattern of `fetch()` + response parsing + state update:

```javascript
// Community API methods to add to DB object:

async loadCommunityBoards()
// GET /api/community/boards?user_type=student&user_id={id}
// Updates state._communityBoards

async loadCommunityPosts(boardId, page = 1)
// GET /api/community/boards/{boardId}/posts?page={page}&limit=20&user_type=student&user_id={id}
// Updates state._communityPosts (append if page > 1), state._communityHasMore, state._communityPage

async loadPostDetail(postId)
// GET /api/community/posts/{postId}?user_type=student&user_id={id}
// Updates state._communityCurrentPost

async savePost(boardId, postData)
// POST /api/community/boards/{boardId}/posts
// postData: { title, content, photos }
// Returns postId

async updatePost(postId, postData)
// PUT /api/community/posts/{postId}
// postData: { title, content }

async deletePost(postId)
// DELETE /api/community/posts/{postId}
// Body: { user_type, user_id }

async loadComments(postId, page = 1)
// GET /api/community/posts/{postId}/comments?page={page}&limit=20
// Updates state._communityComments

async saveComment(postId, content)
// POST /api/community/posts/{postId}/comments
// Body: { author_type, author_id, content }

async deleteComment(commentId)
// DELETE /api/community/comments/{commentId}

async toggleLike(postId)
// POST /api/community/posts/{postId}/like
// Body: { user_type, user_id }
// Returns { liked, likeCount }

async reportContent(targetType, targetId, reason)
// POST /api/community/report
// Body: { reporter_type, reporter_id, target_type, target_id, reason }

async loadFriends()
// GET /api/student/{id}/friends
// Updates state._communityFriends

async generateFriendInviteCode()
// POST /api/student/{id}/friends/invite-code
// Returns { code, expiresAt }

async acceptFriendCode(code)
// POST /api/student/{id}/friends/accept-code
// Body: { code }

async removeFriend(friendshipId)
// DELETE /api/student/{id}/friends/{friendshipId}

async loadShareSettings()
// GET /api/student/{id}/share-settings
// Updates state._communityShareSettings

async updateShareSettings(settings)
// PUT /api/student/{id}/share-settings

async loadFriendProfile(studentId)
// GET /api/student/{studentId}/learning-profile?viewer_id={myId}

async setNickname(nickname)
// PUT /api/student/{id}/nickname
// Body: { nickname }
// On success: updates state._authUser.nickname

async loadNotifications()
// GET /api/community/notifications?user_type=student&user_id={id}
// Updates state._communityNotifications

async getUnreadNotificationCount()
// GET /api/community/notifications/unread-count?user_type=student&user_id={id}
// Updates state._communityUnreadCount

async markNotificationsRead()
// PUT /api/community/notifications/read-all
// Body: { user_type, user_id }
// Sets state._communityUnreadCount = 0
```

Each method must:
- Check `this.studentId()` is truthy (or use mentor ID if `state.mode === 'mentor'`)
- Use `state._authUser.id` for user_id and `'student'` or `'mentor'` for user_type based on `state.mode`
- Handle errors gracefully with `try/catch` and `console.error`
- Follow the response pattern: check `data.success`, extract from `data.data`

### 7. Notification Badge on Tab

Modify the tab bar rendering to show an unread count badge on the community tab.

In `renderSidebar()` (line 758-764), add badge logic for the community tab:

```javascript
${t.id === 'community' && state._communityUnreadCount > 0 
  ? `<span class="sidebar-badge">${state._communityUnreadCount}</span>` : ''}
```

In `renderMobileBottomTab()` (line 796-800), add similar badge:

```javascript
${t.id === 'community' && state._communityUnreadCount > 0 
  ? `<span class="mob-tab-badge">${state._communityUnreadCount > 99 ? '99+' : state._communityUnreadCount}</span>` : ''}
```

### 8. Notification Polling

Set up a 30-second polling interval for unread notification count. Start polling when the app initializes after login. Stop when on non-community screens (to save requests), or always poll but at a lower frequency.

```javascript
let _communityNotifPollTimer = null;

function startCommunityNotifPoll() {
  if (_communityNotifPollTimer) return;
  _communityNotifPollTimer = setInterval(() => {
    if (state._authUser) {
      DB.getUnreadNotificationCount();
    }
  }, 30000);
}

function stopCommunityNotifPoll() {
  if (_communityNotifPollTimer) {
    clearInterval(_communityNotifPollTimer);
    _communityNotifPollTimer = null;
  }
}
```

Call `startCommunityNotifPoll()` after successful login (in the login success handler, alongside `DB.loadAll()`). Call `stopCommunityNotifPoll()` on logout.

### 9. Navigation History Integration

The existing `goScreen()` function (line 14376) manages history state. Community sub-screen navigation should use a helper:

```javascript
function goCommScreen(screen) {
  state._communityScreen = screen;
  state.studentTab = 'community';
  state.currentScreen = 'main';
  renderScreen();
}
```

This function is called by community screen renderers (sections 10-12) to navigate between community sub-screens. Back navigation within community should set `_communityScreen` back to the parent screen (e.g., from `'post-detail'` back to `'board'`, from `'board'` back to `'home'`).

### 10. CSS Additions

Add to `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.css`:

- `.mob-tab-badge` -- small red circle badge for mobile bottom tab (positioned absolute, top-right of tab icon)
- `.community-nickname-card` -- glassmorphism card for nickname setup screen
- `.community-nickname-input` -- styled input field
- `.community-nickname-error` -- red error text below input

These are minimal styles. The existing `.sidebar-badge` style already handles sidebar badges. The mobile tab badge needs a new class since the mobile tab structure differs from sidebar.

### 11. Update renderScreen renderKey

The `renderKey` (line 445) determines whether to skip re-rendering. Add `state._communityScreen` and `state._communityUnreadCount` to the key so community navigation and badge updates trigger re-renders:

```javascript
const renderKey = `...existing...|${state._communityScreen}|${state._communityUnreadCount}`;
```

### 12. DOMPurify CDN Script Tag

Add to the HTML head (in the template that generates the page, likely in `src/renderer.tsx` or the HTML file):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js"></script>
```

This is needed by sections 10 and 11 for safe HTML rendering, but should be added now so the script is available when those sections are implemented.

## Summary Checklist

1. Remove `getCommunityUrl()`, `openCommunityNewTab()`, old `renderCommunityTab()`
2. Add community state properties to `state` object
3. Modify `_handleNavTabClick()` for in-app community navigation
4. Implement new `renderCommunityTab()` as sub-screen router
5. Implement `renderCommunityNicknameSetup()` with full validation
6. Add stub renderers for all other community screens
7. Add all `DB` community API methods
8. Add `goCommScreen()` navigation helper
9. Add notification badge to sidebar and mobile tab bar
10. Add notification polling (start on login, stop on logout)
11. Update `renderKey` for community state changes
12. Add DOMPurify CDN script tag
13. Add CSS for mobile tab badge and nickname setup screen
14. Verify: clicking community tab does NOT open external tab
15. Verify: student without nickname sees nickname setup screen
16. Verify: after setting nickname, community home is shown
17. Verify: unread notification badge appears on tab