/* ================================================================
   Records Module — views/aha-report-result.js
   아하 리포트 AI 분석 로딩 + 5섹션 결과 + 피드백
   2개 렌더러 export: renderAhaLoading, renderAhaResult
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { navigate } from '../core/router.js';
import { events, EVENTS } from '../core/events.js';
import { kstToday, renderMath } from '../core/utils.js';
import { showXpPopup } from '../components/xp-popup.js';
import { generateAhaReportPDF } from '../components/pdf-generator.js';

export function registerHandlers(RM) {
  RM.toggleAhaEdit = () => toggleEdit();
  RM.updateAhaField = (field, value) => updateField(field, value);
  RM.updateAhaPaItem = (idx, value) => updatePaItem(idx, value);
  RM.addAhaPaItem = () => addPaItem();
  RM.removeAhaPaItem = (idx) => removePaItem(idx);
  RM.updateAhaPpaField = (field, value) => updatePpaField(field, value);
  RM.requestAhaFeedback = () => requestFeedback();
  RM.saveAhaReport = () => saveReport();
  RM.retryAhaAnalysis = () => retryAnalysis();
  RM.downloadAhaPDF = () => downloadPDF();
}

// === AI 분석 ===
async function runAnalysis() {
  const photos = state._ahaPhotos || [];
  const tags = state._ahaPhotoTags || [];
  const notePhotos = photos.filter((_, i) => tags[i] === 'note');

  if (notePhotos.length === 0) {
    state._ahaAnalyzing = false;
    state._ahaAnalysisStep = 'error';
    navigate(state.currentScreen, { replace: true });
    return;
  }

  try {
    const result = await DB.analyzeAhaReport(
      notePhotos,
      state._ahaSubject || '',
      state._ahaSource || '',
      state._ahaDate || kstToday()
    );

    if (result) {
      state._ahaResult = result;
      state._ahaAnalyzing = false;
      state._ahaAnalysisStep = '';
      navigate('aha-result', { replace: true });
    } else {
      state._ahaAnalyzing = false;
      state._ahaAnalysisStep = 'error';
      navigate(state.currentScreen, { replace: true });
    }
  } catch (e) {
    console.error('AHA analysis failed:', e);
    state._ahaAnalyzing = false;
    state._ahaAnalysisStep = 'error';
    navigate(state.currentScreen, { replace: true });
  }
}

function retryAnalysis() {
  state._ahaAnalyzing = true;
  state._ahaAnalysisStep = 'analyzing';
  navigate('aha-loading', { replace: true });
}

function toggleEdit() {
  state._ahaEditing = !state._ahaEditing;
  navigate(state.currentScreen, { replace: true });
}

function updateField(field, value) {
  if (!state._ahaResult) return;
  state._ahaResult[field] = value;
}

function updatePaItem(idx, value) {
  if (!state._ahaResult || !state._ahaResult.pa) return;
  state._ahaResult.pa[idx] = value;
}

function addPaItem() {
  if (!state._ahaResult) return;
  if (!state._ahaResult.pa) state._ahaResult.pa = [];
  state._ahaResult.pa.push('');
  navigate(state.currentScreen, { replace: true });
}

function removePaItem(idx) {
  if (!state._ahaResult || !state._ahaResult.pa) return;
  state._ahaResult.pa.splice(idx, 1);
  navigate(state.currentScreen, { replace: true });
}

function updatePpaField(field, value) {
  if (!state._ahaResult) return;
  if (!state._ahaResult.ppa) state._ahaResult.ppa = {};
  state._ahaResult.ppa[field] = value;
}

async function requestFeedback() {
  const r = state._ahaResult;
  if (!r) return;
  state._ahaFeedbackLoading = true;
  navigate(state.currentScreen, { replace: true });

  try {
    const feedback = await DB.getAhaFeedback({
      sa: r.sa || '',
      pa: r.pa || [],
      da: r.da || '',
      poa: r.poa || '',
      ppa: r.ppa || {},
      subject: state._ahaSubject || '',
    });
    state._ahaFeedback = feedback;
  } catch (e) {
    console.error('AHA feedback failed:', e);
    state._ahaFeedback = '피드백을 가져오지 못했습니다. 다시 시도해주세요.';
  }
  state._ahaFeedbackLoading = false;
  navigate(state.currentScreen, { replace: true });
}

async function saveReport() {
  const r = state._ahaResult;
  if (!r) return;

  const subject = state._ahaSubject || r.subject_detected || '';
  const source = state._ahaSource || '';
  const date = state._ahaDate || kstToday();
  const photos = state._ahaPhotos || [];
  const photoTags = state._ahaPhotoTags || [];

  const reportId = await DB.saveAhaReport({
    subject,
    source,
    date,
    photos,
    photo_tags: JSON.stringify(photoTags),
    section_sa: r.sa || '',
    section_pa: JSON.stringify(r.pa || []),
    section_da: r.da || '',
    section_poa: r.poa || '',
    section_ppa: JSON.stringify(r.ppa || {}),
    ai_feedback: state._ahaFeedback || '',
    ai_source: r.ai_source || 'gemini',
    subject_detected: r.subject_detected || '',
    student_name: r.student_name || '',
  });

  // PA 질문 → 나의 질문함 자동 등록
  const paQuestions = r.pa || [];
  if (paQuestions.length > 0) {
    for (const q of paQuestions) {
      if (!q || q.trim().length < 2) continue;
      await DB.saveMyQuestion({
        subject,
        source: 'aha_report',
        title: q,
        date,
        skipXp: true,
      });
    }
  }

  // 크로켓 포인트 지급
  try {
    await fetch('/api/aha-report/give-croquet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId: state.studentId, subject }),
    });
  } catch (_) {}

  // 리셋
  state._ahaPhotos = [];
  state._ahaPhotoTags = [];
  state._ahaResult = null;
  state._ahaEditing = false;
  state._ahaFeedback = null;
  state._ahaFeedbackLoading = false;
  state._ahaSubject = '';
  state._ahaSource = '';
  state._ahaDate = '';

  showXpPopup(15, '아하 리포트 완료!');
  events.emit(EVENTS.XP_EARNED, { amount: 15, label: '아하 리포트 완료!' });
  navigate('aha-list');
}

function downloadPDF() {
  const r = state._ahaResult;
  if (!r) return;
  generateAhaReportPDF(r, state._ahaSubject || '', state._ahaDate || kstToday(), state._ahaFeedback || '');
}

function nl2br(text) {
  return (text || '').replace(/\n/g, '<br>');
}

// === 단계별 로딩 메시지 ===
const AHA_LOADING_STEPS = [
  { time: 0,  message: "노트를 읽고 있어요...",           emoji: "✍️",  progress: 5 },
  { time: 5,  message: "탐구 흐름을 파악하고 있어요...",   emoji: "🔍",  progress: 25 },
  { time: 12, message: "아하 포인트를 찾고 있어요...",     emoji: "💡",  progress: 50 },
  { time: 20, message: "피드백을 작성하고 있어요...",      emoji: "✨",  progress: 75 },
  { time: 27, message: "거의 다 됐어요...",               emoji: "🎯",  progress: 90 },
];

let _ahaLoadingTimers = [];

function startAhaLoadingSteps() {
  _ahaLoadingTimers.forEach(t => clearTimeout(t));
  _ahaLoadingTimers = [];

  AHA_LOADING_STEPS.forEach((step) => {
    const timer = setTimeout(() => {
      const msgEl = document.getElementById('al-loading-msg');
      const emojiEl = document.getElementById('al-loading-emoji');
      const fillEl = document.getElementById('al-progress-fill');
      if (!msgEl || !emojiEl) return;

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
    _ahaLoadingTimers.push(timer);
  });
}

// === 로딩 화면 ===
export function renderAhaLoading() {
  const isError = state._ahaAnalysisStep === 'error';

  if (state._ahaAnalyzing && state._ahaAnalysisStep === 'analyzing') {
    setTimeout(() => {
      startAhaLoadingSteps();
      runAnalysis();
    }, 100);
  }

  if (isError) {
    _ahaLoadingTimers.forEach(t => clearTimeout(t));
    _ahaLoadingTimers = [];
  }

  return `
    <div class="full-screen animate-slide">
      <div class="al-container">
        ${isError ? `
          <div class="al-error-icon">⚠️</div>
          <div class="al-step-text" style="color:#FF6B6B">AI 분석에 실패했습니다</div>
          <p style="color:var(--text-muted);font-size:13px;margin:12px 0 24px">네트워크 상태를 확인하고 다시 시도해주세요</p>
          <button class="btn-primary" onclick="_RM.retryAhaAnalysis()" style="width:auto;padding:12px 32px">
            <i class="fas fa-redo" style="margin-right:8px"></i>다시 시도
          </button>
          <button class="pu-skip-btn" onclick="_RM.nav('aha-input')" style="margin-top:12px">
            ← 사진 업로드로 돌아가기
          </button>
        ` : `
          <span class="al-loading-emoji" id="al-loading-emoji">✍️</span>
          <p class="al-loading-message" id="al-loading-msg">노트를 읽고 있어요...</p>
          <p class="al-loading-subtitle">아하 리포트를 정리합니다</p>
          <div class="al-progress-bar">
            <div class="al-progress-fill" id="al-progress-fill"></div>
          </div>
        `}
      </div>
    </div>
  `;
}

// === 결과 화면 ===
export function renderAhaResult() {
  const r = state._ahaResult;
  const editing = state._ahaEditing;
  const subject = state._ahaSubject || r?.subject_detected || '';
  const feedbackLoading = state._ahaFeedbackLoading;
  const feedback = state._ahaFeedback;

  if (!r) {
    return `
      <div class="full-screen animate-slide">
        <div class="al-container">
          <p style="color:var(--text-muted)">분석 결과가 없습니다</p>
          <button class="btn-primary" onclick="_RM.nav('aha-input')">← 다시 시도</button>
        </div>
      </div>`;
  }

  const pa = r.pa || [];
  const ppa = r.ppa || {};

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('aha-input')"><i class="fas fa-arrow-left"></i></button>
        <h1>아하 리포트</h1>
        ${subject ? `<span class="header-badge">${subject}</span>` : ''}
      </div>
      <div class="form-body">
        <div class="aha-result-card">
          <div class="aha-result-title-section">
            <div class="aha-result-title">아하 리포트</div>
            <div class="aha-result-subtitle">AHA REPORT</div>
            <div class="aha-result-meta">${subject ? subject + ' · ' : ''}${state._ahaDate || kstToday()}</div>
          </div>

          <!-- SA: 문제상황 -->
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(255,107,107,0.15);color:#FF6B6B">SA</span>
              <span class="aha-section-label">문제상황</span>
            </div>
            ${editing
              ? `<textarea class="cl-edit-textarea" rows="3" oninput="_RM.updateAhaField('sa',this.value)">${r.sa || ''}</textarea>`
              : `<div class="aha-section-content">${renderMath(nl2br(r.sa)) || '<span class="text-muted">(내용 없음)</span>'}</div>`}
          </div>

          <!-- PA: 탐구질문 -->
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(108,92,231,0.15);color:#A29BFE">PA</span>
              <span class="aha-section-label">탐구질문</span>
            </div>
            <div class="aha-pa-list">
              ${pa.map((q, i) => `
                <div class="aha-pa-item">
                  <span class="aha-pa-num">Q${i + 1}</span>
                  ${editing
                    ? `<input class="cl-edit-input" value="${(q || '').replace(/"/g, '&quot;')}" oninput="_RM.updateAhaPaItem(${i},this.value)" style="flex:1">
                       <button class="aha-pa-remove" onclick="_RM.removeAhaPaItem(${i})">&times;</button>`
                    : `<span class="aha-pa-text">${renderMath(q || '')}</span>`}
                </div>
              `).join('')}
              ${editing ? `
                <button class="aha-pa-add" onclick="_RM.addAhaPaItem()">
                  <i class="fas fa-plus" style="margin-right:6px"></i>질문 추가
                </button>
              ` : ''}
            </div>
          </div>

          <!-- DA: 탐구과정 & 결론 -->
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(0,184,148,0.15);color:#00B894">DA</span>
              <span class="aha-section-label">탐구과정 & 결론</span>
            </div>
            ${editing
              ? `<textarea class="cl-edit-textarea" rows="4" oninput="_RM.updateAhaField('da',this.value)">${r.da || ''}</textarea>`
              : `<div class="aha-section-content">${renderMath(nl2br(r.da)) || '<span class="text-muted">(내용 없음)</span>'}</div>`}
          </div>

          <!-- POA: 아하포인트 -->
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(253,203,110,0.15);color:#FECA57">POA</span>
              <span class="aha-section-label">아하포인트</span>
            </div>
            ${editing
              ? `<textarea class="cl-edit-textarea" rows="3" oninput="_RM.updateAhaField('poa',this.value)">${r.poa || ''}</textarea>`
              : `<div class="aha-section-content">${renderMath(nl2br(r.poa)) || '<span class="text-muted">(내용 없음)</span>'}</div>`}
          </div>

          <!-- PPA: 성찰 -->
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(116,185,255,0.15);color:#74B9FF">PPA</span>
              <span class="aha-section-label">성찰</span>
            </div>
            ${editing ? `
              <div class="aha-ppa-edit">
                <label class="aha-ppa-label">전후 생각 변화</label>
                <textarea class="cl-edit-textarea" rows="2" oninput="_RM.updateAhaPpaField('change',this.value)">${ppa.change || ''}</textarea>
                <label class="aha-ppa-label" style="margin-top:8px">부족했던 것</label>
                <textarea class="cl-edit-textarea" rows="2" oninput="_RM.updateAhaPpaField('lacking',this.value)">${ppa.lacking || ''}</textarea>
              </div>
            ` : `
              <div class="aha-ppa-content">
                ${ppa.change ? `<div class="aha-ppa-row"><span class="aha-ppa-icon">🔄</span><div><strong>전후 생각 변화</strong><p>${renderMath(nl2br(ppa.change))}</p></div></div>` : ''}
                ${ppa.lacking ? `<div class="aha-ppa-row"><span class="aha-ppa-icon">📌</span><div><strong>부족했던 것</strong><p>${renderMath(nl2br(ppa.lacking))}</p></div></div>` : ''}
                ${!ppa.change && !ppa.lacking ? '<span class="text-muted">(내용 없음)</span>' : ''}
              </div>
            `}
          </div>
        </div>

        <!-- 피드백 섹션 -->
        <div class="aha-feedback-section">
          ${feedback ? `
            <div class="aha-feedback-card">
              <div class="aha-feedback-header">
                <span class="aha-feedback-icon">🎯</span>
                <span class="aha-feedback-title">아하 리포트 피드백</span>
              </div>
              <div class="aha-feedback-body">${renderMath(nl2br(feedback))}</div>
            </div>
          ` : feedbackLoading ? `
            <div class="aha-feedback-loading">
              <i class="fas fa-spinner fa-spin" style="margin-right:8px"></i>피드백을 생성하고 있어요...
            </div>
          ` : `
            <button class="aha-feedback-btn" onclick="_RM.requestAhaFeedback()">
              <i class="fas fa-comment-dots" style="margin-right:8px"></i>AI 피드백 받기
            </button>
          `}
        </div>

        <!-- 액션 바 -->
        <div class="cl-action-bar">
          <button class="cl-edit-toggle" onclick="_RM.toggleAhaEdit()">
            <i class="fas fa-${editing ? 'check' : 'pen'}" style="margin-right:6px"></i>
            ${editing ? '수정 완료' : '수정하기'}
          </button>
          <button class="cl-pdf-btn" onclick="_RM.downloadAhaPDF()">
            <i class="fas fa-file-pdf" style="margin-right:6px"></i>PDF로 저장
          </button>
        </div>

        <button class="btn-primary cl-save-btn" onclick="_RM.saveAhaReport()">
          기록 완료 +15 XP ✨
        </button>
      </div>
    </div>
  `;
}
