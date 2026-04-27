"use client";
import { useEffect, useState, useCallback } from "react";
import { debtApi, investmentApi, accountApi, rateApi } from "@/lib/api";
import { getPersonalAccountId, fmt, convertToBase } from "@/lib/utils";
import type { Debt, Investment } from "@/types";

export default function NetWorthPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [baseCurrency, setBaseCurrency] = useState("USD");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getPersonalAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const [d, i, acct] = await Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      investmentApi.list(accountId).catch(() => [] as Investment[]),
      accountApi.getAccount(accountId).catch(() => null),
    ]);
    setDebts(d);
    setInvestments(i);

    const bc = acct?.base_currency ?? "USD";
    setBaseCurrency(bc);

    const uniqueCurrencies = [
      ...new Set([
        ...d.map((x) => x.currency),
        ...i.map((x) => x.currency),
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Net Worth</h1>
        <p className="text-slate-500 text-sm mt-0.5">Assets minus liabilities</p>
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
