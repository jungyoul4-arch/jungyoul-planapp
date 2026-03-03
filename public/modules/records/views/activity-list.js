/* ================================================================
   Records Module — views/activity-list.js
   활동 목록
   ================================================================ */

import { state } from '../core/state.js';
import { getSubjectColor } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.setActivityFilter = (filter) => {
    state._activityFilter = filter;
    RM.render();
  };
}

function getFilterKey(type, subType) {
  if (type === 'report') return '탐구보고서';
  if (type === 'reading') return '독서';
  if (subType === 'career') return '진로';
  if (subType === 'self') return '자율자치';
  return '동아리';
}

function getTypeIcon(type, subType) {
  if (type === 'report') return '📄';
  if (type === 'reading') return '📖';
  if (subType === 'career') return '🎯';
  if (subType === 'self') return '🧠';
  return '🎭';
}

export function renderRecordActivity() {
  const ec = state.extracurriculars || [];
  const currentFilter = state._activityFilter || '전체';
  const filters = ['전체', '동아리', '진로', '자율자치', '탐구보고서', '독서'];

  const filtered = currentFilter === '전체' ? ec : ec.filter(e => getFilterKey(e.type, e.subType) === currentFilter);

  const inProgress = ec.filter(e => e.status !== 'completed').length;
  const completed = ec.filter(e => e.status === 'completed').length;
  const totalXp = ec.reduce((sum, e) => sum + (e.xpEarned || 0), 0);

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>🏫 창의적 체험활동</h1>
      </div>
      <div class="form-body">
        <!-- 요약 배너 -->
        <div class="act-summary-banner">
          <div class="act-summary-item">
            <span class="act-summary-num" style="color:var(--primary-light)">${inProgress}</span>
            <span class="act-summary-label">진행중</span>
          </div>
          <div class="act-summary-divider"></div>
          <div class="act-summary-item">
            <span class="act-summary-num" style="color:#00B894">${completed}</span>
            <span class="act-summary-label">완료</span>
          </div>
          <div class="act-summary-divider"></div>
          <div class="act-summary-item">
            <span class="act-summary-num" style="color:var(--xp-gold)">${totalXp}</span>
            <span class="act-summary-label">총 XP</span>
          </div>
        </div>

        <!-- 필터 탭 -->
        <div class="act-filter-tabs">
          ${filters.map(f => {
            const count = f === '전체' ? ec.length : ec.filter(e => getFilterKey(e.type, e.subType) === f).length;
            return `<button class="act-filter-tab ${f === currentFilter ? 'active' : ''}" onclick="_RM.setActivityFilter('${f}')">
              ${f}<span class="act-filter-count">${count}</span>
            </button>`;
          }).join('')}
        </div>

        <!-- 활동 카드 목록 -->
        ${filtered.length === 0 ? `
        <div class="act-empty">
          <div class="act-empty-icon">🏫</div>
          <div class="act-empty-text">등록된 활동이 없어요</div>
          <div class="act-empty-sub">새 활동을 추가해보세요!</div>
          <button class="btn-primary" style="margin-top:16px;padding:10px 24px" onclick="_RM.nav('activity-add')">
            + 활동 추가하기
          </button>
        </div>
        ` : filtered.map(e => {
          const typeIcon = getTypeIcon(e.type, e.subType);
          const typeLabel = getFilterKey(e.type, e.subType);
          const statusClass = e.status === 'completed' ? 'completed' : e.status === 'in-progress' ? 'in-progress' : 'pending';
          const statusLabel = e.status === 'completed' ? '완료' : e.status === 'in-progress' ? '진행중' : '예정';
          const color = e.color || getSubjectColor(e.subject || '기타');
          const onclick = e.type === 'report' && e.report
            ? `state.viewingReport='${e.id}';state.reportPhaseTab=${e.report?.currentPhase || 0};_RM.nav('report-project')`
            : `state.viewingActivity='${e.id}';_RM.nav('activity-detail')`;
          return `
          <div class="act-card" onclick="${onclick}">
            <div class="act-card-left">
              <div class="act-card-type-badge" style="background:${color}15">${typeIcon}</div>
            </div>
            <div class="act-card-body">
              <div class="act-card-top">
                <span class="act-card-type-label" style="color:${color}">${typeLabel}</span>
                <span class="act-card-subject">${e.subject || ''}</span>
                <span class="act-card-status ${statusClass}">${statusLabel}</span>
              </div>
              <div class="act-card-title">${e.title}</div>
              ${e.description ? `<div class="act-card-desc">${e.description}</div>` : ''}
              <div class="act-card-footer">
                <span class="act-card-date">${e.startDate || ''}</span>
                <div class="act-card-progress"><div class="act-card-progress-fill" style="width:${e.progress || 0}%;background:${color}"></div></div>
                <span class="act-card-progress-text">${e.progress || 0}%</span>
              </div>
            </div>
          </div>`;
        }).join('')}

        <!-- 활동 추가 버튼 -->
        <button class="act-add-float-btn" onclick="_RM.nav('activity-add')">
          + 새 활동 추가하기
        </button>
      </div>
    </div>
  `;
}
