/* ================================================================
   Records Module — components/pdf-generator.js
   MY CREDIT LOG PDF 생성 (window.print 기반)
   ================================================================ */


export function generateCreditLogPDF(creditLog, subject, date, studentName) {
  if (!creditLog) return;

  const questions = creditLog.questions || [];
  const keywords = creditLog.keywords || [];
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

function _openPrintWindow(html) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('팝업이 차단되었습니다. 팝업을 허용해주세요.');
    return;
  }
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => {
    printWindow.print();
  };
}

// === 아하 리포트 PDF ===
export function generateAhaReportPDF(result, subject, date, feedback) {
  if (!result) return;

  const pa = result.pa || [];
  const ppa = result.ppa || {};

  const printHtml = `
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<title>아하 리포트 - ${subject} ${date}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
  @page { size: A4; margin: 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Pretendard Variable', Pretendard, -apple-system, sans-serif;
    color: #222; background: #fff; padding: 20px;
  }
  .aha-pdf-header {
    text-align: center; margin-bottom: 24px; padding-bottom: 12px;
    border-bottom: 3px solid #1a237e;
  }
  .aha-pdf-title {
    font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #1a237e;
  }
  .aha-pdf-subtitle {
    font-size: 14px; letter-spacing: 6px; color: #666; margin-top: 4px;
  }
  .aha-pdf-meta { font-size: 14px; color: #888; margin-top: 8px; }

  .aha-pdf-section {
    border: 1.5px solid #333; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 12px;
  }
  .aha-pdf-badge {
    display: inline-block; font-size: 12px; font-weight: 700;
    padding: 2px 10px; border-radius: 4px; margin-right: 8px;
  }
  .aha-pdf-label {
    font-size: 15px; font-weight: bold; color: #333; margin-bottom: 8px;
    display: flex; align-items: center;
  }
  .aha-pdf-value {
    font-size: 15px; line-height: 1.8; color: #1a237e; font-weight: 500;
    min-height: 24px;
  }

  .aha-pdf-pa-item {
    margin-bottom: 8px; padding: 8px 12px;
    background: #f0f0ff; border-radius: 6px;
  }
  .aha-pdf-pa-num { font-weight: 700; color: #5c4cdb; margin-right: 8px; }

  .aha-pdf-ppa-row {
    margin-bottom: 8px; padding: 8px 12px; background: #f0f8ff; border-radius: 6px;
  }
  .aha-pdf-ppa-label { font-size: 12px; color: #888; font-weight: 600; margin-bottom: 4px; }

  .aha-pdf-feedback {
    border: 1.5px solid #ff9f43; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 12px;
    background: #fffbf0;
  }
  .aha-pdf-feedback-title { font-size: 15px; font-weight: 700; color: #e67e22; margin-bottom: 8px; }
  .aha-pdf-feedback-body { font-size: 14px; line-height: 1.7; color: #555; }
</style>
</head>
<body>
  <div class="aha-pdf-header">
    <div class="aha-pdf-title">아 하 리 포 트</div>
    <div class="aha-pdf-subtitle">A H A &nbsp; R E P O R T</div>
    <div class="aha-pdf-meta">${subject}${date ? ' · ' + date : ''}</div>
  </div>

  ${result.sa ? `
  <div class="aha-pdf-section">
    <div class="aha-pdf-label">
      <span class="aha-pdf-badge" style="background:#ffe0e0;color:#e53935">SA</span> 문제상황
    </div>
    <div class="aha-pdf-value">${(result.sa || '').replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  ${pa.length > 0 ? `
  <div class="aha-pdf-section">
    <div class="aha-pdf-label">
      <span class="aha-pdf-badge" style="background:#e8e0ff;color:#5c4cdb">PA</span> 탐구질문
    </div>
    ${pa.map((q, i) => `<div class="aha-pdf-pa-item"><span class="aha-pdf-pa-num">Q${i + 1}.</span>${q}</div>`).join('')}
  </div>` : ''}

  ${result.da ? `
  <div class="aha-pdf-section">
    <div class="aha-pdf-label">
      <span class="aha-pdf-badge" style="background:#d0f0e0;color:#00897b">DA</span> 탐구과정 & 결론
    </div>
    <div class="aha-pdf-value">${(result.da || '').replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  ${result.poa ? `
  <div class="aha-pdf-section">
    <div class="aha-pdf-label">
      <span class="aha-pdf-badge" style="background:#fff8e0;color:#f9a825">POA</span> 아하포인트
    </div>
    <div class="aha-pdf-value">${(result.poa || '').replace(/\n/g, '<br>')}</div>
  </div>` : ''}

  ${ppa.change || ppa.lacking ? `
  <div class="aha-pdf-section">
    <div class="aha-pdf-label">
      <span class="aha-pdf-badge" style="background:#e0f0ff;color:#1565c0">PPA</span> 성찰
    </div>
    ${ppa.change ? `<div class="aha-pdf-ppa-row"><div class="aha-pdf-ppa-label">🔄 전후 생각 변화</div><div class="aha-pdf-value">${ppa.change.replace(/\n/g, '<br>')}</div></div>` : ''}
    ${ppa.lacking ? `<div class="aha-pdf-ppa-row"><div class="aha-pdf-ppa-label">📌 부족했던 것</div><div class="aha-pdf-value">${ppa.lacking.replace(/\n/g, '<br>')}</div></div>` : ''}
  </div>` : ''}

  ${feedback ? `
  <div class="aha-pdf-feedback">
    <div class="aha-pdf-feedback-title">🎯 아하 리포트 피드백</div>
    <div class="aha-pdf-feedback-body">${feedback.replace(/\n/g, '<br>')}</div>
  </div>` : ''}
</body>
</html>`;

  _openPrintWindow(printHtml);
}
