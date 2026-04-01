import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getKSTString, recordXp, callGeminiWithFallback } from '../helpers'

const mentorQuestions = new Hono<{ Bindings: Bindings }>()

// 질문 등록
mentorQuestions.post('/api/my-questions', async (c) => {
  try {
    const { studentId, subject, classRecordId, title, content, imageKey, thumbnailKey, questionLevel, aiImproved, source, period, date, skipXp, parentId } = await c.req.json()
    if (!studentId || !title || title.trim().length < 2) return c.json({ error: '질문 제목을 2자 이상 입력해주세요' }, 400)

    // 중복 방지: classRecordId + title 조합
    if (classRecordId) {
      const dup: any = await c.env.DB.prepare('SELECT id FROM my_questions WHERE student_id = ? AND class_record_id = ? AND title = ?')
        .bind(studentId, classRecordId, title.trim()).first()
      if (dup) return c.json({ success: true, questionId: dup.id, duplicate: true })
    }

    // 사진이 base64이면 R2에 업로드 후 r2:키로 저장
    let storedImageKey = imageKey || null
    let storedThumbnailKey = thumbnailKey || null
    if (imageKey && typeof imageKey === 'string' && imageKey.startsWith('data:image/')) {
      if (c.env.R2) {
        try {
          const r2Key = `questions/${studentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
          const match = imageKey.match(/^data:(image\/\w+);base64,(.+)$/)
          const rawBase64 = match ? match[2] : imageKey.replace(/^data:image\/\w+;base64,/, '')
          const binary = Uint8Array.from(atob(rawBase64), ch => ch.charCodeAt(0))
          await c.env.R2.put(r2Key, binary, { httpMetadata: { contentType: match?.[1] || 'image/jpeg' } })
          storedImageKey = `r2:${r2Key}`
          storedThumbnailKey = imageKey.slice(0, 200) // 썸네일용 base64 앞부분
        } catch (e) {
          console.error('R2 upload failed for question photo, using base64 fallback:', e)
          // R2 실패 시 base64 그대로 저장 (폴백)
        }
      }
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO my_questions (student_id, subject, class_record_id, title, content, image_key, thumbnail_key, question_level, ai_improved, source, period, date, parent_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).bind(studentId, subject || '기타', classRecordId || null, title.trim(), content || '', storedImageKey, storedThumbnailKey, questionLevel || null, aiImproved || null, source || null, period || null, date || null, parentId || null).run()

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
mentorQuestions.get('/api/my-questions', async (c) => {
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

    // R2 사진 해석: image_key가 'r2:'로 시작하면 R2에서 조회하여 base64로 변환
    if (c.env.R2 && questions.results) {
      const r2Questions = questions.results.filter((q: any) => q.image_key && q.image_key.startsWith('r2:'))
      await Promise.all(r2Questions.map(async (q: any) => {
        try {
          const r2Key = q.image_key.slice(3)
          const obj = await c.env.R2.get(r2Key)
          if (obj) {
            const buf = await obj.arrayBuffer()
            const bytes = new Uint8Array(buf)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
            const base64 = btoa(binary)
            const mime = obj.httpMetadata?.contentType || 'image/jpeg'
            q.image_key = `data:${mime};base64,${base64}`
          }
        } catch (e) { console.error('R2 read failed:', e) }
      }))
    }

    return c.json({ questions: questions.results })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 질문 통계 (IMPORTANT: :id 라우트보다 먼저 정의해야 "stats"가 :id로 매칭되지 않음)
mentorQuestions.get('/api/my-questions/stats', async (c) => {
  try {
    const studentId = c.req.query('studentId')
    if (!studentId) return c.json({ error: 'studentId 필수' }, 400)

    // 통합 쿼리: 7개 → 3개로 최적화
    const [combined, avgResolve, subjectStats] = await Promise.all([
      c.env.DB.prepare(`
        SELECT
          COUNT(*) as total,
          SUM(CASE WHEN status = '미답변' THEN 1 ELSE 0 END) as unanswered,
          SUM(CASE WHEN status = '답변완료' THEN 1 ELSE 0 END) as answered,
          SUM(CASE WHEN created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as weekly_total,
          SUM(CASE WHEN status = '답변완료' AND created_at >= datetime('now', '-7 days') THEN 1 ELSE 0 END) as weekly_answered
        FROM my_questions WHERE student_id = ?
      `).bind(studentId).first(),
      c.env.DB.prepare('SELECT AVG(resolve_days) as avg_days, AVG(resolve_hours) as avg_hours FROM my_answers WHERE student_id = ?').bind(studentId).first(),
      c.env.DB.prepare('SELECT subject, COUNT(*) as cnt FROM my_questions WHERE student_id = ? GROUP BY subject ORDER BY cnt DESC').bind(studentId).all(),
    ])

    const s = combined as any
    return c.json({
      total: s?.total || 0,
      unanswered: s?.unanswered || 0,
      answered: s?.answered || 0,
      avgResolveDays: Math.round(((avgResolve as any)?.avg_days || 0) * 10) / 10,
      avgResolveHours: Math.round(((avgResolve as any)?.avg_hours || 0) * 10) / 10,
      subjectStats: (subjectStats as any)?.results || [],
      weeklyQuestions: s?.weekly_total || 0,
      weeklyAnswered: s?.weekly_answered || 0,
    })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 질문 상세 + 답변 조회
mentorQuestions.get('/api/my-questions/:id', async (c) => {
  try {
    const id = c.req.param('id')
    const question: any = await c.env.DB.prepare('SELECT * FROM my_questions WHERE id = ?').bind(id).first()
    if (!question) return c.json({ error: '질문을 찾을 수 없습니다' }, 404)

    // R2 사진 해석: image_key가 'r2:'로 시작하면 R2에서 조회하여 base64로 변환
    if (question.image_key && question.image_key.startsWith('r2:') && c.env.R2) {
      try {
        const r2Key = question.image_key.slice(3)
        const obj = await c.env.R2.get(r2Key)
        if (obj) {
          const buf = await obj.arrayBuffer()
          const bytes = new Uint8Array(buf)
          let binary = ''
          for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
          const base64 = btoa(binary)
          const mime = obj.httpMetadata?.contentType || 'image/jpeg'
          question.image_key = `data:${mime};base64,${base64}`
        }
      } catch (e) {
        console.error('R2 read failed for question photo:', e)
        // R2 실패 시 image_key 그대로 유지 (r2:... 형태)
      }
    }

    const answers = await c.env.DB.prepare('SELECT * FROM my_answers WHERE question_id = ? ORDER BY created_at DESC').bind(id).all()

    // 답변 사진도 R2 해석
    if (c.env.R2 && answers.results) {
      const r2Answers = answers.results.filter((a: any) => a.image_key && a.image_key.startsWith('r2:'))
      await Promise.all(r2Answers.map(async (a: any) => {
        try {
          const r2Key = a.image_key.slice(3)
          const obj = await c.env.R2.get(r2Key)
          if (obj) {
            const buf = await obj.arrayBuffer()
            const bytes = new Uint8Array(buf)
            let binary = ''
            for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
            const base64 = btoa(binary)
            const mime = obj.httpMetadata?.contentType || 'image/jpeg'
            a.image_key = `data:${mime};base64,${base64}`
          }
        } catch (e) { console.error('R2 read failed for answer photo:', e) }
      }))
    }

    return c.json({ question, answers: answers.results })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

// 본인이 직접 답변 등록
mentorQuestions.post('/api/my-questions/:id/answer', async (c) => {
  try {
    const questionId = c.req.param('id')
    const { studentId, content, imageKey } = await c.req.json()
    if (!studentId || !content || content.trim().length < 2) return c.json({ error: '답변 내용을 2자 이상 입력해주세요' }, 400)

    // 소요 시간 자동 계산
    const question: any = await c.env.DB.prepare('SELECT created_at FROM my_questions WHERE id = ?').bind(questionId).first()
    if (!question) return c.json({ error: '질문을 찾을 수 없습니다' }, 404)

    const resolveHours = (Date.now() - new Date(question.created_at).getTime()) / (1000 * 60 * 60)
    const resolveDays = Math.ceil(resolveHours / 24)

    // 답변 사진도 R2에 업로드
    let storedAnswerImageKey = imageKey || null
    if (imageKey && typeof imageKey === 'string' && imageKey.startsWith('data:image/') && c.env.R2) {
      try {
        const r2Key = `answers/${studentId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`
        const match = imageKey.match(/^data:(image\/\w+);base64,(.+)$/)
        const rawBase64 = match ? match[2] : imageKey.replace(/^data:image\/\w+;base64,/, '')
        const binary = Uint8Array.from(atob(rawBase64), ch => ch.charCodeAt(0))
        await c.env.R2.put(r2Key, binary, { httpMetadata: { contentType: match?.[1] || 'image/jpeg' } })
        storedAnswerImageKey = `r2:${r2Key}`
      } catch (e) {
        console.error('R2 upload failed for answer photo:', e)
      }
    }

    const result = await c.env.DB.prepare(
      'INSERT INTO my_answers (question_id, student_id, content, image_key, resolve_hours, resolve_days) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(questionId, studentId, content.trim(), storedAnswerImageKey, Math.round(resolveHours * 10) / 10, resolveDays).run()

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
mentorQuestions.put('/api/my-questions/:id/status', async (c) => {
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
mentorQuestions.put('/api/my-questions/:qid/answer/:aid', async (c) => {
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
mentorQuestions.delete('/api/my-questions/:qid/answer/:aid', async (c) => {
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
mentorQuestions.post('/api/my-questions/:id/improve', async (c) => {
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
      proxySecret: c.env.AI_PROXY_SECRET,
      prompt,
      jsonMode: false,
      temperature: 0.4,
      externalId: question.student_id ? String(question.student_id) : undefined,
      task: 'question-improve',
    })

    const improved = text.trim().replace(/^["']|["']$/g, '')
    await c.env.DB.prepare('UPDATE my_questions SET ai_improved = ? WHERE id = ?').bind(improved, questionId).run()

    return c.json({ success: true, aiImproved: improved })
  } catch (e: any) {
    return c.json({ error: e.message }, 500)
  }
})

export default mentorQuestions
