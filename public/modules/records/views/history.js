/* ================================================================
   Records Module — views/history.js
   통합 기록 히스토리
   ================================================================ */

import { state } from '../core/state.js';
import { DAY_NAMES, kstToday } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.setHistoryFilter = (filter) => {
    state._historyFilter = filter;
    RM.render();
  };
  RM.toggleHistoryCal = () => {
    state._historyCalOpen = !state._historyCalOpen;
    if (!state._historyCalMonth) {
      const today = kstToday();
      state._historyCalMonth = today.slice(0, 7); // 'YYYY-MM'
    }
    RM.render();
  };
  RM.historyCalPrev = () => {
    const [y, m] = state._historyCalMonth.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    state._historyCalMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    RM.render();
  };
  RM.historyCalNext = () => {
    const [y, m] = state._historyCalMonth.split('-').map(Number);
    const d = new Date(y, m, 1);
    state._historyCalMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    RM.render();
  };
  RM.historyPickDate = (dateStr) => {
    if (state._historySelectedDate === dateStr) {
      state._historySelectedDate = null; // 토글 해제
    } else {
      state._historySelectedDate = dateStr;
    }
    RM.render();
  };
  RM.historyClearDate = () => {
    state._historySelectedDate = null;
    state._historyCalOpen = false;
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

function _renderMiniCalendar(allItems) {
  const monthStr = state._historyCalMonth || kstToday().slice(0, 7);
  const [year, month] = monthStr.split('-').map(Number);
  const selectedDate = state._historySelectedDate || null;

  // 해당 월에 기록이 있는 날짜 Set
  const recordDates = new Set();
  allItems.forEach(item => {
    if (item.date && item.date.startsWith(monthStr)) recordDates.add(item.date);
  });

  const firstDay = new Date(year, month - 1, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = kstToday();

  const dayHeaders = ['일', '월', '화', '수', '목', '금', '토'];

  let cells = '';
  // 빈 셀
  for (let i = 0; i < firstDay; i++) cells += '<div class="hcal-cell empty"></div>';
  // 날짜 셀
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const hasRecord = recordDates.has(dateStr);
    const isToday = dateStr === today;
    const isSelected = dateStr === selectedDate;
    const cls = ['hcal-cell', hasRecord ? 'has-record' : '', isToday ? 'today' : '', isSelected ? 'selected' : ''].filter(Boolean).join(' ');
    cells += `<div class="${cls}" onclick="_RM.historyPickDate('${dateStr}')"><span>${d}</span>${hasRecord ? '<div class="hcal-dot"></div>' : ''}</div>`;
  }

  return `
    <div class="hcal-wrapper">
      <div class="hcal-nav">
        <button class="hcal-nav-btn" onclick="_RM.historyCalPrev()"><i class="fas fa-chevron-left"></i></button>
        <span class="hcal-nav-title">${year}년 ${month}월</span>
        <button class="hcal-nav-btn" onclick="_RM.historyCalNext()"><i class="fas fa-chevron-right"></i></button>
      </div>
      <div class="hcal-grid">
        ${dayHeaders.map(h => `<div class="hcal-header">${h}</div>`).join('')}
        ${cells}
      </div>
      ${selectedDate ? `
        <div class="hcal-selected-bar">
          <span>${selectedDate.replace(/-/g, '.')} 기록 보기</span>
          <button onclick="_RM.historyClearDate()" style="background:none;border:none;color:var(--text-muted);font-size:12px;cursor:pointer">초기화 ✕</button>
        </div>
      ` : ''}
    </div>
  `;
}

export function renderRecordHistory() {
  const filter = state._historyFilter || '전체';
  const calOpen = !!state._historyCalOpen;
  const selectedDate = state._historySelectedDate || null;
  const allItems = _buildAllRecords();

  // 타입 필터
  let filtered = filter === '전체' ? allItems : allItems.filter(item => item.type === filter);
  // 날짜 필터
  if (selectedDate) {
    filtered = filtered.filter(item => item.date === selectedDate);
  }

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
  const maxShow = selectedDate ? 100 : 10;
  const historyData = Object.values(grouped).slice(0, maxShow);

  const tabs = ['전체', '수업', '교학상장', '창체', '아하리포트', '나의질문'];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>📜 기록 히스토리</h1>
        <button class="icon-btn" onclick="_RM.toggleHistoryCal()" style="margin-left:auto;font-size:18px;background:${calOpen ? 'var(--primary)' : 'var(--bg-input)'};color:${calOpen ? '#fff' : 'var(--text-muted)'};border:none;width:36px;height:36px;border-radius:10px;cursor:pointer;display:flex;align-items:center;justify-content:center">
          <i class="fas fa-calendar-alt"></i>
        </button>
      </div>
      <div class="form-body">
        ${calOpen ? _renderMiniCalendar(allItems) : ''}

        ${selectedDate ? `
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;padding:8px 12px;background:rgba(108,92,231,0.1);border-radius:10px;font-size:13px;color:var(--primary-light)">
            <i class="fas fa-calendar-check"></i>
            <span>${selectedDate.replace(/-/g, '.')} 선택됨</span>
            <button onclick="_RM.historyClearDate()" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:12px">전체보기</button>
          </div>
        ` : ''}

        <div class="chip-row" style="margin-bottom:16px">
          ${tabs.map(c => `<button class="chip ${c === filter ? 'active' : ''}" onclick="_RM.setHistoryFilter('${c}')">${c}</button>`).join('')}
        </div>

        ${historyData.length === 0 ? `
          <div style="text-align:center;padding:60px 0;color:var(--text-muted)">
            <span style="font-size:48px;display:block;margin-bottom:16px">📜</span>
            <p style="font-size:16px;font-weight:600;margin:0 0 8px">기록이 없습니다</p>
            <p style="font-size:13px;margin:0">${selectedDate ? selectedDate.replace(/-/g, '.') + '에 기록이 없습니다' : (filter === '전체' ? '수업을 기록하면 여기에 표시됩니다' : filter + ' 기록이 없습니다')}</p>
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
