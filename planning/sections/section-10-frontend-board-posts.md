Now I have enough context. Let me generate the section content.

# Section 10: Frontend Board Posts

## Overview

This section implements the core community browsing experience: board selector chips, post list with glassmorphism cards, post detail view with comments, like button, infinite scroll pagination, and DOMPurify-based safe HTML rendering. All code goes into `public/static/app.js` (and minimal CSS into `public/static/app.css`).

## Dependencies

- **section-03-post-api**: Post CRUD endpoints (`GET /api/community/boards/:boardId/posts`, `GET /api/community/posts/:postId`, etc.)
- **section-04-comment-like-api**: Comment CRUD + Like toggle endpoints
- **section-05-notification-api**: Notification endpoints for unread count display
- **section-08-moderation-api**: Report endpoint for the "report" action in post detail
- **section-09-frontend-navigation**: Community tab integration, state additions (`_communityBoards`, `_communityPosts`, `_communityCurrentBoard`, `_communityCurrentPost`, `_communityComments`, `_communityPage`, `_communityHasMore`, `_communityUnreadCount`), DB API methods (`DB.loadCommunityBoards`, `DB.loadCommunityPosts`, `DB.loadPostDetail`, `DB.loadComments`, `DB.toggleLike`, `DB.reportContent`, `DB.deletePost`, `DB.deleteComment`, `DB.getUnreadNotificationCount`, `DB.markNotificationsRead`), nickname check flow, and the `community-home` screen shell

## Tests (Manual Verification)

These tests should be verified via browser interaction and curl commands before considering this section complete.

### Board Selector and Post List

- Test: `community-home` shows horizontal board selector chips (one per board the user can access)
- Test: Tapping a board chip loads posts for that board and highlights the chip
- Test: Post list displays glassmorphism cards with: author emoji + nickname, relative time, title, content preview (first 100 chars, HTML stripped), photo indicator if photos exist, like count, comment count
- Test: Posts from soft-deleted posts (`is_deleted=1`) do not appear in the list
- Test: Empty board shows a "아직 게시글이 없어요" placeholder with illustration

### Post Detail

- Test: Tapping a post card navigates to `community-post-detail` screen
- Test: Post detail shows full rich HTML content rendered safely via DOMPurify
- Test: DOMPurify strips `<script>` tags from rendered content
- Test: DOMPurify strips `javascript:` URIs from rendered content
- Test: DOMPurify strips `on*` event handlers from rendered content
- Test: Photo gallery displays horizontally scrollable images (if photos exist)
- Test: Like button shows filled heart if already liked, outline if not
- Test: Tapping like toggles the state and updates count without full re-render
- Test: "more" menu (three dots) shows options: report, delete (if author or mentor)
- Test: Back button returns to the post list at the previous scroll position

### Comments

- Test: Comments section loads below the post in chronological order
- Test: Comment input is fixed at the bottom of the screen
- Test: Submitting a comment adds it to the list and increments comment count
- Test: Empty comment submission is prevented (frontend validation)
- Test: Comment with > 1,000 chars shows validation error
- Test: Author or mentor can delete a comment via long-press or menu

### Pagination (Infinite Scroll)

- Test: Initial load shows first 20 posts
- Test: Scrolling to bottom triggers next page load (spinner appears)
- Test: "No more posts" sentinel shows when `hasMore` is false
- Test: Page state resets when switching boards

### curl Verification Commands

```bash
BASE="http://localhost:5173"
STUDENT_ID=1

# Load boards
curl -s "$BASE/api/community/boards?user_type=student&user_id=$STUDENT_ID" | jq .

# Load posts for board 1, page 1
curl -s "$BASE/api/community/boards/1/posts?page=1&limit=20&user_type=student&user_id=$STUDENT_ID" | jq .

# Load post detail
curl -s "$BASE/api/community/posts/1?user_type=student&user_id=$STUDENT_ID" | jq .

# Load comments
curl -s "$BASE/api/community/posts/1/comments?page=1&limit=20" | jq .

# Toggle like
curl -s -X POST "$BASE/api/community/posts/1/like" \
  -H "Content-Type: application/json" \
  -d '{"user_type":"student","user_id":1}' | jq .
```

---

## Implementation Details

### File: `public/static/app.js`

All new rendering functions are added in a new section block after the existing `renderCommunityTab()` replacement (done in section-09). The section block should be clearly delimited:

```
// ==================== COMMUNITY: BOARD & POSTS ====================
```

### Screen Routing

Section-09 already wires `community` tab to `renderCommunityHome()`. This section adds sub-screen routing. The `renderCommunityHome()` function should check `state._communityScreen` to determine which sub-view to render:

- `'board-list'` (default) -- board chips + post list
- `'post-detail'` -- full post with comments

The pattern follows how existing tabs handle sub-screens (e.g., the growth tab checks `state._growthSubScreen`). The `renderCommunityTab()` function (replaced in section-09) should dispatch based on `state._communityScreen`:

```javascript
function renderCommunityTab() {
  switch (state._communityScreen) {
    case 'post-detail': return renderPostDetail();
    default: return renderCommunityHome();
  }
}
```

### Renderer: `renderCommunityHome()`

This is the main board browsing screen. Structure:

1. **Header bar**: "소통" title, bell icon with notification badge (`state._communityUnreadCount`), gear icon linking to settings/friends
2. **Board selector chips**: Horizontal scrollable row of chips from `state._communityBoards`. The active board is `state._communityCurrentBoard`. Tapping a chip calls `selectCommunityBoard(boardId)`.
3. **Post list**: Maps `state._communityPosts` to post card HTML. Each card is a glassmorphism container.
4. **FAB**: Floating "+" button at bottom-right, navigates to `community-post-editor` screen (section-11).
5. **Infinite scroll sentinel**: A div at the bottom observed by IntersectionObserver.

Key implementation notes:

- On first render (no boards loaded), call `await DB.loadCommunityBoards()` then auto-select the first board
- Board chip TailwindCSS: active chip uses `bg-indigo-500 text-white`, inactive uses `bg-white bg-opacity-70 text-gray-600`
- Post list container needs an `id` (e.g., `community-post-list`) for the IntersectionObserver sentinel

### Board Selection Logic

```javascript
async function selectCommunityBoard(boardId) {
  state._communityCurrentBoard = boardId;
  state._communityPage = 1;
  state._communityPosts = [];
  state._communityHasMore = false;
  renderScreen();
  await loadCommunityPostsPage();
}
```

### Post Card Rendering

Each post card helper function `_renderPostCard(post)` returns HTML. The card layout:

```
┌─────────────────────────────────────┐
│ {emoji} {nickname}          {time}  │
│                                     │
│ {title} (bold, if present)          │
│ {contentPreview} (max 100 chars)    │
│                                     │
│ [📷 {photoCount}장] (if hasPhotos)  │
│                                     │
│ ♡ {likeCount}   💬 {commentCount}  │
└─────────────────────────────────────┘
```

TailwindCSS classes for the card: `bg-white bg-opacity-70 backdrop-blur-sm rounded-2xl shadow-sm p-4 mb-3`

The card is wrapped in a clickable div with `onclick="openPostDetail(${post.id})"`.

**Content preview**: Strip HTML tags from `post.content` to get plain text, then truncate to 100 characters. Use a helper:

```javascript
function _stripHtmlForPreview(html, maxLen = 100) {
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  const text = tmp.textContent || '';
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}
```

**Relative time**: Use a helper `_relativeTime(dateStr)` that converts ISO date strings to Korean relative time ("방금 전", "3분 전", "2시간 전", "어제", "3일 전", "2026.03.10").

### Renderer: `renderPostDetail()`

Triggered when `state._communityScreen === 'post-detail'`. Uses `state._communityCurrentPost` (loaded via `DB.loadPostDetail(postId)`).

Layout:

1. **Header**: Back button (returns to board list, preserving scroll), board name
2. **Author info**: Emoji + nickname + relative time
3. **Post content**: Rich HTML rendered inside a div. **Critical**: sanitize with DOMPurify before innerHTML assignment:
   ```javascript
   const safeHtml = DOMPurify.sanitize(post.content);
   ```
4. **Photo gallery**: Horizontal scrollable container. Each photo is an `<img>` tag. Tap opens a full-screen overlay (simple lightbox).
5. **Like button**: `<button>` with heart icon. Filled (`fas fa-heart text-red-500`) if `post.isLikedByMe`, outline (`far fa-heart text-gray-400`) if not. Tapping calls `togglePostLike(postId)`.
6. **Action menu**: Three-dot button reveals: "신고하기" (report), "삭제하기" (delete, shown only if user is author or mentor). Uses a simple dropdown or bottom sheet.
7. **Comments section**: List of comment cards, each showing emoji + nickname + content + time. Paginated (load more button or infinite scroll).
8. **Comment input**: Fixed bottom bar with text input and send button.

### Post Detail Navigation

```javascript
async function openPostDetail(postId) {
  state._communityCurrentPost = null;
  state._communityComments = [];
  state._communityScreen = 'post-detail';
  renderScreen();
  // Load post and comments in parallel
  const [post, commentsData] = await Promise.all([
    DB.loadPostDetail(postId),
    DB.loadComments(postId, 1)
  ]);
  state._communityCurrentPost = post;
  state._communityComments = commentsData.comments;
  // Use DOM update instead of full renderScreen to avoid flicker
  _updatePostDetailDOM();
}
```

### Like Toggle

```javascript
async function togglePostLike(postId) {
  const result = await DB.toggleLike(postId);
  if (result) {
    state._communityCurrentPost.isLikedByMe = result.liked;
    state._communityCurrentPost.likeCount = result.likeCount;
    // Update like button DOM directly (no full re-render)
    _updateLikeButtonDOM(result.liked, result.likeCount);
    // Also update the post in the list
    const listPost = state._communityPosts.find(p => p.id === postId);
    if (listPost) {
      listPost.likeCount = result.likeCount;
    }
  }
}
```

### Comment Submission

```javascript
async function submitComment(postId) {
  const input = document.getElementById('community-comment-input');
  const content = (input?.value || '').trim();
  if (!content) return;
  if (content.length > 1000) {
    alert('댓글은 1,000자까지 입력할 수 있어요.');
    return;
  }
  input.value = '';
  const result = await DB.saveComment(postId, content);
  if (result) {
    // Append new comment to list
    state._communityComments.push(result);
    state._communityCurrentPost.commentCount++;
    _updateCommentsDOM();
  }
}
```

### Comment Deletion

```javascript
async function deleteCommunityComment(commentId) {
  if (!confirm('댓글을 삭제하시겠어요?')) return;
  const result = await DB.deleteComment(commentId);
  if (result) {
    state._communityComments = state._communityComments.filter(c => c.id !== commentId);
    state._communityCurrentPost.commentCount--;
    _updateCommentsDOM();
  }
}
```

### Infinite Scroll (IntersectionObserver)

After `renderCommunityHome()` renders, attach an IntersectionObserver to a sentinel element:

```javascript
function _setupCommunityInfiniteScroll() {
  const sentinel = document.getElementById('community-scroll-sentinel');
  if (!sentinel) return;
  const observer = new IntersectionObserver(async (entries) => {
    if (entries[0].isIntersecting && state._communityHasMore && !state._communityLoadingMore) {
      state._communityLoadingMore = true;
      state._communityPage++;
      await loadCommunityPostsPage();
      state._communityLoadingMore = false;
    }
  }, { threshold: 0.1 });
  observer.observe(sentinel);
}
```

The sentinel HTML (placed at the bottom of the post list):

```html
<div id="community-scroll-sentinel" style="height:40px;display:flex;align-items:center;justify-content:center">
  <!-- Shows spinner when loading, "모든 게시글을 불러왔어요" when no more -->
</div>
```

**Important**: The observer must be set up after DOM render. Use `setTimeout(() => _setupCommunityInfiniteScroll(), 0)` after `renderScreen()` or use a `requestAnimationFrame` callback.

### Loading Posts Page

```javascript
async function loadCommunityPostsPage() {
  const boardId = state._communityCurrentBoard;
  const page = state._communityPage;
  const data = await DB.loadCommunityPosts(boardId, page);
  if (data) {
    if (page === 1) {
      state._communityPosts = data.posts;
    } else {
      state._communityPosts = [...state._communityPosts, ...data.posts];
    }
    state._communityHasMore = data.hasMore;
    // Append new cards to DOM instead of full re-render
    if (page > 1) {
      _appendPostCardsDOM(data.posts);
    } else {
      renderScreen();
    }
  }
}
```

### DOMPurify Integration

DOMPurify is loaded via CDN (added to the HTML in section-09 or here). It must be available as a global `DOMPurify` object. Usage:

```javascript
// Safe rendering of rich text content
const safeContent = typeof DOMPurify !== 'undefined'
  ? DOMPurify.sanitize(rawHtml)
  : escapeHtml(rawHtml); // fallback if CDN fails to load
```

The DOMPurify CDN script tag should be added to the HTML template in `src/renderer.tsx` (or wherever the main HTML shell is defined):

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js"></script>
```

### Report Action

From the post detail "more" menu:

```javascript
async function reportCommunityPost(postId) {
  const reason = prompt('신고 사유를 입력해주세요:');
  if (!reason) return;
  await DB.reportContent('post', postId, reason);
  alert('신고가 접수되었습니다.');
}
```

### Post Deletion

```javascript
async function deleteCommunityPost(postId) {
  if (!confirm('게시글을 삭제하시겠어요?')) return;
  const result = await DB.deletePost(postId);
  if (result) {
    // Return to board list and remove from local state
    state._communityPosts = state._communityPosts.filter(p => p.id !== postId);
    state._communityScreen = 'board-list';
    renderScreen();
  }
}
```

### State Variables Added

These are added to the state proxy in addition to what section-09 provides:

```javascript
_communityScreen: 'board-list',   // sub-screen routing within community tab
_communityLoadingMore: false,     // infinite scroll loading flag
_communityCommentPage: 1,         // comment pagination
_communityCommentHasMore: false,  // comment pagination flag
```

---

### File: `public/static/app.css`

Minimal CSS additions for community-specific elements not achievable with TailwindCSS CDN utilities:

```css
/* Community post content area — ensure rich HTML displays properly */
.community-post-content img {
  max-width: 100%;
  border-radius: 8px;
  margin: 8px 0;
}

.community-post-content a {
  color: #6366f1;
  text-decoration: underline;
}

/* Comment input fixed bar */
.community-comment-bar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(255,255,255,0.95);
  backdrop-filter: blur(10px);
  padding: 8px 16px;
  border-top: 1px solid rgba(0,0,0,0.06);
  display: flex;
  gap: 8px;
  z-index: 100;
}

/* Photo gallery horizontal scroll */
.community-photo-gallery {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding: 8px 0;
}

.community-photo-gallery img {
  height: 200px;
  border-radius: 12px;
  object-fit: cover;
  flex-shrink: 0;
}

/* Board chip active state */
.community-board-chip.active {
  background: #6366f1;
  color: white;
}

/* Lightbox overlay for photo zoom */
.community-lightbox {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.community-lightbox img {
  max-width: 95vw;
  max-height: 90vh;
  object-fit: contain;
}
```

---

### File: `src/renderer.tsx`

Add the DOMPurify CDN script tag in the `<head>` section of the HTML template, alongside existing CDN scripts:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js"></script>
```

---

## Key Patterns to Follow

1. **Existing rendering pattern**: All renderers return HTML strings. The main `renderScreen()` calls `renderCommunityTab()` which dispatches to sub-renderers. This is identical to how other tabs work (e.g., `renderGrowthTab()` dispatching to sub-screens).

2. **DOM direct updates**: For performance-sensitive updates (like toggle, comment append), update the DOM directly instead of calling `renderScreen()`. This prevents scroll position loss and flickering. Use `document.getElementById()` to target specific elements.

3. **`goScreen()` not used for community sub-screens**: Community sub-navigation uses `state._communityScreen` within the community tab, not the global `goScreen()` mechanism. The global `state.currentScreen` remains `'main'` and `state.studentTab` remains `'community'`.

4. **Inline onclick with global functions**: All click handlers in innerHTML must be globally accessible functions (not module-scoped). Since `app.js` uses script-level functions, this is automatic. Example: `onclick="openPostDetail(42)"`.

5. **Error handling**: All async operations should use try/catch and show user-friendly Korean error messages. Never silently fail.

6. **Loading states**: Show spinners while data loads. The post detail screen should show a skeleton/spinner until `state._communityCurrentPost` is populated.