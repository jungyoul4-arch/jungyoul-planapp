Now I have enough context. Let me generate the section content.

# Section 11: Frontend Editor and Photos

## Overview

This section implements the **post creation/editing UI** including a rich text editor with a formatting toolbar, photo upload with client-side compression, and the photo preview strip. These components power the `community-post-editor` screen where students and mentors compose and edit community posts.

**Dependencies**: 
- Section 03 (Post API) must be complete -- the editor submits to `POST /api/community/boards/:boardId/posts` and `PUT /api/community/posts/:postId`
- Section 09 (Frontend Navigation) must be complete -- provides `goScreen()`, community state, and `DB` API layer

**Files to modify**:
- `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.js` -- Add `renderPostEditor()` renderer, photo compression utilities, rich text toolbar logic
- `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.css` -- Contenteditable styling, toolbar styles, photo strip layout
- `/Users/jungyoulkwak/jungyoul-planapp/public/index.html` (or equivalent Hono-rendered HTML) -- Add DOMPurify CDN script tag

---

## Tests (Manual Verification)

These tests must pass before the section is considered complete. They are performed via browser interaction on the running dev server (`npm run dev`).

### 4.5 Rich Text Editor Tests

1. **Toolbar formatting**: Navigate to `community-post-editor`. Type text in the contenteditable area, select a portion, and click each toolbar button (Bold, Italic, Link, List). Verify the selected text gets wrapped in `<b>`, `<i>`, `<a>`, or `<ul><li>` tags respectively. Inspect the contenteditable div's innerHTML via browser console to confirm.

2. **DOMPurify strips script tags**: In the browser console, manually set the editor content to `<script>alert('xss')</script>Hello`. Trigger the save flow. Verify that the content sent to the API (inspect network tab) does not contain the `<script>` tag -- only "Hello" should remain.

3. **DOMPurify strips javascript: URIs**: Set editor content to `<a href="javascript:alert(1)">click</a>`. Save and verify the `href` is stripped or sanitized.

4. **DOMPurify strips on-event handlers**: Set content to `<div onmouseover="alert(1)">hover</div>`. Save and verify `onmouseover` is removed.

5. **Content preview strips HTML**: After saving a post with bold/italic formatting, navigate to the board post list. Verify the preview text (first ~100 chars) is plain text with no HTML tags visible.

### 4.6 Photo Upload Tests

6. **Photo limit enforcement**: In the post editor, attempt to attach more than 5 photos. Verify a toast/error message appears and only the first 5 are accepted.

7. **Photo compression**: Attach a large image (e.g., 4000px wide). Inspect the base64 data in state or network request -- the image width should be resized to max 1200px.

8. **Photo preview strip**: Attach 3 photos. Verify they appear as thumbnails in a horizontal strip below the editor. Each thumbnail should have an X button to remove it.

9. **Photo display in post detail**: After posting with photos, navigate to the post detail view. Verify photos render correctly (not broken images, not raw base64 text).

### Editor Integration Tests

10. **Empty post rejection**: Leave both title and content empty (no photos). Click the submit button. Verify the form does not submit and shows a validation message.

11. **Photo-only post accepted**: Leave title and content empty but attach at least one photo. Click submit. Verify the post is created successfully.

12. **Title character limit**: Type more than 100 characters in the title field. Verify the character counter shows the limit exceeded and the submit button is disabled or blocked.

13. **Content character limit**: Type more than 10,000 characters in the contenteditable area. Verify the counter reflects the limit and submission is prevented.

14. **Edit mode loads existing data**: Navigate to edit an existing post. Verify the title, content (with formatting), and photos are pre-populated in the editor.

### API Integration (curl)

```bash
BASE="http://localhost:5173"

# Create post with photos (base64 photo data abbreviated)
curl -s -X POST "$BASE/api/community/boards/1/posts" \
  -H "Content-Type: application/json" \
  -d '{
    "author_type":"student",
    "author_id":1,
    "title":"에디터 테스트",
    "content":"<b>볼드</b> 텍스트",
    "photos":[{"data":"data:image/jpeg;base64,/9j/...","mime_type":"image/jpeg"}]
  }' | jq .

# Verify post detail returns sanitized content and photo references
curl -s "$BASE/api/community/posts/1?user_type=student&user_id=1" | jq '.data.post.content, .data.post.photos'
```

---

## Implementation Details

### DOMPurify CDN Integration

Add the DOMPurify script tag to the HTML template. The project uses Hono's `renderer.tsx` to generate the HTML shell. Add this before the app.js script:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js"></script>
```

DOMPurify will be available globally as `DOMPurify`. It is used in two places:
- **On save**: Before sending content to the API, sanitize with `DOMPurify.sanitize(editorDiv.innerHTML)`
- **On render**: Before assigning rich HTML content to innerHTML in post detail, sanitize with `DOMPurify.sanitize(post.content)`

### Rich Text Editor Implementation

The editor screen (`community-post-editor`) is rendered by `renderPostEditor(boardId, postId?)`. When `postId` is provided, it loads existing post data for editing.

**Editor structure** (rendered as innerHTML):

- A back button header with "게시" (Post) submit button
- Title input: `<input>` with maxlength=100 and a live character counter
- Formatting toolbar: A horizontal row of buttons for Bold, Italic, Link, List
- Content area: `<div contenteditable="true">` with min-height for comfortable typing
- Photo attachment strip: Horizontal scroll area showing photo thumbnails with remove buttons
- Photo add button: Camera icon that triggers a hidden `<input type="file" accept="image/*" multiple>`

**Toolbar button handlers** use `document.execCommand()` for simplicity:
- Bold: `document.execCommand('bold')`
- Italic: `document.execCommand('italic')`
- Link: Prompt for URL, then `document.execCommand('createLink', false, url)`
- List: `document.execCommand('insertUnorderedList')`

While `execCommand` is technically deprecated, it remains the most practical approach for a Vanilla JS contenteditable editor and is fully supported in all target browsers. No framework-based alternatives are justified given the project constraints.

**Character counting** for the contenteditable area uses `editorDiv.innerText.length` (not innerHTML.length, which includes HTML tags). Attach an `input` event listener to update the counter in real time.

**Content extraction on save**:
1. Get raw HTML: `const rawHtml = editorDiv.innerHTML`
2. Sanitize: `const cleanHtml = DOMPurify.sanitize(rawHtml, { ALLOWED_TAGS: ['b', 'i', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'br', 'p', 'div'], ALLOWED_ATTR: ['href', 'target'] })`
3. Send `cleanHtml` as the `content` field to the API

**Content preview helper** for the post list (strips HTML to plain text):

```javascript
function stripHtmlForPreview(html, maxLen = 100) {
  /** Strip HTML tags and return first maxLen chars of plain text. */
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const text = tmp.textContent || tmp.innerText || '';
  return text.length > maxLen ? text.slice(0, maxLen) + '...' : text;
}
```

### Photo Upload and Compression

Follow the existing pattern from `/Users/jungyoulkwak/jungyoul-planapp/public/modules/records/views/photo-upload-v2.js` which already implements `resizeImage()` with Canvas API.

**Compression function** (adapted from the existing `resizeImage` in photo-upload-v2.js):

```javascript
function compressCommunityPhoto(file, maxWidth = 1200, quality = 0.7) {
  /** Resize image to maxWidth and compress as JPEG. Returns Promise<string> (base64 data URL). */
}
```

The function:
1. Reads the file with `FileReader.readAsDataURL`
2. Creates an `Image` element and waits for load
3. If width <= maxWidth, returns the original data URL
4. Otherwise creates a Canvas, draws the image scaled down, and returns `canvas.toDataURL('image/jpeg', quality)`

**Thumbnail generation** for the post list preview (smaller version):

```javascript
function generateThumbnail(dataUrl, maxWidth = 200) {
  /** Create a small thumbnail for list view display. Returns Promise<string>. */
}
```

**Photo state management** in the editor:

```javascript
// Temporary state while editing (stored on the global state proxy)
state._editorPhotos = [];      // Array of { data: base64DataUrl, mimeType: string }
state._editorPhotoCount = 0;   // For quick limit checks
```

**Photo selection handler**:
1. Triggered by file input change event
2. Check total count (existing + new) does not exceed 5. If exceeded, show toast: "사진은 최대 5장까지 첨부할 수 있어요"
3. For each selected file, call `compressCommunityPhoto(file)` 
4. Push result to `state._editorPhotos`
5. Re-render the photo strip

**Photo strip rendering**: A horizontal flex container with fixed-size thumbnail previews. Each thumbnail has a small X button in the corner (absolute positioned) that removes it from `state._editorPhotos` and re-renders.

**Photo removal**: Splice from `state._editorPhotos` at the given index and re-render.

### Post Submit Flow

When the user taps "게시" (Post):

1. **Validate**: At least one of (title, content text, photos) must be non-empty. Show error toast if all are empty.
2. **Validate limits**: Title <= 100 chars, content innerText <= 10,000 chars
3. **Sanitize**: Run DOMPurify on the editor HTML content
4. **Build payload**:
   ```javascript
   const payload = {
     author_type: state.userType,
     author_id: state.userId,
     title: titleInput.value.trim(),
     content: sanitizedHtml,
     photos: state._editorPhotos.map(p => ({ data: p.data, mime_type: p.mimeType }))
   };
   ```
5. **Call API**: For new posts, `DB.savePost(boardId, payload)`. For edits, `DB.updatePost(postId, payload)`.
6. **On success**: Navigate back to the board view with `goScreen('community-board', { boardId })`. Show success toast.
7. **On error**: Show error toast with the API error message.

### Edit Mode

When `renderPostEditor(boardId, postId)` is called with a `postId`:

1. Load existing post via `DB.loadPostDetail(postId)`
2. Pre-populate:
   - Title input with `post.title`
   - Contenteditable div innerHTML with `DOMPurify.sanitize(post.content)` 
   - Photo strip with existing photos from `post.photos` array
3. The submit button label changes from "게시" to "수정"
4. On submit, call `DB.updatePost(postId, payload)` instead of `DB.savePost()`

### CSS Additions

Add to `/Users/jungyoulkwak/jungyoul-planapp/public/static/app.css`:

```css
/* Community Post Editor */
.community-editor-toolbar {
  /* Horizontal toolbar with formatting buttons */
  display: flex;
  gap: 4px;
  padding: 8px;
  border-bottom: 1px solid rgba(0,0,0,0.1);
}

.community-editor-toolbar button {
  /* Individual toolbar buttons */
  width: 36px;
  height: 36px;
  border-radius: 8px;
  border: none;
  background: rgba(0,0,0,0.05);
  font-weight: bold;
  cursor: pointer;
}

.community-editor-toolbar button:active {
  background: rgba(59, 130, 246, 0.2);
}

.community-editor-content {
  /* Contenteditable area */
  min-height: 200px;
  padding: 16px;
  outline: none;
  font-size: 15px;
  line-height: 1.6;
}

.community-editor-content:empty::before {
  content: attr(data-placeholder);
  color: #9ca3af;
}

.community-photo-strip {
  /* Horizontal photo preview strip */
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
}

.community-photo-thumb {
  position: relative;
  width: 80px;
  height: 80px;
  border-radius: 12px;
  overflow: hidden;
  flex-shrink: 0;
}

.community-photo-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.community-photo-thumb .remove-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  background: rgba(0,0,0,0.5);
  color: white;
  border: none;
  border-radius: 50%;
  font-size: 12px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.community-photo-add {
  /* The "add photo" button in the strip */
  width: 80px;
  height: 80px;
  border-radius: 12px;
  border: 2px dashed #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
  color: #9ca3af;
  font-size: 24px;
}
```

These are plain CSS rules (not Tailwind custom classes) since the project uses TailwindCSS CDN which does not support `@apply` or custom config. The editor layout itself uses standard Tailwind utility classes inline (e.g., `bg-white rounded-2xl shadow-sm`).

### Integration with DB API Layer

The following `DB` methods (defined in section 09) are used by this section:

- `DB.savePost(boardId, postData)` -- POST to `/api/community/boards/:boardId/posts`
- `DB.updatePost(postId, postData)` -- PUT to `/api/community/posts/:postId`
- `DB.loadPostDetail(postId)` -- GET `/api/community/posts/:postId` (for edit mode pre-population)

These methods must follow the existing `DB` object pattern: async functions that call `fetch()`, parse the JSON response, and return `data` on success or throw/return null on failure.

### Key Patterns to Follow

The existing project has established patterns that this implementation must follow:

1. **Inline onclick with global namespace**: All click handlers in innerHTML-rendered content must use globally accessible functions. In app.js, functions are already global. Example: `onclick="submitCommunityPost()"`.

2. **State proxy**: The global `state` object is a Proxy. New properties like `state._editorPhotos` can be added dynamically and will work correctly.

3. **Screen rendering**: `renderPostEditor()` returns an HTML string. It is called from `renderScreen()` when `currentScreen === 'community-post-editor'`. Navigation uses `goScreen('community-post-editor', { boardId, postId })`.

4. **Toast notifications**: Use the existing `showToast(message, type)` function for success/error feedback.

5. **Photo pattern from records module**: The `resizeImage()` function in `photo-upload-v2.js` uses `FileReader` + `Image` + `Canvas` with JPEG quality 0.85. For community photos, use 0.7 quality since these are social posts, not academic records requiring high fidelity.

### Server-Side Sanitization Note

The backend (section 03) must also sanitize content. Since the Cloudflare Workers environment cannot run DOMPurify (which requires a DOM), the server-side approach uses a simpler regex-based tag stripping that removes `<script>`, `on*` attributes, and `javascript:` URIs. The client-side DOMPurify sanitization is the primary defense; server-side is defense-in-depth. This is documented in section 03's implementation.