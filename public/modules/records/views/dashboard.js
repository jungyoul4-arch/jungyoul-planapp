/* ================================================================
   Records Module — views/dashboard.js
   기록 대시보드 (renderRecordTab 포팅)
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';
import { getDday, formatDate } from '../core/utils.js';

// _RM 네임스페이스에 등록할 핸들러
export function registerHandlers(RM) {
  RM.goDashboard = () => navigate('dashboard');
}

const examTypeIcons = { midterm:'📘', final:'📕', mock:'📗', performance:'📝' };

function _renderUpcomingExams() {
  const upcomingExams = (state.exams||[]).filter(e => !e.result && getDday(e.startDate) >= 0).sort((a,b) => (a.startDate||'').localeCompare(b.startDate||'')).slice(0,3);
  if (upcomingExams.length === 0) return '';
  return `
    <div class="card stagger-7 animate-in">
      <div class="card-header-row">
        <span class="card-title">📝 다가오는 시험</span>
        <button class="card-link" onclick="_RM.nav('exam-list')">전체보기 →</button>
      </div>
      ${upcomingExams.map(e => {
        const dDay = getDday(e.startDate);
        const dDayText = dDay === 0 ? 'D-Day' : 'D-' + dDay;
        const urgency = dDay <= 3 ? 'urgent' : dDay <= 7 ? 'warning' : 'normal';
        const subs = e.subjects || [];
        const avgReadiness = subs.length > 0 ? Math.round(subs.reduce((s,sub) => s + (sub.readiness||0), 0) / subs.length) : 0;
        return `
        <div class="exam-mini-row" onclick="_RM.state.viewingExam='${e.id}';_RM.nav('exam-detail')">
          <span class="exam-mini-icon">${examTypeIcons[e.type]||'📝'}</span>
          <div class="exam-mini-info">
            <span class="exam-mini-name">${e.name}</span>
            <span class="exam-mini-subjects">${subs.map(s => s.subject).join(', ')}</span>
          </div>
          <div class="exam-mini-right">
            <span class="assignment-dday ${urgency}">${dDayText}</span>
            <div class="exam-mini-bar"><div class="exam-mini-bar-fill" style="width:${avgReadiness}%;background:var(--primary)"></div></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function _renderActiveAssignments() {
  const activeAssignments = (state.assignments||[]).filter(a => a.status !== 'completed').sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).slice(0,3);
  if (activeAssignments.length === 0) return '';
  return `
    <div class="card stagger-8 animate-in">
      <div class="card-header-row">
        <span class="card-title">📋 진행 중 과제</span>
        <button class="card-link" onclick="_RM.nav('assignment-list')">전체보기 →</button>
      </div>
      ${activeAssignments.map(a => {
        const dDay = getDday(a.dueDate);
        const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? 'D-' + dDay : 'D+' + Math.abs(dDay);
        return `
        <div class="assignment-mini-row" onclick="_RM.state.viewingAssignment='${a.id}';_RM.nav('assignment-plan')">
          <div class="assignment-mini-dot" style="background:${a.color||'var(--primary)'}"></div>
          <div class="assignment-mini-info">
            <span class="assignment-mini-subject">${a.subject} · ${dDayText}</span>
            <span class="assignment-mini-title">${a.title}</span>
          </div>
          <div class="assignment-mini-right">
            <span style="font-size:11px;font-weight:700;color:var(--text-muted)">${a.progress||0}%</span>
            <div class="assignment-mini-bar"><div class="assignment-mini-bar-fill" style="width:${a.progress||0}%;background:${a.color||'var(--primary)'}"></div></div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

export function renderDashboard() {
  const classRecordCount = (state._dbClassRecords || []).length;

  return `
    <div class="tab-content animate-in">
      <div class="screen-header">
        <h1>📝 기록</h1>
      </div>

      <div class="record-type-grid">
        <!-- 오늘의 수업 (교시 선택) -->
        <div class="record-type-card stagger-0 animate-in" style="background:linear-gradient(135deg,rgba(108,92,231,0.12),rgba(0,184,148,0.08));border:1.5px solid rgba(108,92,231,0.3)" onclick="_RM.nav('period-select')">
          <div class="record-type-icon" style="background:rgba(108,92,231,0.2)">📝</div>
          <div class="record-type-info">
            <h3>오늘의 수업</h3>
            <p>사진 찍고 AI가 수업 탐구 기록 자동 정리</p>
          </div>
          <span style="color:var(--primary-light);font-size:14px"><i class="fas fa-chevron-right"></i></span>
        </div>

        <!-- 나의 수업 기록 열람 -->
        <div class="record-type-card stagger-1 animate-in" style="background:rgba(108,92,231,0.08);border:1px solid rgba(108,92,231,0.2)" onclick="_RM.nav('class-record-history')">
          <div class="record-type-icon" style="background:rgba(108,92,231,0.2)">📚</div>
          <div class="record-type-info">
            <h3>나의 수업 다시보기</h3>
            <p>기록한 수업 내용·사진 다시보기 ${classRecordCount > 0 ? '<span style="color:var(--primary-light);font-weight:600">' + classRecordCount + '건</span>' : ''}</p>
          </div>
          <span style="color:var(--primary-light);font-size:14px"><i class="fas fa-chevron-right"></i></span>
        </div>

        <!-- 사진 앨범 -->
        <div class="record-type-card stagger-1 animate-in" style="background:rgba(0,184,148,0.08);border:1px solid rgba(0,184,148,0.2)" onclick="_RM.nav('photo-album')">
          <div class="record-type-icon" style="background:rgba(0,184,148,0.2)">📷</div>
          <div class="record-type-info">
            <h3>사진 앨범</h3>
            <p>수업 필기·프린트 사진 모아보기</p>
          </div>
          <span style="color:var(--primary-light);font-size:14px"><i class="fas fa-chevron-right"></i></span>
        </div>

        ${[
          { screen: 'record-question', icon: '❓', bg: 'rgba(255,107,107,0.15)', title: '나의 질문함', desc: '궁금한 것을 기록하고 답을 찾아가기', xp: '+3' },
          { screen: 'record-teach', icon: '🤝', bg: 'rgba(0,184,148,0.15)', title: '교학상장', desc: '친구에게 가르친 경험', xp: '+30' },
          { screen: 'exam-list', icon: '📝', bg: 'rgba(224,86,160,0.15)', title: '시험 관리', desc: '시험 일정 + 결과 + 성장분석', xp: '' },
          { screen: 'assignment-list', icon: '📋', bg: 'rgba(255,159,67,0.15)', title: '과제 기록', desc: '과제 등록 + 마감 관리', xp: '+15' },
          { screen: 'record-activity', icon: '🏫', bg: 'rgba(253,203,110,0.15)', title: '창의적 체험활동', desc: '비교과 활동 기록', xp: '+20' },
          { screen: 'aha-list', icon: '💡', bg: 'rgba(255,159,67,0.15)', title: '아하 리포트', desc: '영역 탐구 보고서 작성', xp: '+15' },
          { screen: 'record-history', icon: '📜', bg: 'rgba(116,185,255,0.15)', title: '기록 히스토리', desc: '모든 기록 한눈에 보기', xp: '' },
          { screen: 'school-record', icon: '📄', bg: 'rgba(162,155,254,0.15)', title: '생활기록부 관리', desc: '생기부 업로드 및 분석', xp: '+30' },
        ].map((item, i) => `
          <div class="record-type-card stagger-${i + 2} animate-in" onclick="_RM.nav('${item.screen}')">
            <div class="record-type-icon" style="background:${item.bg}">${item.icon}</div>
            <div class="record-type-info">
              <h3>${item.title}</h3>
              <p>${item.desc}</p>
            </div>
            ${item.xp ? `<span class="xp-badge-sm">${item.xp}</span>` : ''}
          </div>
        `).join('')}
      </div>

      <!-- Upcoming Exams Mini Section -->
      ${_renderUpcomingExams()}

      <!-- In-Progress Assignments Mini Section -->
      ${_renderActiveAssignments()}

      <!-- Recent Records Timeline -->
      <div class="card stagger-9 animate-in">
        <div class="card-header-row">
          <span class="card-title">📜 최근 기록</span>
          <button class="card-link" onclick="_RM.nav('record-history')">전체보기 →</button>
        </div>

        <div class="timeline">
          ${(state._dbClassRecords || []).slice(0, 4).map(r => `
          <div class="timeline-item">
            <div class="timeline-dot" style="background:var(--primary)"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">${r.date || ''}</span>
                <span class="timeline-subject">${r.subject || ''}</span>
              </div>
              <p class="timeline-text">${r.content || r.topic || '수업 기록'}</p>
            </div>
          </div>
          `).join('')}
          ${classRecordCount === 0 ? '<div style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">아직 기록이 없습니다. 수업을 기록해보세요!</div>' : ''}
        </div>
      </div>
    </div>
  `;
}
