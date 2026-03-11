/* ================================================================
   Records Module — views/career-detail.js
   진로 프로파일 상세 뷰 (앱티핏 전공적성 검사 결과)
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';

export function renderCareerDetail() {
  const cp = state._careerProfile;
  if (!cp) {
    return `
      <div class="tab-content animate-in">
        <div class="screen-header">
          <button class="back-btn" onclick="_RM.nav('dashboard')">←</button>
          <h1>🧭 진로 프로파일</h1>
        </div>
        <div class="card" style="text-align:center;padding:40px 20px">
          <div style="font-size:48px;margin-bottom:12px">🧭</div>
          <h3 style="color:var(--text-primary);margin-bottom:8px">진로 프로파일이 아직 등록되지 않았어요</h3>
          <p style="color:var(--text-secondary);font-size:14px">멘토에게 앱티핏 전공적성 검사 결과 PDF 등록을 요청하세요.</p>
        </div>
      </div>`;
  }

  const dream = cp.dream_department || {};
  const topDepts = cp.top_departments || [];
  const fieldProfile = cp.field_profile || {};
  const majorProfile = cp.major_profile || {};
  const careers = cp.careers || [];
  const advice = cp.career_advice || '';

  // 계열 적성 바 차트 데이터 정렬
  const fieldEntries = Object.entries(fieldProfile).sort((a, b) => Number(b[1]) - Number(a[1]));
  const maxField = fieldEntries.length > 0 ? Number(fieldEntries[0][1]) : 100;

  // 계열별 색상
  const fieldColors = {
    '자연': '#6366f1', '사회': '#10b981', '공학': '#06b6d4', '교육': '#f59e0b',
    '의약': '#ec4899', '인문': '#8b5cf6', '예체능': '#f97316', '상경': '#14b8a6'
  };

  return `
    <div class="tab-content animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')">←</button>
        <h1>🧭 진로 프로파일</h1>
      </div>

      <!-- 꿈의 전공 히어로 카드 -->
      <div class="card stagger-1 animate-in" style="background:linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.10) 100%);border:1px solid rgba(99,102,241,0.25);text-align:center;padding:28px 20px">
        <div style="font-size:40px;margin-bottom:8px">🎯</div>
        <div style="font-size:13px;color:var(--text-secondary);font-weight:600;margin-bottom:4px">꿈의 전공</div>
        <div style="font-size:26px;font-weight:800;color:#a5b4fc;margin-bottom:4px">${dream.department || '미등록'}</div>
        ${dream.field ? `<div style="font-size:14px;color:var(--text-secondary)">${dream.field}</div>` : ''}
        ${dream.score ? `<div style="font-size:48px;font-weight:800;color:#6366f1;margin-top:8px">${dream.score}<span style="font-size:20px">%</span></div>` : ''}
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">적합도</div>
      </div>

      <!-- TOP 학과 순위 -->
      ${topDepts.length > 0 ? `
      <div class="card stagger-2 animate-in">
        <div class="card-title">🏆 학과 적합도 순위</div>
        <div style="margin-top:12px">
          ${topDepts.map((d, i) => {
            const isTop = i === 0;
            const barColor = isTop ? '#6366f1' : i < 3 ? '#818cf8' : '#a5b4fc';
            return `
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
              <div style="width:24px;height:24px;border-radius:8px;background:${isTop ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.05)'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:${isTop ? '#fbbf24' : 'var(--text-secondary)'}">${d.rank || i + 1}</div>
              <div style="flex:1;min-width:0">
                <div style="font-size:14px;font-weight:600;color:var(--text-primary);margin-bottom:2px">${d.department}</div>
                <div style="font-size:11px;color:var(--text-muted)">${d.field || ''}</div>
              </div>
              <div style="width:80px">
                <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:4px;overflow:hidden">
                  <div style="height:100%;width:${d.score}%;background:${barColor};border-radius:4px;transition:width 0.6s ease"></div>
                </div>
              </div>
              <div style="min-width:36px;text-align:right;font-size:14px;font-weight:700;color:${barColor}">${d.score}%</div>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- 계열 적성 바 차트 -->
      ${fieldEntries.length > 0 ? `
      <div class="card stagger-3 animate-in">
        <div class="card-title">📊 계열 적성 프로파일</div>
        <div style="margin-top:12px">
          ${fieldEntries.map(([field, val]) => {
            const pct = Math.round((Number(val) / maxField) * 100);
            const color = fieldColors[field] || '#6366f1';
            return `
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:13px;color:var(--text-primary);min-width:48px;font-weight:600">${field}</span>
              <div style="flex:1;height:10px;background:rgba(255,255,255,0.06);border-radius:5px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${color};border-radius:5px;transition:width 0.6s ease"></div>
              </div>
              <span style="font-size:13px;font-weight:700;color:${color};min-width:28px;text-align:right">${val}</span>
            </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- 전공 상세 프로파일 (5축) -->
      ${majorProfile && (majorProfile.abilities?.length || majorProfile.values?.length) ? `
      <div class="card stagger-4 animate-in">
        <div class="card-title">🎭 전공 적성 프로파일</div>
        <div style="margin-top:12px;display:flex;flex-direction:column;gap:12px">
          ${_renderProfileAxis('💪 역량', majorProfile.abilities)}
          ${_renderProfileAxis('💎 가치관', majorProfile.values)}
          ${_renderProfileAxis('🧠 개인 특성', majorProfile.personality)}
          ${_renderProfileAxis('🔍 흥미', majorProfile.interests)}
          ${_renderProfileAxis('📚 지식', majorProfile.knowledge)}
        </div>
      </div>` : ''}

      <!-- 진로 조언 -->
      ${advice ? `
      <div class="card stagger-5 animate-in">
        <div class="card-title">💬 진로 조언</div>
        <p style="font-size:14px;color:var(--text-secondary);line-height:1.7;margin-top:8px;white-space:pre-wrap">${advice}</p>
      </div>` : ''}

      <!-- 추천 커리어 -->
      ${careers.length > 0 ? `
      <div class="card stagger-6 animate-in">
        <div class="card-title">🚀 추천 커리어</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px">
          ${careers.map(c => `<span style="font-size:13px;padding:6px 14px;border-radius:20px;background:rgba(99,102,241,0.1);color:#a5b4fc;font-weight:600">${c}</span>`).join('')}
        </div>
      </div>` : ''}

      ${cp.test_date ? `<div style="text-align:center;font-size:11px;color:var(--text-muted);padding:16px 0">검사일: ${cp.test_date} · ${cp.test_provider || 'aptifit'}</div>` : ''}
    </div>`;
}

function _renderProfileAxis(label, items) {
  if (!items || items.length === 0) return '';
  return `
    <div>
      <div style="font-size:13px;font-weight:700;color:var(--text-primary);margin-bottom:6px">${label}</div>
      <div style="display:flex;flex-wrap:wrap;gap:6px">
        ${items.map(item => `<span style="font-size:12px;padding:4px 10px;border-radius:10px;background:rgba(255,255,255,0.06);color:var(--text-secondary)">${item}</span>`).join('')}
      </div>
    </div>`;
}
