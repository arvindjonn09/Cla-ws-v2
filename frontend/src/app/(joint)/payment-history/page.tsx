"use client";
import Link from "next/link";

export default function PaymentHistoryPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Payment History</h1>
        <p className="text-slate-500 text-sm mt-0.5">All logged debt payments for this account</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center space-y-4">
        <p className="text-4xl">📋</p>
        <p className="text-slate-300 font-semibold">Payment history coming soon</p>
        <p className="text-sm text-slate-500">Full audit log of all debt payments — date, amount, who logged it.</p>
        <Link href="/shared-debts" className="text-purple-400 text-sm hover:text-purple-300">View shared debts →</Link>
      </div>
    </div>
  );
}
