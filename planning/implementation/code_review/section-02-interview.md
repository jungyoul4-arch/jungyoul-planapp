# Section 02 Code Review Interview

## Auto-fixes Applied
1. **Added boardId NaN validation** — Return 400 for invalid board IDs before DB queries
2. **Added is_active filter** — Academy board auth check now includes `s.is_active = 1` (consistent with group board check)

## Let Go (Not Fixed)
- Query-param auth — existing pattern throughout the app, not a section-02 concern
- Empty academy_name matching — returns no boards (correct behavior)
- Mentor nickname fallback '멘토' vs '익명' — better UX
- Error message leak — consistent with codebase pattern
- nickname column dependency — migration is prerequisite per dependency graph
