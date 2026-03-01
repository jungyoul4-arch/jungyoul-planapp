import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'

type Bindings = {
  OPENAI_API_KEY: string
  ANTHROPIC_API_KEY: string
  GEMINI_API_KEY: string
  PERPLEXITY_API_KEY: string
  QA_APP_SECRET: string
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())
app.get('/static/*', serveStatic())

// ==================== XP 내역 기록 헬퍼 ====================
async function recordXp(db: D1Database, studentId: number, amount: number, source: string, sourceDetail: string = '', refTable: string | null = null, refId: number | null = null) {
  if (!amount || amount === 0) return
  try {
    await db.prepare(
      'INSERT INTO xp_history (student_id, amount, source, source_detail, ref_table, ref_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(studentId, amount, source, sourceDetail, refTable, refId).run()
  } catch (e) {
    // xp_history 테이블이 아직 없을 수 있음 — 조용히 무시
    console.error('recordXp failed:', e)
  }
}

// ==================== Gemini → OpenAI 폴백 헬퍼 ====================
// Gemini API가 할당량 초과(429) 등으로 실패할 경우 OpenAI gpt-4o-mini로 자동 폴백

async function callGeminiWithFallback(opts: {
  geminiKey: string,
  openaiKey: string,
  prompt: string,
  jsonMode?: boolean,
  temperature?: number,
  inlineData?: { mime_type: string, data: string },
}) {
  const { geminiKey, openaiKey, prompt, jsonMode = true, temperature = 0.3, inlineData } = opts

  // Step 1: Gemini 시도
  try {
    const parts: any[] = [{ text: prompt }]
    if (inlineData) parts.push({ inline_data: inlineData })

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: {
            temperature,
            ...(jsonMode ? { responseMimeType: 'application/json' } : { maxOutputTokens: 2048 })
          }
        })
      }
    )

    if (geminiRes.ok) {
      const data: any = await geminiRes.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      return { text, source: 'gemini' }
    }

    // Gemini 실패 → 폴백으로 진행
    console.log(`Gemini API 실패 (${geminiRes.status}), OpenAI로 폴백`)
  } catch (e) {
    console.log('Gemini API 에러, OpenAI로 폴백:', e)
  }

  // Step 2: OpenAI 폴백 (이미지가 있는 경우 이미지 없이 텍스트만 전송)
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: prompt }
      ],
      temperature,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  })

  if (!openaiRes.ok) {
    const err = await openaiRes.text()
    throw new Error(`OpenAI 폴백도 실패: ${err}`)
  }

  const openaiData: any = await openaiRes.json()
  const text = openaiData.choices[0].message.content
  return { text, source: 'openai' }
}

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


// ==================== API 라우트: 질문 분석 (OpenAI) ====================

app.post('/api/analyze', async (c) => {
  try {
    const { question, subject, axis } = await c.req.json()
    if (!question) return c.json({ error: '질문 내용이 필요합니다' }, 400)

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT_ANALYZE },
          { role: 'user', content: `과목: ${subject || '미지정'}\n질문 축: ${axis === 'reflection' ? '축2(성찰)' : '축1(호기심)'}\n\n학생 질문: "${question}"` }
        ],
        temperature: 0.3,
        response_format: { type: "json_object" }
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: 'OpenAI API 오류', detail: err }, 500)
    }

    const data: any = await res.json()
    const result = JSON.parse(data.choices[0].message.content)
    return c.json(result)
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== API 라우트: 소크라테스 코칭 (Claude) ====================

app.post('/api/coaching', async (c) => {
  try {
    const { messages, subject, currentLevel } = await c.req.json()
    if (!messages || messages.length === 0) return c.json({ error: '대화 내용이 필요합니다' }, 400)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': c.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: SYSTEM_PROMPT_COACHING + `\n\n현재 학생의 질문 단계: ${currentLevel || 'A-2'}\n과목: ${subject || '미지정'}`,
        messages: messages.map((m: any) => ({
          role: m.role,
          content: m.content
        }))
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: 'Claude API 오류', detail: err }, 500)
    }

    const data: any = await res.json()
    const text = data.content[0].text

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

    // Gemini 우선 시도 (이미지 지원) → 실패 시 OpenAI 폴백 (이미지 없이 텍스트만)
    const { text } = await callGeminiWithFallback({
      geminiKey: c.env.GEMINI_API_KEY,
      openaiKey: c.env.OPENAI_API_KEY,
      prompt: fullPrompt,
      jsonMode: true,
      temperature: 0.3,
      inlineData: { mime_type: mimeType || 'image/jpeg', data: cleanBase64 },
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


// ==================== API 라우트: 고난도 문제 분석 (Claude) ====================

app.post('/api/deep-analyze', async (c) => {
  try {
    const { question, subject, context } = await c.req.json()
    if (!question) return c.json({ error: '질문 내용이 필요합니다' }, 400)

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': c.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: `당신은 고등학교 수준의 고난도 문제를 분석하는 전문 튜터입니다.
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
}`,
        messages: [
          { role: 'user', content: `과목: ${subject}\n${context ? `배경: ${context}\n` : ''}\n질문: ${question}` }
        ]
      })
    })

    if (!res.ok) {
      const err = await res.text()
      return c.json({ error: 'Claude API 오류', detail: err }, 500)
    }

    const data: any = await res.json()
    const text = data.content[0].text

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
      geminiKey: c.env.GEMINI_API_KEY,
      openaiKey: c.env.OPENAI_API_KEY,
      prompt,
      jsonMode: false,
      temperature: 0.7,
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
      geminiKey: c.env.GEMINI_API_KEY,
      openaiKey: c.env.OPENAI_API_KEY,
      prompt: fullPrompt,
      jsonMode: true,
      temperature: 0.3,
    })

    try {
      return c.json(JSON.parse(text))
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


// ==================== AUTH: 비밀번호 해싱 (Web Crypto API) ====================

async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_credit_planner_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// 간단한 세션 토큰 생성
function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 초대코드 생성 (JYCC-XXXX-XXXX)
function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `JYCC-${part1}-${part2}`;
}


// ==================== AUTH API: 멘토 회원가입 ====================

app.post('/api/auth/mentor/register', async (c) => {
  try {
    const { loginId, password, name, academyName, phone } = await c.req.json();
    if (!loginId || !password || !name) return c.json({ error: '아이디, 비밀번호, 이름은 필수입니다' }, 400);
    if (password.length < 4) return c.json({ error: '비밀번호는 4자 이상이어야 합니다' }, 400);

    const existing = await c.env.DB.prepare('SELECT id FROM mentors WHERE login_id = ?').bind(loginId).first();
    if (existing) return c.json({ error: '이미 사용 중인 아이디입니다' }, 409);

    const passwordHash = await hashPassword(password);
    const result = await c.env.DB.prepare(
      'INSERT INTO mentors (login_id, password_hash, name, academy_name, phone) VALUES (?, ?, ?, ?, ?)'
    ).bind(loginId, passwordHash, name, academyName || '', phone || '').run();

    const mentorId = result.meta.last_row_id;

    // 기본 반 1개 자동 생성
    const inviteCode = generateInviteCode();
    await c.env.DB.prepare(
      'INSERT INTO groups (mentor_id, name, invite_code, description) VALUES (?, ?, ?, ?)'
    ).bind(mentorId, `${name} 선생님 반`, inviteCode, '').run();

    return c.json({ 
      success: true, 
      mentorId,
      message: '멘토 등록이 완료되었습니다',
      defaultGroupInviteCode: inviteCode
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== AUTH API: 멘토 로그인 ====================

app.post('/api/auth/mentor/login', async (c) => {
  try {
    const { loginId, password } = await c.req.json();
    if (!loginId || !password) return c.json({ error: '아이디와 비밀번호를 입력해주세요' }, 400);

    const mentor: any = await c.env.DB.prepare(
      'SELECT * FROM mentors WHERE login_id = ?'
    ).bind(loginId).first();

    if (!mentor) return c.json({ error: '아이디 또는 비밀번호가 틀렸습니다' }, 401);

    const valid = await verifyPassword(password, mentor.password_hash);
    if (!valid) return c.json({ error: '아이디 또는 비밀번호가 틀렸습니다' }, 401);

    // 멘토의 그룹 목록 조회
    const groups = await c.env.DB.prepare(
      'SELECT id, name, invite_code, description, max_students, is_active FROM groups WHERE mentor_id = ?'
    ).bind(mentor.id).all();

    const token = generateToken();

    return c.json({
      success: true,
      token,
      role: 'mentor',
      user: {
        id: mentor.id,
        loginId: mentor.login_id,
        name: mentor.name,
        academyName: mentor.academy_name,
        phone: mentor.phone,
      },
      groups: groups.results
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== AUTH API: 학생 회원가입 (초대코드) ====================

app.post('/api/auth/student/register', async (c) => {
  try {
    const { inviteCode, name, password, schoolName, grade } = await c.req.json();
    if (!inviteCode || !name || !password) return c.json({ error: '초대코드, 이름, 비밀번호는 필수입니다' }, 400);
    if (password.length < 4) return c.json({ error: '비밀번호는 4자 이상이어야 합니다' }, 400);

    // 초대코드로 그룹 찾기
    const group: any = await c.env.DB.prepare(
      'SELECT g.*, m.name as mentor_name, m.academy_name FROM groups g JOIN mentors m ON g.mentor_id = m.id WHERE g.invite_code = ? AND g.is_active = 1'
    ).bind(inviteCode.toUpperCase()).first();

    if (!group) return c.json({ error: '유효하지 않은 초대코드입니다' }, 404);

    // 같은 그룹에 같은 이름 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM students WHERE group_id = ? AND name = ?'
    ).bind(group.id, name).first();
    if (existing) return c.json({ error: '같은 반에 동일한 이름이 있습니다. 이름 뒤에 번호를 붙여주세요 (예: 홍길동2)' }, 409);

    // 정원 확인
    const count: any = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM students WHERE group_id = ? AND is_active = 1'
    ).bind(group.id).first();
    if (count.cnt >= group.max_students) return c.json({ error: '이 반의 정원이 가득 찼습니다' }, 409);

    const passwordHash = await hashPassword(password);
    const emojis = ['😊','😎','🤓','🦊','🐱','🐶','🦁','🐻','🐼','🐨','🦄','🐸','🐰','🐯'];
    const profileEmoji = emojis[Math.floor(Math.random() * emojis.length)];

    const result = await c.env.DB.prepare(
      'INSERT INTO students (group_id, name, password_hash, school_name, grade, profile_emoji) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(group.id, name, passwordHash, schoolName || '', grade || 1, profileEmoji).run();

    return c.json({
      success: true,
      studentId: result.meta.last_row_id,
      message: `${group.name}에 가입되었습니다!`,
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
    const { inviteCode, name, password } = await c.req.json();
    if (!inviteCode || !name || !password) return c.json({ error: '초대코드, 이름, 비밀번호를 모두 입력해주세요' }, 400);

    // 초대코드로 그룹 찾기
    const group: any = await c.env.DB.prepare(
      'SELECT g.*, m.name as mentor_name, m.academy_name FROM groups g JOIN mentors m ON g.mentor_id = m.id WHERE g.invite_code = ?'
    ).bind(inviteCode.toUpperCase()).first();

    if (!group) return c.json({ error: '유효하지 않은 초대코드입니다' }, 401);

    const student: any = await c.env.DB.prepare(
      'SELECT * FROM students WHERE group_id = ? AND name = ? AND is_active = 1'
    ).bind(group.id, name).first();

    if (!student) return c.json({ error: '이름 또는 비밀번호가 틀렸습니다' }, 401);

    const valid = await verifyPassword(password, student.password_hash);
    if (!valid) return c.json({ error: '이름 또는 비밀번호가 틀렸습니다' }, 401);

    // 마지막 로그인 시간 업데이트
    await c.env.DB.prepare(
      'UPDATE students SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).bind(student.id).run();

    const token = generateToken();

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
        groupId: student.group_id,
      },
      group: {
        id: group.id,
        name: group.name,
        mentorName: group.mentor_name,
        academyName: group.academy_name,
      }
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


// ==================== MENTOR API: 그룹(반) 관리 ====================

app.post('/api/mentor/groups', async (c) => {
  try {
    const { mentorId, name, description, maxStudents } = await c.req.json();
    if (!mentorId || !name) return c.json({ error: '멘토 ID와 반 이름은 필수입니다' }, 400);

    const inviteCode = generateInviteCode();
    const result = await c.env.DB.prepare(
      'INSERT INTO groups (mentor_id, name, invite_code, description, max_students) VALUES (?, ?, ?, ?, ?)'
    ).bind(mentorId, name, inviteCode, description || '', maxStudents || 30).run();

    return c.json({
      success: true,
      groupId: result.meta.last_row_id,
      inviteCode,
      message: `"${name}" 반이 생성되었습니다`
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 멘토의 그룹 목록 + 학생 수
app.get('/api/mentor/:mentorId/groups', async (c) => {
  try {
    const mentorId = c.req.param('mentorId');
    const groups = await c.env.DB.prepare(`
      SELECT g.*, 
        (SELECT COUNT(*) FROM students s WHERE s.group_id = g.id AND s.is_active = 1) as student_count
      FROM groups g WHERE g.mentor_id = ? ORDER BY g.created_at DESC
    `).bind(mentorId).all();

    return c.json({ groups: groups.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 그룹의 학생 목록
app.get('/api/mentor/groups/:groupId/students', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const students = await c.env.DB.prepare(
      'SELECT id, name, school_name, grade, profile_emoji, xp, level, last_login_at, created_at FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name'
    ).bind(groupId).all();

    return c.json({ students: students.results });
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
    fields.push('updated_at = CURRENT_TIMESTAMP');

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

    // 각 결과에 오답 데이터 추가
    const fullResults = [];
    for (const r of results.results as any[]) {
      const wrongAnswers = await c.env.DB.prepare(
        'SELECT * FROM wrong_answers WHERE exam_result_id = ? ORDER BY id'
      ).bind(r.id).all();

      const waWithImages = [];
      for (const wa of wrongAnswers.results as any[]) {
        const images = await c.env.DB.prepare(
          'SELECT image_data FROM wrong_answer_images WHERE wrong_answer_id = ? ORDER BY sort_order'
        ).bind(wa.id).all();
        waWithImages.push({
          ...wa,
          images: (images.results as any[]).map((img: any) => img.image_data)
        });
      }

      fullResults.push({ ...r, wrongAnswers: waWithImages });
    }

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
    fields.push('updated_at = CURRENT_TIMESTAMP');

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


// ==================== STUDENT DATA API: 수업 기록 ====================

app.get('/api/student/:studentId/class-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const records = await c.env.DB.prepare(
      'SELECT * FROM class_records WHERE student_id = ? ORDER BY date DESC'
    ).bind(studentId).all();
    return c.json({ records: records.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

app.post('/api/student/:studentId/class-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { subject, date, content, keywords, understanding, memo, topic, pages, photos, teacher_note } = await c.req.json();
    if (!subject || !date) return c.json({ error: '과목과 날짜는 필수입니다' }, 400);

    const result = await c.env.DB.prepare(
      'INSERT INTO class_records (student_id, subject, date, content, keywords, understanding, memo, topic, pages, photos, teacher_note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, subject, date, content || '', JSON.stringify(keywords || []), understanding || 3, memo || '', topic || '', pages || '', JSON.stringify(photos || []), teacher_note || '').run();

    return c.json({ success: true, recordId: result.meta.last_row_id });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

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

    if (fields.length === 0) return c.json({ success: true });

    values.push(recordId);
    await c.env.DB.prepare(`UPDATE class_records SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();

    return c.json({ success: true });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== STUDENT DATA API: 수업 기록 사진 ====================

// 사진 업로드 (base64 → DB 저장, photo ID 반환)
app.post('/api/student/:studentId/class-record-photos', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const { photos, classRecordId } = await c.req.json();
    // photos: base64 문자열 배열
    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return c.json({ error: '사진 데이터가 필요합니다' }, 400);
    }
    const ids: number[] = [];
    for (const photoData of photos) {
      if (typeof photoData !== 'string' || photoData.length < 10) continue;
      // 썸네일 생성 (base64에서 첫 200자만 저장 - 목록용)
      const thumbnail = photoData.slice(0, 200);
      const fileSize = Math.round(photoData.length * 0.75); // base64 → bytes 추정
      const result = await c.env.DB.prepare(
        'INSERT INTO class_record_photos (student_id, class_record_id, photo_data, thumbnail, file_size) VALUES (?, ?, ?, ?, ?)'
      ).bind(studentId, classRecordId || null, photoData, thumbnail, fileSize).run();
      ids.push(result.meta.last_row_id as number);
    }
    return c.json({ success: true, photoIds: ids });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 사진 원본 조회
app.get('/api/photos/:photoId', async (c) => {
  try {
    const photoId = c.req.param('photoId');
    const row: any = await c.env.DB.prepare(
      'SELECT photo_data, mime_type FROM class_record_photos WHERE id = ?'
    ).bind(photoId).first();
    if (!row) return c.json({ error: 'Photo not found' }, 404);
    // base64 data URL인 경우 그대로 반환
    if (row.photo_data.startsWith('data:')) {
      return c.json({ photoData: row.photo_data });
    }
    // raw base64인 경우 data URL로 변환
    return c.json({ photoData: `data:${row.mime_type || 'image/jpeg'};base64,${row.photo_data}` });
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
    fields.push('updated_at = CURRENT_TIMESTAMP');

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
      'SELECT * FROM activity_records WHERE student_id = ? ORDER BY created_at DESC'
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
    const { activityRecordId, date, content, reflection, duration, xpEarned } = await c.req.json();
    if (!activityRecordId || !content) return c.json({ error: '활동 ID와 내용은 필수입니다' }, 400);

    const result = await c.env.DB.prepare(
      'INSERT INTO activity_logs (activity_record_id, student_id, date, content, reflection, duration, xp_earned) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(activityRecordId, studentId, date || new Date().toISOString().slice(0,10), content, reflection || '', duration || '', xpEarned || 20).run();

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
    fields.push('updated_at = CURRENT_TIMESTAMP');

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


// ==================== 관리자/멘토 전체 데이터 조회 API ====================

// 특정 학생의 전체 기록 (날짜별 통합)
app.get('/api/mentor/student/:studentId/all-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const dateFrom = c.req.query('from') || '2000-01-01';
    const dateTo = c.req.query('to') || '2099-12-31';

    const [classRecords, questionRecords, teachRecords, activityRecords, activityLogs, assignments, exams, examResults, reportRecords, classPhotos, myQuestions, feedbacks] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM class_records WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM question_records WHERE student_id = ? AND DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM teach_records WHERE student_id = ? AND DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM activity_records WHERE student_id = ? ORDER BY created_at DESC').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM activity_logs WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM assignments WHERE student_id = ? ORDER BY due_date DESC').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM exams WHERE student_id = ? ORDER BY start_date DESC').bind(studentId).all(),
      c.env.DB.prepare('SELECT er.*, e.name as exam_name FROM exam_results er JOIN exams e ON er.exam_id = e.id WHERE er.student_id = ? ORDER BY e.start_date DESC').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM report_records WHERE student_id = ? ORDER BY created_at DESC').bind(studentId).all(),
      // 추가: 수업 기록 사진 (thumbnail만 — 원본은 /api/photos/:id로 별도 조회)
      c.env.DB.prepare('SELECT id, class_record_id, thumbnail, file_size, created_at FROM class_record_photos WHERE student_id = ? ORDER BY id DESC LIMIT 200').bind(studentId).all(),
      // 추가: 나만의 질문방
      c.env.DB.prepare('SELECT q.*, (SELECT COUNT(*) FROM my_answers a WHERE a.question_id = q.id) as answer_count FROM my_questions q WHERE q.student_id = ? AND DATE(q.created_at) BETWEEN ? AND ? ORDER BY q.created_at DESC').bind(studentId, dateFrom, dateTo).all(),
      // 추가: 멘토 피드백
      c.env.DB.prepare('SELECT * FROM mentor_feedbacks WHERE student_id = ? ORDER BY created_at DESC LIMIT 100').bind(studentId).all().catch(() => ({ results: [] })),
    ]);

    // 사진을 class_record_id별로 매핑
    const photoMap: Record<number, any[]> = {};
    (classPhotos.results as any[]).forEach(p => {
      if (p.class_record_id) {
        if (!photoMap[p.class_record_id]) photoMap[p.class_record_id] = [];
        photoMap[p.class_record_id].push({ id: p.id, thumbnail: p.thumbnail, file_size: p.file_size });
      }
    });

    // 날짜별로 통합
    const dateMap: Record<string, any> = {};
    const addToDate = (date: string, type: string, data: any) => {
      if (!dateMap[date]) dateMap[date] = { date, records: [] };
      dateMap[date].records.push({ type, ...data });
    };

    (classRecords.results as any[]).forEach(r => {
      // 수업 기록에 사진 정보 첨부
      const photos = photoMap[r.id] || [];
      addToDate(r.date, 'class', { ...r, _photoCount: photos.length, _photoIds: photos.map((p: any) => p.id) });
    });
    (questionRecords.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'question', r));
    (teachRecords.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'teach', r));
    (activityRecords.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'activity', r));
    (activityLogs.results as any[]).forEach(r => addToDate(r.date || r.created_at?.slice(0,10) || '', 'activity_log', r));
    (assignments.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'assignment', r));
    (reportRecords.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'report', r));
    (myQuestions.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'my_question', r));

    const sortedDates = Object.values(dateMap).sort((a: any, b: any) => b.date.localeCompare(a.date));

    return c.json({
      student: studentId,
      dateRange: { from: dateFrom, to: dateTo },
      dailyRecords: sortedDates,
      summary: {
        classRecords: (classRecords.results as any[]).length,
        questionRecords: (questionRecords.results as any[]).length,
        teachRecords: (teachRecords.results as any[]).length,
        activityRecords: (activityRecords.results as any[]).length,
        activityLogs: (activityLogs.results as any[]).length,
        assignments: (assignments.results as any[]).length,
        exams: (exams.results as any[]).length,
        examResults: (examResults.results as any[]).length,
        reportRecords: (reportRecords.results as any[]).length,
        myQuestions: (myQuestions.results as any[]).length,
        classPhotos: (classPhotos.results as any[]).length,
      },
      exams: exams.results,
      examResults: examResults.results,
      reportRecords: reportRecords.results,
      feedbacks: feedbacks.results,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 그룹 전체 학생 요약 (멘토용 대시보드)
app.get('/api/mentor/groups/:groupId/summary', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const dateFrom = c.req.query('from') || new Date().toISOString().slice(0,10);
    const dateTo = c.req.query('to') || new Date().toISOString().slice(0,10);

    // KST 기준 오늘 날짜 (UTC+9)
    const kstNow = new Date(Date.now() + 9 * 3600000);
    const kstToday = kstNow.toISOString().slice(0,10);
    const kstDayOfWeek = kstNow.getUTCDay(); // 0=Sun,1=Mon,...6=Sat

    // 이번 주 평일 수 계산 (from~to 범위 내 월~금)
    const countWeekdays = (from: string, to: string): number => {
      let count = 0;
      const d = new Date(from + 'T00:00:00Z');
      const end = new Date(to + 'T00:00:00Z');
      while (d <= end) {
        const dow = d.getUTCDay();
        if (dow >= 1 && dow <= 5) count++;
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return count;
    };
    const weekdaysInRange = countWeekdays(dateFrom, dateTo);
    // 학교 수업: 평일 평균 6교시 기준
    const CLASSES_PER_DAY = 6;
    const expectedSchoolClasses = weekdaysInRange * CLASSES_PER_DAY;

    const students = await c.env.DB.prepare(
      'SELECT id, name, school_name, grade, profile_emoji, xp, level, last_login_at, croquet_balance FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name'
    ).bind(groupId).all();

    const summaries = [];
    for (const s of students.results as any[]) {
      const [classCount, questionCount, teachCount, assignCount, actLogCount,
             schoolClassCount, allAssignments, todayAcademyRecords, todayAllRecords] = await Promise.all([
        // 기존 기간 통계
        c.env.DB.prepare('SELECT COUNT(*) as cnt FROM class_records WHERE student_id = ? AND date BETWEEN ? AND ?').bind(s.id, dateFrom, dateTo).first(),
        c.env.DB.prepare('SELECT COUNT(*) as cnt FROM question_records WHERE student_id = ? AND DATE(created_at) BETWEEN ? AND ?').bind(s.id, dateFrom, dateTo).first(),
        c.env.DB.prepare('SELECT COUNT(*) as cnt FROM teach_records WHERE student_id = ? AND DATE(created_at) BETWEEN ? AND ?').bind(s.id, dateFrom, dateTo).first(),
        c.env.DB.prepare('SELECT COUNT(*) as cnt FROM assignments WHERE student_id = ? AND DATE(created_at) BETWEEN ? AND ?').bind(s.id, dateFrom, dateTo).first(),
        c.env.DB.prepare('SELECT COUNT(*) as cnt FROM activity_logs WHERE student_id = ? AND date BETWEEN ? AND ?').bind(s.id, dateFrom, dateTo).first(),
        // 수업 기록률: 학교 수업 기록 (memo에 isAcademy 미포함)
        c.env.DB.prepare("SELECT COUNT(*) as cnt FROM class_records WHERE student_id = ? AND date BETWEEN ? AND ? AND (memo IS NULL OR memo NOT LIKE '%isAcademy%')").bind(s.id, dateFrom, dateTo).first(),
        // 플래너(과제) 실행률: 기간 내 전체 과제 + 완료 과제
        c.env.DB.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM assignments WHERE student_id = ? AND DATE(created_at) BETWEEN ? AND ?").bind(s.id, dateFrom, dateTo).first(),
        // 학원 당일 완료율: 오늘(KST) 학원 수업 기록
        c.env.DB.prepare("SELECT COUNT(*) as cnt FROM class_records WHERE student_id = ? AND date = ? AND memo LIKE '%isAcademy%'").bind(s.id, kstToday).first(),
        // 오늘 전체 기록 수 (학교+학원)
        c.env.DB.prepare("SELECT COUNT(*) as cnt FROM class_records WHERE student_id = ? AND date = ?").bind(s.id, kstToday).first(),
      ]);

      // 수업 기록률 = 학교 수업 기록 ÷ 기대 수업 수
      const schoolRecords = (schoolClassCount as any)?.cnt || 0;
      const classRecordRate = expectedSchoolClasses > 0 ? Math.min(100, Math.round(schoolRecords / expectedSchoolClasses * 100)) : 0;

      // 플래너(과제) 실행률 = 완료 과제 ÷ 전체 과제
      const totalAssign = (allAssignments as any)?.total || 0;
      const completedAssign = (allAssignments as any)?.completed || 0;
      const plannerRate = totalAssign > 0 ? Math.round(completedAssign / totalAssign * 100) : -1; // -1 = 과제 없음

      // 학원 당일 완료율: 오늘이 평일이고 학원 수업이 있을 수 있는 날
      // 학원 스케줄은 클라이언트에 있으므로, 기록 기반으로 계산
      // 오늘 학원 기록이 0이고 주말이면 "학원 없음" 표시
      const todayAcademyCount = (todayAcademyRecords as any)?.cnt || 0;
      const todayTotalCount = (todayAllRecords as any)?.cnt || 0;
      const isWeekend = kstDayOfWeek === 0 || kstDayOfWeek === 6;
      // 학원 당일 완료율: -1 = 오늘 학원 없음 (데이터가 없고 주말인 경우)
      // 학원 스케줄은 DB에 없으므로, "오늘 작성한 학원 기록 수" 기준으로 표시
      // 학원 수업이 있다고 가정: 평일 1회, 토 2회 (일반적 학원 패턴)
      // 실제 학원 스케줄은 학생별로 다르므로 기록 유무로 판단
      let academyTodayRate = -1; // -1 = 학원 없음
      if (todayAcademyCount > 0) {
        academyTodayRate = 100; // 기록이 있으면 완료
      } else if (!isWeekend) {
        academyTodayRate = 0; // 평일인데 학원 기록 없음 → 0% (학원 있을 수도)
      }
      // 주말이고 기록 없으면 -1(학원 없음) 유지

      summaries.push({
        ...s,
        periodStats: {
          classRecords: (classCount as any)?.cnt || 0,
          questionRecords: (questionCount as any)?.cnt || 0,
          teachRecords: (teachCount as any)?.cnt || 0,
          assignments: (assignCount as any)?.cnt || 0,
          activityLogs: (actLogCount as any)?.cnt || 0,
          total: ((classCount as any)?.cnt || 0) + ((questionCount as any)?.cnt || 0) + ((teachCount as any)?.cnt || 0) + ((assignCount as any)?.cnt || 0) + ((actLogCount as any)?.cnt || 0),
        },
        // 3대 비율 지표
        rateStats: {
          classRecordRate,          // 수업 기록률 (0~100)
          expectedClasses: expectedSchoolClasses,
          actualClassRecords: schoolRecords,
          plannerRate,              // 플래너(과제) 실행률 (0~100, -1=과제없음)
          totalAssignments: totalAssign,
          completedAssignments: completedAssign,
          academyTodayRate,         // 학원 당일 완료율 (0~100, -1=학원없음)
          todayAcademyCount,
          kstToday,
        },
      });
    }

    return c.json({
      groupId,
      dateRange: { from: dateFrom, to: dateTo },
      students: summaries,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 전체 DB 내보내기 (관리자용) - 파라미터 바인딩으로 SQL 인젝션 방지
app.get('/api/admin/export/:table', async (c) => {
  try {
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

    await c.env.DB.prepare('UPDATE students SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(xpDelta, studentId).run();
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
      'SELECT s.*, g.name as group_name, g.invite_code FROM students s JOIN groups g ON s.group_id = g.id WHERE s.id = ?'
    ).bind(studentId).first();

    if (!student) return c.json({ error: '학생을 찾을 수 없습니다' }, 404);

    // 통계
    const examCount: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM exams WHERE student_id = ?').bind(studentId).first();
    const assignmentCount: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM assignments WHERE student_id = ?').bind(studentId).first();
    const questionCount: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM question_records WHERE student_id = ?').bind(studentId).first();
    const classCount: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM class_records WHERE student_id = ?').bind(studentId).first();
    const teachCount: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM teach_records WHERE student_id = ?').bind(studentId).first();
    const activityLogCount: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM activity_logs WHERE student_id = ?').bind(studentId).first();

    return c.json({
      id: student.id,
      name: student.name,
      schoolName: student.school_name,
      grade: student.grade,
      profileEmoji: student.profile_emoji,
      xp: student.xp,
      level: student.level,
      groupName: student.group_name,
      inviteCode: student.invite_code,
      stats: {
        exams: examCount.cnt,
        assignments: assignmentCount.cnt,
        questions: questionCount.cnt,
        classRecords: classCount.cnt,
        teachRecords: teachCount.cnt,
        activityLogs: activityLogCount.cnt,
      },
      lastLoginAt: student.last_login_at,
      createdAt: student.created_at,
      croquetBalance: student.croquet_balance || 0,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== ADMIN: 비밀번호 리셋 ====================
app.post('/api/admin/reset-password', async (c) => {
  try {
    const { studentId, newPassword, adminKey } = await c.req.json();
    if (adminKey !== 'jycc_admin_2026') return c.json({ error: 'Unauthorized' }, 403);
    if (!studentId || !newPassword) return c.json({ error: 'studentId와 newPassword 필요' }, 400);
    const hash = await hashPassword(newPassword);
    await c.env.DB.prepare('UPDATE students SET password_hash = ? WHERE id = ?').bind(hash, studentId).run();
    return c.json({ success: true, message: '비밀번호가 초기화되었습니다' });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== DB 자동 마이그레이션 ====================
app.get('/api/migrate', async (c) => {
  try {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS mentors (id INTEGER PRIMARY KEY AUTOINCREMENT, login_id TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL, name TEXT NOT NULL, academy_name TEXT DEFAULT '', phone TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP)`,
      `CREATE TABLE IF NOT EXISTS groups (id INTEGER PRIMARY KEY AUTOINCREMENT, mentor_id INTEGER NOT NULL, name TEXT NOT NULL, invite_code TEXT UNIQUE NOT NULL, description TEXT DEFAULT '', max_students INTEGER DEFAULT 30, is_active INTEGER DEFAULT 1, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (mentor_id) REFERENCES mentors(id))`,
      `CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, school_name TEXT DEFAULT '', grade INTEGER DEFAULT 1, profile_emoji TEXT DEFAULT '😊', xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1, last_login_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (group_id) REFERENCES groups(id))`,
      `CREATE TABLE IF NOT EXISTS exams (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'midterm', start_date TEXT NOT NULL, subjects TEXT NOT NULL DEFAULT '[]', status TEXT DEFAULT 'upcoming', memo TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS exam_results (id INTEGER PRIMARY KEY AUTOINCREMENT, exam_id INTEGER NOT NULL UNIQUE, student_id INTEGER NOT NULL, total_score INTEGER, grade INTEGER, subjects_data TEXT NOT NULL DEFAULT '[]', overall_reflection TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (exam_id) REFERENCES exams(id), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS wrong_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, exam_result_id INTEGER NOT NULL, student_id INTEGER NOT NULL, subject TEXT NOT NULL, question_number INTEGER, topic TEXT DEFAULT '', error_type TEXT DEFAULT '', my_answer TEXT DEFAULT '', correct_answer TEXT DEFAULT '', reason TEXT DEFAULT '', reflection TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (exam_result_id) REFERENCES exam_results(id), FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS wrong_answer_images (id INTEGER PRIMARY KEY AUTOINCREMENT, wrong_answer_id INTEGER NOT NULL, image_data TEXT NOT NULL, sort_order INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (wrong_answer_id) REFERENCES wrong_answers(id))`,
      `CREATE TABLE IF NOT EXISTS assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, title TEXT NOT NULL, description TEXT DEFAULT '', teacher_name TEXT DEFAULT '', due_date TEXT NOT NULL, status TEXT DEFAULT 'pending', progress INTEGER DEFAULT 0, color TEXT DEFAULT '#6C5CE7', plan_data TEXT DEFAULT '[]', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS class_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, date TEXT NOT NULL, content TEXT DEFAULT '', keywords TEXT DEFAULT '[]', understanding INTEGER DEFAULT 3, memo TEXT DEFAULT '', topic TEXT DEFAULT '', pages TEXT DEFAULT '', photos TEXT DEFAULT '[]', teacher_note TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS question_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, question_text TEXT NOT NULL, question_level TEXT DEFAULT '', question_label TEXT DEFAULT '', axis TEXT DEFAULT 'curiosity', coaching_messages TEXT DEFAULT '[]', xp_earned INTEGER DEFAULT 0, is_complete INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS teach_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT NOT NULL, topic TEXT NOT NULL, taught_to TEXT DEFAULT '', content TEXT DEFAULT '', reflection TEXT DEFAULT '', xp_earned INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id))`,
      `CREATE TABLE IF NOT EXISTS activity_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, activity_type TEXT DEFAULT '', title TEXT NOT NULL, description TEXT DEFAULT '', start_date TEXT, end_date TEXT, status TEXT DEFAULT 'in-progress', progress INTEGER DEFAULT 0, reflection TEXT DEFAULT '', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id))`,
      // 활동 로그 별도 테이블 (날짜별 기록 보장)
      `CREATE TABLE IF NOT EXISTS activity_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, activity_record_id INTEGER NOT NULL, student_id INTEGER NOT NULL, date TEXT NOT NULL, content TEXT NOT NULL DEFAULT '', reflection TEXT DEFAULT '', duration TEXT DEFAULT '', xp_earned INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (activity_record_id) REFERENCES activity_records(id), FOREIGN KEY (student_id) REFERENCES students(id))`,
      // 탐구보고서 기록 테이블
      `CREATE TABLE IF NOT EXISTS report_records (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, title TEXT NOT NULL, subject TEXT DEFAULT '', phase TEXT DEFAULT '', timeline TEXT DEFAULT '[]', questions TEXT DEFAULT '[]', total_xp INTEGER DEFAULT 0, status TEXT DEFAULT 'in-progress', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id))`,
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
      // ===== 나만의 질문방 테이블 =====
      `CREATE TABLE IF NOT EXISTS my_questions (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, subject TEXT DEFAULT '기타', class_record_id INTEGER DEFAULT NULL, title TEXT NOT NULL, content TEXT DEFAULT '', image_key TEXT DEFAULT NULL, thumbnail_key TEXT DEFAULT NULL, status TEXT DEFAULT '미답변', question_level TEXT DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE TABLE IF NOT EXISTS my_answers (id INTEGER PRIMARY KEY AUTOINCREMENT, question_id INTEGER NOT NULL, student_id INTEGER NOT NULL, content TEXT DEFAULT '', image_key TEXT DEFAULT NULL, resolve_hours REAL DEFAULT NULL, resolve_days INTEGER DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (question_id) REFERENCES my_questions(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_my_questions_student ON my_questions(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_my_questions_status ON my_questions(student_id, status)`,
      `CREATE INDEX IF NOT EXISTS idx_my_questions_subject ON my_questions(student_id, subject)`,
      `CREATE INDEX IF NOT EXISTS idx_my_answers_question ON my_answers(question_id)`,
      // ===== XP 내역 기록 테이블 =====
      `CREATE TABLE IF NOT EXISTS xp_history (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, amount INTEGER NOT NULL, source TEXT NOT NULL, source_detail TEXT DEFAULT '', ref_table TEXT DEFAULT NULL, ref_id INTEGER DEFAULT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_xp_history_student ON xp_history(student_id, created_at DESC)`,
      // class_records 새 컬럼 추가 (기존 테이블 호환)
      `ALTER TABLE class_records ADD COLUMN topic TEXT DEFAULT ''`,
      `ALTER TABLE class_records ADD COLUMN pages TEXT DEFAULT ''`,
      `ALTER TABLE class_records ADD COLUMN photos TEXT DEFAULT '[]'`,
      `ALTER TABLE class_records ADD COLUMN teacher_note TEXT DEFAULT ''`,
      // ===== 수업 기록 사진 별도 저장 테이블 =====
      `CREATE TABLE IF NOT EXISTS class_record_photos (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, class_record_id INTEGER, photo_data TEXT NOT NULL, thumbnail TEXT DEFAULT '', mime_type TEXT DEFAULT 'image/jpeg', file_size INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_crp_student ON class_record_photos(student_id)`,
      `CREATE INDEX IF NOT EXISTS idx_crp_record ON class_record_photos(class_record_id)`,
      // ===== 멘토 피드백 테이블 =====
      `CREATE TABLE IF NOT EXISTS mentor_feedbacks (id INTEGER PRIMARY KEY AUTOINCREMENT, mentor_id INTEGER NOT NULL, student_id INTEGER NOT NULL, record_type TEXT NOT NULL DEFAULT 'general', record_id INTEGER DEFAULT NULL, content TEXT NOT NULL, feedback_type TEXT DEFAULT 'note', is_read INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (mentor_id) REFERENCES mentors(id), FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE)`,
      `CREATE INDEX IF NOT EXISTS idx_mf_student ON mentor_feedbacks(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_mf_mentor ON mentor_feedbacks(mentor_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_mf_record ON mentor_feedbacks(record_type, record_id)`,
      `CREATE INDEX IF NOT EXISTS idx_mf_unread ON mentor_feedbacks(student_id, is_read)`,
      // 크로켓 포인트 테이블
      `CREATE TABLE IF NOT EXISTS croquet_points (id INTEGER PRIMARY KEY AUTOINCREMENT, student_id INTEGER NOT NULL, mentor_id INTEGER NOT NULL, amount INTEGER NOT NULL, reason TEXT NOT NULL DEFAULT '기타', reason_detail TEXT DEFAULT '', balance_after INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE, FOREIGN KEY (mentor_id) REFERENCES mentors(id))`,
      `CREATE INDEX IF NOT EXISTS idx_cp_student ON croquet_points(student_id, created_at DESC)`,
      `CREATE INDEX IF NOT EXISTS idx_cp_mentor ON croquet_points(mentor_id, created_at DESC)`,
      // students 테이블에 croquet_balance 컬럼 추가
      `ALTER TABLE students ADD COLUMN croquet_balance INTEGER NOT NULL DEFAULT 0`,
    ];
    for (const sql of stmts) {
      try { await c.env.DB.prepare(sql).run(); } catch(_) { /* column may already exist */ }
    }
    return c.json({ success: true, message: 'Migration completed', tables: 17 });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


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

// 멘토 → 학생 포인트 지급 (단일)
app.post('/api/mentor/croquet-points/give', async (c) => {
  try {
    const { mentorId, studentId, amount, reason, reasonDetail } = await c.req.json();
    if (!mentorId || !studentId || !amount || amount <= 0) {
      return c.json({ error: '필수 입력값을 확인해주세요' }, 400);
    }
    if (amount > 10000) return c.json({ error: '1회 최대 10,000P까지 지급 가능합니다' }, 400);

    // 잔액 업데이트
    await c.env.DB.prepare('UPDATE students SET croquet_balance = croquet_balance + ? WHERE id = ?').bind(amount, studentId).run();
    const student: any = await c.env.DB.prepare('SELECT croquet_balance FROM students WHERE id = ?').bind(studentId).first();
    const newBalance = student?.croquet_balance || 0;

    // 이력 저장
    await c.env.DB.prepare(
      'INSERT INTO croquet_points (student_id, mentor_id, amount, reason, reason_detail, balance_after) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(studentId, mentorId, amount, reason || '기타', reasonDetail || '', newBalance).run();

    return c.json({ success: true, newBalance, amount });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 멘토 → 학생 일괄 포인트 지급
app.post('/api/mentor/croquet-points/give-bulk', async (c) => {
  try {
    const { mentorId, studentIds, amount, reason, reasonDetail } = await c.req.json();
    if (!mentorId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0 || !amount || amount <= 0) {
      return c.json({ error: '필수 입력값을 확인해주세요' }, 400);
    }
    if (amount > 10000) return c.json({ error: '1회 최대 10,000P까지 지급 가능합니다' }, 400);

    const results: any[] = [];
    for (const sid of studentIds) {
      await c.env.DB.prepare('UPDATE students SET croquet_balance = croquet_balance + ? WHERE id = ?').bind(amount, sid).run();
      const student: any = await c.env.DB.prepare('SELECT croquet_balance, name FROM students WHERE id = ?').bind(sid).first();
      const newBalance = student?.croquet_balance || 0;
      await c.env.DB.prepare(
        'INSERT INTO croquet_points (student_id, mentor_id, amount, reason, reason_detail, balance_after) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(sid, mentorId, amount, reason || '기타', reasonDetail || '', newBalance).run();
      results.push({ studentId: sid, name: student?.name, newBalance, amount });
    }

    return c.json({ success: true, count: results.length, results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 멘토 지급 이력 조회
app.get('/api/mentor/:mentorId/croquet-points/history', async (c) => {
  try {
    const mentorId = c.req.param('mentorId');
    const month = c.req.query('month'); // YYYY-MM 형식
    const limit = parseInt(c.req.query('limit') || '100');

    let query = 'SELECT cp.*, s.name as student_name, s.profile_emoji FROM croquet_points cp LEFT JOIN students s ON cp.student_id = s.id WHERE cp.mentor_id = ?';
    const binds: any[] = [mentorId];

    if (month) {
      query += " AND strftime('%Y-%m', cp.created_at) = ?";
      binds.push(month);
    }
    query += ' ORDER BY cp.created_at DESC LIMIT ?';
    binds.push(limit);

    const history = await c.env.DB.prepare(query).bind(...binds).all();

    // 이번 달 요약
    const kstNow = new Date(Date.now() + 9 * 3600000);
    const currentMonth = kstNow.toISOString().slice(0, 7);
    const monthlySummary: any = await c.env.DB.prepare(
      "SELECT COUNT(*) as cnt, COALESCE(SUM(amount),0) as total, COUNT(DISTINCT student_id) as students FROM croquet_points WHERE mentor_id = ? AND strftime('%Y-%m', created_at) = ?"
    ).bind(mentorId, currentMonth).first();

    return c.json({
      history: history.results,
      monthlySummary: {
        month: currentMonth,
        totalGiven: monthlySummary?.total || 0,
        giveCount: monthlySummary?.cnt || 0,
        studentCount: monthlySummary?.students || 0,
      }
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 질문 등록
app.post('/api/my-questions', async (c) => {
  try {
    const { studentId, subject, classRecordId, title, content, imageKey, thumbnailKey, questionLevel } = await c.req.json()
    if (!studentId || !title || title.trim().length < 2) return c.json({ error: '질문 제목을 2자 이상 입력해주세요' }, 400)

    const result = await c.env.DB.prepare(
      'INSERT INTO my_questions (student_id, subject, class_record_id, title, content, image_key, thumbnail_key, question_level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, subject || '기타', classRecordId || null, title.trim(), content || '', imageKey || null, thumbnailKey || null, questionLevel || null).run()

    // XP +3 (질문 등록 보상)
    await c.env.DB.prepare('UPDATE students SET xp = xp + 3, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(studentId).run()
    await recordXp(c.env.DB, Number(studentId), 3, '질문 등록', `${subject || '기타'} — ${title.trim().slice(0, 40)}`, 'my_questions', result.meta.last_row_id as number)
    // 레벨 자동 계산
    const student: any = await c.env.DB.prepare('SELECT xp FROM students WHERE id = ?').bind(studentId).first()
    if (student) {
      const newLevel = Math.max(1, Math.floor(student.xp / 100) + 1)
      await c.env.DB.prepare('UPDATE students SET level = ? WHERE id = ?').bind(newLevel, studentId).run()
    }

    return c.json({ success: true, questionId: result.meta.last_row_id, xpEarned: 3 })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 내 질문 목록 조회 (최신순)
app.get('/api/my-questions', async (c) => {
  try {
    const studentId = c.req.query('studentId')
    const status = c.req.query('status') // '미답변' | '답변완료' | undefined(전체)
    const subject = c.req.query('subject')
    if (!studentId) return c.json({ error: 'studentId 필수' }, 400)

    let query = 'SELECT q.*, (SELECT COUNT(*) FROM my_answers a WHERE a.question_id = q.id) as answer_count FROM my_questions q WHERE q.student_id = ?'
    const binds: any[] = [studentId]

    if (status) { query += ' AND q.status = ?'; binds.push(status) }
    if (subject && subject !== '전체') { query += ' AND q.subject = ?'; binds.push(subject) }
    query += ' ORDER BY q.created_at DESC'

    const questions = await c.env.DB.prepare(query).bind(...binds).all()
    return c.json({ questions: questions.results })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 질문 통계 (IMPORTANT: :id 라우트보다 먼저 정의해야 "stats"가 :id로 매칭되지 않음)
app.get('/api/my-questions/stats', async (c) => {
  try {
    const studentId = c.req.query('studentId')
    if (!studentId) return c.json({ error: 'studentId 필수' }, 400)

    const [totalCount, unansweredCount, answeredCount, avgResolve, subjectStats, weeklyCount, weeklyAnswered] = await Promise.all([
      c.env.DB.prepare('SELECT COUNT(*) as cnt FROM my_questions WHERE student_id = ?').bind(studentId).first(),
      c.env.DB.prepare("SELECT COUNT(*) as cnt FROM my_questions WHERE student_id = ? AND status = '미답변'").bind(studentId).first(),
      c.env.DB.prepare("SELECT COUNT(*) as cnt FROM my_questions WHERE student_id = ? AND status = '답변완료'").bind(studentId).first(),
      c.env.DB.prepare('SELECT AVG(resolve_days) as avg_days, AVG(resolve_hours) as avg_hours FROM my_answers WHERE student_id = ?').bind(studentId).first(),
      c.env.DB.prepare('SELECT subject, COUNT(*) as cnt FROM my_questions WHERE student_id = ? GROUP BY subject ORDER BY cnt DESC').bind(studentId).all(),
      c.env.DB.prepare("SELECT COUNT(*) as cnt FROM my_questions WHERE student_id = ? AND created_at >= datetime('now', '-7 days')").bind(studentId).first(),
      c.env.DB.prepare("SELECT COUNT(*) as cnt FROM my_questions WHERE student_id = ? AND status = '답변완료' AND created_at >= datetime('now', '-7 days')").bind(studentId).first(),
    ])

    return c.json({
      total: (totalCount as any)?.cnt || 0,
      unanswered: (unansweredCount as any)?.cnt || 0,
      answered: (answeredCount as any)?.cnt || 0,
      avgResolveDays: Math.round(((avgResolve as any)?.avg_days || 0) * 10) / 10,
      avgResolveHours: Math.round(((avgResolve as any)?.avg_hours || 0) * 10) / 10,
      subjectStats: (subjectStats as any)?.results || [],
      weeklyQuestions: (weeklyCount as any)?.cnt || 0,
      weeklyAnswered: (weeklyAnswered as any)?.cnt || 0,
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 질문 상세 + 답변 조회
app.get('/api/my-questions/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const question: any = await c.env.DB.prepare('SELECT * FROM my_questions WHERE id = ?').bind(id).first()
    if (!question) return c.json({ error: '질문을 찾을 수 없습니다' }, 404)

    const answers = await c.env.DB.prepare('SELECT * FROM my_answers WHERE question_id = ? ORDER BY created_at DESC').bind(id).all()

    return c.json({ question, answers: answers.results })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 본인이 직접 답변 등록
app.post('/api/my-questions/:id/answer', async (c) => {
  try {
    const questionId = c.req.param('id')
    const { studentId, content, imageKey } = await c.req.json()
    if (!studentId || !content || content.trim().length < 2) return c.json({ error: '답변 내용을 2자 이상 입력해주세요' }, 400)

    // 소요 시간 자동 계산
    const question: any = await c.env.DB.prepare('SELECT created_at FROM my_questions WHERE id = ?').bind(questionId).first()
    if (!question) return c.json({ error: '질문을 찾을 수 없습니다' }, 404)

    const resolveHours = (Date.now() - new Date(question.created_at).getTime()) / (1000 * 60 * 60)
    const resolveDays = Math.ceil(resolveHours / 24)

    const result = await c.env.DB.prepare(
      'INSERT INTO my_answers (question_id, student_id, content, image_key, resolve_hours, resolve_days) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(questionId, studentId, content.trim(), imageKey || null, Math.round(resolveHours * 10) / 10, resolveDays).run()

    // 질문 상태를 '답변완료'로 업데이트
    await c.env.DB.prepare("UPDATE my_questions SET status = '답변완료' WHERE id = ?").bind(questionId).run()

    // XP +5 (답변 등록 보상)
    let totalXp = 5
    // 1일 이내 해결 시 보너스 +3
    if (resolveDays <= 1) totalXp += 3

    await c.env.DB.prepare('UPDATE students SET xp = xp + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(totalXp, studentId).run()
    const bonusText = resolveDays <= 1 ? ' (빠른해결 보너스 +3)' : ''
    await recordXp(c.env.DB, Number(studentId), totalXp, '답변 등록', `질문 #${questionId} 답변${bonusText}`, 'my_answers', result.meta.last_row_id as number)
    // 레벨 자동 계산
    const student: any = await c.env.DB.prepare('SELECT xp FROM students WHERE id = ?').bind(studentId).first()
    if (student) {
      const newLevel = Math.max(1, Math.floor(student.xp / 100) + 1)
      await c.env.DB.prepare('UPDATE students SET level = ? WHERE id = ?').bind(newLevel, studentId).run()
    }

    return c.json({ success: true, answerId: result.meta.last_row_id, resolveHours: Math.round(resolveHours * 10) / 10, resolveDays, xpEarned: totalXp, fastBonus: resolveDays <= 1 })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

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

// ==================== 멘토 피드백 API ====================

// 피드백 작성
app.post('/api/mentor/feedback', async (c) => {
  try {
    const { mentorId, studentId, recordType, recordId, content, feedbackType } = await c.req.json();
    if (!mentorId || !studentId || !content) return c.json({ error: '필수 항목 누락' }, 400);
    const result = await c.env.DB.prepare(
      'INSERT INTO mentor_feedbacks (mentor_id, student_id, record_type, record_id, content, feedback_type) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(mentorId, studentId, recordType || 'general', recordId || null, content, feedbackType || 'note').run();
    return c.json({ success: true, id: result.meta.last_row_id });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// 학생별 피드백 조회 (멘토용)
app.get('/api/mentor/feedback/student/:studentId', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const feedbacks = await c.env.DB.prepare(
      'SELECT f.*, m.name as mentor_name FROM mentor_feedbacks f JOIN mentors m ON f.mentor_id = m.id WHERE f.student_id = ? ORDER BY f.created_at DESC LIMIT 100'
    ).bind(studentId).all();
    return c.json({ feedbacks: feedbacks.results });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// 학생이 자기 피드백 조회 + 읽음 처리
app.get('/api/student/:studentId/feedbacks', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const feedbacks = await c.env.DB.prepare(
      'SELECT f.*, m.name as mentor_name FROM mentor_feedbacks f JOIN mentors m ON f.mentor_id = m.id WHERE f.student_id = ? ORDER BY f.created_at DESC LIMIT 50'
    ).bind(studentId).all();
    // 미읽음 개수
    const unread = await c.env.DB.prepare(
      'SELECT COUNT(*) as cnt FROM mentor_feedbacks WHERE student_id = ? AND is_read = 0'
    ).bind(studentId).first();
    return c.json({ feedbacks: feedbacks.results, unreadCount: (unread as any)?.cnt || 0 });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// 피드백 읽음 처리
app.put('/api/student/feedback/:feedbackId/read', async (c) => {
  try {
    const feedbackId = c.req.param('feedbackId');
    await c.env.DB.prepare('UPDATE mentor_feedbacks SET is_read = 1 WHERE id = ?').bind(feedbackId).run();
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// 피드백 수정
app.put('/api/mentor/feedback/:feedbackId', async (c) => {
  try {
    const feedbackId = c.req.param('feedbackId');
    const { content, feedbackType } = await c.req.json();
    const fields: string[] = []; const values: any[] = [];
    if (content !== undefined) { fields.push('content = ?'); values.push(content); }
    if (feedbackType !== undefined) { fields.push('feedback_type = ?'); values.push(feedbackType); }
    fields.push("updated_at = datetime('now')");
    values.push(feedbackId);
    await c.env.DB.prepare(`UPDATE mentor_feedbacks SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// 피드백 삭제
app.delete('/api/mentor/feedback/:feedbackId', async (c) => {
  try {
    const feedbackId = c.req.param('feedbackId');
    await c.env.DB.prepare('DELETE FROM mentor_feedbacks WHERE id = ?').bind(feedbackId).run();
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// ==================== 헬스체크 ====================
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    services: {
      openai: !!c.env.OPENAI_API_KEY,
      anthropic: !!c.env.ANTHROPIC_API_KEY,
      gemini: !!c.env.GEMINI_API_KEY,
      perplexity: !!c.env.PERPLEXITY_API_KEY
    }
  })
})

app.get('/', (c) => {
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
          <div id="app-content"></div>
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
          <div id="tablet-content"></div>
        </div>
      </div>
      <div id="desktop-container" style="display:none">
        <div id="desktop-content"></div>
      </div>
    </div>
  </div>
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="/static/app.js"></script>
  <script>
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/static/sw.js')
          .then(reg => {
            console.log('SW registered:', reg.scope);
            // 새 SW가 대기 중이면 즉시 활성화
            reg.addEventListener('updatefound', () => {
              const newSW = reg.installing;
              if (newSW) {
                newSW.addEventListener('statechange', () => {
                  if (newSW.state === 'activated' && navigator.serviceWorker.controller) {
                    console.log('[PWA] New version available');
                    if (typeof window._showPwaUpdateToast === 'function') window._showPwaUpdateToast();
                  }
                });
              }
            });
          })
          .catch(err => console.log('SW registration failed:', err));
      });
      // 컨트롤러 변경 시 새로고침 (새 SW 활성화 완료)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (window._swReloading) return;
        window._swReloading = true;
      });
    }
  </script>
</body>
</html>`)
})

export default app
