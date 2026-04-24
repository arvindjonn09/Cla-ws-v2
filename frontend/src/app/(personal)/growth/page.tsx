"use client";
import { useEffect, useState, useCallback } from "react";
import { debtApi, investmentApi, transactionApi } from "@/lib/api";
import { getAccountId, fmt } from "@/lib/utils";
import type { Debt, Investment, Transaction } from "@/types";

function getMonthKey(iso: string) { return iso.slice(0, 7); }
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
}

export default function GrowthPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [d, i, t] = await Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      investmentApi.list(accountId).catch(() => [] as Investment[]),
      transactionApi.list(accountId).catch(() => [] as Transaction[]),
    ]);
    setDebts(d);
    setInvestments(i);
    setTxns(t);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const currency = debts[0]?.currency ?? investments[0]?.currency ?? "USD";

  const activeDebts = debts.filter((d) => d.status === "active");
  const activeInvs = investments.filter((i) => i.status === "active");

  const totalDebt = activeDebts.reduce((s, d) => s + d.current_balance, 0);
  const totalAssets = activeInvs.reduce((s, i) => s + (i.current_value ?? i.base_currency_value ?? 0), 0);
  const netWorth = totalAssets - totalDebt;

  // Monthly net income from transactions
  const monthlyNet = txns.reduce<Record<string, number>>((acc, t) => {
    const key = getMonthKey(t.transaction_date);
    if (!acc[key]) acc[key] = 0;
    if (t.type === "income") acc[key] += t.amount;
    else if (t.type === "expense" || t.type === "debt_payment") acc[key] -= t.amount;
    return acc;
  }, {});
  const sortedMonths = Object.keys(monthlyNet).sort().slice(-6);

  const originalDebt = debts.reduce((s, d) => s + d.original_balance, 0);
  const debtReduced = originalDebt - totalDebt;
  const debtPaidPct = originalDebt > 0 ? Math.min(100, Math.round((debtReduced / originalDebt) * 100)) : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Growth</h1>
        <p className="text-slate-500 text-sm mt-0.5">Net worth and wealth trajectory</p>
      </div>

      {/* Net worth snapshot */}
      <div className="rounded-2xl border border-green-500/20 bg-gradient-to-br from-green-950/30 to-slate-900 p-6">
        <p className="text-xs text-green-400/70 uppercase tracking-widest mb-1">Current Net Worth</p>
        <p className={`text-4xl font-bold ${netWorth >= 0 ? "text-green-400" : "text-red-400"}`}>
          {fmt(netWorth, currency)}
        </p>
        <div className="flex gap-6 mt-3 text-sm">
          <span className="text-slate-400">Assets: <span className="text-green-400 font-semibold">{fmt(totalAssets, currency)}</span></span>
          <span className="text-slate-400">Debt: <span className="text-red-400 font-semibold">{fmt(totalDebt, currency)}</span></span>
        </div>
      </div>

      {/* Debt reduction progress */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Debt Reduction Progress</h2>
        <div className="flex justify-between text-sm text-slate-400">
          <span>Original: {fmt(originalDebt, currency)}</span>
          <span>Remaining: {fmt(totalDebt, currency)}</span>
        </div>
        <div className="w-full bg-slate-700 rounded-full h-3">
          <div
            className="bg-green-500 h-3 rounded-full transition-all"
            style={{ width: `${debtPaidPct}%` }}
          />
        </div>
        <p className="text-sm text-slate-300">
          <span className="text-green-400 font-bold">{debtPaidPct}%</span> paid off —{" "}
          {fmt(debtReduced, currency)} cleared
        </p>
      </div>

      {/* Asset breakdown */}
      {activeInvs.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Investment Assets</h2>
          {activeInvs.map((inv) => {
            const val = inv.current_value ?? inv.base_currency_value ?? 0;
            const pct = totalAssets > 0 ? Math.round((val / totalAssets) * 100) : 0;
            return (
              <div key={inv.id} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-300">{inv.name}</span>
                  <span className="text-slate-400">{fmt(val, inv.currency)} <span className="text-slate-600">({pct}%)</span></span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Monthly net income history */}
      {sortedMonths.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">Monthly Net Cash Flow</h2>
          <div className="space-y-2">
            {sortedMonths.map((key) => {
              const net = monthlyNet[key];
              return (
                <div key={key} className="flex items-center gap-3">
                  <span className="text-xs text-slate-500 w-12">{monthLabel(key)}</span>
                  <div className="flex-1 relative h-6 flex items-center">
                    <div className="absolute inset-x-0 h-px bg-slate-700" />
                    {net >= 0 ? (
                      <div
                        className="h-4 bg-green-500/70 rounded-r-sm ml-1/2 absolute left-1/2"
                        style={{ width: `${Math.min(50, (net / 20000) * 50)}%` }}
                      />
                    ) : (
                      <div
                        className="h-4 bg-red-500/70 rounded-l-sm absolute right-1/2"
                        style={{ width: `${Math.min(50, (Math.abs(net) / 20000) * 50)}%` }}
                      />
                    )}
                  </div>
                  <span className={`text-xs font-semibold w-24 text-right ${net >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {net >= 0 ? "+" : ""}{fmt(net, currency)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {activeDebts.length === 0 && activeInvs.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center space-y-2">
          <p className="text-4xl">📈</p>
          <p className="text-slate-400 text-sm">Add debts and investments to see your growth trajectory.</p>
        </div>
      )}
    </div>
  );
}
