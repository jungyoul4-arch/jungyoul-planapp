/* ================================================================
   Records Module — components/pdf-generator.js
   MY CREDIT LOG PDF 생성 (window.print 기반)
   ================================================================ */


function stripMarkdown(text) {
  return (text || '')
    .replace(/#{1,6}\s?/g, '')
    .replace(/\*{1,3}(.*?)\*{1,3}/g, '$1')
    .replace(/^---+$/gm, '')
    .replace(/[^\p{L}\p{N}\p{P}\p{Z}\n]/gu, '')
    .replace(/\n{3,}/g, '\n\n');
}

export function generateCreditLogPDF(creditLog, subject, date, studentName) {
  if (!creditLog) return;

  const questions = creditLog.questions || [];
  const keywords = creditLog.keywords || [];
  const seteukQs = creditLog.seteuk_questions || [];
  const quiz = creditLog.quiz || [];
  const examConn = creditLog.exam_connection || [];
  const activeRecall = creditLog.active_recall || [];
  const highlights = creditLog.highlights || '';
  const deepDive = creditLog.deep_dive || '';
  const asg = creditLog.assignment;

  // highlights를 줄바꿈 기준으로 리스트화
  const highlightItems = highlights.split(/\n+/).map(s => s.replace(/^[-·•]\s*/, '').trim()).filter(Boolean);

  // deep_dive를 줄바꿈 기준으로 분리
  const deepDiveItems = deepDive.split(/\n{2,}/).map(s => s.trim()).filter(Boolean);

  // 과제 텍스트
  let hwText = '';
  let hwNote = '';
  if (asg && typeof asg === 'object') {
    hwText = asg.title || '';
    if (asg.description) hwText += ' — ' + asg.description;
    hwNote = asg.dueDate ? ('마감: ' + asg.dueDate + (asg.dueDateRaw ? ' (' + asg.dueDateRaw + ')' : '')) : (asg.dueDateRaw || '');
  } else if (typeof asg === 'string') {
    hwText = asg;
  }

  const printHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>나의 수업 탐구 기록 · ${subject} ${date}</title>
<style>
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

.page { display: block; }

.sec      { padding: 43px 8%; border-bottom: 1px solid var(--rule); }
.sec-full { padding: 47px 8%; border-bottom: 1px solid var(--rule); }

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

.exam-list { list-style: none; }
.exam-list li {
  display: grid; grid-template-columns: 44px 1fr; gap: 18px;
  padding: 22px 0; border-bottom: 1px solid var(--rule); align-items: baseline;
}
.exam-list li:first-child { padding-top: 0; }
.exam-list li:last-child  { border-bottom: none; padding-bottom: 0; }
.exam-n { font-family: var(--mono); font-size: 18px; color: var(--accent); font-weight: 700; }
.exam-txt { font-size: 26px; line-height: 1.75; color: var(--mid); }

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
.emph-list li:first-child::before { top: 12px; }
.emph-list li:last-child  { border-bottom: none; padding-bottom: 0; }
.emph-list li strong { color: var(--gold); font-weight: 600; }

.logic-cols { display: flex; flex-direction: column; gap: 32px; margin-top: 4px; }
.logic-tag {
  font-family: var(--mono); font-size: 18px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--faint);
  border-bottom: 1px solid var(--rule); padding-bottom: 10px; margin-bottom: 16px;
}
.logic-item p { font-size: 26px; line-height: 1.8; color: var(--mid); }

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

.meta-block { margin-bottom: 32px; }
.meta-block:last-child { margin-bottom: 0; }
.meta-q { font-size: 26px; font-weight: 600; color: var(--ink); margin-bottom: 10px; line-height: 1.6; }
.meta-a {
  font-size: 26px; color: var(--mid); line-height: 1.8;
  padding-left: 22px; border-left: 2px solid var(--rule);
}
.meta-a strong { color: var(--accent); }

.kw-strip {
  padding: 26px 8%; border-bottom: 1px solid var(--rule);
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px;
}
.kw-label {
  font-family: var(--mono); font-size: 16px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--faint); margin-right: 4px;
}
.kw { font-family: var(--mono); font-size: 20px; color: var(--mid); letter-spacing: 0.04em; }
.kw + .kw::before { content: '\\00B7'; margin-right: 10px; color: var(--rule); }
.kw:first-of-type { color: var(--accent); }

.seteuk { font-family: var(--serif); font-size: 26px; line-height: 2; color: var(--mid); margin-top: 12px; }

.hw { padding: 36px 8%; display: flex; align-items: baseline; gap: 24px; flex-wrap: wrap; }
.hw-label {
  font-family: var(--mono); font-size: 18px; letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--accent); flex-shrink: 0;
}
.hw-text { font-size: 26px; color: var(--ink); line-height: 1.7; }
.hw-note { font-family: var(--mono); font-size: 20px; color: var(--faint); margin-top: 6px; letter-spacing: 0.04em; }

@media print {
  html { zoom: 0.72; }
  body { background: white; }
  .print-fab { display: none !important; }
}
.print-fab {
  position: fixed; bottom: 32px; right: 32px; z-index: 9999;
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--accent); color: #fff; border: none;
  font-size: 22px; cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  display: flex; align-items: center; justify-content: center;
}
</style>
</head>
<body>

<header class="hd">
  <div>
    <div class="hd-eyebrow">MY CREDIT LOG · ${_esc(subject)}</div>
    <h1>나의 수업<br><em>탐구 기록</em></h1>
  </div>
  <div class="hd-meta">
    <strong>${_esc(studentName)}</strong>
    ${_esc(date)}<br>
    ${_esc(creditLog.topic || '')}
  </div>
</header>

<div class="strip">
  <span class="strip-unit">${_esc(subject)}</span>
  ${_esc(creditLog.topic || '')}${creditLog.pages ? ' · ' + _esc(creditLog.pages) : ''}
</div>

<main>

  ${creditLog.summary ? `
  <section class="sec-full">
    <div class="sec-label">수업 맥락 요약</div>
    <div class="ctx-grid">
      <dl class="ctx-info">
        ${creditLog.pages ? `<div class="info-row"><dt>교과서</dt><dd>${_esc(creditLog.pages)}</dd></div>` : ''}
        <div class="info-row"><dt>날짜</dt><dd>${_esc(date)}</dd></div>
        ${studentName ? `<div class="info-row"><dt>학생</dt><dd>${_esc(studentName)}</dd></div>` : ''}
      </dl>
      <div class="ctx-body">
        <h2>${_esc(creditLog.topic || '')}</h2>
        <p>${_esc(creditLog.summary).replace(/\n/g, '<br>')}</p>
      </div>
    </div>
  </section>` : ''}

  ${examConn.length > 0 ? `
  <section class="sec">
    <div class="sec-label">시험 연결 포인트</div>
    <ul class="exam-list">
      ${examConn.slice(0, 4).map((item, i) => `
      <li>
        <span class="exam-n">${String(i + 1).padStart(2, '0')}</span>
        <div class="exam-txt">${_esc(item)}</div>
      </li>`).join('')}
    </ul>
  </section>` : ''}

  ${highlightItems.length > 0 ? `
  <section class="sec">
    <div class="sec-label">선생님 강조 포인트</div>
    <ul class="emph-list">
      ${highlightItems.slice(0, 5).map(item => `<li>${_esc(item)}</li>`).join('')}
    </ul>
  </section>` : ''}

  ${deepDiveItems.length > 0 ? `
  <section class="sec-full">
    <div class="sec-label">핵심 논리 분석</div>
    <div class="logic-cols">
      ${deepDiveItems.slice(0, 3).map(item => `
      <div class="logic-item">
        <p>${_esc(item).replace(/\n/g, '<br>')}</p>
      </div>`).join('')}
    </div>
  </section>` : ''}

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

  ${activeRecall.length > 0 ? `
  <section class="sec">
    <div class="sec-label">메타인지 자극 질문</div>
    ${activeRecall.slice(0, 3).map(item => `
    <div class="meta-block">
      <div class="meta-q">${_esc(item.question)}</div>
      <div class="meta-a">${_esc(item.answer)}</div>
    </div>`).join('')}
  </section>` : ''}

  ${keywords.length > 0 ? `
  <div class="kw-strip">
    <span class="kw-label">핵심 키워드</span>
    ${keywords.slice(0, 5).map(kw => `<span class="kw">${_esc(kw)}</span>`).join('')}
  </div>` : ''}

  ${creditLog.teacher_insight ? `
  <section class="sec-full">
    <div class="sec-label">세특 관찰 코멘트</div>
    <p class="seteuk">${_esc(creditLog.teacher_insight).replace(/\n/g, '<br>')}</p>
  </section>` : ''}

  ${hwText ? `
  <div class="hw">
    <div class="hw-label">과제</div>
    <div class="hw-body">
      <div class="hw-text">${_esc(hwText)}</div>
      ${hwNote ? `<div class="hw-note">${_esc(hwNote)}</div>` : ''}
    </div>
  </div>` : ''}

</main>
<button class="print-fab" onclick="window.print()" title="인쇄">&#x1F5A8;</button>
</body>
</html>`;

  _openPreviewWindow(printHtml);
}

function _esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _openPreviewWindow(html) {
  const w = window.open('', '_blank');
  if (!w) {
    alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
    return;
  }
  w.document.write(html);
  w.document.close();
}


// === 아하 리포트 PDF ===
export function generateAhaReportPDF(result, subject, date, feedback, studentName) {
  if (!result) return;

  const pa = result.pa || [];
  const ppa = result.ppa || {};

  const printHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>아하 리포트 · ${_esc(subject)} ${_esc(date)}</title>
<style>
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

.sec      { padding: 43px 8%; border-bottom: 1px solid var(--rule); }
.sec-full { padding: 47px 8%; border-bottom: 1px solid var(--rule); }

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

.sec-badge {
  font-family: var(--mono);
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 3px 10px;
  border-radius: 3px;
  flex-shrink: 0;
}

.sec-body { font-size: 26px; line-height: 1.85; color: var(--mid); }

.q-list { list-style: none; }
.q-list li {
  display: grid; grid-template-columns: 44px 1fr; gap: 18px;
  padding: 22px 0; border-bottom: 1px solid var(--rule); align-items: baseline;
}
.q-list li:first-child { padding-top: 0; }
.q-list li:last-child  { border-bottom: none; padding-bottom: 0; }
.q-n { font-family: var(--mono); font-size: 18px; color: var(--teal); font-weight: 700; }
.q-txt { font-size: 26px; line-height: 1.75; color: var(--mid); }

.ppa-block { margin-bottom: 28px; }
.ppa-block:last-child { margin-bottom: 0; }
.ppa-tag {
  font-family: var(--mono); font-size: 18px; letter-spacing: 0.1em;
  text-transform: uppercase; color: var(--faint);
  border-bottom: 1px solid var(--rule); padding-bottom: 10px; margin-bottom: 16px;
}
.ppa-body { font-size: 26px; line-height: 1.8; color: var(--mid); }

.feedback-sec {
  padding: 43px 8%; border-bottom: 1px solid var(--rule);
}
.feedback-body {
  font-size: 26px; line-height: 1.85; color: var(--mid);
  padding-left: 22px; border-left: 3px solid var(--gold);
}

@media print {
  html { zoom: 0.72; }
  body { background: white; }
  .print-fab { display: none !important; }
}
.print-fab {
  position: fixed; bottom: 32px; right: 32px; z-index: 9999;
  width: 56px; height: 56px; border-radius: 50%;
  background: var(--accent); color: #fff; border: none;
  font-size: 22px; cursor: pointer;
  box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  display: flex; align-items: center; justify-content: center;
}
</style>
</head>
<body>

<header class="hd">
  <div>
    <div class="hd-eyebrow">AHA REPORT · ${_esc(subject)}</div>
    <h1>아하<br><em>리포트</em></h1>
  </div>
  <div class="hd-meta">
    ${studentName ? `<strong>${_esc(studentName)}</strong>` : ''}
    ${_esc(date)}
  </div>
</header>

<div class="strip">
  <span class="strip-unit">${_esc(subject)}</span>
  아하 리포트${date ? ' · ' + _esc(date) : ''}
</div>

<main>

  ${result.sa ? `
  <section class="sec-full">
    <div class="sec-label">
      <span class="sec-badge" style="background:#ffe0e0;color:#c0392b">SA</span>
      문제상황 · situation analysis
    </div>
    <div class="sec-body">${_esc(result.sa).replace(/\\n/g, '<br>')}</div>
  </section>` : ''}

  ${pa.length > 0 ? `
  <section class="sec">
    <div class="sec-label">
      <span class="sec-badge" style="background:#ede7f6;color:#5c4cdb">PA</span>
      탐구질문 · problem analysis
    </div>
    <ul class="q-list">
      ${pa.map((q, i) => `
      <li>
        <span class="q-n">Q${i + 1}</span>
        <div class="q-txt">${_esc(q)}</div>
      </li>`).join('')}
    </ul>
  </section>` : ''}

  ${result.da ? `
  <section class="sec-full">
    <div class="sec-label">
      <span class="sec-badge" style="background:#e0f2f1;color:#1a6060">DA</span>
      탐구과정 & 결론 · data analysis
    </div>
    <div class="sec-body">${_esc(result.da).replace(/\\n/g, '<br>')}</div>
  </section>` : ''}

  ${result.poa ? `
  <section class="sec-full">
    <div class="sec-label">
      <span class="sec-badge" style="background:#fff8e1;color:#a07028">POA</span>
      아하포인트 · point of awareness
    </div>
    <div class="sec-body">${_esc(result.poa).replace(/\\n/g, '<br>')}</div>
  </section>` : ''}

  ${ppa.change || ppa.lacking ? `
  <section class="sec">
    <div class="sec-label">
      <span class="sec-badge" style="background:#e3f2fd;color:#1565c0">PPA</span>
      성찰 · personal procedural awareness
    </div>
    ${ppa.change ? `
    <div class="ppa-block">
      <div class="ppa-tag">전후 생각 변화</div>
      <div class="ppa-body">${_esc(ppa.change).replace(/\\n/g, '<br>')}</div>
    </div>` : ''}
    ${ppa.lacking ? `
    <div class="ppa-block">
      <div class="ppa-tag">부족했던 것</div>
      <div class="ppa-body">${_esc(ppa.lacking).replace(/\\n/g, '<br>')}</div>
    </div>` : ''}
  </section>` : ''}

  ${feedback ? `
  <section class="feedback-sec">
    <div class="sec-label">아하 리포트 피드백</div>
    <div class="feedback-body">${_esc(stripMarkdown(feedback)).replace(/\n/g, '<br>')}</div>
  </section>` : ''}

</main>
<button class="print-fab" onclick="window.print()" title="인쇄">&#x1F5A8;</button>
</body>
</html>`;

  _openPreviewWindow(printHtml);
}
