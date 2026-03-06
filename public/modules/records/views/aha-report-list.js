/* ================================================================
   Records Module — views/aha-report-list.js
   아하 리포트 목록 + 상세 보기
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { navigate } from '../core/router.js';
import { tryParseJSON } from '../core/utils.js';
import { generateAhaReportPDF } from '../components/pdf-generator.js';

export function registerHandlers(RM) {
  RM.goAhaInput = () => {
    // 새 리포트 작성 초기화
    state._ahaPhotos = [];
    state._ahaPhotoTags = [];
    state._ahaResult = null;
    state._ahaEditing = false;
    state._ahaFeedback = null;
    state._ahaFeedbackLoading = false;
    state._ahaSubject = '';
    state._ahaSource = '';
    state._ahaDate = '';
    navigate('aha-input');
  };
  RM.viewAhaDetail = async (id) => {
    state._ahaDetailLoading = true;
    state._viewingAhaId = id;
    navigate('aha-detail');
    try {
      const detail = await DB.getAhaReportDetail(id);
      state._ahaDetail = detail;
    } catch (e) { console.error('loadAhaDetail:', e); }
    state._ahaDetailLoading = false;
    navigate(state.currentScreen, { replace: true });
  };
  RM.setAhaListFilter = (f) => {
    state._ahaListFilter = f;
    RM.render();
  };
  RM.downloadAhaDetailPDF = () => {
    const d = state._ahaDetail;
    if (!d) return;
    const pa = tryParseJSON(d.section_pa, []);
    const ppa = tryParseJSON(d.section_ppa, {});
    generateAhaReportPDF(
      { sa: d.section_sa || '', pa, da: d.section_da || '', poa: d.section_poa || '', ppa },
      d.subject || '',
      d.date || d.created_at?.slice(0, 10) || '',
      d.ai_feedback || ''
    );
  };
}

export function renderAhaList() {
  const reports = state._dbAhaReports || [];
  const filter = state._ahaListFilter || '전체';

  const filtered = filter === '전체' ? reports : reports.filter(r => r.subject === filter);
  const subjects = [...new Set(reports.map(r => r.subject).filter(Boolean))];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>아하 리포트</h1>
      </div>
      <div class="form-body">
        <!-- 필터 -->
        ${subjects.length > 0 ? `
          <div class="chip-row" style="margin-bottom:16px">
            <button class="chip ${'전체' === filter ? 'active' : ''}" onclick="_RM.setAhaListFilter('전체')">전체</button>
            ${subjects.map(s => `<button class="chip ${s === filter ? 'active' : ''}" onclick="_RM.setAhaListFilter('${s}')">${s}</button>`).join('')}
          </div>
        ` : ''}

        ${filtered.length === 0 ? `
          <div style="text-align:center;padding:60px 0;color:var(--text-muted)">
            <div style="font-size:48px;margin-bottom:16px">💡</div>
            <p style="font-size:16px;font-weight:600;color:var(--text-primary);margin:0 0 8px">아직 아하 리포트가 없어요</p>
            <p style="font-size:13px;margin:0">노트를 촬영하고 AI가 정리해드려요!</p>
          </div>
        ` : filtered.map((r, i) => {
          const pa = tryParseJSON(r.section_pa, []);
          const dateStr = r.date || r.created_at?.slice(0, 10) || '';
          return `
            <div class="aha-list-card stagger-${Math.min(i + 1, 5)} animate-in" onclick="_RM.viewAhaDetail(${r.id})">
              <div class="aha-list-top">
                <div class="aha-list-subject" style="background:rgba(108,92,231,0.15);color:var(--primary-light)">${r.subject || '미분류'}</div>
                <span class="aha-list-date">${dateStr}</span>
              </div>
              <div class="aha-list-sa">${r.section_sa || r.section_topic || '(내용 없음)'}</div>
              ${pa.length > 0 ? `<div class="aha-list-pa">${pa.slice(0, 2).map(q => '<span class="aha-list-pa-chip">Q. ' + q + '</span>').join('')}${pa.length > 2 ? '<span class="aha-list-pa-more">+' + (pa.length - 2) + '</span>' : ''}</div>` : ''}
              ${r.source ? `<span class="aha-list-source">${r.source}</span>` : ''}
            </div>
          `;
        }).join('')}

        <button class="aha-add-float-btn" onclick="_RM.goAhaInput()">
          <i class="fas fa-plus" style="margin-right:8px"></i>새 아하 리포트 작성
        </button>
      </div>
    </div>
  `;
}

export function renderAhaDetail() {
  const detail = state._ahaDetail;
  const loading = state._ahaDetailLoading;

  if (loading) {
    return `
      <div class="full-screen animate-slide">
        <div class="screen-header">
          <button class="back-btn" onclick="_RM.nav('aha-list')"><i class="fas fa-arrow-left"></i></button>
          <h1>아하 리포트</h1>
        </div>
        <div class="al-container">
          <div class="al-spinner"><div class="al-pen-icon">📄</div></div>
          <div class="al-step-text">불러오는 중...</div>
        </div>
      </div>`;
  }

  if (!detail) {
    return `
      <div class="full-screen animate-slide">
        <div class="screen-header">
          <button class="back-btn" onclick="_RM.nav('aha-list')"><i class="fas fa-arrow-left"></i></button>
          <h1>아하 리포트</h1>
        </div>
        <div class="al-container">
          <p style="color:var(--text-muted)">리포트를 찾을 수 없습니다</p>
        </div>
      </div>`;
  }

  const pa = tryParseJSON(detail.section_pa, []);
  const ppa = tryParseJSON(detail.section_ppa, {});
  const photos = tryParseJSON(detail.photos, []);
  const subject = detail.subject || '';
  const dateStr = detail.date || detail.created_at?.slice(0, 10) || '';

  function nl2br(t) { return (t || '').replace(/\n/g, '<br>'); }

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('aha-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>아하 리포트</h1>
        ${subject ? `<span class="header-badge">${subject}</span>` : ''}
      </div>
      <div class="form-body">
        <div class="aha-result-card">
          <div class="aha-result-title-section">
            <div class="aha-result-title">아하 리포트</div>
            <div class="aha-result-subtitle">AHA REPORT</div>
            <div class="aha-result-meta">${subject ? subject + ' · ' : ''}${dateStr}${detail.source ? ' · ' + detail.source : ''}</div>
          </div>

          ${detail.section_sa ? `
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(255,107,107,0.15);color:#FF6B6B">SA</span>
              <span class="aha-section-label">문제상황</span>
            </div>
            <div class="aha-section-content">${nl2br(detail.section_sa)}</div>
          </div>` : ''}

          ${pa.length > 0 ? `
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(108,92,231,0.15);color:#A29BFE">PA</span>
              <span class="aha-section-label">탐구질문</span>
            </div>
            <div class="aha-pa-list">
              ${pa.map((q, i) => `<div class="aha-pa-item"><span class="aha-pa-num">Q${i + 1}</span><span class="aha-pa-text">${q}</span></div>`).join('')}
            </div>
          </div>` : ''}

          ${detail.section_da ? `
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(0,184,148,0.15);color:#00B894">DA</span>
              <span class="aha-section-label">탐구과정 & 결론</span>
            </div>
            <div class="aha-section-content">${nl2br(detail.section_da)}</div>
          </div>` : ''}

          ${detail.section_poa ? `
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(253,203,110,0.15);color:#FECA57">POA</span>
              <span class="aha-section-label">아하포인트</span>
            </div>
            <div class="aha-section-content">${nl2br(detail.section_poa)}</div>
          </div>` : ''}

          ${ppa.change || ppa.lacking ? `
          <div class="aha-section">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(116,185,255,0.15);color:#74B9FF">PPA</span>
              <span class="aha-section-label">성찰</span>
            </div>
            <div class="aha-ppa-content">
              ${ppa.change ? `<div class="aha-ppa-row"><span class="aha-ppa-icon">🔄</span><div><strong>전후 생각 변화</strong><p>${nl2br(ppa.change)}</p></div></div>` : ''}
              ${ppa.lacking ? `<div class="aha-ppa-row"><span class="aha-ppa-icon">📌</span><div><strong>부족했던 것</strong><p>${nl2br(ppa.lacking)}</p></div></div>` : ''}
            </div>
          </div>` : ''}

          ${detail.ai_feedback ? `
          <div class="aha-feedback-card" style="margin-top:16px">
            <div class="aha-feedback-header">
              <span class="aha-feedback-icon">🎯</span>
              <span class="aha-feedback-title">아하 리포트 피드백</span>
            </div>
            <div class="aha-feedback-body">${nl2br(detail.ai_feedback)}</div>
          </div>` : ''}

          ${photos.length > 0 ? `
          <div class="aha-section" style="margin-top:16px">
            <div class="aha-section-header">
              <span class="aha-section-badge" style="background:rgba(162,155,254,0.15);color:#A29BFE">📷</span>
              <span class="aha-section-label">첨부 사진</span>
            </div>
            <div class="pu-ref-grid">
              ${photos.map((p, i) => `<div class="pu-ref-tile"><img class="pu-ref-tile-img" src="${p}" alt="사진 ${i + 1}"></div>`).join('')}
            </div>
          </div>` : ''}
        </div>

        <div class="cl-action-bar">
          <button class="cl-pdf-btn" onclick="_RM.downloadAhaDetailPDF()">
            <i class="fas fa-file-pdf" style="margin-right:6px"></i>PDF로 저장
          </button>
        </div>
      </div>
    </div>
  `;
}
