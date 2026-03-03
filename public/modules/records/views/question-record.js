/* ================================================================
   Records Module — views/question-record.js
   질문 코칭 (9단계 소크라틱)
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { events, EVENTS } from '../core/events.js';
import { navigate } from '../core/router.js';

const questionLevels = {
  curiosity: [
    { id: 'A-1', label: '뭐지?', name: '사실·정의 확인', xp: 8, desc: '정해진 공식·정의를 확인하는 질문', icon: '👀', group: 'A' },
    { id: 'A-2', label: '어떻게?', name: '절차·방법 확인', xp: 10, desc: '풀이 방법이나 순서를 묻는 질문', icon: '🔧', group: 'A' },
    { id: 'B-1', label: '왜?', name: '이유·원리 탐구', xp: 15, desc: '개념의 의미와 원리를 깊이 이해하려는 질문', icon: '💡', group: 'B' },
    { id: 'B-2', label: '만약에?', name: '가능성 탐색', xp: 20, desc: '조건을 변경하고 결과를 예측하는 전략적 사고', icon: '🔀', group: 'B' },
    { id: 'C-1', label: '연결하면?', name: '융합·연결', xp: 30, desc: '서로 다른 개념을 연결하여 새로운 통찰을 만드는 질문', icon: '🔗', group: 'C' },
  ],
  reflection: [
    { id: 'A-3', label: '맞나?', name: '확인·검증', xp: 8, desc: '내 풀이나 이해가 맞는지 확인하려는 질문', icon: '✅', group: 'A' },
    { id: 'B-3', label: '왜 틀렸지?', name: '오류 분석', xp: 15, desc: '틀린 이유를 분석하고 패턴을 찾는 질문', icon: '🔍', group: 'B' },
    { id: 'B-4', label: '다르게?', name: '대안 탐색', xp: 20, desc: '다른 풀이법이나 관점을 탐색하는 질문', icon: '🔄', group: 'B' },
    { id: 'C-2', label: '만들어볼까?', name: '창작·설계', xp: 30, desc: '배운 내용으로 새로운 문제를 만들거나 설계하는 질문', icon: '🎨', group: 'C' },
  ],
};

export function registerHandlers(RM) {
  RM.selectQuestionSubject = (sub) => { state._questionSubject = sub; RM.render(); };
  RM.analyzeQuestion = () => analyzeQuestion();
  RM.saveQuestionToDB = (type) => saveQuestionToDB(type);
  RM.handleQuestionImageUpload = (input) => handleQuestionImageUpload(input);
}

function handleQuestionImageUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    state._questionImageData = e.target.result;
    navigate('record-question', { replace: true });
  };
  reader.readAsDataURL(input.files[0]);
  input.value = '';
}

async function analyzeQuestion() {
  const questionText = document.getElementById('rm-question-input')?.value?.trim();
  if (!questionText && !state._questionImageData) return;
  state._questionText = questionText || '';
  state._isAnalyzing = true;
  navigate('record-question', { replace: true });

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject: state._questionSubject || '수학',
        questionText: state._questionText,
        imageData: state._questionImageData,
      })
    });
    if (res.ok) {
      const data = await res.json();
      state._diagResult = data;
    } else {
      state._diagResult = { level: 'A-1', levelName: '사실·정의 확인', xp: 8, coaching: '질문을 분석할 수 없었습니다.' };
    }
  } catch (e) {
    console.error('analyzeQuestion:', e);
    state._diagResult = { level: 'A-1', levelName: '사실·정의 확인', xp: 8, coaching: '네트워크 오류가 발생했습니다.' };
  }

  state._isAnalyzing = false;
  navigate('record-question', { replace: true });
}

function saveQuestionToDB(saveType) {
  if (!state.studentId) return;
  const subj = state._questionSubject || '수학';
  const questionText = state._questionText || '';
  const diagResult = state._diagResult || {};
  const challengeResult = state._challengeResult || {};
  const coachMessages = state._coachMessages || [];

  const level = challengeResult.level || diagResult.level || '';
  const label = challengeResult.levelName || diagResult.levelName || '';
  const axis = diagResult.axis || 'curiosity';
  const xp = saveType === 'coaching-complete' ? 30 : (challengeResult.xp || diagResult.xp || 15);

  DB.saveQuestionRecord({
    subject: subj, questionText, questionLevel: level,
    questionLabel: label, axis, coachingMessages: coachMessages,
    xpEarned: xp, isComplete: saveType === 'coaching-complete',
  });

  events.emit(EVENTS.XP_EARNED, { amount: xp, label: '질문 코칭 완료!' });

  // 상태 초기화
  state._questionText = '';
  state._questionImageData = null;
  state._diagResult = null;
  state._challengeResult = null;
  state._coachMessages = [];
  state._isAnalyzing = false;
  state._isChallengeMode = false;
  state._isSocratesMode = false;

  navigate('dashboard');
}

export function renderRecordQuestion() {
  const subject = state._questionSubject || '수학';
  const subjects = ['국어', '수학', '영어', '과학', '한국사'];
  const isAnalyzing = state._isAnalyzing;
  const diagResult = state._diagResult;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>❓ 질문 코칭</h1>
      </div>
      <div class="form-body">
        <!-- 과목 선택 -->
        <div class="field-group">
          <label class="field-label">📚 과목</label>
          <div class="chip-row">
            ${subjects.map(s => `<button class="chip ${s === subject ? 'active' : ''}" onclick="_RM.selectQuestionSubject('${s}')">${s}</button>`).join('')}
          </div>
        </div>

        <!-- 질문 입력 -->
        <div class="field-group">
          <label class="field-label">💬 질문 내용 <span style="color:var(--accent)">*</span></label>
          <textarea class="input-field" id="rm-question-input" rows="4" placeholder="궁금한 것을 자유롭게 적어보세요...">${state._questionText || ''}</textarea>
        </div>

        <!-- 이미지 첨부 -->
        <div class="field-group">
          <label class="field-label">📸 문제 사진 <span style="color:var(--text-muted)">(선택)</span></label>
          ${state._questionImageData ? `
            <div style="position:relative;display:inline-block;margin-bottom:8px">
              <img src="${state._questionImageData}" style="max-width:200px;border-radius:8px;border:1px solid var(--border)">
              <button onclick="state._questionImageData=null;_RM.render()" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:12px;cursor:pointer">&times;</button>
            </div>
          ` : `
            <label style="display:flex;align-items:center;gap:8px;padding:12px;border:2px dashed var(--border);border-radius:10px;cursor:pointer;color:var(--text-muted)">
              <i class="fas fa-camera" style="font-size:18px"></i>
              <span style="font-size:13px">문제 사진 첨부하기</span>
              <input type="file" accept="image/*" style="display:none" onchange="_RM.handleQuestionImageUpload(this)">
            </label>
          `}
        </div>

        ${isAnalyzing ? `
        <div style="text-align:center;padding:30px 0">
          <div class="rpt-btn-spinner" style="width:32px;height:32px;margin:0 auto 12px"></div>
          <p style="color:var(--text-muted);font-size:14px">질문을 분석하고 있어요...</p>
        </div>
        ` : diagResult ? `
        <!-- 분석 결과 -->
        <div class="rpt-diag-badge" style="background:rgba(108,92,231,0.08)">
          <div class="rpt-diag-top">
            <span style="font-size:20px">${diagResult.level || 'A-1'}</span>
            <div>
              <div style="font-size:15px;font-weight:800;color:var(--text-primary)">${diagResult.levelName || '사실·정의 확인'}</div>
              <div style="font-size:12px;color:var(--xp-gold);font-weight:700">+${diagResult.xp || 8} XP</div>
            </div>
          </div>
          ${diagResult.coaching ? `
          <div class="rpt-diag-coaching" style="margin-top:8px">${diagResult.coaching}</div>
          ` : ''}
        </div>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn-primary" style="flex:1" onclick="_RM.saveQuestionToDB('initial')">
            기록 저장 +${diagResult.xp || 8} XP
          </button>
        </div>
        ` : `
        <button class="btn-primary btn-glow" onclick="_RM.analyzeQuestion()" style="width:100%;margin-top:8px">
          🔍 질문 분석하기
        </button>
        `}

        <!-- 2축 9단계 분류표 -->
        <details style="margin-top:24px">
          <summary style="font-size:13px;font-weight:600;color:var(--text-secondary);cursor:pointer;padding:8px 0">
            📋 2축 9단계 질문 분류표 보기
          </summary>
          <div style="margin-top:8px">
            <div style="font-size:12px;font-weight:700;color:var(--primary-light);margin-bottom:6px">🔍 호기심 축 (Curiosity)</div>
            ${questionLevels.curiosity.map(q => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <span style="font-size:16px">${q.icon}</span>
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${q.id} ${q.label} — ${q.name}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${q.desc}</div>
                </div>
                <span style="font-size:11px;color:var(--xp-gold);font-weight:600">+${q.xp}</span>
              </div>
            `).join('')}
            <div style="font-size:12px;font-weight:700;color:#00B894;margin:12px 0 6px">🪞 성찰 축 (Reflection)</div>
            ${questionLevels.reflection.map(q => `
              <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.04)">
                <span style="font-size:16px">${q.icon}</span>
                <div style="flex:1">
                  <div style="font-size:12px;font-weight:700;color:var(--text-primary)">${q.id} ${q.label} — ${q.name}</div>
                  <div style="font-size:11px;color:var(--text-muted)">${q.desc}</div>
                </div>
                <span style="font-size:11px;color:var(--xp-gold);font-weight:600">+${q.xp}</span>
              </div>
            `).join('')}
          </div>
        </details>
      </div>
    </div>
  `;
}
