import { addDays, daysBetween, fmt, weekdayIndex } from "../dates.js?v=6";
import { CONFIG } from "../../config.js?v=6";
import { PAPER, INK, INK_2, MUTED, DARK, ACCENT, PHASE_COLORS, PHASE_TINTS, CIRCLED } from "../theme.js?v=6";
import { FONT_STACK, icon, svgDoc, text, textWidth, setTextMeasurer } from "../svg.js?v=6";

const { CAL_START, CAL_END } = CONFIG;
const WHITE = "#ffffff";
const WEEKDAYS = "日一二三四五六";
const MARK_KINDS = { 小組會: "group", 報名: "signup", 高鐵: "train", 燈會: "star" };
const SHORT_LABELS = { 交流名單截止: "名單先截", 前導組會議: "前導組會", 小組會停: "小組停" };
const NOTE_WIDE = "週二小組會在晚上，前導組 11/17 那週改在 11/20（五）。高鐵開賣日是推估，以高鐵公告為準；台灣燈會在苗栗，暫定 2/20～3/7。";
const NOTE_COMPACT = ["週二小組會在晚上；前導組 11/17 那週改在 11/20（五）。", "高鐵開賣日是推估；燈會暫定 2/20～3/7。"];
const EMPTY = Object.freeze({ big: null, marks: [] });

const dayOfMonth = (day) => Number(day.slice(8));
const monthOf = (day) => Number(day.slice(5, 7));
const yearOf = (day) => Number(day.slice(0, 4));
const fullDay = (day) => `${yearOf(day)}/${fmt(day)}`;
const firstOfMonth = (year, month) => `${year}-${String(month).padStart(2, "0")}-01`;
const inRange = (day) => CAL_START <= day && day <= CAL_END;
const within = (day, span) => span && span.start <= day && day <= span.end;
const rangeLabel = (start, end) => `${monthOf(start)}/${dayOfMonth(start)}–${monthOf(end)}/${dayOfMonth(end)}`;
const phaseName = (phase) => phase.name.slice(phase.name.indexOf(" ") + 1);

export function calendarEvents(model) {
  const ev = {};
  const at = (day) => (ev[day] ??= { big: null, marks: [] });
  const addMark = (day, kind, label) => {
    const marks = at(day).marks;
    if (!marks.some(([, l]) => l === label)) marks.push([kind, label]);
  };

  for (const m of model.meetings) {
    if (m.name.includes("沙推") || m.name.includes("彩排")) at(m.date).big = [m.name.slice(0, 3), m.name.slice(3), DARK];
    else if (m.name === "正式舉辦") at(m.date).big = [m.time || "13:00", "總會", ACCENT];
    else if (m.name === "停會") addMark(m.date, "stop", weekdayIndex(m.date) === 1 ? "小組會停" : "停會");
    else addMark(m.date, "meeting", m.name);
  }
  for (const mark of model.marks) addMark(mark.date, MARK_KINDS[mark.icon] ?? "meeting", mark.label);
  for (const s of model.smallGroups) {
    if (inRange(s.date)) addMark(s.date, s.note.includes("停") ? "stop" : "group", s.note.includes("停") ? "小組會停" : "小組會");
  }
  return ev;
}

function shortLabel(label) {
  return label.startsWith("運營會（") ? `運營會${label[4]}` : (SHORT_LABELS[label] ?? label);
}

function cell(model, x, y, w, h, day, ev, { compact = false, active = true, today = null } = {}) {
  const phase = model.phases.findIndex((p) => p.start <= day && day <= p.end);
  const goodwill = within(day, model.goodwill);
  const holiday = model.holidays.some((span) => within(day, span));
  const big = active ? ev.big : null;
  const box = `x="${x + 1}" y="${y + 1}" width="${w - 2}" height="${h - 2}" rx="3"`;
  let fill = "#f3f2ee";
  if (!active) fill = PAPER;
  else if (big) fill = big[2];
  else if (goodwill) fill = PHASE_TINTS[3];
  else if (phase >= 0) fill = PHASE_TINTS[phase];
  const out = [`<rect ${box} fill="${fill}"/>`];
  if (active && !big && (goodwill || holiday)) out.push(`<rect ${box} fill="url(#hatch)"/>`);
  if (!active) return out.join("") + text(x + 8, y + 19, String(dayOfMonth(day)), 14, { color: "#c9c5bc" });

  const [sDate, sName, sMark, sSub, sMain] = compact ? [15, 11, 13, 11, 24] : [18, 14, 17, 15, 34];
  const pad = compact ? 7 : 10;
  const onDark = big ? WHITE : null;
  const first = dayOfMonth(day) === 1;
  out.push(text(x + pad, y + sDate + 5, first ? `${monthOf(day)}/1` : String(dayOfMonth(day)), sDate, { color: onDark ?? (first ? INK : INK_2), weight: first ? 700 : 600 }));
  const names = model.dayNames[day];
  const name = names ? (compact ? names.short : names.full) : "";
  if (name && !(compact && big)) out.push(text(x + w - pad, y + sDate + 4, name, sName, { color: onDark ?? MUTED, weight: 500, anchor: "end" }));

  const marks = ev.marks;
  if (big) {
    const [sub, main] = big;
    const note = model.bigNotes[day];
    if (compact) {
      out.push(text(x + pad, y + 40, sub, sSub, { color: WHITE, weight: 500 }));
      out.push(text(x + pad, y + 66, main, sMain, { color: WHITE, weight: 800 }));
      if (marks.length) out.push(icon(marks[0][0], x + w - 14, y + 14, 12, WHITE));
    } else {
      const base = y + (marks.length || note ? 60 : 67);
      out.push(text(x + pad, base, sub, sSub, { color: WHITE, weight: 500 }));
      out.push(text(x + pad + textWidth(sub, sSub, 500) + 5, base, main, sMain, { color: WHITE, weight: 800 }));
      if (marks.length) {
        out.push(icon(marks[0][0], x + pad + 6, y + h - 13, 12, WHITE));
        out.push(text(x + pad + 16, y + h - 8, marks[0][1], 14, { color: WHITE, weight: 500 }));
      } else if (note) {
        out.push(text(x + pad, y + h - 8, note, 14, { color: WHITE, weight: 500 }));
      }
    }
  } else {
    const gap = compact ? 18 : 24;
    const base0 = y + (compact ? 40 : 52);
    const isz = compact ? 11 : 14;
    marks.slice(0, 2).forEach(([kind, label], i) => {
      const by = base0 + i * gap;
      out.push(icon(kind, x + pad + isz / 2, by - sMark * 0.36, isz));
      out.push(text(x + pad + isz + 4, by, compact ? shortLabel(label) : label, sMark, { color: kind === "stop" ? MUTED : INK, weight: 500 }));
    });
  }
  if (day === today) out.push(`<rect class="today" ${box} fill="none" stroke="${INK}" stroke-width="2"/>`);
  return out.join("");
}

function legendSymbols(x, y, size = 17, gap = 26) {
  const items = [
    ["swatch", "url(#hatch)", PHASE_TINTS[0], "連假"],
    ["swatch", "url(#hatch)", PHASE_TINTS[3], "友好期間（不排運營）"],
    ["box", DARK, null, "沙推・彩排"],
    ["box", ACCENT, null, "總會"],
    ["meeting", null, null, "週六運營會"],
    ["group", null, null, "週二小組會"],
    ["stop", null, null, "停會"],
    ["signup", null, null, "報名"],
    ["train", null, null, "高鐵開賣"],
    ["star", null, null, "燈會開幕"],
  ];
  const out = [];
  let cx = x;
  for (const [kind, a, b, label] of items) {
    if (kind === "swatch" || kind === "box") {
      const rect = (fill) => `<rect x="${cx}" y="${y - size + 2}" width="26" height="${size + 2}" rx="3" fill="${fill}"/>`;
      out.push(kind === "swatch" ? rect(b) + rect(a) : rect(a));
      cx += 32;
    } else {
      out.push(icon(kind, cx + 8, y - size * 0.36, 15));
      cx += 22;
    }
    out.push(text(cx, y, label, size, { color: INK_2, weight: 500 }));
    cx += textWidth(label, size, 500) + gap;
  }
  return out.join("");
}

function header(w, mx, titleSize, split) {
  const weeks = Math.floor((daysBetween(CAL_START, CAL_END) + 1) / 7);
  const span = `${fullDay(CAL_START)}～ ${fullDay(CAL_END)}｜${weeks} 週`;
  const events = "沙推 1/23、2/13　彩排 2/20、2/27　總會 2/28";
  const out = [text(mx, 64, "2027 創價班總會　運營總覽", titleSize, { weight: 800 })];
  if (split) out.push(text(mx, 98, span, 19, { color: INK_2, weight: 500 }), text(mx, 124, events, 19, { color: INK_2, weight: 500 }));
  else out.push(text(mx, 102, `${span}　　${events}`, 21, { color: INK_2, weight: 500 }));
  return out.join("");
}

function monthStepLine(gx0, gy0, cw, rh, firstDay) {
  const [r, c] = [Math.floor(daysBetween(CAL_START, firstDay) / 7), daysBetween(CAL_START, firstDay) % 7];
  const x1 = gx0 + 7 * cw;
  const top = gy0 + r * rh;
  const points = c === 0 ? `${gx0},${top} ${x1},${top}` : `${gx0},${top + rh} ${gx0 + c * cw},${top + rh} ${gx0 + c * cw},${top} ${x1},${top}`;
  return `<polyline points="${points}" fill="none" stroke="#6d695f" stroke-width="2.4" stroke-linejoin="round"/>`;
}

function phaseColumn(model, x, gy0, rh) {
  const pos = (day) => {
    const k = daysBetween(CAL_START, day < CAL_START ? CAL_START : day > CAL_END ? CAL_END : day);
    return gy0 + (Math.floor(k / 7) + (k % 7) / 7) * rh;
  };
  const out = [];
  model.phases.forEach((phase, i) => {
    const y0 = pos(phase.start) + 3;
    const y1 = pos(phase.end) + rh / 7 - 3;
    out.push(`<rect x="${x}" y="${y0}" width="8" height="${y1 - y0}" rx="4" fill="${PHASE_COLORS[i]}"/>`);
    const [label, , extra] = phaseName(phase).split(/(（)/);
    const end = phase.end > CAL_END ? CAL_END : phase.end;
    const range = rangeLabel(phase.start, end) + (extra ? `　${extra.replace(/）$/, "")}` : "");
    const title = `${CIRCLED[i]} ${label}`;
    if (i === 5) {
      const mid = (y0 + y1) / 2;
      out.push(text(x + 18, mid - 4, title, 18, { weight: 800 }));
      out.push(text(x + 18 + textWidth(title, 18, 800) + 8, mid - 4, `${monthOf(phase.start)}/${dayOfMonth(phase.start)}–${dayOfMonth(phase.end)}`, 13, { color: MUTED, weight: 500 }));
      return;
    }
    const top = y0 + (i === 6 ? 30 : 20);
    out.push(text(x + 18, top, title, 19, { weight: 800 }));
    out.push(text(x + 18, top + 20, range, 14, { color: MUTED, weight: 500 }));
  });
  return out.join("");
}

export function calendarWeeksSVG(model, today) {
  const [mx, monthW, cw, rh, phaseW] = [36, 64, 140, 88, 166];
  const gx0 = mx + monthW;
  const gx1 = gx0 + 7 * cw;
  const width = gx1 + phaseW + mx;
  const wdY = 196;
  const gy0 = wdY + 14;
  const total = daysBetween(CAL_START, CAL_END) + 1;
  const rows = Math.floor(total / 7);
  const gy1 = gy0 + rows * rh;
  const ev = calendarEvents(model);
  const out = [header(width, mx, 44, false), legendSymbols(mx, 148)];
  [...WEEKDAYS].forEach((ch, i) => out.push(text(gx0 + i * cw + cw / 2, wdY, ch, 18, { color: INK_2, weight: 700, anchor: "middle" })));

  const monthStarts = [];
  for (let r = 0; r < rows; r++) {
    const cells = [];
    for (let c = 0; c < 7; c++) {
      const day = addDays(CAL_START, r * 7 + c);
      cells.push(cell(model, gx0 + c * cw, gy0 + r * rh, cw, rh, day, ev[day] ?? EMPTY, { today }));
      if ((r === 0 && c === 0) || dayOfMonth(day) === 1) monthStarts.push([day, r]);
    }
    out.push(`<g class="week-row">${cells.join("")}</g>`);
  }
  for (const [day, r] of monthStarts) {
    if (dayOfMonth(day) === 1) out.push(monthStepLine(gx0, gy0, cw, rh, day));
    const y = gy0 + r * rh;
    out.push(text(mx, y + 34, `${monthOf(day)}月`, 24, { weight: 800 }));
    if ([11, 1].includes(monthOf(day))) out.push(text(mx, y + 54, String(yearOf(day)), 14, { color: MUTED, weight: 500 }));
  }
  out.push(phaseColumn(model, gx1 + 16, gy0, rh));
  out.push(text(mx, gy1 + 34, NOTE_WIDE, 15, { color: MUTED, weight: 500 }));
  return svgDoc(width, gy1 + 64, out.join(""));
}

function monthsLegend(model, x, y) {
  const out = [text(x, y + 14, "七個階段", 20, { weight: 800 })];
  model.phases.forEach((phase, i) => {
    const yy = y + 46 + i * 34;
    out.push(`<rect x="${x}" y="${yy - 18}" width="30" height="24" rx="3" fill="${PHASE_TINTS[i]}"/>`);
    if (i === 3) out.push(`<rect x="${x}" y="${yy - 18}" width="30" height="24" rx="3" fill="url(#hatch)"/>`);
    out.push(`<rect x="${x}" y="${yy - 18}" width="5" height="24" rx="2" fill="${PHASE_COLORS[i]}"/>`);
    out.push(text(x + 40, yy, `${CIRCLED[i]} ${phaseName(phase)}`, 17, { weight: 700 }));
    out.push(text(x + 230, yy, rangeLabel(phase.start, phase.end > CAL_END ? CAL_END : phase.end), 15, { color: MUTED, weight: 500 }));
  });
  const y2 = y + 46 + 7 * 34 + 16;
  out.push(text(x, y2, "記號", 20, { weight: 800 }));
  const rows = [
    [["swatch", PHASE_TINTS[0], "連假"], ["swatch", PHASE_TINTS[3], "友好期間"], ["box", DARK, "沙推・彩排"], ["box", ACCENT, "總會"]],
    [["meeting", null, "運營會"], ["group", null, "小組會"], ["stop", null, "停會"], ["signup", null, "報名"], ["train", null, "高鐵開賣"], ["star", null, "燈會開幕"]],
  ];
  rows.forEach((items, j) => {
    let cx = x;
    const yy = y2 + 34 + j * 32;
    for (const [kind, color, label] of items) {
      if (kind === "swatch" || kind === "box") {
        out.push(`<rect x="${cx}" y="${yy - 16}" width="24" height="20" rx="3" fill="${color}"/>`);
        if (kind === "swatch") out.push(`<rect x="${cx}" y="${yy - 16}" width="24" height="20" rx="3" fill="url(#hatch)"/>`);
        cx += 30;
      } else {
        out.push(icon(kind, cx + 7, yy - 6, 14));
        cx += 20;
      }
      out.push(text(cx, yy, label, 15, { color: INK_2, weight: 500 }));
      cx += textWidth(label, 15, 500) + 20;
    }
  });
  return out.join("");
}

function monthList() {
  const list = [];
  let day = firstOfMonth(yearOf(CAL_START), monthOf(CAL_START));
  while (day <= CAL_END) {
    list.push(day);
    const [y, m] = [yearOf(day), monthOf(day)];
    day = m === 12 ? firstOfMonth(y + 1, 1) : firstOfMonth(y, m + 1);
  }
  return list;
}

export function calendarMonthsSVG(model, today, { columns = 2 } = {}) {
  const [cw, rh, gap] = [80, 74, 40];
  const mx = columns === 1 ? 24 : 40;
  const bw = 7 * cw;
  const width = mx * 2 + bw * columns + gap * (columns - 1);
  const ev = calendarEvents(model);
  const single = columns === 1;
  const out = [header(width, mx, 40, single)];
  const blocks = [...monthList(), "legend"];
  let y = single ? 166 : 140;
  for (let start = 0; start < blocks.length; start += columns) {
    let rowH = 0;
    blocks.slice(start, start + columns).forEach((block, col) => {
      const bx = mx + col * (bw + gap);
      if (block === "legend") {
        out.push(monthsLegend(model, bx, y + 20));
        if (single) rowH = Math.max(rowH, 440);
        return;
      }
      const [year, month] = [yearOf(block), monthOf(block)];
      const next = month === 12 ? firstOfMonth(year + 1, 1) : firstOfMonth(year, month + 1);
      const ndays = daysBetween(block, next);
      const lead = (weekdayIndex(block) + 1) % 7;
      const nrows = Math.ceil((lead + ndays) / 7);
      const gy = y + 72;
      const parts = [text(bx, y + 34, `${month} 月`, 28, { weight: 800 }), text(bx + textWidth(`${month} 月`, 28, 800) + 10, y + 34, String(year), 15, { color: MUTED, weight: 500 })];
      [...WEEKDAYS].forEach((ch, k) => parts.push(text(bx + k * cw + cw / 2, y + 62, ch, 15, { color: INK_2, weight: 700, anchor: "middle" })));
      for (let k = 0; k < ndays; k++) {
        const day = addDays(block, k);
        const [r, c] = [Math.floor((lead + k) / 7), (lead + k) % 7];
        parts.push(cell(model, bx + c * cw, gy + r * rh, cw, rh, day, ev[day] ?? EMPTY, { compact: true, active: inRange(day), today }));
      }
      out.push(`<g class="month">${parts.join("")}</g>`);
      rowH = Math.max(rowH, 72 + nrows * rh);
    });
    y += rowH + 26;
  }
  const notes = single ? NOTE_COMPACT : [NOTE_COMPACT.join("")];
  notes.forEach((line, i) => out.push(text(mx, y + 4 + i * 20, line, 14, { color: MUTED, weight: 500 })));
  return svgDoc(width, y + 30 + (notes.length - 1) * 20, out.join(""));
}

let chosen = null;

function installCanvasMeasurer() {
  const canvas = document.createElement("canvas").getContext("2d");
  setTextMeasurer((s, size, weight) => {
    canvas.font = `${weight} ${size}px ${FONT_STACK}`;
    return canvas.measureText(s).width;
  });
}

export function render(container, model, ctx) {
  installCanvasMeasurer();
  const mode = chosen ?? (ctx.wide ? "weeks" : "months");
  const draw = () => {
    const svg = mode === "weeks" ? calendarWeeksSVG(model, ctx.today) : calendarMonthsSVG(model, ctx.today, { columns: ctx.wide ? 2 : 1 });
    const chip = (key, label) => `<button type="button" class="chip" data-mode="${key}" aria-pressed="${mode === key}">${label}</button>`;
    container.innerHTML = `<div class="cal"><div class="cal-switch">${chip("weeks", "連續週曆")}${chip("months", "月份格子")}</div><div class="cal-body is-${mode}">${svg}</div></div>`;
  };
  draw();
  container.onclick = (event) => {
    const button = event.target.closest?.("[data-mode]");
    if (!button || button.dataset.mode === mode) return;
    chosen = button.dataset.mode;
    render(container, model, ctx);
  };
  const token = (container.calendarToken = (container.calendarToken ?? 0) + 1);
  const stillShown = () => container.calendarToken === token && container.querySelector(".cal") !== null;
  Promise.all([500, 800].map((w) => document.fonts.load(`${w} 16px "Noto Sans TC"`, "週一二三四五六日"))).then(() => {
    if (stillShown()) draw();
  }, () => {});
}
