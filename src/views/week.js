import { addDays, fmt } from "../dates.js?v=8";
import { GROUPS, GROUP_COLORS, PHASE_COLORS, PHASE_TINTS, STATUS_STYLE } from "../theme.js?v=8";
import { inlineIcon } from "../svg.js?v=8";
import { weekView, shortItem, shortOwner, nextMeetingBox, smallGroupBox, heroParts } from "../week.js?v=8";
import { renderWeekCardBlob } from "../card.js?v=8";

const FILTERS = [["全部", null], ["本部", "運營本部"], ["前導", "前導組"], ["活動", "活動組"], ["總務", "總務組"]];

const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

function heroCount(daysLeft) {
  const { label, number, unit } = heroParts(daysLeft);
  return `<div class="k">${label}</div><div class="n">${number}${unit ? `<span>${unit}</span>` : ""}</div>`;
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

function showCardOverlay(blob, filename) {
  const url = URL.createObjectURL(blob);
  const dialog = document.createElement("dialog");
  dialog.className = "card-overlay";
  const image = new Image();
  image.src = url;
  image.alt = "本週運營圖卡";
  const save = document.createElement("a");
  save.href = url;
  save.download = filename;
  save.className = "chip";
  save.textContent = "下載";
  const close = document.createElement("button");
  close.type = "button";
  close.className = "chip";
  close.textContent = "關閉";
  const hint = document.createElement("p");
  hint.textContent = "手機可以長按圖片儲存";
  const actions = document.createElement("div");
  actions.append(save, close);
  dialog.append(image, hint, actions);
  const dismiss = () => {
    dialog.close();
    dialog.remove();
    URL.revokeObjectURL(url);
  };
  close.addEventListener("click", dismiss);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    dismiss();
  });
  document.body.append(dialog);
  dialog.showModal();
}

async function makeCard(button, view, fetchedAt) {
  if (button.disabled) return;
  const error = button.parentElement.querySelector(".card-error");
  const label = button.textContent;
  button.disabled = true;
  button.textContent = "產生中…";
  error.hidden = true;
  try {
    showCardOverlay(await renderWeekCardBlob(view, fetchedAt), `本週運營_${view.today}.png`);
  } catch {
    error.hidden = false;
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

export function render(container, model, ctx) {
  const view = weekView(model, ctx.today);
  const selected = GROUPS.includes(ctx.group) ? ctx.group : null;
  const meeting = nextMeetingBox(view.nextMeeting, fmt);
  const small = smallGroupBox(view.nextSmallGroup, fmt);

  container.innerHTML = `<div class="week${ctx.wide ? " is-wide" : ""}">
<div class="hero"><div class="count">${heroCount(view.daysLeft)}</div>
<div class="range">${phaseTag(view.phase)}<div class="k">下次開會前要完成</div><div class="r"><span class="nowrap">${fmt(addDays(ctx.today, 1))}</span> ～ <span class="nowrap">${fmt(view.windowEnd)}</span></div></div></div>
<div class="boxes">${infoBox("下次開會", meeting.value, meeting.sub)}${infoBox("各組小組會", small.value, small.sub)}</div>
${filterBar(selected)}
<div class="groups">${view.groups.filter((g) => !selected || g.group === selected).map(groupSection).join("")}</div>
<div class="card-download"><button type="button" class="chip">下載圖卡</button><p class="card-error" role="alert" hidden>圖卡產生失敗，請再試一次</p></div></div>`;

  container.onclick = (event) => {
    const download = event.target.closest?.(".card-download button");
    if (download) {
      makeCard(download, view, ctx.fetchedAt);
      return;
    }
    const chip = event.target.closest?.("[data-group]");
    if (chip) ctx.setGroup(chip.dataset.group || null);
  };
}
