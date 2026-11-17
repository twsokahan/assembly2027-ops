import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildModel } from "../src/model.js";
import { twoSitesSVG, wrap } from "../src/views/twoSites.js";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/data.json", import.meta.url)));
const model = buildModel(structuredClone(fixture.tables));
const count = (s, re) => (s.match(re) ?? []).length;

for (const narrow of [false, true]) {
  test(`兩地時間軸 SVG（${narrow ? "手機" : "寬版"}）：事件、移動、關鍵文字`, () => {
    const svg = twoSitesSVG(model, { narrow });
    assert.equal(count(svg, /class="event"/g), 19);
    assert.equal(count(svg, /class="move-big"/g), 3);
    assert.equal(count(svg, /class="move-small"/g), 4);
    assert.ok(svg.includes("收寢具"));
    assert.ok(svg.includes("第二次彩排"));
    assert.ok(svg.includes("2/28（日）總會"));
  });
}

for (const narrow of [false, true]) {
  test(`兩地移動有結束時間時，時間欄寫開始、下一行寫～結束（${narrow ? "手機" : "寬版"}）`, () => {
    const t = structuredClone(fixture.tables);
    t.trackMoves = t.trackMoves.map((r) => (r["誰"] === "南部守護會抵達" ? { ...r, 時間: "17:00～17:30" } : r));
    const svg = twoSitesSVG(buildModel(t), { narrow });
    assert.ok(svg.includes(">17:00</text>"));
    assert.ok(svg.includes(">～17:30</text>"));
  });
}

test("頁尾註記以這一頁為準", () => {
  const svg = twoSitesSVG(model, {});
  assert.ok(svg.includes("時間以這一頁為準"));
  assert.ok(!svg.includes("規劃文件"));
});

test("wrap 優先在分隔符號換行", () => {
  const lines = wrap("甲乙丙丁戊；己庚辛壬癸子丑寅卯", 10, 80);
  assert.equal(lines[0], "甲乙丙丁戊；");
  assert.equal(lines.join(""), "甲乙丙丁戊；己庚辛壬癸子丑寅卯");
});
