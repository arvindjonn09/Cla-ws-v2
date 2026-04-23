"use client";
import { useEffect, useState, useCallback } from "react";
import { jointApi } from "@/lib/api";
import { getAccountId } from "@/lib/utils";
import type { JointScenario } from "@/types";

export default function WhatIfPage() {
  const [scenarios, setScenarios] = useState<JointScenario[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const data = await jointApi.listScenarios(accountId).catch(() => [] as JointScenario[]);
    setScenarios(data);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setCreating(true);
    try {
      await jointApi.createScenario(accountId, { title, description: desc });
      setTitle(""); setDesc(""); setShowForm(false);
      await load();
    } catch { /* ignore */ }
    finally { setCreating(false); }
  }

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-slate-700 text-slate-300",
    shared: "bg-blue-500/20 text-blue-400",
    decided: "bg-green-500/20 text-green-400",
    archived: "bg-slate-800 text-slate-500",
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" /></div>;

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">What-If</h1>
          <p className="text-slate-500 text-sm mt-0.5">Plan and compare scenarios together</p>
        </div>
        <button type="button" onClick={() => setShowForm(!showForm)}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">
          + New Scenario
        </button>
      </div>

      {showForm && (
        <form onSubmit={create} className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <input required value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="Scenario title (e.g. What if we cut eating out?)"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
            placeholder="Describe the scenario…"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500 resize-none" />
          <div className="flex gap-3">
            <button type="button" onClick={() => setShowForm(false)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 py-2 text-sm text-slate-300">Cancel</button>
            <button type="submit" disabled={creating}
              className="flex-1 rounded-xl bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
        </form>
      )}

      {scenarios.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-4xl mb-3">🧪</p>
          <p className="text-slate-500 text-sm">No scenarios yet — model different financial paths together</p>
        </div>
      ) : (
        <div className="space-y-3">
          {scenarios.map((s) => (
            <div key={s.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-slate-100">{s.title}</p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${STATUS_COLORS[s.status] ?? "bg-slate-700 text-slate-300"}`}>
                  {s.status}
                </span>
              </div>
              {s.description && <p className="text-xs text-slate-400 mt-1">{s.description}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
