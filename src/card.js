import { fmt, addDays } from "./dates.js?v=8";
import { ACCENT, DARK, GROUPS, GROUP_COLORS, INK, INK_2, MUTED, PAPER, PHASE_COLORS, PHASE_TINTS, STATUS_STYLE } from "./theme.js?v=8";
import { allocate, shortItem, shortOwner, nextMeetingBox, smallGroupBox, heroParts } from "./week.js?v=8";

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN_X = 64;
const ROW_BUDGET = 9;
const FAMILY = '"Noto Sans TC", "PingFang TC", sans-serif';
const BOX_FILL = "#f1efea";

export function cardLayout(view) {
  const alloc = allocate(Object.fromEntries(view.groups.map((g) => [g.group, g.due.length])), ROW_BUDGET);
  return {
    sections: view.groups.map(({ group, due, late }) => {
      const shown = alloc[group] >= due.length ? due.length : alloc[group] - 1;
      return { group, rows: due.slice(0, shown), more: due.length - shown, lateCount: late.length };
    }),
  };
}

export function fitText(measure, text, maxWidth) {
  if (measure(text) <= maxWidth) return text;
  const chars = [...text];
  while (chars.length && measure(`${chars.join("")}…`) > maxWidth) chars.pop();
  return `${chars.join("")}…`;
}

export function updatedNote(fetchedAt) {
  const taipei = new Date(Date.parse(fetchedAt) + 8 * 3600000).toISOString();
  const [, month, day] = taipei.slice(0, 10).split("-").map(Number);
  return `狀態取自追蹤大表（${month}/${day} ${taipei.slice(11, 16)} 更新）`;
}

function baselineIn(top, height, size) {
  return top + (height - 1.448 * size) / 2 + 1.16 * size;
}

function painter(ctx) {
  const font = (weight, size) => {
    ctx.font = `${weight} ${size}px ${FAMILY}`;
  };
  const widthOf = (text, spacing = 0) => ctx.measureText(text).width + spacing * [...text].length;
  const text = (value, x, boxTop, boxHeight, { weight, size, color, spacing = 0, align = "left" }) => {
    font(weight, size);
    ctx.fillStyle = color;
    ctx.textBaseline = "alphabetic";
    const y = baselineIn(boxTop, boxHeight, size);
    const total = widthOf(value, spacing);
    let cursor = align === "right" ? x - total : x;
    if (!spacing) {
      ctx.textAlign = "left";
      ctx.fillText(value, cursor, y);
      return total;
    }
    for (const char of value) {
      ctx.fillText(char, cursor, y);
      cursor += ctx.measureText(char).width + spacing;
    }
    return total;
  };
  const measure = (value, weight, size, spacing = 0) => {
    font(weight, size);
    return widthOf(value, spacing);
  };
  const fill = (x, y, w, h, radius, color) => {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
  };
  return { text, measure, fill, font };
}

function drawHeader(p, ctx, view) {
  const pillWidth = p.measure("本週運營", 800, 28, 0.08 * 28) + 48;
  p.fill(MARGIN_X, 52, pillWidth, 56, 40, DARK);
  p.text("本週運營", MARGIN_X + 24, 52, 56, { weight: 800, size: 28, color: "#fff", spacing: 0.08 * 28 });
  const meeting = view.todayMeeting;
  const meta = meeting && meeting.name !== "停會" ? `${meeting.name}會後｜${fmt(view.today)}` : fmt(view.today);
  p.text(meta, WIDTH - MARGIN_X, 61.5, 37, { weight: 600, size: 26, color: INK_2, align: "right" });

  const hero = heroParts(view.daysLeft);
  const labelWidth = p.measure(hero.label, 700, 28, 0.06 * 28);
  const numberWidth = p.measure(hero.number, 900, 150, -0.02 * 150);
  const unitWidth = hero.unit ? 8 + p.measure(hero.unit, 800, 44) : 0;
  p.text(hero.label, MARGIN_X, 138, 40, { weight: 700, size: 28, color: INK_2, spacing: 0.06 * 28 });
  p.text(hero.number, MARGIN_X, 178, 142.5, { weight: 900, size: 150, color: ACCENT, spacing: -0.02 * 150 });
  if (hero.unit) p.text(hero.unit, MARGIN_X + numberWidth + 8, 263, 64, { weight: 800, size: 44, color: INK });

  const rangeX = MARGIN_X + Math.max(labelWidth, numberWidth + unitWidth) + 44;
  if (view.phase) {
    const { index, label } = view.phase;
    const tagWidth = p.measure(label, 700, 24) + 44;
    p.fill(rangeX, 155.5, tagWidth, 43, 8, PHASE_TINTS[index]);
    p.fill(rangeX + 10, 164, 8, 26, 4, PHASE_COLORS[index]);
    p.text(label, rangeX + 28, 155.5, 43, { weight: 700, size: 24, color: INK });
  }
  p.text("下次開會前要完成", rangeX, 210.5, 40, { weight: 700, size: 28, color: INK_2, spacing: 0.06 * 28 });
  p.text(`${fmt(addDays(view.today, 1))} ～ ${fmt(view.windowEnd)}`, rangeX, 254.5, 58, { weight: 800, size: 40, color: INK });
  ctx.fillStyle = INK;
  ctx.fillRect(MARGIN_X, 346.5, WIDTH - 2 * MARGIN_X, 3);
}

function drawRow(p, ctx, task, top) {
  const [fg, bg, border] = STATUS_STYLE[task.status] ?? STATUS_STYLE.未開始;
  const right = WIDTH - MARGIN_X;
  const statusWidth = p.measure(task.status, 700, 20) + 28;
  const statusX = right - statusWidth;
  p.fill(statusX, top + 5.5, statusWidth, 37, 8, border);
  p.fill(statusX + 2, top + 7.5, statusWidth - 4, 33, 6, bg);
  p.text(task.status, statusX + 14, top, 48, { weight: 700, size: 20, color: fg });

  const owner = shortOwner(task.owner);
  const ownerText = fitText((s) => p.measure(s, 400, 21), owner, 150);
  const ownerWidth = ownerText === owner ? p.measure(ownerText, owner === "待定" ? 700 : 400, 21) : 150;
  const ownerX = statusX - 16 - ownerWidth;
  p.text(ownerText, ownerX, top, 48, { weight: owner === "待定" ? 700 : 400, size: 21, color: owner === "待定" ? "#8a5a00" : MUTED });

  p.text(fmt(task.date), MARGIN_X + 30, top, 48, { weight: 600, size: 22, color: INK_2 });
  const textX = MARGIN_X + 30 + 128 + 16;
  const item = fitText((s) => p.measure(s, 500, 27), shortItem(task.item), ownerX - 16 - textX);
  p.text(item, textX, top, 48, { weight: 500, size: 27, color: INK });
}

function drawSection(p, ctx, section, top) {
  const { group, rows, more, lateCount } = section;
  const total = rows.length + more;
  p.fill(MARGIN_X, top + 9, 16, 30, 5, GROUP_COLORS[group]);
  const nameWidth = p.text(group, MARGIN_X + 30, top, 48, { weight: 800, size: 32, color: INK });
  const countText = total ? `${total} 項` : "沒有到期的事";
  const countX = MARGIN_X + 30 + nameWidth + 14;
  const countWidth = p.text(countText, countX, top, 48, { weight: total ? 600 : 500, size: 24, color: MUTED });
  if (lateCount) {
    const label = `到期未完成 ${lateCount}`;
    const pillX = countX + countWidth + 14;
    p.fill(pillX, top + 6, p.measure(label, 800, 22) + 28, 36, 20, ACCENT);
    p.text(label, pillX + 14, top + 6, 36, { weight: 800, size: 22, color: "#fff" });
  }
  let y = top + 48;
  for (const task of rows) {
    drawRow(p, ctx, task, y);
    y += 48;
  }
  if (more) {
    p.text(`還有 ${more} 項，看追蹤大表`, MARGIN_X + 30, y, 40, { weight: 600, size: 22, color: MUTED });
    y += 40;
  }
  return y + 16;
}

function drawFooter(p, view, sourceNote) {
  const boxes = [
    ["下次開會", nextMeetingBox(view.nextMeeting, fmt)],
    ["各組小組會", smallGroupBox(view.nextSmallGroup, fmt)],
  ];
  const boxWidth = (WIDTH - 2 * MARGIN_X - 20) / 2;
  boxes.forEach(([title, { value, sub }], i) => {
    const x = MARGIN_X + i * (boxWidth + 20);
    p.fill(x, 1115, boxWidth, 153, 18, BOX_FILL);
    p.text(title, x + 26, 1133, 32, { weight: 700, size: 22, color: INK_2 });
    p.text(value, x + 26, 1167, 49, { weight: 800, size: 34, color: INK });
    const fitted = fitText((s) => p.measure(s, 500, 21), sub, boxWidth - 52);
    p.text(fitted, x + 26, 1218, 30, { weight: 500, size: 21, color: MUTED });
  });
  p.text("2027 創價班總會", MARGIN_X, 1289, 27, { weight: 400, size: 19, color: MUTED });
  p.text(sourceNote, WIDTH - MARGIN_X, 1289, 27, { weight: 400, size: 19, color: MUTED, align: "right" });
}

const FONT_WEIGHTS = [400, 500, 600, 700, 800, 900];

async function loadFonts(strings) {
  if (!document.fonts?.load) return;
  const sample = [...new Set(strings.join(""))].join("");
  await Promise.all(FONT_WEIGHTS.map((weight) => document.fonts.load(`${weight} 24px "Noto Sans TC"`, sample).catch(() => [])));
}

export async function drawWeekCard(canvas, view, sourceNote) {
  const layout = cardLayout(view);
  const meeting = nextMeetingBox(view.nextMeeting, fmt);
  const small = smallGroupBox(view.nextSmallGroup, fmt);
  const rowText = layout.sections.flatMap((s) => s.rows.flatMap((t) => [shortItem(t.item), shortOwner(t.owner), t.status, fmt(t.date)]));
  await loadFonts([
    "本週運營距總會今天總會後收尾天0123456789/（）～｜：，、 ①②③④⑤⑥⑦⑧⑨一二三四五六日",
    "下次開會前要完成各組小組會晚上自訂到期未完成還有項看追蹤大表沒有的事停會2027 創價班總會",
    ...GROUPS, view.phase?.label ?? "", view.todayMeeting?.name ?? "", meeting.value, meeting.sub, small.value, small.sub, sourceNote, ...rowText,
  ]);

  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const p = painter(ctx);
  drawHeader(p, ctx, view);
  let top = 379.5;
  for (const section of layout.sections) top = drawSection(p, ctx, section, top);
  drawFooter(p, view, sourceNote);
}

export async function renderWeekCardBlob(view, fetchedAt) {
  const canvas = document.createElement("canvas");
  await drawWeekCard(canvas, view, updatedNote(fetchedAt));
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) throw new Error("圖卡產生失敗");
  return blob;
}
