# PHP API 수정 가이드 (jysk-api.php)

## 변경사항: ClassMember.kind 칼럼 활용, 학생수 기준 15명 이상

### 1. get_relay_classes 액션 수정

**변경 전 (추정):**
```sql
SELECT c.class_id, c.class_name, c.genre_id,
       COUNT(cm.user_id) AS member_count
FROM ClassMember cm
JOIN Class c ON c.class_id = cm.class_id
WHERE cm.active_flag = 1
  AND c.genre_id = 3
  AND c.is_active = 1
  AND cm.class_id IN (
    SELECT class_id FROM ClassMember
    WHERE user_id = :user_id AND active_flag = 1
  )
GROUP BY c.class_id
HAVING member_count >= 16
```

**변경 후:**
```sql
SELECT c.class_id, c.class_name, c.genre_id,
       COUNT(cm.user_id) AS member_count
FROM ClassMember cm
JOIN Class c ON c.class_id = cm.class_id
WHERE cm.active_flag = 1
  AND cm.kind = 2          -- ★ 학생(kind=2)만 카운트
  AND c.genre_id = 3
  AND c.is_active = 1
  AND cm.class_id IN (
    SELECT class_id FROM ClassMember
    WHERE user_id = :user_id AND active_flag = 1
  )
GROUP BY c.class_id
HAVING member_count >= 15   -- ★ 16 → 15로 변경
```

**핵심 변경:**
- `cm.kind = 2` 조건 추가 (학생만 카운트, 멘토 제외)
- `HAVING member_count >= 15` (16 → 15)

### 2. get_relay_class_students 액션 수정

**변경 전 (추정):**
```sql
SELECT u.user_id, u.name
FROM ClassMember cm
JOIN User u ON u.user_id = cm.user_id
WHERE cm.class_id = :class_id
  AND cm.active_flag = 1
  AND u.active_flag = 1
```

**변경 후:**
```sql
SELECT u.user_id, u.name
FROM ClassMember cm
JOIN User u ON u.user_id = cm.user_id
WHERE cm.class_id = :class_id
  AND cm.active_flag = 1
  AND cm.kind = 2          -- ★ 학생(kind=2)만 반환
  AND u.active_flag = 1
```

**핵심 변경:**
- `cm.kind = 2` 조건 추가 (학생만 반환, 멘토 제외)
