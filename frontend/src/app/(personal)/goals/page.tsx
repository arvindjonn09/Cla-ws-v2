"use client";
import { useEffect, useState, useCallback } from "react";
import { goalApi } from "@/lib/api";
import { getAccountId, fmt, fmtDate } from "@/lib/utils";
import type { Goal, GoalType } from "@/types";

const GOAL_TYPE_LABELS: Record<GoalType, string> = {
  emergency_fund: "Emergency Fund",
  debt_payoff:    "Debt Payoff",
  savings:        "Savings",
  house_deposit:  "House Deposit",
  holiday:        "Holiday",
  education:      "Education",
  custom:         "Custom",
};
const GOAL_TYPES: GoalType[] = ["emergency_fund","debt_payoff","savings","house_deposit","holiday","education","custom"];
const CURRENCIES = ["ZAR","USD","GBP","EUR","KES","NGN"];

type GoalForm = {
  name: string;
  goal_type: GoalType;
  target_amount: string;
  current_amount: string;
  currency: string;
  target_date: string;
  priority: string;
};

function GoalModal({
  goal,
  onClose,
  onSave,
}: {
  goal: Goal | null;
  onClose: () => void;
  onSave: (f: GoalForm) => Promise<void>;
}) {
  const [form, setForm] = useState<GoalForm>({
    name:           goal?.name ?? "",
    goal_type:      goal?.goal_type ?? "savings",
    target_amount:  String(goal?.target_amount ?? ""),
    current_amount: String(goal?.current_amount ?? "0"),
    currency:       goal?.currency ?? "ZAR",
    target_date:    goal?.target_date ?? "",
    priority:       String(goal?.priority ?? "1"),
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof GoalForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{goal ? "Edit Goal" : "New Goal"}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Goal name *</label>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Emergency fund" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Type</label>
              <select value={form.goal_type} onChange={(e) => set("goal_type", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                {GOAL_TYPES.map((t) => <option key={t} value={t}>{GOAL_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => set("currency", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target amount *</label>
              <input required type="number" min="0" step="0.01" value={form.target_amount}
                onChange={(e) => set("target_amount", e.target.value)}
                placeholder="0.00" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current amount</label>
              <input type="number" min="0" step="0.01" value={form.current_amount}
                onChange={(e) => set("current_amount", e.target.value)}
                placeholder="0.00" className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Target date</label>
              <input type="date" value={form.target_date} onChange={(e) => set("target_date", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Priority</label>
              <input type="number" min="1" max="10" value={form.priority} onChange={(e) => set("priority", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300 hover:border-slate-500">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-500 disabled:opacity-50">
              {saving ? "Saving…" : goal ? "Update" : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GoalCard({
  goal,
  onEdit,
  onPause,
  onDelete,
}: {
  goal: Goal;
  onEdit: (g: Goal) => void;
  onPause: (g: Goal) => void;
  onDelete: (g: Goal) => void;
}) {
  const pct = goal.target_amount > 0
    ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100))
    : 0;
  const isPaused = goal.status === "paused";
  const isDone = goal.status === "completed" || goal.current_amount >= goal.target_amount;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      isPaused ? "border-slate-800 bg-slate-900 opacity-75" :
      isDone   ? "border-green-500/30 bg-green-950/20" :
                 "border-slate-700 bg-slate-800"
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-slate-100 truncate">{goal.name}</p>
            {isDone && <span className="text-[10px] font-bold text-green-400 bg-green-500/20 px-1.5 py-0.5 rounded">DONE</span>}
            {isPaused && <span className="text-[10px] font-bold text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">PAUSED</span>}
          </div>
          <p className="text-xs text-slate-500">{GOAL_TYPE_LABELS[goal.goal_type]}</p>
        </div>
        <p className="text-sm font-bold text-slate-300 shrink-0">{pct}%</p>
      </div>

      <div className="space-y-1">
        <div className="w-full bg-slate-700 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${isDone ? "bg-green-500" : "bg-blue-500"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-slate-500">
          <span>{fmt(goal.current_amount, goal.currency)}</span>
          <span>{fmt(goal.target_amount, goal.currency)}</span>
        </div>
      </div>

      {goal.target_date && (
        <p className="text-xs text-slate-500">Target: <span className="text-slate-400">{fmtDate(goal.target_date)}</span></p>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={() => onEdit(goal)}
          className="flex-1 rounded-lg bg-slate-700 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-600 transition-colors">
          Edit
        </button>
        <button type="button" onClick={() => onPause(goal)}
          className={`px-3 rounded-lg py-1.5 text-xs font-semibold transition-colors ${
            isPaused
              ? "bg-blue-600/20 border border-blue-600/30 text-blue-400 hover:bg-blue-600/30"
              : "bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
          }`}>
          {isPaused ? "Resume" : "Pause"}
        </button>
        <button type="button" onClick={() => onDelete(goal)}
          className="px-3 rounded-lg bg-red-500/10 border border-red-500/20 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors">
          Delete
        </button>
      </div>
    </div>
  );
}

export default function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [tab, setTab] = useState<"active" | "completed" | "paused">("active");

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const data = await goalApi.list(accountId).catch(() => [] as Goal[]);
    setGoals(data);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: GoalForm) {
    if (!accountId) return;
    const payload = {
      name:           form.name,
      goal_type:      form.goal_type as GoalType,
      target_amount:  parseFloat(form.target_amount) || 0,
      current_amount: parseFloat(form.current_amount) || 0,
      currency:       form.currency,
      target_date:    form.target_date || null,
      priority:       parseInt(form.priority) || 1,
    };
    if (editGoal) {
      await goalApi.update(accountId, editGoal.id, payload);
    } else {
      await goalApi.create(accountId, payload);
    }
    await load();
  }

  async function handlePause(goal: Goal) {
    if (!accountId) return;
    const newStatus = goal.status === "paused" ? "active" : "paused";
    await goalApi.update(accountId, goal.id, { status: newStatus });
    await load();
  }

  async function handleDelete(goal: Goal) {
    if (!accountId) return;
    if (!confirm(`Delete "${goal.name}"?`)) return;
    await goalApi.delete(accountId, goal.id);
    await load();
  }

  const byTab = goals.filter((g) => g.status === tab);
  const totals = {
    active:    goals.filter((g) => g.status === "active").length,
    completed: goals.filter((g) => g.status === "completed").length,
    paused:    goals.filter((g) => g.status === "paused").length,
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Goals</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track every savings milestone</p>
        </div>
        <button type="button" onClick={() => { setEditGoal(null); setModal(true); }}
          className="rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-500 transition-colors">
          + New Goal
        </button>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg border border-slate-700 overflow-hidden text-xs w-fit">
        {(["active","completed","paused"] as const).map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`px-4 py-2 font-medium capitalize transition-colors ${
              tab === t ? "bg-slate-700 text-slate-100" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
            }`}>
            {t} ({totals[t]})
          </button>
        ))}
      </div>

      {byTab.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-500 text-sm mb-3">No {tab} goals</p>
          {tab === "active" && (
            <button type="button" onClick={() => { setEditGoal(null); setModal(true); }}
              className="text-green-400 text-sm hover:text-green-300">Set your first goal →</button>
          )}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {byTab.sort((a, b) => a.priority - b.priority).map((g) => (
            <GoalCard key={g.id} goal={g}
              onEdit={(goal) => { setEditGoal(goal); setModal(true); }}
              onPause={handlePause}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {modal && (
        <GoalModal goal={editGoal} onClose={() => { setModal(false); setEditGoal(null); }} onSave={handleSave} />
      )}
    </div>
  );
}
