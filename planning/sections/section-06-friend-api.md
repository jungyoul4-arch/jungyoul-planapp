Now I have all the context needed. Let me generate the section content.

# Section 06: Friend API

## Overview

This section implements the friend system backend: invite code generation, code acceptance, friend listing, and unfriend. All endpoints live in `src/index.tsx` and follow the existing Hono API patterns.

Friends are exclusively between students (not mentors). The system uses invite codes (same `JYCC-XXXX-XXXX` format already in the codebase) and validates that both students belong to the same academy before creating a friendship.

**Dependencies**: Section 01 (DB Migration) must be complete -- specifically, the `friendships` and `friend_invite_codes` tables must exist.

**Blocks**: Section 12 (Frontend Friends & Settings) consumes these APIs.

---

## Key Design Decisions

### ID Normalization for Friendships

The `friendships` table has a UNIQUE constraint on `(student_id_1, student_id_2)`. To prevent duplicate friendships (A-B and B-A), always store the smaller ID as `student_id_1`:

```
student_id_1 = MIN(studentA, studentB)
student_id_2 = MAX(studentA, studentB)
```

This normalization must happen at every INSERT and every SELECT/lookup.

### Academy Resolution Join Chain

Students do not have a direct `academy_name` field. To determine a student's academy:

```sql
SELECT m.academy_name
FROM students s
JOIN groups g ON s.group_id = g.id
JOIN mentors m ON g.mentor_id = m.id
WHERE s.id = ?
```

This join chain is used for friend invite validation (both students must belong to the same academy).

### Existing Code Reference

The `generateInviteCode()` function already exists at approximately line 1075 of `src/index.tsx`:

```typescript
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `JYCC-${part1}-${part2}`;
}
```

Reuse this function for friend invite codes.

---

## Tests (Manual API Verification)

Run these curl commands after implementation to verify correctness. All assume `BASE="http://localhost:5173"` and that migration + seed data have been run.

### Test 1: Generate Invite Code

```bash
# Should return { success: true, data: { code: "JYCC-XXXX-XXXX", expiresAt: "..." } }
curl -s -X POST "$BASE/api/student/1/friends/invite-code" | jq .
```

- Verify: code matches `JYCC-XXXX-XXXX` format
- Verify: `expiresAt` is 7 days from now
- Verify: calling again generates a new code (or returns existing active code -- implementation choice)

### Test 2: Code Collision Retry

- This is tested implicitly. If the first generated code already exists in `friend_invite_codes`, the endpoint retries up to 3 times. Verify by checking the retry logic in code review.

### Test 3: Accept Code -- Happy Path

```bash
# Student 2 accepts student 1's code
curl -s -X POST "$BASE/api/student/2/friends/accept-code" \
  -H "Content-Type: application/json" \
  -d '{"code":"JYCC-XXXX-XXXX"}' | jq .
```

- Verify: returns `{ success: true, data: { friendId, friendNickname } }`
- Verify: friendship row created with `student_id_1 = MIN(1,2) = 1`, `student_id_2 = MAX(1,2) = 2`, `status = 'accepted'`
- Verify: `use_count` on the invite code incremented by 1

### Test 4: Accept Code -- Expired Code

```bash
# Use an expired code (set expires_at in past via DB manipulation for testing)
# Should return { success: false, error: "초대 코드가 만료되었습니다" }
```

### Test 5: Accept Code -- Max Uses Reached

```bash
# Use a code where use_count >= max_uses
# Should return { success: false, error: "초대 코드 사용 횟수가 초과되었습니다" }
```

### Test 6: Accept Code -- Different Academy

```bash
# Student from a different academy tries to accept code
# Should return { success: false, error: "같은 학원 학생만 친구 추가가 가능합니다" }, 403
```

### Test 7: Self-Invite Prevention

```bash
# Student 1 tries to accept their own code
curl -s -X POST "$BASE/api/student/1/friends/accept-code" \
  -H "Content-Type: application/json" \
  -d '{"code":"JYCC-XXXX-XXXX"}' | jq .
# Should return { success: false, error: "..." }
```

### Test 8: Already Friends

```bash
# Student 2 tries to accept student 1's code again after already being friends
# Should return { success: false, error: "이미 친구입니다" }, 409
```

### Test 9: List Friends

```bash
curl -s "$BASE/api/student/1/friends" | jq .
# Should return { success: true, data: { friends: [{ friendshipId, studentId, nickname, emoji, schoolName }] } }
```

- Verify: only accepted friendships returned
- Verify: friend details (nickname, emoji) are correct

### Test 10: Unfriend (Delete Friendship)

```bash
curl -s -X DELETE "$BASE/api/student/1/friends/FRIENDSHIP_ID" | jq .
# Should return { success: true }
# Subsequent GET /friends should not include this friend
```

---

## Implementation Details

All endpoints are added to `src/index.tsx`.

### Endpoint 1: POST /api/student/:studentId/friends/invite-code

**Purpose**: Generate a friend invite code for a student.

**Logic**:
1. Extract `studentId` from route params
2. Optionally check if student already has an active, non-expired code with remaining uses -- if so, return that code instead of generating a new one (this avoids code spam)
3. Call `generateInviteCode()` (existing function)
4. Insert into `friend_invite_codes` with `max_uses = 5`, `use_count = 0`, `expires_at = datetime('now', '+9 hours', '+7 days')`, `is_active = 1`
5. On UNIQUE constraint violation (code collision), retry up to 3 times with a new code
6. Return `{ success: true, data: { code, expiresAt } }`

**Response format**:
```typescript
{ success: true, data: { code: "JYCC-ABCD-EFGH", expiresAt: "2026-03-19T..." } }
```

### Endpoint 2: POST /api/student/:studentId/friends/accept-code

**Purpose**: Accept a friend invite code, creating a friendship.

**Logic**:
1. Extract `studentId` (the accepter) from route params and `code` from request body
2. Look up the code in `friend_invite_codes` where `is_active = 1`
3. Validate the code:
   - Exists and is active
   - Not expired: `expires_at > datetime('now', '+9 hours')`
   - Not max uses: `use_count < max_uses`
4. Get the inviter's `student_id` from the code record
5. Self-invite check: if `inviter_id === accepter_id`, reject
6. Academy validation: resolve both students' `academy_name` using the join chain (students -> groups -> mentors). If academies differ, return 403
7. Normalize IDs: `id1 = Math.min(inviter, accepter)`, `id2 = Math.max(inviter, accepter)`
8. Check existing friendship: `SELECT * FROM friendships WHERE student_id_1 = ? AND student_id_2 = ?`
   - If exists with any status, return 409 "이미 친구입니다"
9. Insert friendship: `INSERT INTO friendships (student_id_1, student_id_2, status, invited_by, invite_code, accepted_at, created_at) VALUES (?, ?, 'accepted', ?, ?, datetime('now','+9 hours'), datetime('now','+9 hours'))`
10. Increment `use_count` on the invite code
11. Return friend details (nickname, etc.)

**Error responses**:
- Invalid/inactive code: `{ success: false, error: "유효하지 않은 초대 코드입니다" }`, 400
- Expired: `{ success: false, error: "초대 코드가 만료되었습니다" }`, 400
- Max uses: `{ success: false, error: "초대 코드 사용 횟수가 초과되었습니다" }`, 400
- Self-invite: `{ success: false, error: "자신의 초대 코드는 사용할 수 없습니다" }`, 400
- Different academy: `{ success: false, error: "같은 학원 학생만 친구 추가가 가능합니다" }`, 403
- Already friends: `{ success: false, error: "이미 친구입니다" }`, 409

### Endpoint 3: GET /api/student/:studentId/friends

**Purpose**: List all accepted friends for a student.

**Logic**:
1. Query friendships where the student appears on either side and status is 'accepted':
   ```sql
   SELECT f.id as friendshipId,
          CASE WHEN f.student_id_1 = ? THEN f.student_id_2 ELSE f.student_id_1 END as friendStudentId
   FROM friendships f
   WHERE (f.student_id_1 = ? OR f.student_id_2 = ?) AND f.status = 'accepted'
   ```
2. For each friendship, join with the `students` table to get the friend's details (nickname, emoji, school_name)
3. This can be done in a single query with a CASE expression and JOIN, or with a subquery

**Response format**:
```typescript
{
  success: true,
  data: {
    friends: [{
      friendshipId: 1,
      studentId: 2,
      nickname: "물리왕123",
      emoji: "🐱",
      schoolName: "부천고"
    }]
  }
}
```

### Endpoint 4: DELETE /api/student/:studentId/friends/:friendshipId

**Purpose**: Remove a friendship (hard delete).

**Logic**:
1. Verify the friendship exists and the requesting student is one of the two parties:
   ```sql
   SELECT * FROM friendships WHERE id = ? AND (student_id_1 = ? OR student_id_2 = ?)
   ```
2. If not found or student is not a party, return 404
3. Hard delete: `DELETE FROM friendships WHERE id = ?`
4. Return success

**Response format**:
```typescript
{ success: true, data: { message: "친구가 삭제되었습니다" } }
```

---

## Helper: Academy Resolution

Create a reusable helper function near the top of `src/index.tsx` (alongside existing helpers like `generateInviteCode`):

```typescript
async function getStudentAcademy(db: D1Database, studentId: number): Promise<string | null> {
  /** Resolve a student's academy_name via group -> mentor join chain. Returns null if not found. */
}
```

This helper is used by the accept-code endpoint and will also be used by Section 07 (Nickname API) for academy-wide uniqueness checks.

---

## Database Tables Referenced

These tables are created in Section 01 (DB Migration). The friend API uses:

**friend_invite_codes**:
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `student_id` INTEGER (FK to students)
- `code` TEXT UNIQUE
- `max_uses` INTEGER DEFAULT 5
- `use_count` INTEGER DEFAULT 0
- `expires_at` DATETIME
- `is_active` INTEGER DEFAULT 1
- `created_at` DATETIME DEFAULT (datetime('now','+9 hours'))

**friendships**:
- `id` INTEGER PRIMARY KEY AUTOINCREMENT
- `student_id_1` INTEGER (always the smaller ID)
- `student_id_2` INTEGER (always the larger ID)
- `status` TEXT DEFAULT 'accepted' (values: 'pending', 'accepted', 'blocked')
- `invited_by` INTEGER (FK to students)
- `invite_code` TEXT
- `accepted_at` DATETIME
- `created_at` DATETIME DEFAULT (datetime('now','+9 hours'))
- UNIQUE constraint on `(student_id_1, student_id_2)`

---

## File Changes

| File | Changes |
|------|---------|
| `src/index.tsx` | Add `getStudentAcademy()` helper function. Add 4 new API endpoints: POST invite-code, POST accept-code, GET friends, DELETE friendship. |

---

## Implementation Checklist

1. Add `getStudentAcademy()` helper function to `src/index.tsx`
2. Add `POST /api/student/:studentId/friends/invite-code` endpoint
3. Add `POST /api/student/:studentId/friends/accept-code` endpoint with all validation steps
4. Add `GET /api/student/:studentId/friends` endpoint
5. Add `DELETE /api/student/:studentId/friends/:friendshipId` endpoint
6. Run migration (`/api/migrate?key=jycc_admin_2026`) to ensure tables exist
7. Run all manual curl tests from the Tests section above
8. Verify ID normalization is correct (MIN/MAX) in both insert and lookup paths