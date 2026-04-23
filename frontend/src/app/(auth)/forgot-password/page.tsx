"use client";
import { useState } from "react";
import Link from "next/link";
import { authApi } from "@/lib/api";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
    } finally {
      setSent(true);
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <Card className="text-center space-y-4">
        <div className="text-5xl">📬</div>
        <h2 className="text-xl font-semibold text-slate-100">Reset link sent</h2>
        <p className="text-slate-400 text-sm">
          If that email exists, a reset link has been sent. Check your inbox.
        </p>
        <Link href="/login" className="block text-sm text-blue-400 hover:text-blue-300">
          Back to sign in
        </Link>
      </Card>
    );
  }

  return (
    <Card>
      <h2 className="text-xl font-semibold text-slate-100 mb-2">Reset password</h2>
      <p className="text-sm text-slate-400 mb-6">Enter your email and we&apos;ll send a reset link.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <Button type="submit" loading={loading} className="w-full" size="lg">
          Send reset link
        </Button>
      </form>
      <p className="mt-4 text-sm text-center">
        <Link href="/login" className="text-slate-400 hover:text-blue-400">
          Back to sign in
        </Link>
      </p>
    </Card>
  );
}
