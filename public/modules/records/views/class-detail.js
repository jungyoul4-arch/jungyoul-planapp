/* ================================================================
   Records Module — views/class-detail.js
   수업 기록 상세 보기
   ================================================================ */

import { state } from '../core/state.js';
import { kstToday, getSubjectColor, tryParseJSON } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.openPhotoZoom = (idx) => openPhotoZoom(idx);
}

function openPhotoZoom(photoIdx) {
  let photos = [];
  if (state._viewingTodayRecordIdx !== undefined && state._viewingTodayRecordIdx !== null) {
    const r = state.todayRecords[state._viewingTodayRecordIdx];
    photos = r ? (r._photos || []) : [];
  } else if (state._viewingDbRecord) {
    const dbRec = (state._dbClassRecords || []).find(r => String(r.id) === String(state._viewingDbRecord));
    photos = dbRec ? (Array.isArray(dbRec.photos) ? dbRec.photos : []) : [];
  }
  if (photos.length === 0) return;

  const overlay = document.createElement('div');
  overlay.className = 'photo-zoom-overlay';
  let currentIdx = photoIdx;
  let scale = 1, posX = 0, posY = 0, lastTap = 0;

  function renderZoom() {
    scale = 1; posX = 0; posY = 0;
    overlay.innerHTML = `
      <button class="photo-zoom-close" onclick="this.closest('.photo-zoom-overlay').remove()">&times;</button>
      <div class="photo-zoom-counter">${currentIdx + 1} / ${photos.length}</div>
      <div class="photo-zoom-container" id="photoZoomContainer">
        <img src="${photos[currentIdx]}" class="photo-zoom-img" id="photoZoomImg" draggable="false">
      </div>
      ${photos.length > 1 ? `
        <div class="photo-zoom-nav">
          <button class="photo-zoom-btn" id="pzPrev"><i class="fas fa-chevron-left"></i></button>
          <button class="photo-zoom-btn" id="pzNext"><i class="fas fa-chevron-right"></i></button>
        </div>
      ` : ''}
      <div class="photo-zoom-hint">핀치/더블탭으로 확대 · 좌우 스와이프</div>
    `;

    const prev = overlay.querySelector('#pzPrev');
    const next = overlay.querySelector('#pzNext');
    if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); currentIdx = (currentIdx - 1 + photos.length) % photos.length; renderZoom(); });
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); currentIdx = (currentIdx + 1) % photos.length; renderZoom(); });

    const container = overlay.querySelector('#photoZoomContainer');
    const img = overlay.querySelector('#photoZoomImg');
    if (!container || !img) return;

    container.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - lastTap < 350) {
        if (scale > 1) { scale = 1; posX = 0; posY = 0; }
        else { scale = 2.5; }
        img.style.transform = 'translate(' + posX + 'px,' + posY + 'px) scale(' + scale + ')';
      }
      lastTap = now;
    });

    // 핀치줌 + 패닝 (간략)
    let initDist = 0, initScale = 1;
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        initScale = scale;
      }
    }, { passive: true });
    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        scale = Math.max(0.5, Math.min(5, initScale * (dist / initDist)));
        img.style.transform = 'translate(' + posX + 'px,' + posY + 'px) scale(' + scale + ')';
      }
    }, { passive: true });

    // 스와이프
    let swStartX = 0;
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1 && scale <= 1) swStartX = e.touches[0].clientX;
    }, { passive: true });
    container.addEventListener('touchend', (e) => {
      if (scale > 1 || e.changedTouches.length !== 1) return;
      const diff = e.changedTouches[0].clientX - swStartX;
      if (Math.abs(diff) > 60) {
        if (diff < 0 && currentIdx < photos.length - 1) { currentIdx++; renderZoom(); }
        else if (diff > 0 && currentIdx > 0) { currentIdx--; renderZoom(); }
      }
    }, { passive: true });
  }

  renderZoom();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
  });
  document.body.appendChild(overlay);
}

export function renderClassRecordDetail() {
  let record = null;
  let fromToday = false;

  if (state._viewingTodayRecordIdx !== undefined && state._viewingTodayRecordIdx !== null) {
    const idx = state._viewingTodayRecordIdx;
    const r = state.todayRecords[idx];
    if (r && r.done) {
      record = {
        subject: r.subject, date: kstToday(),
        topic: r._topic || '', pages: r._pages || '',
        keywords: r._keywords || (r.summary ? r.summary.split(', ').filter(k => k) : []),
        photos: r._photos || [], teacher_note: r._teacherNote || '',
        memo: JSON.stringify({ period: r.period }),
        teacher: r.teacher || '', color: r.color || '#636e72',
        period: r.period, startTime: r.startTime, endTime: r.endTime,
        question: r.question,
        _assignmentText: r._assignmentText || '',
        _assignmentDue: r._assignmentDue || '',
        _todayIdx: idx,
      };
      fromToday = true;
    }
  }

  if (!record && state._viewingDbRecord) {
    const dbRec = (state._dbClassRecords || []).find(r => String(r.id) === String(state._viewingDbRecord));
    if (dbRec) {
      const memo = tryParseJSON(dbRec.memo, {});
      record = {
        subject: dbRec.subject, date: dbRec.date,
        topic: dbRec.topic || dbRec.content || '',
        pages: dbRec.pages || memo.pages || '',
        keywords: Array.isArray(dbRec.keywords) ? dbRec.keywords : [],
        photos: Array.isArray(dbRec.photos) ? dbRec.photos : [],
        teacher_note: dbRec.teacher_note || memo.teacherNote || '',
        memo: dbRec.memo, period: memo.period || '', color: '#636e72', _dbId: dbRec.id,
      };
    }
  }

  if (!record) {
    state._viewingTodayRecordIdx = null;
    state._viewingDbRecord = null;
    return '<div style="text-align:center;padding:60px;color:var(--text-muted)">기록을 찾을 수 없습니다.</div>';
  }

  const color = record.color !== '#636e72' ? record.color : getSubjectColor(record.subject);
  const keywords = record.keywords || [];
  const photos = record.photos || [];

  const backAction = fromToday
    ? "state._viewingTodayRecordIdx=null;_RM.nav('dashboard')"
    : "state._viewingDbRecord=null;_RM.nav('class-record-history')";

  const editAction = fromToday
    ? `state._viewingTodayRecordIdx=null;_RM.nav('class-record-edit')`
    : "";

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="${backAction}"><i class="fas fa-arrow-left"></i></button>
        <h1>📖 수업 기록</h1>
        ${fromToday ? '<button class="header-action-btn" onclick="' + editAction + '" style="color:var(--primary-light)"><i class="fas fa-edit"></i></button>' : ''}
      </div>
      <div class="form-body">
        <div class="card" style="margin-bottom:16px;border-left:4px solid ${color}">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:44px;height:44px;border-radius:12px;background:${color}15;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:${color}">
              ${record.period || '📖'}
            </div>
            <div style="flex:1">
              <div style="font-size:18px;font-weight:700;color:${color}">${record.subject}</div>
              <div style="font-size:12px;color:var(--text-muted)">
                ${record.date}${record.period ? ' · ' + record.period + '교시' : ''}${record.teacher ? ' · ' + record.teacher + ' 선생님' : ''}${record.startTime ? ' · ' + record.startTime + '~' + record.endTime : ''}
              </div>
            </div>
          </div>
        </div>

        ${record.topic ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">📖 단원/주제</label>
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);padding:8px 0">${record.topic}</div>
        </div>` : ''}

        ${record.pages ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">📄 교과서 쪽수</label>
          <div style="font-size:14px;color:var(--text-primary);padding:8px 0">${record.pages}</div>
        </div>` : ''}

        ${keywords.length > 0 ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">📝 핵심 키워드</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 0">
            ${keywords.map(k => `<span style="font-size:13px;padding:4px 12px;border-radius:16px;background:${color}12;color:${color};border:1px solid ${color}30;font-weight:500">${k}</span>`).join('')}
          </div>
        </div>` : ''}

        ${photos.length > 0 ? `
        <div class="detail-photo-section">
          <div class="detail-photo-header">
            <span class="detail-photo-label">📸 필기 사진</span>
            <span class="detail-photo-count">${photos.length}장</span>
          </div>
          <div class="detail-gallery-wrap">
            <div class="detail-gallery-scroll" id="detailGalleryScroll">
              ${photos.map((p, i) => `
                <div class="detail-gallery-item" data-idx="${i}" ondblclick="_RM.openPhotoZoom(${i})">
                  <img src="${p}" alt="필기 ${i + 1}" class="detail-gallery-img" loading="lazy" draggable="false">
                </div>
              `).join('')}
            </div>
            <div class="detail-gallery-indicator">
              <span class="detail-gallery-current">1</span> / <span class="detail-gallery-total">${photos.length}</span>
            </div>
          </div>
          <div class="detail-gallery-hint">
            <i class="fas fa-hand-point-up" style="margin-right:4px"></i>좌우 스와이프로 넘기기 · 더블탭으로 확대
          </div>
        </div>` : ''}

        ${record.teacher_note ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">⭐ 선생님 강조</label>
          <div style="font-size:14px;color:var(--accent);padding:10px 14px;background:rgba(255,107,107,0.08);border-radius:10px;border:1px solid rgba(255,107,107,0.15);font-weight:500">
            <i class="fas fa-exclamation-circle" style="margin-right:6px"></i>${record.teacher_note}
          </div>
        </div>` : ''}

        ${record._assignmentText ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">📋 과제</label>
          <div style="font-size:14px;color:var(--text-primary);padding:10px 14px;background:var(--bg-input);border-radius:10px;border:1px solid var(--border)">
            ${record._assignmentText}
            ${record._assignmentDue ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">📅 마감: ' + record._assignmentDue + '</div>' : ''}
          </div>
        </div>` : ''}

        ${record.question ? `
        <div class="card" style="margin-top:4px;background:var(--bg-input);border-color:var(--primary)22">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="tt-q-badge">${record.question.level}</span>
            <span style="font-size:13px;font-weight:600">질문 기록</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0">"${record.question.text}"</p>
        </div>` : ''}

        ${fromToday ? `
        <button class="btn-secondary" style="width:100%;margin-top:16px" onclick="${editAction}">
          <i class="fas fa-edit" style="margin-right:6px"></i> 수정하기
        </button>` : ''}
      </div>
    </div>
  `;
}
