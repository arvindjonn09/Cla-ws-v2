"use client";
import { useEffect, useState, useCallback } from "react";
import { jointApi } from "@/lib/api";
import { getAccountId, fmtDate } from "@/lib/utils";
import type { PaymentWarning } from "@/types";

const WARNING_LABELS: Record<string, string> = {
  "30_day":      "30 days before due",
  "7_day":       "7 days before due",
  "4_day":       "4 days before due",
  "3_day":       "3 days before due",
  "1_day":       "1 day before due",
  "payment_day": "Payment day",
  "3_day_after": "3 days after (missed)",
};

const WARNING_COLORS: Record<string, string> = {
  "30_day":      "border-blue-500/30 bg-blue-950/20 text-blue-400",
  "7_day":       "border-amber-500/30 bg-amber-950/20 text-amber-400",
  "4_day":       "border-orange-500/30 bg-orange-950/20 text-orange-400",
  "3_day":       "border-orange-500/30 bg-orange-950/20 text-orange-400",
  "1_day":       "border-red-500/30 bg-red-950/20 text-red-400",
  "payment_day": "border-red-500/30 bg-red-950/20 text-red-400",
  "3_day_after": "border-red-800/30 bg-red-950/40 text-red-500",
};

export default function PaymentWarningsPage() {
  const [warnings, setWarnings] = useState<PaymentWarning[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const data = await jointApi.listWarnings(accountId).catch(() => [] as PaymentWarning[]);
    setWarnings(data.sort((a, b) => a.due_date.localeCompare(b.due_date)));
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function confirm(warning: PaymentWarning) {
    if (!accountId) return;
    await jointApi.confirmWarning(accountId, warning.id).catch(() => null);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" /></div>;

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Payment Warnings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Both partners must confirm each warning</p>
      </div>

      {warnings.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-500 text-sm">No payment warnings — you&apos;re on track!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {warnings.map((w) => {
            const bothConfirmed = w.member_a_confirmed && w.member_b_confirmed;
            const colorClass = WARNING_COLORS[w.warning_type] ?? "border-slate-700 bg-slate-800 text-slate-400";
            return (
              <div key={w.id} className={`rounded-xl border p-4 space-y-3 ${colorClass}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{WARNING_LABELS[w.warning_type] ?? w.warning_type}</p>
                    <p className="text-xs opacity-70 mt-0.5">Due: {fmtDate(w.due_date)}</p>
                  </div>
                  {bothConfirmed ? (
                    <span className="text-xs font-bold text-green-400 bg-green-500/20 px-2 py-1 rounded">Both confirmed</span>
                  ) : (
                    <button type="button" onClick={() => confirm(w)}
                      className="text-xs font-semibold bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-colors">
                      Confirm
                    </button>
                  )}
                </div>
                <div className="flex gap-4 text-xs opacity-70">
                  <span>Partner A: {w.member_a_confirmed ? "✓ Confirmed" : "⏳ Pending"}</span>
                  <span>Partner B: {w.member_b_confirmed ? "✓ Confirmed" : "⏳ Pending"}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
