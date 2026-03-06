/* ================================================================
   Records Module — core/state.js
   내부 상태 관리 (Proxy 기반 반응형)
   ================================================================ */

import { events, EVENTS } from './events.js';

const _initialState = {
  // 인증/학생 정보
  studentId: null,
  studentName: '',
  xp: 0,
  level: 1,
  streak: 0,

  // 현재 화면
  currentScreen: 'dashboard',
  _screenHistory: [],

  // 시간표 (호스트 앱에서 주입)
  timetable: { school: [], teachers: {}, subjectColors: {}, periodTimes: [] },
  todayRecords: [],
  todayAcademyRecords: null,

  // DB 데이터
  _dbClassRecords: [],
  _dbQuestionRecords: [],
  _dbTeachRecords: [],
  _dbActivityRecords: [],
  _dbReportRecords: [],

  // 미션
  missions: [
    { text: '수업 기록 3개 이상', icon: '📝', current: 0, target: 3, done: false },
    { text: '질문 1개 이상', icon: '❓', current: 0, target: 1, done: false },
    { text: '교학상장 도전!', icon: '🤝', current: 0, target: 1, done: false },
  ],

  // 갤러리/뷰어 상태
  _recordGalleryFilter: '전체',
  _viewingTodayRecordIdx: null,
  _viewingDbRecord: null,
  _viewingAcademyRecord: null,
  _editingClassRecordIdx: null,
  _classPhotos: [],
  _classAssignmentText: '',
  _classAssignmentDue: '',

  // 질문 코칭 (레거시)
  _questionSubject: '수학',
  _questionText: '',
  _questionImageData: null,
  _diagResult: null,
  _challengeResult: null,
  _coachMessages: [],
  _isAnalyzing: false,
  _isChallengeMode: false,
  _isSocratesMode: false,

  // 나의 질문함
  _myQuestions: [],
  _myQuestionStats: null,
  _myQuestionFilter: '전체',
  _viewingMyQuestion: null,
  _myQuestionDetail: null,
  _pendingQuestionText: null,
  _pendingQuestionImage: null,
  _pendingQuestionSource: null,
  _questionPhotoPreview: null,
  _aiImproveExpanded: {},

  // 교학상장
  _teachSubject: '',
  _teachTopic: '',

  // 활동
  extracurriculars: [],
  viewingActivity: null,
  viewingReport: null,
  reportPhaseTab: 0,

  // AI 수업 기록 (MY CREDIT LOG)
  _selectedPeriodIdx: null,
  _classPhotoTags: [],
  _aiAnalyzing: false,
  _aiAnalysisStep: '',
  _aiCreditLog: null,
  _aiCreditLogEditing: false,
  _studentComment: '',
  _albumFilter: '전체',
  _albumTagFilter: '전체',

  // 아하 리포트
  _dbAhaReports: [],
  _ahaPhotos: [],
  _ahaPhotoTags: [],
  _ahaSubject: '',
  _ahaSource: '',
  _ahaDate: '',
  _ahaAnalyzing: false,
  _ahaAnalysisStep: '',
  _ahaResult: null,
  _ahaEditing: false,
  _ahaFeedback: null,
  _ahaFeedbackLoading: false,
  _ahaListFilter: '전체',
  _viewingAhaId: null,
  _ahaDetail: null,
  _ahaDetailLoading: false,

  // 소급 기록
  _backfillDate: null,
  _backfillPeriod: null,
  _backfillSubject: null,
  _backfillTeacher: '',
  _backfillTime: {},

  // 시험 관리
  exams: [],
  viewingExam: null,
  examAiLoading: false,
  _examResultActiveSubj: 0,
  _growthTab: 'total',

  // 과제 관리
  assignments: [],
  viewingAssignment: null,
  editingAssignment: null,
  assignmentFilter: 'all',

  // 반 친구 (교학상장용)
  classmates: [],

  // 독립 모드 여부
  standalone: false,
};

let _state = { ..._initialState };
let _renderTimer = null;

function scheduleRender() {
  if (_renderTimer) cancelAnimationFrame(_renderTimer);
  _renderTimer = requestAnimationFrame(() => {
    _renderTimer = null;
    events.emit(EVENTS.STATE_CHANGE, _state);
  });
}

// Proxy 기반 반응형 상태
export const state = new Proxy(_state, {
  set(target, prop, value) {
    target[prop] = value;
    scheduleRender();
    return true;
  },
  get(target, prop) {
    return target[prop];
  },
});

export function getState() {
  return { ..._state };
}

export function setState(partial) {
  Object.assign(_state, partial);
  scheduleRender();
}

export function resetState() {
  Object.assign(_state, _initialState);
  _state._screenHistory = [];
  scheduleRender();
}
