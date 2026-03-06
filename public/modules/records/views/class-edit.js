/* ================================================================
   Records Module — views/class-edit.js
   수업 기록 수정
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { kstToday, kstDateOffset, getSubjectColor, SUBJECT_COLOR_MAP } from '../core/utils.js';
import { navigate } from '../core/router.js';

export function registerHandlers(RM) {
  RM.saveClassRecordEdit = () => saveClassRecordEdit();
  RM.handleEditPhotoUpload = (input) => handleEditPhotoUpload(input);
  RM.removeEditPhoto = (idx) => removeEditPhoto(idx);
  RM.toggleEditDeadline = () => toggleEditDeadline();
}

function handleEditPhotoUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const idx = state._editingClassRecordIdx;
  const r = state.todayRecords[idx];
  if (!r) return;
  if (!r._photos) r._photos = [];
  if (!r._photoTags) r._photoTags = [];
  const files = Array.from(input.files).slice(0, 20 - r._photos.length);
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      r._photos.push(e.target.result);
      r._photoTags.push('note');
      loaded++;
      if (loaded === files.length) navigate('class-record-edit', { replace: true });
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

function removeEditPhoto(photoIdx) {
  const idx = state._editingClassRecordIdx;
  const r = state.todayRecords[idx];
  if (!r || !r._photos) return;
  r._photos.splice(photoIdx, 1);
  if (r._photoTags) r._photoTags.splice(photoIdx, 1);
  navigate('class-record-edit', { replace: true });
}

function toggleEditDeadline() {
  const input = document.getElementById('edit-cr-assignment');
  const section = document.querySelector('.edit-deadline-section');
  if (input && section) {
    section.style.display = input.value.trim().length > 0 ? 'block' : 'none';
  }
}

function saveClassRecordEdit() {
  const idx = state._editingClassRecordIdx;
  const r = state.todayRecords[idx];
  if (!r) return;

  const topic = document.getElementById('edit-cr-topic')?.value?.trim() || '';
  const pages = document.getElementById('edit-cr-pages')?.value?.trim() || '';
  const keywordsInput = document.getElementById('edit-cr-keywords')?.value || '';
  const teacherNote = document.getElementById('edit-cr-teacher-note')?.value?.trim() || '';
  const keywords = keywordsInput.split(/[,，、\n]+/).map(k => k.trim()).filter(k => k);
  const photos = r._photos || [];
  const assignmentText = document.getElementById('edit-cr-assignment')?.value?.trim() || '';
  const assignmentDue = document.getElementById('edit-cr-due')?.value || '';

  r.summary = topic || keywords.join(', ') || r.summary;
  r._topic = topic;
  r._pages = pages;
  r._keywords = keywords;
  r._teacherNote = teacherNote;
  r._assignmentText = assignmentText;
  r._assignmentDue = assignmentDue;

  if (r._dbRecordId && state.studentId) {
    DB.updateClassRecord(r._dbRecordId, {
      content: topic, keywords,
      memo: JSON.stringify({ period: r.period || '', pages, teacherNote, photoCount: photos.length }),
      topic, pages, photos, teacher_note: teacherNote,
    });
  }

  navigate('dashboard');
}

export function renderClassRecordEdit() {
  const idx = state._editingClassRecordIdx;
  const r = state.todayRecords[idx];
  if (!r) return '<div style="text-align:center;padding:60px;color:var(--text-muted)">기록을 찾을 수 없습니다.</div>';

  const topic = r._topic || '';
  const pages = r._pages || '';
  const keywords = r._keywords || (r.summary ? r.summary.split(', ').filter(k => k) : []);
  const teacherNote = r._teacherNote || '';
  const photos = r._photos || [];
  const assignmentText = r._assignmentText || '';
  const assignmentDue = r._assignmentDue || '';

  const photoThumbs = photos.map((p, i) => `
    <div class="class-photo-thumb" style="position:relative;width:72px;height:72px;flex-shrink:0;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <img src="${p}" style="width:100%;height:100%;object-fit:cover">
      <button onclick="_RM.removeEditPhoto(${i})" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">&times;</button>
    </div>
  `).join('');

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>✏️ 수업 기록 수정</h1>
        <button class="header-action-btn" onclick="_RM.saveClassRecordEdit()" style="color:var(--primary-light)"><i class="fas fa-save"></i></button>
      </div>
      <div class="form-body">
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="tt-period-badge done" style="width:36px;height:36px;font-size:14px">${r.period}</div>
            <div>
              <div style="font-size:17px;font-weight:700;color:${r.color}">${r.subject}</div>
              <div style="font-size:12px;color:var(--text-muted)">${r.teacher} 선생님 · ${r.startTime || ''}~${r.endTime || ''}</div>
            </div>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">📖 단원/주제</label>
          <input class="input-field" id="edit-cr-topic" value="${topic}" placeholder="예: 3단원 세포 분열">
        </div>
        <div class="field-group">
          <label class="field-label">📄 교과서 쪽수</label>
          <input class="input-field" id="edit-cr-pages" value="${pages}" placeholder="예: p.84~89">
        </div>
        <div class="field-group">
          <label class="field-label">📝 핵심 키워드 <span style="color:var(--accent)">*필수</span></label>
          <textarea class="input-field" id="edit-cr-keywords" rows="2" placeholder="예: 감수분열, 상동염색체, 2가 염색체">${keywords.join(', ')}</textarea>
        </div>
        <div class="field-group">
          <label class="field-label">📸 필기 사진</label>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            ${photoThumbs}
            <label style="width:72px;height:72px;flex-shrink:0;border-radius:8px;border:2px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);font-size:11px;gap:2px">
              <i class="fas fa-plus" style="font-size:16px"></i><span>추가</span>
              <input type="file" accept="image/*" multiple style="display:none" onchange="_RM.handleEditPhotoUpload(this)">
            </label>
          </div>
        </div>
        <div class="field-group">
          <label class="field-label">⭐ 선생님 강조</label>
          <input class="input-field" id="edit-cr-teacher-note" value="${teacherNote}" placeholder='예: "서술형 나옴"'>
        </div>
        <div class="field-group" style="background:var(--bg-input);border-radius:12px;padding:14px;border:1px solid var(--border)">
          <label class="field-label" style="margin-bottom:8px">📋 과제</label>
          <input class="input-field" id="edit-cr-assignment" value="${assignmentText}" placeholder="예: 워크북 p.30~32 풀어오기" oninput="_RM.toggleEditDeadline()">
          <div class="edit-deadline-section" style="display:${assignmentText ? 'block' : 'none'};margin-top:12px">
            <label class="field-label" style="margin-bottom:8px">📅 마감일</label>
            <input type="date" class="input-field" id="edit-cr-due" value="${assignmentDue}" style="font-size:13px">
          </div>
        </div>
        <button class="btn-primary" style="width:100%;margin-top:20px" onclick="_RM.saveClassRecordEdit()">
          <i class="fas fa-save" style="margin-right:6px"></i> 수정 완료
        </button>
      </div>
    </div>
  `;
}
