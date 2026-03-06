/* ================================================================
   Records Module — views/activity-result.js
   창체 활동 AI 분석 로딩 + 결과 화면
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';

export function registerHandlers(RM) {
  RM.activityResultSave = () => saveAndGoBack(RM);
  RM.activityResultBack = () => {
    state._activityAiResult = null;
    state._activityAiType = '';
    RM.nav('record-activity');
  };
}

async function saveAndGoBack(RM) {
  const result = state._activityAiResult;
  const type = state._activityAiType;
  if (!result || !type) return;

  const TITLES = { club: '동아리 활동', career: '진로 활동', autonomy: '자율·자치 활동', reading: '독서활동', volunteer: '봉사활동' };
  const PREFIX_MAP = { club: '_club', career: '_career', autonomy: '_autonomy', reading: '_reading', volunteer: '_vol' };
  const prefix = PREFIX_MAP[type] || '_club';
  const photos = state[`${prefix}Photos`] || [];
  const comment = state[`${prefix}Comment`] || '';

  const logId = await DB.saveActivityLogWithPhotos(
    type, TITLES[type] || type, photos, comment || result.summary || '활동 기록', null, result
  );

  // state 초기화
  state[`${prefix}Photos`] = [];
  state[`${prefix}PhotoTags`] = [];
  state[`${prefix}Comment`] = '';
  state._activityAiResult = null;
  state._activityAiType = '';

  if (logId && RM.toast) RM.toast(`${TITLES[type] || '활동'}이 저장되었습니다`);
  RM.nav('record-activity');
}

/* ── 로딩 화면 ── */
export function renderActivityLoading() {
  const step = state._activityAnalysisStep || '사진을 분석하고 있어요...';
  const COLORS = { club: '#6366f1', career: '#10b981', autonomy: '#f59e0b', reading: '#ec4899', volunteer: '#06b6d4' };
  const color = COLORS[state._activityAiType] || '#6366f1';

  return `
    <div class="full-screen animate-slide" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh">
      <div style="width:60px;height:60px;border:3px solid ${color}22;border-top-color:${color};border-radius:50%;animation:rm-spin 0.8s linear infinite;margin-bottom:24px"></div>
      <p style="font-size:16px;font-weight:600;color:var(--text-primary);margin-bottom:8px">AI 분석 중</p>
      <p style="font-size:14px;color:var(--text-secondary)">${step}</p>
    </div>
  `;
}

/* ── 결과 화면 ── */
export function renderActivityResult() {
  const result = state._activityAiResult;
  const type = state._activityAiType;
  if (!result) return `<div class="full-screen"><p>분석 결과가 없습니다.</p></div>`;

  if (type === 'career') return renderCareerResult(result);
  if (type === 'club') return renderClubResult(result);
  return renderGeneralResult(result, type);
}

function renderCareerResult(r) {
  const sections = [
    { title: '활동 내용 요약', icon: 'fas fa-pen', content: r.summary, color: '#8b5cf6' },
    { title: '알게 된 점', icon: 'fas fa-lightbulb', content: r.learned, color: '#f59e0b' },
    { title: '느낀 점 / 성찰', icon: 'fas fa-heart', content: r.reflection, color: '#ec4899' },
    { title: '변화된 점', icon: 'fas fa-sync-alt', content: r.changed, color: '#10b981' },
    { title: '후속 계획', icon: 'fas fa-calendar-check', content: r.next_plan, color: '#3b82f6' },
  ].filter(s => s.content);

  const questions = (r.questions || []).filter(q => q);

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.activityResultBack()"><i class="fas fa-arrow-left"></i></button>
        <h1>진로활동 분석 결과</h1>
        <span class="header-badge" style="background:#10b981;color:#fff">AI</span>
      </div>
      <div class="form-body" style="padding-bottom:100px">
        ${r.activity_name ? `<div style="background:linear-gradient(135deg,#10b98122,#10b98108);border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:13px;color:#10b981;font-weight:600;margin-bottom:4px">${r.activity_subtype || '진로활동'}</div>
          <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${r.activity_name}</div>
          ${r.date ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${r.date} | ${r.student_name || ''} ${r.grade_class || ''}</div>` : ''}
        </div>` : ''}

        ${sections.map(s => `
          <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border-color)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="${s.icon}" style="color:${s.color};font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${s.title}</span>
            </div>
            <p style="font-size:14px;line-height:1.8;color:var(--text-secondary);word-break:keep-all">${s.content}</p>
          </div>
        `).join('')}

        ${questions.length > 0 ? `
          <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border-color)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="fas fa-question-circle" style="color:#8b5cf6;font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:var(--text-primary)">생긴 질문</span>
            </div>
            ${questions.map((q, i) => `<p style="font-size:14px;line-height:1.8;color:var(--text-secondary);margin-bottom:4px">${i + 1}. ${q}</p>`).join('')}
          </div>
        ` : ''}

        ${r.teacher_insight ? `
          <div style="background:linear-gradient(135deg,#6366f108,#8b5cf610);border:1px solid #6366f133;border-radius:12px;padding:16px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="fas fa-graduation-cap" style="color:#6366f1;font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:#6366f1">세특 관찰 코멘트</span>
            </div>
            <p style="font-size:14px;line-height:1.8;color:var(--text-secondary);word-break:keep-all">${r.teacher_insight}</p>
          </div>
        ` : ''}

        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--bg-primary);border-top:1px solid var(--border-color)">
          <button class="btn-primary" style="width:100%;padding:14px;font-size:15px;font-weight:600" onclick="_RM.activityResultSave()">
            <i class="fas fa-save" style="margin-right:8px"></i>저장하기
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderClubResult(r) {
  const sections = [
    { title: '활동 내용', icon: 'fas fa-pen', content: r.content, color: '#6366f1' },
    { title: '활동 결과', icon: 'fas fa-check-circle', content: r.result, color: '#10b981' },
    { title: '활동 소감 및 성찰', icon: 'fas fa-heart', content: r.reflection, color: '#ec4899' },
    { title: '차기 활동 계획', icon: 'fas fa-calendar-check', content: r.next_plan, color: '#3b82f6' },
  ].filter(s => s.content);

  const questions = (r.questions || []).filter(q => q);

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.activityResultBack()"><i class="fas fa-arrow-left"></i></button>
        <h1>동아리활동 분석 결과</h1>
        <span class="header-badge" style="background:#6366f1;color:#fff">AI</span>
      </div>
      <div class="form-body" style="padding-bottom:100px">
        ${r.club_name ? `<div style="background:linear-gradient(135deg,#6366f122,#6366f108);border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${r.club_name} ${r.session_number ? `제 ${r.session_number}회차` : ''}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:6px;display:flex;flex-wrap:wrap;gap:8px">
            ${r.activity_date ? `<span>${r.activity_date}</span>` : ''}
            ${r.activity_time ? `<span>${r.activity_time}</span>` : ''}
            ${r.activity_place ? `<span>${r.activity_place}</span>` : ''}
          </div>
          ${r.topic ? `<div style="font-size:13px;color:#6366f1;font-weight:600;margin-top:8px">${r.topic}</div>` : ''}
        </div>` : ''}

        ${sections.map(s => `
          <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border-color)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="${s.icon}" style="color:${s.color};font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${s.title}</span>
            </div>
            <p style="font-size:14px;line-height:1.8;color:var(--text-secondary);word-break:keep-all">${s.content}</p>
          </div>
        `).join('')}

        ${questions.length > 0 ? `
          <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border-color)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="fas fa-search" style="color:#8b5cf6;font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:var(--text-primary)">궁금한 점</span>
              <span style="font-size:11px;color:var(--text-muted)">세특 소재</span>
            </div>
            ${questions.map((q, i) => `<p style="font-size:14px;line-height:1.8;color:var(--text-secondary);margin-bottom:4px">${i + 1}. ${q}</p>`).join('')}
          </div>
        ` : ''}

        ${r.teacher_insight ? `
          <div style="background:linear-gradient(135deg,#6366f108,#8b5cf610);border:1px solid #6366f133;border-radius:12px;padding:16px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="fas fa-graduation-cap" style="color:#6366f1;font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:#6366f1">세특 관찰 코멘트</span>
            </div>
            <p style="font-size:14px;line-height:1.8;color:var(--text-secondary);word-break:keep-all">${r.teacher_insight}</p>
          </div>
        ` : ''}

        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--bg-primary);border-top:1px solid var(--border-color)">
          <button class="btn-primary" style="width:100%;padding:14px;font-size:15px;font-weight:600" onclick="_RM.activityResultSave()">
            <i class="fas fa-save" style="margin-right:8px"></i>저장하기
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderGeneralResult(r, type) {
  const LABELS = { autonomy: '자율·자치', reading: '독서활동', volunteer: '봉사활동' };
  const COLORS = { autonomy: '#f59e0b', reading: '#ec4899', volunteer: '#06b6d4' };
  const label = LABELS[type] || '활동';
  const color = COLORS[type] || '#6366f1';

  const sections = [
    { title: '활동 내용 요약', icon: 'fas fa-pen', content: r.summary, color },
    { title: '활동 소감/성찰', icon: 'fas fa-heart', content: r.reflection, color: '#ec4899' },
    { title: '후속 계획', icon: 'fas fa-calendar-check', content: r.next_plan, color: '#3b82f6' },
  ].filter(s => s.content);

  const questions = (r.questions || []).filter(q => q);

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.activityResultBack()"><i class="fas fa-arrow-left"></i></button>
        <h1>${label} 분석 결과</h1>
        <span class="header-badge" style="background:${color};color:#fff">AI</span>
      </div>
      <div class="form-body" style="padding-bottom:100px">
        ${r.activity_name ? `<div style="background:linear-gradient(135deg,${color}22,${color}08);border-radius:12px;padding:14px 16px;margin-bottom:16px">
          <div style="font-size:16px;font-weight:700;color:var(--text-primary)">${r.activity_name}</div>
          ${r.date ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px">${r.date} ${r.student_name || ''}</div>` : ''}
        </div>` : ''}

        ${sections.map(s => `
          <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border-color)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="${s.icon}" style="color:${s.color};font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:var(--text-primary)">${s.title}</span>
            </div>
            <p style="font-size:14px;line-height:1.8;color:var(--text-secondary);word-break:keep-all">${s.content}</p>
          </div>
        `).join('')}

        ${questions.length > 0 ? `
          <div style="background:var(--card-bg);border-radius:12px;padding:16px;margin-bottom:12px;border:1px solid var(--border-color)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="fas fa-question-circle" style="color:#8b5cf6;font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:var(--text-primary)">생긴 질문</span>
            </div>
            ${questions.map((q, i) => `<p style="font-size:14px;line-height:1.8;color:var(--text-secondary);margin-bottom:4px">${i + 1}. ${q}</p>`).join('')}
          </div>
        ` : ''}

        ${r.teacher_insight ? `
          <div style="background:linear-gradient(135deg,${color}08,${color}15);border:1px solid ${color}33;border-radius:12px;padding:16px;margin-bottom:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px">
              <i class="fas fa-graduation-cap" style="color:${color};font-size:14px"></i>
              <span style="font-size:14px;font-weight:600;color:${color}">세특 관찰 코멘트</span>
            </div>
            <p style="font-size:14px;line-height:1.8;color:var(--text-secondary);word-break:keep-all">${r.teacher_insight}</p>
          </div>
        ` : ''}

        <div style="position:fixed;bottom:0;left:0;right:0;padding:16px;background:var(--bg-primary);border-top:1px solid var(--border-color)">
          <button class="btn-primary" style="width:100%;padding:14px;font-size:15px;font-weight:600" onclick="_RM.activityResultSave()">
            <i class="fas fa-save" style="margin-right:8px"></i>저장하기
          </button>
        </div>
      </div>
    </div>
  `;
}
