# Integration Notes: Opus Review Feedback

## Integrating (11 items)

### 1. Community Tab Already Exists → INTEGRATE
기존 `renderCommunityTab()`이 외부 URL로 리다이렉트하는 스텁이 있음. 이를 교체하는 것으로 계획 수정.

### 2. Photo Storage: R2 사용 → INTEGRATE
base64 대신 R2 스토리지 사용. CLAUDE.md 교훈 반영. `r2:KEY` 참조 패턴으로 변경.

### 4. XSS: DOMPurify 추가 → INTEGRATE
contenteditable HTML 저장 시 DOMPurify CDN 사용하여 sanitize.

### 5. DB.batch() for Counters → INTEGRATE
모든 카운터 업데이트(좋아요, 댓글)에 DB.batch() 명시.

### 6. Friendship Query Pattern → INTEGRATE
양방향 조회 패턴 명시. min/max ID 정규화 로직 문서화.

### 7. Academy Name Resolution → INTEGRATE
students → groups → mentors → academy_name 조인 체인 문서화.

### 9. Notification Badge → INTEGRATE
소통 탭에 읽지 않은 알림 배지 추가. 댓글/좋아요 알림 테이블 추가.

### 10. Comment Pagination → INTEGRATE
댓글 페이지네이션 추가 (20개씩 로드).

### 11. Invite Code Collision Retry → INTEGRATE
코드 생성 시 unique 위반 → 최대 3회 재시도 로직.

### 13. Content Length Limits → INTEGRATE
제목 100자, 본문 10,000자, 댓글 1,000자 서버+클라이언트 검증.

### 14. Board Auto-Seeding Lifecycle → INTEGRATE
그룹 생성/삭제 시 게시판 자동 생성/비활성화. 마이그레이션 멱등성.

### 15. Minor Issues → INTEGRATE
- updated_at 명시적 SET
- DELETE 요청 body 사용
- 용어 수정: offset-based pagination
- KST 일관성

## Not Integrating (4 items)

### 3. Authentication → NOT INTEGRATING
기존 시스템 전체가 토큰 검증 미들웨어 없이 동작 중. 커뮤니티 기능만 별도 인증 체계를 도입하면 불일치 발생. 전체 앱 보안 강화는 별도 프로젝트로 분리. 계획에는 "기존 인증 방식을 따르며, 전체 앱 보안 강화는 별도 과제"로 명시.

### 8. Modular Architecture → NOT INTEGRATING
Records 모듈 패턴이 대안이지만, 사용자가 "기존 탭에 추가"를 명시적으로 선택함. app.js에 직접 추가하는 것이 사용자의 결정. 다만, 향후 분리 가능성은 언급.

### 12. Soft Delete Inconsistency → NOT INTEGRATING
친구 삭제는 하드 딜리트가 적절. 'blocked' 상태는 별도 로직으로 처리 (삭제와 차단은 다른 동작). 차단 시 새 row INSERT with status='blocked'.

### 15-c. Cursor-based vs offset → PARTIALLY INTEGRATE
용어만 수정 (offset-based로). 150명 규모에서 cursor-based는 과도함.
