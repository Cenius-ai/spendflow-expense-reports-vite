/**
 * Thin fetch wrapper for the Spendflow API.
 * Every call is same-origin (`/api/...`) so the Vite dev proxy reaches FastAPI.
 */

const TOKEN_KEY = "spendflow.token";
const USER_KEY = "spendflow.user";

export class ApiError extends Error {
  constructor(message, status, detail) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.detail = detail;
  }
}

function safeStorage() {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readToken() {
  const storage = safeStorage();
  return storage ? storage.getItem(TOKEN_KEY) : null;
}

export function saveToken(token) {
  const storage = safeStorage();
  if (!storage) return;
  if (token) storage.setItem(TOKEN_KEY, token);
  else storage.removeItem(TOKEN_KEY);
}

export function readCachedUser() {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    return JSON.parse(storage.getItem(USER_KEY) || "null");
  } catch {
    return null;
  }
}

export function saveCachedUser(user) {
  const storage = safeStorage();
  if (!storage) return;
  if (user) storage.setItem(USER_KEY, JSON.stringify(user));
  else storage.removeItem(USER_KEY);
}

let unauthorizedHandler = () => {};

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = typeof handler === "function" ? handler : () => {};
}

function fallbackMessage(status) {
  if (status === 401) return "Your session expired. Sign in again.";
  if (status === 403) return "You do not have access to that.";
  if (status === 404) return "That record no longer exists.";
  if (status === 409) return "That action is not allowed in the current state.";
  if (status === 422) return "Please check the highlighted fields.";
  if (status === 429) return "Too many attempts. Try again in a minute.";
  if (status >= 500) return "The Spendflow API hit an error. Please retry.";
  return "The request could not be completed.";
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = auth ? readToken() : null;
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Cannot reach the Spendflow API. Is the backend running on port 8000?", 0, null);
  }

  if (response.status === 204) return null;

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  if (!response.ok) {
    if (response.status === 401 && path !== "/api/auth/login") unauthorizedHandler();
    const detail = payload && payload.detail !== undefined ? payload.detail : null;
    const message = typeof detail === "string" ? detail : fallbackMessage(response.status);
    throw new ApiError(message, response.status, detail);
  }

  return payload;
}

export const api = {
  login: (email, password) =>
    request("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
  me: () => request("/api/auth/me"),

  listReports: (status) =>
    request(status ? `/api/reports?status=${encodeURIComponent(status)}` : "/api/reports"),
  createReport: (title) => request("/api/reports", { method: "POST", body: { title } }),
  getReport: (id) => request(`/api/reports/${id}`),
  renameReport: (id, title) => request(`/api/reports/${id}`, { method: "PATCH", body: { title } }),
  deleteReport: (id) => request(`/api/reports/${id}`, { method: "DELETE" }),
  submitReport: (id) => request(`/api/reports/${id}/submit`, { method: "POST" }),
  decideReport: (id, decision, note) =>
    request(`/api/reports/${id}/decision`, { method: "POST", body: { decision, note } }),
  reimburseReport: (id) => request(`/api/reports/${id}/reimburse`, { method: "POST" }),

  addExpense: (reportId, payload) =>
    request(`/api/reports/${reportId}/expenses`, { method: "POST", body: payload }),
  updateExpense: (expenseId, payload) =>
    request(`/api/expenses/${expenseId}`, { method: "PATCH", body: payload }),
  deleteExpense: (expenseId) => request(`/api/expenses/${expenseId}`, { method: "DELETE" }),

  dashboardSummary: () => request("/api/dashboard/summary"),
  spendAnalytics: () => request("/api/analytics/spend"),
};
