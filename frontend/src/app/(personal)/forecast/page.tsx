"use client";
import Link from "next/link";

export default function ForecastPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Forecast</h1>
        <p className="text-slate-500 text-sm mt-0.5">12-month income and expense projections</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center space-y-4">
        <p className="text-4xl">📅</p>
        <p className="text-slate-300 font-semibold">Forecast coming soon</p>
        <p className="text-sm text-slate-500">
          This will show projected income, expenses, and debt payoff over the next 12 months based on your current plan.
        </p>
        <Link href="/debts" className="text-blue-400 text-sm hover:text-blue-300">View your Freedom Date →</Link>
      </div>
    </div>
  );
}
