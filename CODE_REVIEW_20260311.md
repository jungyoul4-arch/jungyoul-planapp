# 코드 리뷰 보고서 — 고교학점플래너
**날짜**: 2026-03-11
**대상 파일**: `public/static/app.js` (15,202줄), `src/index.tsx` (백엔드 API + DB)

---

## 종합 평점

| 영역 | app.js (프론트) | index.tsx (백엔드) |
|------|:-:|:-:|
| **보안** | 🔴 2.5/5 | 🔴 2/5 |
| **성능** | 🔴 2/5 | 🟡 3/5 |
| **정확성** | 🟡 3/5 | 🟡 3/5 |
| **유지보수** | 🟡 2.5/5 | 🟡 3/5 |

---

## 🔴 반드시 수정해야 할 Critical 이슈

### 1. 학생 데이터 API 인증 없음 (index.tsx, 42개+ 엔드포인트)
**위치**: Lines 1654~2598

모든 `/api/student/:studentId/*` 엔드포인트가 URL의 `studentId`를 그대로 사용하며, 요청자가 해당 학생 본인인지 검증하지 않습니다. 아무나 다른 학생의 시험, 수업기록, 과제 등 모든 데이터를 열람할 수 있습니다.

```
GET /api/student/1/exams       ← 학생1 시험 데이터
GET /api/student/999/exams     ← 학생999 데이터도 접근 가능!
```

**수정 방안**: 미들웨어에서 세션/토큰으로 요청자 검증 추가

---

### 2. SQL Injection — seed-test-data 엔드포인트 (index.tsx, Line 3423~3551)
**위치**: `/api/seed-test-data`

`studentIds.join(',')` 로 IN 절을 직접 구성하여 SQL Injection 취약점 존재:

```typescript
// 취약 코드
await DB.prepare('DELETE FROM activity_logs WHERE student_id IN ('+studentIds.join(',')+')').run();

// 수정 방법
const placeholders = studentIds.map(() => '?').join(',');
await DB.prepare(`DELETE FROM ... IN (${placeholders})`).bind(...studentIds).run();
```

---

### 3. 크로켓 포인트 API 인증 없음 (index.tsx, Line 4102~4124)
`/api/mentor/croquet-points/give` 엔드포인트에서 `mentorId`를 요청 본문에서 받지만 실제 해당 멘토인지 검증하지 않아 아무나 포인트를 부여할 수 있습니다.

---

### 4. XSS 취약점 — innerHTML + 인라인 onclick (app.js, 다수)
**위치**: Lines 7434, 7439, 9346, 13177, 13241~13252 등

사용자/API 데이터를 `innerHTML` 템플릿에 직접 삽입하고, `onclick` 속성에 변수를 이스케이프 없이 넣는 패턴이 반복됩니다:

```javascript
// 취약 예시
onclick="deleteClassmate('${c.id}','${c.name}')"  // c.name에 ' 포함 시 XSS
titleEl.innerHTML = '..${date}...'                  // date에 HTML 포함 가능
```

**수정 방안**: `data-*` 속성 + 이벤트 위임으로 전환, 모든 사용자 데이터에 `escapeHtml()` 적용

---

### 5. 이벤트 리스너 메모리 누수 (app.js, Line 466~486)
`renderScreen()` 호출 시마다 사이드바 버튼에 새 이벤트 리스너가 추가되지만 이전 리스너가 제거되지 않습니다. 10번 렌더 후 클릭 한 번에 10개 핸들러가 실행됩니다.

**수정 방안**: 이벤트 위임 패턴 적용 또는 리렌더 전 리스너 제거

---

## 🟡 수정 권장 Warning 이슈

### 6. 약한 비밀번호 해싱 (index.tsx, Line 968~974)
SHA-256 + 고정 솔트(`_credit_planner_salt_2026`) 사용. 사용자별 솔트가 없어 Rainbow Table 공격에 취약합니다.

**수정 방안**: `bcryptjs` 사용으로 전환

### 7. 하드코딩된 관리자 키 (index.tsx, Lines 3030, 3045, 3359)
```typescript
const validKey = c.env.ADMIN_KEY || 'jycc_admin_2026'  // 환경변수 미설정 시 기본키 노출
```
**수정 방안**: 폴백값 제거, 환경변수 필수화

### 8. 무제한 쿼리 (index.tsx, Lines 2625~2638)
`LIMIT 200` 등 높은 한도의 쿼리가 페이지네이션 없이 사용되어, 데이터가 쌓이면 응답 크기와 처리시간이 급격히 증가합니다.

### 9. Race Condition — 크로켓 잔액 업데이트 (index.tsx, Line 4111)
두 요청이 동시에 도달하면 잔액이 정확히 반영되지 않을 수 있습니다.

**수정 방안**: `UPDATE ... RETURNING` 절 활용

### 10. N+1 서브쿼리 (index.tsx, Line 2636)
my_questions 조회 시 각 행마다 answer_count 서브쿼리 실행. `LEFT JOIN + GROUP BY`로 개선 가능합니다.

### 11. 비효율적 데이터 필터링 (app.js, Lines 1743~1754)
`refreshDataWidgets()`에서 7일 × `records.filter()` 반복 호출. 날짜별 사전 그룹핑으로 O(n)→O(1) 개선 가능합니다.

### 12. 자동 동기화 N+1 API 호출 (app.js, Lines 2655~2661)
45초마다 5개 개별 API 엔드포인트 호출. 100명 동시접속 시 500 API 호출/45초.

**수정 방안**: 배치 API 엔드포인트 구현

### 13. KST 타임존 처리 취약 (app.js, Lines 28~31)
```javascript
const kstNow = () => new Date(Date.now() + 9 * 3600000)  // Date 객체의 timezone 메타데이터 불일치
```
`toISOString()` 호출 시 여전히 UTC 반환. 현재 `slice(0,10)` 우회로 작동하지만 취약합니다.

---

## 🟢 긍정적 패턴

| 항목 | 설명 |
|------|------|
| ✅ 파라미터 바인딩 | 대부분의 D1 쿼리에서 `?` 플레이스홀더 정상 사용 |
| ✅ D1 SQLite 문법 준수 | `AUTOINCREMENT`, `datetime('now')` 등 올바른 문법 |
| ✅ 배치 처리 | 대량 INSERT시 50건 단위 청킹 패턴 적용 |
| ✅ 테이블 화이트리스트 | admin export에서 허용 테이블명 검증 |
| ✅ escapeHtml() 존재 | XSS 방지 헬퍼 함수 정의 (일부 사용 중) |
| ✅ RequestAnimationFrame | `renderScreen()`에서 RAF로 렌더 배칭 |
| ✅ 로그아웃 시 타이머 정리 | `stopAutoSync()`, `clearInterval()` 호출 |
| ✅ Try/Catch 에러 핸들링 | 대부분의 API 엔드포인트에 적용 |

---

## 🎯 수정 우선순위 (Top 5)

| 순위 | 이슈 | 예상 소요 | 영향도 |
|:---:|------|:---:|:---:|
| 1 | 학생 API 인증 미들웨어 추가 | 4~6시간 | 전체 데이터 보안 |
| 2 | SQL Injection 수정 (seed 엔드포인트) | 1시간 | DB 보안 |
| 3 | innerHTML XSS + onclick 이벤트 위임 전환 | 4~6시간 | XSS 방지 + 메모리 누수 해결 |
| 4 | 비밀번호 해싱 강화 (bcrypt) | 2시간 | 사용자 인증 보안 |
| 5 | 하드코딩 관리자 키 제거 | 30분 | 관리자 접근 보안 |

---

*이 리뷰는 코드 정적 분석 기반이며, 런타임 동작 테스트는 포함되지 않았습니다.*
