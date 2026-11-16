import test from "node:test";
import assert from "node:assert/strict";
import { ApiError, refresh, storage } from "../src/api.js";

function memoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    get: (key) => map.get(key) ?? null,
    set: (key, value) => (value == null ? map.delete(key) : map.set(key, value)),
  };
}

const oldData = { fetchedAt: "2026-11-21T09:00:00+08:00", tables: { tasks: [] } };
const newData = { fetchedAt: "2026-11-21T10:05:00+08:00", tables: { tasks: [{ 序: "1" }] } };

test("refresh: 成功就回 fresh 並寫入 ops.data", async () => {
  const store = memoryStorage({ "ops.token": "t" });
  const result = await refresh(store, async () => newData);
  assert.equal(result.status, "fresh");
  assert.deepEqual(result.data, newData);
  assert.deepEqual(store.get("ops.data"), newData);
});

test("refresh: 沒有 token 回 login，舊資料保留", async () => {
  const store = memoryStorage({ "ops.data": oldData });
  const result = await refresh(store, async () => assert.fail("不該呼叫"));
  assert.equal(result.status, "login");
  assert.deepEqual(store.get("ops.data"), oldData);
});

test("refresh: not_allowed 清掉 token 與 data，回 email", async () => {
  const store = memoryStorage({ "ops.token": "t", "ops.data": oldData });
  const result = await refresh(store, async () => {
    throw new ApiError("not_allowed", "a@example.com");
  });
  assert.equal(result.status, "not_allowed");
  assert.equal(result.email, "a@example.com");
  assert.equal(store.get("ops.token"), null);
  assert.equal(store.get("ops.data"), null);
});

test("refresh: expired 只清 token，回 login，data 留著", async () => {
  const store = memoryStorage({ "ops.token": "t", "ops.data": oldData });
  const result = await refresh(store, async () => {
    throw new ApiError("expired");
  });
  assert.equal(result.status, "login");
  assert.equal(store.get("ops.token"), null);
  assert.deepEqual(store.get("ops.data"), oldData);
});

test("refresh: 網路錯誤且有舊資料回 offline", async () => {
  const store = memoryStorage({ "ops.token": "t", "ops.data": oldData });
  const result = await refresh(store, async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.equal(result.status, "offline");
  assert.deepEqual(result.data, oldData);
  assert.equal(store.get("ops.token"), "t");
});

test("refresh: server_error 且有舊資料回 offline", async () => {
  const store = memoryStorage({ "ops.token": "t", "ops.data": oldData });
  const result = await refresh(store, async () => {
    throw new ApiError("server_error");
  });
  assert.equal(result.status, "offline");
});

test("refresh: 連不上又沒有舊資料回 error", async () => {
  const store = memoryStorage({ "ops.token": "t" });
  const result = await refresh(store, async () => {
    throw new TypeError("Failed to fetch");
  });
  assert.equal(result.status, "error");
  assert.equal(result.data, null);
});

test("storage: localStorage 會丟錯時 get 回 null、set 不丟錯", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("denied");
    },
  });
  try {
    assert.equal(storage.get("ops.token"), null);
    assert.doesNotThrow(() => storage.set("ops.token", "x"));
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

test("storage: JSON 物件可以來回存取", () => {
  const map = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (k) => map.get(k) ?? null,
      setItem: (k, v) => map.set(k, v),
      removeItem: (k) => map.delete(k),
    },
  });
  try {
    storage.set("ops.data", newData);
    assert.deepEqual(storage.get("ops.data"), newData);
    storage.set("ops.data", null);
    assert.equal(storage.get("ops.data"), null);
  } finally {
    delete globalThis.localStorage;
  }
});
