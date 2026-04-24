"use client";
import { useEffect, useState, useCallback } from "react";
import { transactionApi, debtApi, goalApi } from "@/lib/api";
import { getAccountId, fmt } from "@/lib/utils";
import type { Transaction, Debt, Goal } from "@/types";

export default function AnnualReviewPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;
  const currentYear = new Date().getFullYear();

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [t, d, g] = await Promise.all([
      transactionApi.list(accountId).catch(() => [] as Transaction[]),
      debtApi.list(accountId).catch(() => [] as Debt[]),
      goalApi.list(accountId).catch(() => [] as Goal[]),
    ]);
    setTxns(t);
    setDebts(d);
    setGoals(g);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // Filter to current year
  const ytdTxns = txns.filter((t) => t.transaction_date.startsWith(String(currentYear)));
  const currency = ytdTxns[0]?.currency ?? debts[0]?.currency ?? "USD";

  const ytdIncome = ytdTxns.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const ytdExpense = ytdTxns.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const ytdDebtPayments = ytdTxns.filter((t) => t.type === "debt_payment").reduce((s, t) => s + t.amount, 0);
  const ytdNet = ytdIncome - ytdExpense - ytdDebtPayments;

  const debtsCleared = debts.filter(
    (d) => d.status === "cleared" && d.cleared_at?.startsWith(String(currentYear))
  );
  const goalsCompleted = goals.filter(
    (g) => g.status === "completed" && g.updated_at?.startsWith(String(currentYear))
  );

  // Category breakdown
  const byCategory = ytdTxns
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      const cat = t.category ?? "Other";
      acc[cat] = (acc[cat] ?? 0) + t.amount;
      return acc;
    }, {});
  const topCategories = Object.entries(byCategory)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  // Monthly breakdown
  const monthlyIncome = Array.from({ length: 12 }, (_, i) => {
    const key = `${currentYear}-${String(i + 1).padStart(2, "0")}`;
    return ytdTxns.filter((t) => t.transaction_date.startsWith(key) && t.type === "income").reduce((s, t) => s + t.amount, 0);
  });
  const bestMonth = monthlyIncome.indexOf(Math.max(...monthlyIncome));
  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Annual Review</h1>
        <p className="text-slate-500 text-sm mt-0.5">{currentYear} — year-to-date financial summary</p>
      </div>

      {/* YTD stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "YTD Income",        value: fmt(ytdIncome, currency),        color: "text-green-400"  },
          { label: "YTD Expenses",      value: fmt(ytdExpense, currency),       color: "text-red-400"    },
          { label: "Debt Payments",     value: fmt(ytdDebtPayments, currency),  color: "text-amber-400"  },
          { label: "Net Position",      value: fmt(ytdNet, currency),           color: ytdNet >= 0 ? "text-green-400" : "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Milestones */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Milestones This Year</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⛓</span>
              <div>
                <p className="text-sm text-slate-200">Debts Cleared</p>
                <p className="text-xs text-slate-500">{debtsCleared.map((d) => d.name).join(", ") || "None yet"}</p>
              </div>
            </div>
            <span className={`text-2xl font-bold ${debtsCleared.length > 0 ? "text-green-400" : "text-slate-600"}`}>
              {debtsCleared.length}
            </span>
          </div>
          <div className="border-t border-slate-700" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              <div>
                <p className="text-sm text-slate-200">Goals Completed</p>
                <p className="text-xs text-slate-500">{goalsCompleted.map((g) => g.name).join(", ") || "None yet"}</p>
              </div>
            </div>
            <span className={`text-2xl font-bold ${goalsCompleted.length > 0 ? "text-green-400" : "text-slate-600"}`}>
              {goalsCompleted.length}
            </span>
          </div>
          <div className="border-t border-slate-700" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">📝</span>
              <div>
                <p className="text-sm text-slate-200">Transactions Logged</p>
                <p className="text-xs text-slate-500">Total for {currentYear}</p>
              </div>
            </div>
            <span className="text-2xl font-bold text-slate-300">{ytdTxns.length}</span>
          </div>
        </div>
      </div>

      {/* Best month */}
      {ytdIncome > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 flex items-center gap-4">
          <span className="text-3xl">🏆</span>
          <div>
            <p className="text-sm font-semibold text-amber-400">Best Income Month</p>
            <p className="text-slate-300 text-sm mt-0.5">
              {MONTHS[bestMonth]} — {fmt(monthlyIncome[bestMonth], currency)}
            </p>
          </div>
        </div>
      )}

      {/* Top spend categories */}
      {topCategories.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Top Spending Categories</h2>
          <div className="space-y-3">
            {topCategories.map(([cat, total]) => {
              const pct = ytdExpense > 0 ? Math.round((total / ytdExpense) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{cat}</span>
                    <span className="text-slate-400">{fmt(total, currency)} <span className="text-slate-600">({pct}%)</span></span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="bg-amber-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Monthly income bar chart */}
      {ytdIncome > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Monthly Income — {currentYear}</h2>
          <div className="flex items-end gap-1 h-24">
            {monthlyIncome.map((inc, i) => {
              const max = Math.max(...monthlyIncome, 1);
              const height = Math.round((inc / max) * 100);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={`w-full rounded-t-sm transition-all ${i === bestMonth ? "bg-amber-500" : "bg-blue-500/50"}`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-xs text-slate-600">{MONTHS[i]}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {ytdTxns.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center space-y-2">
          <p className="text-3xl">🏆</p>
          <p className="text-slate-400 text-sm">No transactions logged for {currentYear} yet.</p>
          <p className="text-slate-600 text-xs">Log income and expenses in Budget to see your annual review.</p>
        </div>
      )}
    </div>
  );
}
