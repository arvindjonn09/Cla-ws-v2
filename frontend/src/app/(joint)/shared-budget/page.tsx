"use client";
import { useEffect, useState, useCallback } from "react";
import { transactionApi, jointApi } from "@/lib/api";
import { getAccountId, fmt } from "@/lib/utils";
import type { Transaction, SpendingBoundary } from "@/types";
import Link from "next/link";

function getMonthKey(iso: string) { return iso.slice(0, 7); }

export default function SharedBudgetPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [boundaries, setBoundaries] = useState<SpendingBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [t, b] = await Promise.all([
      transactionApi.list(accountId).catch(() => [] as Transaction[]),
      jointApi.listBoundaries(accountId).catch(() => [] as SpendingBoundary[]),
    ]);
    setTxns(t);
    setBoundaries(b);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const allMonths = [...new Set(txns.map((t) => getMonthKey(t.transaction_date)))].sort().reverse();
  const currency = txns[0]?.currency ?? "USD";

  const monthTxns = txns.filter(
    (t) => getMonthKey(t.transaction_date) === selectedMonth && t.type === "expense"
  );

  const totalSpent = monthTxns.reduce((s, t) => s + t.amount, 0);
  const sharedSpent = monthTxns.filter((t) => t.is_shared).reduce((s, t) => s + t.amount, 0);
  const personalSpent = monthTxns.filter((t) => !t.is_shared).reduce((s, t) => s + t.amount, 0);

  // Spending by category vs boundary
  const byCategory = monthTxns.reduce<Record<string, number>>((acc, t) => {
    const cat = t.category ?? "Other";
    acc[cat] = (acc[cat] ?? 0) + t.amount;
    return acc;
  }, {});

  const boundaryMap = boundaries.reduce<Record<string, SpendingBoundary>>((acc, b) => {
    acc[b.category] = b;
    return acc;
  }, {});

  const categories = Object.entries(byCategory).sort(([, a], [, b]) => b - a);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Shared Budget</h1>
        <p className="text-slate-500 text-sm mt-0.5">Joint income allocation and spending by category</p>
      </div>

      {/* Month selector */}
      <select
        className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
        value={selectedMonth}
        onChange={(e) => setSelectedMonth(e.target.value)}
      >
        {allMonths.length > 0
          ? allMonths.map((m) => <option key={m} value={m}>{m}</option>)
          : <option value={selectedMonth}>{selectedMonth}</option>}
      </select>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Total Spent",    value: fmt(totalSpent, currency),    color: "text-red-400"    },
          { label: "Shared",        value: fmt(sharedSpent, currency),   color: "text-purple-400" },
          { label: "Personal",      value: fmt(personalSpent, currency), color: "text-blue-400"   },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Category breakdown with boundaries */}
      {categories.length > 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Spending by Category</h2>
            <Link href="/boundaries" className="text-xs text-purple-400 hover:text-purple-300">Set boundaries →</Link>
          </div>
          <div className="space-y-4">
            {categories.map(([cat, spent]) => {
              const boundary = boundaryMap[cat];
              const pct = totalSpent > 0 ? Math.round((spent / totalSpent) * 100) : 0;
              const classification = boundary?.classification;
              const classColor = classification === "shared" ? "text-purple-400" : classification === "personal" ? "text-blue-400" : "text-amber-400";
              return (
                <div key={cat} className="space-y-1.5">
                  <div className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-slate-300">{cat}</span>
                      {classification && (
                        <span className={`text-xs ${classColor}`}>({classification})</span>
                      )}
                    </div>
                    <span className="text-slate-400">{fmt(spent, currency)} <span className="text-slate-600">·{pct}%</span></span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        classification === "shared" ? "bg-purple-500" :
                        classification === "personal" ? "bg-blue-500" : "bg-amber-500"
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center space-y-2">
          <p className="text-3xl">💰</p>
          <p className="text-slate-400 text-sm">No expenses logged for {selectedMonth}.</p>
        </div>
      )}

      {/* Boundaries reminder */}
      {boundaries.length === 0 && (
        <div className="rounded-xl border border-purple-500/20 bg-purple-950/20 p-4 text-sm text-purple-400">
          Set spending boundaries to classify categories as Shared, Personal, or Grey Zone.{" "}
          <Link href="/boundaries" className="underline hover:no-underline">Set boundaries →</Link>
        </div>
      )}
    </div>
  );
}
