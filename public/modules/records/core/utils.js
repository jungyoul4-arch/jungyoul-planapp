/* ================================================================
   Records Module — core/utils.js
   공유 유틸리티 (escapeHtml, KST 날짜, 색상맵 등)
   ================================================================ */

export function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function kstNow() {
  return new Date(Date.now() + 9 * 3600000);
}

export function kstToday() {
  return kstNow().toISOString().slice(0, 10);
}

export function kstDate(d) {
  if (!d) return kstToday();
  const kd = new Date(d.getTime() + 9 * 3600000);
  return kd.toISOString().slice(0, 10);
}

export function kstDateOffset(days) {
  return kstDate(new Date(Date.now() + days * 86400000));
}

export const SUBJECT_COLOR_MAP = {
  '국어': '#FF6B6B',
  '수학': '#6C5CE7',
  '영어': '#00B894',
  '과학': '#FDCB6E',
  '사회': '#74B9FF',
  '한국사': '#E056A0',
  '제2외국어': '#A29BFE',
  '기술가정': '#FF9F43',
  '음악': '#fd79a8',
  '미술': '#00cec9',
  '체육': '#e17055',
  '정보': '#0984e3',
  '동아리': '#00CEC9',
  '창체': '#E17055',
  '진로': '#636e72',
  '기타': '#888',
};

export const SUBJECT_LIST = ['수학', '국어', '영어', '과학', '한국사', '사회', '정보', '기술가정', '음악', '미술', '체육', '진로', '기타'];
export const SUBJECT_COLORS_ARRAY = ['#6C5CE7', '#FF6B6B', '#00B894', '#FDCB6E', '#74B9FF', '#A29BFE', '#E056A0', '#FF9F43', '#00CEC9', '#FD79A8', '#E17055', '#636e72', '#888'];

export const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];

export function getSubjectColor(subject) {
  return SUBJECT_COLOR_MAP[subject] || '#636e72';
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return (dateStr).slice(5).replace('-', '/') + ' (' + DAY_NAMES[d.getDay()] + ')';
}

export function getDday(dateStr) {
  if (!dateStr) return 999;
  const target = new Date(dateStr + 'T00:00:00+09:00');
  const today = new Date(kstToday() + 'T00:00:00+09:00');
  return Math.ceil((target - today) / 86400000);
}

export function tryParseJSON(str, fallback) {
  try { return JSON.parse(str || (Array.isArray(fallback) ? '[]' : '{}')); }
  catch { return fallback !== undefined ? fallback : {}; }
}

/**
 * KaTeX 수식 렌더링: $$블록$$ + $인라인$ 처리
 * KaTeX 미로드 시 원문 그대로 반환
 */
export function renderMath(text) {
  if (!text || typeof text !== 'string') return text || '';
  if (typeof katex === 'undefined') return text;

  // 블록 수식: $$...$$
  text = text.replace(/\$\$([^$]+)\$\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: true, throwOnError: false, output: 'html'
      });
    } catch { return match; }
  });

  // 인라인 수식: $...$
  text = text.replace(/\$([^$\n]+)\$/g, (match, formula) => {
    try {
      return katex.renderToString(formula.trim(), {
        displayMode: false, throwOnError: false, output: 'html'
      });
    } catch { return match; }
  });

  return text;
}

/**
 * 텍스트에서 keywords 배열에 포함된 단어를 찾아 <span class="cl-mark"> 으로 감싼다.
 * HTML 태그 내부는 건드리지 않으며, 2글자 이상 키워드만 처리한다.
 */
export function markKeywords(text, keywords) {
  if (!text || !keywords || keywords.length === 0) return text || '';
  const filtered = keywords.filter(k => k && k.length >= 2);
  if (filtered.length === 0) return text;
  const escaped = filtered.map(k => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const regex = new RegExp(`(${escaped.join('|')})`, 'gi');
  return text.replace(regex, '<span class="cl-mark">$1</span>');
}

/**
 * 과제 마감일까지의 단계별 플랜을 자동 생성
 * @param {string} dueDate - YYYY-MM-DD 마감일
 * @returns {Array} plan steps [{step, title, date, done}, ...]
 */
export function generatePlanSteps(dueDate) {
  if (!dueDate) return [];
  const daysUntilDue = getDday(dueDate);
  if (daysUntilDue <= 0) return [];
  const stepsCount = Math.max(3, Math.min(6, daysUntilDue));
  const plan = [];
  const dueD = new Date(dueDate + 'T00:00:00+09:00');
  const today = kstNow();
  const stepLabels = ['자료 조사 및 준비', '초안 작성', '본문 완성', '검토 및 수정', '최종 점검', '제출'];
  for (let i = 0; i < stepsCount; i++) {
    const stepDate = new Date(today.getTime() + ((dueD - today) / stepsCount) * (i + 1));
    plan.push({
      step: i + 1,
      title: stepLabels[i] || `${i + 1}단계 진행`,
      date: `${stepDate.getMonth() + 1}/${stepDate.getDate()}`,
      done: false,
    });
  }
  return plan;
}

/**
 * assignment 필드에서 표시용 텍스트를 추출 (object / string 둘 다 처리)
 */
export function getAssignmentDisplayText(assignment) {
  if (!assignment) return '';
  if (typeof assignment === 'string') return assignment;
  if (typeof assignment === 'object') {
    let text = assignment.title || '';
    if (assignment.description && assignment.description !== assignment.title) {
      text += text ? ' - ' + assignment.description : assignment.description;
    }
    if (assignment.dueDateRaw) text += ` (기한: ${assignment.dueDateRaw})`;
    return text;
  }
  return '';
}
