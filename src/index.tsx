import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'
import { Bindings } from './types'
import {
  getKSTNow, getKSTString, getKSTDate,
  recordXp, fetchWithTimeout,
  callGeminiWithFallback, GEMINI_MODEL, callGeminiOcrSingle,
  callSonnetAnalysis, callGeminiMultiImage,
  callProxyGemini, callProxyClaude, callProxyOpenAI, cleanJsonResponse,
  hashPassword, verifyPassword, generateToken, generateInviteCode,
  stripHtmlForPreview, sanitizeHTML,
  NICKNAME_BLOCKLIST, validateNickname,
  getStudentAcademy, canAccessBoard,
  getStudentCareerContext, getExternalUserId,
} from './helpers'
import mentorAuth from './routes/mentor-auth'
import mentorGroups from './routes/mentor-groups'
import mentorStudent from './routes/mentor-student'
import mentorAnalysis from './routes/mentor-analysis'
import mentorNickname from './routes/mentor-nickname'
import mentorCommunity from './routes/mentor-community'
import mentorCroquet from './routes/mentor-croquet'
import mentorFeedback from './routes/mentor-feedback'
import mentorQuestions from './routes/mentor-questions'
import mentorRelay from './routes/mentor-relay'
import mentorDashboard from './routes/mentor-dashboard'

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors({
  origin: '*',                    // 모든 도메인 허용 (필요시 특정 도메인으로 제한)
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
  exposeHeaders: ['Content-Length'],
  credentials: true,
  maxAge: 86400,                  // preflight 캐시 24시간
}))

// sw.js, app.js, app.css → 캐시 방지 헤더 (항상 최신 버전 로드)
app.use('/static/sw.js', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.header('Pragma', 'no-cache')
  c.header('Expires', '0')
})
app.use('/static/app.js', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
})
app.use('/static/app.css', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
})
app.use('/static/app-mentor.js', async (c, next) => {
  await next()
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
})

app.get('/static/*', serveStatic())

// ==================== Route modules ====================
app.route('/', mentorAuth)
app.route('/', mentorGroups)
app.route('/', mentorStudent)
app.route('/', mentorAnalysis)
app.route('/', mentorNickname)
app.route('/', mentorCommunity)
app.route('/', mentorCroquet)
app.route('/', mentorFeedback)
app.route('/', mentorQuestions)
app.route('/', mentorRelay)
app.route('/', mentorDashboard)


// ==================== MY CREDIT LOG 시스템 프롬프트 ====================

const SYSTEM_PROMPT_CREDIT_LOG = `# Team
당신은 3명의 전문가로 구성된 [Subject] 수업 분석 팀입니다.
어떤 사진이 올라오든 (양식지 / 교과서 필기 / 프린트물 / 칠판 사진 / 노트 필기)
각 전문가가 자신의 관점에서 수업 내용을 분석합니다.

## 전문가 1 — [Subject] 스타 강사
수업 사진 전체를 보고 선생님의 수업 의도를 역으로 파악합니다.
선생님이 무엇을 강조하려 했는지, 어떤 흐름으로 수업을 설계했는지 분석하여
"선생님 강조 포인트"와 "핵심 키워드"를 작성합니다.

## 전문가 2 — 고교학점제·탐구보고서·세특 작성 전문가
이 수업 내용을 바탕으로 학생이 생기부 세특(세부능력 및 특기사항)에 활용할 수 있는
탐구 소재 질문 3가지를 제안합니다. 각 질문마다:
- 세특 소재 질문
- 왜 이 소재를 선택해야 하는가
- 어떻게 탐구하면 좋은지 방향 가이드

## 전문가 3 — 내신 출제 전문가
이 수업에서 시험에 반드시 출제될 가능성이 높은 퀴즈 문제 3가지를 만듭니다.
각 문제에 정답과 해설을 함께 작성합니다.

# Input Data
- [Subject]: 과목명
- [Student_Comment]: 학생 소감/궁금한 점 (없을 수 있음)
- [Note_OCR]: 필기 노트 OCR 텍스트
- [Reference_OCR_1~N]: 참고사진 OCR 텍스트 (교과서/프린트/칠판 등, 없을 수 있음)

# 수식 처리 규칙 (절대 예외 없음)
수학적 표현은 모두 LaTeX으로 변환:
- 인라인: $수식$ / 블록: $$수식$$
- 거듭제곱: $x^2$ / 분수: $\\frac{a}{b}$ / 루트: $\\sqrt{x}$
- 함수: $f(x)$, $\\sin(x)$, $\\log(x)$ / 극한: $\\lim$ / 적분: $\\int$
- 그리스 문자: $\\alpha$, $\\theta$, $\\pi$ / 부등호: $\\leq$, $\\geq$
- 절대 일반 텍스트로 수식을 출력하지 말 것

# 공통 규칙
1. 사진에서 해당 정보를 찾을 수 없으면 수업 내용에서 AI가 추론하여 생성
2. 말투: 전문적이고 구체적으로. 추상적 표현 금지.
3. 마크다운 코드블록(\\x60\\x60\\x60)으로 감싸지 말 것. 순수 JSON만 출력.

# Output Format (반드시 이 JSON만 응답 — 코드블록 없이)
{
  "topic": "단원/주제명",
  "pages": "p.XX~XX 또는 빈 문자열",
  "teacher_emphasis": "선생님 강조 포인트 (여러 줄 가능, \\n으로 구분). 밑줄/별표/반복/박스/색깔 표시된 내용, 수업 흐름상 핵심 개념/원리.",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "seteuk_questions": [
    {"question": "세특 소재 질문", "reason": "왜 이 소재인가", "guide": "탐구 방향 가이드"},
    {"question": "세특 소재 질문", "reason": "왜 이 소재인가", "guide": "탐구 방향 가이드"},
    {"question": "세특 소재 질문", "reason": "왜 이 소재인가", "guide": "탐구 방향 가이드"}
  ],
  "quiz": [
    {"question": "예상 시험 문제", "answer": "정답", "explanation": "해설"},
    {"question": "예상 시험 문제", "answer": "정답", "explanation": "해설"},
    {"question": "예상 시험 문제", "answer": "정답", "explanation": "해설"}
  ],
  "assignment": null 또는 {"content": "과제 내용", "due": "기한 (없으면 미확인)"},
  "rawOcrText": "사진에서 인식한 전체 텍스트 원본"
}`

// ==================== 2축 9단계 시스템 프롬프트 ====================

const SYSTEM_PROMPT_ANALYZE = `당신은 정율고교학점데이터센터의 "2축 9단계 질문 코칭 시스템 v2.0"에 따라 학생 질문을 분석하는 정율 코치입니다.

## 2축 9단계 분류 체계

### 축1: 호기심 사다리 (문제를 향한 질문)
- A-1 "뭐지?" (8XP): 사실·정의·공식 확인 질문
- A-2 "어떻게?" (10XP): 절차·방법·순서 확인 질문
- B-1 "왜?" (15XP): 이유·원리를 깊이 이해하려는 질문
- B-2 "만약에?" (20XP): 조건 변경 → 결과 예측하는 전략적 사고 질문
- C-1 "뭐가 더 나아?" (25XP): 서로 다른 방법 비교 + 자기 판단 제시
- C-2 "그러면?" (30XP): 배운 것을 새 상황에 적용/확장

### 축2: 성찰 질문 (내 풀이를 향한 질문)
- R-1 "어디서 틀렸지?" (15XP): 오류 위치 발견
- R-2 "왜 틀렸지?" (20XP): 오류 원인 분석 (개념부족/실수/해석오류)
- R-3 "다음엔 어떻게?" (25XP): 재발 방지 전략 수립

## B단계 이상 3대 필수 조건 (매우 엄격하게 적용!)
1. **구체적 대상**: 문제의 특정 부분(수식, 선지 번호, 표현 등)을 명확히 지목. "이거", "그거" 같은 모호한 표현이면 불합격
2. **자기 생각**: "나는 ~라고 생각한다/~것 같다" 등 학생 자신의 해석·추론이 반드시 포함. 이것이 가장 크리티컬한 조건!
3. **맥락 연결**: 지문·조건·풀이의 구체적 내용과 연결. 형식만 빌린 질문은 즉시 걸러냄

**꼼수 차단**: "왜"라는 단어가 있어도 자기 생각이 없으면 A단계. "만약에"가 있어도 구체적 조건 변경이 없으면 A단계.

## 응답 형식 (반드시 이 JSON 형식으로만 응답)
{
  "level": "B-1",
  "levelName": "왜?",
  "levelDesc": "이유·원리 탐구",
  "xp": 15,
  "axis": "curiosity",
  "checks": {
    "specificTarget": { "pass": true, "detail": "which와 that의 용법 구분을 지목했어" },
    "ownThought": { "pass": true, "detail": "'역사적으로 같은 기능이었을 것 같다'는 네 해석이 있어" },
    "contextLink": { "pass": true, "detail": "제한적/계속적 용법이라는 수업 내용과 연결됐어" }
  },
  "feedback": "단순한 규칙 암기가 아니라 그 배경의 '왜'를 묻고 있어. 훌륭한 호기심이야!",
  "nextHint": {
    "targetLevel": "B-2",
    "targetName": "만약에?",
    "hint": "만약 which가 제한적 용법에서도 쓰인다면 문장 의미가 어떻게 달라질까? 처럼 조건을 바꿔 예측해봐!"
  }
}`;

const SYSTEM_PROMPT_COACHING = `당신은 정율고교학점데이터센터의 소크라테스식 정율 코치입니다.

## 코칭 원칙
1. **절대 답을 직접 주지 마세요.** 질문으로 학생이 스스로 깨닫게 유도하세요.
2. 당신이 던지는 모든 질문에 해당 질문의 2축 9단계 단계를 표시하세요.
3. 단계를 점진적으로 높여가세요: B-1 → B-2 → C-1 → C-2
4. 학생이 막히면 힌트를 주되, 절대 정답을 말하지 마세요.
5. 톤: 냉정하게 진단하고, 따뜻하게 격려하세요.

## 응답 형식 (반드시 이 JSON 형식으로만 응답)
{
  "message": "정율 코치의 질문 또는 피드백 텍스트",
  "questionLevel": "B-2",
  "questionLabel": "만약에?",
  "emoji": "🔀",
  "isComplete": false,
  "encouragement": ""
}

isComplete가 true이면 대화가 자연스럽게 마무리된 것이며, encouragement에 격려 메시지를 넣으세요.`;

const SYSTEM_PROMPT_IMAGE = `당신은 학생이 올린 문제지/풀이 이미지를 분석하는 정율 분석기입니다.

## 분석 내용
1. 이미지에서 텍스트/수식/그래프 등을 정확히 읽어내세요
2. 어떤 과목의 어떤 단원인지 파악하세요
3. 문제의 핵심 개념과 풀이에 필요한 사고를 설명하세요
4. 학생의 필기가 있다면 올바른지 확인하세요

## 응답 형식 (반드시 이 JSON 형식으로만 응답)
{
  "subject": "수학",
  "topic": "치환적분",
  "extractedText": "이미지에서 읽은 핵심 내용",
  "analysis": "문제/풀이에 대한 분석",
  "handwritingCheck": "필기 확인 결과 (필기가 있을 경우)",
  "suggestedQuestion": "이 문제에 대해 B단계 이상의 좋은 질문 예시"
}`;


// ==================== 진로 PDF 파싱 프롬프트 ====================
const CAREER_PDF_PARSE_PROMPT = `이 이미지는 앱티핏(aptifit) 전공적성 검사 결과입니다. 모든 정보를 정확히 읽어서 아래 JSON 형식으로 반환해주세요.

{
  "student_name": "학생 이름",
  "test_date": "검사 일자 YYYY-MM-DD",
  "dream_department": {
    "field": "계열(자연/인문/사회 등)",
    "department": "학과명",
    "score": 100
  },
  "top_departments": [
    {"rank": 1, "field": "계열", "department": "학과명", "score": 100},
    {"rank": 2, "field": "계열", "department": "학과명", "score": 91}
  ],
  "field_profile": {
    "자연": 82, "사회": 68, "공학": 64, "교육": 60, "의약": 56, "인문": 50, "예체능": 44, "상경": 38
  },
  "major_profile": {
    "abilities": ["관찰력", "정보활용능력"],
    "values": ["자기실현", "지적탐구"],
    "personality": ["이성적인", "주도적인"],
    "interests": ["자연현상탐구", "데이터분석"],
    "knowledge": ["자연과학지식", "수학적지식"]
  },
  "career_advice": "진로 조언 전체 텍스트",
  "careers": ["천문학자", "데이터과학자", "연구원"]
}

중요:
- 모든 수치는 숫자(정수)로
- 계열 적성 프로파일은 8개 계열 모두 포함
- top_departments는 표시된 모든 학과 포함 (보통 5개)
- major_profile의 각 항목은 이미지에서 읽은 키워드 배열
- career_advice는 텍스트 전체를 그대로 복사
- 순수 JSON만 반환 (마크다운 코드블록 없이)`


// ==================== API 라우트: 질문 분석 (OpenAI) ====================

app.post('/api/analyze', async (c) => {
  try {
    const { question, subject, axis, studentId } = await c.req.json()
    if (!question) return c.json({ error: '질문 내용이 필요합니다' }, 400)

    // 진로 프로파일 컨텍스트 로드
    const careerCtx = studentId ? await getStudentCareerContext(c.env.DB, Number(studentId)) : ''
    const externalId = studentId ? await getExternalUserId(c.env.DB, Number(studentId)) : undefined

    const rawText = await callProxyOpenAI({
      proxySecret: c.env.AI_PROXY_SECRET,
      prompt: `과목: ${subject || '미지정'}\n질문 축: ${axis === 'reflection' ? '축2(성찰)' : '축1(호기심)'}\n\n학생 질문: "${question}"`,
      systemPrompt: SYSTEM_PROMPT_ANALYZE + careerCtx,
      model: 'gpt-4o-mini',
      jsonMode: true,
      temperature: 0.3,
      externalId,
      task: 'analyze',
    })

    const result = JSON.parse(cleanJsonResponse(rawText))
    return c.json(result)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== API 라우트: 소크라테스 코칭 (Claude) ====================

app.post('/api/coaching', async (c) => {
  try {
    const { messages, subject, currentLevel, studentId } = await c.req.json()
    if (!messages || messages.length === 0) return c.json({ error: '대화 내용이 필요합니다' }, 400)

    // 진로 프로파일 컨텍스트 로드
    const careerCtx = studentId ? await getStudentCareerContext(c.env.DB, Number(studentId)) : ''
    const externalId = studentId ? await getExternalUserId(c.env.DB, Number(studentId)) : undefined

    const text = await callProxyClaude({
      proxySecret: c.env.AI_PROXY_SECRET,
      systemPrompt: SYSTEM_PROMPT_COACHING + `\n\n현재 학생의 질문 단계: ${currentLevel || 'A-2'}\n과목: ${subject || '미지정'}` + careerCtx,
      messages: messages.map((m: any) => ({ role: m.role, content: m.content })),
      maxTokens: 1024,
      timeoutMs: 45000,
      externalId,
      task: 'coaching',
    })

    // JSON 파싱 시도, 실패하면 텍스트 그대로 반환
    try {
      const result = JSON.parse(text)
      return c.json(result)
    } catch {
      return c.json({
        message: text,
        questionLevel: '',
        questionLabel: '',
        emoji: '🤖',
        isComplete: false,
        encouragement: ''
      })
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== API 라우트: 이미지 분석 (Gemini) ====================

app.post('/api/image-analyze', async (c) => {
  try {
    const { imageBase64, mimeType, subject } = await c.req.json()
    if (!imageBase64) return c.json({ error: '이미지 데이터가 필요합니다' }, 400)

    // base64 데이터에서 prefix 제거
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')
    const fullPrompt = SYSTEM_PROMPT_IMAGE + `\n\n과목 힌트: ${subject || '미지정'}\n\n위 형식에 맞게 JSON으로만 응답하세요.`

    // Gemini 우선 시도 (이미지 지원) → 실패 시 Claude 폴백
    const { text } = await callGeminiWithFallback({
      proxySecret: c.env.AI_PROXY_SECRET,
      prompt: fullPrompt,
      jsonMode: true,
      temperature: 0.3,
      inlineData: { mime_type: mimeType || 'image/jpeg', data: cleanBase64 },
      task: 'image-analyze',
    })

    try {
      return c.json(JSON.parse(text))
    } catch {
      return c.json({ analysis: text })
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== API 라우트: MY CREDIT LOG AI 분석 (Gemini 2.5 Flash) ====================

app.post('/api/ai/credit-log', async (c) => {
  try {
    const { images, subject, period, date, studentComment, studentId } = await c.req.json()
    if (!images || images.length === 0) return c.json({ success: false, error: '사진이 필요합니다' }, 400)

    // 진로 프로파일 컨텍스트 로드
    const careerCtx = studentId ? await getStudentCareerContext(c.env.DB, Number(studentId)) : ''
    const externalId = studentId ? await getExternalUserId(c.env.DB, Number(studentId)) : undefined

    // ── AI 전달 이미지 선별: 필기 1장 + 참고 최대 4장 = 최대 5장 ──
    const MAX_AI_IMAGES = 5
    const MAX_BASE64_LEN = 1_500_000 // base64 ~1.5M자 ≈ 바이너리 ~1.1MB
    const noteImages: any[] = []
    const refImages: any[] = []
    for (const img of images) {
      const b64 = (img.base64 || '').replace(/^data:image\/\w+;base64,/, '')
      if (b64.length > MAX_BASE64_LEN) {
        console.log(`[credit-log] 이미지 크기 초과 스킵 (${Math.round(b64.length / 1000)}KB base64)`)
        continue
      }
      const entry = { mime_type: img.mimeType || 'image/jpeg', data: b64, tag: img.tag || '참고' }
      if (img.tag === '필기' && noteImages.length < 1) {
        noteImages.push(entry)
      } else if (refImages.length < MAX_AI_IMAGES - 1) {
        refImages.push(entry)
      }
    }
    const aiImages = [...noteImages, ...refImages].slice(0, MAX_AI_IMAGES)
    if (aiImages.length === 0) return c.json({ success: false, error: '유효한 사진이 없습니다 (크기 초과)' }, 400)
    console.log(`[credit-log] AI에 전달할 이미지: ${aiImages.length}장 (필기${noteImages.length} + 참고${refImages.length}) / 전체 ${images.length}장`)

    const inlineImages = aiImages.map(({ mime_type, data }: any) => ({ mime_type, data }))
    const imageTags = aiImages.map((img: any) => img.tag)

    // Note_OCR / Reference_OCR 구분 정보
    const tagInfo = aiImages.map((img: any, i: number) => {
      return img.tag === '필기' ? `사진${i + 1}: [Note_OCR] 필기 노트` : `사진${i + 1}: [Reference_OCR] 참고사진 (${img.tag})`
    }).join('\n')

    // [Subject] 동적 치환 — system prompt와 user prompt 분리
    const systemPrompt = SYSTEM_PROMPT_CREDIT_LOG.replace(/\[Subject\]/g, subject || '미지정') + careerCtx
    const userContext = `[Subject]: ${subject || '미지정'}\n교시: ${period || '미지정'}교시\n날짜: ${date || '미지정'}\n${studentComment ? `[Student_Comment]: ${studentComment}\n` : ''}사진 구성:\n${tagInfo}`
    // Gemini용 (system+user 합침)
    const fullPrompt = systemPrompt + `\n\n---\n${userContext}\n\n위 JSON 형식으로만 응답하세요.`

    const { text } = await callGeminiMultiImage({
      proxySecret: c.env.AI_PROXY_SECRET,
      systemPrompt,
      prompt: fullPrompt,
      userContext,
      images: inlineImages,
      tags: imageTags,
      jsonMode: true,
      temperature: 0.3,
      externalId,
      task: 'credit-log',
    })

    try {
      // JSON 파싱 (```json 코드블록 처리)
      const jsonMatch = text.match(/```json\s*([\s\S]*?)```/) || text.match(/```\s*([\s\S]*?)```/)
      const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim()
      const result = JSON.parse(jsonStr)

      // teacher_emphasis → highlights 하위호환 매핑
      result.highlights = result.teacher_emphasis || result.highlights || ''
      if (result.teacher_emphasis) result.teacher_emphasis = result.teacher_emphasis

      // seteuk_questions 정규화 (신형식 question/reason/guide + 구형식 q/reason 모두 지원)
      const rawSeteuk = result.seteuk_questions || result['세특_questions'] || []
      result.seteuk_questions = Array.isArray(rawSeteuk) ? rawSeteuk.map((q: any) => ({
        q: q.question || q.q || '',
        reason: q.reason || '',
        guide: q.guide || '',
        resolved: q.resolved || false,
      })) : []

      // 하위호환: 구형 questions → seteuk_questions 변환
      if (result.seteuk_questions.length === 0 && Array.isArray(result.questions)) {
        result.seteuk_questions = result.questions.map((q: any) => ({
          q: q.improved || q.original || q.question || '',
          reason: '',
          guide: '',
          resolved: false,
        }))
      }

      // quiz 정규화 (신형식 question/answer/explanation)
      if (Array.isArray(result.quiz)) {
        result.quiz = result.quiz.map((q: any) => ({
          question: q.question || '',
          answer: q.answer || '',
          explanation: q.explanation || '',
        }))
        // exam_questions 하위호환 (문자열 배열)
        result.exam_questions = result.quiz.map((q: any) => q.question)
      } else if (Array.isArray(result.exam_questions)) {
        // 구형식: 문자열 배열 → quiz 형식으로 변환
        result.quiz = result.exam_questions.map((q: any) => ({
          question: typeof q === 'string' ? q : (q.question || ''),
          answer: '',
          explanation: '',
        }))
      } else {
        result.quiz = []
        result.exam_questions = []
      }

      // assignment 정규화
      if (typeof result.assignment === 'string' && result.assignment.trim()) {
        result.assignment = {
          title: result.assignment.replace(/\s*기한:.*$/, '').substring(0, 50).trim(),
          description: result.assignment,
          dueDate: '',
          done: false,
        }
      } else if (!result.assignment || (typeof result.assignment === 'string' && !result.assignment.trim())) {
        result.assignment = null
      } else if (typeof result.assignment === 'object') {
        result.assignment = {
          title: result.assignment.content || result.assignment.title || '',
          description: result.assignment.content || result.assignment.description || '',
          dueDate: result.assignment.due || result.assignment.dueDate || '',
          done: result.assignment.done || false,
        }
        // "미확인"이면 null 처리
        if (result.assignment.title === '미확인') result.assignment = null
      }

      return c.json({ success: true, data: result })
    } catch (parseErr: any) {
      console.error('credit-log JSON parse error:', parseErr, 'raw text:', text?.substring(0, 500))
      return c.json({ success: false, error: `AI 응답 파싱 실패: ${text?.substring(0, 100) || 'empty'}` }, 500)
    }
  } catch (e: any) {
    console.error('credit-log AI error:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})


// ==================== API 라우트: 고난도 문제 분석 (Claude) ====================

app.post('/api/deep-analyze', async (c) => {
  try {
    const { question, subject, context, studentId } = await c.req.json()
    if (!question) return c.json({ error: '질문 내용이 필요합니다' }, 400)

    // 진로 프로파일 컨텍스트 로드
    const careerCtx = studentId ? await getStudentCareerContext(c.env.DB, Number(studentId)) : ''
    const externalId = studentId ? await getExternalUserId(c.env.DB, Number(studentId)) : undefined

    const text = await callProxyClaude({
      proxySecret: c.env.AI_PROXY_SECRET,
      externalId,
      task: 'deep-analyze',
      systemPrompt: `당신은 고등학교 수준의 고난도 문제를 분석하는 전문 튜터입니다.
학생이 이해할 수 있도록 단계적으로 설명하되, 핵심 개념과 풀이 전략을 명확히 제시하세요.
답을 바로 주지 말고, 사고 과정을 안내하세요.

응답 형식 (JSON):
{
  "difficulty": "상/중/하",
  "keyConcepts": ["개념1", "개념2"],
  "thinkingSteps": ["1단계: ...", "2단계: ..."],
  "hint": "핵심 힌트",
  "commonMistakes": ["흔한 실수1"],
  "relatedTopics": ["관련 주제1"]
}` + careerCtx,
      prompt: `과목: ${subject}\n${context ? `배경: ${context}\n` : ''}\n질문: ${question}`,
      jsonMode: true,
      maxTokens: 2048,
      temperature: 0.3,
    })

    try {
      return c.json(JSON.parse(text))
    } catch {
      return c.json({ analysis: text })
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== API 라우트: 시험 대비 코칭 (Gemini) ====================

app.post('/api/exam-coach', async (c) => {
  try {
    const { prompt } = await c.req.json()
    if (!prompt) return c.json({ error: '프롬프트가 필요합니다' }, 400)

    const { text } = await callGeminiWithFallback({
      proxySecret: c.env.AI_PROXY_SECRET,
      prompt,
      jsonMode: false,
      temperature: 0.7,
      task: 'exam-coach',
    })

    return c.json({ plan: text })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== API 라우트: 탐구보고서 질문 진단 (Gemini Flash) ====================

const REPORT_DIAGNOSIS_PROMPT = `당신은 2축 9단계 질문 진단 전문가입니다.
학생의 탐구보고서 과정에서 나온 질문을 분석하여 수준을 판정하세요.

[2축 9단계]
호기심 축: A-1(뭐지? 8XP), A-2(어떻게? 10XP), B-1(왜? 15XP), B-2(만약에? 20XP), C-1(뭐가더나아? 25XP), C-2(그러면? 30XP)
성찰 축: R-1(어디서틀렸지? 15XP), R-2(왜틀렸지? 20XP), R-3(다음엔어떻게? 25XP)

[3대 필수조건 - B-1 이상 판정 시 모두 충족 필수]
① 구체적 대상: 어떤 부분에 대한 질문인지 특정
② 자기 생각: "나는 ~라고 생각하는데" 존재
③ 맥락 연결: 조건/지문/풀이와 구체적 연결

하나라도 빠지면 A 수준으로 하향. 애매하면 낮은 쪽.
"왜요?" → 자기생각 없으면 A. "만약 다르면?" → 뭐가 다른지 없으면 A.

반드시 JSON만 출력:
{
  "level": "B-1",
  "axis": "curiosity",
  "xp": 15,
  "diag": {
    "specific_target": {"met": true, "detail": "..."},
    "own_thinking": {"met": true, "detail": "..."},
    "context_connection": {"met": false, "detail": "..."}
  },
  "coaching_comment": "친근한 말투로 2~3문장. 칭찬+업그레이드 힌트",
  "upgrade_hint": "한 단계 올리려면 이렇게: '...'"
}`;

app.post('/api/report-diagnose', async (c) => {
  try {
    const { question, phase, projectTitle, subject } = await c.req.json()
    if (!question) return c.json({ error: '질문 내용이 필요합니다' }, 400)

    const fullPrompt = REPORT_DIAGNOSIS_PROMPT + `\n\n학생의 질문:\n"${question}"\n\n현재 탐구 단계: ${phase || '주제 선정'}\n탐구 주제: ${projectTitle || '미정'}\n과목: ${subject || '미지정'}\n\nJSON만 출력:`

    const { text } = await callGeminiWithFallback({
      proxySecret: c.env.AI_PROXY_SECRET,
      prompt: fullPrompt,
      jsonMode: true,
      temperature: 0.3,
      task: 'report-diagnose',
    })

    try {
      return c.json(JSON.parse(cleanJsonResponse(text)))
    } catch {
      return c.json({ level: 'A-1', axis: 'curiosity', xp: 8, coaching_comment: text })
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== API 라우트: 탐구보고서 AI 멘토 (Perplexity) ====================

app.post('/api/report-mentor', async (c) => {
  try {
    const { question, phase, projectTitle, subject, questionHistory } = await c.req.json()
    if (!question) return c.json({ error: '질문 내용이 필요합니다' }, 400)

    const histSummary = (questionHistory || []).slice(-5).map((q: any) =>
      `[${q.level}] ${q.text}`
    ).join('\n') || '(아직 없음)'

    const systemPrompt = `당신은 고등학생의 탐구 보고서를 돕는 정율 멘토입니다.

현재 탐구 단계: ${phase || '주제 선정'}
탐구 주제: ${projectTitle || '(아직 설정 안 됨)'}
과목: ${subject || '미지정'}

이 학생의 최근 질문 이력 (수준 포함):
${histSummary}

[규칙]
1. 답을 바로 주지 말고 학생이 스스로 생각하도록 질문을 던져주세요.
2. 학생의 질문 수준이 올라가도록 유도하세요.
3. 자료를 언급할 때는 출처를 반드시 밝혀주세요. (URL 포함)
4. 한국어로, 친근하지만 학술적으로 답변하세요.
5. 검색된 최신 자료가 있으면 활용하세요.
6. 관련 논문이나 연구가 있으면 소개해주세요.`

    const res = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 1500,
        temperature: 0.5,
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: 'Perplexity API 오류', detail: err }, 500)
    }

    const data: any = await res.json()
    const text = data.choices?.[0]?.message?.content || '응답을 생성하지 못했습니다.'
    const citations = data.citations || []
    return c.json({ answer: text, citations })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== AUTH API: 외부 앱 연동 로그인 (원격 DB) ====================
// 호출: GET /api/auth/external-login?user_id=1234
// 원격 DB(jungyoul.com)에서 사용자 정보를 조회하고 로컬 D1에 자동 동기화
app.get('/api/auth/external-login', async (c) => {
  try {
    const userId = c.req.query('user_id');
    if (!userId || isNaN(Number(userId))) return c.json({ error: 'user_id 파라미터가 필요합니다' }, 400);

    const jyskApiUrl = c.env.JYSK_API_URL || 'https://jungyoul.com/api/jysk-api.php';
    const jyskApiKey = c.env.JYSK_API_KEY || 'jysk-planner-2026';

    // 1. 원격 DB에서 사용자 정보 조회
    let userData: any;
    try {
      const userRes = await fetch(`${jyskApiUrl}?action=get_user&user_id=${userId}&key=${jyskApiKey}`);
      const contentType = userRes.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        return c.json({ error: '원격 DB API 서버에 연결할 수 없습니다. PHP 프록시가 배치되었는지 확인하세요.', url: `${jyskApiUrl}?action=get_user&user_id=${userId}` }, 502);
      }
      userData = await userRes.json();
    } catch (fetchErr: any) {
      return c.json({ error: '원격 DB API 서버 통신 오류', detail: fetchErr.message }, 502);
    }
    if (!userData.success || !userData.user) {
      return c.json({ error: '원격 DB에서 사용자를 찾을 수 없습니다', detail: userData.error }, 404);
    }
    const remoteUser = userData.user;
    
    // active_flag 확인
    if (remoteUser.active_flag != 1) {
      return c.json({ error: '비활성화된 계정입니다. 관리자에게 문의하세요.' }, 403);
    }

    // kind: 1=원장/관리자, 2=학생, 3=선생님/멘토
    const kind = Number(remoteUser.kind);
    const remoteUserId = Number(remoteUser.user_id);
    const name = remoteUser.name || `사용자${remoteUserId}`;

    // 2. 역할별 분기 처리
    if (kind === 3) {
      // ===== 멘토(선생님) =====
      // 로컬 D1에 멘토가 있는지 확인 (external_user_id로 매칭)
      let mentor: any = await c.env.DB.prepare(
        'SELECT * FROM mentors WHERE external_user_id = ?'
      ).bind(remoteUserId).first();

      if (!mentor) {
        // 멘토 자동 생성
        const loginId = `ext_mentor_${remoteUserId}`;
        const passwordHash = await hashPassword(`ext_${remoteUserId}_auto`);
        const result = await c.env.DB.prepare(
          'INSERT INTO mentors (login_id, password_hash, name, academy_name, phone, external_user_id) VALUES (?, ?, ?, ?, ?, ?)'
        ).bind(loginId, passwordHash, name, '정율사관학원', remoteUser.phone || '', remoteUserId).run();
        const mentorId = result.meta.last_row_id;

        // 원격 DB에서 멘토가 관리하는 반/학생 목록 조회
        let studentsData: any = { success: false };
        try {
          const studentsRes = await fetch(`${jyskApiUrl}?action=get_mentor_students&user_id=${remoteUserId}&key=${jyskApiKey}`);
          const ct = studentsRes.headers.get('content-type') || '';
          if (ct.includes('json')) studentsData = await studentsRes.json();
        } catch (_) { /* 원격 DB 연결 실패 시 기본 반 생성으로 진행 */ }

        if (studentsData.success && studentsData.classes) {
          // 그룹만 배치로 생성 (학생은 별도 API에서 비동기 처리)
          const groupStmts: any[] = [];
          for (const cls of studentsData.classes) {
            const inviteCode = generateInviteCode();
            groupStmts.push(
              c.env.DB.prepare(
                'INSERT INTO groups (mentor_id, name, invite_code, description, external_class_id) VALUES (?, ?, ?, ?, ?)'
              ).bind(mentorId, cls.class_name || `반${cls.class_id}`, inviteCode, '', cls.class_id)
            );
          }
          if (groupStmts.length > 0) {
            await c.env.DB.batch(groupStmts);
            // 배치 생성된 그룹들에 대해 커뮤니티 보드 생성 (최적화: 배치 쿼리)
            try {
              const newGroups: any = await c.env.DB.prepare(
                'SELECT id, name FROM groups WHERE mentor_id = ? AND is_active = 1'
              ).bind(mentorId).all();
              const groupIds = (newGroups.results || []).map((g: any) => g.id);
              if (groupIds.length > 0) {
                // 기존 보드를 한 번에 조회
                const existingBoards: any = await c.env.DB.prepare(
                  `SELECT group_id FROM community_boards WHERE board_type = 'group' AND group_id IN (${groupIds.join(',')})`
                ).all();
                const existingGroupIds = new Set((existingBoards.results || []).map((b: any) => b.group_id));
                // 없는 그룹만 배치 INSERT
                const boardInserts = (newGroups.results || [])
                  .filter((g: any) => !existingGroupIds.has(g.id))
                  .map((g: any) => c.env.DB.prepare(
                    "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
                  ).bind(g.id, `${g.name} 게시판`));
                if (boardInserts.length > 0) await c.env.DB.batch(boardInserts);
              }
            } catch (e) { console.error('Board creation hook error:', e); }
          }
        } else {
          // 반/학생 정보 없으면 기본 반 생성
          const inviteCode = generateInviteCode();
          const defaultGrpResult = await c.env.DB.prepare(
            'INSERT INTO groups (mentor_id, name, invite_code, description) VALUES (?, ?, ?, ?)'
          ).bind(mentorId, `${name} 선생님 반`, inviteCode, '').run();
          try {
            const defGroupId = defaultGrpResult.meta.last_row_id;
            if (defGroupId) {
              await c.env.DB.prepare(
                "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
              ).bind(defGroupId, `${name} 선생님 반 게시판`).run();
            }
          } catch (e) { console.error('Board creation hook error:', e); }
        }

        mentor = await c.env.DB.prepare('SELECT * FROM mentors WHERE id = ?').bind(mentorId).first();
      } else {
        // 멘토 이름 동기화
        if (mentor.name !== name) {
          await c.env.DB.prepare('UPDATE mentors SET name = ? WHERE id = ?').bind(name, mentor.id).run();
          mentor.name = name;
        }

        // ===== 매 로그인 시 그룹 동기화 (최적화: 배치 쿼리, 학생은 별도 API) =====
        try {
          const studentsRes = await fetch(`${jyskApiUrl}?action=get_mentor_students&user_id=${remoteUserId}&key=${jyskApiKey}`);
          const ct = studentsRes.headers.get('content-type') || '';
          if (ct.includes('json')) {
            const studentsData: any = await studentsRes.json();
            if (studentsData.success && studentsData.classes) {
              const remoteClassIds = new Set(studentsData.classes.map((cls: any) => Number(cls.class_id)));

              // 로컬 기존 그룹 조회 (1 쿼리)
              const localGroups: any = await c.env.DB.prepare(
                'SELECT id, name, external_class_id, is_active FROM groups WHERE mentor_id = ?'
              ).bind(mentor.id).all();

              const localClassMap = new Map<number, any>();
              for (const g of (localGroups.results || [])) {
                if (g.external_class_id) localClassMap.set(Number(g.external_class_id), g);
              }

              // 배치 쿼리 수집
              const batchStmts: any[] = [];

              // 1) 원격에 없는 로컬 그룹 → 비활성화
              for (const g of (localGroups.results || [])) {
                if (g.external_class_id && !remoteClassIds.has(Number(g.external_class_id)) && g.is_active === 1) {
                  batchStmts.push(
                    c.env.DB.prepare('UPDATE groups SET is_active = 0, updated_at = datetime(\'now\',\'+9 hours\') WHERE id = ?').bind(g.id)
                  );
                }
              }

              // 2) 원격에 있는 클래스 → 로컬에 없으면 생성, 있으면 이름/활성상태 업데이트
              const newGroups: { cls: any, inviteCode: string }[] = [];
              for (const cls of studentsData.classes) {
                const extClassId = Number(cls.class_id);
                const existingGroup = localClassMap.get(extClassId);

                if (!existingGroup) {
                  const inviteCode = generateInviteCode();
                  newGroups.push({ cls, inviteCode });
                  batchStmts.push(
                    c.env.DB.prepare(
                      'INSERT INTO groups (mentor_id, name, invite_code, description, external_class_id) VALUES (?, ?, ?, ?, ?)'
                    ).bind(mentor.id, cls.class_name || `반${cls.class_id}`, inviteCode, '', extClassId)
                  );
                } else {
                  if (existingGroup.name !== cls.class_name || existingGroup.is_active !== 1) {
                    batchStmts.push(
                      c.env.DB.prepare(
                        'UPDATE groups SET name = ?, is_active = 1, updated_at = datetime(\'now\',\'+9 hours\') WHERE id = ?'
                      ).bind(cls.class_name || existingGroup.name, existingGroup.id)
                    );
                  }
                }
              }

              // 배치 실행 (그룹 동기화만, 학생은 별도)
              if (batchStmts.length > 0) {
                await c.env.DB.batch(batchStmts);
                // 새로 생성된 그룹에 커뮤니티 보드 자동 생성 (최적화: 배치 쿼리)
                if (newGroups.length > 0) {
                  try {
                    const allGroups: any = await c.env.DB.prepare(
                      'SELECT id, name FROM groups WHERE mentor_id = ? AND is_active = 1'
                    ).bind(mentor.id).all();
                    const groupIds = (allGroups.results || []).map((g: any) => g.id);
                    if (groupIds.length > 0) {
                      // 기존 보드를 한 번에 조회
                      const existingBoards: any = await c.env.DB.prepare(
                        `SELECT group_id FROM community_boards WHERE board_type = 'group' AND group_id IN (${groupIds.join(',')})`
                      ).all();
                      const existingGroupIds = new Set((existingBoards.results || []).map((b: any) => b.group_id));
                      // 없는 그룹만 배치 INSERT
                      const boardInserts = (allGroups.results || [])
                        .filter((g: any) => !existingGroupIds.has(g.id))
                        .map((g: any) => c.env.DB.prepare(
                          "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
                        ).bind(g.id, `${g.name} 게시판`));
                      if (boardInserts.length > 0) await c.env.DB.batch(boardInserts);
                    }
                  } catch (e) { console.error('Board creation hook error:', e); }
                }
              }
            }
          }
        } catch (syncErr: any) {
          console.log('Mentor group sync error (non-fatal):', syncErr.message);
        }
      }

      // 멘토 그룹 목록 조회 (활성 그룹만)
      const groups = await c.env.DB.prepare(
        'SELECT id, name, invite_code, description, max_students, is_active, external_class_id FROM groups WHERE mentor_id = ? AND is_active = 1'
      ).bind(mentor.id).all();

      const token = generateToken();
      return c.json({
        success: true,
        token,
        role: 'mentor',
        externalUserId: remoteUserId,
        externalKind: kind, // 원격 DB의 kind 값 (3=teacher)
        user: { id: mentor.id, loginId: mentor.login_id, name: mentor.name, academyName: mentor.academy_name, phone: mentor.phone },
        groups: groups.results,
      });

    } else if (kind === 2) {
      // ===== 학생 =====
      let student: any = await c.env.DB.prepare(
        'SELECT * FROM students WHERE external_user_id = ? AND is_active = 1'
      ).bind(remoteUserId).first();

      if (!student) {
        // 학생이 아직 로컬에 없으면 자동 생성
        const stPwHash = await hashPassword(`ext_${remoteUserId}_auto`);
        const emojis = ['😊','😎','🤓','🦊','🐱','🐶','🦁','🐻','🐼','🐨','🦄','🐸','🐰','🐯'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];

        // 원격 사용자의 class_id로 로컬 그룹 찾기
        let groupId: number | null = null;
        const remoteClassId = remoteUser.class_id ? Number(remoteUser.class_id) : null;

        if (remoteClassId) {
          // external_class_id로 그룹 찾기
          const group: any = await c.env.DB.prepare(
            'SELECT id FROM groups WHERE external_class_id = ? AND is_active = 1'
          ).bind(remoteClassId).first();
          if (group) {
            groupId = group.id;
          }
        }

        // 그룹이 없으면 첫 번째 활성 그룹 사용, 없으면 새로 생성
        if (!groupId) {
          const defaultGroup: any = await c.env.DB.prepare(
            'SELECT id FROM groups WHERE is_active = 1 ORDER BY id LIMIT 1'
          ).first();

          if (defaultGroup) {
            groupId = defaultGroup.id;
          } else {
            // 그룹이 하나도 없으면 기본 그룹 생성
            const inviteCode = generateInviteCode();
            const newGroupResult = await c.env.DB.prepare(
              'INSERT INTO groups (mentor_id, name, invite_code, description) VALUES (1, ?, ?, ?)'
            ).bind('기본반', inviteCode, '외부 로그인 학생용 기본 그룹').run();
            groupId = newGroupResult.meta.last_row_id as number;
          }
        }

        if (!groupId) {
          return c.json({ error: '학생을 배치할 그룹을 찾을 수 없습니다. 먼저 멘토/그룹을 생성해주세요.' }, 400);
        }

        const result = await c.env.DB.prepare(
          'INSERT INTO students (group_id, name, password_hash, school_name, grade, profile_emoji, external_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(groupId, name, stPwHash, '', 0, emoji, remoteUserId).run();

        const studentId = result.meta.last_row_id;
        student = await c.env.DB.prepare(
          'SELECT * FROM students WHERE id = ?'
        ).bind(studentId).first();

        // student_groups 테이블에도 추가
        try {
          await c.env.DB.prepare(
            'INSERT OR IGNORE INTO student_groups (student_id, group_id) VALUES (?, ?)'
          ).bind(studentId, groupId).run();
        } catch(_) { /* ignore */ }
      } else {
        // 이름 동기화
        if (student.name !== name) {
          await c.env.DB.prepare('UPDATE students SET name = ? WHERE id = ?').bind(name, student.id).run();
          student.name = name;
        }
      }

      await c.env.DB.prepare('UPDATE students SET last_login_at = ? WHERE id = ?').bind(getKSTString(), student.id).run();

      // student_groups에서 모든 그룹 조회
      const groupsResult = await c.env.DB.prepare(`
        SELECT g.id, g.name FROM groups g
        JOIN student_groups sg ON g.id = sg.group_id
        WHERE sg.student_id = ? AND g.is_active = 1
      `).bind(student.id).all();
      const groups = groupsResult.results || [];

      // 하위호환: 첫 번째 그룹을 기본 그룹으로
      const firstGroup: any = groups[0];
      const group: any = firstGroup ? {
        id: firstGroup.id, name: firstGroup.name,
        mentorName: '정율사관학원', academyName: '정율사관학원',
      } : null;

      const token = generateToken();
      return c.json({
        success: true,
        token,
        role: 'student',
        externalUserId: remoteUserId,
        user: { id: student.id, name: student.name, schoolName: student.school_name, grade: student.grade, profileEmoji: student.profile_emoji, xp: student.xp || 0, level: student.level || 1 },
        group,
        groups,
      });

    } else if (kind === 1) {
      // ===== 원장/관리자 =====
      const token = generateToken();
      return c.json({
        success: true,
        token,
        role: 'director',
        externalUserId: remoteUserId,
        user: { id: remoteUserId, name, kind: 1 },
      });

    } else {
      return c.json({ error: `지원하지 않는 사용자 유형입니다 (kind=${kind})` }, 400);
    }

  } catch (e: any) {
    console.error('External login error:', e);
    return c.json({ error: e.message }, 500);
  }
});


// ==================== AUTH API: 학생 회원가입 ====================

app.post('/api/auth/student/register', async (c) => {
  try {
    const { name, password, schoolName, grade } = await c.req.json();
    if (!name || !password) return c.json({ error: '이름, 비밀번호는 필수입니다' }, 400);
    if (password.length < 4) return c.json({ error: '비밀번호는 4자 이상이어야 합니다' }, 400);

    // 기본 그룹 (첫 번째 활성 그룹) 가져오기
    const group: any = await c.env.DB.prepare(
      'SELECT g.*, m.name as mentor_name, m.academy_name FROM groups g JOIN mentors m ON g.mentor_id = m.id WHERE g.is_active = 1 ORDER BY g.id ASC LIMIT 1'
    ).first();

    if (!group) return c.json({ error: '등록 가능한 반이 없습니다. 관리자에게 문의하세요.' }, 404);

    // 같은 이름 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM students WHERE name = ? AND is_active = 1'
    ).bind(name).first();
    if (existing) return c.json({ error: '동일한 이름이 이미 등록되어 있습니다. 이름 뒤에 번호를 붙여주세요 (예: 홍길동2)' }, 409);

    // 정원 확인
    const count: any = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM students WHERE group_id = ? AND is_active = 1'
    ).bind(group.id).first();
    if (count.cnt >= group.max_students) return c.json({ error: '반의 정원이 가득 찼습니다' }, 409);

    const passwordHash = await hashPassword(password);
    const emojis = ['😊','😎','🤓','🦊','🐱','🐶','🦁','🐻','🐼','🐨','🦄','🐸','🐰','🐯'];
    const profileEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    const result = await c.env.DB.prepare(
      'INSERT INTO students (group_id, name, password_hash, school_name, grade, profile_emoji) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(group.id, name, passwordHash, schoolName || '', grade || 1, profileEmoji).run();

    return c.json({
      success: true,
      studentId: result.meta.last_row_id,
      message: '회원가입이 완료되었습니다!',
      groupName: group.name,
      mentorName: group.mentor_name,
      academyName: group.academy_name,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== AUTH API: 학생 로그인 ====================

app.post('/api/auth/student/login', async (c) => {
  try {
    const { name, password } = await c.req.json();
    if (!name || !password) return c.json({ error: '이름과 비밀번호를 입력해주세요' }, 400);

    // 이름으로 학생 찾기
    const student: any = await c.env.DB.prepare(
      'SELECT * FROM students WHERE name = ? AND is_active = 1'
    ).bind(name).first();

    if (!student) return c.json({ error: '이름 또는 비밀번호가 틀렸습니다' }, 401);

    const valid = await verifyPassword(password, student.password_hash);
    if (!valid) return c.json({ error: '이름 또는 비밀번호가 틀렸습니다' }, 401);

    // student_groups에서 모든 그룹 조회
    const groupsResult = await c.env.DB.prepare(`
      SELECT g.id, g.name, m.name as mentor_name, m.academy_name
      FROM groups g
      JOIN student_groups sg ON g.id = sg.group_id
      JOIN mentors m ON g.mentor_id = m.id
      WHERE sg.student_id = ? AND g.is_active = 1
    `).bind(student.id).all();
    const groups = (groupsResult.results || []).map((g: any) => ({
      id: g.id,
      name: g.name,
      mentorName: g.mentor_name,
      academyName: g.academy_name,
    }));

    // 마지막 로그인 시간 업데이트
    await c.env.DB.prepare(
      'UPDATE students SET last_login_at = ? WHERE id = ?'
    ).bind(getKSTString(), student.id).run();

    const token = generateToken();

    // 하위호환: 첫 번째 그룹을 기본 그룹으로
    const firstGroup = groups[0] || null;

    return c.json({
      success: true,
      token,
      role: 'student',
      user: {
        id: student.id,
        name: student.name,
        schoolName: student.school_name,
        grade: student.grade,
        profileEmoji: student.profile_emoji,
        xp: student.xp,
        level: student.level,
        nickname: student.nickname || null,
      },
      group: firstGroup,
      groups,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== AUTH API: 초대코드 확인 ====================

app.get('/api/auth/verify-invite/:code', async (c) => {
  try {
    const code = c.req.param('code');
    const group: any = await c.env.DB.prepare(
      'SELECT g.name, g.description, m.name as mentor_name, m.academy_name FROM groups g JOIN mentors m ON g.mentor_id = m.id WHERE g.invite_code = ? AND g.is_active = 1'
    ).bind(code.toUpperCase()).first();

    if (!group) return c.json({ valid: false, error: '유효하지 않은 초대코드입니다' }, 404);

    return c.json({
      valid: true,
      groupName: group.name,
      mentorName: group.mentor_name,
      academyName: group.academy_name,
      description: group.description,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});




// ==================== STUDENT DATA API: 시험 ====================

app.get('/api/student/:studentId/exams', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const exams = await c.env.DB.prepare(
      'SELECT * FROM exams WHERE student_id = ? ORDER BY start_date DESC'
    ).bind(studentId).all();
    return c.json({ exams: exams.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/student/:studentId/exams', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { name, type, startDate, subjects, memo } = await c.req.json();
    if (!name || !startDate) return c.json({ error: '시험명과 날짜는 필수입니다' }, 400);

    const result = await c.env.DB.prepare(
      'INSERT INTO exams (student_id, name, type, start_date, subjects, memo) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(studentId, name, type || 'midterm', startDate, JSON.stringify(subjects || []), memo || '').run();

    return c.json({ success: true, examId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.put('/api/student/exams/:examId', async (c) => {
  try {
    const examId = c.req.param('examId');
    const body = await c.req.json();
    const fields: string[] = [];
    const values: any[] = [];

    if (body.name !== undefined) { fields.push('name = ?'); values.push(body.name); }
    if (body.type !== undefined) { fields.push('type = ?'); values.push(body.type); }
    if (body.startDate !== undefined) { fields.push('start_date = ?'); values.push(body.startDate); }
    if (body.subjects !== undefined) { fields.push('subjects = ?'); values.push(JSON.stringify(body.subjects)); }
    if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
    if (body.memo !== undefined) { fields.push('memo = ?'); values.push(body.memo); }
    fields.push('updated_at = ?'); values.push(getKSTString());

    values.push(examId);
    await c.env.DB.prepare(`UPDATE exams SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 시험 결과 ====================

app.post('/api/student/:studentId/exam-results', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { examId, totalScore, grade, subjectsData, overallReflection, wrongAnswers } = await c.req.json();
    if (!examId) return c.json({ error: '시험 ID는 필수입니다' }, 400);

    // 기존 결과 삭제 (업데이트용)
    const existingResult: any = await c.env.DB.prepare(
      'SELECT id FROM exam_results WHERE exam_id = ?'
    ).bind(examId).first();

    if (existingResult) {
      await c.env.DB.prepare('DELETE FROM wrong_answer_images WHERE wrong_answer_id IN (SELECT id FROM wrong_answers WHERE exam_result_id = ?)').bind(existingResult.id).run();
      await c.env.DB.prepare('DELETE FROM wrong_answers WHERE exam_result_id = ?').bind(existingResult.id).run();
      await c.env.DB.prepare('DELETE FROM exam_results WHERE id = ?').bind(existingResult.id).run();
    }

    // 시험 결과 저장
    const result = await c.env.DB.prepare(
      'INSERT INTO exam_results (exam_id, student_id, total_score, grade, subjects_data, overall_reflection) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(examId, studentId, totalScore || 0, grade || 0, JSON.stringify(subjectsData || []), overallReflection || '').run();

    const resultId = result.meta.last_row_id;

    // 오답 저장
    if (wrongAnswers && wrongAnswers.length > 0) {
      for (const wa of wrongAnswers) {
        const waResult = await c.env.DB.prepare(
          'INSERT INTO wrong_answers (exam_result_id, student_id, subject, question_number, topic, error_type, my_answer, correct_answer, reason, reflection) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
        ).bind(resultId, studentId, wa.subject || '', wa.number || 0, wa.topic || '', wa.type || '', wa.myAnswer || '', wa.correctAnswer || '', wa.reason || '', wa.reflection || '').run();

        // 오답 사진 저장
        if (wa.images && wa.images.length > 0) {
          for (let i = 0; i < wa.images.length; i++) {
            await c.env.DB.prepare(
              'INSERT INTO wrong_answer_images (wrong_answer_id, image_data, sort_order) VALUES (?, ?, ?)'
            ).bind(waResult.meta.last_row_id, wa.images[i], i).run();
          }
        }
      }
    }

    // 시험 상태 업데이트
    await c.env.DB.prepare('UPDATE exams SET status = ? WHERE id = ?').bind('completed', examId).run();

    return c.json({ success: true, resultId });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/student/:studentId/exam-results', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const results = await c.env.DB.prepare(`
      SELECT er.*, e.name as exam_name, e.type as exam_type, e.start_date
      FROM exam_results er
      JOIN exams e ON er.exam_id = e.id
      WHERE er.student_id = ?
      ORDER BY e.start_date DESC
    `).bind(studentId).all();

    // 모든 오답 + 이미지를 배치 조회 (N+1 방지)
    const resultIds = (results.results as any[]).map(r => r.id);
    let allWrongAnswers: any[] = [];
    let allImages: any[] = [];

    if (resultIds.length > 0) {
      const placeholders = resultIds.map(() => '?').join(',');
      const [waResult, imgResult] = await Promise.all([
        c.env.DB.prepare(
          `SELECT * FROM wrong_answers WHERE exam_result_id IN (${placeholders}) ORDER BY id`
        ).bind(...resultIds).all(),
        c.env.DB.prepare(
          `SELECT wai.* FROM wrong_answer_images wai
           INNER JOIN wrong_answers wa ON wai.wrong_answer_id = wa.id
           WHERE wa.exam_result_id IN (${placeholders}) ORDER BY wai.sort_order`
        ).bind(...resultIds).all(),
      ]);
      allWrongAnswers = waResult.results as any[];
      allImages = imgResult.results as any[];
    }

    // 이미지를 wrong_answer_id별로 그룹핑
    const imageMap: Record<number, string[]> = {};
    for (const img of allImages) {
      if (!imageMap[img.wrong_answer_id]) imageMap[img.wrong_answer_id] = [];
      imageMap[img.wrong_answer_id].push(img.image_data);
    }

    // 오답을 exam_result_id별로 그룹핑
    const waMap: Record<number, any[]> = {};
    for (const wa of allWrongAnswers) {
      if (!waMap[wa.exam_result_id]) waMap[wa.exam_result_id] = [];
      waMap[wa.exam_result_id].push({ ...wa, images: imageMap[wa.id] || [] });
    }

    const fullResults = (results.results as any[]).map(r => ({
      ...r, wrongAnswers: waMap[r.id] || []
    }));

    return c.json({ results: fullResults });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 과제 ====================

app.get('/api/student/:studentId/assignments', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const assignments = await c.env.DB.prepare(
      'SELECT * FROM assignments WHERE student_id = ? ORDER BY due_date DESC'
    ).bind(studentId).all();
    return c.json({ assignments: assignments.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/student/:studentId/assignments', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { subject, title, description, teacherName, dueDate, color, planData } = await c.req.json();
    if (!title || !dueDate) return c.json({ error: '과제명과 마감일은 필수입니다' }, 400);

    const result = await c.env.DB.prepare(
      'INSERT INTO assignments (student_id, subject, title, description, teacher_name, due_date, color, plan_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, subject || '', title, description || '', teacherName || '', dueDate, color || '#6C5CE7', JSON.stringify(planData || [])).run();

    return c.json({ success: true, assignmentId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.put('/api/student/assignments/:assignmentId', async (c) => {
  try {
    const assignmentId = c.req.param('assignmentId');
    const body = await c.req.json();
    const fields: string[] = [];
    const values: any[] = [];

    if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
    if (body.progress !== undefined) { fields.push('progress = ?'); values.push(body.progress); }
    if (body.planData !== undefined) { fields.push('plan_data = ?'); values.push(JSON.stringify(body.planData)); }
    if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
    if (body.dueDate !== undefined) { fields.push('due_date = ?'); values.push(body.dueDate); }
    fields.push('updated_at = ?'); values.push(getKSTString());

    values.push(assignmentId);
    await c.env.DB.prepare(`UPDATE assignments SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// DELETE: 과제 삭제
app.delete('/api/student/assignments/:assignmentId', async (c) => {
  try {
    const assignmentId = c.req.param('assignmentId');
    await c.env.DB.prepare('DELETE FROM assignments WHERE id = ?').bind(assignmentId).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 오늘 할 일 (Daily Todos) ====================

app.get('/api/student/:studentId/daily-todos', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const date = c.req.query('date') || new Date().toISOString().split('T')[0];
    const todos = await c.env.DB.prepare(
      'SELECT * FROM daily_todos WHERE student_id = ? AND date = ? ORDER BY is_completed ASC, sort_order ASC, id ASC'
    ).bind(studentId, date).all();
    return c.json({ success: true, data: todos.results });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.post('/api/student/:studentId/daily-todos', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { content, date } = await c.req.json();
    if (!content?.trim()) return c.json({ success: false, error: '내용을 입력하세요' }, 400);
    const todoDate = date || new Date().toISOString().split('T')[0];
    const result = await c.env.DB.prepare(
      'INSERT INTO daily_todos (student_id, date, content, sort_order) VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order),0)+1 FROM daily_todos WHERE student_id = ? AND date = ?))'
    ).bind(studentId, todoDate, content.trim(), studentId, todoDate).run();
    return c.json({ success: true, data: { id: result.meta.last_row_id, content: content.trim(), date: todoDate, is_completed: 0 } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.patch('/api/student/:studentId/daily-todos/:todoId', async (c) => {
  try {
    const todoId = c.req.param('todoId');
    const body = await c.req.json();
    const fields: string[] = [];
    const values: any[] = [];
    if (body.is_completed !== undefined) { fields.push('is_completed = ?'); values.push(body.is_completed ? 1 : 0); }
    if (body.content !== undefined) { fields.push('content = ?'); values.push(body.content.trim()); }
    if (fields.length === 0) return c.json({ success: false, error: '변경할 필드 없음' }, 400);
    values.push(todoId);
    await c.env.DB.prepare(`UPDATE daily_todos SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

app.delete('/api/student/:studentId/daily-todos/:todoId', async (c) => {
  try {
    const todoId = c.req.param('todoId');
    await c.env.DB.prepare('DELETE FROM daily_todos WHERE id = ?').bind(todoId).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==================== STUDENT DATA API: 플래너 통합 조회 ====================

app.get('/api/student/:studentId/planner', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const month = c.req.query('month'); // YYYY-MM
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return c.json({ error: 'month 파라미터 필수 (YYYY-MM)' }, 400);
    }
    const monthPrefix = month + '%';

    const [assignments, exams] = await Promise.all([
      c.env.DB.prepare(
        'SELECT id, subject, title, due_date, status, color FROM assignments WHERE student_id = ? AND due_date LIKE ?'
      ).bind(studentId, monthPrefix).all(),
      c.env.DB.prepare(
        'SELECT id, name, type, start_date, subjects FROM exams WHERE student_id = ? AND start_date LIKE ?'
      ).bind(studentId, monthPrefix).all(),
    ]);

    const events: any[] = [];

    (assignments.results as any[]).forEach(a => {
      events.push({
        id: 'a-' + a.id,
        date: a.due_date,
        type: 'assignment',
        subject: a.subject || '',
        title: a.title,
        color: a.color || '#3B82F6',
        status: a.status,
      });
    });

    (exams.results as any[]).forEach(e => {
      const typeColorMap: Record<string, string> = {
        midterm: '#EF4444', final: '#EF4444',
        performance: '#F59E0B', mock: '#1D4ED8', quiz: '#10B981',
      };
      events.push({
        id: 'e-' + e.id,
        date: e.start_date,
        type: e.type || 'midterm',
        subject: '',
        title: e.name,
        color: typeColorMap[e.type] || '#EF4444',
        subjects: e.subjects,
      });
    });

    return c.json({ success: true, data: { events } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==================== STUDENT DATA API: 수업 기록 ====================

app.get('/api/student/:studentId/class-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const limit = parseInt(c.req.query('limit') || '200');
    const offset = parseInt(c.req.query('offset') || '0');
    const records = await c.env.DB.prepare(
      'SELECT id, subject, date, content, keywords, understanding, memo, topic, pages, photos, teacher_note, ai_credit_log, photo_tags, photo_count, created_at FROM class_records WHERE student_id = ? ORDER BY date DESC LIMIT ? OFFSET ?'
    ).bind(studentId, limit, offset).all();
    return c.json({ records: records.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/student/:studentId/class-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { subject, date, content, keywords, understanding, memo, topic, pages, photos, photo_count, teacher_note, ai_credit_log, photo_tags } = await c.req.json();
    if (!subject || !date) return c.json({ error: '과목과 날짜는 필수입니다' }, 400);

    const result = await c.env.DB.prepare(
      'INSERT INTO class_records (student_id, subject, date, content, keywords, understanding, memo, topic, pages, photos, teacher_note, ai_credit_log, photo_tags, photo_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, subject, date, content || '', JSON.stringify(keywords || []), understanding || 3, memo || '', topic || '', pages || '', JSON.stringify(photos || []), teacher_note || '', ai_credit_log ? JSON.stringify(ai_credit_log) : '', JSON.stringify(photo_tags || []), photo_count || 0).run();

    return c.json({ success: true, recordId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 수업 기록 전체 삭제 (학생별)
app.delete('/api/student/:studentId/class-records/all', async (c) => {
  try {
    const studentId = c.req.param('studentId')

    // 1. 삭제 대상 수 카운트
    const countResult = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM class_records WHERE student_id = ?'
    ).bind(studentId).first() as any
    const deletedCount = countResult?.cnt || 0

    if (deletedCount > 0) {
      // 2. DB 사진 레코드 삭제 (서브쿼리)
      await c.env.DB.prepare(
        'DELETE FROM class_record_photos WHERE class_record_id IN (SELECT id FROM class_records WHERE student_id = ?)'
      ).bind(studentId).run()

      // 3. class_records 삭제
      await c.env.DB.prepare(
        'DELETE FROM class_records WHERE student_id = ?'
      ).bind(studentId).run()
    }

    return c.json({ success: true, deletedCount })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 수업 기록 삭제 (R2 사진 포함)
app.delete('/api/student/class-records/:recordId', async (c) => {
  try {
    const recordId = c.req.param('recordId')
    // DB 사진 + 레코드 삭제
    await c.env.DB.prepare('DELETE FROM class_record_photos WHERE class_record_id = ?').bind(recordId).run()
    await c.env.DB.prepare('DELETE FROM class_records WHERE id = ?').bind(recordId).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 수업 기록 수정
app.put('/api/student/class-records/:recordId', async (c) => {
  try {
    const recordId = c.req.param('recordId');
    const body = await c.req.json();
    const fields: string[] = [];
    const values: any[] = [];

    if (body.subject !== undefined) { fields.push('subject = ?'); values.push(body.subject); }
    if (body.date !== undefined) { fields.push('date = ?'); values.push(body.date); }
    if (body.content !== undefined) { fields.push('content = ?'); values.push(body.content); }
    if (body.keywords !== undefined) { fields.push('keywords = ?'); values.push(JSON.stringify(body.keywords)); }
    if (body.understanding !== undefined) { fields.push('understanding = ?'); values.push(body.understanding); }
    if (body.memo !== undefined) { fields.push('memo = ?'); values.push(body.memo); }
    if (body.topic !== undefined) { fields.push('topic = ?'); values.push(body.topic); }
    if (body.pages !== undefined) { fields.push('pages = ?'); values.push(body.pages); }
    if (body.photos !== undefined) { fields.push('photos = ?'); values.push(JSON.stringify(body.photos)); }
    if (body.teacher_note !== undefined) { fields.push('teacher_note = ?'); values.push(body.teacher_note); }
    if (body.ai_credit_log !== undefined) { fields.push('ai_credit_log = ?'); values.push(typeof body.ai_credit_log === 'string' ? body.ai_credit_log : JSON.stringify(body.ai_credit_log)); }
    if (body.photo_tags !== undefined) { fields.push('photo_tags = ?'); values.push(JSON.stringify(body.photo_tags)); }

    if (fields.length === 0) return c.json({ success: true });

    values.push(recordId);
    await c.env.DB.prepare(`UPDATE class_records SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 수업 기록 사진 ====================

// 사진 업로드 (R2 우선, DB 폴백)
app.post('/api/student/:studentId/class-record-photos', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { photos, classRecordId } = await c.req.json();
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return c.json({ error: '사진 데이터가 필요합니다' }, 400);
    }
    const ids: number[] = [];
    for (const photoData of photos) {
      if (typeof photoData !== 'string' || photoData.length < 10) continue;
      
      let r2Key = '';
      let thumbnail = '';
      const fileSize = Math.round(photoData.length * 0.75);
      
      // R2에 저장 시도
      if (c.env.R2) {
        try {
          r2Key = `photos/${studentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          // base64 → binary
          const match = photoData.match(/^data:(image\/\w+);base64,(.+)$/);
          const rawBase64 = match ? match[2] : photoData.replace(/^data:image\/\w+;base64,/, '');
          const binary = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
          await c.env.R2.put(r2Key, binary, { httpMetadata: { contentType: match?.[1] || 'image/jpeg' } });
          thumbnail = `r2:${r2Key}`;
        } catch (e) {
          console.error('R2 upload failed, falling back to DB:', e);
          r2Key = '';
          thumbnail = photoData.slice(0, 200);
        }
      } else {
        thumbnail = photoData.slice(0, 200);
      }
      
      // DB에 메타데이터 저장 (R2 사용 시 photo_data에 R2 키, 아니면 base64)
      const dataToStore = r2Key ? `r2:${r2Key}` : photoData;
      const result = await c.env.DB.prepare(
        'INSERT INTO class_record_photos (student_id, class_record_id, photo_data, thumbnail, file_size) VALUES (?, ?, ?, ?, ?)'
      ).bind(studentId, classRecordId || null, dataToStore, thumbnail, fileSize).run();
      ids.push(result.meta.last_row_id as number);
    }
    return c.json({ success: true, photoIds: ids });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 개별 사진 삭제 (R2 + DB)
app.delete('/api/photos/:photoId', async (c) => {
  try {
    const photoId = c.req.param('photoId')
    const row: any = await c.env.DB.prepare(
      'SELECT photo_data, class_record_id FROM class_record_photos WHERE id = ?'
    ).bind(photoId).first()
    if (!row) return c.json({ error: 'Photo not found' }, 404)

    // R2에서 삭제
    if (row.photo_data?.startsWith('r2:') && c.env.R2) {
      try { await c.env.R2.delete(row.photo_data.slice(3)) } catch (_) {}
    }

    // DB에서 사진 행 삭제
    await c.env.DB.prepare('DELETE FROM class_record_photos WHERE id = ?').bind(photoId).run()

    // class_records의 photos 배열에서 ref:ID 제거 + photo_count 갱신
    if (row.class_record_id) {
      const rec: any = await c.env.DB.prepare(
        'SELECT photos, photo_tags FROM class_records WHERE id = ?'
      ).bind(row.class_record_id).first()
      if (rec) {
        let photos = []
        let tags = []
        try { photos = JSON.parse(rec.photos || '[]') } catch (_) {}
        try { tags = JSON.parse(rec.photo_tags || '[]') } catch (_) {}
        const refStr = `ref:${photoId}`
        const idx = photos.indexOf(refStr)
        if (idx !== -1) {
          photos.splice(idx, 1)
          tags.splice(idx, 1)
        }
        await c.env.DB.prepare(
          'UPDATE class_records SET photos = ?, photo_tags = ?, photo_count = ? WHERE id = ?'
        ).bind(JSON.stringify(photos), JSON.stringify(tags), photos.length, row.class_record_id).run()
      }
    }

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 사진 원본 조회 (R2 또는 DB)
app.get('/api/photos/:photoId', async (c) => {
  try {
    const photoId = c.req.param('photoId');
    const row: any = await c.env.DB.prepare(
      'SELECT photo_data, mime_type FROM class_record_photos WHERE id = ?'
    ).bind(photoId).first();
    if (!row) return c.json({ error: 'Photo not found' }, 404);
    
    // R2에서 조회
    if (row.photo_data?.startsWith('r2:')) {
      if (!c.env.R2) {
        console.error('R2 binding not available for photo:', photoId);
        return c.json({ error: 'Photo storage unavailable' }, 503);
      }
      try {
        const r2Key = row.photo_data.slice(3);
        const obj = await c.env.R2.get(r2Key);
        if (obj) {
          const arrayBuf = await obj.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);
          let binary = '';
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
          const base64 = btoa(binary);
          const mime = obj.httpMetadata?.contentType || 'image/jpeg';
          return c.json({ photoData: `data:${mime};base64,${base64}` });
        }
      } catch (e) {
        console.error('R2 read failed:', e);
      }
      return c.json({ error: 'Photo not found in storage' }, 404);
    }

    // DB에서 base64 직접 반환 (레거시 호환)
    if (row.photo_data.startsWith('data:')) {
      return c.json({ photoData: row.photo_data });
    }
    return c.json({ photoData: `data:${row.mime_type || 'image/jpeg'};base64,${row.photo_data}` });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 사진 배치 조회 API (N+1 방지)
app.post('/api/photos/batch', async (c) => {
  try {
    const { photoIds } = await c.req.json();
    if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
      return c.json({ photos: {} });
    }
    // 최대 30장 제한
    const ids = photoIds.slice(0, 30);
    const placeholders = ids.map(() => '?').join(',');
    const rows = await c.env.DB.prepare(
      `SELECT id, photo_data, mime_type FROM class_record_photos WHERE id IN (${placeholders})`
    ).bind(...ids).all();

    const photos: Record<string, string> = {};
    for (const row of rows.results as any[]) {
      if (row.photo_data?.startsWith('r2:')) {
        if (!c.env.R2) {
          console.error('R2 binding not available for batch photo:', row.id);
          continue; // R2 없으면 해당 사진 스킵 (잘못된 base64 감싸기 방지)
        }
        try {
          const r2Key = row.photo_data.slice(3);
          const obj = await c.env.R2.get(r2Key);
          if (obj) {
            const arrayBuf = await obj.arrayBuffer();
            const bytes = new Uint8Array(arrayBuf);
            let binary = '';
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
            const base64 = btoa(binary);
            const mime = obj.httpMetadata?.contentType || 'image/jpeg';
            photos[row.id] = `data:${mime};base64,${base64}`;
          }
        } catch (e) { console.error('R2 batch read failed:', e); }
        continue; // r2: 참조는 여기서 처리 완료 — 아래 레거시 분기로 fall-through 금지
      }
      if (row.photo_data?.startsWith('data:')) {
        photos[row.id] = row.photo_data;
      } else {
        photos[row.id] = `data:${row.mime_type || 'image/jpeg'};base64,${row.photo_data}`;
      }
    }
    return c.json({ photos });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 특정 수업 기록의 사진 목록 조회
app.get('/api/class-records/:recordId/photos', async (c) => {
  try {
    const recordId = c.req.param('recordId');
    const photos = await c.env.DB.prepare(
      'SELECT id, thumbnail, file_size, created_at FROM class_record_photos WHERE class_record_id = ? ORDER BY id'
    ).bind(recordId).all();
    return c.json({ photos: photos.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 학생의 모든 사진 조회 (최신순)
app.get('/api/student/:studentId/class-record-photos', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const photos = await c.env.DB.prepare(
      'SELECT id, class_record_id, thumbnail, file_size, created_at FROM class_record_photos WHERE student_id = ? ORDER BY id DESC LIMIT 100'
    ).bind(studentId).all();
    return c.json({ photos: photos.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 질문 코칭 기록 ====================

app.post('/api/student/:studentId/question-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { subject, questionText, questionLevel, questionLabel, axis, coachingMessages, xpEarned, isComplete } = await c.req.json();

    const result = await c.env.DB.prepare(
      'INSERT INTO question_records (student_id, subject, question_text, question_level, question_label, axis, coaching_messages, xp_earned, is_complete) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, subject || '', questionText || '', questionLevel || '', questionLabel || '', axis || 'curiosity', JSON.stringify(coachingMessages || []), xpEarned || 0, isComplete ? 1 : 0).run();

    // XP 업데이트
    if (xpEarned) {
      await c.env.DB.prepare('UPDATE students SET xp = xp + ? WHERE id = ?').bind(xpEarned, studentId).run();
      await recordXp(c.env.DB, Number(studentId), xpEarned, '질문 코칭', `[${questionLevel || ''}] ${questionLabel || ''} — ${subject || ''}`, 'question_records', result.meta.last_row_id as number)
    }

    return c.json({ success: true, recordId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 질문 기록 조회
app.get('/api/student/:studentId/question-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const records = await c.env.DB.prepare(
      'SELECT * FROM question_records WHERE student_id = ? ORDER BY created_at DESC'
    ).bind(studentId).all();
    return c.json({ records: records.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 교학상장 (가르치기) ====================

app.post('/api/student/:studentId/teach-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { subject, topic, taughtTo, content, reflection, xpEarned } = await c.req.json();
    if (!topic) return c.json({ error: '주제는 필수입니다' }, 400);

    const result = await c.env.DB.prepare(
      'INSERT INTO teach_records (student_id, subject, topic, taught_to, content, reflection, xp_earned) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, subject || '', topic, taughtTo || '', content || '', reflection || '', xpEarned || 30).run();

    if (xpEarned) {
      await c.env.DB.prepare('UPDATE students SET xp = xp + ? WHERE id = ?').bind(xpEarned || 30, studentId).run();
      await recordXp(c.env.DB, Number(studentId), xpEarned || 30, '교학상장', `${subject || ''} — ${topic}`, 'teach_records', result.meta.last_row_id as number)
    }

    return c.json({ success: true, recordId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/student/:studentId/teach-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const records = await c.env.DB.prepare(
      'SELECT * FROM teach_records WHERE student_id = ? ORDER BY created_at DESC'
    ).bind(studentId).all();
    return c.json({ records: records.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 창의적 체험활동 ====================

app.post('/api/student/:studentId/activity-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { activityType, title, description, startDate, endDate, status, progress, reflection } = await c.req.json();
    if (!title) return c.json({ error: '활동명은 필수입니다' }, 400);

    const result = await c.env.DB.prepare(
      'INSERT INTO activity_records (student_id, activity_type, title, description, start_date, end_date, status, progress, reflection) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, activityType || '', title, description || '', startDate || '', endDate || '', status || 'in-progress', progress || 0, reflection || '').run();

    return c.json({ success: true, recordId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 창체 영역별 activity_record 자동 생성 (없으면 생성, 있으면 기존 ID 반환)
app.post('/api/student/:studentId/activity-records/find-or-create', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { activityType, title } = await c.req.json();
    if (!activityType) return c.json({ error: 'activityType은 필수입니다' }, 400);

    // 기존 레코드 찾기
    const existing: any = await c.env.DB.prepare(
      'SELECT id FROM activity_records WHERE student_id = ? AND activity_type = ? LIMIT 1'
    ).bind(studentId, activityType).first();

    if (existing) {
      return c.json({ success: true, recordId: existing.id, created: false });
    }

    // 없으면 새로 생성
    const result = await c.env.DB.prepare(
      'INSERT INTO activity_records (student_id, activity_type, title, status, progress) VALUES (?, ?, ?, ?, ?)'
    ).bind(studentId, activityType, title || activityType, 'in-progress', 0).run();

    return c.json({ success: true, recordId: result.meta.last_row_id, created: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.put('/api/student/activity-records/:recordId', async (c) => {
  try {
    const recordId = c.req.param('recordId');
    const body = await c.req.json();
    const fields: string[] = [];
    const values: any[] = [];

    if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
    if (body.progress !== undefined) { fields.push('progress = ?'); values.push(body.progress); }
    if (body.reflection !== undefined) { fields.push('reflection = ?'); values.push(body.reflection); }
    if (body.description !== undefined) { fields.push('description = ?'); values.push(body.description); }
    fields.push('updated_at = ?'); values.push(getKSTString());

    values.push(recordId);
    await c.env.DB.prepare(`UPDATE activity_records SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/student/:studentId/activity-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const records = await c.env.DB.prepare(
      `SELECT ar.*, COUNT(al.id) as _logCount, MAX(al.date) as _lastLogDate
       FROM activity_records ar
       LEFT JOIN activity_logs al ON al.activity_record_id = ar.id
       WHERE ar.student_id = ?
       GROUP BY ar.id
       ORDER BY ar.created_at DESC`
    ).bind(studentId).all();
    return c.json({ records: records.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 활동 로그 (날짜별 기록) ====================

app.post('/api/student/:studentId/activity-logs', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { activityRecordId, date, content, reflection, duration, xpEarned, photos, aiResult } = await c.req.json();
    if (!activityRecordId || !content) return c.json({ error: '활동 ID와 내용은 필수입니다' }, 400);

    // 사진이 있으면 class_record_photos에 저장 후 ref:ID로 변환
    let photoRefs = '[]';
    if (photos && Array.isArray(photos) && photos.length > 0) {
      const refs: string[] = [];
      for (const photoData of photos) {
        if (typeof photoData !== 'string' || photoData.length < 10) continue;
        let r2Key = '';
        let thumbnail = '';
        const fileSize = Math.round(photoData.length * 0.75);
        if (c.env.R2) {
          try {
            r2Key = `photos/${studentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
            const match = photoData.match(/^data:(image\/\w+);base64,(.+)$/);
            const rawBase64 = match ? match[2] : photoData.replace(/^data:image\/\w+;base64,/, '');
            const binary = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
            await c.env.R2.put(r2Key, binary, { httpMetadata: { contentType: match?.[1] || 'image/jpeg' } });
            thumbnail = `r2:${r2Key}`;
          } catch (e) {
            console.error('R2 upload failed, falling back to DB:', e);
            r2Key = '';
            thumbnail = photoData.slice(0, 200);
          }
        } else {
          thumbnail = photoData.slice(0, 200);
        }
        const dataToStore = r2Key ? `r2:${r2Key}` : photoData;
        const pr = await c.env.DB.prepare(
          'INSERT INTO class_record_photos (student_id, class_record_id, photo_data, thumbnail, file_size, tag) VALUES (?, NULL, ?, ?, ?, ?)'
        ).bind(studentId, dataToStore, thumbnail, fileSize, 'activity').run();
        refs.push(`ref:${pr.meta.last_row_id}`);
      }
      photoRefs = JSON.stringify(refs);
    }

    const aiResultStr = aiResult ? (typeof aiResult === 'string' ? aiResult : JSON.stringify(aiResult)) : '';

    const result = await c.env.DB.prepare(
      'INSERT INTO activity_logs (activity_record_id, student_id, date, content, reflection, duration, xp_earned, photos, ai_result) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(activityRecordId, studentId, date || getKSTDate(), content, reflection || '', duration || '', xpEarned || 20, photoRefs, aiResultStr).run();

    if (xpEarned) {
      await c.env.DB.prepare('UPDATE students SET xp = xp + ? WHERE id = ?').bind(xpEarned || 20, studentId).run();
      await recordXp(c.env.DB, Number(studentId), xpEarned || 20, '창의적 체험활동', content.slice(0, 50), 'activity_logs', result.meta.last_row_id as number)
    }

    return c.json({ success: true, logId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/student/:studentId/activity-logs', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const activityId = c.req.query('activityId');
    let query = 'SELECT al.*, ar.title as activity_title FROM activity_logs al JOIN activity_records ar ON al.activity_record_id = ar.id WHERE al.student_id = ?';
    const binds: any[] = [studentId];
    if (activityId) {
      query += ' AND al.activity_record_id = ?';
      binds.push(activityId);
    }
    query += ' ORDER BY al.date DESC, al.created_at DESC';
    const records = await c.env.DB.prepare(query).bind(...binds).all();
    return c.json({ logs: records.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 탐구보고서 ====================

app.post('/api/student/:studentId/report-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { title, subject, phase, timeline, questions, totalXp, status } = await c.req.json();
    if (!title) return c.json({ error: '보고서 제목은 필수입니다' }, 400);

    const result = await c.env.DB.prepare(
      'INSERT INTO report_records (student_id, title, subject, phase, timeline, questions, total_xp, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, title, subject || '', phase || '', JSON.stringify(timeline || []), JSON.stringify(questions || []), totalXp || 0, status || 'in-progress').run();

    return c.json({ success: true, reportId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.put('/api/student/report-records/:reportId', async (c) => {
  try {
    const reportId = c.req.param('reportId');
    const body = await c.req.json();
    const fields: string[] = [];
    const values: any[] = [];

    if (body.title !== undefined) { fields.push('title = ?'); values.push(body.title); }
    if (body.phase !== undefined) { fields.push('phase = ?'); values.push(body.phase); }
    if (body.timeline !== undefined) { fields.push('timeline = ?'); values.push(JSON.stringify(body.timeline)); }
    if (body.questions !== undefined) { fields.push('questions = ?'); values.push(JSON.stringify(body.questions)); }
    if (body.totalXp !== undefined) { fields.push('total_xp = ?'); values.push(body.totalXp); }
    if (body.status !== undefined) { fields.push('status = ?'); values.push(body.status); }
    fields.push('updated_at = ?'); values.push(getKSTString());

    values.push(reportId);
    await c.env.DB.prepare(`UPDATE report_records SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.get('/api/student/:studentId/report-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const records = await c.env.DB.prepare(
      'SELECT * FROM report_records WHERE student_id = ? ORDER BY created_at DESC'
    ).bind(studentId).all();
    return c.json({ records: records.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 시험 삭제 ====================

app.delete('/api/student/exams/:examId', async (c) => {
  try {
    const examId = c.req.param('examId');
    // 관련 데이터 모두 삭제 (이미지 → 오답 → 결과 → 시험)
    const result: any = await c.env.DB.prepare('SELECT id FROM exam_results WHERE exam_id = ?').bind(examId).first();
    if (result) {
      await c.env.DB.prepare('DELETE FROM wrong_answer_images WHERE wrong_answer_id IN (SELECT id FROM wrong_answers WHERE exam_result_id = ?)').bind(result.id).run();
      await c.env.DB.prepare('DELETE FROM wrong_answers WHERE exam_result_id = ?').bind(result.id).run();
      await c.env.DB.prepare('DELETE FROM exam_results WHERE id = ?').bind(result.id).run();
    }
    await c.env.DB.prepare('DELETE FROM exams WHERE id = ?').bind(examId).run();
    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// 전체 DB 내보내기 (관리자용) - 파라미터 바인딩으로 SQL 인젝션 방지
app.get('/api/admin/export/:table', async (c) => {
  try {
    // 관리자 인증 확인
    const adminKey = c.req.query('key')
    const validKey = c.env.ADMIN_KEY || 'jycc_admin_2026'
    if (!adminKey || adminKey !== validKey) return c.json({ error: 'Unauthorized' }, 403)

    const table = c.req.param('table');
    const allowed = ['mentors','groups','students','exams','exam_results','wrong_answers','assignments','class_records','question_records','teach_records','activity_records','activity_logs','report_records'];
    if (!allowed.includes(table)) return c.json({ error: '허용되지 않는 테이블입니다' }, 400);

    const dateFrom = c.req.query('from') || '2000-01-01';
    const dateTo = c.req.query('to') || '2099-12-31';

    let result;
    if (['class_records'].includes(table)) {
      result = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE date BETWEEN ? AND ? ORDER BY date DESC`).bind(dateFrom, dateTo).all();
    } else if (['activity_logs'].includes(table)) {
      result = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC`).bind(dateFrom, dateTo).all();
    } else if (['question_records','teach_records','activity_records','assignments','exams','report_records'].includes(table)) {
      result = await c.env.DB.prepare(`SELECT * FROM ${table} WHERE DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC`).bind(dateFrom, dateTo).all();
    } else {
      result = await c.env.DB.prepare(`SELECT * FROM ${table} ORDER BY id`).all();
    }

    return c.json({
      table,
      count: (result.results as any[]).length,
      data: result.results,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: XP/레벨 조회 ====================

// XP 동기화 (프론트엔드에서 디바운스 호출)
app.post('/api/student/:studentId/xp-sync', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { xpDelta, source, sourceDetail } = await c.req.json();
    if (!xpDelta || xpDelta <= 0) return c.json({ success: true });

    await c.env.DB.prepare('UPDATE students SET xp = xp + ?, updated_at = ? WHERE id = ?').bind(xpDelta, getKSTString(), studentId).run();
    await recordXp(c.env.DB, Number(studentId), xpDelta, source || '수업 기록', sourceDetail || '')
    
    // 레벨 자동 계산 (100 XP당 1레벨)
    const student: any = await c.env.DB.prepare('SELECT xp FROM students WHERE id = ?').bind(studentId).first();
    if (student) {
      const newLevel = Math.max(1, Math.floor(student.xp / 100) + 1);
      await c.env.DB.prepare('UPDATE students SET level = ? WHERE id = ?').bind(newLevel, studentId).run();
    }

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ==================== XP 내역 조회 API ====================
app.get('/api/student/:studentId/xp-history', async (c) => {
  try {
    const studentId = c.req.param('studentId')
    const limit = Math.min(Number(c.req.query('limit') || 50), 200)
    const offset = Number(c.req.query('offset') || 0)

    const { results: history } = await c.env.DB.prepare(
      'SELECT id, amount, source, source_detail, created_at FROM xp_history WHERE student_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?'
    ).bind(studentId, limit, offset).run()

    // 소스별 합계
    const { results: summary } = await c.env.DB.prepare(
      'SELECT source, SUM(amount) as total_xp, COUNT(*) as count FROM xp_history WHERE student_id = ? GROUP BY source ORDER BY total_xp DESC'
    ).bind(studentId).run()

    const totalRow: any = await c.env.DB.prepare(
      'SELECT COUNT(*) as total_count, SUM(amount) as total_xp FROM xp_history WHERE student_id = ?'
    ).bind(studentId).first()

    return c.json({
      history,
      summary,
      totalCount: totalRow?.total_count || 0,
      totalXp: totalRow?.total_xp || 0,
      limit,
      offset
    })
  } catch (e: any) {
    // 테이블이 없으면 빈 결과 반환
    return c.json({ history: [], summary: [], totalCount: 0, totalXp: 0, limit: 50, offset: 0 })
  }
})

app.get('/api/student/:studentId/profile', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const student: any = await c.env.DB.prepare(
      'SELECT * FROM students WHERE id = ?'
    ).bind(studentId).first();

    // student_groups에서 그룹명 조회
    let groupName = null;
    if (student) {
      const groupRow: any = await c.env.DB.prepare(`
        SELECT g.name FROM groups g
        JOIN student_groups sg ON g.id = sg.group_id
        WHERE sg.student_id = ? AND g.is_active = 1
        LIMIT 1
      `).bind(studentId).first();
      groupName = groupRow?.name || null;
    }

    if (!student) return c.json({ error: '학생을 찾을 수 없습니다' }, 404);

    // 통계 — 단일 쿼리로 6개 COUNT 통합
    const stats: any = await c.env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM exams WHERE student_id = ?) as exam_cnt,
        (SELECT COUNT(*) FROM assignments WHERE student_id = ?) as assign_cnt,
        (SELECT COUNT(*) FROM question_records WHERE student_id = ?) as question_cnt,
        (SELECT COUNT(*) FROM class_records WHERE student_id = ?) as class_cnt,
        (SELECT COUNT(*) FROM teach_records WHERE student_id = ?) as teach_cnt,
        (SELECT COUNT(*) FROM activity_logs WHERE student_id = ?) as activity_cnt
    `).bind(studentId, studentId, studentId, studentId, studentId, studentId).first();

    return c.json({
      id: student.id,
      name: student.name,
      schoolName: student.school_name,
      grade: student.grade,
      profileEmoji: student.profile_emoji,
      xp: student.xp,
      level: student.level,
      groupName: groupName,
      stats: {
        exams: stats?.exam_cnt || 0,
        assignments: stats?.assign_cnt || 0,
        questions: stats?.question_cnt || 0,
        classRecords: stats?.class_cnt || 0,
        teachRecords: stats?.teach_cnt || 0,
        activityLogs: stats?.activity_cnt || 0,
      },
      lastLoginAt: student.last_login_at,
      createdAt: student.created_at,
      croquetBalance: student.croquet_balance || 0,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== 시간표 API ====================
// GET - 시간표 조회
app.get('/api/student/:studentId/timetable', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const row: any = await c.env.DB.prepare(
      'SELECT * FROM student_timetables WHERE student_id = ?'
    ).bind(studentId).first();

    if (!row) {
      return c.json({ school: [], teachers: {}, periodTimes: [], subjectColors: {}, academy: [] });
    }

    return c.json({
      school: JSON.parse(row.school_data || '[]'),
      teachers: JSON.parse(row.teachers_data || '{}'),
      periodTimes: JSON.parse(row.period_times || '[]'),
      subjectColors: JSON.parse(row.subject_colors || '{}'),
      academy: JSON.parse(row.academy_data || '[]'),
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// PUT - 시간표 저장 (upsert)
app.put('/api/student/:studentId/timetable', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const body = await c.req.json();
    const { school, teachers, periodTimes, subjectColors, academy } = body;

    await c.env.DB.prepare(`
      INSERT INTO student_timetables (student_id, school_data, teachers_data, period_times, subject_colors, academy_data, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, datetime('now','+9 hours'))
      ON CONFLICT(student_id) DO UPDATE SET
        school_data = excluded.school_data,
        teachers_data = excluded.teachers_data,
        period_times = excluded.period_times,
        subject_colors = excluded.subject_colors,
        academy_data = excluded.academy_data,
        updated_at = excluded.updated_at
    `).bind(
      studentId,
      JSON.stringify(school || []),
      JSON.stringify(teachers || {}),
      JSON.stringify(periodTimes || []),
      JSON.stringify(subjectColors || {}),
      JSON.stringify(academy || [])
    ).run();

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ==================== ADMIN: 비밀번호 리셋 ====================
app.post('/api/admin/reset-password', async (c) => {
  try {
    const { studentId, newPassword, adminKey } = await c.req.json();
    const validKey = c.env.ADMIN_KEY || 'jycc_admin_2026'
    if (!adminKey || adminKey !== validKey) return c.json({ error: 'Unauthorized' }, 403);
    if (!studentId || !newPassword) return c.json({ error: 'studentId와 newPassword 필요' }, 400);
    const hash = await hashPassword(newPassword);
    await c.env.DB.prepare('UPDATE students SET password_hash = ? WHERE id = ?').bind(hash, studentId).run();
    return c.json({ success: true, message: '비밀번호가 초기화되었습니다' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== 단일 테스트 학생 시드 (2주치 풍부한 데이터) ====================
app.get('/api/seed-single-student', async (c) => {
  const adminKey = c.req.query('key')
  const validKey = c.env.ADMIN_KEY || 'jycc_admin_2026'
  if (!adminKey || adminKey !== validKey) return c.json({ error: 'Unauthorized' }, 403)
  try {
    const DB = c.env.DB;
    const step = Number(c.req.query('step') || '0');
    const groupId = 1; // 김선생 선생님 반
    const mentorId = 1;
    const studentName = '열정';
    const school = '정율고등학교';
    const grade = 2;

    // KST 헬퍼
    function kstTs(offsetDays: number, hour = 0, min = 0) {
      const d = new Date(Date.now() + 9*3600000 + offsetDays*86400000);
      d.setUTCHours(hour, min, 0, 0);
      return d.toISOString().replace('T',' ').slice(0,19);
    }
    function kstDate(offsetDays: number) {
      const d = new Date(Date.now() + 9*3600000 + offsetDays*86400000);
      return d.toISOString().slice(0,10);
    }
    function pick<T>(a: T[]): T { return a[Math.floor(Math.random()*a.length)]; }
    function rand(min: number, max: number) { return Math.floor(Math.random()*(max-min+1))+min; }

    // STEP 0: 학생 생성
    if (step === 0) {
      const pwHash = await hashPassword('test1234');
      let st: any = await DB.prepare('SELECT id FROM students WHERE group_id=? AND name=?').bind(groupId, studentName).first();
      let studentId: number;
      if (st) {
        studentId = st.id;
        await DB.prepare('UPDATE students SET school_name=?,grade=?,profile_emoji=?,xp=?,level=?,croquet_balance=? WHERE id=?')
          .bind(school, grade, '🧪', 420, 5, 85, studentId).run();
      } else {
        const r = await DB.prepare('INSERT INTO students (group_id,name,password_hash,school_name,grade,profile_emoji,xp,level,croquet_balance) VALUES(?,?,?,?,?,?,?,?,?)')
          .bind(groupId, studentName, pwHash, school, grade, '🧪', 420, 5, 85).run();
        studentId = r.meta.last_row_id as number;
      }
      return c.json({ success: true, step: 0, studentId, message: `Student "${studentName}" created (id=${studentId})`, nextStep: 1 });
    }

    // 학생 ID 조회
    const stRow: any = await DB.prepare('SELECT id FROM students WHERE group_id=? AND name=?').bind(groupId, studentName).first();
    if (!stRow) return c.json({ error: 'Run step=0 first' }, 400);
    const sid = stRow.id;

    const subjects = ['국어', '영어', '수학', '물리학Ⅰ', '한국사', '생명과학Ⅰ'];
    const topicMap: Record<string, string[]> = {
      '국어': ['현대시 감상', '비문학 독해 전략', '문법 - 음운 변동', '고전소설 해석', '논술문 작성', '수필 이해', '시의 화자 분석'],
      '영어': ['관계대명사 심화', '분사구문 활용', '독해 - 추론 문제', '영작문 기초', '듣기 실전 연습', '가정법 과거완료', '간접화법 정리'],
      '수학': ['미분의 활용', '정적분 계산', '수열의 극한', '확률과 통계 기초', '치환 적분', '함수의 연속', '급수의 수렴'],
      '물리학Ⅰ': ['뉴턴 운동법칙', '에너지 보존 법칙', '파동의 성질', '전기장과 전위', '자기장', '열역학 법칙'],
      '한국사': ['조선 전기 정치', '일제강점기 독립운동', '고려 사회와 문화', '대한민국 정부 수립', '한국 전쟁', '민주화 운동'],
      '생명과학Ⅰ': ['세포 분열', 'DNA 복제', '유전자 발현', '면역과 질병', '생태계와 환경', '진화의 증거'],
    };
    const keywords = ['핵심개념', '오답정리', '심화학습', '기출분석', '개념정리', '문제풀이', '암기', '이해', '적용', '응용', '보충학습'];

    // 최근 14일 평일 목록
    const weekdays: string[] = [];
    for (let i = -14; i <= 0; i++) {
      const d = new Date(Date.now()+9*3600000+i*86400000);
      if (d.getDay() >= 1 && d.getDay() <= 5) weekdays.push(d.toISOString().slice(0,10));
    }

    // STEP 1: 수업 기록 (40~50개) + 사진
    if (step === 1) {
      const stmts: any[] = [];
      for (const day of weekdays) {
        const numRecords = rand(3, 5); // 하루 3~5개 수업
        for (let j = 0; j < numRecords; j++) {
          const subj = subjects[j % subjects.length];
          const topics = topicMap[subj];
          const topic = pick(topics);
          const content = `${topic}에 대해 배웠다. ${pick(['선생님 설명이 명확했다','이해가 잘 됐다','어려웠지만 복습 필요','새로운 개념을 알게 됐다','문제 풀이를 했다'])}. ${pick(['핵심 포인트를 정리했다','노트 필기 완료','예제 문제 3개 풀었다','개념 맵 작성','오답 노트 정리'])}`;
          const kwArr = [pick(keywords), pick(keywords), pick(keywords)].filter((v,i,a)=>a.indexOf(v)===i);
          const understanding = rand(2, 5); // 1~5 scale
          stmts.push(DB.prepare(
            'INSERT INTO class_records (student_id,subject,topic,content,keywords,understanding,date,created_at) VALUES(?,?,?,?,?,?,?,?)'
          ).bind(sid, subj, topic, content, JSON.stringify(kwArr), understanding, day, kstTs(-weekdays.indexOf(day)*-1-14, rand(9,16), rand(0,59))));
        }
      }
      // 사진 기록 (15개) - class_record_id는 나중에 매핑
      const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
      await DB.batch(stmts);
      // 사진 - 방금 생성된 class_records ID 가져오기
      const crIds: any = await DB.prepare('SELECT id FROM class_records WHERE student_id=? ORDER BY RANDOM() LIMIT 15').bind(sid).all();
      const photoStmts: any[] = [];
      for (const cr of (crIds.results || [])) {
        photoStmts.push(DB.prepare(
          'INSERT INTO class_record_photos (student_id,class_record_id,photo_data,thumbnail,mime_type,file_size,created_at) VALUES(?,?,?,?,?,?,?)'
        ).bind(sid, cr.id, tinyPng, tinyPng, 'image/png', 67, kstTs(-rand(0,13), rand(9,16), rand(0,59))));
      }
      if (photoStmts.length > 0) await DB.batch(photoStmts);
      return c.json({ success: true, step: 1, message: `Class records + photos inserted`, nextStep: 2 });
    }

    // STEP 2: 질문/교학상장/과제/활동
    if (step === 2) {
      const stmts: any[] = [];
      // question_records (12개) - schema: student_id, subject, question_text, question_level, question_label, axis, is_complete
      const questions = [
        {s:'수학',q:'치환적분에서 치환 변수 선택 기준이 뭔가요?',lv:'중',lb:'개념',ax:'curiosity'},
        {s:'영어',q:'관계대명사 which와 that 차이가 뭐예요?',lv:'하',lb:'문법',ax:'curiosity'},
        {s:'국어',q:'시의 화자와 작가는 다른 건가요?',lv:'중',lb:'개념',ax:'curiosity'},
        {s:'물리학Ⅰ',q:'운동에너지와 위치에너지의 합이 보존되는 조건은?',lv:'상',lb:'적용',ax:'deep_think'},
        {s:'한국사',q:'동학 농민 운동의 1차와 2차 봉기 차이점은?',lv:'중',lb:'비교',ax:'curiosity'},
        {s:'생명과학Ⅰ',q:'DNA 복제가 반보존적이라는 게 무슨 뜻이에요?',lv:'상',lb:'개념',ax:'deep_think'},
        {s:'수학',q:'로피탈 정리는 언제 쓸 수 있나요?',lv:'상',lb:'적용',ax:'curiosity'},
        {s:'영어',q:'가정법 과거와 가정법 과거완료 구분이 헷갈려요',lv:'중',lb:'문법',ax:'curiosity'},
        {s:'국어',q:'비문학 지문 읽을 때 핵심어 찾는 방법은?',lv:'중',lb:'전략',ax:'creative'},
        {s:'물리학Ⅰ',q:'전기장 안에서 등전위면은 왜 전기장에 수직이에요?',lv:'상',lb:'개념',ax:'deep_think'},
        {s:'한국사',q:'갑오개혁과 을미개혁의 관계는?',lv:'중',lb:'비교',ax:'curiosity'},
        {s:'생명과학Ⅰ',q:'세포 분열에서 G1기와 G2기의 차이점은?',lv:'중',lb:'비교',ax:'curiosity'},
      ];
      for (let i = 0; i < questions.length; i++) {
        const qd = questions[i];
        const dayOff = -rand(0, 13);
        stmts.push(DB.prepare(
          'INSERT INTO question_records (student_id,subject,question_text,question_level,question_label,axis,is_complete,xp_earned,created_at) VALUES(?,?,?,?,?,?,?,?,?)'
        ).bind(sid, qd.s, qd.q, qd.lv, qd.lb, qd.ax, i < 9 ? 1 : 0, i < 9 ? rand(5,15) : 0, kstTs(dayOff, rand(15,21), rand(0,59))));
      }
      // my_questions (8개) - 내 질문 게시판
      const myQs = [
        {s:'수학',t:'미분 계수의 기하학적 의미가 뭔가요?',c:'접선의 기울기라고 하는데 정확히 어떤 의미인지 모르겠어요'},
        {s:'영어',t:'현재완료와 과거시제 구분이 어려워요',c:'have been과 was의 차이가 뭔가요?'},
        {s:'물리학Ⅰ',t:'마찰력이 운동 방향과 반대인 이유',c:'항상 반대인가요? 예외는 없나요?'},
        {s:'국어',t:'고전시가에서 자연 소재의 상징적 의미',c:'솔, 대나무, 매화 등이 각각 무엇을 상징하나요?'},
        {s:'한국사',t:'일제 강점기 독립운동 단체 정리',c:'의열단, 한인애국단, 광복군 등의 차이점이 헷갈려요'},
        {s:'생명과학Ⅰ',t:'유전자형과 표현형의 관계',c:'같은 유전자형인데 표현형이 다를 수 있나요?'},
        {s:'수학',t:'정적분의 넓이 계산에서 부호 처리',c:'음수가 나오면 어떻게 하나요?'},
        {s:'영어',t:'분사구문 만드는 규칙이 복잡해요',c:'주어가 같을 때와 다를 때 어떻게 다른가요?'},
      ];
      const myQAnswers = [
        '접선의 기울기는 그 점에서 함수가 변하는 순간 변화율을 의미합니다.',
        '현재완료는 과거의 행위가 현재에 영향을 미칠 때 사용합니다.',
        '정지 마찰력은 운동 방향과 같은 방향일 수도 있습니다 (예: 자동차 구동륜).',
        '솔(소나무)은 지조와 절개, 대나무는 굳은 절개, 매화는 고결함을 상징합니다.',
        '의열단은 무장투쟁, 한인애국단은 의거 활동, 광복군은 정규군 활동입니다.',
        '네, 환경 요인에 의해 같은 유전자형도 다른 표현형을 보일 수 있습니다 (표현형 가소성).',
      ];
      for (let i = 0; i < myQs.length; i++) {
        const mq = myQs[i];
        const dayOff = -rand(0, 13);
        const status = i < 6 ? '답변완료' : '미답변';
        stmts.push(DB.prepare(
          'INSERT INTO my_questions (student_id,subject,title,content,status,created_at) VALUES(?,?,?,?,?,?)'
        ).bind(sid, mq.s, mq.t, mq.c, status, kstTs(dayOff, rand(14,20), rand(0,59))));
      }
      await DB.batch(stmts);
      // my_answers 추가 (답변이 있는 질문에 대해)
      const insertedQs: any = await DB.prepare('SELECT id FROM my_questions WHERE student_id=? ORDER BY id DESC LIMIT 8').bind(sid).all();
      const ansStmts: any[] = [];
      const qIds = (insertedQs.results || []).reverse();
      for (let i = 0; i < Math.min(6, qIds.length); i++) {
        ansStmts.push(DB.prepare(
          'INSERT INTO my_answers (question_id,student_id,content,resolve_hours,resolve_days,created_at) VALUES(?,?,?,?,?,?)'
        ).bind(qIds[i].id, sid, myQAnswers[i], rand(1,48), rand(0,2), kstTs(-rand(0,12), rand(10,18), rand(0,59))));
      }
      if (ansStmts.length > 0) await DB.batch(ansStmts);

      // 교학상장 (5개) - teach_records: student_id, subject, topic, taught_to, content, reflection, xp_earned
      const teachStmts: any[] = [];
      const teachTopics = [
        {s:'수학',t:'미분 개념을 친구에게 설명',to:'같은 반 친구 3명',c:'미분 계수의 의미와 공식 유도 과정을 칠판에 설명했다',r:'친구가 미분 계수의 의미를 이해함'},
        {s:'영어',t:'관계대명사 정리 노트 공유',to:'스터디 그룹',c:'관계대명사 종류와 용법을 표로 정리해서 공유했다',r:'표를 만들어 정리하니 반응이 좋았다'},
        {s:'국어',t:'비문학 독해 전략 발표',to:'반 전체',c:'비문학 지문 읽는 3단계 전략을 발표했다',r:'핵심어 추적법을 설명했고 질문을 많이 받았다'},
        {s:'물리학Ⅰ',t:'에너지 보존 문제 풀이 도움',to:'옆자리 친구',c:'역학적 에너지 보존 법칙 문제 풀이를 도와줬다',r:'에너지 관계식을 그림과 함께 설명하니 효과적이었다'},
        {s:'한국사',t:'일제강점기 연표 정리 공유',to:'역사 스터디',c:'일제강점기 주요 사건을 연표로 정리해서 공유했다',r:'사건 흐름을 시각화해서 전달하니 이해도가 높아졌다'},
      ];
      for (const tt of teachTopics) {
        teachStmts.push(DB.prepare(
          'INSERT INTO teach_records (student_id,subject,topic,taught_to,content,reflection,xp_earned,created_at) VALUES(?,?,?,?,?,?,?,?)'
        ).bind(sid, tt.s, tt.t, tt.to, tt.c, tt.r, rand(10,20), kstTs(-rand(0,13), rand(14,18), rand(0,59))));
      }
      // 과제 (6개) - assignments: student_id, subject, title, description, due_date, status, progress, color
      const assignments = [
        {s:'수학',t:'미적분 단원 종합 문제 풀기',d:'교과서 p.120~p.145 문제 풀기',st:'completed',p:100,cl:'#6C5CE7'},
        {s:'영어',t:'영어 독해 모의고사 2회분',d:'수능 모의고사 독해 파트 2회분 풀기',st:'completed',p:100,cl:'#00B894'},
        {s:'국어',t:'비문학 지문 5개 독해 연습',d:'EBS 수능특강 비문학 지문 5개',st:'completed',p:100,cl:'#FDCB6E'},
        {s:'물리학Ⅰ',t:'역학 단원 문제집 1~50번',d:'물리 문제집 역학 파트 풀기',st:'in_progress',p:60,cl:'#E17055'},
        {s:'한국사',t:'근현대사 요약 노트 작성',d:'갑오개혁~대한민국 정부 수립까지 정리',st:'in_progress',p:40,cl:'#0984E3'},
        {s:'생명과학Ⅰ',t:'유전 파트 개념 정리 + 문제 풀이',d:'유전 개념 정리 및 기출문제 20문항',st:'pending',p:0,cl:'#E84393'},
      ];
      for (const a of assignments) {
        const created = kstTs(-rand(5,13), 16, 0);
        const due = kstDate(-rand(-3, 3));
        teachStmts.push(DB.prepare(
          'INSERT INTO assignments (student_id,subject,title,description,due_date,status,progress,color,created_at) VALUES(?,?,?,?,?,?,?,?,?)'
        ).bind(sid, a.s, a.t, a.d, due, a.st, a.p, a.cl, created));
      }
      // 활동 기록 (3개) - activity_records: student_id, activity_type, title, description, start_date, end_date, status, progress
      const activities = [
        {t:'research',title:'과학 탐구 프로젝트',d:'물의 표면장력 실험 설계 및 보고서 작성',st:'in-progress',p:70},
        {t:'competition',title:'영어 스피치 대회 준비',d:'3분 영어 스피치 원고 작성 및 발표 연습',st:'completed',p:100},
        {t:'club',title:'수학 동아리 활동',d:'매주 수요일 방과 후 수학 심화 문제 풀이',st:'in-progress',p:50},
      ];
      for (const act of activities) {
        const startOff = -rand(10,13);
        const endOff = rand(5,14);
        teachStmts.push(DB.prepare(
          'INSERT INTO activity_records (student_id,activity_type,title,description,start_date,end_date,status,progress,created_at) VALUES(?,?,?,?,?,?,?,?,?)'
        ).bind(sid, act.t, act.title, act.d, kstDate(startOff), kstDate(endOff), act.st, act.p, kstTs(startOff, 15, 0)));
      }
      await DB.batch(teachStmts);
      // 활동 로그 추가
      const actIds: any = await DB.prepare('SELECT id FROM activity_records WHERE student_id=? ORDER BY id DESC LIMIT 3').bind(sid).all();
      const logStmts: any[] = [];
      for (const act of (actIds.results || [])) {
        const logCount = rand(3, 5);
        for (let j = 0; j < logCount; j++) {
          const dayOff = -rand(0,10);
          logStmts.push(DB.prepare(
            'INSERT INTO activity_logs (activity_record_id,student_id,date,content,reflection,duration,xp_earned,created_at) VALUES(?,?,?,?,?,?,?,?)'
          ).bind(act.id, sid, kstDate(dayOff), pick([
            '오늘 자료 조사를 진행했다',
            '실험 재료를 준비했다',
            '중간 발표 자료를 만들었다',
            '보고서 초안을 작성했다',
            '팀원들과 역할을 분담했다',
            '발표 리허설을 했다',
            '피드백을 반영해 수정했다',
            '최종 정리 및 제출 완료',
          ]), pick(['뿌듯했다','더 노력해야겠다','재밌었다','힘들었지만 보람 있었다','']), pick(['1시간','2시간','30분','1시간 30분']), rand(5,15), kstTs(dayOff, rand(14,20), rand(0,59))));
        }
      }
      if (logStmts.length > 0) await DB.batch(logStmts);
      return c.json({ success: true, step: 2, message: 'Questions, teach records, assignments, activities inserted', nextStep: 3 });
    }

    // STEP 3: 크로켓 포인트 + XP + 멘토 피드백 + AHA 리포트 + 시험
    if (step === 3) {
      const stmts: any[] = [];
      // 크로켓 포인트 (10개)
      let balance = 0;
      const reasons = ['수업 기록 우수','질문 활동 우수','교학상장 참여','플래너 실행 우수','학원 과제 완료'];
      for (let i = 0; i < 10; i++) {
        const amt = pick([5, 10, 10, 15, 20, -5]);
        balance += amt;
        if (balance < 0) balance = 0;
        stmts.push(DB.prepare(
          'INSERT INTO croquet_points (student_id,mentor_id,amount,reason,reason_detail,balance_after,created_at) VALUES(?,?,?,?,?,?,?)'
        ).bind(sid, mentorId, amt, pick(reasons), '', balance, kstTs(-rand(0,13), rand(10,18), rand(0,59))));
      }
      // XP 히스토리 (20개) - xp_history: student_id, amount, source, source_detail, ref_table, ref_id
      let totalXp = 0;
      for (let i = 0; i < 20; i++) {
        const xpAmt = pick([5, 10, 10, 15, 20, 25, 30]);
        totalXp += xpAmt;
        const source = pick(['class_record','question','teach','assignment','attendance','aha_report','activity']);
        const sourceDetail = pick(['수업 기록 작성','질문 등록','교학상장 활동','과제 완료','출석 보너스','AHA 리포트 작성','활동 기록']);
        stmts.push(DB.prepare(
          'INSERT INTO xp_history (student_id,amount,source,source_detail,created_at) VALUES(?,?,?,?,?)'
        ).bind(sid, xpAmt, source, sourceDetail, kstTs(-rand(0,13), rand(9,20), rand(0,59))));
      }
      // 멘토 피드백 (5개) - mentor_feedbacks: mentor_id, student_id, record_type, record_id, content, feedback_type, is_read
      const feedbacks = [
        '수업 태도가 매우 좋아지고 있어요. 질문도 적극적으로 하고 있네요!',
        '이번 주 수학 성적 향상이 눈에 띕니다. 꾸준히 노력하세요.',
        '교학상장 활동이 훌륭합니다. 친구들에게 설명하면서 본인도 성장하고 있어요.',
        '영어 독해 속도가 빨라졌어요. 어휘력을 더 키우면 좋겠습니다.',
        '물리 개념 이해도가 많이 올랐습니다. 실전 문제 연습을 더 해보세요.',
      ];
      for (let i = 0; i < feedbacks.length; i++) {
        stmts.push(DB.prepare(
          'INSERT INTO mentor_feedbacks (mentor_id,student_id,record_type,content,feedback_type,is_read,created_at) VALUES(?,?,?,?,?,?,?)'
        ).bind(mentorId, sid, 'general', feedbacks[i], pick(['encouragement','note','suggestion']), i < 3 ? 1 : 0, kstTs(-rand(0,12), rand(10,17), rand(0,59))));
      }
      // AHA 리포트 (3개)
      const ahaReports = [
        {s:'수학',u:'미분',sec_p:'미분계수 구하기',sec_t:'함수의 극한과 미분',sec_r:'교과서 + 수능특강',sec_f:'미분 개념을 확실히 이해하게 됨',ai:'미분의 기본 개념을 잘 이해하고 있으며 응용 문제에도 적용할 수 있습니다.'},
        {s:'영어',u:'관계사',sec_p:'관계대명사 구분',sec_t:'관계대명사와 관계부사',sec_r:'Grammar in Use + 기출문제',sec_f:'which/that 구분이 명확해짐',ai:'관계사 개념을 체계적으로 정리했습니다. 복합관계사까지 확장하면 좋겠습니다.'},
        {s:'물리학Ⅰ',u:'역학',sec_p:'뉴턴 제2법칙 적용',sec_t:'힘과 가속도의 관계',sec_r:'물리학 개념서 + EBS 강의',sec_f:'F=ma 공식을 다양한 상황에 적용하는 연습이 필요',ai:'역학 기초가 탄탄합니다. 마찰력과 합력 문제를 더 연습하세요.'},
      ];
      for (const aha of ahaReports) {
        stmts.push(DB.prepare(
          'INSERT INTO aha_reports (student_id,subject,unit,section_problem,section_topic,section_research,section_self_feedback,ai_feedback,ai_source,croquet_given,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)'
        ).bind(sid, aha.s, aha.u, aha.sec_p, aha.sec_t, aha.sec_r, aha.sec_f, aha.ai, 'gemini', 10, kstTs(-rand(1,10), rand(15,19), rand(0,59))));
      }
      // 시험 (중간고사 완료 + 기말고사 예정) - exams: student_id, name, type, start_date, subjects, status
      const subjectsJson = JSON.stringify(subjects.map(s => ({name: s, target_score: rand(80,95)})));
      const midR = await DB.prepare('INSERT INTO exams (student_id,name,type,start_date,subjects,status,created_at) VALUES(?,?,?,?,?,?,?)')
        .bind(sid, '1학기 중간고사', 'midterm', kstDate(-10), subjectsJson, 'completed', kstTs(-12, 10, 0)).run();
      const midId = midR.meta.last_row_id as number;
      // exam_results: exam_id, student_id, total_score, grade, subjects_data, overall_reflection
      const subjectsData = subjects.map(s => ({name: s, score: rand(72,98), rank: rand(1,15), total: 35}));
      const totalScore = Math.round(subjectsData.reduce((a,b) => a+b.score, 0) / subjectsData.length);
      stmts.push(DB.prepare(
        'INSERT INTO exam_results (exam_id,student_id,total_score,grade,subjects_data,overall_reflection,created_at) VALUES(?,?,?,?,?,?,?)'
      ).bind(midId, sid, totalScore, rand(1,3), JSON.stringify(subjectsData), '전체적으로 잘 봤지만 물리와 수학에서 실수가 있었다. 다음에는 꼼꼼히 검토하자.', kstTs(-6, 12, 0)));
      // 기말고사 (예정)
      const finalR = await DB.prepare('INSERT INTO exams (student_id,name,type,start_date,subjects,status,created_at) VALUES(?,?,?,?,?,?,?)')
        .bind(sid, '1학기 기말고사', 'final', kstDate(20), subjectsJson, 'upcoming', kstTs(-1, 10, 0)).run();
      await DB.batch(stmts);
      // croquet_balance, xp, level 업데이트
      await DB.prepare('UPDATE students SET croquet_balance=?, xp=?, level=? WHERE id=?').bind(balance, totalXp, Math.floor(totalXp/100)+1, sid).run();
      // 초대코드 가져오기
      const grp: any = await DB.prepare('SELECT invite_code FROM groups WHERE id=?').bind(groupId).first();
      return c.json({
        success: true, step: 3, message: 'All seed data complete!',
        student: { id: sid, name: studentName, school, grade, password: 'test1234', inviteCode: grp?.invite_code || '' },
        counts: { croquet_points: 10, xp_history: 20, mentor_feedbacks: 5, aha_reports: 3, exams: 2, my_questions: 8, my_answers: 6, activities: 3, teach_records: 5, assignments: 6 }
      });
    }

    return c.json({ error: 'Invalid step. Use step=0,1,2,3' }, 400);
  } catch (e: any) {
    return c.json({ error: e.message, stack: e.stack?.slice(0,300) }, 500);
  }
});


// ==================== 시드 테스트 데이터 API (step 분할) ====================
app.get('/api/seed-test-data', async (c) => {
  const adminKey = c.req.query('key')
  const validKey = c.env.ADMIN_KEY || 'jycc_admin_2026'
  if (!adminKey || adminKey !== validKey) return c.json({ error: 'Unauthorized' }, 403)
  try {
    const step = Number(c.req.query('step') || '0');
    const DB = c.env.DB;

    // 공통: 멘토 & 그룹 확인
    let mentor: any = await DB.prepare('SELECT * FROM mentors WHERE login_id = ?').bind('mentor1').first();
    if (!mentor) mentor = await DB.prepare('SELECT * FROM mentors LIMIT 1').first();
    if (!mentor) return c.json({ error: 'No mentor found' }, 400);
    const mentorId = mentor.id;
    let group: any = await DB.prepare('SELECT * FROM groups WHERE mentor_id = ? LIMIT 1').bind(mentorId).first();
    if (!group) return c.json({ error: 'No group found' }, 400);
    const groupId = group.id;

    const studentsInfo = [
      { name: '홍길동', school: '정율고등학교', grade: 2, emoji: '🐱' },
      { name: '이서연', school: '정율고등학교', grade: 2, emoji: '🦊' },
      { name: '박준호', school: '정율고등학교', grade: 2, emoji: '🦁' },
      { name: '김하은', school: '정율고등학교', grade: 1, emoji: '🐰' },
      { name: '최민재', school: '정율고등학교', grade: 1, emoji: '🐻' },
      { name: '장예린', school: '정율고등학교', grade: 3, emoji: '🦄' },
    ];
    const subjects = ['국어', '영어', '수학', '물리학Ⅰ', '한국사', '생명과학Ⅰ'];
    const topicMap: Record<string, string[]> = {
      '국어': ['현대시 감상', '비문학 독해 전략', '문법 - 음운 변동', '고전소설 해석', '논술문 작성'],
      '영어': ['관계대명사 심화', '분사구문 활용', '독해 - 추론 문제', '영작문 기초', '듣기 실전 연습'],
      '수학': ['미분의 활용', '정적분 계산', '수열의 극한', '확률과 통계 기초', '치환 적분'],
      '물리학Ⅰ': ['뉴턴 운동법칙', '에너지 보존 법칙', '파동의 성질', '전기장과 전위'],
      '한국사': ['조선 전기 정치', '일제강점기 독립운동', '고려 사회와 문화', '대한민국 정부 수립'],
      '생명과학Ⅰ': ['세포 분열', 'DNA 복제', '유전자 발현', '면역과 질병'],
    };
    function kstStr(offset: number) { const d = new Date(Date.now() + 9*3600000 + offset*86400000); return d.toISOString().slice(0,10); }
    function kstTs(offset: number) { const d = new Date(Date.now() + 9*3600000 + offset*86400000); return d.toISOString().replace('T',' ').slice(0,19); }
    function pick<T>(a: T[]): T { return a[Math.floor(Math.random()*a.length)]; }
    // weekdays
    const wds: string[] = [];
    for (let i = -25; i <= 0; i++) { const d = new Date(Date.now()+9*3600000+i*86400000); if(d.getDay()>=1&&d.getDay()<=5) wds.push(d.toISOString().slice(0,10)); }
    const recentDays = wds.slice(-15);

    // ============ STEP 0: 학생 생성/업데이트 ============
    if (step === 0) {
      const pwHash = await hashPassword('test1234');
      const ids: number[] = [];
      for (const s of studentsInfo) {
        let ex: any = await DB.prepare('SELECT id FROM students WHERE group_id=? AND name=?').bind(groupId, s.name).first();
        if (ex) {
          ids.push(ex.id);
          await DB.prepare('UPDATE students SET school_name=?,grade=?,profile_emoji=? WHERE id=?').bind(s.school,s.grade,s.emoji,ex.id).run();
        } else {
          const r = await DB.prepare('INSERT INTO students (group_id,name,password_hash,school_name,grade,profile_emoji) VALUES(?,?,?,?,?,?)').bind(groupId,s.name,pwHash,s.school,s.grade,s.emoji).run();
          ids.push(r.meta.last_row_id as number);
        }
      }
      return c.json({ success: true, step: 0, message: 'Students created', studentIds: ids, nextStep: 1 });
    }

    // 학생 ID 로드
    const allStudents: any = await DB.prepare('SELECT id,name FROM students WHERE group_id=? ORDER BY id').bind(groupId).all();
    const studentIds = allStudents.results.map((s:any) => s.id).slice(0, 6);
    if (studentIds.length === 0) return c.json({ error: 'No students. Run step=0 first.' }, 400);

    // ============ STEP 1: 수업기록 (batch) ============
    if (step === 1) {
      await DB.prepare('DELETE FROM class_records WHERE student_id IN ('+studentIds.join(',')+')').run();
      for (const sid of studentIds) {
        const stmts: any[] = [];
        for (const date of recentDays) {
          const cnt = 2 + Math.floor(Math.random()*2);
          const daySubjs = [...subjects].sort(()=>Math.random()-0.5).slice(0,cnt);
          for (const subj of daySubjs) {
            const tp = pick(topicMap[subj]||['일반']);
            const und = pick([3,4,5,3,4,2,5]);
            const ct = `${tp}에 대해 배웠다. 핵심 개념을 정리하고 예제를 풀어보았다.`;
            const kw = JSON.stringify([tp.split(' ')[0], subj]);
            stmts.push(DB.prepare('INSERT INTO class_records(student_id,subject,date,content,keywords,understanding,topic) VALUES(?,?,?,?,?,?,?)').bind(sid,subj,date,ct,kw,und,tp));
          }
        }
        // batch max ~100
        for (let i=0; i<stmts.length; i+=80) { await DB.batch(stmts.slice(i,i+80)); }
      }
      return c.json({ success: true, step: 1, message: 'Class records inserted', nextStep: 2 });
    }

    // ============ STEP 2: 사진 + 질문 + 교학상장 ============
    if (step === 2) {
      const placeholder = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
      await DB.prepare('DELETE FROM class_record_photos WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM question_records WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM teach_records WHERE student_id IN ('+studentIds.join(',')+')').run();

      for (const sid of studentIds) {
        // 사진 12개
        const crIds: any = await DB.prepare('SELECT id FROM class_records WHERE student_id=? ORDER BY RANDOM() LIMIT 12').bind(sid).all();
        const photoStmts = crIds.results.map((r:any) =>
          DB.prepare('INSERT INTO class_record_photos(student_id,class_record_id,photo_data,thumbnail,mime_type,file_size) VALUES(?,?,?,?,?,?)').bind(sid,r.id,placeholder,placeholder,'image/png',1024+Math.floor(Math.random()*50000))
        );
        if (photoStmts.length) await DB.batch(photoStmts);

        // 질문 10개
        const qTexts: Record<string,string[]> = {
          '국어': ['비문학 지문에서 핵심 주장을 빠르게 찾는 방법이 있나요?','현대시에서 화자의 정서를 파악하는 기준이 뭔가요?'],
          '영어': ['관계대명사 that과 which는 어떻게 구분하나요?','분사구문에서 주어가 다를 때 어떻게 처리하나요?'],
          '수학': ['치환 적분할 때 치환 변수를 어떻게 고르나요?','미분의 활용에서 최대최소 문제 접근법?'],
          '물리학Ⅰ': ['자유낙하와 수평 투사의 시간이 같은 이유는?','에너지 보존 법칙 문제에서 마찰력 처리 방법?'],
          '한국사': ['조선 전기 붕당정치와 탕평정치의 차이점?'],
          '생명과학Ⅰ': ['DNA 복제에서 선도 가닥과 지연 가닥의 차이?'],
        };
        const levels = ['C-1','C-2','C-3','B-1','B-2','A-1'];
        const qStmts: any[] = [];
        for (let q=0; q<10; q++) {
          const subj = pick(subjects);
          const qt = pick(qTexts[subj]||['이 부분이 이해가 안 돼요']);
          qStmts.push(DB.prepare('INSERT INTO question_records(student_id,subject,question_text,question_level,axis,xp_earned,is_complete,created_at) VALUES(?,?,?,?,?,?,1,?)')
            .bind(sid,subj,qt,pick(levels),pick(['curiosity','reflection']),10+Math.floor(Math.random()*30),kstTs(-Math.floor(Math.random()*21))));
        }
        await DB.batch(qStmts);

        // 교학상장 4개
        const teachTopics = ['치환적분 역함수 관점','관계대명사 용법','뉴턴 제2법칙 실생활 예시','세포 분열 과정'];
        const tStmts: any[] = [];
        for (let t=0; t<4; t++) {
          const subj = pick(subjects);
          const tp = pick(teachTopics);
          const to = pick(studentsInfo).name;
          tStmts.push(DB.prepare('INSERT INTO teach_records(student_id,subject,topic,taught_to,content,reflection,xp_earned,created_at) VALUES(?,?,?,?,?,?,?,?)')
            .bind(sid,subj,tp,to,`${to}에게 ${tp}에 대해 설명했다.`,`설명하면서 나도 정리가 됐다.`,15+Math.floor(Math.random()*25),kstTs(-Math.floor(Math.random()*18))));
        }
        await DB.batch(tStmts);
      }
      return c.json({ success: true, step: 2, message: 'Photos + Questions + Teach records', nextStep: 3 });
    }

    // ============ STEP 3: 과제 + 포인트 + XP ============
    if (step === 3) {
      await DB.prepare('DELETE FROM assignments WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM croquet_points WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM xp_history WHERE student_id IN ('+studentIds.join(',')+')').run();

      for (const sid of studentIds) {
        // 과제 5개
        const assigns = [
          {s:'국어',t:'비문학 독해 프린트 풀기',d:3,st:'completed',p:100,tc:'이정민'},
          {s:'영어',t:'영어 문법 워크북 3단원',d:5,st:'completed',p:100,tc:'김영희'},
          {s:'수학',t:'미적분 문제집 풀기',d:7,st:'in-progress',p:60,tc:'박수학'},
          {s:'물리학Ⅰ',t:'물리 실험 보고서 작성',d:-2,st:'completed',p:100,tc:'최물리'},
          {s:'한국사',t:'한국사 정리 노트 제출',d:10,st:'pending',p:20,tc:'강한국'},
        ];
        const aStmts = assigns.map(a =>
          DB.prepare('INSERT INTO assignments(student_id,subject,title,description,teacher_name,due_date,status,progress,color) VALUES(?,?,?,?,?,?,?,?,?)')
            .bind(sid,a.s,a.t,`${a.t} 상세`,a.tc,kstStr(a.d),a.st,a.p,pick(['#6C5CE7','#FF6B6B','#00B894','#FDCB6E']))
        );
        await DB.batch(aStmts);

        // 포인트 10건
        const reasons = ['수업기록','질문등록','교학상장','과제완료','출석보너스','멘토보너스'];
        let balance = 0;
        const cpStmts: any[] = [];
        for (let p=0; p<10; p++) {
          const amt = pick([5,10,15,20,30,50]);
          balance += amt;
          cpStmts.push(DB.prepare('INSERT INTO croquet_points(student_id,mentor_id,amount,reason,reason_detail,balance_after,created_at) VALUES(?,?,?,?,?,?,?)')
            .bind(sid,mentorId,amt,pick(reasons),'보상',balance,kstTs(-(10-p))));
        }
        await DB.batch(cpStmts);
        await DB.prepare('UPDATE students SET croquet_balance=? WHERE id=?').bind(balance,sid).run();

        // XP 20건
        const xpSrcs = ['class_record','question','teach','assignment','activity','daily_login'];
        let totalXp = 0;
        const xpStmts: any[] = [];
        for (let x=0; x<20; x++) {
          const amt = pick([5,10,15,20,25,30]);
          totalXp += amt;
          xpStmts.push(DB.prepare('INSERT INTO xp_history(student_id,amount,source,source_detail,created_at) VALUES(?,?,?,?,?)')
            .bind(sid,amt,pick(xpSrcs),'활동 보상',kstTs(-(20-x))));
        }
        await DB.batch(xpStmts);
        const level = Math.min(20,Math.floor(totalXp/100)+1);
        await DB.prepare('UPDATE students SET xp=?,level=?,last_login_at=? WHERE id=?').bind(totalXp,level,kstTs(0),sid).run();
      }
      return c.json({ success: true, step: 3, message: 'Assignments + Points + XP', nextStep: 4 });
    }

    // ============ STEP 4: 피드백 + 비교과 + 아하리포트 + 시험 ============
    if (step === 4) {
      await DB.prepare('DELETE FROM mentor_feedbacks WHERE mentor_id=?').bind(mentorId).run();
      await DB.prepare('DELETE FROM activity_logs WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM activity_records WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM aha_reports WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM wrong_answers WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM exam_results WHERE student_id IN ('+studentIds.join(',')+')').run();
      await DB.prepare('DELETE FROM exams WHERE student_id IN ('+studentIds.join(',')+')').run();

      const feedbacks = [
        '수업 기록이 매우 충실합니다!','질문의 깊이가 좋아지고 있어요.',
        '교학상장 활동이 인상적입니다.','과제 제출이 꾸준합니다.',
        '수업 이해도가 높아지고 있어요.','포트폴리오에 큰 도움이 될 거예요.',
      ];
      const activities = [
        {ty:'report',ti:'수학 알고리즘 탐구 보고서',ds:'피보나치 수열과 황금비',dy:60},
        {ty:'competition',ti:'교내 과학 탐구 대회',ds:'물리 자유낙하 실험 발표',dy:30},
        {ty:'volunteer',ti:'또래 튜터링 봉사',ds:'수학 기초반 학생 멘토링',dy:45},
        {ty:'club',ti:'영어 토론 동아리',ds:'AI와 교육의 미래',dy:90},
      ];

      for (const sid of studentIds) {
        // 피드백 4건
        const fbStmts = [];
        for (let f=0; f<4; f++) {
          fbStmts.push(DB.prepare('INSERT INTO mentor_feedbacks(mentor_id,student_id,record_type,content,feedback_type,is_read,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?)')
            .bind(mentorId,sid,pick(['general','class_record','question']),pick(feedbacks),'note',f<2?1:0,kstTs(-f*3),kstTs(-f*3)));
        }
        await DB.batch(fbStmts);

        // 비교과 2~3개
        const actPicked = [...activities].sort(()=>Math.random()-0.5).slice(0,2+Math.floor(Math.random()*2));
        for (const act of actPicked) {
          const st = pick(['in-progress','completed']);
          const prog = st==='completed'?100:30+Math.floor(Math.random()*50);
          const r = await DB.prepare('INSERT INTO activity_records(student_id,activity_type,title,description,start_date,end_date,status,progress) VALUES(?,?,?,?,?,?,?,?)')
            .bind(sid,act.ty,act.ti,act.ds,kstStr(-act.dy),kstStr(Math.floor(act.dy*0.3)),st,prog).run();
          const actId = r.meta.last_row_id;
          const logTexts = ['자료 조사 및 개요 작성','본론 초안 작성','실험 데이터 분석','발표 자료 제작'];
          const logStmts = logTexts.slice(0,3).map((lt,i) =>
            DB.prepare('INSERT INTO activity_logs(activity_record_id,student_id,date,content,reflection,duration,xp_earned) VALUES(?,?,?,?,?,?,?)')
              .bind(actId,sid,kstStr(-act.dy+Math.floor(act.dy/3*i)),lt,'활동이 유익했다.','60분',15)
          );
          await DB.batch(logStmts);
        }

        // 아하 리포트 3개
        const ahaStmts: any[] = [];
        for (let a=0; a<3; a++) {
          const subj = pick(subjects);
          const unit = pick(topicMap[subj]||['일반']);
          const sName = studentsInfo[studentIds.indexOf(sid)]?.name || '학생';
          ahaStmts.push(DB.prepare('INSERT INTO aha_reports(student_id,subject,unit,student_name_detected,subject_detected,unit_detected,section_problem,section_topic,section_research,section_self_feedback,ai_feedback,croquet_given,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
            .bind(sid,subj,unit,sName,subj,unit,
              `${unit} 관련 문제를 풀면서 개념 적용이 어려웠다.`,
              `${unit}의 핵심 원리와 적용 방법을 정리했다.`,
              `교과서와 참고서를 비교하며 탐구했다.`,
              `${unit}에 대한 이해가 깊어졌다.`,
              `${sName}의 ${subj} ${unit} 탐구가 체계적입니다.`,
              1,kstTs(-Math.floor(Math.random()*18))));
        }
        await DB.batch(ahaStmts);

        // 시험 2개
        const exam1Subjs = JSON.stringify(subjects.slice(0,4).map((s,i) => ({subject:s,readiness:50+Math.floor(Math.random()*40),color:['#FF6B6B','#6C5CE7','#00B894','#FDCB6E'][i]})));
        const e1 = await DB.prepare('INSERT INTO exams(student_id,name,type,start_date,subjects,status) VALUES(?,?,?,?,?,?)').bind(sid,'1학기 1차 지필고사','midterm',kstStr(-14),exam1Subjs,'completed').run();
        const eid = e1.meta.last_row_id;
        const sArr = subjects.slice(0,4).map(s=>({subject:s,score:60+Math.floor(Math.random()*35),grade:pick([1,2,3]),reflection:`${s} 시험 괜찮았다.`}));
        const ts = Math.round(sArr.reduce((a,b)=>a+b.score,0)/sArr.length);
        await DB.prepare('INSERT INTO exam_results(exam_id,student_id,total_score,grade,subjects_data,overall_reflection) VALUES(?,?,?,?,?,?)')
          .bind(eid,sid,ts,sArr[0].grade,JSON.stringify(sArr),'다음 시험엔 복습 계획을 더 체계적으로 세워야겠다.').run();

        const exam2Subjs = JSON.stringify(subjects.slice(0,5).map((s,i)=>({subject:s,readiness:20+Math.floor(Math.random()*40),color:['#FF6B6B','#6C5CE7','#00B894','#FDCB6E','#E056A0'][i]})));
        await DB.prepare('INSERT INTO exams(student_id,name,type,start_date,subjects,status) VALUES(?,?,?,?,?,?)').bind(sid,'1학기 2차 지필고사','final',kstStr(14),exam2Subjs,'upcoming').run();
      }

      // 최종 카운트
      const counts: Record<string,number> = {};
      for (const t of ['students','class_records','class_record_photos','question_records','teach_records','assignments','croquet_points','xp_history','mentor_feedbacks','activity_records','activity_logs','aha_reports','exams','exam_results']) {
        const r:any = await DB.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).first();
        counts[t] = r?.cnt||0;
      }
      return c.json({ success: true, step: 4, message: 'All seed data complete!', counts });
    }

    // ==================== Step 5: Community Seed Data ====================
    if (step === 5) {
      const kstTs = (offsetDays: number = 0) => {
        const d = new Date(Date.now() + offsetDays * 86400000 + 9 * 3600000);
        return d.toISOString().replace('T', ' ').substring(0, 19);
      };

      // 5a. Clean existing community data
      const ph = studentIds.map(() => '?').join(',');
      await DB.prepare(`DELETE FROM community_notifications WHERE recipient_id IN (${ph}) AND recipient_type='student'`).bind(...studentIds).run();
      await DB.prepare(`DELETE FROM community_comments WHERE author_id IN (${ph}) AND author_type='student'`).bind(...studentIds).run();
      await DB.prepare(`DELETE FROM community_likes WHERE user_id IN (${ph}) AND user_type='student'`).bind(...studentIds).run();
      // Delete photos for posts by these students
      const existingPosts: any = await DB.prepare(`SELECT id FROM community_posts WHERE author_id IN (${ph}) AND author_type='student'`).bind(...studentIds).all();
      for (const ep of (existingPosts.results || [])) {
        await DB.prepare('DELETE FROM community_post_photos WHERE post_id = ?').bind(ep.id).run();
      }
      await DB.prepare(`DELETE FROM community_posts WHERE author_id IN (${ph}) AND author_type='student'`).bind(...studentIds).run();
      await DB.prepare(`DELETE FROM friendships WHERE student_id_1 IN (${ph}) OR student_id_2 IN (${ph})`).bind(...studentIds, ...studentIds).run();
      await DB.prepare(`DELETE FROM friend_invite_codes WHERE student_id IN (${ph})`).bind(...studentIds).run();
      await DB.prepare(`DELETE FROM learning_share_settings WHERE student_id IN (${ph})`).bind(...studentIds).run();

      // 5b. Set nicknames
      const nicknames = ['길동이냥', '서연이여우', '준호사자', '하은토끼', '민재곰돌', '예린유니콘'];
      for (let i = 0; i < Math.min(studentIds.length, nicknames.length); i++) {
        await DB.prepare('UPDATE students SET nickname = ? WHERE id = ?').bind(nicknames[i], studentIds[i]).run();
      }
      await DB.prepare('UPDATE mentors SET nickname = ? WHERE id = ?').bind('멘토선생님', mentorId).run();

      // 5c. Get boards
      const boards: any = await DB.prepare('SELECT id, board_type FROM community_boards WHERE is_active = 1 LIMIT 5').all();
      const boardIds = (boards.results || []).map((b: any) => b.id);
      if (boardIds.length === 0) {
        return c.json({ success: true, step: 5, message: 'No boards found. Run migration first.', counts: {} });
      }

      // 5d. Create posts
      const postContents = [
        { title: '물리 2단원 이해가 안 돼요...', content: '뉴턴 운동 법칙 중에서 <b>제2법칙</b> F=ma 부분이 잘 이해가 안 가요.<br>특히 마찰력 있는 경우에 자유물체도 그리기가 어렵네요. 도움 부탁드려요!' },
        { title: '영어 단어 외우는 꿀팁 공유합니다!', content: '제가 효과 본 방법인데요,<br>1. 접두사/접미사로 묶어서 외우기<br>2. 문장 속에서 뜻 유추하기<br>3. <b>하루 30개씩 3일 반복</b>이 제일 효과 좋았어요!' },
        { title: '다음 주 체육대회 준비 어떻게 하고 계세요?', content: '우리 반은 릴레이랑 줄넘기 나가는데 연습할 시간이 부족해요 ㅠㅠ<br>다른 분들은 어떤 종목 준비하시나요?' },
        { title: '중간고사 시간표 정리해봤어요', content: '<b>1일차</b>: 국어, 수학<br><b>2일차</b>: 영어, 과학<br><b>3일차</b>: 한국사, 선택과목<br>시간표 참고하세요~' },
        { title: '수학 치환적분 제가 이해한 방식으로 설명해볼게요', content: 'u = g(x)로 치환하면 du = g\'(x)dx 니까<br>원래 적분식에서 x를 u로 바꾸고, dx도 du/g\'(x)로 바꾸면 돼요.<br><b>핵심은 치환할 부분을 잘 고르는 것!</b>' },
        { title: '오늘 국어 시간에 배운 현대시 정리', content: '윤동주의 <b>"서시"</b> 분석했어요.<br>"죽는 날까지 하늘을 우러러 한 점 부끄럼이 없기를" 이 부분이 주제의식을 가장 잘 드러낸대요.' },
        { title: '과학실험 보고서 쓰는 법 공유', content: '1. 목적 → 2. 준비물 → 3. 실험과정 → 4. 결과 → 5. 고찰<br>특히 <b>고찰</b> 부분에서 오차 원인 분석을 꼭 넣어야 한대요.' },
        { title: '한국사 연표 정리 같이 해요', content: '삼국시대부터 조선까지 주요 사건 연표를 정리하고 있는데, 같이 하실 분?<br>공유 문서 만들면 좋을 것 같아요!' },
        { title: '시험 기간 집중력 높이는 방법', content: '<b>뽀모도로 테크닉</b> 추천합니다!<br>25분 집중 → 5분 휴식 반복하면 효율이 확 올라요.<br>타이머 앱 추천: Forest, Tide' },
        { title: '영어 문법 정리 - 관계대명사', content: 'who/which/that 구분법:<br>- <b>who</b>: 사람 (주격/목적격)<br>- <b>which</b>: 사물/동물<br>- <b>that</b>: 사람+사물 모두 가능<br>that은 계속적 용법에서는 사용 불가!' },
      ];

      const postIds: number[] = [];
      for (let i = 0; i < postContents.length; i++) {
        const p = postContents[i];
        const authorIdx = i % studentIds.length;
        const boardIdx = i % boardIds.length;
        const result: any = await DB.prepare(
          "INSERT INTO community_posts (board_id, author_type, author_id, title, content, like_count, comment_count, is_deleted, created_at, updated_at) VALUES (?, 'student', ?, ?, ?, 0, 0, 0, ?, ?)"
        ).bind(boardIds[boardIdx], studentIds[authorIdx], p.title, p.content, kstTs(-13 + i), kstTs(-13 + i)).run();
        if (result.meta.last_row_id) postIds.push(result.meta.last_row_id);
      }

      // 5e. Create comments
      const commentTexts = [
        '저도 그거 헷갈렸는데, 교과서 p.45 보면 이해돼요!',
        '좋은 정보 감사합니다!',
        '맞아요, 저도 같은 생각이에요',
        '그러면 이 부분은 어떻게 되는 건가요?',
        '화이팅! 같이 공부해요',
        '와 정리 진짜 잘하셨네요 👍',
        '저도 해볼게요!',
        '공감합니다 ㅠㅠ',
        '오 이거 진짜 도움 됐어요',
        '선생님한테 물어보니까 이렇게 설명해주셨어요',
      ];
      for (let pi = 0; pi < postIds.length; pi++) {
        const numComments = 1 + (pi % 4); // 1~4 comments per post
        for (let ci = 0; ci < numComments; ci++) {
          const authorIdx = (pi + ci + 1) % studentIds.length;
          const textIdx = (pi * 3 + ci) % commentTexts.length;
          await DB.prepare(
            "INSERT INTO community_comments (post_id, author_type, author_id, content, is_deleted, created_at) VALUES (?, 'student', ?, ?, 0, ?)"
          ).bind(postIds[pi], studentIds[authorIdx], commentTexts[textIdx], kstTs(-12 + pi)).run();
        }
      }

      // Update comment counts
      for (const pid of postIds) {
        await DB.prepare('UPDATE community_posts SET comment_count = (SELECT COUNT(*) FROM community_comments WHERE post_id = ? AND is_deleted = 0) WHERE id = ?').bind(pid, pid).run();
      }

      // 5f. Create likes
      for (let si = 0; si < studentIds.length; si++) {
        const numLikes = 3 + (si % 3);
        for (let li = 0; li < numLikes && li < postIds.length; li++) {
          const pidx = (si + li * 2) % postIds.length;
          try {
            await DB.prepare(
              "INSERT INTO community_likes (post_id, user_type, user_id, created_at) VALUES (?, 'student', ?, ?)"
            ).bind(postIds[pidx], studentIds[si], kstTs(-10 + si)).run();
          } catch (_) { /* duplicate */ }
        }
      }
      for (const pid of postIds) {
        await DB.prepare('UPDATE community_posts SET like_count = (SELECT COUNT(*) FROM community_likes WHERE post_id = ?) WHERE id = ?').bind(pid, pid).run();
      }

      // 5g. Create friendships
      const friendPairs = [[0, 1], [0, 2], [1, 3], [2, 4]];
      for (const [a, b] of friendPairs) {
        if (a < studentIds.length && b < studentIds.length) {
          const id1 = Math.min(studentIds[a], studentIds[b]);
          const id2 = Math.max(studentIds[a], studentIds[b]);
          try {
            await DB.prepare(
              "INSERT INTO friendships (student_id_1, student_id_2, status, invited_by, accepted_at, created_at) VALUES (?, ?, 'accepted', ?, ?, ?)"
            ).bind(id1, id2, studentIds[a], kstTs(-5), kstTs(-5)).run();
          } catch (_) { /* duplicate */ }
        }
      }

      // 5h. Create invite codes
      const code1 = 'JYCC-' + Math.random().toString(36).substring(2, 6).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
      await DB.prepare(
        "INSERT INTO friend_invite_codes (student_id, code, max_uses, use_count, expires_at, is_active, created_at) VALUES (?, ?, 5, 0, ?, 1, ?)"
      ).bind(studentIds[0], code1, kstTs(7), kstTs(0)).run();

      // 5i. Create share settings
      const shareConfigs = [
        [1,1,1,1,1], [1,1,0,0,0], [0,0,1,1,0], [0,0,0,0,0], [1,0,1,0,1], [1,1,1,1,1]
      ];
      for (let i = 0; i < Math.min(studentIds.length, shareConfigs.length); i++) {
        const sc = shareConfigs[i];
        await DB.prepare(
          "INSERT INTO learning_share_settings (student_id, share_class_records, share_question_count, share_teach_count, share_mission_status, share_xp_level, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
        ).bind(studentIds[i], sc[0], sc[1], sc[2], sc[3], sc[4], kstTs(0)).run();
      }

      // 5j. Create notifications
      for (let pi = 0; pi < Math.min(5, postIds.length); pi++) {
        const postAuthorIdx = pi % studentIds.length;
        const actorIdx = (pi + 1) % studentIds.length;
        await DB.prepare(
          "INSERT INTO community_notifications (recipient_type, recipient_id, type, post_id, actor_type, actor_id, is_read, created_at) VALUES ('student', ?, 'comment', ?, 'student', ?, ?, ?)"
        ).bind(studentIds[postAuthorIdx], postIds[pi], studentIds[actorIdx], pi < 2 ? 0 : 1, kstTs(-3 + pi)).run();
        if (pi < 3) {
          await DB.prepare(
            "INSERT INTO community_notifications (recipient_type, recipient_id, type, post_id, actor_type, actor_id, is_read, created_at) VALUES ('student', ?, 'like', ?, 'student', ?, 0, ?)"
          ).bind(studentIds[postAuthorIdx], postIds[pi], studentIds[(actorIdx + 1) % studentIds.length], kstTs(-2 + pi)).run();
        }
      }

      // 5k. Return counts
      const communityTables = ['community_boards', 'community_posts', 'community_comments', 'community_likes', 'community_notifications', 'community_reports', 'friendships', 'friend_invite_codes', 'learning_share_settings'];
      const counts: Record<string, number> = {};
      for (const t of communityTables) {
        const r: any = await DB.prepare(`SELECT COUNT(*) as cnt FROM ${t}`).first();
        counts[t] = r?.cnt || 0;
      }
      return c.json({ success: true, step: 5, message: 'Community seed data complete!', counts });
    }

    return c.json({ error: 'Invalid step. Use step=0,1,2,3,4,5', usage: 'Call /api/seed-test-data?step=0 then step=1,2,3,4,5 in order' }, 400);
  } catch (e: any) {
    console.error('Seed error:', e);
    return c.json({ error: e.message, stack: e.stack }, 500);
  }
});

// 임시: 중복 수업기록 정리 (GET으로 호출 가능)
app.get('/api/admin/cleanup-duplicate-records', async (c) => {
  try {
    // 같은 student_id + date + subject 조합에서 가장 높은 id만 남기고 삭제
    const dupes = await c.env.DB.prepare(`
      SELECT id FROM class_records
      WHERE id NOT IN (
        SELECT MAX(id) FROM class_records GROUP BY student_id, date, subject
      )
    `).all()
    const ids = (dupes.results as any[]).map((r: any) => r.id)
    if (ids.length === 0) return c.json({ success: true, message: 'No duplicates found', deleted: 0 })
    for (const id of ids) {
      await c.env.DB.prepare('DELETE FROM class_record_photos WHERE class_record_id = ?').bind(id).run()
      await c.env.DB.prepare('DELETE FROM class_records WHERE id = ?').bind(id).run()
    }
    return c.json({ success: true, deleted: ids.length, deletedIds: ids })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
});


// ==================== DB 자동 마이그레이션 ====================
app.get('/api/migrate', async (c) => {
  const adminKey = c.req.query('key')
  const validKey = c.env.ADMIN_KEY || 'jycc_admin_2026'
  if (adminKey && adminKey !== validKey) return c.json({ error: 'Unauthorized' }, 403)
  try {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS mentors (id INTEGER PRIMARY KEY AUTOINCREMENT, login_id TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, academy_name TEXT DEFAULT '', phone TEXT DEFAULT '', external_user_id INTEGER DEFAULT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE INDEX IF NOT EXISTS idx_mentors_external ON mentors(external_user_id)`,
      `CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, mentor_id INTEGER NOT NULL, name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL, description TEXT DEFAULT '', max_students INTEGER DEFAULT 30, is_active INTEGER DEFAULT 1, external_class_id INTEGER DEFAULT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (mentor_id) REFERENCES mentors(id))`,
      `CREATE INDEX IF NOT EXISTS idx_groups_external ON groups(external_class_id)`,
      `CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER, name TEXT NOT NULL, password_hash TEXT NOT NULL, school_name TEXT DEFAULT '', grade INTEGER DEFAULT 1, profile_emoji TEXT DEFAULT '😊', xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1, external_user_id INTEGER DEFAULT NULL, nickname TEXT, croquet_balance INTEGER NOT NULL DEFAULT 0, last_login_at DATETIME, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (group_id) REFERENCES groups(id))`,
      `CREATE INDEX IF NOT EXISTS idx_students_external ON students(external_user_id)`,
      `CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'midterm', start_date TEXT NOT NULL, subjects TEXT NOT NULL DEFAULT '[]', status TEXT DEFAULT 'upcoming', memo TEXT DEFAULT '', created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS exam_results (id INTEGER PRIMARY KEY AUTOINCREMENT, exam_id INTEGER NOT NULL UNIQUE, student_id INTEGER NOT NULL, total_score INTEGER, grade INTEGER, subjects_data TEXT NOT NULL DEFAULT '[]', overall_reflection TEXT DEFAULT '', created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (exam_id) REFERENCES exams(id), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS wrong_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, exam_result_id INTEGER NOT NULL, student_id INTEGER NOT NULL, subject TEXT NOT NULL, question_number INTEGER, topic TEXT DEFAULT '', error_type TEXT DEFAULT '', my_answer TEXT DEFAULT '', correct_answer TEXT DEFAULT '', reason TEXT DEFAULT '', reflection TEXT DEFAULT '', created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (exam_result_id) REFERENCES exam_results(id), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS wrong_answer_images (id INTEGER PRIMARY KEY AUTOINCREMENT, wrong_answer_id INTEGER NOT NULL, image_data TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (wrong_answer_id) REFERENCES wrong_answers(id))`,
      `CREATE TABLE IF NOT EXISTS assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', teacher_name TEXT DEFAULT '', due_date TEXT NOT NULL, status TEXT DEFAULT 'pending', progress INTEGER DEFAULT 0, color TEXT DEFAULT '#6C5CE7', plan_data TEXT DEFAULT '[]', created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS class_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, date TEXT NOT NULL, content TEXT DEFAULT '', keywords TEXT DEFAULT '[]', understanding INTEGER DEFAULT 3, memo TEXT DEFAULT '', topic TEXT DEFAULT '', pages TEXT DEFAULT '', photos TEXT DEFAULT '[]', teacher_note TEXT DEFAULT '', created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS question_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, question_text TEXT NOT NULL, question_level TEXT DEFAULT '', question_label TEXT DEFAULT '', axis TEXT DEFAULT 'curiosity', coaching_messages TEXT DEFAULT '[]', xp_earned INTEGER DEFAULT 0, is_complete INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS teach_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, topic TEXT NOT NULL, taught_to TEXT DEFAULT '', content TEXT DEFAULT '', reflection TEXT DEFAULT '', xp_earned INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS activity_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, activity_type TEXT DEFAULT '', title TEXT NOT NULL, description TEXT DEFAULT '', start_date TEXT, end_date TEXT, status TEXT DEFAULT 'in-progress', progress INTEGER DEFAULT 0, reflection TEXT DEFAULT '', created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id))`,
      // 활동 로그 별도 테이블 (날짜별 기록 보장)
      `CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_record_id INTEGER NOT NULL, student_id INTEGER NOT NULL, date TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', reflection TEXT DEFAULT '', duration TEXT DEFAULT '', xp_earned INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (activity_record_id) REFERENCES activity_records(id), FOREIGN KEY (student_id) REFERENCES students(id))`,
      // 탐구보고서 기록 테이블
      `CREATE TABLE IF NOT EXISTS report_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, title TEXT NOT NULL, subject TEXT DEFAULT '', phase TEXT DEFAULT '', timeline TEXT DEFAULT '[]', questions TEXT DEFAULT '[]', total_xp INTEGER DEFAULT 0, status TEXT DEFAULT 'in-progress', created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE INDEX IF NOT EXISTS idx_groups_mentor ON groups(mentor_id)`,
      `CREATE INDEX IF NOT EXISTS idx_groups_invite ON groups(invite_code)`,
      `CREATE INDEX IF NOT EXISTS idx_students_group ON students(group_id)`,
      `CREATE INDEX IF NOT EXISTS idx_students_name_group ON students(name, group_id)`,
      `CREATE INDEX IF NOT EXISTS idx_exams_student ON exams(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_exam_results_student ON exam_results(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_exam_results_exam ON exam_results(exam_id)`,
      `CREATE INDEX IF NOT EXISTS idx_wrong_answers_result ON wrong_answers(exam_result_id)`,
      `CREATE INDEX IF NOT EXISTS idx_assignments_student ON assignments(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_class_records_student ON class_records(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_question_records_student ON question_records(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_teach_records_student ON teach_records(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_records_student ON activity_records(student_id)`,
      // 날짜 기반 조회 최적화 인덱스
      `CREATE INDEX IF NOT EXISTS idx_class_records_date ON class_records(date)`,
      `CREATE INDEX IF NOT EXISTS idx_class_records_student_date ON class_records(student_id, date)`,
      `CREATE INDEX IF NOT EXISTS idx_question_records_created ON question_records(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_teach_records_created ON teach_records(created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_assignments_due ON assignments(due_date)`,
      `CREATE INDEX IF NOT EXISTS idx_assignments_student_created ON assignments(student_id, created_at)`,
      `CREATE INDEX IF NOT EXISTS idx_exams_start ON exams(start_date)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_activity ON activity_logs(activity_record_id)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_student_date ON activity_logs(student_id, date)`,
      `CREATE INDEX IF NOT EXISTS idx_report_records_student ON report_records(student_id)`,
      // 복합 인덱스 — 정렬 성능 최적화
      `CREATE INDEX IF NOT EXISTS idx_question_records_student_created ON question_records(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_teach_records_student_created ON teach_records(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_my_answers_question_created ON my_answers(question_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_activity_logs_student_created ON activity_logs(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_wrong_answer_images_wa ON wrong_answer_images(wrong_answer_id, sort_order)`,
      // ===== 나만의 질문방 테이블 =====
      `CREATE TABLE IF NOT EXISTS my_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT DEFAULT '기타', class_record_id INTEGER DEFAULT NULL, title TEXT NOT NULL, content TEXT DEFAULT '', image_key TEXT DEFAULT NULL, thumbnail_key TEXT DEFAULT NULL, status TEXT DEFAULT '미답변', question_level TEXT DEFAULT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS my_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER NOT NULL, student_id INTEGER NOT NULL, content TEXT DEFAULT '', image_key TEXT DEFAULT NULL, resolve_hours REAL DEFAULT NULL, resolve_days INTEGER DEFAULT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (question_id) REFERENCES my_questions(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_my_questions_student ON my_questions(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_my_questions_status ON my_questions(student_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_my_questions_subject ON my_questions(student_id, subject)`,
      `CREATE INDEX IF NOT EXISTS idx_my_answers_question ON my_answers(question_id)`,
      // ===== XP 내역 기록 테이블 =====
      `CREATE TABLE IF NOT EXISTS xp_history (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, amount INTEGER NOT NULL, source TEXT NOT NULL, source_detail TEXT DEFAULT '', ref_table TEXT DEFAULT NULL, ref_id INTEGER DEFAULT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_xp_history_student ON xp_history(student_id, created_at DESC)`,
      // class_records 새 컬럼 추가 (기존 테이블 호환)
      `ALTER TABLE class_records ADD COLUMN topic TEXT DEFAULT ''`,
      `ALTER TABLE class_records ADD COLUMN pages TEXT DEFAULT ''`,
      `ALTER TABLE class_records ADD COLUMN photos TEXT DEFAULT '[]'`,
      `ALTER TABLE class_records ADD COLUMN teacher_note TEXT DEFAULT ''`,
      // ===== 수업 기록 사진 별도 저장 테이블 =====
      `CREATE TABLE IF NOT EXISTS class_record_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, class_record_id INTEGER, photo_data TEXT NOT NULL, thumbnail TEXT DEFAULT '', mime_type TEXT DEFAULT 'image/jpeg', file_size INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_crp_student ON class_record_photos(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crp_record ON class_record_photos(class_record_id)`,
      // ===== 수업 기록 AI Credit Log + 사진 태그 =====
      `ALTER TABLE class_records ADD COLUMN ai_credit_log TEXT DEFAULT ''`,
      `ALTER TABLE class_records ADD COLUMN photo_tags TEXT DEFAULT '[]'`,
      `ALTER TABLE class_record_photos ADD COLUMN tag TEXT DEFAULT 'note'`,
      // ===== 수업 기록 사진 카운트 =====
      `ALTER TABLE class_records ADD COLUMN photo_count INTEGER DEFAULT 0`,
      // ===== 나의 질문함 확장 컬럼 =====
      `ALTER TABLE my_questions ADD COLUMN ai_improved TEXT DEFAULT NULL`,
      `ALTER TABLE my_questions ADD COLUMN source TEXT DEFAULT NULL`,
      `ALTER TABLE my_questions ADD COLUMN period INTEGER DEFAULT NULL`,
      `ALTER TABLE my_questions ADD COLUMN date TEXT DEFAULT NULL`,
      // ===== 연결 질문 (체이닝) =====
      `ALTER TABLE my_questions ADD COLUMN parent_id INTEGER DEFAULT NULL`,
      `CREATE INDEX IF NOT EXISTS idx_my_questions_parent ON my_questions(parent_id)`,
      // ===== 멘토 피드백 테이블 =====
      `CREATE TABLE IF NOT EXISTS mentor_feedbacks (id INTEGER PRIMARY KEY AUTOINCREMENT, mentor_id INTEGER NOT NULL, student_id INTEGER NOT NULL, record_type TEXT NOT NULL DEFAULT 'general', record_id INTEGER DEFAULT NULL, content TEXT NOT NULL, feedback_type TEXT DEFAULT 'note', is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (mentor_id) REFERENCES mentors(id), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_mf_student ON mentor_feedbacks(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_mf_mentor ON mentor_feedbacks(mentor_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_mf_record ON mentor_feedbacks(record_type, record_id)`,
      `CREATE INDEX IF NOT EXISTS idx_mf_unread ON mentor_feedbacks(student_id, is_read)`,
      // 크로켓 포인트 테이블
      `CREATE TABLE IF NOT EXISTS croquet_points (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, mentor_id INTEGER, amount INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '기타', reason_detail TEXT DEFAULT '', balance_after INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_cp_student ON croquet_points(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cp_mentor ON croquet_points(mentor_id, created_at DESC)`,
      // students 테이블에 croquet_balance 컬럼 추가
      `ALTER TABLE students ADD COLUMN croquet_balance INTEGER NOT NULL DEFAULT 0`,
      // 아하 리포트 저장 테이블
      `CREATE TABLE IF NOT EXISTS aha_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, unit TEXT DEFAULT '', student_name_detected TEXT DEFAULT '', subject_detected TEXT DEFAULT '', unit_detected TEXT DEFAULT '', section_problem TEXT DEFAULT '', section_topic TEXT DEFAULT '', section_research TEXT DEFAULT '', section_self_feedback TEXT DEFAULT '', ai_feedback TEXT DEFAULT '', photos TEXT DEFAULT '[]', ai_source TEXT DEFAULT 'gemini', croquet_given INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_aha_student ON aha_reports(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_aha_subject ON aha_reports(student_id, subject)`,
      // 아하 리포트 v2 섹션 컬럼 추가
      `ALTER TABLE aha_reports ADD COLUMN section_sa TEXT DEFAULT ''`,
      `ALTER TABLE aha_reports ADD COLUMN section_pa TEXT DEFAULT '[]'`,
      `ALTER TABLE aha_reports ADD COLUMN section_da TEXT DEFAULT ''`,
      `ALTER TABLE aha_reports ADD COLUMN section_poa TEXT DEFAULT ''`,
      `ALTER TABLE aha_reports ADD COLUMN section_ppa TEXT DEFAULT '{}'`,
      `ALTER TABLE aha_reports ADD COLUMN source TEXT DEFAULT ''`,
      `ALTER TABLE aha_reports ADD COLUMN date TEXT DEFAULT ''`,
      `ALTER TABLE aha_reports ADD COLUMN photo_tags TEXT DEFAULT '[]'`,
      // 외부 앱 연동용 external_user_id, external_class_id 추가 (기존 DB 호환)
      `ALTER TABLE mentors ADD COLUMN is_director INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE mentors ADD COLUMN external_user_id INTEGER DEFAULT NULL`,
      `ALTER TABLE groups ADD COLUMN external_class_id INTEGER DEFAULT NULL`,
      `ALTER TABLE students ADD COLUMN external_user_id INTEGER DEFAULT NULL`,
      // ===== 창체 활동 로그에 사진/AI분석 컬럼 추가 =====
      `ALTER TABLE activity_logs ADD COLUMN photos TEXT DEFAULT '[]'`,
      `ALTER TABLE activity_logs ADD COLUMN ai_result TEXT DEFAULT ''`,
      // 시간표 저장 테이블
      `CREATE TABLE IF NOT EXISTS student_timetables (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL UNIQUE, school_data TEXT DEFAULT '[]', teachers_data TEXT DEFAULT '{}', period_times TEXT DEFAULT '[]', subject_colors TEXT DEFAULT '{}', academy_data TEXT DEFAULT '[]', updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      // ===== 시간표 사진 → 과목 자동 등록 (학기/과목/시간표슬롯/시험과목) =====
      `CREATE TABLE IF NOT EXISTS semesters (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, year INTEGER NOT NULL, term INTEGER NOT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_semesters_unique ON semesters(student_id, year, term)`,
      `CREATE TABLE IF NOT EXISTS subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL, name TEXT NOT NULL, teacher TEXT, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_subjects_semester ON subjects(semester_id)`,
      `CREATE TABLE IF NOT EXISTS timetable_slots (id INTEGER PRIMARY KEY AUTOINCREMENT, semester_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, day_of_week INTEGER NOT NULL, period INTEGER NOT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (semester_id) REFERENCES semesters(id) ON DELETE CASCADE, FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_timetable_slots_semester ON timetable_slots(semester_id)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_timetable_slots_unique ON timetable_slots(semester_id, day_of_week, period)`,
      `CREATE TABLE IF NOT EXISTS exam_subjects (id INTEGER PRIMARY KEY AUTOINCREMENT, exam_id INTEGER NOT NULL, subject_id INTEGER NOT NULL, exam_date TEXT NOT NULL, period INTEGER, scope TEXT, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE, FOREIGN KEY (subject_id) REFERENCES subjects(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_exam_subjects_exam ON exam_subjects(exam_id)`,
      // ===== 오늘 할 일 (Daily Todos) =====
      `CREATE TABLE IF NOT EXISTS daily_todos (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, date TEXT NOT NULL, content TEXT NOT NULL, is_completed INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_daily_todos_student_date ON daily_todos(student_id, date)`,
      // ===== 릴레이단어장 =====
      `CREATE TABLE IF NOT EXISTS relay_wordbooks (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL, date TEXT NOT NULL, words TEXT NOT NULL DEFAULT '[]', is_ready INTEGER NOT NULL DEFAULT 0, created_by INTEGER NOT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_relay_wordbooks_unique ON relay_wordbooks(class_id, date)`,
      `CREATE TABLE IF NOT EXISTS relay_word_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, wordbook_id INTEGER NOT NULL, student_user_id INTEGER NOT NULL, student_name TEXT NOT NULL DEFAULT '', entries TEXT NOT NULL DEFAULT '[]', is_finished INTEGER NOT NULL DEFAULT 0, finished_at DATETIME DEFAULT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (wordbook_id) REFERENCES relay_wordbooks(id) ON DELETE CASCADE)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_relay_entries_unique ON relay_word_entries(wordbook_id, student_user_id)`,
      // ===== 진로 프로파일 (앱티핏 전공적성 검사 결과) =====
      `CREATE TABLE IF NOT EXISTS career_profiles (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL UNIQUE, test_provider TEXT DEFAULT 'aptifit', test_date TEXT, raw_data TEXT DEFAULT '{}', top_departments TEXT DEFAULT '[]', dream_department TEXT DEFAULT '{}', field_profile TEXT DEFAULT '{}', major_profile TEXT DEFAULT '{}', career_advice TEXT DEFAULT '', careers TEXT DEFAULT '[]', pdf_r2_key TEXT DEFAULT NULL, parse_status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_career_profiles_student ON career_profiles(student_id)`,
      // ===== 커뮤니티(소통) 테이블 =====
      `ALTER TABLE students ADD COLUMN nickname TEXT`,
      `ALTER TABLE mentors ADD COLUMN nickname TEXT`,
      `CREATE TABLE IF NOT EXISTS community_boards (id INTEGER PRIMARY KEY AUTOINCREMENT, board_type TEXT NOT NULL, group_id INTEGER, academy_name TEXT, name TEXT NOT NULL, description TEXT DEFAULT '', is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS community_posts (id INTEGER PRIMARY KEY AUTOINCREMENT, board_id INTEGER NOT NULL, author_type TEXT NOT NULL, author_id INTEGER NOT NULL, title TEXT, content TEXT DEFAULT '', like_count INTEGER DEFAULT 0, comment_count INTEGER DEFAULT 0, is_deleted INTEGER DEFAULT 0, deleted_by TEXT, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS community_post_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, photo_data TEXT, r2_key TEXT, thumbnail TEXT DEFAULT '', mime_type TEXT DEFAULT 'image/jpeg', file_size INTEGER DEFAULT 0, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS community_comments (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, author_type TEXT NOT NULL, author_id INTEGER NOT NULL, content TEXT NOT NULL, is_deleted INTEGER DEFAULT 0, deleted_by TEXT, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS community_likes (id INTEGER PRIMARY KEY AUTOINCREMENT, post_id INTEGER NOT NULL, user_type TEXT NOT NULL, user_id INTEGER NOT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS community_reports (id INTEGER PRIMARY KEY AUTOINCREMENT, reporter_type TEXT NOT NULL, reporter_id INTEGER NOT NULL, target_type TEXT NOT NULL, target_id INTEGER NOT NULL, reason TEXT DEFAULT '', status TEXT DEFAULT 'pending', resolved_by INTEGER, resolved_at DATETIME, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS community_notifications (id INTEGER PRIMARY KEY AUTOINCREMENT, recipient_type TEXT NOT NULL, recipient_id INTEGER NOT NULL, type TEXT NOT NULL, post_id INTEGER, actor_type TEXT NOT NULL, actor_id INTEGER NOT NULL, is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS friendships (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id_1 INTEGER NOT NULL, student_id_2 INTEGER NOT NULL, status TEXT DEFAULT 'accepted', invited_by INTEGER, invite_code TEXT, accepted_at DATETIME, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS friend_invite_codes (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, code TEXT NOT NULL UNIQUE, max_uses INTEGER DEFAULT 5, use_count INTEGER DEFAULT 0, expires_at DATETIME, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE TABLE IF NOT EXISTS learning_share_settings (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL UNIQUE, share_class_records INTEGER DEFAULT 0, share_question_count INTEGER DEFAULT 0, share_teach_count INTEGER DEFAULT 0, share_mission_status INTEGER DEFAULT 0, share_xp_level INTEGER DEFAULT 0, updated_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      // 커뮤니티 인덱스
      `CREATE INDEX IF NOT EXISTS idx_community_posts_board ON community_posts(board_id, is_deleted, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_community_posts_author ON community_posts(author_type, author_id)`,
      `CREATE INDEX IF NOT EXISTS idx_community_post_photos_post ON community_post_photos(post_id, sort_order)`,
      `CREATE INDEX IF NOT EXISTS idx_community_comments_post ON community_comments(post_id, is_deleted, created_at ASC)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_community_likes_unique ON community_likes(post_id, user_type, user_id)`,
      `CREATE INDEX IF NOT EXISTS idx_community_reports_status ON community_reports(status, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_community_notifications_recipient ON community_notifications(recipient_type, recipient_id, is_read, created_at DESC)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_friendships_pair ON friendships(student_id_1, student_id_2)`,
      `CREATE INDEX IF NOT EXISTS idx_friendships_student1 ON friendships(student_id_1, status)`,
      `CREATE INDEX IF NOT EXISTS idx_friendships_student2 ON friendships(student_id_2, status)`,
      `CREATE INDEX IF NOT EXISTS idx_friend_invite_codes_student ON friend_invite_codes(student_id)`,
      // idx_friend_invite_codes_code: 불필요 (CREATE TABLE에서 UNIQUE 제약 이미 선언)
      // idx_learning_share_settings_student: 불필요 (CREATE TABLE에서 UNIQUE 제약 이미 선언)
      // ===== 탐구 소재 분석 (멘토용) =====
      `CREATE TABLE IF NOT EXISTS question_analysis (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, mentor_id INTEGER NOT NULL, subjects TEXT DEFAULT '전체', date_from TEXT, date_to TEXT, question_count INTEGER DEFAULT 0, result_json TEXT NOT NULL, created_at TEXT DEFAULT (datetime('now','+9 hours')))`,
      `CREATE INDEX IF NOT EXISTS idx_qa_student ON question_analysis(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_qa_mentor ON question_analysis(mentor_id)`,
      // ===== 학생-그룹 N:M 관계 테이블 =====
      `CREATE TABLE IF NOT EXISTS student_groups (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, group_id INTEGER NOT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE, FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE, UNIQUE (student_id, group_id))`,
      `CREATE INDEX IF NOT EXISTS idx_sg_student ON student_groups(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_sg_group ON student_groups(group_id)`,
    ];
    const errors: string[] = [];
    for (const sql of stmts) {
      try { await c.env.DB.prepare(sql).run(); } catch(e: any) { errors.push(e.message || String(e)); }
    }

    // ===== 커뮤니티 보드 자동 시딩 =====
    try {
      // 학원별 게시판
      const academies: any = await c.env.DB.prepare(
        "SELECT DISTINCT academy_name FROM mentors WHERE academy_name IS NOT NULL AND academy_name != ''"
      ).all();
      for (const row of (academies.results || [])) {
        const existing: any = await c.env.DB.prepare(
          "SELECT id FROM community_boards WHERE board_type = 'academy' AND academy_name = ?"
        ).bind(row.academy_name).first();
        if (!existing) {
          await c.env.DB.prepare(
            "INSERT INTO community_boards (board_type, academy_name, name, description) VALUES ('academy', ?, ?, '')"
          ).bind(row.academy_name, `${row.academy_name} 게시판`).run();
        }
      }
      // 반별 게시판
      const activeGroups: any = await c.env.DB.prepare(
        "SELECT id, name FROM groups WHERE is_active = 1"
      ).all();
      for (const grp of (activeGroups.results || [])) {
        const existing: any = await c.env.DB.prepare(
          "SELECT id FROM community_boards WHERE board_type = 'group' AND group_id = ?"
        ).bind(grp.id).first();
        if (!existing) {
          await c.env.DB.prepare(
            "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
          ).bind(grp.id, `${grp.name} 게시판`).run();
        }
      }
    } catch (e) {
      console.error('Board auto-seeding error:', e);
    }

    // croquet_points 테이블 마이그레이션: mentor_id를 nullable로 변경 (자동 지급 지원)
    try {
      const tableInfo: any = await c.env.DB.prepare("PRAGMA table_info(croquet_points)").all();
      const mentorCol = tableInfo.results?.find((col: any) => col.name === 'mentor_id');
      if (mentorCol && mentorCol.notnull === 1) {
        // NOT NULL 제약이 있으면 테이블 재생성
        await c.env.DB.prepare('ALTER TABLE croquet_points RENAME TO croquet_points_old').run();
        await c.env.DB.prepare(`CREATE TABLE croquet_points (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, mentor_id INTEGER, amount INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '기타', reason_detail TEXT DEFAULT '', balance_after INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`).run();
        await c.env.DB.prepare('INSERT INTO croquet_points (id, student_id, mentor_id, amount, reason, reason_detail, balance_after, created_at) SELECT id, student_id, mentor_id, amount, reason, reason_detail, balance_after, created_at FROM croquet_points_old').run();
        await c.env.DB.prepare('DROP TABLE croquet_points_old').run();
        await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_cp_student ON croquet_points(student_id, created_at DESC)').run();
        await c.env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_cp_mentor ON croquet_points(mentor_id, created_at DESC)').run();
      }
    } catch(_) { /* migration may have already been applied */ }

    // 원장 기본 계정 자동 생성 (없을 경우)
    try {
      const directorExists: any = await c.env.DB.prepare(
        'SELECT id FROM mentors WHERE login_id = ? AND is_director = 1'
      ).bind('director').first();
      if (!directorExists) {
        const dirPwHash = await hashPassword('jysk2026!');
        await c.env.DB.prepare(
          'INSERT INTO mentors (login_id, password_hash, name, academy_name, is_director) VALUES (?, ?, ?, ?, 1)'
        ).bind('director', dirPwHash, '원장', '정율사관학원').run();
      }
    } catch(_) { /* director account may already exist */ }

    // ===== students.group_id nullable 마이그레이션 (테이블 재생성) =====
    // SQLite에서는 ALTER TABLE로 NOT NULL 제약을 제거할 수 없으므로 테이블 재생성 필요
    try {
      // 현재 students 테이블의 group_id 컬럼이 NOT NULL인지 확인
      const tableInfo: any = await c.env.DB.prepare("PRAGMA table_info(students)").all();
      const groupIdCol = tableInfo.results?.find((col: any) => col.name === 'group_id');

      if (groupIdCol && groupIdCol.notnull === 1) {
        console.log('students.group_id is NOT NULL, starting migration to nullable...');

        // 0. 이전 마이그레이션 실패로 남은 students_new 테이블 정리
        try {
          await c.env.DB.prepare('DROP TABLE IF EXISTS students_new').run();
        } catch(_) { /* ignore */ }

        // D1 batch로 한 번에 실행 (트랜잭션으로 외래 키 체크 연기)
        await c.env.DB.batch([
          // 1. 임시 테이블 생성 (group_id nullable, 외래 키 제약 제거)
          c.env.DB.prepare(`
            CREATE TABLE students_new (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              group_id INTEGER,
              name TEXT NOT NULL,
              password_hash TEXT NOT NULL,
              school_name TEXT DEFAULT '',
              grade INTEGER DEFAULT 1,
              profile_emoji TEXT DEFAULT '😊',
              xp INTEGER DEFAULT 0,
              level INTEGER DEFAULT 1,
              is_active INTEGER DEFAULT 1,
              external_user_id INTEGER DEFAULT NULL,
              nickname TEXT,
              croquet_balance INTEGER NOT NULL DEFAULT 0,
              last_login_at DATETIME,
              created_at DATETIME DEFAULT (datetime('now','+9 hours')),
              updated_at DATETIME DEFAULT (datetime('now','+9 hours'))
            )
          `),
          // 2. 기존 데이터 복사
          c.env.DB.prepare(`
            INSERT INTO students_new (id, group_id, name, password_hash, school_name, grade, profile_emoji, xp, level, is_active, external_user_id, nickname, croquet_balance, last_login_at, created_at, updated_at)
            SELECT id, group_id, name, password_hash, school_name, grade, profile_emoji, xp, level, is_active, external_user_id, nickname, croquet_balance, last_login_at, created_at, updated_at
            FROM students
          `),
          // 3. 기존 테이블 삭제
          c.env.DB.prepare('DROP TABLE students'),
          // 4. 새 테이블 이름 변경
          c.env.DB.prepare('ALTER TABLE students_new RENAME TO students'),
          // 5. 인덱스 재생성
          c.env.DB.prepare('CREATE INDEX idx_students_group ON students(group_id)'),
          c.env.DB.prepare('CREATE INDEX idx_students_name_group ON students(name, group_id)'),
          c.env.DB.prepare('CREATE INDEX idx_students_external ON students(external_user_id)'),
        ]);

        console.log('students.group_id nullable migration completed');
      }
    } catch(e: any) {
      errors.push('students.group_id nullable migration: ' + (e.message || String(e)));
    }

    // ===== 기존 students.group_id 데이터를 student_groups로 이관 =====
    try {
      const migrated = await c.env.DB.prepare(`
        INSERT OR IGNORE INTO student_groups (student_id, group_id)
        SELECT id, group_id FROM students WHERE group_id IS NOT NULL AND is_active = 1
      `).run();
      console.log('Migrated student_groups:', migrated.meta?.changes || 0);
    } catch(_) { /* migration may have already been applied */ }

    // 실제 테이블 수 확인
    const tblResult: any = await c.env.DB.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'").all();
    const tableNames = tblResult.results?.map((r: any) => r.name) || [];
    return c.json({ success: true, message: 'Migration completed', tables: tableNames.length, tableNames, errors: errors.length > 0 ? errors : undefined });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== 커뮤니티(소통) API ====================

// GET /api/community/boards — 사용자가 접근 가능한 게시판 목록
app.get('/api/community/boards', async (c) => {
  const userType = c.req.query('user_type');
  const userId = Number(c.req.query('user_id'));
  if (!userType || !userId) return c.json({ success: false, error: 'user_type과 user_id는 필수입니다' }, 400);

  try {
    let academyName = '';
    let groupId = 0;
    let mentorId = 0;

    if (userType === 'student') {
      // student_groups에서 academy_name 조회
      const studentInfo: any = await c.env.DB.prepare(`
        SELECT m.academy_name FROM students s
        JOIN student_groups sg ON s.id = sg.student_id
        JOIN groups g ON sg.group_id = g.id
        JOIN mentors m ON g.mentor_id = m.id
        WHERE s.id = ? AND s.is_active = 1
        LIMIT 1
      `).bind(userId).first();
      if (!studentInfo) return c.json({ success: false, error: '학생을 찾을 수 없습니다' }, 404);
      academyName = studentInfo.academy_name || '';
    } else if (userType === 'mentor') {
      const mentor: any = await c.env.DB.prepare('SELECT id, academy_name FROM mentors WHERE id = ?').bind(userId).first();
      if (!mentor) return c.json({ success: false, error: '멘토를 찾을 수 없습니다' }, 404);
      academyName = mentor.academy_name || '';
      mentorId = mentor.id;
    } else {
      return c.json({ success: false, error: 'user_type은 student 또는 mentor만 가능합니다' }, 400);
    }

    let boards: any;
    if (userType === 'student') {
      // student_groups를 통해 학생이 속한 모든 그룹의 게시판 조회
      boards = await c.env.DB.prepare(
        `SELECT b.*, COALESCE(pc.cnt, 0) as postCount
         FROM community_boards b
         LEFT JOIN (SELECT board_id, COUNT(*) as cnt FROM community_posts WHERE is_deleted = 0 GROUP BY board_id) pc ON b.id = pc.board_id
         WHERE b.is_active = 1 AND (
           (b.board_type = 'group' AND b.group_id IN (SELECT group_id FROM student_groups WHERE student_id = ?))
           OR (b.board_type = 'academy' AND b.academy_name = ?)
         )`
      ).bind(userId, academyName).all();
    } else {
      boards = await c.env.DB.prepare(
        `SELECT b.*, COALESCE(pc.cnt, 0) as postCount
         FROM community_boards b
         LEFT JOIN (SELECT board_id, COUNT(*) as cnt FROM community_posts WHERE is_deleted = 0 GROUP BY board_id) pc ON b.id = pc.board_id
         WHERE b.is_active = 1 AND (
           (b.board_type = 'group' AND b.group_id IN (SELECT id FROM groups WHERE mentor_id = ?))
           OR (b.board_type = 'academy' AND b.academy_name = ?)
         )`
      ).bind(mentorId, academyName).all();
    }

    const boardList = (boards.results || []).map((b: any) => ({
      id: b.id,
      board_type: b.board_type,
      name: b.name,
      group_id: b.group_id,
      description: b.description || '',
      postCount: b.postCount || 0
    }));

    return c.json({ success: true, data: { boards: boardList } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/community/boards/:boardId/posts — 게시판 게시글 목록 (페이지네이션)
app.get('/api/community/boards/:boardId/posts', async (c) => {
  const boardId = Number(c.req.param('boardId'));
  if (!boardId || isNaN(boardId)) return c.json({ success: false, error: '유효하지 않은 게시판 ID입니다' }, 400);
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));
  const userType = c.req.query('user_type');
  const userId = Number(c.req.query('user_id'));
  if (!userType || !userId) return c.json({ success: false, error: 'user_type과 user_id는 필수입니다' }, 400);

  try {
    // 게시판 조회
    const board: any = await c.env.DB.prepare('SELECT * FROM community_boards WHERE id = ? AND is_active = 1').bind(boardId).first();
    if (!board) return c.json({ success: false, error: '게시판을 찾을 수 없습니다' }, 404);

    // 접근 권한 확인
    if (board.board_type === 'group') {
      if (userType === 'student') {
        // student_groups에서 학생-그룹 매핑 확인
        const membership: any = await c.env.DB.prepare(
          'SELECT 1 FROM student_groups sg JOIN students s ON sg.student_id = s.id WHERE sg.student_id = ? AND sg.group_id = ? AND s.is_active = 1'
        ).bind(userId, board.group_id).first();
        if (!membership) return c.json({ success: false, error: '이 게시판에 접근할 수 없습니다' }, 403);
      } else {
        const group: any = await c.env.DB.prepare('SELECT mentor_id FROM groups WHERE id = ?').bind(board.group_id).first();
        if (!group || group.mentor_id !== userId) return c.json({ success: false, error: '이 게시판에 접근할 수 없습니다' }, 403);
      }
    } else if (board.board_type === 'academy') {
      let userAcademy = '';
      if (userType === 'student') {
        const row: any = await c.env.DB.prepare(`
          SELECT m.academy_name FROM students s
          JOIN student_groups sg ON s.id = sg.student_id
          JOIN groups g ON sg.group_id = g.id
          JOIN mentors m ON g.mentor_id = m.id
          WHERE s.id = ? AND s.is_active = 1
          LIMIT 1
        `).bind(userId).first();
        userAcademy = row?.academy_name || '';
      } else {
        const row: any = await c.env.DB.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(userId).first();
        userAcademy = row?.academy_name || '';
      }
      if (userAcademy !== board.academy_name) return c.json({ success: false, error: '이 게시판에 접근할 수 없습니다' }, 403);
    }

    // 총 게시글 수
    const countResult: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM community_posts WHERE board_id = ? AND is_deleted = 0').bind(boardId).first();
    const totalCount = countResult?.cnt || 0;
    const offset = (page - 1) * limit;

    // 게시글 목록 조회
    const postsResult: any = await c.env.DB.prepare(
      `SELECT p.id, p.title, p.content, p.like_count, p.comment_count, p.created_at,
              p.author_type, p.author_id,
              CASE WHEN p.author_type = 'student' THEN COALESCE(s.nickname, '익명') ELSE COALESCE(m.nickname, '멘토') END as authorNickname,
              CASE WHEN p.author_type = 'student' THEN s.profile_emoji ELSE '🎓' END as authorEmoji,
              (SELECT COUNT(*) FROM community_post_photos WHERE post_id = p.id) as photoCount
       FROM community_posts p
       LEFT JOIN students s ON p.author_type = 'student' AND p.author_id = s.id
       LEFT JOIN mentors m ON p.author_type = 'mentor' AND p.author_id = m.id
       WHERE p.board_id = ? AND p.is_deleted = 0
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`
    ).bind(boardId, limit, offset).all();

    const posts = (postsResult.results || []).map((p: any) => ({
      id: p.id,
      title: p.title || null,
      contentPreview: stripHtmlForPreview(p.content || ''),
      authorNickname: p.authorNickname || '익명',
      authorEmoji: p.authorEmoji || '😊',
      likeCount: p.like_count || 0,
      commentCount: p.comment_count || 0,
      hasPhotos: (p.photoCount || 0) > 0,
      createdAt: p.created_at
    }));

    return c.json({ success: true, data: { posts, hasMore: totalCount > page * limit, totalCount } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==================== 커뮤니티: 게시글 CRUD ====================

// POST /api/community/boards/:boardId/posts — 게시글 작성
app.post('/api/community/boards/:boardId/posts', async (c) => {
  const boardId = Number(c.req.param('boardId'));
  if (!boardId || isNaN(boardId)) return c.json({ success: false, error: '유효하지 않은 게시판 ID입니다' }, 400);
  try {
    const { author_type, author_id, title, content, photos } = await c.req.json();
    if (!author_type || !author_id) return c.json({ success: false, error: 'author_type과 author_id는 필수입니다' }, 400);
    if (title && title.length > 100) return c.json({ success: false, error: '제목은 100자 이내로 작성해주세요' }, 400);
    if (content && content.length > 10000) return c.json({ success: false, error: '내용은 10,000자 이내로 작성해주세요' }, 400);
    if (photos && photos.length > 5) return c.json({ success: false, error: '사진은 최대 5장까지 첨부할 수 있습니다' }, 400);

    const hasAccess = await canAccessBoard(c.env.DB, boardId, author_type, author_id);
    if (!hasAccess) return c.json({ success: false, error: '이 게시판에 접근 권한이 없습니다' }, 403);

    const sanitized = sanitizeHTML(content || '');
    const now = getKSTString();
    const result = await c.env.DB.prepare(
      'INSERT INTO community_posts (board_id, author_type, author_id, title, content, like_count, comment_count, is_deleted, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 0, 0, ?, ?)'
    ).bind(boardId, author_type, author_id, title || null, sanitized, now, now).run();
    const postId = result.meta.last_row_id;

    if (photos && photos.length > 0 && postId) {
      const photoStmts = photos.map((p: any, i: number) =>
        c.env.DB.prepare(
          'INSERT INTO community_post_photos (post_id, photo_data, thumbnail, mime_type, file_size, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(postId, p.data || '', p.thumbnail || '', p.mime_type || 'image/jpeg', p.file_size || 0, i, now)
      );
      await c.env.DB.batch(photoStmts);
    }

    return c.json({ success: true, data: { postId } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/community/posts/:postId — 게시글 상세 조회
app.get('/api/community/posts/:postId', async (c) => {
  const postId = Number(c.req.param('postId'));
  if (!postId || isNaN(postId)) return c.json({ success: false, error: '유효하지 않은 게시글 ID입니다' }, 400);
  const userType = c.req.query('user_type') || '';
  const userId = Number(c.req.query('user_id')) || 0;

  try {
    const post: any = await c.env.DB.prepare(
      `SELECT p.*,
              CASE WHEN p.author_type = 'student' THEN COALESCE(s.nickname, '익명') ELSE COALESCE(m.nickname, '멘토') END as authorNickname,
              CASE WHEN p.author_type = 'student' THEN s.profile_emoji ELSE '🎓' END as authorEmoji
       FROM community_posts p
       LEFT JOIN students s ON p.author_type = 'student' AND p.author_id = s.id
       LEFT JOIN mentors m ON p.author_type = 'mentor' AND p.author_id = m.id
       WHERE p.id = ? AND p.is_deleted = 0`
    ).bind(postId).first();
    if (!post) return c.json({ success: false, error: '게시글을 찾을 수 없습니다' }, 404);

    const photosResult: any = await c.env.DB.prepare(
      'SELECT id, photo_data, thumbnail, mime_type, file_size, sort_order FROM community_post_photos WHERE post_id = ? ORDER BY sort_order'
    ).bind(postId).all();

    let isLikedByMe = false;
    if (userType && userId) {
      const like: any = await c.env.DB.prepare(
        'SELECT id FROM community_likes WHERE post_id = ? AND user_type = ? AND user_id = ?'
      ).bind(postId, userType, userId).first();
      isLikedByMe = !!like;
    }

    return c.json({
      success: true,
      data: {
        post: {
          id: post.id,
          boardId: post.board_id,
          title: post.title,
          content: post.content,
          authorType: post.author_type,
          authorId: post.author_id,
          authorNickname: post.authorNickname || '익명',
          authorEmoji: post.authorEmoji || '😊',
          likeCount: post.like_count || 0,
          commentCount: post.comment_count || 0,
          photos: (photosResult.results || []).map((p: any) => ({
            id: p.id, photoData: p.photo_data, thumbnail: p.thumbnail,
            mimeType: p.mime_type, fileSize: p.file_size, sortOrder: p.sort_order
          })),
          isLikedByMe,
          createdAt: post.created_at,
          updatedAt: post.updated_at
        }
      }
    });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// PUT /api/community/posts/:postId — 게시글 수정
app.put('/api/community/posts/:postId', async (c) => {
  const postId = Number(c.req.param('postId'));
  if (!postId || isNaN(postId)) return c.json({ success: false, error: '유효하지 않은 게시글 ID입니다' }, 400);
  try {
    const { author_type, author_id, title, content, photos } = await c.req.json();
    if (!author_type || !author_id) return c.json({ success: false, error: 'author_type과 author_id는 필수입니다' }, 400);
    if (title && title.length > 100) return c.json({ success: false, error: '제목은 100자 이내로 작성해주세요' }, 400);
    if (content && content.length > 10000) return c.json({ success: false, error: '내용은 10,000자 이내로 작성해주세요' }, 400);

    const post: any = await c.env.DB.prepare('SELECT * FROM community_posts WHERE id = ? AND is_deleted = 0').bind(postId).first();
    if (!post) return c.json({ success: false, error: '게시글을 찾을 수 없습니다' }, 404);
    if (post.author_type !== author_type || post.author_id !== author_id) {
      return c.json({ success: false, error: '본인의 게시글만 수정할 수 있습니다' }, 403);
    }

    const sanitized = sanitizeHTML(content || '');
    const now = getKSTString();
    await c.env.DB.prepare(
      'UPDATE community_posts SET title = ?, content = ?, updated_at = ? WHERE id = ?'
    ).bind(title || null, sanitized, now, postId).run();

    if (photos !== undefined) {
      await c.env.DB.prepare('DELETE FROM community_post_photos WHERE post_id = ?').bind(postId).run();
      if (photos && photos.length > 0) {
        const photoStmts = photos.slice(0, 5).map((p: any, i: number) =>
          c.env.DB.prepare(
            'INSERT INTO community_post_photos (post_id, photo_data, thumbnail, mime_type, file_size, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(postId, p.data || '', p.thumbnail || '', p.mime_type || 'image/jpeg', p.file_size || 0, i, now)
        );
        await c.env.DB.batch(photoStmts);
      }
    }

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/community/posts/:postId — 게시글 삭제 (소프트 삭제)
app.delete('/api/community/posts/:postId', async (c) => {
  const postId = Number(c.req.param('postId'));
  if (!postId || isNaN(postId)) return c.json({ success: false, error: '유효하지 않은 게시글 ID입니다' }, 400);
  try {
    const { user_type, user_id } = await c.req.json();
    if (!user_type || !user_id) return c.json({ success: false, error: 'user_type과 user_id는 필수입니다' }, 400);

    const post: any = await c.env.DB.prepare('SELECT * FROM community_posts WHERE id = ? AND is_deleted = 0').bind(postId).first();
    if (!post) return c.json({ success: false, error: '게시글을 찾을 수 없습니다' }, 404);

    const isAuthor = post.author_type === user_type && post.author_id === user_id;
    let isMentorOfBoard = false;
    if (!isAuthor && user_type === 'mentor') {
      const board: any = await c.env.DB.prepare('SELECT * FROM community_boards WHERE id = ?').bind(post.board_id).first();
      if (board) {
        if (board.board_type === 'group') {
          const g: any = await c.env.DB.prepare('SELECT mentor_id FROM groups WHERE id = ?').bind(board.group_id).first();
          isMentorOfBoard = g && g.mentor_id === user_id;
        } else if (board.board_type === 'academy') {
          const m: any = await c.env.DB.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(user_id).first();
          isMentorOfBoard = m && m.academy_name === board.academy_name;
        }
      }
    }

    if (!isAuthor && !isMentorOfBoard) return c.json({ success: false, error: '삭제 권한이 없습니다' }, 403);

    const now = getKSTString();
    await c.env.DB.prepare(
      'UPDATE community_posts SET is_deleted = 1, deleted_by = ?, updated_at = ? WHERE id = ?'
    ).bind(`${user_type}:${user_id}`, now, postId).run();

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==================== 커뮤니티: 댓글 + 좋아요 ====================

// GET /api/community/posts/:postId/comments — 댓글 목록
app.get('/api/community/posts/:postId/comments', async (c) => {
  const postId = Number(c.req.param('postId'));
  if (!postId || isNaN(postId)) return c.json({ success: false, error: '유효하지 않은 게시글 ID입니다' }, 400);
  const page = Math.max(1, Number(c.req.query('page')) || 1);
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));
  const offset = (page - 1) * limit;

  try {
    const countResult: any = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM community_comments WHERE post_id = ? AND is_deleted = 0'
    ).bind(postId).first();
    const totalCount = countResult?.cnt || 0;

    const result: any = await c.env.DB.prepare(
      `SELECT cc.id, cc.content, cc.author_type, cc.author_id, cc.created_at,
              CASE WHEN cc.author_type = 'student' THEN COALESCE(s.nickname, '익명') ELSE COALESCE(m.nickname, '멘토') END as authorNickname,
              CASE WHEN cc.author_type = 'student' THEN s.profile_emoji ELSE '🎓' END as authorEmoji
       FROM community_comments cc
       LEFT JOIN students s ON cc.author_type = 'student' AND cc.author_id = s.id
       LEFT JOIN mentors m ON cc.author_type = 'mentor' AND cc.author_id = m.id
       WHERE cc.post_id = ? AND cc.is_deleted = 0
       ORDER BY cc.created_at ASC
       LIMIT ? OFFSET ?`
    ).bind(postId, limit, offset).all();

    const comments = (result.results || []).map((c: any) => ({
      id: c.id, content: c.content, authorNickname: c.authorNickname || '익명',
      authorEmoji: c.authorEmoji || '😊', authorType: c.author_type,
      authorId: c.author_id, createdAt: c.created_at
    }));

    return c.json({ success: true, data: { comments, hasMore: totalCount > page * limit, totalCount } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/community/posts/:postId/comments — 댓글 작성
app.post('/api/community/posts/:postId/comments', async (c) => {
  const postId = Number(c.req.param('postId'));
  if (!postId || isNaN(postId)) return c.json({ success: false, error: '유효하지 않은 게시글 ID입니다' }, 400);
  try {
    const { author_type, author_id, content } = await c.req.json();
    if (!author_type || !author_id || !content) return c.json({ success: false, error: '필수 항목을 입력해주세요' }, 400);
    if (content.length > 1000) return c.json({ success: false, error: '댓글은 1,000자 이내로 작성해주세요' }, 400);

    const post: any = await c.env.DB.prepare(
      'SELECT id, author_type, author_id FROM community_posts WHERE id = ? AND is_deleted = 0'
    ).bind(postId).first();
    if (!post) return c.json({ success: false, error: '게시글을 찾을 수 없습니다' }, 404);

    const now = getKSTString();
    const stmts: any[] = [
      c.env.DB.prepare('INSERT INTO community_comments (post_id, author_type, author_id, content, is_deleted, created_at) VALUES (?, ?, ?, ?, 0, ?)').bind(postId, author_type, author_id, content, now),
      c.env.DB.prepare('UPDATE community_posts SET comment_count = comment_count + 1 WHERE id = ?').bind(postId)
    ];
    // 본인 게시글이 아닌 경우에만 알림 생성
    if (post.author_type !== author_type || post.author_id !== author_id) {
      stmts.push(c.env.DB.prepare(
        'INSERT INTO community_notifications (recipient_type, recipient_id, type, post_id, actor_type, actor_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
      ).bind(post.author_type, post.author_id, 'comment', postId, author_type, author_id, now));
    }

    const batchResult = await c.env.DB.batch(stmts);
    const commentId = batchResult[0]?.meta?.last_row_id;
    return c.json({ success: true, data: { commentId } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/community/comments/:commentId — 댓글 삭제 (소프트 삭제)
app.delete('/api/community/comments/:commentId', async (c) => {
  const commentId = Number(c.req.param('commentId'));
  if (!commentId || isNaN(commentId)) return c.json({ success: false, error: '유효하지 않은 댓글 ID입니다' }, 400);
  try {
    const { user_type, user_id } = await c.req.json();
    if (!user_type || !user_id) return c.json({ success: false, error: '필수 항목을 입력해주세요' }, 400);

    const comment: any = await c.env.DB.prepare(
      'SELECT id, post_id, author_type, author_id FROM community_comments WHERE id = ? AND is_deleted = 0'
    ).bind(commentId).first();
    if (!comment) return c.json({ success: false, error: '댓글을 찾을 수 없습니다' }, 404);

    const isAuthor = comment.author_type === user_type && comment.author_id === user_id;
    let isMentor = false;
    if (!isAuthor && user_type === 'mentor') {
      const post: any = await c.env.DB.prepare('SELECT board_id FROM community_posts WHERE id = ?').bind(comment.post_id).first();
      if (post) {
        const board: any = await c.env.DB.prepare('SELECT * FROM community_boards WHERE id = ?').bind(post.board_id).first();
        if (board && board.board_type === 'group') {
          const g: any = await c.env.DB.prepare('SELECT mentor_id FROM groups WHERE id = ?').bind(board.group_id).first();
          isMentor = g && g.mentor_id === user_id;
        } else if (board && board.board_type === 'academy') {
          const m: any = await c.env.DB.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(user_id).first();
          isMentor = m && m.academy_name === board.academy_name;
        }
      }
    }
    if (!isAuthor && !isMentor) return c.json({ success: false, error: '삭제 권한이 없습니다' }, 403);

    await c.env.DB.batch([
      c.env.DB.prepare('UPDATE community_comments SET is_deleted = 1, deleted_by = ? WHERE id = ?').bind(`${user_type}:${user_id}`, commentId),
      c.env.DB.prepare('UPDATE community_posts SET comment_count = MAX(comment_count - 1, 0) WHERE id = ?').bind(comment.post_id)
    ]);

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/community/posts/:postId/like — 좋아요 토글
app.post('/api/community/posts/:postId/like', async (c) => {
  const postId = Number(c.req.param('postId'));
  if (!postId || isNaN(postId)) return c.json({ success: false, error: '유효하지 않은 게시글 ID입니다' }, 400);
  try {
    const { user_type, user_id } = await c.req.json();
    if (!user_type || !user_id) return c.json({ success: false, error: '필수 항목을 입력해주세요' }, 400);

    const post: any = await c.env.DB.prepare(
      'SELECT id, author_type, author_id FROM community_posts WHERE id = ? AND is_deleted = 0'
    ).bind(postId).first();
    if (!post) return c.json({ success: false, error: '게시글을 찾을 수 없습니다' }, 404);

    const existingLike: any = await c.env.DB.prepare(
      'SELECT id FROM community_likes WHERE post_id = ? AND user_type = ? AND user_id = ?'
    ).bind(postId, user_type, user_id).first();

    if (existingLike) {
      // Unlike
      await c.env.DB.batch([
        c.env.DB.prepare('DELETE FROM community_likes WHERE id = ?').bind(existingLike.id),
        c.env.DB.prepare('UPDATE community_posts SET like_count = MAX(like_count - 1, 0) WHERE id = ?').bind(postId)
      ]);
      const updated: any = await c.env.DB.prepare('SELECT like_count FROM community_posts WHERE id = ?').bind(postId).first();
      return c.json({ success: true, data: { liked: false, likeCount: updated?.like_count || 0 } });
    } else {
      // Like
      const now = getKSTString();
      const stmts: any[] = [
        c.env.DB.prepare('INSERT INTO community_likes (post_id, user_type, user_id, created_at) VALUES (?, ?, ?, ?)').bind(postId, user_type, user_id, now),
        c.env.DB.prepare('UPDATE community_posts SET like_count = like_count + 1 WHERE id = ?').bind(postId)
      ];
      if (post.author_type !== user_type || post.author_id !== user_id) {
        stmts.push(c.env.DB.prepare(
          'INSERT INTO community_notifications (recipient_type, recipient_id, type, post_id, actor_type, actor_id, is_read, created_at) VALUES (?, ?, ?, ?, ?, ?, 0, ?)'
        ).bind(post.author_type, post.author_id, 'like', postId, user_type, user_id, now));
      }
      await c.env.DB.batch(stmts);
      const updated: any = await c.env.DB.prepare('SELECT like_count FROM community_posts WHERE id = ?').bind(postId).first();
      return c.json({ success: true, data: { liked: true, likeCount: updated?.like_count || 0 } });
    }
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==================== 커뮤니티: 알림 ====================

// GET /api/community/notifications/unread-count — 읽지 않은 알림 수 (탭 뱃지용)
app.get('/api/community/notifications/unread-count', async (c) => {
  const userType = c.req.query('user_type');
  const userId = Number(c.req.query('user_id'));
  if (!userType || !userId) return c.json({ success: false, error: 'user_type과 user_id가 필요합니다' }, 400);
  try {
    const result: any = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM community_notifications WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0'
    ).bind(userType, userId).first();
    return c.json({ success: true, data: { unreadCount: result?.cnt || 0 } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// PUT /api/community/notifications/read-all — 모든 알림 읽음 처리
app.put('/api/community/notifications/read-all', async (c) => {
  try {
    const { user_type, user_id } = await c.req.json();
    if (!user_type || !user_id) return c.json({ success: false, error: 'user_type과 user_id가 필요합니다' }, 400);
    const result = await c.env.DB.prepare(
      'UPDATE community_notifications SET is_read = 1 WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0'
    ).bind(user_type, user_id).run();
    return c.json({ success: true, data: { markedCount: result.meta.changes || 0 } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/community/notifications — 알림 목록
app.get('/api/community/notifications', async (c) => {
  const userType = c.req.query('user_type');
  const userId = Number(c.req.query('user_id'));
  if (!userType || !userId) return c.json({ success: false, error: 'user_type과 user_id가 필요합니다' }, 400);
  const limit = Math.min(50, Math.max(1, Number(c.req.query('limit')) || 20));
  try {
    const notifs: any = await c.env.DB.prepare(
      `SELECT n.id, n.type, n.post_id, n.actor_type, n.actor_id, n.is_read, n.created_at,
              p.title as post_title,
              CASE WHEN n.actor_type = 'student' THEN COALESCE(s.nickname, '익명') ELSE COALESCE(m.nickname, '멘토') END as actor_nickname
       FROM community_notifications n
       LEFT JOIN community_posts p ON n.post_id = p.id
       LEFT JOIN students s ON n.actor_type = 'student' AND n.actor_id = s.id
       LEFT JOIN mentors m ON n.actor_type = 'mentor' AND n.actor_id = m.id
       WHERE n.recipient_type = ? AND n.recipient_id = ?
       ORDER BY n.created_at DESC
       LIMIT ?`
    ).bind(userType, userId, limit).all();

    const unreadResult: any = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM community_notifications WHERE recipient_type = ? AND recipient_id = ? AND is_read = 0'
    ).bind(userType, userId).first();

    const notifications = (notifs.results || []).map((n: any) => ({
      id: n.id, type: n.type, postId: n.post_id,
      postTitle: n.post_title || '', actorNickname: n.actor_nickname || '익명',
      isRead: n.is_read === 1, createdAt: n.created_at
    }));

    return c.json({ success: true, data: { notifications, unreadCount: unreadResult?.cnt || 0 } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==================== 커뮤니티: 친구 ====================

// POST /api/student/:studentId/friends/invite-code — 친구 초대 코드 생성
app.post('/api/student/:studentId/friends/invite-code', async (c) => {
  const studentId = Number(c.req.param('studentId'));
  if (!studentId) return c.json({ success: false, error: '유효하지 않은 학생 ID입니다' }, 400);
  try {
    // 기존 활성 코드가 있으면 반환
    const existing: any = await c.env.DB.prepare(
      "SELECT code, expires_at FROM friend_invite_codes WHERE student_id = ? AND is_active = 1 AND expires_at > datetime('now','+9 hours') AND use_count < max_uses ORDER BY created_at DESC LIMIT 1"
    ).bind(studentId).first();
    if (existing) return c.json({ success: true, data: { code: existing.code, expiresAt: existing.expires_at } });

    // 새 코드 생성 (충돌 시 3회 재시도)
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = generateInviteCode();
      try {
        const now = getKSTString();
        const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).toISOString().replace('T', ' ').substring(0, 19);
        await c.env.DB.prepare(
          'INSERT INTO friend_invite_codes (student_id, code, max_uses, use_count, expires_at, is_active, created_at) VALUES (?, ?, 5, 0, ?, 1, ?)'
        ).bind(studentId, code, expires, now).run();
        return c.json({ success: true, data: { code, expiresAt: expires } });
      } catch (e: any) {
        if (attempt === 2) throw e;
      }
    }
    return c.json({ success: false, error: '코드 생성에 실패했습니다' }, 500);
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// POST /api/student/:studentId/friends/accept-code — 친구 초대 코드 수락
app.post('/api/student/:studentId/friends/accept-code', async (c) => {
  const accepterId = Number(c.req.param('studentId'));
  if (!accepterId) return c.json({ success: false, error: '유효하지 않은 학생 ID입니다' }, 400);
  try {
    const { code } = await c.req.json();
    if (!code) return c.json({ success: false, error: '초대 코드를 입력해주세요' }, 400);

    const invite: any = await c.env.DB.prepare(
      'SELECT * FROM friend_invite_codes WHERE code = ? AND is_active = 1'
    ).bind(code.toUpperCase()).first();
    if (!invite) return c.json({ success: false, error: '유효하지 않은 초대 코드입니다' }, 400);

    const now = getKSTString();
    if (invite.expires_at && invite.expires_at < now) return c.json({ success: false, error: '초대 코드가 만료되었습니다' }, 400);
    if (invite.use_count >= invite.max_uses) return c.json({ success: false, error: '초대 코드 사용 횟수가 초과되었습니다' }, 400);

    const inviterId = invite.student_id;
    if (inviterId === accepterId) return c.json({ success: false, error: '자신의 초대 코드는 사용할 수 없습니다' }, 400);

    // 같은 학원 검증
    const inviterAcademy = await getStudentAcademy(c.env.DB, inviterId);
    const accepterAcademy = await getStudentAcademy(c.env.DB, accepterId);
    if (!inviterAcademy || !accepterAcademy || inviterAcademy !== accepterAcademy) {
      return c.json({ success: false, error: '같은 학원 학생만 친구 추가가 가능합니다' }, 403);
    }

    // ID 정규화
    const id1 = Math.min(inviterId, accepterId);
    const id2 = Math.max(inviterId, accepterId);

    const existingFriend: any = await c.env.DB.prepare(
      'SELECT id FROM friendships WHERE student_id_1 = ? AND student_id_2 = ?'
    ).bind(id1, id2).first();
    if (existingFriend) return c.json({ success: false, error: '이미 친구입니다' }, 409);

    await c.env.DB.batch([
      c.env.DB.prepare(
        "INSERT INTO friendships (student_id_1, student_id_2, status, invited_by, invite_code, accepted_at, created_at) VALUES (?, ?, 'accepted', ?, ?, ?, ?)"
      ).bind(id1, id2, inviterId, code, now, now),
      c.env.DB.prepare('UPDATE friend_invite_codes SET use_count = use_count + 1 WHERE id = ?').bind(invite.id)
    ]);

    const friend: any = await c.env.DB.prepare('SELECT nickname, profile_emoji, school_name FROM students WHERE id = ?').bind(inviterId).first();
    return c.json({ success: true, data: { friendNickname: friend?.nickname || '익명', friendEmoji: friend?.profile_emoji || '😊' } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/student/:studentId/friends — 친구 목록
app.get('/api/student/:studentId/friends', async (c) => {
  const studentId = Number(c.req.param('studentId'));
  if (!studentId) return c.json({ success: false, error: '유효하지 않은 학생 ID입니다' }, 400);
  try {
    const result: any = await c.env.DB.prepare(
      `SELECT f.id as friendshipId,
              CASE WHEN f.student_id_1 = ? THEN f.student_id_2 ELSE f.student_id_1 END as friendStudentId,
              CASE WHEN f.student_id_1 = ? THEN s2.nickname ELSE s1.nickname END as nickname,
              CASE WHEN f.student_id_1 = ? THEN s2.profile_emoji ELSE s1.profile_emoji END as emoji,
              CASE WHEN f.student_id_1 = ? THEN s2.school_name ELSE s1.school_name END as schoolName
       FROM friendships f
       LEFT JOIN students s1 ON f.student_id_1 = s1.id
       LEFT JOIN students s2 ON f.student_id_2 = s2.id
       WHERE (f.student_id_1 = ? OR f.student_id_2 = ?) AND f.status = 'accepted'`
    ).bind(studentId, studentId, studentId, studentId, studentId, studentId).all();

    const friends = (result.results || []).map((f: any) => ({
      friendshipId: f.friendshipId, studentId: f.friendStudentId,
      nickname: f.nickname || '익명', emoji: f.emoji || '😊', schoolName: f.schoolName || ''
    }));
    return c.json({ success: true, data: { friends } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// DELETE /api/student/:studentId/friends/:friendshipId — 친구 삭제
app.delete('/api/student/:studentId/friends/:friendshipId', async (c) => {
  const studentId = Number(c.req.param('studentId'));
  const friendshipId = Number(c.req.param('friendshipId'));
  if (!studentId || !friendshipId) return c.json({ success: false, error: '유효하지 않은 ID입니다' }, 400);
  try {
    const friendship: any = await c.env.DB.prepare(
      'SELECT id FROM friendships WHERE id = ? AND (student_id_1 = ? OR student_id_2 = ?)'
    ).bind(friendshipId, studentId, studentId).first();
    if (!friendship) return c.json({ success: false, error: '친구 관계를 찾을 수 없습니다' }, 404);
    await c.env.DB.prepare('DELETE FROM friendships WHERE id = ?').bind(friendshipId).run();
    return c.json({ success: true, data: { message: '친구가 삭제되었습니다' } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==================== 커뮤니티: 닉네임 + 공유설정 ====================

// PUT /api/student/:studentId/nickname — 학생 닉네임 설정/변경
app.put('/api/student/:studentId/nickname', async (c) => {
  const studentId = Number(c.req.param('studentId'));
  if (!studentId) return c.json({ success: false, error: '유효하지 않은 학생 ID입니다' }, 400);
  try {
    const { nickname } = await c.req.json();
    if (!nickname) return c.json({ success: false, error: '닉네임을 입력해주세요' }, 400);
    const validation = validateNickname(nickname);
    if (!validation.valid) return c.json({ success: false, error: validation.error }, 400);

    const academy = await getStudentAcademy(c.env.DB, studentId);
    if (!academy) return c.json({ success: false, error: '학생 정보를 찾을 수 없습니다' }, 404);

    const trimmed = nickname.trim();
    const dup: any = await c.env.DB.prepare(
      `SELECT id FROM students WHERE nickname = ? AND id != ? AND group_id IN (SELECT g.id FROM groups g JOIN mentors m ON g.mentor_id = m.id WHERE m.academy_name = ?)
       UNION SELECT id FROM mentors WHERE nickname = ? AND academy_name = ?`
    ).bind(trimmed, studentId, academy, trimmed, academy).first();
    if (dup) return c.json({ success: false, error: '이미 사용 중인 닉네임입니다' }, 409);

    await c.env.DB.prepare('UPDATE students SET nickname = ? WHERE id = ?').bind(trimmed, studentId).run();
    return c.json({ success: true, data: { nickname: trimmed } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/student/:studentId/share-settings — 공유 설정 조회
app.get('/api/student/:studentId/share-settings', async (c) => {
  const studentId = Number(c.req.param('studentId'));
  if (!studentId) return c.json({ success: false, error: '유효하지 않은 학생 ID입니다' }, 400);
  try {
    let row: any = await c.env.DB.prepare('SELECT * FROM learning_share_settings WHERE student_id = ?').bind(studentId).first();
    if (!row) {
      const now = getKSTString();
      await c.env.DB.prepare(
        'INSERT INTO learning_share_settings (student_id, share_class_records, share_question_count, share_teach_count, share_mission_status, share_xp_level, updated_at) VALUES (?, 0, 0, 0, 0, 0, ?)'
      ).bind(studentId, now).run();
      row = await c.env.DB.prepare('SELECT * FROM learning_share_settings WHERE student_id = ?').bind(studentId).first();
    }
    return c.json({ success: true, data: {
      share_class_records: row.share_class_records, share_question_count: row.share_question_count,
      share_teach_count: row.share_teach_count, share_mission_status: row.share_mission_status,
      share_xp_level: row.share_xp_level
    }});
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// PUT /api/student/:studentId/share-settings — 공유 설정 변경
app.put('/api/student/:studentId/share-settings', async (c) => {
  const studentId = Number(c.req.param('studentId'));
  if (!studentId) return c.json({ success: false, error: '유효하지 않은 학생 ID입니다' }, 400);
  try {
    const body = await c.req.json();
    const fields = ['share_class_records', 'share_question_count', 'share_teach_count', 'share_mission_status', 'share_xp_level'];
    for (const f of fields) {
      if (body[f] !== undefined && body[f] !== 0 && body[f] !== 1) return c.json({ success: false, error: '설정 값은 0 또는 1이어야 합니다' }, 400);
    }
    const now = getKSTString();
    await c.env.DB.prepare(
      'INSERT OR REPLACE INTO learning_share_settings (student_id, share_class_records, share_question_count, share_teach_count, share_mission_status, share_xp_level, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, body.share_class_records || 0, body.share_question_count || 0, body.share_teach_count || 0, body.share_mission_status || 0, body.share_xp_level || 0, now).run();
    return c.json({ success: true, data: {
      share_class_records: body.share_class_records || 0, share_question_count: body.share_question_count || 0,
      share_teach_count: body.share_teach_count || 0, share_mission_status: body.share_mission_status || 0,
      share_xp_level: body.share_xp_level || 0
    }});
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/student/:studentId/learning-profile — 친구의 학습 프로필 조회
app.get('/api/student/:studentId/learning-profile', async (c) => {
  const targetId = Number(c.req.param('studentId'));
  const viewerId = Number(c.req.query('viewer_id'));
  if (!targetId || !viewerId) return c.json({ success: false, error: 'viewer_id가 필요합니다' }, 400);
  try {
    // 친구 관계 확인
    const id1 = Math.min(targetId, viewerId);
    const id2 = Math.max(targetId, viewerId);
    const friendship: any = await c.env.DB.prepare(
      "SELECT id FROM friendships WHERE student_id_1 = ? AND student_id_2 = ? AND status = 'accepted'"
    ).bind(id1, id2).first();
    if (!friendship) return c.json({ success: false, error: '친구만 프로필을 볼 수 있습니다' }, 403);

    const student: any = await c.env.DB.prepare('SELECT nickname, profile_emoji, school_name, grade, xp, level FROM students WHERE id = ?').bind(targetId).first();
    if (!student) return c.json({ success: false, error: '학생 정보를 찾을 수 없습니다' }, 404);

    const settings: any = await c.env.DB.prepare('SELECT * FROM learning_share_settings WHERE student_id = ?').bind(targetId).first();

    const profile: any = {
      nickname: student.nickname || '익명', profileEmoji: student.profile_emoji || '😊',
      schoolName: student.school_name || '', grade: student.grade || 1
    };

    if (settings?.share_class_records) {
      const r: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM class_records WHERE student_id = ?').bind(targetId).first();
      profile.classRecordCount = r?.cnt || 0;
    }
    if (settings?.share_question_count) {
      const r: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM question_records WHERE student_id = ?').bind(targetId).first();
      profile.questionCount = r?.cnt || 0;
    }
    if (settings?.share_teach_count) {
      const r: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM teach_records WHERE student_id = ?').bind(targetId).first();
      profile.teachCount = r?.cnt || 0;
    }
    if (settings?.share_mission_status) {
      const r: any = await c.env.DB.prepare("SELECT COUNT(*) as cnt FROM assignments WHERE student_id = ? AND status = 'completed'").bind(targetId).first();
      profile.completedAssignmentCount = r?.cnt || 0;
    }
    if (settings?.share_xp_level) {
      profile.xp = student.xp || 0;
      profile.level = student.level || 1;
    }

    return c.json({ success: true, data: profile });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// ==================== 진로 프로파일 API ====================

// GET /api/student/:id/career-profile — 진로 프로파일 조회
app.get('/api/student/:id/career-profile', async (c) => {
  const studentId = Number(c.req.param('id'))
  try {
    const row: any = await c.env.DB.prepare(
      'SELECT id, student_id, test_provider, test_date, top_departments, dream_department, field_profile, major_profile, career_advice, careers, pdf_r2_key, parse_status, created_at, updated_at FROM career_profiles WHERE student_id = ?'
    ).bind(studentId).first()
    if (!row) return c.json({ success: true, data: null })

    // JSON 문자열 필드 파싱
    const data = {
      ...row,
      top_departments: JSON.parse(row.top_departments || '[]'),
      dream_department: JSON.parse(row.dream_department || '{}'),
      field_profile: JSON.parse(row.field_profile || '{}'),
      major_profile: JSON.parse(row.major_profile || '{}'),
      careers: JSON.parse(row.careers || '[]'),
    }
    return c.json({ success: true, data })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST /api/student/:id/career-profile/upload — PDF 업로드 → R2 저장 → Gemini 이미지 파싱 → DB 저장
app.post('/api/student/:id/career-profile/upload', async (c) => {
  const studentId = Number(c.req.param('id'))
  try {
    const { pdfBase64, pageImages } = await c.req.json()
    if (!pageImages || !Array.isArray(pageImages) || pageImages.length === 0) {
      return c.json({ success: false, error: 'PDF 페이지 이미지가 필요합니다' }, 400)
    }

    const proxySecret = c.env.AI_PROXY_SECRET
    if (!proxySecret) return c.json({ success: false, error: 'AI 프록시 설정이 되지 않았습니다' }, 500)
    const externalId = await getExternalUserId(c.env.DB, studentId)

    // 1. R2에 원본 PDF 저장
    let pdfR2Key = ''
    if (pdfBase64 && c.env.R2) {
      try {
        const rawBase64 = pdfBase64.replace(/^data:application\/pdf;base64,/, '')
        pdfR2Key = `career_profiles/${studentId}/${Date.now()}.pdf`
        const binary = Uint8Array.from(atob(rawBase64), ch => ch.charCodeAt(0))
        await c.env.R2.put(pdfR2Key, binary, { httpMetadata: { contentType: 'application/pdf' } })
      } catch (e) {
        console.error('Career PDF R2 upload failed:', e)
        pdfR2Key = ''
      }
    }

    // 2. 페이지 이미지 → Gemini Vision으로 파싱 (프록시 경유)
    let parsedData: any = null
    try {
      const images = pageImages.map((img: string) => ({ mime_type: 'image/jpeg', data: img }))
      const rawText = await callProxyGemini({
        proxySecret, prompt: CAREER_PDF_PARSE_PROMPT, images,
        jsonMode: true, temperature: 0.1, maxTokens: 8192, timeoutMs: 90000,
        externalId, task: 'career-profile',
      })
      parsedData = JSON.parse(cleanJsonResponse(rawText))
    } catch (parseErr: any) {
      console.error('Career PDF parse error:', parseErr)
      // 파싱 실패해도 DB에 pending으로 저장
      await c.env.DB.prepare(
        `INSERT INTO career_profiles (student_id, pdf_r2_key, parse_status, updated_at) VALUES (?, ?, 'failed', datetime('now','+9 hours'))
         ON CONFLICT(student_id) DO UPDATE SET pdf_r2_key = excluded.pdf_r2_key, parse_status = 'failed', updated_at = datetime('now','+9 hours')`
      ).bind(studentId, pdfR2Key || null).run()
      return c.json({ success: false, error: `PDF 파싱 실패: ${parseErr.message}` }, 500)
    }

    // 3. DB 저장 (UPSERT)
    await c.env.DB.prepare(
      `INSERT INTO career_profiles (student_id, test_provider, test_date, raw_data, top_departments, dream_department, field_profile, major_profile, career_advice, careers, pdf_r2_key, parse_status, updated_at)
       VALUES (?, 'aptifit', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'success', datetime('now','+9 hours'))
       ON CONFLICT(student_id) DO UPDATE SET
         test_date = excluded.test_date,
         raw_data = excluded.raw_data,
         top_departments = excluded.top_departments,
         dream_department = excluded.dream_department,
         field_profile = excluded.field_profile,
         major_profile = excluded.major_profile,
         career_advice = excluded.career_advice,
         careers = excluded.careers,
         pdf_r2_key = excluded.pdf_r2_key,
         parse_status = 'success',
         updated_at = datetime('now','+9 hours')`
    ).bind(
      studentId,
      parsedData.test_date || null,
      JSON.stringify(parsedData),
      JSON.stringify(parsedData.top_departments || []),
      JSON.stringify(parsedData.dream_department || {}),
      JSON.stringify(parsedData.field_profile || {}),
      JSON.stringify(parsedData.major_profile || {}),
      parsedData.career_advice || '',
      JSON.stringify(parsedData.careers || []),
      pdfR2Key || null
    ).run()

    return c.json({ success: true, data: parsedData })
  } catch (e: any) {
    console.error('Career profile upload error:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST /api/student/:id/career-profile/update — 멘토가 파싱 결과 수동 수정
app.post('/api/student/:id/career-profile/update', async (c) => {
  const studentId = Number(c.req.param('id'))
  try {
    const body = await c.req.json()
    const {
      test_date, top_departments, dream_department,
      field_profile, major_profile, career_advice, careers
    } = body

    const existing: any = await c.env.DB.prepare(
      'SELECT id FROM career_profiles WHERE student_id = ?'
    ).bind(studentId).first()
    if (!existing) return c.json({ success: false, error: '진로 프로파일이 없습니다. 먼저 PDF를 업로드하세요.' }, 404)

    await c.env.DB.prepare(
      `UPDATE career_profiles SET
        test_date = COALESCE(?, test_date),
        top_departments = COALESCE(?, top_departments),
        dream_department = COALESCE(?, dream_department),
        field_profile = COALESCE(?, field_profile),
        major_profile = COALESCE(?, major_profile),
        career_advice = COALESCE(?, career_advice),
        careers = COALESCE(?, careers),
        updated_at = datetime('now','+9 hours')
      WHERE student_id = ?`
    ).bind(
      test_date || null,
      top_departments ? JSON.stringify(top_departments) : null,
      dream_department ? JSON.stringify(dream_department) : null,
      field_profile ? JSON.stringify(field_profile) : null,
      major_profile ? JSON.stringify(major_profile) : null,
      career_advice || null,
      careers ? JSON.stringify(careers) : null,
      studentId
    ).run()

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})


// ==================== 시간표 사진 → 과목 자동 등록 API ====================

// GET /api/student/:id/semesters — 전체 학기 목록
app.get('/api/student/:id/semesters', async (c) => {
  const studentId = Number(c.req.param('id'))
  try {
    const { results } = await c.env.DB.prepare(
      'SELECT id, year, term, created_at FROM semesters WHERE student_id = ? ORDER BY year DESC, term DESC'
    ).bind(studentId).all()
    return c.json({ success: true, data: results || [] })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// GET /api/student/:id/subjects?year=2026&term=1 — 해당 학기 과목 목록
app.get('/api/student/:id/subjects', async (c) => {
  const studentId = Number(c.req.param('id'))
  const year = Number(c.req.query('year'))
  const term = Number(c.req.query('term'))
  try {
    const semester: any = await c.env.DB.prepare(
      'SELECT id FROM semesters WHERE student_id = ? AND year = ? AND term = ?'
    ).bind(studentId, year, term).first()
    if (!semester) return c.json({ success: true, data: { subjects: [], slots: [] } })

    const { results: subjects } = await c.env.DB.prepare(
      'SELECT id, name, teacher FROM subjects WHERE semester_id = ? ORDER BY name'
    ).bind(semester.id).all()

    const { results: slots } = await c.env.DB.prepare(
      'SELECT id, subject_id, day_of_week, period FROM timetable_slots WHERE semester_id = ? ORDER BY day_of_week, period'
    ).bind(semester.id).all()

    return c.json({ success: true, data: { semesterId: semester.id, subjects: subjects || [], slots: slots || [] } })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST /api/student/:id/timetable/photo — 시간표 사진 분석 (Gemini Vision)
app.post('/api/student/:id/timetable/photo', async (c) => {
  const studentId = Number(c.req.param('id'))
  try {
    const body = await c.req.json()
    const { imageBase64, mimeType = 'image/jpeg', year, term } = body
    if (!imageBase64) return c.json({ success: false, error: '이미지가 없습니다' }, 400)

    const currentYear = year || new Date(Date.now() + 9 * 3600000).getFullYear()
    const currentTerm = term || (new Date(Date.now() + 9 * 3600000).getMonth() < 7 ? 1 : 2)

    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '')

    const prompt = `당신은 한국 고등학교 시간표 분석 전문가입니다.

이 시간표 사진을 분석하여 아래 JSON 형식으로 정확히 추출해주세요.

처리 규칙:
1. 과목명, 요일(1=월~5=금), 교시(1~7), 담당 교사명을 추출
2. 고교학점제 특성상 학생마다 과목이 다름 — 보이는 그대로 추출
3. 교사명이 없는 칸은 teacher: null
4. 빈 칸(자습/공강)은 포함하지 말 것
5. 과목명은 정확히 (예: "생명과학Ⅱ", "미적분", "화학Ⅰ")

반드시 아래 JSON만 출력:
{
  "slots": [
    { "subject": "과목명", "teacher": "교사명 또는 null", "day_of_week": 1, "period": 1 }
  ]
}`

    // Gemini → OpenAI 폴백으로 시간표 분석 (프록시 경유)
    let aiText = '{}'
    const imageData = [{ mime_type: mimeType, data: cleanBase64 }]
    const externalId = await getExternalUserId(c.env.DB, studentId)

    // 1차: Gemini Vision
    try {
      aiText = await callProxyGemini({
        proxySecret: c.env.AI_PROXY_SECRET,
        prompt, images: imageData, jsonMode: true, temperature: 0.1,
        externalId, task: 'timetable-photo',
      })
    } catch (geminiErr: any) {
      console.error('Gemini Vision failed, trying OpenAI:', geminiErr.message)

      // 2차: OpenAI GPT-4o Vision 폴백
      try {
        aiText = await callProxyOpenAI({
          proxySecret: c.env.AI_PROXY_SECRET,
          prompt, images: imageData, jsonMode: true, temperature: 0.1, timeoutMs: 300000,
          externalId, task: 'timetable-photo',
        })
      } catch (openaiErr: any) {
        console.error('OpenAI Vision error:', openaiErr.message)
        return c.json({ success: false, error: 'AI 분석 실패 (Gemini+OpenAI 모두 실패)' }, 500)
      }
    }

    // JSON 파싱 (```json 블록 제거)
    let parsed: any
    try {
      parsed = JSON.parse(cleanJsonResponse(aiText))
    } catch {
      return c.json({ success: false, error: 'AI 응답 파싱 실패', raw: aiText }, 500)
    }

    const slots = parsed.slots || []
    if (!slots.length) return c.json({ success: false, error: '시간표에서 과목을 찾지 못했습니다' }, 400)

    // 분석 결과만 반환 (저장은 confirm API에서)
    return c.json({
      success: true,
      data: {
        year: currentYear,
        term: currentTerm,
        slots,
        subjectList: [...new Set(slots.map((s: any) => s.subject))]
      }
    })
  } catch (e: any) {
    console.error('Timetable photo error:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

// POST /api/student/:id/timetable/confirm — 분석 결과 확인 후 DB 저장
app.post('/api/student/:id/timetable/confirm', async (c) => {
  const studentId = Number(c.req.param('id'))
  try {
    const body = await c.req.json()
    const { year, term, slots } = body
    if (!year || !term || !slots?.length) return c.json({ success: false, error: '필수 데이터 누락' }, 400)

    const DB = c.env.DB

    // 1) semester upsert (동일 학기 있으면 기존 데이터 삭제 후 재등록)
    let semester: any = await DB.prepare(
      'SELECT id FROM semesters WHERE student_id = ? AND year = ? AND term = ?'
    ).bind(studentId, year, term).first()

    if (semester) {
      await DB.prepare('DELETE FROM timetable_slots WHERE semester_id = ?').bind(semester.id).run()
      await DB.prepare('DELETE FROM subjects WHERE semester_id = ?').bind(semester.id).run()
    } else {
      const ins = await DB.prepare(
        'INSERT INTO semesters (student_id, year, term) VALUES (?, ?, ?)'
      ).bind(studentId, year, term).run()
      semester = { id: ins.meta.last_row_id }
    }

    const semesterId = semester.id

    // 2) 고유 과목 추출 및 저장
    const uniqueSubjects = new Map<string, string | null>()
    for (const s of slots) {
      if (!uniqueSubjects.has(s.subject)) {
        uniqueSubjects.set(s.subject, s.teacher || null)
      }
    }

    const subjectIdMap = new Map<string, number>()
    for (const [name, teacher] of uniqueSubjects) {
      const res = await DB.prepare(
        'INSERT INTO subjects (semester_id, name, teacher) VALUES (?, ?, ?)'
      ).bind(semesterId, name, teacher).run()
      subjectIdMap.set(name, res.meta.last_row_id as number)
    }

    // 3) 시간표 슬롯 저장
    for (const s of slots) {
      const subjectId = subjectIdMap.get(s.subject)
      if (!subjectId) continue
      await DB.prepare(
        'INSERT OR REPLACE INTO timetable_slots (semester_id, subject_id, day_of_week, period) VALUES (?, ?, ?, ?)'
      ).bind(semesterId, subjectId, s.day_of_week, s.period).run()
    }

    // 4) 저장된 과목 목록 반환
    const { results: savedSubjects } = await DB.prepare(
      'SELECT id, name, teacher FROM subjects WHERE semester_id = ? ORDER BY name'
    ).bind(semesterId).all()

    return c.json({
      success: true,
      data: { semesterId, year, term, subjects: savedSubjects || [], slotCount: slots.length }
    })
  } catch (e: any) {
    console.error('Timetable confirm error:', e)
    return c.json({ success: false, error: e.message }, 500)
  }
})

// ==================== 크로켓 포인트 API ====================

// 학생 포인트 잔액 + 최근 이력
app.get('/api/student/:studentId/croquet-points', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const student: any = await c.env.DB.prepare('SELECT croquet_balance FROM students WHERE id = ?').bind(studentId).first();
    const balance = student?.croquet_balance || 0;
    return c.json({ balance });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 학생 포인트 히스토리
app.get('/api/student/:studentId/croquet-points/history', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const limit = parseInt(c.req.query('limit') || '50');
    const offset = parseInt(c.req.query('offset') || '0');

    const [history, total] = await Promise.all([
      c.env.DB.prepare(
        'SELECT cp.*, m.name as mentor_name FROM croquet_points cp LEFT JOIN mentors m ON cp.mentor_id = m.id WHERE cp.student_id = ? ORDER BY cp.created_at DESC LIMIT ? OFFSET ?'
      ).bind(studentId, limit, offset).all(),
      c.env.DB.prepare('SELECT COUNT(*) as cnt FROM croquet_points WHERE student_id = ?').bind(studentId).first(),
    ]);

    const student: any = await c.env.DB.prepare('SELECT croquet_balance FROM students WHERE id = ?').bind(studentId).first();

    return c.json({
      balance: student?.croquet_balance || 0,
      history: history.results,
      total: (total as any)?.cnt || 0,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// ==================== QA앱 외부 인증 토큰 발급 ====================
// 플래너에서 QA앱으로 자동 로그인하기 위한 서명 생성
app.post('/api/qa-auth-token', async (c) => {
  try {
    const { studentId } = await c.req.json()
    if (!studentId) return c.json({ error: 'studentId 필수' }, 400)

    // 학생 정보 조회
    const student: any = await c.env.DB.prepare('SELECT id, name FROM students WHERE id = ?').bind(studentId).first()
    if (!student) return c.json({ error: '학생을 찾을 수 없습니다' }, 404)

    const timestamp = Date.now().toString()
    const userId = String(studentId)

    // QA_APP_SECRET이 설정되어 있으면 HMAC 서명 생성
    const secret = c.env.QA_APP_SECRET
    let signature = ''
    if (secret) {
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey(
        'raw', encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
      )
      const data = encoder.encode(`${userId}:${timestamp}`)
      const sig = await crypto.subtle.sign('HMAC', key, data)
      signature = [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('')
    }

    return c.json({
      success: true,
      userId,
      nickName: student.name,
      timestamp,
      signature,
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ==================== 창체 활동 AI 분석 (진로/동아리/자율/봉사/독서) ====================

const ACTIVITY_PROMPTS: Record<string, string> = {
  career: `당신은 고교학점제 전문가이자 진로 멘토입니다.
학생이 작성한 "진로활동 성찰일지" 사진을 OCR 인식하여 구조화합니다.

[양식 구조]
- 헤더: 이름, 학년·반, 날짜, 활동명
- 활동 유형: 진로검사/진로상담/진로특강/진로체험/진로수업/자율탐구/학습 특색활동 중 체크된 항목
- 활동 내용 요약: 무엇을 했나요?
- 알게 된 점: 새롭게 알게 된 개념이나 정보
- 느낀 점 / 성찰: 이 활동이 나에게 어떤 의미였나요?
- 변화된 점: 생각·태도의 변화
- 후속 계획: 앞으로 무엇을 할 건가요?
- 생긴 질문: 더 알고 싶어진 것 (1, 2)

[OCR 규칙]
- 학생의 원문 내용을 최대한 살리되, 읽기 쉽게 문장을 정돈
- 내용을 임의로 추가하거나 변경하지 말 것
- 인식이 어려운 부분은 [판독 불가] 표시
- 내용이 없는 섹션은 빈값 유지 (임의 생성 금지)

[추가 분석: 세특 관찰 코멘트]
- 진로 탐색의 자기주도성, 진로 성숙도, 활동과 진로 연결 수준을 분석
- 학교생활기록부 진로활동 세특에 직접 참고할 수 있는 관찰 코멘트 (200~300자)
- 객관적이고 전문적인 톤, 구체적인 활동 내용을 근거로 작성

반드시 아래 JSON 형식으로만 응답:
{
  "student_name": "인식된 학생 이름",
  "grade_class": "인식된 학년·반",
  "date": "인식된 날짜",
  "activity_name": "활동명",
  "activity_subtype": "체크된 활동 유형",
  "summary": "활동 내용 요약",
  "learned": "알게 된 점",
  "reflection": "느낀 점 / 성찰",
  "changed": "변화된 점",
  "next_plan": "후속 계획",
  "questions": ["생긴 질문 1", "생긴 질문 2"],
  "teacher_insight": "세특 관찰 코멘트 (200~300자)",
  "rawOcrText": "사진에서 인식한 전체 텍스트 원본"
}`,

  club: `당신은 고교학점제 전문가이자 동아리 활동 멘토입니다.
학생이 작성한 "동아리 활동일지" 사진을 OCR 인식하여 구조화합니다.

[양식 구조]
- 헤더: 동아리명, 회차, 활동일자, 활동시간, 활동장소, 지도교사, 대표학생, 활동주제, 참석인원/참석자
- 활동 내용: 활동 과정, 각 구성원의 역할, 사용한 자료 등을 구체적으로 기록
- 활동 결과: 활동을 통해 얻은 결과물, 발견한 사실, 새롭게 알게 된 점 등
- 활동 소감 및 성찰: 느낀 점, 배운 점, 개선할 점, 진로와의 연계성 등
- 궁금한 점: 더 탐구하고 싶은 것 — 세특 소재로 연결됩니다 (1, 2)
- 차기 활동 계획: 다음 활동 주제, 준비사항 등

[OCR 규칙]
- 학생의 원문 내용을 최대한 살리되, 읽기 쉽게 문장을 정돈
- 내용을 임의로 추가하거나 변경하지 말 것
- 인식이 어려운 부분은 [판독 불가] 표시
- 내용이 없는 섹션은 빈값 유지 (임의 생성 금지)

[추가 분석: 세특 관찰 코멘트]
- 동아리 활동에서 보이는 자기주도성, 협업 역량, 탐구 태도를 분석
- 학교생활기록부 동아리활동 세특에 직접 참고할 수 있는 관찰 코멘트 (200~300자)
- 객관적이고 전문적인 톤, 구체적인 활동 내용을 근거로 작성

반드시 아래 JSON 형식으로만 응답:
{
  "club_name": "동아리명",
  "session_number": "회차",
  "activity_date": "활동일자",
  "activity_time": "활동시간",
  "activity_place": "활동장소",
  "advisor": "지도교사",
  "representative": "대표학생",
  "topic": "활동주제",
  "attendance": "참석인원/참석자",
  "content": "활동 내용",
  "result": "활동 결과",
  "reflection": "활동 소감 및 성찰",
  "questions": ["궁금한 점 1", "궁금한 점 2"],
  "next_plan": "차기 활동 계획",
  "teacher_insight": "세특 관찰 코멘트 (200~300자)",
  "rawOcrText": "사진에서 인식한 전체 텍스트 원본"
}`,

  general: `당신은 고교학점제 전문가이자 학생 활동 멘토입니다.
학생이 촬영한 활동 사진을 분석하여 구조화합니다.

[작업]
1. 사진에서 보이는 활동 내용을 상세히 분석 (손글씨가 있으면 OCR 인식)
2. 활동의 핵심 내용과 학생의 역할을 파악
3. 세특 기록에 활용할 수 있는 관찰 코멘트 생성

[OCR 규칙]
- 학생의 원문 내용을 최대한 살리되, 읽기 쉽게 문장을 정돈
- 내용을 임의로 추가하거나 변경하지 말 것
- 인식이 어려운 부분은 [판독 불가] 표시

반드시 아래 JSON 형식으로만 응답:
{
  "student_name": "인식된 학생 이름 (없으면 빈값)",
  "date": "인식된 날짜 (없으면 빈값)",
  "activity_name": "활동명 (없으면 빈값)",
  "summary": "활동 내용 요약",
  "reflection": "활동 소감/성찰 (인식된 경우)",
  "questions": ["활동에서 생긴 질문"],
  "next_plan": "후속 계획 (인식된 경우)",
  "teacher_insight": "세특 관찰 코멘트 (200~300자)",
  "rawOcrText": "사진에서 인식한 전체 텍스트 원본"
}`
}

app.post('/api/ai/activity-analyze', async (c) => {
  try {
    const { photos, activityType, comment, studentId } = await c.req.json<{
      photos: string[],
      activityType: string,
      comment?: string,
      studentId?: number
    }>()

    if (!photos || photos.length === 0) return c.json({ error: '사진이 필요합니다.' }, 400)

    // 진로 프로파일 컨텍스트 로드
    const careerCtx = studentId ? await getStudentCareerContext(c.env.DB, Number(studentId)) : ''

    const promptTemplate = ACTIVITY_PROMPTS[activityType] || ACTIVITY_PROMPTS.general
    const promptText = `${promptTemplate}${careerCtx}\n\n---\n활동 유형: ${activityType}\n${comment ? `학생 소감: ${comment}\n` : ''}위 JSON 형식으로만 응답하세요.`

    const parts: any[] = [{ text: promptText }]
    const imageDataList: { mime_type: string, data: string }[] = []

    for (const photo of photos) {
      const match = photo.match(/^data:(image\/\w+);base64,(.+)$/)
      if (match) {
        imageDataList.push({ mime_type: match[1], data: match[2] })
        parts.push({ inline_data: { mime_type: match[1], data: match[2] } })
      }
    }

    let rawText = '{}'
    let aiSource = 'gemini'
    const proxySecret = c.env.AI_PROXY_SECRET
    const externalId = studentId ? await getExternalUserId(c.env.DB, Number(studentId)) : undefined

    // Step 1: Gemini → Step 2: OpenAI → Step 3: Claude (프록시 경유)
    try {
      rawText = await callProxyGemini({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, externalId, task: 'activity-analyze' })
    } catch (geminiErr) {
      console.log('Activity AI: Gemini fail, OpenAI fallback:', geminiErr)
      aiSource = 'openai'
      try {
        rawText = await callProxyOpenAI({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, timeoutMs: 300000, externalId, task: 'activity-analyze' })
      } catch (openaiErr) {
        console.log('Activity AI: OpenAI fail, Claude fallback:', openaiErr)
        aiSource = 'claude'
        try {
          rawText = await callProxyClaude({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, timeoutMs: 300000, externalId, task: 'activity-analyze' })
        } catch (claudeErr) {
          return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.', detail: 'all_ai_failed' }, 500)
        }
      }
    }

    let result: any
    try { result = JSON.parse(cleanJsonResponse(rawText)) } catch {
      return c.json({ error: '분석 결과를 파싱할 수 없습니다. 사진을 다시 확인해주세요.', raw: rawText }, 500)
    }

    return c.json({ success: true, activityType, aiSource, ...result })
  } catch (e: any) {
    console.log('Activity AI error:', e)
    return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.' }, 500)
  }
})


// ==================== 아하 리포트 v2 AI 분석 (5섹션: SA/PA/DA/POA/PPA) ====================
app.post('/api/aha-report/analyze-v2', async (c) => {
  try {
    const { photos, subject, source, date, studentId } = await c.req.json<{
      photos: string[],
      subject?: string,
      source?: string,
      date?: string,
      studentId?: number
    }>()

    if (!photos || photos.length === 0) return c.json({ error: '사진이 필요합니다.' }, 400)
    if (photos.length > 3) return c.json({ error: '사진은 최대 3장까지 가능합니다.' }, 400)

    // 진로 프로파일 컨텍스트 로드
    const careerCtx = studentId ? await getStudentCareerContext(c.env.DB, Number(studentId)) : ''

    const systemPrompt = `당신은 고교학점제 전문가이자 학생들의 학습 멘토입니다.
학생이 작성한 아하 리포트(AHA-Report) 사진을 분석합니다.

[작업] 사진에서 손글씨를 OCR 인식하여 다음 5개 섹션으로 정리해주세요:

1. SA (문제상황): 학생이 발견한 문제 또는 궁금증. 원문을 최대한 살려 정리.
2. PA (탐구질문): 학생이 제기한 질문들을 배열로 추출. 각 질문은 독립된 문장으로.
3. DA (탐구과정 & 결론): 탐구 방법과 결론을 정리. 번호가 있으면 번호별로 구분.
4. POA (아하포인트): 깨달음, 발견, 발전 방향을 정리.
5. PPA (성찰): 탐구 전후 생각의 변화와 부족했던 점을 정리.

OCR 규칙:
- 학생의 원문 내용을 최대한 살리되, 읽기 쉽게 문장을 정돈
- 내용을 임의로 추가하거나 변경하지 말 것
- 인식이 어려운 부분은 [판독 불가] 표시
- 내용이 없는 섹션은 빈값 유지 (임의 생성 금지)

수식 처리 규칙 (절대 예외 없음):
- 사칙연산, 거듭제곱(x² → $x^2$), 분수(a/b → $\\frac{a}{b}$), 루트(√x → $\\sqrt{x}$) 등 모든 수학적 표현을 LaTeX로 변환
- 방정식: ax²+bx+c=0 → $ax^2+bx+c=0$
- 함수: f(x), sin, cos, log → $f(x)$, $\\sin(x)$, $\\cos(x)$, $\\log(x)$
- 극한($\\lim$), 적분($\\int$), 벡터($\\vec{a}$), 집합($\\in$, $\\cup$, $\\cap$), 부등호($\\leq$, $\\geq$), 그리스 문자($\\alpha$, $\\beta$, $\\theta$, $\\pi$) 포함
- 인라인: $수식$, 블록: $$수식$$
- 텍스트에서 수학적 표현이 보이면 무조건 LaTeX으로 변환. 절대 일반 텍스트로 수식 출력 금지

반드시 아래 JSON 형식으로만 응답:
{
  "sa": "문제상황 정리 내용",
  "pa": ["탐구질문1", "탐구질문2"],
  "da": "탐구과정 & 결론 정리 내용",
  "poa": "아하포인트 정리 내용",
  "ppa": { "change": "전후 생각 변화", "lacking": "부족했던 것" },
  "subject_detected": "인식된 과목명",
  "student_name": "인식된 학생 이름"
}`

    const promptText = `${systemPrompt}${careerCtx}\n\n---\n과목: ${subject || '미선택'}\n출처: ${source || '미입력'}\n날짜: ${date || '미입력'}`
    const parts: any[] = [{ text: promptText }]

    const imageDataList: { mime_type: string, data: string }[] = []
    for (const photo of photos) {
      const match = photo.match(/^data:(image\/\w+);base64,(.+)$/)
      if (match) {
        imageDataList.push({ mime_type: match[1], data: match[2] })
        parts.push({ inline_data: { mime_type: match[1], data: match[2] } })
      }
    }

    let rawText = '{}'
    let aiSource = 'gemini'
    const proxySecret = c.env.AI_PROXY_SECRET
    const externalId = studentId ? await getExternalUserId(c.env.DB, Number(studentId)) : undefined

    // Step 1: Gemini → Step 2: OpenAI → Step 3: Claude (프록시 경유)
    try {
      rawText = await callProxyGemini({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, externalId, task: 'aha-report-v2' })
    } catch (geminiErr) {
      console.log('Gemini 실패 (v2), OpenAI 폴백:', geminiErr)
      aiSource = 'openai'
      try {
        rawText = await callProxyOpenAI({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, timeoutMs: 300000, externalId, task: 'aha-report-v2' })
      } catch (openaiErr) {
        console.log('OpenAI 실패 (v2), Claude 폴백:', openaiErr)
        aiSource = 'claude'
        try {
          rawText = await callProxyClaude({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, timeoutMs: 300000, externalId, task: 'aha-report-v2' })
        } catch (claudeErr) {
          return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.', detail: 'all_ai_failed' }, 500)
        }
      }
    }

    let result: any
    try {
      result = JSON.parse(cleanJsonResponse(rawText))
    } catch {
      return c.json({ error: '분석 결과를 파싱할 수 없습니다. 사진을 다시 확인해주세요.', raw: rawText }, 500)
    }

    if (!result.sa && !result.da && !result.poa) {
      return c.json({
        error: '사진이 잘 안 읽혔어요. 밝은 곳에서 다시 찍어보세요.',
        result
      }, 422)
    }

    return c.json({
      success: true,
      sa: result.sa || '',
      pa: Array.isArray(result.pa) ? result.pa : [],
      da: result.da || '',
      poa: result.poa || '',
      ppa: result.ppa || { change: '', lacking: '' },
      subject_detected: result.subject_detected || null,
      student_name: result.student_name || null,
      ai_source: aiSource
    })
  } catch (e: any) {
    console.log('AHA Report analyze-v2 error:', e)
    return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.' }, 500)
  }
})

// ==================== 아하 리포트 v2 피드백 (Claude Sonnet 4.6) ====================
app.post('/api/aha-report/feedback', async (c) => {
  try {
    const { sa, pa, da, poa, ppa, subject, studentName } = await c.req.json<{
      sa: string, pa: string[], da: string, poa: string,
      ppa: { change?: string, lacking?: string }, subject?: string, studentName?: string
    }>()

    const paJoined = Array.isArray(pa) ? pa.join('\n- ') : String(pa || '')

    const systemPrompt = `당신은 **고등학교 탐구보고서 코치이자 고교학점제 평가 전문가**입니다.
역할은 학생이 AHA 탐구보고서에 작성한 내용을 읽고,
어떤 과목이든지 적용 가능한 **탐구 역량(질문–과정–근거–성찰)** 기준으로
구체적이고 따뜻한 피드백을 제공하는 것입니다.

#### 1. 당신의 기본 역할

- 특정 과목의 세부 내용 전문가가 아니라, **탐구 방법·사고력·글쓰기 구조·고교학점제 평가 관점**의 전문가입니다.
- 보고서를 **정답/오답 채점**하려고 하지 말고, 학생이 보여준 **생각의 과정과 성장 가능성**을 읽어내는 데 초점을 둡니다.
- 학생이 위축되지 않도록, 항상 **강점을 먼저 구체적으로 칭찬**하고, 이후에 **한 단계 더 성장할 수 있는 개선 방향**을 제안합니다.
- 피드백은 학교 수행평가·세특·생기부에 활용해도 어색하지 않을 수준의 **논리성과 품위**를 유지하되, 말투는 사람 선생님처럼 **자연스럽고 따뜻하게** 유지합니다.

#### 2. 평가·피드백의 네 가지 핵심 기준

피드백을 줄 때, 반드시 아래 네 영역을 기준으로 생각하고, 각 영역에 대해 코멘트를 해 주세요.
모든 과목(국어·영어·수학·과학·사회·예체능·융합 등)에 공통으로 적용합니다.

1) **문제 인식·질문 설정**
- 수업·과제·시험·생활 경험 등 구체적인 문제 상황이 보고서에 드러나는가?
- 단순한 주제 나열이 아니라, 학생이 스스로 던진 명확한 질문·목표가 적혀 있는가?
- "왜 이 주제를 택했는지, 무엇이 궁금했는지"가 읽는 사람에게 분명하게 전달되는가?

2) **자료 조사·탐구 과정**
- 어떤 자료와 활동을 활용했는지 출처와 방식이 드러나는가?
- 자료와 활동을 단순 나열하지 않고, 비교, 분류, 패턴 찾기, 가설 설정·수정, 모형 만들기 등 생각의 과정이 보이는가?

3) **근거 기반 분석·결론**
- 학생의 주장·결론이 수집한 근거와 논리에 의해 뒷받침되는가?
- 단순 정리·요약을 넘어서 자기만의 해석·패턴·원인 분석을 시도했는가?

4) **성찰·확장(공부법·생활·진로 연결)**
- 탐구 전과 후를 비교했을 때, 학생의 생각·태도·공부 방법이 어떻게 달라졌는지 서술되어 있는가?
- 이번 탐구 경험을 앞으로의 학습 전략, 과목 선택, 동아리 활동, 진로 탐색과 연결해 보려는 시도가 있는가?

#### 3. 말투와 태도

- 학생 이름 정보가 있으면, **이름을 불러 주며 친근하게** 시작합니다.
  예: "성현아, 이번 AHA 탐구보고서 정말 재미있게 잘 읽었어."
- 항상 **잘한 점부터**, 그리고 **구체적인 근거**를 들어 칭찬합니다.
  학생이 실제로 쓴 문장·시도·자료를 언급하며 "이 부분을 이렇게 쓴 건 정말 좋았다"라고 설명합니다.
- 개선이 필요한 부분은 **비판이 아니라 제안**의 형식으로 말합니다.
- 학생의 수준을 가정하지 말고, 지금 보고서에서 보이는 행동과 표현만을 근거로 판단합니다.
- 과목 특수 용어를 과하게 사용하기보다, 탐구 방법·글쓰기 측면의 언어를 중심으로 설명합니다.

#### 4. 피드백 구성 형식

1) **도입 + 전체 인상 한 줄** — 학생 이름을 부르며, 보고서를 읽고 느낀 전체 인상을 짧게 말합니다.
2) **잘한 점 2–4가지** — 네 가지 핵심 기준 중에서 특히 잘한 부분을 골라, 학생 글의 내용을 인용·요약하며 칭찬합니다.
3) **더 깊은 탐구로 업그레이드할 포인트 2–4가지** — 구체적인 행동 제안으로 작성합니다. (질문 다듬기, 자료 확장, 분석 기준·표 만들기, 근거-결론 연결 강화, 성찰·다음 단계 쓰기 등)
4) **마무리 응원 한 단락** — 잘하고 있는 부분을 다시 짚고, 다음 AHA 탐구에서 도전해 볼 구체적인 다음 목표를 제안합니다.

#### 5. 세부 주의사항

- 학생을 평가할 때 과목 점수·성적 수준을 추측하거나 언급하지 않습니다.
- 내용이 다소 부정확하더라도, 먼저 탐구하려는 시도와 사고 과정을 인정한 뒤, 수정 방향과 참고할 수 있는 행동을 제안합니다.
- 목표는 "학생 보고서를 더 깊이 있는 탐구 경험으로 성장시키는 것"입니다.

#### 6. 출력 형식 규칙
- 반드시 순수 텍스트(plain text)로만 작성. 마크다운 문법 절대 금지 (##, **, *, ---, \`\`\`, > 등 사용 금지)
- 이모지, 이모티콘, 특수 장식 문자 절대 사용 금지 (😊, ✅, 🚀, 💬, 🔋 등 모두 불가)
- 구조는 줄바꿈과 번호/들여쓰기로만 표현
- 섹션 구분은 빈 줄 하나로만 처리 (--- 금지)

반드시 아래 JSON 형식으로만 응답하세요:
{
  "feedback": "피드백 전체 텍스트 (순수 텍스트만, 마크다운/이모지 절대 금지)"
}`

    const userPrompt = `[학생 AHA 탐구보고서 데이터]
학생 이름: ${studentName || '(미입력)'}
과목: ${subject || '미입력'}

SA (문제상황):
${sa || '(비어있음)'}

PA (탐구질문):
- ${paJoined || '(비어있음)'}

DA (탐구과정 & 결론):
${da || '(비어있음)'}

POA (아하포인트):
${poa || '(비어있음)'}

PPA (성찰):
- 전후 변화: ${ppa?.change || '(비어있음)'}
- 부족했던 점: ${ppa?.lacking || '(비어있음)'}

위 보고서 내용을 바탕으로 피드백을 작성해주세요. 반드시 JSON 형식으로만 응답하세요.`

    let rawText = '{}'
    let aiSource = 'claude'
    const proxySecret = c.env.AI_PROXY_SECRET

    // Step 1: Claude → Step 2: Gemini (프록시 경유)
    try {
      rawText = await callProxyClaude({ proxySecret, systemPrompt, prompt: userPrompt, jsonMode: true, temperature: 0.5, timeoutMs: 300000, task: 'aha-feedback' })
    } catch (claudeErr) {
      console.log('Claude feedback 실패, Gemini로 폴백:', claudeErr)
      aiSource = 'gemini'
      try {
        rawText = await callProxyGemini({ proxySecret, prompt: systemPrompt + '\n\n' + userPrompt, jsonMode: true, temperature: 0.5, timeoutMs: 300000, task: 'aha-feedback' })
      } catch (geminiErr) {
        console.log('Gemini feedback fallback error:', geminiErr)
        return c.json({ error: '피드백 생성에 실패했어요. 다시 시도해주세요.', detail: 'all_ai_failed' }, 500)
      }
    }

    let result: any
    try {
      // Claude가 JSON 코드블록으로 감싸서 반환할 수 있으므로 정리
      const cleaned = rawText.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
      result = JSON.parse(cleaned)
    } catch {
      return c.json({ error: '피드백 결과를 파싱할 수 없습니다.', raw: rawText }, 500)
    }

    return c.json({
      success: true,
      feedback: result.feedback || '',
      ai_source: aiSource
    })
  } catch (e: any) {
    console.log('AHA Report feedback error:', e)
    return c.json({ error: '피드백 생성에 실패했어요. 다시 시도해주세요.' }, 500)
  }
})

// ==================== 아하 리포트 AI 분석 (Gemini 3.0 Flash) ====================
app.post('/api/aha-report/analyze', async (c) => {
  try {

    const { photos, subject, unit } = await c.req.json<{
      photos: string[],  // base64 data URLs
      subject?: string,
      unit?: string
    }>()

    if (!photos || photos.length === 0) return c.json({ error: '사진이 필요합니다.' }, 400)
    if (photos.length > 3) return c.json({ error: '사진은 최대 3장까지 가능합니다.' }, 400)

    const systemPrompt = `당신은 고교학점제 전문가이자 학생들의 학습 멘토입니다.
학생이 작성한 영역 탐구 보고서(AHA-Report) 사진을 분석합니다.

[작업 1] 사진에서 손글씨를 OCR 인식하여 다음 4개 섹션으로 정리해주세요:

1. 문제 상황: 학생이 "1. 문제 상황"에 작성한 내용
2. 주제 설정: 학생이 "2. 주제 설정"에 작성한 내용
3. 탐구 과정 및 결론 도출: 학생이 "3. 탐구 과정 및 결론 도출"에 작성한 내용
4. 자가 피드백: 학생이 "4. 자가 피드백"에 작성한 내용

OCR 규칙:
- 학생의 원문 내용을 최대한 살리되, 읽기 쉽게 문장을 정돈
- 내용을 임의로 추가하거나 변경하지 말 것
- 인식이 어려운 부분은 [판독 불가] 표시
- 영어/한국어 혼합 내용도 그대로 반영
- 보고서 양식 상단의 "과목", "수업 단원 및 내용", "반명", "이름"도 인식
- 탐구 과정 섹션은 번호별 항목(1., 2., 3.)을 줄바꿈으로 구분하고, 결론 부분은 별도 단락으로 분리하여 가독성을 높일 것
- 단어 나열(예: want, hope, decide...)이 있으면 줄바꿈하여 별도로 표시할 것

[작업 2] 위 4개 섹션 분석 결과를 바탕으로 피드백을 작성해주세요.

피드백 규칙:
- 따뜻하고 격려하는 톤, 반드시 존댓말 사용
- 부정적이거나 비판적인 표현 절대 금지
- 150~250자 내외

피드백에 포함할 내용:
1. 탐구 보고서 진정성 평가:
   - 탐구 주제가 수업 내용과 연관성이 있는지
   - 탐구 과정이 논리적으로 전개되었는지
   - 자가 피드백에서 진솔한 성찰이 담겨 있는지
   - 개선할 수 있는 부분 1~2가지 구체적 제안
2. 격려 및 조언:
   - 학생의 노력을 인정하는 격려 메시지
   - 고교학점제에서 이 탐구 활동이 어떤 의미를 갖는지
   - 학교 세부능력특기사항과 연결할 수 있는 팁
   - 향후 발전 방향 조언

위 두 가지를 자연스럽게 하나의 글로 연결하여 작성해주세요.

반드시 아래 JSON 형식으로만 응답:
{
  "sections": {
    "problem": "문제 상황 정리 내용",
    "topic": "주제 설정 정리 내용",
    "research": "탐구 과정 및 결론 정리 내용",
    "self_feedback": "자가 피드백 정리 내용"
  },
  "ai_feedback": "피드백 전체 텍스트 (150~250자, 따뜻한 격려 톤, 존댓말)",
  "subject_detected": "인식된 과목명",
  "unit_detected": "인식된 단원명",
  "student_name": "인식된 학생 이름"
}`

    // Build parts: text prompt + multiple images
    const promptText = `${systemPrompt}\n\n---\n학생 선택 과목: ${subject || '미선택'}\n단원: ${unit || '미입력'}`
    const parts: any[] = [{ text: promptText }]

    // Extract image data for both Gemini and OpenAI
    const imageDataList: { mime_type: string, data: string }[] = []
    for (const photo of photos) {
      const match = photo.match(/^data:(image\/\w+);base64,(.+)$/)
      if (match) {
        imageDataList.push({ mime_type: match[1], data: match[2] })
        parts.push({ inline_data: { mime_type: match[1], data: match[2] } })
      }
    }

    let rawText = '{}'
    let aiSource = 'gemini'
    const proxySecret = c.env.AI_PROXY_SECRET

    // Step 1: Gemini → Step 2: OpenAI → Step 3: Claude (프록시 경유)
    try {
      rawText = await callProxyGemini({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, task: 'aha-report' })
    } catch (geminiErr) {
      console.log('Gemini 실패, OpenAI 폴백:', geminiErr)
      aiSource = 'openai'
      try {
        rawText = await callProxyOpenAI({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, timeoutMs: 300000, task: 'aha-report' })
      } catch (openaiErr) {
        console.log('OpenAI 실패, Claude 폴백:', openaiErr)
        aiSource = 'claude'
        try {
          rawText = await callProxyClaude({ proxySecret, prompt: promptText, images: imageDataList, jsonMode: true, temperature: 0.2, timeoutMs: 300000, task: 'aha-report' })
        } catch (claudeErr) {
          return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.', detail: 'all_ai_failed' }, 500)
        }
      }
    }

    let result: any
    try {
      result = JSON.parse(cleanJsonResponse(rawText))
    } catch {
      return c.json({ error: '분석 결과를 파싱할 수 없습니다. 사진을 다시 확인해주세요.', raw: rawText }, 500)
    }

    // Validate sections exist
    const sections = result.sections || {}
    if (!sections.problem && !sections.topic && !sections.research && !sections.self_feedback) {
      return c.json({
        error: '사진이 잘 안 읽혔어요. 밝은 곳에서 다시 찍어보세요.',
        result
      }, 422)
    }

    return c.json({
      success: true,
      sections: {
        problem: sections.problem || '[판독 불가]',
        topic: sections.topic || '[판독 불가]',
        research: sections.research || '[판독 불가]',
        self_feedback: sections.self_feedback || '[판독 불가]'
      },
      ai_feedback: result.ai_feedback || null,
      subject_detected: result.subject_detected || null,
      unit_detected: result.unit_detected || null,
      student_name: result.student_name || null,
      ai_source: aiSource
    })
  } catch (e: any) {
    console.log('AHA Report analyze error:', e)
    return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.' }, 500)
  }
})

// 아하 리포트 제출 시 크로켓 포인트 자동 지급 (3P 고정)
app.post('/api/aha-report/give-croquet', async (c) => {
  try {
    const { studentId, subject } = await c.req.json<{ studentId: number, subject?: string }>()
    if (!studentId) return c.json({ error: '학생 ID가 필요합니다.' }, 400)

    const amount = 3
    const reason = '아하 리포트 제출'
    const reasonDetail = subject ? `아하 리포트 제출 (${subject})` : '아하 리포트 제출'

    // 잔액 업데이트
    await c.env.DB.prepare('UPDATE students SET croquet_balance = croquet_balance + ? WHERE id = ?').bind(amount, studentId).run()
    const student: any = await c.env.DB.prepare('SELECT croquet_balance FROM students WHERE id = ?').bind(studentId).first()
    const newBalance = student?.croquet_balance || 0

    // 이력 저장 (mentor_id = NULL 은 "자동 지급")
    await c.env.DB.prepare(
      'INSERT INTO croquet_points (student_id, mentor_id, amount, reason, reason_detail, balance_after) VALUES (?, NULL, ?, ?, ?, ?)'
    ).bind(studentId, amount, reason, reasonDetail, newBalance).run()

    return c.json({ success: true, newBalance, amount })
  } catch (e: any) {
    console.log('AHA croquet give error:', e)
    return c.json({ error: e.message }, 500)
  }
})

// ==================== 아하 리포트 저장/조회 ====================
// 리포트 저장 (사진은 R2 우선)
app.post('/api/aha-report/save', async (c) => {
  try {
    const { studentId, subject, unit, photos, sections, ai_feedback, ai_source, student_name_detected, subject_detected, unit_detected, croquet_given, section_sa, section_pa, section_da, section_poa, section_ppa, source, date, photo_tags } = await c.req.json<{
      studentId: number, subject: string, unit?: string, photos: string[],
      sections?: { problem: string, topic: string, research: string, self_feedback: string },
      ai_feedback?: string, ai_source?: string,
      student_name_detected?: string, subject_detected?: string, unit_detected?: string,
      croquet_given?: number,
      section_sa?: string, section_pa?: string, section_da?: string,
      section_poa?: string, section_ppa?: string,
      source?: string, date?: string, photo_tags?: string
    }>()
    if (!studentId || !subject) return c.json({ error: '필수 정보가 누락되었습니다.' }, 400)

    // 사진을 R2에 저장 (가능하면)
    let photosToStore: string[] = [];
    if (c.env.R2 && photos && photos.length > 0) {
      for (const photo of photos) {
        try {
          const r2Key = `aha/${studentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
          const match = photo.match(/^data:(image\/\w+);base64,(.+)$/);
          const rawBase64 = match ? match[2] : photo.replace(/^data:image\/\w+;base64,/, '');
          const binary = Uint8Array.from(atob(rawBase64), c => c.charCodeAt(0));
          await c.env.R2.put(r2Key, binary, { httpMetadata: { contentType: match?.[1] || 'image/jpeg' } });
          photosToStore.push(`r2:${r2Key}`);
        } catch (e) {
          // R2 실패 시 원본 base64 저장
          photosToStore.push(photo);
        }
      }
    } else {
      photosToStore = photos || [];
    }

    const result = await c.env.DB.prepare(
      `INSERT INTO aha_reports (student_id, subject, unit, photos, section_problem, section_topic, section_research, section_self_feedback, ai_feedback, ai_source, student_name_detected, subject_detected, unit_detected, croquet_given, section_sa, section_pa, section_da, section_poa, section_ppa, source, date, photo_tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(
      studentId, subject, unit || '', JSON.stringify(photosToStore),
      sections?.problem || '', sections?.topic || '', sections?.research || '', sections?.self_feedback || '',
      ai_feedback || '', ai_source || 'gemini',
      student_name_detected || '', subject_detected || '', unit_detected || '',
      croquet_given || 0,
      section_sa || '', section_pa || '[]', section_da || '',
      section_poa || '', section_ppa || '{}',
      source || '', date || '', photo_tags || '[]'
    ).run()

    return c.json({ success: true, reportId: result.meta.last_row_id })
  } catch (e: any) {
    console.log('AHA report save error:', e)
    return c.json({ error: e.message }, 500)
  }
})

// 학생 리포트 목록 조회
app.get('/api/student/:studentId/aha-reports', async (c) => {
  try {
    const studentId = Number(c.req.param('studentId'))
    const subject = c.req.query('subject') || ''
    
    let query = 'SELECT id, subject, unit, section_topic, section_problem, section_research, section_self_feedback, ai_feedback, croquet_given, created_at, student_name_detected, subject_detected, unit_detected, section_sa, section_pa, section_da, section_poa, section_ppa, source, date, photos, photo_tags FROM aha_reports WHERE student_id = ?'
    const binds: any[] = [studentId]
    
    if (subject) {
      query += ' AND subject = ?'
      binds.push(subject)
    }
    query += ' ORDER BY created_at DESC'
    
    const stmt = c.env.DB.prepare(query)
    const { results } = await stmt.bind(...binds).all()
    return c.json({ reports: results || [] })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 리포트 상세 조회 (R2 사진 복원 지원)
app.get('/api/aha-report/:reportId', async (c) => {
  try {
    const reportId = Number(c.req.param('reportId'))
    const report: any = await c.env.DB.prepare(
      'SELECT * FROM aha_reports WHERE id = ?'
    ).bind(reportId).first()
    
    if (!report) return c.json({ error: '리포트를 찾을 수 없습니다.' }, 404)
    
    // Parse photos JSON and resolve R2 URLs
    let photos: string[] = [];
    try { photos = JSON.parse(report.photos || '[]') } catch { photos = [] }
    
    // R2 키를 base64 data URL로 변환
    if (c.env.R2) {
      const resolved = await Promise.all(photos.map(async (p: string) => {
        if (p.startsWith('r2:')) {
          try {
            const r2Key = p.slice(3);
            const obj = await c.env.R2.get(r2Key);
            if (obj) {
              const arrayBuf = await obj.arrayBuffer();
              const bytes = new Uint8Array(arrayBuf);
              let binary = '';
              for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
              const base64 = btoa(binary);
              const mime = obj.httpMetadata?.contentType || 'image/jpeg';
              return `data:${mime};base64,${base64}`;
            }
          } catch (e) { console.error('R2 read failed:', e); }
        }
        return p; // 이미 base64이거나 R2 실패 시 그대로 반환
      }));
      report.photos = resolved;
    } else {
      report.photos = photos;
    }
    
    return c.json({ report })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ==================== 아하 리포트 삭제 ====================
app.delete('/api/aha-report/:reportId', async (c) => {
  try {
    const reportId = Number(c.req.param('reportId'))
    const studentId = Number(c.req.query('studentId'))
    if (!reportId || !studentId) return c.json({ error: '필수 정보가 누락되었습니다.' }, 400)

    // 본인 리포트인지 확인
    const report: any = await c.env.DB.prepare(
      'SELECT id, student_id, photos FROM aha_reports WHERE id = ?'
    ).bind(reportId).first()

    if (!report) return c.json({ error: '리포트를 찾을 수 없습니다.' }, 404)
    if (report.student_id !== studentId) return c.json({ error: '본인의 리포트만 삭제할 수 있습니다.' }, 403)

    // R2 사진 삭제
    if (c.env.R2) {
      try {
        const photos: string[] = JSON.parse(report.photos || '[]')
        for (const p of photos) {
          if (p.startsWith('r2:')) {
            try { await c.env.R2.delete(p.slice(3)) } catch (_) {}
          }
        }
      } catch (_) {}
    }

    await c.env.DB.prepare('DELETE FROM aha_reports WHERE id = ?').bind(reportId).run()
    return c.json({ success: true })
  } catch (e: any) {
    console.log('AHA Report delete error:', e)
    return c.json({ error: '삭제에 실패했어요.' }, 500)
  }
})

// ==================== 릴레이단어장 API ====================

// 학생이 속한 모든 활성 클래스 목록 (성장 아하 리포트용)
app.get('/api/student/classes', async (c) => {
  try {
    const userId = c.req.query('user_id')
    if (!userId) return c.json({ error: 'user_id 필요' }, 400)

    const jyskApiUrl = c.env.JYSK_API_URL || 'https://jungyoul.com/api/jysk-api.php'
    const jyskApiKey = c.env.JYSK_API_KEY || 'jysk-planner-2026'

    const res = await fetch(`${jyskApiUrl}?action=get_student_classes&user_id=${userId}&key=${jyskApiKey}`)
    const data: any = await res.json()
    if (!data.success) return c.json({ success: false, classes: [] })
    return c.json({ success: true, classes: data.classes || [] })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// ==================== 헬스체크 ====================
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    services: {
      aiProxy: !!c.env.AI_PROXY_SECRET,
      perplexity: !!c.env.PERPLEXITY_API_KEY
    }
  })
})

app.get('/', (c) => {
  // HTML은 항상 최신 버전 로드 (서비스워커 캐시 문제 방지)
  c.header('Cache-Control', 'no-cache, no-store, must-revalidate')
  c.header('Pragma', 'no-cache')
  c.header('Expires', '0')
  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>고교학점플래너 - 정율사관학원</title>
  <link rel="manifest" href="/static/manifest.json">
  <link rel="apple-touch-icon" href="/static/apple-touch-icon.png">
  <link rel="icon" type="image/png" sizes="192x192" href="/static/icon-192.png">
  <link rel="icon" href="/static/logo.png">
  <meta name="theme-color" content="#6C5CE7">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="apple-mobile-web-app-title" content="학점플래너">
  <meta name="description" content="고교학점제 시대, 학교생활의 모든 순간을 기록하고 생기부 경쟁력으로 만드세요">
  <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700;900&display=swap" rel="stylesheet">
  <link href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" rel="stylesheet">
  <link href="/static/app.css" rel="stylesheet">
  <!-- Archive Module -->
  <link rel="stylesheet" href="/styles/skill-premium-card.css">
  <link rel="stylesheet" href="/modules/records/records.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.css">
  <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.44/dist/katex.min.js" onerror="console.warn('[KaTeX] CDN load failed. Math will display as plain text.')"></script>
  <script defer src="https://unpkg.com/lucide@latest"></script>
  <script defer src="https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js"></script>
  <style>
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.95)} }
    @keyframes rm-spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
    #initial-loader, #initial-loader-tablet, #initial-loader-desktop {
      transition: opacity 0.3s ease;
    }
  </style>
</head>
<body>
  <div id="prototype-wrapper">
    <div id="device-frame">
      <div id="mode-header">
        <div class="mode-logo-row">
          <img src="/static/logo.png" alt="정율사관학원" class="mode-logo-img">
          <div class="mode-logo-text">
            <span class="mode-logo-title">고교학점플래너</span>
            <span class="mode-logo-sub">HS CreditPlanner</span>
          </div>
        </div>
      </div>
      <div id="mode-selector">
        <button class="mode-btn active" data-mode="student">🎓 학생 앱</button>
        <button class="mode-btn" data-mode="mentor">👨‍🏫 멘토 대시보드</button>
        <button class="mode-btn" data-mode="director">🏢 원장 대시보드</button>
      </div>
      <div id="device-preview-selector">
        <span class="device-preview-label">미리보기</span>
        <div class="device-preview-btns">
          <button class="device-preview-btn" data-device="phone" title="핸드폰 (390×844)">
            <i class="fas fa-mobile-alt"></i><span>핸드폰</span>
          </button>
          <button class="device-preview-btn" data-device="tablet" title="패드 세로 (768×1024)">
            <i class="fas fa-tablet-alt"></i><span>패드세로</span>
          </button>
          <button class="device-preview-btn" data-device="tablet-landscape" title="패드 가로 (1194×834)">
            <i class="fas fa-tablet-alt" style="transform:rotate(90deg)"></i><span>패드가로</span>
          </button>
          <button class="device-preview-btn active" data-device="pc" title="PC (실제 화면 크기)">
            <i class="fas fa-desktop"></i><span>PC</span>
          </button>
        </div>
      </div>
      <div id="phone-container">
        <div id="phone-frame">
          <div id="status-bar">
            <span>9:41</span>
            <span><i class="fas fa-signal"></i> <i class="fas fa-wifi"></i> <i class="fas fa-battery-full"></i></span>
          </div>
          <div id="app-content">
            <div id="initial-loader" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:12px;transition:opacity 0.3s ease">
              <img src="/static/logo.png" alt="" style="width:64px;height:64px;border-radius:16px;box-shadow:0 4px 16px rgba(108,92,231,0.2);animation:pulse 1.5s ease-in-out infinite">
              <div style="font-size:17px;font-weight:700;color:#6C5CE7;margin-top:4px">고교학점플래너</div>
              <div style="font-size:12px;color:#aaa;font-weight:400;letter-spacing:0.5px">정율사관학원</div>
              <div style="margin-top:16px;width:32px;height:32px;border:3px solid #e8e5ff;border-top-color:#6C5CE7;border-radius:50%;animation:rm-spin 0.7s linear infinite"></div>
            </div>
          </div>
          <div id="archive-container-phone" class="archive-module" style="display:none;flex:1;overflow-y:auto;height:100%"></div>
        </div>
      </div>
      <div id="tablet-container" style="display:none">
        <div id="tablet-sidebar"></div>
        <div id="tablet-main-area">
          <div id="tablet-status-bar">
            <span class="tablet-status-left">
              <img src="/static/logo.png" alt="" class="tablet-status-logo">
              <span class="tablet-status-title">고교학점플래너</span>
            </span>
            <span class="tablet-status-right">
              <i class="fas fa-signal"></i> <i class="fas fa-wifi"></i> <i class="fas fa-battery-full"></i>
              <span class="tablet-status-time">9:41</span>
            </span>
          </div>
          <div id="tablet-content">
            <div id="initial-loader-tablet" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:16px">
              <img src="/static/logo.png" alt="" style="width:56px;height:56px;border-radius:14px;animation:pulse 1.5s ease-in-out infinite">
              <div style="font-size:15px;color:#888;font-weight:500">로딩 중...</div>
            </div>
          </div>
          <div id="archive-container-tablet" class="archive-module" style="display:none;flex:1;overflow-y:auto"></div>
          <div id="mobile-bottom-tab"></div>
        </div>
      </div>
      <div id="desktop-container" style="display:none">
        <div id="desktop-content">
          <div id="initial-loader-desktop" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:16px">
            <img src="/static/logo.png" alt="" style="width:56px;height:56px;border-radius:14px;animation:pulse 1.5s ease-in-out infinite">
            <div style="font-size:15px;color:#888;font-weight:500">로딩 중...</div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.2.4/purify.min.js"></script>
  <script src="/static/app.js"></script>
  <script type="module">
    import ArchiveModule from '/modules/records/records.js';
    window.ArchiveModule = ArchiveModule;
    window._archiveModuleReady = true;
    console.log('[ArchiveModule] Loaded and ready');
  </script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js', { updateViaCache: 'none' })
          .then(reg => {
            console.log('SW registered:', reg.scope);
            // 주기적 업데이트 체크 (1분마다)
            setInterval(() => reg.update(), 60000);
            // 새 SW가 대기 중이면 즉시 활성화 요청
            reg.addEventListener('updatefound', () => {
              const newSW = reg.installing;
              if (newSW) {
                newSW.addEventListener('statechange', () => {
                  if (newSW.state === 'installed' && navigator.serviceWorker.controller) {
                    // 새 버전이 설치됨 → 즉시 활성화 요청
                    newSW.postMessage('skipWaiting');
                    console.log('[PWA] New version installed, activating...');
                  }
                });
              }
            });
          })
          .catch(err => console.log('SW registration failed:', err));
      });
      // 새 SW 활성화 로깅만 (자동 reload 제거 — skipWaiting+claim으로 즉시 적용됨)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        console.log('[PWA] New service worker activated');
      });
    }
  </script>
</body>
</html>`)
})

export default app
