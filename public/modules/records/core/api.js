/* ================================================================
   Records Module — core/api.js
   API 호출 계층 (6가지 기록 타입 CRUD)
   ================================================================ */

import { state } from './state.js';
import { tryParseJSON } from './utils.js';

function studentId() {
  return state.studentId;
}

export const DB = {
  studentId,

  // === 수업 기록 ===
  async loadClassRecords() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/class-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbClassRecords = (data.records || []).map(r => {
          const photos = tryParseJSON(r.photos, []);
          return {
            id: r.id,
            subject: r.subject,
            date: r.date,
            content: r.content,
            keywords: tryParseJSON(r.keywords, []),
            understanding: r.understanding,
            memo: r.memo,
            topic: r.topic || '',
            pages: r.pages || '',
            photos,
            photo_count: r.photo_count || photos.length || 0,
            teacher_note: r.teacher_note || '',
            ai_credit_log: tryParseJSON(r.ai_credit_log, null),
            photo_tags: tryParseJSON(r.photo_tags, []),
            created_at: r.created_at || '',
          };
        });
      }
    } catch (e) { console.error('loadClassRecords:', e); }
  },

  async saveClassRecord(recordData) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const photosRaw = recordData.photos || [];
      const recordToSave = { ...recordData };
      // ai_credit_log, photo_tags 전달
      if (recordData.ai_credit_log) recordToSave.ai_credit_log = recordData.ai_credit_log;
      if (recordData.photo_tags) recordToSave.photo_tags = recordData.photo_tags;
      // 메인 레코드에는 base64 사진을 저장하지 않음 (별도 업로드)
      // photo_count만 저장하여 응답 크기 축소
      recordToSave.photos = [];
      recordToSave.photo_count = photosRaw.length;

      const res = await fetch(`/api/student/${sid}/class-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordToSave)
      });
      if (res.ok) {
        const data = await res.json();
        const recordId = data.recordId;

        // 사진은 별도 엔드포인트로 업로드 (R2 저장)
        let uploadedPhotoIds = [];
        if (photosRaw.length > 0) {
          try {
            const photoRes = await fetch(`/api/student/${sid}/class-record-photos`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ photos: photosRaw, classRecordId: recordId })
            });
            if (photoRes.ok) {
              const photoData = await photoRes.json();
              uploadedPhotoIds = photoData.photoIds || [];
            }
          } catch (pe) { console.error('saveClassRecordPhotos:', pe); }

          // 메인 레코드에 사진 ID 참조 저장 (base64 대신)
          if (uploadedPhotoIds.length > 0) {
            try {
              await fetch(`/api/student/class-records/${recordId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ photos: uploadedPhotoIds.map(id => `ref:${id}`) })
              });
            } catch (_) {}
          }
        }

        try { await this.loadClassRecords(); } catch (_) {}
        return recordId;
      }
    } catch (e) { console.error('saveClassRecord:', e); }
    return null;
  },

  async updateClassRecord(recordId, updates) {
    try {
      await fetch(`/api/student/class-records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      try { await this.loadClassRecords(); } catch (_) {}
    } catch (e) { console.error('updateClassRecord:', e); }
  },

  // 사진 참조(ref:ID) → 실제 base64로 해석
  async resolvePhotos(photos) {
    if (!photos || !Array.isArray(photos) || photos.length === 0) return [];
    const resolved = [];
    for (const p of photos) {
      if (typeof p === 'string' && p.startsWith('ref:')) {
        const photoId = p.slice(4);
        try {
          const res = await fetch(`/api/photos/${photoId}`);
          if (res.ok) {
            const data = await res.json();
            resolved.push(data.photoData || p);
          } else {
            resolved.push(p);
          }
        } catch (_) { resolved.push(p); }
      } else if (typeof p === 'string' && p.startsWith('data:')) {
        resolved.push(p); // 기존 base64 (레거시 호환)
      } else {
        resolved.push(p);
      }
    }
    return resolved;
  },

  // 특정 수업 기록의 사진 목록 로드
  async loadClassRecordPhotos(recordId) {
    try {
      const res = await fetch(`/api/class-records/${recordId}/photos`);
      if (res.ok) {
        const data = await res.json();
        return data.photos || [];
      }
    } catch (e) { console.error('loadClassRecordPhotos:', e); }
    return [];
  },

  // === AI Credit Log 분석 ===
  async analyzePhotos(images, subject, period, date, studentComment) {
    try {
      const res = await fetch('/api/ai/credit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, subject, period, date, studentComment: studentComment || '' })
      });
      if (res.ok) {
        const data = await res.json();
        return data.data || data;
      }
    } catch (e) { console.error('analyzePhotos:', e); }
    return null;
  },

  // === 질문 코칭 기록 ===
  async loadQuestionRecords() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/question-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbQuestionRecords = (data.records || []).map(r => ({
          ...r,
          coachingMessages: tryParseJSON(r.coaching_messages, []),
        }));
      }
    } catch (e) { console.error('loadQuestionRecords:', e); }
  },

  async saveQuestionRecord(recordData) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/question-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.recordId;
      }
    } catch (e) { console.error('saveQuestionRecord:', e); }
    return null;
  },

  // === 교학상장 (가르치기) ===
  async saveTeachRecord(recordData) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/teach-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.recordId;
      }
    } catch (e) { console.error('saveTeachRecord:', e); }
    return null;
  },

  async loadTeachRecords() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/teach-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbTeachRecords = data.records || [];
      }
    } catch (e) { console.error('loadTeachRecords:', e); }
  },

  // === 창의적 체험활동 ===
  async saveActivityRecord(recordData) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/activity-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(recordData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.recordId;
      }
    } catch (e) { console.error('saveActivityRecord:', e); }
    return null;
  },

  async updateActivityRecord(recordId, updates) {
    try {
      await fetch(`/api/student/activity-records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('updateActivityRecord:', e); }
  },

  async loadActivityRecords() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/activity-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbActivityRecords = data.records || [];
      }
    } catch (e) { console.error('loadActivityRecords:', e); }
  },

  // === 활동 로그 (날짜별 기록) ===
  async saveActivityLog(activityRecordId, logData) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/activity-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityRecordId, ...logData })
      });
      if (res.ok) {
        const data = await res.json();
        return data.logId;
      }
    } catch (e) { console.error('saveActivityLog:', e); }
    return null;
  },

  async loadActivityLogs(activityId) {
    const sid = studentId();
    if (!sid) return [];
    try {
      const url = activityId
        ? `/api/student/${sid}/activity-logs?activityId=${activityId}`
        : `/api/student/${sid}/activity-logs`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        return data.logs || [];
      }
    } catch (e) { console.error('loadActivityLogs:', e); }
    return [];
  },

  // === 탐구보고서 ===
  async saveReportRecord(reportData) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/report-records`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportData)
      });
      if (res.ok) {
        const data = await res.json();
        return data.reportId;
      }
    } catch (e) { console.error('saveReportRecord:', e); }
    return null;
  },

  async updateReportRecord(reportId, updates) {
    try {
      await fetch(`/api/student/report-records/${reportId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('updateReportRecord:', e); }
  },

  async loadReportRecords() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/report-records`);
      if (res.ok) {
        const data = await res.json();
        state._dbReportRecords = (data.records || []).map(r => ({
          ...r,
          timeline: tryParseJSON(r.timeline, []),
          questions: tryParseJSON(r.questions, []),
        }));
      }
    } catch (e) { console.error('loadReportRecords:', e); }
  },

  // === 시험 관리 ===
  async loadExams() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/exams`);
      if (res.ok) {
        const data = await res.json();
        state.exams = (data.exams || []).map(r => ({
          id: String(r.id),
          _dbId: r.id,
          type: r.type || 'midterm',
          name: r.name,
          startDate: r.start_date || r.startDate || '',
          endDate: r.end_date || r.endDate || r.start_date || r.startDate || '',
          subjects: tryParseJSON(r.subjects, []),
          status: r.status || 'upcoming',
          result: tryParseJSON(r.result, null),
          aiPlan: r.ai_plan || null,
          memo: r.memo || '',
        }));
      }
    } catch (e) { console.error('loadExams:', e); }
  },

  async saveExam(data) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/exams`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const d = await res.json();
        return d.examId || d.id;
      }
    } catch (e) { console.error('saveExam:', e); }
    return null;
  },

  async updateExam(examId, updates) {
    try {
      await fetch(`/api/student/exams/${examId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('updateExam:', e); }
  },

  async deleteExam(examId) {
    try {
      await fetch(`/api/student/exams/${examId}`, { method: 'DELETE' });
    } catch (e) { console.error('deleteExam:', e); }
  },

  async saveExamResult(examId, result) {
    try {
      await fetch(`/api/student/exams/${examId}/result`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result })
      });
    } catch (e) { console.error('saveExamResult:', e); }
  },

  // === 과제 관리 ===
  async loadAssignments() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/assignments`);
      if (res.ok) {
        const data = await res.json();
        state.assignments = (data.assignments || []).map(r => ({
          id: String(r.id),
          _dbId: r.id,
          subject: r.subject || '',
          title: r.title || '',
          desc: r.description || '',
          type: r.type || '문제풀이',
          teacher: r.teacher_name || r.teacherName || '',
          dueDate: r.due_date || r.dueDate || '',
          createdDate: r.created_at || '',
          color: r.color || '#636e72',
          status: r.status || 'pending',
          progress: r.progress || 0,
          plan: tryParseJSON(r.plan_data || r.planData, []),
        }));
      }
    } catch (e) { console.error('loadAssignments:', e); }
  },

  async saveAssignment(data) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (res.ok) {
        const d = await res.json();
        return d.assignmentId || d.id;
      }
    } catch (e) { console.error('saveAssignment:', e); }
    return null;
  },

  async updateAssignment(assignmentId, updates) {
    try {
      await fetch(`/api/student/assignments/${assignmentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
    } catch (e) { console.error('updateAssignment:', e); }
  },

  // === 나의 질문함 ===
  async loadMyQuestions(filter) {
    const sid = studentId();
    if (!sid) return;
    try {
      let url = `/api/my-questions?studentId=${sid}`;
      if (filter && filter !== '전체') url += `&subject=${encodeURIComponent(filter)}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        state._myQuestions = (data.data || data.questions || []).map(q => ({
          id: q.id,
          subject: q.subject || '기타',
          title: q.title || '',
          content: q.content || '',
          status: q.status || '미답변',
          questionLevel: q.question_level || '',
          classRecordId: q.class_record_id,
          imageKey: q.image_key,
          aiImproved: q.ai_improved || null,
          source: q.source || null,
          period: q.period || null,
          date: q.date || null,
          parentId: q.parent_id || null,
          answerCount: q.answer_count || 0,
          createdAt: q.created_at || '',
        }));
      }
    } catch (e) { console.error('loadMyQuestions:', e); }
  },

  async loadMyQuestionStats() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/my-questions/stats?studentId=${sid}`);
      if (res.ok) {
        const data = await res.json();
        state._myQuestionStats = data.data || data;
      }
    } catch (e) { console.error('loadMyQuestionStats:', e); }
  },

  async saveMyQuestion(data) {
    try {
      const payload = { ...data, studentId: studentId() };
      // imageData(base64) → imageKey로 매핑 (백엔드 필드명에 맞춤)
      if (payload.imageData) {
        payload.imageKey = payload.imageData;
        delete payload.imageData;
      }
      const res = await fetch('/api/my-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const d = await res.json();
        return d.data?.id || d.questionId || d.id;
      }
    } catch (e) { console.error('saveMyQuestion:', e); }
    return null;
  },

  async improveMyQuestion(questionId) {
    try {
      const res = await fetch(`/api/my-questions/${questionId}/improve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const d = await res.json();
        return d.aiImproved || null;
      }
    } catch (e) { console.error('improveMyQuestion:', e); }
    return null;
  },

  async getMyQuestionDetail(id) {
    try {
      const res = await fetch(`/api/my-questions/${id}`);
      if (res.ok) {
        const data = await res.json();
        return data.data || data;
      }
    } catch (e) { console.error('getMyQuestionDetail:', e); }
    return null;
  },

  async saveMyAnswer(questionId, data) {
    try {
      const res = await fetch(`/api/my-questions/${questionId}/answer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, studentId: studentId() }),
      });
      if (res.ok) {
        const d = await res.json();
        return d.data || d;
      }
    } catch (e) { console.error('saveMyAnswer:', e); }
    return null;
  },

  async updateMyAnswer(questionId, answerId, content, imageKey) {
    try {
      const res = await fetch(`/api/my-questions/${questionId}/answer/${answerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, imageKey: imageKey || null, studentId: studentId() }),
      });
      if (res.ok) return true;
    } catch (e) { console.error('updateMyAnswer:', e); }
    return false;
  },

  async deleteMyAnswer(questionId, answerId) {
    try {
      const res = await fetch(`/api/my-questions/${questionId}/answer/${answerId}?studentId=${studentId()}`, {
        method: 'DELETE',
      });
      if (res.ok) return true;
    } catch (e) { console.error('deleteMyAnswer:', e); }
    return false;
  },

  async resolveMyQuestion(questionId, resolved) {
    try {
      await fetch(`/api/my-questions/${questionId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: studentId(), status: resolved ? '답변완료' : '미답변' }),
      });
    } catch (e) { console.error('resolveMyQuestion:', e); }
  },

  // === 아하 리포트 ===
  async analyzeAhaReport(photos, subject, source, date) {
    try {
      const res = await fetch('/api/aha-report/analyze-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos, subject, source, date })
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) { console.error('analyzeAhaReport:', e); }
    return null;
  },

  async getAhaFeedback(sections) {
    try {
      const res = await fetch('/api/aha-report/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sections)
      });
      if (res.ok) {
        const data = await res.json();
        return data.feedback || '';
      }
    } catch (e) { console.error('getAhaFeedback:', e); }
    return '';
  },

  async saveAhaReport(data) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch('/api/aha-report/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: sid, ...data })
      });
      if (res.ok) {
        const d = await res.json();
        try { await this.loadAhaReports(); } catch (_) {}
        return d.reportId || d.id;
      }
    } catch (e) { console.error('saveAhaReport:', e); }
    return null;
  },

  async loadAhaReports() {
    const sid = studentId();
    if (!sid) return;
    try {
      const res = await fetch(`/api/student/${sid}/aha-reports`);
      if (res.ok) {
        const data = await res.json();
        state._dbAhaReports = (data.reports || []).map(r => ({
          ...r,
          section_pa: r.section_pa || '[]',
        }));
      }
    } catch (e) { console.error('loadAhaReports:', e); }
  },

  async getAhaReportDetail(id) {
    try {
      const res = await fetch(`/api/aha-report/${id}`);
      if (res.ok) {
        const data = await res.json();
        return data.report || data;
      }
    } catch (e) { console.error('getAhaReportDetail:', e); }
    return null;
  },

  // === 전체 로드 ===
  async loadAll() {
    await Promise.all([
      this.loadClassRecords(),
      this.loadQuestionRecords(),
      this.loadTeachRecords(),
      this.loadActivityRecords(),
      this.loadReportRecords(),
      this.loadExams(),
      this.loadAssignments(),
      this.loadMyQuestions(),
      this.loadMyQuestionStats(),
      this.loadAhaReports(),
    ]);
  },
};
