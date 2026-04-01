import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getKSTDate, getKSTString } from '../helpers'

const mentorRelay = new Hono<{ Bindings: Bindings }>()

// 릴레이 자격 확인: 사용자(멘토/학생)의 영어 클래스 중 학생(kind=2) 15명 이상인 클래스 목록
mentorRelay.get('/api/relay/classes', async (c) => {
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
mentorRelay.get('/api/relay/class-students', async (c) => {
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
mentorRelay.get('/api/relay/wordbook', async (c) => {
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
mentorRelay.post('/api/relay/wordbook', async (c) => {
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
mentorRelay.get('/api/relay/student-wordbook', async (c) => {
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
mentorRelay.post('/api/relay/student-entry', async (c) => {
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
mentorRelay.get('/api/relay/student-entry-detail', async (c) => {
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

export default mentorRelay
