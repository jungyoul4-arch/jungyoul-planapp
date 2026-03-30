// ==================== KST (한국 표준시) 헬퍼 ====================
export function getKSTNow(): Date {
  return new Date(Date.now() + 9 * 3600000);
}
export function getKSTString(): string {
  // 'YYYY-MM-DD HH:MM:SS' 형식의 KST 시간 문자열
  return getKSTNow().toISOString().slice(0, 19).replace('T', ' ');
}
export function getKSTDate(): string {
  // 'YYYY-MM-DD' 형식의 KST 날짜
  return getKSTNow().toISOString().slice(0, 10);
}

// ==================== XP 내역 기록 헬퍼 ====================
export async function recordXp(db: D1Database, studentId: number, amount: number, source: string, sourceDetail: string = '', refTable: string | null = null, refId: number | null = null) {
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

// ==================== 타임아웃 fetch 헬퍼 ====================
export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number = 60000): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal })
    return res
  } catch (e: any) {
    if (e.name === 'AbortError') throw new Error(`요청 시간 초과 (${Math.round(timeoutMs / 1000)}초)`)
    throw e
  } finally {
    clearTimeout(timer)
  }
}

// ==================== Gemini → OpenAI 폴백 헬퍼 ====================
// Gemini API가 할당량 초과(429) 등으로 실패할 경우 OpenAI gpt-4o-mini로 자동 폴백

export async function callGeminiWithFallback(opts: {
  geminiKey: string,
  openaiKey: string,
  anthropicKey?: string,
  prompt: string,
  jsonMode?: boolean,
  temperature?: number,
  inlineData?: { mime_type: string, data: string },
}) {
  const { geminiKey, openaiKey, anthropicKey, prompt, jsonMode = true, temperature = 0.3, inlineData } = opts
  let geminiError = ''

  // Step 1: Gemini 시도
  try {
    const parts: any[] = [{ text: prompt }]
    if (inlineData) parts.push({ inline_data: inlineData })

    const geminiRes = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent?key=${geminiKey}`,
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
      },
      30000
    )

    if (geminiRes.ok) {
      const data: any = await geminiRes.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
      return { text, source: 'gemini' }
    }

    geminiError = `Gemini ${geminiRes.status}: ${await geminiRes.text().catch(() => 'unknown')}`
    console.log(`Gemini API 실패 (${geminiRes.status}), Claude로 폴백`)
  } catch (e: any) {
    geminiError = `Gemini error: ${e.message}`
    console.log('Gemini API 에러, Claude로 폴백:', e)
  }

  // Step 2: Claude 폴백
  if (anthropicKey) {
    try {
      const text = await callSonnetAnalysis(anthropicKey, prompt, '위 지시에 따라 응답하세요.', jsonMode, temperature)
      return { text, source: 'claude-fallback' }
    } catch (e) {
      console.log('Claude 폴백 실패:', e)
    }
  }

  throw new Error(`AI 호출 실패 — ${geminiError}`)
}

// ==================== Gemini 2.5 Flash 다중 이미지 헬퍼 ====================

export const GEMINI_MODEL = 'gemini-3-flash-preview'

// 단일 이미지 OCR (병렬 처리용)
export async function callGeminiOcrSingle(geminiKey: string, image: { mime_type: string, data: string }, tag: string, index: number) {
  const ocrPrompt = `이 사진(${tag})의 모든 텍스트를 정확히 읽어주세요. 수식은 LaTeX($...$) 변환. 줄바꿈 유지. 텍스트만 반환.`
  const parts: any[] = [{ text: ocrPrompt }, { inline_data: image }]

  const res = await fetchWithTimeout(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
      })
    },
    600000 // 10분 타임아웃
  )

  if (!res.ok) throw new Error(`OCR 실패 (사진${index + 1}): ${res.status}`)
  const data: any = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// Sonnet 분석 호출 (텍스트 전용)
export async function callSonnetAnalysis(anthropicKey: string, systemPrompt: string, userPrompt: string, jsonMode: boolean = true, temperature: number = 0.3) {
  const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    })
  }, 600000) // 10분 타임아웃

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Sonnet 분석 실패 (${res.status}): ${err}`)
  }

  const data: any = await res.json()
  return data.content[0].text
}

export async function callGeminiMultiImage(opts: {
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
  let ocrError = ''

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
      const geminiRes = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
          })
        },
        600000 // 10분 타임아웃
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
      } else {
        ocrError = `Gemini OCR ${geminiRes.status}: ${await geminiRes.text().catch(() => 'unknown')}`
        console.log('[OCR] ' + ocrError)
      }
    }
    if (ocrSuccess) console.log(`[OCR] 완료 (${ocrText.length}자)`)
  } catch (e: any) {
    ocrError = `Gemini OCR error: ${e.message}`
    console.log('[OCR] Gemini OCR 실패:', e)
  }

  // STEP 1.5: OpenAI Vision OCR 폴백 (Gemini OCR 실패 시)
  if (!ocrSuccess && openaiKey) {
    try {
      console.log('[OCR] OpenAI Vision OCR 폴백 시도')
      const contentParts: any[] = [
        { type: 'text', text: '모든 사진의 텍스트를 정확히 읽어주세요. 수식은 LaTeX($...$) 변환. 줄바꿈 유지. 각 사진별로 구분해서 텍스트만 반환.' }
      ]
      for (const img of images) {
        contentParts.push({
          type: 'image_url',
          image_url: { url: `data:${img.mime_type};base64,${img.data}`, detail: 'high' }
        })
      }
      const ocrRes = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${openaiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{ role: 'user', content: contentParts }],
          temperature: 0.1,
          max_tokens: 4096,
        })
      }, 600000)
      if (ocrRes.ok) {
        const data: any = await ocrRes.json()
        const rawOcr = data.choices?.[0]?.message?.content || ''
        ocrText = images.map((_, i) => {
          const tag = tags[i] || '노트'
          const label = tag === '필기' ? '[Note_OCR]' : '[Reference_OCR]'
          return `--- 사진${i + 1} ${label} ${tag} ---`
        }).join('\n') + '\n\n' + rawOcr
        ocrSuccess = true
        console.log(`[OCR] OpenAI Vision OCR 성공 (${ocrText.length}자)`)
      } else {
        console.log(`[OCR] OpenAI Vision OCR 실패: ${ocrRes.status}`)
      }
    } catch (e: any) {
      console.log('[OCR] OpenAI Vision OCR 에러:', e.message)
    }
  }

  // STEP 2: Sonnet 분석 (1순위 — OCR 텍스트 기반 구조화 분석)
  let sonnetError = ''
  if (ocrSuccess && anthropicKey) {
    try {
      console.log('[분석] Sonnet 4.6 분석 시작')
      const sysPrompt = systemPrompt || prompt
      const usrPrompt = (userContext || '') + `\n\n=== OCR 결과 ===\n${ocrText}\n\n위 JSON 형식으로만 응답하세요.`
      const text = await callSonnetAnalysis(anthropicKey, sysPrompt, usrPrompt, jsonMode, temperature)
      console.log('[분석] Sonnet 4.6 분석 성공')
      return { text, source: 'gemini-ocr+sonnet' }
    } catch (e: any) {
      sonnetError = e.message
      console.log('[분석] Sonnet 실패:', sonnetError?.substring(0, 200))
    }
  }

  // STEP 3 폴백: Gemini 분석 (Sonnet 실패 시)
  let geminiAnalysisError = ''
  try {
    if (ocrSuccess) {
      console.log('[분석] Gemini 텍스트 분석 폴백 시도')
      const textPrompt = prompt + `\n\n=== OCR 결과 ===\n${ocrText}\n\n위 JSON 형식으로만 응답하세요.`
      const geminiRes = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: textPrompt }] }],
            generationConfig: {
              temperature,
              maxOutputTokens: 8192,
              ...(jsonMode ? { responseMimeType: 'application/json' } : {})
            }
          })
        },
        600000 // 10분 타임아웃
      )
      if (geminiRes.ok) {
        const data: any = await geminiRes.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        console.log('[분석] Gemini 텍스트 분석 성공')
        return { text, source: `gemini-ocr+analysis` }
      }
      const errBody = await geminiRes.text().catch(() => 'unknown')
      geminiAnalysisError = `${GEMINI_MODEL} ${geminiRes.status}: ${errBody.substring(0, 200)}`
      console.log(`[분석] Gemini 텍스트 분석 실패: ${geminiRes.status}`, errBody.substring(0, 200))
    } else {
      // OCR도 실패: 이미지 직접 전송
      console.log('[분석] Gemini 이미지 직접 분석 폴백 시도')
      const parts: any[] = [{ text: prompt }]
      for (const img of images) {
        parts.push({ inline_data: img })
      }
      const geminiRes = await fetchWithTimeout(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts }],
            generationConfig: {
              temperature,
              maxOutputTokens: 8192,
              ...(jsonMode ? { responseMimeType: 'application/json' } : {})
            }
          })
        },
        600000 // 10분 타임아웃
      )
      if (geminiRes.ok) {
        const data: any = await geminiRes.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}'
        return { text, source: GEMINI_MODEL }
      }
      const errBody = await geminiRes.text().catch(() => 'unknown')
      geminiAnalysisError = `${GEMINI_MODEL} ${geminiRes.status}: ${errBody.substring(0, 200)}`
      console.log(`[분석] Gemini 이미지 분석 실패: ${geminiRes.status}`, errBody.substring(0, 200))
    }
  } catch (e: any) {
    geminiAnalysisError = `${GEMINI_MODEL} error: ${e.message}`
    console.log(`${GEMINI_MODEL} 분석 에러:`, e)
  }

  // STEP 4 폴백: OpenAI Vision (Gemini + Sonnet 모두 실패 시 최종 안전망)
  if (openaiKey) {
    try {
      console.log('[분석] OpenAI Vision 최종 폴백 시도')
      const openaiMessages: any[] = [
        { role: 'system', content: systemPrompt || prompt },
      ]
      // OCR 텍스트가 있으면 텍스트 기반, 없으면 이미지 직접 전송
      if (ocrSuccess && ocrText) {
        openaiMessages.push({ role: 'user', content: (userContext || '') + `\n\n=== OCR 결과 ===\n${ocrText}\n\n위 JSON 형식으로만 응답하세요.` })
      } else {
        // 이미지를 OpenAI Vision으로 직접 전송
        const contentParts: any[] = [{ type: 'text', text: (userContext || '') + '\n\n위 JSON 형식으로만 응답하세요.' }]
        for (const img of images) {
          contentParts.push({
            type: 'image_url',
            image_url: { url: `data:${img.mime_type};base64,${img.data}`, detail: 'high' }
          })
        }
        openaiMessages.push({ role: 'user', content: contentParts })
      }

      const openaiRes = await fetchWithTimeout('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openaiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: openaiMessages,
          temperature,
          max_tokens: 8192,
          ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        })
      }, 600000)

      if (openaiRes.ok) {
        const data: any = await openaiRes.json()
        const text = data.choices?.[0]?.message?.content || '{}'
        console.log('[분석] OpenAI Vision 폴백 성공')
        return { text, source: 'openai-vision-fallback' }
      }
      const errBody = await openaiRes.text().catch(() => 'unknown')
      console.log(`[분석] OpenAI Vision 폴백 실패: ${openaiRes.status}`, errBody.substring(0, 200))
    } catch (e: any) {
      console.log('[분석] OpenAI Vision 폴백 에러:', e.message)
    }
  }

  throw new Error(`모든 AI 서비스 실패 — Sonnet: ${sonnetError || 'skipped'} | Gemini: ${geminiAnalysisError || 'unknown'} | OpenAI: 폴백 실패`)
}

// ==================== AUTH: 비밀번호 해싱 (Web Crypto API) ====================

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_credit_planner_salt_2026');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

// 간단한 세션 토큰 생성
export function generateToken(): string {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// 초대코드 생성 (JYCC-XXXX-XXXX)
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const part1 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const part2 = Array.from({length: 4}, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `JYCC-${part1}-${part2}`;
}

/** HTML 태그 제거 후 plain text 미리보기 생성 */
export function stripHtmlForPreview(html: string, maxLen: number = 100): string {
  const text = html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').trim();
  return text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
}

/** 서버사이드 HTML 새니타이징 (defense-in-depth) */
export function sanitizeHTML(html: string): string {
  let clean = html;
  clean = clean.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  clean = clean.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
  clean = clean.replace(/\bon\w+\s*=\s*(['"]?)[\s\S]*?\1/gi, '');
  clean = clean.replace(/javascript\s*:/gi, '');
  clean = clean.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '');
  clean = clean.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, '');
  clean = clean.replace(/<embed\b[^>]*>/gi, '');
  return clean;
}

/** 닉네임 금지어 목록 */
export const NICKNAME_BLOCKLIST = ['바보', '멍청', '시발', '씨발', '병신', '개새', '죽어', '지랄', '닥쳐', 'fuck', 'shit', 'damn'];

/** 닉네임 유효성 검사 */
export function validateNickname(nickname: string): { valid: boolean; error?: string } {
  const trimmed = nickname.trim();
  if (trimmed.length < 2 || trimmed.length > 12) return { valid: false, error: '닉네임은 2~12자여야 합니다' };
  if (!/^[가-힣a-zA-Z0-9\s]+$/.test(trimmed)) return { valid: false, error: '닉네임에 한글, 영문, 숫자, 공백만 사용 가능합니다' };
  if (NICKNAME_BLOCKLIST.some(w => trimmed.toLowerCase().includes(w))) return { valid: false, error: '사용할 수 없는 닉네임입니다' };
  return { valid: true };
}

/** 학생의 학원명 조회 (join chain via student_groups) */
export async function getStudentAcademy(db: any, studentId: number): Promise<string | null> {
  const row: any = await db.prepare(`
    SELECT m.academy_name FROM students s
    JOIN student_groups sg ON s.id = sg.student_id
    JOIN groups g ON sg.group_id = g.id
    JOIN mentors m ON g.mentor_id = m.id
    WHERE s.id = ? AND s.is_active = 1
    LIMIT 1
  `).bind(studentId).first();
  return row?.academy_name || null;
}

export async function canAccessBoard(db: any, boardId: number, userType: string, userId: number): Promise<boolean> {
  const board: any = await db.prepare('SELECT * FROM community_boards WHERE id = ? AND is_active = 1').bind(boardId).first();
  if (!board) return false;
  if (board.board_type === 'group') {
    if (userType === 'student') {
      // student_groups에서 학생-그룹 매핑 확인
      const membership: any = await db.prepare(
        'SELECT 1 FROM student_groups sg JOIN students s ON sg.student_id = s.id WHERE sg.student_id = ? AND sg.group_id = ? AND s.is_active = 1'
      ).bind(userId, board.group_id).first();
      return !!membership;
    } else {
      const g: any = await db.prepare('SELECT mentor_id FROM groups WHERE id = ?').bind(board.group_id).first();
      return g && g.mentor_id === userId;
    }
  } else if (board.board_type === 'academy') {
    let academy = '';
    if (userType === 'student') {
      const row: any = await db.prepare(`
        SELECT m.academy_name FROM students s
        JOIN student_groups sg ON s.id = sg.student_id
        JOIN groups g ON sg.group_id = g.id
        JOIN mentors m ON g.mentor_id = m.id
        WHERE s.id = ? AND s.is_active = 1
        LIMIT 1
      `).bind(userId).first();
      academy = row?.academy_name || '';
    } else {
      const row: any = await db.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(userId).first();
      academy = row?.academy_name || '';
    }
    return academy === board.academy_name;
  }
  return false;
}

// Helper: 멘토가 해당 게시판을 관리할 수 있는지 확인
export async function canMentorModerateBoard(db: any, mentorId: number, boardId: number): Promise<boolean> {
  const mentor: any = await db.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(mentorId).first();
  if (!mentor) return false;
  const board: any = await db.prepare('SELECT * FROM community_boards WHERE id = ?').bind(boardId).first();
  if (!board) return false;
  if (board.board_type === 'academy') {
    return board.academy_name === mentor.academy_name;
  }
  if (board.board_type === 'group') {
    const group: any = await db.prepare('SELECT mentor_id FROM groups WHERE id = ?').bind(board.group_id).first();
    return group?.mentor_id === mentorId;
  }
  return false;
}

// ==================== 진로 프로파일 컨텍스트 헬퍼 ====================
export async function getStudentCareerContext(db: D1Database, studentId: number): Promise<string> {
  try {
    const row: any = await db.prepare(
      'SELECT dream_department, top_departments, field_profile, major_profile, career_advice, careers FROM career_profiles WHERE student_id = ? AND parse_status = ?'
    ).bind(studentId, 'success').first()
    if (!row) return ''

    const dream = typeof row.dream_department === 'string' ? JSON.parse(row.dream_department || '{}') : row.dream_department
    const topDepts = typeof row.top_departments === 'string' ? JSON.parse(row.top_departments || '[]') : row.top_departments
    const fieldProf = typeof row.field_profile === 'string' ? JSON.parse(row.field_profile || '{}') : row.field_profile
    const majorProf = typeof row.major_profile === 'string' ? JSON.parse(row.major_profile || '{}') : row.major_profile
    const careers = typeof row.careers === 'string' ? JSON.parse(row.careers || '[]') : row.careers

    let ctx = `\n\n[학생 진로 프로파일]\n`
    if (dream.department) ctx += `- 꿈의 전공: ${dream.department} (${dream.field || ''}, 적합도 ${dream.score || 0}%)\n`
    if (Array.isArray(topDepts) && topDepts.length > 0) {
      ctx += `- TOP 학과: ${topDepts.slice(0, 3).map((d: any) => `${d.department}(${d.score}%)`).join(', ')}\n`
    }
    if (fieldProf && Object.keys(fieldProf).length > 0) {
      const topFields = Object.entries(fieldProf).sort((a: any, b: any) => b[1] - a[1]).slice(0, 3)
      ctx += `- 강점 계열: ${topFields.map(([k, v]) => `${k}(${v})`).join(', ')}\n`
    }
    if (majorProf) {
      const abilities = majorProf.abilities || []
      const personality = majorProf.personality || []
      const values = majorProf.values || []
      if (abilities.length > 0) ctx += `- 핵심 역량: ${abilities.slice(0, 3).join(', ')}\n`
      if (personality.length > 0) ctx += `- 개인 특성: ${personality.slice(0, 3).join(', ')}\n`
      if (values.length > 0) ctx += `- 가치관: ${values.slice(0, 3).join(', ')}\n`
    }
    if (Array.isArray(careers) && careers.length > 0) {
      ctx += `- 추천 커리어: ${careers.slice(0, 3).join(', ')}\n`
    }
    if (row.career_advice) ctx += `- 진로 조언: ${(row.career_advice as string).substring(0, 100)}\n`

    return ctx
  } catch (e) {
    console.error('getStudentCareerContext error:', e)
    return ''
  }
}
