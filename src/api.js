import { CONFIG } from "../config.js?v=1";

const KEY = { token: "ops.token", data: "ops.data" };

export class ApiError extends Error {
  constructor(code, email) {
    super(code);
    this.code = code;
    this.email = email;
  }
}

export const storage = {
  get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Private browsing: the login lasts for this page only.
    }
  },
};

async function call(payload) {
  const response = await fetch(CONFIG.apiUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new ApiError("server_error");
  const result = await response.json();
  if (!result.ok) throw new ApiError(result.error, result.email);
  return result;
}

export async function login(idToken) {
  const { token, email, name } = await call({ action: "login", idToken });
  return { token, email, name };
}

export async function fetchData(token) {
  const { fetchedAt, tables } = await call({ action: "data", token });
  return { fetchedAt, tables };
}

export async function refresh(store, fetchFn = fetchData) {
  const cached = store.get(KEY.data);
  const token = store.get(KEY.token);
  if (!token) return { status: "login", data: cached };
  try {
    const data = await fetchFn(token);
    store.set(KEY.data, data);
    return { status: "fresh", data };
  } catch (error) {
    if (error.code === "not_allowed") {
      store.set(KEY.token, null);
      store.set(KEY.data, null);
      return { status: "not_allowed", data: null, email: error.email };
    }
    if (error.code === "expired") {
      store.set(KEY.token, null);
      return { status: "login", data: cached };
    }
    return cached ? { status: "offline", data: cached } : { status: "error", data: null };
  }
}
