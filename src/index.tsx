import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-pages'

type Bindings = {
  OPENAI_API_KEY: string
  ANTHROPIC_API_KEY: string
  GEMINI_API_KEY: string
  PERPLEXITY_API_KEY: string
  QA_APP_SECRET: string
  ADMIN_KEY: string     // 관리자 API 인증 키
  JYSK_API_URL: string  // 원격 DB API 프록시 URL
  JYSK_API_KEY: string  // 원격 DB API 키
  DB: D1Database
  R2: R2Bucket
  KV: KVNamespace
}

const app = new Hono<{ Bindings: Bindings }>()

app.use('/api/*', cors())

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

// ==================== KST (한국 표준시) 헬퍼 ====================
function getKSTNow(): Date {
  return new Date(Date.now() + 9 * 3600000);
}
function getKSTString(): string {
  // 'YYYY-MM-DD HH:MM:SS' 형식의 KST 시간 문자열
  return getKSTNow().toISOString().slice(0, 19).replace('T', ' ');
}
function getKSTDate(): string {
  // 'YYYY-MM-DD' 형식의 KST 날짜
  return getKSTNow().toISOString().slice(0, 10);
}

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

// ==================== Gemini 2.5 Flash 다중 이미지 헬퍼 ====================

const GEMINI_MODEL = 'gemini-3-flash-preview'

// 단일 이미지 OCR (병렬 처리용)
async function callGeminiOcrSingle(geminiKey: string, image: { mime_type: string, data: string }, tag: string, index: number) {
  const ocrPrompt = `이 사진(${tag})의 모든 텍스트를 정확히 읽어주세요. 수식은 LaTeX($...$) 변환. 줄바꿈 유지. 텍스트만 반환.`
  const parts: any[] = [{ text: ocrPrompt }, { inline_data: image }]

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      })
    }
  )

  if (!res.ok) throw new Error(`OCR 실패 (사진${index + 1}): ${res.status}`)
  const data: any = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// Sonnet 분석 호출 (텍스트 전용)
async function callSonnetAnalysis(anthropicKey: string, systemPrompt: string, userPrompt: string, jsonMode: boolean = true, temperature: number = 0.3) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 8192,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sonnet 분석 실패 (${res.status}): ${err}`)
  }

  const data: any = await res.json()
  return data.content[0].text
}

async function callGeminiMultiImage(opts: {
  geminiKey: string,
  openaiKey: string,
  anthropicKey?: string,
  systemPrompt?: string,
  prompt: string,
  userContext?: string,
  images: Array<{ mime_type: string, data: string }>,
  tags?: string[],
  jsonMode?: boolean,
  temperature?: number,
}) {
  const { geminiKey, openaiKey, anthropicKey, systemPrompt, prompt, userContext, images, tags = [], jsonMode = true, temperature = 0.3 } = opts

  // ================================================================
  // 2단계 파이프라인: Gemini OCR (병렬) → Sonnet 분석
  // ================================================================

  // STEP 1: Gemini OCR — 모든 사진을 병렬로 텍스트 추출
  let ocrText = ''
  let ocrSuccess = false

  try {
    console.log(`[OCR] ${images.length}장 사진 Gemini OCR 시작`)

    if (images.length >= 3) {
      // 3장 이상: 병렬 OCR
      const ocrPromises = images.map((img, i) =>
        callGeminiOcrSingle(geminiKey, img, tags[i] || '노트', i)
          .catch(e => { console.log(`OCR 사진${i + 1} 실패:`, e); return `(사진${i + 1} OCR 실패)` })
      )
      const ocrResults = await Promise.all(ocrPromises)
      ocrText = ocrResults.map((text, i) => {
        const tag = tags[i] || '노트'
        const label = tag === '필기' ? '[Note_OCR]' : '[Reference_OCR]'
        return `--- 사진${i + 1} ${label} ${tag} ---\n${text}`
      }).join('\n\n')
      ocrSuccess = true
    } else {
      // 1~2장: 한 번에 OCR
      const parts: any[] = [
        { text: '모든 사진의 텍스트를 정확히 읽어주세요. 수식은 LaTeX($...$) 변환. 줄바꿈 유지. 각 사진별로 구분해서 텍스트만 반환.' }
      ]
      for (const img of images) {
        parts.push({ inline_data: img })
      }
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
          })
        }
      )
      if (geminiRes.ok) {
        const data: any = await geminiRes.json()
        const rawOcr = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
        ocrText = images.map((_, i) => {
          const tag = tags[i] || '노트'
          const label = tag === '필기' ? '[Note_OCR]' : '[Reference_OCR]'
          return `--- 사진${i + 1} ${label} ${tag} ---`
        }).join('\n') + '\n\n' + rawOcr
        ocrSuccess = true
      }
    }
    if (ocrSuccess) console.log(`[OCR] 완료 (${ocrText.length}자)`)
  } catch (e) {
    console.log('[OCR] Gemini OCR 실패:', e)
  }

  // STEP 2: Sonnet 분석 (OCR 성공 + Anthropic 키 있을 때)
  if (ocrSuccess && anthropicKey) {
    try {
      console.log('[분석] Sonnet 분석 시작')
      const sysPrompt = systemPrompt || prompt
      const usrPrompt = (userContext || '') + `\n\n=== OCR 결과 ===\n${ocrText}\n\n위 JSON 형식으로만 응답하세요.`
      const text = await callSonnetAnalysis(anthropicKey, sysPrompt, usrPrompt, jsonMode, temperature)
      console.log('[분석] Sonnet 분석 완료')
      return { text, source: 'gemini-ocr+sonnet' }
    } catch (e) {
      console.log('[분석] Sonnet 실패, Gemini 분석으로 폴백:', e)
    }
  }

  // STEP 2 폴백A: Gemini 자체 분석 (OCR 텍스트 있으면 텍스트만, 없으면 이미지 포함)
  try {
    if (ocrSuccess) {
      console.log('[분석] Gemini 텍스트 분석 폴백')
      const textPrompt = prompt + `\n\n=== OCR 결과 ===\n${ocrText}\n\n위 JSON 형식으로만 응답하세요.`
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: textPrompt }] }],
            generationConfig: {
              temperature,
              ...(jsonMode ? { responseMimeType: 'application/json' } : { maxOutputTokens: 8192 })
            }
          })
        }
      )
      if (geminiRes.ok) {
        const data: any = await geminiRes.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        return { text, source: `${GEMINI_MODEL}-fallback` }
      }
    } else {
      // OCR도 실패: 이미지 직접 전송
      console.log('[분석] Gemini 이미지 직접 분석 폴백')
      const parts: any[] = [{ text: prompt }]
      for (const img of images) {
        parts.push({ inline_data: img })
      }
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature,
              ...(jsonMode ? { responseMimeType: 'application/json' } : { maxOutputTokens: 4096 })
            }
          })
        }
      )
      if (geminiRes.ok) {
        const data: any = await geminiRes.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        return { text, source: GEMINI_MODEL }
      }
    }
    console.log(`${GEMINI_MODEL} 분석 실패, OpenAI로 폴백`)
  } catch (e) {
    console.log(`${GEMINI_MODEL} 에러, OpenAI로 폴백:`, e)
  }

  // STEP 2 폴백B: OpenAI (텍스트만)
  const fallbackPrompt = ocrSuccess
    ? prompt + `\n\n=== OCR 결과 ===\n${ocrText}\n\n위 JSON 형식으로만 응답하세요.`
    : prompt
  const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: fallbackPrompt }],
      temperature,
      ...(jsonMode ? { response_format: { type: 'json_object' } } : {})
    })
  })

  if (!openaiRes.ok) {
    const err = await openaiRes.text()
    throw new Error(`모든 AI 폴백 실패: ${err}`)
  }

  const openaiData: any = await openaiRes.json()
  const text = openaiData.choices[0].message.content
  return { text, source: 'openai' }
}

// ==================== MY CREDIT LOG 시스템 프롬프트 ====================

const SYSTEM_PROMPT_CREDIT_LOG = `# Role
당신은 [Subject] 분야의 최고 수준 일타강사이자 학습 코치입니다.
선생님이 이 수업에서 무엇을 의도했는지 꿰뚫어 보고,
이 내용이 시험에서 어떻게 출제되는지 정확히 알고 있습니다.
학생의 날 것의 필기를 보며 놓친 핵심을 짚어주고,
"아, 이래서 이걸 배우는 거구나"를 깨닫는 순간을 만드는 것이 목표입니다.
교학상장(敎學相長) — 학생이 스스로 질문하고 성장하도록 돕습니다.

# Input Data
- [Subject]: 과목명
- [Student_Comment]: 학생이 입력한 오늘 수업 소감 / 궁금한 점 / 수업 후 느낀 점 (없을 수 있음)
- [Note_OCR]: 필기 노트 OCR 텍스트 (MY CREDIT LOG 양식)
- [Reference_OCR_1~N]: 참고사진 OCR 텍스트 (교과서/프린트/칠판 등, 없을 수 있음)

# 수식 처리 규칙 (절대 예외 없음)
다음에 해당하는 모든 표현을 LaTeX으로 변환한다:

변환 대상:
- 사칙연산: x+y, x-y, x*y, x/y
- 거듭제곱: x², x³, x^n → $x^2$, $x^3$, $x^n$
- 분수: a/b 형태 → $\\frac{a}{b}$
- 루트: √x, √(a+b) → $\\sqrt{x}$, $\\sqrt{a+b}$
- 방정식: ax²+bx+c=0 → $ax^2+bx+c=0$
- 함수: f(x), sin(x), cos(x), log(x) → $f(x)$, $\\sin(x)$, $\\cos(x)$, $\\log(x)$
- 극한: lim → $\\lim$
- 적분: ∫ → $\\int$
- 벡터: a→ → $\\vec{a}$
- 집합: ∈, ∪, ∩ → $\\in$, $\\cup$, $\\cap$
- 부등호: ≤, ≥ → $\\leq$, $\\geq$
- 그리스 문자: α, β, θ, π → $\\alpha$, $\\beta$, $\\theta$, $\\pi$

규칙:
1. 인라인 수식: $수식$ 형식 (문장 중간)
2. 블록 수식: $$수식$$ 형식 (단독 줄)
3. 텍스트에서 수학적 표현이 보이면 무조건 LaTeX으로 변환
4. 절대 일반 텍스트로 수식을 출력하지 말 것
5. 변환 예시: "x의 제곱" → $x^2$, "루트 2" → $\\sqrt{2}$, "a분의 b" → $\\frac{b}{a}$, "2x+3=7" → $2x+3=7$

# 공통 처리 규칙
1. 학생 문장은 의미·의도를 보존하되 자연스럽고 품격 있게 다듬기
2. 내용 없는 섹션은 빈값 유지 (절대 임의 생성 금지)
3. 말투: 코치처럼 따뜻하게 격려하되 전문성 있게

# Instructions

## 1. 수업 맥락 요약 (Context Summary)
- 일타강사의 시각으로: 선생님이 이 수업을 통해 진짜 가르치려 한 것이 무엇인지 파악
- 노트와 참고사진 전체를 하나의 흐름으로 연결하여 핵심 주제 3문장 이내로 요약
- [Student_Comment]가 있다면 반드시 먼저 공감하고 통찰 제시
- 단순 요약이 아닌 "왜 이걸 배우는가"의 교육적 의미까지 포함

## 2. 시험 연결 포인트 (Exam Connection)
- 일타강사로서: 오늘 배운 내용 중 시험에 반드시 나오는 포인트 2~3개 명시
- "선생님이 강조한 이 부분은 이런 유형으로 출제됩니다" 형식
- 수험생 입장에서 절대 놓치면 안 되는 개념·공식·논리 흐름 짚기

## 3. 핵심 논리 분석 (Deep Dive)
- 학생 필기 중 가장 깊은 사고가 담긴 지점 하나를 선택하여 구체적으로 칭찬
- 고난도 문제/서술형 시도가 있다면 정답 여부와 무관하게 논리적 접근 과정 심층 분석
- 학생이 미처 발전시키지 못한 사고의 방향을 한 걸음 더 안내

## 4. 세특 소재 질문 정제 (Seteuk Questions)
- 학생이 노트에 작성한 질문들을 추출
- 각 질문을 선생님께 실제로 여쭤볼 수 있는 전문적인 수준으로 다듬기
- 원문과 다듬은 버전을 함께 제공 (학생이 자신의 생각이 발전하는 걸 체감하도록)
- send_to_qbox: true → 나의 질문함에 자동 저장

## 5. 메타인지 자극 질문 (Active Recall)
- 오늘 학습에서 가장 헷갈리기 쉽거나 시험에 자주 나오는 부분
- "왜 이렇게 될까?", "조건이 바뀌면 어떻게 될까?" 중심의 Why·What if 질문 2개
- 질문과 답변을 반드시 분리된 필드로 제공 (UI에서 답 가리기 기능 연동)

## 6. 세특 관찰 코멘트 (Teacher Insight)
- 자기주도성 / 문제해결력 / 지적 호기심 중심으로 분석
- 학교생활기록부 세특에 직접 참고할 수 있는 수준의 관찰 코멘트
- 분량: 300~400자, 객관적이고 전문적인 톤

## 7. 과제 추출 (Assignment)
- 사진에서 "과제", "숙제", "제출", "~까지", "~해오세요" 등 과제 관련 내용을 찾는다
- 과제가 발견되면 구조화하여 반환, 없으면 null

# Output Format (반드시 이 JSON 형식으로만 응답)
{
  "topic": "단원/주제",
  "pages": "p.XX~XX",
  "summary": "수업 맥락 요약 (3문장 이내)",
  "exam_connection": ["시험 연결 포인트 1", "시험 연결 포인트 2", "시험 연결 포인트 3"],
  "deep_dive": "핵심 논리 분석 텍스트",
  "highlights": "선생님 강조 포인트 (여러 줄 가능)",
  "keywords": ["키워드1", "키워드2", "키워드3", "키워드4", "키워드5"],
  "questions": [
    { "original": "학생 원본 질문", "improved": "AI 고도화 질문", "send_to_qbox": true },
    { "original": "학생 원본 질문", "improved": "AI 고도화 질문", "send_to_qbox": true },
    { "original": "학생 원본 질문", "improved": "AI 고도화 질문", "send_to_qbox": true }
  ],
  "active_recall": [
    { "question": "메타인지 질문 1", "answer": "답변 1" },
    { "question": "메타인지 질문 2", "answer": "답변 2" }
  ],
  "teacher_insight": "세특 관찰 코멘트 (300~400자)",
  "assignment": null 또는 { "title": "과제 제목", "description": "과제 상세", "dueDate": "YYYY-MM-DD 또는 빈 문자열", "dueDateRaw": "원문 마감일 표현" },
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
        model: 'claude-sonnet-4-6',
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


// ==================== API 라우트: MY CREDIT LOG AI 분석 (Gemini 2.5 Flash) ====================

app.post('/api/ai/credit-log', async (c) => {
  try {
    const { images, subject, period, date, studentComment } = await c.req.json()
    if (!images || images.length === 0) return c.json({ success: false, error: '사진이 필요합니다' }, 400)

    // base64 prefix 제거 + inline_data 배열 생성
    const inlineImages = images.map((img: any) => ({
      mime_type: img.mimeType || 'image/jpeg',
      data: (img.base64 || '').replace(/^data:image\/\w+;base64,/, '')
    }))

    // Note_OCR / Reference_OCR 구분 정보
    const tagInfo = images.map((img: any, i: number) => {
      const tag = img.tag || '노트'
      return tag === '필기' ? `사진${i + 1}: [Note_OCR] 필기 노트` : `사진${i + 1}: [Reference_OCR] 참고사진 (${tag})`
    }).join('\n')

    // [Subject] 동적 치환 — system prompt와 user prompt 분리
    const systemPrompt = SYSTEM_PROMPT_CREDIT_LOG.replace(/\[Subject\]/g, subject || '미지정')
    const userContext = `[Subject]: ${subject || '미지정'}\n교시: ${period || '미지정'}교시\n날짜: ${date || '미지정'}\n${studentComment ? `[Student_Comment]: ${studentComment}\n` : ''}사진 구성:\n${tagInfo}`
    // Gemini용 (system+user 합침)
    const fullPrompt = systemPrompt + `\n\n---\n${userContext}\n\n위 JSON 형식으로만 응답하세요.`

    // 병렬 OCR용 태그 배열
    const imageTags = images.map((img: any) => img.tag || '참고')

    const { text } = await callGeminiMultiImage({
      geminiKey: c.env.GEMINI_API_KEY,
      openaiKey: c.env.OPENAI_API_KEY,
      anthropicKey: c.env.ANTHROPIC_API_KEY,
      systemPrompt,
      prompt: fullPrompt,
      userContext,
      images: inlineImages,
      tags: imageTags,
      jsonMode: true,
      temperature: 0.3,
    })

    try {
      const result = JSON.parse(text)
      // assignment 정규화: 문자열 → 구조화된 객체, 빈 값 → null
      if (typeof result.assignment === 'string' && result.assignment.trim()) {
        result.assignment = {
          title: result.assignment.replace(/\s*기한:.*$/, '').substring(0, 50).trim(),
          description: result.assignment,
          dueDate: '',
          dueDateRaw: '',
        }
      } else if (!result.assignment || (typeof result.assignment === 'string' && !result.assignment.trim())) {
        result.assignment = null
      }
      return c.json({ success: true, data: result })
    } catch {
      return c.json({ success: true, data: { rawOcrText: text, topic: '', pages: '', summary: '', exam_connection: [], deep_dive: '', highlights: '', keywords: [], questions: [], active_recall: [], teacher_insight: '', assignment: null } })
    }
  } catch (e: any) {
    console.error('credit-log AI error:', e)
    return c.json({ success: false, error: e.message }, 500)
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
        model: 'claude-sonnet-4-6',
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


// ==================== AUTH API: 원장 로그인 ====================
app.post('/api/auth/director/login', async (c) => {
  try {
    const { loginId, password } = await c.req.json();
    if (!loginId || !password) return c.json({ error: '아이디와 비밀번호를 입력해주세요' }, 400);

    const mentor: any = await c.env.DB.prepare(
      'SELECT * FROM mentors WHERE login_id = ? AND is_director = 1'
    ).bind(loginId).first();

    if (!mentor) return c.json({ error: '원장 아이디 또는 비밀번호가 틀렸습니다' }, 401);

    const valid = await verifyPassword(password, mentor.password_hash);
    if (!valid) return c.json({ error: '원장 아이디 또는 비밀번호가 틀렸습니다' }, 401);

    // 원장은 모든 그룹 조회 가능
    const groups = await c.env.DB.prepare(
      'SELECT g.id, g.name, g.invite_code, g.description, g.max_students, g.is_active, m.name as mentor_name FROM groups g JOIN mentors m ON g.mentor_id = m.id'
    ).all();

    const token = generateToken();

    return c.json({
      success: true,
      token,
      role: 'director',
      user: {
        id: mentor.id,
        loginId: mentor.login_id,
        name: mentor.name,
        academyName: mentor.academy_name,
        kind: 1,
      },
      groups: groups.results
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


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
          for (const cls of studentsData.classes) {
            // 반 생성
            const inviteCode = generateInviteCode();
            const groupResult = await c.env.DB.prepare(
              'INSERT INTO groups (mentor_id, name, invite_code, description, external_class_id) VALUES (?, ?, ?, ?, ?)'
            ).bind(mentorId, cls.class_name || `반${cls.class_id}`, inviteCode, '', cls.class_id).run();
            const groupId = groupResult.meta.last_row_id;

            // 학생들 자동 생성
            for (const st of cls.students) {
              const exists = await c.env.DB.prepare(
                'SELECT id FROM students WHERE external_user_id = ?'
              ).bind(st.user_id).first();
              if (!exists) {
                const stPwHash = await hashPassword(`ext_${st.user_id}_auto`);
                const emojis = ['😊','😎','🤓','🦊','🐱','🐶','🦁','🐻','🐼','🐨','🦄','🐸','🐰','🐯'];
                const emoji = emojis[Math.floor(Math.random() * emojis.length)];
                await c.env.DB.prepare(
                  'INSERT INTO students (group_id, name, password_hash, school_name, grade, profile_emoji, external_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
                ).bind(groupId, st.name, stPwHash, '', 0, emoji, st.user_id).run();
              }
            }
          }
        } else {
          // 반/학생 정보 없으면 기본 반 생성
          const inviteCode = generateInviteCode();
          await c.env.DB.prepare(
            'INSERT INTO groups (mentor_id, name, invite_code, description) VALUES (?, ?, ?, ?)'
          ).bind(mentorId, `${name} 선생님 반`, inviteCode, '').run();
        }

        mentor = await c.env.DB.prepare('SELECT * FROM mentors WHERE id = ?').bind(mentorId).first();
      } else {
        // 멘토 이름 동기화
        if (mentor.name !== name) {
          await c.env.DB.prepare('UPDATE mentors SET name = ? WHERE id = ?').bind(name, mentor.id).run();
          mentor.name = name;
        }
      }

      // 멘토 그룹 목록 조회
      const groups = await c.env.DB.prepare(
        'SELECT id, name, invite_code, description, max_students, is_active FROM groups WHERE mentor_id = ?'
      ).bind(mentor.id).all();

      const token = generateToken();
      return c.json({
        success: true,
        token,
        role: 'mentor',
        externalUserId: remoteUserId,
        user: { id: mentor.id, loginId: mentor.login_id, name: mentor.name, academyName: mentor.academy_name, phone: mentor.phone },
        groups: groups.results,
      });

    } else if (kind === 2) {
      // ===== 학생 =====
      let student: any = await c.env.DB.prepare(
        'SELECT s.*, g.name as group_name, g.invite_code FROM students s LEFT JOIN groups g ON s.group_id = g.id WHERE s.external_user_id = ? AND s.is_active = 1'
      ).bind(remoteUserId).first();

      if (!student) {
        // 학생이 아직 로컬에 없으면 자동 생성 (기본 그룹에 배치)
        // 원격 DB에서 이 학생이 속한 반의 멘토를 찾아 해당 그룹에 배치
        const stPwHash = await hashPassword(`ext_${remoteUserId}_auto`);
        const emojis = ['😊','😎','🤓','🦊','🐱','🐶','🦁','🐻','🐼','🐨','🦄','🐸','🐰','🐯'];
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];

        // 첫 번째 그룹에 임시 배치 (나중에 멘토 로그인 시 올바른 그룹으로 재배치됨)
        const firstGroup: any = await c.env.DB.prepare('SELECT id FROM groups LIMIT 1').first();
        const groupId = firstGroup?.id || 1;

        const result = await c.env.DB.prepare(
          'INSERT INTO students (group_id, name, password_hash, school_name, grade, profile_emoji, external_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
        ).bind(groupId, name, stPwHash, '', 0, emoji, remoteUserId).run();

        student = await c.env.DB.prepare(
          'SELECT s.*, g.name as group_name, g.invite_code FROM students s LEFT JOIN groups g ON s.group_id = g.id WHERE s.id = ?'
        ).bind(result.meta.last_row_id).first();
      } else {
        // 이름 동기화
        if (student.name !== name) {
          await c.env.DB.prepare('UPDATE students SET name = ? WHERE id = ?').bind(name, student.id).run();
          student.name = name;
        }
      }

      await c.env.DB.prepare('UPDATE students SET last_login_at = ? WHERE id = ?').bind(getKSTString(), student.id).run();

      const group: any = student.group_name ? {
        id: student.group_id, name: student.group_name,
        mentorName: '정율사관학원', academyName: '정율사관학원',
      } : null;

      const token = generateToken();
      return c.json({
        success: true,
        token,
        role: 'student',
        externalUserId: remoteUserId,
        user: { id: student.id, name: student.name, schoolName: student.school_name, grade: student.grade, profileEmoji: student.profile_emoji, xp: student.xp || 0, level: student.level || 1, groupId: student.group_id },
        group,
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

    // 그룹 정보 가져오기
    const group: any = await c.env.DB.prepare(
      'SELECT g.*, m.name as mentor_name, m.academy_name FROM groups g JOIN mentors m ON g.mentor_id = m.id WHERE g.id = ?'
    ).bind(student.group_id).first();

    // 마지막 로그인 시간 업데이트
    await c.env.DB.prepare(
      'UPDATE students SET last_login_at = ? WHERE id = ?'
    ).bind(getKSTString(), student.id).run();

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
      group: group ? {
        id: group.id,
        name: group.name,
        mentorName: group.mentor_name,
        academyName: group.academy_name,
      } : null
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
      FROM groups g WHERE g.mentor_id = ? ORDER BY student_count DESC, g.created_at DESC
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

// 사진 원본 조회 (R2 또는 DB)
app.get('/api/photos/:photoId', async (c) => {
  try {
    const photoId = c.req.param('photoId');
    const row: any = await c.env.DB.prepare(
      'SELECT photo_data, mime_type FROM class_record_photos WHERE id = ?'
    ).bind(photoId).first();
    if (!row) return c.json({ error: 'Photo not found' }, 404);
    
    // R2에서 조회
    if (row.photo_data?.startsWith('r2:') && c.env.R2) {
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
    ).bind(activityRecordId, studentId, date || getKSTDate(), content, reflection || '', duration || '', xpEarned || 20).run();

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


// ==================== 관리자/멘토 전체 데이터 조회 API ====================

// 특정 학생의 전체 기록 (날짜별 통합)
app.get('/api/mentor/student/:studentId/all-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const dateFrom = c.req.query('from') || '2000-01-01';
    const dateTo = c.req.query('to') || '2099-12-31';

    const [classRecords, questionRecords, teachRecords, activityRecords, activityLogs, assignments, exams, examResults, reportRecords, classPhotos, myQuestions, feedbacks] = await Promise.all([
      c.env.DB.prepare('SELECT id, subject, date, content, keywords, understanding, memo, topic, pages, teacher_note, created_at FROM class_records WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC LIMIT 200').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM question_records WHERE student_id = ? AND DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 200').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM teach_records WHERE student_id = ? AND DATE(created_at) BETWEEN ? AND ? ORDER BY created_at DESC LIMIT 200').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM activity_records WHERE student_id = ? ORDER BY created_at DESC LIMIT 100').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM activity_logs WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC LIMIT 200').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM assignments WHERE student_id = ? ORDER BY due_date DESC LIMIT 100').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM exams WHERE student_id = ? ORDER BY start_date DESC LIMIT 50').bind(studentId).all(),
      c.env.DB.prepare('SELECT er.*, e.name as exam_name FROM exam_results er JOIN exams e ON er.exam_id = e.id WHERE er.student_id = ? ORDER BY e.start_date DESC LIMIT 50').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM report_records WHERE student_id = ? ORDER BY created_at DESC LIMIT 100').bind(studentId).all(),
      c.env.DB.prepare('SELECT id, class_record_id, thumbnail, file_size, created_at FROM class_record_photos WHERE student_id = ? ORDER BY id DESC LIMIT 200').bind(studentId).all(),
      c.env.DB.prepare('SELECT q.*, (SELECT COUNT(*) FROM my_answers a WHERE a.question_id = q.id) as answer_count FROM my_questions q WHERE q.student_id = ? AND DATE(q.created_at) BETWEEN ? AND ? ORDER BY q.created_at DESC LIMIT 100').bind(studentId, dateFrom, dateTo).all(),
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

// 그룹 전체 학생 요약 (멘토용 대시보드) — 최적화: N+1 → 배치 집계 쿼리
app.get('/api/mentor/groups/:groupId/summary', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const dateFrom = c.req.query('from') || getKSTDate();
    const dateTo = c.req.query('to') || getKSTDate();

    // KV 캐시 확인 (5분)
    const cacheKey = `group-summary:${groupId}:${dateFrom}:${dateTo}`;
    if (c.env.KV) {
      try {
        const cached = await c.env.KV.get(cacheKey, 'json');
        if (cached) return c.json(cached as any);
      } catch (_) {}
    }

    const kstNow = new Date(Date.now() + 9 * 3600000);
    const kstToday = kstNow.toISOString().slice(0,10);
    const kstDayOfWeek = kstNow.getUTCDay();

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
    const CLASSES_PER_DAY = 6;
    const expectedSchoolClasses = weekdaysInRange * CLASSES_PER_DAY;

    // 1. 학생 목록
    const students = await c.env.DB.prepare(
      'SELECT id, name, school_name, grade, profile_emoji, xp, level, last_login_at, croquet_balance FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name'
    ).bind(groupId).all();

    const studentIds = (students.results as any[]).map(s => s.id);
    if (studentIds.length === 0) {
      const resp = { groupId, dateRange: { from: dateFrom, to: dateTo }, students: [] };
      return c.json(resp);
    }

    // 2. 배치 집계 쿼리 (N+1 → 7개 쿼리로 통합)
    const placeholders = studentIds.map(() => '?').join(',');
    const [classCounts, questionCounts, teachCounts, assignCounts, actLogCounts, schoolClassCounts, assignStats, todayAcademyCounts, todayAllCounts] = await Promise.all([
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM class_records WHERE student_id IN (${placeholders}) AND date BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM question_records WHERE student_id IN (${placeholders}) AND DATE(created_at) BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM teach_records WHERE student_id IN (${placeholders}) AND DATE(created_at) BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM assignments WHERE student_id IN (${placeholders}) AND DATE(created_at) BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM activity_logs WHERE student_id IN (${placeholders}) AND date BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM class_records WHERE student_id IN (${placeholders}) AND date BETWEEN ? AND ? AND (memo IS NULL OR memo NOT LIKE '%isAcademy%') GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM assignments WHERE student_id IN (${placeholders}) AND DATE(created_at) BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM class_records WHERE student_id IN (${placeholders}) AND date = ? AND memo LIKE '%isAcademy%' GROUP BY student_id`).bind(...studentIds, kstToday).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM class_records WHERE student_id IN (${placeholders}) AND date = ? GROUP BY student_id`).bind(...studentIds, kstToday).all(),
    ]);

    // 3. 결과를 student_id별 Map으로 변환
    const toMap = (rows: any[]) => {
      const m: Record<number, any> = {};
      for (const r of rows) m[r.student_id] = r;
      return m;
    };
    const classMap = toMap(classCounts.results as any[]);
    const questionMap = toMap(questionCounts.results as any[]);
    const teachMap = toMap(teachCounts.results as any[]);
    const assignMap = toMap(assignCounts.results as any[]);
    const actLogMap = toMap(actLogCounts.results as any[]);
    const schoolMap = toMap(schoolClassCounts.results as any[]);
    const assignStatsMap = toMap(assignStats.results as any[]);
    const todayAcademyMap = toMap(todayAcademyCounts.results as any[]);
    const todayAllMap = toMap(todayAllCounts.results as any[]);

    // 4. 학생별 요약 조합 (DB 호출 없음)
    const isWeekend = kstDayOfWeek === 0 || kstDayOfWeek === 6;
    const summaries = (students.results as any[]).map(s => {
      const cc = classMap[s.id]?.cnt || 0;
      const qc = questionMap[s.id]?.cnt || 0;
      const tc = teachMap[s.id]?.cnt || 0;
      const ac = assignMap[s.id]?.cnt || 0;
      const alc = actLogMap[s.id]?.cnt || 0;
      const schoolRecords = schoolMap[s.id]?.cnt || 0;
      const totalAssign = assignStatsMap[s.id]?.total || 0;
      const completedAssign = assignStatsMap[s.id]?.completed || 0;
      const todayAcademyCount = todayAcademyMap[s.id]?.cnt || 0;

      const classRecordRate = expectedSchoolClasses > 0 ? Math.min(100, Math.round(schoolRecords / expectedSchoolClasses * 100)) : 0;
      const plannerRate = totalAssign > 0 ? Math.round(completedAssign / totalAssign * 100) : -1;

      let academyTodayRate = -1;
      if (todayAcademyCount > 0) {
        academyTodayRate = 100;
      } else if (!isWeekend) {
        academyTodayRate = 0;
      }

      return {
        ...s,
        periodStats: {
          classRecords: cc, questionRecords: qc, teachRecords: tc,
          assignments: ac, activityLogs: alc,
          total: cc + qc + tc + ac + alc,
        },
        rateStats: {
          classRecordRate, expectedClasses: expectedSchoolClasses,
          actualClassRecords: schoolRecords, plannerRate,
          totalAssignments: totalAssign, completedAssignments: completedAssign,
          academyTodayRate, todayAcademyCount, kstToday,
        },
      };
    });

    const resp = { groupId, dateRange: { from: dateFrom, to: dateTo }, students: summaries };

    // KV 캐시 저장 (5분)
    if (c.env.KV) {
      try { await c.env.KV.put(cacheKey, JSON.stringify(resp), { expirationTtl: 300 }); } catch (_) {}
    }

    return c.json(resp);
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
      'SELECT s.*, g.name as group_name FROM students s JOIN groups g ON s.group_id = g.id WHERE s.id = ?'
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

    return c.json({ error: 'Invalid step. Use step=0,1,2,3,4', usage: 'Call /api/seed-test-data?step=0 then step=1,2,3,4 in order' }, 400);
  } catch (e: any) {
    console.error('Seed error:', e);
    return c.json({ error: e.message, stack: e.stack }, 500);
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
      `CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY AUTOINCREMENT, group_id INTEGER NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL, school_name TEXT DEFAULT '', grade INTEGER DEFAULT 1, profile_emoji TEXT DEFAULT '😊', xp INTEGER DEFAULT 0, level INTEGER DEFAULT 1, is_active INTEGER DEFAULT 1, external_user_id INTEGER DEFAULT NULL, last_login_at DATETIME, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (group_id) REFERENCES groups(id))`,
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
      // ===== 릴레이단어장 =====
      `CREATE TABLE IF NOT EXISTS relay_wordbooks (id INTEGER PRIMARY KEY AUTOINCREMENT, class_id INTEGER NOT NULL, date TEXT NOT NULL, words TEXT NOT NULL DEFAULT '[]', is_ready INTEGER NOT NULL DEFAULT 0, created_by INTEGER NOT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')))`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_relay_wordbooks_unique ON relay_wordbooks(class_id, date)`,
      `CREATE TABLE IF NOT EXISTS relay_word_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, wordbook_id INTEGER NOT NULL, student_user_id INTEGER NOT NULL, student_name TEXT NOT NULL DEFAULT '', entries TEXT NOT NULL DEFAULT '[]', is_finished INTEGER NOT NULL DEFAULT 0, finished_at DATETIME DEFAULT NULL, created_at DATETIME DEFAULT (datetime('now','+9 hours')), updated_at DATETIME DEFAULT (datetime('now','+9 hours')), FOREIGN KEY (wordbook_id) REFERENCES relay_wordbooks(id) ON DELETE CASCADE)`,
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_relay_entries_unique ON relay_word_entries(wordbook_id, student_user_id)`,
    ];
    for (const sql of stmts) {
      try { await c.env.DB.prepare(sql).run(); } catch(_) { /* column may already exist */ }
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

    return c.json({ success: true, message: 'Migration completed', tables: 17 });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


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

    // Gemini 3.1 Flash Vision으로 시간표 분석
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${c.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType, data: cleanBase64 } }
          ] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' }
        })
      }
    )
    if (!geminiRes.ok) {
      const errText = await geminiRes.text()
      console.error('Gemini Vision error:', errText)
      return c.json({ success: false, error: 'AI 분석 실패: ' + geminiRes.status }, 500)
    }
    const geminiData: any = await geminiRes.json()
    const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}'

    // JSON 파싱 (```json 블록 제거)
    let parsed: any
    try {
      const jsonStr = aiText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
      parsed = JSON.parse(jsonStr)
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
    const { studentId, subject, classRecordId, title, content, imageKey, thumbnailKey, questionLevel, aiImproved, source, period, date, skipXp, parentId } = await c.req.json()
    if (!studentId || !title || title.trim().length < 2) return c.json({ error: '질문 제목을 2자 이상 입력해주세요' }, 400)

    // 중복 방지: classRecordId + title 조합
    if (classRecordId) {
      const dup: any = await c.env.DB.prepare('SELECT id FROM my_questions WHERE student_id = ? AND class_record_id = ? AND title = ?')
        .bind(studentId, classRecordId, title.trim()).first()
      if (dup) return c.json({ success: true, questionId: dup.id, duplicate: true })
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO my_questions (student_id, subject, class_record_id, title, content, image_key, thumbnail_key, question_level, ai_improved, source, period, date, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, subject || '기타', classRecordId || null, title.trim(), content || '', imageKey || null, thumbnailKey || null, questionLevel || null, aiImproved || null, source || null, period || null, date || null, parentId || null).run()

    // XP +3 (skipXp=true이면 건너뜀 — 수업 기록 자동 등록 시)
    if (!skipXp) {
      await c.env.DB.prepare('UPDATE students SET xp = xp + 3, updated_at = ? WHERE id = ?').bind(getKSTString(), studentId).run()
      await recordXp(c.env.DB, Number(studentId), 3, '질문 등록', `${subject || '기타'} — ${title.trim().slice(0, 40)}`, 'my_questions', result.meta.last_row_id as number)
      const student: any = await c.env.DB.prepare('SELECT xp FROM students WHERE id = ?').bind(studentId).first()
      if (student) {
        const newLevel = Math.max(1, Math.floor(student.xp / 100) + 1)
        await c.env.DB.prepare('UPDATE students SET level = ? WHERE id = ?').bind(newLevel, studentId).run()
      }
    }

    return c.json({ success: true, questionId: result.meta.last_row_id, xpEarned: skipXp ? 0 : 3 })
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

    await c.env.DB.prepare('UPDATE students SET xp = xp + ?, updated_at = ? WHERE id = ?').bind(totalXp, getKSTString(), studentId).run()
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

// 질문 상태 토글 (해결완료 ↔ 미답변)
app.put('/api/my-questions/:id/status', async (c) => {
  try {
    const questionId = c.req.param('id')
    const { studentId, status } = await c.req.json()
    if (!studentId) return c.json({ error: 'studentId 필수' }, 400)
    const newStatus = status || '답변완료'

    await c.env.DB.prepare('UPDATE my_questions SET status = ? WHERE id = ? AND student_id = ?')
      .bind(newStatus, questionId, studentId).run()

    // 해결완료 시 XP +5
    if (newStatus === '답변완료') {
      await c.env.DB.prepare('UPDATE students SET xp = xp + 5, updated_at = ? WHERE id = ?')
        .bind(getKSTString(), studentId).run()
      await recordXp(c.env.DB, Number(studentId), 5, '질문 해결', `질문 #${questionId} 해결완료`, 'my_questions', Number(questionId))
    }

    return c.json({ success: true, status: newStatus })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 답변 수정
app.put('/api/my-questions/:qid/answer/:aid', async (c) => {
  try {
    const { qid, aid } = c.req.param() as { qid: string; aid: string }
    const { content, studentId, imageKey } = await c.req.json()
    if (!studentId || !content || content.trim().length < 2) return c.json({ error: '답변 내용을 2자 이상 입력해주세요' }, 400)

    const answer: any = await c.env.DB.prepare('SELECT id FROM my_answers WHERE id = ? AND question_id = ? AND student_id = ?').bind(aid, qid, studentId).first()
    if (!answer) return c.json({ error: '답변을 찾을 수 없습니다' }, 404)

    await c.env.DB.prepare('UPDATE my_answers SET content = ?, image_key = ? WHERE id = ?').bind(content.trim(), imageKey || null, aid).run()
    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 답변 삭제
app.delete('/api/my-questions/:qid/answer/:aid', async (c) => {
  try {
    const { qid, aid } = c.req.param() as { qid: string; aid: string }
    const studentId = c.req.query('studentId')
    if (!studentId) return c.json({ error: 'studentId 필수' }, 400)

    const answer: any = await c.env.DB.prepare('SELECT id FROM my_answers WHERE id = ? AND question_id = ? AND student_id = ?').bind(aid, qid, studentId).first()
    if (!answer) return c.json({ error: '답변을 찾을 수 없습니다' }, 404)

    await c.env.DB.prepare('DELETE FROM my_answers WHERE id = ?').bind(aid).run()

    // 남은 답변이 없으면 상태를 '미답변'으로 되돌림
    const remaining: any = await c.env.DB.prepare('SELECT COUNT(*) as cnt FROM my_answers WHERE question_id = ?').bind(qid).first()
    if ((remaining?.cnt || 0) === 0) {
      await c.env.DB.prepare("UPDATE my_questions SET status = '미답변' WHERE id = ?").bind(qid).run()
    }

    return c.json({ success: true })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 질문 AI 고도화
app.post('/api/my-questions/:id/improve', async (c) => {
  try {
    const questionId = c.req.param('id')
    const question: any = await c.env.DB.prepare('SELECT * FROM my_questions WHERE id = ?').bind(questionId).first()
    if (!question) return c.json({ error: '질문을 찾을 수 없습니다' }, 404)

    // 이미 ai_improved가 있으면 바로 반환
    if (question.ai_improved) return c.json({ success: true, aiImproved: question.ai_improved })

    const prompt = `당신은 고등학생의 질문을 고도화하는 AI입니다.

## 규칙
- 학생의 원본 질문 의도를 존중하되, "선생님, 이 부분이 궁금합니다"라고 바로 말할 수 있는 수준으로 완성
- 단순 암기 질문 → 원리/이유/적용을 묻는 질문으로 업그레이드
- 해당 과목의 교과 맥락에 맞는 용어 사용
- 결과는 고도화된 질문 텍스트만 반환 (따옴표, 설명 없이)

## 입력
과목: ${question.subject || '기타'}
원본 질문: ${question.title}
${question.content ? `추가 설명: ${question.content}` : ''}

## 출력
고도화된 질문 (한 문장~두 문장):`

    const { text } = await callGeminiWithFallback({
      geminiKey: c.env.GEMINI_API_KEY,
      openaiKey: c.env.OPENAI_API_KEY,
      prompt,
      jsonMode: false,
      temperature: 0.4,
    })

    const improved = text.trim().replace(/^["']|["']$/g, '')
    await c.env.DB.prepare('UPDATE my_questions SET ai_improved = ? WHERE id = ?').bind(improved, questionId).run()

    return c.json({ success: true, aiImproved: improved })
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
    fields.push("updated_at = datetime('now','+9 hours')");
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

// ==================== 아하 리포트 v2 AI 분석 (5섹션: SA/PA/DA/POA/PPA) ====================
app.post('/api/aha-report/analyze-v2', async (c) => {
  try {
    const geminiKey = c.env.GEMINI_API_KEY
    if (!geminiKey) return c.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, 500)

    const { photos, subject, source, date } = await c.req.json<{
      photos: string[],
      subject?: string,
      source?: string,
      date?: string
    }>()

    if (!photos || photos.length === 0) return c.json({ error: '사진이 필요합니다.' }, 400)
    if (photos.length > 3) return c.json({ error: '사진은 최대 3장까지 가능합니다.' }, 400)

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

    const promptText = `${systemPrompt}\n\n---\n과목: ${subject || '미선택'}\n출처: ${source || '미입력'}\n날짜: ${date || '미입력'}`
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

    // Step 1: Gemini 시도
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        }
      )

      if (geminiRes.ok) {
        const data: any = await geminiRes.json()
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      } else {
        const errStatus = geminiRes.status
        console.log('Gemini API error (v2):', errStatus, '→ OpenAI로 폴백')
        throw new Error(`Gemini ${errStatus}`)
      }
    } catch (geminiErr) {
      // Step 2: OpenAI GPT-4o 폴백
      console.log('Gemini 실패 (v2), OpenAI GPT-4o로 폴백:', geminiErr)
      aiSource = 'openai'

      const openaiKey = c.env.OPENAI_API_KEY
      if (!openaiKey) {
        return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.', detail: 'no_fallback_key' }, 502)
      }

      const openaiContent: any[] = [{ type: 'text', text: promptText + '\n\n반드시 위에 지정한 JSON 형식으로만 응답해주세요.' }]
      for (const img of imageDataList) {
        openaiContent.push({
          type: 'image_url',
          image_url: { url: `data:${img.mime_type};base64,${img.data}`, detail: 'high' }
        })
      }

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: openaiContent }],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      })

      if (!openaiRes.ok) {
        const errText = await openaiRes.text()
        console.log('OpenAI fallback error (v2):', openaiRes.status, errText)
        return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.', detail: openaiRes.status }, 502)
      }

      const openaiData: any = await openaiRes.json()
      rawText = openaiData.choices?.[0]?.message?.content || '{}'
    }

    let result: any
    try {
      result = JSON.parse(rawText)
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

// ==================== 아하 리포트 v2 피드백 ====================
app.post('/api/aha-report/feedback', async (c) => {
  try {
    const geminiKey = c.env.GEMINI_API_KEY
    const { sa, pa, da, poa, ppa, subject } = await c.req.json<{
      sa: string, pa: string[], da: string, poa: string,
      ppa: { change?: string, lacking?: string }, subject?: string
    }>()

    const paJoined = Array.isArray(pa) ? pa.join(', ') : String(pa || '')

    const promptText = `당신은 고교학점제 탐구보고서 전문가입니다.

학생의 아하 리포트를 평가하고 피드백을 작성해주세요.

[입력 데이터]
과목: ${subject || '미입력'}
SA (문제상황): ${sa || ''}
PA (탐구질문): ${paJoined}
DA (탐구과정 & 결론): ${da || ''}
POA (아하포인트): ${poa || ''}
PPA (성찰): ${JSON.stringify(ppa || {})}

[피드백 작성 규칙]
- 따뜻하고 격려하는 톤, 반드시 존댓말 사용
- 300~500자 내외
- 각 섹션에 대한 간단한 평가와 개선 조언 또는 칭찬
- 심화 탐구 방향 제안
- 고교학점제에서 이 탐구가 갖는 의미
- 학교 세부능력특기사항과 연결 팁

반드시 아래 JSON 형식으로만 응답:
{
  "feedback": "피드백 전체 텍스트"
}`

    let rawText = '{}'
    let aiSource = 'gemini'

    // Step 1: Gemini 시도
    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: promptText }] }],
              generationConfig: {
                temperature: 0.4,
                responseMimeType: 'application/json'
              }
            })
          }
        )

        if (geminiRes.ok) {
          const data: any = await geminiRes.json()
          rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        } else {
          throw new Error(`Gemini ${geminiRes.status}`)
        }
      } catch (geminiErr) {
        console.log('Gemini feedback 실패, OpenAI로 폴백:', geminiErr)
        aiSource = 'openai'

        const openaiKey = c.env.OPENAI_API_KEY
        if (!openaiKey) {
          return c.json({ error: '피드백 생성에 실패했어요. 다시 시도해주세요.', detail: 'no_fallback_key' }, 502)
        }

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [{ role: 'user', content: promptText + '\n\n반드시 위에 지정한 JSON 형식으로만 응답해주세요.' }],
            temperature: 0.4,
            response_format: { type: 'json_object' }
          })
        })

        if (!openaiRes.ok) {
          const errText = await openaiRes.text()
          console.log('OpenAI feedback fallback error:', openaiRes.status, errText)
          return c.json({ error: '피드백 생성에 실패했어요. 다시 시도해주세요.', detail: openaiRes.status }, 502)
        }

        const openaiData: any = await openaiRes.json()
        rawText = openaiData.choices?.[0]?.message?.content || '{}'
      }
    } else {
      // No Gemini key, try OpenAI directly
      aiSource = 'openai'
      const openaiKey = c.env.OPENAI_API_KEY
      if (!openaiKey) {
        return c.json({ error: 'API 키가 설정되지 않았습니다.' }, 500)
      }

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: promptText + '\n\n반드시 위에 지정한 JSON 형식으로만 응답해주세요.' }],
          temperature: 0.4,
          response_format: { type: 'json_object' }
        })
      })

      if (!openaiRes.ok) {
        return c.json({ error: '피드백 생성에 실패했어요. 다시 시도해주세요.' }, 502)
      }

      const openaiData: any = await openaiRes.json()
      rawText = openaiData.choices?.[0]?.message?.content || '{}'
    }

    let result: any
    try {
      result = JSON.parse(rawText)
    } catch {
      return c.json({ error: '피드백 결과를 파싱할 수 없습니다.', raw: rawText }, 500)
    }

    return c.json({
      success: true,
      feedback: result.feedback || ''
    })
  } catch (e: any) {
    console.log('AHA Report feedback error:', e)
    return c.json({ error: '피드백 생성에 실패했어요. 다시 시도해주세요.' }, 500)
  }
})

// ==================== 아하 리포트 AI 분석 (Gemini 3.0 Flash) ====================
app.post('/api/aha-report/analyze', async (c) => {
  try {
    const geminiKey = c.env.GEMINI_API_KEY
    if (!geminiKey) return c.json({ error: 'Gemini API 키가 설정되지 않았습니다.' }, 500)

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

    // Step 1: Gemini 시도
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature: 0.2,
              responseMimeType: 'application/json'
            }
          })
        }
      )

      if (geminiRes.ok) {
        const data: any = await geminiRes.json()
        rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      } else {
        const errStatus = geminiRes.status
        console.log('Gemini API error:', errStatus, '→ OpenAI로 폴백')
        throw new Error(`Gemini ${errStatus}`)
      }
    } catch (geminiErr) {
      // Step 2: OpenAI GPT-4o 폴백 (이미지 지원)
      console.log('Gemini 실패, OpenAI GPT-4o로 폴백:', geminiErr)
      aiSource = 'openai'

      const openaiKey = c.env.OPENAI_API_KEY
      if (!openaiKey) {
        return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.', detail: 'no_fallback_key' }, 502)
      }

      const openaiContent: any[] = [{ type: 'text', text: promptText + '\n\n반드시 위에 지정한 JSON 형식으로만 응답해주세요.' }]
      for (const img of imageDataList) {
        openaiContent.push({
          type: 'image_url',
          image_url: { url: `data:${img.mime_type};base64,${img.data}`, detail: 'high' }
        })
      }

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: openaiContent }],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        })
      })

      if (!openaiRes.ok) {
        const errText = await openaiRes.text()
        console.log('OpenAI fallback error:', openaiRes.status, errText)
        return c.json({ error: '분석에 실패했어요. 다시 시도해주세요.', detail: openaiRes.status }, 502)
      }

      const openaiData: any = await openaiRes.json()
      rawText = openaiData.choices?.[0]?.message?.content || '{}'
    }

    let result: any
    try {
      result = JSON.parse(rawText)
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
    const { studentId, subject, unit, photos, sections, ai_feedback, ai_source, student_name_detected, subject_detected, unit_detected, croquet_given, section_sa, section_pa, section_da, section_poa, section_ppa, source, date } = await c.req.json<{
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
    
    let query = 'SELECT id, subject, unit, section_topic, ai_feedback, croquet_given, created_at, student_name_detected, subject_detected, unit_detected, section_sa, section_pa, source, date, photos, photo_tags FROM aha_reports WHERE student_id = ?'
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

// ==================== 릴레이단어장 API ====================

// 릴레이 자격 확인: 사용자(멘토/학생)의 영어 클래스 중 멤버 16명 이상인 클래스 목록
app.get('/api/relay/classes', async (c) => {
  try {
    const userId = c.req.query('user_id')
    if (!userId) return c.json({ error: 'user_id 필요' }, 400)

    const jyskApiUrl = c.env.JYSK_API_URL || 'https://jungyoul.com/api/jysk-api.php'
    const jyskApiKey = c.env.JYSK_API_KEY || 'jysk-planner-2026'

    const res = await fetch(`${jyskApiUrl}?action=get_relay_classes&user_id=${userId}&key=${jyskApiKey}`)
    const data: any = await res.json()
    if (!data.success) return c.json({ success: false, classes: [] })
    return c.json({ success: true, classes: data.classes || [] })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 클래스의 학생 목록 (원격 DB)
app.get('/api/relay/class-students', async (c) => {
  try {
    const classId = c.req.query('class_id')
    if (!classId) return c.json({ error: 'class_id 필요' }, 400)

    const jyskApiUrl = c.env.JYSK_API_URL || 'https://jungyoul.com/api/jysk-api.php'
    const jyskApiKey = c.env.JYSK_API_KEY || 'jysk-planner-2026'

    const res = await fetch(`${jyskApiUrl}?action=get_relay_class_students&class_id=${classId}&key=${jyskApiKey}`)
    const data: any = await res.json()
    if (!data.success) return c.json({ success: false, students: [] })
    return c.json({ success: true, students: data.students || [] })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 멘토: 오늘의 단어장 조회 (클래스별)
app.get('/api/relay/wordbook', async (c) => {
  try {
    const classId = c.req.query('class_id')
    const date = c.req.query('date') || getKSTDate()
    if (!classId) return c.json({ error: 'class_id 필요' }, 400)

    const wb: any = await c.env.DB.prepare(
      'SELECT * FROM relay_wordbooks WHERE class_id = ? AND date = ?'
    ).bind(Number(classId), date).first()

    if (!wb) return c.json({ success: true, wordbook: null })

    // 학생 제출 현황
    const entries: any = await c.env.DB.prepare(
      'SELECT student_user_id, student_name, is_finished, finished_at, entries FROM relay_word_entries WHERE wordbook_id = ? ORDER BY finished_at ASC'
    ).bind(wb.id).all()

    return c.json({ success: true, wordbook: wb, entries: entries.results || [] })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 멘토: 단어장 저장 (생성 또는 업데이트)
app.post('/api/relay/wordbook', async (c) => {
  try {
    const { class_id, date, words, is_ready, created_by } = await c.req.json()
    if (!class_id || !words || !created_by) return c.json({ error: '필수 필드 누락' }, 400)

    const dateStr = date || getKSTDate()
    const wordsJson = JSON.stringify(words)

    // UPSERT: 이미 있으면 업데이트, 없으면 생성
    const existing: any = await c.env.DB.prepare(
      'SELECT id FROM relay_wordbooks WHERE class_id = ? AND date = ?'
    ).bind(class_id, dateStr).first()

    if (existing) {
      await c.env.DB.prepare(
        'UPDATE relay_wordbooks SET words = ?, is_ready = ?, updated_at = ? WHERE id = ?'
      ).bind(wordsJson, is_ready ? 1 : 0, getKSTString(), existing.id).run()
      return c.json({ success: true, id: existing.id, updated: true })
    } else {
      const result = await c.env.DB.prepare(
        'INSERT INTO relay_wordbooks (class_id, date, words, is_ready, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).bind(class_id, dateStr, wordsJson, is_ready ? 1 : 0, created_by, getKSTString(), getKSTString()).run()
      return c.json({ success: true, id: result.meta.last_row_id, created: true })
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 학생: 오늘의 단어장 + 본인 엔트리 조회
app.get('/api/relay/student-wordbook', async (c) => {
  try {
    const classId = c.req.query('class_id')
    const studentUserId = c.req.query('student_user_id')
    const date = c.req.query('date') || getKSTDate()
    if (!classId || !studentUserId) return c.json({ error: 'class_id, student_user_id 필요' }, 400)

    const wb: any = await c.env.DB.prepare(
      'SELECT * FROM relay_wordbooks WHERE class_id = ? AND date = ? AND is_ready = 1'
    ).bind(Number(classId), date).first()

    if (!wb) return c.json({ success: true, wordbook: null, myEntry: null, finishedStudents: [] })

    // 완료된 학생 목록 (완료순)
    const finished: any = await c.env.DB.prepare(
      'SELECT student_user_id, student_name, finished_at FROM relay_word_entries WHERE wordbook_id = ? AND is_finished = 1 ORDER BY finished_at ASC'
    ).bind(wb.id).all()

    // 본인 엔트리
    const myEntry: any = await c.env.DB.prepare(
      'SELECT * FROM relay_word_entries WHERE wordbook_id = ? AND student_user_id = ?'
    ).bind(wb.id, Number(studentUserId)).first()

    return c.json({
      success: true,
      wordbook: { id: wb.id, class_id: wb.class_id, date: wb.date, words: wb.words, is_ready: wb.is_ready },
      myEntry: myEntry || null,
      finishedStudents: finished.results || []
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 학생: 단어 뜻 저장 (임시 저장 또는 완료 제출)
app.post('/api/relay/student-entry', async (c) => {
  try {
    const { wordbook_id, student_user_id, student_name, entries, is_finished } = await c.req.json()
    if (!wordbook_id || !student_user_id) return c.json({ error: '필수 필드 누락' }, 400)

    const entriesJson = JSON.stringify(entries || [])
    const now = getKSTString()

    const existing: any = await c.env.DB.prepare(
      'SELECT id FROM relay_word_entries WHERE wordbook_id = ? AND student_user_id = ?'
    ).bind(wordbook_id, student_user_id).first()

    if (existing) {
      if (is_finished) {
        await c.env.DB.prepare(
          'UPDATE relay_word_entries SET entries = ?, is_finished = 1, finished_at = ?, updated_at = ? WHERE id = ?'
        ).bind(entriesJson, now, now, existing.id).run()
      } else {
        await c.env.DB.prepare(
          'UPDATE relay_word_entries SET entries = ?, updated_at = ? WHERE id = ?'
        ).bind(entriesJson, now, existing.id).run()
      }
      return c.json({ success: true, id: existing.id, updated: true })
    } else {
      const result = await c.env.DB.prepare(
        'INSERT INTO relay_word_entries (wordbook_id, student_user_id, student_name, entries, is_finished, finished_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
      ).bind(wordbook_id, student_user_id, student_name || '', entriesJson, is_finished ? 1 : 0, is_finished ? now : null, now, now).run()
      return c.json({ success: true, id: result.meta.last_row_id, created: true })
    }
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 멘토: 특정 학생의 제출 상세 조회
app.get('/api/relay/student-entry-detail', async (c) => {
  try {
    const wordbookId = c.req.query('wordbook_id')
    const studentUserId = c.req.query('student_user_id')
    if (!wordbookId || !studentUserId) return c.json({ error: '필수 파라미터 누락' }, 400)

    const entry: any = await c.env.DB.prepare(
      'SELECT * FROM relay_word_entries WHERE wordbook_id = ? AND student_user_id = ?'
    ).bind(Number(wordbookId), Number(studentUserId)).first()

    const wb: any = await c.env.DB.prepare(
      'SELECT words FROM relay_wordbooks WHERE id = ?'
    ).bind(Number(wordbookId)).first()

    return c.json({ success: true, entry: entry || null, words: wb?.words || '[]' })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

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
  <style>
    @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(.95)} }
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
            <div id="initial-loader" style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:80vh;gap:16px">
              <img src="/static/logo.png" alt="" style="width:56px;height:56px;border-radius:14px;animation:pulse 1.5s ease-in-out infinite">
              <div style="font-size:15px;color:#888;font-weight:500">로딩 중...</div>
            </div>
          </div>
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
  <script src="/static/app.js"></script>
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
      // 컨트롤러 변경 시 자동 새로고침 (새 SW 활성화 완료 = 새 버전 적용)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (window._swReloading) return;
        window._swReloading = true;
        console.log('[PWA] New version activated, reloading...');
        window.location.reload();
      });
    }
  </script>
</body>
</html>`)
})

export default app
