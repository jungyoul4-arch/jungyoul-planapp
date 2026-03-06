/* ================================================================
   Records Module — views/activity-list.js
   창의적 체험활동 — Premium Bento Grid
   ================================================================ */

import { state } from '../core/state.js';

/* ── 카드 정의 (DB에서 recordCount/lastDate를 주입) ── */
const BENTO_CARD_DEFS = [
  { id: 'club',      activityType: 'club',      label: '동아리',     desc: '교내 동아리 활동 기록과 성장 과정을 관리하세요', icon: 'users',           color: '#6366f1', size: 'large',  badge: '자율동아리', screen: 'club-upload' },
  { id: 'career',    activityType: 'career',    label: '진로',       desc: '진로 탐색과 체험 활동을 기록하세요',             icon: 'compass',         color: '#10b981', size: 'normal', badge: '진로탐색',   screen: 'career-upload' },
  { id: 'autonomy',  activityType: 'autonomy',  label: '자율 · 자치', desc: '학생 자율 활동과 자치 활동을 기록하세요',         icon: 'shield',          color: '#f59e0b', size: 'normal', badge: '자율활동',   screen: 'autonomy-upload' },
  { id: 'report',    activityType: null,         label: '탐구보고서', desc: '교과별 탐구 보고서를 체계적으로 작성하고 관리하세요', icon: 'file-search',  color: '#8b5cf6', size: 'large',  badge: '보고서',     screen: 'report-project' },
  { id: 'reading',   activityType: 'reading',   label: '독서활동',   desc: '독서 기록과 서평을 남기세요',                     icon: 'book-open',       color: '#ec4899', size: 'normal', badge: '독서',       screen: 'reading-upload' },
  { id: 'volunteer', activityType: 'volunteer', label: '봉사활동',   desc: '봉사활동 시간과 내용을 기록하세요',               icon: 'heart-handshake', color: '#06b6d4', size: 'normal', badge: '봉사',       screen: 'volunteer-upload' },
];

function _buildBentoCards() {
  const records = state._dbActivityRecords || [];
  return BENTO_CARD_DEFS.map(def => {
    let recordCount = 0;
    let lastDate = '';
    let progress = 0;

    if (def.activityType) {
      // activity_records에서 해당 type 찾기
      const ar = records.find(r => r.activity_type === def.activityType);
      if (ar) {
        recordCount = ar._logCount || 0;
        lastDate = ar._lastLogDate || '';
        progress = ar.progress || 0;
      }
    } else if (def.id === 'report') {
      const reports = state._dbReportRecords || [];
      recordCount = reports.length;
      if (reports.length > 0) lastDate = (reports[0].created_at || '').slice(0, 10);
      progress = reports.length > 0 ? (reports[0].status === 'completed' ? 100 : 30) : 0;
    }

    return { ...def, recordCount, lastDate, progress };
  });
}

export function registerHandlers(RM) {
  RM.setActivityFilter = (filter) => {
    state._activityFilter = filter;
    RM.render();
  };

  RM.onBentoCard = (cardId) => {
    const card = BENTO_CARD_DEFS.find(c => c.id === cardId);
    if (!card) return;
    if (card.screen) RM.nav(card.screen);
  };
}

/* ── Bento 카드 HTML 생성 ── */
function renderBentoCards(data) {
  return data.map(card => {
    const isLarge = card.size === 'large';
    const lastText = card.lastDate || '기록 없음';

    return `
    <div class="bento-card bento-card--${card.id}"
         style="--card-accent: ${card.color}"
         onclick="_RM.onBentoCard('${card.id}')">
      <div class="bento-card-glow"></div>
      <div class="bento-card-inner">
        <div class="bento-card-top">
          <div class="bento-icon-wrap" style="--icon-bg: ${card.color}1A">
            <i data-lucide="${card.icon}"></i>
          </div>
          <span class="bento-badge">${card.badge}</span>
        </div>
        <div class="bento-card-mid">
          <h3 class="bento-card-title">${card.label}</h3>
          <p class="bento-card-desc">${card.desc}</p>
        </div>
        ${isLarge ? `
        <div class="bento-progress-wrap">
          <div class="bento-progress-bar">
            <div class="bento-progress-fill" style="width: ${card.progress}%"></div>
          </div>
          <span class="bento-progress-text">${card.progress}%</span>
        </div>` : ''}
        <div class="bento-card-bottom">
          <span class="bento-stat">기록 ${card.recordCount}건</span>
          <span class="bento-divider">|</span>
          <span class="bento-stat">${lastText}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}

/* ── 메인 렌더러 ── */
export function renderRecordActivity() {
  setTimeout(() => {
    if (window.lucide) window.lucide.createIcons();
  }, 0);

  return `
    <div class="full-screen bento-page animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')">
          <i class="fas fa-arrow-left"></i>
        </button>
        <h1 class="bento-page-title">Creative Activities</h1>
      </div>

      <div class="bento-body">
        <p class="bento-page-subtitle">
          창의적 체험활동 영역을 선택하세요
        </p>
        <div class="bento-grid">
          ${renderBentoCards(_buildBentoCards())}
        </div>
      </div>
    </div>
  `;
}
