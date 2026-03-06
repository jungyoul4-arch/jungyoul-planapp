/* ================================================================
   Records Module — views/photo-upload-v2.js
   사진 업로드 — 필기 노트(1장) + 참고 사진(14장) 2영역 분리
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';
import { getSubjectColor } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.handleNoteUpload = (input) => handleNoteUpload(input);
  RM.removeNote = () => removeNote();
  RM.handleRefUpload = (input) => handleRefUpload(input);
  RM.removeRefPhoto = (idx) => removeRefPhoto(idx);
  RM.startAiAnalysis = () => startAiAnalysis();
  RM.skipToManualEntry = () => skipToManual();
  RM.updateStudentComment = (value) => { state._studentComment = value; };
}

function resizeImage(file, maxWidth = 1200) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width <= maxWidth) {
          resolve(e.target.result);
          return;
        }
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// === 필기 노트 (1장만) ===
async function handleNoteUpload(input) {
  if (!input.files || input.files.length === 0) return;
  if (!state._classPhotos) state._classPhotos = [];
  if (!state._classPhotoTags) state._classPhotoTags = [];

  const file = input.files[0];
  const dataUrl = await resizeImage(file);

  // 기존 필기 노트가 있으면 교체
  if (_hasNote()) {
    state._classPhotos[0] = dataUrl;
    state._classPhotoTags[0] = '필기';
  } else {
    // 맨 앞에 삽입
    state._classPhotos.unshift(dataUrl);
    state._classPhotoTags.unshift('필기');
  }

  input.value = '';
  navigate(state.currentScreen, { replace: true });
}

function removeNote() {
  if (!_hasNote()) return;
  state._classPhotos.splice(0, 1);
  state._classPhotoTags.splice(0, 1);
  navigate(state.currentScreen, { replace: true });
}

// === 참고 사진 (여러 장) ===
async function handleRefUpload(input) {
  if (!input.files || input.files.length === 0) return;
  if (!state._classPhotos) state._classPhotos = [];
  if (!state._classPhotoTags) state._classPhotoTags = [];

  const maxRef = 14;
  const currentRefCount = _getRefPhotos().length;
  const remaining = maxRef - currentRefCount;
  if (remaining <= 0) { input.value = ''; return; }

  const files = Array.from(input.files).slice(0, remaining);

  for (const file of files) {
    const dataUrl = await resizeImage(file);
    state._classPhotos.push(dataUrl);
    state._classPhotoTags.push('참고');
  }

  input.value = '';
  navigate(state.currentScreen, { replace: true });
}

function removeRefPhoto(idx) {
  // idx는 참고 사진 배열 내 인덱스. 실제 배열 인덱스 = offset + idx
  const offset = _hasNote() ? 1 : 0;
  const realIdx = offset + idx;
  if (realIdx >= state._classPhotos.length) return;
  state._classPhotos.splice(realIdx, 1);
  state._classPhotoTags.splice(realIdx, 1);
  navigate(state.currentScreen, { replace: true });
}

// === 헬퍼 ===
function _hasNote() {
  return (state._classPhotoTags || [])[0] === '필기';
}

function _getNotePhoto() {
  return _hasNote() ? state._classPhotos[0] : null;
}

function _getRefPhotos() {
  const photos = state._classPhotos || [];
  const tags = state._classPhotoTags || [];
  const offset = _hasNote() ? 1 : 0;
  return photos.slice(offset).map((p, i) => ({ dataUrl: p, tag: tags[offset + i] || '참고' }));
}

function startAiAnalysis() {
  const photos = state._classPhotos || [];
  if (photos.length === 0) return; // 사진이 최소 1장 필요 (필기 or 참고)
  state._aiAnalyzing = true;
  state._aiAnalysisStep = 'analyzing';
  navigate('ai-loading');
}

function skipToManual() {
  const record = state.todayRecords[state._selectedPeriodIdx];
  if (record) {
    state._backfillDate = null;
    state._backfillPeriod = record.period;
    state._backfillSubject = record.subject;
    state._backfillTeacher = record.teacher || '';
  }
  navigate('record-class');
}

// === 렌더러 ===
export function renderPhotoUpload() {
  const record = state.todayRecords[state._selectedPeriodIdx];
  const subject = record ? record.subject : '수업';
  const period = record ? record.period : '';
  const color = record ? record.color : getSubjectColor(subject);
  const teacher = record ? record.teacher : '';

  const notePhoto = _getNotePhoto();
  const refPhotos = _getRefPhotos();
  const refCount = refPhotos.length;
  const hasNote = !!notePhoto;
  const hasAnyPhoto = hasNote || refCount > 0;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('period-select')"><i class="fas fa-arrow-left"></i></button>
        <h1>사진 업로드</h1>
        <span class="header-badge">${period}교시 ${subject}</span>
      </div>
      <div class="form-body">
        <div class="subject-indicator">
          <span class="subject-dot" style="background:${color}"></span>
          <span>${subject}${teacher ? ' · ' + teacher + ' 선생님' : ''}</span>
          <span class="period-badge">${period}교시</span>
        </div>

        <!-- 필기 노트 영역 -->
        <div class="pu-note-section">
          <div class="pu-note-header">
            <span class="pu-note-title">📝 필기 노트 촬영</span>
            <span class="pu-note-subtitle">MY CREDIT LOG 양식</span>
          </div>
          <div class="pu-note-desc">AI가 분석하여 수업 기록을 자동 정리합니다</div>

          ${hasNote ? `
            <div class="pu-note-preview">
              <img class="pu-note-img" src="${notePhoto}" alt="필기 노트">
              <div class="pu-note-done-badge">✅ 촬영 완료</div>
              <div class="pu-note-actions">
                <label class="pu-note-retake">
                  다시 촬영
                  <input type="file" accept="image/*" capture="environment" style="display:none" onchange="_RM.handleNoteUpload(this)">
                </label>
                <button class="pu-note-delete" onclick="_RM.removeNote()">✕ 삭제</button>
              </div>
            </div>
          ` : `
            <label class="pu-note-upload">
              <i class="fas fa-camera" style="font-size:28px;margin-bottom:8px;color:#7c6aef"></i>
              <span style="font-weight:600;color:#7c6aef">필기 노트 촬영하기</span>
              <span style="font-size:11px;color:var(--text-muted);margin-top:4px">1장만 촬영</span>
              <input type="file" accept="image/*" capture="environment" style="display:none" onchange="_RM.handleNoteUpload(this)">
            </label>
          `}
          <div class="pu-note-hint">※ MY CREDIT LOG 양식에 손으로 작성한 필기만 촬영해주세요</div>
        </div>

        <!-- 구분선 -->
        <div class="pu-divider"></div>

        <!-- 참고 사진 영역 -->
        <div class="pu-ref-section">
          <div class="pu-ref-header">
            <span class="pu-ref-title">📷 참고 사진</span>
            <span class="pu-ref-optional">(선택)</span>
          </div>
          <div class="pu-ref-desc">교과서, 프린트, 칠판 등 참고 자료를 남겨보세요</div>

          <div class="pu-ref-grid">
            ${refPhotos.map((p, i) => `
              <div class="pu-ref-tile">
                <img class="pu-ref-tile-img" src="${p.dataUrl}" alt="참고 ${i + 1}">
                <button class="pu-ref-tile-delete" onclick="_RM.removeRefPhoto(${i})">&times;</button>
              </div>
            `).join('')}
            ${refCount < 14 ? `
              <label class="pu-ref-add-tile">
                <i class="fas fa-plus" style="font-size:20px;margin-bottom:4px"></i>
                <span>${refCount > 0 ? '추가' : '사진 추가'}</span>
                <input type="file" accept="image/*" multiple style="display:none" onchange="_RM.handleRefUpload(this)">
              </label>
            ` : ''}
          </div>
          <div class="pu-ref-count">${refCount}/14장</div>
        </div>

        <!-- 소감/궁금한 점 -->
        <div class="pu-comment-section">
          <div class="pu-comment-header">
            <span class="pu-comment-title">💬 오늘 수업 소감</span>
            <span class="pu-ref-optional">(선택)</span>
          </div>
          <div class="pu-comment-desc">수업 후 느낀 점이나 궁금한 점을 적어주세요. AI가 맞춤 피드백을 드려요!</div>
          <textarea class="pu-comment-textarea"
                    placeholder="예) 오늘 배운 개념이 어렵게 느껴졌어요 / 이 부분이 시험에 나올까요?"
                    rows="3"
                    oninput="_RM.updateStudentComment(this.value)">${state._studentComment || ''}</textarea>
        </div>

        <!-- 액션 버튼 -->
        <div class="pu-actions">
          <button class="btn-primary pu-ai-btn ${hasAnyPhoto ? '' : 'disabled'}"
                  onclick="${hasAnyPhoto ? '_RM.startAiAnalysis()' : ''}"
                  ${hasAnyPhoto ? '' : 'disabled'}>
            <i class="fas fa-magic" style="margin-right:8px"></i>AI 정리 시작
          </button>
          <button class="pu-skip-btn" onclick="_RM.skipToManualEntry()">
            직접 입력할게요 →
          </button>
        </div>
      </div>
    </div>
  `;
}
