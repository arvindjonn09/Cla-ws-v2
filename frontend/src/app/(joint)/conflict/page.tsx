"use client";

const PROMPTS = [
  "How are you feeling about our financial progress this week?",
  "Is there anything about our money plan that's worrying you?",
  "What's one thing you'd like us to change about how we handle money?",
  "Are we on the same page about our priorities right now?",
  "What sacrifice have you made this week that you're proud of?",
  "Is there any tension around money we should talk about?",
];

export default function ConflictPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Check-In</h1>
        <p className="text-slate-500 text-sm mt-0.5">Weekly money check-in to stay aligned</p>
      </div>

      <div className="rounded-xl border border-blue-500/20 bg-blue-950/10 p-4 text-sm text-slate-400">
        Use these prompts in your weekly money check-in. Take turns answering honestly — no blame, no judgment.
        Say <span className="text-blue-400">&quot;we&quot;</span> and <span className="text-blue-400">&quot;our&quot;</span>, not &quot;you&quot; or &quot;your&quot;.
      </div>

      <div className="space-y-3">
        {PROMPTS.map((p, i) => (
          <div key={i} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
            <div className="flex gap-3 items-start">
              <span className="text-purple-400 font-bold text-sm shrink-0">{i + 1}.</span>
              <p className="text-sm text-slate-300">{p}</p>
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-slate-600 text-center">
        For deeper discussions, use <a href="/safe-space" className="text-purple-400 hover:text-purple-300">Safe Space</a>.
      </p>
    </div>
  );
}
