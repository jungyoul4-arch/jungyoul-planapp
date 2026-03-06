/* ================================================================
   Records Module — views/period-select.js
   오늘의 수업 교시 선택 화면 + 날짜 선택 (소급 기록)
   ================================================================ */

import { state } from '../core/state.js';
import { navigate } from '../core/router.js';
import { kstNow, kstToday, tryParseJSON } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.selectPeriod = (idx) => {
    state._selectedPeriodIdx = idx;
    state._classPhotos = [];
    state._classPhotoTags = [];
    state._aiCreditLog = null;
    state._aiCreditLogEditing = false;
    navigate('photo-upload');
  };
  RM.viewCompletedPeriod = (idx) => {
    const records = _getActiveRecords();
    const rec = records[idx];
    if (!rec) return;
    const dbRec = _getDbRecordForPeriod(rec);
    if (dbRec) {
      state._viewingDbRecord = dbRec.id;
      navigate('class-record-detail');
    }
  };
  RM.editCompletedPeriod = (idx) => {
    const records = _getActiveRecords();
    const rec = records[idx];
    if (!rec) return;
    const dbRec = _getDbRecordForPeriod(rec);
    if (dbRec && !dbRec._virtual) {
      // class-record-edit는 todayRecords[idx] 기반이므로 DB 데이터를 로드
      rec._dbRecordId = dbRec.id;
      rec._topic = dbRec.topic || '';
      rec._pages = dbRec.pages || '';
      rec._keywords = dbRec.keywords || [];
      rec._teacherNote = dbRec.teacher_note || '';
      rec._photos = dbRec.photos || [];
      rec._photoTags = dbRec.photo_tags || [];
      state._editingClassRecordIdx = idx;
      navigate('class-record-edit');
    }
  };
  RM.toggleDatePicker = () => {
    state._showDatePicker = !state._showDatePicker;
    RM.render();
  };
  RM.selectBackfillDate = (dateStr) => {
    state._showDatePicker = false;
    if (dateStr === kstToday()) {
      state._backfillDate = null;
      RM.render();
      return;
    }
    state._backfillDate = dateStr;
    _rebuildRecordsForDate(dateStr);
    RM.render();
  };
}

function _rebuildRecordsForDate(dateStr) {
  const dt = new Date(dateStr + 'T00:00:00+09:00');
  let dayIdx = dt.getDay() - 1; // 0=월 ~ 4=금
  if (dayIdx < 0 || dayIdx > 4) {
    state.todayRecords = [];
    return;
  }
  const tt = state.timetable || {};
  const daySchedule = (tt.school || [])[dayIdx] || [];
  const dbRecords = state._dbClassRecords || [];

  state.todayRecords = daySchedule.map((subject, i) => {
    const existing = dbRecords.find(r => r.date === dateStr && r.subject === subject);
    return {
      period: i + 1,
      subject: subject,
      teacher: (tt.teachers || {})[subject] || '',
      color: (tt.subjectColors || {})[subject] || '#636e72',
      startTime: (tt.periodTimes || [])[i]?.start || '',
      endTime: (tt.periodTimes || [])[i]?.end || '',
      done: !!existing,
      summary: existing ? (existing.topic || existing.content || '수업 기록 완료') : '',
      _dbRecordId: existing ? existing.id : null,
    };
  });
}

function _getActiveRecords() {
  return state.todayRecords || [];
}

function _getActiveDate() {
  return state._backfillDate || kstToday();
}

function _isPeriodRecorded(record) {
  return !!_getDbRecordForPeriod(record);
}

function _getDbRecordForPeriod(record) {
  const dbRecords = state._dbClassRecords || [];

  // _dbRecordId가 있으면 ID로 직접 찾기 (가장 확실)
  if (record._dbRecordId) {
    const byId = dbRecords.find(r => r.id === record._dbRecordId);
    if (byId) return byId;
    // DB 레코드가 메모리에 없어도 ID가 있으면 최소한의 레코드 반환
    return { id: record._dbRecordId, subject: record.subject, date: _getActiveDate(), _fromId: true };
  }

  const dateStr = _getActiveDate();

  if (record.done) {
    return dbRecords.find(r =>
      r.date === dateStr && r.subject === record.subject
    ) || { _virtual: true };
  }

  return dbRecords.find(r => {
    if (r.date !== dateStr || r.subject !== record.subject) return false;
    const memo = tryParseJSON(r.memo, {});
    return !record.period || memo.period == record.period || !memo.period;
  }) || null;
}

function _renderPeriodItem(record, idx) {
  const dbRec = _getDbRecordForPeriod(record);
  const isRecorded = !!dbRec;
  const color = record.color || '#636e72';
  const periodTimes = state.timetable?.periodTimes || [];
  const time = periodTimes[record.period - 1];
  const timeStr = time ? `${time.start || time.startTime || ''}~${time.end || time.endTime || ''}` : '';

  if (isRecorded && !dbRec._virtual) {
    // 기록 완료 카드
    const photoCount = dbRec.photo_count || (dbRec.photos || []).length;
    const aiLog = dbRec.ai_credit_log;
    const hasAi = !!aiLog;
    const keywords = dbRec.keywords || [];
    const keywordPreview = keywords.slice(0, 3).join(', ');

    return `
    <div class="ps-period-item done" onclick="_RM.viewCompletedPeriod(${idx})">
      <div class="ps-period-badge" style="background:${color}">${record.period}</div>
      <div class="ps-period-info">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:2px">
          <div class="ps-period-subject">${record.subject}</div>
          <span class="ps-done-badge">✅ 기록완료</span>
        </div>
        <div class="ps-period-meta">${record.teacher ? record.teacher + ' 선생님' : ''}${timeStr ? ' · ' + timeStr : ''}</div>
        ${(photoCount > 0 || hasAi || keywords.length > 0) ? `
          <div class="ps-summary-box">
            ${photoCount > 0 ? `<span class="ps-summary-item">📸 사진 ${photoCount}장</span>` : ''}
            ${hasAi ? `<span class="ps-summary-item">· AI 분석 완료</span>` : ''}
            ${keywordPreview ? `<div class="ps-summary-keywords">${keywordPreview}</div>` : ''}
          </div>
        ` : ''}
        <div class="ps-done-actions" onclick="event.stopPropagation()">
          <button class="ps-action-view" onclick="_RM.viewCompletedPeriod(${idx})">다시보기</button>
          <button class="ps-action-edit" onclick="_RM.editCompletedPeriod(${idx})">수정하기</button>
        </div>
      </div>
    </div>`;
  }

  if (isRecorded && dbRec._virtual) {
    // done 플래그만 있고 DB 레코드 없는 경우
    return `
    <div class="ps-period-item done" onclick="_RM.selectPeriod(${idx})">
      <div class="ps-period-badge" style="background:${color}">${record.period}</div>
      <div class="ps-period-info">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div class="ps-period-subject">${record.subject}</div>
          <span class="ps-done-badge">✅ 기록완료</span>
        </div>
        <div class="ps-period-meta">${record.teacher ? record.teacher + ' 선생님' : ''}${timeStr ? ' · ' + timeStr : ''}</div>
      </div>
    </div>`;
  }

  // 미기록 카드
  return `
    <div class="ps-period-item" onclick="_RM.selectPeriod(${idx})">
      <div class="ps-period-badge" style="background:${color}">${record.period}</div>
      <div class="ps-period-info">
        <div class="ps-period-subject">${record.subject}</div>
        <div class="ps-period-meta">${record.teacher ? record.teacher + ' 선생님' : ''}${timeStr ? ' · ' + timeStr : ''}</div>
      </div>
      <div class="ps-period-status">
        <span class="ps-record-btn">기록하기 <i class="fas fa-camera" style="margin-left:4px"></i></span>
      </div>
    </div>`;
}

function _renderDatePicker() {
  const todayStr = kstToday();
  const activeDate = _getActiveDate();
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dates = [];

  for (let i = 0; i < 7; i++) {
    const d = new Date(kstNow().getTime() - i * 86400000);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${day}`;
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    dates.push({
      dateStr,
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      dayName: dayNames[dayOfWeek],
      isToday: dateStr === todayStr,
      isActive: dateStr === activeDate,
      isWeekend,
    });
  }

  return `
    <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:12px;margin-bottom:16px">
      <div style="font-size:12px;font-weight:600;color:var(--text-muted);margin-bottom:8px">📅 날짜 선택 (최근 7일)</div>
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">
        ${dates.map(d => `
          <button onclick="_RM.selectBackfillDate('${d.dateStr}')" style="
            padding:8px 2px;border-radius:8px;border:none;cursor:pointer;text-align:center;
            background:${d.isActive ? 'var(--primary)' : 'transparent'};
            color:${d.isActive ? '#fff' : d.isWeekend ? 'var(--text-muted)' : 'var(--text-primary)'};
            opacity:${d.isWeekend ? '0.4' : '1'};
            font-size:12px;
          " ${d.isWeekend ? 'disabled' : ''}>
            <div style="font-weight:700">${d.label}</div>
            <div style="font-size:10px;margin-top:2px">${d.dayName}${d.isToday ? ' ·오늘' : ''}</div>
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

export function renderPeriodSelect() {
  const isBackfill = !!state._backfillDate;
  const activeDate = _getActiveDate();
  const dt = new Date(activeDate + 'T00:00:00+09:00');
  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const dayName = dayNames[dt.getDay()];
  const month = dt.getMonth() + 1;
  const dayNum = dt.getDate();

  const records = _getActiveRecords();
  const totalCount = records.length;
  const doneCount = records.filter(r => _isPeriodRecorded(r)).length;
  const showDatePicker = state._showDatePicker;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round(doneCount / totalCount * 100) : 0;

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>${isBackfill ? '📅 소급 기록' : '오늘의 수업'}</h1>
        <span class="header-badge" onclick="_RM.toggleDatePicker()" style="cursor:pointer">
          ${month}/${dayNum} (${dayName}) <i class="fas fa-caret-${showDatePicker ? 'up' : 'down'}" style="margin-left:4px;font-size:10px"></i>
        </span>
      </div>
      <div class="form-body">
        ${showDatePicker ? _renderDatePicker() : ''}

        ${isBackfill ? `
          <div style="background:rgba(255,159,67,0.1);border:1px solid rgba(255,159,67,0.3);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:13px;color:#FF9F43;display:flex;align-items:center;gap:8px">
            <i class="fas fa-info-circle"></i>
            <span>${month}월 ${dayNum}일 (${dayName}) 수업을 소급 기록합니다</span>
          </div>
        ` : ''}

        ${totalCount === 0 ? `
          <div style="text-align:center;padding:60px 20px;color:var(--text-muted)">
            <div style="font-size:48px;margin-bottom:16px">📅</div>
            <p style="font-size:15px;margin-bottom:8px">${isBackfill ? '해당 날짜에 수업이 없습니다' : '오늘은 수업이 없습니다'}</p>
            <p style="font-size:13px">${isBackfill ? '다른 날짜를 선택해보세요' : '시간표를 먼저 설정해주세요'}</p>
          </div>
        ` : `
          <div class="ps-progress-section">
            <div class="ps-progress-header">
              <span class="ps-progress-label">${allDone ? '🎉 오늘 수업 기록 완료!' : `${doneCount}/${totalCount} 수업 기록`}</span>
              <span class="ps-progress-pct">${progressPct}%</span>
            </div>
            <div class="ps-progress-bar ${allDone ? 'complete' : ''}">
              <div class="ps-progress-fill" style="width:${progressPct}%"></div>
            </div>
          </div>

          <div class="ps-period-list">
            ${records.map((r, i) => _renderPeriodItem(r, i)).join('')}
          </div>

          <div class="ps-footer-links">
            <button class="ps-link-btn" onclick="_RM.nav('record-status')">
              <i class="fas fa-calendar-check" style="margin-right:6px"></i>주간 기록 현황
            </button>
          </div>
        `}
      </div>
    </div>
  `;
}
