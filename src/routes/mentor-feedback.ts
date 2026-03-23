import { Hono } from 'hono'
import type { Bindings } from '../types'

const mentorFeedback = new Hono<{ Bindings: Bindings }>()

// 피드백 작성
mentorFeedback.post('/api/mentor/feedback', async (c) => {
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
mentorFeedback.get('/api/mentor/feedback/student/:studentId', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const feedbacks = await c.env.DB.prepare(
      'SELECT f.*, m.name as mentor_name FROM mentor_feedbacks f JOIN mentors m ON f.mentor_id = m.id WHERE f.student_id = ? ORDER BY f.created_at DESC LIMIT 100'
    ).bind(studentId).all();
    return c.json({ feedbacks: feedbacks.results });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// 학생이 자기 피드백 조회 + 읽음 처리
mentorFeedback.get('/api/student/:studentId/feedbacks', async (c) => {
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
mentorFeedback.put('/api/student/feedback/:feedbackId/read', async (c) => {
  try {
    const feedbackId = c.req.param('feedbackId');
    await c.env.DB.prepare('UPDATE mentor_feedbacks SET is_read = 1 WHERE id = ?').bind(feedbackId).run();
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

// 피드백 수정
mentorFeedback.put('/api/mentor/feedback/:feedbackId', async (c) => {
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
mentorFeedback.delete('/api/mentor/feedback/:feedbackId', async (c) => {
  try {
    const feedbackId = c.req.param('feedbackId');
    await c.env.DB.prepare('DELETE FROM mentor_feedbacks WHERE id = ?').bind(feedbackId).run();
    return c.json({ success: true });
  } catch (e: any) { return c.json({ error: e.message }, 500); }
});

export default mentorFeedback
