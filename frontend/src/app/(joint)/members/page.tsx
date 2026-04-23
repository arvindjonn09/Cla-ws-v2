"use client";
import { useEffect, useState } from "react";
import { accountApi } from "@/lib/api";
import { getAccountId } from "@/lib/utils";
import type { AccountMember } from "@/types";

export default function MembersPage() {
  const [members, setMembers] = useState<AccountMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"member"|"viewer">("member");
  const [inviting, setInviting] = useState(false);
  const [msg, setMsg] = useState("");

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  useEffect(() => {
    if (!accountId) return;
    setLoading(false);
  }, [accountId]);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId) return;
    setInviting(true); setMsg("");
    try {
      await accountApi.invite(accountId, { email, role });
      setMsg(`Invite sent to ${email}`);
      setEmail("");
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Failed to invite");
    } finally {
      setInviting(false);
    }
  }

  async function remove(userId: string) {
    if (!accountId || !confirm("Remove this member?")) return;
    await accountApi.removeMember(accountId, userId).catch(() => null);
    setMembers((m) => m.filter((x) => x.user_id !== userId));
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" /></div>;

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Members</h1>
        <p className="text-slate-500 text-sm mt-0.5">Manage your joint account team</p>
      </div>

      {/* Invite */}
      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Invite Partner</h2>
        <form onSubmit={invite} className="space-y-3">
          <input
            required type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="partner@example.com"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
          />
          <div className="flex gap-2">
            {(["member","viewer"] as const).map((r) => (
              <button key={r} type="button" onClick={() => setRole(r)}
                className={`flex-1 rounded-lg py-2 text-sm font-medium border capitalize transition-colors ${
                  role === r ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-slate-700 bg-slate-900 text-slate-400"
                }`}>
                {r}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            Members can see and edit everything. Viewers can only observe — they can never become members (Business Rule #7).
          </p>
          {msg && <p className="text-sm text-slate-400">{msg}</p>}
          <button type="submit" disabled={inviting}
            className="w-full rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
            {inviting ? "Sending…" : "Send Invite"}
          </button>
        </form>
      </div>

      {/* Current members */}
      {members.length > 0 ? (
        <div className="rounded-xl border border-slate-700 bg-slate-800 overflow-hidden">
          {members.map((m, i) => (
            <div key={m.id} className={`flex items-center justify-between px-4 py-3 ${i !== 0 ? "border-t border-slate-700" : ""}`}>
              <div>
                <p className="text-sm text-slate-200 capitalize">{m.role}</p>
                <p className="text-xs text-slate-500 capitalize">{m.status}</p>
              </div>
              {m.status === "active" && (
                <button type="button" onClick={() => remove(m.user_id)}
                  className="text-xs text-red-400 hover:text-red-300">Remove</button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-slate-500 text-sm">No other members yet — invite your partner above</p>
        </div>
      )}
    </div>
  );
}
