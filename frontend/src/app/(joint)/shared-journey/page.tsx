"use client";

const STAGES = [
  { num: 1, title: "Know Your Numbers",     icon: "🔍" },
  { num: 2, title: "Stop The Bleeding",      icon: "🩹" },
  { num: 3, title: "Clear Small Debts",      icon: "⛓"  },
  { num: 4, title: "Emergency Fund",         icon: "🛡"  },
  { num: 5, title: "Clear Large Debts",      icon: "🔨" },
  { num: 6, title: "Save Consistently",      icon: "💰" },
  { num: 7, title: "Begin Investing",        icon: "📈" },
  { num: 8, title: "Foreign Investments",    icon: "🌍" },
  { num: 9, title: "Financial Independence", icon: "🏁" },
];

export default function SharedJourneyPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Shared Journey</h1>
        <p className="text-slate-500 text-sm mt-0.5">Your joint 9-stage path to financial independence</p>
      </div>

      <div className="space-y-2">
        {STAGES.map((s) => (
          <div key={s.num} className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 flex items-center gap-4">
            <span className="text-xl">{s.icon}</span>
            <div>
              <span className="text-xs text-slate-500 mr-2">Stage {s.num}</span>
              <span className="text-sm text-slate-200">{s.title}</span>
            </div>
          </div>
        ))}
      </div>


    </div>
  );
}
