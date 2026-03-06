/* ================================================================
   Records Module — components/xp-popup.js
   XP 획득 팝업
   ================================================================ */

import { state } from '../core/state.js';

export function showXpPopup(amount, label, options) {
  const skipNavigate = options && options.stayOnScreen;
  state.xp += amount;

  // XP를 DB에 동기화 (디바운스: 마지막 호출 후 2초 뒤 실행)
  if (state.studentId && amount > 0) {
    const _lastXpLabel = label || '';
    clearTimeout(window._rmXpSyncTimer);
    window._rmXpSyncTimer = setTimeout(() => {
      fetch(`/api/student/${state.studentId}/profile`)
        .then(r => { if (!r.ok) throw new Error('not ok'); return r.json(); })
        .then(data => {
          const serverXp = data.xp || 0;
          if (state.xp > serverXp) {
            const diff = state.xp - serverXp;
            let source = '기타 활동';
            if (_lastXpLabel.includes('수업 기록')) source = '수업 기록';
            else if (_lastXpLabel.includes('코칭') || _lastXpLabel.includes('도전')) source = '질문 코칭';
            else if (_lastXpLabel.includes('교학상장')) source = '교학상장';
            else if (_lastXpLabel.includes('활동') || _lastXpLabel.includes('체험')) source = '창의적 체험활동';
            else if (_lastXpLabel.includes('과제')) source = '과제 기록';

            fetch(`/api/student/${state.studentId}/xp-sync`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ xpDelta: diff, source, sourceDetail: _lastXpLabel })
            }).catch(() => {});
          }
        })
        .catch(() => {});
    }, 2000);
  }

  const overlay = document.createElement('div');
  overlay.className = 'xp-popup-overlay';
  const popup = document.createElement('div');
  popup.className = 'xp-popup';
  popup.innerHTML = `
    <div class="xp-popup-icon">✨</div>
    <div class="xp-popup-amount">+${amount} XP</div>
    <div class="xp-popup-label">${label}</div>
    <div style="margin-top:16px">
      <div style="font-size:12px;color:var(--text-muted)">Lv.${state.level} 연구자</div>
      <div class="progress-bar" style="width:200px;margin:8px auto 0;height:8px;border-radius:4px">
        <div class="progress-fill level-fill" style="width:${Math.min((state.xp / 1500 * 100), 100).toFixed(0)}%"></div>
      </div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:4px">${state.xp.toLocaleString()}/1,500 XP</div>
    </div>
    <div style="margin-top:8px;font-size:14px;color:var(--streak-fire);font-weight:700">🔥 ${state.streak}일 스트릭</div>
  `;
  document.body.appendChild(overlay);
  document.body.appendChild(popup);

  const close = () => {
    overlay.style.opacity = '0';
    popup.style.opacity = '0';
    popup.style.transform = 'translate(-50%,-50%) scale(0.9)';
    setTimeout(() => {
      if (document.body.contains(overlay)) overlay.remove();
      if (document.body.contains(popup)) popup.remove();
    }, 200);
  };
  overlay.addEventListener('click', close);
  setTimeout(close, 2500);
}
