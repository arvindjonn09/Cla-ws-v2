"use client";
import Link from "next/link";

const insightItems = [
  {
    href: "/boundaries",
    title: "Boundaries",
    label: "Shared, personal, and grey-zone rules",
    accent: "border-amber-500/30 bg-amber-950/20 text-amber-300",
  },
  {
    href: "/shared-budget",
    title: "Budget",
    label: "Joint spending and category breakdowns",
    accent: "border-emerald-500/30 bg-emerald-950/20 text-emerald-300",
  },
  {
    href: "/contributions",
    title: "Contributors",
    label: "Who paid what across shared costs",
    accent: "border-blue-500/30 bg-blue-950/20 text-blue-300",
  },
  {
    href: "/sacrifice-log",
    title: "Sacrifice Log",
    label: "Small tradeoffs made for the mission",
    accent: "border-rose-500/30 bg-rose-950/20 text-rose-300",
  },
];

export default function InsightsPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Insights</h1>
        <p className="text-slate-500 text-sm mt-0.5">Joint account decisions, spending patterns, and contribution context</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {insightItems.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`min-h-44 rounded-xl border p-5 transition hover:-translate-y-0.5 hover:border-slate-500 ${item.accent}`}
          >
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide opacity-70">Insight</p>
                <h2 className="mt-3 text-xl font-bold text-slate-100">{item.title}</h2>
                <p className="mt-2 text-sm text-slate-400">{item.label}</p>
              </div>
              <p className="mt-6 text-sm font-semibold">Open</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
