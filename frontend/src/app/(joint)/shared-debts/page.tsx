"use client";
import { useEffect, useState, useCallback } from "react";
import { debtApi } from "@/lib/api";
import { getAccountId, fmt, fmtDate } from "@/lib/utils";
import type { Debt, DebtType, FreedomDateResponse } from "@/types";

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  credit_card: "Credit Card", personal_loan: "Personal Loan", car_finance: "Car Finance",
  student_loan: "Student Loan", home_loan: "Home Loan", store_account: "Store Account",
  personal: "Personal", other: "Other",
};
const DEBT_TYPES: DebtType[] = ["credit_card","personal_loan","car_finance","student_loan","home_loan","store_account","personal","other"];
const CURRENCIES = ["EUR","USD","INR","AUD"];

type DebtForm = {
  name: string; debt_type: DebtType; current_balance: string; original_balance: string;
  minimum_payment: string; actual_payment: string; has_interest: boolean; interest_rate: string;
  payment_frequency: "weekly"|"biweekly"|"monthly"; currency: string;
};

function DebtModal({ debt, onClose, onSave }: { debt: Debt|null; onClose: ()=>void; onSave: (f:DebtForm)=>Promise<void> }) {
  const [form, setForm] = useState<DebtForm>({
    name: debt?.name??"", debt_type: debt?.debt_type??"personal_loan",
    current_balance: String(debt?.current_balance??""), original_balance: String(debt?.original_balance??""),
    minimum_payment: String(debt?.minimum_payment??""), actual_payment: String(debt?.actual_payment??""),
    has_interest: debt?.has_interest??true, interest_rate: String(debt?.interest_rate??""),
    payment_frequency: (debt?.payment_frequency??"monthly") as "weekly"|"biweekly"|"monthly",
    currency: debt?.currency??"USD",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof DebtForm, v: string|boolean) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { await onSave(form); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-lg bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{debt ? "Edit" : "Add"} Shared Debt</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Name *</label>
              <input required value={form.name} onChange={(e) => set("name", e.target.value)}
                placeholder="e.g. Bond / Home Loan"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select value={form.debt_type} onChange={(e) => set("debt_type", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
                {DEBT_TYPES.map((t) => <option key={t} value={t}>{DEBT_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => set("currency", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current balance *</label>
              <input required type="number" min="0" step="0.01" value={form.current_balance}
                onChange={(e) => set("current_balance", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Original balance</label>
              <input type="number" min="0" step="0.01" value={form.original_balance}
                onChange={(e) => set("original_balance", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Minimum payment</label>
              <input type="number" min="0" step="0.01" value={form.minimum_payment}
                onChange={(e) => set("minimum_payment", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Actual payment</label>
              <input type="number" min="0" step="0.01" value={form.actual_payment}
                onChange={(e) => set("actual_payment", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
            </div>
            <div className="sm:col-span-2 flex items-center gap-3">
              <input id="ji" type="checkbox" checked={form.has_interest} onChange={(e) => set("has_interest", e.target.checked)} className="rounded" />
              <label htmlFor="ji" className="text-sm text-slate-300">Charges interest</label>
            </div>
            {form.has_interest && (
              <div>
                <label className="block text-xs text-slate-400 mb-1">Interest rate (% p.a.)</label>
                <input type="number" min="0" max="100" step="0.01" value={form.interest_rate}
                  onChange={(e) => set("interest_rate", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
              </div>
            )}
          </div>
          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
              {saving ? "Saving…" : debt ? "Update" : "Add Shared Debt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SharedDebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [freedomDate, setFreedomDate] = useState<FreedomDateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editDebt, setEditDebt] = useState<Debt|null>(null);
  const [highlightDebtId, setHighlightDebtId] = useState<string | null>(null);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const [d, fd] = await Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      debtApi.freedomDate(accountId).catch(() => null),
    ]);
    setDebts(d.filter((x) => x.is_shared));
    setFreedomDate(fd);
    setLoading(false);
  }, [accountId]);

  useEffect(() => {
    load();
    const params = new URLSearchParams(window.location.search);
    setHighlightDebtId(params.get("debt"));
  }, [load]);

  async function handleSave(form: DebtForm) {
    if (!accountId) return;
    const payload = {
      name: form.name, debt_type: form.debt_type,
      current_balance: parseFloat(form.current_balance)||0,
      original_balance: parseFloat(form.original_balance)||parseFloat(form.current_balance)||0,
      minimum_payment: form.minimum_payment ? parseFloat(form.minimum_payment) : null,
      actual_payment: form.actual_payment ? parseFloat(form.actual_payment) : null,
      has_interest: form.has_interest,
      interest_rate: form.has_interest && form.interest_rate ? parseFloat(form.interest_rate) : null,
      payment_frequency: form.payment_frequency, payment_type: "fixed" as const,
      payment_day: null, months_remaining: null, currency: form.currency, is_shared: true,
    };
    if (editDebt) await debtApi.update(accountId, editDebt.id, payload);
    else await debtApi.create(accountId, payload);
    await load();
  }

  async function handleDelete(debt: Debt) {
    if (!accountId || !confirm(`Delete "${debt.name}"?`)) return;
    await debtApi.delete(accountId, debt.id);
    await load();
  }

  const rec = freedomDate
    ? (freedomDate[freedomDate.recommended_method as keyof FreedomDateResponse] as { freedom_date: string | null; months_remaining: number })
    : null;
  const totalDebt = debts.reduce((s, d) => s + d.current_balance, 0);
  const currency = debts[0]?.currency ?? "USD";

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" /></div>;

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Shared Debts</h1>
          <p className="text-slate-500 text-sm mt-0.5">Joint liabilities and freedom date</p>
        </div>
        <button type="button" onClick={() => { setEditDebt(null); setModal(true); }}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">
          + Add Shared Debt
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Shared Debt</p>
          <p className="text-xl font-bold text-red-400">{fmt(totalDebt, currency)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${rec?.freedom_date ? "border-purple-500/20 bg-purple-950/20" : "border-slate-700 bg-slate-800"}`}>
          <p className="text-xs text-slate-500 mb-1">Freedom Date</p>
          <p className={`text-lg font-bold ${rec?.freedom_date ? "text-purple-400" : "text-slate-500"}`}>
            {rec?.freedom_date ? fmtDate(rec.freedom_date) : "Add debts"}
          </p>
        </div>
      </div>

      {debts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-500 text-sm mb-3">No shared debts yet</p>
          <button type="button" onClick={() => { setEditDebt(null); setModal(true); }}
            className="text-purple-400 text-sm hover:text-purple-300">Add your first shared debt →</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {debts.map((d) => {
            const paid = d.original_balance > 0
              ? Math.min(100, Math.round(((d.original_balance - d.current_balance) / d.original_balance) * 100)) : 0;
            return (
              <div key={d.id} className={`rounded-xl border p-4 space-y-3 ${
                highlightDebtId === d.id
                  ? "border-purple-400 bg-purple-950/30 ring-1 ring-purple-400/50"
                  : "border-slate-700 bg-slate-800"
              }`}>
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{d.name}</p>
                    <p className="text-xs text-slate-500">{DEBT_TYPE_LABELS[d.debt_type]}</p>
                    {d.shared_from_debt_id && <p className="mt-1 text-xs text-purple-300">Mirrored from personal debt</p>}
                  </div>
                  <p className="text-lg font-bold text-red-400">{fmt(d.current_balance, d.currency)}</p>
                </div>
                <div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${paid}%` }} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{paid}% paid</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setEditDebt(d); setModal(true); }}
                    className="flex-1 rounded-lg bg-slate-700 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-600">Edit</button>
                  <button type="button" onClick={() => handleDelete(d)}
                    className="px-3 rounded-lg bg-red-500/10 border border-red-500/20 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && <DebtModal debt={editDebt} onClose={() => { setModal(false); setEditDebt(null); }} onSave={handleSave} />}
    </div>
  );
}
