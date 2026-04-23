"use client";
import Link from "next/link";

export default function SharedInvestmentsPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Shared Investments</h1>
        <p className="text-slate-500 text-sm mt-0.5">Joint investment portfolio — Stage 7+</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center space-y-4">
        <p className="text-4xl">📈</p>
        <p className="text-slate-300 font-semibold">Shared investments coming soon</p>
        <p className="text-sm text-slate-500">Track joint investments, shared ETFs, and combined portfolio performance.</p>
        <Link href="/investments" className="text-purple-400 text-sm hover:text-purple-300">View personal investments →</Link>
      </div>
    </div>
  );
}
