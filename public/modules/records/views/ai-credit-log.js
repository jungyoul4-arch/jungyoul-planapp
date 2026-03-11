/* ================================================================
   Records Module — views/ai-credit-log.js
   AI 분석 로딩 + MY CREDIT LOG 결과 표시 + PDF 저장
   2개 렌더러 export: renderAiLoading, renderAiResult
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { navigate } from '../core/router.js';
import { events, EVENTS } from '../core/events.js';
import { kstToday, kstDateOffset, getSubjectColor, markKeywords, renderMath, generatePlanSteps, isSimpleAssignment, SUBJECT_COLOR_MAP, showToast } from '../core/utils.js';
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
  RM.toggleSeteukResolved = (idx) => {
    if (!state._aiCreditLog?.seteuk_questions?.[idx]) return;
    state._aiCreditLog.seteuk_questions[idx].resolved = !state._aiCreditLog.seteuk_questions[idx].resolved;
    navigate(state.currentScreen, { replace: true });
  };
  RM.toggleAssignmentDone = () => {
    if (!state._aiCreditLog?.assignment) return;
    state._aiCreditLog.assignment.done = !state._aiCreditLog.assignment.done;
    navigate(state.currentScreen, { replace: true });
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
      state._aiErrorMsg = 'AI 서버가 응답하지 않았어요. 잠시 후 다시 시도해주세요.';
      navigate(state.currentScreen, { replace: true });
    }
  } catch (e) {
    console.error('AI analysis failed:', e);
    state._aiAnalyzing = false;
    state._aiAnalysisStep = 'error';
    if (e.message?.includes('시간 초과')) {
      state._aiErrorMsg = '분석 시간이 초과되었어요. 다시 시도해주세요.';
    } else if (e.message?.includes('AI 서버') || e.message?.includes('AI 응답') || e.message?.includes('모든 AI')) {
      state._aiErrorMsg = e.message;
    } else {
      state._aiErrorMsg = '네트워크 오류가 발생했어요. 인터넷 연결을 확인해주세요.';
    }
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

  // 중복 저장 방지
  if (state._savingCreditLog) return;
  state._savingCreditLog = true;

  // 저장 버튼 즉시 시각 피드백
  const saveBtn = document.querySelector('.cl-save-btn');
  if (saveBtn) {
    saveBtn.classList.add('saving');
    saveBtn.textContent = '저장 중...';
  }

  const log = state._aiCreditLog;
  const subject = record.subject;
  const period = record.period;
  const date = state._backfillDate || kstToday();
  const photos = [...(state._classPhotos || [])]; // 사본 보관 (비동기 업로드용)
  const tags = [...(state._classPhotoTags || [])];
  const normalizedTags = tags.map(t => t === '필기' ? '필기' : '참고');
  const hasAssignment = log.assignment && typeof log.assignment === 'object' && log.assignment.title;

  try {
    // 1단계: 메인 레코드 저장 (사진 제외 — 빠름)
    const recordId = await DB.saveClassRecord({
      subject, date,
      content: log.topic || '',
      keywords: log.keywords || [],
      understanding: 3,
      memo: JSON.stringify({ period, pages: log.pages || '', teacherNote: log.highlights || '', photoCount: photos.length }),
      topic: log.topic || '', pages: log.pages || '',
      photos, teacher_note: log.highlights || '',
      ai_credit_log: log, photo_tags: normalizedTags,
    });

    // DB 저장 실패 시 에러 표시 + 현재 화면 유지
    if (!recordId) {
      state._savingCreditLog = false;
      if (saveBtn) {
        saveBtn.classList.remove('saving');
        saveBtn.textContent = '기록 완료 +15 XP ✨';
      }
      showToast('⚠️', '기록 저장에 실패했습니다. 다시 시도해주세요.');
      return;
    }

    // 2단계: DB 저장 성공 확인 후 todayRecords 업데이트 + 대시보드 이동
    record.done = true;
    record._dbRecordId = recordId;
    record.summary = log.topic || log.keywords?.join(', ') || '수업 기록 완료';

    if (state.missions && state.missions[0]) {
      state.missions[0].current = state.todayRecords.filter(r => r.done).length;
      if (state.missions[0].current >= state.missions[0].target) state.missions[0].done = true;
    }

    // 리셋 + 즉시 대시보드 이동
    state._savingCreditLog = false;
    state._classPhotos = [];
    state._classPhotoTags = [];
    state._aiCreditLog = null;
    state._aiCreditLogEditing = false;
    state._studentComment = '';
    state._selectedPeriodIdx = null;

    const xpLabel = hasAssignment ? 'MY CREDIT LOG 완료! + 과제 자동 등록' : 'MY CREDIT LOG 완료!';
    showXpPopup(15, xpLabel);
    events.emit(EVENTS.XP_EARNED, { amount: 15, label: xpLabel });
    navigate('dashboard');

    // 3단계: 백그라운드에서 부가 작업 (과제 등록, 질문 등록)
    // 사용자는 이미 대시보드에서 다른 작업 가능
    _backgroundTasks(log, subject, period, date, record, recordId, hasAssignment).catch(e => {
      console.error('backgroundTasks error:', e);
    });

  } catch (e) {
    console.error('saveCreditLog error:', e);
    state._savingCreditLog = false;
    if (saveBtn) {
      saveBtn.classList.remove('saving');
      saveBtn.textContent = '기록 완료 +15 XP ✨';
    }
    showToast('⚠️', '저장에 실패했어요. 다시 시도해주세요.');
  }
}

// 백그라운드 부가 작업 (과제/질문 등록)
async function _backgroundTasks(log, subject, period, date, record, recordId, hasAssignment) {
  // 과제 자동 등록
  if (hasAssignment) {
    const asg = log.assignment;
    const dueDate = asg.dueDate || kstDateOffset(7);
    const color = SUBJECT_COLOR_MAP[subject] || '#636e72';
    const simple = isSimpleAssignment(asg.title);
    const planData = simple ? [] : generatePlanSteps(dueDate);

    const dbId = await DB.saveAssignment({
      subject, title: asg.title,
      description: asg.description || '',
      teacherName: record.teacher || '',
      dueDate, color, planData,
    });

    if (dbId) {
      const assignments = state.assignments || [];
      assignments.push({
        id: String(dbId), _dbId: dbId, subject,
        title: asg.title, desc: asg.description || '',
        teacher: record.teacher || '', dueDate,
        createdDate: date, color, status: 'pending',
        progress: 0, plan: planData, simple,
      });
      state.assignments = [...assignments];
      showToast('📌', `과제 "${asg.title}" 자동 등록 완료!`);
    }
  }

  // 세특 질문 → 나의 질문함 자동 등록 (신형식: seteuk_questions / 구형식: questions)
  const seteukQs = log.seteuk_questions || [];
  const legacyQs = log.questions || [];
  const questionsToSave = seteukQs.length > 0 ? seteukQs : legacyQs;
  if (questionsToSave.length > 0 && recordId) {
    for (const q of questionsToSave) {
      const title = q.q || q.original || '';
      if (!title || title.trim().length < 2) continue;
      await DB.saveMyQuestion({
        subject, source: '수업', title,
        aiImproved: q.reason || q.improved || null, classRecordId: recordId,
        period, date, skipXp: true,
      });
    }
  }
}

function downloadPDF() {
  const record = state.todayRecords[state._selectedPeriodIdx];
  const log = state._aiCreditLog;
  if (!log) return;
  generateCreditLogPDF(log, record?.subject || '', state._backfillDate || kstToday(), state.studentName || '');
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
          <p style="color:var(--text-muted);font-size:13px;margin:12px 0 24px">${state._aiErrorMsg || '네트워크 상태를 확인하고 다시 시도해주세요'}</p>
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

// === 결과 화면 헬퍼 (신형식 양식지 스타일) ===
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

function _renderSeteukQuestions(log, editing) {
  const qs = log.seteuk_questions || [];
  if (qs.length === 0) return '<div style="color:var(--text-muted);padding:8px 0;font-size:13px">질문 없음</div>';
  return qs.map((q, i) => `
    <div class="cl-seteuk-item" style="padding:14px 0;${i < qs.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
      <div style="display:flex;align-items:flex-start;gap:10px">
        <button onclick="_RM.toggleSeteukResolved(${i})" style="flex-shrink:0;width:24px;height:24px;border-radius:6px;border:2px solid ${q.resolved ? 'var(--success)' : 'var(--border)'};background:${q.resolved ? 'var(--success)' : 'transparent'};cursor:pointer;display:flex;align-items:center;justify-content:center;margin-top:2px;transition:all 0.2s">
          ${q.resolved ? '<i class="fas fa-check" style="color:white;font-size:11px"></i>' : ''}
        </button>
        <div style="flex:1;min-width:0">
          <div style="font-size:14px;font-weight:600;color:${q.resolved ? 'var(--text-muted)' : 'var(--text-primary)'};${q.resolved ? 'text-decoration:line-through;opacity:0.6' : ''}">${renderMath(q.q)}</div>
          ${q.reason ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:6px;line-height:1.5"><i class="fas fa-lightbulb" style="color:#FECA57;margin-right:4px;font-size:10px"></i><strong>왜?</strong> ${q.reason}</div>` : ''}
          ${q.guide ? `<div style="font-size:12px;color:var(--primary-light);margin-top:4px;line-height:1.5;padding:6px 10px;background:rgba(99,102,241,0.08);border-radius:6px"><i class="fas fa-compass" style="margin-right:4px;font-size:10px"></i><strong>탐구 방향:</strong> ${q.guide}</div>` : ''}
        </div>
        <span class="cl-question-num" style="flex-shrink:0">Q${i + 1}</span>
      </div>
    </div>
  `).join('');
}

function _renderQuiz(log) {
  const quiz = log.quiz || [];
  // 하위호환: 구형식 exam_questions (문자열 배열)
  const legacy = log.exam_questions || [];
  if (quiz.length === 0 && legacy.length === 0) return '';

  if (quiz.length > 0) {
    return `
      <div class="cl-section cl-exam-section">
        <span class="cl-section-label">📝 예상 퀴즈</span>
        <div class="cl-quiz-list">
          ${quiz.map((q, i) => `
            <div class="cl-quiz-item" style="padding:12px 0;${i < quiz.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
              <div style="display:flex;align-items:flex-start;gap:10px">
                <span class="cl-exam-num">${i + 1}</span>
                <div style="flex:1;min-width:0">
                  <div style="font-size:14px;font-weight:500;color:var(--text-primary);line-height:1.5">${renderMath(q.question)}</div>
                  <button onclick="_RM.toggleRecallAnswer(${i})" style="margin-top:8px;padding:6px 14px;border-radius:6px;border:1px solid var(--border);background:rgba(255,255,255,0.05);color:var(--text-secondary);font-size:12px;cursor:pointer;transition:all 0.2s">
                    <i class="fas fa-eye" style="margin-right:4px"></i>정답·해설 보기
                  </button>
                  <div id="recall-answer-${i}" style="display:none;margin-top:8px;padding:10px 12px;background:rgba(99,102,241,0.06);border-radius:8px;border-left:3px solid var(--primary-light)">
                    ${q.answer ? `<div style="font-size:13px;font-weight:600;color:var(--success);margin-bottom:4px"><i class="fas fa-check-circle" style="margin-right:4px"></i>정답: ${renderMath(q.answer)}</div>` : ''}
                    ${q.explanation ? `<div style="font-size:12px;color:var(--text-secondary);line-height:1.5">${renderMath(q.explanation)}</div>` : ''}
                  </div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>`;
  }

  // 하위호환: 문자열 배열
  return `
    <div class="cl-section cl-exam-section">
      <span class="cl-section-label">📝 예상 시험 문제</span>
      <div class="cl-exam-list">
        ${legacy.map((item, i) => `
          <div class="cl-exam-item">
            <span class="cl-exam-num">${i + 1}</span>
            <span class="cl-exam-text">${renderMath(item)}</span>
          </div>
        `).join('')}
      </div>
    </div>`;
}

function _renderAssignmentSection(log, editing) {
  const asg = log.assignment;
  if (!asg) {
    return `
      <div class="cl-section cl-assignment-section">
        <span class="cl-section-label">📌 과제</span>
        <div class="cl-section-value cl-handwriting" style="color:var(--text-muted)">과제 없음 (미확인)</div>
      </div>`;
  }
  if (typeof asg === 'object') {
    if (editing) {
      return `
        <div class="cl-section cl-assignment-section">
          <span class="cl-section-label">📌 과제</span>
          <div class="cl-assignment-card">
            <label style="font-size:12px;color:var(--text-secondary);margin-bottom:4px;display:block">과제 제목</label>
            <input class="cl-edit-input" value="${asg.title || ''}" oninput="_RM.updateAssignmentField('title',this.value)">
            <label style="font-size:12px;color:var(--text-secondary);margin:8px 0 4px;display:block">상세 내용</label>
            <textarea class="cl-edit-textarea" rows="2" oninput="_RM.updateAssignmentField('description',this.value)">${asg.description || ''}</textarea>
            <label style="font-size:12px;color:var(--text-secondary);margin:8px 0 4px;display:block">마감일</label>
            <input class="cl-edit-input" type="date" value="${asg.dueDate || ''}" oninput="_RM.updateAssignmentField('dueDate',this.value)" style="color:var(--text-primary)">
          </div>
        </div>`;
    }
    return `
      <div class="cl-section cl-assignment-section">
        <span class="cl-section-label">📌 과제</span>
        <div class="cl-assignment-card" style="display:flex;align-items:flex-start;gap:10px">
          <button onclick="_RM.toggleAssignmentDone()" style="flex-shrink:0;width:24px;height:24px;border-radius:6px;border:2px solid ${asg.done ? 'var(--success)' : 'var(--border)'};background:${asg.done ? 'var(--success)' : 'transparent'};cursor:pointer;display:flex;align-items:center;justify-content:center;margin-top:2px;transition:all 0.2s">
            ${asg.done ? '<i class="fas fa-check" style="color:white;font-size:11px"></i>' : ''}
          </button>
          <div style="flex:1">
            <div class="cl-assignment-title" style="${asg.done ? 'text-decoration:line-through;opacity:0.6' : ''}">${asg.title || asg.content || ''}</div>
            ${asg.description ? `<div class="cl-assignment-desc">${asg.description}</div>` : ''}
            ${asg.dueDate || asg.due ? `<div class="cl-assignment-due"><i class="fas fa-calendar-alt" style="margin-right:6px"></i>마감일: ${asg.dueDate || asg.due}</div>` : ''}
            <div class="cl-assignment-auto-badge"><i class="fas fa-check-circle" style="margin-right:4px"></i>저장 시 과제로 자동 등록됩니다</div>
          </div>
        </div>
      </div>`;
  }
  return `
    <div class="cl-section cl-assignment-section">
      <span class="cl-section-label">📌 과제</span>
      <div class="cl-section-value cl-handwriting">${asg}</div>
    </div>`;
}

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

// === 결과 화면 렌더러 (양식지 스타일) ===
export function renderAiResult() {
  const log = state._aiCreditLog;
  const editing = state._aiCreditLogEditing;
  const record = state.todayRecords[state._selectedPeriodIdx];
  const subject = record ? record.subject : '';
  const period = record ? record.period : '';

  if (!log) {
    return `
      <div class="full-screen animate-slide">
        <div class="al-container">
          <p style="color:var(--text-muted)">분석 결과가 없습니다</p>
          <button class="btn-primary" onclick="_RM.nav('photo-upload')">← 다시 시도</button>
        </div>
      </div>`;
  }

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

          <!-- 1. 단원/주제 + 교과서 -->
          <div class="cl-section">
            <span class="cl-section-label">📖 단원 / 주제</span>
            ${editing
              ? `<input class="cl-edit-input" value="${log.topic || ''}" oninput="_RM.updateCreditLogField('topic',this.value)">`
              : `<div class="cl-section-value cl-handwriting">${log.topic || '—'}${log.pages ? ` <span style="color:var(--text-muted);font-size:12px">(${log.pages})</span>` : ''}</div>`}
          </div>
          ${editing ? `
          <div class="cl-section">
            <span class="cl-section-label">📚 교과서</span>
            <input class="cl-edit-input" value="${log.pages || ''}" oninput="_RM.updateCreditLogField('pages',this.value)">
          </div>` : ''}

          <!-- 2. ⭐ 선생님 강조 포인트 -->
          <div class="cl-section cl-highlight-section">
            <span class="cl-section-label">⭐ 선생님 강조 포인트</span>
            ${editing
              ? `<textarea class="cl-edit-textarea" rows="3" oninput="_RM.updateCreditLogField('highlights',this.value)">${log.highlights || ''}</textarea>`
              : `<div class="cl-section-value cl-handwriting">${renderMath(markKeywords((log.highlights || '—').replace(/\n/g, '<br>'), kw))}</div>`}
          </div>

          <!-- 3. 🔑 핵심 키워드 -->
          <div class="cl-section">
            <span class="cl-section-label">🔑 오늘 수업의 핵심 키워드 <span style="color:var(--text-muted);font-weight:400">(최대 5개)</span></span>
            <div class="cl-keywords">${_renderKeywords(log.keywords, editing)}</div>
          </div>

          <!-- 4. 💡 세특 소재 질문 -->
          <div class="cl-section cl-questions-section">
            <span class="cl-section-label">💡 세특 소재 질문</span>
            ${_renderSeteukQuestions(log, editing)}
          </div>

          <!-- 5. 📝 예상 퀴즈 -->
          ${_renderQuiz(log)}

          <!-- 6. 📌 과제 -->
          ${_renderAssignmentSection(log, editing)}
        </div>

        <div class="cl-action-bar">
          <button class="cl-edit-toggle" onclick="_RM.toggleCreditLogEdit()">
            <i class="fas fa-${editing ? 'check' : 'pen'}" style="margin-right:6px"></i>
            ${editing ? '수정 완료' : '수정하기'}
          </button>
          <button class="cl-pdf-btn" onclick="_RM.downloadCreditLogPDF()">
            <i class="fas fa-print" style="margin-right:6px"></i>인쇄물 보기
          </button>
        </div>

        <button class="btn-primary cl-save-btn" onclick="_RM.saveCreditLog()">
          기록 완료 +15 XP ✨
        </button>
      </div>
    </div>
  `;
}
