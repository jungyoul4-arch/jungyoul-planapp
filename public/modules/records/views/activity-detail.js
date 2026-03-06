/* ================================================================
   Records Module — views/activity-detail.js
   활동 상세 + 로그
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { kstToday, getSubjectColor } from '../core/utils.js';
import { events, EVENTS } from '../core/events.js';
import { navigate } from '../core/router.js';

export function registerHandlers(RM) {
  RM.saveActivityLog = (ecId) => saveActivityLog(ecId);
  RM.updateActivityProgress = (ecId, val) => updateActivityProgress(ecId, val);
  RM.completeActivity = (ecId) => completeActivity(ecId);
}

function saveActivityLog(ecId) {
  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec) return;

  const content = document.getElementById('act-log-content')?.value?.trim() || '';
  if (!content) return;

  const reflection = document.getElementById('act-log-reflection')?.value?.trim() || '';
  const durationChip = document.querySelector('.act-log-duration-chip.active');
  const duration = durationChip ? durationChip.dataset.duration : '30분';

  const logEntry = {
    date: kstToday(),
    content,
    reflection,
    duration,
    created: new Date().toISOString(),
  };

  if (!ec.logs) ec.logs = [];
  ec.logs.unshift(logEntry);
  ec.progress = Math.min(100, (ec.progress || 0) + 5);

  if (ec._dbId && state.studentId) {
    DB.updateActivityRecord(ec._dbId, { progress: ec.progress, status: ec.status });
    DB.saveActivityLog(ec._dbId, logEntry);
  }

  events.emit(EVENTS.XP_EARNED, { amount: 20, label: '활동 로그 작성!' });
  navigate('activity-detail', { replace: true });
}

function updateActivityProgress(ecId, newProgress) {
  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec) return;
  ec.progress = Math.min(Math.max(newProgress, 0), 100);
  if (ec.progress >= 100) ec.status = 'completed';
  if (ec._dbId && state.studentId) {
    DB.updateActivityRecord(ec._dbId, { progress: ec.progress, status: ec.status });
  }
  navigate('activity-detail', { replace: true });
}

function completeActivity(ecId) {
  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec) return;
  ec.status = 'completed';
  ec.progress = 100;
  if (ec._dbId && state.studentId) {
    DB.updateActivityRecord(ec._dbId, { status: 'completed', progress: 100 });
  }
  events.emit(EVENTS.XP_EARNED, { amount: 30, label: '활동 완료! 🎉' });
  navigate('activity-detail', { replace: true });
}

function getTypeLabel(e) {
  if (e.type === 'report') return '📄 탐구보고서';
  if (e.type === 'reading') return '📖 독서';
  if (e.subType === 'career') return '🎯 진로활동';
  if (e.subType === 'self') return '🧠 자율자치';
  return '🎭 동아리';
}

export function renderActivityDetail() {
  const ecId = state.viewingActivity;
  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec) return '<div style="text-align:center;padding:60px;color:var(--text-muted)">활동을 찾을 수 없습니다.</div>';

  const color = ec.color || getSubjectColor(ec.subject || '기타');
  const logs = ec.logs || [];
  const progress = ec.progress || 0;
  const isCompleted = ec.status === 'completed';

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('record-activity')"><i class="fas fa-arrow-left"></i></button>
        <h1>${ec.title}</h1>
      </div>
      <div class="form-body">
        <!-- 헤더 -->
        <div class="act-detail-header">
          <div class="act-detail-header-top">
            <div style="flex:1">
              <div class="act-detail-title">${ec.title}</div>
              <div class="act-detail-subtitle">${getTypeLabel(ec)} · ${ec.subject || ''}</div>
            </div>
            <div class="rpt-xp-badge">${ec.xpEarned || 0} XP</div>
          </div>
          <div class="act-detail-stats">
            <div class="act-detail-stat"><span class="act-detail-stat-icon">📂</span><span class="act-detail-stat-value">${getTypeLabel(ec).split(' ')[0]}</span><span class="act-detail-stat-label">유형</span></div>
            <div class="act-detail-stat"><span class="act-detail-stat-icon">📅</span><span class="act-detail-stat-value">${ec.startDate || '-'}</span><span class="act-detail-stat-label">시작일</span></div>
            <div class="act-detail-stat"><span class="act-detail-stat-icon">📊</span><span class="act-detail-stat-value">${progress}%</span><span class="act-detail-stat-label">진행률</span></div>
            <div class="act-detail-stat"><span class="act-detail-stat-icon">📝</span><span class="act-detail-stat-value">${logs.length}</span><span class="act-detail-stat-label">기록</span></div>
          </div>
          <div class="act-detail-progress-wrap">
            <div class="act-detail-progress-bar"><div class="act-detail-progress-fill" style="width:${progress}%;background:${color}"></div></div>
            <span class="act-detail-progress-text">${progress}%</span>
          </div>
        </div>

        <!-- 활동 설명 -->
        ${ec.description ? `
        <div class="act-detail-card">
          <div class="act-detail-card-title">📋 활동 설명</div>
          <div class="act-detail-card-body">${ec.description}</div>
        </div>` : ''}

        ${ec.careerLink ? `
        <div class="act-detail-card">
          <div class="act-detail-card-title">🔗 진로 연계</div>
          <div class="act-detail-card-body">${ec.careerLink}</div>
        </div>` : ''}

        <!-- 활동 로그 -->
        <div class="act-detail-card">
          <div class="act-detail-card-header">
            <div class="act-detail-card-title">📝 활동 로그</div>
            <span style="font-size:12px;color:var(--text-muted)">${logs.length}건</span>
          </div>
          ${logs.length === 0 ? `
            <div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">아직 활동 로그가 없어요</div>
          ` : logs.map(log => `
            <div class="act-log-item">
              <div class="act-log-date">${(log.date || '').slice(5).replace('-', '/')}</div>
              <div class="act-log-content">
                <div class="act-log-text">${log.content}</div>
                ${log.reflection ? `<div class="act-log-reflection">💎 ${log.reflection}</div>` : ''}
                ${log.duration ? `<div class="act-log-duration">⏱️ ${log.duration}</div>` : ''}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- 새 로그 작성 -->
        ${!isCompleted ? `
        <div class="act-detail-card act-log-form">
          <div class="act-detail-card-title">✏️ 새 활동 기록 추가</div>
          <div class="field-group">
            <textarea class="input-field" id="act-log-content" rows="3" placeholder="오늘 활동한 내용을 적어주세요"></textarea>
          </div>
          <div class="field-group">
            <label class="field-label">💎 느낀 점 / 배운 점 <span class="field-hint">(선택)</span></label>
            <input class="input-field" id="act-log-reflection" placeholder="세특에 녹아들 소중한 기록!">
          </div>
          <div class="field-group">
            <label class="field-label">⏱️ 소요 시간</label>
            <div class="chip-row">
              ${['15분', '30분', '1시간', '2시간', '3시간+'].map((t, i) => `
                <button class="chip act-log-duration-chip ${i === 1 ? 'active' : ''}" data-duration="${t}" onclick="document.querySelectorAll('.act-log-duration-chip').forEach(c=>c.classList.remove('active'));this.classList.add('active')">${t}</button>
              `).join('')}
            </div>
          </div>
          <button class="btn-primary" onclick="_RM.saveActivityLog('${ec.id}')">
            📝 활동 기록 저장 +20 XP
          </button>
        </div>
        ` : ''}

        <!-- 액션 버튼 -->
        <div class="act-detail-actions">
          ${!isCompleted ? `
            <button class="btn-secondary" onclick="_RM.updateActivityProgress('${ec.id}', ${Math.min(progress + 10, 100)})">
              📈 진행률 +10%
            </button>
            <button class="btn-secondary" style="background:rgba(0,184,148,0.1);border-color:rgba(0,184,148,0.3);color:#00B894" onclick="_RM.completeActivity('${ec.id}')">
              ✅ 활동 완료
            </button>
          ` : `
            <button class="btn-secondary" style="width:100%">
              ✅ 완료된 활동
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}
