/* ================================================================
   Records Module — views/question-record.js
   나의 질문함 — STEP 2: 입력 + 카드 펼침 + 답변 + 해결완료
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { events, EVENTS } from '../core/events.js';
import { navigate } from '../core/router.js';
import { showXpPopup } from '../components/xp-popup.js';

const SOURCE_TAGS = [
  { value: '수업', icon: '📖' },
  { value: '독서', icon: '📚' },
  { value: '수행평가', icon: '📝' },
  { value: '시험', icon: '📊' },
  { value: '동아리', icon: '🎭' },
  { value: '진로', icon: '🧭' },
  { value: '봉사', icon: '🤝' },
  { value: '자율자치', icon: '🏛️' },
  { value: '기타', icon: '💭' },
];

const SUBJECT_TAGS = [
  { value: '국어', icon: '📕', color: '#EC4899' },
  { value: '영어', icon: '📗', color: '#10B981' },
  { value: '수학', icon: '📘', color: '#3B82F6' },
  { value: '사회', icon: '📙', color: '#F97316' },
  { value: '과학', icon: '📓', color: '#8B5CF6' },
  { value: '기타', icon: '📎', color: '#8b949e' },
];

const SUBJECT_COLORS = {
  '국어': '#EC4899', '영어': '#10B981', '수학': '#3B82F6',
  '사회': '#F97316', '과학': '#8B5CF6', '기타': '#8b949e',
};

/* 세부 과목명 → 대분류 카테고리 */
function _getSubjectCategory(subject) {
  if (!subject) return '기타';
  if (['국어','문학','독서','화법','작문','언어','매체'].some(k => subject.includes(k))) return '국어';
  if (['영어','English'].some(k => subject.includes(k))) return '영어';
  if (['수학','미적분','확률','통계','기하'].some(k => subject.includes(k))) return '수학';
  if (['사회','한국사','세계사','경제','정치','법','윤리','지리','동아시아'].some(k => subject.includes(k))) return '사회';
  if (['물리','화학','생명','지구','과학'].some(k => subject.includes(k))) return '과학';
  return '기타';
}

function _getSubjectColor(subject) {
  return SUBJECT_COLORS[_getSubjectCategory(subject)] || '#8b949e';
}

/* ── 스크롤 보존 리렌더 ── */
function _rerender() {
  const scrollArea = document.querySelector('.qb-scroll-area');
  const saved = scrollArea ? scrollArea.scrollTop : 0;
  state._keepScroll = true;
  window._RM.render();
  const el = document.querySelector('.qb-scroll-area');
  if (el) el.scrollTop = saved;
}

/* ── 핸들러 등록 ── */
export function registerHandlers(RM) {
  RM.toggleQbSidebar = () => {
    state._qbSidebarOpen = !state._qbSidebarOpen;
    RM.render();
  };
  RM.setMyQuestionFilter = async (f) => {
    state._myQuestionFilter = f;
    RM.render();
  };
  RM.setQbSourceFilter = (src) => {
    state._qbSourceFilter = state._qbSourceFilter === src ? null : src;
    RM.render();
  };
  RM.setQbSortOrder = (order) => {
    state._qbSortOrder = order;
    RM.render();
  };

  // 카드 펼침 토글
  RM.toggleQuestionExpand = (id) => {
    if (state._expandedQuestionId === id) {
      state._expandedQuestionId = null;
      state._qbAnswerEditing = null;
      state._qbEditingAnswerId = null;
    } else {
      state._expandedQuestionId = id;
      state._qbAnswerEditing = null;
      state._qbEditingAnswerId = null;
      // 상세 로드
      _loadQuestionDetail(id);
    }
    _rerender();
  };

  // 해결완료 토글
  RM.toggleQuestionResolved = (id, currentStatus) => toggleResolved(id, currentStatus);

  // AI 고도화 토글
  RM.toggleAiImprove = (id) => toggleAiImprove(id);

  // 답변 작성
  RM.showAnswerInput = (qId) => {
    state._qbAnswerEditing = qId;
    state._qbEditingAnswerId = null;
    state._qbAnswerPhoto = null;
    RM.render();
    setTimeout(() => {
      const el = document.getElementById('qb-answer-textarea');
      if (el) el.focus();
    }, 100);
  };
  RM.cancelAnswer = () => {
    state._qbAnswerEditing = null;
    state._qbEditingAnswerId = null;
    state._qbAnswerPhoto = null;
    RM.render();
  };
  RM.submitAnswer = (qId) => submitAnswer(qId);

  // 답변 사진
  RM.pickAnswerPhoto = (mode) => pickAnswerPhoto(mode);
  RM.removeAnswerPhoto = () => {
    state._qbAnswerPhoto = null;
    _rerender();
  };

  // 답변 수정
  RM.editAnswer = (qId, aId, content, imageKey) => {
    state._qbAnswerEditing = qId;
    state._qbEditingAnswerId = aId;
    state._qbEditingAnswerContent = content;
    state._qbAnswerPhoto = imageKey || null;
    RM.render();
    setTimeout(() => {
      const el = document.getElementById('qb-answer-textarea');
      if (el) { el.value = content; el.focus(); }
    }, 100);
  };
  RM.updateAnswer = (qId, aId) => updateAnswer(qId, aId);

  // 답변 삭제
  RM.deleteAnswer = (qId, aId) => deleteAnswer(qId, aId);

  // 질문 입력 화면
  RM.openQuestionInput = () => {
    state._qbInputMode = true;
    state._qbInputSubject = null;
    state._qbInputSources = [];
    state._qbInputPhoto = null;
    RM.render();
  };
  RM.closeQuestionInput = () => {
    state._qbInputMode = false;
    RM.render();
  };
  RM.toggleQbInputSubject = (v) => {
    state._qbInputSubject = state._qbInputSubject === v ? null : v;
    RM.render();
  };
  RM.toggleQbInputSource = (v) => {
    const arr = state._qbInputSources || [];
    const idx = arr.indexOf(v);
    if (idx >= 0) arr.splice(idx, 1); else arr.push(v);
    state._qbInputSources = [...arr];
    RM.render();
  };
  RM.removeQbInputPhoto = () => {
    state._qbInputPhoto = null;
    RM.render();
  };
  RM.submitQuestion = () => submitQuestion();
  RM.pickQbPhoto = (mode) => pickPhoto(mode);

  // 사진 풀스크린 뷰어
  RM.openPhotoViewer = (src) => {
    const existing = document.getElementById('qb-photo-viewer');
    if (existing) existing.remove();
    const overlay = document.createElement('div');
    overlay.id = 'qb-photo-viewer';
    overlay.className = 'qb-photo-viewer';
    overlay.innerHTML = `
      <button class="qb-photo-viewer__close" onclick="_RM.closePhotoViewer()"><i class="fas fa-times"></i></button>
      <img src="${src}" alt="질문 사진">
    `;
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) RM.closePhotoViewer();
    });
    document.body.appendChild(overlay);
  };
  RM.closePhotoViewer = () => {
    const el = document.getElementById('qb-photo-viewer');
    if (el) el.remove();
  };

  // 연결 질문 (체인)
  RM.openChainInput = (parentId) => {
    state._chainInputParentId = parentId;
    _rerender();
    setTimeout(() => {
      const el = document.getElementById('qb-chain-input');
      if (el) el.focus();
    }, 100);
  };
  RM.cancelChainInput = () => {
    state._chainInputParentId = null;
    _rerender();
  };
  RM.submitChainQuestion = (parentId) => submitChainQuestion(parentId);
  RM.expandChain = (rootId) => {
    if (!state._chainExpandedIds) state._chainExpandedIds = {};
    state._chainExpandedIds[rootId] = true;
    _rerender();
  };

  // 히스토리 등 외부에서 특정 질문으로 직접 이동
  RM.goToQuestion = (id) => {
    state._expandedQuestionId = id;
    state._qbAnswerEditing = null;
    state._qbEditingAnswerId = null;
    state._qbInputMode = false;
    state._myQuestionFilter = '전체';
    state._qbSourceFilter = null;
    _loadQuestionDetail(id);
    navigate('record-question');
    // 펼쳐진 카드로 스크롤
    setTimeout(() => {
      const card = document.querySelector(`.qb-card[data-qid="${id}"]`);
      if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  };

  // 기존 상세뷰 호환 (안전장치)
  RM.viewMyQuestion = (id) => { RM.toggleQuestionExpand(id); };
  RM.backToQuestionList = () => {
    state._expandedQuestionId = null;
    state._qbAnswerEditing = null;
    RM.render();
  };
  RM.submitMyAnswer = (qId) => submitAnswer(qId);
}

/* ── 비즈니스 로직 ── */

async function _loadQuestionDetail(id) {
  const detail = await DB.getMyQuestionDetail(id);
  if (detail) {
    // 상세 정보를 캐시에 저장
    if (!state._qbDetailCache) state._qbDetailCache = {};
    state._qbDetailCache[id] = detail;
    // 현재 펼쳐진 카드면 스크롤 보존하며 리렌더
    if (state._expandedQuestionId === id) {
      _rerender();
    }
  }
}

async function toggleResolved(id, currentStatus) {
  const newResolved = currentStatus !== '답변완료';
  if (!newResolved) {
    // 해결 취소 확인
    if (!confirm('해결을 취소하시겠습니까?')) return;
  }
  await DB.resolveMyQuestion(id, newResolved);
  if (newResolved) {
    showXpPopup(5, '질문 해결! +5 XP');
    events.emit(EVENTS.XP_EARNED, { amount: 5, label: '질문 해결' });
  }
  await DB.loadMyQuestions();
  await DB.loadMyQuestionStats();
  // 상세 캐시 갱신
  if (state._qbDetailCache && state._qbDetailCache[id]) {
    const detail = await DB.getMyQuestionDetail(id);
    if (detail) state._qbDetailCache[id] = detail;
  }
  navigate('record-question', { replace: true });
}

async function submitAnswer(questionId) {
  const el = document.getElementById('qb-answer-textarea');
  const content = el?.value?.trim();
  if (!content || content.length < 10) {
    alert('답변을 10자 이상 입력해주세요.');
    return;
  }
  const imageKey = state._qbAnswerPhoto || null;
  const result = await DB.saveMyAnswer(questionId, { content, imageKey });
  if (result) {
    showXpPopup(5, '답변 작성! +5 XP');
    events.emit(EVENTS.XP_EARNED, { amount: 5, label: '답변 작성' });
    state._qbAnswerEditing = null;
    state._qbEditingAnswerId = null;
    state._qbAnswerPhoto = null;
    // 캐시 갱신
    const detail = await DB.getMyQuestionDetail(questionId);
    if (detail) {
      if (!state._qbDetailCache) state._qbDetailCache = {};
      state._qbDetailCache[questionId] = detail;
    }
    await DB.loadMyQuestions();
    await DB.loadMyQuestionStats();
    navigate('record-question', { replace: true });
  }
}

async function updateAnswer(questionId, answerId) {
  const el = document.getElementById('qb-answer-textarea');
  const content = el?.value?.trim();
  if (!content || content.length < 10) {
    alert('답변을 10자 이상 입력해주세요.');
    return;
  }
  const imageKey = state._qbAnswerPhoto || null;
  const ok = await DB.updateMyAnswer(questionId, answerId, content, imageKey);
  if (ok) {
    state._qbAnswerEditing = null;
    state._qbEditingAnswerId = null;
    state._qbAnswerPhoto = null;
    const detail = await DB.getMyQuestionDetail(questionId);
    if (detail) {
      if (!state._qbDetailCache) state._qbDetailCache = {};
      state._qbDetailCache[questionId] = detail;
    }
    navigate('record-question', { replace: true });
  }
}

async function deleteAnswer(questionId, answerId) {
  if (!confirm('답변을 삭제하시겠습니까?')) return;
  const ok = await DB.deleteMyAnswer(questionId, answerId);
  if (ok) {
    const detail = await DB.getMyQuestionDetail(questionId);
    if (detail) {
      if (!state._qbDetailCache) state._qbDetailCache = {};
      state._qbDetailCache[questionId] = detail;
    }
    await DB.loadMyQuestions();
    await DB.loadMyQuestionStats();
    navigate('record-question', { replace: true });
  }
}

async function toggleAiImprove(id) {
  const expanded = { ...(state._aiImproveExpanded || {}) };
  if (expanded[id]) {
    delete expanded[id];
    state._aiImproveExpanded = expanded;
    navigate('record-question', { replace: true });
    return;
  }
  expanded[id] = true;
  state._aiImproveExpanded = expanded;

  const q = (state._myQuestions || []).find(x => x.id === id);
  if (q && q.aiImproved) {
    navigate('record-question', { replace: true });
    return;
  }

  navigate('record-question', { replace: true });
  const improved = await DB.improveMyQuestion(id);
  if (improved) {
    const questions = state._myQuestions || [];
    const target = questions.find(x => x.id === id);
    if (target) target.aiImproved = improved;
    state._myQuestions = [...questions];
    navigate('record-question', { replace: true });
  }
}

/* ── 답변 사진 선택 ── */
function pickAnswerPhoto(mode) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (mode === 'camera') input.capture = 'environment';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    _resizeImage(file, 1200).then(base64 => {
      state._qbAnswerPhoto = base64;
      _rerender();
    });
  };
  input.click();
}

/* ── 사진 선택 ── */
function pickPhoto(mode) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  if (mode === 'camera') input.capture = 'environment';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    _resizeImage(file, 1200).then(base64 => {
      state._qbInputPhoto = base64;
      navigate('record-question', { replace: true });
    });
  };
  input.click();
}

function _resizeImage(file, maxWidth) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = Math.round(h * maxWidth / w); w = maxWidth; }
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

/* ── 질문 등록 ── */
async function submitQuestion() {
  const textarea = document.getElementById('qb-input-textarea');
  const text = textarea?.value?.trim();
  const hasPhoto = !!state._qbInputPhoto;
  const minLen = hasPhoto ? 10 : 2;
  if (!text || text.length < minLen) {
    alert(hasPhoto ? '사진과 함께 질문을 10자 이상 입력해주세요.' : '질문을 2자 이상 입력해주세요.');
    return;
  }
  const sources = state._qbInputSources || [];
  if (sources.length === 0) {
    alert('출처 태그를 1개 이상 선택해주세요.');
    return;
  }

  const subject = state._qbInputSubject || '기타';
  const source = sources.join(',');
  const photo = state._qbInputPhoto || null;

  const questionId = await DB.saveMyQuestion({
    subject,
    source,
    title: text,
    imageData: photo,
  });

  if (questionId) {
    showXpPopup(3, '질문 등록! +3 XP');
    events.emit(EVENTS.XP_EARNED, { amount: 3, label: '질문 등록' });
    state._qbInputMode = false;
    state._qbInputPhoto = null;
    state._qbInputSubject = null;
    state._qbInputSources = [];
    await DB.loadMyQuestions();
    await DB.loadMyQuestionStats();
    navigate('record-question', { replace: true });
  }
}

/* ── 연결 질문 등록 ── */
async function submitChainQuestion(parentId) {
  const el = document.getElementById('qb-chain-input');
  const text = el?.value?.trim();
  if (!text || text.length < 2) {
    alert('질문을 2자 이상 입력해주세요.');
    return;
  }
  // 부모 질문의 태그 상속
  const parent = (state._myQuestions || []).find(q => q.id === parentId);
  const subject = parent?.subject || '기타';
  const source = parent?.source || '기타';

  const questionId = await DB.saveMyQuestion({
    subject,
    source,
    title: text,
    parentId,
  });

  if (questionId) {
    showXpPopup(3, '연결 질문! +3 XP');
    events.emit(EVENTS.XP_EARNED, { amount: 3, label: '연결 질문' });
    state._chainInputParentId = null;
    await DB.loadMyQuestions();
    await DB.loadMyQuestionStats();
    _rerender();
  }
}

/* ── 유틸 ── */

function _formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMin = Math.floor((now - d) / 60000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}시간 전`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function _getDateKey(dateStr) {
  if (!dateStr) return 'unknown';
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function _formatDateLabel(dateKey) {
  if (dateKey === 'unknown') return '날짜 미상';
  const d = new Date(dateKey + 'T00:00:00+09:00');
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[d.getDay()];
  return `${month}월 ${day}일 ${dayName}요일`;
}

function _groupByDate(questions) {
  const groups = {};
  for (const q of questions) {
    const key = _getDateKey(q.createdAt || q.date);
    if (!groups[key]) groups[key] = [];
    groups[key].push(q);
  }
  const sortOrder = state._qbSortOrder || 'newest';
  return Object.entries(groups).sort((a, b) =>
    sortOrder === 'newest' ? b[0].localeCompare(a[0]) : a[0].localeCompare(b[0])
  );
}

/* ── 체인 데이터 구조 빌드 (렌더 사이클 캐싱) ── */
let _chainMapCache = null;
let _chainMapCacheKey = null;

function _buildChainMap() {
  // 간단한 캐싱: _myQuestions 배열 참조가 같으면 캐시 사용
  const all = state._myQuestions || [];
  if (_chainMapCache && _chainMapCacheKey === all) return _chainMapCache;
  _chainMapCacheKey = all;

  const byId = {};        // id → question
  const childrenMap = {};  // rootId → [children]
  const rootMap = {};      // id → root question
  const childToRoot = {};  // childId → rootId

  for (const q of all) byId[q.id] = q;

  // 루트 찾기: parentId 체인을 따라 최상위까지 올라감
  function findRoot(q) {
    let current = q;
    const visited = new Set();
    while (current.parentId && byId[current.parentId] && !visited.has(current.parentId)) {
      visited.add(current.id);
      current = byId[current.parentId];
    }
    return current;
  }

  // 먼저 루트 등록
  for (const q of all) {
    if (!q.parentId) {
      rootMap[q.id] = q;
      if (!childrenMap[q.id]) childrenMap[q.id] = [];
    }
  }
  // 자식들을 루트에 매핑 (다단계 지원)
  for (const q of all) {
    if (q.parentId) {
      const root = findRoot(q);
      const rootId = root.id;
      if (!rootMap[rootId]) { rootMap[rootId] = root; }
      if (!childrenMap[rootId]) childrenMap[rootId] = [];
      childrenMap[rootId].push(q);
      childToRoot[q.id] = rootId;
    }
  }
  // 자식들을 날짜순 정렬
  for (const rid of Object.keys(childrenMap)) {
    childrenMap[rid].sort((a, b) =>
      (a.createdAt || a.date || '').localeCompare(b.createdAt || b.date || '')
    );
  }
  _chainMapCache = { childrenMap, rootMap, childToRoot };
  return _chainMapCache;
}

function _getFilteredQuestions() {
  const all = state._myQuestions || [];
  const subjectFilter = state._myQuestionFilter || '전체';
  const sourceFilter = state._qbSourceFilter || null;
  const sortOrder = state._qbSortOrder || 'newest';

  // 체인 인식 필터링: 체인 내 하나라도 매치하면 전체 체인 표시
  const { childrenMap, childToRoot } = _buildChainMap();

  function matchesFilter(q) {
    if (subjectFilter !== '전체' && _getSubjectCategory(q.subject) !== subjectFilter) return false;
    if (sourceFilter) {
      const qSources = (q.source || '기타').split(',');
      if (!qSources.includes(sourceFilter)) return false;
    }
    return true;
  }

  // 루트 질문만 수집 (자식은 체인으로 표시)
  const roots = all.filter(q => !q.parentId);
  let filteredRoots = roots.filter(root => {
    // 루트 자체가 매치
    if (matchesFilter(root)) return true;
    // 자식 중 하나라도 매치
    const children = childrenMap[root.id] || [];
    return children.some(c => matchesFilter(c));
  });

  filteredRoots = [...filteredRoots].sort((a, b) => {
    const da = a.createdAt || a.date || '';
    const db_ = b.createdAt || b.date || '';
    return sortOrder === 'newest' ? db_.localeCompare(da) : da.localeCompare(db_);
  });

  return filteredRoots;
}

/* ──────────────────────────────────────
   렌더링 — 질문 입력 화면
   ────────────────────────────────────── */

function _renderQuestionInput() {
  const selectedSubject = state._qbInputSubject || null;
  const selectedSources = state._qbInputSources || [];
  const photo = state._qbInputPhoto || null;

  const subjectChips = SUBJECT_TAGS.map(t => {
    const isActive = selectedSubject === t.value;
    return `<button class="qbi-tag-chip ${isActive ? 'active' : ''}"
                    style="${isActive ? `background:${t.color};border-color:${t.color};color:#fff` : `border-color:${t.color}40;color:${t.color}`}"
                    onclick="_RM.toggleQbInputSubject('${t.value}')">${t.icon} ${t.value}</button>`;
  }).join('');

  const sourceChips = SOURCE_TAGS.map(s => {
    const isActive = selectedSources.includes(s.value);
    return `<button class="qbi-tag-chip ${isActive ? 'active' : ''}"
                    style="${isActive ? 'background:#7c6aef;border-color:#7c6aef;color:#fff' : 'border-color:rgba(255,255,255,0.15);color:#8b949e'}"
                    onclick="_RM.toggleQbInputSource('${s.value}')">${s.icon} ${s.value}</button>`;
  }).join('');

  return `
    <div class="full-screen animate-slide qbi-screen">
      <div class="screen-header" style="flex-shrink:0">
        <button class="back-btn" onclick="_RM.closeQuestionInput()"><i class="fas fa-arrow-left"></i></button>
        <h1>질문 작성</h1>
      </div>

      <div class="qbi-body">
        ${photo ? `
          <div class="qbi-photo-preview">
            <img src="${photo}" alt="첨부 사진">
            <button class="qbi-photo-remove" onclick="_RM.removeQbInputPhoto()"><i class="fas fa-times"></i></button>
          </div>
        ` : ''}

        <textarea id="qb-input-textarea" class="qbi-textarea" placeholder="궁금한 것을 자유롭게 적어보세요..." rows="5"></textarea>

        <div class="qbi-section">
          <div class="qbi-section-label">과목 <span style="color:#484f58;font-weight:400">(선택)</span></div>
          <div class="qbi-tag-wrap">${subjectChips}</div>
        </div>

        <div class="qbi-section">
          <div class="qbi-section-label">출처 <span style="color:#f59e0b;font-weight:400">* 필수 (중복 가능)</span></div>
          <div class="qbi-tag-wrap">${sourceChips}</div>
        </div>

        <div class="qbi-photo-actions">
          <button class="qbi-photo-btn" onclick="_RM.pickQbPhoto('camera')">
            <i class="fas fa-camera"></i> 카메라
          </button>
          <button class="qbi-photo-btn" onclick="_RM.pickQbPhoto('gallery')">
            <i class="fas fa-image"></i> 갤러리
          </button>
        </div>

        <button class="qbi-submit-btn" onclick="_RM.submitQuestion()">
          질문 등록하기  +3 XP
        </button>
      </div>
    </div>
  `;
}

/* ──────────────────────────────────────
   렌더링 — 사이드바
   ────────────────────────────────────── */

function _renderSidebar() {
  const all = state._myQuestions || [];
  const totalCount = all.length;
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const todayCount = all.filter(q => _getDateKey(q.createdAt || q.date) === todayStr).length;
  const activeSource = state._qbSourceFilter || null;

  return `
    <div class="qb-sidebar-stats">
      <div class="qb-sidebar-stat">
        <div class="qb-sidebar-stat-num">${totalCount}</div>
        <div class="qb-sidebar-stat-label">전체질문</div>
      </div>
      <div class="qb-sidebar-stat">
        <div class="qb-sidebar-stat-num">${todayCount}</div>
        <div class="qb-sidebar-stat-label">오늘질문</div>
      </div>
    </div>
    <div class="qb-sidebar-divider"></div>
    <div class="qb-sidebar-sources">
      ${SOURCE_TAGS.map(s => `
        <button class="qb-sidebar-source ${activeSource === s.value ? 'active' : ''}"
                onclick="_RM.setQbSourceFilter('${s.value}')">
          <span class="qb-sidebar-source-icon">${s.icon}</span>
          <span class="qb-sidebar-source-label">${s.value}</span>
        </button>
      `).join('')}
    </div>
  `;
}

/* ── 상단 헤더 ── */
function _renderHeader() {
  return `
    <div class="qb-header">
      <button class="qb-hamburger" onclick="_RM.toggleQbSidebar()">
        <i class="fas fa-bars"></i>
      </button>
      <h1 class="qb-header-title">나의 질문함</h1>
      <button class="qb-add-btn" onclick="_RM.openQuestionInput()">
        <i class="fas fa-plus" style="margin-right:4px"></i>질문하기
      </button>
    </div>
  `;
}

/* ── 과목 필터 칩 ── */
function _renderSubjectFilter() {
  const activeFilter = state._myQuestionFilter || '전체';
  const sortOrder = state._qbSortOrder || 'newest';

  const chips = ['전체', ...SUBJECT_TAGS.map(t => t.value)].map(f => {
    const tag = SUBJECT_TAGS.find(t => t.value === f);
    const color = tag ? tag.color : '#7c6aef';
    const isActive = f === activeFilter;
    return `<button class="qb-filter-chip ${isActive ? 'active' : ''}"
                    style="${isActive ? `background:${color};border-color:${color};color:#fff` : `border-color:${color}40;color:${color}`}"
                    onclick="_RM.setMyQuestionFilter('${f}')">${f}</button>`;
  }).join('');

  return `
    <div class="qb-filter-bar">
      <div class="qb-filter-chips">${chips}</div>
      <select class="qb-sort-select" onchange="_RM.setQbSortOrder(this.value)">
        <option value="newest" ${sortOrder === 'newest' ? 'selected' : ''}>최신순</option>
        <option value="oldest" ${sortOrder === 'oldest' ? 'selected' : ''}>오래된순</option>
      </select>
    </div>
  `;
}

/* ──────────────────────────────────────
   렌더링 — 카드 (축소/펼침)
   ────────────────────────────────────── */

function _renderCard(q, showChainBtn = false) {
  const isExpanded = state._expandedQuestionId === q.id;
  const isResolved = q.status === '답변완료';
  const subjectCat = _getSubjectCategory(q.subject);
  const color = _getSubjectColor(q.subject);
  const hasImage = !!q.imageKey;

  // 태그 칩: 과목 + 출처(복수)
  const subjectChip = `<span class="qb-tag-chip" style="background:${color}20;color:${color};border:1px solid ${color}40">#${subjectCat}</span>`;
  const sources = (q.source || '').split(',').filter(Boolean);
  const sourceChips = sources.map(s =>
    `<span class="qb-tag-chip" style="background:rgba(139,148,158,0.15);color:#8b949e;border:1px solid rgba(139,148,158,0.2)">#${s}</span>`
  ).join('');

  if (!isExpanded) {
    // 축소 상태
    return `
      <div class="qb-card ${isResolved ? 'qb-card--resolved' : ''}"
           data-qid="${q.id}"
           style="border-color:${isResolved ? '#f59e0b' : color}40"
           onclick="_RM.toggleQuestionExpand(${q.id})">
        <div class="qb-card-top">
          <div class="qb-card-tags">${subjectChip}${sourceChips}</div>
          <span class="qb-card-time">${_formatTimeAgo(q.createdAt || q.date)}</span>
        </div>
        ${hasImage ? `
          <div class="qb-card-img-wrap" onclick="event.stopPropagation();_RM.openPhotoViewer('${q.imageKey}')">
            <img class="qb-card-img" src="${q.imageKey}" alt="질문 사진" loading="lazy">
          </div>
        ` : ''}
        <div class="qb-card-text">${q.title || ''}</div>
        <div class="qb-card-bottom">
          ${showChainBtn ? `<button class="qb-chain-btn" onclick="event.stopPropagation();_RM.openChainInput(${q.id})" title="연결 질문">▶</button>` : ''}
          <button class="qb-resolve-btn ${isResolved ? 'resolved' : ''}"
                  onclick="event.stopPropagation();_RM.toggleQuestionResolved(${q.id},'${q.status}')">
            ${isResolved ? '✅ 해결완료' : '☐ 해결완료'}
          </button>
        </div>
      </div>
    `;
  }

  // 펼침 상태
  const detail = (state._qbDetailCache || {})[q.id];
  const answers = detail?.answers || [];
  const aiImproved = q.aiImproved || detail?.question?.ai_improved || null;
  const aiExpanded = (state._aiImproveExpanded || {})[q.id];

  return `
    <div class="qb-card qb-card--expanded ${isResolved ? 'qb-card--resolved' : ''}"
         data-qid="${q.id}"
         style="border-color:${isResolved ? '#f59e0b' : color}40">
      <div class="qb-card-top" onclick="_RM.toggleQuestionExpand(${q.id})" style="cursor:pointer">
        <div class="qb-card-tags">${subjectChip}${sourceChips}</div>
        <span class="qb-card-time">${_formatTimeAgo(q.createdAt || q.date)}</span>
      </div>

      ${hasImage ? `
        <div class="qb-card-img-wrap qb-card-img-wrap--full">
          <img class="qb-card-img" src="${q.imageKey}" alt="질문 사진">
          <button class="qb-photo-zoom-btn" onclick="event.stopPropagation();_RM.openPhotoViewer('${q.imageKey}')">🔍 확대</button>
        </div>
      ` : ''}

      <div class="qb-card-text-full">${q.title || ''}</div>

      ${_renderAnswerSection(q.id, answers, isResolved)}

      ${_renderAiSection(q, aiImproved, aiExpanded)}

      <div class="qb-card-bottom" style="margin-top:12px">
        ${showChainBtn ? `<button class="qb-chain-btn" onclick="event.stopPropagation();_RM.openChainInput(${q.id})" title="연결 질문">▶</button>` : ''}
        <button class="qb-resolve-btn ${isResolved ? 'resolved' : ''}"
                onclick="event.stopPropagation();_RM.toggleQuestionResolved(${q.id},'${q.status}')">
          ${isResolved ? '✅ 해결완료' : '☐ 해결완료'}
        </button>
      </div>
    </div>
  `;
}

/* ── 답변 영역 ── */
function _renderAnswerSection(qId, answers, isResolved) {
  const isEditing = state._qbAnswerEditing === qId;
  const editingAnswerId = state._qbEditingAnswerId;

  let html = `<div class="qb-answer-section">`;
  html += `<div class="qb-answer-divider"><span>나의 답변</span></div>`;

  const answerPhoto = state._qbAnswerPhoto || null;

  if (answers.length === 0 && !isEditing) {
    html += `
      <div class="qb-answer-empty">아직 답변이 없습니다</div>
      <button class="qb-answer-write-btn" onclick="event.stopPropagation();_RM.showAnswerInput(${qId})">
        <i class="fas fa-pen" style="margin-right:6px"></i>답변 작성하기
      </button>
    `;
  } else {
    // 기존 답변 표시
    for (const a of answers) {
      if (editingAnswerId === a.id && isEditing) {
        // 수정 모드
        html += `
          <div class="qb-answer-card qb-answer-card--editing">
            ${answerPhoto ? `
              <div class="qb-answer-photo-preview">
                <img src="${answerPhoto}" alt="답변 사진">
                <button class="qb-answer-photo-remove" onclick="event.stopPropagation();_RM.removeAnswerPhoto()"><i class="fas fa-times"></i></button>
              </div>
            ` : ''}
            <textarea id="qb-answer-textarea" class="qb-answer-textarea" rows="3">${a.content || ''}</textarea>
            <div class="qb-answer-photo-actions">
              <button class="qb-answer-photo-btn" onclick="event.stopPropagation();_RM.pickAnswerPhoto('camera')"><i class="fas fa-camera"></i></button>
              <button class="qb-answer-photo-btn" onclick="event.stopPropagation();_RM.pickAnswerPhoto('gallery')"><i class="fas fa-image"></i></button>
            </div>
            <div class="qb-answer-actions">
              <button class="qb-answer-cancel" onclick="event.stopPropagation();_RM.cancelAnswer()">취소</button>
              <button class="qb-answer-save" onclick="event.stopPropagation();_RM.updateAnswer(${qId},${a.id})">수정 저장</button>
            </div>
          </div>
        `;
      } else {
        // content를 안전하게 HTML attribute에 넣기 위해 인코딩
        const safeContent = (a.content || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;');
        const safeImageKey = (a.image_key || '').replace(/&/g,'&amp;').replace(/"/g,'&quot;');
        html += `
          <div class="qb-answer-card">
            ${a.image_key ? `
              <div class="qb-answer-img-wrap" onclick="event.stopPropagation();_RM.openPhotoViewer('${a.image_key}')">
                <img class="qb-answer-img" src="${a.image_key}" alt="답변 사진" loading="lazy">
              </div>
            ` : ''}
            <div class="qb-answer-content">${(a.content || '').replace(/\n/g, '<br>')}</div>
            <div class="qb-answer-meta">
              <span>${_formatTimeAgo(a.created_at)}</span>
              <div class="qb-answer-btns">
                <button data-content="${safeContent}" data-imgkey="${safeImageKey}" onclick="event.stopPropagation();_RM.editAnswer(${qId},${a.id},this.dataset.content,this.dataset.imgkey)" class="qb-answer-edit-btn">수정</button>
                <button onclick="event.stopPropagation();_RM.deleteAnswer(${qId},${a.id})" class="qb-answer-delete-btn">삭제</button>
              </div>
            </div>
          </div>
        `;
      }
    }

    // 새 답변 입력
    if (isEditing && !editingAnswerId) {
      html += `
        <div class="qb-answer-card qb-answer-card--editing">
          ${answerPhoto ? `
            <div class="qb-answer-photo-preview">
              <img src="${answerPhoto}" alt="답변 사진">
              <button class="qb-answer-photo-remove" onclick="event.stopPropagation();_RM.removeAnswerPhoto()"><i class="fas fa-times"></i></button>
            </div>
          ` : ''}
          <textarea id="qb-answer-textarea" class="qb-answer-textarea" placeholder="답변을 적어보세요..." rows="3"></textarea>
          <div class="qb-answer-photo-actions">
            <button class="qb-answer-photo-btn" onclick="event.stopPropagation();_RM.pickAnswerPhoto('camera')"><i class="fas fa-camera"></i></button>
            <button class="qb-answer-photo-btn" onclick="event.stopPropagation();_RM.pickAnswerPhoto('gallery')"><i class="fas fa-image"></i></button>
          </div>
          <div class="qb-answer-actions">
            <button class="qb-answer-cancel" onclick="event.stopPropagation();_RM.cancelAnswer()">취소</button>
            <button class="qb-answer-save" onclick="event.stopPropagation();_RM.submitAnswer(${qId})">답변 저장</button>
          </div>
        </div>
      `;
    } else if (!isEditing && answers.length > 0) {
      html += `
        <button class="qb-answer-write-btn qb-answer-write-btn--small" onclick="event.stopPropagation();_RM.showAnswerInput(${qId})">
          <i class="fas fa-plus" style="margin-right:4px"></i>답변 추가
        </button>
      `;
    }
  }

  html += `</div>`;
  return html;
}

/* ── AI 추천 질문 영역 ── */
function _renderAiSection(q, aiImproved, aiExpanded) {
  return `
    <div class="qb-ai-section">
      <button class="qb-ai-toggle" onclick="event.stopPropagation();_RM.toggleAiImprove(${q.id})">
        ✨ AI 추천 질문 보기 ${aiExpanded ? '▲' : '▼'}
      </button>
      ${aiExpanded ? `
        <div class="qb-ai-content">
          ${aiImproved
            ? `<div class="qb-ai-improved">${aiImproved}</div>`
            : `<div class="qb-ai-loading"><div class="rpt-btn-spinner" style="width:20px;height:20px;margin-right:8px"></div>AI가 질문을 고도화하고 있어요...</div>`
          }
        </div>
      ` : ''}
    </div>
  `;
}

/* ── 체인 렌더링 ── */
function _renderChain(root) {
  const { childrenMap } = _buildChainMap();
  const children = childrenMap[root.id] || [];

  if (children.length === 0 && state._chainInputParentId !== root.id) {
    // 단독 질문 (입력 중 아님) — 기존 카드 + [▶] 버튼
    return _renderCard(root, true);
  }

  // 체인 존재
  const allInChain = [root, ...children];
  const allResolved = allInChain.every(q => q.status === '답변완료');
  const isExpanded = (state._chainExpandedIds || {})[root.id];
  const showCount = isExpanded ? children.length : Math.min(children.length, 2);
  const visibleChildren = children.slice(0, showCount);
  const hiddenCount = children.length - showCount;

  let html = `<div class="qb-chain ${allResolved ? 'qb-chain--all-resolved' : ''}">`;

  // 루트 카드
  html += _renderCard(root, true);

  // 자식 카드들 (화살표 + 카드)
  for (const child of visibleChildren) {
    html += `<div class="qb-chain__arrow">▶</div>`;
    html += _renderCard(child, true);
  }

  // 더보기 카드
  if (hiddenCount > 0) {
    html += `<div class="qb-chain__arrow">▶</div>`;
    html += `
      <button class="qb-chain__more" onclick="event.stopPropagation();_RM.expandChain(${root.id})">
        <span class="qb-chain__more-num">+${hiddenCount}</span>
        <span class="qb-chain__more-label">더보기</span>
      </button>
    `;
  }

  // 체인 입력 (이 체인 내 아무 카드에서 [▶] 클릭 시)
  const chainIds = [root.id, ...children.map(c => c.id)];
  if (chainIds.includes(state._chainInputParentId)) {
    html += `<div class="qb-chain__arrow">▶</div>`;
    html += `
      <div class="qb-chain__input-card">
        <textarea id="qb-chain-input" class="qb-chain__textarea" placeholder="연결 질문을 적어보세요..." rows="2"></textarea>
        <div class="qb-chain__input-actions">
          <button class="qb-chain__input-cancel" onclick="event.stopPropagation();_RM.cancelChainInput()">취소</button>
          <button class="qb-chain__input-submit" onclick="event.stopPropagation();_RM.submitChainQuestion(${state._chainInputParentId})">등록</button>
        </div>
      </div>
    `;
  }

  html += `</div>`;
  return html;
}

/* ── 날짜별 그룹 렌더링 ── */
function _renderCardList(questions) {
  if (questions.length === 0) {
    const sourceFilter = state._qbSourceFilter;
    const subjectFilter = state._myQuestionFilter || '전체';
    const hasFilter = subjectFilter !== '전체' || !!sourceFilter;

    return `
      <div class="qb-empty">
        <div class="qb-empty-icon">💬</div>
        <p class="qb-empty-title">${hasFilter ? '조건에 맞는 질문이 없습니다' : '아직 질문이 없습니다'}</p>
        <p class="qb-empty-desc">${hasFilter ? '다른 필터를 선택해보세요' : '+ 질문하기 버튼으로 첫 질문을 등록해보세요'}</p>
      </div>
    `;
  }

  const groups = _groupByDate(questions);

  return groups.map(([dateKey, items]) => `
    <div class="qb-date-group">
      <div class="qb-date-divider">
        <span class="qb-date-label">${_formatDateLabel(dateKey)}</span>
        <span class="qb-date-line"></span>
      </div>
      <div class="qb-card-list">
        ${items.map(q => _renderChain(q)).join('')}
      </div>
    </div>
  `).join('');
}

/* ── 메인 렌더 ── */
export function renderRecordQuestion() {
  // 질문 입력 화면
  if (state._qbInputMode) {
    return _renderQuestionInput();
  }

  // 목록 뷰 (카드 펼침 포함)
  const sidebarOpen = !!state._qbSidebarOpen;
  const questions = _getFilteredQuestions();

  return `
    <div class="full-screen animate-slide qb-layout">
      <div class="qb-sidebar ${sidebarOpen ? 'open' : ''}">
        ${_renderSidebar()}
      </div>
      <div class="qb-main">
        ${_renderHeader()}
        ${_renderSubjectFilter()}
        <div class="qb-scroll-area">
          ${_renderCardList(questions)}
        </div>
      </div>
    </div>
  `;
}
