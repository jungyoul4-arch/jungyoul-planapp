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
