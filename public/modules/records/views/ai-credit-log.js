/* ================================================================
   Records Module — views/ai-credit-log.js
   AI 분석 로딩 + MY CREDIT LOG 결과 표시 + PDF 저장
   2개 렌더러 export: renderAiLoading, renderAiResult
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { navigate } from '../core/router.js';
import { events, EVENTS } from '../core/events.js';
import { kstToday, kstDateOffset, getSubjectColor, markKeywords, renderMath, generatePlanSteps, SUBJECT_COLOR_MAP } from '../core/utils.js';
import { generateCreditLogPDF } from '../components/pdf-generator.js';
import { showXpPopup } from '../components/xp-popup.js';

export function registerHandlers(RM) {
  RM.toggleCreditLogEdit = () => toggleEdit();
  RM.updateCreditLogField = (field, value) => updateField(field, value);
  RM.updateQuestionField = (qIdx, fieldName, value) => updateQuestion(qIdx, fieldName, value);
  RM.addCreditLogKeyword = () => addKeyword();
  RM.removeCreditLogKeyword = (idx) => removeKeyword(idx);
  RM.saveCreditLog = () => saveCreditLog();
  RM.downloadCreditLogPDF = () => downloadPDF();
  RM.retryAiAnalysis = () => retryAnalysis();
  RM.updateAssignmentField = (field, value) => {
    if (!state._aiCreditLog || !state._aiCreditLog.assignment) return;
    state._aiCreditLog.assignment[field] = value;
  };
  RM.toggleRecallAnswer = (idx) => {
    const el = document.getElementById(`recall-answer-${idx}`);
    if (el) el.style.display = el.style.display === 'none' ? 'block' : 'none';
  };
}

// === AI 분석 실행 (ai-loading 화면 진입 시 호출) ===
async function runAnalysis() {
  const record = state.todayRecords[state._selectedPeriodIdx];
  const photos = state._classPhotos || [];
  const tags = state._classPhotoTags || [];

  // 사진이 최소 1장 필요 (필기 또는 참고)
  if (photos.length === 0) {
    state._aiAnalyzing = false;
    state._aiAnalysisStep = 'error';
    navigate(state.currentScreen, { replace: true });
    return;
  }

  // 모든 사진(필기+참고)을 태그와 함께 전송
  const images = photos.map((p, i) => ({
    base64: p,
    mimeType: 'image/jpeg',
    tag: tags[i] || '참고'
  }));

  try {
    const result = await DB.analyzePhotos(
      images,
      record ? record.subject : '',
      record ? record.period : 0,
      state._backfillDate || kstToday(),
      state._studentComment || ''
    );

    if (result) {
      state._aiCreditLog = result;
      state._aiAnalyzing = false;
      state._aiAnalysisStep = '';
      navigate('ai-result', { replace: true });
    } else {
      state._aiAnalyzing = false;
      state._aiAnalysisStep = 'error';
      navigate(state.currentScreen, { replace: true });
    }
  } catch (e) {
    console.error('AI analysis failed:', e);
    state._aiAnalyzing = false;
    state._aiAnalysisStep = 'error';
    navigate(state.currentScreen, { replace: true });
  }
}

function retryAnalysis() {
  state._aiAnalyzing = true;
  state._aiAnalysisStep = 'analyzing';
  navigate('ai-loading', { replace: true });
}

function toggleEdit() {
  state._aiCreditLogEditing = !state._aiCreditLogEditing;
  navigate(state.currentScreen, { replace: true });
}

function updateField(field, value) {
  if (!state._aiCreditLog) return;
  state._aiCreditLog[field] = value;
}

function updateQuestion(qIdx, fieldName, value) {
  if (!state._aiCreditLog || !state._aiCreditLog.questions) return;
  if (state._aiCreditLog.questions[qIdx]) {
    state._aiCreditLog.questions[qIdx][fieldName] = value;
  }
}

function addKeyword() {
  if (!state._aiCreditLog) return;
  const input = document.querySelector('.cl-keyword-add-input');
  if (!input || !input.value.trim()) return;
  if (!state._aiCreditLog.keywords) state._aiCreditLog.keywords = [];
  if (state._aiCreditLog.keywords.length >= 5) return;
  state._aiCreditLog.keywords.push(input.value.trim());
  navigate(state.currentScreen, { replace: true });
}

function removeKeyword(idx) {
  if (!state._aiCreditLog || !state._aiCreditLog.keywords) return;
  state._aiCreditLog.keywords.splice(idx, 1);
  navigate(state.currentScreen, { replace: true });
}

async function saveCreditLog() {
  const record = state.todayRecords[state._selectedPeriodIdx];
  if (!record || !state._aiCreditLog) return;

  const log = state._aiCreditLog;
  const subject = record.subject;
  const period = record.period;
  const date = state._backfillDate || kstToday();
  const photos = state._classPhotos || [];
  const tags = state._classPhotoTags || [];

  // 태그 정규화: 기존 값도 필기/참고로 매핑
  const normalizedTags = tags.map(t => t === '필기' ? '필기' : '참고');

  const recordId = await DB.saveClassRecord({
    subject,
    date,
    content: log.topic || '',
    keywords: log.keywords || [],
    understanding: 3,
    memo: JSON.stringify({ period, pages: log.pages || '', teacherNote: log.highlights || '', photoCount: photos.length }),
    topic: log.topic || '',
    pages: log.pages || '',
    photos,
    teacher_note: log.highlights || '',
    ai_credit_log: log,
    photo_tags: normalizedTags,
  });

  // 과제 자동 등록
  let assignmentRegistered = false;
  if (log.assignment && typeof log.assignment === 'object' && log.assignment.title) {
    const asg = log.assignment;
    const dueDate = asg.dueDate || kstDateOffset(7); // 날짜 없으면 7일 후
    const color = SUBJECT_COLOR_MAP[subject] || '#636e72';
    const planData = generatePlanSteps(dueDate);

    const dbId = await DB.saveAssignment({
      subject,
      title: asg.title,
      description: asg.description || '',
      teacherName: record.teacher || '',
      dueDate,
      color,
      planData,
    });

    if (dbId) {
      // state.assignments에 로컬 추가
      const assignments = state.assignments || [];
      const newId = String(dbId);
      assignments.push({
        id: newId,
        _dbId: dbId,
        subject,
        title: asg.title,
        desc: asg.description || '',
        teacher: record.teacher || '',
        dueDate,
        createdDate: state._backfillDate || kstToday(),
        color,
        status: 'pending',
        progress: 0,
        plan: planData,
      });
      state.assignments = [...assignments];
      assignmentRegistered = true;
    }
  }

  // 세특 질문 → 나의 질문함 자동 등록
  const questions = log.questions || [];
  if (questions.length > 0 && recordId) {
    for (const q of questions) {
      if (!q.original || q.original.trim().length < 2) continue;
      await DB.saveMyQuestion({
        subject,
        source: '수업',
        title: q.original,
        aiImproved: q.improved || null,
        classRecordId: recordId,
        period,
        date,
        skipXp: true,
      });
    }
  }

  // todayRecords 업데이트
  record.done = true;
  record._dbRecordId = recordId || null;
  record.summary = log.topic || log.keywords?.join(', ') || '수업 기록 완료';

  // 미션 업데이트
  if (state.missions && state.missions[0]) {
    state.missions[0].current = state.todayRecords.filter(r => r.done).length;
    if (state.missions[0].current >= state.missions[0].target) state.missions[0].done = true;
  }

  // 리셋
  state._classPhotos = [];
  state._classPhotoTags = [];
  state._aiCreditLog = null;
  state._aiCreditLogEditing = false;
  state._studentComment = '';
  state._selectedPeriodIdx = null;

  const xpLabel = assignmentRegistered ? 'MY CREDIT LOG 완료! + 과제 자동 등록' : 'MY CREDIT LOG 완료!';
  showXpPopup(15, xpLabel);
  events.emit(EVENTS.XP_EARNED, { amount: 15, label: xpLabel });
  navigate('dashboard');
}

function downloadPDF() {
  const record = state.todayRecords[state._selectedPeriodIdx];
  const log = state._aiCreditLog;
  if (!log) return;
  generateCreditLogPDF(log, record?.subject || '', kstToday());
}

// === 단계별 로딩 메시지 ===
const CLASS_LOADING_STEPS = [
  { time: 0,  message: "필기를 인식하고 있어요...",       emoji: "✍️",  progress: 5 },
  { time: 5,  message: "수업 핵심을 파악하고 있어요...",   emoji: "🔍",  progress: 25 },
  { time: 12, message: "시험 포인트를 연결하고 있어요...", emoji: "📌",  progress: 50 },
  { time: 20, message: "세특 소재를 정리하고 있어요...",   emoji: "✨",  progress: 75 },
  { time: 27, message: "거의 다 됐어요...",               emoji: "🎯",  progress: 90 },
];

let _loadingTimers = [];

function startLoadingSteps(steps) {
  _loadingTimers.forEach(t => clearTimeout(t));
  _loadingTimers = [];

  steps.forEach((step, i) => {
    const timer = setTimeout(() => {
      const msgEl = document.getElementById('al-loading-msg');
      const emojiEl = document.getElementById('al-loading-emoji');
      const fillEl = document.getElementById('al-progress-fill');
      if (!msgEl || !emojiEl) return;

      // 페이드 아웃
      msgEl.style.opacity = '0';
      emojiEl.style.opacity = '0';
      setTimeout(() => {
        msgEl.textContent = step.message;
        emojiEl.textContent = step.emoji;
        msgEl.style.opacity = '1';
        emojiEl.style.opacity = '1';
      }, 300);

      if (fillEl) fillEl.style.width = step.progress + '%';
    }, step.time * 1000);
    _loadingTimers.push(timer);
  });
}

// === 로딩 화면 렌더러 ===
export function renderAiLoading() {
  const isError = state._aiAnalysisStep === 'error';

  // 분석 시작 (비동기)
  if (state._aiAnalyzing && state._aiAnalysisStep === 'analyzing') {
    setTimeout(() => {
      startLoadingSteps(CLASS_LOADING_STEPS);
      runAnalysis();
    }, 100);
  }

  if (isError) {
    _loadingTimers.forEach(t => clearTimeout(t));
    _loadingTimers = [];
  }

  return `
    <div class="full-screen animate-slide">
      <div class="al-container">
        ${isError ? `
          <div class="al-error-icon">⚠️</div>
          <div class="al-step-text" style="color:#FF6B6B">AI 분석에 실패했습니다</div>
          <p style="color:var(--text-muted);font-size:13px;margin:12px 0 24px">네트워크 상태를 확인하고 다시 시도해주세요</p>
          <button class="btn-primary" onclick="_RM.retryAiAnalysis()" style="width:auto;padding:12px 32px">
            <i class="fas fa-redo" style="margin-right:8px"></i>다시 시도
          </button>
          <button class="pu-skip-btn" onclick="_RM.nav('photo-upload')" style="margin-top:12px">
            ← 사진 업로드로 돌아가기
          </button>
        ` : `
          <span class="al-loading-emoji" id="al-loading-emoji">✍️</span>
          <p class="al-loading-message" id="al-loading-msg">필기를 인식하고 있어요...</p>
          <p class="al-loading-subtitle">수업 탐구 기록을 정리합니다</p>
          <div class="al-progress-bar">
            <div class="al-progress-fill" id="al-progress-fill"></div>
          </div>
        `}
      </div>
    </div>
  `;
}

// === 결과 화면 헬퍼 ===
function _renderKeywords(keywords, editing) {
  if (!keywords || keywords.length === 0) return '<span style="color:var(--text-muted)">키워드 없음</span>';

  const chips = keywords.map((kw, i) => `
    <span class="cl-keyword-chip">
      ${kw}
      ${editing ? `<button class="cl-keyword-remove" onclick="_RM.removeCreditLogKeyword(${i})">&times;</button>` : ''}
    </span>
  `).join('');

  const addInput = editing && keywords.length < 5 ? `
    <span class="cl-keyword-add">
      <input class="cl-keyword-add-input" placeholder="추가" maxlength="20"
             onkeydown="if(event.key==='Enter'){_RM.addCreditLogKeyword();event.preventDefault()}"
             style="width:60px;border:none;background:transparent;color:var(--text-primary);font-size:13px;outline:none">
      <button onclick="_RM.addCreditLogKeyword()" style="background:none;border:none;color:var(--primary-light);cursor:pointer;font-size:12px">+</button>
    </span>
  ` : '';

  return chips + addInput;
}

function _renderQuestionPair(q, idx, editing, keywords) {
  return `
    <div class="cl-question-pair">
      <div class="cl-question-num">Q${idx + 1}</div>
      <div class="cl-question-body">
        <div class="cl-question-original">
          <span class="cl-q-label">💬 내가 쓴 질문</span>
          ${editing
            ? `<textarea class="cl-edit-textarea" oninput="_RM.updateQuestionField(${idx},'original',this.value)" rows="2">${q.original || ''}</textarea>`
            : `<p>${q.original || '(질문 없음)'}</p>`}
        </div>
        <div class="cl-question-improved">
          <span class="cl-q-label">✨ 선생님께 이렇게 여쭤보세요</span>
          ${editing
            ? `<textarea class="cl-edit-textarea" oninput="_RM.updateQuestionField(${idx},'improved',this.value)" rows="3">${q.improved || ''}</textarea>`
            : `<p>${renderMath(markKeywords(q.improved || '(개선 질문 없음)', keywords))}</p>`}
        </div>
      </div>
    </div>`;
}

function _renderAssignmentSection(log, editing) {
  const asg = log.assignment;
  // null / 없음 → 과제 없음 표시
  if (!asg) {
    return `
      <div class="cl-section cl-assignment-section">
        <span class="cl-section-label">📌 과제</span>
        <div class="cl-section-value cl-handwriting" style="color:var(--text-muted)">과제 없음</div>
      </div>`;
  }
  // 구조화된 객체
  if (typeof asg === 'object') {
    if (editing) {
      return `
        <div class="cl-section cl-assignment-section">
          <span class="cl-section-label">📌 과제</span>
          <div class="cl-assignment-card">
            <label style="font-size:20px;color:var(--text-secondary);margin-bottom:4px;display:block">과제 제목</label>
            <input class="cl-edit-input" value="${asg.title || ''}" oninput="_RM.updateAssignmentField('title',this.value)">
            <label style="font-size:20px;color:var(--text-secondary);margin:8px 0 4px;display:block">상세 내용</label>
            <textarea class="cl-edit-textarea" rows="2" oninput="_RM.updateAssignmentField('description',this.value)">${asg.description || ''}</textarea>
            <label style="font-size:20px;color:var(--text-secondary);margin:8px 0 4px;display:block">마감일</label>
            <input class="cl-edit-input" type="date" value="${asg.dueDate || ''}" oninput="_RM.updateAssignmentField('dueDate',this.value)" style="color:var(--text-primary)">
          </div>
        </div>`;
    }
    return `
      <div class="cl-section cl-assignment-section">
        <span class="cl-section-label">📌 과제</span>
        <div class="cl-assignment-card">
          <div class="cl-assignment-title">${asg.title || ''}</div>
          ${asg.description ? `<div class="cl-assignment-desc">${asg.description}</div>` : ''}
          ${asg.dueDate ? `<div class="cl-assignment-due"><i class="fas fa-calendar-alt" style="margin-right:6px"></i>마감일: ${asg.dueDate}${asg.dueDateRaw ? ` (${asg.dueDateRaw})` : ''}</div>` : (asg.dueDateRaw ? `<div class="cl-assignment-due" style="color:var(--warning)"><i class="fas fa-clock" style="margin-right:6px"></i>${asg.dueDateRaw}</div>` : '')}
          <div class="cl-assignment-auto-badge"><i class="fas fa-check-circle" style="margin-right:4px"></i>저장 시 과제로 자동 등록됩니다</div>
        </div>
      </div>`;
  }
  // 하위호환: 문자열
  return `
    <div class="cl-section cl-assignment-section">
      <span class="cl-section-label">📌 과제</span>
      <div class="cl-section-value cl-handwriting">${asg}</div>
    </div>`;
}

// === 새 섹션 렌더러 ===
function _renderSummarySection(log, editing) {
  if (!log.summary && !editing) return '';
  return `
    <div class="cl-section cl-summary-section">
      <span class="cl-section-label">📋 수업 맥락 요약</span>
      ${editing
        ? `<textarea class="cl-edit-textarea" rows="3" oninput="_RM.updateCreditLogField('summary',this.value)">${log.summary || ''}</textarea>`
        : `<div class="cl-section-value cl-handwriting">${renderMath((log.summary || '—').replace(/\n/g, '<br>'))}</div>`}
    </div>`;
}

function _renderExamConnection(log, editing) {
  const items = log.exam_connection || [];
  if (items.length === 0 && !editing) return '';
  return `
    <div class="cl-section cl-exam-section">
      <span class="cl-section-label">🎯 시험 연결 포인트</span>
      <div class="cl-exam-list">
        ${items.map((item, i) => `
          <div class="cl-exam-item">
            <span class="cl-exam-num">${i + 1}</span>
            <span class="cl-exam-text">${renderMath(item)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function _renderDeepDive(log, editing) {
  if (!log.deep_dive && !editing) return '';
  return `
    <div class="cl-section cl-deepdive-section">
      <span class="cl-section-label">🔬 핵심 논리 분석</span>
      ${editing
        ? `<textarea class="cl-edit-textarea" rows="4" oninput="_RM.updateCreditLogField('deep_dive',this.value)">${log.deep_dive || ''}</textarea>`
        : `<div class="cl-section-value cl-handwriting">${renderMath((log.deep_dive || '—').replace(/\n/g, '<br>'))}</div>`}
    </div>`;
}

function _renderActiveRecall(log) {
  const items = log.active_recall || [];
  if (items.length === 0) return '';
  return `
    <div class="cl-section cl-recall-section">
      <span class="cl-section-label">🧠 메타인지 자극 질문</span>
      <div class="cl-recall-list">
        ${items.map((item, i) => `
          <div class="cl-recall-item">
            <div class="cl-recall-q" onclick="_RM.toggleRecallAnswer(${i})">
              <span class="cl-recall-icon">Q</span>
              <span class="cl-recall-text">${renderMath(item.question)}</span>
              <i class="fas fa-chevron-down cl-recall-toggle"></i>
            </div>
            <div id="recall-answer-${i}" class="cl-recall-a" style="display:none">
              <span class="cl-recall-a-icon">A</span>
              <span>${renderMath(item.answer)}</span>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="cl-recall-hint">질문을 탭하면 답을 확인할 수 있어요</div>
    </div>`;
}

function _renderTeacherInsight(log, editing) {
  if (!log.teacher_insight && !editing) return '';
  return `
    <div class="cl-section cl-insight-section">
      <span class="cl-section-label">📝 세특 관찰 코멘트</span>
      ${editing
        ? `<textarea class="cl-edit-textarea" rows="5" oninput="_RM.updateCreditLogField('teacher_insight',this.value)">${log.teacher_insight || ''}</textarea>`
        : `<div class="cl-insight-box">${renderMath((log.teacher_insight || '—').replace(/\n/g, '<br>'))}</div>`}
    </div>`;
}

// === 결과 화면 렌더러 ===
export function renderAiResult() {
  const log = state._aiCreditLog;
  const editing = state._aiCreditLogEditing;
  const record = state.todayRecords[state._selectedPeriodIdx];
  const subject = record ? record.subject : '';
  const period = record ? record.period : '';
  const color = record ? record.color : '#6C5CE7';

  if (!log) {
    return `
      <div class="full-screen animate-slide">
        <div class="al-container">
          <p style="color:var(--text-muted)">분석 결과가 없습니다</p>
          <button class="btn-primary" onclick="_RM.nav('photo-upload')">← 다시 시도</button>
        </div>
      </div>`;
  }

  const questions = log.questions || [];
  const kw = log.keywords || [];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('photo-upload')"><i class="fas fa-arrow-left"></i></button>
        <h1>수업 탐구 기록</h1>
        <span class="header-badge">${period}교시 ${subject}</span>
      </div>
      <div class="form-body">
        <div class="cl-card">
          <div class="cl-title-section">
            <div class="cl-title">나의 수업 탐구 기록</div>
            <div class="cl-subtitle">MY CREDIT LOG</div>
            <div class="cl-meta">${subject} · ${period}교시 · ${state._backfillDate || kstToday()}</div>
          </div>

          <div class="cl-section">
            <span class="cl-section-label">📖 단원 / 주제</span>
            ${editing
              ? `<input class="cl-edit-input" value="${log.topic || ''}" oninput="_RM.updateCreditLogField('topic',this.value)">`
              : `<div class="cl-section-value cl-handwriting">${log.topic || '—'}</div>`}
          </div>

          <div class="cl-section">
            <span class="cl-section-label">📚 교과서</span>
            ${editing
              ? `<input class="cl-edit-input" value="${log.pages || ''}" oninput="_RM.updateCreditLogField('pages',this.value)">`
              : `<div class="cl-section-value cl-handwriting">${log.pages || '—'}</div>`}
          </div>

          ${_renderSummarySection(log, editing)}

          ${_renderExamConnection(log, editing)}

          <div class="cl-section cl-highlight-section">
            <span class="cl-section-label">⭐ 선생님 강조 포인트</span>
            ${editing
              ? `<textarea class="cl-edit-textarea" rows="3" oninput="_RM.updateCreditLogField('highlights',this.value)">${log.highlights || ''}</textarea>`
              : `<div class="cl-section-value cl-handwriting">${renderMath(markKeywords((log.highlights || '—').replace(/\n/g, '<br>'), kw))}</div>`}
          </div>

          ${_renderDeepDive(log, editing)}

          <div class="cl-section">
            <span class="cl-section-label">🔑 오늘 수업의 핵심 키워드 <span style="color:var(--text-muted);font-weight:400">(최대 5개)</span></span>
            <div class="cl-keywords">${_renderKeywords(log.keywords, editing)}</div>
          </div>

          <div class="cl-section cl-questions-section">
            <span class="cl-section-label">💡 세특 소재 질문</span>
            ${questions.map((q, i) => _renderQuestionPair(q, i, editing, kw)).join('')}
          </div>

          ${_renderActiveRecall(log)}

          ${_renderTeacherInsight(log, editing)}

          ${_renderAssignmentSection(log, editing)}
        </div>

        <div class="cl-action-bar">
          <button class="cl-edit-toggle" onclick="_RM.toggleCreditLogEdit()">
            <i class="fas fa-${editing ? 'check' : 'pen'}" style="margin-right:6px"></i>
            ${editing ? '수정 완료' : '수정하기'}
          </button>
          <button class="cl-pdf-btn" onclick="_RM.downloadCreditLogPDF()">
            <i class="fas fa-file-pdf" style="margin-right:6px"></i>PDF로 저장
          </button>
        </div>

        <button class="btn-primary cl-save-btn" onclick="_RM.saveCreditLog()">
          기록 완료 +15 XP ✨
        </button>
      </div>
    </div>
  `;
}
