import { Hono } from 'hono'
import type { Bindings } from '../types'

const mentorCroquet = new Hono<{ Bindings: Bindings }>()

// 멘토 → 학생 포인트 지급 (단일)
mentorCroquet.post('/api/mentor/croquet-points/give', async (c) => {
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
mentorCroquet.post('/api/mentor/croquet-points/give-bulk', async (c) => {
  try {
    const { mentorId, studentIds, amount, reason, reasonDetail } = await c.req.json();
    if (!mentorId || !studentIds || !Array.isArray(studentIds) || studentIds.length === 0 || !amount || amount <= 0) {
      return c.json({ error: '필수 입력값을 확인해주세요' }, 400);
    }
    if (amount > 10000) return c.json({ error: '1회 최대 10,000P까지 지급 가능합니다' }, 400);

    // 배치 처리: UPDATE → SELECT → INSERT를 학생별로 batch 실행
    const batchStmts = studentIds.flatMap(sid => [
      c.env.DB.prepare('UPDATE students SET croquet_balance = croquet_balance + ? WHERE id = ?').bind(amount, sid),
    ]);
    await c.env.DB.batch(batchStmts);

    // 업데이트된 잔액 일괄 조회
    const placeholders = studentIds.map(() => '?').join(',');
    const students = await c.env.DB.prepare(
      `SELECT id, name, croquet_balance FROM students WHERE id IN (${placeholders})`
    ).bind(...studentIds).all();
    const studentMap: Record<number, any> = {};
    (students.results as any[]).forEach(s => { studentMap[s.id] = s; });

    // 이력 일괄 INSERT
    const insertStmts = studentIds.map(sid => {
      const s = studentMap[sid];
      return c.env.DB.prepare(
        'INSERT INTO croquet_points (student_id, mentor_id, amount, reason, reason_detail, balance_after) VALUES (?, ?, ?, ?, ?, ?)'
      ).bind(sid, mentorId, amount, reason || '기타', reasonDetail || '', s?.croquet_balance || 0);
    });
    await c.env.DB.batch(insertStmts);

    const results = studentIds.map(sid => {
      const s = studentMap[sid];
      return { studentId: sid, name: s?.name, newBalance: s?.croquet_balance || 0, amount };
    });

    return c.json({ success: true, count: results.length, results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 멘토 지급 이력 조회
mentorCroquet.get('/api/mentor/:mentorId/croquet-points/history', async (c) => {
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

export default mentorCroquet
