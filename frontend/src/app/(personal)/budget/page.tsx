"use client";
import { useEffect, useState, useCallback } from "react";
import { transactionApi } from "@/lib/api";
import { getAccountId, fmt } from "@/lib/utils";
import type { Transaction } from "@/types";

const CATEGORIES = [
  "Food & Groceries","Transport","Rent / Mortgage","Utilities","Insurance",
  "Healthcare","Education","Entertainment","Clothing","Personal Care",
  "Debt Payment","Savings","Investment","Transfer","Other",
];

const CATEGORY_ICONS: Record<string, string> = {
  "Food & Groceries": "🛒",
  "Transport": "🚗",
  "Rent / Mortgage": "🏠",
  "Utilities": "💡",
  "Insurance": "🛡",
  "Healthcare": "🏥",
  "Education": "📚",
  "Entertainment": "🎬",
  "Clothing": "👗",
  "Personal Care": "✂",
  "Debt Payment": "⛓",
  "Savings": "💰",
  "Investment": "📈",
  "Transfer": "↔",
  "Other": "📦",
};

function currentMonthRange() {
  const now = new Date();
  const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const end = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${last}`;
  return { start, end };
}

export default function BudgetPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editBudget, setEditBudget] = useState<string | null>(null);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const { start, end } = currentMonthRange();
    const data = await transactionApi.list(accountId, { from: start, to: end }).catch(() => [] as Transaction[]);
    setTransactions(data);
    const stored = localStorage.getItem(`budgets_${accountId}`);
    if (stored) setBudgets(JSON.parse(stored));
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  function saveBudget(cat: string, val: string) {
    if (!accountId) return;
    const updated = { ...budgets, [cat]: val };
    setBudgets(updated);
    localStorage.setItem(`budgets_${accountId}`, JSON.stringify(updated));
    setEditBudget(null);
  }

  const expenses = transactions.filter((t) => t.type === "expense");
  const income = transactions.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const totalSpent = expenses.reduce((s, t) => s + t.amount, 0);
  const currency = transactions[0]?.currency ?? "ZAR";

  const byCategory: Record<string, number> = {};
  for (const tx of expenses) {
    const cat = tx.category ?? "Other";
    byCategory[cat] = (byCategory[cat] ?? 0) + tx.amount;
  }

  const now = new Date();
  const monthLabel = now.toLocaleString("default", { month: "long", year: "numeric" });

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Budget</h1>
        <p className="text-slate-500 text-sm mt-0.5">{monthLabel}</p>
      </div>

      {/* Month summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-green-500/20 bg-green-950/20 p-4">
          <p className="text-xs text-slate-500 mb-1">Income</p>
          <p className="text-xl font-bold text-green-400">{fmt(income, currency)}</p>
        </div>
        <div className="rounded-xl border border-red-500/20 bg-red-950/20 p-4">
          <p className="text-xs text-slate-500 mb-1">Spent</p>
          <p className="text-xl font-bold text-red-400">{fmt(totalSpent, currency)}</p>
        </div>
        <div className={`rounded-xl border p-4 ${income - totalSpent >= 0 ? "border-blue-500/20 bg-blue-950/20" : "border-red-500/20 bg-red-950/20"}`}>
          <p className="text-xs text-slate-500 mb-1">Remaining</p>
          <p className={`text-xl font-bold ${income - totalSpent >= 0 ? "text-blue-400" : "text-red-400"}`}>
            {fmt(income - totalSpent, currency)}
          </p>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">By Category</h2>
          <p className="text-xs text-slate-500">Click budget to edit</p>
        </div>
        <div className="space-y-3">
          {CATEGORIES.map((cat) => {
            const spent = byCategory[cat] ?? 0;
            const budgetVal = parseFloat(budgets[cat] ?? "0");
            const pct = budgetVal > 0 ? Math.min(100, Math.round((spent / budgetVal) * 100)) : 0;
            const over = budgetVal > 0 && spent > budgetVal;
            if (spent === 0 && !budgets[cat]) return null;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{CATEGORY_ICONS[cat] ?? "📦"}</span>
                    <span className="text-sm text-slate-300">{cat}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-sm font-semibold ${over ? "text-red-400" : "text-slate-300"}`}>
                      {fmt(spent, currency)}
                    </span>
                    <span className="text-slate-600">/</span>
                    {editBudget === cat ? (
                      <input
                        type="number"
                        className="w-24 rounded border border-blue-500 bg-slate-900 px-2 py-0.5 text-xs text-white outline-none"
                        defaultValue={budgets[cat] ?? ""}
                        autoFocus
                        onBlur={(e) => saveBudget(cat, e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveBudget(cat, (e.target as HTMLInputElement).value);
                          if (e.key === "Escape") setEditBudget(null);
                        }}
                      />
                    ) : (
                      <button type="button" onClick={() => setEditBudget(cat)}
                        className="text-xs text-slate-500 hover:text-blue-400 w-24 text-right">
                        {budgets[cat] ? fmt(parseFloat(budgets[cat]), currency) : "+ budget"}
                      </button>
                    )}
                  </div>
                </div>
                {budgetVal > 0 && (
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className={`h-1.5 rounded-full transition-all ${over ? "bg-red-500" : pct > 80 ? "bg-amber-500" : "bg-blue-500"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          {Object.keys(byCategory).length === 0 && (
            <p className="text-slate-500 text-sm text-center py-4">No expenses this month</p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-600 text-center">
        Budgets are stored locally per device. Log expenses in Transactions.
      </p>
    </div>
  );
}
