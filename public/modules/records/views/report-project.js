/* ================================================================
   Records Module — views/report-project.js
   탐구보고서
   ================================================================ */

import { state } from '../core/state.js';

export function registerHandlers(RM) {
  RM.selectReportPhaseTab = (phase) => {
    state.reportPhaseTab = phase;
    RM.render();
  };
}

export function renderReportProject() {
  const ecId = state.viewingReport;
  const ec = state.extracurriculars.find(e => e.id === ecId);

  if (!ec || !ec.report) {
    return renderReportProjectList();
  }

  const report = ec.report;
  const questions = report.questions || [];
  const totalXp = questions.reduce((sum, q) => sum + (q.xp || 0), 0);
  const currentPhase = state.reportPhaseTab || 0;

  const phases = [
    { name: '관찰', icon: '👀', color: '#60a5fa' },
    { name: '질문', icon: '❓', color: '#a78bfa' },
    { name: '탐구', icon: '🔬', color: '#34d399' },
    { name: '분석', icon: '📊', color: '#fbbf24' },
    { name: '결론', icon: '📝', color: '#f87171' },
  ];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('record-activity')"><i class="fas fa-arrow-left"></i></button>
        <h1>💡 아하 리포트</h1>
      </div>
      <div class="form-body">
        <div class="rpt-header">
          <div class="rpt-header-top">
            <div class="rpt-header-title">
              <div class="rpt-title">${ec.title}</div>
              <div class="rpt-subtitle">${ec.subject || ''} · ${ec.startDate || ''}</div>
            </div>
            <div class="rpt-xp-badge">${totalXp} XP</div>
          </div>

          <div class="rpt-stats-row">
            <div class="rpt-stat-item">
              <span class="rpt-stat-icon">✨</span>
              <span class="rpt-stat-value" style="color:var(--xp-gold)">${totalXp}</span>
              <span class="rpt-stat-label">총 XP</span>
            </div>
            <div class="rpt-stat-item">
              <span class="rpt-stat-icon">❓</span>
              <span class="rpt-stat-value" style="color:var(--primary-light)">${questions.length}</span>
              <span class="rpt-stat-label">질문 수</span>
            </div>
            <div class="rpt-stat-item">
              <span class="rpt-stat-icon">🏆</span>
              <span class="rpt-stat-value" style="color:#34d399">${questions.length > 0 ? questions[questions.length - 1].level || '-' : '-'}</span>
              <span class="rpt-stat-label">최고 레벨</span>
            </div>
          </div>

          <div class="rpt-phase-tabs">
            ${phases.map((p, i) => {
              const isActive = i === currentPhase;
              const isLocked = i > (report.currentPhase || 0) + 1;
              return `<button class="rpt-phase-tab ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}" style="${isActive ? 'background:' + p.color + '15;color:' + p.color + ';border-color:' + p.color + '40' : ''}" onclick="${isLocked ? '' : `_RM.selectReportPhaseTab(${i})`}">${p.icon} ${p.name}${isLocked ? ' 🔒' : ''}</button>`;
            }).join('')}
          </div>
        </div>

        <div class="rpt-content">
          ${questions.length === 0 ? `
            <div class="rpt-empty">
              <div style="font-size:48px;margin-bottom:12px">🔬</div>
              <div style="font-size:15px;font-weight:700;color:var(--text-primary)">아직 탐구 질문이 없어요</div>
              <div style="font-size:13px;color:var(--text-muted);margin-top:4px">첫 번째 질문을 등록해보세요!</div>
            </div>
          ` : `
            <div class="rpt-prev-questions">
              ${questions.map(q => `
                <div class="rpt-q-history-item">
                  <span class="rpt-q-level" style="background:rgba(108,92,231,0.15);color:var(--primary-light)">${q.level || '?'}</span>
                  <span class="rpt-q-text">${q.text || ''}</span>
                  <span class="rpt-q-xp">+${q.xp || 0}</span>
                </div>
              `).join('')}
            </div>
          `}
        </div>
      </div>
    </div>
  `;
}

function renderReportProjectList() {
  const reports = (state.extracurriculars || []).filter(e => e.type === 'report' && e.report);

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('record-activity')"><i class="fas fa-arrow-left"></i></button>
        <h1>💡 아하 리포트</h1>
      </div>
      <div class="form-body">
        ${reports.length === 0 ? `
          <div class="rpt-empty" style="padding:60px 20px">
            <div style="font-size:48px;margin-bottom:16px">📄</div>
            <div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px">아직 아하 리포트가 없어요</div>
            <div style="font-size:13px;color:var(--text-muted)">창의적 체험활동에서 아하 리포트를 추가해보세요</div>
            <button class="btn-primary" style="margin-top:16px;padding:10px 24px" onclick="_RM.nav('activity-add')">
              + 새 아하 리포트 만들기
            </button>
          </div>
        ` : reports.map(e => {
          const report = e.report;
          const questions = report.questions || [];
          const totalXp = questions.reduce((sum, q) => sum + (q.xp || 0), 0);
          const color = e.color || 'var(--primary)';
          return `
          <div class="rpt-project-card" onclick="_RM.state.viewingReport='${e.id}';_RM.state.reportPhaseTab=${report.currentPhase || 0};_RM.render()">
            <div class="rpt-project-top">
              <div class="rpt-project-color" style="background:${color}"></div>
              <div class="rpt-project-info">
                <div class="rpt-project-name">${e.title}</div>
                <div class="rpt-project-meta">${e.subject || ''} · 질문 ${questions.length}개</div>
              </div>
              <div class="rpt-project-phase" style="background:${color}15;color:${color}">
                ${['관찰', '질문', '탐구', '분석', '결론'][report.currentPhase || 0] || '관찰'}
              </div>
            </div>
            <div class="rpt-project-bottom">
              <span class="rpt-project-stat">✨ ${totalXp} XP</span>
              <div class="rpt-project-progress"><div class="rpt-project-progress-fill" style="width:${e.progress || 0}%;background:${color}"></div></div>
            </div>
          </div>`;
        }).join('')}

        <button class="rpt-add-float-btn" onclick="_RM.nav('activity-add')">
          + 새 아하 리포트 만들기
        </button>
      </div>
    </div>
  `;
}
