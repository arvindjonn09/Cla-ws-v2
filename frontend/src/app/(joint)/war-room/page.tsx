"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { debtApi, goalApi, jointApi } from "@/lib/api";
import { getAccountId, fmt, fmtDate, daysUntil } from "@/lib/utils";
import type { Debt, Goal, PaymentWarning, FreedomDateResponse } from "@/types";

export default function WarRoomPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [warnings, setWarnings] = useState<PaymentWarning[]>([]);
  const [freedomDate, setFreedomDate] = useState<FreedomDateResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      goalApi.list(accountId).catch(() => [] as Goal[]),
      jointApi.listWarnings(accountId).catch(() => [] as PaymentWarning[]),
      debtApi.freedomDate(accountId).catch(() => null),
    ]).then(([d, g, w, fd]) => {
      setDebts(d);
      setGoals(g.filter((x) => x.status === "active"));
      setWarnings(w.slice(0, 3));
      setFreedomDate(fd);
    }).finally(() => setLoading(false));
  }, [accountId]);

  const activeDebts = debts.filter((d) => d.status === "active");
  const totalDebt = activeDebts.reduce((s, d) => s + d.current_balance, 0);
  const currency = activeDebts[0]?.currency ?? "USD";

  const rec = freedomDate
    ? (freedomDate[freedomDate.recommended_method as keyof FreedomDateResponse] as { freedom_date: string | null; months_remaining: number })
    : null;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-xs text-purple-400 uppercase tracking-widest font-semibold">Joint Account</p>
        <h1 className="text-2xl font-bold text-slate-100">War Room</h1>
        <p className="text-slate-500 text-sm mt-0.5">Command centre for your shared financial mission</p>
      </div>

      {/* Freedom Date */}
      {rec?.freedom_date ? (
        <div className="rounded-2xl border border-purple-500/30 bg-gradient-to-br from-purple-950/50 to-slate-900 p-6">
          <p className="text-xs text-purple-400/70 uppercase tracking-widest mb-1">Shared Freedom Date</p>
          <p className="text-3xl font-bold text-purple-400">{fmtDate(rec.freedom_date)}</p>
          {(() => {
            const days = daysUntil(rec.freedom_date);
            if (!days) return null;
            return <p className="text-slate-400 mt-1 text-sm">{Math.floor(days / 365)}y {Math.floor((days % 365) / 30)}m remaining</p>;
          })()}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-700 bg-slate-800 p-6 text-center">
          <p className="text-slate-400 text-sm">Add shared debts to see your Freedom Date</p>
          <Link href="/shared-debts" className="text-sm text-purple-400 hover:text-purple-300 mt-1 block">Add shared debt →</Link>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Shared Debt</p>
          <p className="text-xl font-bold text-red-400">{fmt(totalDebt, currency)}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Active Debts</p>
          <p className="text-xl font-bold text-slate-200">{activeDebts.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Shared Goals</p>
          <p className="text-xl font-bold text-green-400">{goals.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Warnings</p>
          <p className={`text-xl font-bold ${warnings.length > 0 ? "text-amber-400" : "text-slate-400"}`}>{warnings.length}</p>
        </div>
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-amber-400 uppercase tracking-wide">Payment Warnings</h2>
            <Link href="/payment-warnings" className="text-xs text-amber-400 hover:text-amber-300">View all →</Link>
          </div>
          {warnings.map((w) => (
            <div key={w.id} className="flex items-center justify-between text-sm">
              <span className="text-slate-300">{w.warning_type.replace(/_/g, " ")} warning</span>
              <span className="text-slate-500">{fmtDate(w.due_date)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/shared-debts",      label: "Shared Debts",   icon: "⛓"  },
          { href: "/safe-space",         label: "Safe Space",     icon: "💬" },
          { href: "/boundaries",         label: "Boundaries",     icon: "🗂"  },
          { href: "/payment-warnings",   label: "Warnings",       icon: "⚠"  },
        ].map(({ href, label, icon }) => (
          <Link key={href} href={href}
            className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-center hover:border-slate-500 transition-colors">
            <span className="text-2xl">{icon}</span>
            <p className="text-xs text-slate-400 mt-2">{label}</p>
          </Link>
        ))}
      </div>

      {/* Goals */}
      {goals.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Shared Goals</h2>
            <Link href="/shared-goals" className="text-xs text-purple-400 hover:text-purple-300">View all</Link>
          </div>
          <div className="grid sm:grid-cols-2 gap-3">
            {goals.slice(0, 4).map((g) => {
              const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
              return (
                <div key={g.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
                  <div className="flex justify-between">
                    <p className="text-sm font-medium text-slate-200">{g.name}</p>
                    <span className="text-xs text-slate-500">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
