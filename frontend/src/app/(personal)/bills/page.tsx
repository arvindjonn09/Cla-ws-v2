"use client";
import { useState } from "react";

type Bill = {
  id: string;
  name: string;
  amount: string;
  currency: string;
  due_day: number;
  category: string;
  is_recurring: boolean;
  last_paid?: string;
};

const CATEGORIES = ["Rent / Mortgage", "Electricity", "Water", "Internet", "Insurance", "Phone", "Transport", "Rates & Taxes", "Other"];
const CURRENCIES = ["EUR","USD","INR","AUD"];

function daysUntilDue(day: number): number {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  if (thisMonth <= now) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, day);
    return Math.ceil((next.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }
  return Math.ceil((thisMonth.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function urgencyColor(days: number): string {
  if (days <= 3) return "text-red-400 border-red-500/30 bg-red-950/20";
  if (days <= 7) return "text-amber-400 border-amber-500/30 bg-amber-950/20";
  return "text-slate-300 border-slate-700 bg-slate-800";
}

function loadBills(): Bill[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("bills") ?? "[]"); }
  catch { return []; }
}

export default function BillsPage() {
  const [bills, setBills] = useState<Bill[]>(loadBills);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<Bill, "id">>({
    name: "", amount: "", currency: "USD", due_day: 1,
    category: "Rent / Mortgage", is_recurring: true,
  });

  function save() {
    if (!form.name || !form.amount) return;
    const bill: Bill = { ...form, id: crypto.randomUUID() };
    const updated = [...bills, bill];
    setBills(updated);
    localStorage.setItem("bills", JSON.stringify(updated));
    setForm({ name: "", amount: "", currency: "USD", due_day: 1, category: "Rent / Mortgage", is_recurring: true });
    setAdding(false);
  }

  function markPaid(id: string) {
    const updated = bills.map((b) =>
      b.id === id ? { ...b, last_paid: new Date().toISOString().split("T")[0] } : b
    );
    setBills(updated);
    localStorage.setItem("bills", JSON.stringify(updated));
  }

  function remove(id: string) {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);
    localStorage.setItem("bills", JSON.stringify(updated));
  }

  const sorted = [...bills].sort((a, b) => daysUntilDue(a.due_day) - daysUntilDue(b.due_day));
  const totalMonthly = bills.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Bills</h1>
          <p className="text-slate-500 text-sm mt-0.5">Recurring bill tracker</p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
        >
          + Add Bill
        </button>
      </div>

      {bills.length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 flex justify-between items-center">
          <span className="text-sm text-slate-400">{bills.length} bill{bills.length !== 1 ? "s" : ""} tracked</span>
          <span className="text-sm font-semibold text-slate-200">ZAR {totalMonthly.toFixed(2)}/mo</span>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">New Bill</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Bill name</label>
              <input
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                placeholder="e.g. Electricity"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Amount</label>
              <input
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                type="number"
                placeholder="0.00"
                value={form.amount}
                onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                value={form.currency}
                onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}
              >
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Due day of month</label>
              <input
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                type="number"
                min={1}
                max={31}
                value={form.due_day}
                onChange={(e) => setForm((f) => ({ ...f, due_day: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Category</label>
              <select
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={save}
              disabled={!form.name || !form.amount}
              className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
              Save bill
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-sm text-slate-300 hover:border-slate-500 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Bill list */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center space-y-2">
          <p className="text-3xl">📃</p>
          <p className="text-slate-400 text-sm">No bills tracked yet.</p>
          <button type="button" onClick={() => setAdding(true)}
            className="text-blue-400 text-sm hover:text-blue-300">
            Add your first bill →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((bill) => {
            const days = daysUntilDue(bill.due_day);
            const colors = urgencyColor(days);
            const paidToday = bill.last_paid === new Date().toISOString().split("T")[0];
            return (
              <div key={bill.id} className={`rounded-xl border p-4 ${colors}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold">{bill.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{bill.category} · Due day {bill.due_day}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{bill.currency} {parseFloat(bill.amount).toFixed(2)}</p>
                    <p className="text-xs mt-0.5">
                      {paidToday
                        ? <span className="text-green-400">✓ Paid today</span>
                        : <span>{days === 0 ? "Due today" : `${days}d remaining`}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  {!paidToday && (
                    <button type="button" onClick={() => markPaid(bill.id)}
                      className="text-xs rounded-lg border border-green-500/30 bg-green-950/20 px-3 py-1.5 text-green-400 hover:bg-green-950/40 transition-colors">
                      Mark paid
                    </button>
                  )}
                  <button type="button" onClick={() => remove(bill.id)}
                    className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-colors ml-auto">
                    Remove
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
