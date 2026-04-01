import { Hono } from 'hono'
import type { Bindings } from '../types'
import { canMentorModerateBoard, stripHtmlForPreview } from '../helpers'

const mentorCommunity = new Hono<{ Bindings: Bindings }>()

// POST /api/community/report — 신고 생성
mentorCommunity.post('/api/community/report', async (c) => {
  try {
    const { reporter_type, reporter_id, target_type, target_id, reason } = await c.req.json();
    if (!reporter_type || !reporter_id || !target_type || !target_id || !reason) {
      return c.json({ success: false, error: '필수 항목이 누락되었습니다' }, 400);
    }
    if (!['post', 'comment'].includes(target_type)) {
      return c.json({ success: false, error: 'target_type은 post 또는 comment이어야 합니다' }, 400);
    }

    // 대상 존재 및 삭제 여부 확인
    const tableName = target_type === 'post' ? 'community_posts' : 'community_comments';
    const target: any = await c.env.DB.prepare(
      `SELECT id, is_deleted FROM ${tableName} WHERE id = ?`
    ).bind(target_id).first();
    if (!target) {
      return c.json({ success: false, error: '신고 대상을 찾을 수 없습니다' }, 404);
    }
    if (target.is_deleted === 1) {
      return c.json({ success: false, error: '이미 삭제된 콘텐츠입니다' }, 400);
    }

    // 중복 신고 확인
    const dup: any = await c.env.DB.prepare(
      'SELECT id FROM community_reports WHERE reporter_type = ? AND reporter_id = ? AND target_type = ? AND target_id = ?'
    ).bind(reporter_type, reporter_id, target_type, target_id).first();
    if (dup) {
      return c.json({ success: false, error: '이미 신고한 콘텐츠입니다' }, 409);
    }

    const result: any = await c.env.DB.prepare(
      "INSERT INTO community_reports (reporter_type, reporter_id, target_type, target_id, reason, status, created_at) VALUES (?, ?, ?, ?, ?, 'pending', datetime('now','+9 hours'))"
    ).bind(reporter_type, reporter_id, target_type, target_id, reason).run();

    return c.json({ success: true, data: { reportId: result.meta.last_row_id } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// GET /api/mentor/:mentorId/community-reports — 멘토 관할 게시판 신고 목록
mentorCommunity.get('/api/mentor/:mentorId/community-reports', async (c) => {
  try {
    const mentorId = Number(c.req.param('mentorId'));
    if (!mentorId || isNaN(mentorId)) return c.json({ success: false, error: '유효하지 않은 멘토 ID입니다' }, 400);

    // 멘토 academy 조회
    const mentor: any = await c.env.DB.prepare('SELECT academy_name FROM mentors WHERE id = ?').bind(mentorId).first();
    if (!mentor) return c.json({ success: false, error: '멘토를 찾을 수 없습니다' }, 404);

    // 멘토 관할 게시판 ID 수집
    const groupBoards: any = await c.env.DB.prepare(
      "SELECT cb.id FROM community_boards cb JOIN groups g ON cb.group_id = g.id WHERE g.mentor_id = ? AND cb.board_type = 'group' AND cb.is_active = 1"
    ).bind(mentorId).all();
    const academyBoards: any = await c.env.DB.prepare(
      "SELECT id FROM community_boards WHERE board_type = 'academy' AND academy_name = ? AND is_active = 1"
    ).bind(mentor.academy_name).all();

    const boardIds = [
      ...(groupBoards.results || []).map((r: any) => r.id),
      ...(academyBoards.results || []).map((r: any) => r.id),
    ];
    if (boardIds.length === 0) {
      return c.json({ success: true, data: { reports: [] } });
    }

    // pending 신고 조회 — post 대상
    const placeholders = boardIds.map(() => '?').join(',');
    const postReports: any = await c.env.DB.prepare(
      `SELECT cr.id, cr.reporter_type, cr.reporter_id, cr.target_type, cr.target_id, cr.reason, cr.status, cr.created_at,
              cp.title as post_title, cp.content as post_content, cp.board_id
       FROM community_reports cr
       JOIN community_posts cp ON cr.target_id = cp.id
       WHERE cr.target_type = 'post' AND cr.status = 'pending' AND cp.board_id IN (${placeholders})`
    ).bind(...boardIds).all();

    // pending 신고 조회 — comment 대상
    const commentReports: any = await c.env.DB.prepare(
      `SELECT cr.id, cr.reporter_type, cr.reporter_id, cr.target_type, cr.target_id, cr.reason, cr.status, cr.created_at,
              cc.content as comment_content, cc.post_id, cp.title as post_title, cp.board_id
       FROM community_reports cr
       JOIN community_comments cc ON cr.target_id = cc.id
       JOIN community_posts cp ON cc.post_id = cp.id
       WHERE cr.target_type = 'comment' AND cr.status = 'pending' AND cp.board_id IN (${placeholders})`
    ).bind(...boardIds).all();

    // 결과 병합 및 reporter 닉네임 조회
    const allReports = [...(postReports.results || []), ...(commentReports.results || [])];
    const reports = [];
    for (const r of allReports) {
      let reporterNickname = '알 수 없음';
      if (r.reporter_type === 'student') {
        const s: any = await c.env.DB.prepare('SELECT nickname, name FROM students WHERE id = ?').bind(r.reporter_id).first();
        reporterNickname = s?.nickname || s?.name || '학생';
      } else if (r.reporter_type === 'mentor') {
        const m: any = await c.env.DB.prepare('SELECT nickname, name FROM mentors WHERE id = ?').bind(r.reporter_id).first();
        reporterNickname = m?.nickname || m?.name || '멘토';
      }

      const targetPreview = r.target_type === 'post'
        ? stripHtmlForPreview(r.post_content || '', 100)
        : (r.comment_content || '').substring(0, 100);

      reports.push({
        id: r.id,
        reporterNickname,
        targetType: r.target_type,
        targetId: r.target_id,
        targetPreview,
        postTitle: r.post_title || null,
        reason: r.reason,
        status: r.status,
        createdAt: r.created_at,
      });
    }

    // 최신순 정렬
    reports.sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return c.json({ success: true, data: { reports } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

// PUT /api/community/reports/:reportId — 신고 처리 (resolve/dismiss)
mentorCommunity.put('/api/community/reports/:reportId', async (c) => {
  try {
    const reportId = Number(c.req.param('reportId'));
    if (!reportId || isNaN(reportId)) return c.json({ success: false, error: '유효하지 않은 신고 ID입니다' }, 400);

    const { status, resolved_by, delete_content } = await c.req.json();
    if (!status || !resolved_by) {
      return c.json({ success: false, error: '필수 항목이 누락되었습니다' }, 400);
    }
    if (!['resolved', 'dismissed'].includes(status)) {
      return c.json({ success: false, error: 'status는 resolved 또는 dismissed이어야 합니다' }, 400);
    }

    // 신고 존재 및 상태 확인
    const report: any = await c.env.DB.prepare('SELECT * FROM community_reports WHERE id = ?').bind(reportId).first();
    if (!report) return c.json({ success: false, error: '신고를 찾을 수 없습니다' }, 404);
    if (report.status !== 'pending') {
      return c.json({ success: false, error: '이미 처리된 신고입니다' }, 400);
    }

    // 멘토 권한 확인: 신고 대상의 게시판을 관리하는 멘토인지
    let boardId: number | null = null;
    if (report.target_type === 'post') {
      const post: any = await c.env.DB.prepare('SELECT board_id FROM community_posts WHERE id = ?').bind(report.target_id).first();
      boardId = post?.board_id;
    } else if (report.target_type === 'comment') {
      const comment: any = await c.env.DB.prepare('SELECT post_id FROM community_comments WHERE id = ?').bind(report.target_id).first();
      if (comment) {
        const post: any = await c.env.DB.prepare('SELECT board_id FROM community_posts WHERE id = ?').bind(comment.post_id).first();
        boardId = post?.board_id;
      }
    }
    if (!boardId || !(await canMentorModerateBoard(c.env.DB, resolved_by, boardId))) {
      return c.json({ success: false, error: '권한이 없습니다' }, 403);
    }

    // 신고 상태 업데이트
    await c.env.DB.prepare(
      "UPDATE community_reports SET status = ?, resolved_by = ?, resolved_at = datetime('now','+9 hours') WHERE id = ?"
    ).bind(status, resolved_by, reportId).run();

    // 콘텐츠 삭제 (resolved + delete_content)
    if (status === 'resolved' && delete_content === true) {
      if (report.target_type === 'post') {
        const target: any = await c.env.DB.prepare('SELECT is_deleted FROM community_posts WHERE id = ?').bind(report.target_id).first();
        if (target && target.is_deleted === 0) {
          await c.env.DB.prepare(
            "UPDATE community_posts SET is_deleted = 1, deleted_by = ? WHERE id = ?"
          ).bind(`mentor:${resolved_by}`, report.target_id).run();
        }
      } else if (report.target_type === 'comment') {
        const target: any = await c.env.DB.prepare('SELECT is_deleted, post_id FROM community_comments WHERE id = ?').bind(report.target_id).first();
        if (target && target.is_deleted === 0) {
          await c.env.DB.batch([
            c.env.DB.prepare("UPDATE community_comments SET is_deleted = 1, deleted_by = ? WHERE id = ?").bind(`mentor:${resolved_by}`, report.target_id),
            c.env.DB.prepare("UPDATE community_posts SET comment_count = MAX(0, comment_count - 1) WHERE id = ?").bind(target.post_id),
          ]);
        }
      }
    }

    return c.json({ success: true, data: { reportId, status } });
  } catch (e: any) {
    return c.json({ success: false, error: e.message }, 500);
  }
});

export default mentorCommunity
