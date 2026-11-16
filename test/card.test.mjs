import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildModel } from "../src/model.js";
import { weekView } from "../src/week.js";
import { cardLayout, fitText, updatedNote } from "../src/card.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/data.json", import.meta.url)));
const model = (mutate) => {
  const tables = structuredClone(fixture.tables);
  mutate?.(tables);
  return buildModel(tables);
};
const shape = (layout) => layout.sections.map((s) => [s.group, s.rows.length, s.more]);

test("11/21：各組列數與「還有 k 項」", () => {
  const layout = cardLayout(weekView(model(), "2026-11-21"));
  assert.deepEqual(shape(layout), [["運營本部", 3, 0], ["前導組", 3, 2], ["活動組", 1, 0], ["總務組", 1, 0]]);
  assert.deepEqual(layout.sections.map((s) => s.lateCount), [0, 6, 0, 0]);
});

test("所有區塊的列數（含「還有」那一行）不超過 9", () => {
  for (const day of ["2026-11-21", "2026-12-05", "2026-12-19", "2027-01-16", "2027-02-13"]) {
    const layout = cardLayout(weekView(model(), day));
    const total = layout.sections.reduce((sum, s) => sum + s.rows.length + (s.more > 0 ? 1 : 0), 0);
    assert.ok(total <= 9, `${day}: ${total}`);
  }
});

test("平手時第 9 列給 GROUPS 順序較前的組", () => {
  const layout = cardLayout(weekView(model(), "2026-11-21"));
  assert.equal(layout.sections[0].rows.length, 3);
  assert.equal(layout.sections[1].rows.length, 3);
});

test("fitText：超寬截斷並以「…」結尾，放得下原樣返回", () => {
  const measure = (s) => s.length * 10;
  assert.equal(fitText(measure, "一二三四五六", 45), "一二三…");
  assert.equal(fitText(measure, "一二三", 45), "一二三");
});

test("updatedNote：UTC 時間換成台北時間顯示", () => {
  assert.equal(updatedNote("2026-11-16T21:05:00+08:00"), "狀態取自追蹤大表（11/16 21:05 更新）");
  assert.equal(updatedNote("2026-11-16T23:30:00Z"), "狀態取自追蹤大表（11/17 07:30 更新）");
});
