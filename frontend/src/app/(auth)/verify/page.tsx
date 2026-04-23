"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { authApi } from "@/lib/api";

function VerifyContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [message, setMessage] = useState("Verifying your email...");

  useEffect(() => {
    async function verify() {
      if (!token) {
        setMessage("Verification token is missing.");
        return;
      }
      try {
        const data = await authApi.verifyEmail(token);
        setMessage(data.message);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Verification failed");
      }
    }
    verify();
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
      <section className="w-full max-w-md rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <p className="mb-3 text-sm font-semibold text-blue-400">Financial Command Center</p>
        <h1 className="text-3xl font-bold text-white">Email verification</h1>
        <p className="mt-4 text-slate-300">{message}</p>
        <Link
          href="/login"
          className="mt-6 inline-flex rounded-md bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-500"
        >
          Go to sign in
        </Link>
      </section>
    </main>
  );
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
          <p className="text-slate-300">Loading verification...</p>
        </main>
      }
    >
      <VerifyContent />
    </Suspense>
  );
}
