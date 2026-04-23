"use client";

export default function AnnualReviewPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Annual Review</h1>
        <p className="text-slate-500 text-sm mt-0.5">Year-end financial health check</p>
      </div>
      <div className="rounded-2xl border border-dashed border-slate-700 p-12 text-center space-y-4">
        <p className="text-4xl">🏆</p>
        <p className="text-slate-300 font-semibold">Annual Review coming soon</p>
        <p className="text-sm text-slate-500">
          At year end, review your debt reduction, savings growth, and stage progression with a full year summary.
        </p>
      </div>
    </div>
  );
}
