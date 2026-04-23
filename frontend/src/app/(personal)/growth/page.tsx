"use client";
import Link from "next/link";

export default function GrowthPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Growth</h1>
        <p className="text-slate-500 text-sm mt-0.5">Net worth and wealth trajectory over time</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center space-y-4">
        <p className="text-4xl">📈</p>
        <p className="text-slate-300 font-semibold">Growth charts coming soon</p>
        <p className="text-sm text-slate-500">
          Track your net worth, debt reduction rate, and investment growth month by month.
        </p>
        <Link href="/net-worth" className="text-blue-400 text-sm hover:text-blue-300">Check net worth →</Link>
      </div>
    </div>
  );
}
