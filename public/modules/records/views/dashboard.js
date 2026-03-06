/* ================================================================
   Records Module — views/dashboard.js
   Premium Card Dashboard (skill-premium-card design system)
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';
import { getDday, formatDate } from '../core/utils.js';

// _RM namespace handlers
export function registerHandlers(RM) {
  RM.goDashboard = () => navigate('dashboard');
}

/* ---- Dashboard Card Definitions ---- */
/* 순서: 생활기록부(col2) | 사진앨범 / 오늘수업 | 수업다시보기 | 질문함 / 교학상장 | 시험 | 과제 / 창체(col2) | 아하 / 히스토리 */
const DASHBOARD_CARDS = [
  { screen: 'school-record',        icon: 'file-text',        accent: '#ec4899', title: '생활기록부 관리', desc: '생기부 업로드 및 분석', xp: '+30', colSpan: 2 },
  { screen: 'photo-album',          icon: 'camera',           accent: '#f59e0b', title: '사진 앨범',       desc: '수업 필기·프린트 사진 모아보기', xp: '' },
  { screen: 'period-select',        icon: 'edit',             accent: '#6366f1', title: '오늘의 수업',       desc: '사진 찍고 AI가 수업 탐구 기록 자동 정리', xp: '' },
  { screen: 'class-record-history',  icon: 'book-open',        accent: '#10b981', title: '나의 수업 다시보기', desc: '기록한 수업 내용·사진 다시보기', xp: '', hasCount: true },
  { screen: 'record-question',      icon: 'help-circle',      accent: '#8b5cf6', title: '나의 질문함',     desc: '궁금한 것을 기록하고 답을 찾아가기', xp: '+3' },
  { screen: 'record-teach',         icon: 'heart-handshake',  accent: '#ec4899', title: '교학상장',       desc: '친구에게 가르친 경험', xp: '+30' },
  { screen: 'exam-list',            icon: 'clipboard-list',   accent: '#06b6d4', title: '시험 관리',       desc: '시험 일정 + 결과 + 성장분석', xp: '' },
  { screen: 'assignment-list',      icon: 'check-square',     accent: '#6366f1', title: '과제 기록',       desc: '과제 등록 + 마감 관리', xp: '+15' },
  { screen: 'record-activity',      icon: 'sparkles',         accent: '#8b5cf6', title: '창의적 체험활동', desc: '비교과 활동 기록', xp: '+20', colSpan: 2 },
  { screen: 'aha-list',             icon: 'lightbulb',        accent: '#f59e0b', title: '아하 리포트',     desc: '영역 탐구 보고서 작성', xp: '+15' },
  { screen: 'record-history',       icon: 'archive',          accent: '#10b981', title: '기록 히스토리',   desc: '모든 기록 한눈에 보기', xp: '' },
];

/* ---- Hex to RGB for box-shadow glow ---- */
function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
}

/* ---- Render a single skill card ---- */
function _renderSkillCard(card, idx) {
  const rgb = hexToRgb(card.accent);
  const classRecordCount = card.hasCount ? (state._dbClassRecords || []).length : 0;
  const countHtml = card.hasCount && classRecordCount > 0
    ? `<span class="skill-count" style="color:${card.accent}">${classRecordCount}\uAC74</span>`
    : '';
  const xpHtml = card.xp
    ? `<span class="skill-badge">${card.xp}</span>`
    : '';

  const spanClass = card.colSpan === 2 ? ' skill-card-wide' : '';

  return `
    <div class="skill-card${spanClass}"
         style="--glow-color:${card.accent};--glow-rgb:${rgb};animation-delay:${idx * 0.06}s"
         onclick="_RM.nav('${card.screen}')">
      <div class="skill-card-glow"></div>
      <div class="skill-icon-wrap" style="--icon-bg:${card.accent}1A;color:${card.accent}">
        <i data-lucide="${card.icon}"></i>
      </div>
      <div class="skill-card-info">
        <h3>${card.title}</h3>
        <p>${card.desc}</p>
      </div>
      ${countHtml}${xpHtml}
    </div>`;
}

/* ---- Upcoming Exams Mini Section ---- */
const examTypeIcons = { midterm:'📘', final:'📕', mock:'📗', performance:'📝' };

function _renderUpcomingExams() {
  const upcomingExams = (state.exams||[]).filter(e => !e.result && getDday(e.startDate) >= 0).sort((a,b) => (a.startDate||'').localeCompare(b.startDate||'')).slice(0,3);
  if (upcomingExams.length === 0) return '';
  return `
    <div class="card stagger-7 animate-in">
      <div class="card-header-row">
        <span class="card-title">📝 다가오는 시험</span>
        <button class="card-link" onclick="_RM.nav('exam-list')">전체보기 →</button>
      </div>
      ${upcomingExams.map(e => {
        const dDay = getDday(e.startDate);
        const dDayText = dDay === 0 ? 'D-Day' : 'D-' + dDay;
        const urgency = dDay <= 3 ? 'urgent' : dDay <= 7 ? 'warning' : 'normal';
        const subs = e.subjects || [];
        const avgReadiness = subs.length > 0 ? Math.round(subs.reduce((s,sub) => s + (sub.readiness||0), 0) / subs.length) : 0;
        return `
        <div class="exam-mini-row" onclick="_RM.state.viewingExam='${e.id}';_RM.nav('exam-detail')">
          <span class="exam-mini-icon">${examTypeIcons[e.type]||'📝'}</span>
          <div class="exam-mini-info">
            <span class="exam-mini-name">${e.name}</span>
            <span class="exam-mini-subjects">${subs.map(s => s.subject).join(', ')}</span>
          </div>
          <div class="exam-mini-right">
            <span class="assignment-dday ${urgency}">${dDayText}</span>
            <div class="exam-mini-bar"><div class="exam-mini-bar-fill" style="width:${avgReadiness}%;background:var(--primary)"></div></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

/* ---- Post-render: Lucide icons + GSAP stagger ---- */
function _initDashboardEffects() {
  setTimeout(() => {
    // Lucide icons
    if (window.lucide) window.lucide.createIcons();

    // GSAP stagger animation (overrides CSS fallback)
    const cards = document.querySelectorAll('.skill-card');
    if (window.gsap && cards.length) {
      cards.forEach(c => c.style.animation = 'none');
      window.gsap.from(cards, {
        duration: 0.55,
        y: 24,
        opacity: 0,
        stagger: 0.06,
        ease: 'power2.out',
        clearProps: 'all'
      });
    }

    // Mouse-tracking glow
    cards.forEach(card => {
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width * 100).toFixed(1);
        const y = ((e.clientY - rect.top) / rect.height * 100).toFixed(1);
        card.style.setProperty('--mouse-x', x + '%');
        card.style.setProperty('--mouse-y', y + '%');
      });
    });
  }, 0);
}

/* ---- Main Renderer ---- */
export function renderDashboard() {
  // Trigger post-render effects
  _initDashboardEffects();

  return `
    <div class="tab-content animate-in">
      <div class="screen-header">
        <h1>📝 아카이브</h1>
      </div>

      <div class="skill-card-grid">
        ${DASHBOARD_CARDS.map((card, i) => _renderSkillCard(card, i)).join('')}
      </div>

      <!-- Upcoming Exams Mini Section -->
      ${_renderUpcomingExams()}
    </div>
  `;
}
