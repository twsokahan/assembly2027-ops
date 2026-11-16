import test from "node:test";
import assert from "node:assert/strict";
import { statusLine } from "../src/status.js";

const at = "2026-11-21T10:05:00+08:00";

test("暫存資料更新中要標示上次更新", () => {
  assert.deepEqual(statusLine("refreshing", at), { text: "上次更新 10:05，更新中…", alert: false });
});

test("讀到新資料顯示更新於", () => {
  assert.deepEqual(statusLine("fresh", at), { text: "更新於 10:05", alert: false });
});

test("連不上要明顯標示", () => {
  assert.deepEqual(statusLine("offline", at), { text: "連不上，顯示的是 10:05 的資料", alert: true });
});
