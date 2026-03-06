/* ================================================================
   Records Module — views/record-status.js
   주간 기록 현황 그리드
   ================================================================ */

import { state } from '../core/state.js';
import { kstNow, kstToday, tryParseJSON } from '../core/utils.js';

export function registerHandlers(RM) {
  RM.startBackfill = (date, period, subject) => {
    const dayIdx = new Date(date).getDay() - 1;
    if (dayIdx < 0 || dayIdx > 4) return;
    const periodTimes = state.timetable?.periodTimes || [];
    const teachers = state.timetable?.teachers || {};
    state._backfillDate = date;
    state._backfillPeriod = period;
    state._backfillSubject = subject;
    state._backfillTeacher = teachers[subject] || '';
    state._backfillTime = periodTimes[period - 1] || {};
    RM.nav('record-class');
  };
}

function checkRecordExists(date, subject, period, dbRecords, todayRecords, todayStr) {
  const inDb = dbRecords.some(r => {
    if (r.date !== date || r.subject !== subject) return false;
    const memo = tryParseJSON(r.memo, {});
    return !period || memo.period == period || !memo.period;
  });
  if (inDb) return true;
  if (date === todayStr) {
    return todayRecords.some(r => r.subject === subject && r.period === period && r.done);
  }
  return false;
}

export function renderRecordStatus() {
  const school = state.timetable?.school || [];
  const teachers = state.timetable?.teachers || {};
  const subjectColors = state.timetable?.subjectColors || {};
  const dbRecords = state._dbClassRecords || [];
  const todayRecords = state.todayRecords || [];
  const today = kstNow();
  const todayStr = today.toISOString().slice(0, 10);

  const dayOfWeek = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  const weekDays = [];
  const dayNames = ['월', '화', '수', '목', '금'];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    weekDays.push({
      date: d.toISOString().slice(0, 10),
      dayName: dayNames[i],
      dayNum: d.getDate(),
      month: d.getMonth() + 1,
      isToday: d.toISOString().slice(0, 10) === todayStr,
      isFuture: d > today
    });
  }

  const periodCount = school.length || 7;
  let totalSlots = 0, recordedSlots = 0;

  const weekData = weekDays.map((day, dayIdx) => {
    const periods = [];
    for (let p = 0; p < periodCount; p++) {
      const subject = school[p] ? (school[p][dayIdx] || '') : '';
      if (!subject) continue;
      const isRecorded = checkRecordExists(day.date, subject, p + 1, dbRecords, todayRecords, todayStr);
      if (!day.isFuture) {
        totalSlots++;
        if (isRecorded) recordedSlots++;
      }
      periods.push({
        period: p + 1, subject,
        color: subjectColors[subject] || '#636e72',
        teacher: teachers[subject] || '',
        recorded: isRecorded,
        isFuture: day.isFuture
      });
    }
    return { ...day, periods };
  });

  const completionRate = totalSlots > 0 ? Math.round((recordedSlots / totalSlots) * 100) : 0;
  const missedCount = totalSlots - recordedSlots;
  const rateColor = completionRate >= 80 ? '#00B894' : completionRate >= 50 ? '#FDCB6E' : '#FF6B6B';

  return `
    <div class="full-screen animate-slide">
      <div class="screen-header">
        <button class="back-btn" onclick="_RM.nav('dashboard')"><i class="fas fa-arrow-left"></i></button>
        <h1>📊 기록 관리 & 누락 체크</h1>
      </div>
      <div class="form-body">
        <div class="rs-progress-card">
          <div class="rs-progress-header">
            <div>
              <div class="rs-progress-title">이번 주 기록 현황</div>
              <div class="rs-progress-subtitle">${weekDays[0].month}/${weekDays[0].dayNum} ~ ${weekDays[4].month}/${weekDays[4].dayNum}</div>
            </div>
            <div class="rs-progress-circle" style="--rate:${completionRate};--rate-color:${rateColor}">
              <svg viewBox="0 0 36 36" class="rs-circle-svg">
                <path class="rs-circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
                <path class="rs-circle-fill" stroke="${rateColor}" stroke-dasharray="${completionRate}, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"/>
              </svg>
              <div class="rs-circle-text">
                <span class="rs-circle-num" style="color:${rateColor}">${completionRate}</span>
                <span class="rs-circle-pct">%</span>
              </div>
            </div>
          </div>
          <div class="rs-progress-stats">
            <div class="rs-stat"><span class="rs-stat-num" style="color:var(--primary-light)">${recordedSlots}</span><span class="rs-stat-label">기록 완료</span></div>
            <div class="rs-stat"><span class="rs-stat-num" style="color:${missedCount > 0 ? '#FF6B6B' : '#00B894'}">${missedCount}</span><span class="rs-stat-label">누락</span></div>
            <div class="rs-stat"><span class="rs-stat-num" style="color:var(--text-secondary)">${totalSlots}</span><span class="rs-stat-label">전체 수업</span></div>
          </div>
        </div>

        <div class="rs-calendar">
          ${weekData.map(day => `
            <div class="rs-day-column ${day.isToday ? 'today' : ''} ${day.isFuture ? 'future' : ''}">
              <div class="rs-day-header ${day.isToday ? 'today' : ''}">
                <span class="rs-day-name">${day.dayName}</span>
                <span class="rs-day-num">${day.dayNum}</span>
              </div>
              <div class="rs-period-list">
                ${day.periods.map(p => `
                  <div class="rs-period-cell ${p.recorded ? 'recorded' : ''} ${p.isFuture ? 'future' : ''} ${!p.recorded && !p.isFuture ? 'missed' : ''}"
                       onclick="${!p.isFuture && !p.recorded ? `_RM.startBackfill('${day.date}',${p.period},'${p.subject}')` : ''}"
                       title="${p.period}교시 ${p.subject}${p.teacher ? ' (' + p.teacher + ')' : ''}">
                    <div class="rs-period-num">${p.period}</div>
                    <div class="rs-period-subject" style="color:${p.color}">${p.subject}</div>
                    <div class="rs-period-status">
                      ${p.isFuture ? '<i class="fas fa-clock" style="color:var(--text-muted);font-size:12px"></i>'
                        : p.recorded ? '<i class="fas fa-check-circle" style="color:#00B894;font-size:16px"></i>'
                        : '<div class="rs-missed-box"><i class="fas fa-plus" style="font-size:10px"></i></div>'}
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        ${missedCount > 0 ? `
        <div class="rs-hint">
          <i class="fas fa-info-circle" style="margin-right:6px;color:var(--primary-light)"></i>
          빈 박스를 탭하면 누락된 수업을 소급 기록할 수 있어요
        </div>
        ` : `
        <div class="rs-hint" style="color:#00B894">
          <i class="fas fa-trophy" style="margin-right:6px"></i>
          이번 주 모든 수업을 기록했어요! 완벽해요! 🎉
        </div>
        `}
      </div>
    </div>
  `;
}
