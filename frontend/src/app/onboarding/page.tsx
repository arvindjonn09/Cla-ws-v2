"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { accountApi } from "@/lib/api";
import { getAccountId, saveAccountMeta } from "@/lib/utils";

type Step = "situation" | "income" | "debt_method" | "motivation" | "done";

const STEPS: Step[] = ["situation", "income", "debt_method", "motivation", "done"];

const SITUATIONS = [
  { value: "in_debt",       label: "In debt",        icon: "⛓",  desc: "I have debts I need to clear"                  },
  { value: "breaking_even", label: "Breaking even",  icon: "⚖",  desc: "Income covers expenses, nothing left over"      },
  { value: "stable",        label: "Stable",         icon: "🟢", desc: "I have savings and growing slowly"              },
  { value: "growing",       label: "Growing",        icon: "🚀", desc: "I save consistently and invest regularly"        },
];

const INCOME_TYPES = [
  { value: "fixed",    label: "Fixed salary",   icon: "📅", desc: "Same amount on the same date each month"        },
  { value: "casual",   label: "Casual / shifts", icon: "📆", desc: "Day labour, part-time, irregular shifts"        },
  { value: "variable", label: "Variable",        icon: "📊", desc: "Uber, freelance, commission — changes each month" },
  { value: "multiple", label: "Multiple sources",icon: "💼", desc: "More than one regular income stream"            },
];

const DEBT_METHODS = [
  { value: "snowball",  label: "Snowball",  icon: "⛄", desc: "Pay smallest balance first — builds momentum"    },
  { value: "avalanche", label: "Avalanche", icon: "🏔", desc: "Pay highest interest first — saves most money"   },
  { value: "custom",    label: "Custom",    icon: "✏",  desc: "I want to choose the order myself"               },
];

const MOTIVATION_STYLES = [
  { value: "disciplined",       label: "Disciplined",       icon: "🎯", desc: "Show me the numbers, I stick to the plan"      },
  { value: "motivation_driven", label: "Motivation-driven", icon: "🔥", desc: "I need wins, encouragement, and momentum"      },
];

function OptionCard({
  option,
  selected,
  onSelect,
}: {
  option: { value: string; label: string; icon: string; desc: string };
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full text-left rounded-xl border p-4 transition-all ${
        selected
          ? "border-blue-500 bg-blue-500/15 ring-1 ring-blue-500"
          : "border-slate-700 bg-slate-800 hover:border-slate-500"
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl mt-0.5">{option.icon}</span>
        <div>
          <p className="font-semibold text-slate-100">{option.label}</p>
          <p className="text-sm text-slate-400 mt-0.5">{option.desc}</p>
        </div>
        {selected && (
          <span className="ml-auto text-blue-400 font-bold text-lg">✓</span>
        )}
      </div>
    </button>
  );
}

export default function OnboardingPage() {
  const router = useRouter();
  const [stepIdx, setStepIdx] = useState(0);
  const [saving, setSaving] = useState(false);

  const [situation, setSituation] = useState("");
  const [incomeType, setIncomeType] = useState("");
  const [debtMethod, setDebtMethod] = useState("snowball");
  const [motivation, setMotivation] = useState("");

  const step = STEPS[stepIdx];
  const progress = Math.round(((stepIdx) / (STEPS.length - 1)) * 100);

  async function finish() {
    setSaving(true);
    try {
      const accountId = getAccountId();
      if (accountId) {
        await accountApi.updateProfile(accountId, {
          financial_situation: situation as never,
          income_type: incomeType as never,
          debt_method: debtMethod as never,
          motivation_style: motivation as never,
          onboarding_complete: true,
        });
        const accountType = localStorage.getItem("account_type") ?? "personal";
        const role = localStorage.getItem("role") ?? "member";
        saveAccountMeta(accountId, accountType, role, true);
      }
    } catch { /* continue anyway */ }
    finally { setSaving(false); }
    router.replace("/dashboard");
  }

  function next() {
    if (stepIdx < STEPS.length - 1) setStepIdx((i) => i + 1);
  }
  function back() {
    if (stepIdx > 0) setStepIdx((i) => i - 1);
  }

  const canProceed = {
    situation: !!situation,
    income: !!incomeType,
    debt_method: !!debtMethod,
    motivation: !!motivation,
    done: true,
  }[step];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
        <p className="text-blue-400 font-bold text-sm">Financial Command Center</p>
        <p className="text-slate-500 text-sm">Step {stepIdx + 1} of {STEPS.length}</p>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-slate-800">
        <div
          className="h-1 bg-blue-500 transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <main className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-lg space-y-6">

          {step === "situation" && (
            <>
              <div>
                <h1 className="text-3xl font-bold text-white">Where are you right now?</h1>
                <p className="text-slate-400 mt-2">Be honest — this sets your starting point. You can change it anytime.</p>
              </div>
              <div className="space-y-3">
                {SITUATIONS.map((s) => (
                  <OptionCard key={s.value} option={s} selected={situation === s.value} onSelect={() => setSituation(s.value)} />
                ))}
              </div>
            </>
          )}

          {step === "income" && (
            <>
              <div>
                <h1 className="text-3xl font-bold text-white">How do you earn?</h1>
                <p className="text-slate-400 mt-2">This determines how the app calculates your plan.</p>
              </div>
              <div className="space-y-3">
                {INCOME_TYPES.map((s) => (
                  <OptionCard key={s.value} option={s} selected={incomeType === s.value} onSelect={() => setIncomeType(s.value)} />
                ))}
              </div>
            </>
          )}

          {step === "debt_method" && (
            <>
              <div>
                <h1 className="text-3xl font-bold text-white">How should we attack your debt?</h1>
                <p className="text-slate-400 mt-2">
                  Don&apos;t worry — all three methods are always shown. This sets your default.
                </p>
              </div>
              <div className="space-y-3">
                {DEBT_METHODS.map((s) => (
                  <OptionCard key={s.value} option={s} selected={debtMethod === s.value} onSelect={() => setDebtMethod(s.value)} />
                ))}
              </div>
            </>
          )}

          {step === "motivation" && (
            <>
              <div>
                <h1 className="text-3xl font-bold text-white">What keeps you going?</h1>
                <p className="text-slate-400 mt-2">This shapes how the app talks to you.</p>
              </div>
              <div className="space-y-3">
                {MOTIVATION_STYLES.map((s) => (
                  <OptionCard key={s.value} option={s} selected={motivation === s.value} onSelect={() => setMotivation(s.value)} />
                ))}
              </div>
            </>
          )}

          {step === "done" && (
            <div className="text-center space-y-5 py-8">
              <div className="text-6xl">🏁</div>
              <h1 className="text-3xl font-bold text-white">You&apos;re all set.</h1>
              <p className="text-slate-400">
                Your Command Center is ready. Add your first debt and see your{" "}
                <span className="text-blue-400 font-semibold">Freedom Date</span>.
              </p>
            </div>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-2">
            {stepIdx > 0 && step !== "done" && (
              <button
                type="button"
                onClick={back}
                className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-3 font-semibold text-slate-300 hover:border-slate-500 transition-colors"
              >
                Back
              </button>
            )}
            {step !== "done" ? (
              <button
                type="button"
                onClick={next}
                disabled={!canProceed}
                className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Continue
              </button>
            ) : (
              <button
                type="button"
                onClick={finish}
                disabled={saving}
                className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                {saving ? "Setting up…" : "Enter Command Center"}
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
