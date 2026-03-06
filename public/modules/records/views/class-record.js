/* ================================================================
   Records Module — views/class-record.js
   수업 기록 입력 폼
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { kstToday, kstDateOffset, getSubjectColor, SUBJECT_COLOR_MAP } from '../core/utils.js';
import { events, EVENTS } from '../core/events.js';
import { navigate } from '../core/router.js';

export function registerHandlers(RM) {
  RM.saveClassRecord = () => saveClassRecordFromForm();
  RM.validateClassRecordForm = () => validateClassRecordForm();
  RM.handleClassPhotoUpload = (input) => handleClassPhotoUpload(input);
  RM.removeClassPhoto = (idx) => removeClassPhoto(idx);
  RM.viewClassPhoto = (idx) => viewClassPhoto(idx);
  RM.toggleDeadlineSection = () => toggleDeadlineSection();
  RM.selectDeadline = (el) => selectDeadline(el);
  RM.openCustomDeadline = () => openCustomDeadline();
  RM.selectCustomDeadline = (el) => selectCustomDeadline(el);
}

function getDeadlineOptions() {
  const today = kstToday();
  const tmr = kstDateOffset(1);
  const dayAfter = kstDateOffset(2);
  const nextWeek = kstDateOffset(7);
  return [
    { label: '내일', sub: tmr.slice(5).replace('-', '/'), value: tmr },
    { label: '모레', sub: dayAfter.slice(5).replace('-', '/'), value: dayAfter },
    { label: '다음주', sub: nextWeek.slice(5).replace('-', '/'), value: nextWeek },
  ];
}

function renderClassRecordFields(subject) {
  const photoCount = (state._classPhotos || []).length;
  const photoThumbs = (state._classPhotos || []).map((p, i) => `
    <div class="class-photo-thumb" style="position:relative;width:72px;height:72px;flex-shrink:0;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <img src="${p}" style="width:100%;height:100%;object-fit:cover" onclick="_RM.viewClassPhoto(${i})">
      <button onclick="_RM.removeClassPhoto(${i})" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">&times;</button>
    </div>
  `).join('');

  const deadlineOpts = getDeadlineOptions();
  const selectedDue = state._classAssignmentDue || '';
  const deadlineBtns = deadlineOpts.map(o => `
    <button type="button" class="deadline-btn ${selectedDue === o.value ? 'active' : ''}" data-due="${o.value}" onclick="_RM.selectDeadline(this)" style="flex:1;min-width:0;padding:8px 4px;border-radius:8px;border:1px solid ${selectedDue === o.value ? 'var(--primary-light)' : 'var(--border)'};background:${selectedDue === o.value ? 'rgba(108,92,231,0.15)' : 'var(--bg-input)'};color:${selectedDue === o.value ? 'var(--primary-light)' : 'var(--text-primary)'};font-size:11px;text-align:center;cursor:pointer;transition:all 0.2s;line-height:1.3">
      <div style="font-weight:600">${o.label}</div>
      <div style="font-size:10px;color:${selectedDue === o.value ? 'var(--primary-light)' : 'var(--text-muted)'};margin-top:2px">${o.sub}</div>
    </button>
  `).join('');

  return `
    <div class="field-group">
      <label class="field-label">📖 단원/주제</label>
      <input class="input-field class-topic-input" placeholder="예: 3단원 세포 분열" oninput="_RM.validateClassRecordForm()">
    </div>
    <div class="field-group">
      <label class="field-label">📄 교과서 쪽수</label>
      <input class="input-field class-pages-input" placeholder="예: p.84~89">
    </div>
    <div class="field-group">
      <label class="field-label">📝 핵심 키워드 <span style="color:var(--accent)">*필수</span></label>
      <textarea class="input-field class-keyword-input" placeholder="예: 감수분열, 상동염색체, 2가 염색체" rows="2" oninput="_RM.validateClassRecordForm()"></textarea>
    </div>
    <div class="field-group">
      <label class="field-label">📸 필기 사진 <span style="color:var(--text-muted)">(선택)</span></label>
      <div class="class-photos-container" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${photoThumbs}
        <label class="class-photo-add-btn" style="width:72px;height:72px;flex-shrink:0;border-radius:8px;border:2px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);font-size:11px;gap:2px;transition:border-color 0.2s">
          <i class="fas fa-plus" style="font-size:16px"></i>
          <span>${photoCount > 0 ? '추가' : '사진 추가'}</span>
          <input type="file" accept="image/*" multiple style="display:none" onchange="_RM.handleClassPhotoUpload(this)">
        </label>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin:0">노트/프린트를 촬영하세요 (여러 장 선택 가능)</p>
    </div>
    <div class="field-group">
      <label class="field-label">⭐ 선생님 강조 <span style="color:var(--text-muted)">(선택)</span></label>
      <input class="input-field class-teacher-note-input" placeholder='예: "서술형 나옴"'>
    </div>
    <div class="field-group assignment-section" style="background:var(--bg-input);border-radius:12px;padding:14px;border:1px solid var(--border)">
      <label class="field-label" style="margin-bottom:8px">📋 과제 <span style="color:var(--text-muted)">(있으면 적어줘!)</span></label>
      <input class="input-field class-assignment-input" placeholder="예: 워크북 p.30~32 풀어오기" oninput="_RM.toggleDeadlineSection()">
      <div class="deadline-section" style="display:${state._classAssignmentText ? 'block' : 'none'};margin-top:12px">
        <label class="field-label" style="margin-bottom:8px">📅 마감일</label>
        <div style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto">
          ${deadlineBtns}
          <button type="button" class="deadline-btn deadline-custom-btn" onclick="_RM.openCustomDeadline()" style="flex:0 0 auto;min-width:52px;padding:8px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-muted);font-size:11px;text-align:center;cursor:pointer;transition:all 0.2s;line-height:1.3">
            <div>📅</div>
            <div style="font-size:10px;margin-top:2px">직접 선택</div>
          </button>
        </div>
        <input type="date" class="custom-date-picker" style="display:none;margin-top:8px;width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-size:13px" onchange="_RM.selectCustomDeadline(this)">
      </div>
    </div>
  `;
}

function validateClassRecordForm() {
  const keywordInput = document.querySelector('.class-keyword-input');
  const topicInput = document.querySelector('.class-topic-input');
  const submitBtn = document.querySelector('.class-record-submit');
  if (!submitBtn) return false;

  const hasKeyword = keywordInput && keywordInput.value.trim().length > 0;
  const hasTopic = topicInput && topicInput.value.trim().length > 0;
  const isValid = hasKeyword || hasTopic;

  submitBtn.disabled = !isValid;
  submitBtn.style.opacity = isValid ? '1' : '0.4';
  submitBtn.style.cursor = isValid ? 'pointer' : 'not-allowed';
  return isValid;
}

function handleClassPhotoUpload(input) {
  if (!input.files || input.files.length === 0) return;
  if (!state._classPhotos) state._classPhotos = [];
  if (!state._classPhotoTags) state._classPhotoTags = [];
  const files = Array.from(input.files).slice(0, 20 - state._classPhotos.length);
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      state._classPhotos.push(e.target.result);
      state._classPhotoTags.push('note');
      loaded++;
      if (loaded === files.length) {
        navigate(state.currentScreen, { replace: true });
      }
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function removeClassPhoto(idx) {
  if (!state._classPhotos) return;
  state._classPhotos.splice(idx, 1);
  if (state._classPhotoTags) state._classPhotoTags.splice(idx, 1);
  navigate(state.currentScreen, { replace: true });
}

function viewClassPhoto(idx) {
  const photos = state._classPhotos || [];
  if (photos[idx]) {
    // 호스트 앱의 photo viewer 호출 또는 간단한 새 탭
    window.open(photos[idx], '_blank');
  }
}

function toggleDeadlineSection() {
  const input = document.querySelector('.class-assignment-input');
  const section = document.querySelector('.deadline-section');
  if (input && section) {
    section.style.display = input.value.trim().length > 0 ? 'block' : 'none';
  }
}

function selectDeadline(el) {
  state._classAssignmentDue = el.dataset.due;
  // 버튼 active 상태 토글
  document.querySelectorAll('.deadline-btn').forEach(btn => {
    const isActive = btn.dataset.due === state._classAssignmentDue;
    btn.style.borderColor = isActive ? 'var(--primary-light)' : 'var(--border)';
    btn.style.background = isActive ? 'rgba(108,92,231,0.15)' : 'var(--bg-input)';
    btn.style.color = isActive ? 'var(--primary-light)' : 'var(--text-primary)';
  });
}

function openCustomDeadline() {
  const picker = document.querySelector('.custom-date-picker');
  if (picker) {
    picker.style.display = 'block';
    picker.focus();
  }
}

function selectCustomDeadline(el) {
  state._classAssignmentDue = el.value;
  el.style.display = 'none';
}

function saveClassRecordFromForm() {
  if (!validateClassRecordForm()) {
    const keywordInput = document.querySelector('.class-keyword-input');
    if (keywordInput) {
      keywordInput.focus();
      keywordInput.style.borderColor = 'var(--accent)';
      keywordInput.setAttribute('placeholder', '핵심 키워드를 입력해야 기록을 완료할 수 있어요!');
      setTimeout(() => { keywordInput.style.borderColor = ''; }, 2000);
    }
    return;
  }

  const nextRecord = state.todayRecords.find(r => !r.done);
  const subject = nextRecord ? nextRecord.subject : (state._backfillSubject || '기타');
  const period = nextRecord ? nextRecord.period : (state._backfillPeriod || 0);
  const date = state._backfillDate || kstToday();

  const topicInput = document.querySelector('.class-topic-input');
  const topic = topicInput ? topicInput.value.trim() : '';
  const pagesInput = document.querySelector('.class-pages-input');
  const pages = pagesInput ? pagesInput.value.trim() : '';
  const keywordInput = document.querySelector('.class-keyword-input');
  const keywordText = keywordInput ? keywordInput.value.trim() : '';
  const keywordTexts = keywordText ? keywordText.split(/[,，、\n]+/).map(k => k.trim()).filter(k => k) : [];
  const photos = state._classPhotos || [];
  const teacherNoteInput = document.querySelector('.class-teacher-note-input');
  const teacherNote = teacherNoteInput ? teacherNoteInput.value.trim() : '';

  // todayRecords 업데이트
  if (nextRecord) {
    nextRecord.done = true;
    nextRecord.summary = topic || keywordTexts.join(', ') || '수업 기록 완료';
    nextRecord._topic = topic;
    nextRecord._pages = pages;
    nextRecord._keywords = keywordTexts;
    nextRecord._photos = photos;
    nextRecord._teacherNote = teacherNote;

    const assignInput = document.querySelector('.class-assignment-input');
    const assignText = assignInput ? assignInput.value.trim() : '';
    nextRecord._assignmentText = assignText;
    nextRecord._assignmentDue = state._classAssignmentDue || '';

    state.missions[0].current = state.todayRecords.filter(r => r.done).length;
    if (state.missions[0].current >= state.missions[0].target) state.missions[0].done = true;
  }

  // DB 저장
  const photoTags = state._classPhotoTags || [];
  if (state.studentId) {
    DB.saveClassRecord({
      subject, date,
      content: topic,
      keywords: keywordTexts,
      understanding: 3,
      memo: JSON.stringify({ period, pages, teacherNote, photoCount: photos.length }),
      topic, pages, photos, teacher_note: teacherNote,
      photo_tags: photoTags,
    });
  }

  // 사진 리셋
  state._classPhotos = [];
  state._classPhotoTags = [];
  state._backfillDate = null;
  state._backfillPeriod = null;
  state._backfillSubject = null;

  // XP
  events.emit(EVENTS.XP_EARNED, { amount: 10, label: '수업 기록 완료!' });

  // 대시보드로
  navigate('dashboard');
}

export function renderRecordClass() {
  const nextRecord = state.todayRecords.find(r => !r.done);
  const subject = nextRecord ? nextRecord.subject : (state._backfillSubject || '영어');
  const teacher = nextRecord ? nextRecord.teacher : (state._backfillTeacher || '');
  const period = nextRecord ? nextRecord.period : (state._backfillPeriod || 3);
  const color = nextRecord ? nextRecord.color : getSubjectColor(subject);

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>수업 기록</h1>
        <span class="header-badge">${period}교시 ${subject}</span>
      </div>
      <div class="form-body">
        <div class="subject-indicator">
          <span class="subject-dot" style="background:${color}"></span>
          <span>${subject}${teacher ? ' · ' + teacher + ' 선생님' : ''}</span>
          <span class="period-badge">${period}교시</span>
        </div>
        ${renderClassRecordFields(subject)}
        <button class="btn-primary class-record-submit" onclick="_RM.saveClassRecord()" disabled style="opacity:0.4;cursor:not-allowed">기록 완료 +10 XP ✨</button>
      </div>
    </div>
  `;
}
