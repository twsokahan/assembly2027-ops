import { daysBetween, fmt, fmtShort } from "../dates.js?v=5";
import { CONFIG } from "../../config.js?v=5";
import { isCancelled, isDone } from "../model.js?v=5";
import { PAPER, INK, INK_2, MUTED, RULE, DARK, ACCENT, GROUP_COLORS, PHASE_COLORS, PHASE_TINTS, CIRCLED, mix } from "../theme.js?v=5";
import { FONT_STACK, arrowDefs, diamond, icon, inlineIcon, setTextMeasurer, svgDoc, text, textWidth } from "../svg.js?v=5";

const { CAL_START, CAL_END, EVENT_DATE } = CONFIG;
const WHITE = "#ffffff";
const W = 1920;
const MX = 36;
const X0 = 250;
const X1 = 1870;
const ROW_H = 72;
const LANE_GAP = 14;
const LANE_TOP = 300;
const PILL_Y = [222, 254];
const KEY_NAMES = [["沙推", "沙推", DARK], ["彩排", "彩排", DARK], ["正式舉辦", "總會", ACCENT]];
const FOOTNOTE = "逐項工作、負責人、狀態看「運營追蹤大表」；逐週表在規劃文件附錄。沙推、彩排、總會的直線貫穿四組。";

const halo = (color = PAPER, width = 5) => ` paint-order="stroke" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"`;
const rangeLabel = (start, end) => (start === end ? fmtShort(start) : `${fmtShort(start)}–${fmtShort(end)}`);
const within = (day, span) => span && span.start <= day && day <= span.end;
const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function keyLines(model) {
  const lines = [];
  for (const m of model.meetings) {
    const key = KEY_NAMES.find(([match]) => m.name.includes(match));
    if (key) lines.push({ day: m.date, label: key[1], color: key[2] });
  }
  return lines.sort((a, b) => (a.day < b.day ? -1 : 1));
}

function layoutGeometry(model) {
  const ppd = (X1 - X0) / (daysBetween(CAL_START, CAL_END) + 1);
  const xd = (day) => X0 + (daysBetween(CAL_START, day) + 0.5) * ppd;
  const rows = new Map();
  const bands = [];
  let y = LANE_TOP;
  for (const lane of model.lanes) {
    const top = y;
    lane.rows.forEach((row, i) => {
      rows.set(`${lane.group}/${i}`, y + ROW_H / 2);
      y += ROW_H;
    });
    bands.push({ lane, top, bottom: y });
    y += LANE_GAP;
  }
  const bottom = y - LANE_GAP;
  return { ppd, xd, rows, bands, bottom, height: bottom + 62 };
}

function header(model, today) {
  const out = [text(MX, 58, "2027 創價班總會　各組時程", 40, { weight: 800 }), text(W - MX, 58, `截至 ${fmtShort(today)}`, 16, { color: MUTED, weight: 500, anchor: "end" })];
  const ly = 100;
  let lx = MX;
  const group = GROUP_COLORS["前導組"];
  const entry = (label) => {
    out.push(text(lx + 48, ly, label, 18, { color: INK_2, weight: 500 }));
    lx += 48 + textWidth(label, 18, 500) + 28;
  };
  out.push(`<rect x="${lx}" y="${ly - 15}" width="40" height="16" rx="3" fill="${mix(group, 0.22)}" stroke="${group}" stroke-width="1.5"/>`);
  entry("持續的工作");
  lx -= 24;
  out.push(diamond(lx + 8, ly - 6, 8, group));
  entry("截止點（日期是最晚完成日）");
  lx -= 24;
  out.push(`<path d="M${lx},${ly - 6} H${lx + 40}" stroke="${INK}" stroke-width="1.8" marker-end="url(#arr)"/>`);
  lx += 2;
  entry("要先完成才能做下一步");
  lx -= 0;
  out.push(`<rect x="${lx}" y="${ly - 16}" width="40" height="20" fill="${PHASE_TINTS[3]}"/><rect x="${lx}" y="${ly - 16}" width="40" height="20" fill="url(#hatch)"/>`);
  entry("友好期間（不排運營）");
  out.push(`<rect x="${lx}" y="${ly - 16}" width="40" height="20" fill="url(#hatch)" opacity=".55"/>`);
  out.push(text(lx + 48, ly, "連假", 18, { color: INK_2, weight: 500 }));
  return out;
}

function phaseStrip(model, g) {
  const out = [];
  model.phases.forEach((phase, i) => {
    const x0 = g.xd(phase.start) - g.ppd / 2;
    const x1 = g.xd(phase.end > CAL_END ? CAL_END : phase.end) + g.ppd / 2;
    out.push(`<rect x="${x0 + 1}" y="128" width="${x1 - x0 - 2}" height="30" rx="3" fill="${PHASE_TINTS[i]}"/>`);
    out.push(`<rect x="${x0 + 1}" y="128" width="4" height="30" rx="2" fill="${PHASE_COLORS[i]}"/>`);
    let label = `${CIRCLED[i]} ${phase.name.slice(phase.name.indexOf(" ") + 1).split("（")[0]}`;
    const size = textWidth(label, 15, 700) + 16 <= x1 - x0 ? 15 : 13;
    if (textWidth(label, size, 700) + 14 > x1 - x0) label = CIRCLED[i];
    out.push(text(x0 + 10, 149, label, size, { weight: 700 }));
  });
  return out;
}

function weekAxis(model, g, back) {
  const out = [];
  model.weeks.forEach((week, i) => {
    const x = g.xd(week.start) - g.ppd / 2;
    back.push(`<line x1="${x}" y1="180" x2="${x}" y2="${g.bottom}" stroke="${RULE}" stroke-width="1"/>`);
    out.push(text(x + 5, 198, week.name || `W${i + 1}`, 15, { color: INK_2, weight: 700 }));
    out.push(text(x + 5, 215, fmtShort(week.start), 13, { color: MUTED, weight: 500 }));
  });
  return out;
}

function laneFrames(g, back, out) {
  for (const { lane, top, bottom } of g.bands) {
    back.unshift(`<rect x="${MX}" y="${top}" width="${X1 - MX}" height="${bottom - top}" rx="6" fill="#f5f4f0"/>`);
    out.push(`<rect x="${MX}" y="${top}" width="6" height="${bottom - top}" rx="3" fill="${GROUP_COLORS[lane.group]}"/>`);
    out.push(text(MX + 18, top + 31, lane.group, 22, { weight: 800 }));
    lane.rows.forEach((row, i) => {
      const cy = g.rows.get(`${lane.group}/${i}`);
      out.push(text(MX + 18, cy + (i === 0 ? 22 : 5), row.name, 14, { color: MUTED, weight: 500 }));
      if (i > 0) back.push(`<line x1="${X0 - 6}" y1="${cy - ROW_H / 2}" x2="${X1}" y2="${cy - ROW_H / 2}" stroke="${RULE}" stroke-width="1" stroke-dasharray="4 4"/>`);
    });
  }
}

function breaks(model, g, back, labels) {
  const goodwill = model.goodwill;
  if (goodwill) {
    const gx0 = g.xd(goodwill.start) - g.ppd / 2;
    const gx1 = g.xd(goodwill.end) + g.ppd / 2;
    const h = g.bottom - LANE_TOP;
    back.push(`<rect x="${gx0}" y="${LANE_TOP}" width="${gx1 - gx0}" height="${h}" fill="${PHASE_TINTS[3]}" opacity=".8"/><rect x="${gx0}" y="${LANE_TOP}" width="${gx1 - gx0}" height="${h}" fill="url(#hatch)"/>`);
    const cy = g.rows.values().next().value ?? LANE_TOP + ROW_H / 2;
    labels.push(text((gx0 + gx1) / 2, cy - 2, "友好期間", 17, { color: INK_2, weight: 800, anchor: "middle", extra: halo("#efeeeb") }));
    labels.push(text((gx0 + gx1) / 2, cy + 20, "不排運營", 15, { color: INK_2, weight: 600, anchor: "middle", extra: halo("#efeeeb") }));
  }
  for (const holiday of model.holidays) {
    if (within(holiday.start, goodwill)) continue;
    const hx0 = g.xd(holiday.start) - g.ppd / 2;
    const hx1 = g.xd(holiday.end > CAL_END ? CAL_END : holiday.end) + g.ppd / 2;
    back.push(`<rect x="${hx0}" y="${LANE_TOP}" width="${hx1 - hx0}" height="${g.bottom - LANE_TOP}" fill="url(#hatch)" opacity=".55"/>`);
  }
}

function keyLineMarks(model, g, mid, out) {
  const tops = [-Infinity, -Infinity];
  for (const { day, label, color } of keyLines(model)) {
    const x = g.xd(day);
    const caption = `${label} ${fmtShort(day)}`;
    const tw = textWidth(caption, 15, 700) + 18;
    let left = x - tw / 2;
    if (day === EVENT_DATE) left = x - 6;
    else if (daysBetween(day, EVENT_DATE) === 1) left = x - tw + 6;
    const level = tops[0] + 4 <= left ? 0 : 1;
    tops[level] = left + tw;
    const py = PILL_Y[level];
    mid.push(`<line x1="${x}" y1="${py + 24}" x2="${x}" y2="${g.bottom}" stroke="${color}" stroke-width="${color === ACCENT ? 2.4 : 1.6}"/>`);
    out.push(`<rect x="${left}" y="${py}" width="${tw}" height="24" rx="12" fill="${color}"/>`);
    out.push(text(left + tw / 2, py + 17, caption, 15, { color: WHITE, weight: 700, anchor: "middle" }));
  }
}

function placeLabels(items, g, labels) {
  const ends = new Map();
  for (const item of [...items].sort((a, b) => a.group.localeCompare(b.group) || a.row - b.row || a.x - b.x)) {
    const cy = g.rows.get(`${item.group}/${item.row}`);
    const width = textWidth(item.when, 13, 600) + 5 + textWidth(item.name, 16, 600);
    let start = item.x - 7;
    if (start + width > X1) start = item.x + 7 - width;
    const slots = ends.get(`${item.group}/${item.row}`) ?? { above: -1e9, below: -1e9 };
    ends.set(`${item.group}/${item.row}`, slots);
    const slot = start >= slots.above + 10 ? "above" : start >= slots.below + 10 ? "below" : slots.above <= slots.below ? "above" : "below";
    slots[slot] = start + width;
    const base = slot === "above" ? cy - 17 : cy + 30;
    const strike = item.cancelled ? ' text-decoration="line-through"' : "";
    labels.push(text(start, base, item.when, 13, { color: MUTED, weight: 600, extra: halo() + strike }));
    labels.push(text(start + textWidth(item.when, 13, 600) + 5, base, item.name, 16, { weight: 600, extra: halo() + strike }));
  }
}

function spansAndMilestones(model, g, mid, front, labels) {
  const anchors = new Map();
  const placed = [];
  for (const span of model.spans) {
    const cy = g.rows.get(`${span.group}/${span.row}`);
    if (cy === undefined) continue;
    const color = GROUP_COLORS[span.group];
    const x0 = g.xd(span.start) - g.ppd / 2;
    const x1 = g.xd(span.end) + g.ppd / 2;
    mid.push(`<rect class="span" x="${x0}" y="${cy - 10}" width="${x1 - x0}" height="20" rx="5" fill="${mix(color, 0.22)}" stroke="${color}" stroke-width="1.5"/>`);
    anchors.set(span.name, { start: x0, end: x1, cy, kind: "span" });
    const when = rangeLabel(span.start, span.end);
    const need = textWidth(`${span.name}　${when}`, 14, 600) + 12;
    const stops = model.milestones
      .filter((m) => m.group === span.group && m.row === span.row && x0 - 10 <= g.xd(m.date) && g.xd(m.date) <= x1 + 10)
      .map((m) => g.xd(m.date))
      .sort((a, b) => a - b);
    const edges = [x0 - 2, ...stops, x1 + 2];
    let spot = null;
    for (let i = 0; i < edges.length - 1 && spot === null; i++) {
      const left = stops.includes(edges[i]) ? 12 : 8;
      const right = stops.includes(edges[i + 1]) ? 12 : 6;
      if (edges[i + 1] - edges[i] - left - right >= need) spot = edges[i] + left;
    }
    if (spot !== null) labels.push(text(spot, cy + 5, `${span.name}　${when}`, 14, { weight: 600 }));
    else placed.push({ x: x0, group: span.group, row: span.row, name: span.name, when });
  }
  for (const m of model.milestones) {
    const cy = g.rows.get(`${m.group}/${m.row}`);
    if (cy === undefined) continue;
    const x = g.xd(m.date);
    const done = isDone(m.status);
    const cancelled = isCancelled(m.status);
    anchors.set(m.name, { start: x, end: x, cy, kind: "milestone" });
    placed.push({ x, group: m.group, row: m.row, name: m.name, when: fmtShort(m.date), cancelled });
    const color = GROUP_COLORS[m.group];
    const state = done ? " done" : cancelled ? " cancelled" : "";
    const shape = cancelled ? diamond(x, cy, 9, PAPER, color) : diamond(x, cy, 9, done ? mix(color, 0.35, PAPER) : color);
    front.push(`<g class="milestone${state}">${shape}${done ? icon("check", x + 19, cy + 1, 12, color) : ""}</g>`);
  }
  placeLabels(placed, g, labels);
  return anchors;
}

function arrows(model, anchors) {
  const out = [];
  for (const { from, to } of model.deps) {
    const a = anchors.get(from);
    const b = anchors.get(to);
    if (!a || !b) continue;
    const r = 10;
    const xa = a.kind === "span" ? a.end : a.start;
    const xe = b.start - (b.kind === "milestone" ? r : 1);
    const stroke = `fill="none" stroke="${INK}" stroke-width="1.8" stroke-opacity=".8" marker-end="url(#arr)"`;
    const begin = xa + (a.kind === "milestone" ? r : 1);
    if (Math.abs(a.cy - b.cy) < 1) out.push(`<path class="dep" d="M${begin},${a.cy} H${xe}" ${stroke}/>`);
    else {
      const ys = a.cy + (b.cy > a.cy ? r : -r);
      const bend = Math.max(12, Math.min(40, (xe - xa) * 0.6));
      out.push(`<path class="dep" d="M${xa},${ys} C${xa},${b.cy} ${xe - bend},${b.cy} ${xe},${b.cy}" ${stroke}/>`);
    }
  }
  return out;
}

export function groupScheduleSVG(model, today) {
  const g = layoutGeometry(model);
  const back = [];
  const mid = [];
  const front = [];
  const labels = [];
  const out = [...header(model, today), ...phaseStrip(model, g), ...weekAxis(model, g, back)];
  laneFrames(g, back, out);
  breaks(model, g, back, labels);
  keyLineMarks(model, g, mid, out);
  const anchors = spansAndMilestones(model, g, mid, front, labels);
  if (CAL_START <= today && today <= CAL_END) {
    const x = g.xd(today);
    mid.push(`<line class="today-line" x1="${x}" y1="${LANE_TOP - 8}" x2="${x}" y2="${g.bottom}" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 5"/>`);
    out.push(text(x, LANE_TOP - 12, "今天", 14, { color: ACCENT, weight: 800, anchor: "middle" }));
  }
  out.push(text(MX, g.height - 24, FOOTNOTE, 15, { color: MUTED, weight: 500 }));
  return svgDoc(W, g.height, arrowDefs() + [...back, ...mid, ...arrows(model, anchors), ...front, ...labels, ...out].join(""));
}

export function groupScheduleList(model, today) {
  const prerequisites = new Map();
  for (const { from, to } of model.deps) prerequisites.set(to, [...(prerequisites.get(to) ?? []), from]);
  const sections = model.lanes.map(({ group }) => {
    const items = [
      ...model.milestones.filter((m) => m.group === group).map((m) => ({ day: m.date, name: m.name, when: fmt(m.date), status: m.status })),
      ...model.spans.filter((s) => s.group === group).map((s) => ({ day: s.start, name: s.name, when: rangeLabel(s.start, s.end), status: null })),
    ].sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
    const rows = items.map((it) => {
      const state = it.status && isDone(it.status) ? " done" : it.status && isCancelled(it.status) ? " cancelled" : it.status && it.day < today ? " past" : "";
      const check = state === " done" ? inlineIcon("check", 14, GROUP_COLORS[group]) : "";
      const needs = prerequisites.get(it.name);
      const before = needs ? `<span class="gs-needs">要先有：${needs.map(escapeHtml).join("、")}</span>` : "";
      return `<li class="gs-item${state}" data-day="${it.day}"><span class="gs-when">${escapeHtml(it.when)}</span><span class="gs-name">${check}${escapeHtml(it.name)}</span>${before}</li>`;
    });
    return `<section class="gs-group" style="--group:${GROUP_COLORS[group]}"><h2>${group}</h2><ol>${rows.join("")}</ol></section>`;
  });
  return sections.join("");
}

function problemsFooter(model) {
  if (!model.problems.length) return "";
  return `<footer class="gs-problems"><h3>資料問題</h3><ul>${model.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul></footer>`;
}

export function renderInto(container, model, ctx) {
  const body = ctx.wide ? `<div class="gs-wide chart-wide">${groupScheduleSVG(model, ctx.today)}</div>` : `<div class="gs-list">${groupScheduleList(model, ctx.today)}</div>`;
  container.innerHTML = `<div class="gs">${body}${problemsFooter(model)}</div>`;
}

function installCanvasMeasurer() {
  const canvas = document.createElement("canvas").getContext("2d");
  setTextMeasurer((s, size, weight) => {
    canvas.font = `${weight} ${size}px ${FONT_STACK}`;
    return canvas.measureText(s).width;
  });
}

export function render(container, model, ctx) {
  installCanvasMeasurer();
  renderInto(container, model, ctx);
  container.onclick = null;
  const token = (container.scheduleToken = (container.scheduleToken ?? 0) + 1);
  const stillShown = () => container.scheduleToken === token && container.querySelector(".gs") !== null;
  const sample = "各組時程運營本部前導組活動組總務組截止點持續的工作友好期間今天";
  Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(`${w} 16px "Noto Sans TC"`, sample))).then(() => {
    if (stillShown()) renderInto(container, model, ctx);
  }, () => {});
}
