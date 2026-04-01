import { Hono } from 'hono'
import type { Bindings } from '../types'
import { generateInviteCode, hashPassword } from '../helpers'

const mentorGroups = new Hono<{ Bindings: Bindings }>()


// ==================== MENTOR API: 그룹(반) 관리 ====================

mentorGroups.post('/api/mentor/groups', async (c) => {
  try {
    const { mentorId, name, description, maxStudents } = await c.req.json();
    if (!mentorId || !name) return c.json({ error: '멘토 ID와 반 이름은 필수입니다' }, 400);

    const inviteCode = generateInviteCode();
    const result = await c.env.DB.prepare(
      'INSERT INTO groups (mentor_id, name, invite_code, description, max_students) VALUES (?, ?, ?, ?, ?)'
    ).bind(mentorId, name, inviteCode, description || '', maxStudents || 30).run();
    // 커뮤니티 보드 자동 생성
    try {
      const newGrpId = result.meta.last_row_id;
      if (newGrpId) {
        await c.env.DB.prepare(
          "INSERT INTO community_boards (board_type, group_id, name, description) VALUES ('group', ?, ?, '')"
        ).bind(newGrpId, `${name} 게시판`).run();
      }
    } catch (e) { console.error('Board creation hook error:', e); }

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
mentorGroups.get('/api/mentor/:mentorId/groups', async (c) => {
  try {
    const mentorId = c.req.param('mentorId');
    const groups = await c.env.DB.prepare(`
      SELECT g.*,
        (SELECT COUNT(*) FROM student_groups sg JOIN students s ON sg.student_id = s.id WHERE sg.group_id = g.id AND s.is_active = 1) as student_count
      FROM groups g WHERE g.mentor_id = ? AND g.is_active = 1 ORDER BY student_count DESC, g.created_at DESC
    `).bind(mentorId).all();

    return c.json({ groups: groups.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

// 멘토 학생 동기화 (로그인 후 비동기 호출) - N:M 관계 지원
mentorGroups.post('/api/mentor/:mentorId/sync-students', async (c) => {
  try {
    const mentorId = c.req.param('mentorId');
    const body: any = await c.req.json().catch(() => ({}));
    const externalUserId = body.externalUserId;
    if (!externalUserId) return c.json({ error: 'externalUserId required' }, 400);

    const jyskApiUrl = c.env.JYSK_API_URL || 'https://jungyoul.com/api/jysk-api.php';
    const jyskApiKey = c.env.JYSK_API_KEY || 'jysk-planner-2026';

    const studentsRes = await fetch(`${jyskApiUrl}?action=get_mentor_students&user_id=${externalUserId}&key=${jyskApiKey}`);
    const ct = studentsRes.headers.get('content-type') || '';
    if (!ct.includes('json')) return c.json({ error: 'Remote API error' }, 502);

    const studentsData: any = await studentsRes.json();
    if (!studentsData.success || !studentsData.classes) return c.json({ success: true, synced: 0 });

    // 로컬 그룹 목록 조회
    const localGroups: any = await c.env.DB.prepare(
      'SELECT id, external_class_id FROM groups WHERE mentor_id = ? AND is_active = 1'
    ).bind(mentorId).all();

    const classToGroupMap = new Map<number, number>();
    for (const g of (localGroups.results || [])) {
      if (g.external_class_id) classToGroupMap.set(Number(g.external_class_id), g.id);
    }

    // ★ N:M 관계: 학생별로 그룹 목록 수집
    const studentEntries = new Map<number, { name: string, groupIds: Set<number> }>();
    const allGroupIds = new Set<number>();
    for (const cls of studentsData.classes) {
      const groupId = classToGroupMap.get(Number(cls.class_id));
      if (!groupId) continue;
      allGroupIds.add(groupId);
      for (const st of cls.students) {
        const extUserId = Number(st.user_id);
        if (!studentEntries.has(extUserId)) {
          studentEntries.set(extUserId, { name: st.name, groupIds: new Set() });
        }
        studentEntries.get(extUserId)!.groupIds.add(groupId);
      }
    }

    if (studentEntries.size === 0) return c.json({ success: true, synced: 0 });

    // 기존 학생 조회 (external_user_id 기준, 단일 레코드)
    const extUserIds = Array.from(studentEntries.keys());
    const existingStudentsMap = new Map<number, any>(); // extUserId -> student record
    for (let i = 0; i < extUserIds.length; i += 80) {
      const chunk = extUserIds.slice(i, i + 80);
      const placeholders = chunk.map(() => '?').join(',');
      const existing: any = await c.env.DB.prepare(
        `SELECT id, external_user_id, name FROM students WHERE external_user_id IN (${placeholders}) AND is_active = 1`
      ).bind(...chunk).all();
      for (const s of (existing.results || [])) {
        existingStudentsMap.set(Number(s.external_user_id), s);
      }
    }

    // 기존 student_groups 매핑 조회
    const groupIdArr = Array.from(allGroupIds);
    const existingMappings = new Set<string>(); // "studentId_groupId"
    for (let i = 0; i < groupIdArr.length; i += 80) {
      const chunk = groupIdArr.slice(i, i + 80);
      const placeholders = chunk.map(() => '?').join(',');
      const mappings: any = await c.env.DB.prepare(
        `SELECT student_id, group_id FROM student_groups WHERE group_id IN (${placeholders})`
      ).bind(...chunk).all();
      for (const m of (mappings.results || [])) {
        existingMappings.add(`${m.student_id}_${m.group_id}`);
      }
    }

    // 배치 쿼리 수집
    const batchStmts: any[] = [];
    const defaultPwHash = await hashPassword('ext_student_auto');
    const emojis = ['😊','😎','🤓','🦊','🐱','🐶','🦁','🐻','🐼','🐨','🦄','🐸','🐰','🐯'];
    const newStudentExtIds: number[] = []; // 새로 생성할 학생의 extUserId

    for (const [extUserId, entry] of studentEntries) {
      const existingStudent = existingStudentsMap.get(extUserId);

      if (!existingStudent) {
        // 학생이 없음 → students에 1개만 INSERT (group_id는 첫 번째 그룹)
        const emoji = emojis[Math.floor(Math.random() * emojis.length)];
        const firstGroupId = Array.from(entry.groupIds)[0];
        batchStmts.push(
          c.env.DB.prepare(
            'INSERT INTO students (group_id, name, password_hash, school_name, grade, profile_emoji, external_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
          ).bind(firstGroupId, entry.name, defaultPwHash, '', 0, emoji, extUserId)
        );
        newStudentExtIds.push(extUserId);
      } else {
        // 이름 변경 시 업데이트
        if (existingStudent.name !== entry.name) {
          batchStmts.push(
            c.env.DB.prepare('UPDATE students SET name = ? WHERE id = ?').bind(entry.name, existingStudent.id)
          );
        }
        // student_groups에 매핑 추가 (없는 경우만)
        for (const groupId of entry.groupIds) {
          const mappingKey = `${existingStudent.id}_${groupId}`;
          if (!existingMappings.has(mappingKey)) {
            batchStmts.push(
              c.env.DB.prepare('INSERT OR IGNORE INTO student_groups (student_id, group_id) VALUES (?, ?)').bind(existingStudent.id, groupId)
            );
          }
        }
      }
    }

    // D1 batch 실행 (학생 INSERT 먼저)
    let synced = 0;
    for (let i = 0; i < batchStmts.length; i += 50) {
      const chunk = batchStmts.slice(i, i + 50);
      await c.env.DB.batch(chunk);
      synced += chunk.length;
    }

    // 새로 생성된 학생들의 student_groups 매핑 추가
    if (newStudentExtIds.length > 0) {
      const newStudentMappings: any[] = [];
      for (const extUserId of newStudentExtIds) {
        const student: any = await c.env.DB.prepare(
          'SELECT id FROM students WHERE external_user_id = ? AND is_active = 1'
        ).bind(extUserId).first();
        if (student) {
          const entry = studentEntries.get(extUserId)!;
          for (const groupId of entry.groupIds) {
            newStudentMappings.push(
              c.env.DB.prepare('INSERT OR IGNORE INTO student_groups (student_id, group_id) VALUES (?, ?)').bind(student.id, groupId)
            );
          }
        }
      }
      for (let i = 0; i < newStudentMappings.length; i += 50) {
        const chunk = newStudentMappings.slice(i, i + 50);
        await c.env.DB.batch(chunk);
        synced += chunk.length;
      }
    }

    // ★ 원격에 없는 매핑은 student_groups에서 삭제 (학생 자체는 유지)
    const remoteStudentIds = new Set<number>();
    for (const [extUserId, entry] of studentEntries) {
      const student = existingStudentsMap.get(extUserId);
      if (student) remoteStudentIds.add(student.id);
    }
    // 해당 그룹들에서 원격에 없는 학생 매핑 삭제
    const remoteMappings = new Set<string>();
    for (const [extUserId, entry] of studentEntries) {
      const student = existingStudentsMap.get(extUserId);
      if (student) {
        for (const groupId of entry.groupIds) {
          remoteMappings.add(`${student.id}_${groupId}`);
        }
      }
    }
    const deleteStmts: any[] = [];
    for (const mapping of existingMappings) {
      if (!remoteMappings.has(mapping)) {
        const [studentId, groupId] = mapping.split('_').map(Number);
        deleteStmts.push(
          c.env.DB.prepare('DELETE FROM student_groups WHERE student_id = ? AND group_id = ?').bind(studentId, groupId)
        );
      }
    }
    for (let i = 0; i < deleteStmts.length; i += 50) {
      const chunk = deleteStmts.slice(i, i + 50);
      await c.env.DB.batch(chunk);
    }

    return c.json({ success: true, synced });
  } catch (e: any) {
    console.log('Student sync error:', e.message);
    return c.json({ error: e.message }, 500);
  }
});

// 그룹의 학생 목록 (N:M 관계 - student_groups 사용)
mentorGroups.get('/api/mentor/groups/:groupId/students', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const students = await c.env.DB.prepare(`
      SELECT s.id, s.name, s.school_name, s.grade, s.profile_emoji, s.xp, s.level,
             s.last_login_at, s.created_at, s.external_user_id
      FROM students s
      JOIN student_groups sg ON s.id = sg.student_id
      WHERE sg.group_id = ? AND s.is_active = 1
      ORDER BY s.name
    `).bind(groupId).all();

    return c.json({ students: students.results });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});

export default mentorGroups
