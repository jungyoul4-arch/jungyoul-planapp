/* ================================================================
   Records Module — core/api.js
   API 호출 계층 (6가지 기록 타입 CRUD)
   ================================================================ */

import { state } from './state.js';
import { tryParseJSON } from './utils.js';

// AI API는 Pages 직접 URL로 호출 (커스텀 도메인 HKG 엣지에서 AI API 지역 차단 우회)
const AI_API_BASE = 'https://credit-planner-v8-359.pages.dev';

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

  // 사진 참조(ref:ID) → 실제 base64로 해석 (배치 API 사용)
  async resolvePhotos(photos) {
    if (!photos || !Array.isArray(photos) || photos.length === 0) return [];

    // ref:ID 사진들의 ID 수집
    const refMap = {}; // index → photoId
    for (let i = 0; i < photos.length; i++) {
      const p = photos[i];
      if (typeof p === 'string' && p.startsWith('ref:')) {
        refMap[i] = p.slice(4);
      }
    }

    const refIds = Object.values(refMap);
    let batchResult = {};

    // 배치 API로 한 번에 조회
    if (refIds.length > 0) {
      try {
        const res = await fetch('/api/photos/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ photoIds: refIds })
        });
        if (res.ok) {
          const data = await res.json();
          batchResult = data.photos || {};
        }
      } catch (e) {
        console.error('resolvePhotos batch failed, falling back:', e);
        // 폴백: 개별 조회
        for (const id of refIds) {
          try {
            const res = await fetch(`/api/photos/${id}`);
            if (res.ok) {
              const data = await res.json();
              batchResult[id] = data.photoData;
            }
          } catch (_) {}
        }
      }
    }

    // 결과 조합
    return photos.map((p, i) => {
      if (refMap[i] !== undefined) {
        return batchResult[refMap[i]] || p;
      }
      return p;
    });
  },

  // 개별 사진 삭제
  async deletePhoto(photoId) {
    try {
      const res = await fetch(`/api/photos/${photoId}`, { method: 'DELETE' });
      if (res.ok) {
        try { await this.loadClassRecords(); } catch (_) {}
        return true;
      }
    } catch (e) { console.error('deletePhoto:', e); }
    return false;
  },

  // 기존 수업 기록에 사진 추가
  async addPhotosToRecord(recordId, newPhotos, newTags) {
    const sid = studentId();
    if (!sid || !recordId) return null;
    try {
      // 1. 사진 업로드
      const photoRes = await fetch(`/api/student/${sid}/class-record-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: newPhotos, classRecordId: recordId })
      });
      if (!photoRes.ok) return null;
      const photoData = await photoRes.json();
      const newIds = photoData.photoIds || [];

      // 2. 기존 photos/photo_tags 가져와서 병합
      const rec = (state._dbClassRecords || []).find(r => String(r.id) === String(recordId));
      const existingPhotos = rec ? (Array.isArray(rec.photos) ? rec.photos : []) : [];
      const existingTags = rec ? (Array.isArray(rec.photo_tags) ? rec.photo_tags : []) : [];
      const mergedPhotos = [...existingPhotos, ...newIds.map(id => `ref:${id}`)];
      const mergedTags = [...existingTags, ...(newTags || newPhotos.map(() => '필기'))];

      // 3. 메인 레코드 업데이트
      await fetch(`/api/student/class-records/${recordId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos: mergedPhotos, photo_tags: mergedTags, photo_count: mergedPhotos.length })
      });

      try { await this.loadClassRecords(); } catch (_) {}
      return newIds;
    } catch (e) { console.error('addPhotosToRecord:', e); }
    return null;
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

  // 수업 기록 개별 삭제
  async deleteClassRecord(recordId) {
    try {
      const res = await fetch(`/api/student/class-records/${recordId}`, { method: 'DELETE' });
      if (res.ok) {
        state._dbClassRecords = (state._dbClassRecords || []).filter(r => String(r.id) !== String(recordId));
        return true;
      }
    } catch (e) { console.error('deleteClassRecord:', e); }
    return false;
  },

  // 수업 기록 전체 삭제
  async deleteAllClassRecords() {
    const sid = studentId();
    if (!sid) return false;
    try {
      const res = await fetch(`/api/student/${sid}/class-records/all`, { method: 'DELETE' });
      if (res.ok) {
        const data = await res.json();
        state._dbClassRecords = [];
        return data.deletedCount || 0;
      }
    } catch (e) { console.error('deleteAllClassRecords:', e); }
    return false;
  },

  // === AI Credit Log 분석 ===
  async analyzePhotos(images, subject, period, date, studentComment) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600000); // 10분 타임아웃 (OCR+분석 파이프라인)
    try {
      const res = await fetch('/api/ai/credit-log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ images, subject, period, date, studentComment: studentComment || '', studentId: studentId() }),
        signal: controller.signal
      });
      if (res.ok) {
        const data = await res.json();
        return data.data || data;
      }
      // 서버 에러 응답 처리
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || `AI 서버 오류 (${res.status})`);
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('AI 분석 시간 초과 (10분)');
      console.error('analyzePhotos:', e);
      throw e;
    } finally {
      clearTimeout(timer);
    }
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

  // 창체 활동 AI 분석
  async analyzeActivity(photos, activityType, comment) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600000); // 10분 타임아웃
    try {
      const res = await fetch(`${AI_API_BASE}/api/ai/activity-analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos, activityType, comment: comment || '', studentId: studentId() }),
        signal: controller.signal
      });
      if (res.ok) {
        const data = await res.json();
        return data.success ? data : null;
      }
    } catch (e) {
      if (e.name === 'AbortError') { console.error('analyzeActivity: 시간 초과 (10분)'); return null; }
      console.error('analyzeActivity:', e);
    } finally {
      clearTimeout(timer);
    }
    return null;
  },

  // 창체 영역별 activity_record 자동 생성 (find or create)
  async findOrCreateActivityRecord(activityType, title) {
    const sid = studentId();
    if (!sid) return null;
    try {
      const res = await fetch(`/api/student/${sid}/activity-records/find-or-create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activityType, title })
      });
      if (res.ok) {
        const data = await res.json();
        return data.recordId;
      }
    } catch (e) { console.error('findOrCreateActivityRecord:', e); }
    return null;
  },

  // 창체 활동 로그 저장 (사진 + AI분석 결과 포함)
  async saveActivityLogWithPhotos(activityType, title, photos, comment, date, aiResult) {
    const sid = studentId();
    if (!sid) return null;
    try {
      // 1. activity_record find or create
      const recordId = await this.findOrCreateActivityRecord(activityType, title);
      if (!recordId) throw new Error('activity_record 생성 실패');

      // 2. activity_log 저장 (사진 + 소감 + AI 분석 결과)
      const res = await fetch(`/api/student/${sid}/activity-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activityRecordId: recordId,
          date: date || new Date().toISOString().slice(0, 10),
          content: comment || '활동 기록',
          photos: photos || [],
          aiResult: aiResult || null,
          xpEarned: 20
        })
      });
      if (res.ok) {
        const data = await res.json();
        await this.loadActivityRecords();
        return data.logId;
      }
    } catch (e) { console.error('saveActivityLogWithPhotos:', e); }
    return null;
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
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 600000); // 10분 타임아웃
    try {
      const res = await fetch(`${AI_API_BASE}/api/aha-report/analyze-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photos, subject, source, date, studentId: studentId() }),
        signal: controller.signal
      });
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('아하 리포트 분석 시간 초과 (10분)');
      console.error('analyzeAhaReport:', e);
      throw e;
    } finally {
      clearTimeout(timer);
    }
    return null;
  },

  async getAhaFeedback(sections) {
    try {
      const { studentName, ...sectionData } = sections;
      const res = await fetch(`${AI_API_BASE}/api/aha-report/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...sectionData, studentName: studentName || '' })
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

  async deleteAhaReport(id) {
    const sid = studentId();
    if (!sid || !id) return false;
    try {
      const res = await fetch(`/api/aha-report/${id}?studentId=${sid}`, { method: 'DELETE' });
      if (res.ok) {
        try { await this.loadAhaReports(); } catch (_) {}
        return true;
      }
    } catch (e) { console.error('deleteAhaReport:', e); }
    return false;
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
