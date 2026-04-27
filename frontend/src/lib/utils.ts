// ── Formatting ─────────────────────────────────────────────────────────────────

export function fmt(amount: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function fmtCompact(amount: number, currency = "USD"): string {
  if (Math.abs(amount) >= 1_000_000)
    return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000)
    return `${currency} ${(amount / 1_000).toFixed(1)}K`;
  return fmt(amount, currency);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

export function daysUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  const now = new Date();
  const diff = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export function monthsUntil(isoDate: string | null | undefined): number | null {
  if (!isoDate) return null;
  const target = new Date(isoDate);
  const now = new Date();
  return (
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth())
  );
}

export function pct(current: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((current / target) * 100));
}

// ── Auth storage ───────────────────────────────────────────────────────────────

export function saveTokens(access: string, refresh: string) {
  localStorage.setItem("access_token", access);
  localStorage.setItem("refresh_token", refresh);
  // Set a cookie middleware can read (15-day lifetime matches refresh token)
  document.cookie = "fcc_auth=1; path=/; max-age=1296000; SameSite=Strict";
}

export function clearTokens() {
  localStorage.clear();
  document.cookie = "fcc_auth=; path=/; max-age=0; SameSite=Strict";
}

export function getAccountId(): string | null {
  return getPersonalAccountId();
}

export function getPersonalAccountId(): string | null {
  return localStorage.getItem("personal_account_id")
    ?? (localStorage.getItem("account_type") === "joint" ? null : localStorage.getItem("account_id"));
}

export function getJointAccountId(): string | null {
  return localStorage.getItem("joint_account_id")
    ?? (localStorage.getItem("account_type") === "joint" ? localStorage.getItem("account_id") : null);
}

export function saveAccountMeta(
  accountId: string,
  accountType: string,
  role: string,
  onboardingComplete: boolean
) {
  if (accountType === "joint") {
    saveJointAccountMeta(accountId, role, onboardingComplete);
    return;
  }

  localStorage.setItem("account_id", accountId);
  localStorage.setItem("personal_account_id", accountId);
  localStorage.setItem("account_type", accountType);
  localStorage.setItem("role", role);
  localStorage.setItem("onboarding_complete", String(onboardingComplete));
}

export function saveJointAccountMeta(
  accountId: string,
  role: string,
  onboardingComplete = true
) {
  localStorage.setItem("joint_account_id", accountId);
  localStorage.setItem("joint_role", role);
  localStorage.setItem("joint_onboarding_complete", String(onboardingComplete));
}

export function clearJointAccountMeta() {
  localStorage.removeItem("joint_account_id");
  localStorage.removeItem("joint_role");
  localStorage.removeItem("joint_onboarding_complete");
}

export function saveAccountMemberships(
  memberships: {
    account: { id: string; type: string };
    role: string;
    status: string;
  }[]
) {
  const active = memberships.filter((m) => m.status === "active");
  const personal = active.find((m) => m.account.type === "personal");
  const joint = active.find((m) => m.account.type === "joint");

  if (personal) {
    const onboardingComplete = localStorage.getItem("onboarding_complete") === "true";
    saveAccountMeta(personal.account.id, "personal", personal.role, onboardingComplete);
  }

  if (joint) {
    saveJointAccountMeta(joint.account.id, joint.role, true);
  } else {
    clearJointAccountMeta();
  }
}

// ── Debt helpers ───────────────────────────────────────────────────────────────

export function debtTypeLabel(type: string): string {
  const map: Record<string, string> = {
    credit_card: "Credit Card",
    personal_loan: "Personal Loan",
    car_finance: "Car Finance",
    student_loan: "Student Loan",
    home_loan: "Home Loan",
    store_account: "Store Account",
    personal: "Personal Debt",
    other: "Other",
  };
  return map[type] ?? type;
}

export function goalTypeLabel(type: string): string {
  const map: Record<string, string> = {
    emergency_fund: "Emergency Fund",
    debt_payoff: "Debt Payoff",
    savings: "Savings",
    house_deposit: "House Deposit",
    holiday: "Holiday",
    education: "Education",
    custom: "Custom Goal",
  };
  return map[type] ?? type;
}

export function assetTypeLabel(type: string): string {
  const map: Record<string, string> = {
    stocks: "Stocks",
    bonds: "Bonds",
    mutual_funds: "Mutual Funds",
    property: "Property",
    crypto: "Crypto",
    fixed_deposit: "Fixed Deposit",
    retirement: "Retirement",
    foreign_cash: "Foreign Cash",
    other: "Other",
  };
  return map[type] ?? type;
}

// ── Class merging ──────────────────────────────────────────────────────────────

export function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

// ── Today ──────────────────────────────────────────────────────────────────────
export function today(): string {
  return new Date().toISOString().split("T")[0];
}

/**
 * Convert an amount from one currency to another using stored USD-based rates.
 * rates = { "INR": 84, "AUD": 1.56, ... } where each value is USD → that currency.
 * Falls back to the original amount if either rate is missing.
 */
export function convertToBase(
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  rates: Record<string, number>,
): number {
  if (fromCurrency === toCurrency) return amount;
  const fromRate = rates[fromCurrency];
  const toRate   = rates[toCurrency];
  if (!fromRate || !toRate) return amount;
  return (amount / fromRate) * toRate;
}
