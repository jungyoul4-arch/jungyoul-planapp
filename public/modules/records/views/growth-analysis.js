/* ================================================================
   Records Module — views/growth-analysis.js
   성장 분석 + Canvas 차트
   ================================================================ */

import { state } from '../core/state.js';
import { navigate, render } from '../core/router.js';

const errorTypeLabels = {concept:'📘 개념부족', careless:'⚡ 실수', interpretation:'🔍 해석오류', time:'⏱️ 시간부족'};
const errorTypeColors = {concept:'#6C5CE7', careless:'#FF9F43', interpretation:'#FF6B6B', time:'#74B9FF'};

export function registerHandlers(RM) {
  RM.drawGrowthChart = drawGrowthChart;
}

export function renderGrowthAnalysis() {
  const examsWithResult = (state.exams||[]).filter(e => e.result).sort((a,b) => (a.startDate||'').localeCompare(b.startDate||''));

  if (examsWithResult.length === 0) {
    return `
      <div class="full-screen animate-in">
        <div class="screen-header">
          <button class="back-btn" onclick="_RM.nav('exam-list')"><i class="fas fa-arrow-left"></i></button>
          <h1>📈 성장 분석</h1>
        </div>
        <div class="form-body" style="text-align:center;padding-top:60px">
          <div style="font-size:48px;margin-bottom:16px">📊</div>
          <p style="font-size:14px;color:var(--text-secondary)">시험 결과를 2개 이상 입력하면<br>성장 추이를 분석할 수 있습니다</p>
        </div>
      </div>
    `;
  }

  const allSubjects = [...new Set(examsWithResult.flatMap(e => (e.result.subjects||[]).map(s => s.subject)))];
  const activeTab = state._growthTab || 'total';

  const subjColorMap = {};
  examsWithResult.forEach(e => (e.result.subjects||[]).forEach(s => { if (!subjColorMap[s.subject]) subjColorMap[s.subject] = s.color; }));

  let highlights = [];
  if (examsWithResult.length >= 2) {
    const first = examsWithResult[0].result;
    const last = examsWithResult[examsWithResult.length-1].result;
    allSubjects.forEach(subj => {
      const firstSub = (first.subjects||[]).find(s => s.subject === subj);
      const lastSub = (last.subjects||[]).find(s => s.subject === subj);
      if (firstSub && lastSub && firstSub.score && lastSub.score) {
        const diff = lastSub.score - firstSub.score;
        highlights.push({ subject: subj, first: firstSub.score, last: lastSub.score, diff, color: subjColorMap[subj] || '#888' });
      }
    });
    highlights.sort((a,b) => b.diff - a.diff);
  }

  // Schedule chart draw after render
  setTimeout(() => drawGrowthChart(), 100);

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('exam-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>📈 성장 분석</h1>
      </div>
      <div class="form-body">

        <div class="chip-row" style="margin-bottom:16px;flex-wrap:wrap">
          <button class="chip ${activeTab==='total'?'active':''}" onclick="_RM.state._growthTab='total';_RM.render()">전체</button>
          ${allSubjects.map(s => `
            <button class="chip ${activeTab===s?'active':''}" onclick="_RM.state._growthTab='${s}';_RM.render()" style="${activeTab===s?'background:'+subjColorMap[s]+';border-color:'+subjColorMap[s]:''}">
              ${s}
            </button>
          `).join('')}
        </div>

        <div class="section-label">📊 성적 추이</div>
        <div class="card" style="padding:16px">
          <canvas id="growth-chart" width="300" height="180" style="width:100%;height:180px"></canvas>
        </div>

        ${examsWithResult.length >= 1 ? `
        <div class="section-label" style="margin-top:16px">🔍 오답 유형 변화</div>
        <div class="card">
          <div style="display:flex;gap:4px;margin-bottom:8px;font-size:10px;color:var(--text-muted)">
            <span style="width:80px"></span>
            ${examsWithResult.map(e => `<span style="flex:1;text-align:center">${(e.name||'').replace(/.*?(중간|기말|모의|수행|학력).*/, '$1')}</span>`).join('')}
          </div>
          ${Object.entries(errorTypeLabels).map(([type, label]) => {
            const counts = examsWithResult.map(e => {
              let c = 0;
              const subs = activeTab === 'total' ? (e.result.subjects||[]) : (e.result.subjects||[]).filter(s => s.subject === activeTab);
              subs.forEach(s => (s.wrongAnswers||[]).forEach(w => { if (w.type===type) c++; }));
              return c;
            });
            if (counts.every(c => c===0)) return '';
            const trend = counts.length >= 2 ? (counts[counts.length-1] < counts[0] ? '📉' : counts[counts.length-1] > counts[0] ? '📈' : '➡️') : '';
            return `
            <div style="display:flex;align-items:center;gap:4px;padding:4px 0;font-size:12px">
              <span style="width:80px;color:${errorTypeColors[type]}">${label}</span>
              ${counts.map(c => `<span style="flex:1;text-align:center;font-weight:700;color:var(--text-primary)">${c}</span>`).join('')}
              <span>${trend}</span>
            </div>`;
          }).join('')}
        </div>
        ` : ''}

        ${highlights.length > 0 ? `
        <div class="section-label" style="margin-top:16px">🏆 성장 하이라이트</div>
        <div class="card">
          ${highlights.map(h => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border)">
              <span style="font-size:${h.diff>0?'16px':'14px'};width:24px">${h.diff>0?'✅':'⚠️'}</span>
              <span style="font-size:13px;font-weight:600;color:${h.color};width:44px">${h.subject}</span>
              <span style="font-size:12px;color:var(--text-muted)">${h.first} → ${h.last}</span>
              <span style="margin-left:auto;font-size:14px;font-weight:700;color:${h.diff>0?'#00B894':'#FF6B6B'}">${h.diff>0?'+':''}${h.diff}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <div class="section-label" style="margin-top:16px">📋 시험별 보고서</div>
        ${examsWithResult.map(e => `
          <div class="card" style="padding:12px;margin-bottom:8px;cursor:pointer" onclick="_RM.state.viewingExam='${e.id}';_RM.nav('exam-report')">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${e.name}</div>
                <div style="font-size:11px;color:var(--text-muted)">${(e.startDate||'').slice(5).replace('-','/')}</div>
              </div>
              <div style="text-align:right">
                <span style="font-size:18px;font-weight:800;color:var(--primary-light)">${e.result.totalScore}점</span>
                ${e.result.grade ? `<span style="font-size:11px;color:var(--text-muted);margin-left:4px">(${e.result.grade}등급)</span>` : ''}
              </div>
            </div>
          </div>
        `).join('')}

      </div>
    </div>
  `;
}

function drawGrowthChart() {
  const canvas = document.getElementById('growth-chart');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const examsWithResult = (state.exams||[]).filter(e => e.result).sort((a,b) => (a.startDate||'').localeCompare(b.startDate||''));
  if (examsWithResult.length === 0) return;

  const activeTab = state._growthTab || 'total';
  const dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const pad = {top:20, right:20, bottom:30, left:35};
  const chartW = W - pad.left - pad.right;
  const chartH = H - pad.top - pad.bottom;

  ctx.clearRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad.top + chartH * (1 - i/4);
    ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+chartW, y); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(i*25, pad.left-4, y+4);
  }

  // X labels
  examsWithResult.forEach((e,i) => {
    const x = pad.left + (examsWithResult.length===1 ? chartW/2 : chartW * i/(examsWithResult.length-1));
    ctx.fillStyle = 'rgba(255,255,255,0.4)';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    const label = (e.name||'').replace(/.*?(중간|기말|모의|수행|학력).*/, '$1');
    ctx.fillText(label, x, H - 6);
  });

  if (activeTab === 'total') {
    const allSubjects = [...new Set(examsWithResult.flatMap(e => (e.result.subjects||[]).map(s => s.subject)))];
    const subjColorMap = {};
    examsWithResult.forEach(e => (e.result.subjects||[]).forEach(s => { if (!subjColorMap[s.subject]) subjColorMap[s.subject] = s.color; }));

    allSubjects.forEach(subj => {
      const points = [];
      examsWithResult.forEach((e,i) => {
        const s = (e.result.subjects||[]).find(s => s.subject === subj);
        if (s && s.score) {
          const x = pad.left + (examsWithResult.length===1 ? chartW/2 : chartW * i/(examsWithResult.length-1));
          const y = pad.top + chartH * (1 - s.score/100);
          points.push({x, y, score: s.score});
        }
      });
      if (points.length === 0) return;
      ctx.strokeStyle = subjColorMap[subj] || '#888';
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
      ctx.stroke();
      points.forEach(p => {
        ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fillStyle = subjColorMap[subj] || '#888'; ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 9px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(p.score, p.x, p.y-8);
      });
    });

    // Legend
    let legendX = pad.left;
    allSubjects.forEach(subj => {
      ctx.fillStyle = subjColorMap[subj] || '#888';
      ctx.beginPath(); ctx.arc(legendX+4, pad.top-8, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(subj, legendX+10, pad.top-5);
      legendX += ctx.measureText(subj).width + 20;
    });

  } else {
    const points = [];
    examsWithResult.forEach((e,i) => {
      const s = (e.result.subjects||[]).find(s => s.subject === activeTab);
      if (s && s.score) {
        const x = pad.left + (examsWithResult.length===1 ? chartW/2 : chartW * i/(examsWithResult.length-1));
        const y = pad.top + chartH * (1 - s.score/100);
        points.push({x, y, score: s.score, avg: s.avg, name: (e.name||'').replace(/.*?(중간|기말|모의|수행|학력).*/, '$1')});
      }
    });

    if (points.some(p => p.avg)) {
      ctx.setLineDash([4,4]);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      points.filter(p=>p.avg).forEach((p,i) => {
        const ay = pad.top + chartH * (1 - p.avg/100);
        i===0 ? ctx.moveTo(p.x, ay) : ctx.lineTo(p.x, ay);
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    const subjColor = examsWithResult.flatMap(e=>(e.result.subjects||[])).find(s=>s.subject===activeTab)?.color || '#A29BFE';
    ctx.strokeStyle = subjColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.stroke();

    points.forEach(p => {
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
      ctx.fillStyle = subjColor; ctx.fill();
      ctx.strokeStyle = '#1a1a2e'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(p.score, p.x, p.y-10);
    });
  }
}
