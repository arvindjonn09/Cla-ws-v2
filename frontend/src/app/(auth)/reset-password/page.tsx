"use client";
import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";

function ResetForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  if (!token) {
    return (
      <div className="text-center space-y-4">
        <p className="text-red-400 text-sm">Missing reset token. Use the link from your email.</p>
        <Link href="/forgot-password" className="text-blue-400 text-sm hover:text-blue-300">
          Request a new link →
        </Link>
      </div>
    );
  }

  if (done) {
    return (
      <div className="text-center space-y-4">
        <div className="text-5xl">✅</div>
        <h2 className="text-xl font-semibold text-slate-100">Password reset</h2>
        <p className="text-slate-400 text-sm">Your password has been updated. You can now sign in.</p>
        <Link href="/login" className="block text-blue-400 text-sm hover:text-blue-300">
          Sign in →
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirm) { setError("Passwords do not match"); return; }
    if (newPassword.length < 8) { setError("Password must be at least 8 characters"); return; }
    setError("");
    setLoading(true);
    try {
      await authApi.resetPassword(token, newPassword);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reset failed — link may be expired");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-white">Set new password</h1>
        <p className="text-slate-400 mt-2 text-sm">Choose a strong password of at least 8 characters.</p>
      </div>
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-6">
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">New password</span>
          <input
            type="password"
            required
            minLength={8}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-300">Confirm password</span>
          <input
            type="password"
            required
            minLength={8}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </label>
        {error && (
          <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>
        )}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-60 transition-colors"
        >
          {loading ? "Resetting…" : "Reset password"}
        </button>
      </form>
      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-slate-400 hover:text-blue-400">Back to sign in</Link>
      </p>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="text-slate-400 text-sm text-center">Loading…</div>}>
      <ResetForm />
    </Suspense>
  );
}
