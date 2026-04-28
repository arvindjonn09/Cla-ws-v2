"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { transactionApi, debtApi, goalApi } from "@/lib/api";
import { getJointAccountId, fmt, fmtDate, daysUntil } from "@/lib/utils";
import type { Transaction, Debt, Goal, FreedomDateResponse } from "@/types";

function getMonthKey(iso: string) { return iso.slice(0, 7); }

function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-ZA", { month: "short", year: "2-digit" });
}

function addMonths(date: Date, n: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + n, 1);
}

function toMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export default function SharedForecastPage() {
  const [txns,        setTxns]        = useState<Transaction[]>([]);
  const [debts,       setDebts]       = useState<Debt[]>([]);
  const [goals,       setGoals]       = useState<Goal[]>([]);
  const [freedomDate, setFreedomDate] = useState<FreedomDateResponse | null>(null);
  const [loading,     setLoading]     = useState(true);

  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [t, d, g, fd] = await Promise.all([
      transactionApi.list(accountId).catch(() => [] as Transaction[]),
      debtApi.list(accountId).catch(() => [] as Debt[]),
      goalApi.list(accountId).catch(() => [] as Goal[]),
      debtApi.freedomDate(accountId).catch(() => null),
    ]);
    setTxns(t);
    setDebts(d);
    setGoals(g.filter((x) => x.status === "active"));
    setFreedomDate(fd);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  // ── Cash flow: 3-month rolling average ──────────────────────────────────────
  const monthly = txns.reduce<Record<string, { income: number; expense: number }>>((acc, t) => {
    const key = getMonthKey(t.transaction_date);
    if (!acc[key]) acc[key] = { income: 0, expense: 0 };
    if (t.type === "income") acc[key].income += t.amount;
    else if (t.type === "expense" || t.type === "debt_payment") acc[key].expense += t.amount;
    return acc;
  }, {});

  const sortedMonths = Object.keys(monthly).sort();
  const lastThree   = sortedMonths.slice(-3);

  const avgIncome  = lastThree.length ? lastThree.reduce((s, k) => s + monthly[k].income,  0) / lastThree.length : 0;
  const avgExpense = lastThree.length ? lastThree.reduce((s, k) => s + monthly[k].expense, 0) / lastThree.length : 0;
  const avgSurplus = avgIncome - avgExpense;

  const currency = txns[0]?.currency ?? debts[0]?.currency ?? "USD";

  // ── 12-month cash flow projection ───────────────────────────────────────────
  const now = new Date();
  const projected12 = Array.from({ length: 12 }, (_, i) => {
    const d = addMonths(now, i + 1);
    return { key: toMonthKey(d), income: avgIncome, expense: avgExpense, net: avgSurplus };
  });

  // ── Debt paydown projection (month-by-month simulation) ─────────────────────
  const activeDebts = debts.filter((d) => d.status === "active");
  const totalCurrentDebt = activeDebts.reduce((s, d) => s + d.current_balance, 0);
  const totalMonthlyPayment = activeDebts.reduce(
    (s, d) => s + (d.actual_payment ?? d.minimum_payment ?? 0), 0
  );

  // Simulate 12 months of debt reduction (simple: no interest compounding for display)
  const debtProjection = Array.from({ length: 12 }, (_, i) => {
    const balance = Math.max(0, totalCurrentDebt - totalMonthlyPayment * (i + 1));
    return { key: toMonthKey(addMonths(now, i + 1)), balance };
  });

  const rec = freedomDate
    ? (freedomDate[freedomDate.recommended_method as keyof FreedomDateResponse] as {
        freedom_date: string | null; months_remaining: number
      })
    : null;

  // ── Goal completion estimates ────────────────────────────────────────────────
  const goalEstimates = goals.map((g) => {
    const gap = Math.max(0, g.target_amount - g.current_amount);
    const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
    let monthsEst: number | null = null;
    let estDate: string | null = null;
    if (gap <= 0) {
      monthsEst = 0;
    } else if (avgSurplus > 0) {
      monthsEst = Math.ceil(gap / avgSurplus);
      const d = addMonths(now, monthsEst);
      estDate = d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
    }
    return { goal: g, gap, pct, monthsEst, estDate };
  });

  // ── Derived summary ──────────────────────────────────────────────────────────
  const runwayMonths = avgSurplus > 0 ? null : avgExpense > 0
    ? Math.floor((totalCurrentDebt > 0 ? totalCurrentDebt : avgExpense * 3) / Math.abs(avgSurplus))
    : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div>
        <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold">Joint Account</p>
        <h1 className="text-2xl font-bold text-slate-100">Shared Forecast</h1>
        <p className="text-slate-500 text-sm mt-0.5">12-month projection based on your last 3 months of joint activity</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Avg Joint Income",   value: fmt(avgIncome,  currency), color: "text-green-400"  },
          { label: "Avg Joint Expenses", value: fmt(avgExpense, currency), color: "text-red-400"    },
          { label: "Avg Monthly Surplus", value: (avgSurplus >= 0 ? "+" : "") + fmt(avgSurplus, currency),
            color: avgSurplus >= 0 ? "text-green-400" : "text-red-400" },
          { label: "Total Shared Debt",  value: fmt(totalCurrentDebt, currency), color: "text-red-400" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <p className="text-xs text-slate-500 mb-1">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Freedom date + deficit alert */}
      {rec?.freedom_date ? (
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-purple-400/70 uppercase tracking-widest mb-1">Shared Freedom Date</p>
            <p className="text-xl font-bold text-purple-400">{fmtDate(rec.freedom_date)}</p>
            {(() => {
              const days = daysUntil(rec.freedom_date);
              if (!days || days < 0) return null;
              return <p className="text-xs text-slate-500 mt-0.5">{Math.floor(days / 365)}y {Math.floor((days % 365) / 30)}m remaining</p>;
            })()}
          </div>
          <Link href="/shared-debts" className="text-sm text-purple-400 hover:text-purple-300">View debts →</Link>
        </div>
      ) : activeDebts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-4 text-center">
          <p className="text-slate-500 text-sm">Add shared debts to see the freedom date projection.</p>
          <Link href="/shared-debts" className="text-sm text-purple-400 hover:text-purple-300 mt-1 block">Add shared debt →</Link>
        </div>
      ) : null}

      {avgSurplus < 0 && runwayMonths !== null && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-4">
          <p className="text-sm font-semibold text-red-400">⚠ Spending exceeds income by {fmt(Math.abs(avgSurplus), currency)}/mo</p>
          <p className="text-xs text-slate-400 mt-1">At this rate goals cannot advance and debt payoff slows. Review joint spending first.</p>
          <Link href="/shared-budget" className="text-xs text-red-400 hover:text-red-300 mt-2 block">Review joint budget →</Link>
        </div>
      )}

      {/* Historical cash flow */}
      {sortedMonths.length > 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Historical — Actual (last 6 months)</h2>
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
                    <div className="bg-red-500 rounded-sm"   style={{ width: `${(expense / maxVal) * 100}%` }} />
                  </div>
                  <div className="flex justify-between text-xs text-slate-600">
                    <span className="text-green-400/60">{fmt(income, currency)}</span>
                    <span className="text-red-400/60">{fmt(expense, currency)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500 inline-block" />Income</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block" />Expenses</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-500 text-sm">No joint transactions logged yet.</p>
          <Link href="/shared-budget" className="text-purple-400 text-sm hover:text-purple-300 mt-1 block">Log first transaction →</Link>
        </div>
      )}

      {/* 12-month projected cash flow */}
      {avgIncome > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Projected Cash Flow — Next 12 Months</h2>
            <p className="text-xs text-slate-600 mt-1">3-month rolling average extrapolated forward. Actuals will vary.</p>
          </div>
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
                {projected12.map(({ key, income, expense, net }) => (
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

      {/* Debt paydown projection */}
      {activeDebts.length > 0 && totalMonthlyPayment > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Shared Debt Paydown — 12 Months</h2>
            <p className="text-xs text-slate-600 mt-1">
              {fmt(totalMonthlyPayment, currency)}/mo applied across {activeDebts.length} debt{activeDebts.length !== 1 ? "s" : ""}.
              Interest not modelled here — see <Link href="/shared-debts" className="text-purple-400 hover:text-purple-300">freedom date</Link> for full projections.
            </p>
          </div>
          <div className="space-y-2">
            {debtProjection.map(({ key, balance }, i) => {
              const barPct = totalCurrentDebt > 0 ? Math.round((balance / totalCurrentDebt) * 100) : 0;
              const reduced = totalCurrentDebt - balance;
              return (
                <div key={key} className="space-y-0.5">
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>{monthLabel(key)}</span>
                    <span className="text-slate-300">{fmt(balance, currency)} remaining</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div
                      className="bg-purple-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${barPct}%` }}
                    />
                  </div>
                  {i === 11 && reduced > 0 && (
                    <p className="text-xs text-purple-400/70 text-right">{fmt(reduced, currency)} cleared in 12 months</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Goal completion timeline */}
      {goals.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Shared Goal Timeline</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {goalEstimates.map(({ goal, gap, pct, monthsEst, estDate }) => (
              <div key={goal.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-100">{goal.name}</p>
                  <span className="text-xs text-slate-500 shrink-0">{pct}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1.5">
                  <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{fmt(goal.current_amount, goal.currency)}</span>
                  <span>{fmt(goal.target_amount, goal.currency)}</span>
                </div>
                {gap <= 0 ? (
                  <p className="text-xs text-green-400 font-semibold">✓ Goal reached</p>
                ) : estDate ? (
                  <p className="text-xs text-purple-300">
                    Est. complete: <span className="font-semibold">{estDate}</span>
                    <span className="text-slate-500"> ({monthsEst}mo at {fmt(avgSurplus, currency)}/mo surplus)</span>
                  </p>
                ) : (
                  <p className="text-xs text-amber-400">No surplus — goal cannot advance at current pace</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">
        All projections use a 3-month rolling average. Log joint transactions regularly for accuracy.
      </p>
    </div>
  );
}
