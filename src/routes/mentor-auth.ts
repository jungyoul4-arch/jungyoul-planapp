import { Hono } from 'hono'
import type { Bindings } from '../types'
import { hashPassword, verifyPassword, generateToken, generateInviteCode } from '../helpers'

const mentorAuth = new Hono<{ Bindings: Bindings }>()


// ==================== AUTH API: 멘토 회원가입 ====================

mentorAuth.post('/api/auth/mentor/register', async (c) => {
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
    const groupResult = await c.env.DB.prepare(
      'INSERT INTO groups (mentor_id, name, invite_code, description) VALUES (?, ?, ?, ?)'
    ).bind(mentorId, `${name} 선생님 반`, inviteCode, '').run();
    // 커뮤니티 보드 자동 생성
    try {
      const newGroupId = groupResult.meta.last_row_id;
      if (newGroupId) {
        await c.env.DB.prepare(
          "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
        ).bind(newGroupId, `${name} 선생님 반 게시판`).run();
      }
    } catch (e) { console.error('Board creation hook error:', e); }

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

mentorAuth.post('/api/auth/mentor/login', async (c) => {
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
      'SELECT id, name, invite_code, description, max_students, is_active FROM groups WHERE mentor_id = ? AND is_active = 1'
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
mentorAuth.post('/api/auth/director/login', async (c) => {
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

export default mentorAuth
