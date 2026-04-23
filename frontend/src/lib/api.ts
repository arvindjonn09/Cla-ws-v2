const BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8100";

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return null;
  try {
    const res = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      localStorage.clear();
      return null;
    }
    const data = await res.json();
    localStorage.setItem("access_token", data.access_token);
    localStorage.setItem("refresh_token", data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

async function request<T>(
  method: string,
  path: string,
  data?: unknown,
  retry = true
): Promise<T> {
  const token = localStorage.getItem("access_token");
  const headers: Record<string, string> = {};
  if (data !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });

  if (res.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    if (newToken) return request<T>(method, path, data, false);
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }

  if (res.status === 204) return undefined as T;

  const json = await res.json();
  if (!res.ok) throw new Error(json.detail || `Request failed: ${res.status}`);
  return json as T;
}

export const api = {
  get: <T>(path: string) => request<T>("GET", path),
  post: <T>(path: string, data: unknown) => request<T>("POST", path, data),
  patch: <T>(path: string, data: unknown) => request<T>("PATCH", path, data),
  delete: <T>(path: string) => request<T>("DELETE", path),
};

// ── Auth ───────────────────────────────────────────────────────────────────────
import type { TokenResponse, UserProfile } from "@/types";

export const authApi = {
  signup: (body: { email: string; password: string; full_name: string }) =>
    api.post<{ message: string }>("/api/auth/signup", body),

  verifyEmail: (token: string) =>
    api.post<{ message: string }>(`/api/auth/verify-email?token=${token}`, {}),

  login: (body: { email: string; password: string }) =>
    api.post<TokenResponse>("/api/auth/login", body),

  logout: (refresh_token: string) =>
    api.post<{ message: string }>("/api/auth/logout", { refresh_token }),

  refresh: (refresh_token: string) =>
    api.post<TokenResponse>("/api/auth/refresh", { refresh_token }),

  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/api/auth/forgot-password", { email }),

  resetPassword: (token: string, new_password: string) =>
    api.post<{ message: string }>("/api/auth/reset-password", { token, new_password }),

  changePassword: (body: { old_password: string; new_password: string }) =>
    api.post<{ message: string }>("/api/auth/change-password", body),
};

// ── Account ────────────────────────────────────────────────────────────────────
import type { Account, AccountMember } from "@/types";

export const accountApi = {
  getAccount: (id: string) => api.get<Account>(`/api/accounts/${id}`),

  getProfile: (accountId: string) =>
    api.get<UserProfile>(`/api/accounts/${accountId}/profile`),

  updateProfile: (accountId: string, body: Partial<UserProfile>) =>
    api.patch<UserProfile>(`/api/accounts/${accountId}/profile`, body),

  invite: (accountId: string, body: { email: string; role: "member" | "viewer" }) =>
    api.post<{ message: string }>(`/api/accounts/${accountId}/invite`, body),

  removeMember: (accountId: string, userId: string) =>
    api.delete<{ message: string }>(`/api/accounts/${accountId}/members/${userId}`),

  closeAccount: (accountId: string) =>
    api.post<{ message: string }>(`/api/accounts/${accountId}/close`, {}),
};

// ── Debts ──────────────────────────────────────────────────────────────────────
import type { Debt, DebtPayment, FreedomDateResponse } from "@/types";

export const debtApi = {
  list: (accountId: string) => api.get<Debt[]>(`/api/accounts/${accountId}/debts`),

  create: (accountId: string, body: Omit<Debt, "id" | "account_id" | "status" | "cleared_at" | "created_at" | "updated_at">) =>
    api.post<Debt>(`/api/accounts/${accountId}/debts`, body),

  update: (accountId: string, debtId: string, body: Partial<Debt>) =>
    api.patch<Debt>(`/api/accounts/${accountId}/debts/${debtId}`, body),

  delete: (accountId: string, debtId: string) =>
    api.delete<void>(`/api/accounts/${accountId}/debts/${debtId}`),

  freedomDate: (accountId: string) =>
    api.get<FreedomDateResponse>(`/api/accounts/${accountId}/debts/freedom-date`),

  logPayment: (accountId: string, debtId: string, body: { amount: number; extra_amount?: number; payment_date: string }) =>
    api.post<DebtPayment>(`/api/accounts/${accountId}/debts/${debtId}/payments`, body),

  simulate: (accountId: string, debtId: string, extra_monthly: number) =>
    api.post<{ extra_monthly: number; new_freedom_date: string | null; months_saved: number; interest_saved: number }>(
      `/api/accounts/${accountId}/debts/${debtId}/simulate?extra_monthly=${extra_monthly}`,
      {}
    ),
};

// ── Transactions ───────────────────────────────────────────────────────────────
import type { Transaction } from "@/types";

export const transactionApi = {
  list: (accountId: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Transaction[]>(`/api/accounts/${accountId}/transactions${qs}`);
  },
  create: (accountId: string, body: Omit<Transaction, "id" | "account_id" | "user_id" | "created_at">) =>
    api.post<Transaction>(`/api/accounts/${accountId}/transactions`, body),
  update: (accountId: string, txId: string, body: Partial<Transaction>) =>
    api.patch<Transaction>(`/api/accounts/${accountId}/transactions/${txId}`, body),
  delete: (accountId: string, txId: string) =>
    api.delete<void>(`/api/accounts/${accountId}/transactions/${txId}`),
};

// ── Goals ──────────────────────────────────────────────────────────────────────
import type { Goal } from "@/types";

export const goalApi = {
  list: (accountId: string) => api.get<Goal[]>(`/api/accounts/${accountId}/goals`),
  create: (accountId: string, body: Omit<Goal, "id" | "account_id" | "status" | "created_at" | "updated_at">) =>
    api.post<Goal>(`/api/accounts/${accountId}/goals`, body),
  update: (accountId: string, goalId: string, body: Partial<Goal>) =>
    api.patch<Goal>(`/api/accounts/${accountId}/goals/${goalId}`, body),
  delete: (accountId: string, goalId: string) =>
    api.delete<void>(`/api/accounts/${accountId}/goals/${goalId}`),
};

// ── Investments ────────────────────────────────────────────────────────────────
import type { Investment, PortfolioSummary } from "@/types";

export const investmentApi = {
  list: (accountId: string) => api.get<Investment[]>(`/api/accounts/${accountId}/investments`),
  create: (accountId: string, body: Omit<Investment, "id" | "account_id" | "status" | "created_at" | "updated_at">) =>
    api.post<Investment>(`/api/accounts/${accountId}/investments`, body),
  update: (accountId: string, invId: string, body: Partial<Investment>) =>
    api.patch<Investment>(`/api/accounts/${accountId}/investments/${invId}`, body),
  delete: (accountId: string, invId: string) =>
    api.delete<void>(`/api/accounts/${accountId}/investments/${invId}`),
  portfolio: (accountId: string) =>
    api.get<PortfolioSummary>(`/api/accounts/${accountId}/investments/portfolio`),
};

// ── Joint ──────────────────────────────────────────────────────────────────────
import type { SpendingBoundary, PaymentWarning, JointScenario, SafeSpaceMessage } from "@/types";

export const jointApi = {
  listBoundaries: (accountId: string) =>
    api.get<SpendingBoundary[]>(`/api/accounts/${accountId}/boundaries`),
  createBoundary: (accountId: string, body: Omit<SpendingBoundary, "id" | "account_id">) =>
    api.post<SpendingBoundary>(`/api/accounts/${accountId}/boundaries`, body),

  listWarnings: (accountId: string) =>
    api.get<PaymentWarning[]>(`/api/accounts/${accountId}/payment-warnings`),
  confirmWarning: (accountId: string, warningId: string) =>
    api.post<{ member_a_confirmed: boolean; member_b_confirmed: boolean }>(
      `/api/accounts/${accountId}/payment-warnings/${warningId}/confirm`,
      {}
    ),

  listScenarios: (accountId: string) =>
    api.get<JointScenario[]>(`/api/accounts/${accountId}/scenarios`),
  createScenario: (accountId: string, body: { title: string; description?: string }) =>
    api.post<JointScenario>(`/api/accounts/${accountId}/scenarios`, body),

  getMessages: (accountId: string) =>
    api.get<SafeSpaceMessage[]>(`/api/accounts/${accountId}/safe-space`),
  sendMessage: (accountId: string, message: string) =>
    api.post<{ message: string }>(`/api/accounts/${accountId}/safe-space`, { message }),
};

// ── Exchange Rates ─────────────────────────────────────────────────────────────
export const rateApi = {
  getRate: (from: string, to: string) =>
    api.get<{ rate: number | null; is_stale: boolean; fetched_at: string | null }>(`/api/exchange-rates/${from}/${to}`),
  status: () =>
    api.get<{ usd_zar: { rate: number | null; is_stale: boolean } }>("/api/exchange-rates/status"),
};
