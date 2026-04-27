"use client";
import { useEffect, useState, useCallback } from "react";
import { goalApi } from "@/lib/api";
import { getJointAccountId, fmt, fmtDate, goalTypeLabel } from "@/lib/utils";
import type { Goal, GoalType } from "@/types";

const GOAL_TYPES: GoalType[] = [
  "emergency_fund","savings","house_deposit","holiday","education","custom",
];

const CURRENCIES = ["EUR","USD","INR","AUD"];

export default function SharedGoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "", goal_type: "savings" as GoalType, target_amount: "", currency: "USD",
    current_amount: "0", target_date: "", priority: 1,
  });
  const [depositGoalId, setDepositGoalId] = useState<string | null>(null);
  const [depositAmt, setDepositAmt] = useState("");

  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const g = await goalApi.list(accountId).catch(() => [] as Goal[]);
    setGoals(g.filter((x) => x.status !== "completed"));
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function addGoal() {
    if (!accountId || !form.name || !form.target_amount) return;
    setSaving(true);
    try {
      const g = await goalApi.create(accountId, {
        name: form.name,
        goal_type: form.goal_type,
        target_amount: Number(form.target_amount),
        currency: form.currency,
        current_amount: Number(form.current_amount),
        target_date: form.target_date || null,
        priority: form.priority,
      });
      setGoals((prev) => [...prev, g]);
      setAdding(false);
      setForm({ name: "", goal_type: "savings", target_amount: "", currency: "USD", current_amount: "0", target_date: "", priority: 1 });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function deposit(goalId: string) {
    if (!accountId || !depositAmt) return;
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;
    setSaving(true);
    try {
      const updated = await goalApi.update(accountId, goalId, {
        current_amount: goal.current_amount + Number(depositAmt),
      });
      setGoals((prev) => prev.map((g) => g.id === goalId ? updated : g));
      setDepositGoalId(null);
      setDepositAmt("");
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function markComplete(goalId: string) {
    if (!accountId) return;
    const updated = await goalApi.update(accountId, goalId, { status: "completed" }).catch(() => null);
    if (updated) setGoals((prev) => prev.filter((g) => g.id !== goalId));
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Shared Goals</h1>
          <p className="text-slate-500 text-sm mt-0.5">Goals you&apos;re working toward together</p>
        </div>
        <button type="button" onClick={() => setAdding(true)}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors">
          + Add Goal
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Shared Goal</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Goal name</label>
              <input
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                placeholder="e.g. Holiday fund"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.goal_type}
                onChange={(e) => setForm((f) => ({ ...f, goal_type: e.target.value as GoalType }))}
              >
                {GOAL_TYPES.map((t) => <option key={t} value={t}>{goalTypeLabel(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target amount</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.target_amount}
                onChange={(e) => setForm((f) => ({ ...f, target_amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current saved</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.current_amount}
                onChange={(e) => setForm((f) => ({ ...f, current_amount: e.target.value }))}
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Target date (optional)</label>
              <input
                type="date"
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.target_date}
                onChange={(e) => setForm((f) => ({ ...f, target_date: e.target.value }))}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addGoal} disabled={saving || !form.name || !form.target_amount}
              className="flex-1 rounded-xl bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Add goal"}
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="flex-1 rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:border-slate-500 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Goal list */}
      {goals.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center space-y-2">
          <p className="text-3xl">🎯</p>
          <p className="text-slate-400 text-sm">No shared goals yet.</p>
          <button type="button" onClick={() => setAdding(true)}
            className="text-purple-400 text-sm hover:text-purple-300">
            Set your first shared goal →
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {goals.map((g) => {
            const pct = g.target_amount > 0 ? Math.min(100, Math.round((g.current_amount / g.target_amount) * 100)) : 0;
            return (
              <div key={g.id} className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{g.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{goalTypeLabel(g.goal_type)}{g.target_date ? ` · by ${fmtDate(g.target_date)}` : ""}</p>
                  </div>
                  <span className="text-sm font-bold text-purple-400">{pct}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2">
                  <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{fmt(g.current_amount, g.currency)} saved</span>
                  <span>Target: {fmt(g.target_amount, g.currency)}</span>
                </div>

                {depositGoalId === g.id ? (
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Deposit amount"
                      value={depositAmt}
                      onChange={(e) => setDepositAmt(e.target.value)}
                      className="flex-1 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                    />
                    <button type="button" onClick={() => deposit(g.id)} disabled={saving || !depositAmt}
                      className="rounded-xl bg-purple-600 px-3 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
                      Add
                    </button>
                    <button type="button" onClick={() => { setDepositGoalId(null); setDepositAmt(""); }}
                      className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-400">
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setDepositGoalId(g.id)}
                      className="text-xs rounded-lg border border-purple-500/30 bg-purple-950/20 px-3 py-1.5 text-purple-400 hover:bg-purple-950/40 transition-colors">
                      + Deposit
                    </button>
                    {pct >= 100 && (
                      <button type="button" onClick={() => markComplete(g.id)}
                        className="text-xs rounded-lg border border-green-500/30 bg-green-950/20 px-3 py-1.5 text-green-400 hover:bg-green-950/40 transition-colors">
                        Mark complete
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
