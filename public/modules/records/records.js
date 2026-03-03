/* ================================================================
   Records Module — records.js
   진입점: 모듈 오케스트레이터 + Public API
   ================================================================ */

// ── Core ──
import { state, getState, setState, resetState } from './core/state.js';
import { events, EVENTS } from './core/events.js';
import { DB } from './core/api.js';
import { setContainer, registerView, navigate, goBack, render, setOnNavigate } from './core/router.js';

// ── Views ──
import { registerHandlers as dashboardHandlers, renderDashboard } from './views/dashboard.js';
import { registerHandlers as classRecordHandlers, renderRecordClass } from './views/class-record.js';
import { registerHandlers as classHistoryHandlers, renderClassRecordHistory } from './views/class-history.js';
import { registerHandlers as classDetailHandlers, renderClassRecordDetail } from './views/class-detail.js';
import { registerHandlers as classEditHandlers, renderClassRecordEdit } from './views/class-edit.js';
import { registerHandlers as recordStatusHandlers, renderRecordStatus } from './views/record-status.js';
import { registerHandlers as questionHandlers, renderRecordQuestion } from './views/question-record.js';
import { registerHandlers as teachHandlers, renderRecordTeach } from './views/teach-record.js';
import { registerHandlers as activityListHandlers, renderRecordActivity } from './views/activity-list.js';
import { registerHandlers as activityAddHandlers, renderActivityAdd } from './views/activity-add.js';
import { registerHandlers as activityDetailHandlers, renderActivityDetail } from './views/activity-detail.js';
import { registerHandlers as reportHandlers, renderReportProject } from './views/report-project.js';
import { registerHandlers as historyHandlers, renderRecordHistory } from './views/history.js';
import { registerHandlers as schoolRecordHandlers, renderSchoolRecord } from './views/school-record.js';
import { registerHandlers as examListHandlers, renderExamList } from './views/exam-list.js';
import { registerHandlers as examDetailHandlers, renderExamDetail } from './views/exam-detail.js';
import { registerHandlers as examAddHandlers, renderExamAdd } from './views/exam-add.js';
import { registerHandlers as examResultHandlers, renderExamResultInput } from './views/exam-result.js';
import { registerHandlers as examReportHandlers, renderExamReport } from './views/exam-report.js';
import { registerHandlers as growthAnalysisHandlers, renderGrowthAnalysis } from './views/growth-analysis.js';
import { registerHandlers as assignmentRecordHandlers, renderRecordAssignment } from './views/assignment-record.js';
import { registerHandlers as assignmentListHandlers, renderAssignmentPlan, renderAssignmentList } from './views/assignment-list.js';

// ── Components ──
import { initCarousel, initDetailGalleryScroll } from './components/photo-upload.js';
import { showXpPopup } from './components/xp-popup.js';

// ── 화면 이름 ↔ 렌더러 맵 ──
const SCREEN_MAP = {
  'dashboard':             renderDashboard,
  'record-class':          renderRecordClass,
  'class-record-history':  renderClassRecordHistory,
  'class-record-detail':   renderClassRecordDetail,
  'class-record-edit':     renderClassRecordEdit,
  'record-status':         renderRecordStatus,
  'record-question':       renderRecordQuestion,
  'record-teach':          renderRecordTeach,
  'record-activity':       renderRecordActivity,
  'activity-add':          renderActivityAdd,
  'activity-detail':       renderActivityDetail,
  'report-project':        renderReportProject,
  'record-history':        renderRecordHistory,
  'school-record':         renderSchoolRecord,
  'exam-list':             renderExamList,
  'exam-detail':           renderExamDetail,
  'exam-add':              renderExamAdd,
  'exam-result-input':     renderExamResultInput,
  'exam-report':           renderExamReport,
  'growth-analysis':       renderGrowthAnalysis,
  'record-assignment':     renderRecordAssignment,
  'assignment-plan':       renderAssignmentPlan,
  'assignment-list':       renderAssignmentList,
};

// ── _RM 글로벌 네임스페이스 (인라인 onclick 핸들러) ──
const RM = {
  // 네비게이션
  nav(screen, opts) { navigate(screen, opts); },
  back() { goBack(); },
  render() { render(); },

  // DB API
  DB,

  // 상태
  state,
  getState,
  setState,

  // XP
  showXpPopup,

  // 이벤트
  events,
  EVENTS,
};

// 모든 뷰의 핸들러 등록
function _registerAllHandlers() {
  dashboardHandlers(RM);
  classRecordHandlers(RM);
  classHistoryHandlers(RM);
  classDetailHandlers(RM);
  classEditHandlers(RM);
  recordStatusHandlers(RM);
  questionHandlers(RM);
  teachHandlers(RM);
  activityListHandlers(RM);
  activityAddHandlers(RM);
  activityDetailHandlers(RM);
  reportHandlers(RM);
  historyHandlers(RM);
  schoolRecordHandlers(RM);
  examListHandlers(RM);
  examDetailHandlers(RM);
  examAddHandlers(RM);
  examResultHandlers(RM);
  examReportHandlers(RM);
  growthAnalysisHandlers(RM);
  assignmentRecordHandlers(RM);
  assignmentListHandlers(RM);
}

// ── Public API ──
const RecordsModule = {
  /**
   * 초기화
   * @param {Object} config
   * @param {HTMLElement} config.container    - 렌더 대상 컨테이너
   * @param {number}      config.studentId    - 학생 ID
   * @param {string}      config.studentName  - 학생 이름
   * @param {Object}      config.timetable    - 시간표 데이터
   * @param {Array}       config.classmates   - 반 친구 목록 (교학상장용)
   * @param {boolean}     config.standalone   - 독립 모드 여부
   * @param {Function}    config.onXpEarned   - XP 획득 시 콜백
   * @param {Function}    config.onNavigate   - 화면 전환 시 콜백
   */
  init(config = {}) {
    const {
      container,
      studentId,
      studentName,
      timetable,
      classmates,
      standalone = false,
      onXpEarned,
      onNavigate,
    } = config;

    // 컨테이너 설정
    const el = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!el) {
      console.error('[RecordsModule] Container not found:', container);
      return;
    }

    // .records-module 클래스 보장 (CSS 스코핑)
    if (!el.classList.contains('records-module')) {
      el.classList.add('records-module');
    }

    setContainer(el);

    // 상태 초기화
    setState({
      studentId: studentId || null,
      studentName: studentName || '',
      timetable: timetable || state.timetable,
      classmates: classmates || [],
      standalone: !!standalone,
      currentScreen: 'dashboard',
      _screenHistory: [],
    });

    // 화면 등록
    Object.entries(SCREEN_MAP).forEach(([name, renderer]) => {
      registerView(name, renderer);
    });

    // 핸들러 등록
    _registerAllHandlers();

    // _RM 글로벌 노출 (인라인 onclick용)
    window._RM = RM;

    // 이벤트 바인딩
    if (onXpEarned) {
      events.on(EVENTS.XP_EARNED, onXpEarned);
    }
    if (onNavigate) {
      setOnNavigate(onNavigate);
    }

    // 캐러셀 / 갤러리 스크롤 초기화
    initCarousel();
    initDetailGalleryScroll();

    // 데이터 로드
    if (studentId) {
      DB.loadAll().then(() => {
        events.emit(EVENTS.DATA_LOADED);
        render();
      });
    } else {
      render();
    }

    console.log('[RecordsModule] Initialized', standalone ? '(standalone)' : '(embedded)');
  },

  /** 해제 및 정리 */
  destroy() {
    events.clear();
    resetState();
    setContainer(null);
    if (window._RM === RM) {
      delete window._RM;
    }
    console.log('[RecordsModule] Destroyed');
  },

  /** 특정 화면으로 이동 */
  navigate(screen, opts) {
    navigate(screen, opts);
  },

  /** API 데이터 새로고침 */
  async refresh() {
    if (state.studentId) {
      await DB.loadAll();
      events.emit(EVENTS.DATA_LOADED);
      render();
    }
  },

  /** 현재 상태 반환 */
  getState() {
    return getState();
  },

  /** 외부에서 상태 주입 */
  setState(partial) {
    setState(partial);
    render();
  },

  /** 이벤트 버스 접근 */
  events,
};

// 글로벌 노출
window.RecordsModule = RecordsModule;

export default RecordsModule;
