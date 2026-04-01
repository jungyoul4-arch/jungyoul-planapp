import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getKSTDate, callGeminiWithFallback } from '../helpers'

const mentorDashboard = new Hono<{ Bindings: Bindings }>()


// ==================== 반 전체 질문함 조회 ====================

mentorDashboard.get('/api/mentor/groups/:groupId/questions', async (c) => {
  try {
    const groupId = c.req.param('groupId')
    const subject = c.req.query('subject') || null
    const status = c.req.query('status') || null
    const studentId = c.req.query('studentId') || null
    const limit = Math.min(parseInt(c.req.query('limit') || '50'), 100)
    const offset = parseInt(c.req.query('offset') || '0')

    // 1. 그룹 학생 ID 조회
    const studentsRes = await c.env.DB.prepare(
      'SELECT id, name, profile_emoji FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name'
    ).bind(groupId).all()
    const students = studentsRes.results as any[]
    if (students.length === 0) {
      return c.json({ questions: [], total: 0, subjects: [], studentStats: [], students: [] })
    }
    const sIds = students.map(s => s.id)
    const ph = sIds.map(() => '?').join(',')

    // 2. 질문 목록 (필터 + 페이지네이션)
    let where = `q.student_id IN (${ph})`
    const params: any[] = [...sIds]
    if (subject) { where += ' AND q.subject = ?'; params.push(subject) }
    if (status) { where += ' AND q.status = ?'; params.push(status) }
    if (studentId) { where += ' AND q.student_id = ?'; params.push(parseInt(studentId)) }

    const [questionsRes, countRes] = await Promise.all([
      c.env.DB.prepare(
        `SELECT q.id, q.student_id, q.subject, q.title, q.content, q.status, q.image_key, q.source, q.date, q.created_at,
                s.name as student_name, s.profile_emoji,
                (SELECT COUNT(*) FROM my_answers a WHERE a.question_id = q.id) as answer_count
         FROM my_questions q JOIN students s ON q.student_id = s.id
         WHERE ${where} ORDER BY q.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM my_questions q WHERE ${where}`
      ).bind(...params).all(),
    ])

    // 3. 과목 목록 (필터 드롭다운용)
    const subjectsRes = await c.env.DB.prepare(
      `SELECT subject, COUNT(*) as cnt FROM my_questions WHERE student_id IN (${ph}) GROUP BY subject ORDER BY cnt DESC`
    ).bind(...sIds).all()

    // 4. 학생별 질문 통계
    const statsRes = await c.env.DB.prepare(
      `SELECT student_id, COUNT(*) as total,
              SUM(CASE WHEN status = '답변완료' THEN 1 ELSE 0 END) as answered,
              SUM(CASE WHEN status != '답변완료' THEN 1 ELSE 0 END) as unanswered
       FROM my_questions WHERE student_id IN (${ph}) GROUP BY student_id ORDER BY total DESC`
    ).bind(...sIds).all()

    const total = (countRes.results as any[])[0]?.cnt || 0

    return c.json({
      questions: questionsRes.results,
      total,
      subjects: (subjectsRes.results as any[]).map(r => ({ name: r.subject, count: r.cnt })),
      studentStats: (statsRes.results as any[]).map(r => {
        const st = students.find(s => s.id === r.student_id)
        return { ...r, student_name: st?.name, profile_emoji: st?.profile_emoji }
      }),
      students,
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== 질문 상세 (답변 포함) ====================

mentorDashboard.get('/api/mentor/questions/:questionId/detail', async (c) => {
  try {
    const questionId = c.req.param('questionId')
    const question: any = await c.env.DB.prepare(
      `SELECT q.*, s.name as student_name, s.profile_emoji
       FROM my_questions q JOIN students s ON q.student_id = s.id WHERE q.id = ?`
    ).bind(questionId).first()
    if (!question) return c.json({ error: '질문을 찾을 수 없습니다' }, 404)

    const answers = await c.env.DB.prepare(
      'SELECT * FROM my_answers WHERE question_id = ? ORDER BY created_at ASC'
    ).bind(questionId).all()

    return c.json({ success: true, question, answers: answers.results })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== 과목×학생 수업기록 매트릭스 ====================

mentorDashboard.get('/api/mentor/groups/:groupId/subject-matrix', async (c) => {
  try {
    const groupId = c.req.param('groupId')
    const dateFrom = c.req.query('from') || getKSTDate()
    const dateTo = c.req.query('to') || getKSTDate()

    const studentsRes = await c.env.DB.prepare(
      'SELECT id, name, profile_emoji FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name'
    ).bind(groupId).all()
    const students = studentsRes.results as any[]
    if (students.length === 0) return c.json({ subjects: [], students: [], matrix: {} })
    const sIds = students.map(s => s.id)
    const ph = sIds.map(() => '?').join(',')

    // 과목×학생별 기록 수 + 평균 이해도
    const matrixRes = await c.env.DB.prepare(
      `SELECT student_id, subject, COUNT(*) as cnt, ROUND(AVG(understanding), 1) as avg_understanding
       FROM class_records WHERE student_id IN (${ph}) AND date BETWEEN ? AND ?
       GROUP BY student_id, subject`
    ).bind(...sIds, dateFrom, dateTo).all()

    // 과목 목록
    const subjectSet = new Set<string>()
    const matrix: Record<number, Record<string, { count: number, avgUnderstanding: number }>> = {}
    for (const r of matrixRes.results as any[]) {
      subjectSet.add(r.subject)
      if (!matrix[r.student_id]) matrix[r.student_id] = {}
      matrix[r.student_id][r.subject] = { count: r.cnt, avgUnderstanding: r.avg_understanding }
    }

    const subjects = Array.from(subjectSet).sort()

    return c.json({
      subjects,
      students: students.map(s => ({
        id: s.id, name: s.name, profile_emoji: s.profile_emoji,
        records: matrix[s.id] || {},
      })),
      dateRange: { from: dateFrom, to: dateTo },
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== 과목별 진도 상세 ====================

mentorDashboard.get('/api/mentor/groups/:groupId/subject-progress', async (c) => {
  try {
    const groupId = c.req.param('groupId')
    const subject = c.req.query('subject')
    if (!subject) return c.json({ error: 'subject 파라미터 필수' }, 400)

    const studentsRes = await c.env.DB.prepare(
      'SELECT id, name, profile_emoji, grade FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name'
    ).bind(groupId).all()
    const students = studentsRes.results as any[]
    if (students.length === 0) return c.json({ students: [], questions: [] })
    const sIds = students.map(s => s.id)
    const ph = sIds.map(() => '?').join(',')

    // 해당 과목 수업기록 (최근 200건)
    const recordsRes = await c.env.DB.prepare(
      `SELECT cr.id, cr.student_id, cr.date, cr.content, cr.keywords, cr.understanding, cr.memo, cr.topic, cr.teacher_note, cr.created_at
       FROM class_records cr WHERE cr.student_id IN (${ph}) AND cr.subject = ?
       ORDER BY cr.date DESC, cr.created_at DESC LIMIT 200`
    ).bind(...sIds, subject).all()

    // 학생별 집계
    const statsRes = await c.env.DB.prepare(
      `SELECT student_id, COUNT(*) as total, ROUND(AVG(understanding),1) as avg_understanding, MAX(date) as last_date
       FROM class_records WHERE student_id IN (${ph}) AND subject = ? GROUP BY student_id`
    ).bind(...sIds, subject).all()

    // 해당 과목 질문
    const questionsRes = await c.env.DB.prepare(
      `SELECT q.id, q.student_id, q.title, q.content, q.status, q.created_at,
              (SELECT COUNT(*) FROM my_answers a WHERE a.question_id = q.id) as answer_count
       FROM my_questions q WHERE q.student_id IN (${ph}) AND q.subject = ?
       ORDER BY q.created_at DESC LIMIT 50`
    ).bind(...sIds, subject).all()

    // 사진 수
    const photosRes = await c.env.DB.prepare(
      `SELECT cr.student_id, COUNT(p.id) as photo_count
       FROM class_record_photos p JOIN class_records cr ON p.class_record_id = cr.id
       WHERE cr.student_id IN (${ph}) AND cr.subject = ? GROUP BY cr.student_id`
    ).bind(...sIds, subject).all()

    const statsMap: Record<number, any> = {}
    for (const r of statsRes.results as any[]) statsMap[r.student_id] = r
    const photoMap: Record<number, number> = {}
    for (const r of photosRes.results as any[]) photoMap[r.student_id] = r.photo_count
    const questionMap: Record<number, any[]> = {}
    for (const q of questionsRes.results as any[]) {
      if (!questionMap[q.student_id]) questionMap[q.student_id] = []
      questionMap[q.student_id].push(q)
    }

    // 학생별 최근 기록 (5건씩)
    const recordsByStudent: Record<number, any[]> = {}
    for (const r of recordsRes.results as any[]) {
      if (!recordsByStudent[r.student_id]) recordsByStudent[r.student_id] = []
      if (recordsByStudent[r.student_id].length < 5) recordsByStudent[r.student_id].push(r)
    }

    return c.json({
      subject,
      students: students.map(s => ({
        id: s.id, name: s.name, profile_emoji: s.profile_emoji, grade: s.grade,
        stats: statsMap[s.id] || { total: 0, avg_understanding: null, last_date: null },
        recentRecords: recordsByStudent[s.id] || [],
        questions: questionMap[s.id] || [],
        photoCount: photoMap[s.id] || 0,
      })),
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


// ==================== AI 과목별 진도 요약 ====================

mentorDashboard.post('/api/mentor/groups/:groupId/ai-progress-summary', async (c) => {
  try {
    const groupId = c.req.param('groupId')
    const { subject, studentId } = await c.req.json() as { subject: string, studentId?: number }
    if (!subject) return c.json({ error: 'subject 필수' }, 400)

    const studentsRes = await c.env.DB.prepare(
      studentId
        ? 'SELECT id, name, grade FROM students WHERE id = ? AND group_id = ? AND is_active = 1'
        : 'SELECT id, name, grade FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name'
    ).bind(...(studentId ? [studentId, groupId] : [groupId])).all()
    const students = studentsRes.results as any[]
    if (students.length === 0) return c.json({ error: '학생 없음' }, 400)
    const sIds = students.map(s => s.id)
    const ph = sIds.map(() => '?').join(',')

    // 수업기록 + 질문 조회
    const [recordsRes, questionsRes] = await Promise.all([
      c.env.DB.prepare(
        `SELECT cr.student_id, cr.date, cr.content, cr.keywords, cr.understanding, cr.memo
         FROM class_records cr WHERE cr.student_id IN (${ph}) AND cr.subject = ?
         ORDER BY cr.date DESC LIMIT 300`
      ).bind(...sIds, subject).all(),
      c.env.DB.prepare(
        `SELECT q.student_id, q.title, q.content, q.status, q.created_at
         FROM my_questions q WHERE q.student_id IN (${ph}) AND q.subject = ?
         ORDER BY q.created_at DESC LIMIT 100`
      ).bind(...sIds, subject).all(),
    ])

    if ((recordsRes.results as any[]).length === 0) {
      return c.json({ success: true, summary: `${subject} 과목에 대한 수업 기록이 없습니다.` })
    }

    // 학생별로 묶기
    const studentLines = students.map(s => {
      const records = (recordsRes.results as any[]).filter(r => r.student_id === s.id)
      const questions = (questionsRes.results as any[]).filter(q => q.student_id === s.id)
      if (records.length === 0) return `[${s.name}] 기록 없음`
      const recLines = records.slice(0, 10).map(r => {
        let kw = ''
        try { kw = JSON.parse(r.keywords || '[]').join(',') } catch { kw = r.keywords || '' }
        return `${r.date} | ${r.content?.slice(0, 80) || ''} | 키워드:${kw} | 이해도:${r.understanding || '-'}/5`
      }).join('\n')
      const qLines = questions.slice(0, 5).map(q => `- ${q.title} (${q.status})`).join('\n')
      return `[${s.name} ${s.grade || ''}학년] 기록 ${records.length}건, 질문 ${questions.length}건\n수업기록:\n${recLines}${qLines ? `\n질문:\n${qLines}` : ''}`
    }).join('\n\n')

    const prompt = `당신은 고등학교 ${subject} 교과 멘토입니다. 아래는 학생들의 ${subject} 수업 기록과 질문 내용입니다.

각 학생의 학습 진도 상황을 멘토가 한눈에 파악할 수 있도록 간결하게 요약해주세요.

포함할 내용:
1. 각 학생이 현재 어떤 단원/주제를 학습 중인지
2. 이해도 추이 (향상/정체/하락)
3. 질문에서 드러나는 취약점
4. 주의가 필요한 학생 (기록 없음, 이해도 낮음 등)

형식: 학생별 2-3줄로 요약. 마지막에 "전체 한줄 요약" 추가.

학생 데이터:
${studentLines}`

    const { text } = await callGeminiWithFallback({
      geminiKey: c.env.GEMINI_API_KEY,
      openaiKey: c.env.OPENAI_API_KEY,
      anthropicKey: c.env.ANTHROPIC_API_KEY,
      prompt,
      temperature: 0.3,
    })

    return c.json({ success: true, summary: text })
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500)
  }
})


// ==================== 반 전체 사진 갤러리 ====================

mentorDashboard.get('/api/mentor/groups/:groupId/photos', async (c) => {
  try {
    const groupId = c.req.param('groupId')
    const filterStudent = c.req.query('studentId') || null
    const filterSubject = c.req.query('subject') || null
    const limit = Math.min(parseInt(c.req.query('limit') || '40'), 80)
    const offset = parseInt(c.req.query('offset') || '0')

    const studentsRes = await c.env.DB.prepare(
      'SELECT id FROM students WHERE group_id = ? AND is_active = 1'
    ).bind(groupId).all()
    const sIds = (studentsRes.results as any[]).map(s => s.id)
    if (sIds.length === 0) return c.json({ photos: [], total: 0 })
    const ph = sIds.map(() => '?').join(',')

    let where = `cr.student_id IN (${ph})`
    const params: any[] = [...sIds]
    if (filterStudent) { where += ' AND cr.student_id = ?'; params.push(parseInt(filterStudent)) }
    if (filterSubject) { where += ' AND cr.subject = ?'; params.push(filterSubject) }

    const [photosRes, countRes] = await Promise.all([
      c.env.DB.prepare(
        `SELECT p.id, p.thumbnail, p.file_size, p.created_at as photo_date,
                cr.student_id, cr.subject, cr.date, cr.content,
                s.name as student_name, s.profile_emoji
         FROM class_record_photos p
         JOIN class_records cr ON p.class_record_id = cr.id
         JOIN students s ON cr.student_id = s.id
         WHERE ${where}
         ORDER BY p.created_at DESC LIMIT ? OFFSET ?`
      ).bind(...params, limit, offset).all(),
      c.env.DB.prepare(
        `SELECT COUNT(*) as cnt FROM class_record_photos p
         JOIN class_records cr ON p.class_record_id = cr.id
         WHERE ${where}`
      ).bind(...params).all(),
    ])

    const total = (countRes.results as any[])[0]?.cnt || 0

    return c.json({ photos: photosRes.results, total })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})


export default mentorDashboard
