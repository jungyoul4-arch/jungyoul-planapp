/* ================================================================
   Records Module — views/teach-record.js
   가르침 기록 (교학상장)
   ================================================================ */

import { state } from '../core/state.js';
import { DB } from '../core/api.js';
import { events, EVENTS } from '../core/events.js';
import { navigate } from '../core/router.js';

export function registerHandlers(RM) {
  RM.saveTeachRecord = () => saveTeachRecordFromForm();
}

function saveTeachRecordFromForm() {
  const subject = document.getElementById('rm-teach-subject')?.value || state._teachSubject || '수학';
  const topic = document.getElementById('rm-teach-topic')?.value?.trim() || '';
  const taughtTo = document.getElementById('rm-teach-to')?.value?.trim() || '';
  const content = document.getElementById('rm-teach-content')?.value?.trim() || '';
  const reflection = document.getElementById('rm-teach-reflection')?.value?.trim() || '';
  const timeChips = document.querySelectorAll('.teach-time-chip.active');
  const timeSpent = timeChips.length > 0 ? timeChips[0].dataset.time : '10분';

  if (!content) {
    const el = document.getElementById('rm-teach-content');
    if (el) {
      el.focus();
      el.style.borderColor = 'var(--accent)';
      setTimeout(() => { el.style.borderColor = ''; }, 2000);
    }
    return;
  }

  if (state.studentId) {
    DB.saveTeachRecord({
      subject, topic, taughtTo, content,
      reflection, timeSpent,
    });
  }

  state.missions[2].current = 1;
  state.missions[2].done = true;

  events.emit(EVENTS.XP_EARNED, { amount: 30, label: '교학상장 완료!' });
  navigate('dashboard');
}

export function renderRecordTeach() {
  const subjects = ['국어', '수학', '영어', '과학', '기타'];
  const classmates = state.classmates || [];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>🤝 교학상장</h1>
      </div>
      <div class="form-body">
        <div class="card" style="margin-bottom:16px;background:linear-gradient(135deg,rgba(0,184,148,0.08),rgba(0,206,201,0.04));border-color:rgba(0,184,148,0.2)">
          <div style="text-align:center">
            <div style="font-size:28px;margin-bottom:4px">🤝</div>
            <div style="font-size:15px;font-weight:700;color:var(--teach-green)">교학상장 — 가르치며 함께 성장</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">친구에게 가르친 경험을 기록해보세요!</div>
          </div>
        </div>

        <!-- 누구에게 -->
        <div class="field-group">
          <label class="field-label">👤 누구에게 가르쳤나요?</label>
          <input class="input-field" id="rm-teach-to" placeholder="예: 김민수" list="rm-teach-classmates">
          ${classmates.length > 0 ? `
          <datalist id="rm-teach-classmates">
            ${classmates.map(c => `<option value="${c.name}">`).join('')}
          </datalist>` : ''}
        </div>

        <!-- 과목 -->
        <div class="field-group">
          <label class="field-label">📚 과목</label>
          <div class="chip-row">
            ${subjects.map((s, i) => `<button class="chip ${i === 1 ? 'active' : ''}" onclick="document.querySelectorAll('.chip').forEach(c=>c.classList.remove('active'));this.classList.add('active');document.getElementById('rm-teach-subject').value='${s}'">${s}</button>`).join('')}
          </div>
          <input type="hidden" id="rm-teach-subject" value="수학">
        </div>

        <!-- 단원/주제 -->
        <div class="field-group">
          <label class="field-label">📖 단원/주제</label>
          <input class="input-field" id="rm-teach-topic" placeholder="예: 이차함수의 최대·최소">
        </div>

        <!-- 가르친 내용 -->
        <div class="field-group">
          <label class="field-label">📝 어떻게 가르쳤나요? <span style="color:var(--accent)">*필수</span></label>
          <textarea class="input-field" id="rm-teach-content" rows="3" placeholder="예: 이차함수의 꼭짓점 공식을 알려주고, 직접 문제를 풀어보게 했어요"></textarea>
        </div>

        <!-- 소요 시간 -->
        <div class="field-group">
          <label class="field-label">⏱️ 소요 시간</label>
          <div class="chip-row">
            ${['5분', '10분', '15분', '20분', '30분+'].map((t, i) => `<button class="chip teach-time-chip ${i === 1 ? 'active' : ''}" data-time="${t}" onclick="document.querySelectorAll('.teach-time-chip').forEach(c=>c.classList.remove('active'));this.classList.add('active')">${t}</button>`).join('')}
          </div>
        </div>

        <!-- 깨달은 점 -->
        <div class="field-group">
          <label class="field-label">💎 가르치면서 새로 깨달은 점 <span style="color:var(--text-muted)">(세특 보석!)</span></label>
          <textarea class="input-field" id="rm-teach-reflection" rows="2" placeholder="예: 설명하다 보니 제가 헷갈리던 부분이 정리됐어요"></textarea>
        </div>

        <button class="btn-primary btn-glow" onclick="_RM.saveTeachRecord()" style="width:100%;margin-top:16px">
          🤝 교학상장 기록 완료 +30 XP ✨
        </button>
      </div>
    </div>
  `;
}
