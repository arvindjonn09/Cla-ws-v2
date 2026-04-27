"use client";
import { useEffect, useState, useCallback } from "react";
import { debtApi, transactionApi } from "@/lib/api";
import { getJointAccountId, fmt, fmtDate } from "@/lib/utils";
import type { Debt, Transaction } from "@/types";

export default function PaymentHistoryPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [txns, setTxns] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterDebt, setFilterDebt] = useState<string>("");

  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [d, t] = await Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      transactionApi.list(accountId, { type: "debt_payment" }).catch(() => [] as Transaction[]),
    ]);
    setDebts(d);
    setTxns(t.sort((a, b) => b.transaction_date.localeCompare(a.transaction_date)));
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const currency = txns[0]?.currency ?? debts[0]?.currency ?? "USD";
  const filtered = filterDebt ? txns.filter((t) => t.description?.includes(filterDebt)) : txns;
  const totalPaid = filtered.reduce((s, t) => s + t.amount, 0);

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Payment History</h1>
        <p className="text-slate-500 text-sm mt-0.5">All logged debt payments for this account</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Payments</p>
          <p className="text-xl font-bold text-slate-200">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Total Paid</p>
          <p className="text-xl font-bold text-green-400">{fmt(totalPaid, currency)}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Debts Tracked</p>
          <p className="text-xl font-bold text-purple-400">{debts.length}</p>
        </div>
      </div>

      {/* Filter by debt */}
      {debts.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setFilterDebt("")}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              !filterDebt ? "bg-purple-600 text-white" : "border border-slate-700 text-slate-400 hover:border-slate-500"
            }`}
          >
            All
          </button>
          {debts.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setFilterDebt(d.name)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                filterDebt === d.name ? "bg-purple-600 text-white" : "border border-slate-700 text-slate-400 hover:border-slate-500"
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>
      )}

      {/* Payment log */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center space-y-2">
          <p className="text-3xl">📋</p>
          <p className="text-slate-400 text-sm">No payment history yet.</p>
          <p className="text-slate-600 text-xs">Log payments from the Shared Debts page.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-700">
                <tr className="text-xs text-slate-500">
                  <th className="text-left px-4 py-3">Date</th>
                  <th className="text-left px-4 py-3">Debt / Notes</th>
                  <th className="text-right px-4 py-3">Amount</th>
                  <th className="text-left px-4 py-3">Paid by</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/50">
                {filtered.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-700/20">
                    <td className="px-4 py-3 text-slate-400 whitespace-nowrap">{fmtDate(t.transaction_date)}</td>
                    <td className="px-4 py-3 text-slate-300">{t.description ?? t.category ?? "Debt payment"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-green-400">{fmt(t.amount, t.currency)}</td>
                    <td className="px-4 py-3 text-slate-500 text-xs">{t.user_id ? "Member" : "—"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-slate-700 bg-slate-900/50">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-sm text-slate-400 font-semibold">Total</td>
                  <td className="px-4 py-3 text-right font-bold text-green-400">{fmt(totalPaid, currency)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
