import { addDays, daysBetween } from "./dates.js?v=1";
import { isOpen, isCancelled } from "./model.js?v=1";
import { GROUPS, CIRCLED } from "./theme.js?v=1";
import { CONFIG } from "../config.js?v=1";

const NOT_STARTED = "未開始";
const TBD = ["", "待定"];

export function shortItem(text) {
  const body = text.startsWith("決定：") ? text.slice(text.indexOf("：") + 1) : text;
  return [...body].length > 20 ? body.replace(/（[^）]*）/g, "") : body;
}

export function shortOwner(text) {
  return text.includes("待定") ? "待定" : text.replace(/（[^）]*）/g, "");
}

export function allocate(counts, budget) {
  const alloc = Object.fromEntries(Object.entries(counts).map(([g, c]) => [g, Math.min(c, 2)]));
  const sum = () => Object.values(alloc).reduce((a, b) => a + b, 0);
  while (sum() < budget) {
    const hidden = Object.keys(counts).filter((g) => counts[g] > alloc[g]);
    if (!hidden.length) break;
    const biggest = hidden.reduce((best, g) => (counts[g] - alloc[g] > counts[best] - alloc[best] ? g : best));
    alloc[biggest] += 1;
  }
  return alloc;
}

export function phaseLabel(model, day) {
  const index = model.phases.findIndex((p) => p.start <= day && day <= p.end);
  if (index < 0) return null;
  const name = model.phases[index].name;
  return { index, label: `${CIRCLED[index]} ${name.slice(name.indexOf(" ") + 1)}` };
}

export function weekView(model, today) {
  const nextMeeting = model.meetings.filter((m) => m.date > today && m.name !== "停會").sort((a, b) => a.date.localeCompare(b.date))[0] ?? null;
  const windowEnd = nextMeeting ? nextMeeting.date : addDays(today, 7);
  const todayMeeting = model.meetings.find((m) => m.date === today) ?? null;
  const tasks = model.tasks.filter((t) => t.area !== "會議");
  const due = tasks.filter((t) => today < t.date && t.date <= windowEnd && !isCancelled(t.status));
  const late = tasks.filter((t) => t.date <= today && isOpen(t.status));
  const byDate = (a, b) => a.date.localeCompare(b.date);
  const dueOrder = (a, b) => byDate(a, b) || (a.status !== NOT_STARTED) - (b.status !== NOT_STARTED);
  return {
    today,
    nextMeeting,
    windowEnd,
    todayMeeting,
    groups: GROUPS.map((group) => ({
      group,
      due: due.filter((t) => t.group === group).sort(dueOrder),
      late: late.filter((t) => t.group === group).sort(byDate),
    })),
    nextSmallGroup: model.smallGroups.filter((s) => s.date > today && !s.note.includes("停")).sort(byDate)[0] ?? null,
    phase: phaseLabel(model, addDays(today, 1)),
    daysLeft: daysBetween(today, CONFIG.EVENT_DATE),
  };
}

export function nextMeetingBox(meeting, fmt) {
  if (!meeting) return { value: "—", sub: "運營會已全部結束" };
  const timeKnown = !TBD.includes(meeting.time);
  const placeKnown = !TBD.includes(meeting.place);
  const pending = [["時間", timeKnown], ["場地", placeKnown]].filter(([, known]) => !known).map(([k]) => `${k}待定`);
  const where = pending.length ? pending.join("、") : meeting.place;
  return { value: timeKnown ? `${fmt(meeting.date)} ${meeting.time}` : fmt(meeting.date), sub: `${meeting.name}｜${where}` };
}
