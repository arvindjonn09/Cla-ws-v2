// ── Formatting ─────────────────────────────────────────────────────────────────

export function fmt(amount: number, currency = "ZAR"): string {
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function fmtCompact(amount: number, currency = "ZAR"): string {
  if (Math.abs(amount) >= 1_000_000)
    return `${currency} ${(amount / 1_000_000).toFixed(1)}M`;
  if (Math.abs(amount) >= 1_000)
    return `${currency} ${(amount / 1_000).toFixed(1)}K`;
  return fmt(amount, currency);
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-ZA", {
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
}

export function clearTokens() {
  localStorage.clear();
}

export function getAccountId(): string | null {
  return localStorage.getItem("account_id");
}

export function saveAccountMeta(
  accountId: string,
  accountType: string,
  role: string,
  onboardingComplete: boolean
) {
  localStorage.setItem("account_id", accountId);
  localStorage.setItem("account_type", accountType);
  localStorage.setItem("role", role);
  localStorage.setItem("onboarding_complete", String(onboardingComplete));
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
