# Research Findings: 플랜앱 교학상장 소통창구

---

## Part 1: Codebase Research

### 1. 인증 시스템

**3-tier 인증 구조:**
- Student: `POST /api/auth/student/login` — 이름 + SHA-256 해시 비밀번호
- Mentor: `POST /api/auth/mentor/login` — login_id 기반
- Director: `POST /api/auth/director/login` — mentor에 is_director 플래그
- External: `GET /api/auth/external-login` — jungyoul.com 원격 DB 프록시

**세션 관리:**
- 토큰: 64-char hex (`crypto.getRandomValues()`)
- 프론트엔드: `state._authUser`, `state._authToken`, `state._authRole`로 저장
- 별도 JWT 검증 미들웨어 없음 (보안 개선 필요)

**기존 초대 코드 패턴 (재사용 가능):**
- `generateInviteCode()` → `JYCC-XXXX-XXXX` 형식
- 안전 문자셋: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (I/O/0/1 제외)
- `GET /api/auth/verify-invite/:code` → 그룹 메타데이터 반환

### 2. DB 스키마 & 관계

**현재 21개 테이블.** 핵심 관계:
- `mentors` → `groups` (1:N)
- `groups` → `students` (1:N, invite_code로 가입)
- `students` → 6종 학습 기록 (class/question/teach/activity/report records)

**소셜 기능 관련 기존 테이블:**
- `teach_records`: 교학상장 기록. `taught_to`가 VARCHAR 문자열 (FK 아님!)
- `mentor_feedbacks`: 멘토→학생 1방향 피드백. is_read 플래그로 읽음 추적
- `my_questions` + `my_answers`: 질문-답변 체인 (parent_id 자기참조)
- `xp_history`: XP 이력 추적 (`recordXp()` 함수 활용)

### 3. API 패턴

**응답 형식 (통일):**
```typescript
{ success: true, data: { ... } }  // 성공
{ success: false, error: "msg" }  // 실패 (400/500)
```

**엔드포인트 패턴:**
```
/api/student/:studentId/[resource]  — GET/POST/PUT/DELETE
/api/mentor/:mentorId/[resource]    — 멘토 전용
/api/admin/...                      — 관리자
```

**D1 쿼리 패턴:**
```typescript
c.env.DB.prepare('...').bind(params).first()   // 단일 행
c.env.DB.prepare('...').bind(params).all()     // 복수 행
c.env.DB.batch([stmt1, stmt2])                 // 배치
```

### 4. 프론트엔드 아키텍처

**Vanilla JS SPA** (`app.js` 15,506줄):
- 글로벌 Proxy 기반 state 관리
- `goScreen(name)` → `renderScreen()` → innerHTML 교체
- `DB` 객체: API 호출 래퍼 (fetch + state 업데이트)

**모듈 임베드 패턴** (Records 모듈 참고):
- ES Module 기반 독립 SPA
- `_RM` 네임스페이스로 격리
- `ArchiveModule.init({ studentId, timetable, preloadedData })` 방식 초기화
- `core/state.js`, `core/api.js`, `core/router.js`, `views/*.js` 구조

### 5. 기존 소셜/공유 기능

**Teach Records (교학상장):**
- `POST /api/student/:id/teach-records` → subject, topic, taughtTo, content, reflection
- XP 자동 지급 (30점)
- `taught_to`가 문자열 — 앱 외부 사람에게도 기록 가능

**Mentor Feedbacks:**
- `POST /api/mentor/feedback` → mentorId, studentId, content, feedbackType
- `GET /api/student/:id/feedbacks` → unreadCount 포함
- 읽음 처리: `PUT /api/student/feedback/:id/read`

### 6. 테스팅 & 개발 환경

- Jest/Vitest 등 테스트 프레임워크 **없음**
- 수동 테스트: `GET /api/seed-test-data`, `GET /api/seed-single-student`
- 모듈 테스트: `/modules/records/dev.html`
- 배포: `npm run deploy` (= vite build + wrangler pages deploy)

### 7. 실시간/알림

- Service Worker: 정적 자산 캐싱 (PWA)
- WebSocket/Durable Objects: **미사용**
- 현재 패턴: 폴링 기반 (앱 초기화 시 데이터 로드)

---

## Part 2: Web Research

### Topic 1: Cloudflare Workers 실시간 채팅

**권장: Durable Objects + WebSocket Hibernation API**

| 접근방식 | 장점 | 단점 | 판정 |
|---------|------|------|------|
| Durable Objects + WebSocket | 실시간, 저지연, 내장 영속성, 하이버네이션으로 비용 절감 | DO 추가 비용 ($0.15/M requests) | **최적** |
| D1 폴링 | 단순, DO 불필요 | 단일 스레드 병목, 높은 지연, 낭비적 쿼리 | 비권장 |
| SSE | WS보다 단순, 단방향 푸시 | Workers 30초 CPU 제한, 양방향 불가 | 부분적 |

**하이브리드 스토리지 전략:**
- 실시간 전달: WebSocket으로 직접 브로드캐스트 (스토리지 미경유)
- DO SQLite: 최근 100-200개 메시지 (재접속 복구용)
- D1: 장기 보관, 검색, 분석용 배치 플러시

**아키텍처:**
```
Client (WebSocket) → Hono Worker (인증 체크) → Durable Object "ChatRoom:{roomId}"
  → DO SQLite (최근 메시지)
  → D1 (장기 보관)
```

**150명 규모 비용 추정: 월 $5 미만** (하이버네이션으로 유휴 연결 무과금)

**핵심 코드 패턴:**
```typescript
// Worker
app.get('/api/chat/:roomId/ws', async (c) => {
  const id = c.env.CHAT_ROOM.idFromName(roomId);
  const room = c.env.CHAT_ROOM.get(id);
  return room.fetch(c.req.raw);
});

// Durable Object
export class ChatRoom extends DurableObject {
  async fetch(request) {
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]); // Hibernation API
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws, message) {
    // 1. DO SQLite에 저장
    // 2. 모든 연결된 클라이언트에 브로드캐스트
    for (const socket of this.ctx.getWebSockets()) {
      socket.send(payload);
    }
  }
}
```

**D1 제한사항 (채팅 맥락):**
- 최대 10GB, 단일 스레드, ~1,000 qps
- 150명 기준 피크 5msg/s → D1 아카이브용으로 충분
- 실시간 전달에는 D1 폴링 사용 금지

**출처:**
- [Cloudflare Durable Objects WebSocket Best Practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)
- [D1 Platform Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [Cloudflare Workers Chat Demo](https://github.com/cloudflare/workers-chat-demo)

### Topic 2: 초대 코드/링크 시스템

**권장: 6자리 커스텀 알파벳 코드 (nanoid)**

```javascript
const SAFE_CHARS = '23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ';
// 54^6 = ~24.8B 조합 → 1,000개 코드 기준 충돌 확률 1/24M
```

**기존 패턴과의 호환:**
- 현재 `JYCC-XXXX-XXXX` 형식 사용 중 → 그룹 초대용
- 친구 초대용: 별도 포맷 또는 동일 포맷 재활용

**코드 + 링크 병행 권장:**
- 코드: `Kx7mNp` (구두/인쇄 공유)
- URL: `https://credit-planner-v8.pages.dev/join/Kx7mNp` (디지털 공유)

**D1 스키마:**
```sql
CREATE TABLE invite_codes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'friend',  -- 'group'|'friend'|'study_group'
  created_by INTEGER NOT NULL,
  max_uses INTEGER DEFAULT 1,
  use_count INTEGER DEFAULT 0,
  expires_at TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
```

**보안:**
- 분당 5회 시도 제한 (IP 기반)
- 기본 7일 만료
- 사용 이력 로깅

**출처:**
- [Nanoid](https://github.com/ai/nanoid)
- [Referral Code Architecture](https://medium.com/@siddhusingh/referral-code-generation-architecture)

### Topic 3: 모바일 우선 채팅 UI

**핵심: 버블 기반 레이아웃 + 글래스모피즘 + 메시지 그루핑**

**TailwindCSS CDN 호환 글래스모피즘:**
```html
<!-- 받은 메시지 -->
<div class="px-4 py-2 bg-white bg-opacity-70 backdrop-blur-sm rounded-2xl rounded-bl-sm shadow-sm">

<!-- 보낸 메시지 -->
<div class="px-4 py-2 bg-indigo-500 bg-opacity-80 backdrop-blur-sm rounded-2xl rounded-br-sm shadow-sm">
```
모두 표준 Tailwind 유틸리티 — arbitrary values 불필요.

**메시지 그루핑 규칙 (Messenger 패턴):**
1. 같은 발신자의 1분 이내 연속 메시지 → 그룹화
2. 첫 메시지: 아바타 + 이름 표시
3. 중간 메시지: 아바타/이름 생략, 간격 2px
4. 마지막 메시지: 타임스탬프 표시

**스크롤 동작:**
- 하단 근처일 때만 자동 스크롤
- 위로 스크롤 중이면 "새 메시지" 배지 표시
- 무한 스크롤로 이전 메시지 로드

**모바일 키보드 처리:**
```javascript
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', () => {
    chatWrapper.style.height = `${window.visualViewport.height}px`;
  });
}
```

**타임스탬프 표시 로직:**
- 오늘: "2:34 PM"
- 어제: "어제 2:34 PM"
- 이번 주: "수 2:34 PM"
- 이전: "3월 5일 2:34 PM"

**출처:**
- [Facebook Messenger Chat Component CSS](https://ishadeed.com/article/facebook-messenger-chat-component/)
- [Flowbite TailwindCSS Chat Bubble](https://flowbite.com/docs/components/chat-bubble/)
- [Glassmorphism with TailwindCSS](https://flyonui.com/blog/glassmorphism-with-tailwind-css/)

---

## 통합 권장사항

| 구성요소 | 권장 | 근거 |
|---------|------|------|
| 실시간 전송 | Durable Objects + WebSocket Hibernation | 공식 패턴, 150명 충분, 월 $5 미만 |
| 메시지 저장 | DO SQLite (핫) + D1 (아카이브) | 하이브리드 성능/비용 최적 |
| 초대 코드 | 기존 `generateInviteCode()` 재활용 | 이미 검증된 패턴 |
| 채팅 UI | Vanilla JS 모듈 (Records 패턴 따라) | 기존 아키텍처 일관성 |
| 스타일 | TailwindCSS CDN + glassmorphism | 기존 디자인 시스템 유지 |
| wrangler.jsonc | `durable_objects.bindings` 추가 | ChatRoom DO 클래스 바인딩 |
| 보안 | 토큰 검증 미들웨어 추가 필요 | 현재 인증 검증 부재 |
