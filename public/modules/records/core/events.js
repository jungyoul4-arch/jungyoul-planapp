/* ================================================================
   Records Module — core/events.js
   이벤트 버스 (호스트 앱 통신용)
   ================================================================ */

class EventBus {
  constructor() {
    this._listeners = {};
  }

  on(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
    return () => this.off(event, fn);
  }

  off(event, fn) {
    if (!this._listeners[event]) return;
    this._listeners[event] = this._listeners[event].filter(f => f !== fn);
  }

  emit(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(fn => {
        try { fn(data); } catch (e) { console.error(`[RecordsModule] Event '${event}' handler error:`, e); }
      });
    }
  }

  once(event, fn) {
    const wrapper = (data) => {
      fn(data);
      this.off(event, wrapper);
    };
    this.on(event, wrapper);
  }

  clear() {
    this._listeners = {};
  }
}

export const events = new EventBus();

// 사전 정의 이벤트 이름
export const EVENTS = {
  SCREEN_CHANGE: 'screen:change',
  STATE_CHANGE: 'state:change',
  RECORD_SAVED: 'record:saved',
  RECORD_UPDATED: 'record:updated',
  XP_EARNED: 'xp:earned',
  DATA_LOADED: 'data:loaded',
  NAVIGATE: 'navigate',
  ERROR: 'error',
};
