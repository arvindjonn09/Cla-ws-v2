"use client";
import { useEffect, useState, useCallback } from "react";
import { investmentApi } from "@/lib/api";
import { getAccountId, fmt } from "@/lib/utils";
import type { Investment, AssetType, PortfolioSummary } from "@/types";

const ASSET_LABELS: Record<AssetType, string> = {
  stocks:        "Stocks",
  bonds:         "Bonds",
  mutual_funds:  "Mutual Funds",
  property:      "Property",
  crypto:        "Crypto",
  fixed_deposit: "Fixed Deposit",
  retirement:    "Retirement",
  foreign_cash:  "Foreign Cash",
  other:         "Other",
};
const ASSET_TYPES: AssetType[] = [
  "stocks","bonds","mutual_funds","property","crypto","fixed_deposit","retirement","foreign_cash","other",
];
const CURRENCIES = ["EUR","USD","INR","AUD"];

type InvForm = {
  name: string;
  asset_type: AssetType;
  currency: string;
  current_value: string;
  purchase_price: string;
  units: string;
  current_price: string;
  country: string;
};

function InvModal({
  inv,
  onClose,
  onSave,
}: {
  inv: Investment | null;
  onClose: () => void;
  onSave: (f: InvForm) => Promise<void>;
}) {
  const [form, setForm] = useState<InvForm>({
    name:           inv?.name ?? "",
    asset_type:     inv?.asset_type ?? "stocks",
    currency:       inv?.currency ?? "USD",
    current_value:  String(inv?.current_value ?? ""),
    purchase_price: String(inv?.purchase_price ?? ""),
    units:          String(inv?.units ?? ""),
    current_price:  String(inv?.current_price ?? ""),
    country:        inv?.country ?? "ZA",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function set(k: keyof InvForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{inv ? "Edit Investment" : "Add Investment"}</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Name *</label>
            <input required value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="e.g. Satrix 40 ETF"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">Asset type</label>
              <select value={form.asset_type} onChange={(e) => set("asset_type", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{ASSET_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select value={form.currency} onChange={(e) => set("currency", e.target.value)}
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current value *</label>
              <input required type="number" min="0" step="0.01" value={form.current_value}
                onChange={(e) => set("current_value", e.target.value)} placeholder="0.00"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Purchase price</label>
              <input type="number" min="0" step="0.01" value={form.purchase_price}
                onChange={(e) => set("purchase_price", e.target.value)} placeholder="0.00"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Units held</label>
              <input type="number" min="0" step="0.000001" value={form.units}
                onChange={(e) => set("units", e.target.value)} placeholder="0"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current price/unit</label>
              <input type="number" min="0" step="0.0001" value={form.current_price}
                onChange={(e) => set("current_price", e.target.value)} placeholder="0.00"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Country code</label>
              <input type="text" maxLength={2} value={form.country} onChange={(e) => set("country", e.target.value.toUpperCase())}
                placeholder="ZA"
                className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500" />
            </div>
          </div>
          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {saving ? "Saving…" : inv ? "Update" : "Add"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PortfolioDonut({ summary }: { summary: PortfolioSummary }) {
  const byType = Object.entries(summary.by_type).sort((a, b) => b[1] - a[1]);
  const total = summary.total_base_currency_value;
  const colors = ["bg-blue-500","bg-purple-500","bg-green-500","bg-amber-500","bg-red-500","bg-cyan-500","bg-pink-500","bg-indigo-500"];
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-800 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Portfolio</h2>
        <p className="text-xl font-bold text-blue-400">{fmt(total, summary.base_currency)}</p>
      </div>
      <div className="space-y-2">
        {byType.map(([type, value], i) => {
          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
          return (
            <div key={type} className="flex items-center gap-3">
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${colors[i % colors.length]}`} />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-slate-400 capitalize">{ASSET_LABELS[type as AssetType] ?? type}</span>
                  <span className="text-slate-300">{pct}%</span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-1">
                  <div className={`${colors[i % colors.length]} h-1 rounded-full`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              <span className="text-xs text-slate-400 shrink-0 w-20 text-right">{fmt(value, summary.base_currency)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function InvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editInv, setEditInv] = useState<Investment | null>(null);

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const [invs, port] = await Promise.all([
      investmentApi.list(accountId).catch(() => [] as Investment[]),
      investmentApi.portfolio(accountId).catch(() => null),
    ]);
    setInvestments(invs);
    setPortfolio(port);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: InvForm) {
    if (!accountId) return;
    const payload = {
      name:                form.name,
      asset_type:          form.asset_type as AssetType,
      currency:            form.currency,
      current_value:       parseFloat(form.current_value) || null,
      purchase_price:      form.purchase_price ? parseFloat(form.purchase_price) : null,
      units:               form.units ? parseFloat(form.units) : null,
      current_price:       form.current_price ? parseFloat(form.current_price) : null,
      base_currency_value: parseFloat(form.current_value) || null,
      country:             form.country || null,
      purchased_at:        null,
      visibility:           "personal" as const,
    };
    if (editInv) {
      await investmentApi.update(accountId, editInv.id, payload);
    } else {
      await investmentApi.create(accountId, payload);
    }
    await load();
  }

  async function handleDelete(inv: Investment) {
    if (!accountId) return;
    if (!confirm(`Delete "${inv.name}"?`)) return;
    await investmentApi.delete(accountId, inv.id);
    await load();
  }

  const active = investments.filter((i) => i.status === "active");

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Investments</h1>
          <p className="text-slate-500 text-sm mt-0.5">Stage 7–9: grow your wealth</p>
        </div>
        <button type="button" onClick={() => { setEditInv(null); setModal(true); }}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors">
          + Add Investment
        </button>
      </div>

      {portfolio && portfolio.total_base_currency_value > 0 && (
        <PortfolioDonut summary={portfolio} />
      )}

      {active.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-500 text-sm mb-2">No investments yet</p>
          <p className="text-xs text-slate-600 mb-4">Start here once you reach Stage 7 of the journey</p>
          <button type="button" onClick={() => { setEditInv(null); setModal(true); }}
            className="text-purple-400 text-sm hover:text-purple-300">Add first investment →</button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {active.map((inv) => {
            const gain = (inv.current_value ?? 0) - (inv.purchase_price ?? 0);
            const gainPct = inv.purchase_price && inv.purchase_price > 0
              ? Math.round((gain / inv.purchase_price) * 100)
              : null;
            return (
              <div key={inv.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-slate-100">{inv.name}</p>
                    <p className="text-xs text-slate-500">{ASSET_LABELS[inv.asset_type]} · {inv.country ?? "—"}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-purple-400">{fmt(inv.current_value ?? 0, inv.currency)}</p>
                    {gainPct !== null && (
                      <p className={`text-xs font-medium ${gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                        {gain >= 0 ? "+" : ""}{gainPct}%
                      </p>
                    )}
                  </div>
                </div>
                {inv.units && (
                  <p className="text-xs text-slate-500">
                    {inv.units} units @ {fmt(inv.current_price ?? 0, inv.currency)}
                  </p>
                )}
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setEditInv(inv); setModal(true); }}
                    className="flex-1 rounded-lg bg-slate-700 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-600">Edit</button>
                  <button type="button" onClick={() => handleDelete(inv)}
                    className="px-3 rounded-lg bg-red-500/10 border border-red-500/20 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500/20">Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal && (
        <InvModal inv={editInv} onClose={() => { setModal(false); setEditInv(null); }} onSave={handleSave} />
      )}
    </div>
  );
}
