"use client";
import Link from "next/link";

const STAGES = [
  { num: 1, title: "Know Your Numbers",     desc: "List every debt, income source, and expense. Face the full picture.", color: "border-red-500/40 bg-red-950/20", dot: "bg-red-500"    },
  { num: 2, title: "Stop The Bleeding",      desc: "Cut unnecessary expenses. Create breathing room.",                   color: "border-orange-500/40 bg-orange-950/20", dot: "bg-orange-500" },
  { num: 3, title: "Clear Small Debts",      desc: "Use snowball momentum to wipe out small balances fast.",             color: "border-amber-500/40 bg-amber-950/20",  dot: "bg-amber-500"  },
  { num: 4, title: "Emergency Fund",         desc: "Build 1–3 months of expenses before attacking large debts.",         color: "border-yellow-500/40 bg-yellow-950/20", dot: "bg-yellow-500" },
  { num: 5, title: "Clear Large Debts",      desc: "Avalanche or snowball your major debts to zero.",                   color: "border-lime-500/40 bg-lime-950/20",    dot: "bg-lime-500"   },
  { num: 6, title: "Save Consistently",      desc: "Automate savings. Build 6-month emergency fund.",                   color: "border-green-500/40 bg-green-950/20",  dot: "bg-green-500"  },
  { num: 7, title: "Begin Investing",        desc: "Invest locally — unit trusts, ETFs, retirement annuities.",          color: "border-teal-500/40 bg-teal-950/20",    dot: "bg-teal-500"   },
  { num: 8, title: "Foreign Investments",    desc: "Diversify offshore. USD assets, global ETFs.",                      color: "border-cyan-500/40 bg-cyan-950/20",    dot: "bg-cyan-500"   },
  { num: 9, title: "Financial Independence", desc: "Passive income covers expenses. You are free.",                     color: "border-blue-500/40 bg-blue-950/20",    dot: "bg-blue-500"   },
];

export default function JourneyPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">9-Stage Journey</h1>
        <p className="text-slate-500 text-sm mt-0.5">Your roadmap from debt to financial independence</p>
      </div>

      <div className="space-y-3">
        {STAGES.map((stage, i) => (
          <div key={stage.num} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white ${stage.dot}`}>
                {stage.num}
              </div>
              {i < STAGES.length - 1 && <div className="w-0.5 flex-1 bg-slate-700 mt-1" />}
            </div>
            <div className={`flex-1 rounded-xl border p-4 mb-3 ${stage.color}`}>
              <p className="text-sm font-semibold text-slate-100">{stage.title}</p>
              <p className="text-xs text-slate-400 mt-1">{stage.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-4 text-center">
        <p className="text-sm text-slate-400">Track your Freedom Date in</p>
        <Link href="/debts" className="text-blue-400 text-sm hover:text-blue-300">Debt Center →</Link>
      </div>
    </div>
  );
}
