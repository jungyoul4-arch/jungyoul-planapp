# 수업탐구기록 스킬 — Claude Code 전달 문서

> **정율사관학원 "나의 수업 탐구 기록 (MY CREDIT LOG)"**  
> PDF → HTML 자동 변환 스킬의 사양과 규칙을 정의합니다.  
> 이 문서를 `CLAUDE.md` 또는 세션 시작 시 컨텍스트로 전달하세요.

---

## 1. 스킬 개요

| 항목 | 내용 |
|------|------|
| **스킬명** | `수업탐구기록` |
| **트리거** | 수업 PDF 또는 텍스트가 주어지고 "수업 탐구 기록", "MY CREDIT LOG", "탐구 기록 HTML" 등의 요청이 들어올 때 |
| **출력** | 단일 `.html` 파일 |
| **파일명 규칙** | `나의_수업탐구기록_{{ 교과목 }}_{{ 날짜 }}.html` |

---

## 2. 절대 원칙 (수정 금지)

아래 규칙은 **어떤 상황에서도 변경하지 않는다.**

- `html { zoom: 0.72; }` — 전체 비율 고정값, 수치 변경 금지
- `font-size: 28px` (body 기준) — 수치 변경 금지
- **박스 없음**: 배경색 카드, `border-radius` 카드, `box-shadow` 일절 금지
- **단일 컬럼**: `.page { display: block; }` — grid/flex 다단 레이아웃 금지
- **시스템 폰트 계층**: `-apple-system → Apple SD Gothic Neo → Malgun Gothic`
- **섹션 순서 고정**: 맥락 → 시험포인트 → 강조포인트 → 논리분석 → 질문 → 메타인지 → 키워드 → 세특 → 과제

---

## 3. CSS 전체 (그대로 `<style>` 태그에 삽입)

```css
:root {
  --ink:    #1c1c1e;
  --mid:    #48484a;
  --faint:  #8e8e93;
  --paper:  #faf9f6;
  --rule:   #e2ddd6;
  --accent: #c0392b;
  --gold:   #a07028;
  --teal:   #1a6060;
  --serif:  Georgia, "Nanum Myeongjo", "Apple SD Gothic Neo", serif;
  --sans:   -apple-system, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif;
  --mono:   "SF Mono", "Fira Code", Consolas, monospace;
}

html { zoom: 0.72; }
* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  font-family: var(--sans);
  font-size: 28px;
  line-height: 1.8;
  letter-spacing: -0.02em;
  word-break: keep-all;
  color: var(--ink);
  background: var(--paper);
  -webkit-font-smoothing: antialiased;
}

/* 헤더 */
.hd {
  padding: 58px 8% 47px;
  border-bottom: 2px solid var(--ink);
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  gap: 24px;
  flex-wrap: wrap;
}
.hd-eyebrow {
  font-family: var(--mono);
  font-size: 18px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--accent);
  margin-bottom: 12px;
}
.hd h1 {
  font-family: var(--serif);
  font-size: clamp(48px, 8vw, 80px);
  font-weight: 400;
  letter-spacing: -0.045em;
  line-height: 1.05;
  color: var(--ink);
}
.hd h1 em { font-style: normal; color: var(--accent); }
.hd-meta {
  text-align: right;
  font-family: var(--mono);
  font-size: 20px;
  color: var(--faint);
  letter-spacing: 0.06em;
  line-height: 1.9;
}
.hd-meta strong { color: var(--ink); display: block; font-size: 24px; }

/* 단원 스트립 */
.strip {
  padding: 18px 8%;
  border-bottom: 1px solid var(--rule);
  display: flex;
  align-items: center;
  gap: 20px;
  font-size: 22px;
  color: var(--mid);
  flex-wrap: wrap;
}
.strip-unit {
  font-family: var(--mono);
  font-size: 18px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--accent);
  border: 1px solid var(--accent);
  padding: 3px 12px;
  border-radius: 3px;
  flex-shrink: 0;
}

/* 레이아웃 — 단일 컬럼 */
.page { display: block; }

/* 섹션 */
.sec      { padding: 43px 8%; border-bottom: 1px solid var(--rule); }
.sec-full { padding: 47px 8%; border-bottom: 1px solid var(--rule); }

/* 섹션 레이블 */
.sec-label {
  font-family: var(--mono);
  font-size: 17px;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--faint);
  margin-bottom: 28px;
  display: flex;
  align-items: center;
  gap: 14px;
}
.sec-label::after { content: ''; flex: 1; height: 1px; background: var(--rule); }

/* 수업 맥락 */
.ctx-grid { display: flex; flex-direction: column; gap: 28px; }
.ctx-info { display: flex; flex-direction: row; gap: 40px; flex-wrap: wrap; }
.info-row dt {
  font-family: var(--mono); font-size: 16px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--faint); margin-bottom: 2px;
}
.info-row dd { font-size: 24px; color: var(--ink); font-weight: 500; line-height: 1.4; }
.ctx-body h2 {
  font-family: var(--serif); font-size: 34px; font-weight: 400;
  letter-spacing: -0.03em; line-height: 1.3; margin-bottom: 16px; color: var(--ink);
}
.ctx-body p { font-size: 26px; line-height: 1.85; color: var(--mid); }

/* 시험 포인트 */
.exam-list { list-style: none; }
.exam-list li {
  display: grid; grid-template-columns: 44px 1fr; gap: 18px;
  padding: 22px 0; border-bottom: 1px solid var(--rule); align-items: baseline;
}
.exam-list li:first-child { padding-top: 0; }
.exam-list li:last-child  { border-bottom: none; padding-bottom: 0; }
.exam-n { font-family: var(--mono); font-size: 18px; color: var(--accent); font-weight: 700; }
.exam-txt { font-size: 26px; line-height: 1.75; color: var(--mid); }
.exam-txt strong { color: var(--ink); font-weight: 600; display: block; margin-bottom: 4px; }

/* 강조 포인트 */
.emph-list { list-style: none; }
.emph-list li {
  padding: 18px 0 18px 28px; border-bottom: 1px solid var(--rule);
  font-size: 26px; line-height: 1.7; color: var(--mid); position: relative;
}
.emph-list li::before {
  content: ''; position: absolute; left: 0; top: 30px;
  width: 8px; height: 1px; background: var(--gold);
}
.emph-list li:first-child { padding-top: 0; }
.emph-list li:last-child  { border-bottom: none; padding-bottom: 0; }
.emph-list li strong { color: var(--gold); font-weight: 600; }

/* 논리 분석 */
.logic-cols { display: flex; flex-direction: column; gap: 32px; margin-top: 4px; }
.logic-tag {
  font-family: var(--mono); font-size: 18px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--faint);
  border-bottom: 1px solid var(--rule); padding-bottom: 10px; margin-bottom: 16px;
}
.logic-item p { font-size: 26px; line-height: 1.8; color: var(--mid); }

/* 질문 */
.q-block { margin-bottom: 36px; }
.q-block:last-child { margin-bottom: 0; }
.q-my {
  font-size: 24px; color: var(--faint); margin-bottom: 12px;
  display: flex; align-items: baseline; gap: 12px;
}
.q-my::before {
  content: 'Q'; font-family: var(--mono); font-size: 16px; letter-spacing: 0.1em;
  color: var(--teal); border: 1px solid var(--teal); padding: 2px 8px;
  border-radius: 2px; flex-shrink: 0;
}
.q-up {
  font-size: 26px; line-height: 1.8; color: var(--ink);
  padding-left: 24px; border-left: 3px solid var(--teal);
}
.q-up-label {
  font-family: var(--mono); font-size: 16px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--teal); margin-bottom: 8px; display: block;
}

/* 메타인지 */
.meta-block { margin-bottom: 32px; }
.meta-block:last-child { margin-bottom: 0; }
.meta-q { font-size: 26px; font-weight: 600; color: var(--ink); margin-bottom: 10px; line-height: 1.6; }
.meta-a {
  font-size: 26px; color: var(--mid); line-height: 1.8;
  padding-left: 22px; border-left: 2px solid var(--rule);
}
.meta-a strong { color: var(--accent); }

/* 키워드 */
.kw-strip {
  padding: 26px 8%; border-bottom: 1px solid var(--rule);
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
}
.kw-label {
  font-family: var(--mono); font-size: 16px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--faint); margin-right: 4px;
}
.kw { font-family: var(--mono); font-size: 20px; color: var(--mid); letter-spacing: 0.04em; }
.kw + .kw::before { content: '·'; margin-right: 10px; color: var(--rule); }
.kw:first-of-type { color: var(--accent); }

/* 세특 */
.seteuk { font-family: var(--serif); font-size: 26px; line-height: 2; color: var(--mid); margin-top: 12px; }

/* 과제 */
.hw { padding: 36px 8%; display: flex; align-items: baseline; gap: 24px; flex-wrap: wrap; }
.hw-label {
  font-family: var(--mono); font-size: 18px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--accent); flex-shrink: 0;
}
.hw-text { font-size: 26px; color: var(--ink); line-height: 1.7; }
.hw-note { font-family: var(--mono); font-size: 20px; color: var(--faint); margin-top: 6px; letter-spacing: 0.04em; }
```

---

## 4. HTML 구조 템플릿

`{{ 변수 }}` 자리에 추출한 데이터를 채운다. 없는 섹션은 블록 전체 생략.

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>나의 수업 탐구 기록 · {{ 교과목 }} {{ 날짜 }}</title>
<style>
  /* 3번 CSS 전체 삽입 */
</style>
</head>
<body>

<!-- ① 헤더 -->
<header class="hd">
  <div>
    <div class="hd-eyebrow">MY CREDIT LOG · {{ 교과목 }}</div>
    <h1>나의 수업<br><em>탐구 기록</em></h1>
  </div>
  <div class="hd-meta">
    <strong>{{ 학생이름 }}</strong>
    {{ 날짜 }}<br>
    {{ 단원 }}
  </div>
</header>

<!-- ② 단원 스트립 -->
<div class="strip">
  <span class="strip-unit">{{ 레슨번호 }}</span>
  {{ 수업제목 }} · {{ 교과서페이지 }}
</div>

<main>

  <!-- ③ 수업 맥락 요약 -->
  <section class="sec-full">
    <div class="sec-label">수업 맥락 요약</div>
    <div class="ctx-grid">
      <dl class="ctx-info">
        <div class="info-row"><dt>교과서</dt><dd>{{ 교과서페이지 }}</dd></div>
        <div class="info-row"><dt>날짜</dt><dd>{{ 날짜 }}</dd></div>
        <div class="info-row"><dt>학생</dt><dd>{{ 학생이름 }}</dd></div>
      </dl>
      <div class="ctx-body">
        <h2>{{ 맥락제목 (AI가 1~2줄로 직접 생성) }}</h2>
        <p>{{ 수업맥락요약 }}</p>
      </div>
    </div>
  </section>

  <!-- ④ 시험 연결 포인트 (최대 4개) -->
  <section class="sec">
    <div class="sec-label">시험 연결 포인트</div>
    <ul class="exam-list">
      <li>
        <span class="exam-n">01</span>
        <div class="exam-txt"><strong>{{ 제목 }}</strong>{{ 설명 }}</div>
      </li>
      <!-- 02, 03, 04 반복 -->
    </ul>
  </section>

  <!-- ⑤ 선생님 강조 포인트 (최대 5개) -->
  <section class="sec">
    <div class="sec-label">선생님 강조 포인트</div>
    <ul class="emph-list">
      <li><strong>{{ 레이블 }}</strong> {{ 내용 }}</li>
      <!-- 반복 -->
    </ul>
  </section>

  <!-- ⑥ 핵심 논리 분석 (최대 3개, 없으면 섹션 생략) -->
  <section class="sec-full">
    <div class="sec-label">핵심 논리 분석</div>
    <div class="logic-cols">
      <div class="logic-item">
        <div class="logic-tag">{{ 태그 (예: p.17 · find + O + O.C) }}</div>
        <p>{{ 분석내용 }}</p>
      </div>
      <!-- 반복 -->
    </div>
  </section>

  <!-- ⑦ 세특 소재 질문 (최대 3쌍) -->
  <section class="sec">
    <div class="sec-label">세특 소재 질문</div>
    <div class="q-block">
      <div class="q-my">{{ 학생 원래 질문 }}</div>
      <div class="q-up">
        <span class="q-up-label">✦ 선생님께 이렇게</span>
        {{ 업그레이드된 심화 질문 }}
      </div>
    </div>
    <!-- 반복 -->
  </section>

  <!-- ⑧ 메타인지 자극 질문 (최대 3쌍) -->
  <section class="sec">
    <div class="sec-label">메타인지 자극 질문</div>
    <div class="meta-block">
      <div class="meta-q">{{ 질문 }}</div>
      <div class="meta-a">{{ 답변. 핵심어는 <strong>태그로 강조 }}</div>
    </div>
    <!-- 반복 -->
  </section>

  <!-- ⑨ 핵심 키워드 (최대 5개, 첫 번째 자동으로 accent 색) -->
  <div class="kw-strip">
    <span class="kw-label">핵심 키워드</span>
    <span class="kw">{{ 키워드1 }}</span>
    <span class="kw">{{ 키워드2 }}</span>
    <span class="kw">{{ 키워드3 }}</span>
  </div>

  <!-- ⑩ 세특 관찰 코멘트 -->
  <section class="sec-full">
    <div class="sec-label">세특 관찰 코멘트</div>
    <p class="seteuk">{{ 세특 관찰 코멘트 전문 }}</p>
  </section>

  <!-- ⑪ 과제 -->
  <div class="hw">
    <div class="hw-label">📌 과제</div>
    <div class="hw-body">
      <div class="hw-text">{{ 과제 내용 }}</div>
      <div class="hw-note">{{ 기한 및 비고 }}</div>
    </div>
  </div>

</main>
</body>
</html>
```

---

## 5. 데이터 추출 체크리스트

PDF 또는 텍스트에서 아래 항목을 순서대로 추출한다.

| # | 항목 | 최대 수량 | 비고 |
|---|------|-----------|------|
| 1 | 교과목 | — | 예: 영어, 수학 |
| 2 | 날짜 | — | YYYY-MM-DD |
| 3 | 단원 | — | 예: UNIT 1 |
| 4 | 레슨번호 | — | 예: Lesson 1 |
| 5 | 수업제목 | — | — |
| 6 | 교과서페이지 | — | 예: p.17~24 |
| 7 | 학생이름 | — | — |
| 8 | 맥락제목 | — | AI가 직접 생성 (1~2줄) |
| 9 | 수업맥락요약 | — | 원문 그대로 |
| 10 | 시험연결포인트 | 최대 4개 | 제목 + 설명 |
| 11 | 선생님강조포인트 | 최대 5개 | 레이블 + 내용 |
| 12 | 핵심논리분석 | 최대 3개 | 태그 + 분석 |
| 13 | 세특소재질문 | 최대 3쌍 | 원래질문 + 업그레이드질문 |
| 14 | 메타인지질문 | 최대 3쌍 | 질문 + 답변 |
| 15 | 핵심키워드 | 최대 5개 | — |
| 16 | 세특관찰코멘트 | — | 전체 텍스트 |
| 17 | 과제내용 | — | — |
| 18 | 기한및비고 | — | — |

---

## 6. 작업 순서

```
1. PDF/텍스트 수신
2. 위 체크리스트 기준으로 데이터 추출
3. CSS(3번 전체) → <style> 태그에 삽입 (수치 수정 금지)
4. HTML 템플릿(4번)에 데이터 채우기
5. 없는 섹션은 블록 전체 생략
6. 파일 저장: 나의_수업탐구기록_{{ 교과목 }}_{{ 날짜 }}.html
```

---

## 7. 금지 사항

```
❌ zoom 수치 변경
❌ font-size 수치 변경
❌ CSS 변수값 변경
❌ 배경색 카드 / box-shadow 추가
❌ border-radius 카드 추가
❌ 다단(grid/flex) 레이아웃 적용
❌ 섹션 순서 변경
❌ 새로운 CSS 클래스 임의 추가
```

---

## 8. 레퍼런스

- **스킬 파일**: `수업탐구기록.skill`
- **최종 예시 HTML**: `assets/template_example.html` (스킬 패키지 내 포함)
- **적용 교과**: 영어 기준으로 작성되었으나 어떤 교과목에도 그대로 적용 가능
