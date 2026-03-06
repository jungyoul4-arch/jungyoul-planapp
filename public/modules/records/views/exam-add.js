/* ================================================================
   Records Module — views/exam-add.js
   시험 추가 화면 (중간/기말, 수행평가, 모의고사 3모드)
   ================================================================ */

import { state } from '../core/state.js';
import { navigate, render } from '../core/router.js';
import { kstNow, kstToday, SUBJECT_COLOR_MAP, SUBJECT_COLORS_ARRAY } from '../core/utils.js';

function getDateRange(start, end) {
  const dates = [];
  let cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate()+1);
  }
  return dates;
}

const _subjectColorMap = {
  '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
  '한국사':'#74B9FF','사회':'#A29BFE','물리':'#E056A0','화학':'#FF9F43',
  '생명과학':'#00CEC9','지구과학':'#E17055','미술':'#FD79A8','음악':'#fd79a8','체육':'#A29BFE'
};
const _subjectColorFallback = ['#6C5CE7','#FF6B6B','#00B894','#FDCB6E','#74B9FF','#E056A0','#A29BFE','#FF9F43'];

export function registerHandlers(RM) {
  RM.setExamAddMode = (mode) => { state._examAddMode = mode; render(); };

  // 중간·기말 handlers
  RM.onMidtermPeriodChange = () => {
    const s = document.getElementById('ea-mid-start')?.value;
    const e = document.getElementById('ea-mid-end')?.value;
    if (s) state._eaMidtermStart = s;
    if (e) state._eaMidtermEnd = e;
    const nameEl = document.getElementById('ea-mid-name');
    if (nameEl) state._eaMidtermName = nameEl.value.trim();
    if (state._eaMidtermStart && state._eaMidtermEnd) {
      const dates = getDateRange(state._eaMidtermStart, state._eaMidtermEnd);
      const newSubj = {};
      dates.forEach(d => { newSubj[d] = state._eaMidtermSubjects?.[d] || {}; });
      state._eaMidtermSubjects = newSubj;
    }
    render();
  };

  RM.openPeriodPicker = (date, period) => {
    state._eaPickerDate = date;
    state._eaPickerPeriod = period;
    const nameEl = document.getElementById('ea-mid-name');
    if (nameEl) state._eaMidtermName = nameEl.value.trim();
    const modal = document.getElementById('ea-period-picker');
    if (modal) modal.classList.add('open');

    const dt = new Date(date + 'T00:00:00');
    const dayNames = ['일','월','화','수','목','금','토'];
    const dayIdxMap = {'월':0,'화':1,'수':2,'목':3,'금':4};
    const dayName = dayNames[dt.getDay()];
    const ttDayIdx = dayIdxMap[dayName];
    const ttSchool = state.timetable?.school || [];
    const ttSubj = (ttDayIdx !== undefined && ttSchool[period-1]) ? (ttSchool[period-1][ttDayIdx] || '') : '';

    const titleEl = document.getElementById('ea-pp-title');
    if (titleEl) titleEl.innerHTML = `<i class="fas fa-book" style="color:var(--primary);margin-right:6px"></i>${date.slice(5).replace('-','/')} (${dayName}) ${period}교시`;

    const hintEl = document.getElementById('ea-pp-hint');
    if (hintEl && ttSubj && !['체육','미술','음악','창체','동아리'].includes(ttSubj)) {
      hintEl.innerHTML = `<i class="fas fa-magic" style="margin-right:6px"></i>시간표 기준: <strong>${ttSubj}</strong>`;
      hintEl.style.display = 'flex';
    } else if (hintEl) { hintEl.style.display = 'none'; }

    const examSubjects = ['국어','수학','영어','과학','한국사','사회','물리','화학','생명과학','지구과학'];
    const gridEl = document.getElementById('ea-pp-grid');
    if (gridEl) {
      gridEl.innerHTML = examSubjects.map(s => {
        const c = _subjectColorMap[s] || '#888';
        return `<button class="ea-pp-subj-btn" style="--subj-color:${c}" onclick="_RM.pickPeriodSubject('${s}')">${s}</button>`;
      }).join('');
    }
    const rangeEl = document.getElementById('ea-pp-range');
    if (rangeEl) rangeEl.value = '';
    const customEl = document.getElementById('ea-pp-custom');
    if (customEl) customEl.value = '';
  };

  RM.closePeriodPicker = () => {
    const modal = document.getElementById('ea-period-picker');
    if (modal) modal.classList.remove('open');
  };

  RM.pickPeriodSubject = (subj) => {
    const d = state._eaPickerDate;
    const p = state._eaPickerPeriod;
    if (!state._eaMidtermSubjects) state._eaMidtermSubjects = {};
    if (!state._eaMidtermSubjects[d]) state._eaMidtermSubjects[d] = {};
    const color = _subjectColorMap[subj] || _subjectColorFallback[p % _subjectColorFallback.length];
    const range = document.getElementById('ea-pp-range')?.value?.trim() || '';
    state._eaMidtermSubjects[d][p] = { subject: subj, color, range, period: p, date: d, readiness: 0, notes: '' };
    RM.closePeriodPicker();
    render();
  };

  RM.confirmPeriodCustom = () => {
    const subj = document.getElementById('ea-pp-custom')?.value?.trim();
    if (!subj) { alert('과목명을 입력하세요'); return; }
    RM.pickPeriodSubject(subj);
  };

  RM.clearPeriodSlot = (date, period) => {
    if (state._eaMidtermSubjects?.[date]) {
      delete state._eaMidtermSubjects[date][period];
      render();
    }
  };

  // Save functions
  RM.saveMidtermExam = () => {
    const nameEl = document.getElementById('ea-mid-name');
    const name = nameEl?.value?.trim() || state._eaMidtermName;
    if (!name) { alert('시험 이름을 입력하세요'); return; }
    const subjects = [];
    Object.entries(state._eaMidtermSubjects || {}).forEach(([date, slots]) => {
      if (typeof slots === 'object' && !Array.isArray(slots)) {
        Object.entries(slots).forEach(([period, s]) => {
          if (s && s.subject) subjects.push({ ...s, date, time: period + '교시' });
        });
      }
    });
    if (subjects.length === 0) { alert('최소 1개 과목을 추가하세요'); return; }

    const newExam = {
      id: 'exam' + Date.now(),
      type: state._eaMidtermType === 'final' ? 'final' : 'midterm',
      name, startDate: state._eaMidtermStart, endDate: state._eaMidtermEnd,
      subjects, status: 'upcoming', aiPlan: null,
    };
    state.exams = [...(state.exams||[]), newExam];
    state.viewingExam = newExam.id;

    if (RM.DB.studentId()) {
      RM.DB.saveExam({ name, type: newExam.type, startDate: state._eaMidtermStart, endDate: state._eaMidtermEnd, subjects, memo:'' })
        .then(dbId => { if (dbId) { newExam._dbId = dbId; newExam.id = String(dbId); state.viewingExam = newExam.id; }});
    }
    RM.resetExamAddState();
    navigate('exam-detail');
  };

  RM.savePerformanceExam = () => {
    const subj = document.getElementById('ea-perf-subj')?.value?.trim() || state._eaPerfSubject;
    const name = document.getElementById('ea-perf-name')?.value?.trim() || state._eaPerfName;
    const deadline = document.getElementById('ea-perf-deadline')?.value || state._eaPerfDeadline;
    const topic = document.getElementById('ea-perf-topic')?.value?.trim() || state._eaPerfTopic;
    const memo = document.getElementById('ea-perf-memo')?.value?.trim() || state._eaPerfMemo;
    if (!subj) { alert('과목을 입력하세요'); return; }
    if (!name) { alert('수행평가 이름을 입력하세요'); return; }
    if (!deadline) { alert('마감 기한을 입력하세요'); return; }

    const color = _subjectColorMap[subj] || '#FDCB6E';
    const newExam = {
      id: 'exam' + Date.now(), type: 'performance', name,
      startDate: deadline, endDate: deadline,
      subjects: [{ subject:subj, date:deadline, time:'제출', range:topic, readiness:0, notes:memo, color }],
      status: 'upcoming', aiPlan: null,
    };
    state.exams = [...(state.exams||[]), newExam];
    state.viewingExam = newExam.id;

    if (RM.DB.studentId()) {
      RM.DB.saveExam({ name, type:'performance', startDate:deadline, subjects:newExam.subjects, memo })
        .then(dbId => { if (dbId) { newExam._dbId = dbId; newExam.id = String(dbId); state.viewingExam = newExam.id; }});
    }
    RM.resetExamAddState();
    navigate('exam-detail');
  };

  RM.selectMockPreset = (key) => {
    state._eaMockPreset = key;
    const presets = {
      '3월':{label:'3월 전국연합학력평가',m:3}, '4월':{label:'4월 전국연합학력평가',m:4},
      '6월':{label:'6월 모의평가 (평가원)',m:6}, '7월':{label:'7월 전국연합학력평가',m:7},
      '9월':{label:'9월 모의평가 (평가원)',m:9}, '10월':{label:'10월 전국연합학력평가',m:10},
      '수능':{label:'대학수학능력시험',m:11}
    };
    const p = presets[key];
    const y = new Date().getFullYear();
    state._eaMockName = p ? p.label : '';
    state._eaMockDate = p ? `${y}-${String(p.m).padStart(2,'0')}-06` : '';
    render();
  };

  RM.saveMockExam = () => {
    const name = document.getElementById('ea-mock-name')?.value?.trim() || state._eaMockName;
    const date = document.getElementById('ea-mock-date')?.value || state._eaMockDate;
    if (!name) { alert('시험 이름을 입력하세요'); return; }
    if (!date) { alert('시험 날짜를 입력하세요'); return; }

    const subjects = [
      { subject:'국어', time:'1교시 (08:40~10:00)', range:'독서+문학+언어와 매체', color:'#FF6B6B' },
      { subject:'수학', time:'2교시 (10:30~12:10)', range:'수학Ⅰ+수학Ⅱ+확률과 통계/미적분/기하', color:'#6C5CE7' },
      { subject:'영어', time:'3교시 (13:10~14:20)', range:'듣기+독해 전 범위', color:'#00B894' },
      { subject:'한국사', time:'3교시 (14:30~14:50)', range:'전 범위', color:'#74B9FF' },
      { subject:'탐구1', time:'4교시 (15:20~15:50)', range:'선택과목 1', color:'#FDCB6E' },
      { subject:'탐구2', time:'4교시 (15:50~16:20)', range:'선택과목 2', color:'#E056A0' },
    ].map(s => ({ ...s, date, readiness:0, notes:'' }));

    const newExam = {
      id: 'exam' + Date.now(), type: 'mock', name,
      startDate: date, endDate: date, subjects, status: 'upcoming', aiPlan: null,
    };
    state.exams = [...(state.exams||[]), newExam];
    state.viewingExam = newExam.id;

    if (RM.DB.studentId()) {
      RM.DB.saveExam({ name, type:'mock', startDate:date, subjects, memo:'' })
        .then(dbId => { if (dbId) { newExam._dbId = dbId; newExam.id = String(dbId); state.viewingExam = newExam.id; }});
    }
    RM.resetExamAddState();
    navigate('exam-detail');
  };
}

export function renderExamAdd() {
  if (!state._examAddMode) {
    return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('exam-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>📝 시험 추가</h1>
      </div>
      <div class="form-body">
        <div class="ea-mode-title">어떤 시험을 추가할까요?</div>
        <div class="ea-mode-grid">
          <button class="ea-mode-card" onclick="_RM.setExamAddMode('midterm')">
            <div class="ea-mode-icon" style="background:rgba(108,92,231,0.15);color:#6C5CE7">📘</div>
            <div class="ea-mode-label">중간 · 기말고사</div>
            <div class="ea-mode-desc">시험 기간 설정 후 날짜별 과목을 추가해요</div>
            <i class="fas fa-chevron-right ea-mode-arrow"></i>
          </button>
          <button class="ea-mode-card" onclick="_RM.setExamAddMode('performance')">
            <div class="ea-mode-icon" style="background:rgba(253,203,110,0.2);color:#F39C12">📝</div>
            <div class="ea-mode-label">수행평가</div>
            <div class="ea-mode-desc">마감 기한과 평가 주제만 간단히 입력해요</div>
            <i class="fas fa-chevron-right ea-mode-arrow"></i>
          </button>
          <button class="ea-mode-card" onclick="_RM.setExamAddMode('mock')">
            <div class="ea-mode-icon" style="background:rgba(0,184,148,0.15);color:#00B894">📗</div>
            <div class="ea-mode-label">모의고사</div>
            <div class="ea-mode-desc">프리셋으로 한 번에 입력! 클릭 한 번이면 끝</div>
            <i class="fas fa-chevron-right ea-mode-arrow"></i>
          </button>
        </div>
      </div>
    </div>`;
  }

  if (state._examAddMode === 'midterm') return renderMidterm();
  if (state._examAddMode === 'performance') return renderPerformance();
  if (state._examAddMode === 'mock') return renderMock();
  return '';
}

function renderMidterm() {
  const today = kstNow();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,'0');
  const defaultStart = state._eaMidtermStart || `${y}-${m}-21`;
  const defaultEnd = state._eaMidtermEnd || `${y}-${m}-25`;
  const examPeriods = state._eaMidtermPeriodCount || 4;

  let dateCards = '';
  if (state._eaMidtermStart && state._eaMidtermEnd) {
    const dates = getDateRange(state._eaMidtermStart, state._eaMidtermEnd);
    const dayNames = ['일','월','화','수','목','금','토'];
    const dayIdxMap = {'월':0,'화':1,'수':2,'목':3,'금':4};
    const dayColors = {'토':'#74B9FF','일':'#FF6B6B'};
    dateCards = dates.map((d, di) => {
      const dt = new Date(d + 'T00:00:00');
      const dayName = dayNames[dt.getDay()];
      const dayStyle = dayColors[dayName] ? `color:${dayColors[dayName]}` : '';
      const slotsForDay = state._eaMidtermSubjects?.[d] || {};
      const filledCount = Object.values(slotsForDay).filter(v => v && v.subject).length;
      return `
      <div class="ea-date-card ${filledCount>0?'has-subj':''} stagger-${Math.min(di+1,5)} animate-in">
        <div class="ea-date-header">
          <span class="ea-date-badge"><span class="ea-date-day" style="${dayStyle}">${d.slice(5).replace('-','/')}</span> <span class="ea-date-dayname">(${dayName})</span></span>
          <span class="ea-date-pill ${filledCount>0?'filled':''}">${filledCount}과목</span>
        </div>
        <div class="ea-period-slots">
          ${Array.from({length: examPeriods}, (_,pi) => {
            const pNum = pi + 1;
            const slot = slotsForDay[pNum];
            const subj = slot?.subject || '';
            const color = slot?.color || '';
            if (subj) {
              return `<div class="ea-slot filled" style="border-left:3px solid ${color}">
                <span class="ea-slot-period">${pNum}교시</span>
                <span class="ea-slot-subj" style="color:${color}">${subj}</span>
                <button class="ea-slot-clear" onclick="_RM.clearPeriodSlot('${d}',${pNum})"><i class="fas fa-times"></i></button>
              </div>`;
            } else {
              return `<div class="ea-slot empty" onclick="_RM.openPeriodPicker('${d}',${pNum})">
                <span class="ea-slot-period">${pNum}교시</span>
                <span class="ea-slot-hint">탭하여 선택</span>
                <i class="fas fa-chevron-right ea-slot-arrow"></i>
              </div>`;
            }
          }).join('')}
        </div>
      </div>`;
    }).join('');
  }

  const totalSubjects = Object.values(state._eaMidtermSubjects || {}).reduce((s,slots) => {
    if (typeof slots === 'object' && !Array.isArray(slots)) return s + Object.values(slots).filter(v => v && v.subject).length;
    return s;
  }, 0);
  const typeLabel = state._eaMidtermType === 'final' ? '기말고사' : '중간고사';

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.setExamAddMode(null)"><i class="fas fa-arrow-left"></i></button>
        <h1>📘 ${typeLabel} 추가</h1>
      </div>
      <div class="form-body" style="padding-bottom:100px">
        <div class="ea-toggle-row">
          <button class="ea-toggle-btn ${state._eaMidtermType!=='final'?'active':''}" onclick="_RM.state._eaMidtermType='midterm';_RM.render()">중간고사</button>
          <button class="ea-toggle-btn ${state._eaMidtermType==='final'?'active':''}" onclick="_RM.state._eaMidtermType='final';_RM.render()">기말고사</button>
        </div>

        <label class="field-label">시험 이름</label>
        <input type="text" id="ea-mid-name" class="input-field" placeholder="예: 1학기 ${typeLabel}" value="${state._eaMidtermName || ''}">

        <label class="field-label" style="margin-top:14px">시험 기간</label>
        <div class="ea-period-bar">
          <div class="ea-period-field">
            <i class="fas fa-calendar-day"></i>
            <input type="date" id="ea-mid-start" class="ea-period-input" value="${defaultStart}" onchange="_RM.onMidtermPeriodChange()">
          </div>
          <div class="ea-period-arrow"><i class="fas fa-arrow-right"></i></div>
          <div class="ea-period-field">
            <i class="fas fa-calendar-check"></i>
            <input type="date" id="ea-mid-end" class="ea-period-input" value="${defaultEnd}" onchange="_RM.onMidtermPeriodChange()">
          </div>
        </div>

        <label class="field-label">시험 교시 수</label>
        <div class="ea-period-count-row">
          ${[3,4,5].map(n => `
            <button class="ea-period-count-btn ${examPeriods===n?'active':''}" onclick="_RM.state._eaMidtermPeriodCount=${n};_RM.render()">${n}교시</button>
          `).join('')}
        </div>

        ${state._eaMidtermStart && state._eaMidtermEnd ? `
          <div class="ea-section-label"><span>날짜별 시험 과목</span><span class="ea-section-count">${totalSubjects}과목</span></div>
          ${dateCards}
        ` : `
          <div class="ea-hint-box"><i class="fas fa-info-circle"></i> 시험 기간을 설정하면 날짜별 과목을 추가할 수 있어요</div>
        `}

        <div class="ea-bottom-bar">
          <button class="btn-primary ea-save-btn" onclick="_RM.saveMidtermExam()" ${totalSubjects===0?'disabled':''}>
            <i class="fas fa-check" style="margin-right:8px"></i>${typeLabel} 저장
          </button>
        </div>
      </div>
    </div>

    <div class="ea-modal-overlay" id="ea-period-picker">
      <div class="ea-modal">
        <div class="ea-modal-header">
          <h3 id="ea-pp-title"><i class="fas fa-book" style="color:var(--primary);margin-right:6px"></i>과목 선택</h3>
          <button class="ea-modal-close" onclick="_RM.closePeriodPicker()"><i class="fas fa-times"></i></button>
        </div>
        <div class="ea-modal-body">
          <div class="ea-pp-hint" id="ea-pp-hint"></div>
          <div class="ea-pp-grid" id="ea-pp-grid"></div>
          <div style="margin-top:12px">
            <label class="field-label" style="margin-top:0;font-size:13px">직접 입력</label>
            <div style="display:flex;gap:8px">
              <input type="text" id="ea-pp-custom" class="input-field" placeholder="과목명 입력" style="flex:1;font-size:14px;padding:10px 12px">
              <button class="btn-primary" style="padding:10px 16px;font-size:13px;white-space:nowrap" onclick="_RM.confirmPeriodCustom()">확인</button>
            </div>
          </div>
          <div style="margin-top:10px">
            <label class="field-label" style="margin-top:0;font-size:13px">시험 범위 (선택)</label>
            <input type="text" id="ea-pp-range" class="input-field" placeholder="예: 수학Ⅱ 1~3단원" style="font-size:14px;padding:10px 12px">
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderPerformance() {
  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.setExamAddMode(null)"><i class="fas fa-arrow-left"></i></button>
        <h1>📝 수행평가 추가</h1>
      </div>
      <div class="form-body" style="padding-bottom:100px">
        <label class="field-label">과목</label>
        <div class="ea-quick-subjects" style="margin-bottom:6px">
          ${['국어','수학','영어','과학','한국사','사회','물리','화학','생명과학','미술','음악','체육'].map(s =>
            `<button class="ea-quick-subj-btn ${state._eaPerfSubject===s?'active':''}" onclick="_RM.state._eaPerfSubject='${s}';document.getElementById('ea-perf-subj').value='${s}';_RM.render()">${s}</button>`
          ).join('')}
        </div>
        <input type="text" id="ea-perf-subj" class="input-field" placeholder="직접 입력" value="${state._eaPerfSubject || ''}">

        <label class="field-label" style="margin-top:14px">수행평가 이름</label>
        <input type="text" id="ea-perf-name" class="input-field" placeholder="예: 수학 탐구보고서, 영어 발표" value="${state._eaPerfName || ''}">

        <label class="field-label" style="margin-top:14px">마감 기한</label>
        <div class="ea-period-field ea-single-date">
          <i class="fas fa-clock" style="color:#F39C12"></i>
          <input type="date" id="ea-perf-deadline" class="ea-period-input" value="${state._eaPerfDeadline || ''}">
        </div>

        <label class="field-label" style="margin-top:14px">평가 주제</label>
        <textarea id="ea-perf-topic" class="input-field" rows="3" placeholder="예: 자유주제 탐구보고서 A4 5장 이상">${state._eaPerfTopic || ''}</textarea>

        <label class="field-label" style="margin-top:14px">메모 (선택)</label>
        <input type="text" id="ea-perf-memo" class="input-field" placeholder="참고 사항을 입력하세요" value="${state._eaPerfMemo || ''}">

        <div class="ea-bottom-bar">
          <button class="btn-primary ea-save-btn" onclick="_RM.savePerformanceExam()">
            <i class="fas fa-check" style="margin-right:8px"></i>수행평가 저장
          </button>
        </div>
      </div>
    </div>
  `;
}

function renderMock() {
  const presets = [
    { key:'3월', label:'3월 전국연합학력평가', month:3 },
    { key:'4월', label:'4월 전국연합학력평가', month:4 },
    { key:'6월', label:'6월 모의평가 (평가원)', month:6 },
    { key:'7월', label:'7월 전국연합학력평가', month:7 },
    { key:'9월', label:'9월 모의평가 (평가원)', month:9 },
    { key:'10월', label:'10월 전국연합학력평가', month:10 },
    { key:'수능', label:'대학수학능력시험', month:11 },
  ];
  const mockSubjects = [
    { subject:'국어', time:'1교시 (08:40~10:00)', range:'독서+문학+언어와 매체', color:'#FF6B6B' },
    { subject:'수학', time:'2교시 (10:30~12:10)', range:'수학Ⅰ+수학Ⅱ+확률과 통계/미적분/기하', color:'#6C5CE7' },
    { subject:'영어', time:'3교시 (13:10~14:20)', range:'듣기+독해 전 범위', color:'#00B894' },
    { subject:'한국사', time:'3교시 (14:30~14:50)', range:'전 범위', color:'#74B9FF' },
    { subject:'탐구1', time:'4교시 (15:20~15:50)', range:'선택과목 1', color:'#FDCB6E' },
    { subject:'탐구2', time:'4교시 (15:50~16:20)', range:'선택과목 2', color:'#E056A0' },
  ];
  const year = new Date().getFullYear();

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.setExamAddMode(null)"><i class="fas fa-arrow-left"></i></button>
        <h1>📗 모의고사 추가</h1>
      </div>
      <div class="form-body" style="padding-bottom:100px">
        <div class="ea-mock-intro"><i class="fas fa-magic" style="color:var(--primary);font-size:18px"></i><span>프리셋을 선택하면 과목·시간이 자동으로 채워져요</span></div>

        <div class="ea-section-label"><span>🗓️ ${year}년 모의고사 프리셋</span></div>
        <div class="ea-preset-grid">
          ${presets.map((p,i) => {
            const sel = state._eaMockPreset === p.key;
            return `<button class="ea-preset-btn ${sel?'active':''} stagger-${i+1} animate-in" onclick="_RM.selectMockPreset('${p.key}')">
              <span class="ea-preset-month">${p.key}</span>
              <span class="ea-preset-name">${p.label}</span>
              ${sel ? '<i class="fas fa-check-circle ea-preset-check"></i>' : ''}
            </button>`;
          }).join('')}
        </div>

        ${state._eaMockPreset ? `
          <label class="field-label" style="margin-top:16px">시험 이름</label>
          <input type="text" id="ea-mock-name" class="input-field" value="${state._eaMockName || presets.find(p=>p.key===state._eaMockPreset)?.label || ''}" placeholder="시험 이름">

          <label class="field-label" style="margin-top:14px">시험 날짜</label>
          <div class="ea-period-field ea-single-date">
            <i class="fas fa-calendar-day" style="color:#00B894"></i>
            <input type="date" id="ea-mock-date" class="ea-period-input" value="${state._eaMockDate || `${year}-${String(presets.find(p=>p.key===state._eaMockPreset)?.month||3).padStart(2,'0')}-06`}">
          </div>

          <div class="ea-section-label" style="margin-top:16px"><span>📋 시험 과목 (자동 설정)</span><span class="ea-section-count">${mockSubjects.length}과목</span></div>
          <div class="ea-mock-subjects">
            ${mockSubjects.map(s => `
              <div class="ea-mock-subj-row">
                <div class="ea-subj-color" style="background:${s.color}"></div>
                <div class="ea-mock-subj-info"><span class="ea-mock-subj-name">${s.subject}</span><span class="ea-mock-subj-time">${s.time}</span></div>
                <span class="ea-mock-subj-range">${s.range}</span>
              </div>
            `).join('')}
          </div>

          <div class="ea-mock-custom-note"><i class="fas fa-pencil-alt"></i> 탐구 과목은 저장 후 상세 화면에서 수정할 수 있어요</div>

          <div class="ea-bottom-bar">
            <button class="btn-primary ea-save-btn" onclick="_RM.saveMockExam()">
              <i class="fas fa-check" style="margin-right:8px"></i>모의고사 저장
            </button>
          </div>
        ` : `
          <div class="ea-hint-box" style="margin-top:16px"><i class="fas fa-hand-pointer"></i> 위 프리셋 중 하나를 선택해주세요</div>
        `}
      </div>
    </div>
  `;
}
