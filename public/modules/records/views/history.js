/* ================================================================
   Records Module — views/history.js
   통합 기록 히스토리
   ================================================================ */

import { state } from '../core/state.js';
import { DAY_NAMES } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.setHistoryFilter = (filter) => {
    state._historyFilter = filter;
    RM.render();
  };
}

function _buildAllRecords() {
  const items = [];

  // 수업 기록
  (state._dbClassRecords || []).forEach(r => {
    items.push({
      id: r.id, type: '수업', color: 'var(--primary)',
      date: r.date || r.created_at?.slice(0, 10) || '',
      meta: r.subject || '',
      text: r.content || r.topic || '',
      xp: '+10',
      onclick: `_RM.state._viewingDbRecord=${r.id};_RM.nav('class-record-detail')`,
    });
  });

  // 교학상장
  (state._dbTeachRecords || []).forEach(r => {
    items.push({
      id: r.id, type: '교학상장', color: '#00B894',
      date: r.date || r.created_at?.slice(0, 10) || '',
      meta: r.subject || '',
      text: r.topic || r.content || '',
      xp: '+30',
      onclick: '',
    });
  });

  // 창체
  (state._dbActivityRecords || []).forEach(r => {
    items.push({
      id: r.id, type: '창체', color: '#FECA57',
      date: r.date || r.created_at?.slice(0, 10) || '',
      meta: r.category || r.type || '',
      text: r.title || r.content || '',
      xp: '+20',
      onclick: `_RM.state.viewingActivity='${r.id}';_RM.nav('activity-detail')`,
    });
  });

  // 아하리포트
  (state._dbAhaReports || []).forEach(r => {
    items.push({
      id: r.id, type: '아하리포트', color: '#FF9F43',
      date: r.date || r.created_at?.slice(0, 10) || '',
      meta: r.subject || '',
      text: r.section_sa || r.section_topic || '',
      xp: '+15',
      onclick: `_RM.viewAhaDetail(${r.id})`,
    });
  });

  // 나의 질문
  (state._myQuestions || []).forEach(q => {
    const resolved = q.status === '답변완료';
    items.push({
      id: q.id, type: '나의질문', color: '#E056A0',
      date: q.date || q.createdAt?.slice(0, 10) || '',
      meta: `${q.subject || '기타'}${resolved ? ' · 해결완료' : ''}`,
      text: q.title || '',
      xp: '+3',
      onclick: `_RM.goToQuestion(${q.id})`,
    });
  });

  // 날짜 내림차순 정렬
  items.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  return items;
}

export function renderRecordHistory() {
  const filter = state._historyFilter || '전체';
  const allItems = _buildAllRecords();
  const filtered = filter === '전체' ? allItems : allItems.filter(item => item.type === filter);

  // 날짜별 그룹핑
  const grouped = {};
  filtered.forEach(item => {
    const d = item.date;
    if (!d) return;
    const dt = new Date(d + 'T00:00:00');
    const label = `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${DAY_NAMES[dt.getDay()]})`;
    if (!grouped[d]) grouped[d] = { date: label, items: [] };
    grouped[d].items.push(item);
  });
  const historyData = Object.values(grouped).slice(0, 10);

  const tabs = ['전체', '수업', '교학상장', '창체', '아하리포트', '나의질문'];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>📜 기록 히스토리</h1>
      </div>
      <div class="form-body">
        <div class="chip-row" style="margin-bottom:16px">
          ${tabs.map(c => `<button class="chip ${c === filter ? 'active' : ''}" onclick="_RM.setHistoryFilter('${c}')">${c}</button>`).join('')}
        </div>

        ${historyData.length === 0 ? `
          <div style="text-align:center;padding:60px 0;color:var(--text-muted)">
            <span style="font-size:48px;display:block;margin-bottom:16px">📜</span>
            <p style="font-size:16px;font-weight:600;margin:0 0 8px">기록이 없습니다</p>
            <p style="font-size:13px;margin:0">${filter === '전체' ? '수업을 기록하면 여기에 표시됩니다' : filter + ' 기록이 없습니다'}</p>
          </div>
        ` : historyData.map(day => `
          <div class="history-date-header">${day.date}</div>
          ${day.items.map((item, i) => `
            <div class="history-card stagger-${Math.min(i + 1, 5)} animate-in" ${item.onclick ? `onclick="${item.onclick}" style="cursor:pointer"` : ''}>
              <div class="history-type-badge" style="background:${item.color}">${item.type}</div>
              <div class="history-content">
                <div class="history-meta">${item.meta}</div>
                <p>${item.text}</p>
                <div class="history-tags">
                  <span class="history-xp">${item.xp} XP</span>
                </div>
              </div>
              ${item.onclick ? '<span style="color:var(--text-muted);font-size:12px;align-self:center"><i class="fas fa-chevron-right"></i></span>' : ''}
            </div>
          `).join('')}
        `).join('')}
      </div>
    </div>
  `;
}
