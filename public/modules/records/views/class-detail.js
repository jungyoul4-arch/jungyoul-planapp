/* ================================================================
   Records Module — views/class-detail.js
   수업 기록 상세 보기
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { kstToday, getSubjectColor, tryParseJSON, markKeywords, getAssignmentDisplayText } from '../core/utils.js';
import { generateCreditLogPDF } from '../components/pdf-generator.js';
import { render } from '../core/router.js';

export function registerHandlers(RM) {
  RM.openPhotoZoom = (idx) => openPhotoZoom(idx);
  RM.downloadDetailPDF = (recordId) => downloadDetailPDF(recordId);
}

function downloadDetailPDF(recordId) {
  const dbRec = (state._dbClassRecords || []).find(r => String(r.id) === String(recordId));
  if (!dbRec || !dbRec.ai_credit_log) return;
  const log = typeof dbRec.ai_credit_log === 'string' ? tryParseJSON(dbRec.ai_credit_log, null) : dbRec.ai_credit_log;
  if (!log) return;
  generateCreditLogPDF(log, dbRec.subject || '', dbRec.date || '');
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

async function _resolvePhotosAsync(recordId, rawPhotos, cacheKey) {
  try {
    const resolved = await DB.resolvePhotos(rawPhotos);
    state[cacheKey] = resolved;
    render(); // 사진 로드 후 화면 재렌더
  } catch (e) {
    console.error('_resolvePhotosAsync:', e);
  }
}

function _renderDetailCreditLog(log, dbId) {
  const questions = log.questions || [];
  const keywords = log.keywords || [];
  const examConn = log.exam_connection || [];
  const activeRecall = log.active_recall || [];
  function nl2br(t) { return (t || '').replace(/\n/g, '<br>'); }

  return `
    <div class="cl-card" style="margin-top:16px">
      <div class="cl-title-section">
        <div class="cl-title">나의 수업 탐구 기록</div>
        <div class="cl-subtitle">MY CREDIT LOG</div>
      </div>
      ${log.topic ? `<div class="cl-section"><span class="cl-section-label">📖 단원 / 주제</span><div class="cl-section-value cl-handwriting">${log.topic}</div></div>` : ''}
      ${log.pages ? `<div class="cl-section"><span class="cl-section-label">📚 교과서</span><div class="cl-section-value cl-handwriting">${log.pages}</div></div>` : ''}
      ${log.summary ? `<div class="cl-section cl-summary-section"><span class="cl-section-label">📋 수업 맥락 요약</span><div class="cl-section-value cl-handwriting">${nl2br(log.summary)}</div></div>` : ''}
      ${examConn.length > 0 ? `<div class="cl-section cl-exam-section"><span class="cl-section-label">🎯 시험 연결 포인트</span><div class="cl-exam-list">${examConn.map((item, i) => '<div class="cl-exam-item"><span class="cl-exam-num">' + (i + 1) + '</span><span class="cl-exam-text">' + item + '</span></div>').join('')}</div></div>` : ''}
      ${log.highlights ? `<div class="cl-section cl-highlight-section"><span class="cl-section-label">⭐ 선생님 강조 포인트</span><div class="cl-section-value cl-handwriting">${markKeywords(log.highlights.replace(/\n/g, '<br>'), keywords)}</div></div>` : ''}
      ${log.deep_dive ? `<div class="cl-section cl-deepdive-section"><span class="cl-section-label">🔬 핵심 논리 분석</span><div class="cl-section-value cl-handwriting">${nl2br(log.deep_dive)}</div></div>` : ''}
      ${keywords.length > 0 ? `<div class="cl-section"><span class="cl-section-label">🔑 핵심 키워드</span><div class="cl-keywords">${keywords.map(k => '<span class="cl-keyword-chip">' + k + '</span>').join('')}</div></div>` : ''}
      ${questions.length > 0 ? `<div class="cl-section cl-questions-section"><span class="cl-section-label">💡 세특 소재 질문</span>${questions.map((q, i) => '<div class="cl-question-pair"><div class="cl-question-num">Q' + (i + 1) + '</div><div class="cl-question-body"><div class="cl-question-original"><span class="cl-q-label">💬 내가 쓴 질문</span><p>' + (q.original || '') + '</p></div><div class="cl-question-improved"><span class="cl-q-label">✨ 선생님께 이렇게 여쭤보세요</span><p>' + markKeywords(q.improved || '', keywords) + '</p></div></div></div>').join('')}</div>` : ''}
      ${activeRecall.length > 0 ? `<div class="cl-section cl-recall-section"><span class="cl-section-label">🧠 메타인지 자극 질문</span><div class="cl-recall-list">${activeRecall.map((item, i) => '<div class="cl-recall-item"><div class="cl-recall-q" onclick="this.nextElementSibling.style.display=this.nextElementSibling.style.display===\'none\'?\'flex\':\'none\'"><span class="cl-recall-icon">Q</span><span class="cl-recall-text">' + item.question + '</span><i class="fas fa-chevron-down cl-recall-toggle"></i></div><div class="cl-recall-a" style="display:none"><span class="cl-recall-a-icon">A</span><span>' + item.answer + '</span></div></div>').join('')}</div><div class="cl-recall-hint">질문을 탭하면 답을 확인할 수 있어요</div></div>` : ''}
      ${log.teacher_insight ? `<div class="cl-section cl-insight-section"><span class="cl-section-label">📝 세특 관찰 코멘트</span><div class="cl-insight-box">${nl2br(log.teacher_insight)}</div></div>` : ''}
      ${log.assignment ? `<div class="cl-section cl-assignment-section"><span class="cl-section-label">📌 과제</span><div class="cl-section-value cl-handwriting">${getAssignmentDisplayText(log.assignment)}</div></div>` : ''}
    </div>
    <button class="cl-pdf-btn" onclick="_RM.downloadDetailPDF('${dbId}')" style="width:100%;margin-top:12px">
      <i class="fas fa-file-pdf" style="margin-right:6px"></i>PDF로 저장
    </button>`;
}

export function renderClassRecordDetail() {
  let record = null;
  let fromToday = false;

  if (state._viewingTodayRecordIdx !== undefined && state._viewingTodayRecordIdx !== null) {
    const idx = state._viewingTodayRecordIdx;
    const r = state.todayRecords[idx];
    if (r && r.done) {
      // DB에 저장된 기록이 있으면 DB 데이터 우선 사용
      if (r._dbRecordId) {
        state._viewingDbRecord = r._dbRecordId;
        fromToday = true; // 편집 버튼 등 today UI 유지
      } else {
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
  }

  if (!record && state._viewingDbRecord) {
    const dbRec = (state._dbClassRecords || []).find(r => String(r.id) === String(state._viewingDbRecord));
    if (dbRec) {
      const memo = tryParseJSON(dbRec.memo, {});
      const aiLog = dbRec.ai_credit_log
        ? (typeof dbRec.ai_credit_log === 'string' ? tryParseJSON(dbRec.ai_credit_log, null) : dbRec.ai_credit_log)
        : null;
      const rawPhotos = Array.isArray(dbRec.photos) ? dbRec.photos : [];
      // ref:ID 사진이면 캐시된 해석 결과 사용, 없으면 비동기 로드 트리거
      const hasRefs = rawPhotos.some(p => typeof p === 'string' && p.startsWith('ref:'));
      const cacheKey = `_resolvedPhotos_${dbRec.id}`;
      let photos = rawPhotos;
      if (hasRefs && state[cacheKey]) {
        photos = state[cacheKey];
      } else if (hasRefs) {
        photos = []; // 아직 로딩 중 — 빈 상태로 렌더 후 비동기 로드
        _resolvePhotosAsync(dbRec.id, rawPhotos, cacheKey);
      }
      record = {
        subject: dbRec.subject, date: dbRec.date,
        topic: dbRec.topic || dbRec.content || '',
        pages: dbRec.pages || memo.pages || '',
        keywords: Array.isArray(dbRec.keywords) ? dbRec.keywords : [],
        photos,
        photo_count: dbRec.photo_count || rawPhotos.length,
        teacher_note: dbRec.teacher_note || memo.teacherNote || '',
        memo: dbRec.memo, period: memo.period || '', color: '#636e72', _dbId: dbRec.id,
        ai_credit_log: aiLog,
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
    ? "_RM.state._viewingTodayRecordIdx=null;_RM.nav('dashboard')"
    : "_RM.state._viewingDbRecord=null;_RM.nav('class-record-history')";

  const editAction = fromToday
    ? `_RM.state._viewingTodayRecordIdx=null;_RM.nav('class-record-edit')`
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

        ${(photos.length > 0 || (record.photo_count && record.photo_count > 0)) ? `
        <div class="detail-photo-section">
          <div class="detail-photo-header">
            <span class="detail-photo-label">📸 필기 사진</span>
            <span class="detail-photo-count">${photos.length > 0 ? photos.length : record.photo_count}장${photos.length === 0 && record.photo_count > 0 ? ' (로딩 중...)' : ''}</span>
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

        ${record.ai_credit_log ? _renderDetailCreditLog(record.ai_credit_log, record._dbId) : ''}

        ${fromToday ? `
        <button class="btn-secondary" style="width:100%;margin-top:16px" onclick="${editAction}">
          <i class="fas fa-edit" style="margin-right:6px"></i> 수정하기
        </button>` : ''}
      </div>
    </div>
  `;
}
