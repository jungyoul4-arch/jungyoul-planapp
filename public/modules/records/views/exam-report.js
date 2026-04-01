/* ================================================================
   Records Module — views/exam-report.js
   시험 결과 보고서 화면
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';

const errorTypeLabels = {concept:'📘 개념부족', careless:'⚡ 실수', interpretation:'🔍 해석오류', time:'⏱️ 시간부족'};
const errorTypeColors = {concept:'#6C5CE7', careless:'#FF9F43', interpretation:'#FF6B6B', time:'#74B9FF'};

export function registerHandlers(RM) {
  // No specific handlers needed for report view
}

export function renderExamReport() {
  const ex = (state.exams||[]).find(e => e.id === state.viewingExam);
  if (!ex || !ex.result) return '<div class="full-screen"><p style="padding:40px;text-align:center;color:var(--text-muted)">결과 데이터가 없습니다</p></div>';

  const r = ex.result;
  const totalWrong = (r.subjects||[]).reduce((s,sub) => s + (sub.wrongAnswers||[]).length, 0);
  const errorTypes = {concept:0, careless:0, interpretation:0, time:0};
  const weakTopics = {};

  (r.subjects||[]).forEach(sub => {
    (sub.wrongAnswers||[]).forEach(w => {
      if (w.type) errorTypes[w.type]++;
      if (w.topic) {
        const key = sub.subject + ' - ' + w.topic;
        weakTopics[key] = (weakTopics[key]||0) + 1;
      }
    });
  });

  const sortedWeakTopics = Object.entries(weakTopics).sort((a,b) => b[1]-a[1]).slice(0,5);
  const errorTotal = Object.values(errorTypes).reduce((a,b)=>a+b,0) || 1;

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('exam-detail')"><i class="fas fa-arrow-left"></i></button>
        <h1>📊 결과 보고서</h1>
      </div>
      <div class="form-body">

        <div style="text-align:center;margin-bottom:20px">
          <div style="font-size:13px;color:var(--text-muted)">${ex.name}</div>
          <div style="font-size:36px;font-weight:800;color:var(--primary-light);margin:8px 0">${r.totalScore}점</div>
          <div style="display:flex;justify-content:center;gap:16px;font-size:12px;color:var(--text-secondary)">
            ${r.grade ? `<span>📋 ${r.grade}등급</span>` : ''}
            <span>❌ 총 오답 ${totalWrong}문항</span>
          </div>
        </div>

        <div class="section-label">📚 과목별 성적</div>
        <div class="card">
          ${(r.subjects||[]).map(sub => {
            const diff = sub.score && sub.avg ? sub.score - sub.avg : 0;
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <div style="width:4px;height:28px;border-radius:2px;background:${sub.color}"></div>
              <span style="font-size:13px;font-weight:600;width:44px">${sub.subject}</span>
              <div style="flex:1;height:8px;background:var(--bg-input);border-radius:4px;overflow:hidden">
                <div style="height:100%;width:${sub.score||0}%;background:${sub.color};border-radius:4px"></div>
              </div>
              <span style="font-size:14px;font-weight:700;width:36px;text-align:right;color:var(--text-primary)">${sub.score||'-'}</span>
              ${sub.grade ? `<span style="font-size:10px;background:rgba(108,92,231,0.15);padding:2px 6px;border-radius:6px;color:${sub.color}">${sub.grade}등급</span>` : ''}
              ${diff !== 0 ? `<span style="font-size:10px;color:${diff>0?'#00B894':'#FF6B6B'}">${diff>0?'+':''}${diff}</span>` : ''}
            </div>`;
          }).join('')}
        </div>

        ${totalWrong > 0 ? `
        <div class="section-label" style="margin-top:16px">🔍 오답 유형 분석</div>
        <div class="card">
          ${Object.entries(errorTypes).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([type,count]) => {
            const pct = Math.round(count/errorTotal*100);
            return `
            <div style="display:flex;align-items:center;gap:8px;padding:6px 0">
              <span style="font-size:12px;width:90px">${errorTypeLabels[type]}</span>
              <div style="flex:1;height:10px;background:var(--bg-input);border-radius:5px;overflow:hidden">
                <div style="height:100%;width:${pct}%;background:${errorTypeColors[type]};border-radius:5px;transition:width 0.5s"></div>
              </div>
              <span style="font-size:12px;font-weight:700;width:50px;text-align:right;color:${errorTypeColors[type]}">${count}개 ${pct}%</span>
            </div>`;
          }).join('')}
        </div>
        ` : ''}

        ${sortedWeakTopics.length > 0 ? `
        <div class="section-label" style="margin-top:16px">⚠️ 취약 단원 TOP ${sortedWeakTopics.length}</div>
        <div class="card">
          ${sortedWeakTopics.map(([topic,count],i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i<sortedWeakTopics.length-1?'border-bottom:1px solid var(--border)':''}">
              <span style="width:22px;height:22px;border-radius:50%;background:${i===0?'#FF6B6B':i===1?'#FF9F43':'#FDCB6E'};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</span>
              <span style="flex:1;font-size:13px;color:var(--text-primary)">${topic}</span>
              <span style="font-size:12px;color:var(--text-muted)">${count}문항</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        ${(r.subjects||[]).filter(s => (s.wrongAnswers||[]).length > 0).map(sub => `
        <div class="section-label" style="margin-top:16px">${sub.subject} 오답 상세</div>
        ${(sub.wrongAnswers||[]).map(w => `
          <div class="card" style="border-left:3px solid ${errorTypeColors[w.type]||'var(--border)'};margin-bottom:8px;padding:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;font-weight:700;background:var(--bg-input);padding:2px 8px;border-radius:6px">${w.number ? w.number+'번' : '?'}</span>
              <span style="font-size:12px;color:var(--text-secondary)">${w.topic || ''}</span>
              <span style="margin-left:auto;font-size:10px;padding:2px 6px;border-radius:6px;background:${errorTypeColors[w.type]||'var(--bg-input)'}20;color:${errorTypeColors[w.type]||'var(--text-muted)'}">${errorTypeLabels[w.type]||'미분류'}</span>
            </div>
            ${w.myAnswer || w.correctAnswer ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">내 답: <span style="color:#FF6B6B">${w.myAnswer||'?'}</span> → 정답: <span style="color:#00B894">${w.correctAnswer||'?'}</span></div>` : ''}
            ${w.reason ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px"><strong>원인:</strong> ${w.reason}</div>` : ''}
            ${w.reflection ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px"><strong>성찰:</strong> ${w.reflection}</div>` : ''}
            ${(w.images && w.images.length > 0) ? `
              <div style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
                ${w.images.map(img => `
                  <div style="width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
                    <img src="${img}" style="width:100%;height:100%;object-fit:cover">
                  </div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `).join('')}
        `).join('')}

        ${r.overallReflection ? `
        <div class="section-label" style="margin-top:16px">💭 전체 소감</div>
        <div class="card">
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">${r.overallReflection}</p>
        </div>
        ` : ''}

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn-secondary" style="flex:1" onclick="_RM.state.viewingExam='${ex.id}';_RM.nav('exam-result-input')">
            <i class="fas fa-edit" style="margin-right:4px"></i>결과 수정
          </button>
          <button class="btn-primary" style="flex:1" onclick="_RM.nav('growth-analysis')">
            <i class="fas fa-chart-line" style="margin-right:4px"></i>성장 분석
          </button>
        </div>

      </div>
    </div>
  `;
}
