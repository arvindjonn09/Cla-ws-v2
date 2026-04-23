"use client";
import { useState } from "react";

export default function JournalPage() {
  const [entry, setEntry] = useState("");
  const [entries, setEntries] = useState<{ date: string; text: string }[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("journal_entries") ?? "[]"); }
    catch { return []; }
  });

  function save() {
    if (!entry.trim()) return;
    const newEntry = { date: new Date().toISOString(), text: entry.trim() };
    const updated = [newEntry, ...entries];
    setEntries(updated);
    localStorage.setItem("journal_entries", JSON.stringify(updated.slice(0, 50)));
    setEntry("");
  }

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Journal</h1>
        <p className="text-slate-500 text-sm mt-0.5">Reflect on your financial journey</p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
        <textarea
          value={entry}
          onChange={(e) => setEntry(e.target.value)}
          placeholder="How are you feeling about your progress today?"
          rows={4}
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 resize-none"
        />
        <button type="button" onClick={save} disabled={!entry.trim()}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
          Save entry
        </button>
      </div>

      {entries.length > 0 && (
        <div className="space-y-3">
          {entries.map((e, i) => (
            <div key={i} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <p className="text-xs text-slate-500 mb-2">{new Date(e.date).toLocaleDateString("en-ZA", { dateStyle: "long" })}</p>
              <p className="text-sm text-slate-300 whitespace-pre-wrap">{e.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
