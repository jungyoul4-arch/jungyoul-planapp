/* ================================================================
   Records Module — views/assignment-list.js
   과제 목록 + 과제 계획(플랜) 화면
   ================================================================ */

import { state } from '../core/state.js';
import { navigate, render } from '../core/router.js';
import { getDday, formatDate } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.setAssignmentFilter = (filter) => {
    state.assignmentFilter = filter;
    render();
  };

  RM.togglePlanStep = (assignmentId, stepIdx) => {
    const a = (state.assignments||[]).find(x => String(x.id) === String(assignmentId));
    if (!a || !a.plan || !a.plan[stepIdx]) return;
    a.plan[stepIdx].done = !a.plan[stepIdx].done;

    const doneCount = a.plan.filter(p => p.done).length;
    a.progress = Math.round(doneCount / a.plan.length * 100);

    if (a.progress === 100) {
      a.status = 'completed';
    } else if (a.progress > 0) {
      a.status = 'in-progress';
    } else {
      a.status = 'pending';
    }

    if (a._dbId) {
      RM.DB.updateAssignment(a._dbId, { status: a.status, progress: a.progress, planData: a.plan });
    }

    render();
  };

  RM.toggleAssignmentDone = (assignmentId) => {
    const a = (state.assignments||[]).find(x => String(x.id) === String(assignmentId));
    if (!a) return;
    a.status = a.status === 'completed' ? 'pending' : 'completed';
    a.progress = a.status === 'completed' ? 100 : 0;
    if (a.status === 'completed' && a.plan) a.plan.forEach(p => p.done = true);

    if (a._dbId) {
      RM.DB.updateAssignment(a._dbId, { status: a.status, progress: a.progress });
    }

    render();
    if (a.status === 'completed') {
      RM.showXpPopup(5, '과제 완료! 📋');
    }
  };
}

/* ── 과제 계획 (assignment-plan) ── */
export function renderAssignmentPlan() {
  const a = (state.assignments||[]).find(x => String(x.id) === String(state.viewingAssignment));
  if (!a) { navigate('assignment-list'); return ''; }

  const dDay = getDday(a.dueDate);
  const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
  const urgency = dDay <= 1 ? 'urgent' : dDay <= 3 ? 'warning' : 'normal';
  const donePlanSteps = (a.plan||[]).filter(p => p.done).length;
  const totalPlanSteps = (a.plan||[]).length;
  const planPct = totalPlanSteps > 0 ? Math.round(donePlanSteps / totalPlanSteps * 100) : 0;

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.state.viewingAssignment=null;_RM.nav('assignment-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>📅 과제 계획</h1>
        <span class="assignment-dday ${urgency}" style="font-size:13px;padding:5px 12px">${dDayText}</span>
      </div>

      <div class="form-body">
        <div class="assignment-summary-card animate-in" style="border-left:4px solid ${a.color}">
          <div class="asm-header">
            <div class="asm-subject" style="color:${a.color}">${a.subject}</div>
            <span class="asm-type">${a.type}</span>
          </div>
          <h2 class="asm-title">${a.title}</h2>
          <p class="asm-desc">${a.desc}</p>
          <div class="asm-meta">
            <span><i class="fas fa-user"></i> ${a.teacher} 선생님</span>
            <span><i class="fas fa-calendar"></i> ${formatDate(a.dueDate)} 까지</span>
          </div>
          <div class="asm-progress-row">
            <div class="asm-progress-bar"><div class="asm-progress-fill" style="width:${a.progress}%;background:${a.color}"></div></div>
            <span class="asm-progress-text">${a.progress}%</span>
          </div>
        </div>

        <div class="plan-section stagger-1 animate-in">
          <div class="card-header-row">
            <span class="card-title">📋 단계별 플랜</span>
            <span class="card-subtitle">${donePlanSteps}/${totalPlanSteps} 완료</span>
          </div>

          <div class="plan-progress-mini">
            <div class="plan-progress-bar"><div class="plan-progress-fill" style="width:${planPct}%;background:${a.color}"></div></div>
          </div>

          <div class="plan-steps">
            ${(a.plan||[]).length === 0 ? `
              <div style="text-align:center;padding:20px 0;color:var(--text-muted)">
                <span style="font-size:28px;display:block;margin-bottom:8px">📝</span>
                <p style="font-size:13px;margin:0">아직 세부 플랜이 없어요</p>
                <p style="font-size:11px;margin-top:4px">과제를 수정해서 단계를 추가해보세요!</p>
              </div>
            ` : (a.plan||[]).map((step, i) => {
              const isNext = !step.done && (i === 0 || a.plan[i-1].done);
              return `
              <div class="plan-step ${step.done ? 'done' : ''} ${isNext ? 'next' : ''}">
                <div class="plan-step-check" onclick="_RM.togglePlanStep('${a.id}', ${i})">
                  ${step.done
                    ? '<i class="fas fa-check-circle" style="color:var(--success);font-size:20px"></i>'
                    : isNext
                      ? '<i class="far fa-circle" style="color:var(--primary-light);font-size:20px"></i>'
                      : '<i class="far fa-circle" style="color:var(--text-muted);font-size:20px"></i>'
                  }
                </div>
                <div class="plan-step-line ${i === a.plan.length - 1 ? 'last' : ''} ${step.done ? 'done' : ''}"></div>
                <div class="plan-step-content ${isNext ? 'highlight' : ''}">
                  <div class="plan-step-header">
                    <span class="plan-step-num">Step ${step.step}</span>
                    <span class="plan-step-date">${step.date}</span>
                  </div>
                  <span class="plan-step-title">${step.title}</span>
                </div>
              </div>
              `;
            }).join('')}
          </div>
        </div>

        <div class="ai-plan-card stagger-2 animate-in">
          <div class="ai-header">
            <span class="ai-icon">🤖</span>
            <span class="ai-title">정율 플랜 제안</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-top:8px">
            ${dDay <= 3
              ? `⚠️ 마감이 <strong style="color:var(--accent)">${dDay}일</strong> 남았어요! 오늘부터 하루 1단계씩 진행하면 충분히 완료할 수 있어요. 집중 시간을 확보하세요!`
              : `✅ 마감까지 <strong style="color:var(--success)">${dDay}일</strong> 남았어요. 현재 진행률 ${a.progress}%로 순조로운 편이에요. 꾸준히 하루에 1단계씩 진행해보세요!`
            }
          </p>
        </div>

        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-secondary" style="flex:1" onclick="_RM.state.editingAssignment='${a.id}';_RM.nav('record-assignment')">
            <i class="fas fa-edit"></i> 수정
          </button>
          <button class="btn-primary" style="flex:2" onclick="_RM.nav('assignment-list')">
            <i class="fas fa-list"></i> 과제 목록
          </button>
        </div>

        ${a.status !== 'completed' ? `
        <button class="btn-ghost" style="width:100%;margin-top:8px;color:var(--success)" onclick="_RM.toggleAssignmentDone('${a.id}')">
          ✅ 과제 완료 처리
        </button>
        ` : `
        <div class="assignment-completed-badge">
          <i class="fas fa-check-circle"></i> 이 과제는 완료되었습니다! 🎉
        </div>
        `}
      </div>
    </div>
  `;
}

/* ── 과제 목록 (assignment-list) ── */
export function renderAssignmentList() {
  const filter = state.assignmentFilter || 'all';
  const allAssignments = state.assignments || [];
  const filtered = filter === 'all'
    ? allAssignments
    : allAssignments.filter(a => a.status === filter);

  const activeCount = allAssignments.filter(a => a.status !== 'completed').length;
  const completedCount = allAssignments.filter(a => a.status === 'completed').length;
  const urgentCount = allAssignments.filter(a => getDday(a.dueDate) <= 3 && a.status !== 'completed').length;

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.state.assignmentFilter='all';_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>📋 과제 관리</h1>
        <button class="header-add-btn" onclick="_RM.state.editingAssignment=null;_RM.nav('record-assignment')"><i class="fas fa-plus"></i></button>
      </div>

      <div class="form-body">
        <div class="assignment-stats-row animate-in">
          <div class="assignment-stat-card">
            <span class="assignment-stat-num" style="color:var(--primary-light)">${activeCount}</span>
            <span class="assignment-stat-label">진행 중</span>
          </div>
          <div class="assignment-stat-card">
            <span class="assignment-stat-num" style="color:var(--success)">${completedCount}</span>
            <span class="assignment-stat-label">완료</span>
          </div>
          <div class="assignment-stat-card">
            <span class="assignment-stat-num" style="color:var(--accent)">${urgentCount}</span>
            <span class="assignment-stat-label">긴급</span>
          </div>
        </div>

        <div class="chip-row" style="margin-bottom:16px">
          ${[
            {id:'all', label:'전체', count: allAssignments.length},
            {id:'in-progress', label:'진행 중', count: allAssignments.filter(a=>a.status==='in-progress').length},
            {id:'pending', label:'시작 전', count: allAssignments.filter(a=>a.status==='pending').length},
            {id:'completed', label:'완료', count: allAssignments.filter(a=>a.status==='completed').length},
          ].map(f => `<button class="chip ${filter===f.id?'active':''}" onclick="_RM.setAssignmentFilter('${f.id}')">${f.label} (${f.count})</button>`).join('')}
        </div>

        ${filtered.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
            <span style="font-size:40px">📭</span>
            <p style="margin-top:12px">해당하는 과제가 없습니다</p>
          </div>
        ` : ''}

        ${[...filtered].sort((a,b) => {
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        }).map((a, i) => {
          const dDay = getDday(a.dueDate);
          const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
          const urgency = a.status === 'completed' ? 'completed' : dDay <= 1 ? 'urgent' : dDay <= 3 ? 'warning' : 'normal';
          const donePlanSteps = (a.plan||[]).filter(p => p.done).length;
          return `
          <div class="assignment-card ${urgency} stagger-${i+1} animate-in" onclick="_RM.state.viewingAssignment='${a.id}';_RM.nav('assignment-plan')">
            <div class="ac-top">
              <div class="ac-subject-badge" style="background:${a.color}22;color:${a.color};border:1px solid ${a.color}44">${a.subject}</div>
              <span class="ac-type">${a.type}</span>
              <span class="assignment-dday ${urgency}" style="margin-left:auto">${a.status === 'completed' ? '✅ 완료' : dDayText}</span>
            </div>
            <h3 class="ac-title">${a.title}</h3>
            <p class="ac-desc">${a.desc}</p>
            <div class="ac-bottom">
              <div class="ac-meta">
                <span><i class="fas fa-user"></i> ${a.teacher}</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(a.dueDate)}</span>
              </div>
              <div class="ac-progress-row">
                <div class="ac-progress-bar"><div class="ac-progress-fill" style="width:${a.progress}%;background:${a.color}"></div></div>
                <span class="ac-progress-text">${a.progress}%</span>
                <span class="ac-plan-count">${donePlanSteps}/${(a.plan||[]).length}단계</span>
              </div>
            </div>
          </div>
          `;
        }).join('')}

        <button class="add-assignment-btn" onclick="_RM.state.editingAssignment=null;_RM.nav('record-assignment')">
          <i class="fas fa-plus-circle"></i> 새 과제 추가
        </button>
      </div>
    </div>
  `;
}
