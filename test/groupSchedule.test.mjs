import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildModel } from "../src/model.js";
import { groupScheduleSVG, groupScheduleList, renderInto } from "../src/views/groupSchedule.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/data.json", import.meta.url)));
const model = (mutate) => {
  const tables = structuredClone(fixture.tables);
  mutate?.(tables);
  return buildModel(tables);
};
const count = (s, re) => (s.match(re) ?? []).length;

test("各組時程 SVG：截止點、持續工作、依賴、今天線", () => {
  const svg = groupScheduleSVG(model(), "2026-11-21");
  assert.equal(count(svg, /class="milestone[ "]/g), 40);
  assert.equal(count(svg, /class="span"/g), 8);
  assert.equal(count(svg, /class="dep"/g), 12);
  assert.equal(count(svg, /class="today-line"/g), 1);
  assert.ok(svg.includes("報名截止"));
  assert.ok(!svg.includes("泳道"));
});

test("完成的截止點淡化加勾，取消的加刪除線", () => {
  const m = model();
  const base = groupScheduleSVG(m, "2026-11-21");
  assert.equal(count(base, /class="milestone done"/g), 0);
  const svg = groupScheduleSVG(model((t) => {
    t.tasks.find((r) => r["圖上名稱"] === "報名截止")["狀態"] = "完成";
    t.tasks.find((r) => r["圖上名稱"] === "詢價")["狀態"] = "取消";
  }), "2026-11-21");
  assert.equal(count(svg, /class="milestone done"/g), 1);
  assert.equal(count(svg, /class="milestone cancelled"/g), 1);
  assert.ok(svg.includes("line-through"));
});

test("手機清單：四個分組，前導組日期由小到大，依賴有「要先有：」", () => {
  const html = groupScheduleList(model(), "2026-11-21");
  const sections = html.split("<section").slice(1);
  assert.equal(sections.length, 4);
  ["運營本部", "前導組", "活動組", "總務組"].forEach((g, i) => assert.ok(sections[i].includes(g)));
  const days = [...sections[1].matchAll(/data-day="([\d-]+)"/g)].map((x) => x[1]);
  assert.ok(days.length > 1);
  assert.deepEqual(days, [...days].sort());
  assert.ok(html.includes("要先有："));
});

test("依賴引用不存在的名稱時頁尾列出資料問題", () => {
  const m = model((t) => t.deps.push({ 前: "不存在的項目", 後: "詢價" }));
  const box = { innerHTML: "" };
  renderInto(box, m, { today: "2026-11-21", wide: false });
  assert.ok(box.innerHTML.includes("資料問題"));
  const clean = { innerHTML: "" };
  renderInto(clean, model(), { today: "2026-11-21", wide: true });
  assert.ok(!clean.innerHTML.includes("資料問題"));
});
