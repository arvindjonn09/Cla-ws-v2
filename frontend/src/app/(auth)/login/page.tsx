"use client";
import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { accountApi, authApi } from "@/lib/api";
import { saveTokens, saveAccountMeta, saveAccountMemberships } from "@/lib/utils";

function parseJwt(token: string): Record<string, unknown> | null {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Read ?redirect= param so invite flow can return after login
  const searchParams = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search)
    : null;
  const redirectTo = searchParams?.get("redirect") ?? null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await authApi.login({ email, password });
      saveTokens(data.access_token, data.refresh_token);
      localStorage.setItem("user", JSON.stringify(data.user));

      const payload = parseJwt(data.access_token);
      const accountId = payload?.account_id as string | null;
      const accountType = (payload?.account_type as string) ?? "personal";
      const role = (payload?.role as string) ?? "member";
      const onboardingComplete = data.onboarding_complete;

      if (accountId) saveAccountMeta(accountId, accountType, role, onboardingComplete);
      const memberships = await accountApi.listMine().catch(() => []);
      saveAccountMemberships(memberships);

      // If there was a pending invite or redirect target, go there
      if (redirectTo) { router.replace(redirectTo); return; }
      const pendingInvite = localStorage.getItem("pending_invite");
      if (pendingInvite) { localStorage.removeItem("pending_invite"); router.replace(`/invite?token=${pendingInvite}`); return; }
      router.replace(onboardingComplete ? "/dashboard" : "/onboarding");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold text-blue-400">Financial Command Center</p>
          <h1 className="text-4xl font-bold tracking-normal text-white">Sign in</h1>
          <p className="mt-3 text-slate-400">Continue your debt-to-freedom plan.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-slate-700 bg-slate-800 p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-3 text-white outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
          </label>

          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>}

          <button
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Signing in…" : "Sign in"}
          </button>

          <div className="text-center">
            <Link href="/forgot-password" className="text-sm text-slate-400 hover:text-blue-400 transition-colors">
              Forgot password?
            </Link>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          No account yet?{" "}
          <Link href="/signup" className="font-semibold text-blue-400 hover:text-blue-300">
            Create one
          </Link>
        </p>
      </section>
    </main>
  );
}
