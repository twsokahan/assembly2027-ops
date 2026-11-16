import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildModel } from "../src/model.js";
import { weekView, allocate, shortItem, shortOwner } from "../src/week.js";
import { render } from "../src/views/week.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/data.json", import.meta.url)));
const model = (mutate) => {
  const tables = structuredClone(fixture.tables);
  mutate?.(tables);
  return buildModel(tables);
};
const counts = (v, key) => Object.fromEntries(v.groups.map((g) => [g.group, g[key].length]));

test("11/21：下次開會與各組到期數", () => {
  const v = weekView(model(), "2026-11-21");
  assert.equal(v.nextMeeting.name, "運營會（二）");
  assert.equal(v.windowEnd, "2026-11-28");
  assert.deepEqual(counts(v, "due"), { 運營本部: 3, 前導組: 5, 活動組: 1, 總務組: 1 });
  assert.deepEqual(counts(v, "late"), { 運營本部: 0, 前導組: 6, 活動組: 0, 總務組: 0 });
  assert.deepEqual(v.phase, { index: 0, label: "① 定案" });
  assert.equal(v.daysLeft, 99);
});

test("12/19：跳過停會", () => {
  const v = weekView(model(), "2026-12-19");
  assert.equal(v.nextMeeting.date, "2027-01-09");
  assert.equal(v.nextMeeting.name, "運營會（六）");
  assert.deepEqual(counts(v, "due"), { 運營本部: 0, 前導組: 4, 活動組: 3, 總務組: 1 });
});

test("3/14：沒有下次開會就看七天", () => {
  const v = weekView(model(), "2027-03-14");
  assert.equal(v.nextMeeting, null);
  assert.equal(v.windowEnd, "2027-03-21");
  assert.deepEqual(counts(v, "due"), { 運營本部: 0, 前導組: 0, 活動組: 0, 總務組: 0 });
});

test("取消不列入；不認得的狀態算還沒做完", () => {
  const first = weekView(model(), "2026-11-21").groups[1].due[0];
  const cancelled = weekView(model((t) => { t.tasks.find((r) => Number(r["序"]) === first.id)["狀態"] = "取消"; }), "2026-11-21");
  assert.equal(cancelled.groups[1].due.length, 4);
  const odd = weekView(model((t) => { t.tasks.find((r) => Number(r["序"]) === first.id)["狀態"] = "自己亂打"; }), first.date);
  assert.ok(odd.groups[1].late.some((t) => t.id === first.id));
});

test("allocate", () => {
  assert.deepEqual(allocate({ 運營本部: 1, 前導組: 9, 活動組: 2, 總務組: 3 }, 9), { 運營本部: 1, 前導組: 4, 活動組: 2, 總務組: 2 });
  const small = { 運營本部: 0, 前導組: 3, 活動組: 0, 總務組: 1 };
  assert.deepEqual(allocate(small, 9), small);
});

test("shortItem / shortOwner", () => {
  assert.equal(shortItem("收費級距定案（只參加總會／交流不住宿／交流住宿／春訓）"), "收費級距定案");
  const keep = "報名表欄位、收費級距草案、開放與截止日期";
  assert.equal(shortItem(keep), keep);
  assert.equal(shortOwner("負責人A（暫）"), "負責人A");
  assert.equal(shortOwner("待定（找人）"), "待定");
});

const html = (ctx) => {
  const container = {};
  render(container, model(), { today: "2026-11-21", wide: false, group: null, setGroup() {}, ...ctx });
  return container.innerHTML;
};

test("render：組別篩選與到期未完成標籤", () => {
  const one = html({ group: "前導組" });
  assert.ok(one.includes("前導組"));
  assert.ok(!one.includes("活動組</b>") && !one.includes("</i>活動組"));
  assert.ok(one.includes("到期未完成 6"));
  const all = html({ group: null });
  for (const g of ["運營本部", "前導組", "活動組", "總務組"]) assert.ok(all.includes(`</i>${g}`), g);
});

test("render：試算表文字會被跳脫", () => {
  const container = {};
  const m = model((t) => { t.tasks[1]["工作項目"] = '<img src=x onerror="alert(1)">'; });
  render(container, m, { today: "2026-11-19", wide: false, group: null, setGroup() {} });
  assert.ok(!container.innerHTML.includes("<img"));
});

test("備註寫「停」的小組會會被跳過", () => {
  const m = model();
  const next = weekView(m, "2026-11-21").nextSmallGroup;
  const stopped = model((t) => {
    const row = t.meetings.find((r) => r["會議"] === "各組小組會" && r["備註"] === next.note && String(r["日期"]).includes("11/24"));
    row["備註"] = "停一次";
  });
  assert.equal(weekView(m, "2026-11-21").nextSmallGroup.date, "2026-11-24");
  assert.equal(weekView(stopped, "2026-11-21").nextSmallGroup.date, "2026-12-01");
});
