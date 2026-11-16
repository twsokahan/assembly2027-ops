import { CONFIG } from "../config.js?v=2";
import { login, refresh, storage } from "./api.js?v=2";
import { buildModel } from "./model.js?v=2";
import { statusLine as describeStatus } from "./status.js?v=2";
import { todayInTaipei } from "./dates.js?v=2";
import { render as renderWeek } from "./views/week.js?v=2";

const GSI_SRC = "https://accounts.google.com/gsi/client";
const LINE_HINT = "請點右下角『⋯』用預設瀏覽器開啟";

const placeholder = (container) => {
  container.innerHTML = '<p class="placeholder">下一批上線</p>';
};

const views = {
  week: renderWeek,
  calendar: placeholder,
  schedule: placeholder,
  "two-sites": placeholder,
};

const isLocalhost = ["localhost", "127.0.0.1"].includes(location.hostname);
const query = new URLSearchParams(location.search);
const mockMode = isLocalhost && query.has("mock");
const wideQuery = matchMedia("(min-width: 760px)");

const main = document.getElementById("main");
const statusLine = document.getElementById("status");
const tabs = document.getElementById("tabs");

let current = null;
let gsiLoading = null;

function todayValue() {
  const override = query.get("today");
  return isLocalhost && /^\d{4}-\d{2}-\d{2}$/.test(override ?? "") ? override : todayInTaipei();
}

const currentRoute = () => {
  const name = location.hash.slice(1);
  return name in views ? name : "week";
};

function setStatus(text, offline = false) {
  statusLine.textContent = text;
  statusLine.classList.toggle("is-offline", offline);
}

function showTabs(visible) {
  tabs.hidden = !visible;
}

function render() {
  if (!current) return;
  const route = currentRoute();
  for (const tab of tabs.querySelectorAll("a")) {
    tab.setAttribute("aria-selected", String(tab.dataset.route === route));
  }
  const group = storage.get("ops.group");
  const ctx = {
    today: todayValue(),
    fetchedAt: current.data.fetchedAt,
    wide: wideQuery.matches,
    group,
    setGroup(next) {
      storage.set("ops.group", next);
      render();
    },
  };
  views[route](main, current.model, ctx);
}

function showData(data, status) {
  current = { data, model: buildModel(data.tables) };
  showTabs(true);
  const { text, alert } = describeStatus(status, data.fetchedAt);
  setStatus(text, alert);
  render();
}

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (key === "class") node.className = value;
    else node.setAttribute(key, value);
  }
  node.append(...children);
  return node;
}

function loadGsi() {
  gsiLoading ??= new Promise((resolve, reject) => {
    const script = el("script", { src: GSI_SRC, async: "" });
    script.addEventListener("load", resolve);
    script.addEventListener("error", () => reject(new Error("Google 登入元件載入失敗")));
    document.head.append(script);
  });
  return gsiLoading;
}

function showScreen(...nodes) {
  current = null;
  showTabs(false);
  setStatus("");
  main.replaceChildren(el("div", { class: "notice" }, ...nodes));
}

function signOut() {
  storage.set("ops.token", null);
  storage.set("ops.data", null);
  globalThis.google?.accounts?.id.disableAutoSelect();
}

function showNotAllowed(email) {
  const switchButton = el("button", { class: "link-button", type: "button" }, "換一個帳號");
  switchButton.addEventListener("click", () => {
    signOut();
    showLogin();
  });
  showScreen(el("p", {}, `這個帳號（${email}）沒有權限，請找前導組負責人把你加進追蹤大表的共用`), switchButton);
}

async function onCredential({ credential }) {
  try {
    const { token } = await login(credential);
    storage.set("ops.token", token);
    start();
  } catch (error) {
    if (error.code === "not_allowed") showNotAllowed(error.email);
    else showLogin("登入失敗，請再試一次。");
  }
}

async function showLogin(message) {
  const slot = el("div", { class: "gis-slot" });
  const nodes = [el("p", {}, "用 Google 帳號登入，查看運營時程。")];
  if (message) nodes.push(el("p", { class: "error" }, message));
  if (/Line\//.test(navigator.userAgent)) {
    const external = new URL(location.href);
    external.searchParams.set("openExternalBrowser", "1");
    nodes.push(el("p", { class: "hint" }, LINE_HINT, "　", el("a", { href: external.href }, "用瀏覽器開啟")));
  }
  nodes.push(slot);
  showScreen(...nodes);
  if (!CONFIG.clientId) {
    slot.replaceWith(el("p", { class: "error" }, "尚未設定登入用的 clientId，請先完成部署設定。"));
    return;
  }
  try {
    await loadGsi();
  } catch (error) {
    slot.replaceWith(el("p", { class: "error" }, error.message));
    return;
  }
  google.accounts.id.initialize({ client_id: CONFIG.clientId, callback: onCredential });
  google.accounts.id.renderButton(slot, { theme: "outline", size: "large", text: "signin_with", locale: "zh-TW" });
}

async function startMock() {
  const response = await fetch("test/fixtures/data.json?v=2");
  const { fetchedAt, tables } = await response.json();
  showData({ fetchedAt, tables }, "fresh");
}

async function start() {
  if (mockMode) return startMock();
  const cached = storage.get("ops.data");
  if (cached && storage.get("ops.token")) showData(cached, "refreshing");
  const result = await refresh(storage);
  if (result.status === "not_allowed") return showNotAllowed(result.email);
  if (result.status === "login") return showLogin();
  if (result.status === "error") {
    showScreen(el("p", { class: "error" }, "連不上，請稍後再試。"));
    return;
  }
  showData(result.data, result.status);
}

window.addEventListener("hashchange", render);
wideQuery.addEventListener("change", render);
start();
