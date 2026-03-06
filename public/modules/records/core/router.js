/* ================================================================
   Records Module — core/router.js
   내부 화면 라우팅
   ================================================================ */

import { state } from './state.js';
import { events, EVENTS } from './events.js';

let _container = null;
let _viewRenderers = {};
let _onNavigate = null;

export function setContainer(el) {
  _container = el;
}

export function registerView(screen, renderer) {
  _viewRenderers[screen] = renderer;
}

export function setOnNavigate(fn) {
  _onNavigate = fn;
}

export function navigate(screen, opts) {
  // 히스토리 관리
  if (!opts?.replace) {
    state._screenHistory.push(state.currentScreen);
  }
  state.currentScreen = screen;
  events.emit(EVENTS.SCREEN_CHANGE, { screen, opts });
  render();

  if (_onNavigate) {
    _onNavigate(screen, opts);
  }
}

export function goBack() {
  const history = state._screenHistory;
  if (history.length > 0) {
    const prev = history.pop();
    state.currentScreen = prev;
    events.emit(EVENTS.SCREEN_CHANGE, { screen: prev });
    render();
  } else {
    navigate('dashboard');
  }
}

export function render() {
  if (!_container) return;
  const screen = state.currentScreen;
  const renderer = _viewRenderers[screen];
  if (renderer) {
    try {
      const html = renderer();
      _container.innerHTML = html;
      if (!state._keepScroll) _container.scrollTop = 0;
      state._keepScroll = false;
    } catch (e) {
      console.error(`[RecordsModule] Render error on screen '${screen}':`, e);
      _container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#F85149"><p style="font-size:16px;font-weight:700">렌더링 오류</p><p style="font-size:13px;color:#8B949E;margin-top:8px">${screen}: ${e.message}</p><button onclick="_RM.nav('dashboard')" style="margin-top:16px;padding:8px 20px;background:#6C5CE7;color:#fff;border:none;border-radius:8px;cursor:pointer">대시보드로 이동</button></div>`;
    }
  } else {
    console.warn(`[RecordsModule] Unknown screen: ${screen}`);
    _container.innerHTML = `<div style="text-align:center;padding:60px 20px;color:#8B949E"><p>화면을 찾을 수 없습니다: ${screen}</p></div>`;
  }
}

export function getCurrentScreen() {
  return state.currentScreen;
}
