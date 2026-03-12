Now I have all the context needed. Here is the section content:

# Section 07: Nickname & Learning Share Settings API

## Overview

This section implements three groups of API endpoints in `src/index.tsx`:

1. **Nickname set/update** for students and mentors -- with validation (length, profanity, academy-wide uniqueness)
2. **Learning share settings** CRUD -- per-student toggle preferences for what learning data friends can see
3. **Friend learning profile** -- read-only endpoint that returns a friend's learning stats, filtered by their share settings

All three depend on the database tables and columns created in **Section 01 (DB Migration)**: the `nickname` column on `students`/`mentors`, the `learning_share_settings` table, and the `friendships` table.

## Dependencies

- **Section 01 (DB Migration)**: Must be complete. Requires:
  - `students.nickname` column (TEXT, nullable)
  - `mentors.nickname` column (TEXT, nullable)
  - `learning_share_settings` table with columns: `id`, `student_id` (unique FK), `share_class_records`, `share_question_count`, `share_teach_count`, `share_mission_status`, `share_xp_level`, `updated_at`
  - `friendships` table with columns: `id`, `student_id_1`, `student_id_2`, `status`, etc.

## Test Plan (Manual API Verification)

Tests to verify before this section is considered complete. All use curl against `http://localhost:5173`.

### Nickname Endpoints

```bash
BASE="http://localhost:5173"
STUDENT_ID=1
MENTOR_ID=1

# Test 1: Valid nickname (2-12 chars, Korean/alphanumeric) succeeds
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스터123"}' | jq .
# Expected: { success: true, data: { nickname: "테스터123" } }

# Test 2: Nickname < 2 chars fails
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"가"}' | jq .
# Expected: { success: false, error: "닉네임은 2~12자..." }

# Test 3: Nickname > 12 chars fails
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"가나다라마바사아자차카타파"}' | jq .
# Expected: { success: false, error: "닉네임은 2~12자..." }

# Test 4: Duplicate nickname in same academy fails
# (First set student 2's nickname to same value)
curl -s -X PUT "$BASE/api/student/2/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"테스터123"}' | jq .
# Expected: { success: false, error: "이미 사용 중인 닉네임입니다" }

# Test 5: Profanity-blocked nickname fails
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"바보멍청이"}' | jq .
# Expected: { success: false, error: "사용할 수 없는 닉네임입니다" }

# Test 6: Mentor nickname works the same way
curl -s -X PUT "$BASE/api/mentor/$MENTOR_ID/nickname" \
  -H "Content-Type: application/json" \
  -d '{"nickname":"멘토닉네임"}' | jq .
# Expected: { success: true, data: { nickname: "멘토닉네임" } }
```

### Share Settings Endpoints

```bash
# Test 7: GET creates default row (all 0) if none exists
curl -s "$BASE/api/student/$STUDENT_ID/share-settings" | jq .
# Expected: { success: true, data: { share_class_records: 0, share_question_count: 0, ... } }

# Test 8: PUT updates correctly
curl -s -X PUT "$BASE/api/student/$STUDENT_ID/share-settings" \
  -H "Content-Type: application/json" \
  -d '{"share_class_records":1,"share_question_count":1,"share_teach_count":0,"share_mission_status":0,"share_xp_level":1}' | jq .
# Expected: { success: true, data: { ... } }

# Test 9: GET after update reflects new values
curl -s "$BASE/api/student/$STUDENT_ID/share-settings" | jq .
# Expected: share_class_records=1, share_question_count=1, share_xp_level=1
```

### Learning Profile Endpoint

```bash
# Test 10: Non-friend gets 403
curl -s "$BASE/api/student/3/learning-profile?viewer_id=99" | jq .
# Expected: { success: false, error: "친구만 프로필을 볼 수 있습니다" }

# Test 11: Friend gets only enabled fields
# (Requires friendship between viewer and target from Section 06)
curl -s "$BASE/api/student/$STUDENT_ID/learning-profile?viewer_id=2" | jq .
# Expected: Only fields where share_settings = 1 are included in response
```

### Validation Checks to Build Into Code

- Nickname regex: `/^[가-힣a-zA-Z0-9\s]{2,12}$/` -- Korean, alphanumeric, spaces, 2-12 chars
- Profanity blocklist: a basic array of blocked words checked via `some(word => nickname.includes(word))`
- Academy uniqueness: query all students and mentors in same academy, check no matching nickname
- Share settings values must be 0 or 1 (integer booleans)

## Implementation Details

All code goes in `/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx`.

### 1. Profanity Blocklist Constant

Define a constant array near the top of the file (after existing helper functions around line ~1080):

```typescript
const NICKNAME_BLOCKLIST = ['바보', '멍청', '시발', '씨발', '병신', '개새', '죽어', '지랄', '닥쳐', 'fuck', 'shit', 'damn'];
```

This is a minimal list. The `validateNickname` helper checks if the nickname contains any of these substrings.

### 2. Nickname Validation Helper

Define a helper function:

```typescript
function validateNickname(nickname: string): { valid: boolean; error?: string }
```

Logic:
- Trim the input
- Check length is 2-12 characters. Error: `"닉네임은 2~12자여야 합니다"`
- Check regex `/^[가-힣a-zA-Z0-9\s]+$/` for allowed characters. Error: `"닉네임에 한글, 영문, 숫자, 공백만 사용 가능합니다"`
- Check against `NICKNAME_BLOCKLIST` using `some(word => nickname.toLowerCase().includes(word))`. Error: `"사용할 수 없는 닉네임입니다"`
- Return `{ valid: true }` if all pass

### 3. Academy Resolution Helper

The academy for a student is resolved via the join chain: `students.group_id -> groups.mentor_id -> mentors.academy_name`. This pattern is used in multiple places within this section. Define a reusable helper:

```typescript
async function getStudentAcademy(db: D1Database, studentId: number): Promise<string | null>
```

Query:
```sql
SELECT m.academy_name
FROM students s
JOIN groups g ON s.group_id = g.id
JOIN mentors m ON g.mentor_id = m.id
WHERE s.id = ?
```

Returns `academy_name` or `null` if student not found / not in a group.

### 4. PUT /api/student/:studentId/nickname

Endpoint signature: `app.put('/api/student/:studentId/nickname', async (c) => { ... })`

Steps:
1. Parse `studentId` from params, `nickname` from JSON body
2. Call `validateNickname(nickname)` -- return 400 on failure
3. Call `getStudentAcademy(db, studentId)` to get the student's academy
4. Academy uniqueness check -- query all students AND mentors in the same academy with matching nickname (excluding current student):
   ```sql
   SELECT id FROM students
   WHERE nickname = ? AND id != ?
   AND group_id IN (
     SELECT g.id FROM groups g
     JOIN mentors m ON g.mentor_id = m.id
     WHERE m.academy_name = ?
   )
   UNION
   SELECT id FROM mentors
   WHERE nickname = ? AND academy_name = ?
   ```
   If any row returned, return 409: `"이미 사용 중인 닉네임입니다"`
5. Update: `UPDATE students SET nickname = ? WHERE id = ?`
6. Return `{ success: true, data: { nickname } }`

### 5. PUT /api/mentor/:mentorId/nickname

Endpoint signature: `app.put('/api/mentor/:mentorId/nickname', async (c) => { ... })`

Same pattern as student nickname but simpler academy resolution (mentors have `academy_name` directly). Steps:
1. Parse `mentorId`, `nickname` from body
2. Validate nickname
3. Get mentor's `academy_name` directly: `SELECT academy_name FROM mentors WHERE id = ?`
4. Uniqueness check (same UNION query pattern but excluding current mentor from mentor table)
5. Update: `UPDATE mentors SET nickname = ? WHERE id = ?`
6. Return `{ success: true, data: { nickname } }`

### 6. GET /api/student/:studentId/share-settings

Endpoint signature: `app.get('/api/student/:studentId/share-settings', async (c) => { ... })`

Steps:
1. Parse `studentId`
2. Query: `SELECT * FROM learning_share_settings WHERE student_id = ?`
3. If no row exists, INSERT default row (all 0):
   ```sql
   INSERT INTO learning_share_settings (student_id, share_class_records, share_question_count, share_teach_count, share_mission_status, share_xp_level, updated_at)
   VALUES (?, 0, 0, 0, 0, 0, datetime('now','+9 hours'))
   ```
   Then re-query to return the inserted row.
4. Return `{ success: true, data: { share_class_records, share_question_count, share_teach_count, share_mission_status, share_xp_level } }`

### 7. PUT /api/student/:studentId/share-settings

Endpoint signature: `app.put('/api/student/:studentId/share-settings', async (c) => { ... })`

Steps:
1. Parse `studentId` and settings fields from JSON body
2. Validate each field is 0 or 1
3. Upsert using `INSERT OR REPLACE`:
   ```sql
   INSERT OR REPLACE INTO learning_share_settings
   (student_id, share_class_records, share_question_count, share_teach_count, share_mission_status, share_xp_level, updated_at)
   VALUES (?, ?, ?, ?, ?, ?, datetime('now','+9 hours'))
   ```
   Note: For `INSERT OR REPLACE` to work properly, `student_id` must have a UNIQUE constraint (defined in Section 01 migration).
4. Return `{ success: true, data: { ...settings } }`

### 8. GET /api/student/:studentId/learning-profile

Endpoint signature: `app.get('/api/student/:studentId/learning-profile', async (c) => { ... })`

Query param: `viewer_id` -- the student requesting the profile.

Steps:
1. Parse `studentId` (target) and `viewer_id` from query params
2. **Friendship check**: Normalize IDs and query friendships table:
   ```sql
   SELECT id FROM friendships
   WHERE student_id_1 = ? AND student_id_2 = ? AND status = 'accepted'
   ```
   Where `student_id_1 = MIN(studentId, viewerId)` and `student_id_2 = MAX(studentId, viewerId)`.
   If no row, return 403: `"친구만 프로필을 볼 수 있습니다"`
3. **Get share settings**: Query `learning_share_settings WHERE student_id = ?`. If no row, all sharing is off -- return empty profile.
4. **Build profile** based on enabled settings. For each enabled field, run the appropriate aggregate query:
   - `share_class_records = 1`: `SELECT COUNT(*) as class_record_count FROM class_records WHERE student_id = ?`
   - `share_question_count = 1`: `SELECT COUNT(*) as question_count FROM question_records WHERE student_id = ?`
   - `share_teach_count = 1`: `SELECT COUNT(*) as teach_count FROM teach_records WHERE student_id = ?`
   - `share_mission_status = 1`: `SELECT COUNT(*) as assignment_count FROM assignments WHERE student_id = ? AND status = 'completed'`
   - `share_xp_level = 1`: `SELECT xp, level FROM students WHERE id = ?`
5. Also include basic public info: nickname, profile_emoji, school_name, grade
6. Return `{ success: true, data: { nickname, profileEmoji, schoolName, grade, ...enabledFields } }`

Only fields where the corresponding `share_*` setting is 1 are included in the response. Disabled fields are simply omitted (not set to null or 0).

## Response Format

All endpoints follow the existing project convention:

```typescript
// Success
return c.json({ success: true, data: { ... } });

// Failure
return c.json({ success: false, error: "한국어 에러 메시지" }, 400);  // or 403, 409
```

## Error Codes

| Scenario | HTTP Status | Error Message |
|----------|-------------|---------------|
| Nickname too short/long | 400 | `"닉네임은 2~12자여야 합니다"` |
| Nickname invalid chars | 400 | `"닉네임에 한글, 영문, 숫자, 공백만 사용 가능합니다"` |
| Nickname profanity | 400 | `"사용할 수 없는 닉네임입니다"` |
| Nickname duplicate in academy | 409 | `"이미 사용 중인 닉네임입니다"` |
| Student not found / no group | 404 | `"학생 정보를 찾을 수 없습니다"` |
| Mentor not found | 404 | `"멘토 정보를 찾을 수 없습니다"` |
| Not friends (learning profile) | 403 | `"친구만 프로필을 볼 수 있습니다"` |
| Invalid share setting value | 400 | `"설정 값은 0 또는 1이어야 합니다"` |

## Files to Modify

| File | Change |
|------|--------|
| `/Users/jungyoulkwak/jungyoul-planapp/src/index.tsx` | Add `NICKNAME_BLOCKLIST` constant, `validateNickname()` helper, `getStudentAcademy()` helper, and 5 new API endpoints |

## Downstream Dependents

- **Section 09 (Frontend Navigation)**: Uses nickname endpoints for the first-time nickname setup flow
- **Section 12 (Frontend Friends & Settings)**: Uses share-settings and learning-profile endpoints for the friends feature UI