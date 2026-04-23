"use client";
import { useEffect, useState, useCallback } from "react";
import { debtApi } from "@/lib/api";
import { getAccountId, fmt, fmtDate, daysUntil } from "@/lib/utils";
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

const CURRENCIES = ["ZAR","USD","GBP","EUR","KES","NGN"];

// ── Freedom Date Comparison ────────────────────────────────────────────────────

function FreedomDateComparison({
  data,
  recommended,
}: {
  data: FreedomDateResponse;
  recommended: string;
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
                    Interest: <span className="text-slate-400">{fmt(result.total_interest_paid, "ZAR")}</span>
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
            +{fmt(p, "ZAR")}/mo
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
              <p className="text-lg font-bold text-green-400">{fmt(result.interest_saved, "ZAR")}</p>
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
  currency: string;
  is_shared: boolean;
};

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
    currency:          debt?.currency ?? "ZAR",
    is_shared:         debt?.is_shared ?? false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof DebtFormData, v: string | boolean) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{debt ? "Edit Debt" : "Add Debt"}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Debt name *</label>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Nedbank Credit Card"
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

          {error && (
            <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>
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
              disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving…" : debt ? "Update" : "Add Debt"}
            </button>
          </div>
        </form>
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
}: {
  debt: Debt;
  onEdit: (d: Debt) => void;
  onLogPayment: (d: Debt) => void;
  onDelete: (d: Debt) => void;
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
          <p className="text-sm font-semibold text-slate-100 truncate">{debt.name}</p>
          <p className="text-xs text-slate-500">{DEBT_TYPE_LABELS[debt.debt_type]}</p>
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
          disabled={debt.status !== "active"}
          className="flex-1 rounded-lg bg-green-600/20 border border-green-600/30 py-1.5 text-xs font-semibold text-green-400 hover:bg-green-600/30 disabled:opacity-40 transition-colors"
        >
          Log Payment
        </button>
        <button
          type="button"
          onClick={() => onEdit(debt)}
          className="px-3 rounded-lg bg-slate-700 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-600 transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={() => onDelete(debt)}
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
  const [loading, setLoading] = useState(true);
  const [addModal, setAddModal] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt | null>(null);
  const [payDebt, setPayDebt] = useState<Debt | null>(null);
  const [tab, setTab] = useState<"active" | "cleared">("active");

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const [d, fd] = await Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      debtApi.freedomDate(accountId).catch(() => null),
    ]);
    setDebts(d);
    setFreedomDate(fd);
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
      payment_day:       null,
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

  const activeDebts = debts.filter((d) => d.status === "active");
  const clearedDebts = debts.filter((d) => d.status === "cleared");
  const shown = tab === "active" ? activeDebts : clearedDebts;

  const totalBalance = activeDebts.reduce((s, d) => s + d.current_balance, 0);
  const monthlyPayment = activeDebts.reduce((s, d) => s + (d.actual_payment ?? d.minimum_payment ?? 0), 0);
  const currency = activeDebts[0]?.currency ?? "ZAR";

  const recommended = freedomDate?.recommended_method ?? "snowball";

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Debt</p>
          <p className="text-xl font-bold text-red-400">{fmt(totalBalance, currency)}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Monthly Payment</p>
          <p className="text-xl font-bold text-blue-400">{fmt(monthlyPayment, currency)}</p>
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
        <FreedomDateComparison data={freedomDate} recommended={recommended} />
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
