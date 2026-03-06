/* ================================================================
   Records Module — views/exam-list.js
   시험 목록 화면
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';
import { getDday } from '../core/utils.js';

function getExamTypeLabel(type) {
  const map = { midterm:'중간고사', final:'기말고사', mock:'모의고사', performance:'수행평가' };
  return map[type] || type;
}
function getExamTypeIcon(type) {
  const map = { midterm:'📘', final:'📕', mock:'📗', performance:'📝' };
  return map[type] || '📝';
}

export function registerHandlers(RM) {
  RM.resetExamAddState = () => {
    state._examAddMode = null;
    state._eaMidtermType = 'midterm';
    state._eaMidtermName = '';
    state._eaMidtermStart = '';
    state._eaMidtermEnd = '';
    state._eaMidtermSubjects = {};
    state._eaMidtermPeriodCount = 4;
    state._eaPerfSubject = '';
    state._eaPerfName = '';
    state._eaPerfDeadline = '';
    state._eaPerfTopic = '';
    state._eaPerfMemo = '';
    state._eaMockPreset = '';
    state._eaMockName = '';
    state._eaMockDate = '';
  };
  RM.getExamTypeLabel = getExamTypeLabel;
  RM.getExamTypeIcon = getExamTypeIcon;
}

export function renderExamList() {
  const upcoming = (state.exams || []).filter(e => e.status !== 'completed').sort((a,b) => (a.startDate||'').localeCompare(b.startDate||''));
  const completed = (state.exams || []).filter(e => e.status === 'completed');

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>🎯 시험 관리</h1>
        <button class="header-action-btn" onclick="_RM.resetExamAddState();_RM.nav('exam-add')" title="시험 추가"><i class="fas fa-plus"></i></button>
      </div>
      <div class="form-body">

        ${upcoming.length > 0 ? `
        <div class="section-label">다가오는 시험</div>
        ${upcoming.map((ex,i) => {
          const dDay = getDday(ex.startDate);
          const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? 'D-' + dDay : 'D+' + Math.abs(dDay);
          const urgency = dDay <= 3 ? 'urgent' : dDay <= 7 ? 'warning' : 'normal';
          const subs = ex.subjects || [];
          const avgReadiness = subs.length > 0 ? Math.round(subs.reduce((s,sub) => s + (sub.readiness||0), 0) / subs.length) : 0;
          const dateRange = ex.startDate === ex.endDate
            ? (ex.startDate||'').slice(5).replace('-','/')
            : (ex.startDate||'').slice(5).replace('-','/') + ' ~ ' + (ex.endDate||'').slice(5).replace('-','/');
          return `
          <div class="exam-card stagger-${i+1} animate-in" onclick="_RM.state.viewingExam='${ex.id}';_RM.nav('exam-detail')">
            <div class="exam-card-top">
              <div class="exam-card-icon">${getExamTypeIcon(ex.type)}</div>
              <div class="exam-card-info">
                <div class="exam-card-name">${ex.name}</div>
                <div class="exam-card-meta">${getExamTypeLabel(ex.type)} · ${dateRange} · ${subs.length}과목</div>
              </div>
              <div class="exam-card-dday">
                <span class="assignment-dday ${urgency}">${dDayText}</span>
              </div>
            </div>
            <div class="exam-card-subjects">
              ${subs.map(sub => `
                <div class="exam-subject-chip" style="border-left:3px solid ${sub.color||'var(--primary)'}">
                  <span class="exam-subj-name">${sub.subject}</span>
                  <div class="exam-subj-bar"><div class="exam-subj-bar-fill" style="width:${sub.readiness||0}%;background:${sub.color||'var(--primary)'}"></div></div>
                  <span class="exam-subj-pct">${sub.readiness||0}%</span>
                </div>
              `).join('')}
            </div>
            <div class="exam-card-bottom">
              <span class="exam-avg-label">평균 준비도</span>
              <div class="exam-avg-bar"><div class="exam-avg-bar-fill" style="width:${avgReadiness}%;background:${avgReadiness>=60?'#00B894':avgReadiness>=30?'#FDCB6E':'#FF6B6B'}"></div></div>
              <span class="exam-avg-pct" style="color:${avgReadiness>=60?'#00B894':avgReadiness>=30?'#FDCB6E':'#FF6B6B'}">${avgReadiness}%</span>
            </div>
          </div>`;
        }).join('')}
        ` : `
        <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
          <div style="font-size:48px;margin-bottom:12px">🎉</div>
          <div style="font-size:14px">예정된 시험이 없습니다</div>
        </div>
        `}

        ${completed.length > 0 ? `
        <div class="section-label" style="margin-top:20px">지난 시험</div>
        ${completed.map(ex => `
          <div class="exam-card completed" onclick="_RM.state.viewingExam='${ex.id}';_RM.nav('exam-detail')">
            <div class="exam-card-top">
              <div class="exam-card-icon">${getExamTypeIcon(ex.type)}</div>
              <div class="exam-card-info">
                <div class="exam-card-name">${ex.name}</div>
                <div class="exam-card-meta">${getExamTypeLabel(ex.type)} · ${(ex.startDate||'').slice(5).replace('-','/')}</div>
              </div>
              <span style="color:var(--text-muted);font-size:12px">✅ 완료</span>
            </div>
          </div>
        `).join('')}
        ` : ''}

        <button class="btn-primary" style="width:100%;margin-top:20px" onclick="_RM.resetExamAddState();_RM.nav('exam-add')">
          <i class="fas fa-plus" style="margin-right:6px"></i>시험 추가
        </button>

        ${(state.exams||[]).some(e => e.result) ? `
        <button class="btn-secondary" style="width:100%;margin-top:8px;border-color:rgba(108,92,231,0.4);color:#A29BFE" onclick="_RM.nav('growth-analysis')">
          <i class="fas fa-chart-line" style="margin-right:6px"></i>📈 시간축 성장 분석 보기
        </button>
        ` : ''}

      </div>
    </div>
  `;
}
