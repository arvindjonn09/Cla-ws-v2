"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState, useRef } from "react";

import { authApi } from "@/lib/api";
import { saveTokens, saveAccountMeta } from "@/lib/utils";

function parseJwt(token: string): Record<string, unknown> | null {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

type Phase = "verifying" | "success" | "expired" | "invalid";

function VerifyContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");
  const email = searchParams.get("email") || "";

  const [phase, setPhase] = useState<Phase>("verifying");
  const [resendEmail, setResendEmail] = useState("");
  const [resendSent, setResendSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [countdown, setCountdown] = useState(3);
  const ranRef = useRef(false);
  const autoResentRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    ranRef.current = true;

    async function verify() {
      if (!token) { setPhase("invalid"); return; }
      try {
        const data = await authApi.verifyEmail(token);
        // Save session
        saveTokens(data.access_token, data.refresh_token);
        localStorage.setItem("user", JSON.stringify(data.user));
        const payload = parseJwt(data.access_token);
        const accountId = payload?.account_id as string | null;
        const accountType = (payload?.account_type as string) ?? "personal";
        const role = (payload?.role as string) ?? "member";
        if (accountId) saveAccountMeta(accountId, accountType, role, false);
        setPhase("success");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "";
        setPhase(msg.toLowerCase().includes("expired") ? "expired" : "invalid");
      }
    }

    verify();
  }, [token]);

  useEffect(() => {
    if (phase !== "expired" && phase !== "invalid") return;
    if (!email || autoResentRef.current) return;

    autoResentRef.current = true;
    setResendLoading(true);
    setResendEmail(email);

    async function resendAutomatically() {
      try {
        await authApi.resendVerification(email);
      } finally {
        setResendSent(true);
        setResendLoading(false);
      }
    }

    resendAutomatically();
  }, [phase, email]);

  function redirectAfterVerify() {
    const pendingInvite = localStorage.getItem("pending_invite");
    if (pendingInvite) {
      localStorage.removeItem("pending_invite");
      router.replace(`/invite?token=${pendingInvite}`);
    } else {
      router.replace("/onboarding");
    }
  }

  // Countdown redirect after success
  useEffect(() => {
    if (phase !== "success") return;
    if (countdown <= 0) { redirectAfterVerify(); return; }
    const id = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, countdown, router]);

  async function resend() {
    if (!resendEmail.trim()) return;
    setResendLoading(true);
    try {
      await authApi.resendVerification(resendEmail.trim());
      setResendSent(true);
    } catch {
      setResendSent(true); // still show success to prevent enumeration
    } finally {
      setResendLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">

        {/* ── Verifying ─────────────────────────────────────────────── */}
        {phase === "verifying" && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-blue-400" />
            </div>
            <h1 className="text-2xl font-bold text-white">Verifying your email</h1>
            <p className="mt-2 text-slate-400">Just a moment…</p>
          </>
        )}

        {/* ── Success ───────────────────────────────────────────────── */}
        {phase === "success" && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-green-500/10">
                <svg className="h-7 w-7 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Email verified</h1>
            <p className="mt-2 text-slate-400">
              You&apos;re all set. Taking you to your Command Center in{" "}
              <span className="font-semibold text-white">{countdown}s</span>…
            </p>
            <button
              onClick={redirectAfterVerify}
              className="mt-6 w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500"
            >
              Continue now
            </button>
          </>
        )}

        {/* ── Expired ───────────────────────────────────────────────── */}
        {phase === "expired" && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10">
                <svg className="h-7 w-7 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Link expired</h1>
            <p className="mt-2 text-slate-400">
              You haven&apos;t verified yet, so we&apos;re sending you another verification email. Please verify within 1 hour.
            </p>

            {resendSent ? (
              <p className="mt-6 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-300">
                New verification email sent — check your inbox.
              </p>
            ) : (
              <div className="mt-6 space-y-3 text-left">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-white outline-none focus:border-blue-500"
                />
                <button
                  onClick={resend}
                  disabled={resendLoading || !resendEmail.trim()}
                  className="w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Invalid ───────────────────────────────────────────────── */}
        {phase === "invalid" && (
          <>
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-500/10">
                <svg className="h-7 w-7 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
                </svg>
              </div>
            </div>
            <h1 className="text-2xl font-bold text-white">Link not valid</h1>
            <p className="mt-2 text-slate-400">
              You haven&apos;t verified yet, so we&apos;re sending you another verification email. Please verify within 1 hour.
            </p>
            {resendSent ? (
              <p className="mt-6 rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-300">
                New verification email sent — check your inbox.
              </p>
            ) : (
              <div className="mt-6 space-y-3 text-left">
                <input
                  type="email"
                  placeholder="your@email.com"
                  value={resendEmail}
                  onChange={(e) => setResendEmail(e.target.value)}
                  className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-white outline-none focus:border-blue-500"
                />
                <button
                  onClick={resend}
                  disabled={resendLoading || !resendEmail.trim()}
                  className="w-full rounded-md bg-blue-600 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                >
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </button>
              </div>
            )}
          </>
        )}

      </section>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-blue-400" />
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
