/* ================================================================
   Records Module — views/aha-report-input.js
   아하 리포트 입력 화면 (사진 + 과목/출처/날짜)
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';
import { kstToday } from '../core/utils.js';

const SUBJECTS = ['국어','수학','영어','과학','사회','한국사','기술가정','정보','음악','미술','체육','제2외국어','기타'];
const SOURCES = ['수업','독서','실험','뉴스/기사','다큐멘터리','일상생활','기타'];

export function registerHandlers(RM) {
  RM.handleAhaNoteUpload = (input) => handleNoteUpload(input);
  RM.removeAhaNote = (idx) => removeNote(idx);
  RM.handleAhaRefUpload = (input) => handleRefUpload(input);
  RM.removeAhaRef = (idx) => removeRefPhoto(idx);
  RM.setAhaSubject = (val) => { state._ahaSubject = val; };
  RM.setAhaSource = (val) => { state._ahaSource = val; };
  RM.setAhaDate = (val) => { state._ahaDate = val; };
  RM.startAhaAnalysis = () => startAnalysis();
}

function resizeImage(file, maxWidth = 1200) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        if (img.width <= maxWidth) { resolve(e.target.result); return; }
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

async function handleNoteUpload(input) {
  if (!input.files || input.files.length === 0) return;
  if (!state._ahaPhotos) state._ahaPhotos = [];
  if (!state._ahaPhotoTags) state._ahaPhotoTags = [];

  const maxNotes = 3;
  const currentNoteCount = state._ahaPhotos.filter((_, i) => state._ahaPhotoTags[i] === 'note').length;
  const remaining = maxNotes - currentNoteCount;
  if (remaining <= 0) { input.value = ''; return; }

  const files = Array.from(input.files).slice(0, remaining);
  for (const file of files) {
    const dataUrl = await resizeImage(file);
    state._ahaPhotos.push(dataUrl);
    state._ahaPhotoTags.push('note');
  }

  input.value = '';
  navigate(state.currentScreen, { replace: true });
}

function removeNote(idx) {
  const noteIndices = [];
  (state._ahaPhotoTags || []).forEach((t, i) => { if (t === 'note') noteIndices.push(i); });
  const realIdx = noteIndices[idx];
  if (realIdx == null) return;
  state._ahaPhotos.splice(realIdx, 1);
  state._ahaPhotoTags.splice(realIdx, 1);
  navigate(state.currentScreen, { replace: true });
}

async function handleRefUpload(input) {
  if (!input.files || input.files.length === 0) return;
  if (!state._ahaPhotos) state._ahaPhotos = [];
  if (!state._ahaPhotoTags) state._ahaPhotoTags = [];

  const maxRef = 5;
  const currentRefCount = state._ahaPhotos.filter((_, i) => state._ahaPhotoTags[i] === 'ref').length;
  const remaining = maxRef - currentRefCount;
  if (remaining <= 0) { input.value = ''; return; }

  const files = Array.from(input.files).slice(0, remaining);
  for (const file of files) {
    const dataUrl = await resizeImage(file);
    state._ahaPhotos.push(dataUrl);
    state._ahaPhotoTags.push('ref');
  }

  input.value = '';
  navigate(state.currentScreen, { replace: true });
}

function removeRefPhoto(idx) {
  const refIndices = [];
  (state._ahaPhotoTags || []).forEach((t, i) => { if (t === 'ref') refIndices.push(i); });
  const realIdx = refIndices[idx];
  if (realIdx == null) return;
  state._ahaPhotos.splice(realIdx, 1);
  state._ahaPhotoTags.splice(realIdx, 1);
  navigate(state.currentScreen, { replace: true });
}

function startAnalysis() {
  const notePhotos = (state._ahaPhotos || []).filter((_, i) => (state._ahaPhotoTags || [])[i] === 'note');
  if (notePhotos.length === 0) return;
  state._ahaAnalyzing = true;
  state._ahaAnalysisStep = 'analyzing';
  navigate('aha-loading');
}

export function renderAhaInput() {
  const photos = state._ahaPhotos || [];
  const tags = state._ahaPhotoTags || [];
  const notePhotos = photos.filter((_, i) => tags[i] === 'note');
  const refPhotos = photos.filter((_, i) => tags[i] === 'ref');
  const subject = state._ahaSubject || '';
  const source = state._ahaSource || '';
  const date = state._ahaDate || kstToday();
  const hasNotes = notePhotos.length > 0;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('aha-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>아하 리포트 작성</h1>
      </div>
      <div class="form-body">

        <!-- 과목 / 출처 / 날짜 -->
        <div class="aha-meta-section">
          <div class="aha-meta-row">
            <label class="aha-meta-label">과목</label>
            <select class="aha-meta-select" onchange="_RM.setAhaSubject(this.value)">
              <option value="">선택</option>
              ${SUBJECTS.map(s => `<option value="${s}" ${s === subject ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="aha-meta-row">
            <label class="aha-meta-label">출처</label>
            <select class="aha-meta-select" onchange="_RM.setAhaSource(this.value)">
              <option value="">선택</option>
              ${SOURCES.map(s => `<option value="${s}" ${s === source ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          <div class="aha-meta-row">
            <label class="aha-meta-label">날짜</label>
            <input type="date" class="aha-meta-input" value="${date}" onchange="_RM.setAhaDate(this.value)">
          </div>
        </div>

        <!-- 노트 사진 (최대 3장) -->
        <div class="pu-note-section">
          <div class="pu-note-header">
            <span class="pu-note-title">📝 노트 사진 촬영</span>
            <span class="pu-note-subtitle">${notePhotos.length}/3장</span>
          </div>
          <div class="pu-note-desc">AI가 손글씨를 읽고 5개 섹션으로 정리합니다</div>

          ${notePhotos.length > 0 ? `
            <div class="aha-note-grid">
              ${notePhotos.map((p, i) => `
                <div class="aha-note-tile">
                  <img src="${p}" alt="노트 ${i + 1}">
                  <button class="pu-ref-tile-delete" onclick="_RM.removeAhaNote(${i})">&times;</button>
                </div>
              `).join('')}
              ${notePhotos.length < 3 ? `
                <label class="pu-ref-add-tile">
                  <i class="fas fa-camera" style="font-size:20px;margin-bottom:4px"></i>
                  <span>추가 촬영</span>
                  <input type="file" accept="image/*" capture="environment" style="display:none" onchange="_RM.handleAhaNoteUpload(this)">
                </label>
              ` : ''}
            </div>
          ` : `
            <label class="pu-note-upload">
              <i class="fas fa-camera" style="font-size:28px;margin-bottom:8px;color:#7c6aef"></i>
              <span style="font-weight:600;color:#7c6aef">노트 사진 촬영하기</span>
              <span style="font-size:11px;color:var(--text-muted);margin-top:4px">최대 3장</span>
              <input type="file" accept="image/*" capture="environment" style="display:none" onchange="_RM.handleAhaNoteUpload(this)">
            </label>
          `}
        </div>

        <div class="pu-divider"></div>

        <!-- 참고 사진 (선택) -->
        <div class="pu-ref-section">
          <div class="pu-ref-header">
            <span class="pu-ref-title">📷 참고 사진</span>
            <span class="pu-ref-optional">(선택)</span>
          </div>
          <div class="pu-ref-desc">교과서, 자료 등 참고 이미지</div>
          <div class="pu-ref-grid">
            ${refPhotos.map((p, i) => `
              <div class="pu-ref-tile">
                <img class="pu-ref-tile-img" src="${p}" alt="참고 ${i + 1}">
                <button class="pu-ref-tile-delete" onclick="_RM.removeAhaRef(${i})">&times;</button>
              </div>
            `).join('')}
            ${refPhotos.length < 5 ? `
              <label class="pu-ref-add-tile">
                <i class="fas fa-plus" style="font-size:20px;margin-bottom:4px"></i>
                <span>${refPhotos.length > 0 ? '추가' : '사진 추가'}</span>
                <input type="file" accept="image/*" multiple style="display:none" onchange="_RM.handleAhaRefUpload(this)">
              </label>
            ` : ''}
          </div>
          <div class="pu-ref-count">${refPhotos.length}/5장</div>
        </div>

        <!-- 액션 버튼 -->
        <div class="pu-actions">
          <button class="btn-primary pu-ai-btn ${hasNotes ? '' : 'disabled'}"
                  onclick="${hasNotes ? '_RM.startAhaAnalysis()' : ''}"
                  ${hasNotes ? '' : 'disabled'}>
            <i class="fas fa-magic" style="margin-right:8px"></i>AI 정리 시작
          </button>
        </div>
      </div>
    </div>
  `;
}
