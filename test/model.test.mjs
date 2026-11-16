import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildModel, isDone, isCancelled, isOpen } from "../src/model.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/data.json", import.meta.url)));
const clone = () => structuredClone(fixture.tables);

test("fixture 建出完整 model", () => {
  const m = buildModel(fixture.tables);
  assert.equal(m.tasks.length, 137);
  assert.equal(m.phases.length, 7);
  assert.equal(m.weeks.length, 17);
  assert.equal(m.holidays.length, 4);
  assert.deepEqual(m.goodwill, { start: "2027-01-31", end: "2027-02-13" });
  assert.deepEqual(m.lanes.map((l) => l.rows.length), [1, 3, 1, 2]);
  assert.deepEqual(m.lanes.map((l) => l.group), ["運營本部", "前導組", "活動組", "總務組"]);
  assert.equal(m.milestones.length, 40);
  assert.equal(m.deps.length, 12);
  assert.equal(m.spans.length, 8);
  assert.deepEqual(m.problems, []);
});

test("fixture 的標記與持續工作從工作大表取日期", () => {
  const m = buildModel(fixture.tables);
  const markDate = Object.fromEntries(m.marks.map((x) => [x.label, x.date]));
  assert.equal(markDate["報名開放"], "2026-12-14");
  assert.equal(markDate["交流名單截止"], "2027-01-17");
  assert.equal(markDate["報名截止"], "2027-01-26");
  assert.equal(markDate["高鐵開賣"], "2027-01-29");
  assert.equal(markDate["異動截止"], "2027-02-22");
  const spanStart = Object.fromEntries(m.spans.map((x) => [x.name, x.start]));
  assert.equal(spanStart["工作人員招募"], "2026-12-12");
  assert.equal(spanStart["報名"], "2026-12-14");
  assert.equal(spanStart["布展"], "2027-02-25");
  assert.equal(spanStart["紀念品 下單→到貨"], "2026-11-30");
  assert.equal(spanStart["遊覽車預訂"], "2026-12-14");
});

test("milestone 帶組別、列、日期", () => {
  const m = buildModel(fixture.tables);
  const ms = m.milestones.find((x) => x.name === "報名截止");
  assert.equal(ms.group, "前導組");
  assert.equal(ms.row, 0);
  assert.equal(ms.date, "2027-01-26");
  assert.equal(typeof ms.taskId, "number");
});

test("日期看不懂的 task 被略過並回報", () => {
  const t = clone();
  t.tasks.push({ 序: "999", 日期: "十二月", 組別: "前導組", 類別: "報名", 工作項目: "x", 負責人: "", 狀態: "", 圖上名稱: "" });
  const m = buildModel(t);
  assert.equal(m.tasks.length, 137);
  assert.ok(m.problems.some((p) => p.includes("序") && p.includes("十二月")));
});

test("空白狀態視為未開始", () => {
  const t = clone();
  t.tasks.push({ 序: "999", 日期: "2026/12/1", 組別: "前導組", 類別: "報名", 工作項目: "x", 負責人: "", 狀態: "", 圖上名稱: "" });
  assert.equal(buildModel(t).tasks.at(-1).status, "未開始");
});

test("依賴指向不存在的名稱會被略過並回報", () => {
  const t = clone();
  t.deps.push({ 前: "不存在的事", 後: "報名截止" });
  const m = buildModel(t);
  assert.equal(m.deps.length, 12);
  assert.ok(m.problems.some((p) => p.includes("不存在的事")));
});

test("依賴可以指向持續工作的名稱", () => {
  const t = clone();
  t.deps.push({ 前: "展板", 後: "報名截止" });
  assert.equal(buildModel(t).deps.length, 13);
});

test("span 端點是無法解析的名稱時略過並回報", () => {
  const t = clone();
  t.spans.push({ 名稱: "壞的", 組別: "前導組", 列名: "報名", 開始: "不存在的事", 結束: "2027/1/26" });
  const m = buildModel(t);
  assert.equal(m.spans.length, 8);
  assert.ok(m.problems.some((p) => p.includes("不存在的事")));
});

test("span 端點可以是圖上名稱", () => {
  const t = clone();
  t.spans.push({ 名稱: "新的", 組別: "前導組", 列名: "報名", 開始: "2026/12/14", 結束: "報名截止" });
  const s = buildModel(t).spans.find((x) => x.name === "新的");
  assert.equal(s.end, "2027-01-26");
  assert.equal(s.row, 0);
});

test("span 端點可以寫「序 N」引用工作大表", () => {
  const t = clone();
  t.spans.push({ 名稱: "新的", 組別: "前導組", 列名: "報名", 開始: "序 40", 結束: "序40" });
  const s = buildModel(t).spans.find((x) => x.name === "新的");
  assert.equal(s.start, "2026-12-14");
  assert.equal(s.end, "2026-12-14");
});

test("日曆的開始可以寫圖上名稱或「序 N」", () => {
  const t = clone();
  t.calendar.push(
    { 類型: "標記", 開始: "報名截止", 結束: "", 名稱: "名稱引用", 說明: "報名" },
    { 類型: "標記", 開始: "序 40", 結束: "", 名稱: "序號引用", 說明: "報名" },
  );
  const m = buildModel(t);
  assert.equal(m.marks.find((x) => x.label === "名稱引用").date, "2027-01-26");
  assert.equal(m.marks.find((x) => x.label === "序號引用").date, "2026-12-14");
  assert.deepEqual(m.problems, []);
});

test("空白的結束不會對到沒有名稱的截止點補充", () => {
  const t = clone();
  t.extraMilestones.push({ 圖上名稱: "", 組別: "前導組", 列名: "報名", 日期: "2027/1/10", 狀態: "" });
  t.calendar.push({ 類型: "連假", 開始: "2027/2/1", 結束: "", 名稱: "一天連假", 說明: "" });
  const h = buildModel(t).holidays.find((x) => x.name === "一天連假");
  assert.equal(h.end, "2027-02-01");
});

test("日曆的開始找不到對應時略過並回報", () => {
  const t = clone();
  t.calendar.push({ 類型: "標記", 開始: "序 999", 結束: "", 名稱: "壞的", 說明: "" });
  const m = buildModel(t);
  assert.ok(!m.marks.some((x) => x.label === "壞的"));
  assert.ok(m.problems.some((p) => p.includes("序 999")));
});

test("截止點補充用列名找列並補成 milestone", () => {
  const t = clone();
  t.extraMilestones.push({ 圖上名稱: "補的點", 組別: "前導組", 列名: "導覽・展板", 日期: "2027/1/10", 狀態: "完成" });
  const m = buildModel(t);
  const ms = m.milestones.find((x) => x.name === "補的點");
  assert.equal(ms.row, 2);
  assert.equal(ms.date, "2027-01-10");
  assert.equal(ms.status, "完成");
  assert.equal(ms.taskId, null);
  assert.deepEqual(m.problems, []);
});

test("缺的 key 不丟錯", () => {
  const m = buildModel({ tasks: [], meetings: [] });
  for (const k of ["tasks", "meetings", "smallGroups", "phases", "weeks", "holidays", "marks", "milestones", "spans", "deps", "trackEvents", "trackMoves", "problems"]) {
    assert.deepEqual(m[k], [], k);
  }
  assert.equal(m.goodwill, null);
  assert.deepEqual(m.dayNames, {});
  assert.deepEqual(m.bigNotes, {});
});

test("小組會與其他會議分開", () => {
  const m = buildModel(fixture.tables);
  assert.ok(m.smallGroups.length > 0);
  assert.ok(m.meetings.every((x) => x.name !== "各組小組會"));
});

test("節日、標記、大字補充", () => {
  const t = { calendar: [
    { 類型: "節日", 開始: "2027/1/1", 名稱: "元旦", 說明: "" },
    { 類型: "節日", 開始: "2026/12/25", 名稱: "行憲紀念日", 說明: "行憲" },
    { 類型: "標記", 開始: "2027/1/26", 名稱: "報名截止", 說明: "報名" },
    { 類型: "大字補充", 開始: "2027/2/27", 名稱: "＋大溪交流 18:00" },
  ] };
  const m = buildModel(t);
  assert.deepEqual(m.dayNames["2027-01-01"], { full: "元旦", short: "元旦" });
  assert.deepEqual(m.dayNames["2026-12-25"], { full: "行憲紀念日", short: "行憲" });
  assert.deepEqual(m.marks, [{ date: "2027-01-26", label: "報名截止", icon: "報名" }]);
  assert.equal(m.bigNotes["2027-02-27"], "＋大溪交流 18:00");
});

test("isDone / isCancelled / isOpen", () => {
  assert.equal(isOpen("待決"), true);
  assert.equal(isOpen("取消"), false);
  assert.equal(isOpen("已定"), false);
  assert.equal(isOpen("完成"), false);
  assert.equal(isOpen("自己亂打"), true);
  assert.equal(isOpen(""), true);
  assert.equal(isDone("已定"), true);
  assert.equal(isCancelled("取消"), true);
});
