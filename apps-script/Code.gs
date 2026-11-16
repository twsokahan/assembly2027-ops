// Backend for the live 2027 assembly operations view. Paste into the Apps Script editor bound to the
// tracking spreadsheet. Script properties: CLIENT_ID (OAuth web client ID) and TOKEN_SECRET (created by
// setup()). Nothing secret lives in this file; access follows the spreadsheet's sharing list.

const TOKEN_DAYS = 30;
const ALLOWED_CACHE_SECONDS = 300;
const DATA_CACHE_SECONDS = 60;
const DATA_CACHE_MAX_BYTES = 90 * 1024;

const TABLES = {
  tasks: { sheet: "工作大表", columns: ["序", "日期", "組別", "類別", "工作項目", "負責人", "狀態", "圖上名稱"] },
  meetings: { sheet: "運營會時程", columns: ["日期", "會議", "時間", "場地", "備註"] },
  calendar: { sheet: "網頁｜日曆", columns: ["類型", "開始", "結束", "名稱", "說明"] },
  rows: { sheet: "網頁｜分列", columns: ["組別", "列名", "類別"] },
  spans: { sheet: "網頁｜持續工作", columns: ["名稱", "組別", "列名", "開始", "結束"] },
  deps: { sheet: "網頁｜依賴", columns: ["前", "後"] },
  extraMilestones: { sheet: "網頁｜截止點補充", columns: ["圖上名稱", "組別", "列名", "日期", "狀態"] },
  trackEvents: { sheet: "網頁｜兩地行程", columns: ["日期", "開始", "結束", "地點", "內容"] },
  trackMoves: { sheet: "網頁｜兩地移動", columns: ["日期", "時間", "從", "到", "誰", "補充"] },
};

function setup() {
  const props = PropertiesService.getScriptProperties();
  if (!props.getProperty("TOKEN_SECRET")) props.setProperty("TOKEN_SECRET", Utilities.getUuid() + Utilities.getUuid());
}

function doGet() {
  return json({ ok: true, service: "assembly2027-ops" });
}

function doPost(e) {
  let body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: "bad_request" });
  }
  try {
    switch (body.action) {
      case "login": return json(login(body));
      case "data": return json(data(body));
      default: return json({ ok: false, error: "bad_request" });
    }
  } catch (err) {
    console.error(err);
    return json({ ok: false, error: "server_error" });
  }
}

function json(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function login({ idToken }) {
  if (typeof idToken !== "string" || !idToken) return { ok: false, error: "invalid_login" };
  const response = UrlFetchApp.fetch(
    "https://oauth2.googleapis.com/tokeninfo?id_token=" + encodeURIComponent(idToken), { muteHttpExceptions: true });
  if (response.getResponseCode() !== 200) return { ok: false, error: "invalid_login" };
  const info = JSON.parse(response.getContentText());
  const clientId = PropertiesService.getScriptProperties().getProperty("CLIENT_ID");
  if (info.aud !== clientId || info.email_verified !== "true" || Number(info.exp) * 1000 < Date.now()) {
    return { ok: false, error: "invalid_login" };
  }
  const email = normalizeEmail(info.email);
  if (!allowedEmails().includes(email)) return { ok: false, error: "not_allowed", email };
  const name = info.name || email;
  return { ok: true, token: issueToken({ email, name }), email, name };
}

function encode(text) {
  return Utilities.base64EncodeWebSafe(text, Utilities.Charset.UTF_8);
}

function sign(payload) {
  const secret = PropertiesService.getScriptProperties().getProperty("TOKEN_SECRET");
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(payload, secret));
}

function issueToken(user) {
  const payload = encode(JSON.stringify({ email: user.email, name: user.name, exp: Date.now() + TOKEN_DAYS * 86400000 }));
  return payload + "." + sign(payload);
}

function readToken(token) {
  if (typeof token !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature || sign(payload) !== signature) return null;
  const user = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(payload)).getDataAsString("UTF-8"));
  return user.exp > Date.now() ? user : null;
}

function sharingEmails(item) {
  const owner = item.getOwner();
  return [owner, ...item.getEditors(), ...item.getViewers()].filter(Boolean).map((user) => normalizeEmail(user.getEmail()));
}

function allowedEmails() {
  const cache = CacheService.getScriptCache();
  const cached = cache.get("allowedEmails");
  if (cached) return JSON.parse(cached);
  const emails = new Set();
  const queue = [DriveApp.getFileById(SpreadsheetApp.getActive().getId())];
  while (queue.length) {
    const item = queue.shift();
    sharingEmails(item).forEach((email) => emails.add(email));
    for (const parents = item.getParents(); parents.hasNext();) queue.push(parents.next());
  }
  emails.delete("");
  const list = [...emails];
  cache.put("allowedEmails", JSON.stringify(list), ALLOWED_CACHE_SECONDS);
  return list;
}

function pickColumns(values, columns) {
  if (!values.length) return [];
  const header = values[0].map(String);
  const picked = columns.map((name) => [name, header.indexOf(name)]).filter(([, index]) => index >= 0);
  return values.slice(1)
    .map((row) => Object.fromEntries(picked.map(([name, index]) => [name, String(row[index] ?? "")])))
    .filter((record) => Object.values(record).some((value) => value !== ""));
}

function readTable(sheetName, columns) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet) return [];
  return pickColumns(sheet.getDataRange().getDisplayValues(), columns);
}

function data({ token }) {
  const user = readToken(token);
  if (!user) return { ok: false, error: "expired" };
  if (!allowedEmails().includes(normalizeEmail(user.email))) return { ok: false, error: "not_allowed", email: user.email };
  const cache = CacheService.getScriptCache();
  const cached = cache.get("data");
  if (cached) return JSON.parse(cached);
  const tables = Object.fromEntries(Object.entries(TABLES).map(([key, { sheet, columns }]) => [key, readTable(sheet, columns)]));
  const result = { ok: true, fetchedAt: Utilities.formatDate(new Date(), "Asia/Taipei", "yyyy-MM-dd'T'HH:mm:ssXXX"), tables };
  const serialized = JSON.stringify(result);
  if (serialized.length <= DATA_CACHE_MAX_BYTES) cache.put("data", serialized, DATA_CACHE_SECONDS);
  return result;
}
