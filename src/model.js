import { parseDay } from "./dates.js";
import { GROUPS } from "./theme.js";

const DONE = ["完成", "已定"];
const CANCELLED = "取消";
const NOT_STARTED = "未開始";

export const isDone = (status) => DONE.includes(status);
export const isCancelled = (status) => status === CANCELLED;
export const isOpen = (status) => !isDone(status) && !isCancelled(status);

const text = (value) => String(value ?? "").trim();
const list = (value) => (Array.isArray(value) ? value : []);

const CLOCK = /^(\d{1,2}):(\d{2})$/;
const RANGE_MARK = /\s*[～~–-]\s*/;

function parseClock(value) {
  const m = CLOCK.exec(text(value));
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return null;
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function parseClockRange(value) {
  const parts = text(value).split(RANGE_MARK);
  if (parts.length > 2) return null;
  const start = parseClock(parts[0]);
  const end = parts.length === 2 ? parseClock(parts[1]) : "";
  return start && end !== null ? { start, end } : null;
}

function buildLanes(rows) {
  return GROUPS.map((group) => ({
    group,
    rows: list(rows)
      .filter((r) => text(r["組別"]) === group)
      .map((r) => ({
        name: text(r["列名"]),
        areas: text(r["類別"]).split("、").map((a) => a.trim()).filter(Boolean),
      })),
  }));
}

function rowIndexByArea(lane, area) {
  const exact = lane.rows.findIndex((r) => r.areas.includes(area));
  if (exact >= 0) return exact;
  const catchAll = lane.rows.findIndex((r) => r.areas.length === 0);
  return Math.max(catchAll, 0);
}

function rowIndexByName(lane, name) {
  return Math.max(lane.rows.findIndex((r) => r.name === name), 0);
}

function laneOf(lanes, group) {
  return lanes.find((l) => l.group === group) ?? { group, rows: [] };
}

function readTasks(rawTasks, problems) {
  const tasks = [];
  for (const r of rawTasks) {
    const date = parseDay(r["日期"]);
    if (!date) {
      problems.push(`工作大表 序 ${text(r["序"])} 的日期「${text(r["日期"])}」看不懂`);
      continue;
    }
    tasks.push({
      id: Number(r["序"]),
      date,
      group: text(r["組別"]),
      area: text(r["類別"]),
      item: text(r["工作項目"]),
      owner: text(r["負責人"]),
      status: text(r["狀態"]) || NOT_STARTED,
      chartName: text(r["圖上名稱"]),
    });
  }
  return tasks;
}

const TASK_REF = /^序\s*(\d+)$/;

function dayResolver(tasks, milestones) {
  const byChartName = new Map(milestones.map((m) => [m.name, m.date]));
  const byTaskId = new Map(tasks.map((t) => [t.id, t.date]));
  return (value) => {
    const s = text(value);
    if (!s) return null;
    const ref = s.match(TASK_REF);
    return parseDay(s) ?? byChartName.get(s) ?? (ref ? byTaskId.get(Number(ref[1])) : undefined) ?? null;
  };
}

function readCalendar(rawCalendar, resolveDay, problems) {
  const out = { phases: [], weeks: [], holidays: [], goodwill: null, dayNames: {}, marks: [], bigNotes: {} };
  for (const r of rawCalendar) {
    const type = text(r["類型"]);
    const start = resolveDay(r["開始"]);
    const name = text(r["名稱"]);
    const note = text(r["說明"]);
    if (!start) {
      problems.push(`網頁｜日曆 「${name}」的開始「${text(r["開始"])}」看不懂，也不是圖上名稱或序號`);
      continue;
    }
    const end = resolveDay(r["結束"]) ?? start;
    if (type === "階段") out.phases.push({ start, end, name, note });
    else if (type === "週") out.weeks.push({ start, end, name, note });
    else if (type === "連假") out.holidays.push({ start, end, name });
    else if (type === "友好期間") out.goodwill = { start, end };
    else if (type === "節日") out.dayNames[start] = { full: name, short: note || name };
    else if (type === "標記") out.marks.push({ date: start, label: name, icon: note });
    else if (type === "大字補充") out.bigNotes[start] = name;
  }
  return out;
}

function readMilestones(tasks, rawExtra, lanes, problems) {
  const milestones = tasks
    .filter((t) => t.chartName)
    .map((t) => ({
      name: t.chartName,
      group: t.group,
      row: rowIndexByArea(laneOf(lanes, t.group), t.area),
      date: t.date,
      status: t.status,
      taskId: t.id,
    }));
  for (const r of rawExtra) {
    const date = parseDay(r["日期"]);
    const name = text(r["圖上名稱"]);
    if (!date) {
      problems.push(`網頁｜截止點補充 「${name}」的日期「${text(r["日期"])}」看不懂`);
      continue;
    }
    const group = text(r["組別"]);
    milestones.push({
      name,
      group,
      row: rowIndexByName(laneOf(lanes, group), text(r["列名"])),
      date,
      status: text(r["狀態"]) || NOT_STARTED,
      taskId: null,
    });
  }
  return milestones;
}

function readSpans(rawSpans, resolveDay, lanes, problems) {
  const spans = [];
  for (const r of rawSpans) {
    const name = text(r["名稱"]);
    const start = resolveDay(r["開始"]);
    const end = resolveDay(r["結束"]);
    if (!start || !end) {
      const bad = !start ? text(r["開始"]) : text(r["結束"]);
      problems.push(`網頁｜持續工作 「${name}」的${!start ? "開始" : "結束"}「${bad}」看不懂，也不是圖上名稱或序號`);
      continue;
    }
    const group = text(r["組別"]);
    spans.push({ name, group, row: rowIndexByName(laneOf(lanes, group), text(r["列名"])), start, end });
  }
  return spans;
}

function readDeps(rawDeps, milestones, spans, problems) {
  const known = new Set([...milestones, ...spans].map((x) => x.name));
  const deps = [];
  for (const r of rawDeps) {
    const from = text(r["前"]);
    const to = text(r["後"]);
    const missing = [from, to].find((n) => !known.has(n));
    if (missing !== undefined) {
      problems.push(`網頁｜依賴 的「${missing}」找不到對應的圖上名稱或持續工作`);
      continue;
    }
    deps.push({ from, to });
  }
  return deps;
}

export function buildModel(tables = {}) {
  const problems = [];
  const tasks = readTasks(list(tables.tasks), problems);
  const meetingRows = list(tables.meetings);
  const lanes = buildLanes(tables.rows);
  const milestones = readMilestones(tasks, list(tables.extraMilestones), lanes, problems);
  const resolveDay = dayResolver(tasks, milestones);
  const calendar = readCalendar(list(tables.calendar), resolveDay, problems);
  const spans = readSpans(list(tables.spans), resolveDay, lanes, problems);
  const deps = readDeps(list(tables.deps), milestones, spans, problems);

  const meetings = [];
  const smallGroups = [];
  for (const r of meetingRows) {
    const date = parseDay(r["日期"]);
    if (!date) {
      problems.push(`運營會時程 的日期「${text(r["日期"])}」看不懂`);
      continue;
    }
    if (text(r["會議"]) === "各組小組會") smallGroups.push({ date, note: text(r["備註"]) });
    else meetings.push({ date, name: text(r["會議"]), time: text(r["時間"]), place: text(r["場地"]), note: text(r["備註"]) });
  }

  const trackEvents = [];
  for (const r of list(tables.trackEvents)) {
    const date = parseDay(r["日期"]);
    if (!date) {
      problems.push(`網頁｜兩地行程 的日期「${text(r["日期"])}」看不懂`);
      continue;
    }
    const start = parseClock(r["開始"]);
    const end = text(r["結束"]) ? parseClock(r["結束"]) : "";
    if (!start || end === null) {
      const [label, raw] = start ? ["結束", r["結束"]] : ["開始", r["開始"]];
      problems.push(`網頁｜兩地行程「${text(r["內容"])}」的${label}「${text(raw)}」看不懂`);
      continue;
    }
    trackEvents.push({ date, start, end, place: text(r["地點"]), text: text(r["內容"]) });
  }

  const trackMoves = [];
  for (const r of list(tables.trackMoves)) {
    const date = parseDay(r["日期"]);
    if (!date) {
      problems.push(`網頁｜兩地移動 的日期「${text(r["日期"])}」看不懂`);
      continue;
    }
    const range = parseClockRange(r["時間"]);
    if (!range) {
      problems.push(`網頁｜兩地移動「${text(r["誰"])}」的時間「${text(r["時間"])}」看不懂`);
      continue;
    }
    trackMoves.push({ date, time: range.start, end: range.end, from: text(r["從"]), to: text(r["到"]), who: text(r["誰"]), note: text(r["補充"]) });
  }

  return { tasks, meetings, smallGroups, ...calendar, lanes, milestones, spans, deps, trackEvents, trackMoves, problems };
}
