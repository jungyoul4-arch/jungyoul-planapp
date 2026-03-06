/* ================================================================
   Records Module — views/class-history.js
   수업 기록 갤러리/히스토리
   ================================================================ */

import { state } from '../core/state.js';
import { kstToday, getSubjectColor, SUBJECT_COLOR_MAP } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.setGalleryFilter = (sub) => {
    state._recordGalleryFilter = sub;
    RM.render();
  };
}

export function renderClassRecordHistory() {
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

  const allRecords = [...todayDone, ...dbRecords];
  const currentFilter = state._recordGalleryFilter || '전체';
  const filteredRecords = currentFilter === '전체' ? allRecords : allRecords.filter(r => r.subject === currentFilter);

  const grouped = {};
  allRecords.forEach(r => { if (!grouped[r.date]) grouped[r.date] = []; grouped[r.date].push(r); });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalCount = allRecords.length;
  const totalPhotos = allRecords.reduce((sum, r) => sum + (r.photo_count || (Array.isArray(r.photos) ? r.photos.length : 0)), 0);
  const subjectSet = new Set(allRecords.map(r => r.subject));
  const filterSubjects = ['전체', ...Array.from(subjectSet).sort()];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>📚 나의 수업 다시보기</h1>
      </div>
      <div class="form-body">
        <div class="card" style="margin-bottom:16px;padding:14px;background:linear-gradient(135deg,rgba(108,92,231,0.08),rgba(162,155,254,0.08))">
          <div style="display:flex;justify-content:space-around;text-align:center">
            <div><div style="font-size:22px;font-weight:800;color:var(--primary-light)">${totalCount}</div><div style="font-size:11px;color:var(--text-muted)">총 기록</div></div>
            <div><div style="font-size:22px;font-weight:800;color:#FF9F43">${totalPhotos}</div><div style="font-size:11px;color:var(--text-muted)">첨부 사진</div></div>
            <div><div style="font-size:22px;font-weight:800;color:#00B894">${subjectSet.size}</div><div style="font-size:11px;color:var(--text-muted)">과목</div></div>
            <div><div style="font-size:22px;font-weight:800;color:#FF6B6B">${dates.length}</div><div style="font-size:11px;color:var(--text-muted)">기록일</div></div>
          </div>
        </div>

        ${allRecords.length > 0 ? `
        <div class="record-filter-bar">
          ${filterSubjects.map(sub => {
            const isActive = sub === currentFilter;
            const chipColor = sub === '전체' ? 'var(--primary-light)' : (getSubjectColor(sub));
            return '<button class="record-filter-chip' + (isActive ? ' active' : '') + '" style="' + (isActive ? 'background:' + chipColor + ';color:#fff;border-color:' + chipColor : 'border-color:' + chipColor + '40;color:' + chipColor) + '" onclick="_RM.setGalleryFilter(\'' + sub + '\')">' + sub + (sub !== '전체' ? ' <span class="record-filter-count">' + allRecords.filter(r => r.subject === sub).length + '</span>' : '') + '</button>';
          }).join('')}
        </div>` : ''}

        ${filteredRecords.length === 0 && allRecords.length === 0 ? `
          <div style="text-align:center;padding:60px 0;color:var(--text-muted)">
            <span style="font-size:48px;display:block;margin-bottom:16px">📝</span>
            <p style="font-size:16px;font-weight:600;margin:0 0 8px">아직 기록이 없어요</p>
            <p style="font-size:13px;margin:0">수업 시간에 기록을 시작해보세요!</p>
            <button class="btn-primary" style="margin-top:16px;padding:10px 24px" onclick="_RM.nav('record-class')">
              <i class="fas fa-pen" style="margin-right:6px"></i>수업 기록하러 가기
            </button>
          </div>
        ` : filteredRecords.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
            <span style="font-size:36px;display:block;margin-bottom:12px">🔍</span>
            <p style="font-size:14px;font-weight:600;margin:0">'${currentFilter}' 과목의 기록이 없습니다</p>
          </div>
        ` : `
          <div class="record-gallery-grid">
            ${filteredRecords.map((r, cardIdx) => {
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
              const carouselId = 'rc-carousel-' + cardIdx;
              return `
              <div class="record-gallery-card">
                <div class="record-gallery-thumb" style="border-bottom:3px solid ${color}" onclick="${clickAction}">
                  ${photoCount > 1 ? `
                    <div class="rc-carousel" id="${carouselId}" data-idx="0" data-total="${photoCount}">
                      <div class="rc-carousel-track" style="width:${photoCount * 100}%;transform:translateX(0%)">
                        ${photos.map(p => '<div class="rc-carousel-slide" style="width:' + (100/photoCount) + '%"><img src="' + p + '" alt="필기" class="record-gallery-img" /></div>').join('')}
                      </div>
                      <div class="rc-carousel-dots">
                        ${photos.map((_, i) => '<span class="rc-dot' + (i === 0 ? ' active' : '') + '"></span>').join('')}
                      </div>
                      <span class="record-gallery-badge">${photoCount}장</span>
                    </div>
                  ` : photoCount === 1 ? `
                    <img src="${photos[0]}" alt="필기 사진" class="record-gallery-img" />
                  ` : `
                    <div class="record-gallery-placeholder"><span style="font-size:36px">📝</span><span style="font-size:12px;color:var(--text-muted);margin-top:4px">사진 없음</span></div>
                  `}
                </div>
                <div class="record-gallery-info" onclick="${clickAction}">
                  <div class="record-gallery-subject">
                    <span class="record-gallery-subject-tag" style="background:${color}18;color:${color};border:1px solid ${color}35">${r.subject}</span>
                    ${r.ai_credit_log ? '<span class="pa-ai-badge" style="position:static;font-size:10px;padding:2px 6px;margin-left:4px">AI</span>' : ''}
                  ${memo.period ? '<span class="record-gallery-period">' + memo.period + '교시</span>' : ''}
                  </div>
                  ${r.topic ? '<div class="record-gallery-topic">' + r.topic + '</div>' : '<div class="record-gallery-topic" style="color:var(--text-muted);font-style:italic">단원 미입력</div>'}
                  <div class="record-gallery-date"><i class="far fa-calendar-alt" style="margin-right:4px"></i>${dateStr}</div>
                  ${keywords.length > 0 ? '<div class="record-gallery-keywords">' + keywords.slice(0, 3).map(k => '<span class="record-gallery-kw" style="background:' + color + '10;color:' + color + ';border:1px solid ' + color + '25">' + k + '</span>').join('') + '</div>' : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}
