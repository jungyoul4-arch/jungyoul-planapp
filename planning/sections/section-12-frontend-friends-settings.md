I now have all the context needed. Let me produce the section content.

# Section 12: Frontend — Friends, Settings, and Notifications

## Overview

This section implements the frontend screens for friend management, learning share settings, nickname setup, and the notification list. These screens live inside the community tab area of `public/static/app.js` and rely on the navigation infrastructure from Section 09, the friend API from Section 06, and the nickname/sharing API from Section 07.

**Files to modify:**
- `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.js` — Add renderer functions, DB API methods, state properties, and inline event handlers
- `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.css` — Minimal community-specific styles (friends cards, settings toggles, notification items)

**Dependencies (must be completed first):**
- Section 06 (Friend API) — provides `/api/student/:id/friends/*` endpoints
- Section 07 (Nickname & Sharing API) — provides `/api/student/:id/nickname`, `/api/student/:id/share-settings`, `/api/student/:id/learning-profile`
- Section 09 (Frontend Navigation) — provides community tab integration, `goScreen()` routing for community screens, state additions, DB API stubs

---

## Tests (Manual Verification)

These tests should be verified by running the dev server (`npm run dev`) and testing in a browser. The project has no automated test framework.

### Friends Screen Tests

- **Test: community-friends renders without JS errors** — Navigate to community-friends screen via community home gear/friends link. Check browser console for errors.
- **Test: Friend list displays correctly** — After seeding friend data (Section 13), the friend list shows each friend with nickname, emoji, and school name.
- **Test: Invite code generation** — Tap "초대 코드 생성" button. A code in `JYCC-XXXX-XXXX` format appears. Copy button copies to clipboard.
- **Test: Code input and acceptance** — Enter a valid friend invite code in the input field. Tap accept. On success, a new friend appears in the list.
- **Test: Expired code shows error** — Enter an expired code. Error message "초대 코드가 만료되었습니다" displays.
- **Test: Already-friends shows error** — Enter a code from someone who is already a friend. Error message "이미 친구입니다" displays.
- **Test: Different academy shows error** — Enter a code from a student at a different academy. Error message "같은 학원 학생만 친구 추가가 가능합니다" displays.
- **Test: Self-invite shows error** — Enter your own invite code. Appropriate error displays.
- **Test: Tap friend navigates to profile** — Tapping a friend card navigates to `community-friend-profile` screen.
- **Test: Unfriend works** — Tap unfriend button on a friend. Confirmation dialog appears. After confirming, friend is removed from list.

### Friend Profile Tests

- **Test: community-friend-profile renders** — Shows friend's nickname, emoji, school name.
- **Test: Only shared fields visible** — If the friend has `share_class_records=1` but `share_question_count=0`, the class records summary shows but question count does not.
- **Test: Non-friend access blocked** — Attempting to view a profile of a non-friend shows an error or redirects back.

### Nickname Setup Tests

- **Test: community-nickname-setup enforces 2-12 char validation** — Input fewer than 2 chars, submit button is disabled. Input more than 12 chars, excess is blocked or warning shown.
- **Test: Korean/alphanumeric only** — Special characters are rejected with a validation message.
- **Test: Duplicate nickname in academy shows error** — Enter a nickname already taken by another student in the same academy. Error "이미 사용 중인 닉네임입니다" appears.
- **Test: Successful nickname set redirects** — After setting a valid nickname, the screen transitions to `community-home`.
- **Test: Nickname change from settings** — Accessing nickname setup from settings (not first-time) shows current nickname pre-filled with a "변경" button.

### Share Settings Tests

- **Test: community-share-settings renders toggle switches** — Five toggle switches appear for: class records, question count, teach count, mission status, XP level.
- **Test: Default all off** — On first visit, all toggles are off (matching the DB default of all 0).
- **Test: Toggle persists** — Turn on `share_class_records`, leave and return. The toggle is still on.
- **Test: API called on toggle change** — Each toggle change calls `DB.updateShareSettings()` (verify via Network tab).

### Notification List Tests

- **Test: community-notifications renders** — Shows list of notifications sorted by most recent.
- **Test: Comment notification text** — "[닉네임]님이 내 게시글에 댓글을 달았습니다" format.
- **Test: Like notification text** — "[닉네임]님이 내 게시글을 좋아합니다" format.
- **Test: Tap notification navigates to post** — Tapping a notification calls `goScreen('community-post-detail')` with the correct postId.
- **Test: All marked as read on entry** — Entering the notification screen calls `DB.markNotificationsRead()`. Unread badge on community tab clears.
- **Test: Badge appears on community tab when unread > 0** — Verify that `_communityUnreadCount` > 0 shows a red badge on the tab icon.
- **Test: Badge disappears after marking all as read** — After entering notifications, badge number goes to 0.

### curl Test Commands

```bash
BASE="http://localhost:5173"
STUDENT_ID=1

# Generate friend invite code
curl -s -X POST "$BASE/api/student/$STUDENT_ID/friends/invite-code" | jq .

# Accept friend code (as different student)
curl -s -X POST "$BASE/api/student/2/friends/accept-code" \
  -H "Content-Type: application/json" \
  -d '{"code":"JYCC-XXXX-XXXX"}' | jq .

# Get friends list
curl -s "$BASE/api/student/$STUDENT_ID/friends" | jq .

# Delete friendship
curl -s -X DELETE "$BASE/api/student/$STUDENT_ID/friends/1" | jq .

# Set nickname
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스터123"}' | jq .

# Get share settings
curl -s "$BASE/api/student/$STUDENT_ID/share-settings" | jq .

# Update share settings
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/share-settings" \
  -H "Content-Type: application/json" \
  -d '{"share_class_records":1,"share_question_count":0,"share_teach_count":1,"share_mission_status":0,"share_xp_level":0}' | jq .

# Get friend's learning profile
curl -s "$BASE/api/student/2/learning-profile?viewer_id=$STUDENT_ID" | jq .

# Get notifications
curl -s "$BASE/api/community/notifications?user_type=student&user_id=$STUDENT_ID" | jq .

# Get unread count
curl -s "$BASE/api/community/notifications/unread-count?user_type=student&user_id=$STUDENT_ID" | jq .

# Mark all read
curl -s -X PUT "$BASE/api/community/notifications/read-all" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":1}' | jq .
```

---

## Implementation Details

### 1. State Additions

Add to the global `state` object in `app.js` (Section 09 should have already added these; verify they exist):

```javascript
_communityFriends: [],
_communityShareSettings: null,
_communityNotifications: [],
_communityUnreadCount: 0,
_communityMyInviteCode: null,
_communityFriendProfile: null,
```

### 2. DB API Methods

Add these methods to the `DB` object in `app.js`. They follow the existing fetch pattern used by all other DB methods (e.g., `DB.loadClassRecords`).

**`DB.loadFriends()`** — `GET /api/student/${state.studentId}/friends`. Stores result in `state._communityFriends`.

**`DB.generateFriendInviteCode()`** — `POST /api/student/${state.studentId}/friends/invite-code`. Returns `{ code, expiresAt }`. Store code in `state._communityMyInviteCode`.

**`DB.acceptFriendCode(code)`** — `POST /api/student/${state.studentId}/friends/accept-code` with body `{ code }`. On success, reload friends list. Return the result for UI feedback (success message or error).

**`DB.removeFriend(friendshipId)`** — `DELETE /api/student/${state.studentId}/friends/${friendshipId}`. On success, remove from `state._communityFriends` array.

**`DB.setNickname(nickname)`** — `PUT /api/student/${state.studentId}/nickname` with body `{ nickname }`. On success, update `state.studentNickname` (or equivalent local state).

**`DB.loadShareSettings()`** — `GET /api/student/${state.studentId}/share-settings`. Store in `state._communityShareSettings`. The API creates a default row (all 0) if none exists.

**`DB.updateShareSettings(settings)`** — `PUT /api/student/${state.studentId}/share-settings` with the settings object. Update `state._communityShareSettings`.

**`DB.loadFriendProfile(studentId)`** — `GET /api/student/${studentId}/learning-profile?viewer_id=${state.studentId}`. Store in `state._communityFriendProfile`. This returns only fields the target student has enabled.

**`DB.loadNotifications()`** — `GET /api/community/notifications?user_type=student&user_id=${state.studentId}&limit=20`. Store in `state._communityNotifications`.

**`DB.getUnreadNotificationCount()`** — `GET /api/community/notifications/unread-count?user_type=student&user_id=${state.studentId}`. Store in `state._communityUnreadCount`. Called on app init and periodically (30s poll).

**`DB.markNotificationsRead()`** — `PUT /api/community/notifications/read-all` with body `{ user_type: 'student', user_id: state.studentId }`. Set `state._communityUnreadCount = 0`.

### 3. Screen Renderers

All renderers return an HTML string and are called from `renderScreen()` in the community tab's case block (set up in Section 09).

#### 3a. `renderFriendsList()`

Screen name: `community-friends`

Layout with two sub-tabs toggled via state flag (`_friendsTab: 'list' | 'invite'`):

**"내 친구" tab:**
- Header: "친구" with back button to `community-home`
- Sub-tab chips: "내 친구" (active), "초대하기"
- Friend list as glassmorphism cards, each showing:
  - Emoji + nickname + school name
  - Tap card: `goScreen('community-friend-profile')` with `state._communityViewingFriendId = friendStudentId`
  - Long-press or "..." menu: unfriend option with confirmation dialog
- Empty state: "아직 친구가 없습니다. 초대 코드를 공유해보세요!"

**"초대하기" tab:**
- If no code generated yet: "초대 코드 생성" button
- After generation: Display code (`JYCC-XXXX-XXXX`) in large text, with:
  - "복사" button — uses `navigator.clipboard.writeText(code)`
  - "공유" button — uses `navigator.share()` if available, clipboard fallback
  - Expiry info: "7일 후 만료 · 최대 5회 사용"
- Input field: "친구 초대 코드 입력" with accept button
  - On submit: call `DB.acceptFriendCode(code)`
  - Show success toast or error message
  - Error messages map from API: expired, max uses, different academy, already friends, self-invite

TailwindCSS classes for friend cards: `bg-white bg-opacity-70 backdrop-blur-sm rounded-2xl shadow-sm p-4 mb-3 flex items-center gap-3`

#### 3b. `renderFriendProfile()`

Screen name: `community-friend-profile`

Uses `state._communityViewingFriendId` to load profile via `DB.loadFriendProfile()`.

Layout:
- Header with back button and friend's nickname
- Profile card: emoji (large), nickname, school name
- Shared learning data sections (only shown if the friend enabled them in share_settings):
  - `share_class_records`: "수업 기록" — total count, recent subjects
  - `share_question_count`: "질문 기록" — total question count
  - `share_teach_count`: "가르침 기록" — total teach count
  - `share_mission_status`: "미션 현황" — assignment completion summary
  - `share_xp_level`: "레벨/경험치" — XP level and points
- If no fields are shared: "이 친구는 학습 정보를 공유하지 않고 있습니다"
- Unfriend button at bottom

The API returns only enabled fields (null/undefined for disabled ones). Check each field's existence before rendering its section.

#### 3c. `renderNicknameSetup()`

Screen name: `community-nickname-setup`

This screen is shown in two contexts:
1. **First-time setup** — When entering community tab with no nickname set (intercepted in Section 09's navigation logic)
2. **Change nickname** — Accessed from community settings/gear menu

Layout:
- Header: "닉네임 설정" (no back button on first-time, back button on change mode)
- Instruction text: "커뮤니티에서 사용할 닉네임을 설정해주세요"
- Input field with character counter (2-12 chars)
- Validation feedback shown below input:
  - Too short (< 2 chars): "2자 이상 입력해주세요"
  - Too long (> 12 chars): "12자 이하로 입력해주세요"
  - Invalid characters: "한글, 영문, 숫자만 사용 가능합니다"
  - Duplicate: "이미 사용 중인 닉네임입니다" (checked via API)
  - Available: "사용 가능한 닉네임입니다" (green checkmark)
- Debounced uniqueness check: After 500ms of no typing, call nickname validation API
- Submit button: "설정 완료" (disabled until validation passes)
- On success: If first-time, `goScreen('community-home')`. If change mode, go back.

Validation regex for client-side: `/^[가-힣a-zA-Z0-9\s]{2,12}$/`

#### 3d. `renderShareSettings()`

Screen name: `community-share-settings`

Layout:
- Header: "학습 공유 설정" with back button
- Description: "친구에게 공개할 학습 정보를 선택하세요"
- Five toggle rows, each with label and toggle switch:
  - "수업 기록 공유" → `share_class_records`
  - "질문 기록 수 공유" → `share_question_count`
  - "가르침 기록 수 공유" → `share_teach_count`
  - "미션 현황 공유" → `share_mission_status`
  - "레벨/경험치 공유" → `share_xp_level`
- Each toggle calls `DB.updateShareSettings()` immediately on change (no save button needed)
- Toggle implementation: Use a styled checkbox with TailwindCSS. The `onclick` handler reads all current toggle values and sends the full settings object to the API.

Toggle HTML pattern (using standard Tailwind classes since CDN does not support arbitrary values):
```html
<label class="flex items-center justify-between p-4 bg-white bg-opacity-70 backdrop-blur-sm rounded-xl mb-2">
  <span class="text-gray-800 font-medium">수업 기록 공유</span>
  <input type="checkbox" class="w-5 h-5 rounded" onchange="toggleShareSetting('share_class_records', this.checked)">
</label>
```

The `toggleShareSetting` function (exposed on `window` or via the community namespace) reads all checkbox states, constructs the settings object, and calls `DB.updateShareSettings()`.

#### 3e. `renderNotificationList()`

Screen name: `community-notifications`

On entry: call `DB.markNotificationsRead()` to clear unread state.

Layout:
- Header: "알림" with back button to `community-home`
- Notification list, each item as a tappable row:
  - For `type === 'comment'`: "💬 [actorNickname]님이 내 게시글에 댓글을 달았습니다" + post title snippet + relative time
  - For `type === 'like'`: "❤️ [actorNickname]님이 내 게시글을 좋아합니다" + post title snippet + relative time
  - Unread items: slightly different background (e.g., `bg-blue-50`)
  - Tap: `goScreen('community-post-detail')` with `state._communityCurrentPost = { id: notification.postId }`
- Empty state: "아직 알림이 없습니다"
- Relative time helper: reuse existing time formatting or create `_communityTimeAgo(dateStr)` that returns "방금 전", "5분 전", "2시간 전", "3일 전", etc.

### 4. Notification Badge on Tab

Section 09 handles the tab bar rendering. This section needs to ensure:

- `DB.getUnreadNotificationCount()` is called during community tab initialization
- A polling interval (`setInterval`, 30 seconds) updates the count while the app is active
- The badge renders as a small red circle with number overlaid on the community tab icon
- Badge HTML pattern inside the tab bar item:

```html
<span class="relative">
  <i class="fas fa-comments"></i>
  ${state._communityUnreadCount > 0 ? `<span class="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">${state._communityUnreadCount > 9 ? '9+' : state._communityUnreadCount}</span>` : ''}
</span>
```

The polling should be set up when the app initializes (in the existing init flow) and cleared if needed. Use a module-level variable to track the interval ID:

```javascript
let _notificationPollInterval = null;

function startNotificationPolling() {
  if (_notificationPollInterval) return;
  _notificationPollInterval = setInterval(() => {
    DB.getUnreadNotificationCount();
  }, 30000);
}
```

Call `startNotificationPolling()` after successful student login.

### 5. Community Settings/Gear Menu

From the community home screen (Section 10), a gear icon in the header opens a settings dropdown or navigates to a settings screen. This section implements the settings options:

- "닉네임 변경" → `goScreen('community-nickname-setup')` with a change-mode flag
- "학습 공유 설정" → `goScreen('community-share-settings')`
- "친구 관리" → `goScreen('community-friends')`

This can be a simple dropdown menu triggered by the gear icon, or a dedicated settings screen. A dropdown is simpler and matches common mobile patterns:

```javascript
function toggleCommunitySettingsMenu() {
  const menu = document.getElementById('community-settings-menu');
  if (menu) {
    menu.classList.toggle('hidden');
  }
}
```

### 6. Clipboard and Share API Integration

For the invite code sharing feature:

```javascript
async function copyInviteCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    showToast('초대 코드가 복사되었습니다');
  } catch (e) {
    // Fallback for older browsers
    const textarea = document.createElement('textarea');
    textarea.value = code;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    showToast('초대 코드가 복사되었습니다');
  }
}

async function shareInviteCode(code) {
  if (navigator.share) {
    try {
      await navigator.share({
        title: '정율 플래너 친구 초대',
        text: `정율 플래너에서 친구가 되어요! 초대 코드: ${code}`,
      });
    } catch (e) { /* user cancelled */ }
  } else {
    copyInviteCode(code);
  }
}
```

### 7. Error Handling Patterns

All API calls in this section should follow the existing error handling pattern:

```javascript
const res = await DB.acceptFriendCode(code);
if (res.success) {
  showToast('친구가 추가되었습니다!');
  await DB.loadFriends();
  goScreen('community-friends');
} else {
  showToast(res.error || '친구 추가에 실패했습니다', 'error');
}
```

Error messages from the API (Section 06) are in Korean and can be displayed directly to the user. The DB methods should return the full response object (including error messages) rather than swallowing errors.

### 8. CSS Additions

Add minimal CSS to `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.css` for elements that cannot be achieved with Tailwind CDN utilities alone:

- Toggle switch styling (if the basic checkbox is insufficient)
- Notification unread background highlight
- Invite code display styling (large monospace text)
- Friend card hover/tap states

Keep additions minimal — the glassmorphism design system and TailwindCSS utilities handle most styling needs.

### 9. Inline Event Handler Namespace

All inline `onclick` handlers in community screens must use globally accessible functions. Since `app.js` uses global scope functions (not ES modules), community functions should follow the existing pattern:

```javascript
// Exposed as global functions (same as existing app.js pattern)
function communityAcceptFriendCode() { ... }
function communityGenerateInviteCode() { ... }
function communityToggleShareSetting(field, value) { ... }
function communitySetNickname() { ... }
function communityUnfriend(friendshipId) { ... }
function communityTapNotification(postId) { ... }
```

Use a `community` prefix to avoid name collisions with existing global functions.

---

## Checklist for Implementer

1. Verify Section 09 state additions and screen routing are in place
2. Add DB API methods for friends, settings, nickname, notifications
3. Implement `renderFriendsList()` with two sub-tabs (list + invite)
4. Implement `renderFriendProfile()` with conditional field display
5. Implement `renderNicknameSetup()` with debounced validation
6. Implement `renderShareSettings()` with toggle switches
7. Implement `renderNotificationList()` with mark-as-read on entry
8. Add notification badge to community tab icon
9. Set up 30-second notification polling after login
10. Add settings menu with links to nickname, share settings, friends
11. Add invite code copy/share functionality
12. Add minimal CSS for elements not achievable with Tailwind CDN
13. Test all screens manually in browser (do NOT declare complete without visual verification)