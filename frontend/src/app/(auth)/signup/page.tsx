"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

import { authApi } from "@/lib/api";

export default function SignupPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const data = await authApi.signup({ full_name: fullName, email, password });
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Signup failed");
    } finally {
      setLoading(false);
    }
  }

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

          {message ? <p className="rounded-md bg-green-500/10 px-3 py-2 text-sm text-green-300">{message}</p> : null}
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
