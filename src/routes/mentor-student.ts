import { Hono } from 'hono'
import type { Bindings } from '../types'
import { getKSTDate } from '../helpers'

const mentorStudent = new Hono<{ Bindings: Bindings }>()


// ==================== MENTOR API: 학생 전체 기록 조회 ====================

mentorStudent.get('/api/mentor/student/:studentId/all-records', async (c) => {
  try {
    const studentId = c.req.param('studentId');
    const dateFrom = c.req.query('from') || '2000-01-01';
    const dateTo = c.req.query('to') || '2099-12-31';

    const [classRecords, questionRecords, teachRecords, activityRecords, activityLogs, assignments, exams, examResults, reportRecords, classPhotos, myQuestions, feedbacks] = await Promise.all([
      c.env.DB.prepare('SELECT id, subject, date, content, keywords, understanding, memo, topic, pages, teacher_note, created_at FROM class_records WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC LIMIT 200').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM question_records WHERE student_id = ? AND created_at >= ? AND created_at < datetime(?, \'+1 day\') ORDER BY created_at DESC LIMIT 200').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM teach_records WHERE student_id = ? AND created_at >= ? AND created_at < datetime(?, \'+1 day\') ORDER BY created_at DESC LIMIT 200').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM activity_records WHERE student_id = ? ORDER BY created_at DESC LIMIT 100').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM activity_logs WHERE student_id = ? AND date BETWEEN ? AND ? ORDER BY date DESC, created_at DESC LIMIT 200').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM assignments WHERE student_id = ? ORDER BY due_date DESC LIMIT 100').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM exams WHERE student_id = ? ORDER BY start_date DESC LIMIT 50').bind(studentId).all(),
      c.env.DB.prepare('SELECT er.*, e.name as exam_name FROM exam_results er JOIN exams e ON er.exam_id = e.id WHERE er.student_id = ? ORDER BY e.start_date DESC LIMIT 50').bind(studentId).all(),
      c.env.DB.prepare('SELECT * FROM report_records WHERE student_id = ? ORDER BY created_at DESC LIMIT 100').bind(studentId).all(),
      c.env.DB.prepare('SELECT id, class_record_id, thumbnail, file_size, created_at FROM class_record_photos WHERE student_id = ? ORDER BY id DESC LIMIT 200').bind(studentId).all(),
      c.env.DB.prepare('SELECT q.*, (SELECT COUNT(*) FROM my_answers a WHERE a.question_id = q.id) as answer_count FROM my_questions q WHERE q.student_id = ? AND q.created_at >= ? AND q.created_at < datetime(?, \'+1 day\') ORDER BY q.created_at DESC LIMIT 100').bind(studentId, dateFrom, dateTo).all(),
      c.env.DB.prepare('SELECT * FROM mentor_feedbacks WHERE student_id = ? ORDER BY created_at DESC LIMIT 100').bind(studentId).all().catch(() => ({ results: [] })),
    ]);

    // 사진을 class_record_id별로 매핑
    const photoMap: Record<number, any[]> = {};
    (classPhotos.results as any[]).forEach(p => {
      if (p.class_record_id) {
        if (!photoMap[p.class_record_id]) photoMap[p.class_record_id] = [];
        photoMap[p.class_record_id].push({ id: p.id, thumbnail: p.thumbnail, file_size: p.file_size });
      }
    });

    // 날짜별로 통합
    const dateMap: Record<string, any> = {};
    const addToDate = (date: string, type: string, data: any) => {
      if (!dateMap[date]) dateMap[date] = { date, records: [] };
      dateMap[date].records.push({ type, ...data });
    };

    (classRecords.results as any[]).forEach(r => {
      // 수업 기록에 사진 정보 첨부
      const photos = photoMap[r.id] || [];
      addToDate(r.date, 'class', { ...r, _photoCount: photos.length, _photoIds: photos.map((p: any) => p.id) });
    });
    (questionRecords.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'question', r));
    (teachRecords.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'teach', r));
    (activityRecords.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'activity', r));
    (activityLogs.results as any[]).forEach(r => addToDate(r.date || r.created_at?.slice(0,10) || '', 'activity_log', r));
    (assignments.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'assignment', r));
    (reportRecords.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'report', r));
    (myQuestions.results as any[]).forEach(r => addToDate(r.created_at?.slice(0,10) || '', 'my_question', r));

    const sortedDates = Object.values(dateMap).sort((a: any, b: any) => b.date.localeCompare(a.date));

    return c.json({
      student: studentId,
      dateRange: { from: dateFrom, to: dateTo },
      dailyRecords: sortedDates,
      summary: {
        classRecords: (classRecords.results as any[]).length,
        questionRecords: (questionRecords.results as any[]).length,
        teachRecords: (teachRecords.results as any[]).length,
        activityRecords: (activityRecords.results as any[]).length,
        activityLogs: (activityLogs.results as any[]).length,
        assignments: (assignments.results as any[]).length,
        exams: (exams.results as any[]).length,
        examResults: (examResults.results as any[]).length,
        reportRecords: (reportRecords.results as any[]).length,
        myQuestions: (myQuestions.results as any[]).length,
        classPhotos: (classPhotos.results as any[]).length,
      },
      exams: exams.results,
      examResults: examResults.results,
      reportRecords: reportRecords.results,
      feedbacks: feedbacks.results,
    });
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== MENTOR API: 그룹 전체 학생 요약 (대시보드) ====================

mentorStudent.get('/api/mentor/groups/:groupId/summary', async (c) => {
  try {
    const groupId = c.req.param('groupId');
    const dateFrom = c.req.query('from') || getKSTDate();
    const dateTo = c.req.query('to') || getKSTDate();

    // KV 캐시 확인 (5분)
    const cacheKey = `group-summary:${groupId}:${dateFrom}:${dateTo}`;
    if (c.env.KV) {
      try {
        const cached = await c.env.KV.get(cacheKey, 'json');
        if (cached) return c.json(cached as any);
      } catch (_) {}
    }

    const kstNow = new Date(Date.now() + 9 * 3600000);
    const kstToday = kstNow.toISOString().slice(0,10);
    const kstDayOfWeek = kstNow.getUTCDay();

    const countWeekdays = (from: string, to: string): number => {
      let count = 0;
      const d = new Date(from + 'T00:00:00Z');
      const end = new Date(to + 'T00:00:00Z');
      while (d <= end) {
        const dow = d.getUTCDay();
        if (dow >= 1 && dow <= 5) count++;
        d.setUTCDate(d.getUTCDate() + 1);
      }
      return count;
    };
    const weekdaysInRange = countWeekdays(dateFrom, dateTo);
    const CLASSES_PER_DAY = 6;
    const expectedSchoolClasses = weekdaysInRange * CLASSES_PER_DAY;

    // 1. 학생 목록
    const students = await c.env.DB.prepare(
      'SELECT id, name, school_name, grade, profile_emoji, xp, level, last_login_at, croquet_balance, external_user_id FROM students WHERE group_id = ? AND is_active = 1 ORDER BY name'
    ).bind(groupId).all();

    const studentIds = (students.results as any[]).map(s => s.id);
    if (studentIds.length === 0) {
      const resp = { groupId, dateRange: { from: dateFrom, to: dateTo }, students: [] };
      return c.json(resp);
    }

    // 2. 배치 집계 쿼리 (N+1 → 7개 쿼리로 통합)
    const placeholders = studentIds.map(() => '?').join(',');
    const [classCounts, questionCounts, teachCounts, assignCounts, actLogCounts, schoolClassCounts, assignStats, todayAcademyCounts, todayAllCounts] = await Promise.all([
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM class_records WHERE student_id IN (${placeholders}) AND date BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM question_records WHERE student_id IN (${placeholders}) AND DATE(created_at) BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM teach_records WHERE student_id IN (${placeholders}) AND DATE(created_at) BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM assignments WHERE student_id IN (${placeholders}) AND DATE(created_at) BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM activity_logs WHERE student_id IN (${placeholders}) AND date BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM class_records WHERE student_id IN (${placeholders}) AND date BETWEEN ? AND ? AND (memo IS NULL OR memo NOT LIKE '%isAcademy%') GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM assignments WHERE student_id IN (${placeholders}) AND DATE(created_at) BETWEEN ? AND ? GROUP BY student_id`).bind(...studentIds, dateFrom, dateTo).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM class_records WHERE student_id IN (${placeholders}) AND date = ? AND memo LIKE '%isAcademy%' GROUP BY student_id`).bind(...studentIds, kstToday).all(),
      c.env.DB.prepare(`SELECT student_id, COUNT(*) as cnt FROM class_records WHERE student_id IN (${placeholders}) AND date = ? GROUP BY student_id`).bind(...studentIds, kstToday).all(),
    ]);

    // 3. 결과를 student_id별 Map으로 변환
    const toMap = (rows: any[]) => {
      const m: Record<number, any> = {};
      for (const r of rows) m[r.student_id] = r;
      return m;
    };
    const classMap = toMap(classCounts.results as any[]);
    const questionMap = toMap(questionCounts.results as any[]);
    const teachMap = toMap(teachCounts.results as any[]);
    const assignMap = toMap(assignCounts.results as any[]);
    const actLogMap = toMap(actLogCounts.results as any[]);
    const schoolMap = toMap(schoolClassCounts.results as any[]);
    const assignStatsMap = toMap(assignStats.results as any[]);
    const todayAcademyMap = toMap(todayAcademyCounts.results as any[]);
    const todayAllMap = toMap(todayAllCounts.results as any[]);

    // 4. 학생별 요약 조합 (DB 호출 없음)
    const isWeekend = kstDayOfWeek === 0 || kstDayOfWeek === 6;
    const summaries = (students.results as any[]).map(s => {
      const cc = classMap[s.id]?.cnt || 0;
      const qc = questionMap[s.id]?.cnt || 0;
      const tc = teachMap[s.id]?.cnt || 0;
      const ac = assignMap[s.id]?.cnt || 0;
      const alc = actLogMap[s.id]?.cnt || 0;
      const schoolRecords = schoolMap[s.id]?.cnt || 0;
      const totalAssign = assignStatsMap[s.id]?.total || 0;
      const completedAssign = assignStatsMap[s.id]?.completed || 0;
      const todayAcademyCount = todayAcademyMap[s.id]?.cnt || 0;

      const classRecordRate = expectedSchoolClasses > 0 ? Math.min(100, Math.round(schoolRecords / expectedSchoolClasses * 100)) : 0;
      const plannerRate = totalAssign > 0 ? Math.round(completedAssign / totalAssign * 100) : -1;

      let academyTodayRate = -1;
      if (todayAcademyCount > 0) {
        academyTodayRate = 100;
      } else if (!isWeekend) {
        academyTodayRate = 0;
      }

      return {
        ...s,
        periodStats: {
          classRecords: cc, questionRecords: qc, teachRecords: tc,
          assignments: ac, activityLogs: alc,
          total: cc + qc + tc + ac + alc,
        },
        rateStats: {
          classRecordRate, expectedClasses: expectedSchoolClasses,
          actualClassRecords: schoolRecords, plannerRate,
          totalAssignments: totalAssign, completedAssignments: completedAssign,
          academyTodayRate, todayAcademyCount, kstToday,
        },
      };
    });

    const resp = { groupId, dateRange: { from: dateFrom, to: dateTo }, students: summaries };

    // KV 캐시 저장 (5분)
    if (c.env.KV) {
      try { await c.env.KV.put(cacheKey, JSON.stringify(resp), { expirationTtl: 300 }); } catch (_) {}
    }

    return c.json(resp);
  } catch (e: any) {
    return c.json({ error: e.message }, 500);
  }
});


// ==================== MENTOR API: 질문방 통계 프록시 (CORS 우회) ====================

mentorStudent.post('/api/mentor/qa-stats', async (c) => {
  try {
    const body = await c.req.json();
    const userIds = body.user_ids || [];
    if (!Array.isArray(userIds) || userIds.length === 0) {
      return c.json({ success: true, count: 0, users: [] });
    }
    const res = await fetch('https://qa-tutoring.jung-youl.com/api/user/subject-stats-batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: userIds })
    });
    const data = await res.json();
    return c.json(data);
  } catch (e: any) {
    console.error('qa-stats proxy error:', e);
    return c.json({ success: false, error: e.message, users: [] });
  }
});

export default mentorStudent
