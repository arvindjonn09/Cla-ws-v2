"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountApi } from "@/lib/api";
import { getAccountId, clearTokens } from "@/lib/utils";

export default function ExitPage() {
  const [confirmed, setConfirmed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  async function closeAccount() {
    if (!accountId) return;
    setClosing(true); setError("");
    try {
      await accountApi.closeAccount(accountId);
      clearTokens();
      localStorage.clear();
      router.replace("/login");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close account");
      setClosing(false);
    }
  }

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Exit Joint Account</h1>
        <p className="text-slate-500 text-sm mt-0.5">This is permanent and cannot be undone</p>
      </div>

      <div className="rounded-xl border border-red-500/30 bg-red-950/20 p-5 space-y-4">
        <p className="text-sm text-red-300 font-semibold">Warning: Closing this joint account will:</p>
        <ul className="text-sm text-slate-400 space-y-1 list-disc list-inside">
          <li>Remove all members from the account</li>
          <li>Archive all shared debts and goals</li>
          <li>Stop all payment warnings and email reminders</li>
          <li>Delete all Safe Space messages</li>
        </ul>
        <p className="text-xs text-slate-500">Your personal account will not be affected.</p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <label className="flex items-start gap-3">
          <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="mt-0.5 rounded" />
          <span className="text-sm text-slate-300">
            I understand this is permanent and I want to close the joint account.
          </span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="button" onClick={closeAccount} disabled={!confirmed || closing}
          className="w-full rounded-xl border border-red-500/40 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors">
          {closing ? "Closing…" : "Close Joint Account"}
        </button>
      </div>
    </div>
  );
}
