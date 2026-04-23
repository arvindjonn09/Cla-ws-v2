"use client";
import { useState } from "react";

type Sub = { name: string; amount: string; frequency: "monthly" | "annual"; category: string };

const CATEGORIES = ["Streaming","Software","Gym","Insurance","Utilities","Magazines","Other"];

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<Sub[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("subscriptions") ?? "[]"); }
    catch { return []; }
  });
  const [form, setForm] = useState<Sub>({ name: "", amount: "", frequency: "monthly", category: "Streaming" });
  const [adding, setAdding] = useState(false);

  function addSub() {
    if (!form.name || !form.amount) return;
    const updated = [...subs, form];
    setSubs(updated);
    localStorage.setItem("subscriptions", JSON.stringify(updated));
    setForm({ name: "", amount: "", frequency: "monthly", category: "Streaming" });
    setAdding(false);
  }

  function removeSub(i: number) {
    const updated = subs.filter((_, idx) => idx !== i);
    setSubs(updated);
    localStorage.setItem("subscriptions", JSON.stringify(updated));
  }

  const monthlyTotal = subs.reduce((s, sub) => {
    const amt = parseFloat(sub.amount) || 0;
    return s + (sub.frequency === "annual" ? amt / 12 : amt);
  }, 0);

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Subscriptions</h1>
          <p className="text-slate-500 text-sm mt-0.5">Track recurring payments</p>
        </div>
        <button type="button" onClick={() => setAdding(true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
          + Add
        </button>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4">
        <p className="text-xs text-slate-500">Monthly total</p>
        <p className="text-2xl font-bold text-blue-400">R {monthlyTotal.toFixed(2)}</p>
      </div>

      {adding && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Name (e.g. Netflix)" className="col-span-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="Amount" className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            <select value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value as "monthly" | "annual" })}
              className="rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
              <option value="monthly">Monthly</option>
              <option value="annual">Annual</option>
            </select>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="col-span-2 rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex gap-3">
            <button type="button" onClick={() => setAdding(false)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-900 py-2 text-sm font-semibold text-slate-300">Cancel</button>
            <button type="button" onClick={addSub}
              className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500">Save</button>
          </div>
        </div>
      )}

      {subs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-500 text-sm">No subscriptions tracked yet</p>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          {subs.map((sub, i) => (
            <div key={i} className={`flex items-center justify-between px-4 py-3 ${i !== 0 ? "border-t border-slate-700" : ""}`}>
              <div>
                <p className="text-sm text-slate-200">{sub.name}</p>
                <p className="text-xs text-slate-500">{sub.category} · {sub.frequency}</p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-slate-300">R {sub.amount}</span>
                <button type="button" onClick={() => removeSub(i)} className="text-xs text-red-400 hover:text-red-300">Remove</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-xs text-slate-600 text-center">Subscriptions are stored locally on this device.</p>
    </div>
  );
}
