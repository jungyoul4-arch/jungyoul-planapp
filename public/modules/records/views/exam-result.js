/* ================================================================
   Records Module — views/exam-result.js
   시험 결과 입력 + 오답 관리
   ================================================================ */

import { state } from '../core/state.js';
import { navigate, render } from '../core/router.js';
import { kstToday } from '../core/utils.js';

function collectExamResultData() {
  const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
  if (!ex) return null;

  const r = ex.result || {};
  const subjResults = r.subjects || (ex.subjects||[]).map(s => ({
    subject: s.subject, score: '', grade: '', avg: '', color: s.color, wrongAnswers: []
  }));

  subjResults.forEach(sr => {
    (sr.wrongAnswers || []).forEach(w => { if (!w.images) w.images = []; });
  });

  document.querySelectorAll('.exam-subj-score').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    if (subjResults[idx]) subjResults[idx].score = el.value ? parseInt(el.value) : '';
  });
  document.querySelectorAll('.exam-subj-grade').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    if (subjResults[idx]) subjResults[idx].grade = el.value ? parseInt(el.value) : '';
  });
  document.querySelectorAll('.exam-subj-avg').forEach(el => {
    const idx = parseInt(el.dataset.idx);
    if (subjResults[idx]) subjResults[idx].avg = el.value ? parseInt(el.value) : '';
  });

  document.querySelectorAll('.wa-number').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si]?.wrongAnswers?.[wi]) subjResults[si].wrongAnswers[wi].number = el.value ? parseInt(el.value) : '';
  });
  document.querySelectorAll('.wa-topic').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si]?.wrongAnswers?.[wi]) subjResults[si].wrongAnswers[wi].topic = el.value;
  });
  document.querySelectorAll('.wa-my').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si]?.wrongAnswers?.[wi]) subjResults[si].wrongAnswers[wi].myAnswer = el.value;
  });
  document.querySelectorAll('.wa-correct').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si]?.wrongAnswers?.[wi]) subjResults[si].wrongAnswers[wi].correctAnswer = el.value;
  });
  document.querySelectorAll('.wa-reason').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si]?.wrongAnswers?.[wi]) subjResults[si].wrongAnswers[wi].reason = el.value;
  });
  document.querySelectorAll('.wa-reflection').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si]?.wrongAnswers?.[wi]) subjResults[si].wrongAnswers[wi].reflection = el.value;
  });

  return subjResults;
}

export function registerHandlers(RM) {
  RM.addWrongAnswer = (subjIdx) => {
    const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
    if (!ex) return;
    const collected = collectExamResultData();
    if (collected) {
      if (!ex.result) ex.result = { totalScore:'', grade:'', subjects: collected, overallReflection:'' };
      else ex.result.subjects = collected;
    }
    const ts = document.getElementById('exam-total-score')?.value;
    const tg = document.getElementById('exam-total-grade')?.value;
    const ref = document.getElementById('exam-overall-reflection')?.value;
    if (ex.result) {
      if (ts) ex.result.totalScore = parseInt(ts);
      if (tg) ex.result.grade = parseInt(tg);
      if (ref !== undefined) ex.result.overallReflection = ref;
    }

    if (!ex.result) ex.result = { totalScore:'', grade:'', subjects: (ex.subjects||[]).map(s => ({subject:s.subject,score:'',grade:'',avg:'',color:s.color,wrongAnswers:[]})), overallReflection:'' };
    if (!ex.result.subjects[subjIdx].wrongAnswers) ex.result.subjects[subjIdx].wrongAnswers = [];
    ex.result.subjects[subjIdx].wrongAnswers.push({ number:'', topic:'', type:'', myAnswer:'', correctAnswer:'', reason:'', reflection:'', images:[] });
    render();
  };

  RM.removeWrongAnswer = (subjIdx, waIdx) => {
    const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
    if (!ex || !ex.result) return;
    const collected = collectExamResultData();
    if (collected) ex.result.subjects = collected;
    ex.result.subjects[subjIdx].wrongAnswers.splice(waIdx, 1);
    render();
  };

  RM.setWrongAnswerType = (subjIdx, waIdx, type) => {
    const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
    if (!ex || !ex.result) return;
    const collected = collectExamResultData();
    if (collected) ex.result.subjects = collected;
    ex.result.subjects[subjIdx].wrongAnswers[waIdx].type = type;
    render();
  };

  RM.handleWrongAnswerImage = (event, subjIdx, waIdx) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
    if (!ex || !ex.result) return;
    const collected = collectExamResultData();
    if (collected) ex.result.subjects = collected;
    const wa = ex.result.subjects[subjIdx]?.wrongAnswers[waIdx];
    if (!wa) return;
    if (!wa.images) wa.images = [];
    const remaining = 5 - wa.images.length;
    if (remaining <= 0) { alert('사진은 최대 5장까지 첨부할 수 있습니다.'); return; }
    const filesToProcess = Array.from(files).slice(0, remaining);
    let processedCount = 0;
    filesToProcess.forEach(file => {
      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 800;
          let w = img.width, h = img.height;
          if (w > MAX_SIZE || h > MAX_SIZE) {
            if (w > h) { h = Math.round(h * MAX_SIZE / w); w = MAX_SIZE; }
            else { w = Math.round(w * MAX_SIZE / h); h = MAX_SIZE; }
          }
          canvas.width = w; canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);
          wa.images.push(canvas.toDataURL('image/jpeg', 0.8));
          processedCount++;
          if (processedCount === filesToProcess.length) render();
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  RM.removeWrongAnswerImage = (subjIdx, waIdx, imgIdx) => {
    const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
    if (!ex || !ex.result) return;
    const collected = collectExamResultData();
    if (collected) ex.result.subjects = collected;
    const wa = ex.result.subjects[subjIdx]?.wrongAnswers[waIdx];
    if (!wa || !wa.images) return;
    wa.images.splice(imgIdx, 1);
    render();
  };

  RM.saveExamResult = () => {
    const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
    if (!ex) return;
    const collected = collectExamResultData();
    const totalScore = document.getElementById('exam-total-score')?.value;
    const totalGrade = document.getElementById('exam-total-grade')?.value;
    const reflection = document.getElementById('exam-overall-reflection')?.value || '';
    if (!totalScore) { alert('총점을 입력해주세요'); return; }

    ex.result = {
      totalScore: parseInt(totalScore),
      grade: totalGrade ? parseInt(totalGrade) : '',
      subjects: collected || [],
      overallReflection: reflection,
      createdAt: kstToday(),
    };
    ex.status = 'completed';

    if (ex._dbId && RM.DB.studentId()) {
      RM.DB.saveExamResult(ex._dbId, ex.result);
      RM.DB.updateExam(ex._dbId, { status: 'completed' });
    }

    alert('시험 결과가 저장되었습니다! 📊');
    navigate('exam-report');
  };
}

export function renderExamResultInput() {
  const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
  if (!ex) return '<div class="full-screen"><p style="padding:40px;text-align:center;color:var(--text-muted)">시험을 찾을 수 없습니다</p></div>';

  const r = ex.result || {};
  const subjResults = r.subjects || (ex.subjects||[]).map(s => ({
    subject: s.subject, score: '', grade: '', avg: '', color: s.color, wrongAnswers: []
  }));

  const activeSubj = state._examResultActiveSubj || 0;
  const sr = subjResults[activeSubj] || subjResults[0];
  if (!sr) return '<div class="full-screen"><p style="padding:40px;text-align:center;color:var(--text-muted)">과목 데이터가 없습니다</p></div>';

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('exam-detail')"><i class="fas fa-arrow-left"></i></button>
        <h1>📝 결과 입력</h1>
        <button class="header-action-btn" onclick="_RM.saveExamResult()" title="저장" style="color:var(--primary-light)"><i class="fas fa-save"></i></button>
      </div>
      <div class="form-body">

        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:12px">${ex.name}</div>

        <div style="display:flex;gap:8px;margin-bottom:16px">
          <div style="flex:1">
            <label class="field-label">총점 (100점 환산)</label>
            <input class="input-field" type="number" id="exam-total-score" placeholder="82" value="${r.totalScore || ''}" min="0" max="100" style="text-align:center;font-size:18px;font-weight:700">
          </div>
          <div style="flex:1">
            <label class="field-label">전체 등급</label>
            <select class="input-field" id="exam-total-grade" style="text-align:center;font-size:18px;font-weight:700">
              <option value="">-</option>
              ${[1,2,3,4,5,6,7,8,9].map(g => `<option value="${g}" ${r.grade==g?'selected':''}>${g}등급</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="chip-row" style="margin-bottom:12px;flex-wrap:wrap">
          ${subjResults.map((s,i) => `
            <button class="chip ${i===activeSubj?'active':''}" onclick="_RM.state._examResultActiveSubj=${i};_RM.render()" style="${i===activeSubj?'background:'+s.color+';border-color:'+s.color:''}">
              ${s.subject} ${s.score ? ' ✅' : ''}
            </button>
          `).join('')}
        </div>

        <div class="card" style="border-left:3px solid ${sr.color || 'var(--primary-light)'}">
          <div style="font-size:15px;font-weight:700;color:var(--text-primary);margin-bottom:12px">${sr.subject}</div>

          <div style="display:flex;gap:8px;margin-bottom:12px">
            <div style="flex:1">
              <label class="field-label">점수</label>
              <input class="input-field exam-subj-score" type="number" data-idx="${activeSubj}" placeholder="78" value="${sr.score || ''}" min="0" max="100">
            </div>
            <div style="flex:1">
              <label class="field-label">등급</label>
              <select class="input-field exam-subj-grade" data-idx="${activeSubj}">
                <option value="">-</option>
                ${[1,2,3,4,5,6,7,8,9].map(g => `<option value="${g}" ${sr.grade==g?'selected':''}>${g}등급</option>`).join('')}
              </select>
            </div>
            <div style="flex:1">
              <label class="field-label">평균</label>
              <input class="input-field exam-subj-avg" type="number" data-idx="${activeSubj}" placeholder="65" value="${sr.avg || ''}" min="0" max="100">
            </div>
          </div>

          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:13px;font-weight:700;color:var(--text-primary)">❌ 오답 분석</span>
            <button class="card-link" onclick="_RM.addWrongAnswer(${activeSubj})">+ 오답 추가</button>
          </div>

          ${(sr.wrongAnswers || []).length === 0 ? `
            <div style="text-align:center;padding:16px;background:var(--bg-input);border-radius:12px">
              <p style="color:var(--text-muted);font-size:12px">틀린 문항을 추가하여 오답 분석을 시작하세요</p>
              <button class="btn-secondary" style="margin-top:8px;font-size:12px" onclick="_RM.addWrongAnswer(${activeSubj})">
                <i class="fas fa-plus" style="margin-right:4px"></i>오답 추가
              </button>
            </div>
          ` : `
            ${(sr.wrongAnswers || []).map((w,wi) => `
              <div style="background:var(--bg-input);border-radius:12px;padding:12px;margin-bottom:8px;position:relative">
                <button style="position:absolute;top:6px;right:8px;background:none;border:none;color:#FF6B6B;font-size:14px;cursor:pointer" onclick="_RM.removeWrongAnswer(${activeSubj},${wi})"><i class="fas fa-times"></i></button>

                <div style="display:flex;gap:6px;margin-bottom:8px">
                  <div style="flex:0.5">
                    <label style="font-size:10px;color:var(--text-muted)">문항</label>
                    <input class="input-field wa-number" data-subj="${activeSubj}" data-wi="${wi}" type="number" placeholder="15" value="${w.number || ''}" style="font-size:13px;padding:6px 8px">
                  </div>
                  <div style="flex:1">
                    <label style="font-size:10px;color:var(--text-muted)">관련 단원</label>
                    <input class="input-field wa-topic" data-subj="${activeSubj}" data-wi="${wi}" placeholder="치환적분" value="${w.topic || ''}" style="font-size:13px;padding:6px 8px">
                  </div>
                </div>

                <div style="margin-bottom:8px">
                  <label style="font-size:10px;color:var(--text-muted)">오답 유형</label>
                  <div style="display:flex;gap:4px;flex-wrap:wrap;margin-top:4px">
                    ${[{k:'concept',l:'📘 개념부족',c:'#6C5CE7'},{k:'careless',l:'⚡ 실수',c:'#FF9F43'},{k:'interpretation',l:'🔍 해석오류',c:'#FF6B6B'},{k:'time',l:'⏱️ 시간부족',c:'#74B9FF'}].map(t => `
                      <button class="chip wa-type-btn ${w.type===t.k?'active':''}" onclick="_RM.setWrongAnswerType(${activeSubj},${wi},'${t.k}')" style="font-size:10px;padding:4px 8px;${w.type===t.k?'background:'+t.c+';border-color:'+t.c:''}">
                        ${t.l}
                      </button>
                    `).join('')}
                  </div>
                </div>

                <div style="display:flex;gap:6px;margin-bottom:8px">
                  <div style="flex:1">
                    <label style="font-size:10px;color:var(--text-muted)">내 답</label>
                    <input class="input-field wa-my" data-subj="${activeSubj}" data-wi="${wi}" placeholder="③" value="${w.myAnswer || ''}" style="font-size:13px;padding:6px 8px">
                  </div>
                  <div style="flex:1">
                    <label style="font-size:10px;color:var(--text-muted)">정답</label>
                    <input class="input-field wa-correct" data-subj="${activeSubj}" data-wi="${wi}" placeholder="④" value="${w.correctAnswer || ''}" style="font-size:13px;padding:6px 8px">
                  </div>
                </div>

                <div style="margin-bottom:6px">
                  <label style="font-size:10px;color:var(--text-muted)">왜 틀렸는지 (원인 분석)</label>
                  <textarea class="input-field wa-reason" data-subj="${activeSubj}" data-wi="${wi}" rows="2" placeholder="치환 후 적분 구간 변환을 안 했음" style="font-size:12px;padding:8px">${w.reason || ''}</textarea>
                </div>
                <div>
                  <label style="font-size:10px;color:var(--text-muted)">다음에 어떻게 할지 (성찰)</label>
                  <textarea class="input-field wa-reflection" data-subj="${activeSubj}" data-wi="${wi}" rows="2" placeholder="구간 변환 공식을 다시 정리해야겠다" style="font-size:12px;padding:8px">${w.reflection || ''}</textarea>
                </div>

                <div style="margin-top:8px">
                  <label style="font-size:10px;color:var(--text-muted)">📷 오답 문제 사진</label>
                  <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;align-items:center">
                    ${(w.images || []).map((img, imgIdx) => `
                      <div style="position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;border:1px solid var(--border);flex-shrink:0">
                        <img src="${img}" style="width:100%;height:100%;object-fit:cover">
                        <button style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(255,107,107,0.9);border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="_RM.removeWrongAnswerImage(${activeSubj},${wi},${imgIdx})"><i class="fas fa-times" style="font-size:8px"></i></button>
                      </div>
                    `).join('')}
                    <label style="width:48px;height:48px;border-radius:8px;border:2px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:var(--text-muted);gap:2px">
                      <i class="fas fa-camera" style="font-size:14px"></i><span>추가</span>
                      <input type="file" accept="image/*" multiple style="display:none" onchange="_RM.handleWrongAnswerImage(event,${activeSubj},${wi})">
                    </label>
                  </div>
                </div>
              </div>
            `).join('')}
          `}
        </div>

        <div style="margin-top:12px">
          <label class="field-label">💭 전체 소감</label>
          <textarea class="input-field" id="exam-overall-reflection" rows="3" placeholder="이번 시험을 돌아보며 느낀 점을 적어주세요">${r.overallReflection || ''}</textarea>
        </div>

        <button class="btn-primary" style="width:100%;margin-top:16px;padding:14px" onclick="_RM.saveExamResult()">
          <i class="fas fa-save" style="margin-right:6px"></i>결과 저장
        </button>

      </div>
    </div>
  `;
}
