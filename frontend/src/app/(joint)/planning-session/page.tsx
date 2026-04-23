"use client";

const AGENDA = [
  { icon: "📊", title: "Review the numbers",    desc: "Check total debt, monthly payments, and Freedom Date progress." },
  { icon: "✅", title: "Celebrate wins",          desc: "Name one financial win each since last session." },
  { icon: "⚠",  title: "Address warnings",        desc: "Review payment warnings and upcoming due dates." },
  { icon: "🎯", title: "Check goal progress",     desc: "Are shared goals on track? Adjust contributions if needed." },
  { icon: "🗂",  title: "Review boundaries",       desc: "Are shared/personal classifications still working?" },
  { icon: "🔮", title: "Plan next 30 days",        desc: "Set one shared financial intention for the coming month." },
];

export default function PlanningSessionPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Planning Session</h1>
        <p className="text-slate-500 text-sm mt-0.5">Monthly joint money meeting — 30 minutes, every month</p>
      </div>

      <div className="rounded-xl border border-purple-500/20 bg-purple-950/10 p-4 text-sm text-slate-400">
        Run this agenda together once a month. Both partners should have the app open during the session.
      </div>

      <div className="space-y-3">
        {AGENDA.map((item, i) => (
          <div key={i} className="rounded-xl border border-slate-700 bg-slate-800 p-4 flex gap-4">
            <span className="text-2xl shrink-0">{item.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">{item.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{item.desc}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
