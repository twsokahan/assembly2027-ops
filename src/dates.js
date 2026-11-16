const WEEKDAY_NAMES = "一二三四五六日";

function utcMs(day) {
  const [y, m, d] = day.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function fromUtcMs(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function build(y, m, d) {
  const day = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  return fromUtcMs(utcMs(day)) === day ? day : null;
}

export function parseDay(text) {
  const s = String(text ?? "").trim();
  const full = s.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (full) return build(+full[1], +full[2], +full[3]);
  const short = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!short) return null;
  const month = +short[1];
  return build(month >= 11 ? 2026 : 2027, month, +short[2]);
}

export function weekdayIndex(day) {
  return (new Date(utcMs(day)).getUTCDay() + 6) % 7;
}

export function fmtShort(day) {
  const [, m, d] = day.split("-").map(Number);
  return `${m}/${d}`;
}

export function fmt(day) {
  return `${fmtShort(day)}（${WEEKDAY_NAMES[weekdayIndex(day)]}）`;
}

export function addDays(day, n) {
  return fromUtcMs(utcMs(day) + n * 86400000);
}

export function daysBetween(a, b) {
  return Math.round((utcMs(b) - utcMs(a)) / 86400000);
}

export function todayInTaipei(now = new Date()) {
  return fromUtcMs(now.getTime() + 8 * 3600000);
}
