"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { debtApi, goalApi, transactionApi } from "@/lib/api";
import { getAccountId, fmt, fmtDate, daysUntil } from "@/lib/utils";
import type { Debt, FreedomDateResponse, Goal } from "@/types";

// Stage labels matching the 9-stage journey
const STAGES = [
  "Know Your Numbers",
  "Stop The Bleeding",
  "Clear Small Debts",
  "Emergency Fund",
  "Clear Large Debts",
  "Save Consistently",
  "Begin Investing",
  "Foreign Investments",
  "Financial Independence",
];

function FreedomDateBanner({ data }: { data: FreedomDateResponse | null }) {
  if (!data) return null;
  const rec = data[data.recommended_method as keyof FreedomDateResponse] as { freedom_date: string | null; months_remaining: number };
  if (!rec?.freedom_date) {
    return (
      <div className="rounded-2xl border border-slate-700 bg-gradient-to-br from-slate-800 to-slate-900 p-6">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Freedom Date</p>
        <p className="text-2xl font-bold text-slate-400">Add debts to calculate</p>
        <Link href="/debts" className="mt-3 inline-block text-sm text-blue-400 hover:text-blue-300">
          Add first debt →
        </Link>
      </div>
    );
  }
  const days = daysUntil(rec.freedom_date);
  const years = days !== null ? Math.floor(days / 365) : null;
  const months = days !== null ? Math.floor((days % 365) / 30) : null;

  return (
    <div className="rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-950/50 to-slate-900 p-6">
      <p className="text-xs text-blue-400/70 uppercase tracking-widest mb-1">Freedom Date</p>
      <p className="text-3xl font-bold text-blue-400">{fmtDate(rec.freedom_date)}</p>
      <p className="text-slate-400 mt-1 text-sm">
        {years !== null && months !== null
          ? `${years > 0 ? `${years}y ` : ""}${months}m remaining`
          : `${rec.months_remaining} months remaining`}
      </p>
      <p className="text-xs text-slate-500 mt-2">
        Method: <span className="capitalize text-slate-400">{data.recommended_method}</span>
      </p>
    </div>
  );
}

function DebtSummaryCard({ debts }: { debts: Debt[] }) {
  const active = debts.filter((d) => d.status === "active");
  const totalBalance = active.reduce((s, d) => s + d.current_balance, 0);
  const monthlyPayment = active.reduce((s, d) => s + (d.actual_payment ?? d.minimum_payment ?? 0), 0);
  const currency = active[0]?.currency ?? "ZAR";

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
      <p className="text-xs text-slate-500 uppercase tracking-widest">Total Debt</p>
      <p className="text-2xl font-bold text-red-400">{fmt(totalBalance, currency)}</p>
      <div className="flex justify-between text-sm text-slate-400">
        <span>{active.length} active debt{active.length !== 1 ? "s" : ""}</span>
        <span>{fmt(monthlyPayment, currency)}/mo</span>
      </div>
      <Link href="/debts" className="text-sm text-blue-400 hover:text-blue-300">
        View debt center →
      </Link>
    </div>
  );
}

function GoalCard({ goal }: { goal: Goal }) {
  const pct = Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100));
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-2">
      <div className="flex justify-between items-start">
        <p className="text-sm font-medium text-slate-200">{goal.name}</p>
        <span className="text-xs text-slate-500">{pct}%</span>
      </div>
      <div className="w-full bg-slate-700 rounded-full h-1.5">
        <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{fmt(goal.current_amount, goal.currency)}</span>
        <span>{fmt(goal.target_amount, goal.currency)}</span>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [freedomDate, setFreedomDate] = useState<FreedomDateResponse | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;
  const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = userRaw ? JSON.parse(userRaw) : null;

  useEffect(() => {
    if (!accountId) { setLoading(false); return; }
    Promise.all([
      debtApi.list(accountId).catch(() => [] as Debt[]),
      debtApi.freedomDate(accountId).catch(() => null),
      goalApi.list(accountId).catch(() => [] as Goal[]),
    ]).then(([d, fd, g]) => {
      setDebts(d);
      setFreedomDate(fd);
      setGoals(g.filter((x) => x.status === "active").slice(0, 3));
    }).finally(() => setLoading(false));
  }, [accountId]);

  // Determine current stage based on debts and goals
  const activeDebts = debts.filter((d) => d.status === "active");
  const hasDebts = activeDebts.length > 0;
  const hasEmergencyFund = goals.some((g) => g.goal_type === "emergency_fund" && g.current_amount >= g.target_amount * 0.1);
  const currentStage = !hasDebts ? 5 : hasEmergencyFund ? 3 : 2;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <p className="text-slate-500 text-sm">Welcome back,</p>
        <h1 className="text-2xl font-bold text-slate-100">{user?.full_name ?? "Commander"}</h1>
      </div>

      {/* Freedom Date — always front and centre */}
      <FreedomDateBanner data={freedomDate} />

      {/* Stats row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Active Debts</p>
          <p className="text-xl font-bold text-red-400">{activeDebts.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Goals</p>
          <p className="text-xl font-bold text-green-400">{goals.length}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Stage</p>
          <p className="text-xl font-bold text-blue-400">{currentStage}</p>
        </div>
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
          <p className="text-xs text-slate-500 mb-1">Journey</p>
          <p className="text-sm font-semibold text-amber-400 truncate">{STAGES[currentStage - 1]}</p>
        </div>
      </div>

      {/* Two-col: debts + goals */}
      <div className="grid lg:grid-cols-2 gap-6">
        {/* Debts */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Debts</h2>
            <Link href="/debts" className="text-xs text-blue-400 hover:text-blue-300">View all</Link>
          </div>
          {activeDebts.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
              <p className="text-slate-500 text-sm">No debts added yet</p>
              <Link href="/debts" className="text-blue-400 text-sm hover:text-blue-300">Add your first debt →</Link>
            </div>
          ) : (
            <DebtSummaryCard debts={debts} />
          )}
        </div>

        {/* Goals */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Goals</h2>
            <Link href="/goals" className="text-xs text-blue-400 hover:text-blue-300">View all</Link>
          </div>
          {goals.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-6 text-center">
              <p className="text-slate-500 text-sm">No goals yet</p>
              <Link href="/goals" className="text-blue-400 text-sm hover:text-blue-300">Set a goal →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {goals.map((g) => <GoalCard key={g.id} goal={g} />)}
            </div>
          )}
        </div>
      </div>

      {/* Stage progress */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">9-Stage Journey</h2>
          <Link href="/journey" className="text-xs text-blue-400 hover:text-blue-300">Full view</Link>
        </div>
        <div className="flex items-center gap-1.5">
          {STAGES.map((label, i) => {
            const stageNum = i + 1;
            const isDone = stageNum < currentStage;
            const isCurrent = stageNum === currentStage;
            return (
              <div key={stageNum} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full h-1.5 rounded-full transition-colors ${
                    isDone ? "bg-green-500" : isCurrent ? "bg-blue-500" : "bg-slate-700"
                  }`}
                />
                {isCurrent && (
                  <p className="text-xs text-blue-400 text-center hidden sm:block">{stageNum}</p>
                )}
              </div>
            );
          })}
        </div>
        <p className="text-sm text-slate-300 mt-3 font-medium">
          Stage {currentStage}: {STAGES[currentStage - 1]}
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { href: "/debts",    label: "Add Debt",        icon: "⛓"  },
          { href: "/budget",   label: "Log Expense",     icon: "📊" },
          { href: "/goals",    label: "Set Goal",        icon: "🎯" },
          { href: "/war-room", label: "Joint Account",   icon: "🤝" },
        ].map(({ href, label, icon }) => (
          <Link
            key={href}
            href={href}
            className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-center hover:border-slate-500 transition-colors"
          >
            <span className="text-2xl">{icon}</span>
            <p className="text-xs text-slate-400 mt-2">{label}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
