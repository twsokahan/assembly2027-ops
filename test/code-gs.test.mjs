import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHmac } from "node:crypto";
import vm from "node:vm";

const source = readFileSync(new URL("../apps-script/Code.gs", import.meta.url), "utf8");

const CLIENT_ID = "client-id.apps.googleusercontent.com";

function person(email) {
  return { getEmail: () => email };
}

function sharable({ owner, editors = [], viewers = [], parents = [] }) {
  return {
    getOwner: () => (owner ? person(owner) : null),
    getEditors: () => editors.map(person),
    getViewers: () => viewers.map(person),
    getParents: () => {
      let index = 0;
      return { hasNext: () => index < parents.length, next: () => parents[index++] };
    },
  };
}

function sheetOf(values) {
  return { getDataRange: () => ({ getDisplayValues: () => values }) };
}

function createGs({ file = sharable({ owner: "owner@x.com", editors: ["Editor@X.com"] }), sheets = {}, tokenInfo, calls = {} } = {}) {
  const cache = new Map();
  const gs = vm.createContext({
    console: { error() {} },
    CacheService: {
      getScriptCache: () => ({
        get: (key) => (cache.has(key) ? cache.get(key) : null),
        put: (key, value) => { calls.cachePuts = (calls.cachePuts || 0) + 1; cache.set(key, value); },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (key) => ({ CLIENT_ID, TOKEN_SECRET: "secret" })[key] ?? null,
        setProperty() {},
      }),
    },
    Utilities: {
      Charset: { UTF_8: "UTF_8" },
      base64EncodeWebSafe: (input) => Buffer.from(input).toString("base64url"),
      base64DecodeWebSafe: (text) => [...Buffer.from(text, "base64url")],
      computeHmacSha256Signature: (payload, secret) => [...createHmac("sha256", secret).update(payload).digest()],
      newBlob: (bytes) => ({ getDataAsString: () => Buffer.from(bytes).toString("utf8") }),
      getUuid: () => "uuid",
      formatDate: () => "2026-11-21T10:05:00+08:00",
    },
    UrlFetchApp: {
      fetch: () => ({
        getResponseCode: () => (tokenInfo ? 200 : 400),
        getContentText: () => JSON.stringify(tokenInfo),
      }),
    },
    SpreadsheetApp: {
      getActive: () => ({
        getId: () => "sheet-id",
        getSheetByName: (name) => (sheets[name] ? sheetOf(sheets[name]) : null),
      }),
    },
    DriveApp: { getFileById: () => file },
    ContentService: {
      MimeType: { JSON: "JSON" },
      createTextOutput: (text) => ({ text, setMimeType() { return this; }, getContent() { return text; } }),
    },
  });
  vm.runInContext(source, gs);
  return gs;
}

function withNow(gs, now) {
  vm.runInContext(`Date.now = () => ${now};`, gs);
}

const plain = (value) => JSON.parse(JSON.stringify(value));

const validInfo = { aud: CLIENT_ID, email_verified: "true", email: "Editor@X.com", name: "E", exp: String(Date.now() / 1000 + 3600) };

test("pickColumns picks by header name, drops empty rows and missing columns", () => {
  const gs = createGs();
  const values = [["序", "日期", "狀態", "前置"], ["1", "2026/11/15", "完成", "x"], ["", "", "", ""]];
  assert.deepEqual(JSON.parse(JSON.stringify(gs.pickColumns(values, ["日期", "序", "圖上名稱"]))), [{ 日期: "2026/11/15", 序: "1" }]);
});

test("pickColumns returns an empty list for an empty sheet", () => {
  assert.deepEqual(plain(createGs().pickColumns([], ["序"])), []);
});

test("readTable returns an empty list when the tab is missing", () => {
  assert.deepEqual(plain(createGs().readTable("不存在", ["序"])), []);
});

test("token round-trips, rejects tampering and expiry", () => {
  const gs = createGs();
  const token = gs.issueToken({ email: "a@x.com", name: "A" });
  assert.equal(gs.readToken(token)?.email, "a@x.com");
  const last = token.slice(-1) === "A" ? "B" : "A";
  assert.equal(gs.readToken(token.slice(0, -1) + last), null);
  withNow(gs, Date.now() + 31 * 86400000);
  assert.equal(gs.readToken(token), null);
});

test("allowedEmails collects owner, editors, viewers of file and every ancestor folder, lowercased", () => {
  const root = sharable({ owner: "Root@x.com", viewers: ["v2@x.com"] });
  const folder = sharable({ owner: "folder@x.com", editors: ["E2@x.com"], parents: [root] });
  const file = sharable({ owner: "Owner@x.com", editors: ["editor@x.com", "EDITOR@x.com"], viewers: ["viewer@x.com"], parents: [folder] });
  const gs = createGs({ file });
  assert.deepEqual([...gs.allowedEmails()].sort(),
    ["e2@x.com", "editor@x.com", "folder@x.com", "owner@x.com", "root@x.com", "v2@x.com", "viewer@x.com"]);
});

test("data rejects a valid token whose email is not on the sharing list", () => {
  const gs = createGs();
  const token = gs.issueToken({ email: "a@x.com", name: "A" });
  assert.deepEqual(JSON.parse(JSON.stringify(gs.data({ token }))), { ok: false, error: "not_allowed", email: "a@x.com" });
});

test("data rejects an expired token", () => {
  const gs = createGs();
  const token = gs.issueToken({ email: "editor@x.com", name: "E" });
  withNow(gs, Date.now() + 31 * 86400000);
  assert.deepEqual(JSON.parse(JSON.stringify(gs.data({ token }))), { ok: false, error: "expired" });
});

test("data returns every table with picked columns and fetchedAt", () => {
  const gs = createGs({ sheets: { 運營會時程: [["日期", "會議", "備註2"], ["2026/11/17", "運營會", "x"]] } });
  const token = gs.issueToken({ email: "editor@x.com", name: "E" });
  const result = JSON.parse(JSON.stringify(gs.data({ token })));
  assert.equal(result.ok, true);
  assert.equal(result.fetchedAt, "2026-11-21T10:05:00+08:00");
  assert.deepEqual(result.tables.meetings, [{ 日期: "2026/11/17", 會議: "運營會" }]);
  assert.deepEqual(result.tables.tasks, []);
  assert.deepEqual(Object.keys(result.tables).sort(), Object.keys(vm.runInContext("TABLES", gs)).sort());
});

test("data caches the response for repeat calls", () => {
  const calls = {};
  const gs = createGs({ calls });
  const token = gs.issueToken({ email: "editor@x.com", name: "E" });
  gs.data({ token });
  const putsAfterFirst = calls.cachePuts;
  gs.data({ token });
  assert.equal(calls.cachePuts, putsAfterFirst);
});

test("login rejects a token for another client id", () => {
  const gs = createGs({ tokenInfo: { ...validInfo, aud: "other" } });
  assert.deepEqual(JSON.parse(JSON.stringify(gs.login({ idToken: "t" }))), { ok: false, error: "invalid_login" });
});

test("login rejects an unverified email", () => {
  const gs = createGs({ tokenInfo: { ...validInfo, email_verified: "false" } });
  assert.deepEqual(JSON.parse(JSON.stringify(gs.login({ idToken: "t" }))), { ok: false, error: "invalid_login" });
});

test("login rejects an email outside the sharing list", () => {
  const gs = createGs({ tokenInfo: { ...validInfo, email: "Stranger@x.com" } });
  assert.deepEqual(JSON.parse(JSON.stringify(gs.login({ idToken: "t" }))), { ok: false, error: "not_allowed", email: "stranger@x.com" });
});

test("login issues a token for an allowed email", () => {
  const gs = createGs({ tokenInfo: validInfo });
  const result = gs.login({ idToken: "t" });
  assert.equal(result.ok, true);
  assert.equal(result.email, "editor@x.com");
  assert.equal(gs.readToken(result.token).email, "editor@x.com");
});

test("doPost answers bad_request for malformed bodies and unknown actions", () => {
  const gs = createGs();
  const call = (contents) => JSON.parse(gs.doPost({ postData: { contents } }).getContent());
  assert.deepEqual(call("not json"), { ok: false, error: "bad_request" });
  assert.deepEqual(call(JSON.stringify({ action: "nope" })), { ok: false, error: "bad_request" });
});
