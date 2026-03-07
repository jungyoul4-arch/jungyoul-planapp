/* ================================================================
   Records Module — views/class-history.js
   수업 기록 갤러리/히스토리 — 리디자인 v2 (밝은 카드 대시보드)
   ================================================================ */

import { state } from '../core/state.js';
import { kstToday, getSubjectColor, SUBJECT_COLOR_MAP } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.setGalleryFilter = (sub) => {
    state._recordGalleryFilter = sub;
    RM.render();
  };
  RM.setGallerySort = (sort) => {
    state._recordGallerySort = sort;
    RM.render();
  };
  RM.toggleGallerySearch = () => {
    state._recordGallerySearchOpen = !state._recordGallerySearchOpen;
    RM.render();
    if (state._recordGallerySearchOpen) {
      setTimeout(() => {
        const inp = document.getElementById('rg-search-input');
        if (inp) inp.focus();
      }, 100);
    }
  };
  RM.setGallerySearch = (q) => {
    state._recordGallerySearchQuery = q;
    RM.render();
  };
}

function _buildRecords() {
  const dbRecords = (state._dbClassRecords || []).map(r => ({ ...r, _source: 'db' }));
  const today = kstToday();

  const todayDone = (state.todayRecords || []).filter(r => r.done).map((r, idx) => {
    const topic = r._topic || '';
    const alreadyInDb = dbRecords.some(db => db.date === today && db.subject === r.subject && (db.topic === topic || db.content === topic));
    if (alreadyInDb) return null;
    return {
      id: 'today-' + idx, subject: r.subject || '미지정', date: today,
      topic: r._topic || '', pages: r._pages || '',
      keywords: r._keywords || (r.summary ? r.summary.split(', ').filter(k => k) : []),
      photos: r._photos || [], teacher_note: r._teacherNote || '',
      memo: JSON.stringify({ period: r.period }),
      _source: 'today', _todayIdx: idx
    };
  }).filter(Boolean);

  return [...todayDone, ...dbRecords];
}

export function renderClassRecordHistory() {
  const allRecords = _buildRecords();
  const currentFilter = state._recordGalleryFilter || '전체';
  const currentSort = state._recordGallerySort || 'newest';
  const searchQuery = (state._recordGallerySearchQuery || '').trim().toLowerCase();
  const searchOpen = state._recordGallerySearchOpen || false;

  // 필터 적용
  let filtered = currentFilter === '전체' ? [...allRecords] : allRecords.filter(r => r.subject === currentFilter);

  // 검색 적용
  if (searchQuery) {
    filtered = filtered.filter(r =>
      (r.topic || '').toLowerCase().includes(searchQuery) ||
      (r.subject || '').toLowerCase().includes(searchQuery) ||
      (Array.isArray(r.keywords) ? r.keywords.join(' ') : '').toLowerCase().includes(searchQuery)
    );
  }

  // 정렬
  if (currentSort === 'oldest') {
    filtered.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  } else {
    filtered.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  // 통계
  const totalCount = allRecords.length;
  const totalPhotos = allRecords.reduce((sum, r) => sum + (r.photo_count || (Array.isArray(r.photos) ? r.photos.length : 0)), 0);
  const subjectSet = new Set(allRecords.map(r => r.subject));
  const grouped = {};
  allRecords.forEach(r => { if (!grouped[r.date]) grouped[r.date] = true; });
  const dateCount = Object.keys(grouped).length;
  const filterSubjects = ['전체', ...Array.from(subjectSet).sort()];

  return `
    <div class="full-screen animate-slide">
      <div class="rg-header">
        <button class="rg-back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1 class="rg-title">나의 수업 다시보기</h1>
        <div class="rg-header-actions">
          <button class="rg-icon-btn ${searchOpen ? 'active' : ''}" onclick="_RM.toggleGallerySearch()" title="검색">
            <i class="fas fa-search"></i>
          </button>
          <button class="rg-icon-btn" onclick="_RM.setGallerySort('${currentSort === 'newest' ? 'oldest' : 'newest'}')" title="정렬">
            <i class="fas fa-sort-amount-${currentSort === 'newest' ? 'down' : 'up'}"></i>
          </button>
        </div>
      </div>

      ${searchOpen ? `
      <div class="rg-search-bar">
        <i class="fas fa-search" style="color:var(--text-muted);font-size:13px"></i>
        <input type="text" id="rg-search-input" class="rg-search-input" placeholder="제목, 과목, 키워드로 검색..." value="${searchQuery}" oninput="_RM.setGallerySearch(this.value)">
        ${searchQuery ? '<button class="rg-search-clear" onclick="_RM.setGallerySearch(\'\')"><i class="fas fa-times"></i></button>' : ''}
      </div>` : ''}

      <div class="rg-body">
        <!-- 요약 바 -->
        <div class="rg-summary-bar">
          <div class="rg-stat">
            <span class="rg-stat-num">${totalCount}</span>
            <span class="rg-stat-label">총 기록</span>
          </div>
          <div class="rg-stat-divider"></div>
          <div class="rg-stat">
            <span class="rg-stat-num" style="color:#F59E0B">${totalPhotos}</span>
            <span class="rg-stat-label">첨부 사진</span>
          </div>
          <div class="rg-stat-divider"></div>
          <div class="rg-stat">
            <span class="rg-stat-num" style="color:#10B981">${subjectSet.size}</span>
            <span class="rg-stat-label">과목</span>
          </div>
          <div class="rg-stat-divider"></div>
          <div class="rg-stat">
            <span class="rg-stat-num" style="color:#8B5CF6">${dateCount}</span>
            <span class="rg-stat-label">기록일</span>
          </div>
        </div>

        <!-- 과목 필터 탭 -->
        ${allRecords.length > 0 ? `
        <div class="rg-filter-wrap">
          <div class="rg-filter-scroll">
            ${filterSubjects.map(sub => {
              const isActive = sub === currentFilter;
              const chipColor = sub === '전체' ? '#6C5CE7' : getSubjectColor(sub);
              const count = sub === '전체' ? allRecords.length : allRecords.filter(r => r.subject === sub).length;
              return `<button class="rg-filter-pill ${isActive ? 'active' : ''}" style="${isActive ? 'background:' + chipColor + ';color:#fff;border-color:' + chipColor : '--pill-color:' + chipColor}" onclick="_RM.setGalleryFilter('${sub}')">${sub}${sub !== '전체' ? '<span class="rg-filter-count">' + count + '</span>' : ''}</button>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- 카드 그리드 -->
        ${filtered.length === 0 && allRecords.length === 0 ? `
          <div class="rg-empty">
            <div class="rg-empty-icon">📝</div>
            <p class="rg-empty-title">아직 기록이 없어요</p>
            <p class="rg-empty-desc">수업 시간에 기록을 시작해보세요!</p>
            <button class="rg-empty-btn" onclick="_RM.nav('record-class')">
              <i class="fas fa-pen" style="margin-right:6px"></i>수업 기록하러 가기
            </button>
          </div>
        ` : filtered.length === 0 ? `
          <div class="rg-empty">
            <div class="rg-empty-icon">🔍</div>
            <p class="rg-empty-title">${searchQuery ? '"' + searchQuery + '" 검색 결과 없음' : "'" + currentFilter + "' 과목의 기록이 없습니다"}</p>
          </div>
        ` : `
          <div class="rg-grid">
            ${filtered.map((r, cardIdx) => _renderCard(r, cardIdx)).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

function _renderCard(r, cardIdx) {
  const color = getSubjectColor(r.subject);
  const keywords = Array.isArray(r.keywords) ? r.keywords : [];
  const photos = Array.isArray(r.photos) ? r.photos : [];
  const photoCount = r.photo_count || photos.length;
  const memo = (() => { try { return JSON.parse(r.memo || '{}'); } catch { return {}; } })();
  const d = new Date(r.date);
  const dayNames = ['일','월','화','수','목','금','토'];
  const dateStr = (r.date || '').slice(5).replace('-', '/') + ' (' + dayNames[d.getDay()] + ')';
  const clickAction = r._source === 'today'
    ? "_RM.state._viewingTodayRecordIdx=" + r._todayIdx + ";_RM.nav('class-record-detail')"
    : "_RM.state._viewingDbRecord='" + String(r.id) + "';_RM.nav('class-record-detail')";

  const thumbSrc = photos.length > 0 && !String(photos[0]).startsWith('ref:') ? photos[0] : '';

  return `
    <div class="rg-card" onclick="${clickAction}">
      <div class="rg-card-thumb" style="border-top:3px solid ${color}">
        ${thumbSrc
          ? '<img src="' + thumbSrc + '" alt="" class="rg-card-img" loading="lazy" />'
          : '<div class="rg-card-placeholder"><span>📝</span></div>'
        }
        ${photoCount > 1 ? '<span class="rg-card-badge">' + photoCount + '장</span>' : ''}
        ${r.ai_credit_log ? '<span class="rg-card-badge rg-badge-ai">AI</span>' : ''}
      </div>
      <div class="rg-card-body">
        <div class="rg-card-meta">
          <span class="rg-card-subject" style="background:${color}14;color:${color};border:1px solid ${color}30">${r.subject}</span>
          ${memo.period ? '<span class="rg-card-period">' + memo.period + '교시</span>' : ''}
        </div>
        <div class="rg-card-title">${r.topic || '<span style="color:var(--text-muted);font-style:italic">단원 미입력</span>'}</div>
        <div class="rg-card-date"><i class="far fa-calendar-alt"></i> ${dateStr}</div>
        ${keywords.length > 0 ? `
          <div class="rg-card-tags">
            ${keywords.slice(0, 3).map(k => '<span class="rg-card-tag" style="background:' + color + '0A;color:' + color + ';border:1px solid ' + color + '20">' + k + '</span>').join('')}
            ${keywords.length > 3 ? '<span class="rg-card-tag-more">+' + (keywords.length - 3) + '</span>' : ''}
          </div>
        ` : ''}
      </div>
      <div class="rg-card-arrow"><i class="fas fa-chevron-right"></i></div>
    </div>
  `;
}
