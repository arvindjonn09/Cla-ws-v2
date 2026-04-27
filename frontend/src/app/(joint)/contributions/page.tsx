"use client";
import { useEffect, useState, useCallback } from "react";
import { transactionApi, debtApi } from "@/lib/api";
import { getJointAccountId, fmt } from "@/lib/utils";
import type { Transaction, Debt } from "@/types";

function getMonthKey(iso: string) { return iso.slice(0, 7); }
function monthLabel(key: string) {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
}

export default function ContributionsPage() {
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState<string>("");

  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;
  const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = userRaw ? JSON.parse(userRaw) : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [t, d] = await Promise.all([
      transactionApi.list(accountId).catch(() => [] as Transaction[]),
      debtApi.list(accountId).catch(() => [] as Debt[]),
    ]);
    setTxns(t);
    setDebts(d);
    const months = [...new Set(t.map((x) => getMonthKey(x.transaction_date)))].sort().reverse();
    if (months.length > 0) setSelectedMonth(months[0]);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const currency = txns[0]?.currency ?? debts[0]?.currency ?? "USD";
  const allMonths = [...new Set(txns.map((t) => getMonthKey(t.transaction_date)))].sort().reverse();

  const filtered = txns.filter(
    (t) => !selectedMonth || getMonthKey(t.transaction_date) === selectedMonth
  );

  // Split by user: transactions have user_id; shared vs personal
  const shared = filtered.filter((t) => t.is_shared && t.type === "expense");
  const debtPayments = filtered.filter((t) => t.type === "debt_payment");

  const myId = user?.id ?? null;
  const myShared = shared.filter((t) => t.user_id === myId).reduce((s, t) => s + t.amount, 0);
  const partnerShared = shared.filter((t) => t.user_id !== myId && t.user_id !== null).reduce((s, t) => s + t.amount, 0);
  const totalShared = myShared + partnerShared;

  const myDebt = debtPayments.filter((t) => t.user_id === myId).reduce((s, t) => s + t.amount, 0);
  const partnerDebt = debtPayments.filter((t) => t.user_id !== myId && t.user_id !== null).reduce((s, t) => s + t.amount, 0);
  const totalDebt = myDebt + partnerDebt;

  const myPct = totalShared > 0 ? Math.round((myShared / totalShared) * 100) : 50;
  const partnerPct = 100 - myPct;

  const myDebtPct = totalDebt > 0 ? Math.round((myDebt / totalDebt) * 100) : 50;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Contributions</h1>
        <p className="text-slate-500 text-sm mt-0.5">Who paid what — split contribution tracking</p>
      </div>

      {/* Month selector */}
      {allMonths.length > 0 && (
        <select
          className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
        >
          <option value="">All time</option>
          {allMonths.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      )}

      {/* Shared expenses split */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Shared Expenses</h2>
        <div className="flex justify-between text-sm">
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">You</p>
            <p className="text-lg font-bold text-purple-400">{fmt(myShared, currency)}</p>
            <p className="text-xs text-slate-500">{myPct}%</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">Total</p>
            <p className="text-lg font-bold text-slate-200">{fmt(totalShared, currency)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">Partner</p>
            <p className="text-lg font-bold text-blue-400">{fmt(partnerShared, currency)}</p>
            <p className="text-xs text-slate-500">{partnerPct}%</p>
          </div>
        </div>
        {totalShared > 0 && (
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-purple-500 transition-all" style={{ width: `${myPct}%` }} />
            <div className="bg-blue-500 transition-all" style={{ width: `${partnerPct}%` }} />
          </div>
        )}
        {totalShared === 0 && (
          <p className="text-xs text-slate-600 text-center">No shared expenses logged for this period.</p>
        )}
      </div>

      {/* Debt payment split */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Debt Payments</h2>
        <div className="flex justify-between text-sm">
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">You</p>
            <p className="text-lg font-bold text-purple-400">{fmt(myDebt, currency)}</p>
            <p className="text-xs text-slate-500">{myDebtPct}%</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">Total</p>
            <p className="text-lg font-bold text-slate-200">{fmt(totalDebt, currency)}</p>
          </div>
          <div className="text-center">
            <p className="text-slate-500 text-xs mb-1">Partner</p>
            <p className="text-lg font-bold text-blue-400">{fmt(partnerDebt, currency)}</p>
            <p className="text-xs text-slate-500">{100 - myDebtPct}%</p>
          </div>
        </div>
        {totalDebt > 0 && (
          <div className="flex h-3 rounded-full overflow-hidden">
            <div className="bg-purple-500 transition-all" style={{ width: `${myDebtPct}%` }} />
            <div className="bg-blue-500 transition-all" style={{ width: `${100 - myDebtPct}%` }} />
          </div>
        )}
        {totalDebt === 0 && (
          <p className="text-xs text-slate-600 text-center">No debt payments logged for this period.</p>
        )}
      </div>

      {/* Recent shared transactions */}
      {shared.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">
            Shared Transactions ({selectedMonth ? monthLabel(selectedMonth) : "All time"})
          </h2>
          <div className="space-y-2">
            {shared.slice(0, 10).map((t) => (
              <div key={t.id} className="flex justify-between items-center text-sm py-1 border-b border-slate-700/50 last:border-0">
                <div>
                  <p className="text-slate-300">{t.description ?? t.category ?? "Expense"}</p>
                  <p className="text-xs text-slate-600">{t.transaction_date}</p>
                </div>
                <div className="text-right">
                  <p className="text-red-400 font-semibold">{fmt(t.amount, t.currency)}</p>
                  <p className="text-xs text-slate-600">
                    {t.user_id === myId ? "You" : "Partner"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {txns.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center space-y-2">
          <p className="text-3xl">📊</p>
          <p className="text-slate-400 text-sm">No transactions logged yet for this account.</p>
          <p className="text-slate-600 text-xs">Log shared expenses to see contribution splits here.</p>
        </div>
      )}
    </div>
  );
}
