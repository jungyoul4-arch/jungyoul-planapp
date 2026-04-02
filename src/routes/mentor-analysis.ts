import { Hono } from 'hono'
import type { Bindings } from '../types'
import { callGeminiWithFallback, getExternalUserId } from '../helpers'

const mentorAnalysis = new Hono<{ Bindings: Bindings }>()


// ==================== 탐구 소재 분석 (멘토용) ====================

// POST: AI 분석 실행
mentorAnalysis.post('/api/mentor/:mentorId/student/:studentId/question-analysis', async (c) => {
  try {
    const mentorId = parseInt(c.req.param('mentorId'))
    const studentId = parseInt(c.req.param('studentId'))
    const { subjects, dateFrom, dateTo } = await c.req.json() as { subjects?: string[], dateFrom?: string, dateTo?: string }

    const subjectsKey = (subjects && subjects.length > 0) ? subjects.sort().join(',') : '전체'
    const dfKey = dateFrom || ''
    const dtKey = dateTo || ''

    // 24시간 캐시 확인
    const cached: any = await c.env.DB.prepare(
      `SELECT * FROM question_analysis WHERE student_id = ? AND mentor_id = ? AND subjects = ? AND COALESCE(date_from,'') = ? AND COALESCE(date_to,'') = ? AND created_at > datetime('now','+9 hours','-24 hours') ORDER BY created_at DESC LIMIT 1`
    ).bind(studentId, mentorId, subjectsKey, dfKey, dtKey).first()
    if (cached) {
      return c.json({ success: true, data: { ...cached, result_json: JSON.parse(cached.result_json), cached: true } })
    }

    // 질문 조회
    let query = 'SELECT id, subject, title, content, status, created_at, source FROM my_questions WHERE student_id = ?'
    const params: any[] = [studentId]
    if (subjects && subjects.length > 0 && !subjects.includes('전체')) {
      query += ` AND subject IN (${subjects.map(() => '?').join(',')})`
      params.push(...subjects)
    }
    if (dateFrom) { query += ' AND created_at >= ?'; params.push(dateFrom) }
    if (dateTo) { query += ' AND created_at < datetime(?, \'+1 day\')'; params.push(dateTo) }
    query += ' ORDER BY created_at DESC LIMIT 200'

    const questions: any = await c.env.DB.prepare(query).bind(...params).all()
    const qList = questions.results || []
    if (qList.length === 0) {
      return c.json({ success: false, error: '분석할 질문이 없습니다. 질문방에 질문을 먼저 등록해주세요.' }, 400)
    }

    // 답변도 함께 조회
    const qIds = qList.map((q: any) => q.id)
    let answers: any[] = []
    if (qIds.length > 0) {
      const ansRes: any = await c.env.DB.prepare(
        `SELECT question_id, content FROM my_answers WHERE question_id IN (${qIds.map(() => '?').join(',')}) ORDER BY created_at ASC`
      ).bind(...qIds).all()
      answers = ansRes.results || []
    }
    const answerMap: Record<number, string[]> = {}
    for (const a of answers) {
      if (!answerMap[a.question_id]) answerMap[a.question_id] = []
      answerMap[a.question_id].push(a.content)
    }

    // AI 프롬프트 구성
    const questionLines = qList.map((q: any, i: number) => {
      const ans = answerMap[q.id] ? answerMap[q.id].join(' / ') : '(미답변)'
      return `[${i}] 과목:${q.subject || '기타'} | 제목:${q.title} | 내용:${q.content || ''} | 답변:${ans} | 상태:${q.status} | 출처:${q.source || ''} | 날짜:${q.created_at?.slice(0, 10) || ''}`
    }).join('\n')

    // 학생 이름 조회
    const student: any = await c.env.DB.prepare('SELECT name, school_name, grade FROM students WHERE id = ?').bind(studentId).first()
    const studentName = student?.name || '학생'

    const prompt = `당신은 고등학교 교육 전문가이자 탐구보고서 지도 멘토입니다.
아래는 ${studentName} 학생이 질문방에 기록한 질문 목록입니다. 이 질문들의 패턴을 분석하고, 학생에게 적합한 탐구보고서 소재를 추천해주세요.

## 학생 정보
- 이름: ${studentName}
- 학교: ${student?.school_name || '미입력'}
- 학년: ${student?.grade || '미입력'}학년

## 질문 목록 (총 ${qList.length}개)
${questionLines}

## 분석 지시사항
1. 질문들을 주제별로 클러스터링하세요 (3~6개 클러스터)
2. 각 클러스터에서 학생의 관심사와 사고 패턴을 분석하세요
3. 이 학생에게 적합한 탐구보고서 소재를 5~8개 추천하세요
4. 각 추천에 탐구 깊이(depth)를 1(기초탐구), 2(심화탐구), 3(융합탐구)으로 표시하세요

다음 JSON 형식으로 응답하세요:
{
  "summary": "학생의 질문 패턴과 학습 성향 요약 (2~3문장)",
  "clusters": [
    { "theme": "클러스터 주제", "questions": [질문 인덱스 배열], "insight": "이 클러스터에서 발견된 학생의 관심사/사고 패턴" }
  ],
  "recommendations": [
    {
      "title": "탐구 주제 제목",
      "subject": "관련 교과목",
      "description": "탐구 내용 설명 (2~3문장)",
      "rationale": "이 학생에게 이 주제가 적합한 이유",
      "approach": "구체적인 탐구 접근법/방법론",
      "depth": 1,
      "keywords": ["핵심", "키워드"]
    }
  ]
}`

    const externalId = await getExternalUserId(c.env.DB, studentId)
    const { text, source } = await callGeminiWithFallback({
      proxySecret: c.env.AI_PROXY_SECRET,
      prompt,
      jsonMode: true,
      temperature: 0.4,
      externalId,
      task: 'question-analysis',
    })

    let resultJson: any
    try { resultJson = JSON.parse(text) } catch { resultJson = { summary: text, clusters: [], recommendations: [] } }

    // 학생당 최대 5개 저장 — 초과 시 가장 오래된 것 삭제
    const existing: any = await c.env.DB.prepare(
      'SELECT id FROM question_analysis WHERE student_id = ? ORDER BY created_at DESC'
    ).bind(studentId).all()
    if ((existing.results || []).length >= 5) {
      const toDelete = (existing.results as any[]).slice(4)
      for (const row of toDelete) {
        await c.env.DB.prepare('DELETE FROM question_analysis WHERE id = ?').bind(row.id).run()
      }
    }

    // 저장
    const ins: any = await c.env.DB.prepare(
      'INSERT INTO question_analysis (student_id, mentor_id, subjects, date_from, date_to, question_count, result_json) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, mentorId, subjectsKey, dateFrom || null, dateTo || null, qList.length, JSON.stringify(resultJson)).run()

    return c.json({ success: true, data: { id: ins.meta?.last_row_id, student_id: studentId, mentor_id: mentorId, subjects: subjectsKey, date_from: dateFrom || null, date_to: dateTo || null, question_count: qList.length, result_json: resultJson, ai_source: source, cached: false } })
  } catch (e: any) {
    console.error('question-analysis error:', e)
    return c.json({ success: false, error: e.message || '분석 중 오류가 발생했습니다' }, 500)
  }
})

// GET: 분석 이력 목록
mentorAnalysis.get('/api/mentor/:mentorId/student/:studentId/question-analysis', async (c) => {
  try {
    const mentorId = parseInt(c.req.param('mentorId'))
    const studentId = parseInt(c.req.param('studentId'))
    const rows: any = await c.env.DB.prepare(
      'SELECT id, student_id, mentor_id, subjects, date_from, date_to, question_count, created_at FROM question_analysis WHERE student_id = ? ORDER BY created_at DESC LIMIT 20'
    ).bind(studentId).all()
    return c.json({ success: true, data: rows.results || [] })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

// GET: 분석 상세
mentorAnalysis.get('/api/mentor/:mentorId/student/:studentId/question-analysis/:id', async (c) => {
  try {
    const id = parseInt(c.req.param('id'))
    const studentId = parseInt(c.req.param('studentId'))
    const row: any = await c.env.DB.prepare(
      'SELECT * FROM question_analysis WHERE id = ? AND student_id = ?'
    ).bind(id, studentId).first()
    if (!row) return c.json({ success: false, error: '분석 결과를 찾을 수 없습니다' }, 404)
    row.result_json = JSON.parse(row.result_json || '{}')
    return c.json({ success: true, data: row })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})

export default mentorAnalysis
