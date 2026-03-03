/* ================================================================
   Records Module — views/exam-detail.js
   시험 상세 화면
   ================================================================ */

import { state } from '../core/state.js';
import { navigate, render } from '../core/router.js';
import { getDday, escapeHtml } from '../core/utils.js';

function getExamTypeIcon(type) {
  const map = { midterm:'📘', final:'📕', mock:'📗', performance:'📝' };
  return map[type] || '📝';
}
function getExamTypeLabel(type) {
  const map = { midterm:'중간고사', final:'기말고사', mock:'모의고사', performance:'수행평가' };
  return map[type] || type;
}

export function registerHandlers(RM) {
  RM.updateExamReadiness = (examId, subIdx, value) => {
    const ex = (state.exams||[]).find(e => e.id === examId);
    if (ex && ex.subjects[subIdx] !== undefined) {
      ex.subjects[subIdx].readiness = value;
      const pctEl = document.querySelectorAll('.exam-subj-readiness-pct')[subIdx];
      const fillEl = document.querySelectorAll('.exam-subj-readiness-fill')[subIdx];
      if (pctEl) pctEl.textContent = value + '%';
      if (fillEl) fillEl.style.width = value + '%';
    }
  };
  RM.editExamSubjectNote = (examId, subIdx) => {
    const ex = (state.exams||[]).find(e => e.id === examId);
    if (!ex) return;
    const note = prompt('메모 입력:', ex.subjects[subIdx].notes || '');
    if (note !== null) {
      ex.subjects[subIdx].notes = note;
      render();
    }
  };
  RM.editExamSubjectRange = (examId, subIdx) => {
    const ex = (state.exams||[]).find(e => e.id === examId);
    if (!ex) return;
    const range = prompt('시험 범위 수정:', ex.subjects[subIdx].range || '');
    if (range !== null) {
      ex.subjects[subIdx].range = range;
      render();
    }
  };
  RM.deleteExam = (examId) => {
    if (!confirm('이 시험을 삭제하시겠습니까?')) return;
    const ex = (state.exams||[]).find(e => e.id === examId);
    if (ex && ex._dbId) {
      RM.DB.deleteExam(ex._dbId);
    }
    state.exams = (state.exams||[]).filter(e => e.id !== examId);
    navigate('exam-list');
  };
  RM.generateExamPlan = async (examId) => {
    const ex = (state.exams||[]).find(e => e.id === examId);
    if (!ex) return;
    state.examAiLoading = true;
    render();

    const dDay = getDday(ex.startDate);
    const subjectInfo = (ex.subjects||[]).map(s =>
      `- ${s.subject} (${s.date} ${s.time}): 범위="${s.range}", 준비도=${s.readiness}%, 메모="${s.notes}"`
    ).join('\n');

    const prompt = `너는 고등학교 시험 대비 학습 코치야. 학생의 시험 정보를 분석해서 구체적인 학습 계획을 세워줘.

시험 정보:
- 시험명: ${ex.name}
- 유형: ${getExamTypeLabel(ex.type)}
- 시험 기간: ${ex.startDate} ~ ${ex.endDate}
- D-day: ${dDay > 0 ? dDay + '일 남음' : '오늘/지남'}

과목별 정보:
${subjectInfo}

다음 형식으로 학습 계획을 작성해줘:
1. 전체 전략 (2~3문장)
2. 우선순위 분석 (준비도 낮은 과목 → 높은 과목 순)
3. 일별 학습 계획 (남은 일수에 맞게)
4. 과목별 핵심 공략법 (각 1~2문장)
5. 컨디션 관리 팁 (1~2문장)

HTML 태그를 사용해서 보기 좋게 포맷팅해줘. <h4>, <p>, <ul><li>, <strong> 태그 사용 가능. 한국어로 작성.`;

    try {
      const res = await fetch('/api/exam-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, examId })
      });
      if (!res.ok) throw new Error('서버 응답 오류');
      const data = await res.json();
      if (data.plan) {
        ex.aiPlan = data.plan;
      } else if (data.error) {
        ex.aiPlan = '<p style="color:#FF6B6B">⚠️ 정율 응답 오류: ' + escapeHtml(data.error) + '</p><p>다시 시도해주세요.</p>';
      }
    } catch (e) {
      ex.aiPlan = '<p style="color:#FF6B6B">⚠️ 네트워크 오류. 다시 시도해주세요.</p>';
    }

    state.examAiLoading = false;
    render();
  };
}

export function renderExamDetail() {
  const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
  if (!ex) return '<div class="full-screen"><p style="padding:40px;text-align:center;color:var(--text-muted)">시험을 찾을 수 없습니다</p></div>';

  const dDay = getDday(ex.startDate);
  const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? 'D-' + dDay : 'D+' + Math.abs(dDay);
  const urgency = dDay <= 3 ? 'urgent' : dDay <= 7 ? 'warning' : 'normal';
  const subs = ex.subjects || [];
  const avgReadiness = subs.length > 0 ? Math.round(subs.reduce((s,sub) => s + (sub.readiness||0), 0) / subs.length) : 0;
  const dateRange = ex.startDate === ex.endDate
    ? (ex.startDate||'').slice(5).replace('-','/')
    : (ex.startDate||'').slice(5).replace('-','/') + ' ~ ' + (ex.endDate||'').slice(5).replace('-','/');

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('exam-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>${getExamTypeIcon(ex.type)} ${ex.name}</h1>
        <button class="header-action-btn" onclick="_RM.deleteExam('${ex.id}')" title="삭제" style="color:#FF6B6B"><i class="fas fa-trash"></i></button>
      </div>
      <div class="form-body">

        <div class="exam-detail-summary">
          <div class="exam-detail-dday">
            <span class="assignment-dday ${urgency}" style="font-size:18px;padding:6px 16px">${dDayText}</span>
          </div>
          <div class="exam-detail-meta">
            <div><i class="fas fa-calendar" style="width:16px;color:var(--text-muted)"></i> ${dateRange}</div>
            <div><i class="fas fa-book" style="width:16px;color:var(--text-muted)"></i> ${subs.length}과목</div>
            <div><i class="fas fa-chart-line" style="width:16px;color:var(--text-muted)"></i> 평균 준비도 <strong style="color:${avgReadiness>=60?'#00B894':avgReadiness>=30?'#FDCB6E':'#FF6B6B'}">${avgReadiness}%</strong></div>
          </div>
        </div>

        <div class="section-label">과목별 시험 범위 & 준비 상태</div>
        ${subs.map((sub, idx) => {
          const subDday = getDday(sub.date);
          const subDdayText = subDday === 0 ? 'D-Day' : subDday > 0 ? 'D-' + subDday : '';
          return `
          <div class="exam-subject-card stagger-${idx+1} animate-in">
            <div class="exam-subj-header">
              <div class="exam-subj-color-dot" style="background:${sub.color||'var(--primary)'}"></div>
              <span class="exam-subj-title">${sub.subject}</span>
              <span class="exam-subj-date">${(sub.date||'').slice(5).replace('-','/')} ${sub.time||''}</span>
              ${subDdayText ? '<span class="exam-subj-dday">' + subDdayText + '</span>' : ''}
            </div>
            <div class="exam-subj-range">
              <i class="fas fa-bookmark" style="color:${sub.color||'var(--primary)'};margin-right:6px;font-size:11px"></i>
              <span>${sub.range||'범위 미입력'}</span>
            </div>
            <div class="exam-subj-readiness-row">
              <span class="exam-subj-readiness-label">준비도</span>
              <div class="exam-subj-readiness-bar">
                <div class="exam-subj-readiness-fill" style="width:${sub.readiness||0}%;background:${sub.color||'var(--primary)'}"></div>
              </div>
              <span class="exam-subj-readiness-pct" style="color:${sub.color||'var(--primary)'}">${sub.readiness||0}%</span>
              <input type="range" min="0" max="100" value="${sub.readiness||0}" class="exam-readiness-slider"
                oninput="_RM.updateExamReadiness('${ex.id}',${idx},parseInt(this.value))">
            </div>
            ${sub.notes ? `
            <div class="exam-subj-notes">
              <i class="fas fa-sticky-note" style="color:var(--text-muted);margin-right:4px;font-size:10px"></i>
              ${sub.notes}
            </div>` : ''}
            <div class="exam-subj-actions">
              <button class="exam-subj-note-btn" onclick="_RM.editExamSubjectNote('${ex.id}',${idx})">
                <i class="fas fa-edit"></i> 메모
              </button>
              <button class="exam-subj-note-btn" onclick="_RM.editExamSubjectRange('${ex.id}',${idx})">
                <i class="fas fa-bookmark"></i> 범위수정
              </button>
            </div>
          </div>`;
        }).join('')}

        <div class="section-label" style="margin-top:20px">🤖 정율 시험대비 코칭</div>
        <div class="card">
          ${state.examAiLoading ? `
            <div style="text-align:center;padding:24px">
              <div class="rpt-btn-spinner" style="margin:0 auto"></div>
              <p style="color:var(--text-muted);margin-top:12px;font-size:13px">정율이 학습 계획을 분석 중...</p>
            </div>
          ` : ex.aiPlan ? `
            <div class="exam-ai-plan">
              <div class="exam-ai-plan-header">
                <span>📋 정율 맞춤 학습 계획</span>
                <button class="card-link" onclick="_RM.generateExamPlan('${ex.id}')">다시 생성 →</button>
              </div>
              <div class="exam-ai-plan-content">${ex.aiPlan}</div>
            </div>
          ` : `
            <div style="text-align:center;padding:16px">
              <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">시험 범위와 준비 상태를 분석해서<br>맞춤 학습 계획을 세워드릴게요</p>
              <button class="btn-primary" onclick="_RM.generateExamPlan('${ex.id}')">
                <i class="fas fa-magic" style="margin-right:6px"></i>정율 학습계획 생성
              </button>
            </div>
          `}
        </div>

        <div class="section-label" style="margin-top:20px">📊 시험 결과</div>
        ${ex.result ? `
        <div class="card" style="border:1px solid rgba(108,92,231,0.3)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span style="font-size:14px;font-weight:700;color:var(--text-primary)">✅ 결과 입력 완료</span>
            <span style="font-size:20px;font-weight:800;color:var(--primary-light)">${ex.result.totalScore}점</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-primary" style="flex:1;font-size:12px" onclick="_RM.state.viewingExam='${ex.id}';_RM.nav('exam-report')">
              <i class="fas fa-chart-bar" style="margin-right:4px"></i>결과 보고서
            </button>
            <button class="btn-secondary" style="flex:1;font-size:12px" onclick="_RM.state.viewingExam='${ex.id}';_RM.nav('exam-result-input')">
              <i class="fas fa-edit" style="margin-right:4px"></i>결과 수정
            </button>
          </div>
        </div>
        ` : `
        <div class="card" style="text-align:center">
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">시험이 끝나면 결과를 입력하고<br>오답 분석 보고서를 만들어보세요</p>
          <button class="btn-primary" onclick="_RM.state.viewingExam='${ex.id}';_RM.nav('exam-result-input')">
            <i class="fas fa-pen" style="margin-right:6px"></i>결과 입력하기
          </button>
        </div>
        `}

      </div>
    </div>
  `;
}
