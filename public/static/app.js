/* ==============================
   고교학점플래너 CreditPlanner - Interactive Prototype v3
   학생 앱 UI 집중 리뉴얼
   ============================== */

// ==================== APP STATE ====================
const state = {
  mode: 'student',
  currentScreen: 'login',
  studentTab: 'home',
  mentorTab: 'students',
  directorTab: 'overview',
  // 인증 상태
  _authUser: null,
  _authToken: null,
  _authRole: null,
  _authGroup: null,
  _authMentorGroups: null,
  _loginError: '',
  _loginLoading: false,
  xp: 1240,
  level: 12,
  streak: 18,
  mood: null,
  selectedStudent: null,
  inputMode: 'keyword',
  _mentorFeedbacks: [], // 멘토 피드백 목록
  _mentorFeedbackUnread: 0, // 미읽음 피드백 수
  _classPhotos: [], // 수업 기록 사진 배열
  _recordGalleryFilter: '전체', // 수업 기록 갤러리 과목 필터
  _classAssignmentText: '', // 과제 내용
  _classAssignmentDue: '', // 과제 마감일 (YYYY-MM-DD)
  todayAcademyRecords: null, // 오늘 학원 수업 목록 (initTodayAcademy에서 자동 생성)
  todayRecords: [], // syncTodayRecords()에서 오늘 요일 기준으로 자동 생성
  missions: [
    { text: '수업 기록 3개 이상', icon: '📝', current: 0, target: 3, done: false },
    { text: '질문 1개 이상', icon: '❓', current: 0, target: 1, done: false },
    { text: '교학상장 도전!', icon: '🤝', current: 0, target: 1, done: false },
  ],
  weeklyData: {
    records: [4, 5, 6, 3, 5, 6, 2],
    questions: [1, 2, 1, 0, 2, 3, 1],
    days: ['월','화','수','목','금','토','일']
  },
  students: [
    { name: '김민준', grade: '2-3', today: '5/6', qLevel: 'B→C ↑', teach: 2, streak: 18, status: 'green', xp: 1240, level: 12 },
    { name: '이서연', grade: '2-3', today: '4/6', qLevel: 'A→B ↑', teach: 1, streak: 7, status: 'green', xp: 780, level: 8 },
    { name: '박지호', grade: '2-1', today: '3/6', qLevel: 'B 유지', teach: 0, streak: 3, status: 'yellow', xp: 520, level: 6 },
    { name: '정하은', grade: '2-3', today: '0/6', qLevel: '--', teach: 0, streak: 0, status: 'red', xp: 340, level: 4 },
    { name: '최윤서', grade: '2-2', today: '2/6', qLevel: 'B→A ↓', teach: 0, streak: 1, status: 'yellow', xp: 610, level: 7 },
    { name: '한도윤', grade: '2-1', today: '0/6', qLevel: '--', teach: 0, streak: 0, status: 'red', xp: 280, level: 3 },
    { name: '윤시우', grade: '2-2', today: '1/6', qLevel: 'A 유지', teach: 1, streak: 5, status: 'yellow', xp: 450, level: 5 },
    { name: '강예린', grade: '2-3', today: '6/6', qLevel: 'B→C ↑', teach: 3, streak: 25, status: 'green', xp: 1580, level: 14 },
    { name: '임준혁', grade: '2-1', today: '5/6', qLevel: 'B 유지', teach: 1, streak: 14, status: 'green', xp: 920, level: 10 },
    { name: '송채원', grade: '2-2', today: '4/6', qLevel: 'A→B ↑', teach: 2, streak: 10, status: 'green', xp: 860, level: 9 },
  ],
  notifications: [
    { icon: '🔔', title: '3교시 영어 끝!', desc: '지금 바로 기록해보세요', time: '방금 전', unread: true, bg: 'rgba(108,92,231,0.15)' },
    { icon: '🎯', title: '미션 완료 임박!', desc: '수업 기록 1개만 더하면 완료', time: '10분 전', unread: true, bg: 'rgba(255,215,0,0.15)' },
    { icon: '🏆', title: '이서연이 확인 완료', desc: '교학상장이 인정되었어요!', time: '1시간 전', unread: false, bg: 'rgba(0,184,148,0.15)' },
    { icon: '🔥', title: '18일 연속 스트릭!', desc: '대단해요! 최고 기록 갱신 중', time: '어제', unread: false, bg: 'rgba(255,99,71,0.15)' },
  ],
  // 과제 데이터
  assignments: [
    {
      id: 1,
      subject: '수학',
      title: '치환적분 연습문제 풀이',
      desc: '교재 p.142~148 연습문제 1~15번',
      type: '문제풀이',
      teacher: '김태호',
      dueDate: '2026-02-24',
      createdDate: '2026-02-18',
      color: '#6C5CE7',
      status: 'in-progress', // 'pending','in-progress','completed'
      progress: 60,
      plan: [
        { step: 1, title: '1~5번 기본 문제 풀기', date: '2/19', done: true },
        { step: 2, title: '6~10번 응용 문제 풀기', date: '2/20', done: true },
        { step: 3, title: '11~15번 심화 문제 풀기', date: '2/22', done: false },
        { step: 4, title: '오답 정리 및 복습', date: '2/23', done: false },
        { step: 5, title: '최종 점검 후 제출', date: '2/24', done: false },
      ]
    },
    {
      id: 3,
      subject: '과학',
      title: '산화환원 실험 보고서',
      desc: '실험 결과 분석 및 결론 도출, 그래프 포함',
      type: '보고서',
      teacher: '최은지',
      dueDate: '2026-02-26',
      createdDate: '2026-02-19',
      color: '#FDCB6E',
      status: 'pending',
      progress: 0,
      plan: [
        { step: 1, title: '실험 데이터 정리', date: '2/22', done: false },
        { step: 2, title: '그래프 작성', date: '2/23', done: false },
        { step: 3, title: '결과 분석 작성', date: '2/24', done: false },
        { step: 4, title: '결론 및 고찰', date: '2/25', done: false },
        { step: 5, title: '최종 검토 후 제출', date: '2/26', done: false },
      ]
    },
    {
      id: 4,
      subject: '국어',
      title: '윤동주 시 감상문',
      desc: '서시 감상문 원고지 3장 분량, 자아성찰 관점',
      type: '감상문',
      teacher: '박선영',
      dueDate: '2026-02-20',
      createdDate: '2026-02-16',
      color: '#FF6B6B',
      status: 'completed',
      progress: 100,
      plan: [
        { step: 1, title: '시 반복 읽기 & 핵심 정리', date: '2/17', done: true },
        { step: 2, title: '감상문 초안 작성', date: '2/18', done: true },
        { step: 3, title: '수정 및 퇴고', date: '2/19', done: true },
        { step: 4, title: '최종 제출', date: '2/20', done: true },
      ]
    },
  ],
  assignmentFilter: 'all', // 'all','in-progress','pending','completed'
  editingAssignment: null,
  viewingAssignment: null,
  // 시간표 데이터 (동적 관리)
  timetable: {
    // 기본 학교 시간표 (요일별 교시)
    school: [
      // [월, 화, 수, 목, 금]
      ['국어','수학','영어','과학','국어'],     // 1교시
      ['수학','영어','국어','수학','과학'],     // 2교시
      ['영어','과학','수학','국어','영어'],     // 3교시
      ['과학','국어','과학','영어','수학'],     // 4교시
      ['한국사','체육','미술','한국사','체육'], // 5교시
      ['체육','한국사','체육','미술','동아리'], // 6교시
      ['창체','','','',''],                    // 7교시
    ],
    // 과목별 선생님 매핑
    teachers: {
      '국어':'박선영','수학':'김태호','영어':'이정민','과학':'최은지',
      '한국사':'강민수','체육':'윤대현','미술':'김소연','동아리':'윤대현','창체':'강민수'
    },
    // 과목 색상
    subjectColors: {
      '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
      '한국사':'#74B9FF','체육':'#A29BFE','미술':'#FD79A8','동아리':'#00CEC9','창체':'#E17055'
    },
    // 교시별 시간
    periodTimes: [
      {start:'08:30',end:'09:20'}, // 1교시
      {start:'09:30',end:'10:20'}, // 2교시
      {start:'10:30',end:'11:20'}, // 3교시
      {start:'11:30',end:'12:20'}, // 4교시
      {start:'13:20',end:'14:10'}, // 5교시
      {start:'14:20',end:'15:10'}, // 6교시
      {start:'15:20',end:'16:10'}, // 7교시
    ],
    // 학원 스케줄 (그리드: 요일별 슬롯, 평일2/주말4 → 4칸 통일 표시)
    academy: [
      { id:'ac1', name:'수학 심화반', academy:'대치 수학학원', day:'월', slot:1, startTime:'18:00', endTime:'20:00', color:'#E056A0', subject:'수학', memo:'미적분 심화 과정' },
      { id:'ac2', name:'영어 독해반', academy:'YBM 어학원', day:'수', slot:1, startTime:'18:00', endTime:'19:30', color:'#00B894', subject:'영어', memo:'수능 독해 유형 분석' },
      { id:'ac3', name:'과학 실험반', academy:'메가스터디 과학관', day:'금', slot:1, startTime:'17:00', endTime:'19:00', color:'#FDCB6E', subject:'과학', memo:'물리 실험 + 보고서' },
      { id:'ac4', name:'국어 논술반', academy:'대성학원', day:'토', slot:1, startTime:'10:00', endTime:'12:00', color:'#FF6B6B', subject:'국어', memo:'수능 비문학 집중' },
      { id:'ac5', name:'수학 문제풀이', academy:'대치 수학학원', day:'토', slot:2, startTime:'13:00', endTime:'15:00', color:'#6C5CE7', subject:'수학', memo:'모의고사 기출 풀이' },
    ],
  },
  // 시간표 편집 상태
  editingTimetable: false,
  editingAcademy: null, // null or academy id
  selectedTtCell: null, // {period, dayIdx}
  selectedAcSlot: null, // {day, slot} 학원 그리드 선택
  viewingAcademyDetail: null, // academy id 상세보기
  // 급우(교학상장 대상) 목록 — 학생 관리에서 추가/삭제/편집
  classmates: [
    { id:'cm1', name:'이서연', grade:'2-3', memo:'수학 같이 공부' },
    { id:'cm2', name:'박지호', grade:'2-1', memo:'' },
    { id:'cm3', name:'정하은', grade:'2-3', memo:'' },
    { id:'cm4', name:'최윤서', grade:'2-2', memo:'' },
    { id:'cm5', name:'한도윤', grade:'2-1', memo:'' },
  ],
  // 비교과 활동 데이터
  extracurriculars: [
    { id:'ec1', type:'report', title:'치환적분 알고리즘 탐구', subject:'수학', status:'in-progress', progress:40, startDate:'2026-02-10', endDate:'2026-03-10', color:'#6C5CE7', desc:'치환적분의 판별 알고리즘을 파이썬으로 구현', memo:'역함수 관점 접근법 발견',
      // 탐구보고서 Phase 데이터
      report: {
        currentPhase: 1, // 0~4 (5 phases)
        phases: [
          { id:'p1', name:'주제 선정', status:'completed' },
          { id:'p2', name:'탐구 설계', status:'in-progress' },
          { id:'p3', name:'자료 수집', status:'locked' },
          { id:'p4', name:'분석/작성', status:'locked' },
          { id:'p5', name:'회고', status:'locked' },
        ],
        questions: [
          { text:'항생제 내성이 뭐지?', level:'A-1', axis:'curiosity', xp:8, phaseId:'p1', time:'2026-02-10T09:00:00', diag:{ specific_target:{met:false}, own_thinking:{met:false}, context_connection:{met:false} } },
          { text:'내성 유전자는 어떻게 전달돼?', level:'A-2', axis:'curiosity', xp:10, phaseId:'p1', time:'2026-02-11T14:00:00', diag:{ specific_target:{met:true}, own_thinking:{met:false}, context_connection:{met:false} } },
          { text:'왜 플라스미드가 주요 전달 매체인 거지? 교과서에서는 형질전환만 나오는데 실제로는 접합이 더 빈번한 것 같거든요', level:'B-1', axis:'curiosity', xp:15, phaseId:'p2', time:'2026-02-13T10:30:00', diag:{ specific_target:{met:true}, own_thinking:{met:true}, context_connection:{met:true} } },
        ],
        timeline: [],
        totalXp: 33,
      }
    },
    { id:'ec2', type:'report', title:'산화환원 반응속도 비교 실험', subject:'과학', status:'in-progress', progress:25, startDate:'2026-02-12', endDate:'2026-03-15', color:'#FDCB6E', desc:'다양한 조건에서 반응속도 비교 실험 및 보고서 작성', memo:'',
      report: {
        currentPhase: 0,
        phases: [
          { id:'p1', name:'주제 선정', status:'in-progress' },
          { id:'p2', name:'탐구 설계', status:'locked' },
          { id:'p3', name:'자료 수집', status:'locked' },
          { id:'p4', name:'분석/작성', status:'locked' },
          { id:'p5', name:'회고', status:'locked' },
        ],
        questions: [
          { text:'산화환원 반응에서 왜 반응속도가 달라지는 거지?', level:'A-1', axis:'curiosity', xp:8, phaseId:'p1', time:'2026-02-12T11:00:00', diag:{ specific_target:{met:false}, own_thinking:{met:false}, context_connection:{met:false} } },
        ],
        timeline: [],
        totalXp: 8,
      }
    },
    { id:'ec3', type:'reading', subType:'reading', title:'코스모스 (칼 세이건)', subject:'과학', status:'in-progress', progress:65, startDate:'2026-02-01', endDate:'2026-02-28', color:'#00B894', desc:'우주와 과학의 역사를 다룬 과학 교양서', memo:'3장까지 독서감상문 작성 완료',
      logs: [
        { date:'2026-02-14', content:'3장 "지구의 화합" 독서 완료 및 감상문 작성', reflection:'우주에서 바라본 지구의 의미를 다시 생각하게 됨', duration:'~50쪽' },
        { date:'2026-02-10', content:'2장 읽기 완료', reflection:'과학의 역사가 이렇게 흥미로운 줄 몰랐다', duration:'~30쪽' },
        { date:'2026-02-05', content:'1장 "코스모스의 해안" 읽기', reflection:'칼 세이건의 문체가 시적이라 감동받음', duration:'~30쪽' },
      ]
    },
    { id:'ec4', type:'reading', subType:'reading', title:'수학의 확실성 (모리스 클라인)', subject:'수학', status:'pending', progress:0, startDate:'2026-03-01', endDate:'2026-03-31', color:'#6C5CE7', desc:'수학 철학과 역사를 다룬 교양서', memo:'', logs:[] },
    { id:'ec5', type:'activity', subType:'club', title:'코딩동아리 (CodingLab)', subject:'정보', status:'in-progress', progress:50, startDate:'2026-03-01', endDate:'2026-12-31', color:'#E056A0', desc:'Python matplotlib 수학 그래프 시각화 프로젝트', memo:'sin, cos 합성파 표현', careerLink:'프로그래밍 + 수학 시각화 = 데이터 사이언스',
      logs: [
        { date:'2026-02-21', content:'Python matplotlib으로 sin, cos 합성파 그래프 시각화 완료', reflection:'코드로 수학을 표현하니까 함수의 성질이 더 직관적으로 이해됨', duration:'1시간' },
        { date:'2026-02-10', content:'프로젝트 기획 및 matplotlib 기본 문법 학습', reflection:'그래프 커스텀이 생각보다 쉬워서 놀랐다', duration:'1.5시간' },
      ]
    },
    { id:'ec6', type:'activity', subType:'career', title:'진로탐색 - 데이터사이언스 체험', subject:'진로', status:'completed', progress:100, startDate:'2026-02-05', endDate:'2026-02-05', color:'#FF9F43', desc:'대학 연계 데이터사이언스 1일 체험', memo:'머신러닝 기초 실습', careerLink:'데이터사이언스 → 인공지능 연구',
      logs: [
        { date:'2026-02-05', content:'대학 연계 데이터사이언스 1일 체험. 파이썬으로 iris 데이터 분류 실습', reflection:'머신러닝이 생각보다 접근하기 쉬웠고, 수학이 중요하다는 걸 체감', duration:'2시간+' },
      ]
    },
  ],
  // 플래너 상태
  plannerView: 'daily', // 'daily','weekly','monthly'
  plannerDate: '2026-02-21', // 현재 선택 날짜
  // 포트폴리오 상태
  portfolioPeriod: '1week', // '1week','2week','1month','custom'
  portfolioTab: 'all', // 'all','class','question','assignment','report','reading','activity'
  portfolioCustomStart: '2026-02-01',
  portfolioCustomEnd: '2026-02-28',
  plannerAiOpen: false,
  plannerAiMessages: [
    { role:'ai', text:'안녕 민준! 👋 플래너 정율 도우미예요. 일정 추가, 과제 계획 조정, 공부 시간 배분 등 무엇이든 도와줄게요!' },
  ],
  plannerAddOpen: false,
  // 통합 플래너 일정 데이터
  plannerItems: [
    // == 2/15 (토) ==
    { id:'p1', date:'2026-02-21', time:'07:00', endTime:'07:30', title:'기상 & 아침 루틴', category:'routine', color:'#A29BFE', icon:'☀️', done:true, aiGenerated:false },
    { id:'p2', date:'2026-02-21', time:'08:30', endTime:'09:20', title:'1교시 국어', category:'class', color:'#FF6B6B', icon:'📖', done:true, aiGenerated:false, detail:'윤동주 서시' },
    { id:'p3', date:'2026-02-21', time:'09:30', endTime:'10:20', title:'2교시 수학', category:'class', color:'#6C5CE7', icon:'📐', done:true, aiGenerated:false, detail:'치환적분' },
    { id:'p4', date:'2026-02-21', time:'10:30', endTime:'11:20', title:'3교시 영어', category:'class', color:'#00B894', icon:'🔤', done:false, aiGenerated:false, detail:'관계대명사' },
    { id:'p5', date:'2026-02-21', time:'11:30', endTime:'12:20', title:'4교시 과학', category:'class', color:'#FDCB6E', icon:'🔬', done:false, aiGenerated:false, detail:'산화환원' },
    { id:'p6', date:'2026-02-21', time:'13:20', endTime:'14:10', title:'5교시 한국사', category:'class', color:'#74B9FF', icon:'🏛️', done:false, aiGenerated:false },
    { id:'p7', date:'2026-02-21', time:'14:20', endTime:'15:10', title:'6교시 체육', category:'class', color:'#A29BFE', icon:'⚽', done:false, aiGenerated:false },
    { id:'p8', date:'2026-02-21', time:'15:30', endTime:'16:30', title:'[과제] 수학 11~15번 풀기', category:'assignment', color:'#6C5CE7', icon:'📋', done:false, aiGenerated:true, assignmentId:1, detail:'치환적분 연습문제 심화' },
    { id:'p10', date:'2026-02-21', time:'17:30', endTime:'18:30', title:'코딩동아리 프로젝트', category:'activity', color:'#00CEC9', icon:'💻', done:false, aiGenerated:false, detail:'Python 그래프 시각화' },
    { id:'p11', date:'2026-02-21', time:'19:00', endTime:'20:00', title:'수학 복습 & 질문 정리', category:'study', color:'#6C5CE7', icon:'📝', done:false, aiGenerated:true, detail:'치환적분 오답노트' },
    { id:'p12', date:'2026-02-21', time:'20:00', endTime:'20:30', title:'저녁 루틴 & 하루 마무리', category:'routine', color:'#A29BFE', icon:'🌙', done:false, aiGenerated:false },
    // == 2/16 (일) ==
    { id:'p14', date:'2026-02-22', time:'10:30', endTime:'12:00', title:'[탐구] 치환적분 알고리즘 탐구', category:'explore', color:'#FF6B6B', icon:'🔬', done:false, aiGenerated:true, detail:'멘토 제안 탐구 주제' },
    { id:'p15', date:'2026-02-22', time:'14:00', endTime:'15:30', title:'자유 독서 & 메모', category:'personal', color:'#636e72', icon:'📚', done:false, aiGenerated:false, detail:'진로 관련 도서' },
    { id:'p16', date:'2026-02-22', time:'16:00', endTime:'17:00', title:'이서연에게 수학 가르치기', category:'teach', color:'#00B894', icon:'🤝', done:false, aiGenerated:false, detail:'치환적분 복습' },
    // == 2/17 (월) ==
    { id:'p17', date:'2026-02-23', time:'08:30', endTime:'15:10', title:'학교 수업 (6교시)', category:'class', color:'#6C5CE7', icon:'🏫', done:false, aiGenerated:false },
    { id:'p18', date:'2026-02-23', time:'15:30', endTime:'17:00', title:'[과제] 과학 실험 데이터 정리', category:'assignment', color:'#FDCB6E', icon:'📋', done:false, aiGenerated:true, assignmentId:3 },
    // == 2/18 (화) ==
    { id:'p20', date:'2026-02-24', time:'08:30', endTime:'15:10', title:'학교 수업 (6교시)', category:'class', color:'#6C5CE7', icon:'🏫', done:false, aiGenerated:false },
    { id:'p22', date:'2026-02-24', time:'16:00', endTime:'17:30', title:'[과제] 수학 오답정리', category:'assignment', color:'#6C5CE7', icon:'📋', done:false, aiGenerated:true, assignmentId:1 },
    // == 2/19~20 ==
    { id:'p23', date:'2026-02-25', time:'15:30', endTime:'17:00', title:'[과제] 과학 그래프 작성', category:'assignment', color:'#FDCB6E', icon:'📋', done:false, aiGenerated:true, assignmentId:3 },
    { id:'p24', date:'2026-02-26', time:'08:30', endTime:'09:00', title:'[과제] 수학 최종제출 🚨', category:'assignment', color:'#6C5CE7', icon:'📋', done:false, aiGenerated:true, assignmentId:1, detail:'⚠️ 마감일!' },
  ],
  // ==================== 시험 관리 데이터 ====================
  exams: [
    {
      id: 'exam1', type: 'midterm', name: '1학기 중간고사', 
      startDate: '2026-04-21', endDate: '2026-04-25',
      subjects: [
        { subject: '수학', date: '2026-04-21', time: '1교시', range: '수학Ⅱ 1~3단원 (함수의 극한, 미분법, 적분법 기초)', readiness: 35, notes: '치환적분 집중 복습 필요', color: '#6C5CE7' },
        { subject: '국어', date: '2026-04-21', time: '2교시', range: '문학: 현대시 5작품, 비문학: 과학·기술 지문', readiness: 50, notes: '윤동주 시 감상 정리 완료', color: '#FF6B6B' },
        { subject: '영어', date: '2026-04-22', time: '1교시', range: '3~5과 본문, 관계대명사, 분사구문, 어휘 300개', readiness: 40, notes: '관계대명사 which/that 구분 연습', color: '#00B894' },
        { subject: '과학', date: '2026-04-22', time: '2교시', range: '화학Ⅰ 1~2단원 (원자구조, 화학결합, 산화환원)', readiness: 25, notes: '산화환원 반응식 암기', color: '#FDCB6E' },
        { subject: '한국사', date: '2026-04-23', time: '1교시', range: '근대 이후~일제강점기', readiness: 60, notes: '연표 정리 완료', color: '#74B9FF' },
      ],
      status: 'upcoming', // 'upcoming','in-progress','completed'
      aiPlan: null, // AI 생성 학습계획 저장
    },
    {
      id: 'exam2', type: 'performance', name: '수학 수행평가 (탐구보고서)',
      startDate: '2026-03-14', endDate: '2026-03-14',
      subjects: [
        { subject: '수학', date: '2026-03-14', time: '제출', range: '자유주제 탐구보고서 A4 5장 이상', readiness: 40, notes: '치환적분 알고리즘 주제로 진행 중', color: '#6C5CE7' },
      ],
      status: 'upcoming',
      aiPlan: null,
    },
    {
      id: 'exam3', type: 'mock', name: '3월 전국연합학력평가',
      startDate: '2026-03-06', endDate: '2026-03-06',
      subjects: [
        { subject: '국어', date: '2026-03-06', time: '1교시', range: '전 범위 (독서+문학+언어)', readiness: 45, notes: '', color: '#FF6B6B' },
        { subject: '수학', date: '2026-03-06', time: '2교시', range: '전 범위 (수Ⅰ+수Ⅱ)', readiness: 50, notes: '미적분 속도 연습', color: '#6C5CE7' },
        { subject: '영어', date: '2026-03-06', time: '3교시', range: '전 범위 (듣기+독해)', readiness: 55, notes: '', color: '#00B894' },
        { subject: '탐구', date: '2026-03-06', time: '4교시', range: '화학Ⅰ 전 범위', readiness: 30, notes: '', color: '#FDCB6E' },
      ],
      status: 'upcoming',
      aiPlan: null,
    },
  ],
  viewingExam: null, // 현재 보고 있는 시험 id
  examAddMode: false, // 시험 추가 모드
  examAiLoading: false, // 정율 학습계획 생성 중
  // 탐구보고서 상태
  viewingReport: null, // 현재 보고 있는 탐구보고서 ec id
  reportPhaseTab: 0, // 현재 선택된 Phase 탭 (0~4)
  reportViewMode: 'question', // 'question','timeline','growth','report'
  reportAiLoading: false,
  reportDiagResult: null, // 최근 질문 진단 결과
  reportAiResponse: null, // 최근 정율 멘토/검색 응답
  // 창의적 체험활동 통합 상태
  activityFilter: 'all', // 'all','club','career','self','report','reading'
  viewingActivity: null, // 현재 보고 있는 활동 ec id
  activityLogInput: {}, // 활동 기록 입력 임시 저장
  // 질문 코칭 과목 선택 상태
  _questionSubject: '수학', // 기본 선택 과목
  _questionText: '', // 사용자 입력 질문 텍스트 유지
};

// ==================== MAIN RENDER ====================

// 네이티브 모드 감지 (폰 프레임 없이 풀스크린으로 표시할 기기)
// PC 대형 모니터(1280px+)만 프로토타입 폰 프레임 표시
// devicePreview: null(자동), 'phone', 'tablet', 'pc'
let devicePreview = null;

function isNativeMode() {
  // 디바이스 프리뷰가 수동 설정된 경우: phone/tablet/tablet-landscape → native, pc → not native
  if (devicePreview === 'phone' || devicePreview === 'tablet' || devicePreview === 'tablet-landscape') return true;
  if (devicePreview === 'pc') return false;
  return window.innerWidth <= 1279;
}

function getDevicePreviewClass() {
  if (devicePreview === 'phone') return 'preview-phone';
  if (devicePreview === 'tablet') return 'preview-tablet';
  if (devicePreview === 'tablet-landscape') return 'preview-tablet-landscape';
  return 'preview-pc';
}

function renderScreen() {
  // renderScreen 전에 질문 입력 내용 보존
  const prevQuestionInput = document.getElementById('question-input');
  if (prevQuestionInput) {
    state._questionText = prevQuestionInput.value;
  }

  const container = document.getElementById('app-content');
  const tabletContent = document.getElementById('tablet-content');
  const deskContainer = document.getElementById('desktop-content');
  const phoneContainer = document.getElementById('phone-container');
  const tabletContainer = document.getElementById('tablet-container');
  const desktopContainer = document.getElementById('desktop-container');
  const modeHeader = document.getElementById('mode-header');
  const modeSelector = document.getElementById('mode-selector');
  const deviceSelector = document.getElementById('device-preview-selector');
  const native = isNativeMode();
  const isPreviewMode = devicePreview !== null;

  // 모드 선택 헤더/버튼/디바이스선택: PC에서만 표시 (또는 프리뷰 모드일 때), 학생뷰어에서는 숨김
  const hideControls = (native && !isPreviewMode) || state.mode === 'mentor-student-viewer';
  if (modeHeader) modeHeader.style.display = hideControls ? 'none' : 'flex';
  if (modeSelector) modeSelector.style.display = hideControls ? 'none' : 'flex';
  if (deviceSelector) deviceSelector.style.display = hideControls ? 'none' : 'flex';

  // 프리뷰 프레임 래퍼 관리
  let previewFrame = document.getElementById('device-preview-frame');
  if (isPreviewMode && (devicePreview === 'phone' || devicePreview === 'tablet' || devicePreview === 'tablet-landscape')) {
    // phone/tablet 프리뷰: tablet-container를 프리뷰 프레임 안에 배치
    if (!previewFrame) {
      previewFrame = document.createElement('div');
      previewFrame.id = 'device-preview-frame';
      tabletContainer.parentNode.insertBefore(previewFrame, tabletContainer);
    }
    previewFrame.className = getDevicePreviewClass();
    if (tabletContainer.parentNode !== previewFrame) {
      previewFrame.appendChild(tabletContainer);
    }
    previewFrame.style.display = 'flex';
  } else if (previewFrame) {
    // PC 모드 또는 실제 네이티브: 프리뷰 프레임 해제
    if (tabletContainer.parentNode === previewFrame) {
      previewFrame.parentNode.insertBefore(tabletContainer, previewFrame);
    }
    previewFrame.style.display = 'none';
  }

  if (state.mode === 'student') {
    desktopContainer.style.display = 'none';
    if (native) {
      phoneContainer.style.display = 'none';
      tabletContainer.style.display = 'flex';
      // 사이드바 렌더링 (로그인/온보딩 화면이 아닐 때만)
      const sidebarEl = document.getElementById('tablet-sidebar');
      const isAuthScreen = state.currentScreen === 'login' || state.currentScreen.startsWith('onboarding') || state.currentScreen === 'register-student' || state.currentScreen === 'register-mentor' || state.currentScreen === 'login-mentor';
      if (sidebarEl) {
        if (isAuthScreen) {
          sidebarEl.style.display = 'none';
          sidebarEl.innerHTML = '';
        } else {
          sidebarEl.style.display = 'flex';
          sidebarEl.innerHTML = renderSidebar();
          // 사이드바 네비 이벤트
          sidebarEl.querySelectorAll('.sidebar-nav-item').forEach(btn => {
            btn.addEventListener('click', () => {
              const tab = btn.dataset.tab;
              if (tab === 'myqa') {
                openMyQaIframe();
                return;
              }
              if (tab === 'community') {
                openCommunityNewTab();
                return;
              }
              state._communityOpened = false;
              state.studentTab = tab; 
              state.currentScreen = 'main'; 
              renderScreen(); 
            });
          });
        }
      }
      tabletContent.innerHTML = renderStudentApp();
      initStudentEvents(tabletContent);
      initAuthEvents(tabletContent);
      setTimeout(() => { if (state.currentScreen === 'growth-analysis') drawGrowthChart(); }, 50);
      setTimeout(() => { if (state.studentTab === 'my' && state.currentScreen === 'main') loadXpHistory(); }, 100);
      setTimeout(() => { const chat = document.getElementById('socrates-chat-area'); if (chat) bindAiGeneratedButtons(chat); }, 150);
      setTimeout(() => smartScrollTimetable(), 80);
    } else {
      phoneContainer.style.display = 'flex';
      tabletContainer.style.display = 'none';
      container.innerHTML = renderStudentApp();
      initStudentEvents(container);
      initAuthEvents(container);
      setTimeout(() => { if (state.currentScreen === 'growth-analysis') drawGrowthChart(); }, 50);
      setTimeout(() => { if (state.studentTab === 'my' && state.currentScreen === 'main') loadXpHistory(); }, 100);
      setTimeout(() => { const chat = document.getElementById('socrates-chat-area'); if (chat) bindAiGeneratedButtons(chat); }, 150);
      setTimeout(() => smartScrollTimetable(), 80);
    }
  } else if (state.mode === 'mentor') {
    phoneContainer.style.display = 'none';
    tabletContainer.style.display = 'none';
    desktopContainer.style.display = 'block';
    deskContainer.innerHTML = renderMentorDashboard();
    initMentorEvents();
  } else if (state.mode === 'mentor-student-viewer') {
    // 멘토가 학생 플래너를 열람: 데스크톱 대시보드 레이아웃
    phoneContainer.style.display = 'none';
    tabletContainer.style.display = 'none';
    desktopContainer.style.display = 'block';

    const sname = _mentor.viewerStudentName || '';
    const semoji = _mentor.viewerStudentEmoji || '🐻';

    if (_mentor.viewerLoading) {
      deskContainer.innerHTML = `
        <div class="msv-top-bar">
          <button onclick="mentorExitStudentView()" class="msv-back-btn"><i class="fas fa-arrow-left"></i> 학생 목록으로 돌아가기</button>
          <span class="msv-title-label">${semoji} ${sname} 학생의 플래너 <span class="msv-badge">👁 열람 모드</span></span>
        </div>
        <div style="text-align:center;padding:120px 20px;color:var(--text-muted)">
          <i class="fas fa-spinner fa-spin" style="font-size:48px;color:var(--primary-light)"></i>
          <p style="margin-top:20px;font-size:18px;font-weight:600">${sname} 학생 데이터를 불러오는 중...</p>
        </div>`;
    } else {
      deskContainer.innerHTML = renderMentorStudentDashboard();
      initMentorStudentDashboardEvents();
    }

    setTimeout(() => { drawGrowthChart(); }, 200);
    setTimeout(() => { loadXpHistory(); }, 250);
    setTimeout(() => { const chat = document.getElementById('socrates-chat-area'); if (chat) bindAiGeneratedButtons(chat); }, 300);
  } else {
    phoneContainer.style.display = 'none';
    tabletContainer.style.display = 'none';
    desktopContainer.style.display = 'block';
    deskContainer.innerHTML = renderDirectorDashboard();
    initDirectorEvents();
  }
}

// 화면 크기 변경 감지 → 자동 모드 전환
let _lastNative = isNativeMode();
let _lastOrientation = screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');

window.addEventListener('resize', () => {
  const nowNative = isNativeMode();
  const nowOrientation = screen.orientation?.type || (window.innerWidth > window.innerHeight ? 'landscape' : 'portrait');
  const orientationChanged = (nowOrientation.includes('landscape') !== _lastOrientation.includes('landscape'));
  
  if (nowNative !== _lastNative || orientationChanged) {
    _lastNative = nowNative;
    _lastOrientation = nowOrientation;
    renderScreen();
  }
});

// orientation change 이벤트 (모바일/태블릿 전용)
if (screen.orientation) {
  screen.orientation.addEventListener('change', () => {
    _lastOrientation = screen.orientation.type;
    // 약간의 딜레이 후 렌더링 (새 뷰포트 안정화 대기)
    setTimeout(() => renderScreen(), 100);
  });
} else {
  // fallback: orientationchange
  window.addEventListener('orientationchange', () => {
    setTimeout(() => {
      _lastOrientation = window.innerWidth > window.innerHeight ? 'landscape' : 'portrait';
      renderScreen();
    }, 200);
  });
}

// ==================== STUDENT APP ROUTER ====================

function renderStudentApp() {
  if (state.currentScreen.startsWith('onboarding')) return renderOnboarding();
  if (state.currentScreen === 'login') return renderLoginScreen();
  if (state.currentScreen === 'register-student') return renderStudentRegister();
  if (state.currentScreen === 'register-mentor') return renderMentorRegister();
  if (state.currentScreen === 'login-mentor') return renderMentorLogin();
  if (state.currentScreen === 'record-class') return renderRecordClass();
  if (state.currentScreen === 'record-question') return renderRecordQuestion();
  if (state.currentScreen === 'record-teach') return renderRecordTeach();
  if (state.currentScreen === 'record-activity') return renderRecordActivity();
  if (state.currentScreen === 'class-end-popup') return renderClassEndPopup();
  if (state.currentScreen === 'academy-record-popup') return renderAcademyRecordPopup();
  if (state.currentScreen === 'evening-routine') return renderEveningRoutine();
  if (state.currentScreen === 'weekly-report') return renderWeeklyReportStudent();
  if (state.currentScreen === 'record-history') return renderRecordHistory();
  if (state.currentScreen === 'notifications') return renderNotifications();
  if (state.currentScreen === 'croquet-history') return renderCroquetHistory();
  if (state.currentScreen === 'aha-report') return renderAhaReport();
  if (state.currentScreen === 'record-assignment') return renderRecordAssignment();
  if (state.currentScreen === 'assignment-plan') return renderAssignmentPlan();
  if (state.currentScreen === 'assignment-list') return renderAssignmentList();
  if (state.currentScreen === 'planner-add') return renderPlannerAddItem();
  if (state.currentScreen === 'timetable-manage') return renderTimetableManage();
  if (state.currentScreen === 'academy-add') return renderAcademyAdd();
  if (state.currentScreen === 'classmate-manage') return renderClassmateManage();
  if (state.currentScreen === 'portfolio') return renderPortfolio();
  if (state.currentScreen === 'exam-list') return renderExamList();
  if (state.currentScreen === 'exam-detail') return renderExamDetail();
  if (state.currentScreen === 'exam-add') return renderExamAdd();
  if (state.currentScreen === 'exam-result-input') return renderExamResultInput();
  if (state.currentScreen === 'exam-report') return renderExamReport();
  if (state.currentScreen === 'growth-analysis') return renderGrowthAnalysis();
  if (state.currentScreen === 'report-project') return renderReportProject();
  if (state.currentScreen === 'report-add') return renderReportAdd();
  if (state.currentScreen === 'activity-detail') return renderActivityDetail();
  if (state.currentScreen === 'activity-add') return renderActivityAdd();
  if (state.currentScreen === 'record-schoolrecord') return renderSchoolRecord();
  if (state.currentScreen === 'class-record-edit') return renderClassRecordEdit();
  if (state.currentScreen === 'class-record-history') return renderClassRecordHistory();
  if (state.currentScreen === 'class-record-detail') return renderClassRecordDetail();
  if (state.currentScreen === 'record-status') return renderRecordStatus();
  if (state.currentScreen === 'mentor-feedback') return renderStudentFeedbackScreen();

  let content = '';
  content += renderXpBar();
  switch(state.studentTab) {
    case 'home': content += renderHomeTab(); break;
    case 'record': content += renderRecordTab(); break;
    case 'planner': content += renderPlannerTab(); break;
    case 'growth': content += renderGrowthTab(); break;
    case 'myqa': content += '<div class="tab-content animate-in" style="display:flex;align-items:center;justify-content:center;min-height:60vh"><div style="text-align:center"><div style="font-size:48px;margin-bottom:16px">❓</div><div style="font-size:16px;font-weight:700;color:var(--text-primary);margin-bottom:8px">나만의 질문방</div><div style="font-size:13px;color:var(--text-muted);margin-bottom:20px">질문방을 여는 중입니다...</div></div></div>'; setTimeout(()=>openMyQaIframe(),100); break;
    case 'my': content += renderMyTab(); break;
    case 'community': content += renderCommunityTab(); break;
  }
  content += renderFab();
  // AI 플로팅 어시스턴트 (플래너 탭에서 항상 노출)
  if (state.studentTab === 'planner' && state.currentScreen === 'main') {
    content += renderPlannerAiFloat();
  }
  return content;
}

// ==================== XP BAR ====================
function renderXpBar() {
  const nextLevelXp = 1500;
  const pct = Math.min((state.xp / nextLevelXp * 100), 100).toFixed(0);
  return `
    <div class="xp-bar-container">
      <span class="xp-level">Lv.${state.level}</span>
      <div class="xp-bar"><div class="xp-bar-fill" style="width:${pct}%"></div></div>
      <span class="xp-text">${state.xp.toLocaleString()}/${nextLevelXp.toLocaleString()}</span>
      <span class="streak-badge">🔥${state.streak}</span>
    </div>
  `;
}

// ==================== SIDEBAR NAVIGATION (오르조 스타일) ====================
function renderSidebar() {
  const tabs = [
    { id:'home', icon:'fa-house', label:'홈', emoji:'🏠' },
    { id:'record', icon:'fa-pen-to-square', label:'기록', emoji:'✏️' },
    { id:'planner', icon:'fa-calendar-check', label:'플래너', emoji:'📅' },
    { id:'growth', icon:'fa-chart-line', label:'성장', emoji:'📈' },
    { id:'myqa', icon:'fa-circle-question', label:'내 질문', emoji:'❓' },
    { id:'my', icon:'fa-user', label:'마이', emoji:'👤' },
    { id:'community', icon:'fa-comments', label:'커뮤니티', emoji:'💬' },
  ];

  const userName = state._authUser?.name || '학생';
  const doneCount = state.todayRecords.filter(r => r.done).length;
  const total = state.todayRecords.length;
  const unrecordedCount = countUnrecordedEndedClasses();

  return `
    <div class="sidebar">
      <!-- 로고 영역 -->
      <div class="sidebar-logo">
        <img src="/static/logo.png" alt="정율사관학원" class="sidebar-logo-img">
      </div>

      <!-- 메인 네비게이션 -->
      <nav class="sidebar-nav">
        ${tabs.map(t => `
          <button class="sidebar-nav-item ${state.studentTab===t.id?'active':''}" data-tab="${t.id}">
            <i class="fas ${t.icon}"></i>
            <span class="sidebar-nav-label">${t.label}</span>
            ${t.id === 'record' && unrecordedCount > 0 ? `<span class="sidebar-badge">${unrecordedCount}</span>` : ''}
            ${t.id === 'myqa' && state.myQaStats?.unanswered > 0 ? `<span class="sidebar-badge" style="background:var(--accent)">${state.myQaStats.unanswered}</span>` : ''}
          </button>
        `).join('')}
      </nav>

      <!-- 하단 정보 영역 -->
      <div class="sidebar-footer">
        <div class="sidebar-user">
          <span class="sidebar-user-emoji">${state._authUser?.emoji || '🐻'}</span>
          <span class="sidebar-user-name">${userName}</span>
        </div>
        <div class="sidebar-xp">
          <span class="sidebar-xp-level">Lv.${state.level}</span>
          <div class="sidebar-xp-bar"><div class="sidebar-xp-fill" style="width:${Math.min(state.xp/1500*100,100).toFixed(0)}%"></div></div>
        </div>
        <div class="sidebar-streak">🔥 ${state.streak}일 연속</div>
        ${state._authUser ? `<button class="sidebar-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i><span>로그아웃</span></button>` : ''}
      </div>
    </div>
  `;
}

function renderFab() {
  // 플래너 탭에서는 AI FAB가 대신 표시됨, 기록/내질문 탭에서는 이미 메뉴가 있으므로 불필요
  if (state.studentTab === 'planner' || state.studentTab === 'record' || state.studentTab === 'myqa' || state.studentTab === 'community') return '';
  return `<button class="fab" id="fab-btn"><i class="fas fa-plus"></i></button>`;
}

// ==================== ONBOARDING (S-01 ~ S-05) ====================

function renderOnboarding() {
  switch(state.currentScreen) {
    case 'onboarding-welcome': return renderOnboardingWelcome();
    case 'onboarding-info': return renderOnboardingInfo();
    case 'onboarding-career': return renderOnboardingCareer();
    case 'onboarding-timetable': return renderOnboardingTimetable();
    case 'onboarding-guide': return renderOnboardingGuide();
  }
}

function renderOnboardingWelcome() {
  return `
    <div class="onboarding-screen animate-in">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center">
        <div class="onboarding-logo">
          <img src="/static/logo.png" alt="정율사관학원" class="onboarding-logo-img">
          <h2>고교학점플래너</h2>
          <p>HS CreditPlanner</p>
        </div>
        <p style="text-align:center;color:var(--text-secondary);font-size:15px;line-height:1.8;margin-bottom:40px">
          고교학점제 시대,<br>
          <strong style="color:var(--text-primary)">학교생활의 모든 순간</strong>을 기록하고<br>
          <strong style="color:var(--primary-light)">생기부 경쟁력</strong>으로 만드세요
        </p>
        <div class="field-group" style="width:100%">
          <label class="field-label">초대 코드를 입력하세요</label>
          <input class="input-field" placeholder="JYCC-2025-XXXX" value="JYCC-2025-0314" style="text-align:center;font-size:16px;font-weight:600;letter-spacing:2px">
        </div>
      </div>
      <button class="btn-primary btn-glow" onclick="goScreen('onboarding-info')">
        시작하기 <i class="fas fa-arrow-right" style="margin-left:8px"></i>
      </button>
    </div>
  `;
}

function renderOnboardingInfo() {
  return `
    <div class="onboarding-screen animate-slide">
      <div class="onboarding-progress"><div class="onboarding-progress-fill" style="width:25%"></div></div>
      <span class="onboarding-step">1/4 기본 정보</span>
      <h1 class="onboarding-title">반갑습니다! 👋</h1>
      <p class="onboarding-desc">고교학점플래너를 시작하기 위한 기본 정보를 입력해주세요.</p>
      <div class="field-group">
        <label class="field-label">이름</label>
        <input class="input-field" placeholder="이름을 입력하세요" value="김민준">
      </div>
      <div class="field-group">
        <label class="field-label">학교</label>
        <div class="input-with-icon">
          <i class="fas fa-search"></i>
          <input class="input-field" placeholder="학교명 검색" value="정율고등학교" style="padding-left:40px">
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">학년</label>
        <div style="display:flex;gap:8px">
          <button class="grid-select-btn" style="flex:1">1학년</button>
          <button class="grid-select-btn active" style="flex:1">2학년</button>
          <button class="grid-select-btn" style="flex:1">3학년</button>
        </div>
      </div>
      <div class="field-group">
        <label class="field-label">반</label>
        <input class="input-field" placeholder="반" value="3반" style="width:120px">
      </div>
      <div style="flex:1"></div>
      <button class="btn-primary" onclick="goScreen('onboarding-career')">다음 <i class="fas fa-arrow-right" style="margin-left:6px"></i></button>
    </div>
  `;
}

function renderOnboardingCareer() {
  const fields = [
    {name:'인문', icon:'📚'}, {name:'사회', icon:'🌍'}, {name:'상경', icon:'💰'},
    {name:'자연', icon:'🔬'}, {name:'공학', icon:'⚙️'}, {name:'의약', icon:'🏥'},
    {name:'예체능', icon:'🎨'}, {name:'교육', icon:'👩‍🏫'}, {name:'탐색중', icon:'🔍'}
  ];
  return `
    <div class="onboarding-screen animate-slide">
      <div class="onboarding-progress"><div class="onboarding-progress-fill" style="width:50%"></div></div>
      <span class="onboarding-step">2/4 진로 방향</span>
      <h1 class="onboarding-title">어떤 분야에 관심 있나요? 🎯</h1>
      <p class="onboarding-desc">관심 계열을 선택하세요. 나중에 바꿀 수 있어요.</p>
      <div class="career-grid">
        ${fields.map((f,i) => `
          <button class="career-btn ${i===4?'active':''}" style="animation-delay:${i*0.04}s">
            <span class="career-icon">${f.icon}</span>
            <span class="career-name">${f.name}</span>
          </button>
        `).join('')}
      </div>
      <div class="field-group" style="margin-top:24px">
        <label class="field-label">관심 학과 (선택)</label>
        <input class="input-field" placeholder="예: 컴퓨터공학과" value="컴퓨터공학과">
      </div>
      <div style="flex:1"></div>
      <button class="btn-primary" onclick="goScreen('onboarding-timetable')">다음 <i class="fas fa-arrow-right" style="margin-left:6px"></i></button>
    </div>
  `;
}

function renderOnboardingTimetable() {
  const days = ['월','화','수','목','금'];
  const subjects = [
    ['국어','수학','영어','과학','국어'],
    ['수학','영어','국어','수학','과학'],
    ['영어','과학','수학','국어','영어'],
    ['과학','국어','과학','영어','수학'],
    ['한국사','체육','미술','한국사','체육'],
    ['체육','한국사','체육','미술','동아리'],
    ['창체','','','',''],
  ];
  const subjectColors = {
    '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
    '한국사':'#74B9FF','체육':'#A29BFE','미술':'#FD79A8','동아리':'#00CEC9','창체':'#E17055'
  };
  return `
    <div class="onboarding-screen animate-slide">
      <div class="onboarding-progress"><div class="onboarding-progress-fill" style="width:75%"></div></div>
      <span class="onboarding-step">3/4 시간표</span>
      <h1 class="onboarding-title">시간표를 등록하세요 📋</h1>
      <p class="onboarding-desc">빈 칸을 터치하면 과목을 선택할 수 있어요.</p>
      <div class="tt-editor">
        <div class="tt-editor-header"></div>
        ${days.map(d => `<div class="tt-editor-header">${d}</div>`).join('')}
        ${subjects.map((row, i) => `
          <div class="tt-editor-period">${i+1}</div>
          ${row.map(s => `
            <div class="tt-editor-cell ${s?'filled':''}" ${s?`style="background:${subjectColors[s]||'var(--bg-input)'}22;color:${subjectColors[s]||'var(--text-secondary)'};border-color:${subjectColors[s]||'var(--border)'}44"`:''}>
              ${s||'<i class="fas fa-plus" style="font-size:9px;opacity:0.3"></i>'}
            </div>
          `).join('')}
        `).join('')}
      </div>
      <div style="flex:1"></div>
      <button class="btn-primary" onclick="goScreen('onboarding-guide')" style="margin-top:20px">다음 <i class="fas fa-arrow-right" style="margin-left:6px"></i></button>
    </div>
  `;
}

function renderOnboardingGuide() {
  return `
    <div class="onboarding-screen animate-slide">
      <div class="onboarding-progress"><div class="onboarding-progress-fill" style="width:100%"></div></div>
      <span class="onboarding-step">4/4 시작 가이드</span>
      <h1 class="onboarding-title">이렇게 쓰면 돼요! ✨</h1>
      <p class="onboarding-desc">오늘 기록한 한 줄이, 3년 후 생기부의 한 문장이 됩니다.</p>
      
      <div class="guide-card stagger-1 animate-in">
        <div class="guide-icon-circle" style="background:rgba(108,92,231,0.15)">📝</div>
        <div class="guide-content">
          <h3>수업 끝나면 30초 기록</h3>
          <p>음성, 사진, 키워드 중 편한 방법으로</p>
        </div>
      </div>
      <div class="guide-card stagger-2 animate-in">
        <div class="guide-icon-circle" style="background:rgba(255,107,107,0.15)">❓</div>
        <div class="guide-content">
          <h3>질문이 있었다면 기록</h3>
          <p>정율이 2축 9단계로 질문을 코칭해줘요</p>
        </div>
      </div>
      <div class="guide-card stagger-3 animate-in">
        <div class="guide-icon-circle" style="background:rgba(0,184,148,0.15)">🤝</div>
        <div class="guide-content">
          <h3>친구에게 가르쳤다면 기록</h3>
          <p>교학상장! 가르치면서 배운 것이 세특의 보석</p>
        </div>
      </div>

      <div style="flex:1"></div>
      <div class="guide-bottom-hint">
        <span>🎮</span> 기록할수록 XP가 쌓이고 레벨이 올라가요!
      </div>
      <button class="btn-primary btn-glow" onclick="state.currentScreen='main';state.studentTab='home';renderScreen()">
        알겠어요, 시작! 🎉
      </button>
    </div>
  `;
}

// ==================== LOGIN / REGISTER SCREENS ====================

function renderLoginScreen() {
  // URL 파라미터에서 초대코드 확인 (예: ?code=JYCC-X2Z8-2ND7)
  const urlParams = new URLSearchParams(window.location.search);
  const urlInviteCode = urlParams.get('code') || urlParams.get('invite') || '';
  // 이전에 저장된 초대코드 자동 채우기
  const savedAuth = (() => { try { return JSON.parse(localStorage.getItem('cp_auth') || '{}'); } catch { return {}; } })();
  const savedInviteCode = urlInviteCode || savedAuth.inviteCode || savedAuth.group?.inviteCode || '';
  
  // 기본 초대코드 (멘토가 학생에게 공유용)
  const DEFAULT_INVITE_CODE = 'JYCC-X2Z8-2ND7';
  const showInviteCode = savedInviteCode || DEFAULT_INVITE_CODE;
  return `
    <div class="onboarding-screen animate-in">
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;align-items:center">
        <div class="onboarding-logo">
          <img src="/static/logo.png" alt="정율사관학원" class="onboarding-logo-img">
          <h2>고교학점플래너</h2>
          <p>HS CreditPlanner</p>
        </div>
        <p style="text-align:center;color:var(--text-secondary);font-size:15px;line-height:1.8;margin-bottom:32px">
          고교학점제 시대,<br>
          <strong style="color:var(--text-primary)">학교생활의 모든 순간</strong>을 기록하고<br>
          <strong style="color:var(--primary-light)">생기부 경쟁력</strong>으로 만드세요
        </p>

        ${state._loginError ? `<div style="background:rgba(255,107,107,0.15);color:#FF6B6B;padding:10px 16px;border-radius:10px;font-size:13px;margin-bottom:16px;width:100%;text-align:center">${state._loginError}</div>` : ''}

        <div style="background:linear-gradient(135deg,rgba(99,102,241,0.12),rgba(139,92,246,0.12));border:1px solid rgba(99,102,241,0.25);border-radius:12px;padding:12px 16px;margin-bottom:20px;width:100%;text-align:center">
          <div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">📋 정율사관학원 초대코드</div>
          <div style="font-size:18px;font-weight:700;color:var(--primary-light);letter-spacing:3px;font-family:monospace">${DEFAULT_INVITE_CODE}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:4px">이름과 비밀번호만 입력하면 로그인!</div>
        </div>

        <div class="field-group" style="width:100%">
          <label class="field-label">초대 코드</label>
          <input class="input-field" id="login-invite-code" placeholder="JYCC-XXXX-XXXX" value="${showInviteCode}" style="text-align:center;font-size:16px;font-weight:600;letter-spacing:2px" autocomplete="off">
        </div>
        <div class="field-group" style="width:100%">
          <label class="field-label">이름 (가입할 때 입력한 이름)</label>
          <input class="input-field" id="login-name" placeholder="홍길동" style="font-size:15px">
        </div>
        <div class="field-group" style="width:100%">
          <label class="field-label">비밀번호</label>
          <input class="input-field" id="login-password" type="password" placeholder="비밀번호 입력" style="font-size:15px">
        </div>
      </div>

      <button class="btn-primary btn-glow" id="btn-student-login" style="width:100%;margin-bottom:10px" ${state._loginLoading ? 'disabled' : ''}>
        ${state._loginLoading ? '<i class="fas fa-spinner fa-spin"></i> 로그인 중...' : '로그인 <i class="fas fa-arrow-right" style="margin-left:8px"></i>'}
      </button>
      <button class="btn-secondary" id="btn-go-register" style="width:100%;margin-bottom:10px">
        처음이에요? 회원가입
      </button>
      <div style="text-align:center;margin-top:4px">
        <button style="background:none;border:none;color:var(--text-muted);font-size:12px;cursor:pointer;text-decoration:underline" id="btn-go-mentor-login">
          선생님이신가요?
        </button>
      </div>
    </div>
  `;
}

function renderStudentRegister() {
  // URL 파라미터 또는 기본 초대코드
  const urlParams = new URLSearchParams(window.location.search);
  const urlCode = urlParams.get('code') || urlParams.get('invite') || '';
  const DEFAULT_INVITE_CODE = 'JYCC-X2Z8-2ND7';
  const prefillCode = urlCode || DEFAULT_INVITE_CODE;
  return `
    <div class="onboarding-screen animate-slide">
      <div class="screen-header" style="padding:0 0 16px 0">
        <button class="back-btn" onclick="state._loginError='';goScreen('login')"><i class="fas fa-arrow-left"></i></button>
        <h1 style="font-size:18px">학생 회원가입</h1>
      </div>

      ${state._loginError ? `<div style="background:rgba(255,107,107,0.15);color:#FF6B6B;padding:10px 16px;border-radius:10px;font-size:13px;margin-bottom:16px;text-align:center">${state._loginError}</div>` : ''}

      <div style="background:linear-gradient(135deg,rgba(34,197,94,0.12),rgba(16,185,129,0.12));border:1px solid rgba(34,197,94,0.25);border-radius:12px;padding:10px 16px;margin-bottom:16px;text-align:center">
        <div style="font-size:11px;color:var(--text-muted);margin-bottom:2px">✅ 초대코드가 자동으로 입력되었어요</div>
        <div style="font-size:15px;font-weight:700;color:#22c55e;letter-spacing:2px;font-family:monospace">${prefillCode}</div>
      </div>

      <div class="field-group">
        <label class="field-label">초대 코드 <span style="color:#FF6B6B">*</span></label>
        <input class="input-field" id="reg-invite-code" placeholder="선생님이 알려준 코드" value="${prefillCode}" style="text-align:center;font-size:16px;font-weight:600;letter-spacing:2px">
        <div id="invite-code-status" style="font-size:12px;margin-top:4px;min-height:18px"></div>
      </div>
      <div class="field-group">
        <label class="field-label">이름 <span style="color:#FF6B6B">*</span></label>
        <input class="input-field" id="reg-name" placeholder="실명을 입력하세요">
      </div>
      <div class="field-group">
        <label class="field-label">비밀번호 <span style="color:#FF6B6B">*</span></label>
        <input class="input-field" id="reg-password" type="password" placeholder="4자 이상">
      </div>
      <div class="field-group">
        <label class="field-label">비밀번호 확인 <span style="color:#FF6B6B">*</span></label>
        <input class="input-field" id="reg-password2" type="password" placeholder="비밀번호 다시 입력">
      </div>
      <div class="field-group">
        <label class="field-label">학교명</label>
        <input class="input-field" id="reg-school" placeholder="예: 정율고등학교">
      </div>
      <div class="field-group">
        <label class="field-label">학년</label>
        <div style="display:flex;gap:8px">
          <button class="grid-select-btn reg-grade-btn active" data-grade="1" style="flex:1">1학년</button>
          <button class="grid-select-btn reg-grade-btn" data-grade="2" style="flex:1">2학년</button>
          <button class="grid-select-btn reg-grade-btn" data-grade="3" style="flex:1">3학년</button>
        </div>
      </div>

      <div style="flex:1"></div>
      <button class="btn-primary btn-glow" id="btn-student-register" style="width:100%;margin-top:16px" ${state._loginLoading ? 'disabled' : ''}>
        ${state._loginLoading ? '<i class="fas fa-spinner fa-spin"></i> 가입 중...' : '가입하기 🎉'}
      </button>
    </div>
  `;
}

function renderMentorLogin() {
  return `
    <div class="onboarding-screen animate-slide">
      <div class="screen-header" style="padding:0 0 16px 0">
        <button class="back-btn" onclick="state._loginError='';goScreen('login')"><i class="fas fa-arrow-left"></i></button>
        <h1 style="font-size:18px">멘토 로그인</h1>
      </div>

      ${state._loginError ? `<div style="background:rgba(255,107,107,0.15);color:#FF6B6B;padding:10px 16px;border-radius:10px;font-size:13px;margin-bottom:16px;text-align:center">${state._loginError}</div>` : ''}

      <div style="text-align:center;margin-bottom:24px">
        <span style="font-size:48px">👨‍🏫</span>
        <p style="color:var(--text-secondary);font-size:13px;margin-top:8px">선생님 전용 로그인</p>
      </div>

      <div class="field-group">
        <label class="field-label">아이디</label>
        <input class="input-field" id="mentor-login-id" placeholder="멘토 아이디" autocomplete="username">
      </div>
      <div class="field-group">
        <label class="field-label">비밀번호</label>
        <input class="input-field" id="mentor-login-pw" type="password" placeholder="비밀번호" autocomplete="current-password">
      </div>

      <div style="flex:1"></div>
      <button class="btn-primary" id="btn-mentor-login" style="width:100%;margin-bottom:10px" ${state._loginLoading ? 'disabled' : ''}>
        ${state._loginLoading ? '<i class="fas fa-spinner fa-spin"></i> 로그인 중...' : '멘토 로그인'}
      </button>
      <button class="btn-secondary" id="btn-go-mentor-register" style="width:100%">
        멘토 계정 만들기
      </button>
    </div>
  `;
}

function renderMentorRegister() {
  return `
    <div class="onboarding-screen animate-slide">
      <div class="screen-header" style="padding:0 0 16px 0">
        <button class="back-btn" onclick="state._loginError='';goScreen('login-mentor')"><i class="fas fa-arrow-left"></i></button>
        <h1 style="font-size:18px">멘토 회원가입</h1>
      </div>

      ${state._loginError ? `<div style="background:rgba(255,107,107,0.15);color:#FF6B6B;padding:10px 16px;border-radius:10px;font-size:13px;margin-bottom:16px;text-align:center">${state._loginError}</div>` : ''}

      <div class="field-group">
        <label class="field-label">아이디 <span style="color:#FF6B6B">*</span></label>
        <input class="input-field" id="mentor-reg-id" placeholder="영문/숫자 조합">
      </div>
      <div class="field-group">
        <label class="field-label">비밀번호 <span style="color:#FF6B6B">*</span></label>
        <input class="input-field" id="mentor-reg-pw" type="password" placeholder="4자 이상">
      </div>
      <div class="field-group">
        <label class="field-label">이름 <span style="color:#FF6B6B">*</span></label>
        <input class="input-field" id="mentor-reg-name" placeholder="선생님 성함">
      </div>
      <div class="field-group">
        <label class="field-label">학원명</label>
        <input class="input-field" id="mentor-reg-academy" placeholder="예: 정율사관학원">
      </div>
      <div class="field-group">
        <label class="field-label">연락처</label>
        <input class="input-field" id="mentor-reg-phone" placeholder="010-XXXX-XXXX">
      </div>

      <div style="flex:1"></div>
      <button class="btn-primary btn-glow" id="btn-mentor-register" style="width:100%;margin-top:16px" ${state._loginLoading ? 'disabled' : ''}>
        ${state._loginLoading ? '<i class="fas fa-spinner fa-spin"></i> 가입 중...' : '멘토 등록하기'}
      </button>
    </div>
  `;
}


// ==================== AUTH EVENT HANDLERS ====================

function initAuthEvents(container) {
  if (!container) return;

  // 학생 로그인
  container.querySelector('#btn-student-login')?.addEventListener('click', async () => {
    const code = container.querySelector('#login-invite-code')?.value?.trim();
    const name = container.querySelector('#login-name')?.value?.trim();
    const pw = container.querySelector('#login-password')?.value;
    if (!code || !name || !pw) { state._loginError = '모든 항목을 입력해주세요'; renderScreen(); return; }

    state._loginLoading = true; state._loginError = ''; renderScreen();
    try {
      const res = await fetch('/api/auth/student/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ inviteCode: code, name, password: pw })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '로그인 실패');

      // 로그인 성공 - 상태 저장
      state._authUser = data.user;
      state._authToken = data.token;
      state._authRole = 'student';
      state._authGroup = data.group;
      state._loginError = '';
      state._loginLoading = false;

      // localStorage에 저장 (자동 로그인) - 초대코드도 저장
      localStorage.setItem('cp_auth', JSON.stringify({
        user: data.user, token: data.token, role: 'student', group: data.group,
        inviteCode: code
      }));

      state.currentScreen = 'main';
      state.studentTab = 'home';
      state.mode = 'student';
      renderScreen();

      // DB에서 데이터 로드 (비동기)
      DB.loadAll().then(() => renderScreen());
      // 수업 종료 자동 감지 시작
      startClassEndChecker();
      // 멀티디바이스 자동 동기화 시작
      startAutoSync();
    } catch (e) {
      state._loginError = e.message;
      state._loginLoading = false;
      renderScreen();
    }
  });

  // 학생 가입 페이지로
  container.querySelector('#btn-go-register')?.addEventListener('click', () => {
    state._loginError = ''; goScreen('register-student');
  });

  // 멘토 로그인 페이지로
  container.querySelector('#btn-go-mentor-login')?.addEventListener('click', () => {
    state._loginError = ''; goScreen('login-mentor');
  });

  // 멘토 가입 페이지로
  container.querySelector('#btn-go-mentor-register')?.addEventListener('click', () => {
    state._loginError = ''; goScreen('register-mentor');
  });

  // 학생 회원가입
  container.querySelector('#btn-student-register')?.addEventListener('click', async () => {
    const code = container.querySelector('#reg-invite-code')?.value?.trim();
    const name = container.querySelector('#reg-name')?.value?.trim();
    const pw = container.querySelector('#reg-password')?.value;
    const pw2 = container.querySelector('#reg-password2')?.value;
    const school = container.querySelector('#reg-school')?.value?.trim();
    const gradeBtn = container.querySelector('.reg-grade-btn.active');
    const grade = gradeBtn ? parseInt(gradeBtn.dataset.grade) : 1;

    if (!code || !name || !pw) { state._loginError = '초대코드, 이름, 비밀번호는 필수입니다'; renderScreen(); return; }
    if (pw !== pw2) { state._loginError = '비밀번호가 일치하지 않습니다'; renderScreen(); return; }
    if (pw.length < 4) { state._loginError = '비밀번호는 4자 이상이어야 합니다'; renderScreen(); return; }

    state._loginLoading = true; state._loginError = ''; renderScreen();
    try {
      const res = await fetch('/api/auth/student/register', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ inviteCode: code, name, password: pw, schoolName: school, grade })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '가입 실패');

      state._loginLoading = false;
      alert(`🎉 ${data.groupName}에 가입되었습니다!\\n\\n담당: ${data.mentorName} 선생님\\n이제 로그인해주세요.`);
      state._loginError = '';
      goScreen('login');
    } catch (e) {
      state._loginError = e.message;
      state._loginLoading = false;
      renderScreen();
    }
  });

  // 학생 가입: 학년 선택
  container.querySelectorAll('.reg-grade-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.reg-grade-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // 초대코드 실시간 확인
  const inviteInput = container.querySelector('#reg-invite-code');
  let inviteTimer = null;
  inviteInput?.addEventListener('input', () => {
    clearTimeout(inviteTimer);
    const status = container.querySelector('#invite-code-status');
    const val = inviteInput.value.trim();
    if (val.length < 10) { if (status) status.innerHTML = ''; return; }
    inviteTimer = setTimeout(async () => {
      try {
        const res = await fetch('/api/auth/verify-invite/' + encodeURIComponent(val));
        const data = await res.json();
        if (data.valid) {
          status.innerHTML = `<span style="color:#00B894">✅ ${data.academyName} - ${data.groupName} (${data.mentorName} 선생님)</span>`;
        } else {
          status.innerHTML = `<span style="color:#FF6B6B">❌ ${data.error}</span>`;
        }
      } catch { status.innerHTML = ''; }
    }, 500);
  });

  // 멘토 로그인
  container.querySelector('#btn-mentor-login')?.addEventListener('click', async () => {
    const id = container.querySelector('#mentor-login-id')?.value?.trim();
    const pw = container.querySelector('#mentor-login-pw')?.value;
    if (!id || !pw) { state._loginError = '아이디와 비밀번호를 입력해주세요'; renderScreen(); return; }

    state._loginLoading = true; state._loginError = ''; renderScreen();
    try {
      const res = await fetch('/api/auth/mentor/login', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ loginId: id, password: pw })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '로그인 실패');

      state._authUser = data.user;
      state._authToken = data.token;
      state._authRole = 'mentor';
      state._authMentorGroups = data.groups;
      state._loginError = '';
      state._loginLoading = false;

      localStorage.setItem('cp_auth', JSON.stringify({
        user: data.user, token: data.token, role: 'mentor', groups: data.groups
      }));

      state.mode = 'mentor';
      state.currentScreen = 'main';
      // 멘토 대시보드 데이터 로드
      _mentor.initialLoading = false;
      await mentorLoadGroups();
      await mentorLoadGroupSummary();
      renderScreen();
      // DB 마이그레이션 (멘토 첫 접속 시 테이블 생성)
      fetch('/api/migrate').catch(() => {});
    } catch (e) {
      state._loginError = e.message;
      state._loginLoading = false;
      renderScreen();
    }
  });

  // 멘토 회원가입
  container.querySelector('#btn-mentor-register')?.addEventListener('click', async () => {
    const id = container.querySelector('#mentor-reg-id')?.value?.trim();
    const pw = container.querySelector('#mentor-reg-pw')?.value;
    const name = container.querySelector('#mentor-reg-name')?.value?.trim();
    const academy = container.querySelector('#mentor-reg-academy')?.value?.trim();
    const phone = container.querySelector('#mentor-reg-phone')?.value?.trim();

    if (!id || !pw || !name) { state._loginError = '아이디, 비밀번호, 이름은 필수입니다'; renderScreen(); return; }
    if (pw.length < 4) { state._loginError = '비밀번호는 4자 이상이어야 합니다'; renderScreen(); return; }

    state._loginLoading = true; state._loginError = ''; renderScreen();
    try {
      const res = await fetch('/api/auth/mentor/register', {
        method: 'POST', headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ loginId: id, password: pw, name, academyName: academy, phone })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '가입 실패');

      state._loginLoading = false;
      alert(`🎉 멘토 등록 완료!\\n\\n기본 반 초대코드: ${data.defaultGroupInviteCode}\\n이 코드를 학생들에게 알려주세요.\\n\\n이제 로그인해주세요.`);
      state._loginError = '';
      goScreen('login-mentor');
    } catch (e) {
      state._loginError = e.message;
      state._loginLoading = false;
      renderScreen();
    }
  });

  // Enter 키 로그인
  container.querySelector('#login-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') container.querySelector('#btn-student-login')?.click();
  });
  container.querySelector('#mentor-login-pw')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') container.querySelector('#btn-mentor-login')?.click();
  });
}

// 로그아웃
function logout() {
  if (!confirm('로그아웃 하시겠습니까?')) return;
  // 타이머 정리
  stopAutoSync();
  if (_classCheckTimer) { clearInterval(_classCheckTimer); _classCheckTimer = null; }
  state._authUser = null;
  state._authToken = null;
  state._authRole = null;
  state._authGroup = null;
  state._authMentorGroups = null;
  state._loginError = '';
  localStorage.removeItem('cp_auth');
  state.currentScreen = 'login';
  state.mode = 'student';
  renderScreen();
}

// 자동 로그인 (페이지 로드 시)
function autoLogin() {
  try {
    const saved = localStorage.getItem('cp_auth');
    if (!saved) return;
    const auth = JSON.parse(saved);
    if (!auth.user || !auth.token) return;

    state._authUser = auth.user;
    state._authToken = auth.token;
    state._authRole = auth.role;
    state._loginError = '';
    if (auth.role === 'student') {
      state._authGroup = auth.group;
      state.mode = 'student';
    } else if (auth.role === 'mentor') {
      state._authMentorGroups = auth.groups;
      state.mode = 'mentor';
    }
    state.currentScreen = 'main';
    state.studentTab = 'home';

    // 서버에 프로필 검증 (비동기) - 실패 시 로그인 화면으로
    if (auth.role === 'student' && auth.user.id) {
      fetch(`/api/student/${auth.user.id}/profile`).then(res => {
        if (!res.ok) throw new Error('Profile check failed');
        return res.json();
      }).then(() => {
        DB.loadAll().then(() => renderScreen());
        // 수업 종료 자동 감지 시작
        startClassEndChecker();
        // 멀티디바이스 자동 동기화 시작
        startAutoSync();
      }).catch(() => {
        // 서버 검증 실패 → 로그아웃
        console.log('Auto-login verification failed, logging out');
        localStorage.removeItem('cp_auth');
        state._authUser = null;
        state._authToken = null;
        state._authRole = null;
        state._authGroup = null;
        state._loginError = '';
        state.currentScreen = 'login';
        renderScreen();
      });
    } else if (auth.role === 'mentor') {
      _mentor.initialLoading = true;
      fetch('/api/migrate').catch(() => {});
      // 멘토 대시보드 데이터 비동기 로드
      mentorLoadGroups().then(() => mentorLoadGroupSummary()).catch(e => { console.error('autoLogin mentor load:', e); _mentor.initialLoading = false; _mentor.loading = false; renderScreen(); });
    }
  } catch (e) {
    localStorage.removeItem('cp_auth');
  }
}


// ==================== DB SYNC LAYER ====================

const DB = {
  // 학생 ID 가져오기
  studentId() {
    return state._authUser?.id;
  },

  // === 로그인 후 전체 데이터 로드 ===
  async loadAll() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      // DB 마이그레이션 먼저 실행 (테이블 없으면 생성)
      await fetch('/api/migrate').catch(() => {});
      await Promise.all([
        this.loadExams(),
        this.loadAssignments(),
        this.loadClassRecords(),
        this.loadQuestionRecords(),
        this.loadTeachRecords(),
        this.loadActivityRecords(),
        this.loadReportRecords(),
        this.loadProfile(),
        this.loadMentorFeedbacks(),
      ]);
    } catch (e) {
      console.error('DB loadAll error:', e);
    }
  },

  // === 프로필 ===
  async loadProfile() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/profile`);
      if (res.ok) {
        const data = await res.json();
        state.xp = data.xp || 0;
        state.level = data.level || 1;
      }
    } catch (e) { console.error('loadProfile:', e); }
  },

  // === 시험 ===
  async loadExams() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const [examsRes, resultsRes] = await Promise.all([
        fetch(`/api/student/${sid}/exams`),
        fetch(`/api/student/${sid}/exam-results`)
      ]);
      if (examsRes.ok) {
        const examsData = await examsRes.json();
        const resultsData = resultsRes.ok ? await resultsRes.json() : { results: [] };
        
        // DB 데이터를 state.exams 형식으로 변환
        state.exams = (examsData.exams || []).map(ex => {
          const subjects = JSON.parse(ex.subjects || '[]');
          const result = (resultsData.results || []).find(r => r.exam_id === ex.id);
          
          const examObj = {
            id: String(ex.id),
            _dbId: ex.id,
            name: ex.name,
            type: ex.type,
            startDate: ex.start_date,
            subjects: subjects,
            status: ex.status,
            memo: ex.memo || '',
            result: null,
          };

          if (result) {
            const subjectsData = JSON.parse(result.subjects_data || '[]');
            // 오답 데이터를 과목별로 매핑
            const wrongAnswers = result.wrongAnswers || [];
            subjectsData.forEach(sd => {
              sd.wrongAnswers = wrongAnswers.filter(wa => wa.subject === sd.subject).map(wa => ({
                number: wa.question_number,
                topic: wa.topic,
                type: wa.error_type,
                myAnswer: wa.my_answer,
                correctAnswer: wa.correct_answer,
                reason: wa.reason,
                reflection: wa.reflection,
                images: wa.images || [],
              }));
            });

            examObj.result = {
              totalScore: result.total_score,
              grade: result.grade,
              subjects: subjectsData,
              overallReflection: result.overall_reflection || '',
              createdAt: result.created_at,
            };
          }
          return examObj;
        });
      }
    } catch (e) { console.error('loadExams:', e); }
  },

  async saveExam(examData) {
    const sid = this.studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(examData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.examId;
      }
    } catch (e) { console.error('saveExam:', e); }
    return null;
  },

  async updateExam(examId, updates) {
    try {
      await fetch(`/api/student/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('updateExam:', e); }
  },

  async saveExamResult(examDbId, resultData) {
    const sid = this.studentId();
    if (!sid) return;
    try {
      // wrongAnswers 평탄화
      const wrongAnswers = [];
      (resultData.subjects || []).forEach(sub => {
        (sub.wrongAnswers || []).forEach(wa => {
          wrongAnswers.push({
            subject: sub.subject,
            number: wa.number,
            topic: wa.topic,
            type: wa.type,
            myAnswer: wa.myAnswer,
            correctAnswer: wa.correctAnswer,
            reason: wa.reason,
            reflection: wa.reflection,
            images: wa.images || [],
          });
        });
      });

      await fetch(`/api/student/${sid}/exam-results`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          examId: examDbId,
          totalScore: resultData.totalScore,
          grade: resultData.grade,
          subjectsData: resultData.subjects,
          overallReflection: resultData.overallReflection,
          wrongAnswers: wrongAnswers,
        })
      });
    } catch (e) { console.error('saveExamResult:', e); }
  },

  // === 과제 ===
  async loadAssignments() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/assignments`);
      if (res.ok) {
        const data = await res.json();
        state.assignments = (data.assignments || []).map(a => ({
          id: String(a.id),
          _dbId: a.id,
          subject: a.subject,
          title: a.title,
          desc: a.description || '',
          type: '과제',
          teacher: a.teacher_name || '',
          dueDate: a.due_date,
          createdDate: a.created_at ? a.created_at.slice(0,10) : '',
          status: a.status,
          progress: a.progress,
          color: a.color,
          plan: JSON.parse(a.plan_data || '[]'),
        }));
        // 과제를 플래너 타임라인에도 반영
        state.assignments.forEach(a => {
          if (a.status !== 'completed' && a.dueDate) {
            addAssignmentToPlannerItems(a);
          }
        });
      }
    } catch (e) { console.error('loadAssignments:', e); }
  },

  async saveAssignment(assignmentData) {
    const sid = this.studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignmentData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.assignmentId;
      }
    } catch (e) { console.error('saveAssignment:', e); }
    return null;
  },

  async updateAssignment(assignmentId, updates) {
    try {
      await fetch(`/api/student/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('updateAssignment:', e); }
  },

  // === 수업 기록 ===
  async loadClassRecords() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/class-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbClassRecords = (data.records || []).map(r => ({
          id: r.id,
          subject: r.subject,
          date: r.date,
          content: r.content,
          keywords: JSON.parse(r.keywords || '[]'),
          understanding: r.understanding,
          memo: r.memo,
          topic: r.topic || '',
          pages: r.pages || '',
          photos: (() => { try { return JSON.parse(r.photos || '[]'); } catch(e) { return []; } })(),
          teacher_note: r.teacher_note || '',
          created_at: r.created_at || '',
        }));
      }
    } catch (e) { console.error('loadClassRecords:', e); }
  },

  async saveClassRecord(recordData) {
    const sid = this.studentId();
    if (!sid) return null;
    try {
      // photos 배열에서 base64 데이터를 분리 (photos 필드엔 ID 참조만 저장)
      const photosRaw = recordData.photos || [];
      const recordToSave = { ...recordData };
      
      const res = await fetch(`/api/student/${sid}/class-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordToSave)
      });
      if (res.ok) {
        const data = await res.json();
        const recordId = data.recordId;
        
        // 사진이 있으면 별도 테이블에도 저장 (열람용)
        if (photosRaw.length > 0) {
          try {
            await fetch(`/api/student/${sid}/class-record-photos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ photos: photosRaw, classRecordId: recordId })
            });
          } catch (pe) { console.error('saveClassRecordPhotos:', pe); }
        }
        
        // DB 기록 자동 리프레시 (다른 기기에서도 바로 열람 가능)
        try { await this.loadClassRecords(); } catch (_) {}
        
        return recordId;
      }
    } catch (e) { console.error('saveClassRecord:', e); }
    return null;
  },

  async updateClassRecord(recordId, updates) {
    try {
      await fetch(`/api/student/class-records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      // 수정 후 DB 기록 자동 리프레시
      try { await this.loadClassRecords(); } catch (_) {}
    } catch (e) { console.error('updateClassRecord:', e); }
  },

  // === 질문 코칭 기록 ===
  async loadQuestionRecords() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/question-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbQuestionRecords = (data.records || []).map(r => ({
          ...r,
          coachingMessages: JSON.parse(r.coaching_messages || '[]'),
        }));
      }
    } catch (e) { console.error('loadQuestionRecords:', e); }
  },

  async saveQuestionRecord(recordData) {
    const sid = this.studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/question-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.recordId;
      }
    } catch (e) { console.error('saveQuestionRecord:', e); }
    return null;
  },

  // === 교학상장 (가르치기) ===
  async saveTeachRecord(recordData) {
    const sid = this.studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/teach-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.recordId;
      }
    } catch (e) { console.error('saveTeachRecord:', e); }
    return null;
  },

  async loadTeachRecords() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/teach-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbTeachRecords = data.records || [];
      }
    } catch (e) { console.error('loadTeachRecords:', e); }
  },

  // === 창의적 체험활동 ===
  async saveActivityRecord(recordData) {
    const sid = this.studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/activity-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.recordId;
      }
    } catch (e) { console.error('saveActivityRecord:', e); }
    return null;
  },

  async updateActivityRecord(recordId, updates) {
    try {
      await fetch(`/api/student/activity-records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('updateActivityRecord:', e); }
  },

  // === 활동 로그 (날짜별 기록) ===
  async saveActivityLog(activityRecordId, logData) {
    const sid = this.studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/activity-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityRecordId, ...logData })
      });
      if (res.ok) {
        const data = await res.json();
        return data.logId;
      }
    } catch (e) { console.error('saveActivityLog:', e); }
    return null;
  },

  async loadActivityLogs(activityId) {
    const sid = this.studentId();
    if (!sid) return [];
    try {
      const url = activityId 
        ? `/api/student/${sid}/activity-logs?activityId=${activityId}`
        : `/api/student/${sid}/activity-logs`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (e) { console.error('loadActivityLogs:', e); }
    return [];
  },

  // === 탐구보고서 ===
  async saveReportRecord(reportData) {
    const sid = this.studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/report-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.reportId;
      }
    } catch (e) { console.error('saveReportRecord:', e); }
    return null;
  },

  async updateReportRecord(reportId, updates) {
    try {
      await fetch(`/api/student/report-records/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('updateReportRecord:', e); }
  },

  async loadReportRecords() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/report-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbReportRecords = (data.records || []).map(r => ({
          ...r,
          timeline: JSON.parse(r.timeline || '[]'),
          questions: JSON.parse(r.questions || '[]'),
        }));
      }
    } catch (e) { console.error('loadReportRecords:', e); }
  },

  // === 시험 삭제 ===
  async deleteExam(examId) {
    try {
      await fetch(`/api/student/exams/${examId}`, { method: 'DELETE' });
    } catch (e) { console.error('deleteExam:', e); }
  },

  async loadActivityRecords() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/activity-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbActivityRecords = data.records || [];
      }
    } catch (e) { console.error('loadActivityRecords:', e); }
  },

  async loadMentorFeedbacks() {
    const sid = this.studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/feedbacks`);
      if (res.ok) {
        const data = await res.json();
        state._mentorFeedbacks = data.feedbacks || [];
        state._mentorFeedbackUnread = data.unreadCount || 0;
      }
    } catch (e) { console.error('loadMentorFeedbacks:', e); }
  },

  async markFeedbackRead(feedbackId) {
    try {
      await fetch(`/api/student/feedback/${feedbackId}/read`, { method: 'PUT' });
    } catch (e) { console.error('markFeedbackRead:', e); }
  },
};


// ==================== 시간표 스마트 오토스크롤 ====================
function smartScrollTimetable() {
  const scrollArea = document.getElementById('tt-scroll-area');
  if (!scrollArea) return;
  
  const rows = scrollArea.querySelectorAll('.tt-row[data-tt-start]');
  if (rows.length <= 3) return; // 3개 이하면 스크롤 불필요
  
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  
  let targetRow = null;
  
  // 1순위: 현재 진행 중인 수업 (start <= now < end)
  for (const row of rows) {
    const start = row.dataset.ttStart;
    const end = row.dataset.ttEnd;
    const done = row.dataset.ttDone === '1';
    if (!start || !end) continue;
    
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    
    if (nowMinutes >= startMin && nowMinutes < endMin) {
      targetRow = row;
      break;
    }
  }
  
  // 2순위: 다음 수업 (아직 안 끝난 첫 번째 수업)
  if (!targetRow) {
    for (const row of rows) {
      const start = row.dataset.ttStart;
      const done = row.dataset.ttDone === '1';
      if (!start || done) continue;
      
      const [sh, sm] = start.split(':').map(Number);
      const startMin = sh * 60 + sm;
      
      if (nowMinutes < startMin + 30) { // 시작 30분 이내까지 포함
        targetRow = row;
        break;
      }
    }
  }
  
  // 3순위: 마지막으로 끝난 미기록 수업
  if (!targetRow) {
    for (const row of rows) {
      const done = row.dataset.ttDone === '1';
      if (!done) {
        targetRow = row;
        break;
      }
    }
  }
  
  // 스크롤 실행
  if (targetRow) {
    // 한 행 앞을 보여줘서 맥락 유지
    const prevRow = targetRow.previousElementSibling;
    const scrollTarget = prevRow && prevRow.classList.contains('tt-row') ? prevRow : targetRow;
    
    scrollArea.scrollTo({
      top: Math.max(0, scrollTarget.offsetTop - 4),
      behavior: 'smooth'
    });
  }
  
  // 그라데이션 페이드 업데이트
  updateTtScrollFades(scrollArea);
  scrollArea.addEventListener('scroll', () => updateTtScrollFades(scrollArea), { passive: true });
}

function updateTtScrollFades(el) {
  const wrapper = el.closest('.tt-scroll-wrapper');
  if (!wrapper) return;
  const fadeTop = wrapper.querySelector('.tt-scroll-fade-top');
  const fadeBottom = wrapper.querySelector('.tt-scroll-fade-bottom');
  const { scrollTop, scrollHeight, clientHeight } = el;
  
  if (fadeTop) fadeTop.style.opacity = scrollTop > 8 ? '1' : '0';
  if (fadeBottom) fadeBottom.style.opacity = (scrollTop + clientHeight < scrollHeight - 8) ? '1' : '0';
}

// ==================== 학원 수업 오늘 일정 자동 생성 ====================

function initTodayAcademy() {
  if (state.todayAcademyRecords) return; // 이미 초기화됨
  const dayNames = ['일','월','화','수','목','금','토'];
  const todayDay = dayNames[new Date().getDay()];
  const academy = state.timetable?.academy || [];
  const subjectColors = state.timetable?.subjectColors || {};
  
  state.todayAcademyRecords = academy
    .filter(a => a.day === todayDay)
    .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || ''))
    .map((a, idx) => ({
      _academyId: a.id,
      _isAcademy: true,
      period: 'ac' + (idx + 1),
      subject: a.subject || a.name,
      teacher: a.academy || '',  // 학원명을 teacher 자리에
      academyName: a.academy,
      className: a.name,
      done: false,
      question: null,
      summary: '',
      color: a.color || subjectColors[a.subject] || '#636e72',
      startTime: a.startTime,
      endTime: a.endTime,
      memo: a.memo || '',
      _dbRecordId: null,
      _topic: '',
      _pages: '',
      _keywords: [],
      _photos: [],
      _teacherNote: ''
    }));
}

// ==================== 시간 기반 수업종료 자동 감지 ====================

// 교시별 수업 종료 시간 기준으로 상태 판단
function getClassEndStatus(record) {
  if (!record.endTime || record.done) return 'none';
  const now = new Date();
  const [h, m] = record.endTime.split(':').map(Number);
  const endToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m);
  const diffMin = (now - endToday) / 60000;
  // 수업 종료 후 0~30분 이내 → 'just-ended' (강조)
  if (diffMin >= 0 && diffMin <= 30) return 'just-ended';
  // 수업 종료 후 30분 초과 → 'ended' (미기록 경고)
  if (diffMin > 30) return 'ended';
  return 'none'; // 아직 수업 중이거나 미래
}

// 미기록 + 수업 끝난 교시가 있는지 (학교 + 학원)
function hasUnrecordedEndedClass() {
  const schoolEnded = state.todayRecords.some(r => !r.done && getClassEndStatus(r) !== 'none');
  const academyEnded = (state.todayAcademyRecords || []).some(r => !r.done && getClassEndStatus(r) !== 'none');
  return schoolEnded || academyEnded;
}

function countUnrecordedEndedClasses() {
  const schoolCount = state.todayRecords.filter(r => !r.done && getClassEndStatus(r) !== 'none').length;
  const academyCount = (state.todayAcademyRecords || []).filter(r => !r.done && getClassEndStatus(r) !== 'none').length;
  return schoolCount + academyCount;
}

// 저녁 시간대인지 (19시~23시)
function isEveningTime() {
  const h = new Date().getHours();
  return h >= 19 && h <= 23;
}

// ==================== QUICK TODO FUNCTIONS ====================
function addQuickTodo() {
  const input = document.getElementById('quick-todo-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) return;
  if (!state.quickTodos) state.quickTodos = [];
  state.quickTodos.push({ text, done: false });
  input.value = '';
  // 로컬 스토리지에 저장
  try { localStorage.setItem('quickTodos', JSON.stringify(state.quickTodos)); } catch(e) {}
  renderScreen();
}

function toggleQuickTodo(index) {
  if (!state.quickTodos || !state.quickTodos[index]) return;
  state.quickTodos[index].done = !state.quickTodos[index].done;
  try { localStorage.setItem('quickTodos', JSON.stringify(state.quickTodos)); } catch(e) {}
  renderScreen();
}

function deleteQuickTodo(index) {
  if (!state.quickTodos) return;
  state.quickTodos.splice(index, 1);
  try { localStorage.setItem('quickTodos', JSON.stringify(state.quickTodos)); } catch(e) {}
  renderScreen();
}

// 앱 시작 시 로컬 스토리지에서 투두 복원
try {
  const saved = localStorage.getItem('quickTodos');
  if (saved) state.quickTodos = JSON.parse(saved);
} catch(e) {}

// 1분마다 체크 → 수업 끝났으면 화면 갱신 + 선택적 자동 팝업
let _classCheckTimer = null;
let _lastAutoPopupPeriod = 0;

function startClassEndChecker() {
  if (_classCheckTimer) clearInterval(_classCheckTimer);
  _classCheckTimer = setInterval(() => {
    // 미기록 수업 중 방금 끝난 것 감지
    const justEnded = state.todayRecords.find(r => !r.done && getClassEndStatus(r) === 'just-ended');
    if (justEnded && justEnded.period !== _lastAutoPopupPeriod) {
      _lastAutoPopupPeriod = justEnded.period;
      // 홈 화면이면 알림 배너 표시 + 화면 갱신
      if (state.currentScreen === 'main' && state.studentTab === 'home') {
        renderScreen();
        // 자동 팝업 (홈에 있을 때만)
        showClassEndNotification(justEnded);
      }
    }
    // 매분 홈이면 갱신 (시간 표시 업데이트)
    if (state.currentScreen === 'main' && state.studentTab === 'home') {
      // 버튼 glow 상태만 업데이트 (전체 렌더링은 부담)
      document.querySelectorAll('.qa-glow').forEach(el => el.classList.toggle('qa-pulse'));
    }
  }, 60000); // 1분마다
}

// ==================== 자동 동기화 (멀티디바이스 지원) ====================
let _syncTimer = null;
let _syncInProgress = false;
const SYNC_INTERVAL = 45000; // 45초

function startAutoSync() {
  if (_syncTimer) clearInterval(_syncTimer);
  console.log('[SYNC] Auto-sync started (every 45s)');
  _syncTimer = setInterval(async () => {
    // 동기화 조건: 학생 모드, 로그인 상태, 메인 화면, 이전 동기화 완료
    if (_syncInProgress) return;
    if (!state._authUser?.id) return;
    if (state._authRole !== 'student' && state.mode !== 'student') return;
    // 기록 작성 중(record-class, record-question 등)이면 동기화 스킵
    const recordScreens = ['record-class','record-question','record-teach','record-activity','record-assignment','class-end-popup','academy-record-popup','evening-routine'];
    if (recordScreens.includes(state.currentScreen)) return;
    
    _syncInProgress = true;
    try {
      const sid = state._authUser.id;
      const [crRes, qrRes, trRes, assignRes, profileRes] = await Promise.all([
        fetch(`/api/student/${sid}/class-records`).catch(() => null),
        fetch(`/api/student/${sid}/question-records`).catch(() => null),
        fetch(`/api/student/${sid}/teach-records`).catch(() => null),
        fetch(`/api/student/${sid}/assignments`).catch(() => null),
        fetch(`/api/student/${sid}/profile`).catch(() => null),
      ]);
      
      let changed = false;
      
      if (crRes?.ok) {
        const data = await crRes.json();
        const newRecords = (data.records || []).map(r => ({ ...r, _source: 'db', id: r.id, _dbId: r.id }));
        if (newRecords.length !== (state._dbClassRecords || []).length) {
          state._dbClassRecords = newRecords;
          changed = true;
        }
      }
      if (qrRes?.ok) {
        const data = await qrRes.json();
        const newRecords = (data.records || []).map(r => ({ ...r, _source: 'db', id: r.id, _dbId: r.id }));
        if (newRecords.length !== (state._dbQuestionRecords || []).length) {
          state._dbQuestionRecords = newRecords;
          changed = true;
        }
      }
      if (trRes?.ok) {
        const data = await trRes.json();
        const newRecords = data.records || [];
        if (newRecords.length !== (state._dbTeachRecords || []).length) {
          state._dbTeachRecords = newRecords;
          changed = true;
        }
      }
      if (assignRes?.ok) {
        const data = await assignRes.json();
        const newAssignments = data.assignments || [];
        if (newAssignments.length !== (state._dbAssignments || []).length) {
          state._dbAssignments = newAssignments;
          changed = true;
        }
      }
      if (profileRes?.ok) {
        const data = await profileRes.json();
        if (data.xp !== state.xp || data.level !== state.level) {
          state.xp = data.xp || 0;
          state.level = data.level || 1;
          changed = true;
        }
      }
      
      if (changed) {
        console.log('[SYNC] Data changed, refreshing UI');
        // todayRecords도 갱신
        if (typeof syncTodayRecords === 'function') syncTodayRecords();
        renderScreen();
      }
    } catch (e) {
      console.error('[SYNC] Auto-sync error:', e);
    } finally {
      _syncInProgress = false;
    }
  }, SYNC_INTERVAL);
}

function stopAutoSync() {
  if (_syncTimer) {
    clearInterval(_syncTimer);
    _syncTimer = null;
    console.log('[SYNC] Auto-sync stopped');
  }
}

// 탭 전환 시 동기화 관리 (배터리 절약)
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 탭 비활성 → 동기화 일시 정지
    stopAutoSync();
  } else {
    // 탭 활성화 → 즉시 1회 동기화 + 타이머 재시작
    if (state._authRole === 'student' && state._authUser?.id) {
      console.log('[SYNC] Tab visible, resuming sync');
      DB.loadAll().then(() => {
        if (typeof syncTodayRecords === 'function') syncTodayRecords();
        renderScreen();
      });
      startAutoSync();
    }
  }
});

// 수업 종료 인앱 알림 배너
function showClassEndNotification(record) {
  const banner = document.createElement('div');
  banner.className = 'class-end-banner animate-in';
  banner.innerHTML = `
    <div class="ceb-icon">🔔</div>
    <div class="ceb-text">
      <strong>${record.period}교시 ${record.subject}</strong> 수업 끝!
      <span>지금 바로 기록해보세요</span>
    </div>
    <button class="ceb-btn" onclick="this.closest('.class-end-banner').remove();goScreen('class-end-popup')">기록하기</button>
    <button class="ceb-close" onclick="this.closest('.class-end-banner').remove()">✕</button>
  `;
  // 기존 배너 제거
  document.querySelectorAll('.class-end-banner').forEach(el => el.remove());
  document.body.appendChild(banner);
  // 10초 후 자동 닫기
  setTimeout(() => { if (document.body.contains(banner)) banner.remove(); }, 10000);
}

// ==================== 수업 기록 열람 ====================

// 오늘 기록 상세 보기 (todayRecords 기반)
function viewTodayRecord(idx) {
  state._viewingTodayRecordIdx = idx;
  goScreen('class-record-detail');
}

// ==================== 기록 관리 & 누락 체크 (주간 캘린더 뷰) ====================
function renderRecordStatus() {
  const school = state.timetable?.school || [];
  const teachers = state.timetable?.teachers || {};
  const subjectColors = state.timetable?.subjectColors || {};
  const dbRecords = state._dbClassRecords || [];
  const todayRecords = state.todayRecords || [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0,10);
  
  // 이번 주 월~금 날짜 구하기
  const dayOfWeek = today.getDay(); // 0=일, 1=월...
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  
  const weekDays = [];
  const dayNames = ['월','화','수','목','금'];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push({
      date: d.toISOString().slice(0,10),
      dayName: dayNames[i],
      dayNum: d.getDate(),
      month: d.getMonth() + 1,
      isToday: d.toISOString().slice(0,10) === todayStr,
      isFuture: d > today
    });
  }
  
  // 각 날짜+교시별 기록 여부 계산
  const periodCount = school.length || 7;
  let totalSlots = 0, recordedSlots = 0;
  
  const weekData = weekDays.map((day, dayIdx) => {
    const periods = [];
    for (let p = 0; p < periodCount; p++) {
      const subject = school[p] ? (school[p][dayIdx] || '') : '';
      if (!subject) continue; // 빈 교시 스킵
      
      const isRecorded = checkRecordExists(day.date, subject, p + 1, dbRecords, todayRecords, todayStr);
      
      if (!day.isFuture) {
        totalSlots++;
        if (isRecorded) recordedSlots++;
      }
      
      periods.push({
        period: p + 1,
        subject,
        color: subjectColors[subject] || '#636e72',
        teacher: teachers[subject] || '',
        recorded: isRecorded,
        isFuture: day.isFuture
      });
    }
    return { ...day, periods };
  });
  
  const completionRate = totalSlots > 0 ? Math.round((recordedSlots / totalSlots) * 100) : 0;
  const missedCount = totalSlots - recordedSlots;
  
  // 진행률 색상
  const rateColor = completionRate >= 80 ? '#00B894' : completionRate >= 50 ? '#FDCB6E' : '#FF6B6B';
  
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main');state.studentTab='record'"><i class="fas fa-arrow-left"></i></button>
        <h1>📊 기록 관리 & 누락 체크</h1>
      </div>
      <div class="form-body">
        <!-- 주간 진행률 카드 -->
        <div class="rs-progress-card">
          <div class="rs-progress-header">
            <div>
              <div class="rs-progress-title">이번 주 기록 현황</div>
              <div class="rs-progress-subtitle">${weekDays[0].month}/${weekDays[0].dayNum} ~ ${weekDays[4].month}/${weekDays[4].dayNum}</div>
            </div>
            <div class="rs-progress-circle" style="--rate:${completionRate};--rate-color:${rateColor}">
              <svg viewBox="0 0 36 36" class="rs-circle-svg">
                <path class="rs-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                <path class="rs-circle-fill" stroke="${rateColor}" stroke-dasharray="${completionRate}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              </svg>
              <div class="rs-circle-text">
                <span class="rs-circle-num" style="color:${rateColor}">${completionRate}</span>
                <span class="rs-circle-pct">%</span>
              </div>
            </div>
          </div>
          <div class="rs-progress-stats">
            <div class="rs-stat"><span class="rs-stat-num" style="color:var(--primary-light)">${recordedSlots}</span><span class="rs-stat-label">기록 완료</span></div>
            <div class="rs-stat"><span class="rs-stat-num" style="color:${missedCount > 0 ? '#FF6B6B' : '#00B894'}">${missedCount}</span><span class="rs-stat-label">누락</span></div>
            <div class="rs-stat"><span class="rs-stat-num" style="color:var(--text-secondary)">${totalSlots}</span><span class="rs-stat-label">전체 수업</span></div>
          </div>
        </div>
        
        <!-- 주간 캘린더 그리드 -->
        <div class="rs-calendar">
          ${weekData.map(day => `
            <div class="rs-day-column ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}">
              <div class="rs-day-header ${day.isToday ? 'today' : ''}">
                <span class="rs-day-name">${day.dayName}</span>
                <span class="rs-day-num">${day.dayNum}</span>
              </div>
              <div class="rs-period-list">
                ${day.periods.map(p => `
                  <div class="rs-period-cell ${p.recorded ? 'recorded' : ''} ${p.isFuture ? 'future' : ''} ${!p.recorded && !p.isFuture ? 'missed' : ''}"
                       onclick="${!p.isFuture && !p.recorded ? `startBackfillRecord(&quot;${day.date}&quot;,${p.period},&quot;${p.subject}&quot;)` : ''}"
                       title="${p.period}교시 ${p.subject}${p.teacher ? ' (' + p.teacher + ')' : ''}">
                    <div class="rs-period-num">${p.period}</div>
                    <div class="rs-period-subject" style="color:${p.color}">${p.subject}</div>
                    <div class="rs-period-status">
                      ${p.isFuture ? '<i class="fas fa-clock" style="color:var(--text-muted);font-size:12px"></i>' 
                        : p.recorded ? '<i class="fas fa-check-circle" style="color:#00B894;font-size:16px"></i>' 
                        : '<div class="rs-missed-box"><i class="fas fa-plus" style="font-size:10px"></i></div>'}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
        
        ${missedCount > 0 ? `
        <div class="rs-hint">
          <i class="fas fa-info-circle" style="margin-right:6px;color:var(--primary-light)"></i>
          빈 박스를 탭하면 누락된 수업을 소급 기록할 수 있어요
        </div>
        ` : `
        <div class="rs-hint" style="color:#00B894">
          <i class="fas fa-trophy" style="margin-right:6px"></i>
          이번 주 모든 수업을 기록했어요! 완벽해요! 🎉
        </div>
        `}
      </div>
    </div>
  `;
}

// 특정 날짜+과목+교시의 기록 존재 여부 확인
function checkRecordExists(date, subject, period, dbRecords, todayRecords, todayStr) {
  // DB 기록 확인
  const inDb = dbRecords.some(r => {
    if (r.date !== date || r.subject !== subject) return false;
    const memo = (() => { try { return JSON.parse(r.memo || '{}'); } catch(e) { return {}; } })();
    return !period || memo.period == period || !memo.period;
  });
  if (inDb) return true;
  
  // 오늘 todayRecords 확인
  if (date === todayStr) {
    return todayRecords.some(r => r.subject === subject && r.period === period && r.done);
  }
  return false;
}

// 누락 기록 소급 입력 시작
function startBackfillRecord(date, period, subject) {
  // 해당 날짜의 시간표에서 period 정보 가져오기
  const dayIdx = new Date(date).getDay() - 1; // 0=월
  if (dayIdx < 0 || dayIdx > 4) return;
  
  const periodTimes = state.timetable?.periodTimes || [];
  const teachers = state.timetable?.teachers || {};
  const time = periodTimes[period - 1] || {};
  
  // todayRecords에 가상으로 해당 교시를 세팅하고 기록 화면으로 이동
  state._backfillDate = date;
  state._backfillPeriod = period;
  state._backfillSubject = subject;
  state._backfillTeacher = teachers[subject] || '';
  state._backfillTime = time;
  
  // 기존 record-class 화면으로 이동 (소급 모드)
  goScreen('record-class');
}

// 수업 기록 히스토리 (DB 기반 + 오늘 기록 통합)
function renderClassRecordHistory() {
  const dbRecords = (state._dbClassRecords || []).map(r => ({ ...r, _source: 'db' }));
  
  // 오늘 todayRecords 중 done인 항목도 통합 (DB에 아직 없을 수 있음)
  const today = new Date().toISOString().slice(0,10);
  const todayDone = (state.todayRecords || []).filter(r => r.done).map((r, idx) => {
    // DB에 이미 있는지 확인 (subject + date + topic 기준)
    const topic = r._topic || '';
    const alreadyInDb = dbRecords.some(db => db.date === today && db.subject === r.subject && (db.topic === topic || db.content === topic));
    if (alreadyInDb) return null;
    return {
      id: 'today-' + idx,
      subject: r.subject || '미지정',
      date: today,
      topic: r._topic || '',
      pages: r._pages || '',
      keywords: r._keywords || (r.summary ? r.summary.split(', ').filter(k => k) : []),
      photos: r._photos || [],
      teacher_note: r._teacherNote || '',
      memo: JSON.stringify({ period: r.period }),
      _source: 'today',
      _todayIdx: idx
    };
  }).filter(Boolean);
  
  const allRecords = [...todayDone, ...dbRecords];
  
  // 과목별 필터링
  const currentFilter = state._recordGalleryFilter || '전체';
  const filteredRecords = currentFilter === '전체' ? allRecords : allRecords.filter(r => r.subject === currentFilter);
  
  // 날짜별 그룹핑 (통계용)
  const grouped = {};
  allRecords.forEach(r => {
    if (!grouped[r.date]) grouped[r.date] = [];
    grouped[r.date].push(r);
  });
  const dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
  
  // 전체 통계
  const totalCount = allRecords.length;
  const totalPhotos = allRecords.reduce((sum, r) => sum + (Array.isArray(r.photos) ? r.photos.length : 0), 0);
  const subjectSet = new Set(allRecords.map(r => r.subject));
  
  const subjectColors = {
    '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
    '사회':'#74B9FF','한국사':'#E056A0','제2외국어':'#A29BFE','기술가정':'#FF9F43',
    '음악':'#fd79a8','미술':'#00cec9','체육':'#e17055','정보':'#0984e3',
  };

  // 필터 칩에 표시할 과목 목록 (기록이 있는 과목만)
  const filterSubjects = ['전체', ...Array.from(subjectSet).sort()];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>📚 나의 수업 기록</h1>
      </div>
      <div class="form-body">
        <!-- 통계 요약 -->
        <div class="card" style="margin-bottom:16px;padding:14px;background:linear-gradient(135deg,rgba(108,92,231,0.08),rgba(162,155,254,0.08))">
          <div style="display:flex;justify-content:space-around;text-align:center">
            <div>
              <div style="font-size:22px;font-weight:800;color:var(--primary-light)">${totalCount}</div>
              <div style="font-size:11px;color:var(--text-muted)">총 기록</div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:800;color:#FF9F43">${totalPhotos}</div>
              <div style="font-size:11px;color:var(--text-muted)">첨부 사진</div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:800;color:#00B894">${subjectSet.size}</div>
              <div style="font-size:11px;color:var(--text-muted)">과목</div>
            </div>
            <div>
              <div style="font-size:22px;font-weight:800;color:#FF6B6B">${dates.length}</div>
              <div style="font-size:11px;color:var(--text-muted)">기록일</div>
            </div>
          </div>
        </div>

        <!-- 과목 필터 칩 -->
        ${allRecords.length > 0 ? `
        <div class="record-filter-bar">
          ${filterSubjects.map(sub => {
            const isActive = sub === currentFilter;
            const chipColor = sub === '전체' ? 'var(--primary-light)' : (subjectColors[sub] || '#636e72');
            return '<button class="record-filter-chip' + (isActive ? ' active' : '') + '" style="' + (isActive ? 'background:' + chipColor + ';color:#fff;border-color:' + chipColor : 'border-color:' + chipColor + '40;color:' + chipColor) + '" onclick="state._recordGalleryFilter=\'' + sub + '\';renderScreen()">' + sub + (sub !== '전체' ? ' <span class="record-filter-count">' + allRecords.filter(r => r.subject === sub).length + '</span>' : '') + '</button>';
          }).join('')}
        </div>
        ` : ''}
        
        ${filteredRecords.length === 0 && allRecords.length === 0 ? `
          <div style="text-align:center;padding:60px 0;color:var(--text-muted)">
            <span style="font-size:48px;display:block;margin-bottom:16px">📝</span>
            <p style="font-size:16px;font-weight:600;margin:0 0 8px">아직 기록이 없어요</p>
            <p style="font-size:13px;margin:0">수업 시간에 기록을 시작해보세요!</p>
            <button class="btn-primary" style="margin-top:16px;padding:10px 24px" onclick="goScreen('record-class')">
              <i class="fas fa-pen" style="margin-right:6px"></i>수업 기록하러 가기
            </button>
          </div>
        ` : filteredRecords.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
            <span style="font-size:36px;display:block;margin-bottom:12px">🔍</span>
            <p style="font-size:14px;font-weight:600;margin:0">'${currentFilter}' 과목의 기록이 없습니다</p>
          </div>
        ` : `
          <div class="record-gallery-grid">
            ${filteredRecords.map((r, cardIdx) => {
              const color = subjectColors[r.subject] || '#636e72';
              const keywords = Array.isArray(r.keywords) ? r.keywords : [];
              const photos = Array.isArray(r.photos) ? r.photos : [];
              const photoCount = photos.length;
              const memo = (() => { try { return JSON.parse(r.memo || '{}'); } catch(e) { return {}; } })();
              const d = new Date(r.date);
              const dayNames = ['일','월','화','수','목','금','토'];
              const dateStr = (r.date || '').slice(5).replace('-','/') + ' (' + dayNames[d.getDay()] + ')';
              const clickAction = r._source === 'today' 
                ? "state._viewingTodayRecordIdx=" + r._todayIdx + ";goScreen('class-record-detail')"
                : "state._viewingDbRecord='" + String(r.id) + "';goScreen('class-record-detail')";
              const carouselId = 'rc-carousel-' + cardIdx;
              return `
              <div class="record-gallery-card">
                <div class="record-gallery-thumb" style="border-bottom:3px solid ${color}" onclick="${clickAction}">
                  ${photoCount > 1 ? `
                    <div class="rc-carousel" id="${carouselId}" data-idx="0" data-total="${photoCount}">
                      <div class="rc-carousel-track" style="width:${photoCount * 100}%;transform:translateX(0%)">
                        ${photos.map(p => '<div class="rc-carousel-slide" style="width:' + (100/photoCount) + '%"><img src="' + p + '" alt="필기" class="record-gallery-img" /></div>').join('')}
                      </div>
                      <div class="rc-carousel-dots">
                        ${photos.map((_,i) => '<span class="rc-dot' + (i===0?' active':'') + '"></span>').join('')}
                      </div>
                      ${photoCount > 1 ? '<span class="record-gallery-badge">' + photoCount + '장</span>' : ''}
                    </div>
                  ` : photoCount === 1 ? `
                    <img src="${photos[0]}" alt="필기 사진" class="record-gallery-img" />
                  ` : `
                    <div class="record-gallery-placeholder"><span style="font-size:36px">📝</span><span style="font-size:12px;color:var(--text-muted);margin-top:4px">사진 없음</span></div>
                  `}
                </div>
                <div class="record-gallery-info" onclick="${clickAction}">
                  <div class="record-gallery-subject">
                    <span class="record-gallery-subject-tag" style="background:${color}18;color:${color};border:1px solid ${color}35">${r.subject}</span>
                    ${memo.period ? '<span class="record-gallery-period">' + memo.period + '교시</span>' : ''}
                  </div>
                  ${r.topic ? '<div class="record-gallery-topic">' + r.topic + '</div>' : '<div class="record-gallery-topic" style="color:var(--text-muted);font-style:italic">단원 미입력</div>'}
                  <div class="record-gallery-date"><i class="far fa-calendar-alt" style="margin-right:4px"></i>${dateStr}</div>
                  ${keywords.length > 0 ? '<div class="record-gallery-keywords">' + keywords.slice(0,3).map(k => '<span class="record-gallery-kw" style="background:' + color + '10;color:' + color + ';border:1px solid ' + color + '25">' + k + '</span>').join('') + '</div>' : ''}
                </div>
              </div>`;
            }).join('')}
          </div>
        `}
      </div>
    </div>
  `;
}

// ===== 카드 내 사진 캐러셀 스와이프 핸들러 =====
(function initRecordCarousel() {
  let startX = 0, startY = 0, isDragging = false, currentCarousel = null;
  
  document.addEventListener('touchstart', function(e) {
    const carousel = e.target.closest('.rc-carousel');
    if (!carousel) return;
    e.stopPropagation();
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    isDragging = true;
    currentCarousel = carousel;
  }, { passive: true });
  
  document.addEventListener('touchend', function(e) {
    if (!isDragging || !currentCarousel) return;
    const endX = e.changedTouches[0].clientX;
    const endY = e.changedTouches[0].clientY;
    const diffX = endX - startX;
    const diffY = endY - startY;
    isDragging = false;
    
    // 가로 스와이프만 처리 (세로 스크롤 무시)
    if (Math.abs(diffX) < 30 || Math.abs(diffY) > Math.abs(diffX)) { currentCarousel = null; return; }
    
    const total = parseInt(currentCarousel.dataset.total) || 1;
    let idx = parseInt(currentCarousel.dataset.idx) || 0;
    
    if (diffX < -30 && idx < total - 1) idx++;
    else if (diffX > 30 && idx > 0) idx--;
    else { currentCarousel = null; return; }
    
    currentCarousel.dataset.idx = idx;
    const track = currentCarousel.querySelector('.rc-carousel-track');
    if (track) track.style.transform = 'translateX(-' + (idx * (100 / total)) + '%)';
    
    // 인디케이터 업데이트
    const dots = currentCarousel.querySelectorAll('.rc-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    
    // 배지 업데이트
    const badge = currentCarousel.querySelector('.record-gallery-badge');
    if (badge) badge.textContent = (idx + 1) + '/' + total;
    
    currentCarousel = null;
  }, { passive: true });
  
  // 마우스 드래그 지원 (데스크탑)
  document.addEventListener('mousedown', function(e) {
    const carousel = e.target.closest('.rc-carousel');
    if (!carousel) return;
    e.preventDefault();
    startX = e.clientX;
    isDragging = true;
    currentCarousel = carousel;
  });
  
  document.addEventListener('mouseup', function(e) {
    if (!isDragging || !currentCarousel) return;
    const diffX = e.clientX - startX;
    isDragging = false;
    
    if (Math.abs(diffX) < 30) { currentCarousel = null; return; }
    
    const total = parseInt(currentCarousel.dataset.total) || 1;
    let idx = parseInt(currentCarousel.dataset.idx) || 0;
    
    if (diffX < -30 && idx < total - 1) idx++;
    else if (diffX > 30 && idx > 0) idx--;
    else { currentCarousel = null; return; }
    
    currentCarousel.dataset.idx = idx;
    const track = currentCarousel.querySelector('.rc-carousel-track');
    if (track) track.style.transform = 'translateX(-' + (idx * (100 / total)) + '%)';
    
    const dots = currentCarousel.querySelectorAll('.rc-dot');
    dots.forEach((d, i) => d.classList.toggle('active', i === idx));
    
    const badge = currentCarousel.querySelector('.record-gallery-badge');
    if (badge) badge.textContent = (idx + 1) + '/' + total;
    
    currentCarousel = null;
  });
})();

// 수업 기록 상세 열람
function renderClassRecordDetail() {
  // todayRecords 기반 또는 DB 기반
  let record = null;
  let fromToday = false;
  
  if (state._viewingTodayRecordIdx !== undefined && state._viewingTodayRecordIdx !== null) {
    const idx = state._viewingTodayRecordIdx;
    const r = state.todayRecords[idx];
    if (r && r.done) {
      record = {
        subject: r.subject,
        date: new Date().toISOString().slice(0,10),
        topic: r._topic || '',
        pages: r._pages || '',
        keywords: r._keywords || (r.summary ? r.summary.split(', ').filter(k => k) : []),
        photos: r._photos || [],
        teacher_note: r._teacherNote || '',
        memo: JSON.stringify({ period: r.period }),
        teacher: r.teacher || '',
        color: r.color || '#636e72',
        period: r.period,
        startTime: r.startTime,
        endTime: r.endTime,
        question: r.question,
        _assignmentText: r._assignmentText || '',
        _assignmentDue: r._assignmentDue || '',
        _todayIdx: idx,
      };
      fromToday = true;
    }
  }
  
  // 학원 기록 보기
  if (!record && state._viewingAcademyRecord) {
    const r = state._viewingAcademyRecord;
    if (r && r.done) {
      const memo = { period: r.period, isAcademy: true, academyName: r.academyName, className: r.className };
      record = {
        subject: r.subject,
        date: new Date().toISOString().slice(0,10),
        topic: r._topic || '',
        pages: r._pages || '',
        keywords: r._keywords || (r.summary ? r.summary.split(', ').filter(k => k) : []),
        photos: r._photos || [],
        teacher_note: r._teacherNote || '',
        memo: JSON.stringify(memo),
        teacher: r.academyName || '',
        color: r.color || '#636e72',
        period: r.period,
        startTime: r.startTime,
        endTime: r.endTime,
        question: r.question,
        _assignmentText: r._assignmentText || '',
        _assignmentDue: r._assignmentDue || '',
        _isAcademy: true,
        _academyIdx: r._academyIdx,
      };
      fromToday = true;
    }
  }
  
  if (!record && state._viewingDbRecord) {
    const dbRec = (state._dbClassRecords || []).find(r => String(r.id) === String(state._viewingDbRecord));
    if (dbRec) {
      const memo = (() => { try { return JSON.parse(dbRec.memo || '{}'); } catch(e) { return {}; } })();
      record = {
        subject: dbRec.subject,
        date: dbRec.date,
        topic: dbRec.topic || dbRec.content || '',
        pages: dbRec.pages || memo.pages || '',
        keywords: Array.isArray(dbRec.keywords) ? dbRec.keywords : [],
        photos: Array.isArray(dbRec.photos) ? dbRec.photos : [],
        teacher_note: dbRec.teacher_note || memo.teacherNote || '',
        memo: dbRec.memo,
        period: memo.period || '',
        color: '#636e72',
        _dbId: dbRec.id,
      };
    }
  }
  
  if (!record) { 
    state._viewingTodayRecordIdx = null;
    state._viewingDbRecord = null;
    state._viewingAcademyRecord = null;
    goScreen('main'); 
    return ''; 
  }
  
  const subjectColors = {
    '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
    '사회':'#74B9FF','한국사':'#E056A0','제2외국어':'#A29BFE','기술가정':'#FF9F43',
    '음악':'#fd79a8','미술':'#00cec9','체육':'#e17055','정보':'#0984e3',
  };
  const color = record.color !== '#636e72' ? record.color : (subjectColors[record.subject] || '#636e72');
  const keywords = record.keywords || [];
  const photos = record.photos || [];
  
  const backAction = fromToday 
    ? "state._viewingTodayRecordIdx=null;goScreen('main')" 
    : "state._viewingDbRecord=null;goScreen('class-record-history')";
  
  const editAction = fromToday 
    ? `state._viewingTodayRecordIdx=null;openClassRecordEdit(${record._todayIdx})` 
    : "goScreen('class-record-history')";

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="${backAction}"><i class="fas fa-arrow-left"></i></button>
        <h1>📖 수업 기록</h1>
        ${fromToday ? '<button class="header-action-btn" onclick="' + editAction + '" style="color:var(--primary-light)"><i class="fas fa-edit"></i></button>' : ''}
      </div>
      <div class="form-body">
        <!-- 과목 헤더 -->
        <div class="card" style="margin-bottom:16px;border-left:4px solid ${color}">
          <div style="display:flex;align-items:center;gap:12px">
            <div style="width:44px;height:44px;border-radius:12px;background:${color}15;display:flex;align-items:center;justify-content:center;font-size:20px;font-weight:700;color:${color}">
              ${record.period || '📖'}
            </div>
            <div style="flex:1">
              <div style="font-size:18px;font-weight:700;color:${color}">${record.subject}</div>
              <div style="font-size:12px;color:var(--text-muted)">
                ${record.date}${record.period ? ' · ' + record.period + '교시' : ''}${record.teacher ? ' · ' + record.teacher + ' 선생님' : ''}${record.startTime ? ' · ' + record.startTime + '~' + record.endTime : ''}
              </div>
            </div>
          </div>
        </div>

        <!-- 단원/주제 -->
        ${record.topic ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">📖 단원/주제</label>
          <div style="font-size:15px;font-weight:600;color:var(--text-primary);padding:8px 0">${record.topic}</div>
        </div>
        ` : ''}

        <!-- 교과서 쪽수 -->
        ${record.pages ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">📄 교과서 쪽수</label>
          <div style="font-size:14px;color:var(--text-primary);padding:8px 0">${record.pages}</div>
        </div>
        ` : ''}

        <!-- 핵심 키워드 -->
        ${keywords.length > 0 ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">📝 핵심 키워드</label>
          <div style="display:flex;flex-wrap:wrap;gap:6px;padding:8px 0">
            ${keywords.map(k => `<span style="font-size:13px;padding:4px 12px;border-radius:16px;background:${color}12;color:${color};border:1px solid ${color}30;font-weight:500">${k}</span>`).join('')}
          </div>
        </div>
        ` : ''}

        <!-- 필기 사진 대형 가로 스크롤 갤러리 -->
        ${photos.length > 0 ? `
        <div class="detail-photo-section">
          <div class="detail-photo-header">
            <span class="detail-photo-label">📸 필기 사진</span>
            <span class="detail-photo-count">${photos.length}장</span>
          </div>
          <div class="detail-gallery-wrap">
            <div class="detail-gallery-scroll" id="detailGalleryScroll">
              ${photos.map((p, i) => `
                <div class="detail-gallery-item" data-idx="${i}" ondblclick="openPhotoZoom(${i})">
                  <img src="${p}" alt="필기 ${i+1}" class="detail-gallery-img" loading="lazy" draggable="false">
                </div>
              `).join('')}
            </div>
            <div class="detail-gallery-indicator" id="detailGalleryIndicator">
              <span class="detail-gallery-current">1</span> / <span class="detail-gallery-total">${photos.length}</span>
            </div>
          </div>
          <div class="detail-gallery-hint">
            <i class="fas fa-hand-point-up" style="margin-right:4px"></i>좌우 스와이프로 넘기기 · 더블탭으로 확대
          </div>
        </div>
        ` : ''}

        <!-- 선생님 강조 -->
        ${record.teacher_note ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">⭐ 선생님 강조</label>
          <div style="font-size:14px;color:var(--accent);padding:10px 14px;background:rgba(255,107,107,0.08);border-radius:10px;border:1px solid rgba(255,107,107,0.15);font-weight:500">
            <i class="fas fa-exclamation-circle" style="margin-right:6px"></i>${record.teacher_note}
          </div>
        </div>
        ` : ''}

        <!-- 과제 -->
        ${record._assignmentText ? `
        <div class="field-group" style="margin-bottom:14px">
          <label class="field-label" style="font-size:11px;color:var(--text-muted)">📋 과제</label>
          <div style="font-size:14px;color:var(--text-primary);padding:10px 14px;background:var(--bg-input);border-radius:10px;border:1px solid var(--border)">
            ${record._assignmentText}
            ${record._assignmentDue ? '<div style="font-size:11px;color:var(--text-muted);margin-top:4px">📅 마감: ' + record._assignmentDue + '</div>' : ''}
          </div>
        </div>
        ` : ''}

        <!-- 질문 기록 -->
        ${record.question ? `
        <div class="card" style="margin-top:4px;background:var(--bg-input);border-color:var(--primary)22">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="tt-q-badge">${record.question.level}</span>
            <span style="font-size:13px;font-weight:600">질문 기록</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.5;margin:0">"${record.question.text}"</p>
        </div>
        ` : ''}

        <!-- 수정 버튼 -->
        ${fromToday ? `
        <button class="btn-secondary" style="width:100%;margin-top:16px" onclick="${editAction}">
          <i class="fas fa-edit" style="margin-right:6px"></i> 수정하기
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

// 사진 전체 화면 보기 (핀치줌 + 더블탭 확대 지원)
function openPhotoZoom(photoIdx) {
  let photos = [];
  if (state._viewingTodayRecordIdx !== undefined && state._viewingTodayRecordIdx !== null) {
    const r = state.todayRecords[state._viewingTodayRecordIdx];
    photos = r ? (r._photos || []) : [];
  } else if (state._viewingDbRecord) {
    const dbRec = (state._dbClassRecords || []).find(r => String(r.id) === String(state._viewingDbRecord));
    photos = dbRec ? (Array.isArray(dbRec.photos) ? dbRec.photos : []) : [];
  }
  if (photos.length === 0) return;
  
  const overlay = document.createElement('div');
  overlay.className = 'photo-zoom-overlay';
  
  let currentIdx = photoIdx;
  let scale = 1, posX = 0, posY = 0;
  let lastTap = 0;
  
  function renderZoom() {
    scale = 1; posX = 0; posY = 0;
    overlay.innerHTML = `
      <button class="photo-zoom-close" onclick="this.closest('.photo-zoom-overlay').remove()">&times;</button>
      <div class="photo-zoom-counter">${currentIdx + 1} / ${photos.length}</div>
      <div class="photo-zoom-container" id="photoZoomContainer">
        <img src="${photos[currentIdx]}" class="photo-zoom-img" id="photoZoomImg" draggable="false">
      </div>
      ${photos.length > 1 ? `
        <div class="photo-zoom-nav">
          <button class="photo-zoom-btn" id="pzPrev"><i class="fas fa-chevron-left"></i></button>
          <button class="photo-zoom-btn" id="pzNext"><i class="fas fa-chevron-right"></i></button>
        </div>
      ` : ''}
      <div class="photo-zoom-hint">핀치/더블탭으로 확대 · 좌우 스와이프</div>
    `;
    
    const prev = overlay.querySelector('#pzPrev');
    const next = overlay.querySelector('#pzNext');
    if (prev) prev.addEventListener('click', (e) => { e.stopPropagation(); currentIdx = (currentIdx - 1 + photos.length) % photos.length; renderZoom(); });
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); currentIdx = (currentIdx + 1) % photos.length; renderZoom(); });
    
    // 더블탭 확대/축소
    const container = overlay.querySelector('#photoZoomContainer');
    const img = overlay.querySelector('#photoZoomImg');
    if (!container || !img) return;
    
    container.addEventListener('click', (e) => {
      const now = Date.now();
      if (now - lastTap < 350) {
        // 더블탭 → 토글 확대
        if (scale > 1) { scale = 1; posX = 0; posY = 0; }
        else { scale = 2.5; }
        img.style.transform = 'translate(' + posX + 'px,' + posY + 'px) scale(' + scale + ')';
      }
      lastTap = now;
    });
    
    // 핀치줌
    let initDist = 0, initScale = 1;
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 2) {
        initDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        initScale = scale;
      }
    }, { passive: true });
    container.addEventListener('touchmove', (e) => {
      if (e.touches.length === 2) {
        const dist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        scale = Math.max(0.5, Math.min(5, initScale * (dist / initDist)));
        img.style.transform = 'translate(' + posX + 'px,' + posY + 'px) scale(' + scale + ')';
      }
    }, { passive: true });
    
    // 패닝 (확대 시 드래그 이동)
    let panStartX = 0, panStartY = 0, panPosX = 0, panPosY = 0, isPanning = false;
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1 && scale > 1) {
        isPanning = true;
        panStartX = e.touches[0].clientX - posX;
        panStartY = e.touches[0].clientY - posY;
      }
    }, { passive: true });
    container.addEventListener('touchmove', (e) => {
      if (isPanning && e.touches.length === 1 && scale > 1) {
        posX = e.touches[0].clientX - panStartX;
        posY = e.touches[0].clientY - panStartY;
        img.style.transform = 'translate(' + posX + 'px,' + posY + 'px) scale(' + scale + ')';
      }
    }, { passive: true });
    container.addEventListener('touchend', () => { isPanning = false; }, { passive: true });
    
    // 스와이프로 다음/이전 (scale === 1 일 때만)
    let swStartX = 0;
    container.addEventListener('touchstart', (e) => {
      if (e.touches.length === 1 && scale <= 1) swStartX = e.touches[0].clientX;
    }, { passive: true });
    container.addEventListener('touchend', (e) => {
      if (scale > 1 || e.changedTouches.length !== 1) return;
      const diff = e.changedTouches[0].clientX - swStartX;
      if (Math.abs(diff) > 60) {
        if (diff < 0 && currentIdx < photos.length - 1) { currentIdx++; renderZoom(); }
        else if (diff > 0 && currentIdx > 0) { currentIdx--; renderZoom(); }
      }
    }, { passive: true });
  }
  
  renderZoom();
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', escHandler); }
  });
  document.body.appendChild(overlay);
}

// 레거시 호환
function openPhotoViewer(idx) { openPhotoZoom(idx); }

// 상세 갤러리 스크롤 인디케이터 업데이트
(function initDetailGalleryScroll() {
  document.addEventListener('scroll', function(e) {
    const scroll = e.target;
    if (!scroll || !scroll.classList || !scroll.classList.contains('detail-gallery-scroll')) return;
    const items = scroll.querySelectorAll('.detail-gallery-item');
    if (items.length === 0) return;
    const scrollLeft = scroll.scrollLeft;
    const itemWidth = items[0].offsetWidth;
    const gap = 12; // CSS gap
    const idx = Math.round(scrollLeft / (itemWidth + gap));
    const indicator = scroll.closest('.detail-gallery-wrap')?.querySelector('.detail-gallery-current');
    if (indicator) indicator.textContent = Math.min(idx + 1, items.length);
  }, true);
})();

// 수업 기록 수정 화면 열기
function openClassRecordEdit(idx) {
  state._editingClassRecordIdx = idx;
  goScreen('class-record-edit');
}

// 수업 기록 수정 화면 렌더링
function renderClassRecordEdit() {
  const idx = state._editingClassRecordIdx;
  const r = state.todayRecords[idx];
  if (!r) { goScreen('main'); return ''; }

  const topic = r._topic || '';
  const pages = r._pages || '';
  const keywords = r._keywords || (r.summary ? r.summary.split(', ').filter(k => k) : []);
  const teacherNote = r._teacherNote || '';
  const photos = r._photos || [];
  const assignmentText = r._assignmentText || '';
  const assignmentDue = r._assignmentDue || '';

  const photoThumbs = photos.map((p, i) => `
    <div class="class-photo-thumb" style="position:relative;width:72px;height:72px;flex-shrink:0;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <img src="${p}" style="width:100%;height:100%;object-fit:cover" onclick="viewClassPhoto(${i})">
      <button onclick="removeEditPhoto(${i})" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">&times;</button>
    </div>
  `).join('');

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>✏️ 수업 기록 수정</h1>
        <button class="header-action-btn" onclick="saveClassRecordEdit(${idx})" style="color:var(--primary-light)"><i class="fas fa-save"></i></button>
      </div>

      <div class="form-body">
        <div class="card" style="margin-bottom:16px">
          <div style="display:flex;align-items:center;gap:12px">
            <div class="tt-period-badge done" style="width:36px;height:36px;font-size:14px">${r.period}</div>
            <div>
              <div style="font-size:17px;font-weight:700;color:${r.color}">${r.subject}</div>
              <div style="font-size:12px;color:var(--text-muted)">${r.teacher} 선생님 · ${r.startTime||''}~${r.endTime||''}</div>
            </div>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📖 단원/주제</label>
          <input class="input-field" id="edit-cr-topic" value="${topic}" placeholder="예: 3단원 세포 분열">
        </div>

        <div class="field-group">
          <label class="field-label">📄 교과서 쪽수</label>
          <input class="input-field" id="edit-cr-pages" value="${pages}" placeholder="예: p.84~89">
        </div>

        <div class="field-group">
          <label class="field-label">📝 핵심 키워드 <span style="color:var(--accent)">*필수</span></label>
          <textarea class="input-field" id="edit-cr-keywords" rows="2" placeholder="예: 감수분열, 상동염색체, 2가 염색체">${keywords.join(', ')}</textarea>
        </div>

        <div class="field-group">
          <label class="field-label">📸 필기 사진</label>
          <div class="edit-photos-container" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
            ${photoThumbs}
            <label style="width:72px;height:72px;flex-shrink:0;border-radius:8px;border:2px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);font-size:11px;gap:2px">
              <i class="fas fa-plus" style="font-size:16px"></i>
              <span>추가</span>
              <input type="file" accept="image/*" multiple style="display:none" onchange="handleEditPhotoUpload(this)">
            </label>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">⭐ 선생님 강조</label>
          <input class="input-field" id="edit-cr-teacher-note" value="${teacherNote}" placeholder='예: "서술형 나옴"'>
        </div>

        <div class="field-group" style="background:var(--bg-input);border-radius:12px;padding:14px;border:1px solid var(--border)">
          <label class="field-label" style="margin-bottom:8px">📋 과제 <span style="color:var(--text-muted)">(있으면 적어줘!)</span></label>
          <input class="input-field" id="edit-cr-assignment" value="${assignmentText}" placeholder="예: 워크북 p.30~32 풀어오기" oninput="toggleEditDeadline()">
          <div class="edit-deadline-section" style="display:${assignmentText ? 'block' : 'none'};margin-top:12px">
            <label class="field-label" style="margin-bottom:8px">📅 마감일</label>
            <input type="date" class="input-field" id="edit-cr-due" value="${assignmentDue}" style="font-size:13px">
          </div>
        </div>

        ${r.question ? `
        <div class="card" style="margin-top:12px;background:var(--bg-input);border-color:var(--primary)22">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
            <span class="tt-q-badge">${r.question.level}</span>
            <span style="font-size:13px;font-weight:600">질문 기록</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.5">"${r.question.text}"</p>
        </div>
        ` : ''}

        <button class="btn-primary" style="width:100%;margin-top:20px" onclick="saveClassRecordEdit(${idx})">
          <i class="fas fa-save" style="margin-right:6px"></i> 수정 완료
        </button>
      </div>
    </div>
  `;
}

// 수정 화면 사진 업로드
function handleEditPhotoUpload(input) {
  if (!input.files || input.files.length === 0) return;
  const idx = state._editingClassRecordIdx;
  const r = state.todayRecords[idx];
  if (!r) return;
  if (!r._photos) r._photos = [];

  const files = Array.from(input.files).slice(0, 20 - r._photos.length);
  let loaded = 0;
  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      r._photos.push(e.target.result);
      loaded++;
      if (loaded === files.length) renderScreen();
    };
    reader.readAsDataURL(file);
  });
  input.value = '';
}

// 수정 화면 사진 삭제
function removeEditPhoto(photoIdx) {
  const idx = state._editingClassRecordIdx;
  const r = state.todayRecords[idx];
  if (!r || !r._photos) return;
  r._photos.splice(photoIdx, 1);
  renderScreen();
}

// 수정 화면 과제 입력시 마감일 토글
function toggleEditDeadline() {
  const input = document.getElementById('edit-cr-assignment');
  const section = document.querySelector('.edit-deadline-section');
  if (input && section) {
    section.style.display = input.value.trim().length > 0 ? 'block' : 'none';
  }
}

// 수업 기록 수정 저장
function saveClassRecordEdit(idx) {
  const r = state.todayRecords[idx];
  if (!r) return;

  const topic = document.getElementById('edit-cr-topic')?.value?.trim() || '';
  const pages = document.getElementById('edit-cr-pages')?.value?.trim() || '';
  const keywordsInput = document.getElementById('edit-cr-keywords')?.value || '';
  const teacherNote = document.getElementById('edit-cr-teacher-note')?.value?.trim() || '';
  const keywords = keywordsInput.split(/[,，、\n]+/).map(k => k.trim()).filter(k => k);
  const photos = r._photos || [];
  
  // 과제 정보
  const assignmentText = document.getElementById('edit-cr-assignment')?.value?.trim() || '';
  const assignmentDue = document.getElementById('edit-cr-due')?.value || '';

  // state 업데이트
  r.summary = topic || keywords.join(', ') || r.summary;
  r._topic = topic;
  r._pages = pages;
  r._keywords = keywords;
  r._teacherNote = teacherNote;
  r._assignmentText = assignmentText;
  r._assignmentDue = assignmentDue;

  // DB 업데이트
  if (r._dbRecordId && DB.studentId()) {
    DB.updateClassRecord(r._dbRecordId, {
      content: topic,
      keywords,
      memo: JSON.stringify({ period: r.period || '', pages: pages, teacherNote: teacherNote, photoCount: photos.length }),
      topic,
      pages,
      photos,
      teacher_note: teacherNote,
    });
  }
  
  // 과제가 새로 추가되었으면 플래너에 등록
  if (assignmentText && !r._assignmentRegistered) {
    state._classAssignmentDue = assignmentDue;
    const assignInput = { value: assignmentText };
    // 임시로 DOM에 의존하지 않고 직접 등록
    const dueDate = assignmentDue || new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10);
    const subjectColors = {
      '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
      '사회':'#74B9FF','한국사':'#E056A0','제2외국어':'#A29BFE','기술가정':'#FF9F43',
    };
    const newAssignment = {
      id: 'auto-' + Date.now(),
      subject: r.subject || '미지정',
      title: assignmentText,
      desc: `${r.period || ''}교시 수업 중 등록 (수정에서 추가)`,
      type: '과제',
      teacher: '',
      dueDate: dueDate,
      createdDate: new Date().toISOString().split('T')[0],
      color: subjectColors[r.subject] || '#636e72',
      status: 'pending',
      progress: 0,
      plan: []
    };
    if (!state.assignments) state.assignments = [];
    state.assignments.push(newAssignment);
    if (DB.studentId()) {
      DB.saveAssignment({
        subject: r.subject || '미지정',
        title: assignmentText,
        description: `${r.period || ''}교시 수업 중 등록`,
        teacherName: '',
        dueDate: dueDate,
        color: subjectColors[r.subject] || '#636e72',
        planData: [],
      });
    }
    // 플래너 일간 뷰에도 마감일 항목 추가
    addAssignmentToPlannerItems(newAssignment);
    r._assignmentRegistered = true;
  }

  goScreen('main');
  showXpPopup(0, '수업 기록이 수정되었어요! ✏️');
}

// ==================== HOME TAB (H-01~H-05) ====================

function renderHomeTab() {
  // 학원 수업 초기화
  initTodayAcademy();
  const acRecords = state.todayAcademyRecords || [];
  
  const schoolDone = state.todayRecords.filter(r => r.done).length;
  const acDone = acRecords.filter(r => r.done).length;
  const doneCount = schoolDone + acDone;
  const total = state.todayRecords.length + acRecords.length;
  const recordPct = total > 0 ? Math.round(doneCount / total * 100) : 0;
  const hour = new Date().getHours();
  const greeting = hour < 12 ? '좋은 아침' : hour < 18 ? '좋은 오후' : '좋은 저녁';
  
  const userName = state._authUser?.name || '민준';
  const now = new Date();
  const dayNames = ['일','월','화','수','목','금','토'];
  
  // 투두리스트 데이터 (state에 없으면 초기화)
  if (!state.quickTodos) state.quickTodos = [];
  
  // 질문 통계 비동기 로드 (주간 현황 표시용)
  if (state._authUser?.id && !state._myQaStatsLoaded) {
    state._myQaStatsLoaded = true;
    setTimeout(() => {
      fetch(`/api/my-questions/stats?studentId=${state._authUser.id}`)
        .then(r => r.json())
        .then(data => { state.myQaStats = data; renderScreen(); })
        .catch(() => {});
    }, 200);
  }

  // 크로켓 포인트 잔액 비동기 로드
  if (state._authUser?.id && !state._croquetLoaded) {
    state._croquetLoaded = true;
    fetch(`/api/student/${state._authUser.id}/croquet-points`)
      .then(r => r.json())
      .then(data => {
        const prev = state._croquetBalance || 0;
        const next = data.balance || 0;
        state._croquetBalance = next;
        // 카운팅 애니메이션 (값이 변했을 때만)
        if (prev !== next) {
          const el = document.getElementById('croquet-balance-display');
          if (el) {
            const duration = 800;
            const startTime = Date.now();
            const animate = () => {
              const elapsed = Date.now() - startTime;
              const progress = Math.min(elapsed / duration, 1);
              const eased = 1 - Math.pow(1 - progress, 3);
              const current = Math.round(prev + (next - prev) * eased);
              el.textContent = current.toLocaleString() + 'P';
              if (progress < 1) requestAnimationFrame(animate);
            };
            requestAnimationFrame(animate);
          }
        }
      })
      .catch(() => {});
  }
  
  return `
    <div class="tab-content animate-in">
      <!-- Greeting Row -->
      <div class="home-top-row">
        <div class="home-greeting">
          <div>
            <h2>${greeting}, ${userName}! 👋</h2>
            <p>오늘도 호기심 사다리를 올라가볼까요? 🪜</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:10px">
          <div class="croquet-point-card" onclick="goScreen('croquet-history')" style="cursor:pointer;padding:8px 14px;background:linear-gradient(135deg,rgba(255,159,67,0.15),rgba(253,203,110,0.1));border:1px solid rgba(255,159,67,0.3);border-radius:var(--radius-md);display:flex;align-items:center;gap:8px;white-space:nowrap;transition:all 0.2s" onmouseenter="this.style.transform='scale(1.05)'" onmouseleave="this.style.transform='scale(1)'">
            <span style="font-size:18px">🍩</span>
            <div>
              <div style="font-size:10px;color:var(--text-muted);font-weight:600">크로켓 포인트</div>
              <div style="font-size:16px;font-weight:800;color:#FF9F43" id="croquet-balance-display">${(state._croquetBalance || 0).toLocaleString()}P</div>
            </div>
          </div>
          <div class="home-date" onclick="goScreen('notifications')" style="cursor:pointer;position:relative">
            <span class="date-day">${now.getDate()}</span>
            <span class="date-month">${now.getMonth()+1}월 (${dayNames[now.getDay()]})</span>
            ${state.notifications.filter(n=>n.unread).length > 0 ? `<span style="position:absolute;top:-4px;right:-4px;width:8px;height:8px;background:var(--accent);border-radius:50%;border:2px solid var(--bg-dark)"></span>` : ''}
          </div>
        </div>
      </div>

      ${hasUnrecordedEndedClass() ? `
      <!-- 미기록 수업 경고 배너 -->
      <div class="unrecorded-warn-banner stagger-1 animate-in" onclick="goScreen('class-end-popup')" style="margin:0 16px 12px">
        <span style="font-size:20px">🔔</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--accent)">미기록 수업 ${countUnrecordedEndedClasses()}개!</div>
          <div style="font-size:11px;color:var(--text-secondary)">끝난 수업이 있어요. 탭하여 바로 기록하세요</div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--accent);font-size:12px"></i>
      </div>
      ` : ''}

      ${state._mentorFeedbackUnread > 0 ? `
      <!-- 멘토 피드백 알림 배너 -->
      <div class="animate-in stagger-1" onclick="goScreen('mentor-feedback')" style="margin:0 16px 12px;padding:12px 16px;background:linear-gradient(135deg,rgba(108,92,231,0.15),rgba(0,184,148,0.1));border:1px solid rgba(108,92,231,0.3);border-radius:var(--radius-md);display:flex;align-items:center;gap:10px;cursor:pointer">
        <span style="font-size:20px">💬</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--primary-light)">멘토 피드백 ${state._mentorFeedbackUnread}건</div>
          <div style="font-size:11px;color:var(--text-secondary)">선생님이 보낸 피드백이 있어요!</div>
        </div>
        <i class="fas fa-chevron-right" style="color:var(--primary-light);font-size:12px"></i>
      </div>
      ` : ''}

      <!-- 1행: 좌(루틴+투두) / 우(시간표) -->
      <div class="home-row-top">
        <div class="home-col-left">
          <!-- Morning Routine Card -->
          <div class="card card-gradient-purple stagger-1 animate-in home-card-routine">
            <div class="card-header-row">
              <span class="card-title">☀️ 아침 루틴</span>
              <span class="xp-badge-sm">+10 XP</span>
            </div>
            <div class="routine-checklist">
              <div class="routine-item done">
                <i class="fas fa-check-circle"></i>
                <span>오늘 시간표 확인</span>
              </div>
              <div class="routine-item ${state.mood?'done':''}">
                <i class="fas ${state.mood?'fa-check-circle':'fa-circle'}"></i>
                <span>무드 체크</span>
              </div>
            </div>
            <div class="mood-selector">
              ${[
                {emoji:'😄', label:'최고'},
                {emoji:'🙂', label:'좋음'},
                {emoji:'😐', label:'보통'},
                {emoji:'😔', label:'별로'},
                {emoji:'😫', label:'힘듦'}
              ].map(m => `
                <button class="mood-btn ${state.mood===m.emoji?'active':''}" data-mood="${m.emoji}">
                  <span class="mood-emoji">${m.emoji}</span>
                  <span class="mood-label">${m.label}</span>
                </button>
              `).join('')}
            </div>
          </div>

          <!-- 오늘 일정 미니 아젠다 -->
          <div class="card stagger-2 animate-in home-card-todo">
            <div class="card-header-row">
              <span class="card-title">📅 오늘 일정</span>
              <span class="card-subtitle" onclick="state.studentTab='planner';state.plannerView='daily';renderScreen()" style="cursor:pointer;color:var(--primary-light)">전체보기 →</span>
            </div>
            ${(() => {
              const today = new Date().toISOString().split('T')[0];
              const items = state.plannerItems.filter(i => i.date === today).sort((a,b) => a.time.localeCompare(b.time));
              const todos = state.quickTodos || [];
              const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
              if (items.length === 0 && todos.length === 0) {
                return '<div style="text-align:center;padding:16px 0;color:var(--text-muted);font-size:12px">오늘 일정이 없습니다</div>';
              }
              let html = '<div class="home-agenda-list">';
              // 일정 (최대 5개)
              items.slice(0, 5).forEach(item => {
                const sh = parseInt(item.time.split(':')[0]), sm = parseInt(item.time.split(':')[1]);
                const eh = parseInt(item.endTime.split(':')[0]), em = parseInt(item.endTime.split(':')[1]);
                const isNow = nowMin >= sh*60+sm && nowMin < eh*60+em;
                html += '<div class="home-agenda-item ' + (item.done?'done':'') + (isNow?' now':'') + '" onclick="state.studentTab=\'planner\';state.plannerView=\'daily\';renderScreen()">' +
                  '<div class="home-agenda-time">' + item.time + '</div>' +
                  '<div class="home-agenda-bar" style="background:' + item.color + '"></div>' +
                  '<div class="home-agenda-info">' +
                    '<span class="home-agenda-title">' + (item.icon||'📌') + ' ' + item.title + '</span>' +
                  '</div>' +
                  (item.done ? '<i class="fas fa-check-circle" style="color:var(--success);font-size:12px;flex-shrink:0"></i>' :
                   isNow ? '<span class="agenda-now-tag" style="font-size:9px;padding:1px 5px">진행중</span>' : '') +
                '</div>';
              });
              if (items.length > 5) {
                html += '<div style="font-size:11px;color:var(--text-muted);text-align:center;padding:2px 0">+' + (items.length - 5) + '개 일정 더보기</div>';
              }
              // Quick Todos (최대 3개)
              if (todos.length > 0) {
                html += '<div style="border-top:1px solid var(--border);margin-top:6px;padding-top:6px">';
                todos.slice(0, 3).forEach((t, i) => {
                  html += '<div class="home-agenda-item ' + (t.done?'done':'') + '" style="pointer-events:none;padding:4px 0">' +
                    '<i class="fas ' + (t.done?'fa-check-circle':'fa-circle') + '" style="color:' + (t.done?'var(--success)':'var(--text-muted)') + ';font-size:11px;width:36px;text-align:center;flex-shrink:0"></i>' +
                    '<div class="home-agenda-info"><span class="home-agenda-title" style="font-size:12px">' + t.text + '</span></div>' +
                  '</div>';
                });
                if (todos.length > 3) html += '<div style="font-size:10px;color:var(--text-muted);text-align:center;padding:2px">+' + (todos.length - 3) + '개 할 일</div>';
                html += '</div>';
              }
              html += '</div>';
              return html;
            })()}
          </div>
        </div>

        <!-- Today Timetable (우측) -->
        <div class="card stagger-2 animate-in home-card-timetable">
          <div class="card-header-row">
            <span class="card-title">📋 오늘 시간표</span>
            <span class="card-subtitle">${doneCount}/${total} 기록완료</span>
          </div>
          <div class="timetable-progress">
            <div class="timetable-progress-fill" style="width:${recordPct}%"></div>
          </div>
          <div class="tt-scroll-wrapper">
            <div class="tt-scroll-fade tt-scroll-fade-top"></div>
            <div class="timetable-list" id="tt-scroll-area">
            ${state.todayRecords.length === 0 && acRecords.length === 0 ? `
              <div style="text-align:center;padding:20px 0;color:var(--text-muted)">
                <div style="font-size:28px;margin-bottom:8px">😴</div>
                <div style="font-size:13px;font-weight:600">오늘은 수업이 없어요</div>
                <div style="font-size:11px;margin-top:4px">쉬는 날에도 복습하면 +XP!</div>
              </div>
            ` : ''}
            ${state.todayRecords.map((r, idx) => `
              <div class="tt-row ${r.done?'done':''} ${idx === schoolDone && !r.done?'current':''} ${getClassEndStatus(r)==='just-ended'?'tt-just-ended':''}" data-tt-idx="${idx}" data-tt-start="${r.startTime||''}" data-tt-end="${r.endTime||''}" data-tt-done="${r.done?1:0}" ${r.done ? `onclick="viewTodayRecord(${idx})" style="cursor:pointer"` : ''}>
                <div class="tt-period-badge ${r.done?'done':idx===schoolDone?'current':''}" style="${r.done?'':''}">
                  ${r.done ? '<i class="fas fa-check" style="font-size:10px"></i>' : r.period}
                </div>
                <div class="tt-info">
                  <span class="tt-subject-name" style="color:${r.color}">${r.subject}</span>
                  ${r.done ? `<span class="tt-summary">${r.summary} <i class="fas fa-pencil-alt" style="font-size:9px;opacity:0.4;margin-left:4px"></i></span>` : `<span class="tt-summary" style="opacity:0.4">${r.teacher} 선생님 · ${r.startTime||''}~${r.endTime||''}</span>`}
                </div>
                <div class="tt-action">
                  ${r.done
                    ? `<div style="display:flex;align-items:center;gap:4px">
                        <button class="tt-q-btn" onclick="event.stopPropagation();openQuestionFromTimetable('${r.subject}', ${idx})" title="질문 등록">
                          ❓
                        </button>
                        <span class="tt-done-badge">✅</span>
                      </div>`
                    : (idx === schoolDone
                      ? `<button class="tt-record-btn ${getClassEndStatus(r)==='just-ended'?'tt-btn-glow':''}" onclick="event.stopPropagation();goScreen('class-end-popup')">기록하기</button>`
                      : `<span class="tt-locked"><i class="fas fa-lock" style="font-size:10px"></i></span>`
                    )
                  }
                </div>
              </div>
            `).join('')}
            
            ${acRecords.length > 0 ? `
            <!-- 학원 수업 구분선 -->
            <div class="tt-academy-divider">
              <span class="tt-academy-label">📚 학원</span>
              <div class="tt-academy-line"></div>
            </div>
            ${acRecords.map((r, idx) => `
              <div class="tt-row tt-academy-row ${r.done?'done':''} ${idx === acDone && !r.done?'current':''} ${getClassEndStatus(r)==='just-ended'?'tt-just-ended':''}" data-tt-start="${r.startTime||''}" data-tt-end="${r.endTime||''}" data-tt-done="${r.done?1:0}" ${r.done ? `onclick="viewAcademyRecord(${idx})" style="cursor:pointer"` : ''}>
                <div class="tt-period-badge academy ${r.done?'done':idx===acDone?'current':''}" style="font-size:9px">
                  ${r.done ? '<i class="fas fa-check" style="font-size:10px"></i>' : '<i class="fas fa-graduation-cap" style="font-size:10px"></i>'}
                </div>
                <div class="tt-info">
                  <span class="tt-subject-name" style="color:${r.color}">${r.subject}</span>
                  ${r.done 
                    ? `<span class="tt-summary">${r.summary} <i class="fas fa-pencil-alt" style="font-size:9px;opacity:0.4;margin-left:4px"></i></span>` 
                    : `<span class="tt-summary" style="opacity:0.4">${r.academyName} · ${r.startTime||''}~${r.endTime||''}</span>`}
                </div>
                <div class="tt-action">
                  ${r.done
                    ? `<div style="display:flex;align-items:center;gap:4px">
                        <button class="tt-q-btn" onclick="event.stopPropagation();openQuestionFromTimetable('${r.subject}', ${idx}, true)" title="질문 등록">
                          ❓
                        </button>
                        <span class="tt-done-badge">✅</span>
                      </div>`
                    : (idx === acDone
                      ? `<button class="tt-record-btn ${getClassEndStatus(r)==='just-ended'?'tt-btn-glow':''}" onclick="event.stopPropagation();openAcademyRecordPopup(${idx})">기록하기</button>`
                      : `<span class="tt-locked"><i class="fas fa-lock" style="font-size:10px"></i></span>`
                    )
                  }
                </div>
              </div>
            `).join('')}
            ` : ''}
          </div>
            <div class="tt-scroll-fade tt-scroll-fade-bottom"></div>
          </div>
        </div>
      </div>

      <!-- 2행: 미션 | 주간현황 | 과제 (3등분) -->
      <div class="home-row-bottom">
        <!-- Daily Missions -->
        <div class="card stagger-3 animate-in">
          <div class="card-header-row">
            <span class="card-title">🎯 오늘의 미션</span>
            <span class="xp-badge-sm">완료 시 +30 XP</span>
          </div>
          ${state.missions.map((m,i) => `
            <div class="mission-row ${m.done?'done':''}">
              <div class="mission-icon">${m.icon}</div>
              <div class="mission-info">
                <span class="mission-text">${m.text}</span>
                <div class="mission-bar">
                  <div class="mission-bar-fill" style="width:${Math.min(m.current/m.target*100,100)}%"></div>
                </div>
              </div>
              <span class="mission-count">${m.current}/${m.target}</span>
              ${m.done ? '<i class="fas fa-check-circle" style="color:var(--success);font-size:18px"></i>' : ''}
            </div>
          `).join('')}
        </div>

        <!-- Weekly Mini Chart -->
        <div class="card stagger-4 animate-in">
          <div class="card-header-row">
            <span class="card-title">📊 이번 주 현황</span>
            <button class="card-link" onclick="goScreen('weekly-report')">자세히 →</button>
          </div>
          <div class="weekly-mini-stats">
            <div class="mini-stat">
              <span class="mini-stat-value" style="color:var(--primary-light)">12</span>
              <span class="mini-stat-label">기록</span>
            </div>
            <div class="mini-stat-divider"></div>
            <div class="mini-stat">
              <span class="mini-stat-value" style="color:var(--accent)">${state.myQaStats?.weeklyQuestions || 0}</span>
              <span class="mini-stat-label">질문</span>
            </div>
            <div class="mini-stat-divider"></div>
            <div class="mini-stat">
              <span class="mini-stat-value" style="color:var(--teach-green)">2</span>
              <span class="mini-stat-label">교학상장</span>
            </div>
            <div class="mini-stat-divider"></div>
            <div class="mini-stat">
              <span class="mini-stat-value" style="color:var(--question-b)">${state.myQaStats?.unanswered || 0}</span>
              <span class="mini-stat-label">미답변</span>
            </div>
          </div>
          <div class="weekly-bar-chart">
            ${state.weeklyData.days.map((d, i) => `
              <div class="weekly-bar-col">
                <div class="weekly-bar-stack">
                  <div class="weekly-bar-q" style="height:${state.weeklyData.questions[i]*12}px"></div>
                  <div class="weekly-bar-r" style="height:${state.weeklyData.records[i]*8}px"></div>
                </div>
                <span class="weekly-bar-label ${i===4?'style="color:var(--primary-light);font-weight:700"':''}">${d}</span>
              </div>
            `).join('')}
          </div>
          <div class="chart-legend">
            <span><span class="legend-dot" style="background:var(--primary)"></span>기록</span>
            <span><span class="legend-dot" style="background:var(--accent)"></span>질문</span>
          </div>
        </div>

        <!-- Upcoming Assignments -->
        ${state.assignments.filter(a => a.status !== 'completed').length > 0 ? `
        <div class="card stagger-5 animate-in">
          <div class="card-header-row">
            <span class="card-title">📋 다가오는 과제</span>
            <button class="card-link" onclick="goScreen('assignment-list')">전체보기 →</button>
          </div>
          <div class="upcoming-assignments">
            ${state.assignments.filter(a => a.status !== 'completed').sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).map(a => {
              const dDay = getDday(a.dueDate);
              const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
              const urgency = dDay <= 1 ? 'urgent' : dDay <= 3 ? 'warning' : 'normal';
              return `
              <div class="upcoming-assignment-card ${urgency}" onclick="state.viewingAssignment='${a.id}';goScreen('assignment-plan')">
                <div class="ua-left">
                  <div class="ua-dday-badge ${urgency}">${dDayText}</div>
                </div>
                <div class="ua-center">
                  <div class="ua-subject-row">
                    <span class="ua-subject-dot" style="background:${a.color}"></span>
                    <span class="ua-subject">${a.subject}</span>
                    <span class="ua-type">${a.type || ''}</span>
                  </div>
                  <div class="ua-title">${a.title}</div>
                  <div class="ua-progress-row">
                    <div class="ua-progress-bar"><div class="ua-progress-fill" style="width:${a.progress}%;background:${a.color}"></div></div>
                    <span class="ua-progress-text">${a.progress}%</span>
                  </div>
                </div>
                <div class="ua-right">
                  <i class="fas fa-chevron-right"></i>
                </div>
              </div>
              `;
            }).join('')}
          </div>
        </div>
        ` : ''}
      </div>

      <!-- 하단 Quick Actions 바 -->
      <div class="home-bottom-actions">
        <button class="home-bottom-btn ${isEveningTime()?'active':''}" onclick="goScreen('evening-routine')">
          <i class="fas fa-moon"></i>
          <span>저녁 루틴</span>
        </button>
        <button class="home-bottom-btn ${hasUnrecordedEndedClass()?'active':''}" onclick="goScreen('class-end-popup')">
          <i class="fas fa-bell"></i>
          <span>수업종료 팝업</span>
          ${hasUnrecordedEndedClass()?`<span class="home-bottom-badge">${countUnrecordedEndedClasses()}</span>`:''}
        </button>
        <button class="home-bottom-btn" onclick="goScreen('assignment-list')">
          <i class="fas fa-clipboard-list"></i>
          <span>과제 관리</span>
        </button>
      </div>
    </div>
  `;
}

// ==================== 아하 리포트 ====================

if (!state._ahaReport) state._ahaReport = { step: 1, subject: '', unit: '', photos: [], submitted: false };

function renderAhaReport() {
  const aha = state._ahaReport;

  // 제출 완료 → 결과 플레이스홀더 화면
  if (aha.submitted) {
    return `
      <div class="full-screen animate-slide">
        <div class="screen-header">
          <button class="back-btn" onclick="state._ahaReport={step:1,subject:'',unit:'',photos:[],submitted:false};goScreen('main');state.studentTab='record'"><i class="fas fa-arrow-left"></i></button>
          <h1>💡 아하 리포트</h1>
        </div>
        <div class="form-body">
          <!-- 제출 정보 요약 -->
          <div class="card" style="margin-bottom:16px;padding:16px;background:linear-gradient(135deg,rgba(255,159,67,0.1),rgba(253,203,110,0.06))">
            <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
              <span style="font-size:24px">💡</span>
              <div>
                <div style="font-size:15px;font-weight:700;color:var(--text-main)">아하 리포트 제출 완료</div>
                <div style="font-size:12px;color:var(--text-muted)">${aha.subject || '과목 미선택'} ${aha.unit ? '· ' + aha.unit : ''} · 사진 ${aha.photos.length}장</div>
              </div>
            </div>
            <div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:4px">
              ${aha.photos.map((p, i) => `<img src="${p}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;flex-shrink:0;border:1px solid var(--border)" />`).join('')}
            </div>
          </div>

          <!-- 분석 준비 중 배너 -->
          <div style="text-align:center;padding:16px;margin-bottom:20px">
            <div style="font-size:32px;margin-bottom:8px">🔬</div>
            <div style="font-size:15px;font-weight:700;color:var(--text-main)">분석 준비 중...</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">AI가 사진을 분석하여 리포트를 생성합니다</div>
          </div>

          <!-- 4개 분석 섹션 플레이스홀더 -->
          ${[
            { icon: '📌', title: '문제 상황' },
            { icon: '🎯', title: '주제 설정' },
            { icon: '🔍', title: '탐구 과정 및 결론 도출' },
            { icon: '💡', title: '자가 피드백' },
          ].map(sec => `
            <div class="card" style="margin-bottom:10px;padding:16px;opacity:0.6">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                <span style="font-size:18px">${sec.icon}</span>
                <span style="font-size:14px;font-weight:700;color:var(--text-main)">${sec.title}</span>
                <span style="margin-left:auto;font-size:11px;color:var(--text-muted);background:var(--bg-input);padding:2px 8px;border-radius:8px">분석 예정</span>
              </div>
              <div style="height:48px;background:var(--bg-input);border-radius:8px;display:flex;align-items:center;justify-content:center">
                <div style="width:60%;height:10px;background:var(--border);border-radius:5px;opacity:0.5"></div>
              </div>
            </div>
          `).join('')}

          <!-- AI 피드백 플레이스홀더 -->
          <div class="card" style="margin-bottom:10px;padding:16px;opacity:0.6;border-left:3px solid var(--primary-light)">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
              <span style="font-size:18px">🤖</span>
              <span style="font-size:14px;font-weight:700;color:var(--text-main)">AHA 리포트 피드백</span>
              <span style="margin-left:auto;font-size:11px;color:var(--text-muted);background:var(--bg-input);padding:2px 8px;border-radius:8px">분석 예정</span>
            </div>
            <div style="height:64px;background:var(--bg-input);border-radius:8px;display:flex;align-items:center;justify-content:center">
              <div style="width:80%;height:10px;background:var(--border);border-radius:5px;opacity:0.5"></div>
            </div>
          </div>

          <button onclick="state._ahaReport={step:1,subject:'',unit:'',photos:[],submitted:false};goScreen('main');state.studentTab='record'" class="btn-primary" style="width:100%;margin-top:16px">기록 탭으로 돌아가기</button>
        </div>
      </div>
    `;
  }

  // 작성 화면
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state._ahaReport={step:1,subject:'',unit:'',photos:[],submitted:false};goScreen('main');state.studentTab='record'"><i class="fas fa-arrow-left"></i></button>
        <h1>💡 아하 리포트</h1>
      </div>
      <div class="form-body">
        <!-- 스텝 인디케이터 -->
        <div style="display:flex;gap:8px;margin-bottom:20px">
          ${[{n:1,label:'기본 정보'},{n:2,label:'사진 업로드'},{n:3,label:'제출'}].map(s => `
            <div style="flex:1;text-align:center;padding:8px 0;border-radius:8px;font-size:12px;font-weight:600;transition:all 0.3s;${aha.step >= s.n ? 'background:rgba(255,159,67,0.15);color:#FF9F43;border:1px solid rgba(255,159,67,0.3)' : 'background:var(--bg-input);color:var(--text-muted);border:1px solid var(--border)'}">
              <div style="font-size:16px;font-weight:800">${s.n}</div>
              <div>${s.label}</div>
            </div>
          `).join('')}
        </div>

        ${aha.step === 1 ? `
        <!-- Step 1: 기본 정보 -->
        <div class="card" style="padding:20px;margin-bottom:16px">
          <div style="font-size:15px;font-weight:700;margin-bottom:16px;color:var(--text-main)">📋 기본 정보</div>
          
          <div style="margin-bottom:16px">
            <label style="font-size:13px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">과목 선택 *</label>
            <select id="aha-subject" style="width:100%;padding:12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px">
              <option value="">과목을 선택하세요</option>
              ${['국어','영어','수학','과학','사회','기타'].map(s => `<option value="${s}" ${aha.subject === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select>
          </div>
          
          <div style="margin-bottom:16px">
            <label style="font-size:13px;font-weight:600;color:var(--text-secondary);display:block;margin-bottom:6px">수업 단원 및 내용 <span style="font-size:11px;color:var(--text-muted)">(생략 가능)</span></label>
            <input type="text" id="aha-unit" value="${aha.unit || ''}" placeholder="예: 3단원 세포 분열, 미적분 극한" style="width:100%;padding:12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:14px" />
          </div>

          <button onclick="ahaStep1Next()" class="btn-primary" style="width:100%;padding:14px;font-size:15px">다음 →</button>
        </div>
        ` : aha.step === 2 ? `
        <!-- Step 2: 사진 업로드 -->
        <div class="card" style="padding:20px;margin-bottom:16px">
          <div style="font-size:15px;font-weight:700;margin-bottom:4px;color:var(--text-main)">📸 사진 업로드</div>
          <div style="font-size:12px;color:var(--text-muted);margin-bottom:16px">수업 필기, 실험 결과, 자료 사진 등을 올려주세요 (최소 1장, 최대 3장)</div>
          
          <!-- 업로드된 사진 미리보기 -->
          <div id="aha-photos-preview" style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px">
            ${aha.photos.map((p, i) => `
              <div style="position:relative;width:100px;height:100px;border-radius:12px;overflow:hidden;border:2px solid var(--border)">
                <img src="${p}" style="width:100%;height:100%;object-fit:cover" />
                <button onclick="ahaRemovePhoto(${i})" style="position:absolute;top:4px;right:4px;width:24px;height:24px;border-radius:50%;background:rgba(0,0,0,0.7);border:none;color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;justify-content:center">✕</button>
              </div>
            `).join('')}
            ${aha.photos.length < 3 ? `
              <div style="width:100px;height:100px;border-radius:12px;border:2px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;cursor:pointer;transition:all 0.2s" onclick="document.getElementById('aha-photo-input').click()">
                <i class="fas fa-plus" style="font-size:20px;color:var(--text-muted)"></i>
                <span style="font-size:10px;color:var(--text-muted)">${aha.photos.length}/3</span>
              </div>
            ` : ''}
          </div>

          <!-- 촬영/갤러리 버튼 -->
          <div style="display:flex;gap:10px;margin-bottom:16px">
            <button onclick="document.getElementById('aha-camera-input').click()" style="flex:1;padding:12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
              <i class="fas fa-camera" style="color:var(--primary-light)"></i> 카메라 촬영
            </button>
            <button onclick="document.getElementById('aha-photo-input').click()" style="flex:1;padding:12px;background:var(--bg-input);border:1px solid var(--border);border-radius:var(--radius-md);color:var(--text-main);font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:6px">
              <i class="fas fa-images" style="color:#FF9F43"></i> 갤러리 선택
            </button>
          </div>

          <!-- 숨겨진 파일 입력 -->
          <input type="file" id="aha-camera-input" accept="image/*" capture="environment" style="display:none" onchange="ahaHandlePhotos(this)" />
          <input type="file" id="aha-photo-input" accept="image/*" multiple style="display:none" onchange="ahaHandlePhotos(this)" />

          <div id="aha-photo-error" style="display:none;padding:10px;background:rgba(214,48,49,0.1);border:1px solid rgba(214,48,49,0.3);border-radius:8px;font-size:12px;color:var(--danger);margin-bottom:12px;text-align:center"></div>

          <div style="display:flex;gap:10px">
            <button onclick="state._ahaReport.step=1;renderScreen()" class="btn-secondary" style="flex:1;padding:14px;font-size:14px">← 이전</button>
            <button onclick="ahaStep2Next()" class="btn-primary" style="flex:2;padding:14px;font-size:15px">다음 →</button>
          </div>
        </div>
        ` : `
        <!-- Step 3: 확인 및 제출 -->
        <div class="card" style="padding:20px;margin-bottom:16px">
          <div style="font-size:15px;font-weight:700;margin-bottom:12px;color:var(--text-main)">✅ 제출 확인</div>
          
          <div style="padding:14px;background:var(--bg-input);border-radius:12px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:12px;color:var(--text-muted)">과목</span>
              <span style="font-size:13px;font-weight:600;color:var(--text-main)">${aha.subject || '-'}</span>
            </div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px">
              <span style="font-size:12px;color:var(--text-muted)">단원/내용</span>
              <span style="font-size:13px;font-weight:600;color:var(--text-main)">${aha.unit || '(미입력)'}</span>
            </div>
            <div style="display:flex;justify-content:space-between">
              <span style="font-size:12px;color:var(--text-muted)">사진</span>
              <span style="font-size:13px;font-weight:600;color:var(--text-main)">${aha.photos.length}장</span>
            </div>
          </div>

          <div style="display:flex;gap:8px;overflow-x:auto;margin-bottom:16px;padding-bottom:4px">
            ${aha.photos.map(p => `<img src="${p}" style="width:80px;height:80px;object-fit:cover;border-radius:10px;flex-shrink:0;border:1px solid var(--border)" />`).join('')}
          </div>

          <div style="padding:10px;background:rgba(255,159,67,0.08);border-radius:8px;font-size:12px;color:#FF9F43;text-align:center;margin-bottom:16px">
            🍩 제출 시 크로켓 포인트 +3P 적립 예정
          </div>

          <div style="display:flex;gap:10px">
            <button onclick="state._ahaReport.step=2;renderScreen()" class="btn-secondary" style="flex:1;padding:14px;font-size:14px">← 이전</button>
            <button id="aha-submit-btn" onclick="ahaSubmit()" class="btn-primary" style="flex:2;padding:14px;font-size:15px;background:linear-gradient(135deg,#FF9F43,#FDCB6E)">💡 제출하기</button>
          </div>
        </div>
        `}
      </div>
    </div>
  `;
}

function ahaStep1Next() {
  const subject = document.getElementById('aha-subject')?.value;
  const unit = document.getElementById('aha-unit')?.value || '';
  if (!subject) { alert('과목을 선택해주세요'); return; }
  state._ahaReport.subject = subject;
  state._ahaReport.unit = unit;
  state._ahaReport.step = 2;
  renderScreen();
}

function ahaHandlePhotos(input) {
  const files = Array.from(input.files || []);
  const maxSlots = 3 - (state._ahaReport.photos || []).length;
  const toProcess = files.slice(0, maxSlots);
  const errEl = document.getElementById('aha-photo-error');

  if (toProcess.length === 0) {
    if (errEl) { errEl.textContent = '사진은 최대 3장까지 업로드 가능합니다.'; errEl.style.display = 'block'; }
    input.value = '';
    return;
  }

  let processed = 0;
  toProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // 흐림 필터링: 너무 작은 이미지 (극단적 흐림 대용)
        if (img.width < 50 || img.height < 50) {
          if (errEl) { errEl.textContent = '사진이 너무 흐려요. 다시 찍어주세요.'; errEl.style.display = 'block'; }
          processed++;
          if (processed === toProcess.length) { input.value = ''; renderScreen(); }
          return;
        }
        // 리사이징 (최대 1200px)
        const maxDim = 1200;
        let w = img.width, h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) { h = Math.round(h * maxDim / w); w = maxDim; }
          else { w = Math.round(w * maxDim / h); h = maxDim; }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);

        // 흐림 감지: Laplacian variance (극단적 흐림만)
        try {
          const imageData = ctx.getImageData(0, 0, w, h);
          const data = imageData.data;
          let sum = 0, sumSq = 0, count = 0;
          for (let y = 1; y < h - 1; y += 3) {
            for (let x = 1; x < w - 1; x += 3) {
              const idx = (y * w + x) * 4;
              const gray = data[idx] * 0.299 + data[idx+1] * 0.587 + data[idx+2] * 0.114;
              const grayT = data[((y-1)*w+x)*4] * 0.299 + data[((y-1)*w+x)*4+1] * 0.587 + data[((y-1)*w+x)*4+2] * 0.114;
              const grayB = data[((y+1)*w+x)*4] * 0.299 + data[((y+1)*w+x)*4+1] * 0.587 + data[((y+1)*w+x)*4+2] * 0.114;
              const grayL = data[(y*w+x-1)*4] * 0.299 + data[(y*w+x-1)*4+1] * 0.587 + data[(y*w+x-1)*4+2] * 0.114;
              const grayR = data[(y*w+x+1)*4] * 0.299 + data[(y*w+x+1)*4+1] * 0.587 + data[(y*w+x+1)*4+2] * 0.114;
              const lap = grayT + grayB + grayL + grayR - 4 * gray;
              sum += lap; sumSq += lap * lap; count++;
            }
          }
          const variance = count > 0 ? (sumSq / count) - Math.pow(sum / count, 2) : 999;
          if (variance < 15) {
            if (errEl) { errEl.textContent = '사진이 너무 흐려요. 다시 찍어주세요.'; errEl.style.display = 'block'; }
            processed++;
            if (processed === toProcess.length) { input.value = ''; renderScreen(); }
            return;
          }
        } catch(_) {}

        if (errEl) errEl.style.display = 'none';
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        state._ahaReport.photos.push(dataUrl);
        processed++;
        if (processed === toProcess.length) { input.value = ''; renderScreen(); }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function ahaRemovePhoto(idx) {
  state._ahaReport.photos.splice(idx, 1);
  renderScreen();
}

function ahaStep2Next() {
  if ((state._ahaReport.photos || []).length === 0) {
    const errEl = document.getElementById('aha-photo-error');
    if (errEl) { errEl.textContent = '사진을 최소 1장 업로드해주세요.'; errEl.style.display = 'block'; }
    return;
  }
  state._ahaReport.step = 3;
  renderScreen();
}

function ahaSubmit() {
  const btn = document.getElementById('aha-submit-btn');
  if (btn) { btn.textContent = '제출 중...'; btn.disabled = true; }
  // 이 단계에서는 AI 연동 없이 제출 완료만 처리
  setTimeout(() => {
    state._ahaReport.submitted = true;
    renderScreen();
  }, 800);
}

// ==================== 크로켓 포인트 히스토리 ====================

function renderCroquetHistory() {
  const sid = state._authUser?.id;
  // 비동기 로드
  if (sid && !state._croquetHistoryLoaded) {
    state._croquetHistoryLoaded = true;
    fetch(`/api/student/${sid}/croquet-points/history`)
      .then(r => r.json())
      .then(data => {
        state._croquetHistory = data.history || [];
        state._croquetBalance = data.balance || 0;
        renderScreen();
      })
      .catch(() => {});
  }

  const history = state._croquetHistory || [];
  const balance = state._croquetBalance || 0;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state._croquetHistoryLoaded=false;goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>🍩 크로켓 포인트</h1>
      </div>
      <div class="form-body">
        <!-- 잔액 카드 -->
        <div class="card" style="margin-bottom:20px;padding:24px;text-align:center;background:linear-gradient(135deg,rgba(255,159,67,0.12),rgba(253,203,110,0.08))">
          <div style="font-size:13px;color:var(--text-muted);font-weight:600;margin-bottom:6px">보유 포인트</div>
          <div style="font-size:36px;font-weight:900;color:#FF9F43">🍩 ${balance.toLocaleString()}P</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:8px">학원 카페에서 사용할 수 있어요!</div>
        </div>

        <!-- 히스토리 목록 -->
        <div style="font-size:14px;font-weight:700;color:var(--text-secondary);margin-bottom:12px">포인트 내역</div>
        ${history.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
            <span style="font-size:48px;display:block;margin-bottom:12px">🍩</span>
            <p style="font-size:14px;font-weight:600">아직 포인트 내역이 없어요</p>
            <p style="font-size:12px;margin-top:6px">멘토 선생님이 포인트를 지급하면 여기에 표시됩니다</p>
          </div>
        ` : history.map(h => {
          const date = (h.created_at || '').slice(0, 10);
          const time = (h.created_at || '').slice(11, 16);
          return `
          <div class="card" style="margin-bottom:8px;padding:14px;display:flex;align-items:center;gap:12px">
            <div style="width:40px;height:40px;border-radius:12px;background:rgba(255,159,67,0.12);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🍩</div>
            <div style="flex:1;min-width:0">
              <div style="font-size:14px;font-weight:600;color:var(--text-main)">${h.reason || '기타'}${h.reason_detail ? ' · ' + h.reason_detail : ''}</div>
              <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${date} ${time} · ${h.mentor_name || '멘토'} 선생님</div>
            </div>
            <div style="text-align:right;flex-shrink:0">
              <div style="font-size:16px;font-weight:800;color:#FF9F43">+${(h.amount || 0).toLocaleString()}P</div>
              <div style="font-size:10px;color:var(--text-muted)">${(h.balance_after || 0).toLocaleString()}P</div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  `;
}

// ==================== NOTIFICATIONS ====================

function renderNotifications() {
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>🔔 알림</h1>
        <span class="card-subtitle">${state.notifications.filter(n=>n.unread).length}개 새 알림</span>
      </div>
      <div class="form-body">
        ${state.notifications.map((n,i) => `
          <div class="notification-item ${n.unread?'unread':''} stagger-${i+1} animate-in">
            <div class="notif-icon" style="background:${n.bg}">${n.icon}</div>
            <div class="notif-content">
              <div class="notif-title">${n.title}</div>
              <div class="notif-desc">${n.desc}</div>
            </div>
            <span class="notif-time">${n.time}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ==================== RECORD TAB (R-01~R-06) ====================

function renderRecordTab() {
  return `
    <div class="tab-content animate-in">
      <div class="screen-header">
        <h1>📝 기록</h1>
      </div>
      
      <div class="record-type-grid">
        <!-- 당일 수업 · 당일 복습하기 (최상단) -->
        <div class="record-type-card stagger-0 animate-in" style="background:linear-gradient(135deg,rgba(108,92,231,0.12),rgba(0,184,148,0.08));border:1.5px solid rgba(108,92,231,0.3)" onclick="goScreen('record-status')">
          <div class="record-type-icon" style="background:rgba(108,92,231,0.2)">📝</div>
          <div class="record-type-info">
            <h3>당일 수업 · 당일 복습하기</h3>
            <p>학교 + 학원 수업을 당일에 바로 기록</p>
          </div>
          <span style="color:var(--primary-light);font-size:14px"><i class="fas fa-chevron-right"></i></span>
        </div>
        <!-- 나의 수업 기록 열람 -->
        <div class="record-type-card stagger-1 animate-in" style="background:rgba(108,92,231,0.08);border:1px solid rgba(108,92,231,0.2)" onclick="goScreen('class-record-history')">
          <div class="record-type-icon" style="background:rgba(108,92,231,0.2)">📚</div>
          <div class="record-type-info">
            <h3>나의 수업 기록</h3>
            <p>기록한 수업 내용·사진 열람 ${(state._dbClassRecords||[]).length > 0 ? '<span style="color:var(--primary-light);font-weight:600">' + (state._dbClassRecords||[]).length + '건</span>' : ''}</p>
          </div>
          <span style="color:var(--primary-light);font-size:14px"><i class="fas fa-chevron-right"></i></span>
        </div>
        ${[
          { screen:'aha-report', icon:'💡', bg:'rgba(255,159,67,0.15)', title:'아하 리포트', desc:'영역 탐구 보고서 작성 · 사진 기록', xp:'🍩+3' },
          { screen:'record-assignment', icon:'📋', bg:'rgba(255,159,67,0.15)', title:'과제 기록', desc:'선생님 과제를 기록하고 계획', xp:'+15' },
          { screen:'__qa-new__', icon:'❓', bg:'rgba(255,107,107,0.15)', title:'질문 코칭', desc:'2축 9단계 정율 코칭', xp:'+8~30' },
          { screen:'record-teach', icon:'🤝', bg:'rgba(0,184,148,0.15)', title:'교학상장', desc:'친구에게 가르친 경험', xp:'+30' },
          { screen:'record-activity', icon:'🏫', bg:'rgba(253,203,110,0.15)', title:'창의적 체험활동', desc:'비교과 활동 기록', xp:'+20' },
          { screen:'exam-list', icon:'📝', bg:'rgba(116,185,255,0.15)', title:'시험 관리', desc:'중간·기말·모의·수행평가', xp:'+25' },
          { screen:'record-schoolrecord', icon:'📄', bg:'rgba(162,155,254,0.15)', title:'학교 생활기록부 관리', desc:'생기부 업로드 및 정율 분석', xp:'+30' },
        ].map((item,i) => `
          <div class="record-type-card stagger-${i+1} animate-in" onclick="goScreen('${item.screen}')">
            <div class="record-type-icon" style="background:${item.bg}">${item.icon}</div>
            <div class="record-type-info">
              <h3>${item.title}</h3>
              <p>${item.desc}</p>
            </div>
            <span class="xp-badge-sm">${item.xp}</span>
          </div>
        `).join('')}
      </div>

      <!-- 다가오는 시험 -->
      ${state.exams.filter(ex => ex.status !== 'completed').length > 0 ? `
      <div class="card stagger-6 animate-in">
        <div class="card-header-row">
          <span class="card-title">🎯 다가오는 시험</span>
          <button class="card-link" onclick="goScreen('exam-list')">전체보기 →</button>
        </div>
        ${state.exams.filter(ex => ex.status !== 'completed').sort((a,b) => a.startDate.localeCompare(b.startDate)).slice(0,2).map(ex => {
          const dDay = getDday(ex.startDate);
          const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? 'D-' + dDay : 'D+' + Math.abs(dDay);
          const urgency = dDay <= 3 ? 'urgent' : dDay <= 7 ? 'warning' : 'normal';
          const typeIcon = ex.type === 'midterm' ? '📘' : ex.type === 'final' ? '📕' : ex.type === 'mock' ? '📗' : '📝';
          const avgReadiness = Math.round(ex.subjects.reduce((s,sub) => s + sub.readiness, 0) / ex.subjects.length);
          const readColor = avgReadiness >= 60 ? '#00B894' : avgReadiness >= 30 ? '#FDCB6E' : '#FF6B6B';
          return `
          <div class="exam-mini-row" onclick="state.viewingExam='${ex.id}';goScreen('exam-detail')">
            <div class="exam-mini-icon">${typeIcon}</div>
            <div class="exam-mini-info">
              <span class="exam-mini-name">${ex.name}</span>
              <span class="exam-mini-subjects">${ex.subjects.map(s => s.subject).join(' · ')}</span>
            </div>
            <div class="exam-mini-right">
              <span class="assignment-dday ${urgency}">${dDayText}</span>
              <div class="exam-mini-bar"><div class="exam-mini-bar-fill" style="width:${avgReadiness}%;background:${readColor}"></div></div>
            </div>
          </div>`;
        }).join('')}
      </div>
      ` : ''}

      <!-- Upcoming Assignments Mini -->
      ${state.assignments.filter(a => a.status !== 'completed').length > 0 ? `
      <div class="card stagger-6 animate-in">
        <div class="card-header-row">
          <span class="card-title">📋 진행 중인 과제</span>
          <button class="card-link" onclick="goScreen('assignment-list')">전체보기 →</button>
        </div>
        ${state.assignments.filter(a => a.status !== 'completed').slice(0, 2).map(a => {
          const dDay = getDday(a.dueDate);
          const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
          const urgency = dDay <= 1 ? 'urgent' : dDay <= 3 ? 'warning' : 'normal';
          return `
          <div class="assignment-mini-row" onclick="state.viewingAssignment='${a.id}';goScreen('assignment-plan')">
            <div class="assignment-mini-dot" style="background:${a.color}"></div>
            <div class="assignment-mini-info">
              <span class="assignment-mini-subject">${a.subject}</span>
              <span class="assignment-mini-title">${a.title}</span>
            </div>
            <div class="assignment-mini-right">
              <span class="assignment-dday ${urgency}">${dDayText}</span>
              <div class="assignment-mini-bar"><div class="assignment-mini-bar-fill" style="width:${a.progress}%;background:${a.color}"></div></div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
      ` : ''}

      <!-- 진행 중인 비교과 활동 -->
      ${state.extracurriculars.filter(e => e.status !== 'completed').length > 0 ? `
      <div class="card stagger-7 animate-in">
        <div class="card-header-row">
          <span class="card-title">📚 진행 중인 비교과 활동</span>
          <button class="card-link" onclick="goScreen('record-activity')">전체보기 →</button>
        </div>
        ${state.extracurriculars.filter(e => e.status !== 'completed').slice(0, 4).map(e => {
          const typeLabel = e.type === 'report' ? '📄 탐구보고서' : e.type === 'reading' ? '📖 독서' : e.subType === 'career' ? '🎯 진로' : e.subType === 'self' ? '🧠 자율자치' : '🎭 동아리';
          const statusLabel = e.status === 'in-progress' ? '진행중' : '예정';
          const onclick = e.type === 'report' && e.report 
            ? `state.viewingReport='${e.id}';state.reportPhaseTab=${e.report.currentPhase};goScreen('report-project')` 
            : `state.viewingActivity='${e.id}';goScreen('activity-detail')`;
          return `
          <div class="ec-mini-row" onclick="${onclick}" style="cursor:pointer">
            <div class="ec-mini-dot" style="background:${e.color}"></div>
            <div class="ec-mini-info">
              <div class="ec-mini-top">
                <span class="ec-mini-type">${typeLabel}</span>
                <span class="ec-mini-subject">${e.subject}</span>
              </div>
              <span class="ec-mini-title">${e.title}</span>
            </div>
            <div class="ec-mini-right">
              <span class="ec-mini-status ${e.status}">${statusLabel}</span>
              <div class="ec-mini-bar"><div class="ec-mini-bar-fill" style="width:${e.progress}%;background:${e.color}"></div></div>
            </div>
          </div>
          `;
        }).join('')}
      </div>
      ` : ''}

      <!-- 생기부 포트폴리오 -->
      <div class="card stagger-8 animate-in" onclick="goScreen('portfolio')" style="cursor:pointer">
        <div class="portfolio-entry">
          <div class="portfolio-icon">📊</div>
          <div class="portfolio-text">
            <strong>나의 활동 기록부</strong>
            <p>기간별 수업·질문·과제·비교과 종합 리포트</p>
          </div>
          <i class="fas fa-chevron-right" style="color:var(--text-muted)"></i>
        </div>
      </div>

      <!-- Recent Records Timeline -->
      <div class="card stagger-7 animate-in">
        <div class="card-header-row">
          <span class="card-title">📜 최근 기록</span>
          <button class="card-link" onclick="goScreen('record-history')">전체보기 →</button>
        </div>
        
        <div class="timeline">
          <div class="timeline-item">
            <div class="timeline-dot" style="background:var(--primary)"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">오늘 2교시</span>
                <span class="timeline-subject">수학</span>
                <span class="q-level q-level-c">C-1</span>
              </div>
              <p class="timeline-text">치환적분과 부분적분의 선택 기준이 함수의 구조에 의존한다면...</p>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-dot" style="background:var(--accent)"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">오늘 1교시</span>
                <span class="timeline-subject">국어</span>
              </div>
              <p class="timeline-text">윤동주, 서시, 자아성찰, 저항시의 시대적 배경</p>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-dot" style="background:var(--teach-green)"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">어제</span>
                <span class="timeline-subject">교학상장 · 수학</span>
                <span style="color:var(--teach-green);font-size:12px">🤝</span>
              </div>
              <p class="timeline-text">이서연에게 치환적분 역함수 관점 설명 (15분)</p>
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-dot" style="background:var(--accent-warm)"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">어제</span>
                <span class="timeline-subject">동아리</span>
              </div>
              <p class="timeline-text">코딩동아리 - Python으로 수학 그래프 시각화 프로젝트</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ==================== SCHOOL RECORD (학교 생활기록부 관리) ====================

function renderSchoolRecord() {
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>📄 생활기록부 관리</h1>
        <span class="header-badge">+30 XP</span>
      </div>

      <div class="form-body" style="text-align:center;padding-top:40px">
        <!-- 준비 중 안내 -->
        <div style="background:linear-gradient(135deg,rgba(162,155,254,0.15),rgba(108,92,231,0.1));border-radius:20px;padding:32px 24px;margin-bottom:24px">
          <div style="font-size:64px;margin-bottom:16px">📋</div>
          <h2 style="font-size:18px;font-weight:700;color:var(--text-primary);margin-bottom:8px">학교 생활기록부 정율 분석</h2>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">
            1학년 과정이 끝나면 실제 생활기록부를<br>
            업로드하여 정율이 분석해드립니다
          </p>
        </div>

        <!-- 예정 기능 목록 -->
        <div style="text-align:left">
          <h3 style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:12px">🔮 예정 기능</h3>
          
          ${[
            { icon: '📤', title: '생기부 PDF 업로드', desc: '나이스에서 다운받은 생활기록부를 업로드', status: '준비 중' },
            { icon: '🤖', title: '정율 종합 분석', desc: '교과/비교과/세특 전 영역 정율 자동 분석', status: '준비 중' },
            { icon: '📊', title: '강점·보완점 진단', desc: '대입 관점에서 강점과 보완해야 할 부분 제시', status: '준비 중' },
            { icon: '🎯', title: '맞춤 전략 제안', desc: '분석 결과 기반 2·3학년 학업 전략 추천', status: '준비 중' },
            { icon: '📈', title: '학기별 변화 추적', desc: '매 학기 생기부 비교로 성장 과정 시각화', status: '준비 중' },
            { icon: '✍️', title: '세특 키워드 분석', desc: '세부능력특기사항 핵심 키워드 추출 및 일관성 점검', status: '준비 중' },
          ].map(f => `
            <div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--bg-card);border-radius:14px;margin-bottom:8px;border:1px solid var(--border-color)">
              <span style="font-size:24px;flex-shrink:0">${f.icon}</span>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${f.title}</div>
                <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${f.desc}</div>
              </div>
              <span style="font-size:10px;color:#a29bfe;background:rgba(162,155,254,0.15);padding:3px 8px;border-radius:8px;white-space:nowrap">${f.status}</span>
            </div>
          `).join('')}
        </div>

        <!-- 알림 설정 -->
        <div style="margin-top:24px;padding:20px;background:rgba(0,184,148,0.08);border-radius:14px;border:1px solid rgba(0,184,148,0.2)">
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">
            <strong style="color:#00b894">💡 Tip</strong><br>
            지금은 수업 기록, 질문 코칭, 창체 활동 기록을 꾸준히 쌓아두세요.<br>
            이 데이터가 나중에 생기부 분석과 함께 강력한 포트폴리오가 됩니다!
          </p>
        </div>

        <button class="btn-primary" style="margin-top:24px;width:100%;opacity:0.5;cursor:not-allowed" disabled>
          <i class="fas fa-bell" style="margin-right:6px"></i>
          오픈 시 알림 받기 (준비 중)
        </button>
      </div>
    </div>
  `;
}

// ==================== EXAM MANAGEMENT (시험 관리) ====================

function getExamTypeLabel(type) {
  const map = { midterm:'중간고사', final:'기말고사', mock:'모의고사', performance:'수행평가' };
  return map[type] || type;
}
function getExamTypeIcon(type) {
  const map = { midterm:'📘', final:'📕', mock:'📗', performance:'📝' };
  return map[type] || '📝';
}

function renderExamList() {
  const upcoming = state.exams.filter(e => e.status !== 'completed').sort((a,b) => a.startDate.localeCompare(b.startDate));
  const completed = state.exams.filter(e => e.status === 'completed');

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main');state.studentTab='record'"><i class="fas fa-arrow-left"></i></button>
        <h1>🎯 시험 관리</h1>
        <button class="header-action-btn" onclick="resetExamAddState();goScreen('exam-add')" title="시험 추가"><i class="fas fa-plus"></i></button>
      </div>
      <div class="form-body">

        ${upcoming.length > 0 ? `
        <div class="section-label">다가오는 시험</div>
        ${upcoming.map((ex,i) => {
          const dDay = getDday(ex.startDate);
          const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? 'D-' + dDay : 'D+' + Math.abs(dDay);
          const urgency = dDay <= 3 ? 'urgent' : dDay <= 7 ? 'warning' : 'normal';
          const avgReadiness = Math.round(ex.subjects.reduce((s,sub) => s + sub.readiness, 0) / ex.subjects.length);
          const dateRange = ex.startDate === ex.endDate 
            ? ex.startDate.slice(5).replace('-','/') 
            : ex.startDate.slice(5).replace('-','/') + ' ~ ' + ex.endDate.slice(5).replace('-','/');
          return `
          <div class="exam-card stagger-${i+1} animate-in" onclick="state.viewingExam='${ex.id}';goScreen('exam-detail')">
            <div class="exam-card-top">
              <div class="exam-card-icon">${getExamTypeIcon(ex.type)}</div>
              <div class="exam-card-info">
                <div class="exam-card-name">${ex.name}</div>
                <div class="exam-card-meta">${getExamTypeLabel(ex.type)} · ${dateRange} · ${ex.subjects.length}과목</div>
              </div>
              <div class="exam-card-dday">
                <span class="assignment-dday ${urgency}">${dDayText}</span>
              </div>
            </div>
            <div class="exam-card-subjects">
              ${ex.subjects.map(sub => `
                <div class="exam-subject-chip" style="border-left:3px solid ${sub.color}">
                  <span class="exam-subj-name">${sub.subject}</span>
                  <div class="exam-subj-bar"><div class="exam-subj-bar-fill" style="width:${sub.readiness}%;background:${sub.color}"></div></div>
                  <span class="exam-subj-pct">${sub.readiness}%</span>
                </div>
              `).join('')}
            </div>
            <div class="exam-card-bottom">
              <span class="exam-avg-label">평균 준비도</span>
              <div class="exam-avg-bar"><div class="exam-avg-bar-fill" style="width:${avgReadiness}%;background:${avgReadiness>=60?'#00B894':avgReadiness>=30?'#FDCB6E':'#FF6B6B'}"></div></div>
              <span class="exam-avg-pct" style="color:${avgReadiness>=60?'#00B894':avgReadiness>=30?'#FDCB6E':'#FF6B6B'}">${avgReadiness}%</span>
            </div>
          </div>`;
        }).join('')}
        ` : `
        <div class="pf-empty">
          <div class="pf-empty-icon">🎉</div>
          <div class="pf-empty-text">예정된 시험이 없습니다</div>
        </div>
        `}

        ${completed.length > 0 ? `
        <div class="section-label" style="margin-top:20px">지난 시험</div>
        ${completed.map(ex => `
          <div class="exam-card completed" onclick="state.viewingExam='${ex.id}';goScreen('exam-detail')">
            <div class="exam-card-top">
              <div class="exam-card-icon">${getExamTypeIcon(ex.type)}</div>
              <div class="exam-card-info">
                <div class="exam-card-name">${ex.name}</div>
                <div class="exam-card-meta">${getExamTypeLabel(ex.type)} · ${ex.startDate.slice(5).replace('-','/')}</div>
              </div>
              <span style="color:var(--text-muted);font-size:12px">✅ 완료</span>
            </div>
          </div>
        `).join('')}
        ` : ''}

        <button class="btn-primary" style="width:100%;margin-top:20px" onclick="resetExamAddState();goScreen('exam-add')">
          <i class="fas fa-plus" style="margin-right:6px"></i>시험 추가
        </button>

        <!-- 성장 분석 버튼 -->
        ${state.exams.some(e => e.result) ? `
        <button class="btn-secondary" style="width:100%;margin-top:8px;border-color:rgba(108,92,231,0.4);color:#A29BFE" onclick="goScreen('growth-analysis')">
          <i class="fas fa-chart-line" style="margin-right:6px"></i>📈 시간축 성장 분석 보기
        </button>
        ` : ''}

      </div>
    </div>
  `;
}


function renderExamDetail() {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex) return '<div class="full-screen"><p>시험을 찾을 수 없습니다</p></div>';

  const dDay = getDday(ex.startDate);
  const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? 'D-' + dDay : 'D+' + Math.abs(dDay);
  const urgency = dDay <= 3 ? 'urgent' : dDay <= 7 ? 'warning' : 'normal';
  const avgReadiness = Math.round(ex.subjects.reduce((s,sub) => s + sub.readiness, 0) / ex.subjects.length);
  const dateRange = ex.startDate === ex.endDate 
    ? ex.startDate.slice(5).replace('-','/')
    : ex.startDate.slice(5).replace('-','/') + ' ~ ' + ex.endDate.slice(5).replace('-','/');

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('exam-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>${getExamTypeIcon(ex.type)} ${ex.name}</h1>
        <button class="header-action-btn" onclick="deleteExam('${ex.id}')" title="삭제" style="color:#FF6B6B"><i class="fas fa-trash"></i></button>
      </div>
      <div class="form-body">

        <!-- 상단 요약 -->
        <div class="exam-detail-summary">
          <div class="exam-detail-dday">
            <span class="assignment-dday ${urgency}" style="font-size:18px;padding:6px 16px">${dDayText}</span>
          </div>
          <div class="exam-detail-meta">
            <div><i class="fas fa-calendar" style="width:16px;color:var(--text-muted)"></i> ${dateRange}</div>
            <div><i class="fas fa-book" style="width:16px;color:var(--text-muted)"></i> ${ex.subjects.length}과목</div>
            <div><i class="fas fa-chart-line" style="width:16px;color:var(--text-muted)"></i> 평균 준비도 <strong style="color:${avgReadiness>=60?'#00B894':avgReadiness>=30?'#FDCB6E':'#FF6B6B'}">${avgReadiness}%</strong></div>
          </div>
        </div>

        <!-- 과목별 상세 -->
        <div class="section-label">과목별 시험 범위 & 준비 상태</div>
        ${ex.subjects.map((sub, idx) => {
          const subDday = getDday(sub.date);
          const subDdayText = subDday === 0 ? 'D-Day' : subDday > 0 ? 'D-' + subDday : '';
          return `
          <div class="exam-subject-card stagger-${idx+1} animate-in">
            <div class="exam-subj-header">
              <div class="exam-subj-color-dot" style="background:${sub.color}"></div>
              <span class="exam-subj-title">${sub.subject}</span>
              <span class="exam-subj-date">${sub.date.slice(5).replace('-','/')} ${sub.time}</span>
              ${subDdayText ? '<span class="exam-subj-dday">' + subDdayText + '</span>' : ''}
            </div>
            <div class="exam-subj-range">
              <i class="fas fa-bookmark" style="color:${sub.color};margin-right:6px;font-size:11px"></i>
              <span>${sub.range}</span>
            </div>
            <div class="exam-subj-readiness-row">
              <span class="exam-subj-readiness-label">준비도</span>
              <div class="exam-subj-readiness-bar">
                <div class="exam-subj-readiness-fill" style="width:${sub.readiness}%;background:${sub.color}"></div>
              </div>
              <span class="exam-subj-readiness-pct" style="color:${sub.color}">${sub.readiness}%</span>
              <input type="range" min="0" max="100" value="${sub.readiness}" class="exam-readiness-slider" 
                oninput="updateExamReadiness('${ex.id}',${idx},parseInt(this.value))">
            </div>
            ${sub.notes ? `
            <div class="exam-subj-notes">
              <i class="fas fa-sticky-note" style="color:var(--text-muted);margin-right:4px;font-size:10px"></i>
              ${sub.notes}
            </div>` : ''}
            <div class="exam-subj-actions">
              <button class="exam-subj-note-btn" onclick="editExamSubjectNote('${ex.id}',${idx})">
                <i class="fas fa-edit"></i> 메모
              </button>
              <button class="exam-subj-note-btn" onclick="editExamSubjectRange('${ex.id}',${idx})">
                <i class="fas fa-bookmark"></i> 범위수정
              </button>
            </div>
          </div>`;
        }).join('')}

        <!-- 정율 시험대비 코칭 -->
        <div class="section-label" style="margin-top:20px">🤖 정율 시험대비 코칭</div>
        <div class="card">
          ${state.examAiLoading ? `
            <div style="text-align:center;padding:24px">
              <div class="diag-loading-spinner"></div>
              <p style="color:var(--text-muted);margin-top:12px;font-size:13px">정율이 학습 계획을 분석 중...</p>
            </div>
          ` : ex.aiPlan ? `
            <div class="exam-ai-plan">
              <div class="exam-ai-plan-header">
                <span>📋 정율 맞춤 학습 계획</span>
                <button class="card-link" onclick="generateExamPlan('${ex.id}')">다시 생성 →</button>
              </div>
              <div class="exam-ai-plan-content">${ex.aiPlan}</div>
            </div>
          ` : `
            <div style="text-align:center;padding:16px">
              <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">시험 범위와 준비 상태를 분석해서<br>맞춤 학습 계획을 세워드릴게요</p>
              <button class="btn-primary" onclick="generateExamPlan('${ex.id}')">
                <i class="fas fa-magic" style="margin-right:6px"></i>정율 학습계획 생성
              </button>
            </div>
          `}
        </div>

        <!-- 플래너 연동 -->
        ${ex.aiPlan ? `
        <button class="btn-secondary" style="width:100%;margin-top:12px" onclick="applyExamPlanToPlanner('${ex.id}')">
          <i class="fas fa-calendar-plus" style="margin-right:6px"></i>학습 계획을 플래너에 반영하기
        </button>
        ` : ''}

        <!-- 시험 결과 입력/보고서 -->
        <div class="section-label" style="margin-top:20px">📊 시험 결과</div>
        ${ex.result ? `
        <div class="card" style="border:1px solid rgba(108,92,231,0.3)">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
            <span style="font-size:14px;font-weight:700;color:var(--text-primary)">✅ 결과 입력 완료</span>
            <span style="font-size:20px;font-weight:800;color:var(--primary-light)">${ex.result.totalScore}점</span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-primary" style="flex:1;font-size:12px" onclick="state.viewingExam='${ex.id}';goScreen('exam-report')">
              <i class="fas fa-chart-bar" style="margin-right:4px"></i>결과 보고서
            </button>
            <button class="btn-secondary" style="flex:1;font-size:12px" onclick="state.viewingExam='${ex.id}';goScreen('exam-result-input')">
              <i class="fas fa-edit" style="margin-right:4px"></i>결과 수정
            </button>
          </div>
        </div>
        ` : `
        <div class="card" style="text-align:center">
          <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">시험이 끝나면 결과를 입력하고<br>오답 분석 보고서를 만들어보세요</p>
          <button class="btn-primary" onclick="state.viewingExam='${ex.id}';goScreen('exam-result-input')">
            <i class="fas fa-pen" style="margin-right:6px"></i>결과 입력하기
          </button>
        </div>
        `}

      </div>
    </div>
  `;
}


function renderExamAdd() {
  // 모드가 아직 선택되지 않았으면 모드 선택 화면
  if (!_examAddMode) {
    return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('exam-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>📝 시험 추가</h1>
      </div>
      <div class="form-body">
        <div class="ea-mode-title">어떤 시험을 추가할까요?</div>
        <div class="ea-mode-grid">
          <button class="ea-mode-card" onclick="_examAddMode='midterm';renderScreen()">
            <div class="ea-mode-icon" style="background:rgba(108,92,231,0.15);color:#6C5CE7">📘</div>
            <div class="ea-mode-label">중간 · 기말고사</div>
            <div class="ea-mode-desc">시험 기간 설정 후 날짜별 과목을 추가해요</div>
            <i class="fas fa-chevron-right ea-mode-arrow"></i>
          </button>
          <button class="ea-mode-card" onclick="_examAddMode='performance';renderScreen()">
            <div class="ea-mode-icon" style="background:rgba(253,203,110,0.2);color:#F39C12">📝</div>
            <div class="ea-mode-label">수행평가</div>
            <div class="ea-mode-desc">마감 기한과 평가 주제만 간단히 입력해요</div>
            <i class="fas fa-chevron-right ea-mode-arrow"></i>
          </button>
          <button class="ea-mode-card" onclick="_examAddMode='mock';renderScreen()">
            <div class="ea-mode-icon" style="background:rgba(0,184,148,0.15);color:#00B894">📗</div>
            <div class="ea-mode-label">모의고사</div>
            <div class="ea-mode-desc">프리셋으로 한 번에 입력! 클릭 한 번이면 끝</div>
            <i class="fas fa-chevron-right ea-mode-arrow"></i>
          </button>
        </div>
      </div>
    </div>`;
  }

  // 모드별 분기
  if (_examAddMode === 'midterm') return renderExamAddMidterm();
  if (_examAddMode === 'performance') return renderExamAddPerformance();
  if (_examAddMode === 'mock') return renderExamAddMock();
  return '';
}

/* ── 중간 · 기말고사 모드 ── */
function renderExamAddMidterm() {
  const today = new Date();
  const y = today.getFullYear();
  const m = String(today.getMonth()+1).padStart(2,'0');
  const defaultStart = _eaMidtermStart || `${y}-${m}-21`;
  const defaultEnd = _eaMidtermEnd || `${y}-${m}-25`;

  // 날짜별 교시 카드 생성 (교시 기반 인라인 선택)
  let dateCards = '';
  const examPeriods = _eaMidtermPeriodCount || 4; // 기본 4교시
  if (_eaMidtermStart && _eaMidtermEnd) {
    const dates = getDateRange(_eaMidtermStart, _eaMidtermEnd);
    const dayNames = ['일','월','화','수','목','금','토'];
    const dayIdxMap = {'월':0,'화':1,'수':2,'목':3,'금':4};
    const dayColors = {'토':'#74B9FF','일':'#FF6B6B'};
    dateCards = dates.map((d, di) => {
      const dt = new Date(d + 'T00:00:00');
      const dayName = dayNames[dt.getDay()];
      const dayStyle = dayColors[dayName] ? `color:${dayColors[dayName]}` : '';
      const slotsForDay = _eaMidtermSubjects[d] || {};
      const filledCount = Object.values(slotsForDay).filter(v => v && v.subject).length;
      // 시간표에서 해당 요일의 교시 과목 가져오기
      const ttDayIdx = dayIdxMap[dayName];
      const ttSchool = state.timetable?.school || [];
      return `
      <div class="ea-date-card ${filledCount>0?'has-subj':''} stagger-${Math.min(di+1,5)} animate-in">
        <div class="ea-date-header">
          <span class="ea-date-badge"><span class="ea-date-day" style="${dayStyle}">${d.slice(5).replace('-','/')}</span> <span class="ea-date-dayname">(${dayName})</span></span>
          <span class="ea-date-pill ${filledCount>0?'filled':''}">${filledCount}과목</span>
        </div>
        <div class="ea-period-slots">
          ${Array.from({length: examPeriods}, (_,pi) => {
            const pNum = pi + 1;
            const slot = slotsForDay[pNum];
            const subj = slot?.subject || '';
            const color = slot?.color || '';
            // 시간표 기반 추천 과목
            const ttSubj = (ttDayIdx !== undefined && ttSchool[pi]) ? (ttSchool[pi][ttDayIdx] || '') : '';
            if (subj) {
              return `<div class="ea-slot filled" style="border-left:3px solid ${color}">
                <span class="ea-slot-period">${pNum}교시</span>
                <span class="ea-slot-subj" style="color:${color}">${subj}</span>
                <button class="ea-slot-clear" onclick="clearPeriodSlot('${d}',${pNum})"><i class="fas fa-times"></i></button>
              </div>`;
            } else {
              return `<div class="ea-slot empty" onclick="openPeriodPicker('${d}',${pNum})">
                <span class="ea-slot-period">${pNum}교시</span>
                ${ttSubj && !['체육','미술','음악','창체','동아리'].includes(ttSubj) 
                  ? `<span class="ea-slot-hint">${ttSubj}</span>` 
                  : `<span class="ea-slot-hint">탭하여 선택</span>`}
                <i class="fas fa-chevron-right ea-slot-arrow"></i>
              </div>`;
            }
          }).join('')}
        </div>
      </div>`;
    }).join('');
  }

  const totalSubjects = Object.values(_eaMidtermSubjects).reduce((s,slots) => {
    if (typeof slots === 'object' && !Array.isArray(slots)) {
      return s + Object.values(slots).filter(v => v && v.subject).length;
    }
    return s + (Array.isArray(slots) ? slots.length : 0);
  }, 0);
  const typeLabel = _eaMidtermType === 'final' ? '기말고사' : '중간고사';

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_examAddMode=null;renderScreen()"><i class="fas fa-arrow-left"></i></button>
        <h1>📘 ${typeLabel} 추가</h1>
      </div>
      <div class="form-body" style="padding-bottom:100px">

        <!-- 중간/기말 토글 -->
        <div class="ea-toggle-row">
          <button class="ea-toggle-btn ${_eaMidtermType!=='final'?'active':''}" onclick="_eaMidtermType='midterm';renderScreen()">중간고사</button>
          <button class="ea-toggle-btn ${_eaMidtermType==='final'?'active':''}" onclick="_eaMidtermType='final';renderScreen()">기말고사</button>
        </div>

        <!-- 시험 이름 -->
        <label class="form-label">시험 이름</label>
        <input type="text" id="ea-mid-name" class="form-input" placeholder="예: 1학기 ${typeLabel}" value="${_eaMidtermName || ''}">

        <!-- 시험 기간 바 -->
        <label class="form-label" style="margin-top:14px">시험 기간</label>
        <div class="ea-period-bar">
          <div class="ea-period-field">
            <i class="fas fa-calendar-day"></i>
            <input type="date" id="ea-mid-start" class="ea-period-input" value="${defaultStart}" onchange="onMidtermPeriodChange()">
          </div>
          <div class="ea-period-arrow"><i class="fas fa-arrow-right"></i></div>
          <div class="ea-period-field">
            <i class="fas fa-calendar-check"></i>
            <input type="date" id="ea-mid-end" class="ea-period-input" value="${defaultEnd}" onchange="onMidtermPeriodChange()">
          </div>
        </div>

        <!-- 시험 교시 수 -->
        <label class="form-label" style="margin-top:10px">시험 교시 수</label>
        <div class="ea-period-count-row">
          ${[3,4,5].map(n => `
            <button class="ea-period-count-btn ${examPeriods===n?'active':''}" onclick="_eaMidtermPeriodCount=${n};renderScreen()">${n}교시</button>
          `).join('')}
        </div>

        <!-- 날짜별 과목 카드 -->
        ${_eaMidtermStart && _eaMidtermEnd ? `
          <div class="ea-section-label">
            <span>날짜별 시험 과목</span>
            <span class="ea-section-count">${totalSubjects}과목</span>
          </div>
          ${dateCards}
        ` : `
          <div class="ea-hint-box">
            <i class="fas fa-info-circle"></i>
            시험 기간을 설정하면 날짜별 과목을 추가할 수 있어요
          </div>
        `}

        <!-- 하단 저장 버튼 -->
        <div class="ea-bottom-bar">
          <button class="btn-primary ea-save-btn" onclick="saveMidtermExam()" ${totalSubjects===0?'disabled':''}>
            <i class="fas fa-check" style="margin-right:8px"></i>${typeLabel} 저장
          </button>
        </div>
      </div>
    </div>

    <!-- 교시 과목 선택 바텀시트 -->
    <div class="ea-modal-overlay" id="ea-period-picker">
      <div class="ea-modal">
        <div class="ea-modal-header">
          <h3 id="ea-pp-title"><i class="fas fa-book" style="color:var(--primary);margin-right:6px"></i>과목 선택</h3>
          <button class="ea-modal-close" onclick="closePeriodPicker()"><i class="fas fa-times"></i></button>
        </div>
        <div class="ea-modal-body">
          <div class="ea-pp-hint" id="ea-pp-hint"></div>
          <div class="ea-pp-grid" id="ea-pp-grid"></div>
          <div style="margin-top:12px">
            <label class="form-label" style="margin-top:0;font-size:13px">직접 입력</label>
            <div style="display:flex;gap:8px">
              <input type="text" id="ea-pp-custom" class="form-input" placeholder="과목명 입력" style="flex:1;font-size:14px;padding:10px 12px">
              <button class="btn-primary" style="padding:10px 16px;font-size:13px;white-space:nowrap" onclick="confirmPeriodCustom()">확인</button>
            </div>
          </div>
          <div style="margin-top:10px">
            <label class="form-label" style="margin-top:0;font-size:13px">시험 범위 (선택)</label>
            <input type="text" id="ea-pp-range" class="form-input" placeholder="예: 수학Ⅱ 1~3단원" style="font-size:14px;padding:10px 12px">
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ── 수행평가 모드 ── */
function renderExamAddPerformance() {
  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_examAddMode=null;renderScreen()"><i class="fas fa-arrow-left"></i></button>
        <h1>📝 수행평가 추가</h1>
      </div>
      <div class="form-body" style="padding-bottom:100px">

        <label class="form-label">과목</label>
        <div class="ea-quick-subjects" style="margin-bottom:6px">
          ${['국어','수학','영어','과학','한국사','사회','물리','화학','생명과학','미술','음악','체육'].map(s => 
            `<button class="ea-quick-subj-btn ${_eaPerfSubject===s?'active':''}" onclick="_eaPerfSubject='${s}';document.getElementById('ea-perf-subj').value='${s}';renderScreen()">${s}</button>`
          ).join('')}
        </div>
        <input type="text" id="ea-perf-subj" class="form-input" placeholder="직접 입력" value="${_eaPerfSubject || ''}">

        <label class="form-label" style="margin-top:14px">수행평가 이름</label>
        <input type="text" id="ea-perf-name" class="form-input" placeholder="예: 수학 탐구보고서, 영어 발표" value="${_eaPerfName || ''}">

        <label class="form-label" style="margin-top:14px">마감 기한</label>
        <div class="ea-period-field ea-single-date">
          <i class="fas fa-clock" style="color:#F39C12"></i>
          <input type="date" id="ea-perf-deadline" class="ea-period-input" value="${_eaPerfDeadline || ''}">
        </div>

        <label class="form-label" style="margin-top:14px">평가 주제</label>
        <textarea id="ea-perf-topic" class="form-input ea-textarea" placeholder="예: 자유주제 탐구보고서 A4 5장 이상\n미적분 활용 사례 조사">${_eaPerfTopic || ''}</textarea>

        <label class="form-label" style="margin-top:14px">메모 (선택)</label>
        <input type="text" id="ea-perf-memo" class="form-input" placeholder="참고 사항을 입력하세요" value="${_eaPerfMemo || ''}">

        <!-- 하단 저장 버튼 -->
        <div class="ea-bottom-bar">
          <button class="btn-primary ea-save-btn" onclick="savePerformanceExam()">
            <i class="fas fa-check" style="margin-right:8px"></i>수행평가 저장
          </button>
        </div>
      </div>
    </div>
  `;
}

/* ── 모의고사 모드 ── */
function renderExamAddMock() {
  // 프리셋 목록
  const presets = [
    { key:'3월', label:'3월 전국연합학력평가', month:3 },
    { key:'4월', label:'4월 전국연합학력평가', month:4 },
    { key:'6월', label:'6월 모의평가 (평가원)', month:6 },
    { key:'7월', label:'7월 전국연합학력평가', month:7 },
    { key:'9월', label:'9월 모의평가 (평가원)', month:9 },
    { key:'10월', label:'10월 전국연합학력평가', month:10 },
    { key:'수능', label:'대학수학능력시험', month:11 },
  ];
  const mockSubjects = [
    { subject:'국어', time:'1교시 (08:40~10:00)', range:'독서+문학+언어와 매체', color:'#FF6B6B' },
    { subject:'수학', time:'2교시 (10:30~12:10)', range:'수학Ⅰ+수학Ⅱ+확률과 통계/미적분/기하', color:'#6C5CE7' },
    { subject:'영어', time:'3교시 (13:10~14:20)', range:'듣기+독해 전 범위', color:'#00B894' },
    { subject:'한국사', time:'3교시 (14:30~14:50)', range:'전 범위', color:'#74B9FF' },
    { subject:'탐구1', time:'4교시 (15:20~15:50)', range:'선택과목 1', color:'#FDCB6E' },
    { subject:'탐구2', time:'4교시 (15:50~16:20)', range:'선택과목 2', color:'#E056A0' },
  ];

  const year = new Date().getFullYear();

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="_examAddMode=null;renderScreen()"><i class="fas fa-arrow-left"></i></button>
        <h1>📗 모의고사 추가</h1>
      </div>
      <div class="form-body" style="padding-bottom:100px">

        <div class="ea-mock-intro">
          <i class="fas fa-magic" style="color:var(--primary);font-size:18px"></i>
          <span>프리셋을 선택하면 과목·시간이 자동으로 채워져요</span>
        </div>

        <!-- 프리셋 버튼 -->
        <div class="ea-section-label"><span>🗓️ ${year}년 모의고사 프리셋</span></div>
        <div class="ea-preset-grid">
          ${presets.map((p,i) => {
            const sel = _eaMockPreset === p.key;
            return `
            <button class="ea-preset-btn ${sel?'active':''} stagger-${i+1} animate-in" onclick="selectMockPreset('${p.key}')">
              <span class="ea-preset-month">${p.key}</span>
              <span class="ea-preset-name">${p.label}</span>
              ${sel ? '<i class="fas fa-check-circle ea-preset-check"></i>' : ''}
            </button>`;
          }).join('')}
        </div>

        <!-- 선택 후 상세 -->
        ${_eaMockPreset ? `
          <label class="form-label" style="margin-top:16px">시험 이름</label>
          <input type="text" id="ea-mock-name" class="form-input" value="${_eaMockName || presets.find(p=>p.key===_eaMockPreset)?.label || ''}" placeholder="시험 이름">

          <label class="form-label" style="margin-top:14px">시험 날짜</label>
          <div class="ea-period-field ea-single-date">
            <i class="fas fa-calendar-day" style="color:#00B894"></i>
            <input type="date" id="ea-mock-date" class="ea-period-input" value="${_eaMockDate || `${year}-${String(presets.find(p=>p.key===_eaMockPreset)?.month||3).padStart(2,'0')}-06`}">
          </div>

          <div class="ea-section-label" style="margin-top:16px">
            <span>📋 시험 과목 (자동 설정)</span>
            <span class="ea-section-count">${mockSubjects.length}과목</span>
          </div>
          <div class="ea-mock-subjects">
            ${mockSubjects.map(s => `
              <div class="ea-mock-subj-row">
                <div class="ea-subj-color" style="background:${s.color}"></div>
                <div class="ea-mock-subj-info">
                  <span class="ea-mock-subj-name">${s.subject}</span>
                  <span class="ea-mock-subj-time">${s.time}</span>
                </div>
                <span class="ea-mock-subj-range">${s.range}</span>
              </div>
            `).join('')}
          </div>

          <div class="ea-mock-custom-note">
            <i class="fas fa-pencil-alt"></i>
            탐구 과목은 저장 후 상세 화면에서 수정할 수 있어요
          </div>

          <!-- 하단 저장 -->
          <div class="ea-bottom-bar">
            <button class="btn-primary ea-save-btn" onclick="saveMockExam()">
              <i class="fas fa-check" style="margin-right:8px"></i>모의고사 저장
            </button>
          </div>
        ` : `
          <div class="ea-hint-box" style="margin-top:16px">
            <i class="fas fa-hand-pointer"></i>
            위 프리셋 중 하나를 선택해주세요
          </div>
        `}
      </div>
    </div>
  `;
}


// ==================== EXAM RESULT INPUT ====================

function renderExamResultInput() {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex) return '<div class="full-screen"><p>시험을 찾을 수 없습니다</p></div>';

  // 기존 결과가 있으면 편집 모드
  const r = ex.result || {};
  const subjResults = r.subjects || ex.subjects.map(s => ({
    subject: s.subject, score: '', grade: '', avg: '', color: s.color,
    wrongAnswers: []
  }));

  // 현재 편집 중인 과목 인덱스
  const activeSubj = state._examResultActiveSubj || 0;
  const sr = subjResults[activeSubj] || subjResults[0];

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('exam-detail')"><i class="fas fa-arrow-left"></i></button>
        <h1>📝 결과 입력</h1>
        <button class="header-action-btn" onclick="saveExamResult()" title="저장" style="color:var(--primary-light)"><i class="fas fa-save"></i></button>
      </div>
      <div class="form-body">

        <div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:12px">${ex.name}</div>

        <!-- 전체 총점/등급 -->
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

        <!-- 과목 탭 -->
        <div class="chip-row" style="margin-bottom:12px;flex-wrap:wrap">
          ${subjResults.map((s,i) => `
            <button class="chip ${i===activeSubj?'active':''}" onclick="state._examResultActiveSubj=${i};renderScreen()" style="${i===activeSubj?'background:'+s.color+';border-color:'+s.color:''}">
              ${s.subject}
              ${s.score ? ' ✅' : ''}
            </button>
          `).join('')}
        </div>

        <!-- 선택 과목 입력 -->
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

          <!-- 오답 분석 -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <span style="font-size:13px;font-weight:700;color:var(--text-primary)">❌ 오답 분석</span>
            <button class="card-link" onclick="addWrongAnswer(${activeSubj})">+ 오답 추가</button>
          </div>

          ${(sr.wrongAnswers || []).length === 0 ? `
            <div style="text-align:center;padding:16px;background:var(--bg-input);border-radius:12px">
              <p style="color:var(--text-muted);font-size:12px">틀린 문항을 추가하여 오답 분석을 시작하세요</p>
              <button class="btn-secondary" style="margin-top:8px;font-size:12px" onclick="addWrongAnswer(${activeSubj})">
                <i class="fas fa-plus" style="margin-right:4px"></i>오답 추가
              </button>
            </div>
          ` : `
            ${(sr.wrongAnswers || []).map((w,wi) => `
              <div class="wrong-answer-card" style="background:var(--bg-input);border-radius:12px;padding:12px;margin-bottom:8px;position:relative">
                <button style="position:absolute;top:6px;right:8px;background:none;border:none;color:#FF6B6B;font-size:14px;cursor:pointer" onclick="removeWrongAnswer(${activeSubj},${wi})"><i class="fas fa-times"></i></button>
                
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
                      <button class="chip wa-type-btn ${w.type===t.k?'active':''}" data-subj="${activeSubj}" data-wi="${wi}" data-type="${t.k}" style="font-size:10px;padding:4px 8px;${w.type===t.k?'background:'+t.c+';border-color:'+t.c:''}" onclick="setWrongAnswerType(${activeSubj},${wi},'${t.k}')">
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

                <!-- 오답 문제 사진 -->
                <div style="margin-top:8px">
                  <label style="font-size:10px;color:var(--text-muted)">📷 오답 문제 사진</label>
                  <div style="display:flex;gap:6px;margin-top:4px;flex-wrap:wrap;align-items:center">
                    ${(w.images || []).map((img, imgIdx) => `
                      <div style="position:relative;width:64px;height:64px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color);flex-shrink:0">
                        <img src="${img}" style="width:100%;height:100%;object-fit:cover;cursor:pointer" onclick="viewWrongAnswerImage(${activeSubj},${wi},${imgIdx})">
                        <button style="position:absolute;top:2px;right:2px;width:18px;height:18px;border-radius:50%;background:rgba(255,107,107,0.9);border:none;color:#fff;font-size:10px;cursor:pointer;display:flex;align-items:center;justify-content:center" onclick="removeWrongAnswerImage(${activeSubj},${wi},${imgIdx})"><i class="fas fa-times" style="font-size:8px"></i></button>
                      </div>
                    `).join('')}
                    <div style="display:flex;gap:4px">
                      <label style="width:48px;height:48px;border-radius:8px;border:2px dashed var(--border-color);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:var(--text-muted);gap:2px;transition:all 0.2s" onmouseover="this.style.borderColor='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border-color)'">
                        <i class="fas fa-image" style="font-size:14px"></i>
                        <span>앨범</span>
                        <input type="file" accept="image/*" multiple style="display:none" onchange="handleWrongAnswerImage(event,${activeSubj},${wi})">
                      </label>
                      <label style="width:48px;height:48px;border-radius:8px;border:2px dashed var(--border-color);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:var(--text-muted);gap:2px;transition:all 0.2s" onmouseover="this.style.borderColor='var(--primary-light)'" onmouseout="this.style.borderColor='var(--border-color)'">
                        <i class="fas fa-camera" style="font-size:14px"></i>
                        <span>촬영</span>
                        <input type="file" accept="image/*" capture="environment" style="display:none" onchange="handleWrongAnswerImage(event,${activeSubj},${wi})">
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            `).join('')}
          `}
        </div>

        <!-- 전체 소감 -->
        <div style="margin-top:12px">
          <label class="field-label">💭 전체 소감</label>
          <textarea class="input-field" id="exam-overall-reflection" rows="3" placeholder="이번 시험을 돌아보며 느낀 점을 적어주세요">${r.overallReflection || ''}</textarea>
        </div>

        <button class="btn-primary" style="width:100%;margin-top:16px;padding:14px" onclick="saveExamResult()">
          <i class="fas fa-save" style="margin-right:6px"></i>결과 저장
        </button>

      </div>
    </div>
  `;
}

// ==================== EXAM REPORT ====================

function renderExamReport() {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex || !ex.result) return '<div class="full-screen"><p>결과 데이터가 없습니다</p></div>';

  const r = ex.result;
  const totalWrong = r.subjects.reduce((s,sub) => s + (sub.wrongAnswers||[]).length, 0);
  const errorTypes = {concept:0, careless:0, interpretation:0, time:0};
  const weakTopics = {};
  
  r.subjects.forEach(sub => {
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
  const errorTypeLabels = {concept:'📘 개념부족', careless:'⚡ 실수', interpretation:'🔍 해석오류', time:'⏱️ 시간부족'};
  const errorTypeColors = {concept:'#6C5CE7', careless:'#FF9F43', interpretation:'#FF6B6B', time:'#74B9FF'};

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('exam-detail')"><i class="fas fa-arrow-left"></i></button>
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

        <!-- 과목별 성적 -->
        <div class="section-label">📚 과목별 성적</div>
        <div class="card">
          ${r.subjects.map(sub => {
            const diff = sub.score && sub.avg ? sub.score - sub.avg : 0;
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color)">
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

        <!-- 오답 유형 분석 -->
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

        <!-- 취약 단원 TOP -->
        ${sortedWeakTopics.length > 0 ? `
        <div class="section-label" style="margin-top:16px">⚠️ 취약 단원 TOP ${sortedWeakTopics.length}</div>
        <div class="card">
          ${sortedWeakTopics.map(([topic,count],i) => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;${i<sortedWeakTopics.length-1?'border-bottom:1px solid var(--border-color)':''}">
              <span style="width:22px;height:22px;border-radius:50%;background:${i===0?'#FF6B6B':i===1?'#FF9F43':'#FDCB6E'};color:#fff;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center">${i+1}</span>
              <span style="flex:1;font-size:13px;color:var(--text-primary)">${topic}</span>
              <span style="font-size:12px;color:var(--text-muted)">${count}문항</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- 과목별 오답 상세 -->
        ${r.subjects.filter(s => (s.wrongAnswers||[]).length > 0).map((sub, sIdx) => `
        <div class="section-label" style="margin-top:16px">${sub.subject} 오답 상세</div>
        ${(sub.wrongAnswers||[]).map((w, wIdx) => `
          <div class="card" style="border-left:3px solid ${errorTypeColors[w.type]||'var(--border-color)'};margin-bottom:8px;padding:12px">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:12px;font-weight:700;background:var(--bg-input);padding:2px 8px;border-radius:6px">${w.number ? w.number+'번' : '?'}</span>
              <span style="font-size:12px;color:var(--text-secondary)">${w.topic || ''}</span>
              <span style="margin-left:auto;font-size:10px;padding:2px 6px;border-radius:6px;background:${errorTypeColors[w.type]||'var(--bg-input)'}20;color:${errorTypeColors[w.type]||'var(--text-muted)'}">${errorTypeLabels[w.type]||'미분류'}</span>
            </div>
            ${w.myAnswer || w.correctAnswer ? `<div style="font-size:11px;color:var(--text-muted);margin-bottom:4px">내 답: <span style="color:#FF6B6B">${w.myAnswer||'?'}</span> → 정답: <span style="color:#00B894">${w.correctAnswer||'?'}</span></div>` : ''}
            ${w.reason ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:4px"><strong>원인:</strong> ${w.reason}</div>` : ''}
            ${w.reflection ? `<div style="font-size:12px;color:var(--text-secondary);margin-top:2px"><strong>성찰:</strong> ${w.reflection}</div>` : ''}
            ${(w.images && w.images.length > 0) ? `
              <div style="margin-top:8px">
                <div style="font-size:10px;color:var(--text-muted);margin-bottom:4px">📷 오답 문제 사진</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap">
                  ${w.images.map((img, imgI) => `
                    <div style="width:72px;height:72px;border-radius:8px;overflow:hidden;border:1px solid var(--border-color);cursor:pointer" onclick="viewReportWrongImage('${ex.id}','${sub.subject}',${wIdx},${imgI})">
                      <img src="${img}" style="width:100%;height:100%;object-fit:cover">
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          </div>
        `).join('')}
        `).join('')}

        <!-- 전체 소감 -->
        ${r.overallReflection ? `
        <div class="section-label" style="margin-top:16px">💭 전체 소감</div>
        <div class="card">
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6">${r.overallReflection}</p>
        </div>
        ` : ''}

        <div style="display:flex;gap:8px;margin-top:16px">
          <button class="btn-secondary" style="flex:1" onclick="state.viewingExam='${ex.id}';goScreen('exam-result-input')">
            <i class="fas fa-edit" style="margin-right:4px"></i>결과 수정
          </button>
          <button class="btn-primary" style="flex:1" onclick="goScreen('growth-analysis')">
            <i class="fas fa-chart-line" style="margin-right:4px"></i>성장 분석
          </button>
        </div>

      </div>
    </div>
  `;
}


// ==================== GROWTH ANALYSIS ====================

function renderGrowthAnalysis() {
  const examsWithResult = state.exams.filter(e => e.result).sort((a,b) => a.startDate.localeCompare(b.startDate));
  
  if (examsWithResult.length === 0) {
    return `
      <div class="full-screen animate-in">
        <div class="screen-header">
          <button class="back-btn" onclick="goScreen('exam-list')"><i class="fas fa-arrow-left"></i></button>
          <h1>📈 성장 분석</h1>
        </div>
        <div class="form-body" style="text-align:center;padding-top:60px">
          <div style="font-size:48px;margin-bottom:16px">📊</div>
          <p style="font-size:14px;color:var(--text-secondary)">시험 결과를 2개 이상 입력하면<br>성장 추이를 분석할 수 있습니다</p>
        </div>
      </div>
    `;
  }

  // 전체 과목 리스트 수집
  const allSubjects = [...new Set(examsWithResult.flatMap(e => e.result.subjects.map(s => s.subject)))];
  const activeTab = state._growthTab || 'total';

  // 과목별 색상 매핑
  const subjColorMap = {};
  examsWithResult.forEach(e => e.result.subjects.forEach(s => { if (!subjColorMap[s.subject]) subjColorMap[s.subject] = s.color; }));

  // 오답유형 변화 추적
  const errorTypeLabels = {concept:'📘 개념부족', careless:'⚡ 실수', interpretation:'🔍 해석오류', time:'⏱️ 시간부족'};
  const errorTypeColors = {concept:'#6C5CE7', careless:'#FF9F43', interpretation:'#FF6B6B', time:'#74B9FF'};
  
  // 성장 하이라이트 계산
  let highlights = [];
  if (examsWithResult.length >= 2) {
    const first = examsWithResult[0].result;
    const last = examsWithResult[examsWithResult.length-1].result;
    
    allSubjects.forEach(subj => {
      const firstSub = first.subjects.find(s => s.subject === subj);
      const lastSub = last.subjects.find(s => s.subject === subj);
      if (firstSub && lastSub && firstSub.score && lastSub.score) {
        const diff = lastSub.score - firstSub.score;
        highlights.push({ subject: subj, first: firstSub.score, last: lastSub.score, diff, color: subjColorMap[subj] || '#888' });
      }
    });
    highlights.sort((a,b) => b.diff - a.diff);
  }

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('exam-list')"><i class="fas fa-arrow-left"></i></button>
        <h1>📈 성장 분석</h1>
      </div>
      <div class="form-body">

        <!-- 과목 필터 탭 -->
        <div class="chip-row" style="margin-bottom:16px;flex-wrap:wrap">
          <button class="chip ${activeTab==='total'?'active':''}" onclick="state._growthTab='total';renderScreen()">전체</button>
          ${allSubjects.map(s => `
            <button class="chip ${activeTab===s?'active':''}" onclick="state._growthTab='${s}';renderScreen()" style="${activeTab===s?'background:'+subjColorMap[s]+';border-color:'+subjColorMap[s]:''}">
              ${s}
            </button>
          `).join('')}
        </div>

        <!-- 성적 추이 차트 -->
        <div class="section-label">📊 성적 추이</div>
        <div class="card" style="padding:16px">
          <canvas id="growth-chart" width="300" height="180"></canvas>
        </div>

        <!-- 오답 유형 변화 -->
        ${examsWithResult.length >= 1 ? `
        <div class="section-label" style="margin-top:16px">🔍 오답 유형 변화</div>
        <div class="card">
          <div style="display:flex;gap:4px;margin-bottom:8px;font-size:10px;color:var(--text-muted)">
            <span style="width:80px"></span>
            ${examsWithResult.map(e => `<span style="flex:1;text-align:center">${e.name.replace(/.*?(중간|기말|모의|수행|학력).*/, '$1')}</span>`).join('')}
          </div>
          ${Object.entries(errorTypeLabels).map(([type, label]) => {
            const counts = examsWithResult.map(e => {
              let c = 0;
              const subs = activeTab === 'total' ? e.result.subjects : e.result.subjects.filter(s => s.subject === activeTab);
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

        <!-- 성장 하이라이트 -->
        ${highlights.length > 0 ? `
        <div class="section-label" style="margin-top:16px">🏆 성장 하이라이트</div>
        <div class="card">
          ${highlights.map(h => `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border-color)">
              <span style="font-size:${h.diff>0?'16px':'14px'};width:24px">${h.diff>0?'✅':'⚠️'}</span>
              <span style="font-size:13px;font-weight:600;color:${h.color};width:44px">${h.subject}</span>
              <span style="font-size:12px;color:var(--text-muted)">${h.first} → ${h.last}</span>
              <span style="margin-left:auto;font-size:14px;font-weight:700;color:${h.diff>0?'#00B894':'#FF6B6B'}">${h.diff>0?'+':''}${h.diff}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- 시험별 보고서 바로가기 -->
        <div class="section-label" style="margin-top:16px">📋 시험별 보고서</div>
        ${examsWithResult.map(e => `
          <div class="card" style="padding:12px;margin-bottom:8px;cursor:pointer" onclick="state.viewingExam='${e.id}';goScreen('exam-report')">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <div>
                <div style="font-size:13px;font-weight:700;color:var(--text-primary)">${e.name}</div>
                <div style="font-size:11px;color:var(--text-muted)">${e.startDate.slice(5).replace('-','/')}</div>
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


// ==================== EXAM RESULT UTILITY FUNCTIONS ====================

function collectExamResultData() {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex) return null;

  const r = ex.result || {};
  const subjResults = r.subjects || ex.subjects.map(s => ({
    subject: s.subject, score: '', grade: '', avg: '', color: s.color, wrongAnswers: []
  }));

  // 이미지 데이터는 DOM이 아닌 state에 있으므로 기존 데이터에서 보존
  subjResults.forEach(sr => {
    (sr.wrongAnswers || []).forEach(w => {
      if (!w.images) w.images = [];
    });
  });

  // 현재 과목의 입력값 수집
  const activeSubj = state._examResultActiveSubj || 0;
  
  // 과목 점수/등급/평균 수집
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

  // 오답 데이터 수집
  document.querySelectorAll('.wa-number').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si] && subjResults[si].wrongAnswers[wi]) subjResults[si].wrongAnswers[wi].number = el.value ? parseInt(el.value) : '';
  });
  document.querySelectorAll('.wa-topic').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si] && subjResults[si].wrongAnswers[wi]) subjResults[si].wrongAnswers[wi].topic = el.value;
  });
  document.querySelectorAll('.wa-my').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si] && subjResults[si].wrongAnswers[wi]) subjResults[si].wrongAnswers[wi].myAnswer = el.value;
  });
  document.querySelectorAll('.wa-correct').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si] && subjResults[si].wrongAnswers[wi]) subjResults[si].wrongAnswers[wi].correctAnswer = el.value;
  });
  document.querySelectorAll('.wa-reason').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si] && subjResults[si].wrongAnswers[wi]) subjResults[si].wrongAnswers[wi].reason = el.value;
  });
  document.querySelectorAll('.wa-reflection').forEach(el => {
    const si = parseInt(el.dataset.subj), wi = parseInt(el.dataset.wi);
    if (subjResults[si] && subjResults[si].wrongAnswers[wi]) subjResults[si].wrongAnswers[wi].reflection = el.value;
  });

  return subjResults;
}

function addWrongAnswer(subjIdx) {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex) return;

  // 현재 입력값 저장
  const collected = collectExamResultData();
  if (collected) {
    if (!ex.result) ex.result = { totalScore:'', grade:'', subjects: collected, overallReflection:'' };
    else ex.result.subjects = collected;
  }

  const totalScore = document.getElementById('exam-total-score')?.value;
  const totalGrade = document.getElementById('exam-total-grade')?.value;
  const reflection = document.getElementById('exam-overall-reflection')?.value;
  if (ex.result) {
    if (totalScore) ex.result.totalScore = parseInt(totalScore);
    if (totalGrade) ex.result.grade = parseInt(totalGrade);
    if (reflection !== undefined) ex.result.overallReflection = reflection;
  }

  // 오답 추가
  if (!ex.result) ex.result = { totalScore:'', grade:'', subjects: ex.subjects.map(s => ({subject:s.subject,score:'',grade:'',avg:'',color:s.color,wrongAnswers:[]})), overallReflection:'' };
  if (!ex.result.subjects[subjIdx].wrongAnswers) ex.result.subjects[subjIdx].wrongAnswers = [];
  ex.result.subjects[subjIdx].wrongAnswers.push({ number:'', topic:'', type:'', myAnswer:'', correctAnswer:'', reason:'', reflection:'', images:[] });
  
  renderScreen();
}

function removeWrongAnswer(subjIdx, waIdx) {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex || !ex.result) return;
  
  const collected = collectExamResultData();
  if (collected) ex.result.subjects = collected;
  
  ex.result.subjects[subjIdx].wrongAnswers.splice(waIdx, 1);
  renderScreen();
}

function setWrongAnswerType(subjIdx, waIdx, type) {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex || !ex.result) return;
  
  const collected = collectExamResultData();
  if (collected) ex.result.subjects = collected;
  
  ex.result.subjects[subjIdx].wrongAnswers[waIdx].type = type;
  renderScreen();
}

// 오답 문제 사진 업로드 핸들러
function handleWrongAnswerImage(event, subjIdx, waIdx) {
  const files = event.target.files;
  if (!files || files.length === 0) return;

  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex || !ex.result) return;

  // 현재 입력값 저장
  const collected = collectExamResultData();
  if (collected) ex.result.subjects = collected;

  const wa = ex.result.subjects[subjIdx]?.wrongAnswers[waIdx];
  if (!wa) return;
  if (!wa.images) wa.images = [];

  // 최대 5장 제한
  const maxImages = 5;
  const remaining = maxImages - wa.images.length;
  if (remaining <= 0) {
    alert('사진은 최대 5장까지 첨부할 수 있습니다.');
    return;
  }

  const filesToProcess = Array.from(files).slice(0, remaining);
  let processedCount = 0;

  filesToProcess.forEach(file => {
    const reader = new FileReader();
    reader.onload = function(e) {
      // 이미지 리사이즈 (최대 800px)
      const img = new Image();
      img.onload = function() {
        const canvas = document.createElement('canvas');
        const MAX_SIZE = 800;
        let w = img.width, h = img.height;
        if (w > MAX_SIZE || h > MAX_SIZE) {
          if (w > h) { h = Math.round(h * MAX_SIZE / w); w = MAX_SIZE; }
          else { w = Math.round(w * MAX_SIZE / h); h = MAX_SIZE; }
        }
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        wa.images.push(dataUrl);
        processedCount++;
        if (processedCount === filesToProcess.length) {
          renderScreen();
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// 오답 사진 삭제
function removeWrongAnswerImage(subjIdx, waIdx, imgIdx) {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex || !ex.result) return;

  const collected = collectExamResultData();
  if (collected) ex.result.subjects = collected;

  const wa = ex.result.subjects[subjIdx]?.wrongAnswers[waIdx];
  if (!wa || !wa.images) return;
  wa.images.splice(imgIdx, 1);
  renderScreen();
}

// 오답 사진 확대 보기
function viewWrongAnswerImage(subjIdx, waIdx, imgIdx) {
  const ex = state.exams.find(e => e.id === state.viewingExam);
  if (!ex || !ex.result) return;

  const wa = ex.result.subjects[subjIdx]?.wrongAnswers[waIdx];
  if (!wa || !wa.images || !wa.images[imgIdx]) return;

  const images = wa.images;
  let currentIdx = imgIdx;

  const overlay = document.createElement('div');
  overlay.id = 'wa-image-viewer';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  
  function renderViewer() {
    overlay.innerHTML = `
      <button style="position:absolute;top:16px;right:16px;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;z-index:10001" onclick="document.getElementById('wa-image-viewer').remove()"><i class="fas fa-times"></i></button>
      <div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px">${currentIdx+1} / ${images.length}</div>
      ${images.length > 1 ? `
        <button style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center" onclick="document.getElementById('wa-image-viewer')._nav(-1)"><i class="fas fa-chevron-left"></i></button>
        <button style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center" onclick="document.getElementById('wa-image-viewer')._nav(1)"><i class="fas fa-chevron-right"></i></button>
      ` : ''}
      <img src="${images[currentIdx]}" style="max-width:90%;max-height:80%;object-fit:contain;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5)">
    `;
  }

  overlay._nav = function(dir) {
    currentIdx = (currentIdx + dir + images.length) % images.length;
    renderViewer();
  };

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  renderViewer();
  document.body.appendChild(overlay);
}

// 보고서에서 오답 사진 확대 보기
function viewReportWrongImage(examId, subjectName, waIdx, imgIdx) {
  const ex = state.exams.find(e => e.id === examId);
  if (!ex || !ex.result) return;

  const sub = ex.result.subjects.find(s => s.subject === subjectName);
  if (!sub || !sub.wrongAnswers || !sub.wrongAnswers[waIdx]) return;

  const images = sub.wrongAnswers[waIdx].images || [];
  if (!images[imgIdx]) return;

  let currentIdx = imgIdx;

  const overlay = document.createElement('div');
  overlay.id = 'wa-image-viewer';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.92);z-index:10000;display:flex;flex-direction:column;align-items:center;justify-content:center;';
  
  function renderViewer() {
    overlay.innerHTML = `
      <button style="position:absolute;top:16px;right:16px;background:none;border:none;color:#fff;font-size:24px;cursor:pointer;z-index:10001" onclick="document.getElementById('wa-image-viewer').remove()"><i class="fas fa-times"></i></button>
      <div style="position:absolute;top:16px;left:50%;transform:translateX(-50%);color:#fff;font-size:13px">${currentIdx+1} / ${images.length}</div>
      ${images.length > 1 ? `
        <button style="position:absolute;left:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center" onclick="document.getElementById('wa-image-viewer')._nav(-1)"><i class="fas fa-chevron-left"></i></button>
        <button style="position:absolute;right:12px;top:50%;transform:translateY(-50%);background:rgba(255,255,255,0.2);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;font-size:18px;display:flex;align-items:center;justify-content:center" onclick="document.getElementById('wa-image-viewer')._nav(1)"><i class="fas fa-chevron-right"></i></button>
      ` : ''}
      <img src="${images[currentIdx]}" style="max-width:90%;max-height:80%;object-fit:contain;border-radius:8px;box-shadow:0 4px 20px rgba(0,0,0,0.5)">
    `;
  }

  overlay._nav = function(dir) {
    currentIdx = (currentIdx + dir + images.length) % images.length;
    renderViewer();
  };

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) overlay.remove();
  });

  renderViewer();
  document.body.appendChild(overlay);
}

function saveExamResult() {
  const ex = state.exams.find(e => e.id === state.viewingExam);
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
    createdAt: new Date().toISOString().slice(0,10),
  };

  ex.status = 'completed';

  // DB 저장 (비동기)
  if (ex._dbId && DB.studentId()) {
    DB.saveExamResult(ex._dbId, ex.result);
    DB.updateExam(ex._dbId, { status: 'completed' });
  }

  alert('시험 결과가 저장되었습니다! 📊');
  goScreen('exam-report');
}

// 성장 분석 차트 그리기
function drawGrowthChart() {
  const canvas = document.getElementById('growth-chart');
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  const examsWithResult = state.exams.filter(e => e.result).sort((a,b) => a.startDate.localeCompare(b.startDate));
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

  if (activeTab === 'total') {
    // 전체: 모든 과목 라인
    const allSubjects = [...new Set(examsWithResult.flatMap(e => e.result.subjects.map(s => s.subject)))];
    const subjColorMap = {};
    examsWithResult.forEach(e => e.result.subjects.forEach(s => { if (!subjColorMap[s.subject]) subjColorMap[s.subject] = s.color; }));

    // 그리드
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

    // X축 라벨
    examsWithResult.forEach((e,i) => {
      const x = pad.left + (examsWithResult.length===1 ? chartW/2 : chartW * i/(examsWithResult.length-1));
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      const label = e.name.replace(/.*?(중간|기말|모의|수행|학력).*/, '$1');
      ctx.fillText(label, x, H - 6);
    });

    // 각 과목 라인
    allSubjects.forEach(subj => {
      const points = [];
      examsWithResult.forEach((e,i) => {
        const s = e.result.subjects.find(s => s.subject === subj);
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
        ctx.beginPath();
        ctx.arc(p.x, p.y, 4, 0, Math.PI*2);
        ctx.fillStyle = subjColorMap[subj] || '#888';
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(p.score, p.x, p.y-8);
      });
    });

    // 범례
    let legendX = pad.left;
    allSubjects.forEach(subj => {
      ctx.fillStyle = subjColorMap[subj] || '#888';
      ctx.beginPath(); ctx.arc(legendX+4, pad.top-8, 3, 0, Math.PI*2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(subj, legendX+10, pad.top-5);
      legendX += ctx.measureText(subj).width + 20;
    });

  } else {
    // 단일 과목
    const color = '#A29BFE';
    const points = [];
    examsWithResult.forEach((e,i) => {
      const s = e.result.subjects.find(s => s.subject === activeTab);
      if (s && s.score) {
        const x = pad.left + (examsWithResult.length===1 ? chartW/2 : chartW * i/(examsWithResult.length-1));
        const y = pad.top + chartH * (1 - s.score/100);
        points.push({x, y, score: s.score, avg: s.avg, name: e.name.replace(/.*?(중간|기말|모의|수행|학력).*/, '$1')});
      }
    });

    // 그리드
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + chartH * (1 - i/4);
      ctx.beginPath(); ctx.moveTo(pad.left, y); ctx.lineTo(pad.left+chartW, y); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(i*25, pad.left-4, y+4);
    }

    // X축
    points.forEach(p => {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.font = '9px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.name, p.x, H - 6);
    });

    // 평균 라인 (점선)
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

    // 내 점수 라인
    const subjColor = examsWithResult.flatMap(e=>e.result.subjects).find(s=>s.subject===activeTab)?.color || color;
    ctx.strokeStyle = subjColor;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p,i) => i===0 ? ctx.moveTo(p.x,p.y) : ctx.lineTo(p.x,p.y));
    ctx.stroke();

    points.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI*2);
      ctx.fillStyle = subjColor;
      ctx.fill();
      ctx.strokeStyle = '#1a1a2e';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(p.score, p.x, p.y-10);
    });
  }
}

// ==================== EXAM UTILITY FUNCTIONS ====================

// ==================== EXAM ADD STATE ====================
let _examAddMode = null; // null, 'midterm', 'performance', 'mock'
// 중간·기말 상태
let _eaMidtermType = 'midterm';
let _eaMidtermName = '';
let _eaMidtermStart = '';
let _eaMidtermEnd = '';
let _eaMidtermSubjects = {}; // { '2026-04-21': {1:{subject,color,range}, 2:{...}}, ... }
let _eaMidtermAddingDate = ''; // 모달에서 추가 중인 날짜
let _eaMidtermPeriodCount = 4; // 시험 교시 수 (기본 4교시)
let _eaMidtermPickerDate = ''; // 현재 피커에서 선택 중인 날짜
let _eaMidtermPickerPeriod = 0; // 현재 피커에서 선택 중인 교시
// 수행평가 상태
let _eaPerfSubject = '';
let _eaPerfName = '';
let _eaPerfDeadline = '';
let _eaPerfTopic = '';
let _eaPerfMemo = '';
// 모의고사 상태
let _eaMockPreset = '';
let _eaMockName = '';
let _eaMockDate = '';

function resetExamAddState() {
  _examAddMode = null;
  _eaMidtermType = 'midterm'; _eaMidtermName = ''; _eaMidtermStart = ''; _eaMidtermEnd = '';
  _eaMidtermSubjects = {}; _eaMidtermAddingDate = ''; _eaMidtermPeriodCount = 4;
  _eaMidtermPickerDate = ''; _eaMidtermPickerPeriod = 0;
  _eaPerfSubject = ''; _eaPerfName = ''; _eaPerfDeadline = ''; _eaPerfTopic = ''; _eaPerfMemo = '';
  _eaMockPreset = ''; _eaMockName = ''; _eaMockDate = '';
}

function getDateRange(start, end) {
  const dates = [];
  let cur = new Date(start + 'T00:00:00');
  const last = new Date(end + 'T00:00:00');
  while (cur <= last) {
    dates.push(cur.toISOString().slice(0,10));
    cur.setDate(cur.getDate()+1);
  }
  return dates;
}

/* ── 중간·기말: 기간 변경 ── */
function onMidtermPeriodChange() {
  const s = document.getElementById('ea-mid-start')?.value;
  const e = document.getElementById('ea-mid-end')?.value;
  if (s) _eaMidtermStart = s;
  if (e) _eaMidtermEnd = e;
  // 이름 자동 입력
  const nameEl = document.getElementById('ea-mid-name');
  if (nameEl) _eaMidtermName = nameEl.value.trim();
  // 기존 날짜에 없는 날짜 제거, 새 날짜 추가
  if (_eaMidtermStart && _eaMidtermEnd) {
    const dates = getDateRange(_eaMidtermStart, _eaMidtermEnd);
    const newSubj = {};
    dates.forEach(d => { newSubj[d] = _eaMidtermSubjects[d] || {}; });
    _eaMidtermSubjects = newSubj;
  }
  renderScreen();
}

/* ── 중간·기말: 교시별 과목 선택 피커 ── */
function openPeriodPicker(date, period) {
  _eaMidtermPickerDate = date;
  _eaMidtermPickerPeriod = period;
  // 이름 저장
  const nameEl = document.getElementById('ea-mid-name');
  if (nameEl) _eaMidtermName = nameEl.value.trim();

  const modal = document.getElementById('ea-period-picker');
  if (modal) modal.classList.add('open');

  // 해당 날짜의 요일 기반 시간표 과목 추천
  const dt = new Date(date + 'T00:00:00');
  const dayNames = ['일','월','화','수','목','금','토'];
  const dayIdxMap = {'월':0,'화':1,'수':2,'목':3,'금':4};
  const dayName = dayNames[dt.getDay()];
  const ttDayIdx = dayIdxMap[dayName];
  const ttSchool = state.timetable?.school || [];
  const ttSubj = (ttDayIdx !== undefined && ttSchool[period-1]) ? (ttSchool[period-1][ttDayIdx] || '') : '';

  // 타이틀 업데이트
  const titleEl = document.getElementById('ea-pp-title');
  if (titleEl) titleEl.innerHTML = `<i class="fas fa-book" style="color:var(--primary);margin-right:6px"></i>${date.slice(5).replace('-','/')} (${dayName}) ${period}교시`;

  // 힌트
  const hintEl = document.getElementById('ea-pp-hint');
  if (hintEl && ttSubj && !['체육','미술','음악','창체','동아리'].includes(ttSubj)) {
    hintEl.innerHTML = `<i class="fas fa-magic" style="margin-right:6px"></i>시간표 기준: <strong>${ttSubj}</strong>`;
    hintEl.style.display = 'flex';
  } else if (hintEl) {
    hintEl.style.display = 'none';
  }

  // 주요 과목 그리드 생성
  const examSubjects = ['국어','수학','영어','과학','한국사','사회','물리','화학','생명과학','지구과학'];
  const gridEl = document.getElementById('ea-pp-grid');
  if (gridEl) {
    gridEl.innerHTML = examSubjects.map(s => {
      const c = _subjectColorMap[s] || '#888';
      return `<button class="ea-pp-subj-btn" style="--subj-color:${c}" onclick="pickPeriodSubject('${s}')">${s}</button>`;
    }).join('');
  }

  // 범위 초기화
  const rangeEl = document.getElementById('ea-pp-range');
  if (rangeEl) rangeEl.value = '';
  const customEl = document.getElementById('ea-pp-custom');
  if (customEl) customEl.value = '';
}

function closePeriodPicker() {
  const modal = document.getElementById('ea-period-picker');
  if (modal) modal.classList.remove('open');
}

function pickPeriodSubject(subj) {
  const d = _eaMidtermPickerDate;
  const p = _eaMidtermPickerPeriod;
  if (!_eaMidtermSubjects[d]) _eaMidtermSubjects[d] = {};
  const color = _subjectColorMap[subj] || _subjectColorFallback[p % _subjectColorFallback.length];
  const range = document.getElementById('ea-pp-range')?.value?.trim() || '';
  _eaMidtermSubjects[d][p] = { subject: subj, color, range, period: p, date: d, readiness: 0, notes: '' };
  closePeriodPicker();
  renderScreen();
}

function confirmPeriodCustom() {
  const subj = document.getElementById('ea-pp-custom')?.value?.trim();
  if (!subj) { alert('과목명을 입력하세요'); return; }
  pickPeriodSubject(subj);
}

function clearPeriodSlot(date, period) {
  if (_eaMidtermSubjects[date]) {
    delete _eaMidtermSubjects[date][period];
    renderScreen();
  }
}

function closeEaModal() {
  closePeriodPicker();
}

function pickQuickSubject(name) {
  const el = document.getElementById('ea-pp-custom');
  if (el) el.value = name;
}

const _subjectColorMap = {
  '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
  '한국사':'#74B9FF','사회':'#A29BFE','물리':'#E056A0','화학':'#FF9F43',
  '생명과학':'#00CEC9','지구과학':'#E17055','미술':'#FD79A8','음악':'#fd79a8','체육':'#A29BFE'
};
const _subjectColorFallback = ['#6C5CE7','#FF6B6B','#00B894','#FDCB6E','#74B9FF','#E056A0','#A29BFE','#FF9F43'];

function confirmMidtermSubjectAdd() {
  // Legacy compatibility - redirect to period picker
  confirmPeriodCustom();
}

function removeMidtermSubject(date, period) {
  clearPeriodSlot(date, period);
}

/* ── 중간·기말: 저장 ── */
function saveMidtermExam() {
  const nameEl = document.getElementById('ea-mid-name');
  const name = nameEl?.value?.trim() || _eaMidtermName;
  if (!name) { alert('시험 이름을 입력하세요'); return; }
  const subjects = [];
  Object.entries(_eaMidtermSubjects).forEach(([date, slots]) => {
    if (typeof slots === 'object' && !Array.isArray(slots)) {
      Object.entries(slots).forEach(([period, s]) => {
        if (s && s.subject) {
          subjects.push({ ...s, date, time: period + '교시' });
        }
      });
    }
  });
  if (subjects.length === 0) { alert('최소 1개 과목을 추가하세요'); return; }

  const newExam = {
    id: 'exam' + Date.now(),
    type: _eaMidtermType === 'final' ? 'final' : 'midterm',
    name,
    startDate: _eaMidtermStart,
    endDate: _eaMidtermEnd,
    subjects,
    status: 'upcoming',
    aiPlan: null,
  };
  state.exams.push(newExam);
  state.viewingExam = newExam.id;

  if (DB.studentId()) {
    DB.saveExam({ name, type: newExam.type, startDate: _eaMidtermStart, endDate: _eaMidtermEnd, subjects, memo:'' })
      .then(dbId => { if (dbId) { newExam._dbId = dbId; newExam.id = String(dbId); state.viewingExam = newExam.id; }});
  }
  resetExamAddState();
  goScreen('exam-detail');
}

/* ── 수행평가: 저장 ── */
function savePerformanceExam() {
  const subj = document.getElementById('ea-perf-subj')?.value?.trim() || _eaPerfSubject;
  const name = document.getElementById('ea-perf-name')?.value?.trim() || _eaPerfName;
  const deadline = document.getElementById('ea-perf-deadline')?.value || _eaPerfDeadline;
  const topic = document.getElementById('ea-perf-topic')?.value?.trim() || _eaPerfTopic;
  const memo = document.getElementById('ea-perf-memo')?.value?.trim() || _eaPerfMemo;

  if (!subj) { alert('과목을 입력하세요'); return; }
  if (!name) { alert('수행평가 이름을 입력하세요'); return; }
  if (!deadline) { alert('마감 기한을 입력하세요'); return; }

  const color = _subjectColorMap[subj] || '#FDCB6E';
  const newExam = {
    id: 'exam' + Date.now(),
    type: 'performance',
    name,
    startDate: deadline,
    endDate: deadline,
    subjects: [{ subject:subj, date:deadline, time:'제출', range:topic, readiness:0, notes:memo, color }],
    status: 'upcoming',
    aiPlan: null,
  };
  state.exams.push(newExam);
  state.viewingExam = newExam.id;

  if (DB.studentId()) {
    DB.saveExam({ name, type:'performance', startDate:deadline, subjects:newExam.subjects, memo })
      .then(dbId => { if (dbId) { newExam._dbId = dbId; newExam.id = String(dbId); state.viewingExam = newExam.id; }});
  }
  resetExamAddState();
  goScreen('exam-detail');
}

/* ── 모의고사: 프리셋 선택 ── */
function selectMockPreset(key) {
  _eaMockPreset = key;
  const presets = {
    '3월':{label:'3월 전국연합학력평가',m:3}, '4월':{label:'4월 전국연합학력평가',m:4},
    '6월':{label:'6월 모의평가 (평가원)',m:6}, '7월':{label:'7월 전국연합학력평가',m:7},
    '9월':{label:'9월 모의평가 (평가원)',m:9}, '10월':{label:'10월 전국연합학력평가',m:10},
    '수능':{label:'대학수학능력시험',m:11}
  };
  const p = presets[key];
  const y = new Date().getFullYear();
  _eaMockName = p ? p.label : '';
  _eaMockDate = p ? `${y}-${String(p.m).padStart(2,'0')}-06` : '';
  renderScreen();
}

/* ── 모의고사: 저장 ── */
function saveMockExam() {
  const name = document.getElementById('ea-mock-name')?.value?.trim() || _eaMockName;
  const date = document.getElementById('ea-mock-date')?.value || _eaMockDate;
  if (!name) { alert('시험 이름을 입력하세요'); return; }
  if (!date) { alert('시험 날짜를 입력하세요'); return; }

  const subjects = [
    { subject:'국어', time:'1교시 (08:40~10:00)', range:'독서+문학+언어와 매체', color:'#FF6B6B' },
    { subject:'수학', time:'2교시 (10:30~12:10)', range:'수학Ⅰ+수학Ⅱ+확률과 통계/미적분/기하', color:'#6C5CE7' },
    { subject:'영어', time:'3교시 (13:10~14:20)', range:'듣기+독해 전 범위', color:'#00B894' },
    { subject:'한국사', time:'3교시 (14:30~14:50)', range:'전 범위', color:'#74B9FF' },
    { subject:'탐구1', time:'4교시 (15:20~15:50)', range:'선택과목 1', color:'#FDCB6E' },
    { subject:'탐구2', time:'4교시 (15:50~16:20)', range:'선택과목 2', color:'#E056A0' },
  ].map(s => ({ ...s, date, readiness:0, notes:'' }));

  const newExam = {
    id: 'exam' + Date.now(),
    type: 'mock',
    name,
    startDate: date,
    endDate: date,
    subjects,
    status: 'upcoming',
    aiPlan: null,
  };
  state.exams.push(newExam);
  state.viewingExam = newExam.id;

  if (DB.studentId()) {
    DB.saveExam({ name, type:'mock', startDate:date, subjects, memo:'' })
      .then(dbId => { if (dbId) { newExam._dbId = dbId; newExam.id = String(dbId); state.viewingExam = newExam.id; }});
  }
  resetExamAddState();
  goScreen('exam-detail');
}

function deleteExam(examId) {
  if (!confirm('이 시험을 삭제하시겠습니까?')) return;
  const ex = state.exams.find(e => e.id === examId);
  // DB 삭제
  if (ex && ex._dbId && DB.studentId()) {
    DB.deleteExam(ex._dbId);
  }
  state.exams = state.exams.filter(e => e.id !== examId);
  goScreen('exam-list');
}

function updateExamReadiness(examId, subIdx, value) {
  const ex = state.exams.find(e => e.id === examId);
  if (ex && ex.subjects[subIdx] !== undefined) {
    ex.subjects[subIdx].readiness = value;
    // 화면을 다시 그리면 슬라이더가 초기화되므로 수동으로 업데이트
    const pctEl = document.querySelectorAll('.exam-subj-readiness-pct')[subIdx];
    const fillEl = document.querySelectorAll('.exam-subj-readiness-fill')[subIdx];
    if (pctEl) pctEl.textContent = value + '%';
    if (fillEl) fillEl.style.width = value + '%';
  }
}

function editExamSubjectNote(examId, subIdx) {
  const ex = state.exams.find(e => e.id === examId);
  if (!ex) return;
  const note = prompt('메모 입력:', ex.subjects[subIdx].notes || '');
  if (note !== null) {
    ex.subjects[subIdx].notes = note;
    renderScreen();
  }
}

function editExamSubjectRange(examId, subIdx) {
  const ex = state.exams.find(e => e.id === examId);
  if (!ex) return;
  const range = prompt('시험 범위 수정:', ex.subjects[subIdx].range || '');
  if (range !== null) {
    ex.subjects[subIdx].range = range;
    renderScreen();
  }
}

async function generateExamPlan(examId) {
  const ex = state.exams.find(e => e.id === examId);
  if (!ex) return;

  state.examAiLoading = true;
  renderScreen();

  const dDay = getDday(ex.startDate);
  const subjectInfo = ex.subjects.map(s => 
    `- ${s.subject} (${s.date} ${s.time}): 범위="${s.range}", 준비도=${s.readiness}%, 메모="${s.notes}"`
  ).join('\n');

  const prompt = `너는 고등학교 시험 대비 학습 코치야. 학생의 시험 정보를 분석해서 구체적인 학습 계획을 세워줘.

시험 정보:
- 시험명: ${ex.name}
- 유형: ${getExamTypeLabel(ex.type)}
- 시험 기간: ${ex.startDate} ~ ${ex.endDate}
- D-day: ${dDay > 0 ? dDay + '일 남음' : '오늘/지남'}

과목별 정보:
${subjectInfo}

다음 형식으로 학습 계획을 작성해줘:
1. 전체 전략 (2~3문장)
2. 우선순위 분석 (준비도 낮은 과목 → 높은 과목 순)
3. 일별 학습 계획 (남은 일수에 맞게)
4. 과목별 핵심 공략법 (각 1~2문장)
5. 컨디션 관리 팁 (1~2문장)

HTML 태그를 사용해서 보기 좋게 포맷팅해줘. <h4>, <p>, <ul><li>, <strong> 태그 사용 가능. 한국어로 작성.`;

  try {
    const res = await fetch('/api/exam-coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, examId })
    });
    const data = await res.json();
    if (data.plan) {
      ex.aiPlan = data.plan;
    } else if (data.error) {
      ex.aiPlan = '<p style="color:#FF6B6B">⚠️ 정율 응답 오류: ' + data.error + '</p><p>다시 시도해주세요.</p>';
    }
  } catch (e) {
    ex.aiPlan = '<p style="color:#FF6B6B">⚠️ 네트워크 오류. 다시 시도해주세요.</p>';
  }

  state.examAiLoading = false;
  renderScreen();
}

function applyExamPlanToPlanner(examId) {
  const ex = state.exams.find(e => e.id === examId);
  if (!ex) return;
  alert('📅 학습 계획이 플래너에 반영되었습니다!\n플래너 탭에서 일정을 확인하세요.');
  // 실제로는 state.plannerItems에 학습 일정 추가
  const dDay = getDday(ex.startDate);
  const today = new Date('2026-02-15');
  ex.subjects.forEach((sub, i) => {
    const studyDate = new Date(today);
    studyDate.setDate(studyDate.getDate() + Math.min(i, dDay > 0 ? dDay : 1));
    const dateStr = studyDate.toISOString().slice(0,10);
    state.plannerItems.push({
      id: 'pexam' + Date.now() + i,
      date: dateStr,
      time: '16:00',
      endTime: '18:00',
      title: '[시험대비] ' + sub.subject + ' 집중 학습',
      category: 'study',
      color: sub.color,
      icon: '📖',
      done: false,
      aiGenerated: true,
      detail: sub.range
    });
  });
}

// ==================== PORTFOLIO (나의 활동 기록부) ====================

function getPortfolioDateRange() {
  const today = new Date('2026-02-15');
  let start, end = today;
  switch(state.portfolioPeriod) {
    case '1week':
      start = new Date(today); start.setDate(start.getDate() - 7); break;
    case '2week':
      start = new Date(today); start.setDate(start.getDate() - 14); break;
    case '1month':
      start = new Date(today); start.setMonth(start.getMonth() - 1); break;
    case 'custom':
      start = new Date(state.portfolioCustomStart); end = new Date(state.portfolioCustomEnd); break;
    default:
      start = new Date(today); start.setDate(start.getDate() - 7);
  }
  return { start, end };
}

function collectPortfolioItems() {
  const { start, end } = getPortfolioDateRange();
  const fmt = d => d.toISOString().slice(0,10);
  const s = fmt(start), e = fmt(end);
  const items = [];

  // 1) 수업 기록 (plannerItems category='class', done)
  state.plannerItems.filter(p => p.category === 'class' && p.date >= s && p.date <= e).forEach(p => {
    items.push({ date:p.date, time:p.time, cat:'class', icon:'📝', title:p.title, subject:p.detail||'', desc:'수업 기록', xp:10, color:p.color });
  });

  // 2) 질문 기록 (하드코딩 예시 — 추후 실 데이터)
  const questionRecords = [
    { date:'2026-02-21', time:'09:40', subject:'수학', title:'치환적분과 부분적분의 선택 기준', level:'C-1', xp:25 },
    { date:'2026-02-14', time:'14:20', subject:'국어', title:'윤동주 시의 자아성찰 관점', level:'B-2', xp:15 },
    { date:'2026-02-13', time:'11:00', subject:'영어', title:'관계대명사 which vs that 차이', level:'A-3', xp:8 },
    { date:'2026-02-10', time:'10:15', subject:'과학', title:'산화환원 반응에서 전자 이동 메커니즘', level:'B-1', xp:12 },
    { date:'2026-02-08', time:'15:30', subject:'수학', title:'부정적분 상수 C의 기하학적 의미', level:'C-2', xp:30 },
  ];
  questionRecords.filter(q => q.date >= s && q.date <= e).forEach(q => {
    items.push({ date:q.date, time:q.time, cat:'question', icon:'❓', title:q.title, subject:q.subject, desc:`질문 레벨 ${q.level}`, xp:q.xp, color:'#FF6B6B' });
  });

  // 3) 과제
  state.assignments.filter(a => a.createdDate >= s && a.createdDate <= e).forEach(a => {
    const statusText = a.status === 'completed' ? '✅ 완료' : `진행 ${a.progress}%`;
    items.push({ date:a.createdDate, time:'00:00', cat:'assignment', icon:'📋', title:a.title, subject:a.subject, desc:`${a.teacher} · ${statusText}`, xp:15, color:a.color });
  });

  // 4) 교학상장 기록
  const teachRecords = [
    { date:'2026-02-14', time:'16:00', student:'이서연', subject:'수학', topic:'치환적분 역함수 관점', duration:15 },
    { date:'2026-02-11', time:'14:30', student:'박지호', subject:'영어', topic:'관계대명사 구문 분석', duration:20 },
  ];
  teachRecords.filter(t => t.date >= s && t.date <= e).forEach(t => {
    items.push({ date:t.date, time:t.time, cat:'teach', icon:'🤝', title:`${t.student}에게 ${t.topic} 설명`, subject:t.subject, desc:`${t.duration}분 멘토링`, xp:30, color:'#00B894' });
  });

  // 5) 비교과: 탐구보고서, 독서, 창체
  state.extracurriculars.filter(ec => ec.startDate <= e && (ec.endDate >= s || !ec.endDate)).forEach(ec => {
    const catKey = ec.type === 'report' ? 'report' : ec.type === 'reading' ? 'reading' : 'activity';
    const icon = ec.type === 'report' ? '📄' : ec.type === 'reading' ? '📖' : '🏫';
    const statusText = ec.status === 'completed' ? '✅ 완료' : ec.status === 'in-progress' ? `진행 ${ec.progress}%` : '예정';
    items.push({ date:ec.startDate, time:'00:00', cat:catKey, icon, title:ec.title, subject:ec.subject, desc:`${statusText} · ${ec.desc||''}`, xp:20, color:ec.color });
  });

  // 정렬: 날짜 내림차순
  items.sort((a,b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  // 탭 필터
  if (state.portfolioTab !== 'all') {
    return items.filter(i => i.cat === state.portfolioTab);
  }
  return items;
}

function renderPortfolio() {
  const items = collectPortfolioItems();
  const allItems = (() => { const prev = state.portfolioTab; state.portfolioTab = 'all'; const r = collectPortfolioItems(); state.portfolioTab = prev; return r; })();
  
  // 통계
  const stats = {
    class: allItems.filter(i => i.cat === 'class').length,
    question: allItems.filter(i => i.cat === 'question').length,
    assignment: allItems.filter(i => i.cat === 'assignment').length,
    extra: allItems.filter(i => ['report','reading','activity','teach'].includes(i.cat)).length,
    totalXp: allItems.reduce((s,i) => s + (i.xp||0), 0),
  };

  // 날짜별 그룹핑
  const grouped = {};
  items.forEach(it => {
    const dl = formatDateLabel(it.date);
    if (!grouped[dl]) grouped[dl] = [];
    grouped[dl].push(it);
  });

  const periods = [
    { key:'1week', label:'1주' },
    { key:'2week', label:'2주' },
    { key:'1month', label:'1개월' },
    { key:'custom', label:'직접 선택' },
  ];

  const tabs = [
    { key:'all', label:'전체' },
    { key:'class', label:'수업' },
    { key:'question', label:'질문' },
    { key:'assignment', label:'과제' },
    { key:'report', label:'탐구' },
    { key:'reading', label:'독서' },
    { key:'activity', label:'창체' },
    { key:'teach', label:'교학상장' },
  ];

  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main');state.studentTab='record'"><i class="fas fa-arrow-left"></i></button>
        <h1>📊 나의 활동 기록부</h1>
      </div>
      <div class="form-body" style="padding-bottom:24px">

        <!-- 기간 선택 -->
        <div class="period-selector">
          ${periods.map(p => `
            <button class="period-btn ${state.portfolioPeriod===p.key?'active':''}" onclick="state.portfolioPeriod='${p.key}';renderScreen()">${p.label}</button>
          `).join('')}
        </div>
        ${state.portfolioPeriod === 'custom' ? `
        <div class="custom-period-row">
          <input type="date" value="${state.portfolioCustomStart}" onchange="state.portfolioCustomStart=this.value;renderScreen()">
          <span>~</span>
          <input type="date" value="${state.portfolioCustomEnd}" onchange="state.portfolioCustomEnd=this.value;renderScreen()">
        </div>
        ` : ''}

        <!-- 통계 요약 -->
        <div class="portfolio-stats">
          <div class="portfolio-stat-item">
            <span class="portfolio-stat-num">${stats.class}</span>
            <span class="portfolio-stat-label">수업</span>
          </div>
          <div class="portfolio-stat-item">
            <span class="portfolio-stat-num">${stats.question}</span>
            <span class="portfolio-stat-label">질문</span>
          </div>
          <div class="portfolio-stat-item">
            <span class="portfolio-stat-num">${stats.assignment}</span>
            <span class="portfolio-stat-label">과제</span>
          </div>
          <div class="portfolio-stat-item">
            <span class="portfolio-stat-num">${stats.extra}</span>
            <span class="portfolio-stat-label">비교과</span>
          </div>
        </div>

        <!-- 총 XP -->
        <div class="card" style="margin-bottom:12px;text-align:center;padding:10px">
          <span style="font-size:13px;color:var(--text-muted)">해당 기간 획득 XP</span>
          <span style="font-size:22px;font-weight:800;color:var(--primary);margin-left:8px">${stats.totalXp} XP</span>
        </div>

        <!-- 카테고리 탭 -->
        <div class="portfolio-tabs">
          ${tabs.map(t => `
            <button class="portfolio-tab-btn ${state.portfolioTab===t.key?'active':''}" onclick="state.portfolioTab='${t.key}';renderScreen()">${t.label}</button>
          `).join('')}
        </div>

        <!-- 타임라인 -->
        ${Object.keys(grouped).length > 0 ? `
        <div class="pf-timeline">
          ${Object.entries(grouped).map(([dateLabel, dateItems]) => `
            <div class="pf-date-group">
              <div class="pf-date-label">${dateLabel}</div>
              ${dateItems.map(it => `
                <div class="pf-item">
                  <div class="pf-item-icon">${it.icon}</div>
                  <div class="pf-item-body">
                    <div class="pf-item-header">
                      <span class="pf-item-cat cat-${it.cat}">${getPortfolioCatLabel(it.cat)}</span>
                      <span class="pf-item-subject">${it.subject}</span>
                    </div>
                    <span class="pf-item-title">${it.title}</span>
                    ${it.desc ? `<span class="pf-item-desc">${it.desc}</span>` : ''}
                  </div>
                  <div class="pf-item-right">
                    ${it.time !== '00:00' ? `<span class="pf-item-time">${it.time}</span>` : ''}
                    <span class="pf-item-xp">+${it.xp} XP</span>
                  </div>
                </div>
              `).join('')}
            </div>
          `).join('')}
        </div>
        ` : `
        <div class="pf-empty">
          <div class="pf-empty-icon">📭</div>
          <div class="pf-empty-text">해당 기간에 기록이 없습니다</div>
        </div>
        `}
      </div>
    </div>
  `;
}

function getPortfolioCatLabel(cat) {
  const map = { class:'수업', question:'질문', assignment:'과제', teach:'교학상장', report:'탐구보고서', reading:'독서', activity:'창체' };
  return map[cat] || cat;
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr);
  const days = ['일','월','화','수','목','금','토'];
  const m = d.getMonth()+1, dd = d.getDate(), day = days[d.getDay()];
  const today = new Date('2026-02-15');
  const diff = Math.round((today - d) / 86400000);
  if (diff === 0) return `오늘 (${m}/${dd} ${day})`;
  if (diff === 1) return `어제 (${m}/${dd} ${day})`;
  return `${m}/${dd} (${day})`;
}

// ==================== REPORT PROJECT (탐구보고서 5단계 시스템) ====================

const REPORT_PHASES = [
  { id:'p1', name:'주제 선정', icon:'🔍', color:'#818cf8', aiRole:'가이드', desc:'궁금한 것에서 출발하여 탐구 질문 만들기', expectedLevel:'A-1 ~ A-2', tip:'"이게 궁금해!"에서 시작해봐' },
  { id:'p2', name:'탐구 설계', icon:'📐', color:'#34d399', aiRole:'가이드', desc:'어떻게 조사/실험할 건지 계획 세우기', expectedLevel:'A-2 ~ B-1', tip:'"어떻게 알아볼 수 있을까?"를 고민해봐' },
  { id:'p3', name:'자료 수집', icon:'📊', color:'#fbbf24', aiRole:'피드백', desc:'자료를 모으고 정율에게 물어보기', expectedLevel:'B-1 ~ B-2', tip:'"왜 이런 결과가 나올까?"를 물어봐' },
  { id:'p4', name:'분석/작성', icon:'📝', color:'#f87171', aiRole:'검토', desc:'발견한 것을 정리하고 보고서 작성', expectedLevel:'B-2 ~ C-1', tip:'"만약 조건이 달랐다면?"을 생각해봐' },
  { id:'p5', name:'회고', icon:'🪞', color:'#a78bfa', aiRole:'성찰', desc:'질문 성장을 돌아보고 성찰하기', expectedLevel:'R-1 ~ R-3', tip:'"내가 뭘 배웠지?"를 되돌아봐' },
];

const REPORT_LEVEL_META = {
  'A-1': { n:1, name:'뭐지?', icon:'🔍', color:'#9ca3af', xp:8 },
  'A-2': { n:2, name:'어떻게?', icon:'🔧', color:'#60a5fa', xp:10 },
  'B-1': { n:3, name:'왜?', icon:'💡', color:'#34d399', xp:15 },
  'B-2': { n:4, name:'만약에?', icon:'🔀', color:'#2dd4bf', xp:20 },
  'C-1': { n:5, name:'뭐가 더 나아?', icon:'⚖️', color:'#fbbf24', xp:25 },
  'C-2': { n:6, name:'그러면?', icon:'🚀', color:'#f87171', xp:30 },
  'R-1': { n:3, name:'어디서 틀렸지?', icon:'🔬', color:'#a78bfa', xp:15 },
  'R-2': { n:4, name:'왜 틀렸지?', icon:'🧠', color:'#c084fc', xp:20 },
  'R-3': { n:5, name:'다음엔 어떻게?', icon:'🛡️', color:'#e879f9', xp:25 },
};

function renderReportProject() {
  // 프로젝트 선택 화면 또는 개별 프로젝트 화면
  const reportProjects = state.extracurriculars.filter(e => e.type === 'report' && e.report);

  // viewingReport가 없으면 프로젝트 목록 표시
  if (!state.viewingReport) {
    return renderReportProjectList(reportProjects);
  }

  const ec = state.extracurriculars.find(e => e.id === state.viewingReport);
  if (!ec || !ec.report) {
    state.viewingReport = null;
    return renderReportProjectList(reportProjects);
  }

  const rpt = ec.report;
  const phase = REPORT_PHASES[state.reportPhaseTab] || REPORT_PHASES[0];
  const phaseQuestions = rpt.questions.filter(q => q.phaseId === phase.id);
  const allQuestions = rpt.questions;
  const totalXp = allQuestions.reduce((s, q) => s + (q.xp || 0), 0);

  // 성장 그래프 SVG 데이터
  const growthSvg = buildGrowthSvg(allQuestions.filter(q => q.axis === 'curiosity'));

  // 언락 상태 계산
  const hasB1 = phaseQuestions.some(q => (REPORT_LEVEL_META[q.level]?.n || 0) >= 3);
  const unlocked = hasB1 && phaseQuestions.length >= 2;

  // 최고 수준
  const highest = allQuestions.reduce((h, q) => {
    const n = REPORT_LEVEL_META[q.level]?.n || 0;
    return n > (REPORT_LEVEL_META[h]?.n || 0) ? q.level : h;
  }, 'A-1');
  const highestMeta = REPORT_LEVEL_META[highest];

  return `
    <div class="full-screen animate-slide">
      <!-- 헤더 -->
      <div class="rpt-header">
        <div class="rpt-header-top">
          <button class="back-btn" onclick="state.viewingReport=null;goScreen('report-project')"><i class="fas fa-arrow-left"></i></button>
          <div class="rpt-header-title">
            <div class="rpt-title">${ec.title}</div>
            <div class="rpt-subtitle">${ec.subject} · ${ec.desc || ''}</div>
          </div>
          <div class="rpt-xp-badge">⚡ ${totalXp} XP</div>
        </div>

        <!-- 미니 성장 그래프 (질문 2개 이상일 때) -->
        ${allQuestions.filter(q => q.axis === 'curiosity').length >= 2 ? `
        <div class="rpt-mini-growth">
          <div class="rpt-mini-growth-label">📈 질문 성장</div>
          <svg width="100%" height="50" viewBox="0 0 300 50" preserveAspectRatio="none">
            <defs><linearGradient id="rptGrad" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#34d399"/></linearGradient></defs>
            ${growthSvg}
          </svg>
        </div>
        ` : ''}

        <!-- 요약 통계 -->
        <div class="rpt-stats-row">
          <div class="rpt-stat-item">
            <span class="rpt-stat-icon">⚡</span>
            <span class="rpt-stat-value" style="color:#fbbf24">${totalXp}</span>
            <span class="rpt-stat-label">총 XP</span>
          </div>
          <div class="rpt-stat-item">
            <span class="rpt-stat-icon">💬</span>
            <span class="rpt-stat-value" style="color:#818cf8">${allQuestions.length}</span>
            <span class="rpt-stat-label">질문 수</span>
          </div>
          <div class="rpt-stat-item">
            <span class="rpt-stat-icon">${highestMeta?.icon || '🔍'}</span>
            <span class="rpt-stat-value" style="color:${highestMeta?.color || '#888'}">${highest}</span>
            <span class="rpt-stat-label">최고 수준</span>
          </div>
        </div>

        <!-- Phase 탭 (가로 스크롤) -->
        <div class="rpt-phase-tabs">
          ${REPORT_PHASES.map((p, i) => {
            const pQs = allQuestions.filter(q => q.phaseId === p.id);
            const isActive = state.reportPhaseTab === i;
            const phaseStatus = rpt.phases[i]?.status || 'locked';
            return `
            <button class="rpt-phase-tab ${isActive ? 'active' : ''} ${phaseStatus}"
              onclick="state.reportPhaseTab=${i};state.reportViewMode='question';state.reportDiagResult=null;state.reportAiResponse=null;renderScreen()"
              style="${isActive ? `--phase-color:${p.color};border-color:${p.color}44;background:${p.color}15;color:${p.color}` : ''}">
              ${phaseStatus === 'locked' ? '🔒' : p.icon} ${p.name}
              ${pQs.length > 0 ? `<span class="rpt-phase-badge" style="background:${p.color}25;color:${p.color}">${pQs.length}</span>` : ''}
            </button>
            `;
          }).join('')}
          <!-- 추가 탭: 전체기록, 리포트 -->
          <button class="rpt-phase-tab ${state.reportViewMode === 'all-timeline' ? 'active' : ''}"
            onclick="state.reportViewMode='all-timeline';renderScreen()"
            style="${state.reportViewMode === 'all-timeline' ? '--phase-color:#34d399;border-color:rgba(52,211,153,.3);background:rgba(52,211,153,.12);color:#34d399' : ''}">
            📜 전체기록
          </button>
          <button class="rpt-phase-tab ${state.reportViewMode === 'report' ? 'active' : ''}"
            onclick="state.reportViewMode='report';renderScreen()"
            style="${state.reportViewMode === 'report' ? '--phase-color:#fbbf24;border-color:rgba(251,191,36,.3);background:rgba(251,191,36,.12);color:#fbbf24' : ''}">
            📈 리포트
          </button>
        </div>
      </div>

      <!-- 컨텐츠 영역 -->
      <div class="rpt-content">
        ${state.reportViewMode === 'all-timeline' ? renderReportAllTimeline(allQuestions, rpt.timeline) :
          state.reportViewMode === 'report' ? renderReportGrowthReport(allQuestions) :
          renderReportPhaseView(phase, state.reportPhaseTab, phaseQuestions, allQuestions, rpt, ec, unlocked)}
      </div>
    </div>
  `;
}

// 프로젝트 목록 화면
function renderReportProjectList(projects) {
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('record-activity')"><i class="fas fa-arrow-left"></i></button>
        <h1>📄 탐구보고서</h1>
        <button class="header-add-btn" onclick="goScreen('report-add')"><i class="fas fa-plus"></i></button>
      </div>
      <div class="form-body">
        <!-- 슬로건 배너 -->
        <div class="rpt-banner stagger-1 animate-in">
          <span style="font-size:20px">💡</span>
          <div>
            <div style="font-size:13px;font-weight:700;color:#e0e0e0">질문이 성장하면 보고서가 됩니다</div>
            <div style="font-size:11px;color:#888;margin-top:2px">궁금한 것에서 시작해, 탐구 역량을 키워봐요</div>
          </div>
        </div>

        ${projects.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
            <div style="font-size:48px;margin-bottom:12px">📝</div>
            <div style="font-size:15px;font-weight:600;margin-bottom:8px">아직 탐구보고서 프로젝트가 없어요</div>
            <div style="font-size:13px;color:#666;margin-bottom:16px">아래 버튼을 눌러 첫 탐구를 시작해보세요!</div>
            <button class="btn-primary" onclick="goScreen('report-add')" style="display:inline-flex;align-items:center;gap:6px;padding:12px 24px">
              <i class="fas fa-plus"></i> 새 탐구보고서 만들기
            </button>
          </div>
        ` : projects.map((ec, i) => {
          const rpt = ec.report;
          const totalXp = rpt.questions.reduce((s, q) => s + (q.xp || 0), 0);
          const highest = rpt.questions.reduce((h, q) => (REPORT_LEVEL_META[q.level]?.n || 0) > (REPORT_LEVEL_META[h]?.n || 0) ? q.level : h, 'A-1');
          const hMeta = REPORT_LEVEL_META[highest];
          const currentPhaseName = REPORT_PHASES[rpt.currentPhase]?.name || '주제 선정';
          const currentPhaseIcon = REPORT_PHASES[rpt.currentPhase]?.icon || '🔍';
          const currentPhaseColor = REPORT_PHASES[rpt.currentPhase]?.color || '#818cf8';
          return `
          <div class="rpt-project-card stagger-${i+1} animate-in" onclick="state.viewingReport='${ec.id}';state.reportPhaseTab=${rpt.currentPhase};state.reportViewMode='question';state.reportDiagResult=null;state.reportAiResponse=null;renderScreen()">
            <div class="rpt-project-top">
              <div class="rpt-project-color" style="background:${ec.color}"></div>
              <div class="rpt-project-info">
                <div class="rpt-project-name">${ec.title}</div>
                <div class="rpt-project-meta">${ec.subject} · ${ec.startDate?.slice(5)} ~ ${ec.endDate?.slice(5)}</div>
              </div>
              <div class="rpt-project-phase" style="background:${currentPhaseColor}15;color:${currentPhaseColor}">
                ${currentPhaseIcon} ${currentPhaseName}
              </div>
            </div>
            <div class="rpt-project-bottom">
              <div class="rpt-project-stat">💬 ${rpt.questions.length}개 질문</div>
              <div class="rpt-project-stat">⚡ ${totalXp} XP</div>
              <div class="rpt-project-stat" style="color:${hMeta?.color}">${hMeta?.icon} ${highest}</div>
              <div class="rpt-project-progress">
                <div class="rpt-project-progress-fill" style="width:${ec.progress}%;background:${ec.color}"></div>
              </div>
            </div>
          </div>
          `;
        }).join('')}
        <!-- 추가 버튼 (하단 고정) -->
        <button class="rpt-add-float-btn" onclick="goScreen('report-add')">
          <i class="fas fa-plus" style="margin-right:6px"></i> 새 탐구보고서
        </button>
      </div>
    </div>
  `;
}

// 탐구보고서 추가 화면
function renderReportAdd() {
  const subjects = ['수학','국어','영어','과학','한국사','사회','정보','기술가정','음악','미술','체육'];
  const colors = ['#6C5CE7','#FF6B6B','#00B894','#FDCB6E','#74B9FF','#A29BFE','#E056A0','#FF9F43','#00CEC9','#FD79A8','#E17055'];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('report-project')"><i class="fas fa-arrow-left"></i></button>
        <h1>📄 새 탐구보고서</h1>
      </div>
      <div class="form-body">
        <!-- Step 1: 궁금한 것 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">1</div>
          <div class="rpt-add-step-content">
            <label class="field-label">💡 뭐가 궁금해?</label>
            <div style="font-size:11px;color:#888;margin-bottom:8px">탐구의 출발점이 되는 궁금증을 자유롭게 적어봐!</div>
            <textarea id="rpt-add-curiosity" class="input-field form-input" rows="3" placeholder="예: 왜 항생제를 오래 쓰면 안 듣게 되는 걸까?"></textarea>
          </div>
        </div>

        <!-- Step 2: 과목 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">2</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📚 관련 과목</label>
            <div class="rpt-add-subject-grid" id="rpt-add-subjects">
              ${subjects.map((s, i) => `
                <button class="rpt-add-subject-btn" data-subject="${s}" data-color="${colors[i]}" onclick="selectReportSubject(this)">
                  <span class="rpt-add-subject-dot" style="background:${colors[i]}"></span>${s}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Step 3: 제목 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">3</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📝 탐구 주제 (제목)</label>
            <div style="font-size:11px;color:#888;margin-bottom:8px">나중에 수정할 수 있어요. 지금은 대략적으로 적어도 OK!</div>
            <input id="rpt-add-title" class="input-field form-input" placeholder="예: 항생제 내성 확산 메커니즘 탐구">
          </div>
        </div>

        <!-- Step 4: 기간 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">4</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📅 탐구 기간</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="rpt-add-start" type="date" class="input-field form-input" value="${new Date().toISOString().slice(0,10)}" style="flex:1">
              <span style="color:#666">~</span>
              <input id="rpt-add-end" type="date" class="input-field form-input" value="${new Date(Date.now()+30*86400000).toISOString().slice(0,10)}" style="flex:1">
            </div>
          </div>
        </div>

        <!-- Step 5: 설명 (선택) -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">5</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📖 간단 설명 <span class="field-hint">(선택)</span></label>
            <input id="rpt-add-desc" class="input-field form-input" placeholder="예: 다양한 조건에서 반응속도 비교 실험">
          </div>
        </div>

        <button class="btn-primary" onclick="saveNewReport()" style="margin-top:16px">
          🚀 탐구 시작하기!
        </button>
      </div>
    </div>
  `;
}

function selectReportSubject(btn) {
  document.querySelectorAll('#rpt-add-subjects .rpt-add-subject-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

function saveNewReport() {
  const curiosity = document.getElementById('rpt-add-curiosity')?.value?.trim();
  const title = document.getElementById('rpt-add-title')?.value?.trim();
  const startDate = document.getElementById('rpt-add-start')?.value;
  const endDate = document.getElementById('rpt-add-end')?.value;
  const desc = document.getElementById('rpt-add-desc')?.value?.trim() || '';
  const subjectBtn = document.querySelector('#rpt-add-subjects .rpt-add-subject-btn.active');
  const subject = subjectBtn?.dataset?.subject || '기타';
  const color = subjectBtn?.dataset?.color || '#818cf8';

  if (!title) {
    alert('탐구 주제(제목)를 입력해주세요!');
    return;
  }

  // 새 ID 생성
  const newId = 'ec' + (Date.now() % 100000);

  // extracurriculars에 추가
  const newEntry = {
    id: newId,
    type: 'report',
    title: title,
    subject: subject,
    status: 'in-progress',
    progress: 0,
    startDate: startDate || new Date().toISOString().slice(0,10),
    endDate: endDate || new Date(Date.now()+30*86400000).toISOString().slice(0,10),
    color: color,
    desc: desc,
    memo: curiosity || '',
    report: {
      currentPhase: 0,
      phases: [
        { id:'p1', name:'주제 선정', status:'in-progress' },
        { id:'p2', name:'탐구 설계', status:'locked' },
        { id:'p3', name:'자료 수집', status:'locked' },
        { id:'p4', name:'분석/작성', status:'locked' },
        { id:'p5', name:'회고', status:'locked' },
      ],
      questions: [],
      timeline: [],
      totalXp: 0,
    }
  };

  // 초기 궁금증이 있으면 첫 질문으로 자동 등록
  if (curiosity) {
    newEntry.report.questions.push({
      text: curiosity,
      level: 'A-1',
      axis: 'curiosity',
      xp: 8,
      phaseId: 'p1',
      time: new Date().toISOString(),
      diag: { specific_target:{met:false}, own_thinking:{met:false}, context_connection:{met:false} },
    });
    newEntry.report.timeline.push({
      type: 'question',
      text: curiosity,
      phaseId: 'p1',
      time: new Date().toISOString(),
      diagResult: { level:'A-1', axis:'curiosity', xp:8 },
    });
    newEntry.report.totalXp = 8;
    state.xp += 8;
  }

  state.extracurriculars.push(newEntry);

  // DB 저장 (탐구보고서)
  if (DB.studentId()) {
    DB.saveReportRecord({
      title,
      subject,
      phase: '주제 선정',
      timeline: newEntry.report.timeline,
      questions: newEntry.report.questions,
      totalXp: newEntry.report.totalXp,
      status: 'in-progress',
    }).then(dbId => {
      if (dbId) newEntry._reportDbId = dbId;
    });
    // activity_records에도 저장
    DB.saveActivityRecord({
      activityType: 'report',
      title,
      description: desc,
      startDate: newEntry.startDate,
      endDate: newEntry.endDate,
      status: 'in-progress',
      progress: 0,
      reflection: '',
    }).then(dbId => {
      if (dbId) newEntry._dbId = dbId;
    });
  }

  // 바로 새 프로젝트로 진입
  state.viewingReport = newId;
  state.reportPhaseTab = 0;
  state.reportViewMode = 'question';
  state.reportDiagResult = null;
  state.reportAiResponse = null;
  goScreen('report-project');

  // XP 팝업
  showXpPopup(curiosity ? 8 : 0, '새 탐구보고서가 생성되었어요! 🎉');
}

// Phase 뷰 (질문하기 / 기록 / 성장)
function renderReportPhaseView(phase, phaseIdx, phaseQuestions, allQuestions, rpt, ec, unlocked) {
  const phaseStatus = rpt.phases[phaseIdx]?.status || 'locked';

  return `
    <!-- Phase 헤더 -->
    <div class="rpt-phase-header" style="background:linear-gradient(135deg, ${phase.color}10, transparent);border-color:${phase.color}22">
      <div class="rpt-phase-header-top">
        <span style="font-size:28px">${phase.icon}</span>
        <div style="flex:1">
          <div style="font-size:17px;font-weight:800;color:${phase.color}">${phase.name}</div>
          <div style="font-size:11px;color:#888">${phase.desc}</div>
        </div>
        <div class="rpt-ai-role" style="background:${phase.color}15;color:${phase.color}">🤖 ${phase.aiRole}</div>
      </div>
      <div class="rpt-phase-hint">
        예상 질문 수준: <span style="color:${phase.color};font-weight:700">${phase.expectedLevel}</span>
        &nbsp;·&nbsp; 💡 ${phase.tip}
      </div>
    </div>

    ${phaseStatus === 'locked' ? `
      <div class="rpt-locked-msg">
        <div style="font-size:36px;margin-bottom:8px">🔒</div>
        <div style="font-size:15px;font-weight:600;color:#888;margin-bottom:6px">이 단계는 아직 잠겨있어요</div>
        <div style="font-size:12px;color:#555">이전 단계를 완료하면 열려요!</div>
      </div>
    ` : `
      <!-- 언락 상태 -->
      <div class="rpt-unlock-status ${unlocked ? 'unlocked' : ''}">
        <div class="rpt-unlock-title">${unlocked ? '🔓 정율 초안 보조 활성화!' : '🔒 정율 초안 보조 잠김'}</div>
        <div class="rpt-unlock-checks">
          <span style="color:${phaseQuestions.length >= 2 ? '#34d399' : '#f87171'}">${phaseQuestions.length >= 2 ? '✅' : '❌'} 질문 2회 이상 (${phaseQuestions.length}/2)</span>
          <span style="color:${phaseQuestions.some(q => (REPORT_LEVEL_META[q.level]?.n || 0) >= 3) ? '#34d399' : '#f87171'}">${phaseQuestions.some(q => (REPORT_LEVEL_META[q.level]?.n || 0) >= 3) ? '✅' : '❌'} B-1 이상 질문 달성</span>
        </div>
      </div>

      <!-- 모드 탭 -->
      <div class="rpt-mode-tabs">
        ${[
          { id:'question', label:'💬 질문하기', c:'#818cf8' },
          { id:'timeline', label:'📜 기록', c:'#34d399', badge: rpt.timeline.filter(t => t.phaseId === phase.id).length },
          { id:'growth', label:'📈 성장', c:'#fbbf24' },
        ].map(tab => `
          <button class="rpt-mode-tab ${state.reportViewMode === tab.id ? 'active' : ''}"
            onclick="state.reportViewMode='${tab.id}';renderScreen()"
            style="${state.reportViewMode === tab.id ? `color:${tab.c};border-bottom-color:${tab.c}` : ''}">
            ${tab.label}
            ${tab.badge > 0 ? `<span class="rpt-mode-badge">${tab.badge}</span>` : ''}
          </button>
        `).join('')}
      </div>

      ${state.reportViewMode === 'question' ? renderReportQuestionMode(phase, phaseQuestions, allQuestions, ec) : ''}
      ${state.reportViewMode === 'timeline' ? renderReportTimelineMode(phase, rpt) : ''}
      ${state.reportViewMode === 'growth' ? renderReportGrowthMode(phase, phaseQuestions) : ''}
    `}
  `;
}

// 질문하기 모드
function renderReportQuestionMode(phase, phaseQuestions, allQuestions, ec) {
  // 추천 질문
  const suggestions = {
    'p1': ['내가 관심 있는 분야에서 탐구할 만한 주제가 뭐가 있을까?', '이 주제를 어떤 각도에서 접근할 수 있을까?'],
    'p2': ['이 주제를 탐구하려면 어떤 방법이 좋을까?', '비슷한 연구에서는 어떤 방법을 썼어?'],
    'p3': ['이 주제에 대한 최신 연구가 있을까?', '이 데이터를 어떻게 해석하면 좋을까?'],
    'p4': ['내 분석이 논리적인지 검토해줘', '결론과 근거가 잘 연결되는지 봐줘'],
    'p5': ['이 탐구에서 내가 가장 성장한 점은 뭘까?', '다음 탐구를 한다면 뭘 다르게 할까?'],
  };

  return `
    <!-- 추천 질문 (아직 질문 없을 때) -->
    ${phaseQuestions.length === 0 ? `
      <div class="rpt-suggestions">
        <div style="font-size:11px;color:#888;margin-bottom:6px">💡 이런 것부터 물어봐:</div>
        ${(suggestions[phase.id] || []).map(s => `
          <button class="rpt-suggestion-btn" onclick="document.getElementById('rpt-question-input').value='${s.replace(/'/g, "\\'")}'">
            ${s}
          </button>
        `).join('')}
      </div>
    ` : ''}

    <!-- 질문 입력 -->
    <div class="rpt-input-area">
      <textarea id="rpt-question-input" class="rpt-input" rows="2" placeholder="${phase.name} 단계에서 궁금한 것을 물어봐!"></textarea>
      <button class="rpt-send-btn" style="background:${state.reportAiLoading ? '#444' : phase.color}"
        onclick="submitReportQuestion('${ec.id}', ${REPORT_PHASES.indexOf(phase)})"
        ${state.reportAiLoading ? 'disabled' : ''}>
        ${state.reportAiLoading ? '<div class="rpt-btn-spinner"></div>' : '전송'}
      </button>
    </div>

    <!-- 로딩 -->
    ${state.reportAiLoading ? `
      <div class="rpt-loading">
        <div class="rpt-loading-pulse">🔍 질문 분석 중... → 📚 자료 검색 중...</div>
      </div>
    ` : ''}

    <!-- 진단 결과 -->
    ${state.reportDiagResult ? renderReportDiagBadge(state.reportDiagResult) : ''}

    <!-- 정율 멘토 응답 (Perplexity) -->
    ${state.reportAiResponse ? `
      <div class="rpt-ai-response">
        <div class="rpt-ai-response-header">
          <span>🤖 정율 멘토 (${phase.aiRole})</span>
          <span class="rpt-ai-source">📚 Perplexity 검색 기반</span>
        </div>
        <div class="rpt-ai-response-body">${formatReportAiText(state.reportAiResponse.answer || '')}</div>
        ${state.reportAiResponse.citations && state.reportAiResponse.citations.length > 0 ? `
          <div class="rpt-ai-citations">
            <div style="font-size:10px;color:#888;margin-bottom:4px">📎 출처:</div>
            ${state.reportAiResponse.citations.map((c, i) => `
              <a href="${c}" target="_blank" class="rpt-citation-link">[${i+1}] ${c.length > 50 ? c.slice(0, 50) + '...' : c}</a>
            `).join('')}
          </div>
        ` : ''}
        <div style="margin-top:8px;font-size:9px;color:#555">💾 이 대화는 자동으로 탐구 기록에 저장되었습니다</div>
      </div>
    ` : ''}

    <!-- 이전 질문 이력 -->
    ${phaseQuestions.length > 0 ? `
      <div class="rpt-prev-questions">
        <div style="font-size:11px;color:#888;margin-bottom:8px">이 단계의 질문 이력 (${phaseQuestions.length}개)</div>
        ${phaseQuestions.slice().reverse().map(q => {
          const m = REPORT_LEVEL_META[q.level];
          return `
          <div class="rpt-q-history-item">
            <span class="rpt-q-level" style="background:${m?.color}15;color:${m?.color}">${q.level}</span>
            <span class="rpt-q-text">${q.text.length > 60 ? q.text.slice(0, 60) + '...' : q.text}</span>
            <span class="rpt-q-xp">+${q.xp}</span>
          </div>`;
        }).join('')}
      </div>
    ` : ''}
  `;
}

// 진단 배지 렌더링
function renderReportDiagBadge(result) {
  const m = REPORT_LEVEL_META[result.level] || REPORT_LEVEL_META['A-1'];
  const diag = result.diag || {};
  return `
    <div class="rpt-diag-badge" style="background:${m.color}08;border-color:${m.color}22">
      <div class="rpt-diag-top">
        <span style="font-size:20px">${m.icon}</span>
        <div>
          <div style="font-size:15px;font-weight:800;color:${m.color}">${result.level} "${m.name}"</div>
          <div style="font-size:11px;color:#888">${result.axis === 'curiosity' ? '호기심 사다리' : '성찰 질문'} · +${result.xp || m.xp} XP</div>
        </div>
      </div>
      <div class="rpt-diag-checks">
        ${[
          { key:'specific_target', label:'①대상' },
          { key:'own_thinking', label:'②생각' },
          { key:'context_connection', label:'③맥락' },
        ].map(c => {
          const d = diag[c.key];
          return `
          <div class="rpt-diag-check ${d?.met ? 'pass' : 'fail'}">
            <div style="font-size:12px">${d?.met ? '✅' : '❌'}</div>
            <div class="rpt-diag-check-label">${c.label}</div>
          </div>`;
        }).join('')}
      </div>
      ${result.coaching_comment ? `<div class="rpt-diag-coaching">💬 ${result.coaching_comment}</div>` : ''}
      ${result.upgrade_hint ? `<div class="rpt-diag-hint">⬆️ ${result.upgrade_hint}</div>` : ''}
    </div>
  `;
}

// 타임라인 모드
function renderReportTimelineMode(phase, rpt) {
  const entries = rpt.timeline.filter(t => t.phaseId === phase.id);
  if (entries.length === 0) {
    return `
      <div class="rpt-empty">
        <div style="font-size:28px;margin-bottom:6px">📭</div>
        <div style="font-size:13px">이 단계의 기록이 아직 없어요</div>
        <div style="font-size:11px;margin-top:4px;color:#555">💬 질문하기 탭에서 정율에게 물어보면 자동 기록됩니다</div>
      </div>
    `;
  }
  return entries.slice().reverse().map(entry => {
    const phaseMeta = REPORT_PHASES.find(p => p.id === entry.phaseId);
    const diagMeta = entry.diagResult ? REPORT_LEVEL_META[entry.diagResult.level] : null;
    return `
    <div class="rpt-timeline-entry">
      <div class="rpt-tl-icon ${entry.type}">
        ${entry.type === 'question' ? '💬' : entry.type === 'ai_response' ? '🤖' : '✏️'}
      </div>
      <div class="rpt-tl-body">
        <div class="rpt-tl-meta">
          <span class="rpt-tl-phase" style="background:${phaseMeta?.color || '#888'}15;color:${phaseMeta?.color || '#888'}">${phaseMeta?.name || ''}</span>
          ${entry.diagResult ? `<span class="rpt-tl-level" style="background:${diagMeta?.color}15;color:${diagMeta?.color}">${diagMeta?.icon} ${entry.diagResult.level} +${entry.diagResult.xp || diagMeta?.xp}XP</span>` : ''}
          <span class="rpt-tl-time">${new Date(entry.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span>
        </div>
        <div class="rpt-tl-text">${entry.text}</div>
      </div>
    </div>`;
  }).join('');
}

// 성장 모드
function renderReportGrowthMode(phase, phaseQuestions) {
  if (phaseQuestions.length === 0) {
    return `<div class="rpt-empty" style="padding:30px"><div style="font-size:13px;color:#555">아직 이 단계에서 질문한 적이 없어요</div></div>`;
  }
  const curiosityQs = phaseQuestions.filter(q => q.axis === 'curiosity');
  const growthSvg = buildGrowthSvg(curiosityQs);
  return `
    ${curiosityQs.length >= 2 ? `
    <div class="rpt-growth-chart">
      <div style="font-size:11px;color:#888;margin-bottom:6px">📈 이 단계의 질문 성장 그래프</div>
      <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none">
        <defs><linearGradient id="rptGrad2" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#34d399"/></linearGradient></defs>
        ${buildGrowthSvg(curiosityQs, 100)}
      </svg>
    </div>` : ''}
    <div style="margin-top:12px">
      <div style="font-size:11px;color:#888;margin-bottom:8px">이 단계의 질문 이력</div>
      ${phaseQuestions.map(q => {
        const m = REPORT_LEVEL_META[q.level];
        return `
        <div class="rpt-q-history-item">
          <span class="rpt-q-level" style="background:${m?.color}15;color:${m?.color}">${q.level}</span>
          <span class="rpt-q-text">${q.text.length > 50 ? q.text.slice(0, 50) + '...' : q.text}</span>
          <span class="rpt-q-xp" style="color:#fbbf24">+${q.xp}</span>
        </div>`;
      }).join('')}
    </div>
  `;
}

// 전체 기록 뷰
function renderReportAllTimeline(allQuestions, timeline) {
  const totalXp = allQuestions.reduce((s, q) => s + (q.xp || 0), 0);
  const highest = allQuestions.reduce((h, q) => (REPORT_LEVEL_META[q.level]?.n || 0) > (REPORT_LEVEL_META[h]?.n || 0) ? q.level : h, 'A-1');
  return `
    <div style="font-size:14px;font-weight:800;color:#34d399;margin-bottom:12px">📜 전체 탐구 기록 (${timeline.length}건)</div>
    <div class="rpt-stats-row" style="margin-bottom:12px">
      <div class="rpt-stat-item"><span class="rpt-stat-icon">⚡</span><span class="rpt-stat-value" style="color:#fbbf24">${totalXp}</span><span class="rpt-stat-label">총 XP</span></div>
      <div class="rpt-stat-item"><span class="rpt-stat-icon">💬</span><span class="rpt-stat-value" style="color:#818cf8">${allQuestions.length}</span><span class="rpt-stat-label">질문 수</span></div>
      <div class="rpt-stat-item"><span class="rpt-stat-icon">${REPORT_LEVEL_META[highest]?.icon}</span><span class="rpt-stat-value" style="color:${REPORT_LEVEL_META[highest]?.color}">${highest}</span><span class="rpt-stat-label">최고 수준</span></div>
    </div>
    ${timeline.length === 0 ? `<div class="rpt-empty" style="padding:40px"><div style="font-size:13px;color:#555">각 단계에서 정율에게 질문하면 여기에 자동 기록됩니다</div></div>` :
    timeline.slice().reverse().map(entry => {
      const phaseMeta = REPORT_PHASES.find(p => p.id === entry.phaseId);
      const diagMeta = entry.diagResult ? REPORT_LEVEL_META[entry.diagResult.level] : null;
      return `
      <div class="rpt-timeline-entry">
        <div class="rpt-tl-icon ${entry.type}">${entry.type === 'question' ? '💬' : entry.type === 'ai_response' ? '🤖' : '✏️'}</div>
        <div class="rpt-tl-body">
          <div class="rpt-tl-meta">
            <span class="rpt-tl-phase" style="background:${phaseMeta?.color || '#888'}15;color:${phaseMeta?.color || '#888'}">${phaseMeta?.name || ''}</span>
            ${entry.diagResult ? `<span class="rpt-tl-level" style="background:${diagMeta?.color}15;color:${diagMeta?.color}">${diagMeta?.icon} ${entry.diagResult.level}</span>` : ''}
            <span class="rpt-tl-time">${new Date(entry.time).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}</span>
          </div>
          <div class="rpt-tl-text">${entry.text.length > 100 ? entry.text.slice(0,100) + '...' : entry.text}</div>
        </div>
      </div>`;
    }).join('')}
  `;
}

// 성장 리포트 뷰
function renderReportGrowthReport(allQuestions) {
  if (allQuestions.length === 0) {
    return `<div class="rpt-empty" style="padding:40px"><div style="font-size:32px;margin-bottom:8px">📊</div><div style="font-size:14px;color:#555">질문을 시작하면 성장 리포트가 생성됩니다</div></div>`;
  }
  const curiosityQs = allQuestions.filter(q => q.axis === 'curiosity');
  const reflectQs = allQuestions.filter(q => q.axis === 'reflection');
  const totalXp = allQuestions.reduce((s, q) => s + (q.xp || 0), 0);
  const highest = allQuestions.reduce((h, q) => (REPORT_LEVEL_META[q.level]?.n || 0) > (REPORT_LEVEL_META[h]?.n || 0) ? q.level : h, 'A-1');
  const first = allQuestions[0];
  const last = allQuestions[allQuestions.length - 1];
  const firstB1 = curiosityQs.find(q => (REPORT_LEVEL_META[q.level]?.n || 0) >= 3);

  // 수준 분포
  const levelDist = {};
  allQuestions.forEach(q => { levelDist[q.level] = (levelDist[q.level] || 0) + 1; });

  const growthSvg = buildGrowthSvg(curiosityQs, 100);

  return `
    <div class="rpt-report-card">
      <div style="font-size:16px;font-weight:900;color:#fff;margin-bottom:12px">📈 나의 질문 성장 리포트</div>

      <!-- 탐구 여정 -->
      ${first && last ? `
      <div style="margin-bottom:14px">
        <div style="font-size:12px;color:#888;margin-bottom:6px">🎯 탐구 여정</div>
        <div class="rpt-journey">
          <div>시작: <span style="color:${REPORT_LEVEL_META[first.level]?.color}">${first.level}</span> "${first.text.length > 40 ? first.text.slice(0,40)+'...' : first.text}"</div>
          <div style="text-align:center;color:#555;font-size:16px;margin:4px 0">⬇️</div>
          <div>현재: <span style="color:${REPORT_LEVEL_META[last.level]?.color}">${last.level}</span> "${last.text.length > 40 ? last.text.slice(0,40)+'...' : last.text}"</div>
        </div>
      </div>` : ''}

      <!-- 성장 그래프 -->
      ${curiosityQs.length >= 2 ? `
      <div class="rpt-growth-chart">
        <div style="font-size:11px;color:#888;margin-bottom:6px">📈 질문 성장 그래프</div>
        <svg width="100%" height="100" viewBox="0 0 300 100" preserveAspectRatio="none">
          <defs><linearGradient id="rptGrad3" x1="0%" y1="0%" x2="100%" y2="0%"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#34d399"/></linearGradient></defs>
          ${growthSvg}
        </svg>
      </div>` : ''}

      <!-- 통계 -->
      <div class="rpt-stats-row" style="margin-top:8px">
        <div class="rpt-stat-item"><div style="font-size:14px">💬</div><div style="font-size:14px;font-weight:800;color:#818cf8">${allQuestions.length}</div><div style="font-size:9px;color:#666">총 질문</div></div>
        <div class="rpt-stat-item"><div style="font-size:14px">⚡</div><div style="font-size:14px;font-weight:800;color:#fbbf24">${totalXp}</div><div style="font-size:9px;color:#666">총 XP</div></div>
        <div class="rpt-stat-item"><div style="font-size:14px">🏆</div><div style="font-size:14px;font-weight:800;color:${REPORT_LEVEL_META[highest]?.color}">${highest}</div><div style="font-size:9px;color:#666">최고 수준</div></div>
      </div>

      <!-- 첫 B-1 달성 -->
      ${firstB1 ? `
      <div class="rpt-highlight">
        <div style="font-size:11px;font-weight:700;color:#34d399;margin-bottom:4px">🎉 첫 B-1 달성!</div>
        <div style="font-size:12px;color:#b0b0b0;line-height:1.6">"${firstB1.text.length > 80 ? firstB1.text.slice(0,80)+'...' : firstB1.text}"</div>
      </div>` : ''}

      <!-- 수준 분포 -->
      <div style="margin-top:12px">
        <div style="font-size:11px;color:#888;margin-bottom:6px">질문 수준 분포</div>
        <div class="rpt-level-dist">
          ${Object.entries(levelDist).sort().map(([lv, cnt]) => {
            const m = REPORT_LEVEL_META[lv];
            return `<div class="rpt-level-dist-item" style="flex:${cnt};background:${m?.color}20"><div style="font-size:10px;font-weight:700;color:${m?.color}">${lv}</div><div style="font-size:9px;color:#888">${cnt}회</div></div>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// SVG 성장 그래프 빌더
function buildGrowthSvg(curiosityQs, height) {
  height = height || 50;
  const levels = ['A-1','A-2','B-1','B-2','C-1','C-2'];
  const padL = 36;
  const chartW = 300 - padL;
  const chartH = height - 10;

  if (curiosityQs.length === 0) return '';

  // 그리드 라인 (호기심 축만)
  let svg = levels.map((lv, i) => {
    const y = chartH - (i / 5) * chartH;
    return `<line x1="${padL}" y1="${y}" x2="300" y2="${y}" stroke="rgba(255,255,255,.06)"/>
    <text x="${padL - 4}" y="${y + 3}" text-anchor="end" fill="#555" font-size="8">${lv}</text>`;
  }).join('');

  // 포인트 계산
  const points = curiosityQs.map((q, i) => {
    const lvlIdx = levels.indexOf(q.level);
    const x = padL + (i / Math.max(curiosityQs.length - 1, 1)) * chartW;
    const y = chartH - (lvlIdx / 5) * chartH;
    return { x, y, q };
  });

  // 선
  if (points.length > 1) {
    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
    svg += `<path d="${pathD}" fill="none" stroke="url(#rptGrad)" stroke-width="2" stroke-linecap="round"/>`;
  }

  // 점
  points.forEach((p, i) => {
    const m = REPORT_LEVEL_META[p.q.level];
    const r = i === points.length - 1 ? 4 : 2.5;
    svg += `<circle cx="${p.x}" cy="${p.y}" r="${r}" fill="${m?.color || '#888'}" stroke="#08080f" stroke-width="1"/>`;
  });

  // 마지막 라벨
  if (points.length > 0) {
    const last = points[points.length - 1];
    const lastMeta = REPORT_LEVEL_META[last.q.level];
    svg += `<text x="${last.x}" y="${last.y - 8}" text-anchor="middle" fill="${lastMeta?.color}" font-size="9" font-weight="700">${last.q.level}</text>`;
  }

  return svg;
}

// AI 텍스트 포맷팅
function formatReportAiText(text) {
  return text
    .replace(/\n/g, '<br>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" style="color:#60a5fa">$1</a>');
}

// 질문 제출 함수 (이중 파이프라인: Gemini 진단 → Perplexity 답변)
async function submitReportQuestion(ecId, phaseIdx) {
  const input = document.getElementById('rpt-question-input');
  if (!input || !input.value.trim()) return;

  const question = input.value.trim();
  input.value = '';
  state.reportAiLoading = true;
  state.reportDiagResult = null;
  state.reportAiResponse = null;
  renderScreen();

  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec || !ec.report) { state.reportAiLoading = false; renderScreen(); return; }

  const rpt = ec.report;
  const phase = REPORT_PHASES[phaseIdx];

  try {
    // Step 1: 질문 진단 (Gemini Flash → OpenAI 자동 폴백)
    const diagRes = await fetch('/api/report-diagnose', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        phase: phase.name,
        projectTitle: ec.title,
        subject: ec.subject,
      })
    });
    const diagData = await diagRes.json();

    // 에러 응답 처리
    if (diagData.error) {
      state.reportAiResponse = { answer: '⚠️ 정율 분석 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', citations: [] };
      state.reportAiLoading = false;
      renderScreen();
      return;
    }

    if (diagData.level) {
      state.reportDiagResult = diagData;

      // 질문 로그 추가
      const qEntry = {
        text: question,
        level: diagData.level,
        axis: diagData.axis || 'curiosity',
        xp: diagData.xp || (REPORT_LEVEL_META[diagData.level]?.xp || 8),
        phaseId: phase.id,
        time: new Date().toISOString(),
        diag: diagData.diag || {},
      };
      rpt.questions.push(qEntry);
      rpt.totalXp = rpt.questions.reduce((s, q) => s + (q.xp || 0), 0);

      // 타임라인에 추가
      rpt.timeline.push({
        type: 'question',
        text: question,
        phaseId: phase.id,
        time: qEntry.time,
        diagResult: diagData,
      });

      // XP 추가
      state.xp += qEntry.xp;
    }
    renderScreen();

    // Step 2: 정율 멘토 답변 (Perplexity - 자료 검색 기반)
    const mentorRes = await fetch('/api/report-mentor', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        phase: phase.name,
        projectTitle: ec.title,
        subject: ec.subject,
        questionHistory: rpt.questions.slice(-5).map(q => ({ level: q.level, text: q.text })),
      })
    });
    const mentorData = await mentorRes.json();

    if (mentorData.answer) {
      state.reportAiResponse = mentorData;

      // 타임라인에 AI 응답 추가
      rpt.timeline.push({
        type: 'ai_response',
        text: (mentorData.answer || '').slice(0, 200) + '...',
        phaseId: phase.id,
        time: new Date().toISOString(),
      });
    }

    // DB에 탐구보고서 업데이트 (질문/타임라인 변경)
    if (ec._reportDbId && DB.studentId()) {
      DB.updateReportRecord(ec._reportDbId, {
        timeline: rpt.timeline,
        questions: rpt.questions,
        totalXp: rpt.totalXp,
        phase: phase.name,
      });
    }
  } catch (e) {
    state.reportAiResponse = { answer: '⚠️ 오류가 발생했습니다: ' + e.message, citations: [] };
  }

  state.reportAiLoading = false;
  renderScreen();

  // 스크롤 조정
  setTimeout(() => {
    const content = document.querySelector('.rpt-content');
    if (content) content.scrollTop = content.scrollHeight;
  }, 100);
}


// ==================== CLASS END POPUP ====================

function renderClassEndPopup() {
  const nextRecord = state.todayRecords.find(r => !r.done);
  const subject = nextRecord ? nextRecord.subject : '영어';
  const period = nextRecord ? nextRecord.period : 3;
  const teacher = nextRecord ? nextRecord.teacher : '이정민';
  const color = nextRecord ? nextRecord.color : '#00B894';
  
  return `
    <div class="popup-overlay animate-in">
      <div class="popup-card">
        <div class="popup-record-title">
          <button class="popup-back-btn" onclick="goScreen('main')">
            <i class="fas fa-arrow-left"></i>
          </button>
          <span>📝 당일 수업 · 당일 복습하기</span>
        </div>
        <div class="popup-header">
          <div class="popup-bell"><i class="fas fa-bell"></i></div>
          <h2>${period}교시 <span style="color:${color}">${subject}</span> 수업 끝!</h2>
          <p>${teacher} 선생님</p>
        </div>

        <div class="popup-timer">
          <span class="timer-icon">⏱️</span>
          <span class="timer-text">30초면 OK!</span>
        </div>

        ${renderClassRecordFields(subject)}

        <button class="btn-primary class-record-submit" onclick="completeClassRecord(${period-1})" disabled style="opacity:0.4;cursor:not-allowed">
          기록 완료 +10 XP ✨
        </button>

        <div class="popup-question-after" style="display:none;text-align:center;padding:16px 0;margin-top:8px;border-top:1px solid var(--border)">
          <div style="font-size:24px;margin-bottom:8px">🎉</div>
          <p style="font-size:14px;font-weight:600;color:var(--success);margin:0 0 12px">수업 기록 완료!</p>
          <span style="font-size:14px;font-weight:600">💡 오늘 수업에서 궁금했던 것이 있나요?</span>
          <p style="font-size:12px;color:var(--text-muted);margin:6px 0 12px;line-height:1.5">질문방에 남겨두면 나중에 스스로 직접 답해볼 수 있어요!</p>
          <button class="btn-secondary" style="width:100%;padding:12px;font-size:14px;border-color:rgba(108,92,231,0.4)" onclick="openMyQaIframe('/new')">✏️ 질문하기 +3 XP</button>
          <button class="btn-ghost" style="width:100%;margin-top:8px;font-size:13px" onclick="goScreen('main')">다음에 할게요</button>
        </div>

        <button class="popup-skip popup-skip-before" onclick="goScreen('main')">나중에 할게요</button>
      </div>
    </div>
  `;
}

// ==================== 학원 수업 기록 팝업 ====================

function openAcademyRecordPopup(idx) {
  state._recordingAcademyIdx = idx;
  goScreen('academy-record-popup');
}

function viewAcademyRecord(idx) {
  // 학원 기록 상세 보기 → 기존 detail 화면 재활용
  const r = (state.todayAcademyRecords || [])[idx];
  if (!r) return;
  // todayRecords 구조로 변환해서 기존 상세 뷰에서 볼 수 있도록
  state._viewingTodayRecordIdx = null;
  state._viewingDbRecord = null;
  state._viewingAcademyRecord = { ...r, _academyIdx: idx };
  goScreen('class-record-detail');
}

function renderAcademyRecordPopup() {
  const idx = state._recordingAcademyIdx;
  const acRecords = state.todayAcademyRecords || [];
  const r = acRecords[idx];
  if (!r) { goScreen('main'); return ''; }
  
  const subject = r.subject;
  const color = r.color;
  const academyName = r.academyName || r.teacher;
  const className = r.className || r.subject;
  
  return `
    <div class="popup-overlay animate-in">
      <div class="popup-card">
        <div class="popup-record-title">
          <button class="popup-back-btn" onclick="goScreen('main')">
            <i class="fas fa-arrow-left"></i>
          </button>
          <span>📝 당일 수업 · 당일 복습하기</span>
        </div>
        <div class="popup-header">
          <div class="popup-bell" style="background:rgba(${parseInt(color.slice(1,3),16)},${parseInt(color.slice(3,5),16)},${parseInt(color.slice(5,7),16)},0.2)">
            <i class="fas fa-graduation-cap" style="color:${color}"></i>
          </div>
          <h2><span style="color:${color}">${subject}</span> 학원 수업 끝!</h2>
          <p style="font-size:13px;color:var(--text-muted)">${academyName} · ${className}</p>
          <p style="font-size:12px;color:var(--text-muted);margin-top:2px">${r.startTime||''}~${r.endTime||''}</p>
        </div>

        <div class="popup-timer">
          <span class="timer-icon">⏱️</span>
          <span class="timer-text">30초면 OK!</span>
        </div>

        ${renderClassRecordFields(subject)}

        <button class="btn-primary class-record-submit" onclick="completeAcademyRecord(${idx})" disabled style="opacity:0.4;cursor:not-allowed">
          기록 완료 +10 XP ✨
        </button>

        <div class="popup-question-after" style="display:none;text-align:center;padding:16px 0;margin-top:8px;border-top:1px solid var(--border)">
          <div style="font-size:24px;margin-bottom:8px">🎉</div>
          <p style="font-size:14px;font-weight:600;color:var(--success);margin:0 0 12px">학원 수업 기록 완료!</p>
          <span style="font-size:14px;font-weight:600">💡 학원 수업에서 궁금했던 것이 있나요?</span>
          <p style="font-size:12px;color:var(--text-muted);margin:6px 0 12px;line-height:1.5">질문방에 남겨두면 나중에 스스로 직접 답해볼 수 있어요!</p>
          <button class="btn-secondary" style="width:100%;padding:12px;font-size:14px;border-color:rgba(108,92,231,0.4)" onclick="openMyQaIframe('/new')">✏️ 질문하기 +3 XP</button>
          <button class="btn-ghost" style="width:100%;margin-top:8px;font-size:13px" onclick="goScreen('main')">다음에 할게요</button>
        </div>

        <button class="popup-skip popup-skip-before" onclick="goScreen('main')">나중에 할게요</button>
      </div>
    </div>
  `;
}

function completeAcademyRecord(idx) {
  // 유효성 검사 (기존 함수 재활용)
  if (!validateClassRecordForm()) {
    const keywordInput = document.querySelector('.class-keyword-input');
    if (keywordInput) {
      keywordInput.focus();
      keywordInput.style.borderColor = 'var(--accent)';
      keywordInput.setAttribute('placeholder', '핵심 키워드를 입력해야 기록을 완료할 수 있어요!');
      setTimeout(() => { keywordInput.style.borderColor = ''; }, 2000);
    }
    return;
  }
  
  const acRecords = state.todayAcademyRecords || [];
  if (idx < 0 || idx >= acRecords.length) return;
  const r = acRecords[idx];
  
  // 폼 필드 수집 (기존 로직과 동일)
  const topicInput = document.querySelector('.class-topic-input');
  const topic = topicInput ? topicInput.value.trim() : '';
  
  const pagesInput = document.querySelector('.class-pages-input');
  const pages = pagesInput ? pagesInput.value.trim() : '';
  
  const keywordInput = document.querySelector('.class-keyword-input');
  const keywordText = keywordInput ? keywordInput.value.trim() : '';
  const keywordTexts = [];
  if (keywordText) {
    keywordText.split(/[,，、\n]+/).forEach(k => { const t = k.trim(); if (t) keywordTexts.push(t); });
  }
  
  const photos = state._classPhotos || [];
  
  const teacherNoteInput = document.querySelector('.class-teacher-note-input');
  const teacherNote = teacherNoteInput ? teacherNoteInput.value.trim() : '';
  
  const assignInput = document.querySelector('.class-assignment-input');
  const assignText = assignInput ? assignInput.value.trim() : '';
  
  r.done = true;
  r.summary = topic || keywordTexts.join(', ') || '학원 수업 기록 완료';
  r._topic = topic;
  r._pages = pages;
  r._keywords = keywordTexts;
  r._photos = photos;
  r._teacherNote = teacherNote;
  r._assignmentText = assignText;
  r._assignmentDue = state._classAssignmentDue || '';
  
  // 미션 업데이트 (학교+학원 합산)
  const totalDone = state.todayRecords.filter(x => x.done).length + acRecords.filter(x => x.done).length;
  if (state.missions && state.missions[0]) {
    state.missions[0].current = totalDone;
    if (state.missions[0].current >= state.missions[0].target && !state.missions[0].done) {
      state.missions[0].done = true;
    }
  }
  
  // DB 저장 (학원 수업도 동일하게 class-records API 사용)
  if (state._authUser?.id) {
    saveClassRecord({
      student_id: state._authUser.id,
      subject: r.subject,
      date: new Date().toISOString().slice(0,10),
      topic: topic,
      pages: pages,
      keywords: keywordTexts,
      photos: photos,
      teacher_note: teacherNote,
      content: topic || r.summary,
      memo: JSON.stringify({
        period: r.period,
        isAcademy: true,
        academyName: r.academyName,
        className: r.className,
        startTime: r.startTime,
        endTime: r.endTime,
        assignmentText: assignText,
        assignmentDue: state._classAssignmentDue || ''
      })
    });
  }
  
  // 사진 초기화
  state._classPhotos = [];
  state._classAssignmentDue = '';
  
  // UI 전환 (기존과 동일한 애니메이션)
  const submitBtn = document.querySelector('.class-record-submit');
  const skipBtn = document.querySelector('.popup-skip-before');
  const questionAfter = document.querySelector('.popup-question-after');
  
  if (submitBtn) {
    submitBtn.innerHTML = '✅ 기록 완료! +10 XP';
    submitBtn.style.background = 'var(--success)';
    submitBtn.style.opacity = '1';
  }
  if (skipBtn) skipBtn.style.display = 'none';
  
  setTimeout(() => {
    if (submitBtn) submitBtn.style.display = 'none';
    if (questionAfter) questionAfter.style.display = 'block';
    
    // 기록 필드 숨기기
    document.querySelectorAll('.class-record-section').forEach(el => el.style.display = 'none');
  }, 1200);
  
  showXpPopup(10, '학원 수업 기록 완료! 📚');
}

// ==================== 수업 기록 공통 필드 ====================
function getDeadlineOptions() {
  const today = new Date();
  const dayNames = ['일','월','화','수','목','금','토'];
  
  function addDays(d, n) { const r = new Date(d); r.setDate(r.getDate() + n); return r; }
  function fmt(d) { return `${d.getMonth()+1}/${d.getDate()}(${dayNames[d.getDay()]})`; }
  function iso(d) { return d.toISOString().slice(0,10); }
  
  // 내일
  const tomorrow = addDays(today, 1);
  // 모레
  const dayAfter = addDays(today, 2);
  // 이번주 금요일
  const dayOfWeek = today.getDay(); // 0=Sun
  const daysToFri = dayOfWeek <= 5 ? (5 - dayOfWeek) : (5 + 7 - dayOfWeek);
  const thisFri = addDays(today, daysToFri || 7);
  // 다음주 월요일
  const daysToMon = dayOfWeek === 0 ? 1 : (8 - dayOfWeek);
  const nextMon = addDays(today, daysToMon);
  // 다음주 수요일
  const nextWed = addDays(nextMon, 2);
  
  return [
    { label: '내일', sub: fmt(tomorrow), value: iso(tomorrow) },
    { label: '모레', sub: fmt(dayAfter), value: iso(dayAfter) },
    { label: '이번주 금', sub: fmt(thisFri), value: iso(thisFri) },
    { label: '다음주 월', sub: fmt(nextMon), value: iso(nextMon) },
    { label: '다음주 수', sub: fmt(nextWed), value: iso(nextWed) },
  ];
}

function renderClassRecordFields(subject) {
  const photoCount = (state._classPhotos || []).length;
  const photoThumbs = (state._classPhotos || []).map((p, i) => `
    <div class="class-photo-thumb" style="position:relative;width:72px;height:72px;flex-shrink:0;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
      <img src="${p}" style="width:100%;height:100%;object-fit:cover" onclick="viewClassPhoto(${i})">
      <button onclick="removeClassPhoto(${i})" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">&times;</button>
    </div>
  `).join('');

  const deadlineOpts = getDeadlineOptions();
  const selectedDue = state._classAssignmentDue || '';
  const deadlineBtns = deadlineOpts.map(o => `
    <button type="button" class="deadline-btn ${selectedDue === o.value ? 'active' : ''}" data-due="${o.value}" onclick="selectDeadline(this)" style="flex:1;min-width:0;padding:8px 4px;border-radius:8px;border:1px solid ${selectedDue === o.value ? 'var(--primary-light)' : 'var(--border)'};background:${selectedDue === o.value ? 'rgba(108,92,231,0.15)' : 'var(--bg-input)'};color:${selectedDue === o.value ? 'var(--primary-light)' : 'var(--text-primary)'};font-size:11px;text-align:center;cursor:pointer;transition:all 0.2s;line-height:1.3">
      <div style="font-weight:600">${o.label}</div>
      <div style="font-size:10px;color:${selectedDue === o.value ? 'var(--primary-light)' : 'var(--text-muted)'}; margin-top:2px">${o.sub}</div>
    </button>
  `).join('');

  return `
    <div class="field-group">
      <label class="field-label">📖 단원/주제</label>
      <input class="input-field class-topic-input" placeholder="예: 3단원 세포 분열" oninput="validateClassRecordForm()">
    </div>

    <div class="field-group">
      <label class="field-label">📄 교과서 쪽수</label>
      <input class="input-field class-pages-input" placeholder="예: p.84~89">
    </div>

    <div class="field-group">
      <label class="field-label">📝 핵심 키워드 <span style="color:var(--accent)">*필수</span></label>
      <textarea class="input-field class-keyword-input" placeholder="예: 감수분열, 상동염색체, 2가 염색체" rows="2" oninput="validateClassRecordForm()"></textarea>
    </div>

    <div class="field-group">
      <label class="field-label">📸 필기 사진 <span style="color:var(--text-muted)">(선택)</span></label>
      <div class="class-photos-container" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:8px">
        ${photoThumbs}
        <label class="class-photo-add-btn" style="width:72px;height:72px;flex-shrink:0;border-radius:8px;border:2px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);font-size:11px;gap:2px;transition:border-color 0.2s">
          <i class="fas fa-plus" style="font-size:16px"></i>
          <span>${photoCount > 0 ? '추가' : '사진 추가'}</span>
          <input type="file" accept="image/*" multiple style="display:none" onchange="handleClassPhotoUpload(this)">
        </label>
      </div>
      <p style="font-size:11px;color:var(--text-muted);margin:0">노트/프린트를 촬영하세요 (여러 장 선택 가능)</p>
    </div>

    <div class="field-group">
      <label class="field-label">⭐ 선생님 강조 <span style="color:var(--text-muted)">(선택)</span></label>
      <input class="input-field class-teacher-note-input" placeholder='예: "서술형 나옴"'>
    </div>

    <div class="field-group assignment-section" style="background:var(--bg-input);border-radius:12px;padding:14px;border:1px solid var(--border)">
      <label class="field-label" style="margin-bottom:8px">📋 과제 <span style="color:var(--text-muted)">(있으면 적어줘!)</span></label>
      <input class="input-field class-assignment-input" placeholder="예: 워크북 p.30~32 풀어오기" oninput="toggleDeadlineSection()">
      
      <div class="deadline-section" style="display:${state._classAssignmentText ? 'block' : 'none'};margin-top:12px">
        <label class="field-label" style="margin-bottom:8px">📅 마감일</label>
        <div style="display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto">
          ${deadlineBtns}
          <button type="button" class="deadline-btn deadline-custom-btn" onclick="openCustomDeadline()" style="flex:0 0 auto;min-width:52px;padding:8px 8px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-muted);font-size:11px;text-align:center;cursor:pointer;transition:all 0.2s;line-height:1.3">
            <div>📅</div>
            <div style="font-size:10px;margin-top:2px">직접 선택</div>
          </button>
        </div>
        <input type="date" class="custom-date-picker" style="display:none;margin-top:8px;width:100%;padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--bg-input);color:var(--text-primary);font-size:13px" onchange="selectCustomDeadline(this)">
      </div>
    </div>
  `;
}

// 과제 입력 시 마감일 섹션 토글
function toggleDeadlineSection() {
  const input = document.querySelector('.class-assignment-input');
  const section = document.querySelector('.deadline-section');
  if (input && section) {
    const hasText = input.value.trim().length > 0;
    section.style.display = hasText ? 'block' : 'none';
    state._classAssignmentText = input.value.trim();
  }
}

// 마감일 버튼 선택
function selectDeadline(btn) {
  const due = btn.dataset.due;
  state._classAssignmentDue = due;
  
  // 모든 deadline 버튼 비활성화
  document.querySelectorAll('.deadline-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background = 'var(--bg-input)';
    b.style.color = 'var(--text-primary)';
    b.querySelectorAll('div').forEach(d => d.style.color = '');
  });
  
  // 선택된 버튼 활성화
  btn.style.borderColor = 'var(--primary-light)';
  btn.style.background = 'rgba(108,92,231,0.15)';
  btn.style.color = 'var(--primary-light)';
  btn.querySelectorAll('div').forEach(d => d.style.color = 'var(--primary-light)');
  
  // custom date picker 숨기기
  const picker = document.querySelector('.custom-date-picker');
  if (picker) picker.style.display = 'none';
}

// 직접 선택 → date picker 표시
function openCustomDeadline() {
  const picker = document.querySelector('.custom-date-picker');
  if (picker) {
    picker.style.display = 'block';
    // 최소 날짜를 내일로 설정
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    picker.min = tomorrow.toISOString().slice(0,10);
    picker.focus();
  }
}

// 직접 선택 날짜 적용
function selectCustomDeadline(input) {
  if (!input.value) return;
  state._classAssignmentDue = input.value;
  
  // 기존 버튼 비활성화
  document.querySelectorAll('.deadline-btn').forEach(b => {
    b.style.borderColor = 'var(--border)';
    b.style.background = 'var(--bg-input)';
    b.style.color = 'var(--text-primary)';
    b.querySelectorAll('div').forEach(d => d.style.color = '');
  });
  
  // 직접 선택 버튼 활성화
  const customBtn = document.querySelector('.deadline-custom-btn');
  if (customBtn) {
    customBtn.style.borderColor = 'var(--primary-light)';
    customBtn.style.background = 'rgba(108,92,231,0.15)';
    customBtn.style.color = 'var(--primary-light)';
    const d = new Date(input.value + 'T00:00:00');
    const dayNames = ['일','월','화','수','목','금','토'];
    customBtn.innerHTML = `<div style="font-weight:600;color:var(--primary-light)">${d.getMonth()+1}/${d.getDate()}</div><div style="font-size:10px;color:var(--primary-light);margin-top:2px">(${dayNames[d.getDay()]})</div>`;
  }
}

// 사진 업로드 핸들러 (다중)
function handleClassPhotoUpload(input) {
  if (!input.files || input.files.length === 0) return;
  if (!state._classPhotos) state._classPhotos = [];

  const maxPhotos = 20;
  const remaining = maxPhotos - state._classPhotos.length;
  if (remaining <= 0) {
    alert('사진은 최대 ' + maxPhotos + '장까지 첨부할 수 있습니다.');
    return;
  }

  const files = Array.from(input.files).slice(0, remaining);
  let loaded = 0;

  files.forEach(file => {
    const reader = new FileReader();
    reader.onload = (e) => {
      state._classPhotos.push(e.target.result);
      loaded++;
      if (loaded === files.length) {
        // 사진 영역만 갱신
        refreshClassPhotos();
      }
    };
    reader.readAsDataURL(file);
  });

  // input 리셋 (같은 파일 다시 선택 가능)
  input.value = '';
}

// 사진 삭제
function removeClassPhoto(idx) {
  if (!state._classPhotos) return;
  state._classPhotos.splice(idx, 1);
  refreshClassPhotos();
}

// 사진 확대 보기
function viewClassPhoto(idx) {
  if (!state._classPhotos || !state._classPhotos[idx]) return;
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:10000;display:flex;align-items:center;justify-content:center;cursor:pointer';
  overlay.innerHTML = '<img src="' + state._classPhotos[idx] + '" style="max-width:95%;max-height:95%;border-radius:8px;object-fit:contain">';
  overlay.onclick = () => overlay.remove();
  document.body.appendChild(overlay);
}

// 사진 영역 갱신 (전체 re-render 없이)
function refreshClassPhotos() {
  const containers = document.querySelectorAll('.class-photos-container');
  containers.forEach(container => {
    const photoCount = (state._classPhotos || []).length;
    const thumbs = (state._classPhotos || []).map((p, i) => `
      <div class="class-photo-thumb" style="position:relative;width:72px;height:72px;flex-shrink:0;border-radius:8px;overflow:hidden;border:1px solid var(--border)">
        <img src="${p}" style="width:100%;height:100%;object-fit:cover" onclick="viewClassPhoto(${i})">
        <button onclick="removeClassPhoto(${i})" style="position:absolute;top:2px;right:2px;width:20px;height:20px;border-radius:50%;background:rgba(0,0,0,0.6);color:#fff;border:none;font-size:11px;display:flex;align-items:center;justify-content:center;cursor:pointer">&times;</button>
      </div>
    `).join('');

    container.innerHTML = thumbs + `
      <label class="class-photo-add-btn" style="width:72px;height:72px;flex-shrink:0;border-radius:8px;border:2px dashed var(--border);display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;color:var(--text-muted);font-size:11px;gap:2px;transition:border-color 0.2s">
        <i class="fas fa-plus" style="font-size:16px"></i>
        <span>${photoCount > 0 ? '추가' : '사진 추가'}</span>
        <input type="file" accept="image/*" multiple style="display:none" onchange="handleClassPhotoUpload(this)">
      </label>
    `;
  });
}

// ==================== RECORD CLASS (R-01) ====================

function renderRecordClass() {
  const nextRecord = state.todayRecords.find(r => !r.done);
  const subject = nextRecord ? nextRecord.subject : '영어';
  const teacher = nextRecord ? nextRecord.teacher : '이정민';
  const period = nextRecord ? nextRecord.period : 3;
  const color = nextRecord ? nextRecord.color : '#00B894';

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>수업 기록</h1>
        <span class="header-badge">${period}교시 ${subject}</span>
      </div>

      <div class="form-body">
        <div class="subject-indicator">
          <span class="subject-dot" style="background:${color}"></span>
          <span>${subject} · ${teacher} 선생님</span>
          <span class="period-badge">${period}교시</span>
        </div>

        ${renderClassRecordFields(subject)}

        <button class="btn-primary class-record-submit" onclick="saveClassRecordFromForm()" disabled style="opacity:0.4;cursor:not-allowed">기록 완료 +10 XP ✨</button>

        <div class="fullscreen-question-after" style="display:none;text-align:center;padding:16px 0;margin-top:8px;border-top:1px solid var(--border)">
          <div style="font-size:24px;margin-bottom:8px">🎉</div>
          <p style="font-size:14px;font-weight:600;color:var(--success);margin:0 0 12px">수업 기록 완료!</p>
          <p style="font-size:14px;font-weight:600;margin:0 0 4px">💡 오늘 수업에서 궁금했던 것이 있나요?</p>
          <p style="font-size:12px;color:var(--text-muted);margin:0 0 12px;line-height:1.5">질문방에 남겨두면 나중에 스스로 직접 답해볼 수 있어요!</p>
          <button class="btn-secondary" style="width:100%;padding:12px;font-size:14px;border-color:rgba(108,92,231,0.4)" onclick="openMyQaIframe('/new')">✏️ 질문하기 +3 XP</button>
          <button class="btn-ghost" style="width:100%;margin-top:8px;font-size:13px" onclick="goScreen('main')">다음에 할게요</button>
        </div>
        <p class="input-timer">⏱️ 입력 시간: 22초</p>
      </div>
    </div>
  `;
}

// ==================== RECORD QUESTION (R-02) ====================

// 질문 기록을 DB에 저장
function saveQuestionToDB(saveType) {
  if (!DB.studentId()) return;
  const subj = state._questionSubject || state._activeSubject || '수학';
  const questionText = state._questionText || '';
  const diagResult = state._diagResult || {};
  const challengeResult = state._challengeResult || {};
  const coachMessages = state._coachMessages || [];
  
  const level = challengeResult.level || diagResult.level || '';
  const label = challengeResult.levelName || diagResult.levelName || '';
  const axis = diagResult.axis || 'curiosity';
  const xp = saveType === 'coaching-complete' ? 30 : (challengeResult.xp || diagResult.xp || 15);
  
  DB.saveQuestionRecord({
    subject: subj,
    questionText: questionText,
    questionLevel: level,
    questionLabel: label,
    axis: axis,
    coachingMessages: coachMessages,
    xpEarned: xp,
    isComplete: saveType === 'coaching-complete',
  });
}

// 수업기록 폼에서 실제 입력값을 DB에 저장
function saveClassRecordFromForm() {
  // 유효성 검사
  if (!validateClassRecordForm()) {
    const keywordInput = document.querySelector('.class-keyword-input');
    if (keywordInput) {
      keywordInput.focus();
      keywordInput.style.borderColor = 'var(--accent)';
      keywordInput.setAttribute('placeholder', '핵심 키워드를 입력해야 기록을 완료할 수 있어요!');
      setTimeout(() => { keywordInput.style.borderColor = ''; }, 2000);
    }
    return;
  }
  
  const nextRecord = state.todayRecords.find(r => !r.done);
  const subject = nextRecord ? nextRecord.subject : '영어';
  const period = nextRecord ? nextRecord.period : 3;
  
  // 새 폼 필드 수집
  const topicInput = document.querySelector('.class-topic-input');
  const topic = topicInput ? topicInput.value.trim() : '';
  
  const pagesInput = document.querySelector('.class-pages-input');
  const pages = pagesInput ? pagesInput.value.trim() : '';
  
  const keywordInput = document.querySelector('.class-keyword-input');
  const keywordText = keywordInput ? keywordInput.value.trim() : '';
  const keywordTexts = [];
  if (keywordText) {
    keywordText.split(/[,，、\n]+/).forEach(k => { const t = k.trim(); if (t) keywordTexts.push(t); });
  }
  
  const photos = state._classPhotos || [];
  
  const teacherNoteInput = document.querySelector('.class-teacher-note-input');
  const teacherNote = teacherNoteInput ? teacherNoteInput.value.trim() : '';
  
  // todayRecords 업데이트
  if (nextRecord) {
    nextRecord.done = true;
    nextRecord.summary = topic || keywordTexts.join(', ') || '수업 기록 완료';
    nextRecord._topic = topic;
    nextRecord._pages = pages;
    nextRecord._keywords = keywordTexts;
    nextRecord._photos = photos;
    nextRecord._teacherNote = teacherNote;
    
    // 과제 데이터를 레코드에 저장 (수정 화면에서 다시 볼 수 있도록)
    const assignInput = document.querySelector('.class-assignment-input');
    const assignText = assignInput ? assignInput.value.trim() : '';
    nextRecord._assignmentText = assignText;
    nextRecord._assignmentDue = state._classAssignmentDue || '';
    
    state.missions[0].current = state.todayRecords.filter(r => r.done).length;
    if (state.missions[0].current >= state.missions[0].target) state.missions[0].done = true;
  }
  
  // DB 저장
  if (DB.studentId()) {
    DB.saveClassRecord({
      subject: subject,
      date: new Date().toISOString().slice(0,10),
      content: topic,
      keywords: keywordTexts.length > 0 ? keywordTexts : [],
      understanding: 3,
      memo: JSON.stringify({ period: period, pages: pages, teacherNote: teacherNote, photoCount: photos.length }),
      topic: topic,
      pages: pages,
      photos: photos,
      teacher_note: teacherNote,
    });
  }
  
  // 과제가 있으면 플래너에 자동 등록
  registerAssignmentFromClassRecord(subject, period);
  if (nextRecord) {
    const aInput = document.querySelector('.class-assignment-input');
    nextRecord._assignmentRegistered = !!(aInput && aInput.value.trim());
  }
  
  // 사진 상태 리셋
  state._classPhotos = [];
  
  // 1차 XP 지급
  showXpPopup(10, '수업 기록 완료!', { stayOnScreen: true });
  
  // 기록 완료 → UI 전환: 입력 필드 비활성화, 기록 버튼 숨기고 질문 섹션 표시
  showPostRecordQuestion();
}

// 수업 기록에서 과제 자동 등록
function registerAssignmentFromClassRecord(subject, period) {
  const assignInput = document.querySelector('.class-assignment-input');
  const assignText = assignInput ? assignInput.value.trim() : '';
  if (!assignText) {
    state._classAssignmentText = '';
    state._classAssignmentDue = '';
    return;
  }
  
  const dueDate = state._classAssignmentDue || new Date(Date.now() + 7*24*60*60*1000).toISOString().slice(0,10); // 기본 1주 후
  
  const subjectColors = {
    '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
    '사회':'#74B9FF','한국사':'#E056A0','제2외국어':'#A29BFE','기술가정':'#FF9F43',
    '음악':'#fd79a8','미술':'#00cec9','체육':'#e17055','정보':'#0984e3',
  };
  
  // 플래너 state에 추가
  const newAssignment = {
    id: 'auto-' + Date.now(),
    subject: subject,
    title: assignText,
    desc: `${period}교시 수업 중 등록`,
    type: '과제',
    teacher: '',
    dueDate: dueDate,
    createdDate: new Date().toISOString().split('T')[0],
    color: subjectColors[subject] || '#636e72',
    status: 'pending',
    progress: 0,
    plan: []
  };
  
  if (!state.assignments) state.assignments = [];
  state.assignments.push(newAssignment);
  
  // DB 저장 (비동기)
  if (DB.studentId()) {
    DB.saveAssignment({
      subject: subject,
      title: assignText,
      description: `${period}교시 수업 중 등록`,
      teacherName: '',
      dueDate: dueDate,
      color: subjectColors[subject] || '#636e72',
      planData: [],
    }).then(dbId => {
      if (dbId) {
        newAssignment._dbId = dbId;
        newAssignment.id = String(dbId);
      }
    });
  }
  
  // 플래너 일간 뷰에도 마감일 항목 추가
  addAssignmentToPlannerItems(newAssignment);
  
  // 과제 상태 리셋
  state._classAssignmentText = '';
  state._classAssignmentDue = '';
}

// 과제를 플래너 일간 타임라인에 등록하는 헬퍼
function addAssignmentToPlannerItems(assignment) {
  if (!assignment || !assignment.dueDate) return;
  
  // 이미 같은 과제가 등록되어 있으면 중복 방지
  const exists = state.plannerItems.find(p => 
    p.category === 'assignment' && p.title === '[과제] ' + assignment.title && p.date === assignment.dueDate
  );
  if (exists) return;
  
  state.plannerItems.push({
    id: 'passign-' + Date.now(),
    date: assignment.dueDate,
    time: '23:00',
    endTime: '23:59',
    title: '[과제] ' + assignment.title,
    category: 'assignment',
    color: assignment.color || '#636e72',
    icon: '📋',
    done: false,
    aiGenerated: false,
    detail: assignment.subject + ' · ' + (assignment.desc || '과제 제출')
  });
}

function showPostRecordQuestion() {
  // 기록 완료 버튼 숨기기
  document.querySelectorAll('.class-record-submit').forEach(btn => {
    btn.style.display = 'none';
  });
  
  // "나중에 할게요" 버튼 숨기기 (기록 전용)
  document.querySelectorAll('.popup-skip-before').forEach(btn => {
    btn.style.display = 'none';
  });
  
  // 입력 필드 비활성화 (수정 불가)
  document.querySelectorAll('.class-topic-input, .class-pages-input, .class-keyword-input, .class-teacher-note-input, .class-assignment-input').forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.6';
  });
  
  // 마감일 버튼 비활성화
  document.querySelectorAll('.deadline-btn, .deadline-custom-btn').forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.6';
    el.style.pointerEvents = 'none';
  });
  
  // 사진 추가 버튼 숨기기
  document.querySelectorAll('.class-photo-add-btn').forEach(el => {
    el.style.display = 'none';
  });
  
  // 사진 삭제 버튼 숨기기
  document.querySelectorAll('.class-photo-thumb button').forEach(el => {
    el.style.display = 'none';
  });
  
  // 질문하기 섹션 표시 (팝업 또는 전체화면)
  document.querySelectorAll('.popup-question-after, .fullscreen-question-after').forEach(el => {
    el.style.display = 'block';
  });
  
  // 질문 섹션으로 스크롤
  setTimeout(() => {
    const questionSection = document.querySelector('.popup-question-after') || document.querySelector('.fullscreen-question-after');
    if (questionSection) questionSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
}

function renderRecordQuestion() {
  // 2축 9단계 질문 코칭 시스템 v2.0
  const questionLevels = {
    curiosity: [
      { id:'A-1', label:'뭐지?', name:'사실·정의 확인', xp:8, desc:'정해진 공식·정의를 확인하는 질문', icon:'👀', group:'A' },
      { id:'A-2', label:'어떻게?', name:'절차·방법 확인', xp:10, desc:'풀이 방법이나 순서를 묻는 질문', icon:'🔧', group:'A' },
      { id:'B-1', label:'왜?', name:'이유·원리 탐구', xp:15, desc:'개념의 의미와 원리를 깊이 이해하려는 질문', icon:'💡', group:'B' },
      { id:'B-2', label:'만약에?', name:'가능성 탐색', xp:20, desc:'조건을 변경하고 결과를 예측하는 전략적 사고', icon:'🔀', group:'B' },
      { id:'C-1', label:'뭐가 더 나아?', name:'비교·판단', xp:25, desc:'서로 다른 방법을 비교하고 자기 판단 제시', icon:'⚖️', group:'C' },
      { id:'C-2', label:'그러면?', name:'확장·창조', xp:30, desc:'배운 것을 새로운 상황에 적용/확장', icon:'🚀', group:'C' },
    ],
    reflection: [
      { id:'R-1', label:'어디서 틀렸지?', name:'오류 위치 발견', xp:15, desc:'틀린 지점을 특정하는 질문', icon:'🔍' },
      { id:'R-2', label:'왜 틀렸지?', name:'오류 원인 분석', xp:20, desc:'개념부족·실수·해석오류 등 원인 분석', icon:'🧪' },
      { id:'R-3', label:'다음엔 어떻게?', name:'재발 방지 전략', xp:25, desc:'구체적 다음 행동 전략 수립', icon:'🎯' },
    ]
  };

  const coachingMode = state._coachingMode || 'diagnosis'; // 'diagnosis' | 'challenge' | 'socrates'
  const diagResult = state._diagResult || null;
  const socratesStep = state._socratesStep || 0;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state._coachingMode=null;state._diagResult=null;state._socratesStep=0;state._questionText='';state._questionImages=null;state._imageAnalysis=null;goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>질문 코칭</h1>
        <span class="header-badge">🧠 2축 9단계</span>
      </div>

      <div class="form-body">
        <!-- 시스템 소개 배너 -->
        <div class="coaching-banner animate-in">
          <div class="coaching-banner-icon">🧠</div>
          <div class="coaching-banner-text">
            <strong>2축 9단계 질문 코칭 시스템</strong>
            <p>"답이 아니라 사고의 심연으로" — 궁금함을 만드는 소크라테스 코칭</p>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📚 과목</label>
          <div class="chip-row" id="question-subject-chips">
            ${['국어','수학','영어','과학','한국사'].map((s) => `<button class="chip ${state._questionSubject===s?'active':''}" data-qsubject="${s}">${s}</button>`).join('')}
          </div>
        </div>

        <!-- 질문 유형 선택: 호기심 vs 성찰 + 정율질문방 -->
        <div class="field-group">
          <div class="field-label-row">
            <label class="field-label" style="margin-bottom:0">📋 질문 유형</label>
            <button class="btn-jyqr" onclick="openJeongyulQA()">
              <span class="jyqr-pulse"></span>
              <i class="fas fa-external-link-alt"></i>
              정율질문방 가기
            </button>
          </div>
          <div class="axis-selector">
            <button class="axis-btn ${!state._questionAxis || state._questionAxis==='curiosity'?'active':''}" onclick="state._questionAxis='curiosity';renderScreen()">
              <span class="axis-icon">🪜</span>
              <span>축1: 호기심 사다리</span>
              <small>문제를 향한 질문</small>
            </button>
            <button class="axis-btn ${state._questionAxis==='reflection'?'active':''}" onclick="state._questionAxis='reflection';renderScreen()">
              <span class="axis-icon">🪞</span>
              <span>축2: 성찰 질문</span>
              <small>내 풀이를 향한 질문</small>
            </button>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">❓ 질문 내용</label>
          <div class="question-input-wrap">
            <textarea class="input-field" rows="3" id="question-input" placeholder="${state._questionAxis==='reflection' ? '내가 어디서 틀렸는지, 왜 틀렸는지 생각을 적어주세요' : '수업 중 궁금한 점을 적어주세요. 자기 생각도 함께!'}">${state._questionText || ''}</textarea>
            
            <!-- 이미지 첨부 미리보기 -->
            ${state._questionImages && state._questionImages.length > 0 ? `
            <div class="q-image-preview-row">
              ${state._questionImages.map((img, idx) => `
                <div class="q-image-preview-item">
                  <img src="${img}" alt="첨부 이미지 ${idx+1}">
                  <button class="q-image-remove" onclick="state._questionImages.splice(${idx},1);renderScreen()">
                    <i class="fas fa-times"></i>
                  </button>
                </div>
              `).join('')}
            </div>
            ` : ''}

            <!-- 이미지 첨부 버튼 바 -->
            <div class="q-attach-bar">
              <button class="q-attach-btn" onclick="document.getElementById('q-image-upload').click()">
                <i class="fas fa-image"></i>
                <span>사진 첨부</span>
              </button>
              <button class="q-attach-btn" onclick="document.getElementById('q-camera-capture').click()">
                <i class="fas fa-camera"></i>
                <span>촬영</span>
              </button>
              <span class="q-attach-hint">문제지, 풀이 과정 등을 찍어 올려보세요</span>
            </div>
            <input type="file" id="q-image-upload" accept="image/*" multiple style="display:none" onchange="handleQuestionImageUpload(this)">
            <input type="file" id="q-camera-capture" accept="image/*" capture="environment" style="display:none" onchange="handleQuestionImageUpload(this)">
          </div>
          <div class="input-hint">💡 <strong>B단계 이상</strong> 판정 조건: ① 구체적 대상 ② 자기 생각 ③ 맥락 연결</div>
        </div>

        <button class="btn-primary" style="margin-bottom:16px" onclick="analyzeQuestion()">
          <i class="fas fa-robot"></i> 정율 질문 분석하기
        </button>

        <!-- 로딩 상태 -->
        ${coachingMode === 'loading' ? `
        <div class="ai-diagnosis-card animate-in" style="text-align:center;padding:32px 16px">
          <div class="loading-spinner-wrap">
            <div class="diag-loading-spinner"></div>
          </div>
          <p style="margin-top:12px;font-weight:600;color:var(--text-secondary)">🧠 정율이 질문을 분석하고 있어요...</p>
          <p style="font-size:10px;color:var(--text-muted);margin-top:4px">${state._questionImages && state._questionImages.length > 0 ? '📷 이미지 분석 → 질문 분석 2단계 진행 중' : '2축 9단계 기준으로 꼼꼼히 확인 중'}</p>
        </div>
        ` : ''}

        <!-- 이미지 분석 결과 (있을 경우) -->
        ${state._imageAnalysis && coachingMode === 'result' ? `
        <div class="ai-diagnosis-card animate-in" style="margin-bottom:10px;border-left:3px solid #FDCB6E">
          <div class="ai-header">
            <span class="ai-icon">📷</span>
            <span class="ai-title">이미지 분석 결과</span>
            <span style="margin-left:auto;font-size:9px;background:var(--bg-input);padding:2px 8px;border-radius:8px">정율</span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:8px">
            <div style="background:var(--bg-input);padding:6px 8px;border-radius:8px">
              <div style="font-size:8px;color:var(--text-muted)">선택 과목</div>
              <div style="font-size:11px;font-weight:700">${state._selectedSubject || '미지정'}</div>
            </div>
            <div style="background:var(--bg-input);padding:6px 8px;border-radius:8px">
              <div style="font-size:8px;color:var(--text-muted)">정율 인식 단원</div>
              <div style="font-size:11px;font-weight:700">${state._imageAnalysis.topic || '미지정'}</div>
            </div>
          </div>
          ${state._imageAnalysis.extractedText ? `<div style="margin-top:8px;font-size:10px;color:var(--text-secondary);background:var(--bg-input);padding:8px;border-radius:8px;line-height:1.5"><strong>📝 인식 내용:</strong> ${state._imageAnalysis.extractedText}</div>` : ''}
          ${state._imageAnalysis.handwritingCheck ? `<div style="margin-top:6px;font-size:10px;color:var(--text-secondary);background:var(--bg-input);padding:8px;border-radius:8px"><strong>✏️ 필기 확인:</strong> ${state._imageAnalysis.handwritingCheck}</div>` : ''}
          ${state._imageAnalysis.analysis ? `<div style="margin-top:6px;font-size:10px;color:var(--text-secondary);background:var(--bg-input);padding:8px;border-radius:8px;line-height:1.5"><strong>🔍 분석:</strong> ${state._imageAnalysis.analysis}</div>` : ''}
        </div>
        ` : ''}

        <!-- 정율 진단 결과 카드 (동적) -->
        ${coachingMode === 'result' && diagResult ? `
        <div class="ai-diagnosis-card animate-in">
          <div class="ai-header">
            <span class="ai-icon">📊</span>
            <span class="ai-title">질문 분석 결과</span>
            <span style="margin-left:auto;font-size:9px;background:var(--bg-input);padding:2px 8px;border-radius:8px">${diagResult.axis === 'reflection' ? '축2 성찰' : '축1 호기심'}</span>
          </div>
          <div class="diag-question-echo">
            <span class="diag-q-label">네 질문:</span>
            <span class="diag-q-text">"${(document.getElementById('question-input')?.value || '').replace(/"/g, '&quot;').substring(0,200)}"</span>
          </div>

          ${diagResult.error ? `
          <div style="background:#FFF3F3;padding:12px;border-radius:10px;margin-top:8px;border:1px solid #FFD0D0">
            <p style="font-size:11px;color:#E74C3C;font-weight:600">⚠️ 분석 중 오류가 발생했습니다</p>
            <p style="font-size:10px;color:var(--text-muted);margin-top:4px">${diagResult.error}</p>
            <button class="btn-ghost" style="margin-top:8px" onclick="analyzeQuestion()">
              <i class="fas fa-redo"></i> 다시 시도
            </button>
          </div>
          ` : `
          <!-- 3대 필수조건 체크리스트 -->
          ${diagResult.checks ? `
          <div class="diag-checklist">
            <div class="diag-check-item ${diagResult.checks.specificTarget?.pass ? 'pass' : 'fail'}">
              <span class="diag-check-icon">${diagResult.checks.specificTarget?.pass ? '✅' : '❌'}</span>
              <span class="diag-check-label">구체적 대상</span>
              <span class="diag-check-detail">${diagResult.checks.specificTarget?.detail || '확인 불가'}</span>
            </div>
            <div class="diag-check-item ${diagResult.checks.ownThought?.pass ? 'pass' : 'fail'}">
              <span class="diag-check-icon">${diagResult.checks.ownThought?.pass ? '✅' : '❌'}</span>
              <span class="diag-check-label">자기 생각</span>
              <span class="diag-check-detail">${diagResult.checks.ownThought?.detail || '확인 불가'}</span>
            </div>
            <div class="diag-check-item ${diagResult.checks.contextLink?.pass ? 'pass' : 'fail'}">
              <span class="diag-check-icon">${diagResult.checks.contextLink?.pass ? '✅' : '❌'}</span>
              <span class="diag-check-label">맥락 연결</span>
              <span class="diag-check-detail">${diagResult.checks.contextLink?.detail || '확인 불가'}</span>
            </div>
          </div>
          ` : ''}

          <!-- 진단 결과 -->
          <div class="diag-result">
            <span class="diag-arrow">→</span>
            <span class="q-level q-level-${(diagResult.level||'A-1').charAt(0).toLowerCase()}">${diagResult.level || '?'}</span>
            <span class="diag-result-name">"${diagResult.levelName || ''}" ${diagResult.levelDesc || ''} 단계!</span>
            <span class="diag-xp">XP +${diagResult.xp || 0}</span>
          </div>

          <!-- 정율 피드백 -->
          ${diagResult.feedback ? `
          <div style="background:var(--bg-input);padding:10px 12px;border-radius:10px;margin-top:8px;font-size:11px;line-height:1.6;color:var(--text-secondary)">
            💬 ${diagResult.feedback}
          </div>
          ` : ''}

          <!-- 다음 단계 힌트 -->
          ${diagResult.nextHint ? `
          <div class="diag-hint">
            <span class="diag-hint-icon">💡</span>
            <div class="diag-hint-text">
              <strong>다음 단계 목표:</strong> ${diagResult.nextHint.hint || ''}
              → <span class="q-level q-level-${(diagResult.nextHint.targetLevel||'').charAt(0).toLowerCase()}">${diagResult.nextHint.targetLevel} "${diagResult.nextHint.targetName}"</span>
            </div>
          </div>
          ` : ''}

          <!-- 도전 / 확정 버튼 -->
          <div class="diag-actions">
            ${diagResult.nextHint ? `
            <button class="btn-challenge" onclick="startChallenge()">
              <i class="fas fa-fire"></i> ${diagResult.nextHint.targetLevel} 도전! 🔥
            </button>
            ` : ''}
            <button class="btn-ghost" onclick="saveQuestionToDB('diag');showXpPopup(${diagResult.xp || 0}, '${diagResult.level || ''} ${diagResult.levelName || ''} 완료!')">
              괜찮아요 ✓
            </button>
          </div>
          `}
        </div>
        ` : ''}

        <!-- 도전 모드 -->
        ${coachingMode === 'challenge' ? `
        <div class="challenge-mode animate-in">
          <div class="challenge-header">
            <span>🔥</span>
            <h3>더 좋은 질문 도전!</h3>
            <p>${diagResult?.nextHint ? `${diagResult.nextHint.targetLevel} "${diagResult.nextHint.targetName}" 단계를 목표로 질문을 다시 만들어보세요` : '한 단계 높은 질문을 만들어보세요'}</p>
          </div>
          <textarea class="input-field" rows="3" id="challenge-input" placeholder="${diagResult?.nextHint?.hint || '더 깊은 사고가 담긴 질문을 작성해보세요!'}"></textarea>
          
          ${state._challengeLoading ? `
          <div style="text-align:center;padding:16px">
            <div class="diag-loading-spinner"></div>
            <p style="font-size:10px;color:var(--text-muted);margin-top:8px">도전 질문 분석 중...</p>
          </div>
          ` : ''}

          ${state._challengeResult ? `
          <div class="challenge-result animate-in" style="margin-top:8px">
            <span class="diag-arrow">→</span>
            <span class="q-level q-level-${(state._challengeResult.level||'A-1').charAt(0).toLowerCase()}" style="font-size:14px">${state._challengeResult.level}</span>
            <span>"${state._challengeResult.levelName}" ${state._challengeResult.levelDesc || ''}</span>
            <span class="diag-xp">XP +${state._challengeResult.xp || 0}${state._challengeResult.xp > (diagResult?.xp||0) ? ' (↑+5 보너스)' : ''}</span>
          </div>
          ${state._challengeResult.feedback ? `<div style="background:var(--bg-input);padding:8px 12px;border-radius:8px;margin-top:6px;font-size:10px;color:var(--text-secondary);line-height:1.5">💬 ${state._challengeResult.feedback}</div>` : ''}
          <div class="diag-actions" style="margin-top:8px">
            <button class="btn-primary" onclick="saveQuestionToDB('challenge');showXpPopup(${(state._challengeResult.xp||0) + (state._challengeResult.xp > (diagResult?.xp||0) ? 5 : 0)}, '${state._challengeResult.level} 도전 ${state._challengeResult.xp > (diagResult?.xp||0) ? '성공! +5 성장보너스 포함' : '완료!'}')">도전 완료! +${(state._challengeResult.xp||0) + (state._challengeResult.xp > (diagResult?.xp||0) ? 5 : 0)} XP ${state._challengeResult.xp > (diagResult?.xp||0) ? '🎉' : '✓'}</button>
          </div>
          ` : `
          ${!state._challengeLoading ? `
          <div class="diag-actions" style="margin-top:8px">
            <button class="btn-primary" onclick="submitChallenge()">
              <i class="fas fa-paper-plane"></i> 도전 질문 제출!
            </button>
            <button class="btn-ghost" onclick="state._coachingMode='result';state._challengeResult=null;renderScreen()">돌아가기</button>
          </div>
          ` : ''}
          `}
        </div>
        ` : ''}

        <!-- 선생님과 함께하기 모드 -->
        ${coachingMode === 'result' || coachingMode === 'diagnosis' ? `
        <div class="socrates-entry animate-in" style="margin-top:12px">
          <button class="btn-socrates" onclick="startSocrates()">
            <span class="socrates-icon">👨‍🏫</span>
            <div class="socrates-text">
              <strong>선생님과 함께하기</strong>
              <small>정율이 소크라테스식 질문으로 사고를 확장해줘요</small>
            </div>
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>
        ` : ''}

        ${coachingMode === 'socrates' ? `
        <div class="socrates-mode animate-in">
          <div class="socrates-header">
            <span>👨‍🏫</span>
            <h3>선생님과 함께하기</h3>
            <p>정율 코치가 질문으로 사고를 이끌어줄게요</p>
          </div>
          <div class="socrates-chat" id="socrates-chat-area">
            ${(state._socratesMessages || []).filter(m => !m._hidden).map(m => {
              if (m.role === 'user') {
                return `<div class="socrates-msg student"><div class="socrates-bubble student-bubble"><p>${m.content}</p></div></div>`;
              } else {
                let parsed;
                try { parsed = typeof m.content === 'string' ? JSON.parse(m.content) : m.content; } catch { parsed = { message: m.content }; }
                return `<div class="socrates-msg ai">
                  <div class="socrates-avatar">${parsed.emoji || '🤖'}</div>
                  <div class="socrates-bubble">
                    <div class="socrates-msg-content">${parsed.message || m.content}</div>
                    ${parsed.questionLevel ? `<span class="socrates-stage-tag">이 질문은 ${parsed.questionLevel} "${parsed.questionLabel || ''}" 단계예요</span>` : ''}
                    ${parsed.encouragement ? `<div style="margin-top:6px;font-size:10px;color:var(--primary);font-weight:600">${parsed.encouragement}</div>` : ''}
                  </div>
                </div>`;
              }
            }).join('')}
            ${state._socratesLoading ? `
            <div class="socrates-msg ai">
              <div class="socrates-avatar">🤖</div>
              <div class="socrates-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>
            </div>
            ` : ''}
          </div>
          ${state._socratesComplete ? `
          <div class="socrates-complete animate-in">
            <div class="socrates-complete-icon">🎉</div>
            <p><strong>대화 완료!</strong> 사고가 확장됐어요!</p>
            <p class="socrates-xp">🏆 소크라테스 코칭 완료 +30 XP</p>
            <button class="btn-primary" onclick="saveQuestionToDB('coaching-complete');showXpPopup(30, '소크라테스 코칭 완료!')">
              완료! +30 XP 🏆
            </button>
          </div>
          ` : `
          <div class="socrates-input-row">
            <input class="input-field" style="flex:1" id="socrates-input" placeholder="생각을 적어주세요..." onkeydown="if(event.key==='Enter'){sendSocratesMessage()}">
            <button class="btn-primary" style="padding:10px 16px" onclick="sendSocratesMessage()">
              <i class="fas fa-paper-plane"></i>
            </button>
          </div>
          `}
          <button class="btn-ghost" style="margin-top:8px;width:100%" onclick="state._coachingMode='result';state._socratesMessages=null;state._socratesComplete=false;renderScreen()">
            <i class="fas fa-arrow-left"></i> 분석 결과로 돌아가기
          </button>
        </div>
        ` : ''}

        <!-- 2축 9단계 분류표 (접이식) -->
        <details class="classification-details" style="margin-top:16px">
          <summary class="classification-summary">
            <i class="fas fa-list"></i> 2축 9단계 분류표 보기
          </summary>
          <div class="classification-table">
            <div class="ct-section">
              <div class="ct-section-title">
                <span>🪜 축1: 호기심 사다리</span>
                <small>보기(See) → 파기(Dig) → 넓히기(Expand)</small>
              </div>
              <div class="ct-group-header ct-group-a">A단계 · 보기(See)</div>
              ${questionLevels.curiosity.filter(q=>q.group==='A').map(q => `
              <div class="ct-row">
                <span class="ct-id">${q.id}</span>
                <span class="ct-label">${q.icon} "${q.label}"</span>
                <span class="ct-name">${q.name}</span>
                <span class="ct-xp">${q.xp}XP</span>
              </div>`).join('')}
              <div class="ct-group-header ct-group-b">B단계 · 파기(Dig) — 3대 필수조건 필요</div>
              ${questionLevels.curiosity.filter(q=>q.group==='B').map(q => `
              <div class="ct-row">
                <span class="ct-id">${q.id}</span>
                <span class="ct-label">${q.icon} "${q.label}"</span>
                <span class="ct-name">${q.name}</span>
                <span class="ct-xp">${q.xp}XP</span>
              </div>`).join('')}
              <div class="ct-group-header ct-group-c">C단계 · 넓히기(Expand)</div>
              ${questionLevels.curiosity.filter(q=>q.group==='C').map(q => `
              <div class="ct-row">
                <span class="ct-id">${q.id}</span>
                <span class="ct-label">${q.icon} "${q.label}"</span>
                <span class="ct-name">${q.name}</span>
                <span class="ct-xp">${q.xp}XP</span>
              </div>`).join('')}
            </div>
            <div class="ct-section" style="margin-top:12px">
              <div class="ct-section-title">
                <span>🪞 축2: 성찰 질문</span>
                <small>내 풀이를 돌아보는 질문</small>
              </div>
              ${questionLevels.reflection.map(q => `
              <div class="ct-row">
                <span class="ct-id">${q.id}</span>
                <span class="ct-label">${q.icon} "${q.label}"</span>
                <span class="ct-name">${q.name}</span>
                <span class="ct-xp">${q.xp}XP</span>
              </div>`).join('')}
            </div>
            <div class="ct-note">
              <strong>⚠️ B단계 이상 필수조건:</strong> ① 구체적 대상 지목 ② "나는 ~라고 생각한다" 자기 생각 ③ 맥락(지문·조건)과 연결
            </div>
          </div>
        </details>

        ${coachingMode !== 'challenge' && coachingMode !== 'socrates' && !diagResult ? `
        <button class="btn-primary" style="margin-top:12px" onclick="saveQuestionToDB('basic');showXpPopup(15, '질문 기록 완료!')">완료 +15 XP ✨</button>
        ` : ''}
      </div>
    </div>
  `;
}

function analyzeQuestion() {
  const questionInput = document.getElementById('question-input');
  const questionText = questionInput ? questionInput.value.trim() : '';
  if (!questionText) { alert('질문 내용을 입력해주세요!'); return; }
  
  const subject = state._questionSubject || '미지정';
  const axis = state._questionAxis || 'curiosity';
  
  // 이미지가 있으면 먼저 이미지 분석
  if (state._questionImages && state._questionImages.length > 0) {
    analyzeWithImage(questionText, subject, axis);
    return;
  }
  
  state._diagLoading = true;
  state._diagResult = null;
  state._coachingMode = 'loading';
  state._selectedSubject = subject; // 사용자 선택 과목 저장
  renderScreen();
  
  fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: questionText, subject, axis })
  })
  .then(r => r.json())
  .then(result => {
    if (result.error) {
      state._diagLoading = false;
      state._coachingMode = 'diagnosis';
      alert('정율 분석 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      renderScreen();
      return;
    }
    state._diagResult = result;
    state._diagLoading = false;
    state._coachingMode = 'result';
    renderScreen();
  })
  .catch(err => {
    state._diagLoading = false;
    state._coachingMode = 'diagnosis';
    alert('정율 분석 중 오류가 발생했습니다. 네트워크를 확인해주세요.');
    renderScreen();
  });
}

function analyzeWithImage(questionText, subject, axis) {
  state._diagLoading = true;
  state._coachingMode = 'loading';
  state._selectedSubject = subject; // 사용자 선택 과목 저장
  renderScreen();
  
  const firstImage = state._questionImages[0];
  const mimeMatch = firstImage.match(/^data:(image\/\w+);base64,/);
  const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  
  // Step 1: Gemini 이미지 분석
  fetch('/api/image-analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageBase64: firstImage, mimeType, subject })
  })
  .then(r => r.json())
  .then(imageResult => {
    state._imageAnalysis = imageResult;
    // Step 2: 이미지 분석 결과 + 질문을 함께 OpenAI에 전달
    const enrichedQuestion = questionText + 
      (imageResult.extractedText ? `\n\n[이미지 분석 내용: ${imageResult.extractedText}]` : '') +
      (imageResult.analysis ? `\n[이미지 문제 분석: ${imageResult.analysis}]` : '');
    
    // 사용자가 선택한 과목을 항상 우선 사용 (이미지 분석 결과로 덮어쓰지 않음)
    return fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: enrichedQuestion, subject: subject, axis })
    });
  })
  .then(r => r.json())
  .then(result => {
    if (result.error) {
      state._diagLoading = false;
      state._coachingMode = 'diagnosis';
      alert('정율 분석 중 일시적 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
      renderScreen();
      return;
    }
    state._diagResult = result;
    state._diagLoading = false;
    state._coachingMode = 'result';
    renderScreen();
  })
  .catch(err => {
    state._diagLoading = false;
    state._coachingMode = 'diagnosis';
    alert('정율 분석 중 오류가 발생했습니다. 네트워크를 확인해주세요.');
    renderScreen();
  });
}

function sendSocratesMessage() {
  const input = document.getElementById('socrates-input');
  const text = input ? input.value.trim() : '';
  if (!text) return;
  
  if (!state._socratesMessages) state._socratesMessages = [];
  state._socratesMessages.push({ role: 'user', content: text });
  state._socratesLoading = true;
  renderScreen();
  
  const subject = state._questionSubject || '미지정';
  
  // API에 보낼 때 _hidden 메시지도 포함 (대화 맥락 유지)
  const apiMessages = state._socratesMessages.map(m => ({ role: m.role, content: m.content }));
  
  fetch('/api/coaching', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: apiMessages,
      subject,
      currentLevel: state._diagResult ? state._diagResult.level : 'A-2'
    })
  })
  .then(r => r.json())
  .then(result => {
    state._socratesMessages.push({ role: 'assistant', content: JSON.stringify(result) });
    state._socratesLoading = false;
    if (result.isComplete) state._socratesComplete = true;
    renderScreen();
    setTimeout(() => {
      const chat = document.getElementById('socrates-chat-area');
      if (chat) {
        chat.scrollTop = chat.scrollHeight;
        // AI가 생성한 HTML 내 버튼에 이벤트 바인딩
        bindAiGeneratedButtons(chat);
      }
    }, 100);
  })
  .catch(err => {
    state._socratesLoading = false;
    alert('코칭 정율 오류: ' + err.message);
    renderScreen();
  });
}

function handleQuestionImageUpload(input) {
  if (!input.files || input.files.length === 0) return;
  if (!state._questionImages) state._questionImages = [];
  
  Array.from(input.files).forEach(file => {
    if (state._questionImages.length >= 3) return; // 최대 3장
    const reader = new FileReader();
    reader.onload = (e) => {
      state._questionImages.push(e.target.result);
      renderScreen();
    };
    reader.readAsDataURL(file);
  });
  input.value = ''; // reset for re-upload
}

// AI가 생성한 HTML 내 버튼/인터랙션 바인딩
function bindAiGeneratedButtons(container) {
  if (!container) return;
  // AI가 생성한 button/a 태그에서 onclick 속성 안의 함수명을 추출 후 바인딩
  container.querySelectorAll('button, a, [role="button"]').forEach(btn => {
    // 이미 바인딩된 경우 건너뛰기
    if (btn._aiBound) return;
    btn._aiBound = true;
    
    const onclickAttr = btn.getAttribute('onclick');
    if (onclickAttr) {
      // onclick 속성 제거하고 직접 이벤트 리스너로 대체
      btn.removeAttribute('onclick');
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          // 앱 함수 매핑: AI가 생성할 수 있는 함수명 → 실제 앱 함수 
          if (onclickAttr.includes('startChallenge')) {
            startChallenge();
          } else if (onclickAttr.includes('saveQuestionToDB')) {
            const match = onclickAttr.match(/saveQuestionToDB\(['"]([^'"]*)['"]\)/);
            saveQuestionToDB(match ? match[1] : 'diag');
          } else if (onclickAttr.includes('showXpPopup')) {
            const match = onclickAttr.match(/showXpPopup\((\d+)/);
            showXpPopup(match ? parseInt(match[1]) : 10, '코칭 완료!');
          } else {
            // 알려지지 않은 함수 — 안전하게 eval 대신 무시
            console.warn('AI-generated button onclick not mapped:', onclickAttr);
          }
        } catch (err) {
          console.error('AI button handler error:', err);
        }
      });
    }
    
    // 버튼에 커서 포인터 보장
    btn.style.cursor = 'pointer';
  });
  
  // AI가 생성한 input/select에도 포인터 이벤트 보장
  container.querySelectorAll('input, select, textarea, label').forEach(el => {
    el.style.pointerEvents = 'auto';
  });
}

function startChallenge() {
  state._coachingMode = 'challenge';
  state._challengeResult = null;
  state._challengeLoading = false;
  renderScreen();
}

function submitChallenge() {
  const input = document.getElementById('challenge-input');
  const text = input ? input.value.trim() : '';
  if (!text) { alert('도전 질문을 입력해주세요!'); return; }

  const subject = state._questionSubject || '미지정';
  const axis = state._questionAxis || 'curiosity';

  state._challengeLoading = true;
  renderScreen();

  fetch('/api/analyze', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: text, subject, axis })
  })
  .then(r => r.json())
  .then(result => {
    state._challengeResult = result;
    state._challengeLoading = false;
    renderScreen();
  })
  .catch(err => {
    state._challengeLoading = false;
    alert('도전 분석 중 오류: ' + err.message);
    renderScreen();
  });
}

function startSocrates() {
  const questionInput = document.getElementById('question-input');
  const questionText = questionInput ? questionInput.value.trim() : '';
  const subject = state._questionSubject || '미지정';

  state._coachingMode = 'socrates';
  state._socratesComplete = false;
  state._socratesLoading = true;
  
  // 시작 시 AI에게 첫 질문을 받기 위한 초기 메시지 구성
  const currentLevel = state._diagResult ? state._diagResult.level : 'A-2';
  const initMsg = questionText 
    ? `학생이 "${questionText}"라는 질문을 했습니다 (${subject}). 이 학생의 현재 질문 단계는 ${currentLevel}입니다. 이 질문을 바탕으로 사고를 확장시키는 소크라테스식 첫 질문을 해주세요.`
    : `${subject} 과목에 대해 학생과 소크라테스식 대화를 시작합니다. 학생의 현재 단계는 ${currentLevel}입니다. 사고를 자극하는 첫 질문을 해주세요.`;
  
  state._socratesMessages = [{ role: 'user', content: initMsg }];
  renderScreen();

  fetch('/api/coaching', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: state._socratesMessages,
      subject,
      currentLevel
    })
  })
  .then(r => r.json())
  .then(result => {
    state._socratesMessages.push({ role: 'assistant', content: JSON.stringify(result) });
    // 초기 시스템 메시지를 사용자에게 보이지 않게 처리
    state._socratesMessages[0]._hidden = true;
    state._socratesLoading = false;
    renderScreen();
    // 채팅 스크롤 하단으로
    setTimeout(() => {
      const chat = document.getElementById('socrates-chat-area');
      if (chat) chat.scrollTop = chat.scrollHeight;
    }, 100);
  })
  .catch(err => {
    state._socratesLoading = false;
    alert('코칭 정율 시작 오류: ' + err.message);
    state._coachingMode = 'result';
    renderScreen();
  });
}

function openJeongyulQA() {
  // 현재 선택된 과목 가져오기
  const subject = state._questionSubject || '미지정';
  
  // 질문 내용 가져오기
  const questionInput = document.getElementById('question-input');
  const questionText = questionInput ? questionInput.value.trim() : '';
  
  // 질문 축(유형) 정보
  const axis = state._questionAxis || 'curiosity';
  const axisLabel = axis === 'reflection' ? '성찰질문' : '호기심질문';
  
  // URL 구성 — 쿼리 파라미터로 과목, 질문 내용 전달
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (questionText) params.set('question', questionText);
  params.set('type', axisLabel);
  params.set('from', 'creditplanner');
  
  const url = 'https://qa-tutoring-app.pages.dev/new?' + params.toString();
  
  // 인앱 오버레이 패널로 열기
  openQAPanel(url);
}

function openQAPanel(url) {
  // 이미 열려있으면 URL만 변경
  let overlay = document.getElementById('qa-overlay');
  if (overlay) {
    const iframe = overlay.querySelector('iframe');
    if (iframe) iframe.src = url;
    overlay.classList.add('qa-overlay-visible');
    return;
  }
  
  // 오버레이 생성
  overlay = document.createElement('div');
  overlay.id = 'qa-overlay';
  overlay.className = 'qa-overlay';
  overlay.innerHTML = `
    <div class="qa-panel">
      <div class="qa-panel-header">
        <div class="qa-panel-title">
          <span class="qa-panel-icon">💬</span>
          <span>정율질문방</span>
        </div>
        <div class="qa-panel-actions">
          <button class="qa-panel-btn" onclick="window.open(document.getElementById('qa-iframe').src, '_blank')" title="새 탭에서 열기">
            <i class="fas fa-external-link-alt"></i>
          </button>
          <button class="qa-panel-btn qa-panel-close" onclick="closeQAPanel()" title="닫기">
            <i class="fas fa-times"></i>
          </button>
        </div>
      </div>
      <div class="qa-panel-body">
        <div class="qa-loading-bar">
          <div class="qa-loading-progress"></div>
        </div>
        <iframe id="qa-iframe" src="${url}" allow="camera;microphone"></iframe>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlay);
  
  // iframe 로드 완료 시 로딩바 숨김
  const iframe = overlay.querySelector('iframe');
  iframe.addEventListener('load', () => {
    overlay.querySelector('.qa-loading-bar').style.opacity = '0';
  });
  
  // 약간의 딜레이 후 visible 클래스 추가 (애니메이션)
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      overlay.classList.add('qa-overlay-visible');
    });
  });
  
  // 배경 클릭으로 닫기
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeQAPanel();
  });
}

function closeQAPanel() {
  const overlay = document.getElementById('qa-overlay');
  if (!overlay) return;
  overlay.classList.remove('qa-overlay-visible');
  setTimeout(() => {
    overlay.remove();
  }, 300);
}

// ==================== RECORD TEACH (R-03) ====================

function renderRecordTeach() {
  const classmates = state.classmates || [];
  const selectedCm = state._teachSelectedCm || (classmates.length > 0 ? classmates[0].id : null);
  const searchTerm = state._teachSearch || '';
  const filtered = searchTerm ? classmates.filter(c => c.name.includes(searchTerm) || c.grade.includes(searchTerm)) : classmates;
  const selectedStudent = classmates.find(c => c.id === selectedCm);
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>교학상장 기록</h1>
        <span class="xp-badge-sm">+30 XP</span>
      </div>

      <div class="form-body">
        <div class="teach-hero">
          <span class="teach-hero-emoji">🤝</span>
          <h2>오늘 누군가에게 가르쳤나요?</h2>
        </div>

        <div class="field-group">
          <label class="field-label">👤 누구에게?</label>
          <div class="input-with-icon">
            <i class="fas fa-search"></i>
            <input class="input-field" placeholder="학생 검색..." style="padding-left:40px" value="${searchTerm}" oninput="state._teachSearch=this.value;renderScreen()">
          </div>
          ${filtered.length === 0 ? `
          <div style="text-align:center;padding:20px 0;color:var(--text-muted)">
            <p style="font-size:12px">${searchTerm ? '검색 결과가 없습니다' : '등록된 학생이 없습니다'}</p>
            <button class="btn-secondary" style="margin-top:8px;font-size:11px" onclick="goScreen('classmate-manage')">
              <i class="fas fa-user-plus"></i> 학생 관리에서 추가하기
            </button>
          </div>
          ` : `
          <div class="teach-student-list">
            ${filtered.map(c => `
              <div class="teach-student-item ${selectedCm===c.id?'selected':''}" onclick="state._teachSelectedCm='${c.id}';renderScreen()">
                <div class="teach-avatar">${c.name[0]}</div>
                <span>${c.name} (${c.grade})</span>
                ${selectedCm===c.id?'<i class="fas fa-check-circle" style="color:var(--success);margin-left:auto"></i>':''}
              </div>
            `).join('')}
          </div>
          `}
        </div>

        <div class="field-group">
          <label class="field-label">📚 무엇을?</label>
          <div class="chip-row">
            ${['국어','수학','영어','과학','기타'].map((s,i) => `<button class="chip ${i===1?'active':''}">${s}</button>`).join('')}
          </div>
          <input class="input-field" placeholder="단원/주제" value="치환적분의 원리" style="margin-top:8px">
        </div>

        <div class="field-group">
          <label class="field-label">💡 어떻게 가르쳤나요?</label>
          <textarea class="input-field" rows="3" placeholder="설명 방식, 예시, 접근법 등">역함수 관점에서 접근하면 왜 특정 치환만 가능한지 이해할 수 있다고 설명함</textarea>
        </div>

        <div class="field-group">
          <label class="field-label">⏱️ 대략 몇 분?</label>
          <div class="chip-row">
            ${['5분','10분','15분','20분','30분+'].map((t,i) => `<button class="chip ${i===2?'active':''}">${t}</button>`).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">🔍 가르치면서 발견한 것 <span class="field-hint">세특의 보석! 💎</span></label>
          <textarea class="input-field" rows="3" placeholder="설명하다 보니 내가 모르고 있었던 것...">설명하다 보니 내가 왜 특정 형태만 치환이 되는지 정확히 모르고 있었다는 걸 알게 됨</textarea>
        </div>

        ${selectedStudent ? `
        <div class="teach-confirm-box">
          📨 ${selectedStudent.name}에게 확인 요청을 보낼까요?
          <button class="btn-secondary" style="margin-top:8px;font-size:12px">확인 요청 보내기</button>
        </div>
        ` : ''}

        <button class="btn-primary" onclick="saveTeachRecordFromForm()">기록 완료 +30 XP 🏅</button>
      </div>
    </div>
  `;
}

// ==================== RECORD ASSIGNMENT (과제 기록) ====================

// 교학상장(가르치기) 기록을 DB에 저장
function saveTeachRecordFromForm() {
  const chipActive = document.querySelector('.form-body .chip.active');
  const subject = chipActive ? chipActive.textContent?.trim() : '수학';
  const inputs = document.querySelectorAll('.form-body .input-field');
  const topic = inputs[1]?.value?.trim() || '주제 미입력';
  const content = inputs[2]?.value?.trim() || '';
  const reflection = inputs[3]?.value?.trim() || '';
  
  const selectedCm = state._teachSelectedCm || null;
  const classmates = state.classmates || [];
  const student = classmates.find(c => c.id === selectedCm);
  const taughtTo = student ? student.name : '';
  
  if (DB.studentId()) {
    DB.saveTeachRecord({
      subject,
      topic,
      taughtTo,
      content,
      reflection,
      xpEarned: 30,
    });
  }
  
  showXpPopup(30, '교학상장 기록 완료! 🏅');
}

function renderRecordAssignment() {
  const subjectColors = {
    '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
    '한국사':'#74B9FF','체육':'#A29BFE','미술':'#FD79A8','기타':'#636e72'
  };
  const editing = state.editingAssignment;
  const isEdit = editing !== null;
  const a = isEdit ? state.assignments.find(x => String(x.id) === String(editing)) : null;
  
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state.editingAssignment=null;goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>${isEdit ? '과제 수정' : '📋 과제 기록'}</h1>
        <span class="xp-badge-sm">+15 XP</span>
      </div>

      <div class="form-body">
        <div class="assignment-intro-card animate-in">
          <span class="assignment-intro-icon">📋</span>
          <div>
            <h3>선생님이 내 준 과제를 기록하세요</h3>
            <p>마감일까지의 계획도 함께 세울 수 있어요!</p>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📚 과목</label>
          <div class="chip-row" id="assignment-subject-chips">
            ${['국어','수학','영어','과학','한국사','기타'].map((s,i) => `<button class="chip ${(isEdit && a.subject===s) || (!isEdit && i===1) ? 'active' : ''}" data-subject="${s}">${s}</button>`).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📝 과제 제목</label>
          <input class="input-field" id="assignment-title" placeholder="예: 치환적분 연습문제 풀이" value="${isEdit ? a.title : ''}">
        </div>

        <div class="field-group">
          <label class="field-label">📄 상세 내용</label>
          <textarea class="input-field" id="assignment-desc" rows="3" placeholder="과제의 구체적인 내용, 범위, 조건 등을 적어주세요">${isEdit ? a.desc : ''}</textarea>
        </div>

        <div class="field-group">
          <label class="field-label">📂 과제 유형</label>
          <div class="assignment-type-grid">
            ${[
              {type:'문제풀이', icon:'✏️'},
              {type:'에세이/작문', icon:'📝'},
              {type:'보고서', icon:'📊'},
              {type:'감상문', icon:'📖'},
              {type:'프로젝트', icon:'🔬'},
              {type:'발표준비', icon:'🎤'},
              {type:'실험/실습', icon:'🧪'},
              {type:'기타', icon:'📌'},
            ].map((t,i) => `
              <button class="assignment-type-btn ${(isEdit && a.type===t.type) || (!isEdit && i===0) ? 'active' : ''}" data-atype="${t.type}">
                <span>${t.icon}</span><span>${t.type}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">👨‍🏫 선생님</label>
          <input class="input-field" id="assignment-teacher" placeholder="과제를 내 준 선생님" value="${isEdit ? a.teacher : ''}">
        </div>

        <div class="field-group">
          <label class="field-label">📅 마감일</label>
          <input class="input-field" type="date" id="assignment-due" value="${isEdit ? a.dueDate : '2026-02-26'}" style="color:var(--text-primary)">
        </div>

        <div class="assignment-plan-cta animate-in" onclick="saveAssignment(true)">
          <div class="plan-cta-icon">📅</div>
          <div class="plan-cta-content">
            <h3>제출 계획 세우기</h3>
            <p>마감일까지 단계별 플랜을 정율이 도와줘요!</p>
          </div>
          <i class="fas fa-chevron-right" style="color:var(--primary-light)"></i>
        </div>

        <button class="btn-primary" onclick="saveAssignment(false)">
          ${isEdit ? '과제 수정 완료' : '과제 기록 완료 +15 XP ✨'}
        </button>
      </div>
    </div>
  `;
}

// ==================== ASSIGNMENT PLAN (과제 계획) ====================

function renderAssignmentPlan() {
  const a = state.assignments.find(x => String(x.id) === String(state.viewingAssignment));
  if (!a) { goScreen('main'); return ''; }
  
  const dDay = getDday(a.dueDate);
  const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
  const urgency = dDay <= 1 ? 'urgent' : dDay <= 3 ? 'warning' : 'normal';
  const donePlanSteps = a.plan.filter(p => p.done).length;
  const totalPlanSteps = a.plan.length;
  const planPct = totalPlanSteps > 0 ? Math.round(donePlanSteps / totalPlanSteps * 100) : 0;
  
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state.viewingAssignment=null;goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>📅 과제 계획</h1>
        <span class="assignment-dday ${urgency}" style="font-size:13px;padding:5px 12px">${dDayText}</span>
      </div>

      <div class="form-body">
        <!-- Assignment Summary Card -->
        <div class="assignment-summary-card animate-in" style="border-left:4px solid ${a.color}">
          <div class="asm-header">
            <div class="asm-subject" style="color:${a.color}">${a.subject}</div>
            <span class="asm-type">${a.type}</span>
          </div>
          <h2 class="asm-title">${a.title}</h2>
          <p class="asm-desc">${a.desc}</p>
          <div class="asm-meta">
            <span><i class="fas fa-user"></i> ${a.teacher} 선생님</span>
            <span><i class="fas fa-calendar"></i> ${formatDate(a.dueDate)} 까지</span>
          </div>
          <div class="asm-progress-row">
            <div class="asm-progress-bar"><div class="asm-progress-fill" style="width:${a.progress}%;background:${a.color}"></div></div>
            <span class="asm-progress-text">${a.progress}%</span>
          </div>
        </div>

        <!-- Plan Steps -->
        <div class="plan-section stagger-1 animate-in">
          <div class="card-header-row">
            <span class="card-title">📋 단계별 플랜</span>
            <span class="card-subtitle">${donePlanSteps}/${totalPlanSteps} 완료</span>
          </div>
          
          <div class="plan-progress-mini">
            <div class="plan-progress-bar"><div class="plan-progress-fill" style="width:${planPct}%;background:${a.color}"></div></div>
          </div>

          <div class="plan-steps">
            ${a.plan.length === 0 ? `
              <div style="text-align:center;padding:20px 0;color:var(--text-muted)">
                <span style="font-size:28px;display:block;margin-bottom:8px">📝</span>
                <p style="font-size:13px;margin:0">아직 세부 플랜이 없어요</p>
                <p style="font-size:11px;margin-top:4px">과제를 수정해서 단계를 추가해보세요!</p>
              </div>
            ` : a.plan.map((step, i) => {
              const isNext = !step.done && (i === 0 || a.plan[i-1].done);
              return `
              <div class="plan-step ${step.done ? 'done' : ''} ${isNext ? 'next' : ''}">
                <div class="plan-step-check" onclick="togglePlanStep('${a.id}', ${i})">
                  ${step.done 
                    ? '<i class="fas fa-check-circle" style="color:var(--success);font-size:20px"></i>'
                    : isNext 
                      ? '<i class="far fa-circle" style="color:var(--primary-light);font-size:20px"></i>'
                      : '<i class="far fa-circle" style="color:var(--text-muted);font-size:20px"></i>'
                  }
                </div>
                <div class="plan-step-line ${i === a.plan.length - 1 ? 'last' : ''} ${step.done ? 'done' : ''}"></div>
                <div class="plan-step-content ${isNext ? 'highlight' : ''}">
                  <div class="plan-step-header">
                    <span class="plan-step-num">Step ${step.step}</span>
                    <span class="plan-step-date">${step.date}</span>
                  </div>
                  <span class="plan-step-title">${step.title}</span>
                </div>
              </div>
              `;
            }).join('')}
          </div>
        </div>
        <!-- AI Suggestion -->
        <div class="ai-plan-card stagger-2 animate-in">
          <div class="ai-header">
            <span class="ai-icon">🤖</span>
            <span class="ai-title">정율 플랜 제안</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-top:8px">
            ${dDay <= 3 
              ? `⚠️ 마감이 <strong style="color:var(--accent)">${dDay}일</strong> 남았어요! 오늘부터 하루 1단계씩 진행하면 충분히 완료할 수 있어요. 집중 시간을 확보하세요!`
              : `✅ 마감까지 <strong style="color:var(--success)">${dDay}일</strong> 남았어요. 현재 진행률 ${a.progress}%로 순조로운 편이에요. 꾸준히 하루에 1단계씩 진행해보세요!`
            }
          </p>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:8px;margin-top:8px">
          <button class="btn-secondary" style="flex:1" onclick="state.editingAssignment='${a.id}';goScreen('record-assignment')">
            <i class="fas fa-edit"></i> 수정
          </button>
          <button class="btn-primary" style="flex:2" onclick="goScreen('assignment-list')">
            <i class="fas fa-list"></i> 과제 목록
          </button>
        </div>

        ${a.status !== 'completed' ? `
        <button class="btn-ghost" style="width:100%;margin-top:8px;color:var(--success)" onclick="toggleAssignmentDone('${a.id}')">
          ✅ 과제 완료 처리
        </button>
        ` : `
        <div class="assignment-completed-badge">
          <i class="fas fa-check-circle"></i> 이 과제는 완료되었습니다! 🎉
        </div>
        `}
      </div>
    </div>
  `;
}

// ==================== ASSIGNMENT LIST (과제 목록/관리) ====================

function renderAssignmentList() {
  const filter = state.assignmentFilter;
  const filtered = filter === 'all' 
    ? state.assignments 
    : state.assignments.filter(a => a.status === filter);
  
  const activeCount = state.assignments.filter(a => a.status !== 'completed').length;
  const completedCount = state.assignments.filter(a => a.status === 'completed').length;
  
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state.assignmentFilter='all';goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>📋 과제 관리</h1>
        <button class="header-add-btn" onclick="state.editingAssignment=null;goScreen('record-assignment')"><i class="fas fa-plus"></i></button>
      </div>

      <div class="form-body">
        <!-- Stats Summary -->
        <div class="assignment-stats-row animate-in">
          <div class="assignment-stat-card">
            <span class="assignment-stat-num" style="color:var(--primary-light)">${activeCount}</span>
            <span class="assignment-stat-label">진행 중</span>
          </div>
          <div class="assignment-stat-card">
            <span class="assignment-stat-num" style="color:var(--success)">${completedCount}</span>
            <span class="assignment-stat-label">완료</span>
          </div>
          <div class="assignment-stat-card">
            <span class="assignment-stat-num" style="color:var(--accent)">${state.assignments.filter(a => getDday(a.dueDate) <= 3 && a.status !== 'completed').length}</span>
            <span class="assignment-stat-label">긴급</span>
          </div>
        </div>

        <!-- Filter Chips -->
        <div class="chip-row" style="margin-bottom:16px" id="assignment-filter-chips">
          ${[
            {id:'all', label:'전체', count: state.assignments.length},
            {id:'in-progress', label:'진행 중', count: state.assignments.filter(a=>a.status==='in-progress').length},
            {id:'pending', label:'시작 전', count: state.assignments.filter(a=>a.status==='pending').length},
            {id:'completed', label:'완료', count: state.assignments.filter(a=>a.status==='completed').length},
          ].map(f => `<button class="chip ${filter===f.id?'active':''}" data-afilter="${f.id}">${f.label} (${f.count})</button>`).join('')}
        </div>

        <!-- Assignment Cards -->
        ${filtered.length === 0 ? `
          <div style="text-align:center;padding:40px 0;color:var(--text-muted)">
            <span style="font-size:40px">📭</span>
            <p style="margin-top:12px">해당하는 과제가 없습니다</p>
          </div>
        ` : ''}
        
        ${filtered.sort((a,b) => {
          if (a.status === 'completed' && b.status !== 'completed') return 1;
          if (a.status !== 'completed' && b.status === 'completed') return -1;
          return new Date(a.dueDate) - new Date(b.dueDate);
        }).map((a, i) => {
          const dDay = getDday(a.dueDate);
          const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
          const urgency = a.status === 'completed' ? 'completed' : dDay <= 1 ? 'urgent' : dDay <= 3 ? 'warning' : 'normal';
          const donePlanSteps = a.plan.filter(p => p.done).length;
          return `
          <div class="assignment-card ${urgency} stagger-${i+1} animate-in" onclick="state.viewingAssignment='${a.id}';goScreen('assignment-plan')">
            <div class="ac-top">
              <div class="ac-subject-badge" style="background:${a.color}22;color:${a.color};border:1px solid ${a.color}44">${a.subject}</div>
              <span class="ac-type">${a.type}</span>
              <span class="assignment-dday ${urgency}" style="margin-left:auto">${a.status === 'completed' ? '✅ 완료' : dDayText}</span>
            </div>
            <h3 class="ac-title">${a.title}</h3>
            <p class="ac-desc">${a.desc}</p>
            <div class="ac-bottom">
              <div class="ac-meta">
                <span><i class="fas fa-user"></i> ${a.teacher}</span>
                <span><i class="fas fa-calendar"></i> ${formatDate(a.dueDate)}</span>
              </div>
              <div class="ac-progress-row">
                <div class="ac-progress-bar"><div class="ac-progress-fill" style="width:${a.progress}%;background:${a.color}"></div></div>
                <span class="ac-progress-text">${a.progress}%</span>
                <span class="ac-plan-count">${donePlanSteps}/${a.plan.length}단계</span>
              </div>
            </div>
          </div>
          `;
        }).join('')}

        <!-- Add Assignment Button -->
        <button class="add-assignment-btn" onclick="state.editingAssignment=null;goScreen('record-assignment')">
          <i class="fas fa-plus-circle"></i> 새 과제 추가
        </button>
      </div>
    </div>
  `;
}

// ==================== ASSIGNMENT UTILITIES ====================

function getDday(dateStr) {
  const today = new Date();
  today.setHours(0,0,0,0);
  const due = new Date(dateStr);
  due.setHours(0,0,0,0);
  return Math.ceil((due - today) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return `${d.getMonth()+1}/${d.getDate()}`;
}

function saveAssignment(goToPlan) {
  const subjectChip = document.querySelector('#assignment-subject-chips .chip.active');
  const typeBtn = document.querySelector('.assignment-type-btn.active');
  const title = document.getElementById('assignment-title')?.value || '';
  const desc = document.getElementById('assignment-desc')?.value || '';
  const teacher = document.getElementById('assignment-teacher')?.value || '';
  const dueDate = document.getElementById('assignment-due')?.value || '';
  const subject = subjectChip ? subjectChip.dataset.subject : '수학';
  const type = typeBtn ? typeBtn.dataset.atype : '문제풀이';
  
  const subjectColors = {
    '국어':'#FF6B6B','수학':'#6C5CE7','영어':'#00B894','과학':'#FDCB6E',
    '한국사':'#74B9FF','체육':'#A29BFE','미술':'#FD79A8','기타':'#636e72'
  };

  if (state.editingAssignment !== null) {
    const a = state.assignments.find(x => String(x.id) === String(state.editingAssignment));
    if (a) {
      a.subject = subject;
      a.title = title || a.title;
      a.desc = desc || a.desc;
      a.type = type;
      a.teacher = teacher || a.teacher;
      a.dueDate = dueDate || a.dueDate;
      a.color = subjectColors[subject] || '#636e72';
      
      // DB 업데이트
      if (a._dbId && DB.studentId()) {
        DB.updateAssignment(a._dbId, { title: a.title, dueDate: a.dueDate, status: a.status });
      }
    }
    state.editingAssignment = null;
    if (goToPlan) {
      state.viewingAssignment = a.id;
      goScreen('assignment-plan');
    } else {
      showXpPopup(5, '과제 수정 완료!');
    }
    return;
  }

  const newId = state.assignments.length > 0 ? Math.max(...state.assignments.map(a=>a.id)) + 1 : 1;
  const daysUntilDue = getDday(dueDate);
  const stepsCount = Math.max(3, Math.min(6, daysUntilDue));
  
  // Auto-generate plan steps
  const plan = [];
  const dueD = new Date(dueDate);
  const today = new Date();
  for (let i = 0; i < stepsCount; i++) {
    const stepDate = new Date(today.getTime() + ((dueD - today) / stepsCount) * (i + 1));
    const stepLabels = ['자료 조사 및 준비','초안 작성','본문 완성','검토 및 수정','최종 점검','제출'];
    plan.push({
      step: i + 1,
      title: stepLabels[i] || `${i+1}단계 진행`,
      date: `${stepDate.getMonth()+1}/${stepDate.getDate()}`,
      done: false
    });
  }

  const newAssignment = {
    id: newId,
    subject,
    title: title || '새 과제',
    desc: desc || '',
    type,
    teacher: teacher || '',
    dueDate,
    createdDate: new Date().toISOString().split('T')[0],
    color: subjectColors[subject] || '#636e72',
    status: 'pending',
    progress: 0,
    plan
  };
  
  state.assignments.push(newAssignment);

  // DB 저장 (비동기)
  if (DB.studentId()) {
    DB.saveAssignment({
      subject,
      title: title || '새 과제',
      description: desc || '',
      teacherName: teacher || '',
      dueDate,
      color: subjectColors[subject] || '#636e72',
      planData: plan,
    }).then(dbId => {
      if (dbId) {
        newAssignment._dbId = dbId;
        newAssignment.id = String(dbId);
      }
    });
  }

  if (goToPlan) {
    state.viewingAssignment = newId;
    goScreen('assignment-plan');
  } else {
    showXpPopup(15, '과제 기록 완료! 📋');
  }
}

function togglePlanStep(assignmentId, stepIdx) {
  const a = state.assignments.find(x => String(x.id) === String(assignmentId));
  if (!a || !a.plan || !a.plan[stepIdx]) return;
  a.plan[stepIdx].done = !a.plan[stepIdx].done;
  
  // Update progress
  const doneCount = a.plan.filter(p => p.done).length;
  a.progress = Math.round(doneCount / a.plan.length * 100);
  
  // Update status
  if (a.progress === 100) {
    a.status = 'completed';
  } else if (a.progress > 0) {
    a.status = 'in-progress';
  } else {
    a.status = 'pending';
  }
  
  // DB 업데이트
  if (a._dbId && DB.studentId()) {
    DB.updateAssignment(a._dbId, { status: a.status, progress: a.progress, planData: a.plan });
  }
  
  renderScreen();
}

function completeAssignment(id) {
  const a = state.assignments.find(x => String(x.id) === String(id));
  if (!a) return;
  a.status = 'completed';
  a.progress = 100;
  a.plan.forEach(p => p.done = true);
  
  // DB 업데이트
  if (a._dbId && DB.studentId()) {
    DB.updateAssignment(a._dbId, { status: 'completed', progress: 100, planData: a.plan });
  }
  
  showXpPopup(20, '과제 완료! 🎉');
}

// ==================== RECORD ACTIVITY (R-04 창의적 체험활동) ====================

function renderRecordActivity() {
  // 통합 리스트: 모든 활동 표시 (필터 지원)
  const filter = state.activityFilter || 'all';
  
  // 유형 매핑
  const TYPE_META = {
    'activity': { label:'동아리', icon:'🎭', filterKey:'club', bg:'rgba(224,86,160,0.12)' },
    'career': { label:'진로활동', icon:'🎯', filterKey:'career', bg:'rgba(255,159,67,0.12)' },
    'self': { label:'자율자치', icon:'🧠', filterKey:'self', bg:'rgba(162,155,254,0.12)' },
    'report': { label:'탐구보고서', icon:'📄', filterKey:'report', bg:'rgba(108,92,231,0.12)' },
    'reading': { label:'독서', icon:'📖', filterKey:'reading', bg:'rgba(0,184,148,0.12)' },
  };

  // extracurriculars의 type값 → filter key 매핑
  function getFilterKey(ec) {
    if (ec.type === 'report') return 'report';
    if (ec.type === 'reading') return 'reading';
    // activity 타입은 subType으로 구분 (club, career, self)
    if (ec.subType === 'career') return 'career';
    if (ec.subType === 'self') return 'self';
    return 'club'; // default activity → club
  }
  
  // 필터링
  let filtered = state.extracurriculars;
  if (filter !== 'all') {
    filtered = filtered.filter(ec => getFilterKey(ec) === filter);
  }
  
  // 정렬: 진행중 먼저, 그 다음 최신순
  const statusOrder = { 'in-progress': 0, 'pending': 1, 'completed': 2 };
  filtered = [...filtered].sort((a, b) => {
    const sa = statusOrder[a.status] ?? 1;
    const sb = statusOrder[b.status] ?? 1;
    if (sa !== sb) return sa - sb;
    return (b.startDate || '').localeCompare(a.startDate || '');
  });

  const filters = [
    { key:'all', label:'전체', icon:'📂' },
    { key:'club', label:'동아리', icon:'🎭' },
    { key:'career', label:'진로', icon:'🎯' },
    { key:'self', label:'자율자치', icon:'🧠' },
    { key:'report', label:'탐구보고서', icon:'📄' },
    { key:'reading', label:'독서', icon:'📖' },
  ];

  // 유형별 카운트
  const counts = { all: state.extracurriculars.length };
  state.extracurriculars.forEach(ec => {
    const k = getFilterKey(ec);
    counts[k] = (counts[k] || 0) + 1;
  });

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>🏫 창의적 체험활동</h1>
        <button class="header-add-btn" onclick="goScreen('activity-add')"><i class="fas fa-plus"></i></button>
      </div>

      <div class="form-body" style="padding-top:8px">
        <!-- 통계 요약 배너 -->
        <div class="act-summary-banner animate-in">
          <div class="act-summary-item">
            <span class="act-summary-num">${state.extracurriculars.filter(e => e.status === 'in-progress').length}</span>
            <span class="act-summary-label">진행중</span>
          </div>
          <div class="act-summary-divider"></div>
          <div class="act-summary-item">
            <span class="act-summary-num">${state.extracurriculars.filter(e => e.status === 'completed').length}</span>
            <span class="act-summary-label">완료</span>
          </div>
          <div class="act-summary-divider"></div>
          <div class="act-summary-item">
            <span class="act-summary-num">${state.extracurriculars.reduce((s, e) => s + (e.report?.totalXp || 0), 0)}</span>
            <span class="act-summary-label">총 XP</span>
          </div>
        </div>

        <!-- 필터 탭 (가로 스크롤) -->
        <div class="act-filter-tabs">
          ${filters.map(f => `
            <button class="act-filter-tab ${filter === f.key ? 'active' : ''}" 
              onclick="state.activityFilter='${f.key}';renderScreen()">
              <span>${f.icon}</span>
              <span>${f.label}</span>
              ${counts[f.key] ? `<span class="act-filter-count">${counts[f.key]}</span>` : ''}
            </button>
          `).join('')}
        </div>

        <!-- 활동 리스트 -->
        ${filtered.length === 0 ? `
          <div class="act-empty">
            <div class="act-empty-icon">📝</div>
            <div class="act-empty-text">아직 등록된 활동이 없어요</div>
            <div class="act-empty-sub">아래 버튼을 눌러 첫 활동을 등록해보세요!</div>
            <button class="btn-primary" onclick="goScreen('activity-add')" style="display:inline-flex;align-items:center;gap:6px;padding:12px 24px;margin-top:12px">
              <i class="fas fa-plus"></i> 새 활동 추가하기
            </button>
          </div>
        ` : filtered.map((ec, i) => {
          const fk = getFilterKey(ec);
          const meta = TYPE_META[ec.type] || TYPE_META['activity'];
          // 유형 아이콘 우선순위: subType > type
          let icon = meta.icon;
          let label = meta.label;
          let bg = meta.bg;
          if (ec.subType === 'career') { icon = '🎯'; label = '진로활동'; bg = 'rgba(255,159,67,0.12)'; }
          else if (ec.subType === 'self') { icon = '🧠'; label = '자율자치'; bg = 'rgba(162,155,254,0.12)'; }

          const statusLabel = ec.status === 'completed' ? '✅ 완료' : ec.status === 'in-progress' ? '🔄 진행중' : '📋 예정';
          const statusClass = ec.status === 'completed' ? 'completed' : ec.status === 'in-progress' ? 'in-progress' : 'pending';

          // 탐구보고서는 추가 정보 표시
          let extraInfo = '';
          if (ec.type === 'report' && ec.report) {
            const rpt = ec.report;
            const totalXp = rpt.questions.reduce((s, q) => s + (q.xp || 0), 0);
            const phaseName = ['주제 선정','탐구 설계','자료 수집','분석/작성','회고'][rpt.currentPhase] || '';
            extraInfo = `<div class="act-card-extra"><span>💬 질문 ${rpt.questions.length}개</span><span>⚡ ${totalXp} XP</span><span>📍 ${phaseName}</span></div>`;
          }
          // 독서는 진행률 표시
          if (ec.type === 'reading') {
            extraInfo = `<div class="act-card-extra"><span>📖 ${ec.progress}% 읽음</span>${ec.memo ? `<span>📝 ${ec.memo}</span>` : ''}</div>`;
          }

          // 클릭 핸들러
          let onclick = '';
          if (ec.type === 'report' && ec.report) {
            onclick = `state.viewingReport='${ec.id}';state.reportPhaseTab=${ec.report.currentPhase};state.reportViewMode='question';state.reportDiagResult=null;state.reportAiResponse=null;goScreen('report-project')`;
          } else {
            onclick = `state.viewingActivity='${ec.id}';goScreen('activity-detail')`;
          }

          return `
          <div class="act-card stagger-${Math.min(i+1,8)} animate-in" onclick="${onclick}">
            <div class="act-card-left">
              <div class="act-card-type-badge" style="background:${bg}">
                <span>${icon}</span>
              </div>
            </div>
            <div class="act-card-body">
              <div class="act-card-top">
                <span class="act-card-type-label" style="color:${ec.color}">${label}</span>
                <span class="act-card-subject">${ec.subject}</span>
                <span class="act-card-status ${statusClass}">${statusLabel}</span>
              </div>
              <div class="act-card-title">${ec.title}</div>
              ${ec.desc ? `<div class="act-card-desc">${ec.desc}</div>` : ''}
              ${extraInfo}
              <div class="act-card-footer">
                <span class="act-card-date">${ec.startDate?.slice(5) || ''} ~ ${ec.endDate?.slice(5) || ''}</span>
                <div class="act-card-progress">
                  <div class="act-card-progress-fill" style="width:${ec.progress}%;background:${ec.color}"></div>
                </div>
                <span class="act-card-progress-text">${ec.progress}%</span>
              </div>
            </div>
          </div>
          `;
        }).join('')}

        <!-- 하단 추가 버튼 -->
        ${filtered.length > 0 ? `
        <button class="act-add-float-btn" onclick="goScreen('activity-add')">
          <i class="fas fa-plus" style="margin-right:6px"></i> 새 활동 추가
        </button>
        ` : ''}
      </div>
    </div>
  `;
}

// ==================== 활동 상세 화면 (동아리/진로/자율자치/독서) ====================

function renderActivityDetail() {
  const ec = state.extracurriculars.find(e => e.id === state.viewingActivity);
  if (!ec) { state.viewingActivity = null; goScreen('record-activity'); return ''; }
  
  // 유형 정보
  let typeIcon = '🎭', typeLabel = '동아리', typeColor = '#E056A0';
  if (ec.subType === 'career' || ec.type === 'career') { typeIcon = '🎯'; typeLabel = '진로활동'; typeColor = '#FF9F43'; }
  else if (ec.subType === 'self' || ec.type === 'self') { typeIcon = '🧠'; typeLabel = '자율자치'; typeColor = '#A29BFE'; }
  else if (ec.type === 'reading') { typeIcon = '📖'; typeLabel = '독서'; typeColor = '#00B894'; }

  const statusLabel = ec.status === 'completed' ? '✅ 완료' : ec.status === 'in-progress' ? '🔄 진행중' : '📋 예정';

  // 활동 로그 (간단한 기록 시스템)
  const logs = ec.logs || [];

  return `
    <div class="full-screen animate-slide">
      <!-- 헤더 -->
      <div class="act-detail-header" style="border-bottom:3px solid ${ec.color}20">
        <div class="act-detail-header-top">
          <button class="back-btn" onclick="state.viewingActivity=null;goScreen('record-activity')"><i class="fas fa-arrow-left"></i></button>
          <div style="flex:1">
            <div class="act-detail-title">${ec.title}</div>
            <div class="act-detail-subtitle">${ec.subject} · ${typeLabel}</div>
          </div>
          <span class="xp-badge-sm">+20 XP</span>
        </div>

        <!-- 요약 통계 -->
        <div class="act-detail-stats">
          <div class="act-detail-stat">
            <span class="act-detail-stat-icon">${typeIcon}</span>
            <span class="act-detail-stat-value">${typeLabel}</span>
            <span class="act-detail-stat-label">유형</span>
          </div>
          <div class="act-detail-stat">
            <span class="act-detail-stat-icon">📅</span>
            <span class="act-detail-stat-value">${ec.startDate?.slice(5) || ''}</span>
            <span class="act-detail-stat-label">시작일</span>
          </div>
          <div class="act-detail-stat">
            <span class="act-detail-stat-icon">📊</span>
            <span class="act-detail-stat-value">${ec.progress}%</span>
            <span class="act-detail-stat-label">진행률</span>
          </div>
          <div class="act-detail-stat">
            <span class="act-detail-stat-icon">📝</span>
            <span class="act-detail-stat-value">${logs.length}</span>
            <span class="act-detail-stat-label">기록 수</span>
          </div>
        </div>

        <!-- 진행 바 -->
        <div class="act-detail-progress-wrap">
          <div class="act-detail-progress-bar">
            <div class="act-detail-progress-fill" style="width:${ec.progress}%;background:${ec.color}"></div>
          </div>
          <span class="act-detail-progress-text">${statusLabel}</span>
        </div>
      </div>

      <div class="form-body" style="padding-top:12px">
        <!-- 활동 설명 -->
        ${ec.desc ? `
        <div class="act-detail-card">
          <div class="act-detail-card-title">📋 활동 설명</div>
          <div class="act-detail-card-body">${ec.desc}</div>
        </div>
        ` : ''}

        <!-- 메모 -->
        ${ec.memo ? `
        <div class="act-detail-card">
          <div class="act-detail-card-title">💡 메모</div>
          <div class="act-detail-card-body">${ec.memo}</div>
        </div>
        ` : ''}

        <!-- 진로 연계 -->
        ${ec.careerLink ? `
        <div class="act-detail-card">
          <div class="act-detail-card-title">🔗 진로 연계</div>
          <div class="act-detail-card-body">${ec.careerLink}</div>
        </div>
        ` : ''}

        <!-- 활동 기록 타임라인 -->
        <div class="act-detail-card">
          <div class="act-detail-card-header">
            <span class="act-detail-card-title">📜 활동 기록</span>
            <span style="font-size:11px;color:#888">${logs.length}개 기록</span>
          </div>
          
          ${logs.length > 0 ? logs.map((log, idx) => `
            <div class="act-log-item">
              <div class="act-log-date">${log.date?.slice(5) || ''}</div>
              <div class="act-log-content">
                <div class="act-log-text">${log.content}</div>
                ${log.reflection ? `<div class="act-log-reflection">💡 ${log.reflection}</div>` : ''}
                ${log.duration ? `<div class="act-log-duration">⏱️ ${log.duration}</div>` : ''}
              </div>
            </div>
          `).join('') : `
            <div style="text-align:center;padding:20px 0;color:#666;font-size:13px">
              아직 기록이 없어요<br>아래에서 오늘의 활동을 기록해보세요!
            </div>
          `}
        </div>

        <!-- 새 기록 작성 -->
        <div class="act-detail-card act-log-form">
          <div class="act-detail-card-title">✏️ 오늘의 활동 기록</div>
          <textarea id="act-log-content" class="input-field" rows="3" placeholder="오늘 한 활동 내용을 적어주세요"></textarea>
          
          <div style="display:flex;gap:8px;margin-top:8px">
            <div style="flex:1">
              <label class="field-label" style="font-size:11px">💡 배운 점 (선택)</label>
              <input id="act-log-reflection" class="input-field" placeholder="느낀 점, 배운 점..." style="font-size:13px">
            </div>
          </div>

          ${ec.type !== 'reading' ? `
          <div style="margin-top:8px">
            <label class="field-label" style="font-size:11px">⏱️ 활동 시간</label>
            <div class="chip-row">
              ${['30분','1시간','1.5시간','2시간','2시간+'].map((t,i) => `<button class="chip act-dur-chip ${i===1?'active':''}">${t}</button>`).join('')}
            </div>
          </div>
          ` : `
          <div style="margin-top:8px">
            <label class="field-label" style="font-size:11px">📖 읽은 분량</label>
            <div class="chip-row">
              ${['~10쪽','~30쪽','~50쪽','~100쪽','100쪽+'].map((t,i) => `<button class="chip act-dur-chip ${i===1?'active':''}">${t}</button>`).join('')}
            </div>
          </div>
          `}

          <button class="btn-primary" style="margin-top:12px" onclick="saveActivityLog('${ec.id}')">기록 완료 +20 XP ✨</button>
        </div>

        <!-- 편집/상태 변경 버튼 -->
        <div class="act-detail-actions">
          ${ec.status !== 'completed' ? `
            <button class="btn-secondary" onclick="updateActivityProgress('${ec.id}', ${Math.min(ec.progress + 10, 100)})">
              📊 진행률 +10%
            </button>
            <button class="btn-secondary" onclick="completeActivity('${ec.id}')" style="color:#00B894;border-color:#00B894">
              ✅ 활동 완료
            </button>
          ` : `
            <button class="btn-secondary" onclick="updateActivityStatus('${ec.id}','in-progress')" style="color:#FF9F43;border-color:#FF9F43">
              🔄 다시 진행중으로
            </button>
          `}
        </div>
      </div>
    </div>
  `;
}

// ==================== 활동 추가 화면 ====================

function renderActivityAdd() {
  const subjects = ['수학','국어','영어','과학','한국사','사회','정보','기술가정','음악','미술','체육','진로','기타'];
  const colors = ['#6C5CE7','#FF6B6B','#00B894','#FDCB6E','#74B9FF','#A29BFE','#E056A0','#FF9F43','#00CEC9','#FD79A8','#E17055','#636e72','#888'];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('record-activity')"><i class="fas fa-arrow-left"></i></button>
        <h1>🏫 새 활동 등록</h1>
      </div>
      <div class="form-body">
        <!-- Step 1: 활동 유형 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">1</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📂 활동 유형</label>
            <div class="act-add-type-grid" id="act-add-types">
              ${[
                {type:'club', icon:'🎭', name:'동아리', desc:'교내 동아리 활동'},
                {type:'career', icon:'🎯', name:'진로활동', desc:'진로 탐색·체험'},
                {type:'self', icon:'🧠', name:'자율자치', desc:'자율활동·자치활동'},
                {type:'report', icon:'📄', name:'탐구보고서', desc:'탐구·연구 프로젝트'},
                {type:'reading', icon:'📖', name:'독서', desc:'독서·독서감상문'},
              ].map((a,i) => `
                <button class="act-add-type-btn ${i===0?'active':''}" data-type="${a.type}" onclick="selectActivityType(this)">
                  <span class="act-add-type-icon">${a.icon}</span>
                  <span class="act-add-type-name">${a.name}</span>
                  <span class="act-add-type-desc">${a.desc}</span>
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Step 2: 활동명 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">2</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📝 활동명</label>
            <div style="font-size:11px;color:#888;margin-bottom:8px">활동 이름을 입력하세요</div>
            <input id="act-add-title" class="input-field form-input" placeholder="예: 코딩동아리, 진로탐색 체험, 독서...">
          </div>
        </div>

        <!-- Step 3: 관련 과목 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">3</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📚 관련 과목</label>
            <div class="rpt-add-subject-grid" id="act-add-subjects">
              ${subjects.map((s, i) => `
                <button class="rpt-add-subject-btn" data-subject="${s}" data-color="${colors[i]}" onclick="selectActAddSubject(this)">
                  <span class="rpt-add-subject-dot" style="background:${colors[i]}"></span>${s}
                </button>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Step 4: 기간 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">4</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📅 활동 기간</label>
            <div style="display:flex;gap:8px;align-items:center">
              <input id="act-add-start" type="date" class="input-field form-input" value="${new Date().toISOString().slice(0,10)}" style="flex:1">
              <span style="color:#666">~</span>
              <input id="act-add-end" type="date" class="input-field form-input" value="${new Date(Date.now()+90*86400000).toISOString().slice(0,10)}" style="flex:1">
            </div>
          </div>
        </div>

        <!-- Step 5: 설명 -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">5</div>
          <div class="rpt-add-step-content">
            <label class="field-label">📋 활동 설명 <span class="field-hint">(선택)</span></label>
            <textarea id="act-add-desc" class="input-field form-input" rows="2" placeholder="활동에 대한 간단한 설명"></textarea>
          </div>
        </div>

        <!-- Step 6: 진로 연계 (선택) -->
        <div class="rpt-add-step">
          <div class="rpt-add-step-num">6</div>
          <div class="rpt-add-step-content">
            <label class="field-label">🔗 진로 연계 <span class="field-hint">(선택)</span></label>
            <input id="act-add-career" class="input-field form-input" placeholder="이 활동이 진로와 어떻게 연결되나요?">
          </div>
        </div>

        <button class="btn-primary" onclick="saveNewActivity()" style="margin-top:16px">
          🚀 활동 등록하기!
        </button>
      </div>
    </div>
  `;
}

// 활동 유형 선택
function selectActivityType(btn) {
  document.querySelectorAll('#act-add-types .act-add-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // 탐구보고서 선택 시 report-add로 이동
  if (btn.dataset.type === 'report') {
    goScreen('report-add');
  }
}

function selectActAddSubject(btn) {
  document.querySelectorAll('#act-add-subjects .rpt-add-subject-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

// 새 활동 저장
function saveNewActivity() {
  const typeBtn = document.querySelector('#act-add-types .act-add-type-btn.active');
  const actType = typeBtn?.dataset?.type || 'club';
  
  // 탐구보고서면 report-add로 리다이렉트
  if (actType === 'report') { goScreen('report-add'); return; }

  const title = document.getElementById('act-add-title')?.value?.trim();
  const subjectBtn = document.querySelector('#act-add-subjects .rpt-add-subject-btn.active');
  const subject = subjectBtn?.dataset?.subject || '기타';
  const color = subjectBtn?.dataset?.color || '#888';
  const startDate = document.getElementById('act-add-start')?.value;
  const endDate = document.getElementById('act-add-end')?.value;
  const desc = document.getElementById('act-add-desc')?.value?.trim() || '';
  const careerLink = document.getElementById('act-add-career')?.value?.trim() || '';

  if (!title) { alert('활동명을 입력해주세요!'); return; }

  const newId = 'ec' + (Date.now() % 100000);
  const ecType = actType === 'reading' ? 'reading' : 'activity';
  
  const newEntry = {
    id: newId,
    type: ecType,
    subType: actType, // club, career, self, reading
    title, subject, color,
    status: 'in-progress',
    progress: 0,
    startDate: startDate || new Date().toISOString().slice(0,10),
    endDate: endDate || new Date(Date.now()+90*86400000).toISOString().slice(0,10),
    desc, memo: '',
    careerLink,
    logs: [],
  };

  state.extracurriculars.push(newEntry);
  
  // DB 저장
  if (DB.studentId()) {
    DB.saveActivityRecord({
      activityType: actType,
      title,
      description: desc,
      startDate: newEntry.startDate,
      endDate: newEntry.endDate,
      status: 'in-progress',
      progress: 0,
      reflection: '',
    }).then(dbId => {
      if (dbId) newEntry._dbId = dbId;
    });
  }
  
  // 바로 상세 화면으로
  state.viewingActivity = newId;
  goScreen('activity-detail');
  showXpPopup(5, '새 활동이 등록되었어요! 🎉');
}

// 활동 로그 저장
function saveActivityLog(ecId) {
  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec) return;
  
  const content = document.getElementById('act-log-content')?.value?.trim();
  if (!content) { alert('활동 내용을 입력해주세요!'); return; }
  
  const reflection = document.getElementById('act-log-reflection')?.value?.trim() || '';
  const durChip = document.querySelector('.act-dur-chip.active');
  const duration = durChip ? durChip.textContent : '';

  if (!ec.logs) ec.logs = [];
  ec.logs.unshift({
    date: new Date().toISOString().slice(0, 10),
    content, reflection, duration,
  });

  // 진행률 자동 증가 (최소 5%)
  if (ec.progress < 100) {
    ec.progress = Math.min(ec.progress + 5, 100);
  }

  // DB 업데이트 (활동 로그를 description에 누적 저장 + 별도 activity_logs에도 기록)
  if (ec._dbId && DB.studentId()) {
    DB.updateActivityRecord(ec._dbId, {
      progress: ec.progress,
      status: ec.progress >= 100 ? 'completed' : 'in-progress',
      description: JSON.stringify(ec.logs),
      reflection: reflection,
    });
    // 날짜별 활동 로그 개별 저장 (관리자 조회용)
    DB.saveActivityLog(ec._dbId, {
      date: new Date().toISOString().slice(0, 10),
      content,
      reflection,
      duration,
      xpEarned: 20,
    });
  }

  state.xp += 20;
  renderScreen();
  showXpPopup(20, '활동 기록 완료!');
}

// 활동 진행률 업데이트
function updateActivityProgress(ecId, newProgress) {
  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec) return;
  ec.progress = Math.min(Math.max(newProgress, 0), 100);
  if (ec.progress >= 100) ec.status = 'completed';
  // DB 업데이트
  if (ec._dbId && DB.studentId()) {
    DB.updateActivityRecord(ec._dbId, { progress: ec.progress, status: ec.status });
  }
  renderScreen();
}

// 활동 완료 처리
function completeActivity(ecId) {
  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec) return;
  ec.status = 'completed';
  ec.progress = 100;
  // DB 업데이트
  if (ec._dbId && DB.studentId()) {
    DB.updateActivityRecord(ec._dbId, { status: 'completed', progress: 100 });
  }
  state.xp += 30;
  renderScreen();
  showXpPopup(30, '활동 완료! 🎉');
}

// 활동 상태 변경
function updateActivityStatus(ecId, newStatus) {
  const ec = state.extracurriculars.find(e => e.id === ecId);
  if (!ec) return;
  ec.status = newStatus;
  if (newStatus === 'in-progress' && ec.progress >= 100) ec.progress = 90;
  // DB 업데이트
  if (ec._dbId && DB.studentId()) {
    DB.updateActivityRecord(ec._dbId, { status: ec.status, progress: ec.progress });
  }
  renderScreen();
}

// ==================== EVENING ROUTINE ====================

function renderEveningRoutine() {
  const doneCount = state.todayRecords.filter(r => r.done).length;
  const total = state.todayRecords.length;
  const questionCount = state.todayRecords.filter(r => r.question).length;
  
  return `
    <div class="full-screen animate-in">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>🌙 저녁 루틴</h1>
        <span class="xp-badge-sm">+10 XP</span>
      </div>

      <div class="form-body">
        <div class="evening-summary-card">
          <h2>오늘 하루 수고했어요! 🌟</h2>
          <div class="evening-stats">
            <div class="evening-stat">
              <span class="evening-stat-num">${doneCount}/${total}</span>
              <span class="evening-stat-label">수업 기록</span>
            </div>
            <div class="evening-stat">
              <span class="evening-stat-num">${questionCount}</span>
              <span class="evening-stat-label">질문</span>
            </div>
            <div class="evening-stat">
              <span class="evening-stat-num">0</span>
              <span class="evening-stat-label">교학상장</span>
            </div>
          </div>
        </div>

        ${doneCount < total ? `
          <div class="card" style="margin:0 0 16px;border-color:rgba(243,156,18,0.3)">
            <div class="card-title" style="color:var(--warning)">⚠️ 아직 기록하지 않은 수업</div>
            ${state.todayRecords.filter(r => !r.done).map(r => `
              <div class="missing-record-row">
                <span>${r.period}교시 <span style="color:${r.color};font-weight:600">${r.subject}</span></span>
                <button class="btn-secondary" style="padding:6px 12px;font-size:12px" onclick="goScreen('record-class')">기록하기</button>
              </div>
            `).join('')}
          </div>
        ` : `
          <div class="card" style="margin:0 0 16px;border-color:rgba(0,184,148,0.3)">
            <div style="text-align:center;padding:8px 0">
              <span style="font-size:32px">🎉</span>
              <p style="font-size:14px;font-weight:600;color:var(--success);margin-top:8px">오늘 모든 수업을 기록했어요!</p>
            </div>
          </div>
        `}

        <div class="field-group">
          <label class="field-label">📝 오늘의 한 줄 메모</label>
          <textarea class="input-field" rows="2" placeholder="오늘 하루를 한 줄로 정리한다면?">수학 치환적분 질문이 B-1→C-1까지 사고의 심연을 돌파한 날!</textarea>
        </div>

        <div class="field-group">
          <label class="field-label">😊 오늘의 무드</label>
          <div class="mood-selector" style="justify-content:space-around">
            ${[
              {emoji:'😄', label:'최고'},
              {emoji:'🙂', label:'좋음'},
              {emoji:'😐', label:'보통'},
              {emoji:'😔', label:'별로'},
              {emoji:'😫', label:'힘듦'}
            ].map(m => `
              <button class="mood-btn ${m.emoji==='🙂'?'active':''}" data-mood="${m.emoji}">
                <span class="mood-emoji">${m.emoji}</span>
                <span class="mood-label">${m.label}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="evening-xp-preview">
          <div>오늘 획득 XP</div>
          <div class="evening-xp-total">+45 XP</div>
          <div class="evening-xp-breakdown">수업 기록 20 + 질문 15 + 루틴 10</div>
        </div>

        <button class="btn-primary btn-glow" onclick="showXpPopup(10, '저녁 루틴 완료! 🌙')">하루 마무리 +10 XP 🌙</button>
      </div>
    </div>
  `;
}

// ==================== WEEKLY REPORT (학생 미리보기) ====================

function renderWeeklyReportStudent() {
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>📊 주간 리포트</h1>
        <span style="font-size:12px;color:var(--text-muted)">2월 2주차</span>
      </div>

      <div class="form-body">
        <div class="report-hero">
          <div class="report-hero-avatar">🎓</div>
          <h2>김민준의 이번 주</h2>
          <p>2월 10일 ~ 2월 15일</p>
        </div>

        <div class="report-stat-grid">
          ${[
            {num:'28', label:'수업 기록', sub:'/ 30수업 (93%)', color:'var(--primary-light)'},
            {num:'8', label:'질문', sub:'호기심4 성찰4', color:'var(--accent)'},
            {num:'2', label:'교학상장', sub:'수학, 영어', color:'var(--teach-green)'},
            {num:'🔥18', label:'스트릭', sub:'연속 기록', color:'var(--streak-fire)'},
          ].map(s => `
            <div class="report-stat-item">
              <span class="report-stat-num" style="color:${s.color}">${s.num}</span>
              <span class="report-stat-label">${s.label}</span>
              <span class="report-stat-sub">${s.sub}</span>
            </div>
          `).join('')}
        </div>

        <div class="card" style="margin:0 0 12px">
          <div class="card-title">📈 이번 주 하이라이트</div>
          <div class="highlight-item">
            <span class="highlight-badge" style="background:rgba(255,107,107,0.15);color:var(--accent)">호기심 사다리 성장</span>
            <p>영어에서 B-1("왜?") 단계 첫 등장! 관계대명사의 역사적 배경을 묻는 심층 질문</p>
          </div>
          <div class="highlight-item">
            <span class="highlight-badge" style="background:rgba(0,184,148,0.15);color:var(--teach-green)">교학상장</span>
            <p>수학 치환적분을 역함수 관점으로 설명하며 자신의 이해 빈틈도 발견</p>
          </div>
          <div class="highlight-item">
            <span class="highlight-badge" style="background:rgba(108,92,231,0.15);color:var(--primary-light)">사고의 심연 돌파</span>
            <p>수학 "치환적분" A-2→B-1→C-1 호기심 사다리 완주! +50 XP</p>
          </div>
        </div>

        <div class="card" style="margin:0 0 12px">
          <div class="card-title">🎯 다음 주 목표</div>
          ${[
            {icon:'❓', text:'영어 질문 B-2 "만약에?" 단계 도전'},
            {icon:'🤝', text:'교학상장 3회 이상'},
            {icon:'📝', text:'수업 기록 100% 달성'},
          ].map(g => `
            <div class="next-goal-item">
              <span class="next-goal-icon">${g.icon}</span>
              <span>${g.text}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==================== RECORD HISTORY ====================

function renderRecordHistory() {
  const historyData = [
    { date: '오늘 · 2월 15일 (토)', items: [
      { type: '수업', color: 'var(--primary)', meta: '2교시 · 수학 · 김태호', text: '치환적분, 부분적분, 역함수', tags: [{q:'C-1 "뭐가 더 나아?"', style:'q-level q-level-c'}], xp: '+25' },
      { type: '수업', color: 'var(--accent)', meta: '1교시 · 국어 · 박선영', text: '윤동주 서시, 자아성찰, 저항시', tags: [], xp: '+10' },
    ]},
    { date: '어제 · 2월 14일 (금)', items: [
      { type: '교학상장', color: 'var(--teach-green)', meta: '수학 · 이서연에게', text: '치환적분 역함수 관점 설명 (15분)', tags: [], xp: '+30' },
      { type: '동아리', color: 'var(--accent-warm)', meta: '코딩동아리 CodingLab', text: 'Python matplotlib 수학 그래프 시각화', tags: [], xp: '+20' },
      { type: '수업', color: 'var(--primary)', meta: '5교시 · 과학 · 최은지', text: '산화환원 반응, 전자 이동', tags: [{q:'B-2 "만약에?"', style:'q-level q-level-b'}], xp: '+30' },
    ]},
  ];

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state.studentTab='record';goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>📜 기록 히스토리</h1>
      </div>

      <div class="form-body">
        <div class="chip-row" style="margin-bottom:16px">
          ${['전체','수업','질문','교학상장','창체'].map((c,i) => `<button class="chip ${i===0?'active':''}">${c}</button>`).join('')}
        </div>

        ${historyData.map(day => `
          <div class="history-date-header">${day.date}</div>
          ${day.items.map((item,i) => `
            <div class="history-card stagger-${i+1} animate-in">
              <div class="history-type-badge" style="background:${item.color}">${item.type}</div>
              <div class="history-content">
                <div class="history-meta">${item.meta}</div>
                <p>${item.text}</p>
                <div class="history-tags">
                  ${item.tags.map(t => `<span class="${t.style}" style="font-size:10px">${t.q}</span>`).join('')}
                  <span class="history-xp">${item.xp} XP</span>
                </div>
              </div>
            </div>
          `).join('')}
        `).join('')}
      </div>
    </div>
  `;
}

// ==================== PLANNER TAB ====================

function renderPlannerTab() {
  return `
    <div class="tab-content animate-in">
      <div class="planner-header">
        <h1>📅 플래너</h1>
        <div class="planner-view-toggle">
          ${['daily','weekly','monthly'].map(v => `
            <button class="pvt-btn ${state.plannerView===v?'active':''}" data-pview="${v}">
              ${v==='daily'?'일간':v==='weekly'?'주간':'월간'}
            </button>
          `).join('')}
        </div>
      </div>

      ${state.plannerView === 'daily' ? renderPlannerDaily() : ''}
      ${state.plannerView === 'weekly' ? renderPlannerWeekly() : ''}
      ${state.plannerView === 'monthly' ? renderPlannerMonthly() : ''}
    </div>
  `;
}

// ---- DAILY PLANNER ----
function renderPlannerDaily() {
  const d = new Date(state.plannerDate);
  const dayNames = ['일','월','화','수','목','금','토'];
  const todayItems = state.plannerItems.filter(i => i.date === state.plannerDate).sort((a,b) => a.time.localeCompare(b.time));
  const doneCount = todayItems.filter(i => i.done).length;
  const aiCount = todayItems.filter(i => i.aiGenerated).length;

  // 날짜 네비게이션 (5일)
  const dateDots = [];
  for (let offset = -2; offset <= 2; offset++) {
    const dd = new Date(d);
    dd.setDate(dd.getDate() + offset);
    const dateStr = dd.toISOString().split('T')[0];
    const itemCount = state.plannerItems.filter(i => i.date === dateStr).length;
    dateDots.push({ date: dateStr, day: dd.getDate(), dayName: dayNames[dd.getDay()], isToday: offset===0, hasItems: itemCount > 0, itemCount });
  }

  // 카테고리별 아이콘 매핑
  const catIcon = (cat) => {
    const icons = { 'class':'🏫', 'assignment':'📋', 'study':'📖', 'routine':'☀️', 'activity':'🎭', 'explore':'🔬', 'teach':'🤝', 'personal':'✏️' };
    return icons[cat] || '📌';
  };
  const catLabel = (cat) => {
    const labels = { 'class':'수업', 'assignment':'과제', 'study':'학습', 'routine':'루틴', 'activity':'활동', 'explore':'탐구', 'teach':'교학상장', 'personal':'개인' };
    return labels[cat] || '기타';
  };

  // 현재 시간 계산 (진행중 표시용)
  const nowMinutes = new Date().getHours() * 60 + new Date().getMinutes();
  const isCurrentDate = state.plannerDate === new Date().toISOString().split('T')[0];

  // 마감 과제
  const dueAssignments = state.assignments.filter(a => a.dueDate === state.plannerDate && a.status !== 'completed');

  return `
    <!-- Date Navigator -->
    <div class="planner-date-nav">
      <button class="pdn-arrow" onclick="shiftPlannerDate(-1)"><i class="fas fa-chevron-left"></i></button>
      <div class="pdn-dates">
        ${dateDots.map(dd => `
          <button class="pdn-date ${dd.isToday?'active':''} ${dd.hasItems?'has-items':''}" onclick="state.plannerDate='${dd.date}';renderScreen()">
            <span class="pdn-dayname">${dd.dayName}</span>
            <span class="pdn-day">${dd.day}</span>
            ${dd.hasItems ? `<span class="pdn-dot"></span>` : ''}
          </button>
        `).join('')}
      </div>
      <button class="pdn-arrow" onclick="shiftPlannerDate(1)"><i class="fas fa-chevron-right"></i></button>
    </div>

    <!-- Daily Summary -->
    <div class="planner-daily-summary">
      <div class="pds-item"><span class="pds-num">${todayItems.length}</span><span class="pds-label">전체</span></div>
      <div class="pds-divider"></div>
      <div class="pds-item"><span class="pds-num" style="color:var(--success)">${doneCount}</span><span class="pds-label">완료</span></div>
      <div class="pds-divider"></div>
      <div class="pds-item pds-highlight"><span class="pds-num" style="color:var(--primary-light)">${aiCount}</span><span class="pds-label">정율 배치</span></div>
      <div class="pds-divider"></div>
      <div class="pds-item"><span class="pds-num" style="color:var(--accent)">${dueAssignments.length + todayItems.filter(i=>i.category==='assignment'&&!i.done).length}</span><span class="pds-label">과제</span></div>
    </div>

    <!-- Due Assignments for this day -->
    ${dueAssignments.length > 0 ? (() => {
      return '<div style="padding:0 16px;margin-bottom:8px">' +
        '<div style="font-size:12px;font-weight:700;color:var(--accent);margin-bottom:6px;display:flex;align-items:center;gap:6px"><i class="fas fa-exclamation-circle"></i> 오늘 마감 과제</div>' +
        dueAssignments.map(a => {
          const dDay = getDday(a.dueDate);
          const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? 'D-' + dDay : 'D+' + Math.abs(dDay);
          return '<div class="card" style="margin-bottom:6px;padding:10px 12px;border-left:3px solid ' + a.color + ';cursor:pointer" onclick="state.viewingAssignment=\'' + a.id + '\';goScreen(\'assignment-plan\')">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:3px">' +
              '<span class="assignment-dday urgent" style="font-size:11px;padding:2px 6px">' + dDayText + '</span>' +
              '<span style="font-size:11px;color:' + a.color + ';font-weight:600">' + a.subject + '</span>' +
              '<span style="margin-left:auto;font-size:11px;color:var(--text-muted)">' + a.progress + '%</span>' +
            '</div>' +
            '<div style="font-size:13px;font-weight:600;color:var(--text-primary)">' + a.title + '</div>' +
            '<div style="display:flex;gap:6px;margin-top:6px">' +
              '<button class="btn-secondary" style="flex:1;padding:5px;font-size:11px" onclick="event.stopPropagation();toggleAssignmentDone(\'' + a.id + '\')"><i class="fas fa-check"></i> 완료</button>' +
              '<button class="btn-ghost" style="flex:0;padding:5px 8px;font-size:11px" onclick="event.stopPropagation();deletePlannerAssignment(\'' + a.id + '\')"><i class="fas fa-trash"></i></button>' +
              '<button class="btn-ghost" style="flex:0;padding:5px 8px;font-size:11px" onclick="event.stopPropagation();state.editingAssignment=\'' + a.id + '\';goScreen(\'record-assignment\')"><i class="fas fa-edit"></i></button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';
    })() : ''}

    <!-- 2-Column Layout: Agenda (70%) + Todo (30%) -->
    <div class="planner-two-col">
      <!-- LEFT: Compact Agenda (빈 시간대 제거) -->
      <div class="planner-col-timeline">
        <div class="agenda-list">
          ${todayItems.length === 0 ? `
            <div class="agenda-empty">
              <div class="agenda-empty-icon">📅</div>
              <div class="agenda-empty-text">오늘 일정이 없습니다</div>
              <button class="agenda-add-first" onclick="openPlannerAdd('${state.plannerDate}','09:00')">
                <i class="fas fa-plus"></i> 첫 일정 추가
              </button>
            </div>
          ` : todayItems.map((item, idx) => {
            const startH = parseInt(item.time.split(':')[0]);
            const startM = parseInt(item.time.split(':')[1]);
            const endH = parseInt(item.endTime.split(':')[0]);
            const endM = parseInt(item.endTime.split(':')[1]);
            const itemStart = startH * 60 + startM;
            const itemEnd = endH * 60 + endM;
            const isNow = isCurrentDate && nowMinutes >= itemStart && nowMinutes < itemEnd;
            const isPast = isCurrentDate && nowMinutes >= itemEnd;
            const isClassOrAcademy = item.category === 'class';
            return `
              <div class="agenda-item ${item.done?'done':''} ${isNow?'now':''} ${isPast&&!item.done?'past':''} cat-${item.category}" onclick="togglePlannerItem('${item.id}')">
                <div class="agenda-time-col">
                  <span class="agenda-time-start">${item.time}</span>
                  <span class="agenda-time-end">${item.endTime}</span>
                </div>
                <div class="agenda-bar" style="background:${item.color}"></div>
                <div class="agenda-body">
                  <div class="agenda-title-row">
                    <span class="agenda-check">
                      ${item.done
                        ? '<i class="fas fa-check-circle" style="color:var(--success)"></i>'
                        : isNow
                          ? '<i class="fas fa-dot-circle" style="color:var(--accent-warm)"></i>'
                          : '<i class="far fa-circle"></i>'
                      }
                    </span>
                    <span class="agenda-cat-icon">${item.icon || catIcon(item.category)}</span>
                    <span class="agenda-title">${item.title}</span>
                    ${item.aiGenerated ? '<span class="pt-ai-badge">정율</span>' : ''}
                  </div>
                  ${item.detail ? `<div class="agenda-detail">${item.detail}</div>` : ''}
                  <div class="agenda-tags">
                    <span class="agenda-cat-tag" style="color:${item.color};border-color:${item.color}">${catLabel(item.category)}</span>
                    ${isNow ? '<span class="agenda-now-tag">진행중</span>' : ''}
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>

        <!-- Add Button -->
        <div class="agenda-add-row">
          <button class="agenda-add-btn" onclick="openPlannerAdd('${state.plannerDate}','')">
            <i class="fas fa-plus-circle"></i> 일정 추가
          </button>
        </div>
      </div>

      <!-- RIGHT: Quick Todo -->
      <div class="planner-col-todo">
        <div class="planner-todo-card">
          <div class="planner-todo-header">
            <span class="planner-todo-title">✏️ 오늘 할 일</span>
            <span class="planner-todo-count">${state.quickTodos ? state.quickTodos.filter(t=>t.done).length : 0}/${state.quickTodos ? state.quickTodos.length : 0}</span>
          </div>
          <div class="planner-todo-list">
            ${(!state.quickTodos || state.quickTodos.length === 0) ? `
              <div class="planner-todo-empty">
                <span style="font-size:18px;opacity:0.3">📝</span>
                <span>할 일을 추가해보세요</span>
              </div>
            ` : state.quickTodos.map((t, i) => `
              <div class="planner-todo-item ${t.done?'done':''}" onclick="toggleQuickTodo(${i})">
                <i class="fas ${t.done?'fa-check-circle':'fa-circle'}" style="color:${t.done?'var(--success)':'var(--text-muted)'};font-size:13px"></i>
                <span class="planner-todo-text">${t.text}</span>
                <button class="planner-todo-del" onclick="event.stopPropagation();deleteQuickTodo(${i})"><i class="fas fa-times"></i></button>
              </div>
            `).join('')}
          </div>
          <div class="planner-todo-input-row">
            <input type="text" id="quick-todo-input" class="planner-todo-input" placeholder="할 일 입력..." maxlength="50" onkeydown="if(event.key==='Enter')addQuickTodo()">
            <button class="planner-todo-add-btn" onclick="addQuickTodo()"><i class="fas fa-plus"></i></button>
          </div>
        </div>
      </div>
    </div>
  `;
}

// ---- WEEKLY PLANNER ----
function renderPlannerWeekly() {
  const d = new Date(state.plannerDate);
  const dayOfWeek = d.getDay(); // 0=일 ~ 6=토
  const monday = new Date(d);
  monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const dayNames = ['월','화','수','목','금','토','일'];

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const dd = new Date(monday);
    dd.setDate(monday.getDate() + i);
    const dateStr = dd.toISOString().split('T')[0];
    const items = state.plannerItems.filter(it => it.date === dateStr).sort((a,b) => a.time.localeCompare(b.time));
    const assignments = items.filter(it => it.category === 'assignment');
    // 이 날 마감인 과제
    const deadlines = state.assignments.filter(a => a.dueDate === dateStr && a.status !== 'completed');
    weekDays.push({ date: dateStr, day: dd.getDate(), dayName: dayNames[i], items, assignments, deadlines, isToday: dateStr === state.plannerDate });
  }

  const monthStr = `${monday.getFullYear()}.${String(monday.getMonth()+1).padStart(2,'0')}`;

  return `
    <div class="planner-week-header">
      <button class="pdn-arrow" onclick="shiftPlannerWeek(-1)"><i class="fas fa-chevron-left"></i></button>
      <span class="pw-month">${monthStr} · ${monday.getMonth()+1}/${monday.getDate()}~${weekDays[6].day}</span>
      <button class="pdn-arrow" onclick="shiftPlannerWeek(1)"><i class="fas fa-chevron-right"></i></button>
    </div>

    <div class="planner-week-grid">
      ${weekDays.map(wd => `
        <div class="pw-day ${wd.isToday?'today':''}" onclick="state.plannerDate='${wd.date}';state.plannerView='daily';renderScreen()">
          <div class="pw-day-header">
            <span class="pw-dayname">${wd.dayName}</span>
            <span class="pw-daynum ${wd.isToday?'today':''}">${wd.day}</span>
          </div>
          <div class="pw-items">
            ${wd.deadlines.map(dl => `
              <div class="pw-item pw-deadline">🚨 ${dl.subject} 마감</div>
            `).join('')}
            ${wd.items.slice(0, 4).map(item => `
              <div class="pw-item" style="border-left:2px solid ${item.color}">
                <span class="pw-item-time">${item.time.substring(0,5)}</span>
                <span class="pw-item-title">${item.title.replace('[과제] ','📋').replace('[탐구] ','🔬')}</span>
              </div>
            `).join('')}
            ${wd.items.length > 4 ? `<div class="pw-more">+${wd.items.length - 4}개 더</div>` : ''}
            ${wd.items.length === 0 && wd.deadlines.length === 0 ? `<div class="pw-empty">—</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>

    <!-- Weekly Assignment Overview -->
    <div class="card" style="margin:12px 16px">
      <div class="card-header-row">
        <span class="card-title">📋 이번 주 과제 현황</span>
      </div>
      ${state.assignments.filter(a => {
        const due = new Date(a.dueDate);
        return due >= monday && due <= new Date(weekDays[6].date + 'T23:59:59') && a.status !== 'completed';
      }).map(a => {
        const dDay = getDday(a.dueDate);
        const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
        const urgency = dDay <= 1 ? 'urgent' : dDay <= 3 ? 'warning' : 'normal';
        return `
        <div class="pw-assignment-row" onclick="state.viewingAssignment='${a.id}';goScreen('assignment-plan')">
          <span class="assignment-dday ${urgency}">${dDayText}</span>
          <span style="font-weight:600;flex:1;margin-left:8px">${a.subject} · ${a.title}</span>
          <span style="font-size:11px;color:var(--text-muted)">${a.progress}%</span>
        </div>`;
      }).join('') || '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px">이번 주 마감 과제 없음 ✅</p>'}
    </div>
  `;
}

// ---- MONTHLY PLANNER ----
function renderPlannerMonthly() {
  const d = new Date(state.plannerDate);
  const year = d.getFullYear();
  const month = d.getMonth();
  const firstDay = new Date(year, month, 1).getDay(); // 0=일
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = state.plannerDate;

  const dayNames = ['일','월','화','수','목','금','토'];
  const cells = [];
  
  // 빈 셀
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    const items = state.plannerItems.filter(it => it.date === dateStr);
    const deadlines = state.assignments.filter(a => a.dueDate === dateStr && a.status !== 'completed');
    cells.push({ day, dateStr, items, deadlines, isToday: dateStr === todayStr });
  }

  return `
    <div class="planner-month-header">
      <button class="pdn-arrow" onclick="shiftPlannerMonth(-1)"><i class="fas fa-chevron-left"></i></button>
      <span class="pm-title">${year}년 ${month+1}월</span>
      <button class="pdn-arrow" onclick="shiftPlannerMonth(1)"><i class="fas fa-chevron-right"></i></button>
    </div>

    <div class="planner-month-grid">
      ${dayNames.map(dn => `<div class="pm-day-header ${dn==='일'?'sun':dn==='토'?'sat':''}">${dn}</div>`).join('')}
      ${cells.map(cell => {
        if (!cell) return '<div class="pm-cell empty"></div>';
        const hasAssignment = cell.items.some(i => i.category === 'assignment');
        const hasClass = cell.items.some(i => i.category === 'class');
        const hasDeadline = cell.deadlines.length > 0;
        return `
          <div class="pm-cell ${cell.isToday?'today':''} ${hasDeadline?'deadline':''}" onclick="state.plannerDate='${cell.dateStr}';state.plannerView='daily';renderScreen()">
            <span class="pm-day-num">${cell.day}</span>
            <div class="pm-dots">
              ${hasClass ? '<span class="pm-dot" style="background:var(--primary)"></span>' : ''}
              ${hasAssignment ? '<span class="pm-dot" style="background:#FF9F43"></span>' : ''}
              ${cell.items.some(i => i.category === 'academy') ? '<span class="pm-dot" style="background:#E056A0"></span>' : ''}
              ${hasDeadline ? '<span class="pm-dot" style="background:var(--accent)"></span>' : ''}
            </div>
            ${cell.items.length > 0 ? `<span class="pm-count">${cell.items.length}</span>` : ''}
          </div>
        `;
      }).join('')}
    </div>

    <!-- Legend -->
    <div class="pm-legend">
      <span><span class="pm-dot-lg" style="background:var(--primary)"></span>수업</span>
      <span><span class="pm-dot-lg" style="background:#FF9F43"></span>과제</span>
      <span><span class="pm-dot-lg" style="background:#E056A0"></span>학원</span>
      <span><span class="pm-dot-lg" style="background:var(--accent)"></span>마감</span>
    </div>

    <!-- Upcoming Deadlines -->
    <div class="card" style="margin:12px 16px">
      <div class="card-title">🚨 이번 달 마감 과제</div>
      ${state.assignments.filter(a => {
        const due = new Date(a.dueDate);
        return due.getMonth() === month && due.getFullYear() === year && a.status !== 'completed';
      }).sort((a,b) => new Date(a.dueDate) - new Date(b.dueDate)).map(a => {
        const dDay = getDday(a.dueDate);
        const dDayText = dDay === 0 ? 'D-Day' : dDay > 0 ? `D-${dDay}` : `D+${Math.abs(dDay)}`;
        const urgency = dDay <= 1 ? 'urgent' : dDay <= 3 ? 'warning' : 'normal';
        return `
        <div class="pw-assignment-row" onclick="state.viewingAssignment='${a.id}';goScreen('assignment-plan')">
          <span class="assignment-dday ${urgency}">${dDayText}</span>
          <span style="font-weight:600;flex:1;margin-left:8px">${a.subject} · ${a.title}</span>
          <span style="font-size:11px;color:var(--text-muted)">${formatDate(a.dueDate)}</span>
        </div>`;
      }).join('') || '<p style="font-size:12px;color:var(--text-muted);text-align:center;padding:8px">이번 달 마감 과제 없음 ✅</p>'}
    </div>
  `;
}

// ---- AI FLOATING ASSISTANT ----
function renderPlannerAiFloat() {
  if (state.plannerAiOpen) {
    return `
      <div class="planner-ai-panel animate-in">
        <div class="pai-header">
          <div class="pai-avatar">🤖</div>
          <div>
            <span class="pai-title">정율 플래너 도우미</span>
            <span class="pai-status">항상 대기 중</span>
          </div>
          <button class="pai-close" onclick="state.plannerAiOpen=false;renderScreen()"><i class="fas fa-times"></i></button>
        </div>
        <div class="pai-messages">
          ${state.plannerAiMessages.map(m => `
            <div class="pai-msg ${m.role}">
              ${m.role==='ai' ? '<span class="pai-msg-avatar">🤖</span>' : ''}
              <div class="pai-msg-bubble">${m.text}</div>
            </div>
          `).join('')}
        </div>
        <div class="pai-suggestions">
          ${[
            '오늘 남은 일정 정리해줘',
            '내일 공부 계획 짜줘',
            '과제 마감 일정 확인',
            '이번 주 비는 시간 찾아줘',
          ].map(s => `<button class="pai-suggestion" onclick="sendAiMessage('${s}')">${s}</button>`).join('')}
        </div>
        <div class="pai-input-row">
          <input class="pai-input" placeholder="정율에게 물어보세요..." id="pai-input-field" onkeypress="if(event.key==='Enter'){sendAiMessage(this.value);this.value=''}">
          <button class="pai-send" onclick="const inp=document.getElementById('pai-input-field');sendAiMessage(inp.value);inp.value=''"><i class="fas fa-paper-plane"></i></button>
        </div>
      </div>
    `;
  }
  return `
    <button class="planner-ai-fab" onclick="state.plannerAiOpen=true;renderScreen()">
      <span class="pai-fab-icon">🤖</span>
      <span class="pai-fab-pulse"></span>
    </button>
  `;
}

// ---- PLANNER ADD ITEM ----
function renderPlannerAddItem() {
  const prefillDate = state.plannerDate || '2026-02-15';
  const prefillTime = state._addTime || '';
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
        <h1>📝 일정 추가</h1>
      </div>
      <div class="form-body">
        <div class="field-group">
          <label class="field-label">📂 카테고리</label>
          <div class="planner-cat-grid" id="planner-cat-chips">
            ${[
              {id:'study',icon:'📝',name:'자습/복습'},
              {id:'assignment',icon:'📋',name:'과제'},
              {id:'explore',icon:'🔬',name:'탐구'},
              {id:'academy',icon:'🏢',name:'학원/과외'},
              {id:'activity',icon:'🏫',name:'창의적 체험활동'},
              {id:'personal',icon:'📖',name:'개인공부'},
              {id:'exercise',icon:'🏃',name:'운동'},
              {id:'reading',icon:'📚',name:'독서'},
              {id:'routine',icon:'☀️',name:'루틴'},
            ].map((c,i) => `
              <button class="planner-cat-btn ${i===0?'active':''}" data-pcat="${c.id}">
                <span>${c.icon}</span><span>${c.name}</span>
              </button>
            `).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">✏️ 제목</label>
          <input class="input-field" id="planner-add-title" placeholder="일정 제목을 입력하세요">
        </div>

        <div class="field-group">
          <label class="field-label">📝 상세 메모 <span class="field-hint">(선택)</span></label>
          <textarea class="input-field" id="planner-add-detail" placeholder="추가 내용이 있다면 적어주세요" rows="2"></textarea>
        </div>

        <div style="display:flex;gap:8px">
          <div class="field-group" style="flex:1">
            <label class="field-label">📅 날짜</label>
            <input class="input-field" type="date" id="planner-add-date" value="${prefillDate}" style="color:var(--text-primary)">
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">⏰ 시작</label>
            <input class="input-field" type="time" id="planner-add-time" value="${prefillTime || '15:30'}" style="color:var(--text-primary)">
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">⏰ 종료</label>
            <input class="input-field" type="time" id="planner-add-endtime" value="${prefillTime ? addHour(prefillTime) : '16:30'}" style="color:var(--text-primary)">
          </div>
        </div>

        <!-- AI Suggestion -->
        <div class="ai-plan-card">
          <div class="ai-header">
            <span class="ai-icon">🤖</span>
            <span class="ai-title">정율 추천</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-top:8px">
            지금 <strong style="color:var(--primary-light)">15:30~16:30</strong>이 비어있어요. 수학 과제가 D-5이니까 이 시간에 진행하면 좋겠어요! 📐
          </p>
        </div>

        <button class="btn-primary" onclick="addPlannerItem()">
          일정 추가 완료 ✨
        </button>
      </div>
    </div>
  `;
}

// ---- PLANNER UTILITIES ----

function shiftPlannerDate(offset) {
  const d = new Date(state.plannerDate);
  d.setDate(d.getDate() + offset);
  state.plannerDate = d.toISOString().split('T')[0];
  renderScreen();
}

function shiftPlannerWeek(offset) {
  const d = new Date(state.plannerDate);
  d.setDate(d.getDate() + (offset * 7));
  state.plannerDate = d.toISOString().split('T')[0];
  renderScreen();
}

function shiftPlannerMonth(offset) {
  const d = new Date(state.plannerDate);
  d.setMonth(d.getMonth() + offset);
  state.plannerDate = d.toISOString().split('T')[0];
  renderScreen();
}

function togglePlannerItem(id) {
  const item = state.plannerItems.find(i => i.id === id);
  if (item) {
    item.done = !item.done;
    renderScreen();
  }
}

// 과제 완료/미완료 토글
function toggleAssignmentDone(assignmentId) {
  const a = state.assignments.find(x => String(x.id) === String(assignmentId));
  if (!a) return;
  a.status = a.status === 'completed' ? 'pending' : 'completed';
  a.progress = a.status === 'completed' ? 100 : 0;
  
  // DB 업데이트
  if (a._dbId && DB.studentId()) {
    DB.updateAssignment(a._dbId, { status: a.status, progress: a.progress });
  }
  
  // plannerItems에서도 동기화
  const pItem = state.plannerItems.find(p => 
    p.category === 'assignment' && p.title === '[과제] ' + a.title && p.date === a.dueDate
  );
  if (pItem) pItem.done = a.status === 'completed';
  
  renderScreen();
  if (a.status === 'completed') {
    showXpPopup(5, '과제 완료! 📋');
  }
}

// 과제 삭제
function deletePlannerAssignment(assignmentId) {
  if (!confirm('이 과제를 삭제하시겠어요?')) return;
  
  const a = state.assignments.find(x => String(x.id) === String(assignmentId));
  if (!a) return;
  
  // state에서 삭제
  state.assignments = state.assignments.filter(x => String(x.id) !== String(assignmentId));
  
  // plannerItems에서도 삭제
  state.plannerItems = state.plannerItems.filter(p => 
    !(p.category === 'assignment' && p.title === '[과제] ' + a.title && p.date === a.dueDate)
  );
  
  // DB에서 삭제
  if (a._dbId && DB.studentId()) {
    fetch(`/api/student/assignments/${a._dbId}`, { method: 'DELETE' }).catch(() => {});
  }
  
  renderScreen();
}

function openPlannerAdd(date, time) {
  state.plannerDate = date;
  state._addTime = time;
  goScreen('planner-add');
}

function addHour(timeStr) {
  if (!timeStr) return '16:30';
  const [h, m] = timeStr.split(':').map(Number);
  return `${String(Math.min(h + 1, 23)).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function addPlannerItem() {
  const catBtn = document.querySelector('#planner-cat-chips .planner-cat-btn.active');
  const title = document.getElementById('planner-add-title')?.value || '';
  const detail = document.getElementById('planner-add-detail')?.value || '';
  const date = document.getElementById('planner-add-date')?.value || state.plannerDate;
  const time = document.getElementById('planner-add-time')?.value || '15:30';
  const endTime = document.getElementById('planner-add-endtime')?.value || '16:30';
  const category = catBtn ? catBtn.dataset.pcat : 'personal';

  const catMeta = {
    study:{color:'#6C5CE7',icon:'📝'}, assignment:{color:'#FF9F43',icon:'📋'},
    explore:{color:'#FF6B6B',icon:'🔬'}, academy:{color:'#E056A0',icon:'🏢'},
    activity:{color:'#00CEC9',icon:'🏫'},
    personal:{color:'#636e72',icon:'🎯'}, routine:{color:'#A29BFE',icon:'☀️'},
  };
  const meta = catMeta[category] || catMeta.personal;

  const newId = 'p' + (state.plannerItems.length + 100);
  state.plannerItems.push({
    id: newId, date, time, endTime,
    title: title || '새 일정',
    category, color: meta.color, icon: meta.icon,
    done: false, aiGenerated: false,
    detail: detail || undefined,
  });

  state.plannerDate = date;
  state.plannerView = 'daily';
  showXpPopup(5, '일정이 추가되었어요!');
}

function sendAiMessage(text) {
  if (!text || !text.trim()) return;
  state.plannerAiMessages.push({ role:'user', text: text.trim() });

  // AI 응답 시뮬레이션
  const responses = {
    '오늘 남은 일정 정리해줘': '오늘 남은 일정이에요 📋\n\n• 15:30 수학 과제 (11~15번)\n• 16:30 영어 에세이 서론/결론\n• 17:30 코딩동아리\n• 19:00 수학 복습\n• 20:00 저녁 루틴\n\n수학 과제부터 시작하면 시간 배분이 딱 맞을 거예요! 💪',
    '내일 공부 계획 짜줘': '내일(일요일) 계획을 짜봤어요 📅\n\n• 09:00~10:30 영어 에세이 마무리 (D-2!)\n• 10:30~12:00 치환적분 탐구 주제 정리\n• 14:00~15:30 자유 독서\n• 16:00~17:00 이서연 수학 가르치기\n\n영어 에세이 마감이 모레라서 오전에 끝내는 게 좋겠어요! ✅',
    '과제 마감 일정 확인': '진행 중인 과제 마감일이에요 🚨\n\n• 영어 에세이 → <strong>D-3 (2/18)</strong> 🟡\n• 수학 문제풀이 → D-5 (2/20)\n• 과학 보고서 → D-10 (2/25)\n\n영어 에세이에 집중하는 게 좋겠어요! 내일까지 서론/결론만 끝내면 여유 생겨요 👍',
    '이번 주 비는 시간 찾아줘': `이번 주 자유 시간이에요 ⏰\n\n• 토(오늘) 18:30~19:00 (30분)\n• 일 12:00~14:00 (2시간)\n• 일 17:00~ (자유)\n• 월 방과후 15:10~${state.timetable.academy.find(a=>a.day==='월')?state.timetable.academy.find(a=>a.day==='월').startTime:'자유'}\n• 화 방과후 16:00~\n${state.timetable.academy.length > 0 ? '\n⚠️ 학원 일정 고려: ' + state.timetable.academy.map(a=>a.day+' '+a.startTime+'~'+a.endTime).join(', ') : ''}\n\n학원 일정을 제외한 비는 시간에 과제나 복습을 추천해요! 📚`,
  };

  const academyToday = state.timetable.academy.length > 0 ? `\n학원 일정: ${state.timetable.academy.map(a=>`${a.day} ${a.name}(${a.startTime})`).join(', ')}` : '';
  const aiReply = responses[text.trim()] || `"${text.trim()}" 에 대해 확인해볼게요! 🔍\n\n현재 ${state.assignments.filter(a=>a.status!=='completed').length}개의 진행 중 과제와 ${state.plannerItems.filter(i=>i.date===state.plannerDate&&!i.done).length}개의 오늘 일정이 있어요.${academyToday}\n\n구체적으로 어떤 부분을 도와줄까요?`;

  setTimeout(() => {
    state.plannerAiMessages.push({ role:'ai', text: aiReply });
    renderScreen();
    // 스크롤 하단
    const msgBox = document.querySelector('.pai-messages');
    if (msgBox) msgBox.scrollTop = msgBox.scrollHeight;
  }, 500);

  renderScreen();
}

// ==================== GROWTH TAB (G-01~G-05) ====================

function renderGrowthTab() {
  // 2축 9단계 기반 성장 데이터
  const curiosityDist = [
    {id:'A-1', label:'A-1 뭐지?', pct:10, color:'var(--question-a)'},
    {id:'A-2', label:'A-2 어떻게?', pct:8, color:'var(--question-a)'},
    {id:'B-1', label:'B-1 왜?', pct:30, color:'var(--question-b)'},
    {id:'B-2', label:'B-2 만약에?', pct:22, color:'var(--question-b)'},
    {id:'C-1', label:'C-1 뭐가 더 나아?', pct:18, color:'var(--question-c)'},
    {id:'C-2', label:'C-2 그러면?', pct:12, color:'var(--question-c)'},
  ];
  const reflectionDist = [
    {id:'R-1', label:'R-1 어디서 틀렸지?', pct:35, color:'#E056A0'},
    {id:'R-2', label:'R-2 왜 틀렸지?', pct:40, color:'#C044CC'},
    {id:'R-3', label:'R-3 다음엔 어떻게?', pct:25, color:'#9B59B6'},
  ];
  const bcPct = 30 + 22 + 18 + 12; // B+C = 82%
  const r23Pct = 40 + 25; // R-2 + R-3 = 65%
  const curiosityStars = bcPct >= 80 ? 5 : bcPct >= 60 ? 4 : bcPct >= 40 ? 3 : bcPct >= 20 ? 2 : 1;
  const analysisStars = r23Pct >= 80 ? 5 : r23Pct >= 60 ? 4 : r23Pct >= 40 ? 3 : r23Pct >= 20 ? 2 : 1;

  return `
    <div class="tab-content animate-in">
      <div class="screen-header">
        <h1>📈 나의 성장</h1>
      </div>

      <!-- 성장 카드 스탯 (2축 기반) -->
      <div class="card stagger-1 animate-in">
        <div class="card-title">🃏 2축 성장 카드</div>
        <div class="growth-stats-2axis">
          <div class="growth-stat-box">
            <div class="growth-stat-header">
              <span class="growth-stat-icon">🪜</span>
              <span>탐구력</span>
            </div>
            <div class="growth-stat-stars">
              ${'★'.repeat(curiosityStars)}${'☆'.repeat(5-curiosityStars)}
            </div>
            <div class="growth-stat-detail">B+C 비율: ${bcPct}%</div>
            <div class="growth-stat-sub">호기심 사다리 분포</div>
          </div>
          <div class="growth-stat-box">
            <div class="growth-stat-header">
              <span class="growth-stat-icon">🪞</span>
              <span>분석력</span>
            </div>
            <div class="growth-stat-stars">
              ${'★'.repeat(analysisStars)}${'☆'.repeat(5-analysisStars)}
            </div>
            <div class="growth-stat-detail">R-2+R-3 비율: ${r23Pct}%</div>
            <div class="growth-stat-sub">성찰 질문 분포</div>
          </div>
        </div>
      </div>

      <!-- 축1: 호기심 사다리 분포 -->
      <div class="card stagger-2 animate-in">
        <div class="card-header-row">
          <span class="card-title">🪜 호기심 사다리 분포</span>
          <span class="card-subtitle">이번 달</span>
        </div>
        ${curiosityDist.map(q => `
          <div class="q-dist-row">
            <span class="q-dist-label">${q.label}</span>
            <div class="q-dist-bar"><div class="q-dist-fill" style="width:${q.pct}%;background:${q.color}"></div></div>
            <span class="q-dist-pct">${q.pct}%</span>
          </div>
        `).join('')}
        <div class="success-badge">B+C 비율: ${bcPct}% 🎯 (목표 40% 달성!)</div>
      </div>

      <!-- 축2: 성찰 질문 분포 -->
      <div class="card stagger-3 animate-in">
        <div class="card-header-row">
          <span class="card-title">🪞 성찰 질문 분포</span>
          <span class="card-subtitle">이번 달</span>
        </div>
        ${reflectionDist.map(q => `
          <div class="q-dist-row">
            <span class="q-dist-label">${q.label}</span>
            <div class="q-dist-bar"><div class="q-dist-fill" style="width:${q.pct}%;background:${q.color}"></div></div>
            <span class="q-dist-pct">${q.pct}%</span>
          </div>
        `).join('')}
        <div class="success-badge" style="background:rgba(192,68,204,0.12);color:#C044CC">R-2+R-3 비율: ${r23Pct}% 🎯</div>
      </div>

      <!-- 질문 진화 콤보 (2축 기반) -->
      <div class="card stagger-4 animate-in">
        <div class="card-title">🏆 질문 진화 콤보</div>
        <div class="combo-card">
          <div class="combo-header">
            <span>수학 "치환적분" — 사고의 심연 돌파! 🎉</span>
            <span class="combo-complete">+50 XP</span>
          </div>
          <div class="combo-flow">
            <span class="q-level q-level-a">A-2 어떻게?</span>
            <i class="fas fa-arrow-right combo-arrow"></i>
            <span class="q-level q-level-b">B-1 왜?</span>
            <i class="fas fa-arrow-right combo-arrow"></i>
            <span class="q-level q-level-c">C-1 뭐가 더 나아?</span>
            <span class="combo-bonus">🏆 레어 뱃지!</span>
          </div>
        </div>
        <div class="combo-card" style="margin-top:8px;border-color:rgba(192,68,204,0.3)">
          <div class="combo-header">
            <span>영어 "관계대명사" — 완벽한 성찰! 🪞</span>
            <span class="combo-complete" style="color:#C044CC">+40 XP</span>
          </div>
          <div class="combo-flow">
            <span class="q-level" style="background:rgba(224,86,160,0.15);color:#E056A0">R-1</span>
            <i class="fas fa-arrow-right combo-arrow"></i>
            <span class="q-level" style="background:rgba(192,68,204,0.15);color:#C044CC">R-2</span>
            <i class="fas fa-arrow-right combo-arrow"></i>
            <span class="q-level" style="background:rgba(155,89,182,0.15);color:#9B59B6">R-3</span>
            <span class="combo-bonus">🔍 분석력 뱃지!</span>
          </div>
        </div>
        <div class="combo-card" style="margin-top:8px;border-color:rgba(253,203,110,0.3)">
          <div class="combo-header">
            <span>과학 "산화환원" — 진행 중...</span>
            <span class="combo-progress">B-1까지</span>
          </div>
          <div class="combo-flow">
            <span class="q-level q-level-a">A-1</span>
            <i class="fas fa-arrow-right combo-arrow"></i>
            <span class="q-level q-level-b">B-1</span>
            <i class="fas fa-arrow-right combo-arrow"></i>
            <span class="combo-next">다음: B-2+ 도전!</span>
          </div>
        </div>
      </div>

      <!-- 효과 측정 지표 -->
      <div class="card stagger-5 animate-in">
        <div class="card-title">📊 핵심 효과 지표</div>
        <div class="kpi-grid">
          <div class="kpi-item">
            <span class="kpi-value" style="color:var(--question-c)">${bcPct}%</span>
            <span class="kpi-label">B+C 질문 비율</span>
            <span class="kpi-target">목표 40%</span>
          </div>
          <div class="kpi-item">
            <span class="kpi-value" style="color:var(--primary-light)">68%</span>
            <span class="kpi-label">자기 생각 동반률</span>
            <span class="kpi-target">목표 60%</span>
          </div>
          <div class="kpi-item">
            <span class="kpi-value" style="color:var(--accent)">54%</span>
            <span class="kpi-label">도전 선택률</span>
            <span class="kpi-target">목표 50%</span>
          </div>
          <div class="kpi-item">
            <span class="kpi-value" style="color:var(--teach-green)">45%</span>
            <span class="kpi-label">자발적 B+ 비율</span>
            <span class="kpi-target">목표 40%</span>
          </div>
        </div>
      </div>

      <!-- 나만의 질문방 통계 -->
      <div class="card stagger-6 animate-in">
        <div class="card-header-row">
          <span class="card-title">❓ 나만의 질문방</span>
          <button class="card-link" onclick="state.studentTab='myqa';goScreen('main')">전체보기 →</button>
        </div>
        <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr)">
          <div class="kpi-item">
            <span class="kpi-value" style="color:var(--primary-light)">${state.myQaStats?.total || 0}</span>
            <span class="kpi-label">총 질문</span>
          </div>
          <div class="kpi-item">
            <span class="kpi-value" style="color:var(--accent)">${state.myQaStats?.unanswered || 0}</span>
            <span class="kpi-label">미답변</span>
          </div>
          <div class="kpi-item">
            <span class="kpi-value" style="color:var(--success)">${state.myQaStats?.avgResolveDays || '-'}</span>
            <span class="kpi-label">평균 해결일</span>
          </div>
        </div>
        ${(state.myQaStats?.subjectStats || []).length > 0 ? `
        <div style="margin-top:10px;font-size:11px;color:var(--text-muted)">
          가장 많이 질문한 과목: ${(state.myQaStats.subjectStats || []).map(s => `${s.subject}(${s.cnt})`).slice(0,3).join(', ')}
        </div>` : ''}
      </div>

      <div class="card stagger-7 animate-in">
        <div class="card-title">🤝 교학상장 통계</div>
        <div class="teach-stat-grid">
          <div class="teach-stat-item">
            <span class="teach-stat-num" style="color:var(--teach-green)">12</span>
            <span>이번 달 가르침</span>
          </div>
          <div class="teach-stat-item">
            <span class="teach-stat-num" style="color:var(--primary-light)">7</span>
            <span>도움 준 친구</span>
          </div>
        </div>
        <p style="font-size:12px;color:var(--text-secondary);margin-top:8px">주로 가르치는 과목: 수학(8), 과학(4)</p>
      </div>

      <div class="card stagger-8 animate-in">
        <div class="card-title">📚 과목별 기록 현황</div>
        ${[
          {subject:'수학', records:32, questions:15, bc:'72%', color:'#6C5CE7'},
          {subject:'영어', records:28, questions:8, bc:'48%', color:'#00B894'},
          {subject:'과학', records:24, questions:10, bc:'60%', color:'#FDCB6E'},
          {subject:'국어', records:26, questions:6, bc:'42%', color:'#FF6B6B'},
          {subject:'한국사', records:20, questions:3, bc:'20%', color:'#74B9FF'},
        ].map(s => `
          <div class="subject-record-row">
            <div class="subject-dot" style="background:${s.color}"></div>
            <span class="subject-name">${s.subject}</span>
            <span class="subject-stat">기록 ${s.records}</span>
            <span class="subject-stat">질문 ${s.questions}</span>
            <span class="subject-bc">B+C ${s.bc}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// ==================== 나만의 질문방 (QA앱 iframe) ====================

const QA_APP_URL = 'https://qa-tutoring-app.pages.dev';

// 질문 통계 (홈/성장 탭 표시용)
if (!state.myQaStats) state.myQaStats = { total: 0, unanswered: 0, answered: 0, weeklyQuestions: 0, weeklyAnswered: 0 };

async function loadMyQaStats() {
  const studentId = state._authUser?.id;
  if (!studentId) return;
  try {
    const res = await fetch(`/api/my-questions/stats?studentId=${studentId}`);
    state.myQaStats = await res.json();
  } catch (e) {}
}

// QA앱을 iframe으로 전체화면 열기
// targetPath: 선택적 경로 (예: '/new' → 질문 등록 화면)
async function openMyQaIframe(targetPath) {
  // 이미 열려있으면 무시
  if (document.getElementById('myqa-iframe-overlay')) return;

  const studentId = state._authUser?.id;
  const studentName = state._authUser?.name || '학생';
  const basePath = targetPath || '';
  
  let qaUrl = QA_APP_URL + basePath;

  // 자동 로그인 토큰 발급
  if (studentId) {
    try {
      const res = await fetch('/api/qa-auth-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId })
      });
      const data = await res.json();
      if (data.success) {
        // QA앱에 외부 인증 파라미터 전달
        const params = new URLSearchParams({
          ext_auth: '1',
          user_id: data.userId,
          nick_name: data.nickName,
          timestamp: data.timestamp,
          signature: data.signature,
          from: 'creditplanner'
        });
        // 목록 화면일 때만 내 질문 필터 자동 적용
        if (!targetPath) params.set('filter', 'my');
        qaUrl = QA_APP_URL + basePath + '?' + params.toString();
      }
    } catch (e) {
      console.error('QA 토큰 발급 실패:', e);
    }
  }

  // 진입 전 현재 탭/화면 저장 (돌아가기용)
  const returnTab = state.studentTab;
  const returnScreen = state.currentScreen;

  // iframe 오버레이 생성
  const overlay = document.createElement('div');
  overlay.id = 'myqa-iframe-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:9999;background:var(--bg-main,#1a1a2e);display:flex;flex-direction:column';

  // 상단 바
  const topBar = document.createElement('div');
  topBar.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:rgba(0,0,0,0.6);backdrop-filter:blur(10px);border-bottom:1px solid rgba(255,255,255,0.1);flex-shrink:0';
  
  const leftGroup = document.createElement('div');
  leftGroup.style.cssText = 'display:flex;align-items:center;gap:10px';

  const titleLabel = targetPath === '/new' ? '✏️ 질문 등록' : '❓ 나만의 질문방';
  const title = document.createElement('span');
  title.innerHTML = titleLabel;
  title.style.cssText = 'font-size:15px;font-weight:700;color:#fff';

  leftGroup.appendChild(title);
  topBar.appendChild(leftGroup);

  // 새 탭 열기 버튼
  const extBtn = document.createElement('button');
  extBtn.innerHTML = '<i class="fas fa-external-link-alt"></i>';
  extBtn.title = '새 탭에서 열기';
  extBtn.style.cssText = 'width:36px;height:36px;border-radius:50%;border:1px solid rgba(255,255,255,0.15);background:rgba(255,255,255,0.05);color:#fff;cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;transition:all 0.2s';
  extBtn.onmouseover = () => { extBtn.style.background = 'rgba(255,255,255,0.15)'; };
  extBtn.onmouseout = () => { extBtn.style.background = 'rgba(255,255,255,0.05)'; };
  extBtn.onclick = () => window.open(qaUrl, '_blank');
  topBar.appendChild(extBtn);

  overlay.appendChild(topBar);

  // iframe
  const iframe = document.createElement('iframe');
  iframe.src = qaUrl;
  iframe.style.cssText = 'flex:1;width:100%;border:none;background:#1a1a2e';
  iframe.allow = 'camera;microphone';
  overlay.appendChild(iframe);

  // 하단 고정 돌아가기 버튼 (iframe 헤더와 겹치지 않도록)
  const backBtn = document.createElement('button');
  backBtn.innerHTML = '<i class="fas fa-arrow-left" style="margin-right:6px"></i> 플래너로 돌아가기';
  backBtn.style.cssText = 'position:fixed;bottom:max(20px,env(safe-area-inset-bottom,20px));left:16px;z-index:10000;padding:10px 20px;background:rgba(108,92,231,0.9);color:#fff;border:none;border-radius:24px;font-size:13px;font-weight:700;cursor:pointer;font-family:inherit;box-shadow:0 4px 16px rgba(108,92,231,0.4);transition:all 0.2s;backdrop-filter:blur(8px)';
  backBtn.onmouseover = () => { backBtn.style.background = 'rgba(108,92,231,1)'; backBtn.style.transform = 'scale(1.05)'; };
  backBtn.onmouseout = () => { backBtn.style.background = 'rgba(108,92,231,0.9)'; backBtn.style.transform = 'scale(1)'; };
  backBtn.onclick = () => {
    overlay.remove();
    backBtn.remove();
    state.studentTab = returnTab;
    state.currentScreen = returnScreen;
    loadMyQaStats(); // 통계 갱신
    renderScreen();
  };

  document.body.appendChild(overlay);
  document.body.appendChild(backBtn);
}

// 시간표에서 질문 등록 시 QA앱 iframe으로 이동
function openQuestionFromTimetable(subject, period) {
  openMyQaIframe();
}


// ==================== COMMUNITY TAB (Iframe) ====================

function getCommunityUrl() {
  return 'https://jungyoul-academy.pages.dev/community?inapp=true';
}

function openCommunityNewTab() {
  window.open(getCommunityUrl(), '_blank', 'noopener');
}

function renderCommunityTab() {
  // 자동으로 새 탭에서 열기 (첫 진입 시)
  if (!state._communityOpened) {
    state._communityOpened = true;
    setTimeout(() => openCommunityNewTab(), 300);
  }

  return `
    <div class="community-landing animate-in">
      <div class="community-landing-card">
        <div class="community-landing-icon">💬</div>
        <h2 class="community-landing-title">정율 커뮤니티</h2>
        <p class="community-landing-desc">공지사항, 학습 꿀팁, 질문을 자유롭게 나눠보세요.<br>새 탭에서 커뮤니티가 열렸습니다.</p>
        <button class="community-open-btn" onclick="openCommunityNewTab()">
          <i class="fas fa-external-link-alt"></i> 커뮤니티 열기
        </button>
        <div class="community-landing-features">
          <div class="community-feat"><i class="fas fa-bullhorn"></i><span>📌 공지사항</span></div>
          <div class="community-feat"><i class="fas fa-comments"></i><span>💬 자유게시판</span></div>
          <div class="community-feat"><i class="fas fa-question-circle"></i><span>❓ 질문게시판</span></div>
        </div>
      </div>
    </div>
  `;
}

// ==================== MY TAB (M-01~M-05) ====================

function renderMyTab() {
  const userName = state._authUser?.name || '학생';
  const userEmoji = state._authUser?.emoji || '🎓';
  const userSchool = state._authUser?.school_name || '';
  const userGrade = state._authUser?.grade || '';
  const schoolInfo = userSchool ? `${userSchool}${userGrade ? ' ' + userGrade : ''}` : '';

  // 레벨 계산
  const currentLevel = state.level || 1;
  const xpPerLevel = 100;
  const currentLevelXp = state.xp % xpPerLevel;
  const nextLevelRemain = xpPerLevel - currentLevelXp;
  const levelPct = Math.round((currentLevelXp / xpPerLevel) * 100);
  const tierNames = ['탐험가','학습자','연구자','멘토','설계자','개척자'];
  const tierIdx = Math.min(Math.floor((currentLevel - 1) / 5), 5);
  const currentTierName = tierNames[tierIdx] || '탐험가';

  return `
    <div class="tab-content animate-in">
      <div class="screen-header">
        <h1>🎮 마이</h1>
      </div>

      <div class="card profile-card stagger-1 animate-in">
        <div class="profile-academy-badge">
          <img src="/static/logo.png" alt="정율사관학원" class="profile-academy-logo">
        </div>
        <div class="profile-avatar">
          <span>${userEmoji}</span>
        </div>
        <h2 class="profile-name">${userName}</h2>
        <p class="profile-title">Lv.${currentLevel} ${currentTierName}</p>
        ${schoolInfo ? `<p class="profile-school">${schoolInfo}</p>` : ''}
        <div class="profile-stats">
          <div class="profile-stat">
            <span class="profile-stat-value" style="color:var(--xp-gold)">${state.xp.toLocaleString()}</span>
            <span class="profile-stat-label">총 XP</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value" style="color:var(--streak-fire)">🔥${state.streak}</span>
            <span class="profile-stat-label">스트릭</span>
          </div>
          <div class="profile-stat">
            <span class="profile-stat-value" id="my-total-records">-</span>
            <span class="profile-stat-label">총 기록</span>
          </div>
        </div>
      </div>

      <div class="card stagger-2 animate-in">
        <div class="card-title">🏅 레벨 진행</div>
        <div class="level-progress-header">
          <span>Lv.${currentLevel} ${currentTierName}</span>
          <span style="color:var(--text-muted)">Lv.${currentLevel+1}까지 ${nextLevelRemain} XP</span>
        </div>
        <div class="progress-bar" style="height:12px;border-radius:6px">
          <div class="progress-fill level-fill" style="width:${levelPct}%"></div>
        </div>
        <div class="level-tier-row">
          ${[
            {range:'1-5', name:'탐험가'},
            {range:'6-10', name:'학습자'},
            {range:'11-15', name:'연구자'},
            {range:'16-20', name:'멘토'},
            {range:'21-25', name:'설계자'},
            {range:'26-30', name:'개척자'},
          ].map((t,i) => `
            <span class="level-tier ${i===tierIdx?'active':''}">${t.name}</span>
          `).join('')}
        </div>
      </div>

      <!-- XP 상세 내역 -->
      <div class="card stagger-3 animate-in">
        <div class="card-header-row">
          <span class="card-title">💰 XP 적립 내역</span>
          <button class="btn-ghost" style="font-size:12px" onclick="loadXpHistory()">새로고침</button>
        </div>
        
        <!-- 소스별 요약 -->
        <div id="xp-summary" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">
          <div style="padding:6px 12px;border-radius:8px;background:rgba(108,92,231,0.1);color:var(--text-muted);font-size:11px">로딩 중...</div>
        </div>

        <!-- 내역 리스트 -->
        <div id="xp-history-list" style="display:flex;flex-direction:column;gap:2px;max-height:400px;overflow-y:auto">
        </div>
        
        <div id="xp-history-more" style="display:none;text-align:center;padding:8px">
          <button class="btn-ghost" style="font-size:12px" onclick="loadMoreXpHistory()">더보기</button>
        </div>
      </div>

      <div class="card stagger-4 animate-in">
        <div class="card-header-row">
          <span class="card-title">🏆 업적 뱃지</span>
          <span class="card-subtitle">5/9 획득</span>
        </div>
        <div class="badge-grid">
          ${[
            {icon:'❓', name:'첫 질문', earned:true},
            {icon:'🔥', name:'7일 스트릭', earned:true},
            {icon:'🤝', name:'첫 번째 스승', earned:true},
            {icon:'🏆', name:'사고의 심연 돌파', earned:true, desc:'A→B→C 완주'},
            {icon:'🔍', name:'완벽한 성찰', earned:true, desc:'R-1→R-2→R-3'},
            {icon:'🌟', name:'완전한 사고자', earned:false, desc:'C-2 + R-3'},
            {icon:'⏰', name:'10시간 나눔', earned:false},
            {icon:'🔒', name:'30일 스트릭', earned:false, locked:true},
            {icon:'🔒', name:'질문 마스터', earned:false, locked:true, desc:'B+ 100개'},
          ].map(b => `
            <div class="badge-item ${b.earned?'earned':''} ${b.locked?'locked':''}">
              <span class="badge-icon">${b.icon}</span>
              <span class="badge-name">${b.name}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <div class="card stagger-4 animate-in">
        <div class="card-title">🔥 스트릭 현황</div>
        <div class="streak-display">
          <span class="streak-number">🔥 ${state.streak}일</span>
          <p>연속 기록 중! 대단해요!</p>
        </div>
        <div class="streak-milestones">
          ${[3,7,14,30].map(d => `
            <div class="streak-milestone ${state.streak>=d?'reached':''}">
              ${d}일 ${state.streak>=d?'✅':'🔒'}
            </div>
          `).join('')}
        </div>
        <div class="pause-card-info">
          😴 쉼표 카드 (주 1회) — 하루 쉬어도 스트릭 유지!
        </div>
      </div>

      <!-- 시간표 관리 메뉴 -->
      <div class="card stagger-5 animate-in">
        <div class="card-title">⚙️ 관리</div>
        <div class="my-menu-list">
          <div class="my-menu-item" onclick="goScreen('timetable-manage')">
            <div class="my-menu-icon" style="background:rgba(108,92,231,0.15)"><i class="fas fa-calendar-alt" style="color:var(--primary-light)"></i></div>
            <div class="my-menu-text">
              <span class="my-menu-title">📋 시간표 관리</span>
              <span class="my-menu-desc">학교 시간표 수정 & 학원 스케줄 관리</span>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--text-muted)"></i>
          </div>
          <div class="my-menu-item" onclick="goScreen('assignment-list')">
            <div class="my-menu-icon" style="background:rgba(255,159,67,0.15)"><i class="fas fa-clipboard-list" style="color:#FF9F43"></i></div>
            <div class="my-menu-text">
              <span class="my-menu-title">📋 과제 관리</span>
              <span class="my-menu-desc">진행중 ${state.assignments.filter(a=>a.status!=='completed').length}개</span>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--text-muted)"></i>
          </div>
          <div class="my-menu-item" onclick="goScreen('classmate-manage')">
            <div class="my-menu-icon" style="background:rgba(0,184,148,0.15)"><i class="fas fa-users" style="color:#00B894"></i></div>
            <div class="my-menu-text">
              <span class="my-menu-title">👥 학생 관리</span>
              <span class="my-menu-desc">교학상장 대상 ${state.classmates.length}명</span>
            </div>
            <i class="fas fa-chevron-right" style="color:var(--text-muted)"></i>
          </div>
        </div>
      </div>

      <div class="card stagger-6 animate-in">
        <div class="card-title">🃏 성장 카드</div>
        <div class="growth-card-preview">
          ${[
            {label:'탐구력 (B+C)', pct:82, color:'var(--question-c)'},
            {label:'분석력 (R-2+3)', pct:65, color:'#C044CC'},
            {label:'리더십', pct:82, color:'var(--teach-green)'},
            {label:'지구력', pct:90, color:'var(--streak-fire)'},
            {label:'자기생각률', pct:68, color:'var(--primary-light)'},
          ].map(s => `
            <div class="gc-stat">
              <span class="gc-label">${s.label}</span>
              <div class="gc-bar"><div class="gc-fill" style="width:${s.pct}%;background:${s.color}"></div></div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ==================== XP HISTORY (XP 적립 내역) ====================

let _xpHistoryOffset = 0;
const _xpHistoryLimit = 20;
let _xpHistoryHasMore = false;

const XP_SOURCE_META = {
  '수업 기록':     { icon: '📝', color: '#6C5CE7' },
  '질문 코칭':     { icon: '🧠', color: '#E17055' },
  '교학상장':      { icon: '🤝', color: '#00B894' },
  '창의적 체험활동': { icon: '🎨', color: '#FDCB6E' },
  '질문 등록':     { icon: '❓', color: '#0984E3' },
  '답변 등록':     { icon: '💬', color: '#00CEC9' },
  '과제 기록':     { icon: '📋', color: '#FF9F43' },
  '시험 관리':     { icon: '📊', color: '#A29BFE' },
};

function getXpSourceMeta(source) {
  return XP_SOURCE_META[source] || { icon: '⭐', color: '#8B949E' };
}

function formatXpDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return '방금 전';
  if (diffMin < 60) return `${diffMin}분 전`;
  if (diffHr < 24) return `${diffHr}시간 전`;
  if (diffDay < 7) return `${diffDay}일 전`;
  return `${d.getMonth()+1}/${d.getDate()}`;
}

async function loadXpHistory() {
  const sid = DB.studentId();
  if (!sid) {
    const summaryEl = document.getElementById('xp-summary');
    const listEl = document.getElementById('xp-history-list');
    if (summaryEl) summaryEl.innerHTML = '<div style="padding:6px 12px;border-radius:8px;background:rgba(139,148,158,0.1);color:var(--text-muted);font-size:11px">로그인 후 확인할 수 있습니다</div>';
    if (listEl) listEl.innerHTML = '';
    return;
  }

  _xpHistoryOffset = 0;
  try {
    const res = await fetch(`/api/student/${sid}/xp-history?limit=${_xpHistoryLimit}&offset=0`);
    const data = await res.json();

    // 소스별 요약 렌더링
    const summaryEl = document.getElementById('xp-summary');
    if (summaryEl) {
      if (data.summary && data.summary.length > 0) {
        summaryEl.innerHTML = data.summary.map(s => {
          const meta = getXpSourceMeta(s.source);
          return `<div style="display:inline-flex;align-items:center;gap:4px;padding:5px 10px;border-radius:8px;background:rgba(${hexToRgb(meta.color)},0.12);font-size:11px;font-weight:600;color:${meta.color}">
            <span>${meta.icon}</span>
            <span>${s.source}</span>
            <span style="font-weight:700">+${s.total_xp}</span>
            <span style="opacity:0.6;font-size:10px">(${s.count}회)</span>
          </div>`;
        }).join('');
      } else {
        summaryEl.innerHTML = '<div style="padding:6px 12px;border-radius:8px;background:rgba(139,148,158,0.1);color:var(--text-muted);font-size:11px">아직 XP 적립 내역이 없습니다</div>';
      }
    }

    // 히스토리 리스트 렌더링
    const listEl = document.getElementById('xp-history-list');
    if (listEl) {
      if (data.history && data.history.length > 0) {
        listEl.innerHTML = renderXpHistoryItems(data.history);
      } else {
        listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:13px">아직 XP 적립 내역이 없어요.<br>수업 기록, 질문 코칭 등 활동을 시작해보세요! 🚀</div>';
      }
    }

    // 더보기 버튼
    _xpHistoryOffset = _xpHistoryLimit;
    _xpHistoryHasMore = data.history && data.history.length >= _xpHistoryLimit;
    const moreEl = document.getElementById('xp-history-more');
    if (moreEl) moreEl.style.display = _xpHistoryHasMore ? 'block' : 'none';

  } catch (e) {
    console.error('XP 내역 로드 실패:', e);
    const summaryEl = document.getElementById('xp-summary');
    if (summaryEl) summaryEl.innerHTML = '<div style="padding:6px 12px;border-radius:8px;background:rgba(139,148,158,0.1);color:var(--text-muted);font-size:11px">XP 내역을 불러올 수 없습니다</div>';
  }
}

async function loadMoreXpHistory() {
  const sid = DB.studentId();
  if (!sid || !_xpHistoryHasMore) return;

  try {
    const res = await fetch(`/api/student/${sid}/xp-history?limit=${_xpHistoryLimit}&offset=${_xpHistoryOffset}`);
    const data = await res.json();

    const listEl = document.getElementById('xp-history-list');
    if (listEl && data.history && data.history.length > 0) {
      listEl.insertAdjacentHTML('beforeend', renderXpHistoryItems(data.history));
    }

    _xpHistoryOffset += _xpHistoryLimit;
    _xpHistoryHasMore = data.history && data.history.length >= _xpHistoryLimit;
    const moreEl = document.getElementById('xp-history-more');
    if (moreEl) moreEl.style.display = _xpHistoryHasMore ? 'block' : 'none';

  } catch (e) {
    console.error('XP 내역 추가 로드 실패:', e);
  }
}

function renderXpHistoryItems(items) {
  return items.map(item => {
    const meta = getXpSourceMeta(item.source);
    const detail = item.source_detail ? `<span style="color:var(--text-muted);font-size:11px;margin-left:2px">· ${item.source_detail.length > 30 ? item.source_detail.slice(0,30)+'…' : item.source_detail}</span>` : '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:8px 4px;border-bottom:1px solid rgba(48,54,61,0.3)">
      <div style="width:32px;height:32px;border-radius:8px;background:rgba(${hexToRgb(meta.color)},0.15);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0">${meta.icon}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap">
          <span style="font-size:13px;font-weight:600;color:var(--text-primary)">${item.source}</span>
          ${detail}
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:1px">${formatXpDate(item.created_at)}</div>
      </div>
      <div style="font-size:14px;font-weight:700;color:${meta.color};flex-shrink:0">+${item.amount} XP</div>
    </div>`;
  }).join('');
}

// hex -> rgb 변환 헬퍼
function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1],16)},${parseInt(result[2],16)},${parseInt(result[3],16)}` : '139,148,158';
}

// ==================== CLASSMATE MANAGEMENT (학생 관리) ====================

function renderClassmateManage() {
  const classmates = state.classmates || [];
  const editing = state._editingClassmate; // null or classmate id
  const adding = state._addingClassmate;   // boolean
  
  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state._editingClassmate=null;state._addingClassmate=false;goScreen('main');state.studentTab='my'"><i class="fas fa-arrow-left"></i></button>
        <h1>👥 학생 관리</h1>
        <button class="header-action-btn" onclick="state._addingClassmate=true;state._editingClassmate=null;state._cmName='';state._cmGrade='';state._cmMemo='';renderScreen()">
          <i class="fas fa-user-plus"></i>
        </button>
      </div>

      <div class="form-body">
        <!-- 추가/편집 폼 -->
        ${adding || editing ? `
        <div class="card animate-in" style="border:2px solid var(--primary-light);margin-bottom:12px">
          <div class="card-title">${editing ? '✏️ 학생 정보 수정' : '➕ 새 학생 추가'}</div>
          <div class="field-group" style="margin-bottom:8px">
            <label class="field-label">이름 <span style="color:var(--primary)">*</span></label>
            <input class="input-field" id="cm-name" placeholder="학생 이름" value="${state._cmName || ''}">
          </div>
          <div class="field-group" style="margin-bottom:8px">
            <label class="field-label">학년/반</label>
            <input class="input-field" id="cm-grade" placeholder="예: 2-3" value="${state._cmGrade || ''}">
          </div>
          <div class="field-group" style="margin-bottom:8px">
            <label class="field-label">메모 (선택)</label>
            <input class="input-field" id="cm-memo" placeholder="예: 수학 같이 공부" value="${state._cmMemo || ''}">
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn-primary" style="flex:1" onclick="${editing ? `saveEditClassmate('${editing}')` : 'addClassmate()'}">
              <i class="fas fa-check"></i> ${editing ? '수정 완료' : '추가'}
            </button>
            <button class="btn-ghost" style="flex:0 0 auto" onclick="state._addingClassmate=false;state._editingClassmate=null;renderScreen()">취소</button>
          </div>
        </div>
        ` : ''}

        <!-- 학생 목록 -->
        <div class="card">
          <div class="card-title" style="display:flex;align-items:center;justify-content:space-between">
            <span>📋 등록된 학생 (${classmates.length}명)</span>
          </div>
          ${classmates.length === 0 ? `
          <div style="text-align:center;padding:24px 0;color:var(--text-muted)">
            <div style="font-size:32px;margin-bottom:8px">👥</div>
            <p style="font-size:12px">등록된 학생이 없습니다</p>
            <p style="font-size:11px;color:var(--text-muted);margin-top:4px">위의 <strong>+</strong> 버튼으로 학생을 추가하세요</p>
          </div>
          ` : `
          <div class="cm-list">
            ${classmates.map((c, i) => `
              <div class="cm-item stagger-${Math.min(i+1,6)} animate-in ${editing===c.id?'cm-item-editing':''}">
                <div class="cm-avatar" style="background:${getAvatarColor(i)}">${c.name[0]}</div>
                <div class="cm-info">
                  <div class="cm-name">${c.name}</div>
                  <div class="cm-detail">${c.grade}${c.memo ? ' · '+c.memo : ''}</div>
                </div>
                <div class="cm-actions">
                  <button class="cm-action-btn" onclick="startEditClassmate('${c.id}')" title="수정">
                    <i class="fas fa-pen"></i>
                  </button>
                  <button class="cm-action-btn cm-delete-btn" onclick="deleteClassmate('${c.id}','${c.name}')" title="삭제">
                    <i class="fas fa-trash"></i>
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
          `}
        </div>

        <div style="margin-top:12px;font-size:10px;color:var(--text-muted);text-align:center;line-height:1.6">
          💡 여기서 추가한 학생은 <strong>교학상장 기록</strong>에서 선택할 수 있습니다.<br>
          멘토 대시보드에서도 동일한 학생 목록이 표시됩니다.
        </div>
      </div>
    </div>
  `;
}

function getAvatarColor(index) {
  const colors = ['#6C5CE7','#00B894','#E056A0','#FDCB6E','#FF6B6B','#74B9FF','#A29BFE','#00CEC9','#E17055','#FD79A8'];
  return colors[index % colors.length];
}

function addClassmate() {
  const name = document.getElementById('cm-name')?.value.trim();
  const grade = document.getElementById('cm-grade')?.value.trim() || '';
  const memo = document.getElementById('cm-memo')?.value.trim() || '';
  
  if (!name) { alert('이름을 입력해주세요!'); return; }
  if (state.classmates.some(c => c.name === name && c.grade === grade)) {
    alert('이미 등록된 학생입니다!'); return;
  }
  
  const id = 'cm' + Date.now();
  state.classmates.push({ id, name, grade, memo });
  state._addingClassmate = false;
  state._cmName = ''; state._cmGrade = ''; state._cmMemo = '';
  renderScreen();
}

function startEditClassmate(id) {
  const c = state.classmates.find(x => x.id === id);
  if (!c) return;
  state._editingClassmate = id;
  state._addingClassmate = false;
  state._cmName = c.name;
  state._cmGrade = c.grade;
  state._cmMemo = c.memo || '';
  renderScreen();
}

function saveEditClassmate(id) {
  const name = document.getElementById('cm-name')?.value.trim();
  const grade = document.getElementById('cm-grade')?.value.trim() || '';
  const memo = document.getElementById('cm-memo')?.value.trim() || '';
  
  if (!name) { alert('이름을 입력해주세요!'); return; }
  
  const c = state.classmates.find(x => x.id === id);
  if (c) {
    c.name = name;
    c.grade = grade;
    c.memo = memo;
  }
  state._editingClassmate = null;
  state._cmName = ''; state._cmGrade = ''; state._cmMemo = '';
  renderScreen();
}

function deleteClassmate(id, name) {
  if (!confirm(`"${name}" 학생을 삭제할까요?`)) return;
  state.classmates = state.classmates.filter(c => c.id !== id);
  if (state._editingClassmate === id) state._editingClassmate = null;
  renderScreen();
}


// ==================== TIMETABLE MANAGEMENT ====================

function renderTimetableManage() {
  const days = ['월','화','수','목','금'];
  const acDays = ['월','화','수','목','금','토','일'];
  const tt = state.timetable;
  const subjectList = ['국어','수학','영어','과학','한국사','체육','미술','동아리','창체',''];
  const maxSlots = 4;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state.editingTimetable=false;state.selectedTtCell=null;state.selectedAcSlot=null;state.viewingAcademyDetail=null;goScreen('main');state.studentTab='my'"><i class="fas fa-arrow-left"></i></button>
        <h1>📋 시간표 관리</h1>
        <button class="header-action-btn" onclick="state.editingTimetable=!state.editingTimetable;state.selectedTtCell=null;state.selectedAcSlot=null;renderScreen()">
          <i class="fas ${state.editingTimetable ? 'fa-check' : 'fa-edit'}"></i>
          ${state.editingTimetable ? '완료' : '편집'}
        </button>
      </div>

      <div class="form-body">
        <!-- 학교 시간표 섹션 -->
        <div class="card animate-in" style="margin-bottom:16px">
          <div class="card-header-row">
            <span class="card-title">🏫 학교 시간표</span>
            ${state.editingTimetable ? '<span class="card-subtitle" style="color:var(--primary-light)">셀을 터치하여 수정</span>' : ''}
          </div>
          <div class="tt-editor">
            <div class="tt-editor-header"></div>
            ${days.map(d => `<div class="tt-editor-header">${d}</div>`).join('')}
            ${tt.school.map((row, pi) => `
              <div class="tt-editor-period">${pi+1}</div>
              ${row.map((s, di) => {
                const color = tt.subjectColors[s] || 'var(--text-muted)';
                const isSelected = state.selectedTtCell && state.selectedTtCell.period === pi && state.selectedTtCell.dayIdx === di;
                return `
                <div class="tt-editor-cell ${s?'filled':''} ${isSelected?'selected':''} ${state.editingTimetable?'editable':''}" 
                  ${s?`style="background:${color}22;color:${color};border-color:${color}44"`:''}
                  ${state.editingTimetable ? `onclick="selectTtCell(${pi},${di})"` : ''}>
                  ${s||'<i class="fas fa-plus" style="font-size:9px;opacity:0.3"></i>'}
                </div>`;
              }).join('')}
            `).join('')}
          </div>

          ${state.editingTimetable && state.selectedTtCell !== null ? `
          <div class="tt-edit-panel animate-in" style="margin-top:12px">
            <label class="field-label">과목 선택 (${state.selectedTtCell.period+1}교시 ${days[state.selectedTtCell.dayIdx]}요일)</label>
            <div class="tt-subject-selector">
              ${subjectList.map(s => {
                const color = tt.subjectColors[s] || 'var(--text-muted)';
                const current = tt.school[state.selectedTtCell.period][state.selectedTtCell.dayIdx];
                return `<button class="tt-subj-btn ${current===s?'active':''}" 
                  style="${s?`border-color:${color}44;color:${color}`:'color:var(--text-muted)'}" 
                  onclick="setTtSubject('${s}')">
                  ${s || '비움'}
                </button>`;
              }).join('')}
            </div>
            <div class="field-group" style="margin-top:8px">
              <label class="field-label">👨‍🏫 담당 선생님</label>
              <input class="input-field" id="tt-teacher-input" 
                placeholder="선생님 이름" 
                value="${tt.teachers[tt.school[state.selectedTtCell.period][state.selectedTtCell.dayIdx]] || ''}"
                onchange="setTtTeacher(this.value)">
            </div>
          </div>
          ` : ''}
        </div>

        <!-- 학원 시간표 그리드 섹션 -->
        <div class="card animate-in" style="margin-bottom:16px">
          <div class="card-header-row">
            <span class="card-title">🏢 학원 시간표</span>
            ${state.editingTimetable ? '<span class="card-subtitle" style="color:#E056A0">빈 칸을 터치하여 추가</span>' : '<span class="card-subtitle">클릭하여 상세보기</span>'}
          </div>
          <div class="ac-grid">
            <!-- 헤더 -->
            <div class="ac-grid-header"></div>
            ${acDays.map(d => `<div class="ac-grid-header ${d==='토'||d==='일'?'weekend':''}">${d}</div>`).join('')}
            <!-- 슬롯 rows -->
            ${Array.from({length: maxSlots}, (_, slotIdx) => `
              <div class="ac-grid-period">${slotIdx+1}</div>
              ${acDays.map(day => {
                const ac = tt.academy.find(a => a.day === day && a.slot === slotIdx + 1);
                const isSelected = state.selectedAcSlot && state.selectedAcSlot.day === day && state.selectedAcSlot.slot === slotIdx + 1;
                if (ac) {
                  return `
                  <div class="ac-grid-cell filled ${isSelected?'selected':''}" 
                    style="background:${ac.color}18;border-color:${ac.color}44"
                    onclick="${state.editingTimetable 
                      ? `state.editingAcademy='${ac.id}';goScreen('academy-add')` 
                      : `showAcademyDetail('${ac.id}')`}">
                    <div class="ac-cell-name" style="color:${ac.color}">${ac.name}</div>
                    <div class="ac-cell-time-ribbon" style="background:${ac.color}">${ac.startTime}~${ac.endTime}</div>
                  </div>`;
                } else {
                  return `
                  <div class="ac-grid-cell empty ${isSelected?'selected':''} ${state.editingTimetable?'editable':''}"
                    ${state.editingTimetable ? `onclick="addAcademyAtSlot('${day}',${slotIdx+1})"` : ''}>
                    ${state.editingTimetable ? '<i class="fas fa-plus" style="font-size:9px;opacity:0.3"></i>' : ''}
                  </div>`;
                }
              }).join('')}
            `).join('')}
          </div>
        </div>

        <!-- 학원 상세보기 패널 -->
        ${state.viewingAcademyDetail ? renderAcademyDetailPanel() : ''}

        <!-- 플래너 연동 안내 -->
        <div class="ai-plan-card animate-in">
          <div class="ai-header">
            <span class="ai-icon">🤖</span>
            <span class="ai-title">정율 자동 연동</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-top:8px">
            시간표와 학원 스케줄을 수정하면 <strong style="color:var(--primary-light)">플래너에 자동 반영</strong>됩니다. 
            정율이 학교 수업, 학원, 과제를 종합 분석하여 최적의 학습 계획을 제안해요! 📅
          </p>
        </div>
      </div>
    </div>
  `;
}

// 학원 상세보기 패널
function renderAcademyDetailPanel() {
  const ac = state.timetable.academy.find(a => a.id === state.viewingAcademyDetail);
  if (!ac) return '';

  return `
    <div class="ac-detail-panel animate-in" style="border-left:4px solid ${ac.color}">
      <div class="ac-detail-header">
        <div class="ac-detail-title-row">
          <span class="ac-detail-title" style="color:${ac.color}">${ac.name}</span>
          <button class="ac-detail-close" onclick="state.viewingAcademyDetail=null;renderScreen()">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="ac-detail-subtitle">${ac.academy}</div>
      </div>
      <div class="ac-detail-body">
        <div class="ac-detail-row">
          <span class="ac-detail-icon">📅</span>
          <span class="ac-detail-label">요일</span>
          <span class="ac-detail-value">${ac.day}요일</span>
        </div>
        <div class="ac-detail-row">
          <span class="ac-detail-icon">⏰</span>
          <span class="ac-detail-label">시간</span>
          <span class="ac-detail-value">${ac.startTime} ~ ${ac.endTime}</span>
        </div>
        <div class="ac-detail-row">
          <span class="ac-detail-icon">📚</span>
          <span class="ac-detail-label">관련 과목</span>
          <span class="ac-detail-value">${ac.subject}</span>
        </div>
        ${ac.memo ? `
        <div class="ac-detail-row">
          <span class="ac-detail-icon">📝</span>
          <span class="ac-detail-label">메모</span>
          <span class="ac-detail-value">${ac.memo}</span>
        </div>
        ` : ''}
      </div>
      <div class="ac-detail-actions">
        <button class="btn-secondary" style="flex:1" onclick="state.editingAcademy='${ac.id}';state.viewingAcademyDetail=null;goScreen('academy-add')">
          <i class="fas fa-edit"></i> 수정
        </button>
        <button class="btn-ghost" style="flex:1;color:var(--accent)" onclick="deleteAcademy('${ac.id}');state.viewingAcademyDetail=null;renderScreen()">
          <i class="fas fa-trash"></i> 삭제
        </button>
      </div>
    </div>
  `;
}

function showAcademyDetail(id) {
  state.viewingAcademyDetail = state.viewingAcademyDetail === id ? null : id;
  renderScreen();
}

function addAcademyAtSlot(day, slot) {
  state.editingAcademy = null;
  state._prefillDay = day;
  state._prefillSlot = slot;
  goScreen('academy-add');
}

// 학원 추가/수정 화면
function renderAcademyAdd() {
  const editing = state.editingAcademy;
  const isEdit = editing !== null;
  const ac = isEdit ? state.timetable.academy.find(a => a.id === editing) : null;
  const prefillDay = state._prefillDay || '월';
  const prefillSlot = state._prefillSlot || 1;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="state.editingAcademy=null;state._prefillDay=null;state._prefillSlot=null;goScreen('timetable-manage')"><i class="fas fa-arrow-left"></i></button>
        <h1>${isEdit ? '🏢 학원 수정' : '🏢 학원 추가'}</h1>
      </div>

      <div class="form-body">
        <div class="academy-add-intro animate-in">
          <span style="font-size:32px">🏢</span>
          <div>
            <h3>${isEdit ? '학원 정보를 수정하세요' : '학원 일정을 등록하세요'}</h3>
            <p>등록한 학원 일정은 시간표와 플래너에 자동 표시됩니다</p>
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📝 수업명</label>
          <input class="input-field" id="ac-name" placeholder="예: 수학 심화반" value="${isEdit ? ac.name : ''}">
        </div>

        <div class="field-group">
          <label class="field-label">🏢 학원명</label>
          <input class="input-field" id="ac-academy" placeholder="예: 대치 수학학원" value="${isEdit ? ac.academy : ''}">
        </div>

        <div class="field-group">
          <label class="field-label">📚 관련 과목</label>
          <div class="chip-row" id="ac-subject-chips">
            ${['수학','영어','국어','과학','사회','기타'].map(s => 
              `<button class="chip ${(isEdit && ac.subject===s) || (!isEdit && s==='수학') ? 'active' : ''}" data-subject="${s}">${s}</button>`
            ).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📅 요일</label>
          <div class="chip-row" id="ac-day-chips">
            ${['월','화','수','목','금','토','일'].map(d => 
              `<button class="chip ${(isEdit && ac.day===d) || (!isEdit && d===prefillDay) ? 'active' : ''}" data-day="${d}">${d}</button>`
            ).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">🔢 슬롯 (시간표 칸 위치)</label>
          <div class="chip-row" id="ac-slot-chips">
            ${[1,2,3,4].map(s => 
              `<button class="chip ${(isEdit && ac.slot===s) || (!isEdit && s===prefillSlot) ? 'active' : ''}" data-slot="${s}">${s}번째</button>`
            ).join('')}
          </div>
        </div>

        <div style="display:flex;gap:8px">
          <div class="field-group" style="flex:1">
            <label class="field-label">⏰ 시작 시간</label>
            <input class="input-field" type="time" id="ac-start" value="${isEdit ? ac.startTime : '18:00'}" style="color:var(--text-primary)">
          </div>
          <div class="field-group" style="flex:1">
            <label class="field-label">⏰ 종료 시간</label>
            <input class="input-field" type="time" id="ac-end" value="${isEdit ? ac.endTime : '20:00'}" style="color:var(--text-primary)">
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">🎨 색상</label>
          <div class="color-picker-row" id="ac-color-picker">
            ${['#E056A0','#6C5CE7','#00B894','#FDCB6E','#FF6B6B','#74B9FF','#00CEC9','#FF9F43'].map(c => 
              `<button class="color-pick-btn ${(isEdit && ac.color===c) || (!isEdit && c==='#E056A0') ? 'active' : ''}" 
                data-color="${c}" style="background:${c}" onclick="selectAcColor('${c}')"></button>`
            ).join('')}
          </div>
        </div>

        <div class="field-group">
          <label class="field-label">📝 메모 <span class="field-hint">(선택)</span></label>
          <textarea class="input-field" id="ac-memo" rows="2" placeholder="학원 수업 관련 메모">${isEdit ? (ac.memo || '') : ''}</textarea>
        </div>

        <!-- 정율 제안 -->
        <div class="ai-plan-card animate-in">
          <div class="ai-header">
            <span class="ai-icon">🤖</span>
            <span class="ai-title">정율 시간 분석</span>
          </div>
          <p style="font-size:13px;color:var(--text-secondary);line-height:1.6;margin-top:8px">
            학원 일정을 등록하면 정율이 <strong style="color:var(--primary-light)">학교 수업 → 학원 → 자습</strong> 패턴을 분석하고,
            비는 시간에 과제나 복습을 배치해줘요! 📊
          </p>
        </div>

        <button class="btn-primary" onclick="saveAcademy()">
          ${isEdit ? '학원 수정 완료' : '학원 추가 완료'} ✨
        </button>
        ${isEdit ? `<button class="btn-ghost" style="width:100%;margin-top:8px;color:var(--accent)" onclick="deleteAcademy('${ac.id}');goScreen('timetable-manage')">삭제</button>` : ''}
      </div>
    </div>
  `;
}

// 시간표 관리 유틸리티
function selectTtCell(period, dayIdx) {
  if (state.selectedTtCell && state.selectedTtCell.period === period && state.selectedTtCell.dayIdx === dayIdx) {
    state.selectedTtCell = null;
  } else {
    state.selectedTtCell = { period, dayIdx };
  }
  renderScreen();
}

function setTtSubject(subject) {
  if (!state.selectedTtCell) return;
  const {period, dayIdx} = state.selectedTtCell;
  state.timetable.school[period][dayIdx] = subject;
  // todayRecords도 동기화 (오늘이 해당 요일이면)
  syncTodayRecords();
  renderScreen();
}

function setTtTeacher(name) {
  if (!state.selectedTtCell) return;
  const {period, dayIdx} = state.selectedTtCell;
  const subject = state.timetable.school[period][dayIdx];
  if (subject) {
    state.timetable.teachers[subject] = name;
    syncTodayRecords();
  }
}

function syncTodayRecords() {
  // 오늘 요일 인덱스 (월=0, 화=1, ..., 금=4)
  const today = new Date();
  const jsDay = today.getDay(); // 0=일, 1=월 ... 6=토
  const dayIdx = jsDay === 0 ? -1 : jsDay - 1; // 월~금만
  
  if (dayIdx < 0 || dayIdx > 4) {
    // 주말: 학교 수업 없음 → 빈 배열
    state.todayRecords = [];
    return;
  }

  const tt = state.timetable;
  const periodTimes = tt.periodTimes || [];
  const newRecords = [];
  for (let pi = 0; pi < tt.school.length; pi++) {
    const subject = tt.school[pi][dayIdx];
    if (!subject) continue;
    const existing = state.todayRecords.find(r => r.period === pi + 1 && r.subject === subject);
    const time = periodTimes[pi] || {};
    newRecords.push({
      period: pi + 1,
      subject: subject,
      teacher: tt.teachers[subject] || '',
      done: existing ? existing.done : false,
      question: existing ? existing.question : null,
      summary: existing ? existing.summary : '',
      color: tt.subjectColors[subject] || '#636e72',
      startTime: time.start || '',
      endTime: time.end || '',
      _dbRecordId: existing ? existing._dbRecordId : null,
      _topic: existing ? existing._topic : '',
      _pages: existing ? existing._pages : '',
      _keywords: existing ? existing._keywords : [],
      _photos: existing ? existing._photos : [],
      _teacherNote: existing ? existing._teacherNote : '',
      _assignmentText: existing ? existing._assignmentText : '',
      _assignmentDue: existing ? existing._assignmentDue : '',
    });
  }
  state.todayRecords = newRecords;
}

function saveAcademy() {
  const name = document.getElementById('ac-name')?.value || '';
  const academy = document.getElementById('ac-academy')?.value || '';
  const subjectChip = document.querySelector('#ac-subject-chips .chip.active');
  const dayChip = document.querySelector('#ac-day-chips .chip.active');
  const slotChip = document.querySelector('#ac-slot-chips .chip.active');
  const startTime = document.getElementById('ac-start')?.value || '18:00';
  const endTime = document.getElementById('ac-end')?.value || '20:00';
  const colorBtn = document.querySelector('#ac-color-picker .color-pick-btn.active');
  const memo = document.getElementById('ac-memo')?.value || '';
  const subject = subjectChip ? subjectChip.dataset.subject : '수학';
  const day = dayChip ? dayChip.dataset.day : '월';
  const slot = slotChip ? parseInt(slotChip.dataset.slot) : 1;
  const color = colorBtn ? colorBtn.dataset.color : '#E056A0';

  if (state.editingAcademy) {
    const ac = state.timetable.academy.find(a => a.id === state.editingAcademy);
    if (ac) {
      ac.name = name || ac.name;
      ac.academy = academy || ac.academy;
      ac.subject = subject;
      ac.day = day;
      ac.slot = slot;
      ac.startTime = startTime;
      ac.endTime = endTime;
      ac.color = color;
      ac.memo = memo;
    }
    state.editingAcademy = null;
  } else {
    const newId = 'ac' + (Date.now() % 100000);
    state.timetable.academy.push({
      id: newId, name: name || '학원 수업', academy: academy || '',
      day, slot, startTime, endTime, color, subject, memo
    });
  }

  state._prefillDay = null;
  state._prefillSlot = null;

  // 플래너에 학원 일정 자동 추가
  syncAcademyToPlanner();
  showXpPopup(5, '학원 일정이 저장되었어요!');
}

function deleteAcademy(id) {
  state.timetable.academy = state.timetable.academy.filter(a => a.id !== id);
  // 플래너에서도 해당 학원 일정 제거
  state.plannerItems = state.plannerItems.filter(p => p.academyId !== id);
  renderScreen();
}

function selectAcColor(color) {
  document.querySelectorAll('#ac-color-picker .color-pick-btn').forEach(b => b.classList.remove('active'));
  const btn = document.querySelector(`#ac-color-picker .color-pick-btn[data-color="${color}"]`);
  if (btn) btn.classList.add('active');
}

function syncAcademyToPlanner() {
  // 학원 일정을 플래너에 반영 (향후 2주)
  const dayMap = {'일':0,'월':1,'화':2,'수':3,'목':4,'금':5,'토':6};
  const today = new Date();
  
  // 기존 학원 일정 제거
  state.plannerItems = state.plannerItems.filter(p => p.category !== 'academy');
  
  state.timetable.academy.forEach(ac => {
    const targetDay = dayMap[ac.day];
    if (targetDay === undefined) return;
    
    // 향후 14일 내에서 해당 요일 찾기
    for (let i = 0; i < 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() === targetDay) {
        const dateStr = d.toISOString().split('T')[0];
        state.plannerItems.push({
          id: `pac_${ac.id}_${dateStr}`,
          date: dateStr,
          time: ac.startTime,
          endTime: ac.endTime,
          title: `🏢 ${ac.name}`,
          category: 'academy',
          color: ac.color,
          icon: '🏢',
          done: false,
          aiGenerated: false,
          detail: `${ac.academy} · ${ac.subject}`,
          academyId: ac.id,
        });
      }
    }
  });
}

// 앱 시작 시 학원 플래너 동기화
function initAcademySync() {
  syncAcademyToPlanner();
}

// ==================== 학생용 멘토 피드백 화면 ====================

function renderStudentFeedbackScreen() {
  const feedbacks = state._mentorFeedbacks || [];
  const typeLabels = { class: '📖 수업 기록', question: '❓ 질문', teach: '🤝 교학상장', assignment: '📋 과제', exam: '📝 시험', general: '💬 전체', activity: '🎯 활동', report: '📊 탐구', my_question: '💬 질문방' };

  // 미읽음 피드백 자동 읽음 처리
  feedbacks.filter(f => !f.is_read).forEach(f => {
    DB.markFeedbackRead(f.id);
    f.is_read = 1;
  });
  state._mentorFeedbackUnread = 0;

  return `
    <div class="screen-header">
      <button class="back-btn" onclick="goScreen('main')"><i class="fas fa-arrow-left"></i></button>
      <h1>💬 멘토 피드백</h1>
      <div style="width:32px"></div>
    </div>
    <div style="padding:16px">
      ${feedbacks.length === 0 ? `
        <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
          <div style="font-size:48px;margin-bottom:16px;opacity:0.3">💬</div>
          <p style="font-size:16px;margin-bottom:8px">아직 피드백이 없어요</p>
          <p style="font-size:13px">멘토 선생님이 피드백을 보내면 여기에 표시됩니다</p>
        </div>
      ` : feedbacks.map(f => `
        <div style="background:var(--bg-card);border:1px solid ${f.is_read ? 'var(--border)' : 'rgba(108,92,231,0.4)'};border-radius:var(--radius-lg);padding:16px;margin-bottom:12px;${!f.is_read ? 'box-shadow:0 0 0 1px rgba(108,92,231,0.2);' : ''}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:6px">
              <span style="font-size:12px;font-weight:700;color:var(--primary-light)">${f.mentor_name || '멘토'} 선생님</span>
              <span style="font-size:11px;padding:2px 8px;background:var(--bg-input);border-radius:10px;color:var(--text-muted)">${typeLabels[f.record_type] || f.record_type}</span>
            </div>
            <span style="font-size:11px;color:var(--text-muted)">${f.created_at ? new Date(f.created_at).toLocaleDateString('ko-KR', {month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}) : ''}</span>
          </div>
          <div style="font-size:14px;color:var(--text-secondary);line-height:1.7">${f.content}</div>
        </div>
      `).join('')}
    </div>
  `;
}

// ==================== MENTOR DASHBOARD ====================

// 멘토 대시보드 상태 (학생 코드와 완전 분리)
const _mentor = {
  groups: [],           // 멘토의 반 목록
  selectedGroupId: null,// 현재 선택된 반
  studentList: [],      // 현재 반의 학생 목록
  groupSummary: [],     // 현재 반 학생 요약 데이터
  selectedStudentId: null, // 학생 상세 보기
  selectedStudentName: '',
  studentDetail: null,  // 학생 상세 데이터 (all-records 결과)
  feedbackDraft: '',    // 피드백 작성 중 텍스트
  feedbackRecordType: 'general', // 피드백 대상 유형
  feedbackRecordId: null,        // 피드백 대상 ID
  loading: false,
  initialLoading: true, // 초기 데이터 로딩 중 (autoLogin 시)
  detailLoading: false,
  detailTab: 'timeline', // timeline | exams | photos | feedback
  photoViewId: null,     // 사진 원본 보기
  photoViewData: null,
  // 학생 뷰어 모드 (멘토가 학생 플래너를 직접 열람)
  viewerStudentId: null,
  viewerStudentName: '',
  viewerStudentEmoji: '',
  viewerLoading: false,
  viewerTab: 'home',     // 학생 뷰어 내 현재 탭
  viewerScreen: 'main',  // 학생 뷰어 내 현재 화면
  _savedAuthUser: null,  // 멘토 복귀용 저장
  _savedAuthRole: null,
  _savedState: null,      // 멘토 복귀용 state 스냅샷
};

// ─── 멘토 학생 뷰어: 학생 플래너를 직접 열람 ───

async function mentorEnterStudentView(studentId, studentName, studentEmoji) {
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

function mentorExitStudentView() {
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

function renderMentorStudentViewer() {
  // Legacy — no longer used, replaced by renderMentorStudentDashboard()
  return renderMentorStudentDashboard();
}

// ==================== 멘토용 내 질문 패널 (iframe 대신 직접 렌더링) ====================
function renderMentorMyQaPanel() {
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
            <div class="card" style="margin-bottom:10px;padding:14px;cursor:pointer;transition:all 0.2s;border-left:3px solid ${statusColor}" onclick="mentorViewQuestion(${q.id})">
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
async function mentorViewQuestion(questionId) {
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
function renderMentorStudentDashboard() {
  const sname = _mentor.viewerStudentName || '';
  const semoji = _mentor.viewerStudentEmoji || '🐻';
  const studentInfo = _mentor.studentList.find(s => s.id == _mentor.viewerStudentId) || _mentor.groupSummary.find(s => s.id == _mentor.viewerStudentId) || {};

  // 비메인 화면 (학생 상세 화면 진입 시) → 단일 패널로 표시
  if (state.currentScreen !== 'main') {
    const writeScreens = ['record-class','record-question','record-teach','record-activity','record-assignment','planner-add','timetable-manage','academy-add','classmate-manage','exam-add','exam-result-input','report-add','activity-add','class-end-popup','academy-record-popup','evening-routine','aha-report'];
    let subContent = '';
    if (writeScreens.includes(state.currentScreen)) {
      subContent = '<div style="text-align:center;padding:60px 20px;color:var(--text-muted)"><i class="fas fa-eye" style="font-size:36px;margin-bottom:16px;display:block;opacity:0.3"></i><p style="font-size:16px;font-weight:600;margin-bottom:8px">열람 전용 모드</p><p style="font-size:13px">멘토 열람 모드에서는 기록 작성이 불가합니다.</p><button onclick="state.currentScreen=\'main\';renderScreen()" class="msv-back-sub"><i class="fas fa-arrow-left"></i> 돌아가기</button></div>';
    } else {
      subContent = renderStudentApp();
    }
    return `
      <div class="msv-top-bar">
        <button onclick="mentorExitStudentView()" class="msv-back-btn"><i class="fas fa-arrow-left"></i> 학생 목록으로 돌아가기</button>
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
  const myqaContent = renderMentorMyQaPanel();
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
      <button onclick="mentorExitStudentView()" class="msv-back-btn"><i class="fas fa-arrow-left"></i> 학생 목록으로 돌아가기</button>
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
async function mentorLoadGroups() {
  if (!state._authUser?.id) return;
  try {
    const res = await fetch(`/api/mentor/${state._authUser.id}/groups`);
    const data = await res.json();
    _mentor.groups = data.groups || [];
    if (_mentor.groups.length > 0 && !_mentor.selectedGroupId) {
      _mentor.selectedGroupId = _mentor.groups[0].id;
    }
  } catch (e) { console.error('mentorLoadGroups:', e); }
}

// 멘토 데이터 로드: 반 학생 요약
async function mentorLoadGroupSummary() {
  if (!_mentor.selectedGroupId) return;
  _mentor.loading = true;
  renderScreen();
  try {
    const today = new Date().toISOString().slice(0,10);
    const weekAgo = new Date(Date.now() - 7*86400000).toISOString().slice(0,10);
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
async function mentorLoadStudentDetail(studentId, studentName) {
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
async function mentorLoadPhoto(photoId) {
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
async function mentorSaveFeedback() {
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
    await mentorLoadStudentDetail(_mentor.selectedStudentId, _mentor.selectedStudentName);
  } catch (e) { console.error('mentorSaveFeedback:', e); alert('피드백 저장 실패'); }
}

// 피드백 삭제
async function mentorDeleteFeedback(feedbackId) {
  if (!confirm('이 피드백을 삭제하시겠습니까?')) return;
  try {
    await fetch(`/api/mentor/feedback/${feedbackId}`, { method: 'DELETE' });
    await mentorLoadStudentDetail(_mentor.selectedStudentId, _mentor.selectedStudentName);
  } catch (e) { console.error('mentorDeleteFeedback:', e); }
}

// ─── 렌더링 ───

function renderMentorDashboard() {
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
  const today = new Date().toISOString().slice(0,10);
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
    return renderMentorStudentDetail();
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
      <div class="desk-header-right">
        <span style="font-size:13px;color:var(--text-muted)">${today}</span>
      </div>
    </div>
    ${_mentor.groups.length > 1 ? `<div class="desk-tabs" style="border-bottom:none;padding-bottom:0">${groupTabs}</div>` : ''}
    <div class="desk-tabs">
      ${['students:📋 내 학생','alerts:🚨 경보','feedback:💬 피드백','exams:📝 시험','network:🤝 교학상장','croquet:🍩 포인트'].map(t => {
        const [id, label] = t.split(':');
        return `<button class="desk-tab ${state.mentorTab===id?'active':''}" data-mtab="${id}">${label}</button>`;
      }).join('')}
    </div>
    <div class="desk-body">${_mentor.loading ? '<div style="text-align:center;padding:40px;color:var(--text-muted)"><i class="fas fa-spinner fa-spin" style="font-size:24px"></i><p style="margin-top:12px">데이터 불러오는 중...</p></div>' : renderMentorTabContent()}</div>
  `;
}

function renderMentorTabContent() {
  switch(state.mentorTab) {
    case 'students': return renderMentorStudents();
    case 'alerts': return renderMentorAlerts();
    case 'feedback': return renderMentorFeedback();
    case 'exams': return renderMentorExams();
    case 'network': return renderMentorNetwork();
    case 'croquet': return renderMentorCroquet();
    default: return renderMentorStudents();
  }
}

function renderMentorStudents() {
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

function renderMentorAlerts() {
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

function renderMentorFeedback() {
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

function renderMentorExams() {
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

function renderMentorNetwork() {
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
function renderMentorCroquet() {
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

function renderMentorStudentDetail() {
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
            extra = `<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap">${r._photoIds.map(pid => `<div onclick="event.stopPropagation();mentorLoadPhoto(${pid})" style="width:60px;height:60px;border-radius:8px;background:var(--bg-input);display:flex;align-items:center;justify-content:center;cursor:pointer;border:1px solid var(--border);transition:all 0.15s" onmouseenter="this.style.borderColor='var(--primary-light)'" onmouseleave="this.style.borderColor='var(--border)'"><i class="fas fa-camera" style="color:var(--primary-light);font-size:16px"></i></div>`).join('')}<span style="font-size:11px;color:var(--primary-light);align-self:center">📸 사진 ${r._photoCount}장 (클릭하여 보기)</span></div>`;
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
        <div class="stat-card" style="cursor:pointer;padding:12px;transition:all 0.2s;border:2px solid transparent" onclick="mentorLoadPhoto(${pr.id})" onmouseenter="this.style.borderColor='var(--primary-light)'" onmouseleave="this.style.borderColor='transparent'">
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
        <button onclick="mentorSaveFeedback()" class="btn-primary" style="width:auto;padding:8px 20px;font-size:13px">피드백 보내기</button>
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
              <button onclick="mentorDeleteFeedback(${f.id})" style="background:none;border:none;color:var(--danger);cursor:pointer;font-size:12px" title="삭제">🗑</button>
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

// ==================== DIRECTOR DASHBOARD ====================

function renderDirectorDashboard() {
  return `
    <div class="desk-header">
      <div style="display:flex;align-items:center;gap:14px">
        <img src="/static/logo.png" alt="정율사관학원" class="desk-header-logo">
        <div>
          <h1>고교학점플래너 <span style="color:var(--accent)">원장</span></h1>
          <p style="font-size:13px;color:var(--text-secondary);margin-top:4px">정율고교학점데이터센터 | 498/500명</p>
        </div>
      </div>
      <div class="desk-header-right"><span style="font-size:13px;color:var(--text-muted)">2025-02-15</span></div>
    </div>
    <div class="desk-tabs">
      ${['overview:📊 전체현황','questions:📈 질문분석','network:🤝 교학상장','mentors:👨‍🏫 멘토관리'].map(t => {
        const [id, label] = t.split(':');
        return `<button class="desk-tab ${state.directorTab===id?'active':''}" data-dtab="${id}">${label}</button>`;
      }).join('')}
    </div>
    <div class="desk-body">${renderDirectorTabContent()}</div>
  `;
}

function renderDirectorTabContent() {
  switch(state.directorTab) {
    case 'overview': return renderDirOverview();
    case 'questions': return renderDirQuestions();
    case 'network': return renderDirNetwork();
    case 'mentors': return renderDirMentors();
  }
}

function renderDirOverview() {
  return `
    <div class="stats-row">
      <div class="stat-card"><div class="stat-label">오늘 기록률</div><div class="stat-value" style="color:var(--success)">82%</div><div class="stat-change stat-up">↑ 3%</div></div>
      <div class="stat-card"><div class="stat-label">주간 질문</div><div class="stat-value" style="color:var(--primary-light)">1,247</div><div class="stat-change stat-up">↑ 12%</div></div>
      <div class="stat-card"><div class="stat-label">B+C 비율</div><div class="stat-value" style="color:var(--question-b)">48%</div><div class="stat-change stat-up">↑ 5%</div></div>
      <div class="stat-card"><div class="stat-label">교학상장</div><div class="stat-value" style="color:var(--teach-green)">156</div><div class="stat-change stat-up">↑ 23%</div></div>
    </div>
    <h3 style="margin-bottom:12px">🚨 주요 경보</h3>
    <div class="alert-banner alert-red">🔴 3일+ 미기록: 12명 (고1:7, 고2:3, 고3:2)</div>
    <div class="alert-banner alert-yellow">🟡 질문 수준 하락: 5명 (2주 연속)</div>
    <div class="alert-banner alert-yellow">🟡 무드 저하: 3명 (3일 연속)</div>
    <div class="alert-banner alert-green">✅ 질문 콤보 달성: 8명</div>
  `;
}

function renderDirQuestions() {
  return `
    <h3 style="margin-bottom:16px">📈 학년별 질문 수준 분포</h3>
    <div class="dir-grid">
      ${[
        {grade:'고1 (180명)', data:[{l:'A',p:60},{l:'B',p:35},{l:'C',p:5}]},
        {grade:'고2 (200명)', data:[{l:'A',p:40},{l:'B',p:45},{l:'C',p:15}]},
      ].map(g => `
        <div class="stat-card"><h4 style="margin-bottom:12px">${g.grade}</h4>
          ${g.data.map(q => `<div class="q-dist-row"><span class="q-dist-label">${q.l}단계</span><div class="q-dist-bar"><div class="q-dist-fill" style="width:${q.p}%;background:var(--question-${q.l.toLowerCase()})"></div></div><span class="q-dist-pct">${q.p}%</span></div>`).join('')}
        </div>
      `).join('')}
      <div class="stat-card dir-full"><h4 style="margin-bottom:12px">고3 (120명)</h4>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px">
          ${[{l:'A',p:25},{l:'B',p:50},{l:'C',p:25}].map(q => `<div class="q-dist-row"><span class="q-dist-label">${q.l}단계</span><div class="q-dist-bar"><div class="q-dist-fill" style="width:${q.p}%;background:var(--question-${q.l.toLowerCase()})"></div></div><span class="q-dist-pct">${q.p}%</span></div>`).join('')}
        </div>
        <p style="margin-top:12px;font-size:13px;color:var(--success)">→ 학년↑ 질문수준↑ 확인 ✅</p>
      </div>
    </div>
  `;
}

function renderDirNetwork() {
  return `
    <h3 style="margin-bottom:16px">🤝 전체 교학상장 네트워크</h3>
    <div class="network-placeholder" style="height:300px"><i class="fas fa-project-diagram" style="font-size:64px"></i><p style="font-size:16px">500명 교학상장 네트워크 맵</p></div>
    <div class="dir-grid" style="margin-top:20px">
      <div class="stat-card">
        <h4 style="margin-bottom:12px">🏆 Top 5 교학상장 허브</h4>
        ${['강예린 (영어4, 과학3)','김민준 (수학3, 과학2)','임준혁 (수학2, 영어1)','송채원 (국어3)','박지호 (과학2)']
          .map((s,i) => `<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px"><strong>${i+1}.</strong> ${s}</div>`).join('')}
      </div>
      <div class="insight-box">
        <h4 style="margin-bottom:8px">💡 정율 인사이트</h4>
        <div class="insight-item"><span>•</span> 수학 교학상장 42%로 가장 활발</div>
        <div class="insight-item"><span>•</span> 고1 참여율 = 고2의 1/3 → 캠페인 필요</div>
        <div class="insight-item"><span>•</span> 교학상장 활발 학생 B+C 비율 1.8배</div>
      </div>
    </div>
  `;
}

function renderDirMentors() {
  const mentors = [
    {name:'박진수',students:20,rate:85,qbc:52,teach:8,color:'green'},
    {name:'이수현',students:20,rate:91,qbc:58,teach:12,color:'green'},
    {name:'김태호',students:20,rate:78,qbc:41,teach:5,color:'yellow'},
    {name:'정미래',students:20,rate:88,qbc:55,teach:10,color:'green'},
    {name:'최다은',students:20,rate:72,qbc:38,teach:4,color:'yellow'},
  ];
  return `
    <h3 style="margin-bottom:16px">👨‍🏫 멘토별 관리 현황</h3>
    <table class="student-table">
      <thead><tr><th>멘토</th><th>담당</th><th>기록률</th><th>B+C</th><th>교학상장</th><th>상태</th></tr></thead>
      <tbody>${mentors.map(m => `
        <tr><td style="font-weight:600">${m.name}</td><td>${m.students}명</td>
        <td><span class="mentor-rate" style="background:${m.rate>=80?'rgba(0,184,148,0.15);color:var(--success)':'rgba(243,156,18,0.15);color:var(--warning)'}">${m.rate}%</span></td>
        <td>${m.qbc}%</td><td>${m.teach}회/주</td><td><span class="status-dot status-${m.color}"></span></td></tr>
      `).join('')}</tbody>
    </table>
  `;
}

// ==================== UTILITIES ====================

// ==================== NAVIGATION HISTORY ====================
// 브라우저 뒤로가기(스와이프 포함) 지원을 위한 History API 통합
const _screenHistory = ['onboarding-welcome'];
let _isPopState = false;

function goScreen(screen) {
  // QA앱 iframe 진입점 인터셉트
  if (screen === '__qa-new__') {
    openMyQaIframe('/new');
    return;
  }
  // 화면 히스토리에 push (뒤로가기 지원)
  if (!_isPopState) {
    _screenHistory.push(screen);
    try {
      history.pushState({ screen, tab: state.studentTab }, '', '');
    } catch(e) { /* ignore */ }
  }
  _isPopState = false;

  state.currentScreen = screen;
  renderScreen();

  // Scroll to top on screen change
  const appContent = document.getElementById('app-content');
  if (appContent) appContent.scrollTop = 0;
  const tabletContent = document.getElementById('tablet-content');
  if (tabletContent) tabletContent.scrollTop = 0;
}

// 브라우저 뒤로가기 / 제스처 뒤로가기 처리
window.addEventListener('popstate', (e) => {
  if (_screenHistory.length > 1) {
    _screenHistory.pop(); // 현재 화면 제거
    const prevScreen = _screenHistory[_screenHistory.length - 1] || 'main';

    _isPopState = true;

    // 메인 탭 화면이면 탭도 복원
    if (prevScreen === 'main') {
      state.currentScreen = 'main';
      // 기본 홈 탭으로
      if (!['home','record','planner','growth','my'].includes(state.studentTab)) {
        state.studentTab = 'home';
      }
    } else {
      state.currentScreen = prevScreen;
    }

    renderScreen();
    const tabletContent = document.getElementById('tablet-content');
    if (tabletContent) tabletContent.scrollTop = 0;
    const appContent = document.getElementById('app-content');
    if (appContent) appContent.scrollTop = 0;
  }
});

// 초기 히스토리 상태 설정
try {
  history.replaceState({ screen: state.currentScreen, tab: state.studentTab }, '', '');
} catch(e) { /* ignore */ }

// 수업 기록 폼 유효성 검사 — 핵심 키워드가 있어야 버튼 활성화
function validateClassRecordForm() {
  // 핵심 키워드 textarea에서 실제 입력값 확인
  const keywordInput = document.querySelector('.class-keyword-input');
  const keywordText = keywordInput ? keywordInput.value.trim() : '';
  
  const hasContent = keywordText.length > 0;
  
  // 제출 버튼 찾기 (팝업 또는 전체화면 폼)
  const submitBtns = document.querySelectorAll('.class-record-submit');
  submitBtns.forEach(btn => {
    if (hasContent) {
      btn.disabled = false;
      btn.style.opacity = '1';
      btn.style.cursor = 'pointer';
    } else {
      btn.disabled = true;
      btn.style.opacity = '0.4';
      btn.style.cursor = 'not-allowed';
    }
  });
  
  return hasContent;
}

function completeClassRecord(idx) {
  // 유효성 검사
  if (!validateClassRecordForm()) {
    const keywordInput = document.querySelector('.class-keyword-input');
    if (keywordInput) {
      keywordInput.focus();
      keywordInput.style.borderColor = 'var(--accent)';
      keywordInput.setAttribute('placeholder', '핵심 키워드를 입력해야 기록을 완료할 수 있어요!');
      setTimeout(() => { keywordInput.style.borderColor = ''; }, 2000);
    }
    return;
  }
  
  if (idx >= 0 && idx < state.todayRecords.length) {
    const r = state.todayRecords[idx];
    
    // 새 폼 필드 수집
    const topicInput = document.querySelector('.class-topic-input');
    const topic = topicInput ? topicInput.value.trim() : '';
    
    const pagesInput = document.querySelector('.class-pages-input');
    const pages = pagesInput ? pagesInput.value.trim() : '';
    
    const keywordInput = document.querySelector('.class-keyword-input');
    const keywordText = keywordInput ? keywordInput.value.trim() : '';
    const keywordTexts = [];
    if (keywordText) {
      keywordText.split(/[,，、\n]+/).forEach(k => { const t = k.trim(); if (t) keywordTexts.push(t); });
    }
    
    const photos = state._classPhotos || [];
    
    const teacherNoteInput = document.querySelector('.class-teacher-note-input');
    const teacherNote = teacherNoteInput ? teacherNoteInput.value.trim() : '';
    
    r.done = true;
    r.summary = topic || keywordTexts.join(', ') || '수업 기록 완료';
    r._topic = topic;
    r._pages = pages;
    r._keywords = keywordTexts;
    r._photos = photos;
    r._teacherNote = teacherNote;
    
    // 과제 데이터를 레코드에 저장 (수정 화면에서 다시 볼 수 있도록)
    const assignInput2 = document.querySelector('.class-assignment-input');
    const assignText2 = assignInput2 ? assignInput2.value.trim() : '';
    r._assignmentText = assignText2;
    r._assignmentDue = state._classAssignmentDue || '';
    
    state.missions[0].current = state.todayRecords.filter(r => r.done).length;
    if (state.missions[0].current >= state.missions[0].target) state.missions[0].done = true;

    // DB 저장
    if (DB.studentId()) {
      DB.saveClassRecord({
        subject: r.subject || '미지정',
        date: new Date().toISOString().slice(0,10),
        content: topic,
        keywords: keywordTexts.length > 0 ? keywordTexts : [],
        understanding: 3,
        memo: JSON.stringify({ period: r.period || '', pages: pages, teacherNote: teacherNote, photoCount: photos.length }),
        topic: topic,
        pages: pages,
        photos: photos,
        teacher_note: teacherNote,
      });
    }
  }
  
  // 과제가 있으면 플래너에 자동 등록
  const rSubject = (idx >= 0 && idx < state.todayRecords.length) ? (state.todayRecords[idx].subject || '미지정') : '미지정';
  const rPeriod = (idx >= 0 && idx < state.todayRecords.length) ? (state.todayRecords[idx].period || '') : '';
  registerAssignmentFromClassRecord(rSubject, rPeriod);
  if (idx >= 0 && idx < state.todayRecords.length) {
    const assignText3 = document.querySelector('.class-assignment-input');
    state.todayRecords[idx]._assignmentRegistered = !!(assignText3 && assignText3.value.trim());
  }
  
  // 사진 상태 리셋
  state._classPhotos = [];
  
  // 1차 XP 지급
  showXpPopup(10, '수업 기록 완료!', { stayOnScreen: true });
  
  // 기록 완료 → UI 전환: 입력 필드 비활성화, 기록 버튼 숨기고 질문 섹션 표시
  showPostRecordQuestion();
}

function showXpPopup(amount, label, options) {
  const skipNavigate = options && options.stayOnScreen;
  state.xp += amount;
  
  // XP를 DB에 동기화 (디바운스: 마지막 호출 후 2초 뒤 실행)
  if (DB.studentId() && amount > 0) {
    // XP 소스 추론 (label에서)
    const _lastXpLabel = label || '';
    clearTimeout(window._xpSyncTimer);
    window._xpSyncTimer = setTimeout(() => {
      fetch(`/api/student/${DB.studentId()}/profile`).then(r => r.json()).then(data => {
        // 서버의 현재 XP와 비교하여 차이만큼 업데이트
        const serverXp = data.xp || 0;
        if (state.xp > serverXp) {
          const diff = state.xp - serverXp;
          // label에서 source 추론
          let source = '기타 활동';
          let sourceDetail = _lastXpLabel;
          if (_lastXpLabel.includes('수업 기록')) source = '수업 기록';
          else if (_lastXpLabel.includes('코칭') || _lastXpLabel.includes('도전')) source = '질문 코칭';
          else if (_lastXpLabel.includes('교학상장')) source = '교학상장';
          else if (_lastXpLabel.includes('활동') || _lastXpLabel.includes('체험')) source = '창의적 체험활동';
          else if (_lastXpLabel.includes('과제')) source = '과제 기록';
          else if (_lastXpLabel.includes('시험') || _lastXpLabel.includes('수행평가')) source = '시험 관리';
          else if (_lastXpLabel.includes('루틴') || _lastXpLabel.includes('마무리')) source = '일일 루틴';
          else if (_lastXpLabel.includes('일정')) source = '플래너 관리';
          
          fetch(`/api/student/${DB.studentId()}/xp-sync`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ xpDelta: diff, source, sourceDetail })
          }).catch(() => {});
        }
      }).catch(() => {});
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
        <div class="progress-fill level-fill" style="width:${Math.min((state.xp/1500*100),100).toFixed(0)}%"></div>
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
      if (!skipNavigate) { state.currentScreen='main'; renderScreen(); }
    }, 200);
  };
  overlay.addEventListener('click', close);
  setTimeout(close, 2500);
}

// ==================== EVENT HANDLERS ====================

function initStudentEvents(root) {
  // FAB
  const fab = document.getElementById('fab-btn');
  if (fab) fab.addEventListener('click', () => { state.studentTab = 'record'; state.currentScreen = 'main'; renderScreen(); });

  // Mood buttons
  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.mood = btn.dataset.mood;
    });
  });

  // Question level rows
  document.querySelectorAll('.q-level-row').forEach(row => {
    row.addEventListener('click', () => {
      document.querySelectorAll('.q-level-row').forEach(r => r.classList.remove('selected'));
      row.classList.add('selected');
    });
  });

  // Career buttons
  document.querySelectorAll('.career-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.career-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Activity type
  document.querySelectorAll('.activity-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.activity-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Chips
  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const siblings = chip.parentElement.querySelectorAll('.chip');
      siblings.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      
      // 질문 코칭 과목 chip 선택 시 state 업데이트
      if (chip.dataset.qsubject) {
        state._questionSubject = chip.dataset.qsubject;
      }
    });
  });

  // Grid select buttons
  document.querySelectorAll('.grid-select-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const siblings = btn.parentElement.querySelectorAll('.grid-select-btn');
      siblings.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Planner view toggle
  document.querySelectorAll('[data-pview]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.plannerView = btn.dataset.pview;
      renderScreen();
    });
  });

  // Planner category chips
  document.querySelectorAll('.planner-cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.planner-cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Assignment type buttons
  document.querySelectorAll('.assignment-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.assignment-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Assignment filter chips
  document.querySelectorAll('[data-afilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      state.assignmentFilter = chip.dataset.afilter;
      renderScreen();
    });
  });

  // Assignment subject chips
  document.querySelectorAll('#assignment-subject-chips .chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('#assignment-subject-chips .chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  // Teach student list
  document.querySelectorAll('.teach-student-item').forEach(item => {
    item.addEventListener('click', () => {
      document.querySelectorAll('.teach-student-item').forEach(i => {
        i.classList.remove('selected');
        const check = i.querySelector('.fa-check-circle');
        if (check) check.remove();
      });
      item.classList.add('selected');
      if (!item.querySelector('.fa-check-circle')) {
        const check = document.createElement('i');
        check.className = 'fas fa-check-circle';
        check.style.cssText = 'color:var(--success);margin-left:auto';
        item.appendChild(check);
      }
    });
  });

  // Growth chart
  const chartCanvas = document.getElementById('growth-chart');
  if (chartCanvas) {
    new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: ['3월','4월','5월','6월','7월'],
        datasets: [
          { label:'나의 성장', data:[1.2,1.8,2.5,3.2,3.8], borderColor:'#6C5CE7', backgroundColor:'rgba(108,92,231,0.1)', fill:true, tension:0.4, borderWidth:3, pointRadius:5, pointBackgroundColor:'#6C5CE7', pointBorderColor:'#fff', pointBorderWidth:2 },
          { label:'이상적 곡선', data:[1,1.8,2.6,3.4,4.2], borderColor:'#484F58', borderDash:[5,5], fill:false, tension:0.4, borderWidth:2, pointRadius:0 }
        ]
      },
      options: {
        responsive:true, maintainAspectRatio:false,
        plugins:{legend:{display:false}},
        scales:{
          y:{min:0,max:5,ticks:{callback:v=>['','A','B-1','B-2/3','C-1','C-2'][v],color:'#8B949E',font:{size:10}},grid:{color:'rgba(48,54,61,0.5)'}},
          x:{ticks:{color:'#8B949E',font:{size:11}},grid:{display:false}}
        }
      }
    });
  }
}

function initMentorEvents() {
  // 탭 전환
  document.querySelectorAll('[data-mtab]').forEach(btn => {
    btn.addEventListener('click', () => { state.mentorTab = btn.dataset.mtab; renderScreen(); });
  });
  // 반(그룹) 전환
  document.querySelectorAll('[data-mgroup]').forEach(btn => {
    btn.addEventListener('click', () => {
      _mentor.selectedGroupId = parseInt(btn.dataset.mgroup);
      mentorLoadGroupSummary();
    });
  });
  // 학생 클릭 → 학생 플래너 뷰어 진입
  document.querySelectorAll('.m-student-row').forEach(row => {
    row.addEventListener('click', () => {
      const sid = row.dataset.studentId;
      const sname = row.dataset.studentName;
      const semoji = row.dataset.studentEmoji || '🐻';
      if (sid) mentorEnterStudentView(parseInt(sid), sname, semoji);
    });
  });
  // 경보 배너 클릭 → 학생 플래너 뷰어 진입
  document.querySelectorAll('[data-alert-student]').forEach(el => {
    el.addEventListener('click', () => {
      const sid = el.dataset.alertStudent;
      const sname = el.dataset.alertName;
      if (sid) mentorEnterStudentView(parseInt(sid), sname, '🐻');
    });
  });
  // 학생 상세 탭 전환
  document.querySelectorAll('[data-mdetail]').forEach(btn => {
    btn.addEventListener('click', () => { _mentor.detailTab = btn.dataset.mdetail; renderScreen(); });
  });
  // 타임라인 피드백 버튼
  document.querySelectorAll('.m-fb-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      _mentor.feedbackRecordType = btn.dataset.fbType || 'general';
      _mentor.feedbackRecordId = btn.dataset.fbId ? parseInt(btn.dataset.fbId) : null;
      _mentor.detailTab = 'feedback';
      renderScreen();
      setTimeout(() => { document.getElementById('m-fb-input')?.focus(); }, 100);
    });
  });
  // 피드백 입력 싱크
  const fbInput = document.getElementById('m-fb-input');
  if (fbInput) {
    fbInput.addEventListener('input', () => { _mentor.feedbackDraft = fbInput.value; });
  }
}

function initDirectorEvents() {
  document.querySelectorAll('[data-dtab]').forEach(btn => {
    btn.addEventListener('click', () => { state.directorTab = btn.dataset.dtab; renderScreen(); });
  });
}

// ==================== MODE SWITCHER & INIT ====================

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    if (state.mode === 'student') { state.currentScreen = 'main'; state.studentTab = 'home'; }
    // 멘토 모드 전환 시: 멘토 로그인 상태이면 데이터 로드, 아니면 안내
    if (state.mode === 'mentor') {
      if (state._authRole === 'mentor' && state._authUser?.id) {
        if (_mentor.groups.length === 0) {
          mentorLoadGroups().then(() => mentorLoadGroupSummary()).catch(e => console.error('[MENTOR] mode-switch load error:', e));
        }
      }
    }
    renderScreen();
  });
});

// 디바이스 프리뷰 전환 버튼
document.querySelectorAll('.device-preview-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.device-preview-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const device = btn.dataset.device;
    devicePreview = device === 'pc' ? null : device;
    // phone/tablet 프리뷰는 학생모드만 지원 → 자동 전환
    if (devicePreview && state.mode !== 'student') {
      state.mode = 'student';
      state.currentScreen = 'main';
      state.studentTab = 'home';
      document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
      document.querySelector('.mode-btn[data-mode="student"]').classList.add('active');
    }
    renderScreen();
  });
});

// 학원 플래너 동기화 초기화
initAcademySync();
syncTodayRecords(); // 오늘 요일 기준 학교 시간표 동적 생성
initTodayAcademy(); // 오늘 요일 기준 학원 시간표 동적 생성
autoLogin();
renderScreen();

// ==================== PWA 설치 유도 + 업데이트 알림 ====================
// (기존 로직과 완전 독립 — 이 블록은 추가만 되며 기존 함수를 수정하지 않음)

(function initPWA() {
  // --- 1. Android/Desktop: beforeinstallprompt 캡처 ---
  let _deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _deferredPrompt = e;
    showInstallBanner('android');
  });

  // --- 2. 설치 완료 감지 ---
  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    hideInstallBanner();
    console.log('[PWA] App installed!');
  });

  // --- 3. iOS 감지 (standalone이 아닐 때만) ---
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

  if (isIOS && !isStandalone) {
    // iOS는 beforeinstallprompt가 없으므로 첫 방문 3초 후 가이드 표시
    const dismissed = localStorage.getItem('pwa_ios_dismissed');
    if (!dismissed) {
      setTimeout(() => showInstallBanner('ios'), 3000);
    }
  }

  // --- 4. 배너 표시 함수 ---
  function showInstallBanner(type) {
    if (isStandalone) return; // 이미 앱으로 실행 중이면 표시 안 함
    if (document.getElementById('pwa-install-banner')) return; // 중복 방지

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:99999;padding:16px;padding-bottom:max(16px,env(safe-area-inset-bottom));background:linear-gradient(135deg,#6C5CE7,#8B5CF6);box-shadow:0 -4px 20px rgba(0,0,0,0.3);animation:slideUp .3s ease';

    if (type === 'ios') {
      banner.innerHTML = `
        <div style="max-width:400px;margin:0 auto;color:#fff">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
            <div style="display:flex;align-items:center;gap:10px">
              <img src="/static/icon-192.png" style="width:36px;height:36px;border-radius:8px" alt="">
              <div>
                <div style="font-weight:700;font-size:14px">앱으로 설치하기</div>
                <div style="font-size:11px;opacity:0.85">홈 화면에 추가하면 더 빠르게!</div>
              </div>
            </div>
            <button onclick="document.getElementById('pwa-install-banner').remove();localStorage.setItem('pwa_ios_dismissed','1')" style="background:none;border:none;color:#fff;font-size:20px;cursor:pointer;padding:4px">✕</button>
          </div>
          <div style="background:rgba(255,255,255,0.15);border-radius:10px;padding:10px 14px;font-size:12px;line-height:1.6">
            <span style="font-size:16px">📲</span> 하단 <b>공유 버튼</b> <span style="font-size:14px">⎋</span> 탭 → <b>"홈 화면에 추가"</b> 선택
          </div>
        </div>`;
    } else {
      banner.innerHTML = `
        <div style="max-width:400px;margin:0 auto;color:#fff;display:flex;align-items:center;gap:12px">
          <img src="/static/icon-192.png" style="width:40px;height:40px;border-radius:8px" alt="">
          <div style="flex:1">
            <div style="font-weight:700;font-size:14px">학점플래너 앱 설치</div>
            <div style="font-size:11px;opacity:0.85">홈 화면에서 바로 실행!</div>
          </div>
          <button id="pwa-install-btn" style="background:#fff;color:#6C5CE7;border:none;border-radius:8px;padding:8px 16px;font-weight:700;font-size:13px;cursor:pointer">설치</button>
          <button onclick="document.getElementById('pwa-install-banner').remove()" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;padding:4px">✕</button>
        </div>`;
    }
    document.body.appendChild(banner);

    // Android/Desktop 설치 버튼 이벤트
    const installBtn = banner.querySelector('#pwa-install-btn');
    if (installBtn && _deferredPrompt) {
      installBtn.addEventListener('click', async () => {
        _deferredPrompt.prompt();
        const { outcome } = await _deferredPrompt.userChoice;
        console.log('[PWA] Install prompt outcome:', outcome);
        _deferredPrompt = null;
        hideInstallBanner();
      });
    }
  }

  function hideInstallBanner() {
    const el = document.getElementById('pwa-install-banner');
    if (el) el.remove();
  }

  // --- 5. 업데이트 토스트 알림 ---
  window._showPwaUpdateToast = function() {
    if (document.getElementById('pwa-update-toast')) return;
    const toast = document.createElement('div');
    toast.id = 'pwa-update-toast';
    toast.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:99999;background:#1e293b;color:#fff;padding:12px 20px;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.3);font-size:13px;display:flex;align-items:center;gap:10px;animation:slideDown .3s ease;max-width:90vw';
    toast.innerHTML = `
      <span>🔄 새 버전이 있습니다</span>
      <button onclick="location.reload()" style="background:#6C5CE7;color:#fff;border:none;border-radius:6px;padding:6px 12px;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap">업데이트</button>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;color:#999;font-size:16px;cursor:pointer">✕</button>`;
    document.body.appendChild(toast);
    setTimeout(() => { if (document.body.contains(toast)) toast.remove(); }, 15000);
  };

  // --- 6. CSS 애니메이션 추가 (기존 스타일 시트에 영향 없음) ---
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
    @keyframes slideDown { from { transform: translateY(-100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
  `;
  document.head.appendChild(style);
})();
