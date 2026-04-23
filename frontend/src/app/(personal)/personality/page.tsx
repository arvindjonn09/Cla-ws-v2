"use client";

const PROFILES = [
  { value: "disciplined",   label: "Disciplined",   icon: "🎯", desc: "You stick to the plan. Numbers first, motivation follows." },
  { value: "motivated",     label: "Momentum Seeker",icon: "🔥", desc: "You need wins and visible progress to keep going." },
  { value: "social",        label: "Social Learner",  icon: "👥", desc: "Accountability and shared goals keep you on track." },
  { value: "visual",        label: "Visual Thinker",  icon: "📊", desc: "Charts, progress bars, and dashboards drive your behaviour." },
];

export default function PersonalityPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Spending Personality</h1>
        <p className="text-slate-500 text-sm mt-0.5">Understand your money mindset</p>
      </div>

      <div className="space-y-3">
        {PROFILES.map((p) => (
          <div key={p.value} className="rounded-xl border border-slate-700 bg-slate-800 p-4 flex items-start gap-4">
            <span className="text-2xl mt-0.5">{p.icon}</span>
            <div>
              <p className="text-sm font-semibold text-slate-100">{p.label}</p>
              <p className="text-xs text-slate-400 mt-1">{p.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-950/20 p-4 text-sm text-slate-400">
        Your spending personality is set during onboarding. Update it in{" "}
        <a href="/settings" className="text-blue-400 hover:text-blue-300">Settings</a>.
      </div>
    </div>
  );
}
