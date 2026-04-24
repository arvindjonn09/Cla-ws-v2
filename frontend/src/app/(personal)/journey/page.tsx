"use client";
import { useEffect, useState, useCallback } from "react";
import { debtApi, goalApi } from "@/lib/api";
import { getAccountId, fmt } from "@/lib/utils";
import type { Debt, Goal } from "@/types";
import Link from "next/link";

const STAGES = [
  { num: 1, title: "Know Your Numbers",     icon: "🔍", desc: "List every debt, income source, and expense. Face the full picture.", color: "border-red-500/40 bg-red-950/20",     active: "border-red-500 bg-red-950/40",    dot: "bg-red-500",    done: "bg-red-500"    },
  { num: 2, title: "Stop The Bleeding",      icon: "🩹", desc: "Cut unnecessary expenses. Create breathing room.",                   color: "border-orange-500/40 bg-orange-950/20", active: "border-orange-500 bg-orange-950/40", dot: "bg-orange-500", done: "bg-orange-500" },
  { num: 3, title: "Clear Small Debts",      icon: "⛄", desc: "Use snowball momentum to wipe out small balances fast.",             color: "border-amber-500/40 bg-amber-950/20",  active: "border-amber-500 bg-amber-950/40",  dot: "bg-amber-500",  done: "bg-amber-500"  },
  { num: 4, title: "Emergency Fund",         icon: "🛡", desc: "Build 1–3 months of expenses before attacking large debts.",         color: "border-yellow-500/40 bg-yellow-950/20", active: "border-yellow-500 bg-yellow-950/40", dot: "bg-yellow-500", done: "bg-yellow-500" },
  { num: 5, title: "Clear Large Debts",      icon: "🏔", desc: "Avalanche or snowball your major debts to zero.",                   color: "border-lime-500/40 bg-lime-950/20",    active: "border-lime-500 bg-lime-950/40",    dot: "bg-lime-500",   done: "bg-lime-500"   },
  { num: 6, title: "Save Consistently",      icon: "💰", desc: "Automate savings. Build 6-month emergency fund.",                   color: "border-green-500/40 bg-green-950/20",  active: "border-green-500 bg-green-950/40",  dot: "bg-green-500",  done: "bg-green-500"  },
  { num: 7, title: "Begin Investing",        icon: "📈", desc: "Invest locally — unit trusts, ETFs, retirement annuities.",          color: "border-teal-500/40 bg-teal-950/20",    active: "border-teal-500 bg-teal-950/40",    dot: "bg-teal-500",   done: "bg-teal-500"   },
  { num: 8, title: "Foreign Investments",    icon: "🌍", desc: "Diversify offshore. USD assets, global ETFs.",                      color: "border-cyan-500/40 bg-cyan-950/20",    active: "border-cyan-500 bg-cyan-950/40",    dot: "bg-cyan-500",   done: "bg-cyan-500"   },
  { num: 9, title: "Financial Independence", icon: "🏁", desc: "Passive income covers expenses. You are free.",                     color: "border-blue-500/40 bg-blue-950/20",    active: "border-blue-500 bg-blue-950/40",    dot: "bg-blue-500",   done: "bg-blue-500"   },
];

export default function JourneyPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [d, g] = await Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      goalApi.list(accountId).catch(() => [] as Goal[]),
    ]);
    setDebts(d);
    setGoals(g);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  const activeDebts = debts.filter((d) => d.status === "active");
  const hasDebts = activeDebts.length > 0;
  const hasEmergencyFund = goals.some(
    (g) => g.goal_type === "emergency_fund" && g.current_amount >= g.target_amount * 0.1
  );
  const emergencyFundFull = goals.some(
    (g) => g.goal_type === "emergency_fund" && g.current_amount >= g.target_amount
  );
  const currentStage = !hasDebts ? 6 : hasEmergencyFund ? 3 : 2;

  const totalDebt = activeDebts.reduce((s, d) => s + d.current_balance, 0);
  const currency = activeDebts[0]?.currency ?? "USD";

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">9-Stage Journey</h1>
        <p className="text-slate-500 text-sm mt-0.5">Your roadmap from debt to financial independence</p>
      </div>

      {/* Current stage banner */}
      <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4">
        <p className="text-xs text-blue-400/70 uppercase tracking-widest mb-1">You are at</p>
        <p className="text-xl font-bold text-blue-400">Stage {currentStage}: {STAGES[currentStage - 1].title}</p>
        {hasDebts && (
          <p className="text-xs text-slate-500 mt-1">
            {fmt(totalDebt, currency)} remaining across {activeDebts.length} debt{activeDebts.length !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Stage list */}
      <div className="space-y-0">
        {STAGES.map((stage, i) => {
          const isDone = stage.num < currentStage;
          const isCurrent = stage.num === currentStage;
          const isLocked = stage.num > currentStage;
          return (
            <div key={stage.num} className="flex gap-4">
              {/* Timeline */}
              <div className="flex flex-col items-center">
                <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0 ${
                  isDone ? "bg-green-500" : isCurrent ? stage.dot : "bg-slate-700"
                }`}>
                  {isDone ? "✓" : stage.num}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={`w-0.5 flex-1 mt-1 mb-1 ${isDone ? "bg-green-500/50" : "bg-slate-700"}`} style={{ minHeight: "2rem" }} />
                )}
              </div>

              {/* Card */}
              <div className={`flex-1 rounded-xl border p-4 mb-3 ${
                isDone ? "border-green-500/20 bg-green-950/10" :
                isCurrent ? stage.active :
                stage.color + " opacity-50"
              }`}>
                <div className="flex items-start gap-2">
                  <span className="text-xl">{stage.icon}</span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${isDone ? "text-green-300" : isLocked ? "text-slate-500" : "text-slate-100"}`}>
                        {stage.title}
                      </p>
                      {isDone && <span className="text-xs text-green-400 font-semibold">DONE</span>}
                      {isCurrent && <span className="text-xs text-blue-400 font-semibold bg-blue-500/10 px-2 py-0.5 rounded-full">CURRENT</span>}
                    </div>
                    <p className={`text-xs mt-1 ${isLocked ? "text-slate-600" : "text-slate-400"}`}>{stage.desc}</p>

                    {/* Stage-specific action */}
                    {isCurrent && (
                      <div className="mt-3">
                        {stage.num === 2 && (
                          <Link href="/debts" className="text-xs text-blue-400 hover:text-blue-300">Add debts to plan →</Link>
                        )}
                        {stage.num === 3 && (
                          <Link href="/debts" className="text-xs text-blue-400 hover:text-blue-300">View payoff plan →</Link>
                        )}
                        {stage.num === 4 && (
                          <Link href="/emergency-fund" className="text-xs text-blue-400 hover:text-blue-300">
                            {emergencyFundFull ? "Emergency fund complete →" : "Build emergency fund →"}
                          </Link>
                        )}
                        {stage.num === 5 && (
                          <Link href="/debts" className="text-xs text-blue-400 hover:text-blue-300">Clear remaining debts →</Link>
                        )}
                        {stage.num === 6 && (
                          <Link href="/goals" className="text-xs text-blue-400 hover:text-blue-300">Set savings goals →</Link>
                        )}
                        {stage.num === 7 && (
                          <Link href="/investments" className="text-xs text-blue-400 hover:text-blue-300">Track investments →</Link>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-center">
        <p className="text-sm text-slate-400">Track your Freedom Date in</p>
        <Link href="/debts" className="text-blue-400 text-sm hover:text-blue-300">Debt Center →</Link>
      </div>
    </div>
  );
}
