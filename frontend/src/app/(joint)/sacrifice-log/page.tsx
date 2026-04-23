"use client";
import { useState } from "react";

type Log = { text: string; date: string; author: string };

export default function SacrificeLogPage() {
  const [logs, setLogs] = useState<Log[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem("sacrifice_log") ?? "[]"); }
    catch { return []; }
  });
  const [text, setText] = useState("");
  const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const name = userRaw ? JSON.parse(userRaw)?.full_name ?? "You" : "You";

  function add() {
    if (!text.trim()) return;
    const entry = { text: text.trim(), date: new Date().toISOString(), author: name };
    const updated = [entry, ...logs];
    setLogs(updated);
    localStorage.setItem("sacrifice_log", JSON.stringify(updated.slice(0, 100)));
    setText("");
  }

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Sacrifice Log</h1>
        <p className="text-slate-500 text-sm mt-0.5">Record what you gave up for the mission</p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
          placeholder="e.g. Skipped the restaurant lunch and made food at home — saved R180."
          className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500 resize-none" />
        <button type="button" onClick={add} disabled={!text.trim()}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
          Log sacrifice
        </button>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-500 text-sm">No sacrifices logged — every small win counts</p>
        </div>
      ) : (
        <div className="space-y-3">
          {logs.map((l, i) => (
            <div key={i} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
              <div className="flex justify-between text-xs text-slate-500 mb-2">
                <span className="text-purple-400 font-medium">{l.author}</span>
                <span>{new Date(l.date).toLocaleDateString("en-ZA")}</span>
              </div>
              <p className="text-sm text-slate-300">✊ {l.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
