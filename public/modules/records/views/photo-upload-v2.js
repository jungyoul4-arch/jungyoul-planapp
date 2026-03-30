/* ================================================================
   Records Module — views/photo-upload-v2.js
   사진 업로드 — 필기 노트(1장) + 참고 사진(14장) 2영역 분리
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';
import { getSubjectColor, showToast } from '../core/utils.js';

// ==================== 사진 품질 검증 ====================

const QUALITY_RULES = {
  MIN_WIDTH: 640,
  MIN_HEIGHT: 480,
  MIN_FILE_SIZE: 10 * 1024, // 10KB
  MAX_ASPECT_RATIO: 4,      // 긴변/짧은변 4:1 초과 시 거부
  BLUR_THRESHOLD: 80,       // Laplacian variance 임계값 (낮을수록 흐림)
};

/**
 * 사진 품질 검증 — Canvas 기반 클라이언트사이드 분석
 * @returns {{ ok: boolean, hard: boolean, message: string }}
 *   ok=true: 통과, hard=true: 강제거부(재촬영 필수), hard=false: 경고(무시 가능)
 */
function validatePhoto(img, file, isNote) {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;

  // 1. 최소 해상도 (강제 거부)
  if (w < QUALITY_RULES.MIN_WIDTH || h < QUALITY_RULES.MIN_HEIGHT) {
    return { ok: false, hard: true, message: `사진이 너무 작아요!\n카메라로 노트 가까이에서 다시 찍어주세요 📸` };
  }

  // 2. 파일 크기 (강제 거부)
  if (file && file.size < QUALITY_RULES.MIN_FILE_SIZE) {
    return { ok: false, hard: true, message: `사진에 내용이 거의 없는 것 같아요\n필기가 보이게 다시 찍어주세요 📸` };
  }

  // 3. 극단적 비율 (강제 거부)
  const longSide = Math.max(w, h);
  const shortSide = Math.min(w, h);
  if (longSide / shortSide > QUALITY_RULES.MAX_ASPECT_RATIO) {
    return { ok: false, hard: true, message: `사진이 너무 길게 잘렸어요\n노트 전체가 보이도록 다시 찍어주세요 📸` };
  }

  // 4. 흐림 감지 — 필기 사진에만 적용 (경고)
  if (isNote) {
    try {
      const blurScore = _calcBlurScore(img, w, h);
      if (blurScore < QUALITY_RULES.BLUR_THRESHOLD) {
        return { ok: false, hard: false, message: `사진이 좀 흐려 보여요 🔍\n다시 찍으면 AI가 글씨를 더 잘 읽을 수 있어요!` };
      }
    } catch (_) { /* Canvas 에러 시 통과 처리 */ }
  }

  return { ok: true, hard: false, message: '' };
}

/** Laplacian variance 기반 흐림 감지 — 값이 낮을수록 흐림 */
function _calcBlurScore(img, origW, origH) {
  const canvas = document.createElement('canvas');
  // 성능을 위해 작은 크기로 축소하여 계산
  const scale = Math.min(1, 300 / Math.max(origW, origH));
  const w = Math.round(origW * scale);
  const h = Math.round(origH * scale);
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);

  // RGB → Grayscale
  for (let i = 0; i < gray.length; i++) {
    const r = imageData.data[i * 4];
    const g = imageData.data[i * 4 + 1];
    const b = imageData.data[i * 4 + 2];
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Laplacian 컨볼루션 (3×3 커널: [0,-1,0,-1,4,-1,0,-1,0])
  let sum = 0, sumSq = 0, count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      const lap = 4 * gray[idx] - gray[idx - 1] - gray[idx + 1] - gray[idx - w] - gray[idx + w];
      sum += lap;
      sumSq += lap * lap;
      count++;
    }
  }
  const mean = sum / count;
  return (sumSq / count) - (mean * mean); // variance
}

/** 사진 품질 경고 모달 표시 (경고 수준: "그래도 이대로 할래요" 버튼 포함) */
function _showPhotoWarning(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface,#1e1e2e);border-radius:16px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4)">
        <div style="font-size:48px;margin-bottom:12px">📸</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-primary,#fff);margin-bottom:8px;white-space:pre-line;line-height:1.5">${message}</div>
        <div style="display:flex;flex-direction:column;gap:8px;margin-top:20px">
          <button id="_pq_retake" style="padding:12px;border-radius:10px;background:var(--primary,#6c5ce7);color:white;font-weight:700;font-size:14px;border:none;cursor:pointer">📷 다시 찍을래요</button>
          <button id="_pq_keep" style="padding:10px;border-radius:10px;background:transparent;color:var(--text-muted,#999);font-size:13px;border:1px solid var(--border,#333);cursor:pointer">그래도 이대로 할래요</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_pq_retake').onclick = () => { overlay.remove(); resolve('retake'); };
    overlay.querySelector('#_pq_keep').onclick = () => { overlay.remove(); resolve('keep'); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve('retake'); } };
  });
}

/** 사진 품질 강제 거부 모달 (재촬영만 가능) */
function _showPhotoReject(message) {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.innerHTML = `
      <div style="background:var(--surface,#1e1e2e);border-radius:16px;padding:28px 24px;max-width:320px;width:100%;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.4)">
        <div style="font-size:48px;margin-bottom:12px">🙈</div>
        <div style="font-size:15px;font-weight:600;color:var(--text-primary,#fff);margin-bottom:8px;white-space:pre-line;line-height:1.5">${message}</div>
        <div style="margin-top:20px">
          <button id="_pq_ok" style="padding:12px 32px;border-radius:10px;background:var(--primary,#6c5ce7);color:white;font-weight:700;font-size:14px;border:none;cursor:pointer;width:100%">알겠어요 📷</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#_pq_ok').onclick = () => { overlay.remove(); resolve(); };
    overlay.onclick = (e) => { if (e.target === overlay) { overlay.remove(); resolve(); } };
  });
}

/** File → Image 로딩 (검증용) */
function _loadImageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ img, url }); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('이미지 로딩 실패')); };
    img.src = url;
  });
}

export function registerHandlers(RM) {
  RM.handleNoteUpload = (input) => handleNoteUpload(input);
  RM.removeNote = () => removeNote();
  RM.handleRefUpload = (input) => handleRefUpload(input);
  RM.removeRefPhoto = (idx) => removeRefPhoto(idx);
  RM.startAiAnalysis = () => startAiAnalysis();
  RM.skipToManualEntry = () => skipToManual();
  RM.updateStudentComment = (value) => { state._studentComment = value; };
  RM.photoUploadBack = () => photoUploadBack();
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

  // ① 사진 품질 검증 (필기 = 엄격 모드)
  try {
    const { img, url } = await _loadImageFromFile(file);
    const result = validatePhoto(img, file, true);
    URL.revokeObjectURL(url);
    if (!result.ok) {
      if (result.hard) {
        input.value = '';
        await _showPhotoReject(result.message);
        return;
      }
      // 소프트 경고: 학생이 선택 가능
      const choice = await _showPhotoWarning(result.message);
      if (choice === 'retake') {
        input.value = '';
        return;
      }
    }
  } catch (_) { /* 검증 실패 시 통과 처리 */ }

  // ② 낙관적 UI: 즉시 로컬 미리보기 표시
  const quickPreview = URL.createObjectURL(file);
  if (_hasNote()) {
    state._classPhotos[0] = quickPreview;
    state._classPhotoTags[0] = '필기';
  } else {
    state._classPhotos.unshift(quickPreview);
    state._classPhotoTags.unshift('필기');
  }
  state._photoProcessing = true; // 처리 중 표시
  navigate(state.currentScreen, { replace: true });

  // ③ 백그라운드에서 리사이즈 → 교체
  try {
    const dataUrl = await resizeImage(file);
    URL.revokeObjectURL(quickPreview);
    state._classPhotos[0] = dataUrl;
  } catch (e) {
    console.error('사진 리사이즈 실패:', e);
    URL.revokeObjectURL(quickPreview);
    if (state._classPhotos[0] === quickPreview) {
      state._classPhotos.splice(0, 1);
      state._classPhotoTags.splice(0, 1);
    }
    showToast('⚠️', '사진 처리에 실패했어요. 다시 촬영해주세요.');
  }
  state._photoProcessing = false;
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

  // ① 사진 품질 검증 (참고 사진 = 느슨 모드: 강제 거부만, 흐림 경고 없음)
  const validFiles = [];
  let rejectCount = 0;
  for (const file of files) {
    try {
      const { img, url } = await _loadImageFromFile(file);
      const result = validatePhoto(img, file, false); // isNote=false
      URL.revokeObjectURL(url);
      if (!result.ok && result.hard) {
        rejectCount++;
        continue; // 강제 거부 사진은 건너뜀
      }
    } catch (_) { /* 검증 실패 시 통과 */ }
    validFiles.push(file);
  }
  if (rejectCount > 0) {
    showToast('📸', `${rejectCount}장은 너무 작아서 제외됐어요. 가까이서 다시 찍어주세요!`);
  }
  if (validFiles.length === 0) { input.value = ''; return; }

  // ② 모든 유효 파일의 로컬 미리보기 즉시 추가
  const previews = [];
  for (const file of validFiles) {
    const blobUrl = URL.createObjectURL(file);
    state._classPhotos.push(blobUrl);
    state._classPhotoTags.push('참고');
    previews.push({ blobUrl, file });
  }
  state._photoProcessing = true;
  navigate(state.currentScreen, { replace: true });

  // ③ 백그라운드에서 리사이즈 → blob URL을 data URL로 교체
  let failCount = 0;
  for (const { blobUrl, file } of previews) {
    try {
      const dataUrl = await resizeImage(file);
      const idx = state._classPhotos.indexOf(blobUrl);
      if (idx >= 0) {
        state._classPhotos[idx] = dataUrl;
        URL.revokeObjectURL(blobUrl);
      }
    } catch (e) {
      console.error('참고 사진 리사이즈 실패:', e);
      const idx = state._classPhotos.indexOf(blobUrl);
      if (idx >= 0) {
        state._classPhotos.splice(idx, 1);
        state._classPhotoTags.splice(idx, 1);
      }
      URL.revokeObjectURL(blobUrl);
      failCount++;
    }
  }
  if (failCount > 0) {
    showToast('⚠️', `${failCount}장의 사진 처리에 실패했어요.`);
  }
  state._photoProcessing = false;
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

function photoUploadBack() {
  const photos = state._classPhotos || [];
  if (photos.length > 0) {
    if (confirm('업로드한 사진이 저장되지 않습니다. 나가시겠습니까?')) {
      state._classPhotos = [];
      state._classPhotoTags = [];
      state._studentComment = '';
      navigate('period-select');
    }
  } else {
    navigate('period-select');
  }
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
        <button class="back-btn" onclick="_RM.photoUploadBack()"><i class="fas fa-arrow-left"></i></button>
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
            <div class="pu-note-preview" style="position:relative">
              <img class="pu-note-img" src="${notePhoto}" alt="필기 노트">
              ${state._photoProcessing ? `
                <div class="pu-photo-overlay">
                  <div class="pu-photo-spinner"></div>
                  <div class="pu-photo-status">처리 중...</div>
                </div>` : `<div class="pu-note-done-badge">✅ 촬영 완료</div>`}
              <div class="pu-note-actions">
                <label class="pu-note-retake" style="cursor:pointer">
                  다시 촬영
                  <input type="file" accept="image/*" style="display:none" onchange="_RM.handleNoteUpload(this)">
                </label>
                <button class="pu-note-delete" onclick="_RM.removeNote()">✕ 삭제</button>
              </div>
            </div>
          ` : `
            <label class="pu-note-upload" style="cursor:pointer">
              <i class="fas fa-camera" style="font-size:28px;margin-bottom:8px;color:#7c6aef"></i>
              <span style="font-weight:600;color:#7c6aef">필기 노트 촬영하기</span>
              <span style="font-size:11px;color:var(--text-muted);margin-top:4px">1장만 촬영</span>
              <input type="file" accept="image/*" style="display:none" onchange="_RM.handleNoteUpload(this)">
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
            ${refPhotos.map((p, i) => {
              const isBlob = p.dataUrl.startsWith('blob:');
              return `
              <div class="pu-ref-tile" style="position:relative">
                <img class="pu-ref-tile-img" src="${p.dataUrl}" alt="참고 ${i + 1}">
                ${isBlob ? `
                  <div class="pu-photo-overlay">
                    <div class="pu-photo-spinner" style="width:20px;height:20px;border-width:2px"></div>
                  </div>` : ''}
                <button class="pu-ref-tile-delete" onclick="_RM.removeRefPhoto(${i})">&times;</button>
              </div>`;
            }).join('')}
            ${refCount < 14 ? `
              <label class="pu-ref-add-tile" style="cursor:pointer">
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
          ${state._photoProcessing ? `
          <button class="btn-primary pu-ai-btn disabled" disabled>
            <div class="pu-photo-spinner" style="width:16px;height:16px;border-width:2px;display:inline-block;vertical-align:middle;margin-right:8px"></div>사진 처리 중...
          </button>` : `
          <button class="btn-primary pu-ai-btn ${hasAnyPhoto ? '' : 'disabled'}"
                  onclick="${hasAnyPhoto ? '_RM.startAiAnalysis()' : ''}"
                  ${hasAnyPhoto ? '' : 'disabled'}>
            <i class="fas fa-magic" style="margin-right:8px"></i>AI 정리 시작
          </button>`}
          <button class="pu-skip-btn" onclick="_RM.skipToManualEntry()">
            직접 입력할게요 →
          </button>
        </div>
      </div>
    </div>
  `;
}
