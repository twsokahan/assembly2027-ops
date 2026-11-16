import test from "node:test";
import assert from "node:assert/strict";
import { parseDay, fmt, fmtShort, addDays, daysBetween, weekdayIndex, todayInTaipei } from "../src/dates.js";

test("parseDay", () => {
  assert.equal(parseDay("2026/11/21"), "2026-11-21");
  assert.equal(parseDay("2026-11-21"), "2026-11-21");
  assert.equal(parseDay("2026/1/9"), "2026-01-09");
  assert.equal(parseDay("11/21"), "2026-11-21");
  assert.equal(parseDay("2/28"), "2027-02-28");
  assert.equal(parseDay("12月5日"), null);
  assert.equal(parseDay(""), null);
});

test("parseDay rejects impossible dates", () => {
  assert.equal(parseDay("2/30"), null);
  assert.equal(parseDay("13/1"), null);
});

test("fmt and fmtShort", () => {
  assert.equal(fmt("2026-11-21"), "11/21（六）");
  assert.equal(fmtShort("2026-11-21"), "11/21");
});

test("day arithmetic", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2027-03-01", -1), "2027-02-28");
  assert.equal(daysBetween("2026-11-21", "2027-02-28"), 99);
  assert.equal(weekdayIndex("2026-11-17"), 1);
  assert.equal(weekdayIndex("2026-11-22"), 6);
});

test("todayInTaipei", () => {
  assert.equal(todayInTaipei(new Date("2026-11-20T16:30:00Z")), "2026-11-21");
  assert.equal(todayInTaipei(new Date("2026-11-20T15:59:00Z")), "2026-11-20");
});
