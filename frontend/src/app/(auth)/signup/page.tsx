"use client";

import Link from "next/link";
import { FormEvent, useState, useEffect, useRef } from "react";

import { authApi } from "@/lib/api";

const COUNTDOWN_SECONDS = 45;
const POLL_INTERVAL_MS = 8_000;

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // After successful signup
  const [signedUp, setSignedUp] = useState(false);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [emailSent, setEmailSent] = useState<boolean | null>(null); // null = checking
  const [emailFailed, setEmailFailed] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState("");

  const signedUpEmail = useRef("");

  // Persist invite token from ?redirect= so it survives the email verification flow
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const redirect = params.get("redirect");
    if (redirect) {
      const match = redirect.match(/[?&]token=([^&]+)/);
      if (match) localStorage.setItem("pending_invite", match[1]);
    }
  }, []);

  // Countdown + polling after signup
  useEffect(() => {
    if (!signedUp) return;

    const tickId = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(tickId);
          return 0;
        }
        return prev - 1;
      });
    }, 1_000);

    const pollId = setInterval(async () => {
      try {
        const res = await fetch(
          `/api/auth/email-status?email=${encodeURIComponent(signedUpEmail.current)}`
        );
        if (!res.ok) return;
        const data: { status: string; sent: boolean } = await res.json();
        if (data.sent) {
          setEmailSent(true);
          clearInterval(pollId);
        } else if (data.status === "failed") {
          setEmailFailed(true);
          setEmailSent(false);
          clearInterval(pollId);
        }
      } catch {
        // network error — keep polling
      }
    }, POLL_INTERVAL_MS);

    // Stop polling after countdown ends
    const stopId = setTimeout(() => {
      clearInterval(pollId);
    }, COUNTDOWN_SECONDS * 1_000);

    return () => {
      clearInterval(tickId);
      clearInterval(pollId);
      clearTimeout(stopId);
    };
  }, [signedUp]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await authApi.signup({ full_name: fullName, email, password });
      signedUpEmail.current = email;
      setSignedUp(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResendLoading(true);
    setResendMessage("");
    try {
      await authApi.resendVerification(signedUpEmail.current);
      setResendMessage("Verification email resent. Check your inbox.");
      // Reset countdown and start again
      setCountdown(COUNTDOWN_SECONDS);
      setEmailSent(null);
      setEmailFailed(false);
      setSignedUp(false);
      setTimeout(() => setSignedUp(true), 50);
    } catch {
      setResendMessage("Could not resend. Try again in a moment.");
    } finally {
      setResendLoading(false);
    }
  }

  // ── Success view ──────────────────────────────────────────────────────────────
  if (signedUp) {
    return (
      <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center">
          <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10">
                <svg className="h-7 w-7 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25H4.5a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5H4.5a2.25 2.25 0 00-2.25 2.25m19.5 0-9.75 6.75L2.25 6.75" />
                </svg>
              </div>
            </div>

            <h2 className="mb-2 text-xl font-semibold text-white">Account created</h2>
            <p className="text-slate-400">Check your email to verify.</p>

            {/* Delivery status */}
            <div className="mt-6">
              {emailFailed ? (
                <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
                  Email delivery failed — try after some time.
                </p>
              ) : emailSent ? (
                <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-300">
                  Verification email delivered to your inbox.
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  {countdown > 0 ? `Checking delivery… ${countdown}s` : "Delivery check complete."}
                </p>
              )}
            </div>

            {/* Resend button — only after countdown */}
            {countdown === 0 && !emailSent && (
              <div className="mt-4">
                {resendMessage ? (
                  <p className="text-sm text-slate-400">{resendMessage}</p>
                ) : (
                  <button
                    onClick={resend}
                    disabled={resendLoading}
                    className="rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
                  >
                    {resendLoading ? "Resending…" : "Resend verification"}
                  </button>
                )}
              </div>
            )}

            <p className="mt-8 text-sm text-slate-500">
              Already verified?{" "}
              <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </main>
    );
  }

  // ── Signup form ───────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
      <section className="mx-auto flex min-h-[calc(100vh-6rem)] max-w-md flex-col justify-center">
        <div className="mb-8">
          <p className="mb-3 text-sm font-semibold text-blue-400">Financial Command Center</p>
          <h1 className="text-4xl font-bold tracking-normal text-white">Create account</h1>
          <p className="mt-3 text-slate-400">Start with your personal command center.</p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-6">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Full name</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-white outline-none focus:border-blue-500"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Email</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-white outline-none focus:border-blue-500"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">Password</span>
            <input
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-3 text-white outline-none focus:border-blue-500"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          {error ? <p className="rounded-md bg-red-500/10 px-3 py-2 text-sm text-red-300">{error}</p> : null}

          <button
            className="w-full rounded-md bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            type="submit"
            disabled={loading}
          >
            {loading ? "Creating..." : "Create account"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
