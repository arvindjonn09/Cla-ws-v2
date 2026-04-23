"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { accountApi, authApi } from "@/lib/api";
import { getAccountId, clearTokens } from "@/lib/utils";
import type { UserProfile } from "@/types";

const INCOME_TYPES = [
  { value: "fixed",    label: "Fixed salary" },
  { value: "casual",   label: "Casual / shifts" },
  { value: "variable", label: "Variable" },
  { value: "multiple", label: "Multiple sources" },
];
const DEBT_METHODS = [
  { value: "snowball",  label: "Snowball" },
  { value: "avalanche", label: "Avalanche" },
  { value: "custom",    label: "Custom" },
];
const MOTIVATION_STYLES = [
  { value: "disciplined",       label: "Disciplined" },
  { value: "motivation_driven", label: "Motivation-driven" },
];

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  // password change
  const [pwSection, setPwSection] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  const accountId = typeof window !== "undefined" ? getAccountId() : null;
  const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const user = userRaw ? JSON.parse(userRaw) : null;

  useEffect(() => {
    if (!accountId) return;
    accountApi.getProfile(accountId).then(setProfile).catch(() => null).finally(() => setLoading(false));
  }, [accountId]);

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !profile) return;
    setSaving(true);
    setError("");
    try {
      await accountApi.updateProfile(accountId, {
        income_type:       profile.income_type as never,
        debt_method:       profile.debt_method as never,
        motivation_style:  profile.motivation_style as never,
        local_currency:    profile.local_currency as never,
        country:           profile.country as never,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwSaving(true);
    setPwMsg("");
    try {
      await authApi.changePassword({ old_password: oldPw, new_password: newPw });
      setPwMsg("Password updated.");
      setOldPw(""); setNewPw("");
    } catch (err) {
      setPwMsg(err instanceof Error ? err.message : "Failed");
    } finally {
      setPwSaving(false);
    }
  }

  function logout() {
    clearTokens();
    localStorage.clear();
    router.replace("/login");
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Settings</h1>
        <p className="text-slate-500 text-sm mt-0.5">Your profile and preferences</p>
      </div>

      {/* Account info */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Account</h2>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-white text-lg font-bold">
            {user?.full_name?.[0]?.toUpperCase() ?? "?"}
          </div>
          <div>
            <p className="font-semibold text-slate-100">{user?.full_name}</p>
            <p className="text-sm text-slate-400">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      {profile && (
        <form onSubmit={saveProfile} className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Preferences</h2>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Income type</label>
            <select
              value={profile.income_type ?? "fixed"}
              onChange={(e) => setProfile({ ...profile, income_type: e.target.value as never })}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {INCOME_TYPES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Default debt method</label>
            <select
              value={profile.debt_method}
              onChange={(e) => setProfile({ ...profile, debt_method: e.target.value as never })}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {DEBT_METHODS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Motivation style</label>
            <select
              value={profile.motivation_style ?? "disciplined"}
              onChange={(e) => setProfile({ ...profile, motivation_style: e.target.value as never })}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            >
              {MOTIVATION_STYLES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Local currency</label>
              <input
                type="text"
                maxLength={3}
                value={profile.local_currency ?? "ZAR"}
                onChange={(e) => setProfile({ ...profile, local_currency: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Country code</label>
              <input
                type="text"
                maxLength={2}
                value={profile.country ?? "ZA"}
                onChange={(e) => setProfile({ ...profile, country: e.target.value.toUpperCase() })}
                className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
          </div>

          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>}
          {saved && <p className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-sm text-green-400">Saved!</p>}

          <button type="submit" disabled={saving}
            className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
            {saving ? "Saving…" : "Save Preferences"}
          </button>
        </form>
      )}

      {/* Password */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Password</h2>
          <button type="button" onClick={() => setPwSection(!pwSection)}
            className="text-xs text-blue-400 hover:text-blue-300">{pwSection ? "Cancel" : "Change"}</button>
        </div>
        {pwSection && (
          <form onSubmit={changePassword} className="space-y-3">
            <input required type="password" placeholder="Current password" value={oldPw} onChange={(e) => setOldPw(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            <input required type="password" placeholder="New password (min 8 chars)" minLength={8} value={newPw} onChange={(e) => setNewPw(e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            {pwMsg && <p className="text-sm text-slate-400">{pwMsg}</p>}
            <button type="submit" disabled={pwSaving}
              className="w-full rounded-xl bg-slate-700 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-600 disabled:opacity-50">
              {pwSaving ? "Updating…" : "Update Password"}
            </button>
          </form>
        )}
      </div>

      {/* Sign out */}
      <div className="rounded-xl border border-red-500/20 bg-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-red-400 uppercase tracking-wide">Danger Zone</h2>
        <button type="button" onClick={logout}
          className="w-full rounded-xl border border-red-500/30 py-2.5 text-sm font-semibold text-red-400 hover:bg-red-500/10 transition-colors">
          Sign Out
        </button>
      </div>
    </div>
  );
}
