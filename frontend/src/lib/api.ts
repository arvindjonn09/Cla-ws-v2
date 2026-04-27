const BASE = process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") || "";

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

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      if (!res.ok) throw new Error(text || `Request failed: ${res.status}`);
      throw new Error("Invalid JSON response from server");
    }
  }
  if (!res.ok) {
    const detail = json && typeof json === "object" && "detail" in json ? String(json.detail) : null;
    throw new Error(detail || `Request failed: ${res.status}`);
  }
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
    api.post<TokenResponse>(`/api/auth/verify-email?token=${token}`, {}),

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

  resendVerification: (email: string) =>
    api.post<{ message: string }>("/api/auth/resend-verification", { email }),
};

// ── Account ────────────────────────────────────────────────────────────────────
import type { Account, AccountMember, AccountMembership } from "@/types";

export const accountApi = {
  listMine: () => api.get<AccountMembership[]>("/api/accounts/mine"),

  createJoint: (body: { name?: string; base_currency?: string } = {}) =>
    api.post<Account>("/api/accounts/joint", body),

  getAccount: (id: string) => api.get<Account>(`/api/accounts/${id}`),

  update: (id: string, body: { name?: string; base_currency?: string }) =>
    api.patch<Account>(`/api/accounts/${id}`, body),

  getProfile: (accountId: string) =>
    api.get<UserProfile>(`/api/accounts/${accountId}/profile`),

  updateProfile: (accountId: string, body: Partial<UserProfile>) =>
    api.patch<UserProfile>(`/api/accounts/${accountId}/profile`, body),

  invite: (accountId: string, body: { email: string; role: "member" | "viewer" }) =>
    api.post<{ message: string }>(`/api/accounts/${accountId}/invite`, body),

  listMembers: (accountId: string) =>
    api.get<AccountMember[]>(`/api/accounts/${accountId}/members`),

  removeMember: (accountId: string, userId: string) =>
    api.delete<{ message: string }>(`/api/accounts/${accountId}/members/${userId}`),

  closeAccount: (accountId: string) =>
    api.post<{ message: string; pending: boolean }>(`/api/accounts/${accountId}/close`, {}),

  acceptInvite: (token: string) =>
    api.post<{ message: string; account_id: string; role: string }>(`/api/accounts/accept-invite?token=${token}`, {}),
};

// ── Debts ──────────────────────────────────────────────────────────────────────
import type { Debt, DebtPayment, FreedomDateResponse } from "@/types";

export const debtApi = {
  list: (accountId: string) => api.get<Debt[]>(`/api/accounts/${accountId}/debts`),

  create: (accountId: string, body: Omit<Debt, "id" | "account_id" | "status" | "cleared_at" | "created_at" | "updated_at" | "is_locked" | "shared_from_debt_id" | "shared_to_account_id" | "shared_to_debt_id">) =>
    api.post<Debt>(`/api/accounts/${accountId}/debts`, body),

  update: (accountId: string, debtId: string, body: Partial<Debt>) =>
    api.patch<Debt>(`/api/accounts/${accountId}/debts/${debtId}`, body),

  delete: (accountId: string, debtId: string) =>
    api.delete<void>(`/api/accounts/${accountId}/debts/${debtId}`),

  shareToJoint: (accountId: string, debtId: string) =>
    api.post<{ message: string; source_debt_id: string; joint_account_id: string; joint_debt_id: string }>(
      `/api/accounts/${accountId}/debts/${debtId}/share-to-joint`,
      {}
    ),

  freedomDate: (accountId: string) =>
    api.get<FreedomDateResponse>(`/api/accounts/${accountId}/debts/freedom-date`),

  logPayment: (accountId: string, debtId: string, body: { amount: number; extra_amount?: number; payment_date: string }) =>
    api.post<DebtPayment>(`/api/accounts/${accountId}/debts/${debtId}/payments`, body),

  simulate: (accountId: string, debtId: string, extra_monthly: number) =>
    api.post<{
      extra_monthly: number;
      current_monthly_payment: number;
      new_monthly_payment: number;
      new_freedom_date: string | null;
      months_saved: number;
      interest_saved: number;
    }>(
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
import type { Investment, InvestmentSecureDetails, PortfolioSummary } from "@/types";

type InvestmentSecureDetailsInput = {
  account_email?: string | null;
  account_number?: string | null;
  login_id?: string | null;
  secure_notes?: string | null;
};

export type InvestmentPayload = Omit<Investment, "id" | "account_id" | "status" | "created_at" | "updated_at" | "has_secure_details"> & {
  secure_details?: InvestmentSecureDetailsInput | null;
};

export const investmentApi = {
  list: (accountId: string) => api.get<Investment[]>(`/api/accounts/${accountId}/investments`),
  create: (accountId: string, body: InvestmentPayload) =>
    api.post<Investment>(`/api/accounts/${accountId}/investments`, body),
  update: (accountId: string, invId: string, body: Partial<InvestmentPayload>) =>
    api.patch<Investment>(`/api/accounts/${accountId}/investments/${invId}`, body),
  delete: (accountId: string, invId: string) =>
    api.delete<void>(`/api/accounts/${accountId}/investments/${invId}`),
  portfolio: (accountId: string) =>
    api.get<PortfolioSummary>(`/api/accounts/${accountId}/investments/portfolio`),
  requestSecureCode: (accountId: string, invId: string) =>
    api.post<{ message: string }>(`/api/accounts/${accountId}/investments/${invId}/secure/request-code`, {}),
  verifySecureCode: (accountId: string, invId: string, code: string) =>
    api.post<InvestmentSecureDetails>(`/api/accounts/${accountId}/investments/${invId}/secure/verify`, { code }),
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

// ── PDF Import ────────────────────────────────────────────────────────────────

export interface PreviewBill {
  id: string;
  name: string;
  amount: number;
  currency: string;
  due_day: number;
  category: string;
  sample_dates: string[];
}

export interface PreviewTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
}

export interface PreviewTransfer {
  id: string;
  date: string;
  description: string;
  amount: number;
}

export interface ImportPreviewResponse {
  bills: PreviewBill[];
  transactions: PreviewTransaction[];
  transfers: PreviewTransfer[];
  skipped_duplicates: number;
  unreadable: boolean;
}

export interface BulkImportResponse {
  saved: number;
}

async function uploadPdf(path: string, file: File): Promise<ImportPreviewResponse> {
  const token = localStorage.getItem("access_token");
  const formData = new FormData();
  formData.append("file", file);
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { method: "POST", headers, body: formData });

  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const headers2: Record<string, string> = { Authorization: `Bearer ${newToken}` };
      const res2 = await fetch(`${BASE}${path}`, { method: "POST", headers: headers2, body: formData });
      if (!res2.ok) throw new Error(`Upload failed: ${res2.status}`);
      return res2.json();
    }
    if (typeof window !== "undefined") window.location.href = "/login";
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const text = await res.text();
    let detail: string | null = null;
    try { detail = JSON.parse(text)?.detail; } catch { /* */ }
    throw new Error(detail || `Upload failed: ${res.status}`);
  }
  return res.json();
}

export const importApi = {
  parsePdf: (accountId: string, file: File) =>
    uploadPdf(`/api/accounts/${accountId}/transactions/import-pdf`, file),

  bulkSave: (accountId: string, transactions: { date: string; description: string; amount: number; category: string; currency: string; type?: string }[]) =>
    api.post<BulkImportResponse>(`/api/accounts/${accountId}/transactions/import-bulk`, { transactions }),

  learnRules: (corrections: { description: string; category: string }[]) =>
    api.post<{ learned: number }>("/api/merchant-rules/learn", { corrections }),
};

// ── Exchange Rates ─────────────────────────────────────────────────────────────
export const rateApi = {
  getRate: (from: string, to: string) =>
    api.get<{ rate: number | null; is_stale: boolean; fetched_at: string | null }>(`/api/exchange-rates/${from}/${to}`),
  status: () =>
    api.get<{ usd_eur: { rate: number | null; is_stale: boolean; fetched_at: string | null }; scheduler_running: boolean }>("/api/exchange-rates/status"),
};
