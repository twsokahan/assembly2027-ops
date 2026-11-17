import { addDays, fmtShort } from "../dates.js?v=6";
import { CONFIG } from "../../config.js?v=6";
import { PAPER, INK, INK_2, MUTED, RULE, DARK, ACCENT, mix } from "../theme.js?v=6";
import { FONT_STACK, arrowDefs, setTextMeasurer, svgDoc, text, textWidth } from "../svg.js?v=6";

const WHITE = "#ffffff";
const PLACES = ["桃園", "大溪"];
const PLACE_COLORS = { 桃園: "#2a78d6", 大溪: "#1baf7a" };
const PLACE_TITLES = { 桃園: "桃園會館", 大溪: "大溪會館" };
const PLACE_SUBTITLES = { 桃園: "彩排、導覽、總會", 大溪: "大溪交流、住宿、春訓" };
const FOOTNOTE = "時間以這一頁為準，由前導組更新。春訓時間待春訓節目定。南部遊覽車 2/27 建議提早 1 小時出發（苗栗燈會塞車）。";
const OUTSIDE = "外地";
const BREAK_MARKS = "；，、：";

const LAYOUTS = {
  wide: {
    W: 1240, mx: 36, lineX: { 桃園: 176, 大溪: 668 }, textGap: 24, timeX: 112, size: 18, noteSize: 15, lh: 25, bar: 14, stacked: false,
    arrowSpan: [46, 10],
  },
  narrow: {
    W: 360, mx: 8, lineX: { 桃園: 62, 大溪: 78 }, textGap: 0, timeX: 48, size: 15, noteSize: 13, lh: 21, bar: 8, stacked: true,
    markX: 92, textX: 124, arrowSpan: [26, 0],
  },
};

const hhmm = (s) => {
  const [h, m] = s.split(":");
  return Number(h) * 60 + Number(m);
};

export function wrap(s, size, width) {
  const lines = [];
  let current = "";
  let currentWidth = 0;
  for (const ch of s) {
    const w = textWidth(ch, size);
    if (current && currentWidth + w > width) {
      const cut = Math.max(...[...BREAK_MARKS].map((p) => current.lastIndexOf(p)));
      if (cut >= current.length * 0.55) {
        lines.push(current.slice(0, cut + 1));
        current = current.slice(cut + 1);
        currentWidth = textWidth(current, size);
      } else {
        lines.push(current);
        current = "";
        currentWidth = 0;
      }
    }
    current += ch;
    currentWidth += w;
  }
  if (current) lines.push(current);
  return lines;
}

function dayTitle(day) {
  return day === CONFIG.EVENT_DATE ? "2/28（日）總會" : "2/27（六）第二次彩排＋大溪交流";
}

function arrow(x1, x2, y, width, color = INK) {
  return `<path d="M${x1},${y} H${x2}" stroke="${color}" stroke-width="${width}" fill="none" marker-end="url(#arr)"/>`;
}

function header(L, opts) {
  const out = [];
  const { W, mx, lineX } = L;
  if (L.stacked) {
    out.push(text(mx, 34, "2/27～28 兩地時間軸", 24, { weight: 800 }));
    out.push(text(mx, 58, "時間由上往下。粗線＝持續一段時間；箭頭＝移動。", 13, { color: INK_2, weight: 500 }));
    let x = mx;
    for (const place of PLACES) {
      out.push(`<rect x="${x}" y="76" width="14" height="14" rx="7" fill="${PLACE_COLORS[place]}"/>`);
      out.push(text(x + 20, 89, PLACE_TITLES[place], 17, { weight: 800 }));
      x += 20 + textWidth(PLACE_TITLES[place], 17, 800) + 20;
    }
    return { out, y: 104 };
  }
  out.push(text(mx, 58, "2027 創價班總會　2/27～2/28 兩地時間軸", 40, { weight: 800 }));
  if (opts.today) out.push(text(W - mx, 58, `截至 ${fmtShort(opts.today)}`, 16, { color: MUTED, weight: 500, anchor: "end" }));
  out.push(text(mx, 94, "時間由上往下。粗線是持續一段時間的事；大箭頭是誰從哪裡移動到哪裡。", 19, { color: INK_2, weight: 500 }));
  for (const place of PLACES) {
    const x = lineX[place];
    out.push(`<rect x="${x - 8}" y="128" width="16" height="16" rx="8" fill="${PLACE_COLORS[place]}"/>`);
    out.push(text(x + 18, 143, PLACE_TITLES[place], 24, { weight: 800 }));
    out.push(text(x + 18 + textWidth(PLACE_TITLES[place], 24, 800) + 10, 142, PLACE_SUBTITLES[place], 16, { color: MUTED, weight: 500 }));
  }
  return { out, y: 172 };
}

function placeBlocks(L, events, moves, t, maxWidth) {
  const items = { 桃園: [], 大溪: [] };
  let cross = null;
  for (const e of events.filter((x) => x.start === t)) items[e.place]?.push({ kind: "event", text: e.text, extra: e.end });
  for (const m of moves.filter((x) => x.time === t)) {
    if (m.from === OUTSIDE || m.to === OUTSIDE) {
      const place = m.from === OUTSIDE ? m.to : m.from;
      items[place]?.push({ kind: m.from === OUTSIDE ? "in" : "out", text: m.who, extra: m.note });
    } else cross = m;
  }
  const blocks = {};
  for (const place of PLACES) {
    const lines = [];
    for (const it of items[place]) {
      if (it.kind === "event") lines.push(...wrap(it.text, L.size, maxWidth[place]).map((ln) => ({ kind: "event", ln })));
      else {
        lines.push({ kind: it.kind, ln: it.text });
        if (it.extra) lines.push(...wrap(it.extra, L.noteSize, maxWidth[place]).map((ln) => ({ kind: "note", ln })));
      }
    }
    blocks[place] = lines;
  }
  return { blocks, cross };
}

function wideRow(L, place, lines, y, body) {
  const lx = L.lineX[place];
  const tx = lx + L.textGap;
  let ly = y + 24;
  const [far, near] = L.arrowSpan;
  for (const { kind, ln } of lines) {
    if (kind === "event") body.push(`<g class="event-text">${text(tx, ly, ln, L.size, { weight: 500 })}</g>`);
    else if (kind === "note") body.push(text(tx, ly - 2, ln, L.noteSize, { color: MUTED, weight: 500 }));
    else {
      const [a, b] = kind === "in" ? [lx - far, lx - near] : [lx - near, lx - far];
      body.push(`<g class="move-small">${arrow(a, b, ly - 7, 2.4)}${text(tx, ly, ln, L.size, { weight: 800 })}</g>`);
    }
    ly += L.lh;
  }
}

function narrowRow(L, blocks, cross, y, body, firstLineY) {
  let ly = y + 20;
  for (const place of PLACES) {
    const lines = blocks[place];
    if (!lines.length) continue;
    firstLineY[place] = ly;
    let marked = false;
    for (const { kind, ln } of lines) {
      if (kind === "note") body.push(text(L.textX, ly - 2, ln, L.noteSize, { color: MUTED, weight: 500 }));
      else {
        const color = PLACE_COLORS[place];
        let mark = "";
        if (kind === "event" && !marked) mark = text(L.markX, ly, place, 14, { color, weight: 800 });
        if (kind === "in" || kind === "out") {
          const [a, b] = kind === "in" ? [L.markX, L.markX + 26] : [L.markX + 26, L.markX];
          mark = arrow(a, b, ly - 5, 2.4, color);
        }
        marked = true;
        const weight = kind === "event" ? 500 : 800;
        const inner = `${mark}${text(L.textX, ly, ln, L.size, { weight })}`;
        body.push(kind === "event" ? `<g class="event-text">${inner}</g>` : `<g class="move-small">${inner}</g>`);
      }
      ly += L.lh;
    }
    ly += 4;
  }
  if (cross) {
    const color = INK;
    const width = L.W - L.mx - L.textX;
    const label = [`${cross.from}→${cross.to}`, ...wrap(cross.who, L.size, width)];
    const lines = label.map((ln, i) => text(L.textX, ly + i * L.lh, ln, L.size, { weight: 800 })).join("");
    body.push(`<g class="move-big">${arrow(L.markX, L.markX + 26, ly - 5, 2.6, color)}${lines}</g>`);
    ly += label.length * L.lh;
    for (const ln of wrap(cross.note, L.noteSize, L.W - L.mx - L.textX)) {
      body.push(text(L.textX, ly - 2, ln, L.noteSize, { color: MUTED, weight: 500 }));
      ly += L.lh;
    }
  }
  return ly - y;
}

function crossWide(L, cross, y, body) {
  const { lineX } = L;
  const ay = y + 46;
  let xa = lineX[cross.from];
  let xb = lineX[cross.to];
  const right = xb > xa;
  xa += right ? 12 : -12;
  xb += right ? -14 : 14;
  const x0 = Math.min(...Object.values(lineX)) + 24;
  body.push(`<g class="move-big">${arrow(xa, xb, ay, 3.4)}${text(x0, y + 26, cross.who, L.size, { weight: 800 })}${text(x0 + textWidth(cross.who, L.size, 800) + 10, y + 26, cross.note, 15, { color: MUTED, weight: 500 })}</g>`);
}

function eventMarks(L, events, rowY, firstLineY, body) {
  for (const e of events) {
    const x = L.lineX[e.place];
    const color = e.text.includes("總會正式程序") ? ACCENT : PLACE_COLORS[e.place];
    const startY = L.stacked ? firstLineY.get(`${e.start}/${e.place}`) - 5 : rowY.get(e.start);
    if (e.end) {
      const endY = rowY.get(e.end);
      body.push(`<g class="event"><rect x="${x - L.bar / 2}" y="${startY - 6}" width="${L.bar}" height="${endY - startY + 12}" rx="${L.bar / 2}" fill="${color}"/><circle cx="${x}" cy="${startY}" r="${L.bar / 4.4}" fill="${PAPER}"/></g>`);
    } else {
      const r = L.stacked ? 5 : 8;
      body.push(`<g class="event"><circle cx="${x}" cy="${startY}" r="${r}" fill="${color}" stroke="${PAPER}" stroke-width="2.5"/></g>`);
    }
  }
}

export function twoSitesSVG(model, opts = {}) {
  const L = LAYOUTS[opts.narrow ? "narrow" : "wide"];
  const { W, mx, lineX } = L;
  const maxWidth = L.stacked
    ? { 桃園: W - mx - L.textX, 大溪: W - mx - L.textX }
    : { 桃園: lineX["大溪"] - 70 - (lineX["桃園"] + L.textGap), 大溪: W - mx - (lineX["大溪"] + L.textGap) };
  const head = header(L, opts);
  const out = head.out;
  let y = head.y;
  const back = [];
  const body = [];
  const dayTwo = CONFIG.EVENT_DATE;
  for (const day of [addDays(dayTwo, -1), dayTwo]) {
    const events = model.trackEvents.filter((e) => e.date === day);
    const moves = model.trackMoves.filter((m) => m.date === day);
    const times = [...new Set([...events.flatMap((e) => [e.start, e.end]), ...moves.map((m) => m.time)].filter(Boolean))].sort((a, b) => hhmm(a) - hhmm(b));
    const starts = new Set([...events.map((e) => e.start), ...moves.map((m) => m.time)]);

    out.push(`<rect x="${mx}" y="${y}" width="${W - 2 * mx}" height="${L.stacked ? 34 : 42}" rx="8" fill="${day === dayTwo ? ACCENT : DARK}"/>`);
    out.push(text(mx + (L.stacked ? 12 : 18), y + (L.stacked ? 23 : 29), dayTitle(day), L.stacked ? 16 : 22, { color: WHITE, weight: 800 }));
    y += L.stacked ? 46 : 58;
    const top = y;
    const rowY = new Map();
    const firstLineY = new Map();
    for (const t of times) {
      if (!starts.has(t)) {
        rowY.set(t, y + 4);
        y += 14;
        continue;
      }
      const { blocks, cross } = placeBlocks(L, events, moves, t, maxWidth);
      let h;
      if (L.stacked) {
        const mine = {};
        h = narrowRow(L, blocks, cross, y, body, mine);
        for (const [place, ly] of Object.entries(mine)) firstLineY.set(`${t}/${place}`, ly);
        h = Math.max(h, 26) + 10;
      } else {
        const heights = [26, ...PLACES.map((p) => blocks[p].length * L.lh)];
        if (cross) heights.push(52);
        h = Math.max(...heights) + 18;
        for (const place of PLACES) wideRow(L, place, blocks[place], y, body);
        if (cross) crossWide(L, cross, y, body);
      }
      rowY.set(t, y + 18);
      const end = events.find((e) => e.start === t && e.end)?.end ?? moves.find((m) => m.time === t && m.end)?.end;
      out.push(text(L.timeX, y + (L.stacked ? 20 : 24), t, L.stacked ? 16 : 20, { weight: 800, anchor: "end" }));
      if (end) out.push(text(L.timeX, y + (L.stacked ? 36 : 44), `～${end}`, L.stacked ? 12 : 14, { color: MUTED, weight: 600, anchor: "end" }));
      back.push(`<line x1="${mx}" y1="${y + h}" x2="${W - mx}" y2="${y + h}" stroke="${RULE}" stroke-width="1"/>`);
      y += h;
    }
    const spine = L.stacked ? 4 : 6;
    for (const place of PLACES) {
      const used = [
        ...events.filter((e) => e.place === place).map((e) => rowY.get(e.end || e.start)),
        ...moves.filter((m) => m.from === place || m.to === place).map((m) => rowY.get(m.time) + (m.from === OUTSIDE || m.to === OUTSIDE ? 0 : 28)),
      ];
      if (!used.length) continue;
      back.push(`<rect x="${lineX[place] - spine / 2}" y="${top}" width="${spine}" height="${Math.max(...used) + 14 - top}" rx="${spine / 2}" fill="${mix(PLACE_COLORS[place], 0.3)}"/>`);
    }
    eventMarks(L, events, rowY, firstLineY, body);
    y += 26;
  }
  const height = y + (L.stacked ? 56 : 24);
  const note = L.stacked ? wrap(FOOTNOTE, 12, W - 2 * mx) : [FOOTNOTE];
  note.forEach((ln, i) => out.push(text(mx, height - (L.stacked ? 52 : 26) + i * 17, ln, L.stacked ? 12 : 15, { color: MUTED, weight: 500 })));
  return svgDoc(W, height, arrowDefs() + [...back, ...body, ...out].join(""));
}

const escapeHtml = (value) => String(value).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function problemsFooter(model) {
  if (!model.problems.length) return "";
  return `<footer class="gs-problems"><h3>資料問題</h3><ul>${model.problems.map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ul></footer>`;
}

export function renderInto(container, model, ctx) {
  const svg = twoSitesSVG(model, { narrow: !ctx.wide, today: ctx.today });
  const wrapper = ctx.wide ? `<div class="ts-chart chart-wide">${svg}</div>` : `<div class="ts-chart ts-narrow">${svg}</div>`;
  container.innerHTML = `<div class="ts">${wrapper}${problemsFooter(model)}</div>`;
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
  const token = (container.twoSitesToken = (container.twoSitesToken ?? 0) + 1);
  const stillShown = () => container.twoSitesToken === token && container.querySelector(".ts") !== null;
  const sample = "兩地時間軸桃園大溪會館彩排導覽總會春訓守護會住宿交流";
  Promise.all([500, 600, 700, 800].map((w) => document.fonts.load(`${w} 16px "Noto Sans TC"`, sample))).then(() => {
    if (stillShown()) renderInto(container, model, ctx);
  }, () => {});
}
