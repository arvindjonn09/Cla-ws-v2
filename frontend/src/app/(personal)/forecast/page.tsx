"use client";
import { useEffect, useState, useCallback } from "react";
import { transactionApi, debtApi } from "@/lib/api";
import { getPersonalAccountId, fmt, fmtDate } from "@/lib/utils";
import type { Transaction, FreedomDateResponse } from "@/types";
import Link from "next/link";

function getMonthKey(iso: string) {
  return iso.slice(0, 7); // "YYYY-MM"
}

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
}

export default function ForecastPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [freedomDate, setFreedomDate] = useState<FreedomDateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getPersonalAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [t, fd] = await Promise.all([
      transactionApi.list(accountId).catch(() => [] as Transaction[]),
      debtApi.freedomDate(accountId).catch(() => null),
    ]);
    setTxns(t);
    setFreedomDate(fd);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // Build monthly buckets from transactions
  const monthly = txns.reduce<Record<string, { income: number; expense: number }>>((acc, t) => {
    const key = getMonthKey(t.transaction_date);
    if (!acc[key]) acc[key] = { income: 0, expense: 0 };
    if (t.type === "income") acc[key].income += t.amount;
    else if (t.type === "expense" || t.type === "debt_payment") acc[key].expense += t.amount;
    return acc;
  }, {});

  const sortedMonths = Object.keys(monthly).sort();
  const lastThree = sortedMonths.slice(-3);

  const avgIncome = lastThree.length
    ? lastThree.reduce((s, k) => s + monthly[k].income, 0) / lastThree.length
    : 0;
  const avgExpense = lastThree.length
    ? lastThree.reduce((s, k) => s + monthly[k].expense, 0) / lastThree.length
    : 0;
  const avgNet = avgIncome - avgExpense;

  // Project next 6 months
  const now = new Date();
  const projected = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    return { key, income: avgIncome, expense: avgExpense, net: avgNet };
  });

  const currency = txns[0]?.currency ?? "USD";

  const rec = freedomDate
    ? (freedomDate[freedomDate.recommended_method as keyof FreedomDateResponse] as { freedom_date: string | null })
    : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Forecast</h1>
        <p className="text-slate-500 text-sm mt-0.5">12-month projection based on your last 3 months</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Avg Monthly Income",  value: fmt(avgIncome, currency),  color: "text-green-400" },
          { label: "Avg Monthly Expense", value: fmt(avgExpense, currency), color: "text-red-400"   },
          { label: "Avg Monthly Net",     value: fmt(avgNet, currency),     color: avgNet >= 0 ? "text-green-400" : "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Freedom date banner */}
      {rec?.freedom_date && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/30 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-blue-400/70 uppercase tracking-widest mb-1">Freedom Date</p>
            <p className="text-lg font-bold text-blue-400">{fmtDate(rec.freedom_date)}</p>
          </div>
          <Link href="/debts" className="text-sm text-blue-400 hover:text-blue-300">View all methods →</Link>
        </div>
      )}

      {/* Historical months */}
      {sortedMonths.length > 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Historical — Actual</h2>
          <div className="space-y-3">
            {sortedMonths.slice(-6).map((key) => {
              const { income, expense } = monthly[key];
              const net = income - expense;
              const maxVal = Math.max(income, expense, 1);
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{monthLabel(key)}</span>
                    <span className={net >= 0 ? "text-green-400" : "text-red-400"}>
                      {net >= 0 ? "+" : ""}{fmt(net, currency)}
                    </span>
                  </div>
                  <div className="flex gap-1 h-2">
                    <div className="bg-green-500 rounded-sm" style={{ width: `${(income / maxVal) * 100}%` }} />
                    <div className="bg-red-500 rounded-sm" style={{ width: `${(expense / maxVal) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span className="text-green-400/60">{fmt(income, currency)}</span>
                    <span className="text-red-400/60">{fmt(expense, currency)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />Income</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Expense</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-500 text-sm">No transaction history yet.</p>
          <Link href="/budget" className="text-blue-400 text-sm hover:text-blue-300 mt-1 block">Log your first transaction →</Link>
        </div>
      )}

      {/* Projected months */}
      {avgIncome > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-1">Projected — Next 6 Months</h2>
          <p className="text-xs text-slate-600 mb-4">Based on 3-month rolling average. Actuals may vary.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-700">
                  <th className="text-left pb-2">Month</th>
                  <th className="text-right pb-2">Income</th>
                  <th className="text-right pb-2">Expenses</th>
                  <th className="text-right pb-2">Net</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {projected.map(({ key, income, expense, net }) => (
                  <tr key={key}>
                    <td className="py-2 text-slate-300">{monthLabel(key)}</td>
                    <td className="py-2 text-right text-green-400">{fmt(income, currency)}</td>
                    <td className="py-2 text-right text-red-400">{fmt(expense, currency)}</td>
                    <td className={`py-2 text-right font-semibold ${net >= 0 ? "text-green-400" : "text-red-400"}`}>
                      {net >= 0 ? "+" : ""}{fmt(net, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        Projections use a 3-month rolling average. Log transactions regularly for accuracy.
      </p>
    </div>
  );
}
