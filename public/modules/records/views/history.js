/* ================================================================
   Records Module — views/history.js
   통합 기록 히스토리
   ================================================================ */

import { state } from '../core/state.js';
import { DAY_NAMES } from '../core/utils.js';

export function registerHandlers(RM) {}

export function renderRecordHistory() {
  const records = (state._dbClassRecords || []).slice(0, 20);
  const grouped = {};
  records.forEach(r => {
    const d = r.date || r.created_at?.slice(0, 10) || '';
    if (!d) return;
    const dt = new Date(d + 'T00:00:00');
    const label = `${dt.getMonth() + 1}월 ${dt.getDate()}일 (${DAY_NAMES[dt.getDay()]})`;
    if (!grouped[d]) grouped[d] = { date: label, items: [] };
    grouped[d].items.push({
      type: '수업', color: 'var(--primary)',
      meta: r.subject || '',
      text: r.content || r.topic || '',
      tags: [], xp: '+10'
    });
  });
  const historyData = Object.values(grouped).slice(0, 7);

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>📜 기록 히스토리</h1>
      </div>
      <div class="form-body">
        <div class="chip-row" style="margin-bottom:16px">
          ${['전체', '수업', '질문', '교학상장', '창체'].map((c, i) => `<button class="chip ${i === 0 ? 'active' : ''}">${c}</button>`).join('')}
        </div>

        ${historyData.length === 0 ? `
          <div style="text-align:center;padding:60px 0;color:var(--text-muted)">
            <span style="font-size:48px;display:block;margin-bottom:16px">📜</span>
            <p style="font-size:16px;font-weight:600;margin:0 0 8px">기록이 없습니다</p>
            <p style="font-size:13px;margin:0">수업을 기록하면 여기에 표시됩니다</p>
          </div>
        ` : historyData.map(day => `
          <div class="history-date-header">${day.date}</div>
          ${day.items.map((item, i) => `
            <div class="history-card stagger-${i + 1} animate-in">
              <div class="history-type-badge" style="background:${item.color}">${item.type}</div>
              <div class="history-content">
                <div class="history-meta">${item.meta}</div>
                <p>${item.text}</p>
                <div class="history-tags">
                  ${item.tags.map(t => `<span class="${t.style}" style="font-size:10px">${t.q}</span>`).join('')}
                  <span class="history-xp">${item.xp} XP</span>
                </div>
              </div>
            </div>
          `).join('')}
        `).join('')}
      </div>
    </div>
  `;
}
