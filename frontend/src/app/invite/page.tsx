"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { accountApi } from "@/lib/api";
import { saveAccountMemberships, saveJointAccountMeta } from "@/lib/utils";

function InviteContent() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token") ?? "";

  const [status, setStatus] = useState<"checking" | "accepting" | "done" | "error" | "needs_login">("checking");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");

  useEffect(() => {
    if (!token) { setStatus("error"); setMessage("No invite token found."); return; }

    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

    if (!accessToken) {
      // Store token so we can use it after login
      if (typeof window !== "undefined") localStorage.setItem("pending_invite", token);
      setStatus("needs_login");
      return;
    }

    setStatus("accepting");
    accountApi.acceptInvite(token)
      .then((res) => {
        setRole(res.role);
        // Keep personal and joint account IDs separate so joint membership does not leak personal data.
        saveJointAccountMeta(res.account_id, res.role, true);
        accountApi.listMine().then(saveAccountMemberships).catch(() => {});
        setStatus("done");
      })
      .catch((err) => {
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "Failed to accept invite");
      });
  }, [token]);

  if (status === "checking" || status === "accepting") {
    return (
      <div className="text-center space-y-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-400 mx-auto" />
        <p className="text-slate-400 text-sm">{status === "accepting" ? "Accepting invite…" : "Checking…"}</p>
      </div>
    );
  }

  if (status === "needs_login") {
    return (
      <div className="text-center space-y-5">
        <div className="text-5xl">🔐</div>
        <h2 className="text-xl font-semibold text-slate-100">Sign in to accept</h2>
        <p className="text-slate-400 text-sm">
          You need to be signed in to accept this joint account invitation.
        </p>
        <Link
          href={`/login?redirect=/invite?token=${token}`}
          className="block w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-500 text-center transition-colors"
        >
          Sign in
        </Link>
        <Link
          href={`/signup?redirect=/invite?token=${token}`}
          className="block text-sm text-slate-400 hover:text-purple-400"
        >
          No account? Create one →
        </Link>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="text-center space-y-5">
        <div className="text-5xl">🎉</div>
        <h2 className="text-xl font-semibold text-slate-100">You&apos;re in!</h2>
        <p className="text-slate-400 text-sm">
          You&apos;ve joined as a <span className="text-purple-400 font-semibold capitalize">{role}</span>.
          Welcome to the joint account.
        </p>
        <button
          type="button"
          onClick={() => router.replace("/war-room")}
          className="w-full rounded-xl bg-purple-600 py-3 text-sm font-semibold text-white hover:bg-purple-500 transition-colors"
        >
          Go to War Room →
        </button>
      </div>
    );
  }

  return (
    <div className="text-center space-y-4">
      <div className="text-5xl">❌</div>
      <h2 className="text-xl font-semibold text-slate-100">Invite failed</h2>
      <p className="text-red-400 text-sm">{message || "This invite link is invalid or has expired."}</p>
      <Link href="/dashboard" className="text-blue-400 text-sm hover:text-blue-300">
        Go to dashboard →
      </Link>
    </div>
  );
}

export default function InvitePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md">
        <p className="text-blue-400 font-bold text-sm mb-8 text-center">Financial Command Center</p>
        <Suspense fallback={<div className="text-slate-400 text-sm text-center">Loading…</div>}>
          <InviteContent />
        </Suspense>
      </div>
    </div>
  );
}
