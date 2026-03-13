# Claude Code 지시문 — PDF에 세특 질문 + 퀴즈 누락 수정

CLAUDE.md를 먼저 읽어줘.

## 문제

`나의 수업 탐구 기록` PDF에 선생님 강조 포인트, 키워드, 과제만 나오고 **세특 소재 질문**과 **예상 퀴즈(시험 문제)**가 빠져 있음.

## 근본 원인

파일: `public/modules/records/components/pdf-generator.js`의 `generateCreditLogPDF()` 함수

PDF가 **구형식 필드명**을 참조하고 있는데, 현재 AI는 **신형식**으로 데이터를 생성함:

| PDF가 읽는 필드 (구형식) | AI가 생성하는 필드 (신형식) | 내용 |
|---|---|---|
| `questions` (original/improved) | `seteuk_questions` (q/reason/guide) | 세특 소재 질문 |
| `exam_connection` (문자열 배열) | `quiz` (question/answer/explanation) | 예상 시험 문제/퀴즈 |

## 수정 방법

### 1. 세특 소재 질문 섹션 (line 326~337)

현재 코드:
```js
${questions.length > 0 ? `
<section class="sec">
  <div class="sec-label">세특 소재 질문</div>
  ${questions.slice(0, 3).map(q => `
  <div class="q-block">
    <div class="q-my">${_esc(q.original || '')}</div>
    <div class="q-up">
      <span class="q-up-label">선생님께 이렇게</span>
      ${_esc(q.improved || '')}
    </div>
  </div>`).join('')}
</section>` : ''}
```

수정: **신형식 `seteuk_questions` 우선 사용 + 구형식 폴백**

함수 상단에서 변수 추가 (line 10 근처):
```js
const seteukQs = creditLog.seteuk_questions || [];
const quiz = creditLog.quiz || [];
```

세특 질문 섹션을 다음으로 교체:
```js
${(seteukQs.length > 0 || questions.length > 0) ? `
<section class="sec">
  <div class="sec-label">세특 소재 질문</div>
  ${seteukQs.length > 0
    ? seteukQs.map((q, i) => `
    <div class="q-block">
      <div class="q-my">${_esc(q.q || '')}</div>
      ${q.reason ? `<div style="font-size:22px;color:var(--mid);margin:8px 0 8px 24px;line-height:1.7"><strong style="color:var(--gold)">왜?</strong> ${_esc(q.reason)}</div>` : ''}
      ${q.guide ? `<div class="q-up"><span class="q-up-label">탐구 방향</span>${_esc(q.guide)}</div>` : ''}
    </div>`).join('')
    : questions.map(q => `
    <div class="q-block">
      <div class="q-my">${_esc(q.original || '')}</div>
      <div class="q-up">
        <span class="q-up-label">선생님께 이렇게</span>
        ${_esc(q.improved || '')}
      </div>
    </div>`).join('')}
</section>` : ''}
```

### 2. 예상 퀴즈 섹션 추가 (메타인지 자극 질문 섹션 앞에 삽입)

`activeRecall` 섹션 **바로 앞**에 퀴즈 섹션 추가:
```js
${quiz.length > 0 ? `
<section class="sec">
  <div class="sec-label">예상 퀴즈</div>
  <ul class="exam-list">
    ${quiz.map((q, i) => `
    <li>
      <span class="exam-n">${String(i + 1).padStart(2, '0')}</span>
      <div class="exam-txt">
        <div style="font-weight:500;color:var(--ink)">${_esc(q.question || '')}</div>
        ${q.answer ? `<div style="margin-top:10px;font-size:22px"><strong style="color:var(--teal)">정답:</strong> ${_esc(q.answer)}</div>` : ''}
        ${q.explanation ? `<div style="margin-top:6px;font-size:22px;color:var(--faint)">${_esc(q.explanation)}</div>` : ''}
      </div>
    </li>`).join('')}
  </ul>
</section>` : ''}
```

## 기존 exam_connection 섹션은 유지

구형식 `exam_connection`은 폴백으로 그대로 두되, 신형식 `quiz`가 있으면 `quiz`를 우선 표시.

## 확인 방법

1. `npm run dev` 실행
2. http://localhost:5173/?user_id=68251&device_mode=3 접속
3. 아카이브 → 나의 수업 다시보기 → 영어 → PDF로 저장 클릭
4. PDF에 다음 항목이 모두 포함되는지 확인:
   - ✅ 선생님 강조 포인트
   - ✅ 핵심 키워드
   - ✅ 세특 소재 질문 (질문 + 이유 + 탐구 방향)
   - ✅ 예상 퀴즈 (문제 + 정답 + 해설)
   - ✅ 메타인지 자극 질문
   - ✅ 과제
   - ✅ 수업 맥락 요약
   - ✅ 세특 관찰 코멘트
5. 확인 후 `npm run deploy` 배포

## 주의사항
- 기존 디자인 스타일(serif, mono 폰트, accent 색상 등) 유지
- `_esc()` 함수로 XSS 방지 필수
- 구형식 데이터도 여전히 호환되어야 함
