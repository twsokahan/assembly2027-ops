import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildModel } from "../src/model.js";
import { calendarEvents, calendarWeeksSVG, calendarMonthsSVG } from "../src/views/calendar.js";
import { DARK } from "../src/theme.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/data.json", import.meta.url)));
const model = (mutate) => {
  const tables = structuredClone(fixture.tables);
  mutate?.(tables);
  return buildModel(tables);
};
const count = (s, needle) => s.split(needle).length - 1;

test("大字、停會與標記", () => {
  const ev = calendarEvents(model());
  assert.deepEqual(ev["2027-01-23"].big, ["第一次", "沙推", DARK]);
  assert.deepEqual(ev["2027-02-28"].big.slice(0, 2), ["13:00", "總會"]);
  assert.deepEqual(ev["2026-12-26"].marks, [["stop", "停會"]]);
  assert.deepEqual(ev["2027-02-02"].marks, [["stop", "小組會停"]]);
  assert.deepEqual(ev["2026-11-20"].marks, [["group", "前導組會議"]]);
  assert.deepEqual(ev["2026-11-21"].marks, [["meeting", "運營會（一）"]]);
});

test("正式舉辦大字上方用該會的時間欄", () => {
  const ev = calendarEvents(model((t) => {
    t.meetings.find((r) => r["會議"] === "正式舉辦")["時間"] = "12:30";
  }));
  assert.equal(ev["2027-02-28"].big[0], "12:30");
});

test("各組小組會備註含「停」也算小組會停", () => {
  const ev = calendarEvents(model((t) => {
    t.meetings.find((r) => r["日期"] === "2026/12/1")["備註"] = "當週停";
  }));
  assert.deepEqual(ev["2026-12-01"].marks, [["stop", "小組會停"]]);
});

test("連續週曆：17 週、一個今天、連假斜線", () => {
  const svg = calendarWeeksSVG(model(), "2026-11-21");
  assert.equal(count(svg, 'class="week-row"'), 17);
  assert.equal(count(svg, 'class="today"'), 1);
  assert.ok(count(svg, 'fill="url(#hatch)"') >= 3);
});

test("月份格子：5 個月份", () => {
  const svg = calendarMonthsSVG(model(), "2026-11-21");
  assert.equal(count(svg, 'class="month"'), 5);
  assert.equal(count(svg, 'class="today"'), 1);
});

test("今天不在月曆範圍內就不畫外框", () => {
  for (const today of ["2026-11-14", "2027-03-14"]) {
    assert.equal(count(calendarWeeksSVG(model(), today), 'class="today"'), 0);
    assert.equal(count(calendarMonthsSVG(model(), today), 'class="today"'), 0);
  }
});
