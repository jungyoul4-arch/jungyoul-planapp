/* ================================================================
   Records Module — views/aha-report-list.js
   아하 리포트 목록 (카드형 UI) + 상세 보기
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { navigate, render } from '../core/router.js';
import { tryParseJSON, getSubjectColor, skeletonCards } from '../core/utils.js';
import { generateAhaReportPDF } from '../components/pdf-generator.js';

export function registerHandlers(RM) {
  RM.goAhaInput = () => {
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
  RM.setAhaListSort = (sort) => {
    state._ahaListSort = sort;
    RM.render();
  };
  RM.toggleAhaSearch = () => {
    state._ahaSearchOpen = !state._ahaSearchOpen;
    RM.render();
    if (state._ahaSearchOpen) {
      setTimeout(() => {
        const inp = document.getElementById('aha-search-input');
        if (inp) inp.focus();
      }, 100);
    }
  };
  RM.setAhaSearch = (q) => {
    state._ahaSearchQuery = q;
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

  // 아직 로딩 전이면 스켈레톤
  if (state._dbAhaReports === null) {
    return `
      <div class="full-screen animate-slide">
        <div class="rg-header">
          <button class="rg-back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
          <h1 class="rg-title">아하 리포트</h1>
        </div>
        <div class="rg-body">
          <div class="rg-summary-bar">
            <div class="rg-stat"><div class="skeleton skeleton-text" style="width:24px;height:20px;margin:0 auto 4px"></div><span class="rg-stat-label">총 기록</span></div>
            <div class="rg-stat-divider"></div>
            <div class="rg-stat"><div class="skeleton skeleton-text" style="width:24px;height:20px;margin:0 auto 4px"></div><span class="rg-stat-label">첨부 사진</span></div>
            <div class="rg-stat-divider"></div>
            <div class="rg-stat"><div class="skeleton skeleton-text" style="width:24px;height:20px;margin:0 auto 4px"></div><span class="rg-stat-label">과목</span></div>
            <div class="rg-stat-divider"></div>
            <div class="rg-stat"><div class="skeleton skeleton-text" style="width:24px;height:20px;margin:0 auto 4px"></div><span class="rg-stat-label">기록일</span></div>
          </div>
          <div style="display:flex;gap:8px;padding:0 16px;margin-bottom:16px">
            <div class="skeleton skeleton-chip" style="width:48px;height:32px;border-radius:16px"></div>
            <div class="skeleton skeleton-chip" style="width:56px;height:32px;border-radius:16px"></div>
          </div>
          <div class="skeleton-grid">${skeletonCards(4)}</div>
        </div>
      </div>`;
  }

  const currentFilter = state._ahaListFilter || '전체';
  const currentSort = state._ahaListSort || 'newest';
  const searchQuery = (state._ahaSearchQuery || '').trim().toLowerCase();
  const searchOpen = state._ahaSearchOpen || false;

  // 필터
  let filtered = currentFilter === '전체' ? [...reports] : reports.filter(r => r.subject === currentFilter);

  // 검색
  if (searchQuery) {
    filtered = filtered.filter(r =>
      (r.subject || '').toLowerCase().includes(searchQuery) ||
      (r.section_sa || '').toLowerCase().includes(searchQuery) ||
      (r.section_topic || '').toLowerCase().includes(searchQuery) ||
      (r.source || '').toLowerCase().includes(searchQuery)
    );
  }

  // 정렬
  const getDate = (r) => r.date || r.created_at?.slice(0, 10) || '';
  if (currentSort === 'oldest') {
    filtered.sort((a, b) => getDate(a).localeCompare(getDate(b)));
  } else {
    filtered.sort((a, b) => getDate(b).localeCompare(getDate(a)));
  }

  // 통계
  const totalCount = reports.length;
  const totalPhotos = reports.reduce((sum, r) => {
    const p = tryParseJSON(r.photos, []);
    return sum + (Array.isArray(p) ? p.length : 0);
  }, 0);
  const subjectSet = new Set(reports.map(r => r.subject).filter(Boolean));
  const dateSet = new Set(reports.map(r => getDate(r)).filter(Boolean));
  const filterSubjects = ['전체', ...Array.from(subjectSet).sort()];

  return `
    <div class="full-screen animate-slide">
      <div class="rg-header">
        <button class="rg-back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1 class="rg-title">아하 리포트</h1>
        <div class="rg-header-actions">
          <button class="rg-icon-btn ${searchOpen ? 'active' : ''}" onclick="_RM.toggleAhaSearch()" title="검색">
            <i class="fas fa-search"></i>
          </button>
          <button class="rg-icon-btn" onclick="_RM.setAhaListSort('${currentSort === 'newest' ? 'oldest' : 'newest'}')" title="정렬">
            <i class="fas fa-sort-amount-${currentSort === 'newest' ? 'down' : 'up'}"></i>
          </button>
        </div>
      </div>

      ${searchOpen ? `
      <div class="rg-search-bar">
        <i class="fas fa-search" style="color:var(--text-muted);font-size:13px"></i>
        <input type="text" id="aha-search-input" class="rg-search-input" placeholder="과목, 내용, 출처로 검색..." value="${searchQuery}" oninput="_RM.setAhaSearch(this.value)">
        ${searchQuery ? '<button class="rg-search-clear" onclick="_RM.setAhaSearch(\'\')"><i class="fas fa-times"></i></button>' : ''}
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
            <span class="rg-stat-num" style="color:#8B5CF6">${dateSet.size}</span>
            <span class="rg-stat-label">기록일</span>
          </div>
        </div>

        <!-- 과목 필터 탭 -->
        ${reports.length > 0 ? `
        <div class="rg-filter-wrap">
          <div class="rg-filter-scroll">
            ${filterSubjects.map(sub => {
              const isActive = sub === currentFilter;
              const chipColor = sub === '전체' ? '#6C5CE7' : getSubjectColor(sub);
              const count = sub === '전체' ? reports.length : reports.filter(r => r.subject === sub).length;
              return `<button class="rg-filter-pill ${isActive ? 'active' : ''}" style="${isActive ? 'background:' + chipColor + ';color:#fff;border-color:' + chipColor : '--pill-color:' + chipColor}" onclick="_RM.setAhaListFilter('${sub}')">${sub}${sub !== '전체' ? '<span class="rg-filter-count">' + count + '</span>' : ''}</button>`;
            }).join('')}
          </div>
        </div>` : ''}

        <!-- 카드 그리드 -->
        ${filtered.length === 0 && reports.length === 0 ? `
          <div class="rg-empty">
            <div class="rg-empty-icon">💡</div>
            <p class="rg-empty-title">아직 아하 리포트가 없어요</p>
            <p class="rg-empty-desc">노트를 촬영하고 AI가 정리해드려요!</p>
            <button class="rg-empty-btn" onclick="_RM.goAhaInput()">
              <i class="fas fa-plus" style="margin-right:6px"></i>아하 리포트 작성
            </button>
          </div>
        ` : filtered.length === 0 ? `
          <div class="rg-empty">
            <div class="rg-empty-icon">🔍</div>
            <p class="rg-empty-title">${searchQuery ? '"' + searchQuery + '" 검색 결과 없음' : "'" + currentFilter + "' 과목의 리포트가 없습니다"}</p>
          </div>
        ` : `
          <div class="rg-grid">
            ${filtered.map((r, i) => _renderAhaCard(r, i)).join('')}
          </div>
        `}

        <!-- 하단 추가 버튼 -->
        ${reports.length > 0 ? `
        <div style="padding:16px;text-align:center">
          <button class="aha-add-float-btn" onclick="_RM.goAhaInput()">
            <i class="fas fa-plus" style="margin-right:8px"></i>새 아하 리포트 작성
          </button>
        </div>` : ''}
      </div>
    </div>
  `;
}

function _renderAhaCard(r, cardIdx) {
  const color = getSubjectColor(r.subject || '기타');
  const photos = tryParseJSON(r.photos, []);
  const photoCount = Array.isArray(photos) ? photos.length : 0;
  const pa = tryParseJSON(r.section_pa, []);
  const dateRaw = r.date || r.created_at?.slice(0, 10) || '';
  const d = new Date(dateRaw);
  const dayNames = ['일','월','화','수','목','금','토'];
  const dateStr = dateRaw ? dateRaw.slice(5).replace('-', '/') + ' (' + dayNames[d.getDay()] + ')' : '';

  // 썸네일: 첫 번째 사진 (ref: 시작이 아닌 것만)
  const thumbSrc = photoCount > 0 && !String(photos[0]).startsWith('ref:') ? photos[0] : '';

  // 미리보기 텍스트: SA 섹션 > topic > 내용 없음
  const preview = (r.section_sa || r.section_topic || '').replace(/\n/g, ' ').slice(0, 60);

  return `
    <div class="rg-card" onclick="_RM.viewAhaDetail(${r.id})">
      <div class="rg-card-thumb" style="border-top:3px solid ${color}">
        ${thumbSrc
          ? '<img src="' + thumbSrc + '" alt="" class="rg-card-img" loading="lazy" />'
          : '<div class="rg-card-placeholder"><span>💡</span></div>'
        }
        ${photoCount > 0 ? '<span class="rg-card-badge">' + photoCount + '장</span>' : ''}
        <span class="rg-card-badge rg-badge-ai">AI</span>
      </div>
      <div class="rg-card-body">
        <div class="rg-card-meta">
          <span class="rg-card-subject" style="background:${color}14;color:${color};border:1px solid ${color}30">${r.subject || '미분류'}</span>
          ${r.source ? '<span class="rg-card-period">' + r.source + '</span>' : ''}
        </div>
        <div class="rg-card-title">${preview || '<span style="color:var(--text-muted);font-style:italic">내용 없음</span>'}</div>
        <div class="rg-card-date"><i class="far fa-calendar-alt"></i> ${dateStr}</div>
        ${pa.length > 0 ? `
          <div class="rg-card-tags">
            ${pa.slice(0, 2).map(q => '<span class="rg-card-tag" style="background:' + color + '0A;color:' + color + ';border:1px solid ' + color + '20">Q. ' + q.slice(0, 20) + (q.length > 20 ? '...' : '') + '</span>').join('')}
            ${pa.length > 2 ? '<span class="rg-card-tag-more">+' + (pa.length - 2) + '</span>' : ''}
          </div>
        ` : ''}
      </div>
      <div class="rg-card-arrow"><i class="fas fa-chevron-right"></i></div>
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
