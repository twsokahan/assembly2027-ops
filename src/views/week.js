import { addDays, fmt } from "../dates.js?v=1";
import { GROUPS, GROUP_COLORS, PHASE_COLORS, PHASE_TINTS, STATUS_STYLE } from "../theme.js?v=1";
import { inlineIcon } from "../svg.js?v=1";
import { weekView, shortItem, shortOwner, nextMeetingBox } from "../week.js?v=1";

const FILTERS = [["全部", null], ["本部", "運營本部"], ["前導", "前導組"], ["活動", "活動組"], ["總務", "總務組"]];

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function heroCount(daysLeft) {
  if (daysLeft > 0) return `<div class="k">距總會</div><div class="n">${daysLeft}<span>天</span></div>`;
  if (daysLeft === 0) return '<div class="k">今天</div><div class="n">總會</div>';
  return '<div class="k">總會後</div><div class="n">收尾</div>';
}

function phaseTag(phase) {
  if (!phase) return "";
  return `<div class="phase" style="background:${PHASE_TINTS[phase.index]}"><i style="background:${PHASE_COLORS[phase.index]}"></i>${escapeHtml(phase.label)}</div>`;
}

function taskRow(task, isLate) {
  const [fg, bg, border] = STATUS_STYLE[task.status] ?? STATUS_STYLE.未開始;
  const owner = shortOwner(task.owner);
  const lateMark = isLate ? inlineIcon("late", 14) : "";
  return `<div class="it${isLate ? " is-late" : ""}">
<span class="dt">${lateMark}${fmt(task.date)}</span>
<span class="tx">${escapeHtml(shortItem(task.item))}</span>
<span class="ow${owner === "待定" ? " tbd" : ""}">${escapeHtml(owner)}</span>
<span class="st" style="color:${fg};background:${bg};border-color:${border}">${escapeHtml(task.status)}</span></div>`;
}

function groupSection({ group, due, late }) {
  const count = due.length ? `<b>${due.length} 項</b>` : '<b class="none">沒有到期的事</b>';
  const lateTag = late.length ? `<em class="late">到期未完成 ${late.length}</em>` : "";
  const rows = [...late.map((t) => taskRow(t, true)), ...due.map((t) => taskRow(t, false))].join("");
  return `<section><h3><i style="background:${GROUP_COLORS[group]}"></i>${group}${count}${lateTag}</h3>${rows}</section>`;
}

function filterBar(selected) {
  const buttons = FILTERS.map(([label, group]) => {
    const on = group === selected;
    return `<button type="button" class="chip" data-group="${group ?? ""}" aria-pressed="${on}">${label}</button>`;
  });
  return `<div class="filters" role="group" aria-label="選擇組別">${buttons.join("")}</div>`;
}

function infoBox(title, value, sub) {
  return `<div class="box"><div class="k">${title}</div><div class="v">${escapeHtml(value)}</div><div class="s">${escapeHtml(sub)}</div></div>`;
}

export function render(container, model, ctx) {
  const view = weekView(model, ctx.today);
  const selected = GROUPS.includes(ctx.group) ? ctx.group : null;
  const meeting = nextMeetingBox(view.nextMeeting, fmt);
  const small = view.nextSmallGroup;
  const smallNote = small?.note ? `各組自訂｜${small.note}` : "各組自訂";

  container.innerHTML = `<div class="week${ctx.wide ? " is-wide" : ""}">
<div class="hero"><div class="count">${heroCount(view.daysLeft)}</div>
<div class="range">${phaseTag(view.phase)}<div class="k">下次開會前要完成</div><div class="r">${fmt(addDays(ctx.today, 1))} ～ ${fmt(view.windowEnd)}</div></div></div>
<div class="boxes">${infoBox("下次開會", meeting.value, meeting.sub)}${small ? infoBox("各組小組會", `${fmt(small.date)} 晚上`, smallNote) : infoBox("各組小組會", "—", "")}</div>
${filterBar(selected)}
<div class="groups">${view.groups.filter((g) => !selected || g.group === selected).map(groupSection).join("")}</div></div>`;

  container.onclick = (event) => {
    const chip = event.target.closest?.("[data-group]");
    if (chip) ctx.setGroup(chip.dataset.group || null);
  };
}
