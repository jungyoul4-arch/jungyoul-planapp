/* ================================================================
   Records Module — records.js
   진입점: 모듈 오케스트레이터 + Public API
   ================================================================ */

// ── Core ──
import { state, getState, setState, resetState } from './core/state.js';
import { events, EVENTS } from './core/events.js';
import { DB } from './core/api.js';
import { setContainer, registerView, navigate, goBack, render, setOnNavigate } from './core/router.js';
import { kstToday } from './core/utils.js';

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
import { registerHandlers as periodSelectHandlers, renderPeriodSelect } from './views/period-select.js';
import { registerHandlers as photoUploadV2Handlers, renderPhotoUpload } from './views/photo-upload-v2.js';
import { registerHandlers as aiCreditLogHandlers, renderAiLoading, renderAiResult } from './views/ai-credit-log.js';
import { registerHandlers as photoAlbumHandlers, renderPhotoAlbum } from './views/photo-album.js';
import { registerHandlers as ahaInputHandlers, renderAhaInput } from './views/aha-report-input.js';
import { registerHandlers as ahaResultHandlers, renderAhaLoading as renderAhaLoadingV2, renderAhaResult as renderAhaResultV2 } from './views/aha-report-result.js';
import { registerHandlers as ahaListHandlers, renderAhaList, renderAhaDetail } from './views/aha-report-list.js';
import { registerHandlers as clubUploadHandlers, renderClubUpload } from './views/club-upload.js';
import { registerHandlers as careerUploadHandlers, renderCareerUpload } from './views/career-upload.js';
import { registerHandlers as autonomyUploadHandlers, renderAutonomyUpload } from './views/autonomy-upload.js';
import { registerHandlers as readingUploadHandlers, renderReadingUpload } from './views/reading-upload.js';
import { registerHandlers as volunteerUploadHandlers, renderVolunteerUpload } from './views/volunteer-upload.js';
import { registerHandlers as activityResultHandlers, renderActivityLoading, renderActivityResult } from './views/activity-result.js';
import { renderCareerDetail } from './views/career-detail.js';

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
  'period-select':         renderPeriodSelect,
  'photo-upload':          renderPhotoUpload,
  'ai-loading':            renderAiLoading,
  'ai-result':             renderAiResult,
  'photo-album':           renderPhotoAlbum,
  'aha-input':             renderAhaInput,
  'aha-loading':           renderAhaLoadingV2,
  'aha-result':            renderAhaResultV2,
  'aha-list':              renderAhaList,
  'aha-detail':            renderAhaDetail,
  'club-upload':           renderClubUpload,
  'career-upload':         renderCareerUpload,
  'autonomy-upload':       renderAutonomyUpload,
  'reading-upload':        renderReadingUpload,
  'volunteer-upload':      renderVolunteerUpload,
  'activity-loading':      renderActivityLoading,
  'activity-result':       renderActivityResult,
  'career-detail':         renderCareerDetail,
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

// 오늘의 시간표 → todayRecords 빌드
function _buildTodayRecords() {
  const today = kstToday(); // 'YYYY-MM-DD'
  const todayDate = new Date(today + 'T00:00:00Z'); // UTC 기준 파싱
  const jsDay = todayDate.getUTCDay(); // UTC 기준 요일 (0=일~6=토)
  const dayIdx = jsDay === 0 ? -1 : jsDay - 1; // 월~금만

  if (dayIdx < 0 || dayIdx > 4) {
    state.todayRecords = [];
    return;
  }
  const tt = state.timetable || {};
  const school = tt.school || [];
  const dbRecords = state._dbClassRecords || [];
  const newRecords = [];

  // school[교시][요일] 형태: school[pi][dayIdx] = 해당 교시의 해당 요일 과목
  for (let pi = 0; pi < school.length; pi++) {
    const subject = (school[pi] || [])[dayIdx];
    if (!subject) continue;
    const existing = dbRecords.find(r => r.date === today && r.subject === subject);
    newRecords.push({
      period: pi + 1,
      subject,
      teacher: (tt.teachers || {})[subject] || '',
      color: (tt.subjectColors || {})[subject] || '#636e72',
      startTime: (tt.periodTimes || [])[pi]?.start || '',
      endTime: (tt.periodTimes || [])[pi]?.end || '',
      done: !!existing,
      summary: existing ? (existing.topic || existing.content || '수업 기록 완료') : '',
      _dbRecordId: existing ? existing.id : null,
    });
  }
  state.todayRecords = newRecords;
}

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
  periodSelectHandlers(RM);
  photoUploadV2Handlers(RM);
  aiCreditLogHandlers(RM);
  photoAlbumHandlers(RM);
  ahaInputHandlers(RM);
  ahaResultHandlers(RM);
  ahaListHandlers(RM);
  clubUploadHandlers(RM);
  careerUploadHandlers(RM);
  autonomyUploadHandlers(RM);
  readingUploadHandlers(RM);
  volunteerUploadHandlers(RM);
  activityResultHandlers(RM);
}

// ── Public API ──
const ArchiveModule = {
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
      viewOnly = false,
      onXpEarned,
      onNavigate,
    } = config;

    // 컨테이너 설정
    const el = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    if (!el) {
      console.error('[ArchiveModule] Container not found:', container);
      return;
    }

    // .archive-module 클래스 보장 (CSS 스코핑)
    if (!el.classList.contains('archive-module')) {
      el.classList.add('archive-module');
    }

    setContainer(el);

    // 읽기 전용 모드 CSS 적용
    if (viewOnly) {
      el.classList.add('view-only-mode');

      // 동적으로 버튼 숨김 + 입력 필드 비활성화
      const hideActionButtons = () => {
        // 입력 필드 비활성화
        el.querySelectorAll('input, textarea, select, [contenteditable="true"]').forEach(inp => {
          if (inp.type !== 'hidden') {
            inp.setAttribute('readonly', true);
            inp.setAttribute('disabled', true);
            inp.style.pointerEvents = 'none';
            inp.style.opacity = '0.7';
          }
        });
        el.querySelectorAll('button, .btn, [role="button"], .ps-record-btn, .pu-ai-btn, label.class-photo-add-btn').forEach(btn => {
          const onclick = btn.getAttribute('onclick') || '';
          const text = btn.textContent || '';
          const className = btn.className || '';
          // onclick에 저장/삭제/수정 관련 함수가 있거나, 텍스트에 해당 단어가 있으면 숨김
          if (/save|delete|삭제|저장|수정|추가|편집|기록하기|업로드|분석|photo-add/i.test(onclick + text + className)) {
            // 단, 뒤로가기/닫기/취소/조회 버튼은 제외
            if (!/cancel|취소|닫기|back|뒤로|조회|보기|전체보기/i.test(onclick + text)) {
              btn.style.display = 'none';
            }
          }
        });
        // input[type=file]도 숨김
        el.querySelectorAll('input[type="file"]').forEach(input => {
          input.style.display = 'none';
          if (input.parentElement) input.parentElement.style.display = 'none';
        });
      };

      // 초기 실행 + DOM 변경 감지
      setTimeout(hideActionButtons, 100);
      const observer = new MutationObserver(() => setTimeout(hideActionButtons, 50));
      observer.observe(el, { childList: true, subtree: true });
    }


    // 상태 초기화 — initialScreen이 지정되면 dashboard 대신 해당 화면으로 시작
    const startScreen = config.initialScreen || 'dashboard';
    setState({
      studentId: studentId || null,
      studentName: studentName || '',
      timetable: timetable || state.timetable,
      classmates: classmates || [],
      standalone: !!standalone,
      viewOnly: !!viewOnly,
      currentScreen: startScreen,
      _screenHistory: startScreen !== 'dashboard' ? ['dashboard'] : [],
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

    // 메인 앱에서 전달받은 DB 데이터가 있으면 state에 직접 주입 (API 중복 호출 제거)
    const preloaded = config.preloadedData;
    if (preloaded) {
      state._dbClassRecords = preloaded.classRecords || [];
      state._dbQuestionRecords = preloaded.questionRecords || [];
      state._dbTeachRecords = preloaded.teachRecords || [];
      state._dbActivityRecords = preloaded.activityRecords || [];
      state._dbReportRecords = preloaded.reportRecords || [];
      if (preloaded.careerProfile !== undefined) state._careerProfile = preloaded.careerProfile;
    }

    // 오늘의 시간표 → todayRecords 빌드
    _buildTodayRecords();

    // 데이터 로드
    const skipRender = !!config.skipInitialRender;
    if (studentId) {
      if (preloaded) {
        // 메인 앱 데이터를 이미 주입했으므로 DB 호출 스킵 — 아카이브 전용 데이터만 로드
        ArchiveModule._initReady = Promise.all([
          DB.loadMyQuestions(),
          DB.loadMyQuestionStats(),
          DB.loadAhaReports(),
        ]).then(() => {
          _buildTodayRecords();
          events.emit(EVENTS.DATA_LOADED);
          if (!skipRender) render();
        }).catch(err => {
          console.error('[ArchiveModule] partial load failed:', err);
          if (!skipRender) render();
        });
      } else {
        // standalone 모드 등: 전체 DB 로드
        ArchiveModule._initReady = DB.loadAll().then(() => {
          _buildTodayRecords();
          events.emit(EVENTS.DATA_LOADED);
          if (!skipRender) render();
        }).catch(err => {
          console.error('[ArchiveModule] loadAll failed:', err);
          if (!skipRender) render();
        });
      }
    } else {
      ArchiveModule._initReady = Promise.resolve();
      render();
    }

    console.log('[ArchiveModule] Initialized', standalone ? '(standalone)' : '(embedded)');
  },

  /** 해제 및 정리 */
  destroy() {
    events.clear();
    resetState();
    setContainer(null);
    if (window._RM === RM) {
      delete window._RM;
    }
    console.log('[ArchiveModule] Destroyed');
  },

  /** 특정 화면으로 이동 */
  navigate(screen, opts) {
    navigate(screen, opts);
  },

  /** API 데이터 새로고침
   * @param {Object} opts
   * @param {boolean} opts.skipRender - true면 데이터만 갱신하고 render 생략 (직후 navigate 예정 시)
   * @param {Object} opts.preloadedData - 메인 앱 DB 데이터 주입 (API 중복 호출 방지)
   */
  async refresh({ skipRender = false, preloadedData } = {}) {
    if (state.studentId) {
      if (preloadedData) {
        // 메인 앱 데이터 주입 → 아카이브 전용 데이터만 로드
        state._dbClassRecords = preloadedData.classRecords || [];
        state._dbQuestionRecords = preloadedData.questionRecords || [];
        state._dbTeachRecords = preloadedData.teachRecords || [];
        state._dbActivityRecords = preloadedData.activityRecords || [];
        state._dbReportRecords = preloadedData.reportRecords || [];
        if (preloadedData.careerProfile !== undefined) state._careerProfile = preloadedData.careerProfile;
        await Promise.all([
          DB.loadMyQuestions(),
          DB.loadMyQuestionStats(),
          DB.loadAhaReports(),
        ]);
      } else {
        await DB.loadAll();
      }
      _buildTodayRecords();
      events.emit(EVENTS.DATA_LOADED);
      if (!skipRender) render();
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
window.ArchiveModule = ArchiveModule;

export default ArchiveModule;
