"use client";
import { useEffect, useState, useCallback } from "react";
import { transactionApi } from "@/lib/api";
import { getAccountId, fmt, fmtDate } from "@/lib/utils";
import type { Transaction, TransactionType } from "@/types";

const TYPE_LABELS: Record<TransactionType, string> = {
  income:       "Income",
  expense:      "Expense",
  transfer:     "Transfer",
  debt_payment: "Debt Payment",
};

const TYPE_COLORS: Record<TransactionType, string> = {
  income:       "text-green-400",
  expense:      "text-red-400",
  transfer:     "text-blue-400",
  debt_payment: "text-amber-400",
};

const CATEGORIES = [
  "Food & Groceries","Transport","Rent / Mortgage","Utilities","Insurance",
  "Healthcare","Education","Entertainment","Clothing","Personal Care",
  "Debt Payment","Savings","Investment","Transfer","Other",
];

const CURRENCIES = ["EUR","USD","INR","AUD"];

type TxForm = {
  type: TransactionType;
  amount: string;
  category: string;
  description: string;
  transaction_date: string;
  currency: string;
};

function TxModal({
  tx,
  onClose,
  onSave,
}: {
  tx: Transaction | null;
  onClose: () => void;
  onSave: (f: TxForm) => Promise<void>;
}) {
  const [form, setForm] = useState<TxForm>({
    type:             tx?.type ?? "expense",
    amount:           String(tx?.amount ?? ""),
    category:         tx?.category ?? "Other",
    description:      tx?.description ?? "",
    transaction_date: tx?.transaction_date ?? new Date().toISOString().slice(0, 10),
    currency:         tx?.currency ?? "USD",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof TxForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
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
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{tx ? "Edit Transaction" : "Log Transaction"}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Type *</label>
              <div className="grid grid-cols-4 gap-1">
                {(["income","expense","transfer","debt_payment"] as TransactionType[]).map((t) => (
                  <button key={t} type="button" onClick={() => set("type", t)}
                    className={`rounded-lg py-1.5 text-xs font-medium border transition-colors ${
                      form.type === t ? "border-blue-500 bg-blue-500/20 text-blue-300" : "border-slate-700 bg-slate-800 text-slate-400"
                    }`}>
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amount *</label>
              <input required type="number" min="0.01" step="0.01" value={form.amount}
                onChange={(e) => set("amount", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => set("currency", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select value={form.category} onChange={(e) => set("category", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Date *</label>
              <input required type="date" value={form.transaction_date} onChange={(e) => set("transaction_date", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Description</label>
              <input type="text" value={form.description} onChange={(e) => set("description", e.target.value)}
                placeholder="Optional note"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? "Saving…" : tx ? "Update" : "Log"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState<TransactionType | "all">("all");

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const data = await transactionApi.list(accountId).catch(() => [] as Transaction[]);
    setTransactions(data.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)));
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: TxForm) {
    if (!accountId) return;
    const payload = {
      type:             form.type,
      amount:           parseFloat(form.amount),
      category:         form.category,
      description:      form.description || null,
      transaction_date: form.transaction_date,
      currency:         form.currency,
      is_shared:        false,
      split_type:       null,
      subcategory:      null,
    };
    if (editTx) {
      await transactionApi.update(accountId, editTx.id, payload);
    } else {
      await transactionApi.create(accountId, payload);
    }
    await load();
  }

  async function handleDelete(tx: Transaction) {
    if (!accountId) return;
    if (!confirm("Delete this transaction?")) return;
    await transactionApi.delete(accountId, tx.id);
    await load();
  }

  const shown = filter === "all" ? transactions : transactions.filter((t) => t.type === filter);

  const totals = {
    income: transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0),
    expense: transactions.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0),
  };
  const currency = transactions[0]?.currency ?? "USD";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Transactions</h1>
          <p className="text-slate-500 text-sm mt-0.5">Full income & expense log</p>
        </div>
        <button type="button" onClick={() => { setEditTx(null); setModal(true); }}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
          + Log
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-green-500/20 bg-green-950/20 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Income</p>
          <p className="text-xl font-bold text-green-400">{fmt(totals.income, currency)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Expenses</p>
          <p className="text-xl font-bold text-red-400">{fmt(totals.expense, currency)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(["all","income","expense","transfer","debt_payment"] as const).map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
              filter === f ? "border-blue-500 bg-blue-500/20 text-blue-300" : "border-slate-700 bg-slate-800 text-slate-400 hover:border-slate-600"
            }`}>
            {f === "all" ? "All" : TYPE_LABELS[f as TransactionType]}
          </button>
        ))}
      </div>

      {/* List */}
      {shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-500 text-sm mb-3">No transactions yet</p>
          <button type="button" onClick={() => { setEditTx(null); setModal(true); }}
            className="text-blue-400 text-sm hover:text-blue-300">Log first transaction →</button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          {shown.map((tx, i) => (
            <div key={tx.id} className={`flex items-center gap-4 px-4 py-3 ${i !== 0 ? "border-t border-slate-700" : ""} hover:bg-slate-700/50 group`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-xs font-semibold ${TYPE_COLORS[tx.type]}`}>{TYPE_LABELS[tx.type]}</span>
                  {tx.category && <span className="text-xs text-slate-500">{tx.category}</span>}
                </div>
                <p className="text-sm text-slate-300 truncate">{tx.description ?? "—"}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-semibold ${TYPE_COLORS[tx.type]}`}>
                  {tx.type === "income" ? "+" : "-"}{fmt(tx.amount, tx.currency)}
                </p>
                <p className="text-xs text-slate-500">{fmtDate(tx.transaction_date)}</p>
              </div>
              <div className="hidden group-hover:flex gap-1">
                <button type="button" onClick={() => { setEditTx(tx); setModal(true); }}
                  className="px-2 py-1 rounded text-xs bg-slate-700 text-slate-300 hover:bg-slate-600">Edit</button>
                <button type="button" onClick={() => handleDelete(tx)}
                  className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30">Del</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <TxModal tx={editTx} onClose={() => { setModal(false); setEditTx(null); }} onSave={handleSave} />
      )}
    </div>
  );
}
