/* ================================================================
   Records Module — views/assignment-record.js
   과제 기록 폼 (record-assignment)
   ================================================================ */

import { state } from '../core/state.js';
import { navigate, render } from '../core/router.js';
import { kstToday, formatDate, generatePlanSteps } from '../core/utils.js';

const subjectColors = {
  '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
  '한국사':'#74B9FF','체육':'#A29BFE','미술':'#FD79A8','기타':'#636e72'
};

export function registerHandlers(RM) {
  RM.saveAssignment = (goToPlan) => {
    const subjectChip = document.querySelector('#assignment-subject-chips .chip.active');
    const typeBtn = document.querySelector('.assignment-type-btn.active');
    const title = document.getElementById('assignment-title')?.value || '';
    const desc = document.getElementById('assignment-desc')?.value || '';
    const teacher = document.getElementById('assignment-teacher')?.value || '';
    const dueDate = document.getElementById('assignment-due')?.value || '';
    const subject = subjectChip ? subjectChip.dataset.subject : '수학';
    const type = typeBtn ? typeBtn.dataset.atype : '문제풀이';

    if (state.editingAssignment !== null) {
      const a = (state.assignments||[]).find(x => String(x.id) === String(state.editingAssignment));
      if (a) {
        a.subject = subject;
        a.title = title || a.title;
        a.desc = desc || a.desc;
        a.type = type;
        a.teacher = teacher || a.teacher;
        a.dueDate = dueDate || a.dueDate;
        a.color = subjectColors[subject] || '#636e72';

        if (a._dbId) {
          RM.DB.updateAssignment(a._dbId, { title: a.title, dueDate: a.dueDate, status: a.status });
        }
      }
      state.editingAssignment = null;
      if (goToPlan) {
        state.viewingAssignment = a.id;
        navigate('assignment-plan');
      } else {
        RM.showXpPopup(5, '과제 수정 완료!');
      }
      return;
    }

    const assignments = state.assignments || [];
    const newId = assignments.length > 0 ? Math.max(...assignments.map(a => a.id)) + 1 : 1;
    const plan = generatePlanSteps(dueDate);

    const newAssignment = {
      id: newId,
      subject,
      title: title || '새 과제',
      desc: desc || '',
      type,
      teacher: teacher || '',
      dueDate,
      createdDate: kstToday(),
      color: subjectColors[subject] || '#636e72',
      status: 'pending',
      progress: 0,
      plan
    };

    state.assignments = [...assignments, newAssignment];

    // DB 저장 (비동기)
    RM.DB.saveAssignment({
      subject,
      title: title || '새 과제',
      description: desc || '',
      teacherName: teacher || '',
      dueDate,
      color: subjectColors[subject] || '#636e72',
      planData: plan,
    }).then(dbId => {
      if (dbId) {
        newAssignment._dbId = dbId;
        newAssignment.id = String(dbId);
      }
    });

    if (goToPlan) {
      state.viewingAssignment = newId;
      navigate('assignment-plan');
    } else {
      RM.showXpPopup(15, '과제 기록 완료! 📋');
      navigate('assignment-list');
    }
  };
}

export function renderRecordAssignment() {
  const editing = state.editingAssignment;
  const isEdit = editing !== null;
  const a = isEdit ? (state.assignments||[]).find(x => String(x.id) === String(editing)) : null;
  const todayStr = kstToday();

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.state.editingAssignment=null;_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>${isEdit ? '과제 수정' : '📋 과제 기록'}</h1>
        <span class="xp-badge-sm">+15 XP</span>
      </div>

      <div class="form-body">
        <div class="assignment-intro-card animate-in">
          <span class="assignment-intro-icon">📋</span>
          <div>
            <h3>선생님이 내 준 과제를 기록하세요</h3>
            <p>마감일까지의 계획도 함께 세울 수 있어요!</p>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📚 과목</label>
          <div class="chip-row" id="assignment-subject-chips">
            ${['국어','수학','영어','과학','한국사','기타'].map((s,i) => `<button class="chip ${(isEdit && a && a.subject===s) || (!isEdit && i===1) ? 'active' : ''}" data-subject="${s}" onclick="this.parentNode.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));this.classList.add('active')">${s}</button>`).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📝 과제 제목</label>
          <input class="input-field" id="assignment-title" placeholder="예: 치환적분 연습문제 풀이" value="${isEdit && a ? a.title : ''}">
        </div>

        <div class="field-group">
          <label class="field-label">📄 상세 내용</label>
          <textarea class="input-field" id="assignment-desc" rows="3" placeholder="과제의 구체적인 내용, 범위, 조건 등을 적어주세요">${isEdit && a ? a.desc : ''}</textarea>
        </div>

        <div class="field-group">
          <label class="field-label">📂 과제 유형</label>
          <div class="assignment-type-grid">
            ${[
              {type:'문제풀이', icon:'✏️'},
              {type:'에세이/작문', icon:'📝'},
              {type:'보고서', icon:'📊'},
              {type:'감상문', icon:'📖'},
              {type:'프로젝트', icon:'🔬'},
              {type:'발표준비', icon:'🎤'},
              {type:'실험/실습', icon:'🧪'},
              {type:'기타', icon:'📌'},
            ].map((t,i) => `
              <button class="assignment-type-btn ${(isEdit && a && a.type===t.type) || (!isEdit && i===0) ? 'active' : ''}" data-atype="${t.type}" onclick="this.parentNode.querySelectorAll('.assignment-type-btn').forEach(b=>b.classList.remove('active'));this.classList.add('active')">
                <span>${t.icon}</span><span>${t.type}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">👨‍🏫 선생님</label>
          <input class="input-field" id="assignment-teacher" placeholder="과제를 내 준 선생님" value="${isEdit && a ? a.teacher : ''}">
        </div>

        <div class="field-group">
          <label class="field-label">📅 마감일</label>
          <input class="input-field" type="date" id="assignment-due" value="${isEdit && a ? a.dueDate : todayStr}" style="color:var(--text-primary)">
        </div>

        <div class="assignment-plan-cta animate-in" onclick="_RM.saveAssignment(true)">
          <div class="plan-cta-icon">📅</div>
          <div class="plan-cta-content">
            <h3>제출 계획 세우기</h3>
            <p>마감일까지 단계별 플랜을 정율이 도와줘요!</p>
          </div>
          <i class="fas fa-chevron-right" style="color:var(--primary-light)"></i>
        </div>

        <button class="btn-primary" onclick="_RM.saveAssignment(false)">
          ${isEdit ? '과제 수정 완료' : '과제 기록 완료 +15 XP ✨'}
        </button>
      </div>
    </div>
  `;
}
