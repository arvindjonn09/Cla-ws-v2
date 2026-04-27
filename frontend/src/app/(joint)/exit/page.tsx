"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountApi } from "@/lib/api";
import { getJointAccountId, clearJointAccountMeta } from "@/lib/utils";

export default function ExitPage() {
  const [confirmed, setConfirmed] = useState(false);
  const [closing, setClosing] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const router = useRouter();
  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;

  async function closeAccount() {
    if (!accountId) return;
    setClosing(true); setError("");
    try {
      const res = await accountApi.closeAccount(accountId);
      if (res.pending) {
        // First member — waiting for other member to confirm
        setPending(true);
        setMessage(res.message);
        setClosing(false);
      } else {
        // Account actually closed — clear joint session and redirect
        clearJointAccountMeta();
        router.replace("/dashboard");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to close account");
      setClosing(false);
    }
  }

  async function cancelClose() {
    if (!accountId) return;
    setClosing(true); setError("");
    try {
      await accountApi.closeAccount(accountId);
      setPending(false);
      setMessage("");
      setConfirmed(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to cancel");
    } finally {
      setClosing(false);
    }
  }

  if (pending) {
    return (
      <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Exit Joint Account</h1>
          <p className="text-slate-500 text-sm mt-0.5">Waiting for the other member</p>
        </div>
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-6 space-y-3 text-center">
          <p className="text-3xl">⏳</p>
          <p className="text-amber-300 font-semibold">Close request submitted</p>
          <p className="text-sm text-slate-400">{message}</p>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="button" onClick={cancelClose} disabled={closing}
          className="w-full rounded-xl border border-slate-600 py-2.5 text-sm font-semibold text-slate-400 hover:border-slate-500 disabled:opacity-40 transition-colors">
          {closing ? "Cancelling…" : "Cancel close request"}
        </button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Exit Joint Account</h1>
        <p className="text-slate-500 text-sm mt-0.5">Both members must confirm to close</p>
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
            I understand this is permanent and both members must confirm before the account closes.
          </span>
        </label>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="button" onClick={closeAccount} disabled={!confirmed || closing}
          className="w-full rounded-xl border border-red-500/40 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 disabled:opacity-40 transition-colors">
          {closing ? "Submitting…" : "Request account closure"}
        </button>
      </div>
    </div>
  );
}
