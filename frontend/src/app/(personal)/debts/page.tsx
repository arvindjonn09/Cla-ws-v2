"use client";
import { useEffect, useState, useCallback } from "react";
import { debtApi, accountApi, rateApi } from "@/lib/api";
import { getAccountId, fmt, fmtDate, daysUntil, convertToBase, saveAccountMeta } from "@/lib/utils";
import type { Debt, DebtType, FreedomDateResponse } from "@/types";

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card:   "Credit Card",
  personal_loan: "Personal Loan",
  car_finance:   "Car Finance",
  student_loan:  "Student Loan",
  home_loan:     "Home Loan",
  store_account: "Store Account",
  personal:      "Personal",
  other:         "Other",
};

const DEBT_TYPES: DebtType[] = [
  "credit_card","personal_loan","car_finance","student_loan",
  "home_loan","store_account","personal","other",
];

const CURRENCIES = ["EUR","USD","INR","AUD"];

// ── Freedom Date Comparison ────────────────────────────────────────────────────

function FreedomDateComparison({
  data,
  recommended,
  currency,
}: {
  data: FreedomDateResponse;
  recommended: string;
  currency: string;
}) {
  const methods = [
    { key: "snowball",  label: "Snowball",  icon: "⛄", desc: "Smallest balance first" },
    { key: "avalanche", label: "Avalanche", icon: "🏔", desc: "Highest interest first" },
    { key: "custom",    label: "Custom",    icon: "✏",  desc: "Your priority order" },
  ] as const;

  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Freedom Date — All Methods</h2>
        <span className="text-xs text-slate-500">Business Rule: all 3 shown simultaneously</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {methods.map(({ key, label, icon, desc }) => {
          const result = data[key];
          const isRec = key === recommended;
          const days = result.freedom_date ? daysUntil(result.freedom_date) : null;
          return (
            <div
              key={key}
              className={`rounded-xl border p-4 space-y-2 transition-colors ${
                isRec
                  ? "border-blue-500/60 bg-blue-950/40 ring-1 ring-blue-500/40"
                  : "border-slate-700 bg-slate-900"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{icon}</span>
                <div>
                  <p className={`text-sm font-semibold ${isRec ? "text-blue-300" : "text-slate-200"}`}>{label}</p>
                  {isRec && <span className="text-[10px] text-blue-400 font-medium">Recommended</span>}
                </div>
              </div>
              <p className="text-xs text-slate-500">{desc}</p>
              {result.freedom_date ? (
                <>
                  <p className={`text-lg font-bold ${isRec ? "text-blue-400" : "text-slate-300"}`}>
                    {fmtDate(result.freedom_date)}
                  </p>
                  <p className="text-xs text-slate-500">
                    {days !== null
                      ? `${Math.floor(days / 365)}y ${Math.floor((days % 365) / 30)}m`
                      : `${result.months_remaining}mo`} remaining
                  </p>
                  <p className="text-xs text-slate-600">
                    Interest: <span className="text-slate-400">{fmt(result.total_interest_paid, currency)}</span>
                  </p>
                </>
              ) : (
                <p className="text-sm text-slate-500 italic">No data</p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Simulator ──────────────────────────────────────────────────────────────────

function Simulator({ accountId, debts }: { accountId: string; debts: Debt[] }) {
  const [amount, setAmount] = useState<number | "custom">(100);
  const [customAmount, setCustomAmount] = useState("");
  const [result, setResult] = useState<{ months_saved: number; interest_saved: number; new_freedom_date: string | null } | null>(null);
  const [loading, setLoading] = useState(false);

  const firstActive = debts.find((d) => d.status === "active");
  const simCurrency = firstActive?.currency ?? "USD";
  const presets = [50, 100, 200, 500];

  async function runSim() {
    if (!firstActive) return;
    const extra = amount === "custom" ? parseFloat(customAmount) : amount;
    if (!extra || extra <= 0) return;
    setLoading(true);
    try {
      const r = await debtApi.simulate(accountId, firstActive.id, extra);
      setResult(r);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  return (
    <div className="rounded-2xl border border-amber-500/20 bg-slate-800 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Extra Payment Simulator</h2>
        <p className="text-xs text-slate-500 mt-1">
          How much sooner could you be free? Simulates extra payment on your priority debt.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => { setAmount(p); setResult(null); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              amount === p
                ? "border-amber-500 bg-amber-500/20 text-amber-300"
                : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500"
            }`}
          >
            +{fmt(p, simCurrency)}/mo
          </button>
        ))}
        <button
          type="button"
          onClick={() => { setAmount("custom"); setResult(null); }}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
            amount === "custom"
              ? "border-amber-500 bg-amber-500/20 text-amber-300"
              : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500"
          }`}
        >
          Custom
        </button>
      </div>

      {amount === "custom" && (
        <input
          type="number"
          placeholder="Enter amount"
          value={customAmount}
          onChange={(e) => { setCustomAmount(e.target.value); setResult(null); }}
          className="w-40 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-amber-500"
        />
      )}

      <button
        type="button"
        onClick={runSim}
        disabled={loading || !firstActive}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500 disabled:opacity-50 transition-colors"
      >
        {loading ? "Calculating…" : "Simulate"}
      </button>

      {result && (
        <div className="rounded-xl border border-green-500/30 bg-green-950/30 p-4 space-y-2">
          <p className="text-sm font-semibold text-green-400">Results</p>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-slate-500">Months Saved</p>
              <p className="text-xl font-bold text-green-400">{result.months_saved}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Interest Saved</p>
              <p className="text-lg font-bold text-green-400">{fmt(result.interest_saved, simCurrency)}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">New Freedom Date</p>
              <p className="text-sm font-bold text-green-400">
                {result.new_freedom_date ? fmtDate(result.new_freedom_date) : "—"}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Add / Edit Debt Modal ──────────────────────────────────────────────────────

type DebtFormData = {
  name: string;
  debt_type: DebtType;
  current_balance: string;
  original_balance: string;
  minimum_payment: string;
  actual_payment: string;
  has_interest: boolean;
  interest_rate: string;
  payment_frequency: "weekly" | "biweekly" | "monthly";
  payment_day: string;
  currency: string;
  is_shared: boolean;
};

type AmortRow = {
  month: number;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
};

type AmortResult = {
  rows: AmortRow[];
  totalInterest: number;
  totalMonths: number;
  payoffDate: string;
  neverClears: boolean;
  monthlyPaymentUsed: number;
};

function calcAmortization(
  balance: number,
  payment: number,
  annualRate: number,
  frequency: "monthly" | "biweekly" | "weekly"
): AmortResult {
  const monthlyRate = annualRate / 100 / 12;
  const perPeriodRate = frequency === "monthly" ? monthlyRate
    : frequency === "biweekly" ? annualRate / 100 / 26
    : annualRate / 100 / 52;
  const periodsPerMonth = frequency === "monthly" ? 1
    : frequency === "biweekly" ? 26 / 12
    : 52 / 12;

  // Run simulation period-by-period, then bucket into months
  const monthBuckets: Record<number, { interest: number; principal: number; payment: number }> = {};
  let remaining = balance;
  let period = 0;
  let neverClears = false;

  while (remaining > 0.005 && period < 1200) {
    period++;
    const interest = remaining * perPeriodRate;
    if (payment <= interest + 0.005) {
      neverClears = true;
      break;
    }
    const principal = Math.min(payment - interest, remaining);
    const monthNum = Math.ceil(period / periodsPerMonth);
    if (!monthBuckets[monthNum]) monthBuckets[monthNum] = { interest: 0, principal: 0, payment: 0 };
    monthBuckets[monthNum].interest += interest;
    monthBuckets[monthNum].principal += principal;
    monthBuckets[monthNum].payment += payment;
    remaining = Math.max(0, remaining - principal);
  }

  const rows: AmortRow[] = [];
  let runningBalance = balance;
  const monthKeys = Object.keys(monthBuckets).map(Number).sort((a, b) => a - b);

  for (const m of monthKeys) {
    const b = monthBuckets[m];
    runningBalance = Math.max(0, runningBalance - b.principal);
    rows.push({
      month: m,
      payment: b.payment,
      interest: b.interest,
      principal: b.principal,
      balance: runningBalance,
    });
  }

  const totalInterest = rows.reduce((s, r) => s + r.interest, 0);
  const totalMonths = rows.length;
  const payoff = new Date();
  payoff.setMonth(payoff.getMonth() + totalMonths);
  const payoffDate = payoff.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
  const monthlyPaymentUsed = frequency === "monthly" ? payment
    : frequency === "biweekly" ? payment * (26 / 12)
    : payment * (52 / 12);

  return { rows, totalInterest, totalMonths, payoffDate, neverClears, monthlyPaymentUsed };
}

function AmortizationPreview({ result, currency, formName }: { result: AmortResult; currency: string; formName: string }) {
  const { rows, totalInterest, totalMonths, payoffDate, neverClears } = result;
  const startBalance = rows[0] ? rows[0].balance + rows[0].principal : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 pb-1 border-b border-slate-700">
        <span className="text-base font-semibold text-slate-100">{formName}</span>
        <span className="text-xs text-slate-500">— Repayment Preview</span>
      </div>

      {neverClears ? (
        <div className="rounded-xl border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-300">
          Your payment does not cover the monthly interest. This debt will never clear at this rate.
          Increase your payment amount or reduce the interest rate.
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Months to Clear</p>
              <p className="text-2xl font-bold text-blue-400">{totalMonths}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {Math.floor(totalMonths / 12)}y {totalMonths % 12}m
              </p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Payoff Date</p>
              <p className="text-lg font-bold text-green-400">{payoffDate}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3 text-center">
              <p className="text-[10px] text-amber-500 uppercase tracking-wide mb-1">Total Interest</p>
              <p className="text-lg font-bold text-amber-400">{fmt(totalInterest, currency)}</p>
            </div>
            <div className="rounded-xl border border-slate-700 bg-slate-800/60 p-3 text-center">
              <p className="text-[10px] text-slate-500 uppercase tracking-wide mb-1">Month 1 Interest</p>
              <p className="text-lg font-bold text-orange-400">{fmt(rows[0]?.interest ?? 0, currency)}</p>
            </div>
          </div>

          {/* Warning for long debts */}
          {totalMonths > 60 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-950/20 px-3 py-2 text-xs text-amber-300">
              This debt takes more than 5 years to clear. Consider increasing your payment to save on interest.
            </div>
          )}

          {/* Interest vs principal bar */}
          <div>
            <div className="flex justify-between text-[10px] text-slate-500 mb-1">
              <span>Principal {fmt(startBalance, currency)}</span>
              <span>Interest {fmt(totalInterest, currency)}</span>
            </div>
            <div className="flex h-2 rounded-full overflow-hidden">
              <div
                className="bg-blue-500"
                style={{ width: `${(startBalance / (startBalance + totalInterest)) * 100}%` }}
              />
              <div className="bg-amber-500 flex-1" />
            </div>
            <div className="flex justify-between text-[10px] text-slate-600 mt-0.5">
              <span>Principal</span>
              <span>Interest</span>
            </div>
          </div>

          {/* Amortization table */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Month-by-Month Breakdown</p>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-700">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-800 z-10">
                  <tr>
                    <th className="text-left px-3 py-2 text-slate-400 font-medium">Mo</th>
                    <th className="text-right px-3 py-2 text-slate-400 font-medium">Payment</th>
                    <th className="text-right px-3 py-2 text-amber-400 font-medium">Interest</th>
                    <th className="text-right px-3 py-2 text-blue-400 font-medium">Principal</th>
                    <th className="text-right px-3 py-2 text-slate-400 font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => {
                    const pctRemaining = startBalance > 0 ? row.balance / startBalance : 0;
                    const isLast = i === rows.length - 1;
                    const rowBg = isLast ? "bg-green-950/40" : i % 2 === 0 ? "bg-slate-900" : "bg-slate-800/40";
                    const balanceColor = isLast ? "text-green-400 font-semibold"
                      : pctRemaining > 0.66 ? "text-red-400"
                      : pctRemaining > 0.33 ? "text-amber-400"
                      : "text-green-400";
                    return (
                      <tr key={row.month} className={rowBg}>
                        <td className={`px-3 py-1.5 ${isLast ? "text-green-300 font-semibold" : "text-slate-400"}`}>
                          {isLast ? `${row.month} ✓` : row.month}
                        </td>
                        <td className="px-3 py-1.5 text-right text-slate-300">{fmt(row.payment, currency)}</td>
                        <td className="px-3 py-1.5 text-right text-amber-400">{fmt(row.interest, currency)}</td>
                        <td className="px-3 py-1.5 text-right text-blue-400">{fmt(row.principal, currency)}</td>
                        <td className={`px-3 py-1.5 text-right ${balanceColor}`}>
                          {row.balance < 0.01 ? "—" : fmt(row.balance, currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-slate-600 mt-1.5">
              Scroll to see all {totalMonths} months · Interest in amber · Principal in blue · Balance shifts red → green
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function hasFormChanged(form: DebtFormData, debt: Debt | null): boolean {
  if (!debt) return true;
  return (
    form.name              !== (debt.name ?? "")                             ||
    form.debt_type         !== (debt.debt_type ?? "personal_loan")           ||
    parseFloat(form.current_balance  || "0") !== (debt.current_balance ?? 0)  ||
    parseFloat(form.original_balance || "0") !== (debt.original_balance ?? 0) ||
    parseFloat(form.minimum_payment  || "0") !== (debt.minimum_payment ?? 0)  ||
    parseFloat(form.actual_payment   || "0") !== (debt.actual_payment ?? 0)   ||
    form.has_interest      !== (debt.has_interest ?? true)                   ||
    parseFloat(form.interest_rate || "0")    !== (debt.interest_rate ?? 0)   ||
    form.payment_frequency !== (debt.payment_frequency ?? "monthly")         ||
    form.payment_day       !== (debt.payment_day ?? "")                      ||
    form.currency          !== (debt.currency ?? "USD")                      ||
    form.is_shared         !== (debt.is_shared ?? false)
  );
}

function DebtModal({
  debt,
  onClose,
  onSave,
}: {
  debt: Debt | null;
  onClose: () => void;
  onSave: (data: DebtFormData) => Promise<void>;
}) {
  const [form, setForm] = useState<DebtFormData>({
    name:              debt?.name ?? "",
    debt_type:         debt?.debt_type ?? "personal_loan",
    current_balance:   String(debt?.current_balance ?? ""),
    original_balance:  String(debt?.original_balance ?? ""),
    minimum_payment:   String(debt?.minimum_payment ?? ""),
    actual_payment:    String(debt?.actual_payment ?? ""),
    has_interest:      debt?.has_interest ?? true,
    interest_rate:     String(debt?.interest_rate ?? ""),
    payment_frequency: (debt?.payment_frequency ?? "monthly") as "weekly"|"biweekly"|"monthly",
    payment_day:       debt?.payment_day ?? "",
    currency:          debt?.currency ?? "USD",
    is_shared:         debt?.is_shared ?? false,
  });
  const [step, setStep] = useState<"form" | "preview">("form");
  const [amort, setAmort] = useState<AmortResult | null>(null);
  const [calcError, setCalcError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const isEdit = debt !== null;
  const changed = hasFormChanged(form, debt);
  const balanceMismatch = isEdit
    && form.original_balance
    && parseFloat(form.current_balance || "0") > parseFloat(form.original_balance || "0");

  function set(k: keyof DebtFormData, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
    // Reset preview if form changes
    if (step === "preview") setStep("form");
  }

  function handleCalculate(e: React.FormEvent) {
    e.preventDefault();
    setCalcError("");
    const balance = parseFloat(form.current_balance);
    const payment = parseFloat(form.actual_payment || form.minimum_payment || "0");
    const rate = form.has_interest ? parseFloat(form.interest_rate || "0") : 0;

    if (!balance || balance <= 0) { setCalcError("Enter a valid current balance."); return; }
    if (!payment || payment <= 0) { setCalcError("Enter actual or minimum payment amount."); return; }

    const result = calcAmortization(balance, payment, rate, form.payment_frequency);
    setAmort(result);
    setStep("preview");
  }

  async function handleConfirmAdd() {
    setSaveError("");
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleEditUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaveError("");
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className={`w-full bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-h-[92vh] overflow-y-auto transition-all ${step === "preview" ? "max-w-2xl" : "max-w-lg"}`}>
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between z-20">
          <div className="flex items-center gap-3">
            {step === "preview" && (
              <button
                type="button"
                onClick={() => setStep("form")}
                className="text-slate-400 hover:text-slate-200 text-sm flex items-center gap-1"
              >
                ← Back
              </button>
            )}
            <h2 className="text-lg font-semibold text-slate-100">
              {isEdit ? "Edit Debt" : step === "form" ? "Add Debt" : "Review & Confirm"}
            </h2>
            {!isEdit && (
              <div className="flex items-center gap-1.5 ml-1">
                <span className={`w-2 h-2 rounded-full ${step === "form" ? "bg-blue-400" : "bg-slate-600"}`} />
                <span className={`w-2 h-2 rounded-full ${step === "preview" ? "bg-green-400" : "bg-slate-600"}`} />
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>

        {/* Step 1 — Form */}
        {step === "form" && (
          <form onSubmit={isEdit && !changed ? handleEditUpdate : handleCalculate} className="p-6 space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs text-slate-400 mb-1">Debt name *</label>
                <input
                  required
                  value={form.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="e.g. Car EMI, Credit Card"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Type *</label>
                <select
                  value={form.debt_type}
                  onChange={(e) => set("debt_type", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  {DEBT_TYPES.map((t) => (
                    <option key={t} value={t}>{DEBT_TYPE_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Currency</label>
                <select
                  value={form.currency}
                  onChange={(e) => set("currency", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Current balance *</label>
                <input
                  required
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.current_balance}
                  onChange={(e) => set("current_balance", e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Original balance</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.original_balance}
                  onChange={(e) => set("original_balance", e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Minimum payment</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.minimum_payment}
                  onChange={(e) => set("minimum_payment", e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Actual payment</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.actual_payment}
                  onChange={(e) => set("actual_payment", e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Payment frequency</label>
                <select
                  value={form.payment_frequency}
                  onChange={(e) => set("payment_frequency", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="biweekly">Bi-weekly</option>
                  <option value="weekly">Weekly</option>
                </select>
              </div>
              {form.payment_frequency === "monthly" && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">
                    Payment due on day <span className="text-blue-400">*</span>
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="1"
                      max="28"
                      value={form.payment_day}
                      onChange={(e) => set("payment_day", e.target.value)}
                      placeholder="e.g. 15"
                      className="w-24 rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    />
                    <span className="text-xs text-slate-500">of each month</span>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">Used to send you payment reminders</p>
                </div>
              )}
              <div className="sm:col-span-2 flex items-center gap-3">
                <input
                  id="has_interest"
                  type="checkbox"
                  checked={form.has_interest}
                  onChange={(e) => set("has_interest", e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="has_interest" className="text-sm text-slate-300">This debt charges interest</label>
              </div>
              {form.has_interest && (
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Interest rate (% per year)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={form.interest_rate}
                    onChange={(e) => set("interest_rate", e.target.value)}
                    placeholder="e.g. 21.5"
                    className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                  />
                </div>
              )}
              <div className="sm:col-span-2 flex items-center gap-3">
                <input
                  id="is_shared"
                  type="checkbox"
                  checked={form.is_shared}
                  onChange={(e) => set("is_shared", e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="is_shared" className="text-sm text-slate-300">Shared debt (joint account)</label>
              </div>
            </div>

            {balanceMismatch && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">
                Current balance is higher than the original balance — please check your numbers.
              </p>
            )}
            {calcError && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{calcError}</p>
            )}
            {saveError && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{saveError}</p>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !!balanceMismatch}
                className={`flex-1 rounded-xl py-2.5 text-sm font-semibold text-white disabled:opacity-50 transition-colors ${
                  isEdit && !changed
                    ? "bg-slate-600 hover:bg-slate-500"
                    : isEdit
                    ? "bg-blue-600 hover:bg-blue-500"
                    : "bg-emerald-600 hover:bg-emerald-500"
                }`}
              >
                {saving
                  ? "Saving…"
                  : isEdit && !changed
                  ? "Update Debt"
                  : isEdit
                  ? "Preview Changes →"
                  : "Calculate & Preview →"}
              </button>
            </div>
          </form>
        )}

        {/* Step 2 — Preview */}
        {step === "preview" && amort && (
          <div className="p-6 space-y-5">
            <AmortizationPreview result={amort} currency={form.currency} formName={form.name || "Debt"} />

            {saveError && (
              <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{saveError}</p>
            )}

            <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 px-4 py-3 text-sm text-blue-300">
              {isEdit
                ? "Review the updated breakdown. If everything looks correct, confirm to save your changes."
                : "Review the breakdown above. If the numbers look correct, confirm to add this debt."
              } Otherwise go back and adjust your details.
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setStep("form")}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500 transition-colors"
              >
                ← Edit Details
              </button>
              <button
                type="button"
                onClick={handleConfirmAdd}
                disabled={saving || amort.neverClears}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {saving
                  ? (isEdit ? "Updating…" : "Adding…")
                  : (isEdit ? "Confirm & Update Debt" : "Confirm & Add Debt")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Log Payment Modal ──────────────────────────────────────────────────────────

function LogPaymentModal({
  debt,
  accountId,
  onClose,
  onDone,
}: {
  debt: Debt;
  accountId: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const defaultAmount = String(debt.actual_payment ?? debt.minimum_payment ?? "");
  const [amount, setAmount] = useState(defaultAmount);
  const [extra, setExtra] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await debtApi.logPayment(accountId, debt.id, {
        amount: parseFloat(amount),
        extra_amount: extra ? parseFloat(extra) : 0,
        payment_date: date,
      });
      onDone();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-sm bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Log Payment</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <p className="text-sm text-slate-400">{debt.name}</p>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Payment amount *</label>
            <input
              required
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Extra amount (optional)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              placeholder="0.00"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Payment date *</label>
            <input
              required
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>
          )}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50"
            >
              {saving ? "Logging…" : "Log Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Debt Card ──────────────────────────────────────────────────────────────────

function DebtCard({
  debt,
  onEdit,
  onLogPayment,
  onDelete,
  onShareToJoint,
  onOpenShared,
}: {
  debt: Debt;
  onEdit: (d: Debt) => void;
  onLogPayment: (d: Debt) => void;
  onDelete: (d: Debt) => void;
  onShareToJoint: (d: Debt) => void;
  onOpenShared: (d: Debt) => void;
}) {
  const paid = debt.original_balance > 0
    ? Math.min(100, Math.round(((debt.original_balance - debt.current_balance) / debt.original_balance) * 100))
    : 0;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      debt.status === "active" ? "border-slate-700 bg-slate-800" : "border-slate-800 bg-slate-900 opacity-70"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100 truncate">{debt.name}</p>
            {debt.is_shared && (
              <span className="shrink-0 text-[10px] font-semibold text-red-400 border border-red-400/40 rounded px-1.5 py-0.5 bg-red-400/10">
                Shared
              </span>
            )}
            {debt.is_locked && (
              <span className="shrink-0 text-[10px] font-semibold text-purple-300 border border-purple-400/40 rounded px-1.5 py-0.5 bg-purple-400/10">
                Locked
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{DEBT_TYPE_LABELS[debt.debt_type]}</p>
          {debt.is_locked && debt.shared_to_debt_id && (
            <p className="mt-1 text-xs text-purple-300">Manage this from Shared Debts.</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-lg font-bold text-red-400">{fmt(debt.current_balance, debt.currency)}</p>
          {debt.interest_rate && (
            <p className="text-xs text-slate-500">{debt.interest_rate}% p.a.</p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{paid}% paid</span>
          <span>of {fmt(debt.original_balance, debt.currency)}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-1.5">
          <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${paid}%` }} />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>
          Min: <span className="text-slate-300">{fmt(debt.minimum_payment ?? 0, debt.currency)}/mo</span>
        </span>
        {debt.actual_payment && (
          <span>
            Actual: <span className="text-blue-400">{fmt(debt.actual_payment, debt.currency)}/mo</span>
          </span>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => onLogPayment(debt)}
          disabled={debt.status !== "active" || debt.is_locked}
          className="flex-1 rounded-lg bg-green-600/20 border border-green-600/30 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-600/30 disabled:opacity-40 transition-colors"
        >
          Log Payment
        </button>
        {debt.is_locked && debt.shared_to_debt_id ? (
          <button
            type="button"
            onClick={() => onOpenShared(debt)}
            className="px-3 rounded-lg bg-purple-600/20 border border-purple-500/30 py-1.5 text-xs font-semibold text-purple-300 hover:bg-purple-600/30 transition-colors"
          >
            Open shared
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onEdit(debt)}
            className="px-3 rounded-lg bg-slate-700 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-600 transition-colors"
          >
            Edit
          </button>
        )}
        {!debt.is_locked && !debt.shared_to_debt_id && (
          <button
            type="button"
            onClick={() => onShareToJoint(debt)}
            className="px-3 rounded-lg bg-blue-600/20 border border-blue-500/30 py-1.5 text-xs font-semibold text-blue-300 hover:bg-blue-600/30 transition-colors"
          >
            Share
          </button>
        )}
        <button
          type="button"
          onClick={() => onDelete(debt)}
          disabled={debt.is_locked}
          className="px-3 rounded-lg bg-red-500/10 border border-red-500/20 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────


export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [freedomDate, setFreedomDate] = useState<FreedomDateResponse | null>(null);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [tab, setTab] = useState<"active" | "cleared">("active");

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const [d, fd, acct] = await Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      debtApi.freedomDate(accountId).catch(() => null),
      accountApi.getAccount(accountId).catch(() => null),
    ]);
    setDebts(d);
    setFreedomDate(fd);

    const bc = acct?.base_currency ?? "USD";
    setBaseCurrency(bc);

    // Fetch USD→X rates for every currency that appears in debts + the base currency
    const uniqueCurrencies = [...new Set([...d.map((debt) => debt.currency), bc])];
    const ratePairs = await Promise.all(
      uniqueCurrencies.map(async (c) => {
        const r = await rateApi.getRate("USD", c).catch(() => ({ rate: null }));
        return [c, r.rate] as [string, number | null];
      }),
    );
    const ratesMap: Record<string, number> = {};
    ratePairs.forEach(([c, r]) => { if (r !== null) ratesMap[c] = r; });
    setRates(ratesMap);

    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: DebtFormData) {
    if (!accountId) return;
    const payload = {
      name:              form.name,
      debt_type:         form.debt_type,
      current_balance:   parseFloat(form.current_balance) || 0,
      original_balance:  parseFloat(form.original_balance) || parseFloat(form.current_balance) || 0,
      minimum_payment:   form.minimum_payment ? parseFloat(form.minimum_payment) : null,
      actual_payment:    form.actual_payment ? parseFloat(form.actual_payment) : null,
      has_interest:      form.has_interest,
      interest_rate:     form.has_interest && form.interest_rate ? parseFloat(form.interest_rate) : null,
      payment_frequency: form.payment_frequency,
      payment_type:      "fixed" as const,
      payment_day:       form.payment_frequency === "monthly" && form.payment_day ? form.payment_day : null,
      months_remaining:  null,
      currency:          form.currency,
      is_shared:         form.is_shared,
    };

    if (editDebt) {
      await debtApi.update(accountId, editDebt.id, payload);
      setEditDebt(null);
    } else {
      await debtApi.create(accountId, payload);
    }
    await load();
  }

  async function handleDelete(debt: Debt) {
    if (!accountId) return;
    if (!confirm(`Delete "${debt.name}"? This cannot be undone.`)) return;
    await debtApi.delete(accountId, debt.id);
    await load();
  }

  async function handleShareToJoint(debt: Debt) {
    if (!accountId) return;
    if (!confirm(`Share "${debt.name}" to your joint account? It will be locked here and editable from Shared Debts.`)) return;
    const result = await debtApi.shareToJoint(accountId, debt.id);
    saveAccountMeta(result.joint_account_id, "joint", "member", true);
    window.location.href = `/shared-debts?debt=${result.joint_debt_id}`;
  }

  function openSharedDebt(debt: Debt) {
    if (!debt.shared_to_account_id || !debt.shared_to_debt_id) return;
    saveAccountMeta(debt.shared_to_account_id, "joint", "member", true);
    window.location.href = `/shared-debts?debt=${debt.shared_to_debt_id}`;
  }

  const activeDebts = debts.filter((d) => d.status === "active");
  const clearedDebts = debts.filter((d) => d.status === "cleared");
  const shown = tab === "active" ? activeDebts : clearedDebts;

  const isMultiCurrency = new Set(activeDebts.map((d) => d.currency)).size > 1;

  const totalBalance = activeDebts.reduce(
    (s, d) => s + convertToBase(d.current_balance, d.currency, baseCurrency, rates), 0,
  );
  const monthlyPayment = activeDebts.reduce(
    (s, d) => s + convertToBase(d.actual_payment ?? d.minimum_payment ?? 0, d.currency, baseCurrency, rates), 0,
  );

  const recommended = freedomDate?.recommended_method ?? "snowball";
  const currency = baseCurrency;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Debt Center</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track, pay, and eliminate every debt</p>
        </div>
        <button
          type="button"
          onClick={() => { setEditDebt(null); setAddModal(true); }}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          + Add Debt
        </button>
      </div>

      {/* Summary stats */}
      {isMultiCurrency && (
        <p className="text-xs text-slate-500 -mb-2">
          Totals converted to {baseCurrency} using live exchange rates
        </p>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Debt</p>
          <p className="text-xl font-bold text-red-400">{isMultiCurrency ? "≈ " : ""}{fmt(totalBalance, baseCurrency)}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Monthly Payment</p>
          <p className="text-xl font-bold text-blue-400">{isMultiCurrency ? "≈ " : ""}{fmt(monthlyPayment, baseCurrency)}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Active Debts</p>
          <p className="text-xl font-bold text-slate-200">{activeDebts.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Cleared</p>
          <p className="text-xl font-bold text-green-400">{clearedDebts.length}</p>
        </div>
      </div>

      {/* Freedom Date — all 3 methods */}
      {freedomDate ? (
        <FreedomDateComparison data={freedomDate} recommended={recommended} currency={currency} />
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800 p-8 text-center">
          <p className="text-slate-400 text-sm">Add debts to see your Freedom Date comparison</p>
        </div>
      )}

      {/* Simulator */}
      {activeDebts.length > 0 && accountId && (
        <Simulator accountId={accountId} debts={activeDebts} />
      )}

      {/* Debt list */}
      <div>
        {/* Tabs */}
        <div className="flex items-center gap-4 mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Your Debts</h2>
          <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setTab("active")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                tab === "active" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              Active ({activeDebts.length})
            </button>
            <button
              type="button"
              onClick={() => setTab("cleared")}
              className={`px-3 py-1.5 font-medium transition-colors ${
                tab === "cleared" ? "bg-green-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              Cleared ({clearedDebts.length})
            </button>
          </div>
        </div>

        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
            <p className="text-slate-500 text-sm mb-3">
              {tab === "active" ? "No active debts — you're clean!" : "No cleared debts yet"}
            </p>
            {tab === "active" && (
              <button
                type="button"
                onClick={() => { setEditDebt(null); setAddModal(true); }}
                className="text-blue-400 text-sm hover:text-blue-300"
              >
                Add your first debt →
              </button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            {shown.map((d) => (
              <DebtCard
                key={d.id}
                debt={d}
                onEdit={(debt) => { setEditDebt(debt); setAddModal(true); }}
                onLogPayment={setPayDebt}
                onDelete={handleDelete}
                onShareToJoint={handleShareToJoint}
                onOpenShared={openSharedDebt}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {addModal && (
        <DebtModal
          debt={editDebt}
          onClose={() => { setAddModal(false); setEditDebt(null); }}
          onSave={handleSave}
        />
      )}
      {payDebt && accountId && (
        <LogPaymentModal
          debt={payDebt}
          accountId={accountId}
          onClose={() => setPayDebt(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
