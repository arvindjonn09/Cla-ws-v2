"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { accountApi } from "@/lib/api";
import { getJointAccountId, clearTokens } from "@/lib/utils";
import type { Account } from "@/types";
import Link from "next/link";

export default function JointSettingsPage() {
  const router = useRouter();
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [closeConfirm, setCloseConfirm] = useState(false);
  const [closeMsg, setCloseMsg] = useState("");

  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;
  const role = typeof window !== "undefined" ? localStorage.getItem("joint_role") ?? localStorage.getItem("role") : null;
  const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = userRaw ? JSON.parse(userRaw) : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const acc = await accountApi.getAccount(accountId).catch(() => null);
    if (acc) {
      setAccount(acc);
      setName(acc.name ?? "");
      setCurrency(acc.base_currency);
    }
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setSaving(true);
    try {
      await accountApi.getAccount(accountId); // placeholder — update endpoint if available
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function closeAccount() {
    if (!accountId) return;
    const res = await accountApi.closeAccount(accountId).catch(() => null);
    if (res) setCloseMsg(res.message);
  }

  function switchToPersonal() {
    // Reload page — middleware/page.tsx root will redirect to personal dashboard
    router.replace("/dashboard");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Joint Account Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your joint account</p>
      </div>

      {/* Account info */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Account</h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-600 flex items-center justify-center text-white text-lg font-bold">
            {user?.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-semibold text-slate-100">{user?.full_name}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
            <p className="text-xs text-slate-500 capitalize mt-0.5">Role: {role ?? "member"}</p>
          </div>
        </div>
        {account && (
          <div className="rounded-lg bg-slate-900 p-3 text-xs text-slate-400 space-y-1">
            <p>Account ID: <span className="text-slate-300 font-mono">{account.id}</span></p>
            <p>Base currency: <span className="text-slate-300">{account.base_currency}</span></p>
            <p>Status: <span className={account.status === "active" ? "text-green-400" : "text-red-400"}>{account.status}</span></p>
          </div>
        )}
      </div>

      {/* Members */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Team</h2>
          <Link href="/members" className="text-xs text-purple-400 hover:text-purple-300">Manage members →</Link>
        </div>
        <p className="text-sm text-slate-400">
          Invite your partner or add viewers. Business Rule: viewers can never become members.
        </p>
      </div>

      {/* Notifications */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Notifications</h2>
        <div className="space-y-2 text-sm text-slate-400">
          <p>✓ 30-day, 7-day, 1-day payment warnings — email</p>
          <p>✓ Missed payment alerts — email</p>
          <p className="text-xs text-slate-600 mt-2">Security alerts are always on and cannot be disabled.</p>
        </div>
      </div>

      {/* Switch to personal */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3">Switch Account</h2>
        <p className="text-sm text-slate-400 mb-3">Go back to your personal account dashboard.</p>
        <button type="button" onClick={switchToPersonal}
          className="rounded-xl border border-blue-500/30 px-4 py-2 text-sm font-semibold text-blue-400 hover:bg-blue-500/10 transition-colors">
          Switch to Personal Account
        </button>
      </div>

      {/* Danger zone */}
      {role === "member" && (
        <div className="rounded-xl border border-red-500/20 bg-slate-800 p-5 space-y-3">
          <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide">Danger Zone</h2>
          <p className="text-sm text-slate-400">
            Closing a joint account requires confirmation from both members. Data is retained for 30 days.
          </p>
          {closeMsg ? (
            <p className="text-sm text-amber-400">{closeMsg}</p>
          ) : closeConfirm ? (
            <div className="flex gap-2">
              <button type="button" onClick={closeAccount}
                className="rounded-xl border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors">
                Confirm close request
              </button>
              <button type="button" onClick={() => setCloseConfirm(false)}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-400 hover:border-slate-500 transition-colors">
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" onClick={() => setCloseConfirm(true)}
              className="rounded-xl border border-red-500/30 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
              Close joint account
            </button>
          )}
        </div>
      )}
    </div>
  );
}
