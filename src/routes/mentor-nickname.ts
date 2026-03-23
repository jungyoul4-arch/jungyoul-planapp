import { Hono } from 'hono'
import type { Bindings } from '../types'
import { validateNickname } from '../helpers'

const mentorNickname = new Hono<{ Bindings: Bindings }>()

// PUT /api/mentor/:mentorId/nickname — 멘토 닉네임 설정/변경
mentorNickname.put('/api/mentor/:mentorId/nickname', async (c) => {
  const mentorId = Number(c.req.param('mentorId'));
  if (!mentorId) return c.json({ success: false, error: '유효하지 않은 멘토 ID입니다' }, 400);
  try {
    const { nickname } = await c.req.json();
    if (!nickname) return c.json({ success: false, error: '닉네임을 입력해주세요' }, 400);
    const validation = validateNickname(nickname);
    if (!validation.valid) return c.json({ success: false, error: validation.error }, 400);

    const mentor: any = await c.env.DB.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(mentorId).first();
    if (!mentor) return c.json({ success: false, error: '멘토 정보를 찾을 수 없습니다' }, 404);

    const trimmed = nickname.trim();
    const dup: any = await c.env.DB.prepare(
      `SELECT id FROM mentors WHERE nickname = ? AND id != ? AND academy_name = ?
       UNION SELECT id FROM students WHERE nickname = ? AND group_id IN (SELECT g.id FROM groups g JOIN mentors m ON g.mentor_id = m.id WHERE m.academy_name = ?)`
    ).bind(trimmed, mentorId, mentor.academy_name, trimmed, mentor.academy_name).first();
    if (dup) return c.json({ success: false, error: '이미 사용 중인 닉네임입니다' }, 409);

    await c.env.DB.prepare('UPDATE mentors SET nickname = ? WHERE id = ?').bind(trimmed, mentorId).run();
    return c.json({ success: true, data: { nickname: trimmed } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export default mentorNickname
