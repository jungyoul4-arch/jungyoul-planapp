/* ================================================================
   Records Module — views/autonomy-upload.js
   자율·자치 활동 사진 업로드
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';
import { resizeImage } from '../core/utils.js';
import { DB } from '../core/api.js';

const PREFIX = '_autonomy';
const ACTIVITY_TYPE = 'autonomy';
const ACTIVITY_TITLE = '자율·자치 활동';
const MAIN_TAG = '활동';
const BACK_SCREEN = 'record-activity';

export function registerHandlers(RM) {
  RM.autonomyHandleMain = (input) => handleMainUpload(input);
  RM.autonomyRemoveMain = () => removeMain();
  RM.autonomyHandleRef = (input) => handleRefUpload(input);
  RM.autonomyRemoveRef = (idx) => removeRefPhoto(idx);
  RM.autonomyUpdateComment = (v) => { state[`${PREFIX}Comment`] = v; };
  RM.autonomySave = () => saveActivity(RM);
}

function _photos() { return state[`${PREFIX}Photos`] || []; }
function _tags() { return state[`${PREFIX}PhotoTags`] || []; }
function _hasMain() { return (_tags())[0] === MAIN_TAG; }
function _getMainPhoto() { return _hasMain() ? _photos()[0] : null; }
function _getRefPhotos() {
  const photos = _photos(), tags = _tags();
  const offset = _hasMain() ? 1 : 0;
  return photos.slice(offset).map((p, i) => ({ dataUrl: p, tag: tags[offset + i] || '참고' }));
}

async function handleMainUpload(input) {
  if (!input.files || !input.files.length) return;
  if (!state[`${PREFIX}Photos`]) state[`${PREFIX}Photos`] = [];
  if (!state[`${PREFIX}PhotoTags`]) state[`${PREFIX}PhotoTags`] = [];
  const dataUrl = await resizeImage(input.files[0]);
  if (_hasMain()) {
    state[`${PREFIX}Photos`][0] = dataUrl;
    state[`${PREFIX}PhotoTags`][0] = MAIN_TAG;
  } else {
    state[`${PREFIX}Photos`].unshift(dataUrl);
    state[`${PREFIX}PhotoTags`].unshift(MAIN_TAG);
  }
  input.value = '';
  navigate(state.currentScreen, { replace: true });
}

function removeMain() {
  if (!_hasMain()) return;
  state[`${PREFIX}Photos`].splice(0, 1);
  state[`${PREFIX}PhotoTags`].splice(0, 1);
  navigate(state.currentScreen, { replace: true });
}

async function handleRefUpload(input) {
  if (!input.files || !input.files.length) return;
  if (!state[`${PREFIX}Photos`]) state[`${PREFIX}Photos`] = [];
  if (!state[`${PREFIX}PhotoTags`]) state[`${PREFIX}PhotoTags`] = [];
  const maxRef = 14;
  const currentRefCount = _getRefPhotos().length;
  const remaining = maxRef - currentRefCount;
  if (remaining <= 0) { input.value = ''; return; }
  const files = Array.from(input.files).slice(0, remaining);
  for (const file of files) {
    const dataUrl = await resizeImage(file);
    state[`${PREFIX}Photos`].push(dataUrl);
    state[`${PREFIX}PhotoTags`].push('참고');
  }
  input.value = '';
  navigate(state.currentScreen, { replace: true });
}

async function saveActivity(RM) {
  const photos = _photos();
  const comment = state[`${PREFIX}Comment`] || '';
  if (photos.length === 0 && !comment) return;

  state._activityAiType = ACTIVITY_TYPE;
  state._activityAnalyzing = true;
  state._activityAnalysisStep = '활동 사진을 분석하고 있어요...';
  navigate('activity-loading', { replace: true });

  const aiResult = await DB.analyzeActivity(photos, ACTIVITY_TYPE, comment);

  state._activityAnalyzing = false;

  if (aiResult) {
    state._activityAiResult = aiResult;
    navigate('activity-result', { replace: true });
  } else {
    const logId = await DB.saveActivityLogWithPhotos(ACTIVITY_TYPE, ACTIVITY_TITLE, photos, comment);
    state[`${PREFIX}Photos`] = [];
    state[`${PREFIX}PhotoTags`] = [];
    state[`${PREFIX}Comment`] = '';
    if (logId && RM.toast) RM.toast('자율·자치 활동이 저장되었습니다 (AI 분석 실패)');
    navigate('record-activity', { replace: true });
  }
}

function removeRefPhoto(idx) {
  const offset = _hasMain() ? 1 : 0;
  const realIdx = offset + idx;
  if (realIdx >= _photos().length) return;
  state[`${PREFIX}Photos`].splice(realIdx, 1);
  state[`${PREFIX}PhotoTags`].splice(realIdx, 1);
  navigate(state.currentScreen, { replace: true });
}

export function renderAutonomyUpload() {
  const mainPhoto = _getMainPhoto();
  const refPhotos = _getRefPhotos();
  const refCount = refPhotos.length;
  const hasMain = !!mainPhoto;
  const hasAny = hasMain || refCount > 0;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('${BACK_SCREEN}')"><i class="fas fa-arrow-left"></i></button>
        <h1>자율·자치 활동 기록</h1>
        <span class="header-badge" style="background:#f59e0b;color:#fff">자율·자치</span>
      </div>
      <div class="form-body">
        <div class="subject-indicator">
          <span class="subject-dot" style="background:#f59e0b"></span>
          <span>자율·자치 활동 기록</span>
        </div>

        <div class="pu-note-section">
          <div class="pu-note-header">
            <span class="pu-note-title">📸 활동 사진 촬영</span>
            <span class="pu-note-subtitle">자율·자치</span>
          </div>
          <div class="pu-note-desc">활동 현장을 촬영해주세요</div>

          ${hasMain ? `
            <div class="pu-note-preview">
              <img class="pu-note-img" src="${mainPhoto}" alt="활동 사진">
              <div class="pu-note-done-badge">촬영 완료</div>
              <div class="pu-note-actions">
                <label class="pu-note-retake">
                  다시 촬영
                  <input type="file" accept="image/*" capture="environment" style="display:none" onchange="_RM.autonomyHandleMain(this)">
                </label>
                <button class="pu-note-delete" onclick="_RM.autonomyRemoveMain()">삭제</button>
              </div>
            </div>
          ` : `
            <label class="pu-note-upload">
              <i class="fas fa-camera" style="font-size:28px;margin-bottom:8px;color:#f59e0b"></i>
              <span style="font-weight:600;color:#f59e0b">활동 사진 촬영하기</span>
              <span style="font-size:11px;color:var(--text-muted);margin-top:4px">1장 촬영</span>
              <input type="file" accept="image/*" capture="environment" style="display:none" onchange="_RM.autonomyHandleMain(this)">
            </label>
          `}
        </div>

        <div class="pu-divider"></div>

        <div class="pu-ref-section">
          <div class="pu-ref-header">
            <span class="pu-ref-title">📷 참고 자료</span>
            <span class="pu-ref-optional">(선택)</span>
          </div>
          <div class="pu-ref-desc">회의록, 기획서, 공지 등 참고 자료를 남겨보세요</div>

          <div class="pu-ref-grid">
            ${refPhotos.map((p, i) => `
              <div class="pu-ref-tile">
                <img class="pu-ref-tile-img" src="${p.dataUrl}" alt="참고 ${i + 1}">
                <button class="pu-ref-tile-delete" onclick="_RM.autonomyRemoveRef(${i})">&times;</button>
              </div>
            `).join('')}
            ${refCount < 14 ? `
              <label class="pu-ref-add-tile">
                <i class="fas fa-plus" style="font-size:20px;margin-bottom:4px"></i>
                <span>${refCount > 0 ? '추가' : '사진 추가'}</span>
                <input type="file" accept="image/*" multiple style="display:none" onchange="_RM.autonomyHandleRef(this)">
              </label>
            ` : ''}
          </div>
          <div class="pu-ref-count">${refCount}/14장</div>
        </div>

        <div class="pu-comment-section">
          <div class="pu-comment-header">
            <span class="pu-comment-title">💬 활동 소감</span>
            <span class="pu-ref-optional">(선택)</span>
          </div>
          <div class="pu-comment-desc">활동 후 느낀 점이나 배운 점을 적어주세요</div>
          <textarea class="pu-comment-textarea"
                    placeholder="예) 학급 자치 회의에서 좋은 의견을 제안했어요"
                    rows="3"
                    oninput="_RM.autonomyUpdateComment(this.value)">${state._autonomyComment || ''}</textarea>
        </div>

        <div class="pu-actions">
          <button class="btn-primary pu-ai-btn ${hasAny ? '' : 'disabled'}"
                  ${hasAny ? '' : 'disabled'}
                  onclick="${hasAny ? '_RM.autonomySave()' : ''}">
            <i class="fas fa-magic" style="margin-right:8px"></i>AI 분석 + 저장
          </button>
          <button class="pu-skip-btn" onclick="_RM.nav('${BACK_SCREEN}')">
            돌아가기
          </button>
        </div>
      </div>
    </div>
  `;
}
