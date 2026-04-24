// ── Auth ───────────────────────────────────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  full_name: string;
  is_verified: boolean;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: User;
}

// ── Account ────────────────────────────────────────────────────────────────────
export type AccountType = "personal" | "joint";
export type AccountStatus = "active" | "closed";

export interface Account {
  id: string;
  type: AccountType;
  name: string | null;
  base_currency: string;
  status: AccountStatus;
  created_at: string;
}

export interface AccountMember {
  id: string;
  user_id: string;
  role: "member" | "viewer";
  status: "active" | "pending" | "removed";
  joined_at: string;
}

// ── Profile ────────────────────────────────────────────────────────────────────
export type IncomeType = "fixed" | "casual" | "variable" | "multiple";
export type PayFrequency = "weekly" | "biweekly" | "monthly" | "irregular";
export type DebtMethod = "snowball" | "avalanche" | "custom";

export interface UserProfile {
  id: string;
  user_id: string;
  account_id: string;
  country: string | null;
  city: string | null;
  local_currency: string | null;
  income_type: IncomeType | null;
  pay_frequency: PayFrequency | null;
  pay_day: string | null;
  income_month_1: number | null;
  income_month_2: number | null;
  income_month_3: number | null;
  income_baseline: number | null;
  income_lowest: number | null;
  financial_situation: string | null;
  primary_goal: string | null;
  debt_method: DebtMethod;
  motivation_style: "disciplined" | "motivation_driven" | null;
  spending_personality: string | null;
  onboarding_complete: boolean;
  created_at: string;
}

// ── Debt ───────────────────────────────────────────────────────────────────────
export type DebtType =
  | "credit_card"
  | "personal_loan"
  | "car_finance"
  | "student_loan"
  | "home_loan"
  | "store_account"
  | "personal"
  | "other";

export type DebtStatus = "active" | "cleared" | "paused";

export interface Debt {
  id: string;
  account_id: string;
  name: string;
  debt_type: DebtType;
  payment_type: "fixed" | "variable" | "app_decided" | null;
  original_balance: number;
  current_balance: number;
  minimum_payment: number | null;
  actual_payment: number | null;
  payment_frequency: "weekly" | "biweekly" | "monthly" | null;
  payment_day: string | null;
  has_interest: boolean;
  interest_rate: number | null;
  months_remaining: number | null;
  status: DebtStatus;
  cleared_at: string | null;
  currency: string;
  is_shared: boolean;
  is_locked: boolean;
  shared_from_debt_id: string | null;
  shared_to_account_id: string | null;
  shared_to_debt_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  extra_amount: number;
  payment_date: string;
  due_date: string | null;
  status: "pending" | "confirmed" | "late" | "extended";
  created_at: string;
}

// ── Freedom Date ───────────────────────────────────────────────────────────────
export interface FreedomDateResult {
  method: string;
  freedom_date: string | null;
  months_remaining: number;
  total_interest_paid: number;
}

export interface FreedomDateResponse {
  snowball: FreedomDateResult;
  avalanche: FreedomDateResult;
  custom: FreedomDateResult;
  recommended_method: DebtMethod;
}

// ── Transaction ────────────────────────────────────────────────────────────────
export type TransactionType = "income" | "expense" | "transfer" | "debt_payment";

export interface Transaction {
  id: string;
  account_id: string;
  user_id: string | null;
  amount: number;
  type: TransactionType;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  transaction_date: string;
  currency: string;
  is_shared: boolean;
  split_type: "shared" | "personal" | "grey" | null;
  created_at: string;
}

// ── Goal ───────────────────────────────────────────────────────────────────────
export type GoalType =
  | "emergency_fund"
  | "debt_payoff"
  | "savings"
  | "house_deposit"
  | "holiday"
  | "education"
  | "custom";

export interface Goal {
  id: string;
  account_id: string;
  name: string;
  goal_type: GoalType;
  target_amount: number;
  current_amount: number;
  currency: string;
  target_date: string | null;
  status: "active" | "completed" | "paused";
  priority: number;
  created_at: string;
  updated_at: string;
}

// ── Investment ─────────────────────────────────────────────────────────────────
export type AssetType =
  | "stocks"
  | "bonds"
  | "mutual_funds"
  | "property"
  | "crypto"
  | "fixed_deposit"
  | "retirement"
  | "foreign_cash"
  | "other";

export interface Investment {
  id: string;
  account_id: string;
  name: string;
  asset_type: AssetType;
  currency: string;
  units: number | null;
  purchase_price: number | null;
  current_price: number | null;
  current_value: number | null;
  base_currency_value: number | null;
  country: string | null;
  visibility: "personal" | "shared";
  has_secure_details: boolean;
  status: "active" | "sold";
  purchased_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvestmentSecureDetails {
  account_email: string | null;
  account_number: string | null;
  login_id: string | null;
  secure_notes: string | null;
  revealed_until: string;
}

export interface PortfolioSummary {
  total_base_currency_value: number;
  by_type: Record<string, number>;
  by_country: Record<string, number>;
  base_currency: string;
}

// ── Joint ──────────────────────────────────────────────────────────────────────
export interface SpendingBoundary {
  id: string;
  account_id: string;
  category: string;
  classification: "shared" | "personal" | "grey";
  split_method: "equal" | "percentage" | "decide_each_time" | null;
  member_a_percentage: number | null;
  member_b_percentage: number | null;
  notes: string | null;
}

export interface PaymentWarning {
  id: string;
  account_id: string;
  debt_id: string | null;
  due_date: string;
  warning_type: "30_day" | "7_day" | "4_day" | "3_day" | "1_day" | "payment_day" | "3_day_after";
  member_a_confirmed: boolean;
  member_b_confirmed: boolean;
  created_at: string;
}

export interface JointScenario {
  id: string;
  account_id: string;
  title: string;
  description: string | null;
  scenario_data: Record<string, unknown> | null;
  status: "draft" | "shared" | "decided" | "archived";
}

export interface SafeSpaceMessage {
  id: string;
  account_id: string;
  sender_id: string | null;
  message: string;
  is_read: boolean;
  sent_at: string;
}

// ── Exchange Rate ──────────────────────────────────────────────────────────────
export interface ExchangeRateStatus {
  rate: number | null;
  is_stale: boolean;
  fetched_at: string | null;
  status: string;
}

// ── Misc ───────────────────────────────────────────────────────────────────────
export interface ApiError {
  detail: string;
}

export interface AuthState {
  user: User | null;
  accountId: string | null;
  accountType: AccountType | null;
  role: "member" | "viewer" | null;
  isLoading: boolean;
}
