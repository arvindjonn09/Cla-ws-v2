"use client";
import { useEffect, useState } from "react";
import { goalApi } from "@/lib/api";
import { getPersonalAccountId, fmt } from "@/lib/utils";
import type { Goal } from "@/types";
import Link from "next/link";

export default function EmergencyFundPage() {
  const [efGoal, setEfGoal] = useState<Goal | null>(null);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getPersonalAccountId() : null;

  useEffect(() => {
    if (!accountId) return;
    goalApi.list(accountId).then((goals) => {
      const ef = goals.find((g) => g.goal_type === "emergency_fund" && g.status !== "completed") ?? null;
      setEfGoal(ef);
    }).catch(() => null).finally(() => setLoading(false));
  }, [accountId]);

  const pct = efGoal && efGoal.target_amount > 0
    ? Math.min(100, Math.round((efGoal.current_amount / efGoal.target_amount) * 100))
    : 0;

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Emergency Fund</h1>
        <p className="text-slate-500 text-sm mt-0.5">Stage 4 of your journey — 3 months of expenses</p>
      </div>

      {!efGoal ? (
        <div className="rounded-xl border border-dashed border-amber-500/30 p-8 text-center space-y-3">
          <p className="text-2xl">🛡</p>
          <p className="text-slate-300 font-semibold">No emergency fund goal yet</p>
          <p className="text-sm text-slate-500">Create a goal of type "Emergency Fund" to track your progress here.</p>
          <Link href="/goals" className="inline-block rounded-xl bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-500">
            Create Emergency Fund Goal
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 space-y-4">
            <p className="text-xs text-amber-400/70 uppercase tracking-widest">Progress</p>
            <p className="text-4xl font-bold text-amber-400">{pct}%</p>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div className="bg-amber-500 h-3 rounded-full transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">{fmt(efGoal.current_amount, efGoal.currency)} saved</span>
              <span className="text-slate-400">Target: {fmt(efGoal.target_amount, efGoal.currency)}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-300">Recommended milestones</p>
            {[
              { label: "1 month buffer",  pct: 33 },
              { label: "2 month buffer",  pct: 67 },
              { label: "3 month buffer",  pct: 100 },
            ].map((m) => (
              <div key={m.label} className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center ${pct >= m.pct ? "bg-green-500" : "bg-slate-700"}`}>
                  {pct >= m.pct && <span className="text-[10px] text-white">✓</span>}
                </div>
                <span className={`text-sm ${pct >= m.pct ? "text-slate-300 line-through" : "text-slate-400"}`}>{m.label}</span>
              </div>
            ))}
          </div>

          <Link href="/goals" className="block text-center text-sm text-blue-400 hover:text-blue-300">
            Update in Goals →
          </Link>
        </div>
      )}
    </div>
  );
}
