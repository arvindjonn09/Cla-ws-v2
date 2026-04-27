"use client";
import { useEffect, useState } from "react";
import { debtApi } from "@/lib/api";
import { getJointAccountId, daysUntil, fmtDate } from "@/lib/utils";
import type { FreedomDateResponse } from "@/types";

export default function CountdownPage() {
  const [fd, setFd] = useState<FreedomDateResponse|null>(null);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;

  useEffect(() => {
    if (!accountId) return;
    debtApi.freedomDate(accountId).then(setFd).catch(() => null).finally(() => setLoading(false));
  }, [accountId]);

  const rec = fd ? (fd[fd.recommended_method as keyof FreedomDateResponse] as { freedom_date: string|null; months_remaining: number }) : null;
  const days = rec?.freedom_date ? daysUntil(rec.freedom_date) : null;
  const years = days !== null ? Math.floor(days / 365) : null;
  const months = days !== null ? Math.floor((days % 365) / 30) : null;
  const daysRem = days !== null ? Math.floor(days % 30) : null;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" /></div>;

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Countdown</h1>
        <p className="text-slate-500 text-sm mt-0.5">Every day you pay, you get closer</p>
      </div>

      {!rec?.freedom_date ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center">
          <p className="text-4xl mb-3">⏳</p>
          <p className="text-slate-400 text-sm">Add shared debts to start the countdown</p>
        </div>
      ) : (
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-slate-900 p-8 text-center space-y-4">
          <p className="text-xs text-purple-400 uppercase tracking-widest">Freedom Date</p>
          <p className="text-4xl font-bold text-purple-400">{fmtDate(rec.freedom_date)}</p>
          <div className="grid grid-cols-3 gap-4 mt-6">
            {[
              { val: years, label: "Years" },
              { val: months, label: "Months" },
              { val: daysRem, label: "Days" },
            ].map(({ val, label }) => (
              <div key={label} className="rounded-xl border border-purple-500/20 bg-purple-950/30 p-4">
                <p className="text-3xl font-bold text-purple-300">{val ?? 0}</p>
                <p className="text-xs text-slate-500 mt-1">{label}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-400 mt-4">
            {days !== null ? `${days} total days remaining` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
