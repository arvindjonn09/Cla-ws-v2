"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { debtApi, investmentApi, accountApi, rateApi, goalApi, transactionApi } from "@/lib/api";
import { getPersonalAccountId, fmt, convertToBase, assetTypeLabel } from "@/lib/utils";
import type { Debt, Goal, Investment, Transaction } from "@/types";

function getMonthKey(iso: string) {
  return iso.slice(0, 7);
}

export default function NetWorthPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getPersonalAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) {
      setLoading(false);
      return;
    }
    const [d, i, g, t, acct] = await Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      investmentApi.list(accountId).catch(() => [] as Investment[]),
      goalApi.list(accountId).catch(() => [] as Goal[]),
      transactionApi.list(accountId).catch(() => [] as Transaction[]),
      accountApi.getAccount(accountId).catch(() => null),
    ]);
    setDebts(d);
    setInvestments(i);
    setGoals(g);
    setTxns(t);

    const bc = acct?.base_currency ?? "USD";
    setBaseCurrency(bc);

    const uniqueCurrencies = [
      ...new Set([
        ...d.map((x) => x.currency),
        ...i.map((x) => x.currency),
        ...g.map((x) => x.currency),
        ...t.map((x) => x.currency),
        bc,
      ]),
    ];
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

  const activeDebts = debts.filter((d) => d.status === "active");
  const activeInvs  = investments.filter((i) => i.status === "active");

  const isMultiCurrency = new Set([
    ...activeDebts.map((d) => d.currency),
    ...activeInvs.map((i) => i.currency),
  ]).size > 1;

  const totalDebt   = activeDebts.reduce((s, d) => s + convertToBase(d.current_balance, d.currency, baseCurrency, rates), 0);
  const totalAssets = activeInvs.reduce((s, i)  => s + convertToBase(i.current_value ?? 0, i.currency, baseCurrency, rates), 0);
  const netWorth    = totalAssets - totalDebt;
  const currency    = baseCurrency;

  const monthly = txns.reduce<Record<string, { income: number; expense: number }>>((acc, txn) => {
    const key = getMonthKey(txn.transaction_date);
    if (!acc[key]) acc[key] = { income: 0, expense: 0 };

    const amount = convertToBase(txn.amount, txn.currency, baseCurrency, rates);
    if (txn.type === "income") acc[key].income += amount;
    if (txn.type === "expense" || txn.type === "debt_payment") acc[key].expense += amount;
    return acc;
  }, {});

  const recentMonths = Object.keys(monthly).sort().slice(-3);
  const avgIncome = recentMonths.length
    ? recentMonths.reduce((sum, key) => sum + monthly[key].income, 0) / recentMonths.length
    : 0;
  const avgExpense = recentMonths.length
    ? recentMonths.reduce((sum, key) => sum + monthly[key].expense, 0) / recentMonths.length
    : 0;
  const avgSurplus = avgIncome - avgExpense;

  const emergencyGoal =
    goals.find((g) => g.goal_type === "emergency_fund" && g.status === "active")
    ?? goals.find((g) => g.goal_type === "emergency_fund" && g.status !== "completed")
    ?? null;
  const emergencySaved = emergencyGoal
    ? convertToBase(emergencyGoal.current_amount, emergencyGoal.currency, baseCurrency, rates)
    : 0;
  const emergencyTarget = emergencyGoal
    ? convertToBase(emergencyGoal.target_amount, emergencyGoal.currency, baseCurrency, rates)
    : 0;
  const emergencyCoverageMonths = avgExpense > 0 ? emergencySaved / avgExpense : 0;
  const emergencyGap = Math.max(0, emergencyTarget - emergencySaved);
  const monthsToFundEmergency = avgSurplus > 0 ? Math.ceil(emergencyGap / avgSurplus) : null;

  const assetTypeTotals = activeInvs.reduce<Record<string, number>>((acc, inv) => {
    const value = convertToBase(inv.current_value ?? 0, inv.currency, baseCurrency, rates);
    acc[inv.asset_type] = (acc[inv.asset_type] ?? 0) + value;
    return acc;
  }, {});
  const topAssetType = Object.entries(assetTypeTotals).sort((a, b) => b[1] - a[1])[0] ?? null;
  const topAssetConcentration = topAssetType && totalAssets > 0
    ? Math.round((topAssetType[1] / totalAssets) * 100)
    : 0;
  const assetTypeCount = Object.keys(assetTypeTotals).length;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Net Worth</h1>
        <p className="text-slate-500 text-sm mt-0.5">Assets minus liabilities, with planning signals from your cash flow</p>
      </div>

      {/* Net worth hero */}
      <div className={`rounded-2xl border p-8 text-center space-y-2 ${
        netWorth >= 0 ? "border-green-500/30 bg-green-950/20" : "border-red-500/30 bg-red-950/20"
      }`}>
        <p className="text-sm text-slate-400 uppercase tracking-widest">Net Worth</p>
        <p className={`text-5xl font-bold ${netWorth >= 0 ? "text-green-400" : "text-red-400"}`}>
          {isMultiCurrency ? "≈ " : ""}{fmt(Math.abs(netWorth), currency)}
        </p>
        {netWorth < 0 && <p className="text-sm text-red-400">negative</p>}
        {isMultiCurrency && <p className="text-xs text-slate-500">converted to {baseCurrency} using live exchange rates</p>}
      </div>

      {/* Breakdown */}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="rounded-xl border border-green-500/20 bg-slate-800 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-green-400 uppercase tracking-wide">Assets</h2>
          <p className="text-2xl font-bold text-green-400">{isMultiCurrency ? "≈ " : ""}{fmt(totalAssets, currency)}</p>
          {activeInvs.length === 0 ? (
            <p className="text-xs text-slate-500">No investments logged yet</p>
          ) : (
            <div className="space-y-2">
              {activeInvs.map((inv) => (
                <div key={inv.id} className="flex justify-between text-sm">
                  <span className="text-slate-400 truncate">{inv.name}</span>
                  <span className="text-slate-300">{fmt(inv.current_value ?? 0, inv.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-red-500/20 bg-slate-800 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide">Liabilities</h2>
          <p className="text-2xl font-bold text-red-400">{isMultiCurrency ? "≈ " : ""}{fmt(totalDebt, currency)}</p>
          {activeDebts.length === 0 ? (
            <p className="text-xs text-slate-500">No active debts</p>
          ) : (
            <div className="space-y-2">
              {activeDebts.map((d) => (
                <div key={d.id} className="flex justify-between text-sm">
                  <span className="text-slate-400 truncate">{d.name}</span>
                  <span className="text-slate-300">{fmt(d.current_balance, d.currency)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Workbook-inspired planning insights */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Planning Insights</h2>
            <p className="text-xs text-slate-600 mt-1">
              Emergency buffer, savings pace, and portfolio balance — calculated from your logged data.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <div className="rounded-xl border border-amber-500/20 bg-slate-800 p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-400">Emergency Buffer</p>
            {emergencyGoal ? (
              <>
                <p className="text-2xl font-bold text-slate-100">{emergencyCoverageMonths.toFixed(1)} months</p>
                <p className="text-sm text-slate-400">
                  {fmt(emergencySaved, currency)} saved against average monthly spending of {fmt(avgExpense, currency)}.
                </p>
                <p className="text-xs text-slate-500">
                  Goal progress: {fmt(emergencySaved, currency)} / {fmt(emergencyTarget, currency)}
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-100">No goal yet</p>
                <p className="text-sm text-slate-400">Set a target and track how many months of expenses you can cover.</p>
                <Link href="/goals" className="inline-block text-xs text-blue-400 hover:text-blue-300">
                  Create emergency fund goal →
                </Link>
              </>
            )}
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-slate-800 p-5 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-400">Monthly Surplus Pace</p>
            <p className={`text-2xl font-bold ${avgSurplus >= 0 ? "text-green-400" : "text-red-400"}`}>
              {avgSurplus >= 0 ? "+" : ""}{fmt(avgSurplus, currency)}
            </p>
            <p className="text-sm text-slate-400">
              Based on your last {recentMonths.length || 0} month{recentMonths.length === 1 ? "" : "s"} of logged cash flow.
            </p>
            {emergencyGoal && emergencyGap > 0 ? (
              <p className="text-xs text-slate-500">
                At this pace, your emergency-fund gap closes in {monthsToFundEmergency ?? "?"} month{monthsToFundEmergency === 1 ? "" : "s"}.
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                Log income and expenses regularly to keep this number accurate.
              </p>
            )}
          </div>

          <div className="rounded-xl border border-purple-500/20 bg-slate-800 p-5 space-y-2 sm:col-span-2 xl:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-purple-400">Diversification Check</p>
            {topAssetType ? (
              <>
                <p className="text-2xl font-bold text-slate-100">{assetTypeCount} asset type{assetTypeCount === 1 ? "" : "s"}</p>
                <p className="text-sm text-slate-400">
                  Largest allocation: {assetTypeLabel(topAssetType[0])} at {topAssetConcentration}% of assets.
                </p>
                <p className="text-xs text-slate-500">
                  Concentration above 70% in one asset type is worth reviewing.
                </p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-slate-100">No assets yet</p>
                <p className="text-sm text-slate-400">Once investments are added, we can surface concentration and diversification risk here.</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ratio bar */}
      {(totalAssets + totalDebt) > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-2">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Asset to Debt Ratio</h2>
          <div className="flex gap-1 h-4 rounded-full overflow-hidden">
            <div
              className="bg-green-500 h-full transition-all"
              style={{ width: `${Math.round((totalAssets / (totalAssets + totalDebt)) * 100)}%` }}
            />
            <div
              className="bg-red-500 h-full transition-all"
              style={{ width: `${Math.round((totalDebt / (totalAssets + totalDebt)) * 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span className="text-green-400">Assets {totalAssets + totalDebt > 0 ? Math.round((totalAssets / (totalAssets + totalDebt)) * 100) : 0}%</span>
            <span className="text-red-400">{totalAssets + totalDebt > 0 ? Math.round((totalDebt / (totalAssets + totalDebt)) * 100) : 0}% Debt</span>
          </div>
        </div>
      )}
    </div>
  );
}
