/* ================================================================
   Records Module — views/activity-add.js
   활동 추가
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { kstToday, kstDateOffset, SUBJECT_LIST, SUBJECT_COLORS_ARRAY, getSubjectColor } from '../core/utils.js';
import { events, EVENTS } from '../core/events.js';
import { navigate } from '../core/router.js';

export function registerHandlers(RM) {
  RM.saveNewActivity = () => saveNewActivity();
  RM.selectActivityType = (el) => selectActivityType(el);
  RM.selectActAddSubject = (el) => selectActAddSubject(el);
}

function selectActivityType(el) {
  document.querySelectorAll('.act-add-type-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function selectActAddSubject(el) {
  document.querySelectorAll('.rpt-add-subject-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
}

function saveNewActivity() {
  const typeBtn = document.querySelector('.act-add-type-btn.active');
  const type = typeBtn ? typeBtn.dataset.type : 'club';
  const title = document.getElementById('act-add-title')?.value?.trim() || '';
  if (!title) {
    const el = document.getElementById('act-add-title');
    if (el) { el.focus(); el.style.borderColor = 'var(--accent)'; setTimeout(() => { el.style.borderColor = ''; }, 2000); }
    return;
  }

  const subjectBtn = document.querySelector('.rpt-add-subject-btn.active');
  const subject = subjectBtn ? subjectBtn.dataset.subject : '기타';
  const color = subjectBtn ? subjectBtn.dataset.color : '#888';
  const startDate = document.getElementById('act-add-start')?.value || kstToday();
  const endDate = document.getElementById('act-add-end')?.value || kstDateOffset(90);
  const description = document.getElementById('act-add-desc')?.value?.trim() || '';
  const careerLink = document.getElementById('act-add-career')?.value?.trim() || '';

  const subType = type === 'club' ? 'club' : type === 'career' ? 'career' : type === 'self' ? 'self' : '';

  const newActivity = {
    id: 'ec-' + Date.now(),
    type: type === 'report' ? 'report' : type === 'reading' ? 'reading' : 'extracurricular',
    subType,
    title, subject, color,
    startDate, endDate, description,
    careerLink,
    status: 'in-progress',
    progress: 0,
    logs: [],
    xpEarned: 0,
  };

  if (type === 'report') {
    newActivity.report = { currentPhase: 0, questions: [], timeline: [] };
  }

  if (!state.extracurriculars) state.extracurriculars = [];
  state.extracurriculars.push(newActivity);

  if (state.studentId) {
    DB.saveActivityRecord({
      activityType: type, title, subject, color,
      startDate, endDate, description, careerLink,
      status: 'in-progress', progress: 0,
    }).then(dbId => {
      if (dbId) {
        newActivity._dbId = dbId;
        newActivity.id = String(dbId);
      }
    });
  }

  navigate('record-activity');
}

export function renderActivityAdd() {
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('record-activity')"><i class="fas fa-arrow-left"></i></button>
        <h1>🏫 새 활동 등록</h1>
      </div>
      <div class="form-body">
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">1</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📂 활동 유형</label>
            <div class="act-add-type-grid" id="act-add-types">
              ${[
                { type: 'club', icon: '🎭', name: '동아리', desc: '교내 동아리 활동' },
                { type: 'career', icon: '🎯', name: '진로활동', desc: '진로 탐색·체험' },
                { type: 'self', icon: '🧠', name: '자율자치', desc: '자율활동·자치활동' },
                { type: 'report', icon: '📄', name: '탐구보고서', desc: '탐구·연구 프로젝트' },
                { type: 'reading', icon: '📖', name: '독서', desc: '독서·독서감상문' },
              ].map((a, i) => `
                <button class="act-add-type-btn ${i === 0 ? 'active' : ''}" data-type="${a.type}" onclick="_RM.selectActivityType(this)">
                  <span class="act-add-type-icon">${a.icon}</span>
                  <span class="act-add-type-name">${a.name}</span>
                  <span class="act-add-type-desc">${a.desc}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">2</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📝 활동명</label>
            <input id="act-add-title" class="input-field" placeholder="예: 코딩동아리, 진로탐색 체험, 독서...">
          </div>
        </div>
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">3</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📚 관련 과목</label>
            <div class="rpt-add-subject-grid">
              ${SUBJECT_LIST.map((s, i) => `
                <button class="rpt-add-subject-btn" data-subject="${s}" data-color="${SUBJECT_COLORS_ARRAY[i]}" onclick="_RM.selectActAddSubject(this)">
                  <span class="rpt-add-subject-dot" style="background:${SUBJECT_COLORS_ARRAY[i]}"></span>${s}
                </button>
              `).join('')}
            </div>
          </div>
        </div>
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">4</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📅 활동 기간</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="act-add-start" type="date" class="input-field" value="${kstToday()}" style="flex:1">
              <span style="color:#666">~</span>
              <input id="act-add-end" type="date" class="input-field" value="${kstDateOffset(90)}" style="flex:1">
            </div>
          </div>
        </div>
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">5</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📋 활동 설명 <span class="field-hint">(선택)</span></label>
            <textarea id="act-add-desc" class="input-field" rows="2" placeholder="활동에 대한 간단한 설명"></textarea>
          </div>
        </div>
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">6</div>
          <div class="rpt-add-step-content">
            <label class="field-label">🔗 진로 연계 <span class="field-hint">(선택)</span></label>
            <input id="act-add-career" class="input-field" placeholder="이 활동이 진로와 어떻게 연결되나요?">
          </div>
        </div>
        <button class="btn-primary" onclick="_RM.saveNewActivity()" style="margin-top:16px">
          🚀 활동 등록하기!
        </button>
      </div>
    </div>
  `;
}
