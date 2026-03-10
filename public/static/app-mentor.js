// _mentor state defined in app.js (shared)

// ─── 멘토 학생 뷰어: 학생 플래너를 직접 열람 ───

async function __mentorEnterStudentView(studentId, studentName, studentEmoji) {
  // 1. 현재 멘토 상태 저장
  _mentor._savedAuthUser = { ...state._authUser };
  _mentor._savedAuthRole = state._authRole;
  _mentor._savedState = {
    mode: state.mode,
    currentScreen: state.currentScreen,
    studentTab: state.studentTab,
    xp: state.xp,
    level: state.level,
    streak: state.streak,
    _dbExams: state._dbExams,
    _dbAssignments: state._dbAssignments,
    _dbClassRecords: state._dbClassRecords,
    _dbQuestionRecords: state._dbQuestionRecords,
    _dbTeachRecords: state._dbTeachRecords,
    _dbActivityRecords: state._dbActivityRecords,
    _dbReportRecords: state._dbReportRecords,
    _mentorFeedbacks: state._mentorFeedbacks,
    _mentorFeedbackUnread: state._mentorFeedbackUnread,
    myQaStats: state.myQaStats,
  };

  // 2. 뷰어 상태 설정 + 즉시 화면 전환
  _mentor.viewerStudentId = studentId;
  _mentor.viewerStudentName = studentName || '';
  _mentor.viewerStudentEmoji = studentEmoji || '🐻';
  _mentor.viewerLoading = true;

  state._authUser = { id: studentId, name: studentName };
  state._authRole = 'student';
  state.mode = 'mentor-student-viewer';
  state.currentScreen = 'main';
  state.studentTab = 'home';
  state._msvActivePanel = 'all';
  state._mentorMyQaLoaded = false;
  state._mentorMyQaList = [];
  state._myQaStatsLoaded = false;
  renderScreen();

  // 3. all-records + profile + class-records(사진 포함) = 총 3건 호출
  try {
    const [profileRes, allRes, classRes] = await Promise.all([
      fetch(`/api/student/${studentId}/profile`),
      fetch(`/api/mentor/student/${studentId}/all-records`),
      fetch(`/api/student/${studentId}/class-records`),
    ]);

    // class-records → photos base64 매핑 (멘토 뷰에서 사진 표시용)
    let classRecordPhotosMap = {};
    if (classRes.ok) {
      const classData = await classRes.json();
      (classData.records || []).forEach(r => {
        let photos = [];
        try { photos = JSON.parse(r.photos || '[]'); } catch(e) {}
        classRecordPhotosMap[r.id] = photos;
      });
    }

    // 프로필
    if (profileRes.ok) {
      const profile = await profileRes.json();
      state.xp = profile.xp || 0;
      state.level = profile.level || 1;
      state.streak = profile.streak || 0;
      state._authUser = { ...state._authUser, ...profile };
    }

    // all-records → state에 직접 매핑
    if (allRes.ok) {
      const d = await allRes.json();
      const allRecs = d.dailyRecords || [];

      // class records
      state._dbClassRecords = [];
      // question records
      state._dbQuestionRecords = [];
      // teach records
      state._dbTeachRecords = [];
      // activity records
      state._dbActivityRecords = [];
      // report records
      state._dbReportRecords = [];
      // assignments
      state._dbAssignments = [];

      allRecs.forEach(day => {
        (day.records || []).forEach(r => {
          if (r.type === 'class') {
            // classRecordPhotosMap에서 photos base64 배열 가져오기 (멘토 뷰 사진 표시)
            const photosFromDb = classRecordPhotosMap[r.id] || [];
            state._dbClassRecords.push({
              id: r.id, date: r.date, subject: r.subject, period: r.period,
              content: r.content, keywords: r.keywords || r.keyword,
              understanding: r.understanding, memo: r.memo,
              teacher_note: r.teacher_note, created_at: r.created_at,
              photos: photosFromDb,
              topic: r.topic || '', pages: r.pages || '',
              _photoCount: r._photoCount, _photoIds: r._photoIds,
            });
          } else if (r.type === 'question') {
            state._dbQuestionRecords.push({
              id: r.id, subject: r.subject, question: r.question,
              context: r.context, level: r.level, created_at: r.created_at,
            });
          } else if (r.type === 'teach') {
            state._dbTeachRecords.push(r);
          } else if (r.type === 'activity') {
            state._dbActivityRecords.push(r);
          } else if (r.type === 'report') {
            state._dbReportRecords.push(r);
          } else if (r.type === 'assignment') {
            state._dbAssignments.push(r);
          }
        });
      });

      // exams, feedbacks
      state._dbExams = d.exams || [];
      state._mentorFeedbacks = d.feedbacks || [];
      state._mentorFeedbackUnread = 0;
    }

    // QA 통계 (비동기, 안 기다림)
    fetch(`/api/my-questions/stats?studentId=${studentId}`)
      .then(r => r.json()).then(data => { state.myQaStats = data; }).catch(() => {});

  } catch (e) {
    console.error('mentorEnterStudentView:', e);
  }

  _mentor.viewerLoading = false;
  syncTodayRecords();
  initTodayAcademy();
  renderScreen();
}

function __mentorExitStudentView() {
  // 멘토 상태 복원
  const saved = _mentor._savedState;
  if (saved) {
    state._authUser = _mentor._savedAuthUser;
    state._authRole = _mentor._savedAuthRole;
    state.mode = 'mentor';
    state.currentScreen = 'main';
    state.studentTab = saved.studentTab || 'home';
    state.xp = saved.xp;
    state.level = saved.level;
    state.streak = saved.streak;
    state._dbExams = saved._dbExams;
    state._dbAssignments = saved._dbAssignments;
    state._dbClassRecords = saved._dbClassRecords;
    state._dbQuestionRecords = saved._dbQuestionRecords;
    state._dbTeachRecords = saved._dbTeachRecords;
    state._dbActivityRecords = saved._dbActivityRecords;
    state._dbReportRecords = saved._dbReportRecords;
    state._mentorFeedbacks = saved._mentorFeedbacks;
    state._mentorFeedbackUnread = saved._mentorFeedbackUnread;
    state.myQaStats = saved.myQaStats;
  } else {
    state.mode = 'mentor';
  }
  // 뷰어 상태 초기화
  _mentor.viewerStudentId = null;
  _mentor.viewerStudentName = '';
  _mentor.viewerLoading = false;
  _mentor._savedState = null;
  _mentor._savedAuthUser = null;
  _mentor._savedAuthRole = null;
  state._msvActivePanel = null;
  state._mentorMyQaLoaded = false;
  state._mentorMyQaList = [];
  renderScreen();
}

function __renderMentorStudentViewer() {
  // Legacy — no longer used, replaced by _renderMentorStudentDashboard()
  return _renderMentorStudentDashboard();
}

// ==================== 멘토용 내 질문 패널 (iframe 대신 직접 렌더링) ====================
function __renderMentorMyQaPanel() {
  const stats = state.myQaStats || {};
  const questions = state._mentorMyQaList || [];
  const studentId = _mentor.viewerStudentId || state._authUser?.id;

  // 아직 로드 안 됐으면 비동기 로드
  if (!state._mentorMyQaLoaded && studentId) {
    state._mentorMyQaLoaded = true;
    fetch(`/api/my-questions?studentId=${studentId}`)
      .then(r => r.json())
      .then(data => {
        state._mentorMyQaList = data.questions || [];
        renderScreen();
      })
      .catch(() => {});
  }

  const total = stats.total || 0;
  const unanswered = stats.unanswered || 0;
  const answered = stats.answered || 0;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <h1>❓ 나만의 질문방</h1>
      </div>
      <div class="form-body">
        <!-- 통계 -->
        <div class="card" style="margin-bottom:16px;padding:14px;background:linear-gradient(135deg,rgba(108,92,231,0.08),rgba(232,67,147,0.08))">
          <div style="display:flex;justify-content:space-around;text-align:center">
            <div>
              <div style="font-size:22px;font-weight:800;color:var(--primary-light)">${total}</div>
              <div style="font-size:11px;color:var(--text-muted)">총 질문</div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:800;color:var(--accent)">${unanswered}</div>
              <div style="font-size:11px;color:var(--text-muted)">미답변</div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:800;color:var(--success)">${answered}</div>
              <div style="font-size:11px;color:var(--text-muted)">답변완료</div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:800;color:#FF6B6B">${stats.avgResolveDays || '-'}</div>
              <div style="font-size:11px;color:var(--text-muted)">평균 해결일</div>
            </div>
          </div>
        </div>
        ${(stats.subjectStats || []).length > 0 ? `
        <div class="card" style="margin-bottom:16px;padding:12px">
          <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:8px">과목별 질문 분포</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${stats.subjectStats.map(s => `<span style="background:rgba(108,92,231,0.12);color:var(--primary-light);padding:4px 10px;border-radius:12px;font-size:12px;font-weight:600">${s.subject} ${s.cnt}</span>`).join('')}
          </div>
        </div>` : ''}

        <!-- 질문 목록 -->
        ${questions.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
            <span style="font-size:48px;display:block;margin-bottom:12px">❓</span>
            <p style="font-size:14px;font-weight:600;margin:0">아직 질문이 없습니다</p>
            <p style="font-size:12px;margin-top:6px">학생이 수업 중 궁금한 것을 질문방에 남기면 여기에 표시됩니다</p>
          </div>
        ` : `
          <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">전체 질문 ${questions.length}건</div>
          ${questions.map(q => {
            const statusColor = q.status === '답변완료' ? 'var(--success)' : 'var(--accent)';
            const statusIcon = q.status === '답변완료' ? '✅' : '⏳';
            const date = (q.created_at || '').slice(0,10);
            return `
            <div class="card" style="margin-bottom:10px;padding:14px;cursor:pointer;transition:all 0.2s;border-left:3px solid ${statusColor}" onclick="_mentorViewQuestion(${q.id})">
              <div style="display:flex;justify-content:space-between;align-items:flex-start">
                <div style="flex:1;min-width:0">
                  <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                    <span style="background:${statusColor}20;color:${statusColor};padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">${statusIcon} ${q.status || '미답변'}</span>
                    <span style="background:rgba(108,92,231,0.12);color:var(--primary-light);padding:2px 8px;border-radius:8px;font-size:11px;font-weight:600">${q.subject || '기타'}</span>
                    ${q.question_type ? `<span style="font-size:11px;color:var(--text-muted)">${q.question_type}</span>` : ''}
                  </div>
                  <div style="font-size:14px;font-weight:600;color:var(--text-main);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${q.title || q.content?.slice(0,50) || '(제목 없음)'}</div>
                  ${q.content ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%">${q.content.slice(0,80)}</div>` : ''}
                </div>
                <div style="text-align:right;flex-shrink:0;margin-left:12px">
                  <div style="font-size:11px;color:var(--text-muted)">${date}</div>
                  ${q.answer_count > 0 ? `<div style="font-size:11px;color:var(--success);margin-top:4px">💬 답변 ${q.answer_count}개</div>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        `}
      </div>
    </div>
  `;
}

// 멘토용 질문 상세 보기
async function __mentorViewQuestion(questionId) {
  try {
    const res = await fetch(`/api/my-questions/${questionId}`);
    if (!res.ok) return;
    const data = await res.json();
    const q = data.question;
    const answers = data.answers || [];

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

    const statusColor = q.status === '답변완료' ? 'var(--success)' : 'var(--accent)';
    overlay.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;max-width:600px;width:100%;max-height:85vh;overflow-y:auto;padding:24px" onclick="event.stopPropagation()">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:8px">
            <span style="background:${statusColor}20;color:${statusColor};padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600">${q.status || '미답변'}</span>
            <span style="background:rgba(108,92,231,0.12);color:var(--primary-light);padding:3px 10px;border-radius:10px;font-size:12px;font-weight:600">${q.subject || '기타'}</span>
          </div>
          <button onclick="this.closest('div[style*=fixed]').remove()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer">✕</button>
        </div>
        <h3 style="font-size:18px;font-weight:700;color:var(--text-main);margin-bottom:8px">${q.title || '(제목 없음)'}</h3>
        <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">${(q.created_at || '').slice(0,16)} ${q.question_type ? '· ' + q.question_type : ''}</div>
        <div style="font-size:14px;color:var(--text-main);line-height:1.7;padding:16px;background:var(--bg-input);border-radius:12px;margin-bottom:20px;white-space:pre-wrap">${q.content || ''}</div>
        ${q.image_key ? `<img src="${q.image_key}" style="max-width:100%;border-radius:12px;margin-bottom:20px" />` : ''}
        <div style="font-size:14px;font-weight:700;color:var(--text-secondary);margin-bottom:12px">💬 답변 (${answers.length}건)</div>
        ${answers.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">아직 답변이 없습니다</div>' :
          answers.map(a => `
            <div style="background:linear-gradient(135deg,rgba(0,206,148,0.06),rgba(108,92,231,0.06));border-radius:12px;padding:14px;margin-bottom:10px;border-left:3px solid var(--success)">
              <div style="font-size:12px;color:var(--text-muted);margin-bottom:8px">${(a.created_at || '').slice(0,16)} ${a.resolve_days ? '· ' + a.resolve_days + '일 후 답변' : ''}</div>
              <div style="font-size:14px;color:var(--text-main);line-height:1.7;white-space:pre-wrap">${a.content || ''}</div>
              ${a.image_key ? `<img src="${a.image_key}" style="max-width:100%;border-radius:8px;margin-top:8px" />` : ''}
            </div>
          `).join('')}
      </div>
    `;
    document.body.appendChild(overlay);
  } catch (e) {
    console.error('mentorViewQuestion:', e);
  }
}

// ==================== 멘토 학생 대시보드 (데스크톱 최적화) ====================
function __renderMentorStudentDashboard() {
  const sname = _mentor.viewerStudentName || '';
  const semoji = _mentor.viewerStudentEmoji || '🐻';
  const studentInfo = _mentor.studentList.find(s => s.id == _mentor.viewerStudentId) || _mentor.groupSummary.find(s => s.id == _mentor.viewerStudentId) || {};

  // 비메인 화면 (학생 상세 화면 진입 시) → 단일 패널로 표시
  if (state.currentScreen !== 'main') {
    const writeScreens = ['record-class','record-question','record-teach','record-activity','record-assignment','planner-add','timetable-manage','academy-add','classmate-manage','exam-add','exam-result-input','report-add','activity-add','class-end-popup','academy-record-popup','evening-routine','aha-report','aha-report-list','aha-report-detail'];
    let subContent = '';
    if (writeScreens.includes(state.currentScreen)) {
      subContent = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)"><i class="fas fa-eye" style="font-size:36px;margin-bottom:16px;display:block;opacity:0.3"></i><p style="font-size:16px;font-weight:600;margin-bottom:8px">열람 전용 모드</p><p style="font-size:13px">멘토 열람 모드에서는 기록 작성이 불가합니다.</p><button onclick="state.currentScreen=\'main\';renderScreen()" class="msv-back-sub"><i class="fas fa-arrow-left"></i> 돌아가기</button></div>';
    } else {
      subContent = renderStudentApp();
    }
    return `
      <div class="msv-top-bar">
        <button onclick="_mentorExitStudentView()" class="msv-back-btn"><i class="fas fa-arrow-left"></i> 학생 목록으로 돌아가기</button>
        <span class="msv-title-label">${semoji} ${sname} 학생의 플래너 <span class="msv-badge">👁 열람 모드</span></span>
      </div>
      <div class="msv-sub-screen">
        <button onclick="state.currentScreen='main';renderScreen()" class="msv-breadcrumb"><i class="fas fa-arrow-left"></i> 대시보드로 돌아가기</button>
        <div class="msv-sub-content">${subContent}</div>
      </div>`;
  }

  // 메인 대시보드: 학생 탭을 동시에 다중 패널로 표시
  // 현재 활성 탭 (전체 표시 또는 개별 탭 확대)
  const activeTab = state._msvActivePanel || 'all';

  // 탭 아이콘/라벨
  const tabList = [
    { id: 'all', icon: 'fas fa-th-large', label: '전체 보기' },
    { id: 'home', icon: 'fas fa-home', label: '홈' },
    { id: 'record', icon: 'fas fa-pen', label: '기록' },
    { id: 'planner', icon: 'fas fa-calendar-alt', label: '플래너' },
    { id: 'myqa', icon: 'fas fa-circle-question', label: '내 질문' },
    { id: 'growth', icon: 'fas fa-chart-line', label: '성장' },
    { id: 'my', icon: 'fas fa-user', label: '마이' },
  ];

  // 패널 콘텐츠 생성
  const homeContent = renderHomeTab();
  const recordContent = renderRecordTab();
  const plannerContent = renderPlannerTab();
  const myqaContent = _renderMentorMyQaPanel();
  const growthContent = renderGrowthTab();
  const myContent = renderMyTab();

  let mainArea = '';
  if (activeTab === 'all') {
    mainArea = `
      <div class="msv-grid">
        <div class="msv-panel msv-panel-large" data-msvpanel="home">
          <div class="msv-panel-header"><i class="fas fa-home"></i> 홈 <button class="msv-expand-btn" data-msvexpand="home"><i class="fas fa-expand-alt"></i></button></div>
          <div class="msv-panel-body">${homeContent}</div>
        </div>
        <div class="msv-panel" data-msvpanel="record">
          <div class="msv-panel-header"><i class="fas fa-pen"></i> 기록 <button class="msv-expand-btn" data-msvexpand="record"><i class="fas fa-expand-alt"></i></button></div>
          <div class="msv-panel-body">${recordContent}</div>
        </div>
        <div class="msv-panel" data-msvpanel="planner">
          <div class="msv-panel-header"><i class="fas fa-calendar-alt"></i> 플래너 <button class="msv-expand-btn" data-msvexpand="planner"><i class="fas fa-expand-alt"></i></button></div>
          <div class="msv-panel-body">${plannerContent}</div>
        </div>
        <div class="msv-panel" data-msvpanel="myqa">
          <div class="msv-panel-header"><i class="fas fa-circle-question"></i> 내 질문 <button class="msv-expand-btn" data-msvexpand="myqa"><i class="fas fa-expand-alt"></i></button></div>
          <div class="msv-panel-body">${myqaContent}</div>
        </div>
        <div class="msv-panel" data-msvpanel="growth">
          <div class="msv-panel-header"><i class="fas fa-chart-line"></i> 성장 <button class="msv-expand-btn" data-msvexpand="growth"><i class="fas fa-expand-alt"></i></button></div>
          <div class="msv-panel-body">${growthContent}</div>
        </div>
        <div class="msv-panel" data-msvpanel="my">
          <div class="msv-panel-header"><i class="fas fa-user"></i> 마이페이지 <button class="msv-expand-btn" data-msvexpand="my"><i class="fas fa-expand-alt"></i></button></div>
          <div class="msv-panel-body">${myContent}</div>
        </div>
      </div>`;
  } else {
    // 단일 탭 확대 보기
    let singleContent = '';
    switch (activeTab) {
      case 'home': singleContent = homeContent; break;
      case 'record': singleContent = recordContent; break;
      case 'planner': singleContent = plannerContent; break;
      case 'myqa': singleContent = myqaContent; break;
      case 'growth': singleContent = growthContent; break;
      case 'my': singleContent = myContent; break;
    }
    mainArea = `
      <div class="msv-single-panel">
        <div class="msv-panel-body msv-single-body">${singleContent}</div>
      </div>`;
  }

  return `
    <div class="msv-top-bar">
      <button onclick="_mentorExitStudentView()" class="msv-back-btn"><i class="fas fa-arrow-left"></i> 학생 목록으로 돌아가기</button>
      <span class="msv-title-label">${semoji} ${sname} 학생의 플래너 <span class="msv-badge">👁 열람 모드</span></span>
    </div>
    <div class="msv-layout">
      <aside class="msv-sidebar">
        <div class="msv-profile-card">
          <div class="msv-avatar">${semoji}</div>
          <div class="msv-profile-name">${sname}</div>
          <div class="msv-profile-sub">${studentInfo.school_name || ''} ${studentInfo.grade || ''}학년</div>
          <div class="msv-profile-stats">
            <span>Lv.${state.level || 1}</span>
            <span>XP ${(state.xp || 0).toLocaleString()}</span>
            <span>🔥${state.streak || 0}</span>
          </div>
        </div>
        <nav class="msv-nav">
          ${tabList.map(t => `
            <button class="msv-nav-btn ${activeTab === t.id ? 'active' : ''}" data-msvtab="${t.id}">
              <i class="${t.icon}"></i> ${t.label}
            </button>
          `).join('')}
        </nav>
      </aside>
      <main class="msv-main" id="msv-content">
        ${mainArea}
      </main>
    </div>`;
}

function initMentorStudentDashboardEvents() {
  // 탭 전환
  document.querySelectorAll('.msv-nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state._msvActivePanel = btn.dataset.msvtab;
      state.currentScreen = 'main';
      renderScreen();
    });
  });
  // 패널 확대
  document.querySelectorAll('.msv-expand-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state._msvActivePanel = btn.dataset.msvexpand;
      state.currentScreen = 'main';
      renderScreen();
    });
  });
  // 학생 콘텐츠 내 이벤트 바인딩
  const contentEl = document.getElementById('msv-content');
  if (contentEl) {
    // 화면 이동 (data-go-screen)
    contentEl.querySelectorAll('[data-go-screen]').forEach(el => {
      el.addEventListener('click', () => {
        state.currentScreen = el.dataset.goScreen;
        renderScreen();
      });
    });
    // 플래너 뷰 토글
    contentEl.querySelectorAll('[data-pview]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.plannerView = btn.dataset.pview;
        renderScreen();
      });
    });
    // 성장 차트 (약간의 딜레이 후)
    setTimeout(() => { if (typeof drawGrowthChart === 'function') drawGrowthChart(); }, 200);
    // initStudentEvents 재사용 (읽기 전용이지만 네비게이션 허용)
    initStudentEvents(contentEl);
  }
}

function initMentorStudentViewerEvents() {
  // Legacy fallback
  initMentorStudentDashboardEvents();
}

// 멘토 데이터 로드: 반 목록 가져오기
async function __mentorLoadGroups() {
  if (!state._authUser?.id) return;
  try {
    const res = await fetch(`/api/mentor/${state._authUser.id}/groups`);
    const data = await res.json();
    _mentor.groups = data.groups || [];
    if (_mentor.groups.length > 0 && !_mentor.selectedGroupId) {
      _mentor.selectedGroupId = _mentor.groups[0].id;
    }
    // 릴레이단어장 자격 확인
    _mentor._relayClassId = null;
    _mentor._relayClassName = '';
    _mentor._relayWordbook = null;
    _mentor._relayEntries = [];
    _mentor._relayClassStudents = [];
    await _checkRelayEligibility();
  } catch (e) { console.error('mentorLoadGroups:', e); }
}

// 멘토 데이터 로드: 반 학생 요약
async function __mentorLoadGroupSummary() {
  if (!_mentor.selectedGroupId) return;
  _mentor.loading = true;
  renderScreen();
  try {
    const today = kstToday();
    const weekAgo = kstDateOffset(-7);
    const url1 = `/api/mentor/groups/${_mentor.selectedGroupId}/summary?from=${weekAgo}&to=${today}`;
    const res = await fetch(url1);
    const data = await res.json();
    console.log('[MENTOR] Summary loaded:', data.students?.length, 'students');
    _mentor.groupSummary = data.students || [];
    // 학생 목록도 동시에
    const res2 = await fetch(`/api/mentor/groups/${_mentor.selectedGroupId}/students`);
    const data2 = await res2.json();
    _mentor.studentList = data2.students || [];
  } catch (e) { console.error('mentorLoadGroupSummary:', e); }
  _mentor.loading = false;
  _mentor.initialLoading = false;
  renderScreen();
}

// 학생 상세 데이터 로드 (all-records)
async function __mentorLoadStudentDetail(studentId, studentName) {
  _mentor.selectedStudentId = studentId;
  _mentor.selectedStudentName = studentName || '';
  _mentor.detailLoading = true;
  _mentor.detailTab = 'timeline';
  _mentor.studentDetail = null;
  renderScreen();
  try {
    const res = await fetch(`/api/mentor/student/${studentId}/all-records`);
    _mentor.studentDetail = await res.json();
  } catch (e) { console.error('mentorLoadStudentDetail:', e); }
  _mentor.detailLoading = false;
  renderScreen();
}

// 사진 원본 로드
async function __mentorLoadPhoto(photoId) {
  _mentor.photoViewId = photoId;
  _mentor.photoViewData = null;
  renderScreen();
  try {
    const res = await fetch(`/api/photos/${photoId}`);
    const data = await res.json();
    _mentor.photoViewData = data.photo_data || data.photoData || null;
  } catch (e) { console.error('mentorLoadPhoto:', e); }
  renderScreen();
}

// 피드백 저장
async function __mentorSaveFeedback() {
  const content = _mentor.feedbackDraft.trim();
  if (!content || !_mentor.selectedStudentId || !state._authUser?.id) return;
  try {
    await fetch('/api/mentor/feedback', {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({
        mentorId: state._authUser.id,
        studentId: _mentor.selectedStudentId,
        recordType: _mentor.feedbackRecordType,
        recordId: _mentor.feedbackRecordId,
        content,
        feedbackType: 'note'
      })
    });
    _mentor.feedbackDraft = '';
    _mentor.feedbackRecordType = 'general';
    _mentor.feedbackRecordId = null;
    // 다시 상세 로드
    await _mentorLoadStudentDetail(_mentor.selectedStudentId, _mentor.selectedStudentName);
  } catch (e) { console.error('mentorSaveFeedback:', e); alert('피드백 저장 실패'); }
}

// 피드백 삭제
async function __mentorDeleteFeedback(feedbackId) {
  if (!confirm('이 피드백을 삭제하시겠습니까?')) return;
  try {
    await fetch(`/api/mentor/feedback/${feedbackId}`, { method: 'DELETE' });
    await _mentorLoadStudentDetail(_mentor.selectedStudentId, _mentor.selectedStudentName);
  } catch (e) { console.error('mentorDeleteFeedback:', e); }
}

// ─── 렌더링 ───

function __renderMentorDashboard() {
  // 멘토 로그인이 아닌 경우 안내 메시지
  if (state._authRole !== 'mentor') {
    return `
      <div class="desk-header">
        <div style="display:flex;align-items:center;gap:14px">
          <img src="/static/logo.png" alt="정율사관학원" class="desk-header-logo">
          <div>
            <h1>고교학점플래너 <span style="color:var(--primary-light)">멘토</span></h1>
          </div>
        </div>
      </div>
      <div style="text-align:center;padding:80px 20px">
        <div style="font-size:64px;margin-bottom:24px;opacity:0.3">👨‍🏫</div>
        <h2 style="font-size:22px;font-weight:800;margin-bottom:12px;color:var(--text-main)">멘토 계정으로 로그인해주세요</h2>
        <p style="font-size:14px;color:var(--text-secondary);line-height:1.8;max-width:400px;margin:0 auto 24px">
          멘토 대시보드를 사용하려면 멘토 계정이 필요합니다.<br>
          멘토 계정으로 로그인하면 담당 학생들의<br>
          수업 기록, 질문, 교학상장, 시험 결과를 모두 확인하고<br>
          피드백을 보낼 수 있습니다.
        </p>
        <button onclick="logout();goScreen('login-mentor')" class="btn-primary" style="width:auto;padding:14px 32px;font-size:15px">
          <i class="fas fa-sign-in-alt" style="margin-right:8px"></i>멘토 로그인
        </button>
      </div>
    `;
  }

  const user = state._authUser;
  const today = kstToday();
  const totalStudents = _mentor.studentList.length || _mentor.groupSummary.length || 0;

  // 초기 데이터 로딩 중 (autoLogin 시)
  if (_mentor.initialLoading) {
    return `
      <div class="desk-header">
        <div style="display:flex;align-items:center;gap:14px">
          <img src="/static/logo.png" alt="정율사관학원" class="desk-header-logo">
          <div>
            <h1>고교학점플래너 <span style="color:var(--primary-light)">멘토</span></h1>
            <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">${user?.name || '멘토'}</p>
          </div>
        </div>
      </div>
      <div style="text-align:center;padding:80px 20px;color:var(--text-muted)">
        <i class="fas fa-spinner fa-spin" style="font-size:36px;color:var(--primary-light)"></i>
        <p style="margin-top:16px;font-size:16px;font-weight:600">대시보드 데이터를 불러오는 중...</p>
        <p style="margin-top:8px;font-size:13px">학생 기록, 질문, 사진을 로딩합니다</p>
      </div>
    `;
  }

  // 학생 상세 보기 모드
  if (_mentor.selectedStudentId) {
    return _renderMentorStudentDetail();
  }

  // 그룹 선택 탭
  const groupTabs = _mentor.groups.map(g =>
    `<button class="desk-tab ${_mentor.selectedGroupId===g.id?'active':''}" data-mgroup="${g.id}">${g.name} (${g.student_count || 0})</button>`
  ).join('');

  return `
    <div class="desk-header">
      <div style="display:flex;align-items:center;gap:14px">
        <img src="/static/logo.png" alt="정율사관학원" class="desk-header-logo">
        <div>
          <h1>고교학점플래너 <span style="color:var(--primary-light)">멘토</span></h1>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">${user?.name || '멘토'} | 담당 학생 ${totalStudents}명</p>
        </div>
      </div>
      <div class="desk-header-right" style="display:flex;align-items:center;gap:12px">
        <span style="font-size:13px;color:var(--text-muted)">${today}</span>
        <button onclick="if(confirm('로그아웃 하시겠습니까?')){logout()}" style="background:var(--card-bg);border:1px solid var(--border-color);color:var(--text-secondary);padding:6px 14px;border-radius:8px;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:6px;transition:all 0.2s" onmouseover="this.style.color='#FF6B6B';this.style.borderColor='#FF6B6B'" onmouseout="this.style.color='var(--text-secondary)';this.style.borderColor='var(--border-color)'"><i class="fas fa-sign-out-alt"></i>로그아웃</button>
      </div>
    </div>
    ${_mentor.groups.length > 1 ? `<div class="desk-tabs" style="border-bottom:none;padding-bottom:0">${groupTabs}</div>` : ''}
    <div class="desk-tabs">
      ${(() => {
        const baseTabs = ['students:📋 내 학생','alerts:🚨 경보','feedback:💬 피드백','exams:📝 시험','network:🤝 교학상장','croquet:🍩 포인트'];
        // 릴레이단어장 탭: 현재 선택된 그룹이 영어 클래스(external_class_id 있고 릴레이 대상)인 경우 표시
        if (_mentor._relayClassId) baseTabs.push('relay:📚 릴레이단어장');
        return baseTabs.map(t => {
          const [id, label] = t.split(':');
          return `<button class="desk-tab ${state.mentorTab===id?'active':''}" data-mtab="${id}">${label}</button>`;
        }).join('');
      })()}
    </div>
    <div class="desk-body">${_mentor.loading ? '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="font-size:24px"></i><p style="margin-top:12px">데이터 불러오는 중...</p></div>' : _renderMentorTabContent()}</div>
  `;
}

function __renderMentorTabContent() {
  switch(state.mentorTab) {
    case 'students': return _renderMentorStudents();
    case 'alerts': return _renderMentorAlerts();
    case 'feedback': return _renderMentorFeedback();
    case 'exams': return _renderMentorExams();
    case 'network': return _renderMentorNetwork();
    case 'croquet': return _renderMentorCroquet();
    case 'relay': return _renderMentorRelay();
    default: return _renderMentorStudents();
  }
}

function __renderMentorStudents() {
  const students = _mentor.groupSummary;
  if (students.length === 0) {
    return `<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
      <i class="fas fa-user-graduate" style="font-size:48px;margin-bottom:16px;display:block;opacity:0.3"></i>
      <p style="font-size:16px;margin-bottom:8px">등록된 학생이 없습니다</p>
      <p style="font-size:13px">학생들에게 초대코드를 공유해주세요</p>
      ${_mentor.groups.length > 0 ? `<div style="margin-top:16px;padding:12px 20px;background:var(--bg-input);border-radius:var(--radius-md);display:inline-block;font-family:monospace;font-size:16px;letter-spacing:2px;color:var(--primary-light)">${_mentor.groups.find(g=>g.id===_mentor.selectedGroupId)?.invite_code || ''}</div>` : ''}
    </div>`;
  }

  // 이번 주 통계 집계
  let totalClass = 0, totalQuestion = 0, totalTeach = 0, totalAssign = 0;
  students.forEach(s => {
    const p = s.periodStats || {};
    totalClass += p.classRecords || 0;
    totalQuestion += p.questionRecords || 0;
    totalTeach += p.teachRecords || 0;
    totalAssign += p.assignments || 0;
  });
  const activeCount = students.filter(s => (s.periodStats?.total || 0) > 0).length;
  const recordRate = students.length > 0 ? Math.round(activeCount / students.length * 100) : 0;

  // 3대 비율 지표 평균 계산
  const avgColor = (v) => v >= 80 ? '#22C55E' : v >= 50 ? '#EAB308' : '#EF4444';
  let sumClassRate = 0, countClassRate = 0;
  let sumPlannerRate = 0, countPlannerRate = 0;
  let sumAcademyRate = 0, countAcademyRate = 0;
  students.forEach(s => {
    const rs = s.rateStats || {};
    if (typeof rs.classRecordRate === 'number') { sumClassRate += rs.classRecordRate; countClassRate++; }
    if (typeof rs.plannerRate === 'number' && rs.plannerRate >= 0) { sumPlannerRate += rs.plannerRate; countPlannerRate++; }
    if (typeof rs.academyTodayRate === 'number' && rs.academyTodayRate >= 0) { sumAcademyRate += rs.academyTodayRate; countAcademyRate++; }
  });
  const avgClassRate = countClassRate > 0 ? Math.round(sumClassRate / countClassRate) : 0;
  const avgPlannerRate = countPlannerRate > 0 ? Math.round(sumPlannerRate / countPlannerRate) : -1;
  const avgAcademyRate = countAcademyRate > 0 ? Math.round(sumAcademyRate / countAcademyRate) : -1;

  return `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">활동 학생</div><div class="stat-value">${activeCount}/${students.length}</div><div class="stat-change" style="color:var(--text-muted)">이번 주 기록률 ${recordRate}%</div></div>
      <div class="stat-card"><div class="stat-label">수업 기록</div><div class="stat-value" style="color:var(--primary-light)">${totalClass}</div><div class="stat-change" style="color:var(--text-muted)">이번 주 합계</div></div>
      <div class="stat-card"><div class="stat-label">질문</div><div class="stat-value" style="color:var(--question-b)">${totalQuestion}</div><div class="stat-change" style="color:var(--text-muted)">이번 주 합계</div></div>
      <div class="stat-card"><div class="stat-label">교학상장</div><div class="stat-value" style="color:var(--teach-green)">${totalTeach}</div><div class="stat-change" style="color:var(--text-muted)">이번 주 합계</div></div>
    </div>
    <div class="stats-row" style="margin-top:8px">
      <div class="stat-card">
        <div class="stat-label">평균 기록률</div>
        <div class="stat-value" style="color:${avgColor(avgClassRate)}">${avgClassRate}%</div>
        <div style="height:6px;background:var(--bg-input);border-radius:3px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${avgClassRate}%;background:${avgColor(avgClassRate)};border-radius:3px"></div></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">평균 실행률</div>
        <div class="stat-value" style="color:${avgPlannerRate >= 0 ? avgColor(avgPlannerRate) : 'var(--text-muted)'}">${avgPlannerRate >= 0 ? avgPlannerRate + '%' : '-'}</div>
        ${avgPlannerRate >= 0 ? `<div style="height:6px;background:var(--bg-input);border-radius:3px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${avgPlannerRate}%;background:${avgColor(avgPlannerRate)};border-radius:3px"></div></div>` : `<div style="font-size:10px;color:var(--text-muted);margin-top:6px">과제 데이터 없음</div>`}
      </div>
      <div class="stat-card">
        <div class="stat-label">평균 당일완료율</div>
        <div class="stat-value" style="color:${avgAcademyRate >= 0 ? avgColor(avgAcademyRate) : 'var(--text-muted)'}">${avgAcademyRate >= 0 ? avgAcademyRate + '%' : '-'}</div>
        ${avgAcademyRate >= 0 ? `<div style="height:6px;background:var(--bg-input);border-radius:3px;margin-top:6px;overflow:hidden"><div style="height:100%;width:${avgAcademyRate}%;background:${avgColor(avgAcademyRate)};border-radius:3px"></div></div>` : `<div style="font-size:10px;color:var(--text-muted);margin-top:6px">오늘 학원 없음</div>`}
      </div>
    </div>

    <div style="margin:16px 0 12px;display:flex;justify-content:space-between;align-items:center">
      <h3 style="font-size:15px;font-weight:700">👩‍🎓 학생 목록</h3>
      <div style="display:flex;align-items:center;gap:10px">
        <button onclick="openCroquetBulkGivePopup()" style="background:linear-gradient(135deg,#FF9F43,#FDCB6E);border:none;color:#fff;padding:6px 14px;border-radius:8px;font-size:12px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:4px;transition:all 0.2s" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">📦 일괄 포인트 지급</button>
        <span style="font-size:12px;color:var(--primary-light);font-weight:600">👆 학생 카드 클릭 → 상세 보기</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px">
      ${students.map(s => {
        const p = s.periodStats || {};
        const total = p.total || 0;
        const lastLogin = s.last_login_at ? s.last_login_at.slice(0,10) : '-';
        const daysSince = s.last_login_at ? Math.floor((Date.now() - new Date(s.last_login_at).getTime()) / 86400000) : 999;
        const statusColor = daysSince <= 1 ? 'green' : daysSince <= 3 ? 'yellow' : 'red';
        const statusText = daysSince <= 1 ? '오늘 활동' : daysSince <= 3 ? `${daysSince}일 전` : `${daysSince}일+ 미접속`;
        return `
        <div class="stat-card m-student-row" data-student-id="${s.id}" data-student-name="${s.name}" data-student-emoji="${s.profile_emoji || '🐻'}" style="cursor:pointer;padding:16px;transition:all 0.2s;border:2px solid transparent" onmouseenter="this.style.borderColor='var(--primary-light)'" onmouseleave="this.style.borderColor='transparent'">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px">
            <div style="width:44px;height:44px;border-radius:50%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0">${s.profile_emoji || '🐻'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-weight:700;font-size:15px">${s.name} <span style="font-size:12px;color:var(--text-muted);font-weight:400">${s.school_name || ''} ${s.grade || ''}학년</span></div>
              <div style="font-size:12px;color:var(--text-muted);display:flex;align-items:center;gap:6px;margin-top:2px">
                <span>Lv.${s.level || 1}</span> · <span>XP ${s.xp || 0}</span> ·
                <span style="display:inline-flex;align-items:center;gap:3px"><span class="status-dot status-${statusColor}" style="vertical-align:middle"></span>${statusText}</span>
              </div>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--primary-light);font-size:14px"></i>
          </div>
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:6px;text-align:center">
            <div style="padding:6px 0;background:var(--bg-input);border-radius:8px">
              <div style="font-size:18px;font-weight:800;color:var(--primary-light)">${p.classRecords || 0}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px">수업기록</div>
            </div>
            <div style="padding:6px 0;background:var(--bg-input);border-radius:8px">
              <div style="font-size:18px;font-weight:800;color:var(--question-b)">${p.questionRecords || 0}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px">질문</div>
            </div>
            <div style="padding:6px 0;background:var(--bg-input);border-radius:8px">
              <div style="font-size:18px;font-weight:800;color:var(--teach-green)">${p.teachRecords || 0}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px">교학상장</div>
            </div>
            <div style="padding:6px 0;background:var(--bg-input);border-radius:8px">
              <div style="font-size:18px;font-weight:800;color:var(--warning)">${p.assignments || 0}</div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:2px">과제</div>
            </div>
          </div>
          ${(() => {
            // 3대 비율 지표 프로그레스바
            const rs = s.rateStats || {};
            const getBarColor = (v) => v >= 80 ? '#22C55E' : v >= 50 ? '#EAB308' : '#EF4444';
            const bars = [
              { label: '수업 기록률', value: rs.classRecordRate ?? 0, detail: `${rs.actualClassRecords ?? 0}/${rs.expectedClasses ?? 0}` },
              { label: '과제 실행률', value: rs.plannerRate ?? -1, detail: rs.plannerRate >= 0 ? `${rs.completedAssignments ?? 0}/${rs.totalAssignments ?? 0}` : '과제 없음' },
              { label: '학원 당일완료', value: rs.academyTodayRate ?? -1, detail: rs.academyTodayRate >= 0 ? `${rs.todayAcademyCount ?? 0}건 완료` : '오늘 학원 없음' },
            ];
            return `<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
              ${bars.map(b => {
                const isNA = b.value < 0;
                const pct = isNA ? 0 : b.value;
                const color = isNA ? 'var(--text-muted)' : getBarColor(pct);
                return `<div style="display:flex;align-items:center;gap:8px">
                  <span style="font-size:10px;color:var(--text-muted);width:68px;flex-shrink:0;text-align:right">${b.label}</span>
                  <div style="flex:1;height:8px;background:var(--bg-input);border-radius:4px;overflow:hidden">
                    <div style="height:100%;width:${pct}%;background:${color};border-radius:4px;transition:width 0.5s"></div>
                  </div>
                  <span style="font-size:11px;font-weight:700;color:${color};min-width:42px;text-align:right">${isNA ? '-' : pct + '%'}</span>
                </div>`;
              }).join('')}
            </div>`;
          })()}
          ${total > 0 ? `<div style="margin-top:10px;padding:8px 12px;background:rgba(99,179,237,0.08);border-radius:8px;font-size:12px;color:var(--primary-light)">📊 이번 주 총 ${total}건 활동 — 탭하여 상세 보기</div>` : `<div style="margin-top:10px;padding:8px 12px;background:rgba(214,48,49,0.08);border-radius:8px;font-size:12px;color:var(--danger)">⚠️ 이번 주 활동 기록 없음 — 탭하여 확인</div>`}
          <div style="display:flex;align-items:center;justify-content:space-between;margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
            <div style="font-size:12px;color:#FF9F43;font-weight:600">🍩 ${(s.croquet_balance || 0).toLocaleString()}P</div>
            <button onclick="event.stopPropagation();openCroquetGivePopup(${s.id},'${(s.name||'').replace(/'/g,"\\'")}','${s.profile_emoji||'🐻'}')" style="background:linear-gradient(135deg,#FF9F43,#FDCB6E);border:none;color:#fff;padding:5px 12px;border-radius:8px;font-size:11px;font-weight:700;cursor:pointer;transition:all 0.2s" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">🍩 포인트 지급</button>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div style="margin-top:16px;display:flex;gap:16px;font-size:12px;color:var(--text-muted)">
      <span><span class="status-dot status-green" style="vertical-align:middle"></span> 오늘 활동 ${students.filter(s => { const d = s.last_login_at; return d && Math.floor((Date.now()-new Date(d).getTime())/86400000)<=1; }).length}명</span>
      <span><span class="status-dot status-yellow" style="vertical-align:middle"></span> 2-3일 전 ${students.filter(s => { const d = s.last_login_at; const ds = d ? Math.floor((Date.now()-new Date(d).getTime())/86400000) : 999; return ds > 1 && ds <= 3; }).length}명</span>
      <span><span class="status-dot status-red" style="vertical-align:middle"></span> 3일+ 미접속 ${students.filter(s => { const d = s.last_login_at; return !d || Math.floor((Date.now()-new Date(d).getTime())/86400000) > 3; }).length}명</span>
    </div>
  `;
}

function __renderMentorAlerts() {
  const students = _mentor.groupSummary;
  if (students.length === 0) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">학생 데이터가 없습니다</div>';

  const alerts = [];
  students.forEach(s => {
    const daysSince = s.last_login_at ? Math.floor((Date.now() - new Date(s.last_login_at).getTime()) / 86400000) : 999;
    const p = s.periodStats || {};
    if (daysSince >= 3) alerts.push({ type: 'red', icon: '🔴', name: s.name, id: s.id, msg: `${daysSince}일 연속 미접속. 상담이 필요합니다.` });
    if (p.total === 0 && daysSince < 3) alerts.push({ type: 'yellow', icon: '🟡', name: s.name, id: s.id, msg: '이번 주 기록이 없습니다. 독려해주세요.' });
    if (p.teachRecords >= 2) alerts.push({ type: 'green', icon: '✅', name: s.name, id: s.id, msg: `교학상장 ${p.teachRecords}회 달성! 활발한 활동 중.` });
    if (p.questionRecords >= 3) alerts.push({ type: 'green', icon: '✅', name: s.name, id: s.id, msg: `질문 ${p.questionRecords}건 작성. 적극적인 학습자!` });
  });

  // 정렬: red > yellow > green
  const order = { red: 0, yellow: 1, green: 2 };
  alerts.sort((a, b) => order[a.type] - order[b.type]);

  const redCount = alerts.filter(a => a.type === 'red').length;
  const yellowCount = alerts.filter(a => a.type === 'yellow').length;
  const greenCount = alerts.filter(a => a.type === 'green').length;

  return `
    <div style="display:flex;gap:12px;margin-bottom:20px;flex-wrap:wrap">
      <div style="padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;background:rgba(214,48,49,0.15);color:var(--danger)">🔴 위험 ${redCount}</div>
      <div style="padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;background:rgba(243,156,18,0.15);color:var(--warning)">🟡 주의 ${yellowCount}</div>
      <div style="padding:8px 16px;border-radius:20px;font-size:13px;font-weight:600;background:rgba(0,184,148,0.15);color:var(--success)">✅ 칭찬 ${greenCount}</div>
    </div>
    ${alerts.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-muted)">알림이 없습니다 👍</div>' :
      alerts.map(a => `<div class="alert-banner alert-${a.type}" style="cursor:pointer" data-alert-student="${a.id}" data-alert-name="${a.name}"><span>${a.icon}</span> <strong>${a.name}</strong> — ${a.msg}</div>`).join('')}
  `;
}

function __renderMentorFeedback() {
  // 그룹 내 학생별 최근 피드백 요약
  const students = _mentor.studentList;
  if (students.length === 0) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">학생이 없습니다</div>';

  return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:8px">💬 학생별 피드백</h3>
      <p style="font-size:13px;color:var(--text-muted)">학생을 클릭하면 상세 기록과 함께 피드백을 작성할 수 있습니다</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${students.map(s => `
        <div class="stat-card m-student-row" style="cursor:pointer;display:flex;align-items:center;gap:12px" data-student-id="${s.id}" data-student-name="${s.name}" data-student-emoji="${s.profile_emoji || '🐻'}">
          <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${s.profile_emoji || '🐻'}</div>
          <div style="flex:1;min-width:0">
            <div style="font-weight:700;font-size:14px">${s.name}</div>
            <div style="font-size:12px;color:var(--text-muted)">${s.grade || ''} · Lv.${s.level || 1} · XP ${s.xp || 0}</div>
          </div>
          <i class="fas fa-chevron-right" style="color:var(--text-muted);font-size:12px"></i>
        </div>
      `).join('')}
    </div>
  `;
}

function __renderMentorExams() {
  const students = _mentor.studentList;
  if (students.length === 0) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">학생이 없습니다</div>';

  return `
    <div style="margin-bottom:20px">
      <h3 style="margin-bottom:8px">📝 학생별 시험 현황</h3>
      <p style="font-size:13px;color:var(--text-muted)">학생을 클릭하면 시험 상세 기록을 확인할 수 있습니다</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">
      ${students.map(s => `
        <div class="stat-card m-student-row" style="cursor:pointer" data-student-id="${s.id}" data-student-name="${s.name}" data-student-emoji="${s.profile_emoji || '🐻'}">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px">
            <span style="font-size:18px">${s.profile_emoji || '🐻'}</span>
            <span style="font-weight:700">${s.name}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:auto">${s.grade || ''}</span>
          </div>
          <div style="font-size:12px;color:var(--text-secondary)">클릭하여 시험 기록 확인 →</div>
        </div>
      `).join('')}
    </div>
  `;
}

function __renderMentorNetwork() {
  const students = _mentor.groupSummary;
  if (students.length === 0) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">학생이 없습니다</div>';

  // 교학상장 활동 학생 정렬
  const teachActive = students.filter(s => (s.periodStats?.teachRecords || 0) > 0)
    .sort((a, b) => (b.periodStats?.teachRecords || 0) - (a.periodStats?.teachRecords || 0));

  return `
    <h3 style="margin-bottom:16px">🤝 이번 주 교학상장 활동</h3>
    ${teachActive.length === 0 ? '<div style="text-align:center;padding:40px;color:var(--text-muted)">이번 주 교학상장 활동이 없습니다</div>' : `
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;margin-bottom:24px">
      ${teachActive.map((s, i) => `
        <div class="stat-card m-student-row" style="cursor:pointer" data-student-id="${s.id}" data-student-name="${s.name}" data-student-emoji="${s.profile_emoji || '🐻'}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-size:16px;font-weight:800;color:var(--teach-green)">#${i+1}</span>
            <span style="font-weight:700">${s.profile_emoji || '🐻'} ${s.name}</span>
          </div>
          <div style="font-size:13px;color:var(--teach-green);font-weight:600">교학상장 ${s.periodStats.teachRecords}회</div>
        </div>
      `).join('')}
    </div>`}
    <div class="insight-box" style="margin-top:16px">
      <h4 style="margin-bottom:8px">💡 분석</h4>
      <div class="insight-item"><span>•</span> 전체 ${students.length}명 중 ${teachActive.length}명이 교학상장 활동 (${students.length > 0 ? Math.round(teachActive.length/students.length*100) : 0}%)</div>
      ${teachActive.length > 0 ? `<div class="insight-item"><span>•</span> 최다 활동: ${teachActive[0].name} (${teachActive[0].periodStats.teachRecords}회)</div>` : ''}
      <div class="insight-item"><span>•</span> 교학상장 미활동 학생: ${students.length - teachActive.length}명 → 격려 필요</div>
    </div>
  `;
}

// ==================== 크로켓 포인트 (멘토) ====================

const CROQUET_REASONS = ['수업 기록 우수','질문 활동 우수','교학상장 참여','플래너 실행 우수','학원 과제 완료','기타'];

function openCroquetGivePopup(studentId, studentName, studentEmoji) {
  const overlay = document.createElement('div');
  overlay.id = 'croquet-give-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;max-width:420px;width:100%;padding:24px" onclick="event.stopPropagation()">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
        <span style="font-size:28px">${studentEmoji}</span>
        <div>
          <div style="font-size:16px;font-weight:700;color:var(--text-main)">${studentName}</div>
          <div style="font-size:12px;color:var(--text-muted)">크로켓 포인트 지급</div>
        </div>
        <button onclick="this.closest('#croquet-give-overlay').remove()" style="margin-left:auto;background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer">✕</button>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:13px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">지급 포인트</label>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${[50,100,200,500].map(v => `<button class="cq-quick-btn" onclick="document.getElementById('cq-amount').value=${v};this.parentElement.querySelectorAll('.cq-quick-btn').forEach(b=>b.style.background='var(--bg-input)');this.style.background='rgba(255,159,67,0.25)'" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:#FF9F43;font-weight:700;font-size:13px;cursor:pointer">${v}P</button>`).join('')}
        </div>
        <input type="number" id="cq-amount" placeholder="직접 입력 (1~10,000)" min="1" max="10000" style="width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px" />
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:13px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">지급 사유</label>
        <select id="cq-reason" onchange="document.getElementById('cq-reason-detail').style.display=this.value==='기타'?'block':'none'" style="width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px">
          ${CROQUET_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
        <input type="text" id="cq-reason-detail" placeholder="사유를 직접 입력하세요" style="display:none;width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px;margin-top:8px" />
      </div>

      <button id="cq-submit-btn" onclick="submitCroquetGive(${studentId})" style="width:100%;padding:12px;background:linear-gradient(135deg,#FF9F43,#FDCB6E);border:none;border-radius:var(--radius-md);color:#fff;font-size:15px;font-weight:700;cursor:pointer">🍩 지급하기</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function submitCroquetGive(studentId) {
  const amount = parseInt(document.getElementById('cq-amount')?.value);
  let reason = document.getElementById('cq-reason')?.value || '기타';
  const reasonDetail = document.getElementById('cq-reason-detail')?.value || '';
  if (reason === '기타' && reasonDetail) reason = reasonDetail;

  if (!amount || amount <= 0 || amount > 10000) {
    alert('1 ~ 10,000 사이의 포인트를 입력해주세요');
    return;
  }

  const btn = document.getElementById('cq-submit-btn');
  if (btn) { btn.textContent = '지급 중...'; btn.disabled = true; }

  try {
    const res = await fetch('/api/mentor/croquet-points/give', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId: _mentor.id, studentId, amount, reason, reasonDetail })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('croquet-give-overlay')?.remove();
      // 요약 데이터 갱신
      const s = _mentor.groupSummary.find(s => s.id === studentId);
      if (s) s.croquet_balance = data.newBalance;
      renderScreen();
      // 성공 알림 (토스트)
      showCroquetToast(`🍩 ${amount}P 지급 완료!`);
    } else {
      alert(data.error || '지급 실패');
    }
  } catch (e) {
    alert('네트워크 오류');
  }
  if (btn) { btn.textContent = '🍩 지급하기'; btn.disabled = false; }
}

function showCroquetToast(msg) {
  const toast = document.createElement('div');
  toast.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#FF9F43,#FDCB6E);color:#fff;padding:12px 24px;border-radius:12px;font-size:14px;font-weight:700;z-index:99999;box-shadow:0 4px 20px rgba(255,159,67,0.4);animation:slideUp 0.3s ease';
  toast.textContent = msg;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.opacity = '0'; toast.style.transition = 'opacity 0.3s'; setTimeout(() => toast.remove(), 300); }, 2000);
}

function openCroquetBulkGivePopup() {
  const students = _mentor.groupSummary || [];
  if (students.length === 0) { alert('학생이 없습니다'); return; }

  const overlay = document.createElement('div');
  overlay.id = 'croquet-bulk-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  overlay.innerHTML = `
    <div style="background:var(--bg-card);border-radius:16px;max-width:500px;width:100%;max-height:85vh;overflow-y:auto;padding:24px" onclick="event.stopPropagation()">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
        <div style="font-size:18px;font-weight:700;color:var(--text-main)">📦 일괄 포인트 지급</div>
        <button onclick="this.closest('#croquet-bulk-overlay').remove()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer">✕</button>
      </div>

      <div style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <label style="font-size:13px;font-weight:600;color:var(--text-secondary)">학생 선택</label>
          <button onclick="document.querySelectorAll('.cq-bulk-check').forEach(c=>c.checked=!c.checked)" style="background:none;border:none;color:var(--primary-light);font-size:12px;cursor:pointer;font-weight:600">전체 선택/해제</button>
        </div>
        <div style="max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-md);padding:8px">
          ${students.map(s => `
            <label style="display:flex;align-items:center;gap:8px;padding:6px 8px;cursor:pointer;border-radius:8px;transition:background 0.15s" onmouseenter="this.style.background='var(--bg-input)'" onmouseleave="this.style.background='transparent'">
              <input type="checkbox" class="cq-bulk-check" value="${s.id}" style="width:18px;height:18px;accent-color:#FF9F43">
              <span style="font-size:16px">${s.profile_emoji || '🐻'}</span>
              <span style="font-size:14px;font-weight:600;flex:1">${s.name}</span>
              <span style="font-size:12px;color:#FF9F43">🍩 ${(s.croquet_balance || 0).toLocaleString()}P</span>
            </label>
          `).join('')}
        </div>
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:13px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">지급 포인트</label>
        <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap">
          ${[50,100,200,500].map(v => `<button class="cq-bulk-quick" onclick="document.getElementById('cq-bulk-amount').value=${v};this.parentElement.querySelectorAll('.cq-bulk-quick').forEach(b=>b.style.background='var(--bg-input)');this.style.background='rgba(255,159,67,0.25)'" style="padding:6px 14px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:#FF9F43;font-weight:700;font-size:13px;cursor:pointer">${v}P</button>`).join('')}
        </div>
        <input type="number" id="cq-bulk-amount" placeholder="직접 입력" min="1" max="10000" style="width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px" />
      </div>

      <div style="margin-bottom:16px">
        <label style="font-size:13px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">지급 사유</label>
        <select id="cq-bulk-reason" onchange="document.getElementById('cq-bulk-reason-detail').style.display=this.value==='기타'?'block':'none'" style="width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px">
          ${CROQUET_REASONS.map(r => `<option value="${r}">${r}</option>`).join('')}
        </select>
        <input type="text" id="cq-bulk-reason-detail" placeholder="사유를 직접 입력하세요" style="display:none;width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px;margin-top:8px" />
      </div>

      <button id="cq-bulk-submit" onclick="submitCroquetBulkGive()" style="width:100%;padding:12px;background:linear-gradient(135deg,#FF9F43,#FDCB6E);border:none;border-radius:var(--radius-md);color:#fff;font-size:15px;font-weight:700;cursor:pointer">📦 일괄 지급하기</button>
    </div>
  `;
  document.body.appendChild(overlay);
}

async function submitCroquetBulkGive() {
  const checks = document.querySelectorAll('.cq-bulk-check:checked');
  const studentIds = Array.from(checks).map(c => parseInt(c.value));
  const amount = parseInt(document.getElementById('cq-bulk-amount')?.value);
  let reason = document.getElementById('cq-bulk-reason')?.value || '기타';
  const reasonDetail = document.getElementById('cq-bulk-reason-detail')?.value || '';
  if (reason === '기타' && reasonDetail) reason = reasonDetail;

  if (studentIds.length === 0) { alert('학생을 1명 이상 선택해주세요'); return; }
  if (!amount || amount <= 0 || amount > 10000) { alert('1 ~ 10,000 사이의 포인트를 입력해주세요'); return; }

  if (!confirm(`${studentIds.length}명에게 ${amount}P를 지급합니다. 진행할까요?`)) return;

  const btn = document.getElementById('cq-bulk-submit');
  if (btn) { btn.textContent = '지급 중...'; btn.disabled = true; }

  try {
    const res = await fetch('/api/mentor/croquet-points/give-bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mentorId: _mentor.id, studentIds, amount, reason, reasonDetail })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('croquet-bulk-overlay')?.remove();
      // 잔액 갱신
      (data.results || []).forEach(r => {
        const s = _mentor.groupSummary.find(s => s.id === r.studentId);
        if (s) s.croquet_balance = r.newBalance;
      });
      renderScreen();
      showCroquetToast(`🍩 ${studentIds.length}명에게 ${amount}P 일괄 지급 완료!`);
    } else {
      alert(data.error || '일괄 지급 실패');
    }
  } catch (e) {
    alert('네트워크 오류');
  }
  if (btn) { btn.textContent = '📦 일괄 지급하기'; btn.disabled = false; }
}

// 멘토 포인트 이력 탭
function __renderMentorCroquet() {
  // 비동기 로드
  if (!_mentor._croquetHistoryLoaded) {
    _mentor._croquetHistoryLoaded = true;
    fetch(`/api/mentor/${_mentor.id}/croquet-points/history`)
      .then(r => r.json())
      .then(data => {
        _mentor._croquetHistory = data.history || [];
        _mentor._croquetSummary = data.monthlySummary || {};
        renderScreen();
      })
      .catch(() => {});
  }

  const history = _mentor._croquetHistory || [];
  const summary = _mentor._croquetSummary || {};

  return `
    <!-- 이번 달 요약 -->
    <div class="stats-row">
      <div class="stat-card">
        <div class="stat-label">이번 달 총 지급</div>
        <div class="stat-value" style="color:#FF9F43">🍩 ${(summary.totalGiven || 0).toLocaleString()}P</div>
        <div class="stat-change" style="color:var(--text-muted)">${summary.month || ''}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">지급 횟수</div>
        <div class="stat-value" style="color:var(--primary-light)">${summary.giveCount || 0}회</div>
        <div class="stat-change" style="color:var(--text-muted)">이번 달 합계</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">지급 대상</div>
        <div class="stat-value" style="color:var(--teach-green)">${summary.studentCount || 0}명</div>
        <div class="stat-change" style="color:var(--text-muted)">이번 달 유니크</div>
      </div>
    </div>

    <!-- 지급 이력 -->
    <div style="margin:16px 0 12px;display:flex;justify-content:space-between;align-items:center">
      <h3 style="font-size:15px;font-weight:700">📋 지급 이력</h3>
      <button onclick="_mentor._croquetHistoryLoaded=false;renderScreen()" style="background:none;border:none;color:var(--primary-light);font-size:12px;cursor:pointer;font-weight:600"><i class="fas fa-refresh"></i> 새로고침</button>
    </div>

    ${history.length === 0 ? `
      <div style="text-align:center;padding:40px;color:var(--text-muted)">
        <span style="font-size:48px;display:block;margin-bottom:12px">🍩</span>
        <p style="font-size:14px;font-weight:600">아직 포인트 지급 이력이 없습니다</p>
        <p style="font-size:12px;margin-top:6px">학생 카드에서 포인트를 지급해보세요</p>
      </div>
    ` : `
      <div style="display:flex;flex-direction:column;gap:8px">
        ${history.map(h => {
          const date = (h.created_at || '').slice(0, 10);
          const time = (h.created_at || '').slice(11, 16);
          return `
          <div class="stat-card" style="padding:14px;display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">${h.profile_emoji || '🐻'}</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:600;color:var(--text-main)">${h.student_name || '학생'}</div>
              <div style="font-size:12px;color:var(--text-muted)">${h.reason || '기타'}${h.reason_detail ? ' · ' + h.reason_detail : ''}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${date} ${time}</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:16px;font-weight:800;color:#FF9F43">+${(h.amount || 0).toLocaleString()}P</div>
              <div style="font-size:10px;color:var(--text-muted)">잔액 ${(h.balance_after || 0).toLocaleString()}P</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    `}
  `;
}

// ─── 학생 상세 보기 ───

function __renderMentorStudentDetail() {
  const d = _mentor.studentDetail;
  const name = _mentor.selectedStudentName;
  const sid = _mentor.selectedStudentId;

  if (_mentor.detailLoading) {
    return `
      <div class="desk-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="_mentor.selectedStudentId=null;renderScreen()" style="background:none;border:none;color:var(--text-secondary);font-size:18px;cursor:pointer"><i class="fas fa-arrow-left"></i></button>
          <h1 style="font-size:20px">${name} 학생 데이터</h1>
        </div>
      </div>
      <div style="text-align:center;padding:60px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="font-size:24px"></i><p style="margin-top:12px">데이터 불러오는 중...</p></div>
    `;
  }

  if (!d) {
    return `
      <div class="desk-header">
        <div style="display:flex;align-items:center;gap:12px">
          <button onclick="_mentor.selectedStudentId=null;renderScreen()" style="background:none;border:none;color:var(--text-secondary);font-size:18px;cursor:pointer"><i class="fas fa-arrow-left"></i></button>
          <h1 style="font-size:20px">${name}</h1>
        </div>
      </div>
      <div style="text-align:center;padding:60px;color:var(--text-muted)">데이터를 불러올 수 없습니다</div>
    `;
  }

  const s = d.summary || {};
  const tabs = [
    { id: 'timeline', label: `📋 타임라인 (${(d.dailyRecords||[]).length}일)` },
    { id: 'exams', label: `📝 시험 (${(d.exams||[]).length})` },
    { id: 'photos', label: `📸 사진 (${s.classPhotos || 0})` },
    { id: 'feedback', label: `💬 피드백 (${(d.feedbacks||[]).length})` },
  ];

  // 학생 정보 찾기
  const studentInfo = _mentor.studentList.find(st => st.id == sid) || _mentor.groupSummary.find(st => st.id == sid) || {};

  return `
    <div class="desk-header">
      <div style="display:flex;align-items:center;gap:12px">
        <button onclick="_mentor.selectedStudentId=null;_mentor.studentDetail=null;renderScreen()" style="background:none;border:none;color:var(--text-secondary);font-size:18px;cursor:pointer;padding:8px"><i class="fas fa-arrow-left"></i></button>
        <div style="width:40px;height:40px;border-radius:50%;background:var(--bg-input);display:flex;align-items:center;justify-content:center;font-size:20px">${studentInfo.profile_emoji || '🐻'}</div>
        <div>
          <h1 style="font-size:20px">${name}</h1>
          <p style="font-size:12px;color:var(--text-muted)">${studentInfo.school_name || ''} ${studentInfo.grade || ''}학년 · Lv.${studentInfo.level || 1} · XP ${studentInfo.xp || 0}</p>
        </div>
      </div>
    </div>
    <!-- 요약 통계 -->
    <div class="stats-row" style="padding:16px 28px 0">
      <div class="stat-card"><div class="stat-label">수업 기록</div><div class="stat-value" style="color:var(--primary-light)">${s.classRecords || 0}</div><div class="stat-change" style="font-size:11px;color:var(--text-muted)">전체 기간</div></div>
      <div class="stat-card"><div class="stat-label">질문</div><div class="stat-value" style="color:var(--question-b)">${s.questionRecords || 0}</div><div class="stat-change" style="font-size:11px;color:var(--text-muted)">전체 기간</div></div>
      <div class="stat-card"><div class="stat-label">교학상장</div><div class="stat-value" style="color:var(--teach-green)">${s.teachRecords || 0}</div><div class="stat-change" style="font-size:11px;color:var(--text-muted)">전체 기간</div></div>
      <div class="stat-card"><div class="stat-label">사진·과제·활동</div><div class="stat-value">${(s.classPhotos||0) + (s.assignments||0) + (s.activityRecords||0)}</div><div class="stat-change" style="font-size:11px;color:var(--text-muted)">📸${s.classPhotos||0} 📋${s.assignments||0} 🎯${s.activityRecords||0}</div></div>
    </div>
    <div class="desk-tabs">
      ${tabs.map(t => `<button class="desk-tab ${_mentor.detailTab===t.id?'active':''}" data-mdetail="${t.id}">${t.label}</button>`).join('')}
    </div>
    <div class="desk-body">${renderMentorDetailTab()}</div>

    ${_mentor.photoViewId ? renderPhotoModal() : ''}
  `;
}

function renderMentorDetailTab() {
  switch (_mentor.detailTab) {
    case 'timeline': return renderDetailTimeline();
    case 'exams': return renderDetailExams();
    case 'photos': return renderDetailPhotos();
    case 'feedback': return renderDetailFeedback();
    default: return renderDetailTimeline();
  }
}

function renderDetailTimeline() {
  const d = _mentor.studentDetail;
  if (!d || !d.dailyRecords || d.dailyRecords.length === 0) {
    return '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-inbox" style="font-size:36px;margin-bottom:12px;display:block;opacity:0.3"></i>기록이 없습니다</div>';
  }

  const typeLabel = { class: '📖 수업', question: '❓ 질문', teach: '🤝 교학상장', activity: '🎯 활동', activity_log: '📝 활동일지', assignment: '📋 과제', report: '📊 탐구', my_question: '💬 질문방' };
  const typeColor = { class: 'var(--primary-light)', question: 'var(--question-b)', teach: 'var(--teach-green)', activity: 'var(--accent)', activity_log: 'var(--text-secondary)', assignment: 'var(--warning)', report: 'var(--success)', my_question: '#e84393' };

  return d.dailyRecords.slice(0, 30).map(day => `
    <div style="margin-bottom:24px">
      <div style="font-size:14px;font-weight:700;color:var(--text-secondary);margin-bottom:10px;padding-bottom:6px;border-bottom:2px solid var(--border);display:flex;align-items:center;gap:8px">
        <span style="font-size:18px">📅</span> ${day.date}
        <span style="font-size:12px;color:var(--text-muted);font-weight:400;margin-left:auto">${day.records.length}건</span>
      </div>
      ${day.records.map(r => {
        const tl = typeLabel[r.type] || r.type;
        const tc = typeColor[r.type] || 'var(--text-muted)';
        let detail = '';
        let extra = '';

        if (r.type === 'class') {
          const stars = r.understanding ? '⭐'.repeat(Math.min(r.understanding, 5)) : '';
          const keywords = (() => { try { return JSON.parse(r.keywords || r.keyword || '[]'); } catch { return r.keyword ? [r.keyword] : []; } })();
          detail = `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.subject || '과목미정'} ${r.period ? `<span style="font-size:11px;color:var(--text-muted);font-weight:400">${r.period}교시</span>` : ''}</div>`;
          if (r.content) detail += `<div style="font-size:13px;color:var(--text-main);margin-bottom:4px;line-height:1.5">${r.content}</div>`;
          if (keywords.length > 0) detail += `<div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:4px">${keywords.map(k => `<span style="font-size:11px;padding:2px 8px;background:rgba(99,179,237,0.15);border-radius:10px;color:var(--primary-light)">#${k}</span>`).join('')}</div>`;
          if (stars) detail += `<div style="font-size:12px">이해도: ${stars}</div>`;
          if (r.memo) detail += `<div style="font-size:12px;color:var(--text-muted);margin-top:2px;font-style:italic">${r.memo}</div>`;
          if (r.teacher_note) detail += `<div style="font-size:12px;color:var(--warning);margin-top:2px">✏️ 멘토노트: ${r.teacher_note}</div>`;
          // 사진 표시
          if (r._photoCount > 0 && r._photoIds) {
            extra = `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${r._photoIds.map(pid => `<div onclick="event.stopPropagation();_mentorLoadPhoto(${pid})" style="width:60px;height:60px;border-radius:8px;background:var(--bg-input);display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--border);transition:all 0.15s" onmouseenter="this.style.borderColor='var(--primary-light)'" onmouseleave="this.style.borderColor='var(--border)'"><i class="fas fa-camera" style="color:var(--primary-light);font-size:16px"></i></div>`).join('')}<span style="font-size:11px;color:var(--primary-light);align-self:center">📸 사진 ${r._photoCount}장 (클릭하여 보기)</span></div>`;
          }
        } else if (r.type === 'question') {
          detail = `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.subject || ''} <span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:700;background:${r.level==='C'?'rgba(214,48,49,0.15)':r.level==='B'?'rgba(243,156,18,0.15)':'rgba(0,184,148,0.15)'};color:${r.level==='C'?'var(--danger)':r.level==='B'?'var(--warning)':'var(--success)'}">${r.level || 'A'}등급</span></div>`;
          if (r.question) detail += `<div style="font-size:13px;color:var(--text-main);line-height:1.5;margin-bottom:2px">❓ ${r.question}</div>`;
          if (r.context) detail += `<div style="font-size:12px;color:var(--text-muted);margin-top:2px">💡 ${r.context}</div>`;
        } else if (r.type === 'teach') {
          detail = `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.subject || ''}</div>`;
          if (r.topic) detail += `<div style="font-size:13px;color:var(--text-main)">📝 주제: ${r.topic}</div>`;
          if (r.audience) detail += `<div style="font-size:12px;color:var(--text-muted)">👥 대상: ${r.audience}</div>`;
        } else if (r.type === 'assignment') {
          const statusIcon = r.status === '완료' ? '✅' : r.status === '진행중' ? '🔄' : '📋';
          detail = `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.subject || ''} — ${r.title || ''}</div>`;
          detail += `<div style="font-size:12px">${statusIcon} ${r.status || '미정'} · 진행률 ${r.progress || 0}%</div>`;
          if (r.due_date) detail += `<div style="font-size:11px;color:var(--text-muted)">마감: ${r.due_date}</div>`;
        } else if (r.type === 'my_question') {
          detail = `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.subject || ''} — ${r.title || ''}</div>`;
          detail += `<div style="font-size:12px">${r.image_key ? '📸 ' : ''}${r.status === '답변완료' ? '<span style="color:var(--success)">✅ 답변완료</span>' : '<span style="color:var(--warning)">⏳ 답변대기</span>'} · 답변 ${r.answer_count || 0}건</div>`;
        } else if (r.type === 'activity') {
          detail = `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.activity_type || ''} — ${r.name || ''}</div>`;
          detail += `<div style="font-size:12px">진행률: ${r.progress || 0}%</div>`;
        } else if (r.type === 'activity_log') {
          detail = `<div style="font-size:13px;color:var(--text-main);line-height:1.5">${r.content || r.reflection || ''}</div>`;
        } else if (r.type === 'report') {
          detail = `<div style="font-weight:700;font-size:14px;margin-bottom:4px">${r.title || ''}</div>`;
          if (r.phase) detail += `<div style="font-size:12px;color:var(--text-muted)">단계: ${r.phase}</div>`;
        }
        return `<div style="padding:12px;margin-bottom:8px;background:var(--bg-card);border:1px solid var(--border);border-radius:12px;border-left:3px solid ${tc}">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
            <span style="font-size:12px;font-weight:700;color:${tc};white-space:nowrap;padding:2px 8px;background:${tc}15;border-radius:6px">${tl}</span>
            <span style="margin-left:auto;font-size:11px;color:var(--text-muted)">${r.created_at ? r.created_at.slice(11,16) : ''}</span>
            <button class="m-fb-btn" data-fb-type="${r.type}" data-fb-id="${r.id || ''}" style="background:var(--bg-input);border:1px solid var(--border);color:var(--primary-light);font-size:12px;cursor:pointer;padding:4px 10px;border-radius:6px;transition:all 0.15s;font-weight:600" title="피드백 작성">💬 피드백</button>
          </div>
          <div style="padding-left:4px">${detail}</div>
          ${extra}
        </div>`;
      }).join('')}
    </div>
  `).join('');
}

function renderDetailExams() {
  const d = _mentor.studentDetail;
  if (!d) return '';

  const exams = d.exams || [];
  const results = d.examResults || [];

  if (exams.length === 0) return '<div style="text-align:center;padding:40px;color:var(--text-muted)">등록된 시험이 없습니다</div>';

  return exams.map(ex => {
    const result = results.find(r => r.exam_id === ex.id);
    const subjects = (() => { try { return JSON.parse(ex.subjects || '[]'); } catch { return []; } })();
    return `
      <div class="stat-card" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
          <div>
            <span style="font-weight:700;font-size:15px">${ex.name || '시험'}</span>
            <span style="font-size:12px;color:var(--text-muted);margin-left:8px">${ex.type || ''}</span>
          </div>
          <span style="font-size:12px;color:var(--text-muted)">${ex.start_date || ''}</span>
        </div>
        ${result ? `
          <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:8px">
            <span style="font-size:13px"><strong>총점:</strong> ${result.total_score || '-'}</span>
            <span style="font-size:13px"><strong>등급:</strong> ${result.grade || '-'}</span>
          </div>
        ` : '<div style="font-size:12px;color:var(--text-muted)">결과 미입력</div>'}
        ${subjects.length > 0 ? `
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
            ${subjects.slice(0, 8).map(sub => `<span style="font-size:11px;padding:3px 8px;background:var(--bg-input);border-radius:10px;color:var(--text-secondary)">${sub.subject || sub}</span>`).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderDetailPhotos() {
  const d = _mentor.studentDetail;
  if (!d) return '';

  // dailyRecords에서 사진이 있는 class 기록 추출 + thumbnail 매칭
  const photoRecords = [];
  const allPhotos = {};
  // 모든 class record에서 사진 정보 수집
  (d.dailyRecords || []).forEach(day => {
    day.records.forEach(r => {
      if (r.type === 'class' && r._photoCount > 0) {
        (r._photoIds || []).forEach(pid => {
          photoRecords.push({ id: pid, date: day.date, subject: r.subject, keyword: r.keyword, content: r.content, period: r.period });
        });
      }
    });
  });

  if (photoRecords.length === 0) return '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-images" style="font-size:36px;margin-bottom:12px;display:block;opacity:0.3"></i>수업 기록 사진이 없습니다</div>';

  return `
    <div style="margin-bottom:12px;font-size:13px;color:var(--text-muted)">총 ${photoRecords.length}장의 수업 기록 사진</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px">
      ${photoRecords.map(pr => `
        <div class="stat-card" style="cursor:pointer;padding:12px;transition:all 0.2s;border:2px solid transparent" onclick="_mentorLoadPhoto(${pr.id})" onmouseenter="this.style.borderColor='var(--primary-light)'" onmouseleave="this.style.borderColor='transparent'">
          <div style="text-align:center;padding:24px;background:var(--bg-input);border-radius:10px;margin-bottom:8px">
            <i class="fas fa-camera" style="font-size:28px;color:var(--primary-light)"></i>
            <div style="font-size:11px;color:var(--primary-light);margin-top:6px;font-weight:600">클릭하여 보기</div>
          </div>
          <div style="font-size:13px;font-weight:700">${pr.subject || '과목미정'} ${pr.period ? `${pr.period}교시` : ''}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${pr.date}</div>
          ${pr.keyword ? `<div style="font-size:11px;color:var(--text-secondary);margin-top:4px">${(() => { try { return JSON.parse(pr.keyword).join(', '); } catch { return pr.keyword; } })()}</div>` : ''}
        </div>
      `).join('')}
    </div>
  `;
}

function renderDetailFeedback() {
  const d = _mentor.studentDetail;
  if (!d) return '';

  const feedbacks = d.feedbacks || [];
  const typeLabels = { class: '수업 기록', question: '질문', teach: '교학상장', assignment: '과제', exam: '시험', general: '전체', activity: '활동', report: '탐구', my_question: '질문방' };

  return `
    <!-- 피드백 작성 -->
    <div class="stat-card" style="margin-bottom:20px">
      <div style="font-weight:700;margin-bottom:8px">💬 새 피드백 작성</div>
      ${_mentor.feedbackRecordType !== 'general' ? `<div style="font-size:12px;color:var(--primary-light);margin-bottom:6px">📎 대상: ${typeLabels[_mentor.feedbackRecordType] || _mentor.feedbackRecordType} #${_mentor.feedbackRecordId || ''} <button onclick="_mentor.feedbackRecordType='general';_mentor.feedbackRecordId=null;renderScreen()" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:11px">✕ 취소</button></div>` : ''}
      <textarea id="m-fb-input" rows="3" placeholder="학생에게 보낼 피드백을 작성하세요..." style="width:100%;padding:10px 12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px;resize:vertical;font-family:inherit">${_mentor.feedbackDraft}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px">
        <button onclick="_mentorSaveFeedback()" class="btn-primary" style="width:auto;padding:8px 20px;font-size:13px">피드백 보내기</button>
      </div>
    </div>
    <!-- 기존 피드백 목록 -->
    <h4 style="margin-bottom:12px;color:var(--text-secondary)">보낸 피드백 (${feedbacks.length}건)</h4>
    ${feedbacks.length === 0 ? '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">아직 보낸 피드백이 없습니다</div>' :
      feedbacks.map(f => `
        <div class="coaching-note">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div class="coaching-note-date">${f.created_at?.slice(0,16) || ''} · ${typeLabels[f.record_type] || f.record_type}${f.record_id ? ' #' + f.record_id : ''}</div>
            <div style="display:flex;gap:8px;align-items:center">
              ${f.is_read ? '<span style="font-size:11px;color:var(--success)">✓ 읽음</span>' : '<span style="font-size:11px;color:var(--text-muted)">미읽음</span>'}
              <button onclick="_mentorDeleteFeedback(${f.id})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px" title="삭제">🗑</button>
            </div>
          </div>
          <div class="coaching-note-content" style="margin-top:6px">${f.content}</div>
        </div>
      `).join('')}
  `;
}

function renderPhotoModal() {
  return `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center" onclick="_mentor.photoViewId=null;_mentor.photoViewData=null;renderScreen()">
      <div style="max-width:90vw;max-height:90vh;position:relative" onclick="event.stopPropagation()">
        <button onclick="_mentor.photoViewId=null;_mentor.photoViewData=null;renderScreen()" style="position:absolute;top:-12px;right:-12px;width:32px;height:32px;border-radius:50%;background:var(--bg-card);border:1px solid var(--border);color:var(--text-main);font-size:16px;cursor:pointer;z-index:1;display:flex;align-items:center;justify-content:center">✕</button>
        ${_mentor.photoViewData
          ? `<img src="data:image/jpeg;base64,${_mentor.photoViewData}" style="max-width:90vw;max-height:85vh;border-radius:12px;object-fit:contain">`
          : '<div style="padding:40px;color:var(--text-muted);text-align:center"><i class="fas fa-spinner fa-spin" style="font-size:24px"></i><p style="margin-top:12px">사진 불러오는 중...</p></div>'}
      </div>
    </div>
  `;
}

// ==================== 릴레이단어장 (멘토) ====================

// 현재 선택된 그룹이 릴레이 대상인지 확인
async function _checkRelayEligibility() {
  _mentor._relayClassId = null;
  _mentor._relayClassName = '';
  const group = _mentor.groups.find(g => g.id === _mentor.selectedGroupId);
  if (!group || !group.external_class_id) return;
  // 원격 DB에서 해당 유저의 릴레이 대상 클래스 목록 가져오기
  const extUserId = state._authUser?.external_user_id || state._externalUserId;
  if (!extUserId) return;
  try {
    const res = await fetch(`/api/relay/classes?user_id=${extUserId}`);
    const data = await res.json();
    if (data.success && data.classes) {
      const match = data.classes.find(c => Number(c.class_id) === Number(group.external_class_id));
      if (match) {
        _mentor._relayClassId = Number(match.class_id);
        _mentor._relayClassName = match.class_name;
        console.log('[RELAY] Eligible: classId=', _mentor._relayClassId, match.class_name);
      }
    }
  } catch (e) { console.error('checkRelayEligibility:', e); }
}

// 릴레이단어장 데이터 로드
async function _loadRelayWordbook() {
  if (!_mentor._relayClassId) return;
  try {
    const res = await fetch(`/api/relay/wordbook?class_id=${_mentor._relayClassId}`);
    const data = await res.json();
    _mentor._relayWordbook = data.wordbook || null;
    _mentor._relayEntries = data.entries || [];
  } catch (e) { console.error('loadRelayWordbook:', e); }
  // 학생 목록도 로드
  try {
    const res = await fetch(`/api/relay/class-students?class_id=${_mentor._relayClassId}`);
    const data = await res.json();
    _mentor._relayClassStudents = data.students || [];
  } catch (e) { console.error('loadRelayClassStudents:', e); }
}

// 릴레이단어장 저장 (멘토)
async function _saveRelayWordbook(isReady) {
  const inputs = document.querySelectorAll('.relay-word-input');
  const words = [];
  inputs.forEach(inp => { if (inp.value.trim()) words.push(inp.value.trim()); });
  if (isReady && words.length < 40) {
    alert(`40개 단어를 모두 입력해야 완료할 수 있습니다. (현재 ${words.length}개)`);
    return;
  }
  const extUserId = state._authUser?.external_user_id || state._externalUserId;
  try {
    const res = await fetch('/api/relay/wordbook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        class_id: _mentor._relayClassId,
        words: words,
        is_ready: isReady,
        created_by: extUserId
      })
    });
    const data = await res.json();
    if (data.success) {
      await _loadRelayWordbook();
      renderScreen(true);
    } else {
      alert('저장 실패: ' + (data.error || ''));
    }
  } catch (e) { alert('저장 실패: ' + e.message); }
}

// 릴레이단어장 탭 렌더링 (멘토)
function __renderMentorRelay() {
  if (!_mentor._relayClassId) {
    return `<div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
      <div style="font-size:48px;margin-bottom:16px;opacity:0.3">📚</div>
      <p style="font-size:16px;margin-bottom:8px">릴레이단어장을 사용할 수 없습니다</p>
      <p style="font-size:13px">영어 클래스(genre_id=3)이고 학생(kind=2)이 15명 이상인 경우에만 사용 가능합니다</p>
    </div>`;
  }

  // 데이터 미로드 시 비동기 로드
  if (!_mentor._relayLoaded) {
    _mentor._relayLoaded = true;
    _loadRelayWordbook().then(() => renderScreen(true)).catch(() => renderScreen(true));
    return `<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="font-size:24px"></i><p style="margin-top:12px">릴레이단어장 로딩 중...</p></div>`;
  }

  const wb = _mentor._relayWordbook;
  const today = kstToday();

  // 단어장이 없거나 오늘 날짜가 아닌 경우 → 입력 화면
  if (!wb || wb.date !== today) {
    return _renderRelayWordInput([]);
  }

  // 단어장이 있지만 아직 ready가 아닌 경우 → 입력 화면 (기존 단어 표시)
  const words = typeof wb.words === 'string' ? JSON.parse(wb.words) : wb.words;
  if (!wb.is_ready) {
    return _renderRelayWordInput(words);
  }

  // ready 상태 → 학생 제출 현황
  return _renderRelaySubmissionStatus(words);
}

// 콤마 분리 자동 입력 처리
function _handleRelayWordCommaInput(inputEl) {
  const val = inputEl.value;
  if (!val.includes(',')) return;
  const inputs = Array.from(document.querySelectorAll('.relay-word-input'));
  const idx = inputs.indexOf(inputEl);
  if (idx < 0) return;
  const parts = val.split(',').map(s => s.trim()).filter(s => s);
  if (parts.length <= 1) return;
  // 첫 번째 단어는 현재 필드에, 나머지는 다음 필드들에 순서대로
  for (let i = 0; i < parts.length && (idx + i) < inputs.length; i++) {
    inputs[idx + i].value = parts[i];
  }
  // 마지막으로 입력된 필드의 다음 빈 필드로 포커스 이동
  const lastFilled = Math.min(idx + parts.length, inputs.length) - 1;
  const nextEmpty = inputs.findIndex((inp, j) => j > lastFilled && !inp.value.trim());
  if (nextEmpty >= 0) inputs[nextEmpty].focus();
  else if (lastFilled + 1 < inputs.length) inputs[lastFilled + 1].focus();
  // 입력 카운터 업데이트
  _updateRelayWordCount();
}
function _handleRelayWordPaste(e) {
  const paste = (e.clipboardData || window.clipboardData).getData('text');
  if (!paste.includes(',') && !paste.includes('\n') && !paste.includes('\t')) return;
  e.preventDefault();
  const inputEl = e.target;
  const inputs = Array.from(document.querySelectorAll('.relay-word-input'));
  const idx = inputs.indexOf(inputEl);
  if (idx < 0) return;
  // 콤마, 줄바꿈, 탭으로 분리
  const parts = paste.split(/[,\n\t]+/).map(s => s.trim()).filter(s => s);
  for (let i = 0; i < parts.length && (idx + i) < inputs.length; i++) {
    inputs[idx + i].value = parts[i];
  }
  const lastFilled = Math.min(idx + parts.length, inputs.length) - 1;
  const nextEmpty = inputs.findIndex((inp, j) => j > lastFilled && !inp.value.trim());
  if (nextEmpty >= 0) inputs[nextEmpty].focus();
  else if (lastFilled + 1 < inputs.length) inputs[lastFilled + 1].focus();
  _updateRelayWordCount();
}
function _updateRelayWordCount() {
  const cnt = document.querySelectorAll('.relay-word-input');
  const filled = Array.from(cnt).filter(i => i.value.trim()).length;
  const el = document.getElementById('relay-word-count');
  if (el) el.textContent = filled;
}

// 단어 입력 화면 (멘토)
function _renderRelayWordInput(existingWords) {
  const words = existingWords || [];
  let html = `
    <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <h3 style="font-size:18px;font-weight:700;color:var(--text-main);margin:0">📚 오늘의 릴레이단어장</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-top:4px">${_mentor._relayClassName} · ${kstToday()}</p>
      </div>
      <div style="display:flex;gap:8px">
        <button onclick="_saveRelayWordbook(false)" class="btn-secondary" style="padding:8px 16px;font-size:13px;border-radius:8px">
          <i class="fas fa-save" style="margin-right:4px"></i>임시저장
        </button>
        <button onclick="_saveRelayWordbook(true)" class="btn-primary" style="padding:8px 16px;font-size:13px;border-radius:8px">
          <i class="fas fa-check" style="margin-right:4px"></i>완료 (학생에게 공개)
        </button>
      </div>
    </div>
    <p style="font-size:11px;color:var(--text-muted);margin-bottom:8px;padding:0 4px">
      💡 <b>콤마(,)</b>로 구분하여 여러 단어를 한 번에 입력할 수 있습니다. (예: apple, banana, cat)
    </p>
    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px">
  `;
  for (let i = 0; i < 40; i++) {
    const v = words[i] || '';
    html += `
      <div style="display:flex;align-items:center;gap:8px;padding:6px 10px;background:var(--bg-input);border-radius:8px">
        <span style="font-size:12px;color:var(--text-muted);min-width:24px;text-align:right;font-weight:600">${i+1}</span>
        <input class="relay-word-input" type="text" value="${v}" placeholder="영어 단어 ${i+1}" 
          oninput="_handleRelayWordCommaInput(this)" onpaste="_handleRelayWordPaste(event)"
          style="flex:1;background:none;border:none;color:var(--text-main);font-size:14px;outline:none;padding:6px 0">
      </div>
    `;
  }
  html += `</div>
    <p style="text-align:center;margin-top:12px;font-size:12px;color:var(--text-muted)">
      입력된 단어: <span id="relay-word-count" style="color:var(--primary-light);font-weight:700">${words.filter(w=>w).length}</span> / 40
    </p>
  `;
  return html;
}

// 학생 제출 현황 (멘토)
function _renderRelaySubmissionStatus(words) {
  const entries = _mentor._relayEntries || [];
  const allStudents = _mentor._relayClassStudents || [];
  const finishedEntries = entries.filter(e => e.is_finished);
  const submittedIds = new Set(entries.map(e => Number(e.student_user_id)));
  const finishedIds = new Set(finishedEntries.map(e => Number(e.student_user_id)));
  const notSubmitted = allStudents.filter(s => !finishedIds.has(Number(s.user_id)));

  let html = `
    <div style="margin-bottom:16px;display:flex;align-items:center;justify-content:space-between">
      <div>
        <h3 style="font-size:18px;font-weight:700;color:var(--text-main);margin:0">📚 오늘의 릴레이단어장</h3>
        <p style="font-size:13px;color:var(--text-muted);margin-top:4px">${_mentor._relayClassName} · ${kstToday()} · 단어 ${words.length}개</p>
      </div>
      <div style="display:flex;align-items:center;gap:12px">
        <span style="font-size:14px;font-weight:700;color:var(--success)">✅ ${finishedEntries.length}명 제출</span>
        <span style="font-size:14px;color:var(--text-muted)">/ ${allStudents.length}명</span>
      </div>
    </div>

    <!-- 제출 완료 학생 -->
    <div style="margin-bottom:16px">
      <h4 style="font-size:14px;font-weight:700;color:var(--success);margin-bottom:8px">
        <i class="fas fa-check-circle" style="margin-right:4px"></i>제출 완료 (${finishedEntries.length}명)
      </h4>
      ${finishedEntries.length === 0 
        ? '<p style="font-size:13px;color:var(--text-muted);padding:12px;background:var(--bg-input);border-radius:8px">아직 제출한 학생이 없습니다</p>'
        : `<div style="display:flex;flex-wrap:wrap;gap:6px">
            ${finishedEntries.map((e, i) => {
              const time = e.finished_at ? e.finished_at.slice(11, 16) : '';
              return `<button onclick="_viewRelayStudentEntry(${_mentor._relayWordbook.id}, ${e.student_user_id}, '${(e.student_name||'').replace(/'/g,"\\'")}', '${JSON.stringify(words).replace(/'/g,"\\'")}')" 
                style="padding:6px 12px;background:var(--bg-input);border:1px solid var(--border-color);border-radius:8px;cursor:pointer;color:var(--text-main);font-size:13px;display:flex;align-items:center;gap:4px">
                <span style="color:var(--primary-light);font-weight:700;min-width:20px">${i+1}.</span>
                ${e.student_name}
                <span style="font-size:10px;color:var(--text-muted);margin-left:4px">${time}</span>
              </button>`;
            }).join('')}
          </div>`
      }
    </div>

    <!-- 미제출 학생 -->
    <div>
      <h4 style="font-size:14px;font-weight:700;color:var(--text-muted);margin-bottom:8px">
        <i class="fas fa-clock" style="margin-right:4px"></i>미제출 (${notSubmitted.length}명)
      </h4>
      ${notSubmitted.length === 0
        ? '<p style="font-size:13px;color:var(--success);padding:12px;background:rgba(34,197,94,0.1);border-radius:8px">🎉 모든 학생이 제출했습니다!</p>'
        : `<div style="display:flex;flex-wrap:wrap;gap:6px">
            ${notSubmitted.map(s => `
              <span style="padding:6px 12px;background:var(--bg-input);border-radius:8px;font-size:13px;color:var(--text-muted)">${s.name}</span>
            `).join('')}
          </div>`
      }
    </div>
    
    <!-- 오늘 등록된 단어 목록 -->
    <details style="margin-top:16px">
      <summary style="cursor:pointer;font-size:14px;font-weight:700;color:var(--text-secondary);padding:8px 0">📖 등록된 단어 보기 (${words.length}개)</summary>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin-top:8px">
        ${words.map((w, i) => `<span style="font-size:12px;color:var(--text-main);padding:4px 8px;background:var(--bg-input);border-radius:4px">${i+1}. ${w}</span>`).join('')}
      </div>
    </details>
  `;
  return html;
}

// 학생 제출 상세 보기 (멘토에서 학생 이름 클릭 시)
async function _viewRelayStudentEntry(wordbookId, studentUserId, studentName, wordsJson) {
  try {
    const res = await fetch(`/api/relay/student-entry-detail?wordbook_id=${wordbookId}&student_user_id=${studentUserId}`);
    const data = await res.json();
    const words = typeof wordsJson === 'string' ? JSON.parse(wordsJson) : wordsJson;
    const entry = data.entry;
    const entries = entry ? (typeof entry.entries === 'string' ? JSON.parse(entry.entries) : entry.entries) : [];

    let tbody = '';
    words.forEach((w, i) => {
      const meaning = entries[i] || '';
      tbody += `<tr style="border-bottom:1px solid var(--border-color)">
        <td style="padding:8px;font-size:13px;color:var(--text-muted);text-align:center;width:36px">${i+1}</td>
        <td style="padding:8px;font-size:14px;font-weight:600;color:var(--text-main)">${w}</td>
        <td style="padding:8px;font-size:14px;color:${meaning ? 'var(--text-main)' : 'var(--text-muted)'}">${meaning || '(미입력)'}</td>
      </tr>`;
    });

    const modal = document.createElement('div');
    modal.id = 'relay-student-modal';
    modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);z-index:10000;display:flex;align-items:center;justify-content:center';
    modal.innerHTML = `
      <div style="background:var(--bg-card);border-radius:16px;max-width:600px;width:90%;max-height:85vh;overflow-y:auto;padding:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h3 style="font-size:18px;font-weight:700;color:var(--text-main);margin:0">📚 ${studentName}의 단어장</h3>
          <button onclick="document.getElementById('relay-student-modal').remove()" style="background:none;border:none;color:var(--text-muted);font-size:20px;cursor:pointer"><i class="fas fa-times"></i></button>
        </div>
        <p style="font-size:12px;color:var(--text-muted);margin-bottom:12px">
          ${entry?.is_finished ? '✅ 제출 완료 · ' + (entry.finished_at || '') : '⏳ 작성 중'}
        </p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr style="background:var(--bg-input)">
            <th style="padding:8px;font-size:12px;color:var(--text-muted)">#</th>
            <th style="padding:8px;font-size:12px;color:var(--text-muted);text-align:left">영어 단어</th>
            <th style="padding:8px;font-size:12px;color:var(--text-muted);text-align:left">한글 뜻</th>
          </tr></thead>
          <tbody>${tbody}</tbody>
        </table>
      </div>
    `;
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  } catch (e) {
    alert('제출 내용 조회 실패: ' + e.message);
  }
}

// ==================== 전역 alias 매핑 (app.js 스텁과 연결) ====================
// app.js의 스텁 함수들이 _ (싱글) 접두사를 참조하므로, __ (더블) → _ (싱글) 매핑
var _mentorEnterStudentView = __mentorEnterStudentView;
var _mentorExitStudentView = __mentorExitStudentView;
var _renderMentorStudentViewer = __renderMentorStudentViewer;
var _renderMentorMyQaPanel = __renderMentorMyQaPanel;
var _mentorViewQuestion = __mentorViewQuestion;
var _renderMentorStudentDashboard = __renderMentorStudentDashboard;
var _mentorLoadGroups = __mentorLoadGroups;
var _mentorLoadGroupSummary = __mentorLoadGroupSummary;
var _mentorLoadStudentDetail = __mentorLoadStudentDetail;
var _mentorLoadPhoto = __mentorLoadPhoto;
var _mentorSaveFeedback = __mentorSaveFeedback;
var _mentorDeleteFeedback = __mentorDeleteFeedback;
var _renderMentorDashboard = __renderMentorDashboard;
var _renderMentorTabContent = __renderMentorTabContent;
var _renderMentorStudents = __renderMentorStudents;
var _renderMentorAlerts = __renderMentorAlerts;
var _renderMentorFeedback = __renderMentorFeedback;
var _renderMentorExams = __renderMentorExams;
var _renderMentorNetwork = __renderMentorNetwork;
var _renderMentorCroquet = __renderMentorCroquet;
var _renderMentorRelay = __renderMentorRelay;
var _renderMentorStudentDetail = __renderMentorStudentDetail;

