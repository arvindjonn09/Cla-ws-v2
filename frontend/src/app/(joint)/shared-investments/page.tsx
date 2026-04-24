"use client";
import { useEffect, useState, useCallback } from "react";
import { investmentApi } from "@/lib/api";
import { getAccountId, fmt, assetTypeLabel } from "@/lib/utils";
import type { Investment, InvestmentSecureDetails, AssetType, PortfolioSummary } from "@/types";
import Link from "next/link";

const ASSET_TYPES: AssetType[] = [
  "stocks","bonds","mutual_funds","property","crypto","fixed_deposit","retirement","foreign_cash","other",
];
const CURRENCIES = ["EUR","USD","INR","AUD"];

export default function SharedInvestmentsPage() {
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [secureCodes, setSecureCodes] = useState<Record<string, string>>({});
  const [secureStatus, setSecureStatus] = useState<Record<string, string>>({});
  const [revealedSecure, setRevealedSecure] = useState<Record<string, InvestmentSecureDetails>>({});
  const [form, setForm] = useState({
    name: "", asset_type: "stocks" as AssetType, currency: "USD",
    current_value: "", current_price: "", units: "", purchased_at: "",
    visibility: "shared" as "shared" | "personal",
    account_email: "", account_number: "", login_id: "", secure_notes: "",
  });

  const accountId = typeof window !== "undefined" ? getAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const [inv, port] = await Promise.all([
      investmentApi.list(accountId).catch(() => [] as Investment[]),
      investmentApi.portfolio(accountId).catch(() => null),
    ]);
    setInvestments(inv.filter((i) => i.status === "active"));
    setPortfolio(port);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function addInvestment() {
    if (!accountId || !form.name || !form.current_value) return;
    setSaving(true);
    try {
      const inv = await investmentApi.create(accountId, {
        name: form.name,
        asset_type: form.asset_type,
        currency: form.currency,
        current_value: Number(form.current_value),
        current_price: form.current_price ? Number(form.current_price) : null,
        units: form.units ? Number(form.units) : null,
        purchase_price: null,
        base_currency_value: null,
        country: null,
        purchased_at: form.purchased_at || null,
        visibility: form.visibility,
        secure_details: {
          account_email: form.account_email || null,
          account_number: form.account_number || null,
          login_id: form.login_id || null,
          secure_notes: form.secure_notes || null,
        },
      });
      setInvestments((prev) => [...prev, inv]);
      setAdding(false);
      setForm({
        name: "", asset_type: "stocks", currency: "USD",
        current_value: "", current_price: "", units: "", purchased_at: "",
        visibility: "shared", account_email: "", account_number: "", login_id: "", secure_notes: "",
      });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function requestSecureCode(inv: Investment) {
    if (!accountId) return;
    setSecureStatus((s) => ({ ...s, [inv.id]: "Sending code..." }));
    try {
      await investmentApi.requestSecureCode(accountId, inv.id);
      setSecureStatus((s) => ({ ...s, [inv.id]: "Code sent to your email." }));
    } catch (err) {
      setSecureStatus((s) => ({ ...s, [inv.id]: err instanceof Error ? err.message : "Could not send code" }));
    }
  }

  async function verifySecureCode(inv: Investment) {
    if (!accountId) return;
    const code = secureCodes[inv.id]?.trim();
    if (!code) return;
    setSecureStatus((s) => ({ ...s, [inv.id]: "Verifying..." }));
    try {
      const details = await investmentApi.verifySecureCode(accountId, inv.id, code);
      setRevealedSecure((s) => ({ ...s, [inv.id]: details }));
      setSecureCodes((s) => ({ ...s, [inv.id]: "" }));
      setSecureStatus((s) => ({ ...s, [inv.id]: "Secure details revealed for 2 minutes." }));
      const ms = Math.max(new Date(details.revealed_until).getTime() - Date.now(), 0);
      window.setTimeout(() => {
        setRevealedSecure((s) => {
          const next = { ...s };
          delete next[inv.id];
          return next;
        });
        setSecureStatus((s) => ({ ...s, [inv.id]: "Secure details are masked again." }));
      }, ms);
    } catch (err) {
      setSecureStatus((s) => ({ ...s, [inv.id]: err instanceof Error ? err.message : "Invalid code" }));
    }
  }

  const currency = portfolio?.base_currency ?? "USD";
  const totalValue = portfolio?.total_base_currency_value ?? investments.reduce((s, i) => s + (i.current_value ?? 0), 0);

  const byType = investments.reduce<Record<string, number>>((acc, i) => {
    const key = assetTypeLabel(i.asset_type);
    acc[key] = (acc[key] ?? 0) + (i.current_value ?? 0);
    return acc;
  }, {});

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" />
    </div>
  );

  return (
    <div className="px-4 py-6 lg:px-8 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Shared Investments</h1>
          <p className="text-slate-500 text-sm mt-0.5">Joint investment portfolio — Stage 7+</p>
        </div>
        <button type="button" onClick={() => setAdding(true)}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500 transition-colors">
          + Add
        </button>
      </div>

      {/* Portfolio total */}
      <div className="rounded-2xl border border-teal-500/20 bg-gradient-to-br from-teal-950/30 to-slate-900 p-6">
        <p className="text-xs text-teal-400/70 uppercase tracking-widest mb-1">Joint Portfolio Value</p>
        <p className="text-4xl font-bold text-teal-400">{fmt(totalValue, currency)}</p>
        <p className="text-slate-500 text-xs mt-2">{investments.length} active investment{investments.length !== 1 ? "s" : ""}</p>
      </div>

      {/* By type breakdown */}
      {Object.keys(byType).length > 0 && (
        <div className="rounded-xl border border-slate-700 bg-slate-800 p-5">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide mb-4">By Asset Type</h2>
          <div className="space-y-2">
            {Object.entries(byType).sort(([, a], [, b]) => b - a).map(([type, val]) => {
              const pct = totalValue > 0 ? Math.round((val / totalValue) * 100) : 0;
              return (
                <div key={type} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-300">{type}</span>
                    <span className="text-slate-400">{pct}%</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-1.5">
                    <div className="bg-teal-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Add form */}
      {adding && (
        <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-5 space-y-4">
          <h2 className="text-sm font-semibold text-slate-300">Add Investment</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Name</label>
              <input className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                placeholder="e.g. Satrix 40 ETF"
                value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Asset type</label>
              <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.asset_type} onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value as AssetType }))}>
                {ASSET_TYPES.map((t) => <option key={t} value={t}>{assetTypeLabel(t)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Currency</label>
              <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.currency} onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Visibility</label>
              <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.visibility} onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.value as "shared" | "personal" }))}>
                <option value="shared">Shared with joint members</option>
                <option value="personal">Personal only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Current value</label>
              <input type="number" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.current_value} onChange={(e) => setForm((f) => ({ ...f, current_value: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Units (optional)</label>
              <input type="number" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.units} onChange={(e) => setForm((f) => ({ ...f, units: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Investment ID / account no.</label>
              <input className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.account_number} onChange={(e) => setForm((f) => ({ ...f, account_number: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Email</label>
              <input type="email" className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.account_email} onChange={(e) => setForm((f) => ({ ...f, account_email: e.target.value }))} />
            </div>
            <div>
              <label className="block text-xs text-slate-400 mb-1">Login ID</label>
              <input className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.login_id} onChange={(e) => setForm((f) => ({ ...f, login_id: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-slate-400 mb-1">Secure notes</label>
              <textarea rows={3} className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-purple-500"
                value={form.secure_notes} onChange={(e) => setForm((f) => ({ ...f, secure_notes: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={addInvestment} disabled={saving || !form.name || !form.current_value}
              className="flex-1 rounded-xl bg-purple-600 py-2 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Add investment"}
            </button>
            <button type="button" onClick={() => setAdding(false)}
              className="flex-1 rounded-xl border border-slate-700 py-2 text-sm text-slate-300 hover:border-slate-500 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Investment list */}
      {investments.length === 0 && !adding ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center space-y-2">
          <p className="text-3xl">📈</p>
          <p className="text-slate-400 text-sm">No joint investments yet.</p>
          <p className="text-slate-600 text-xs">Available from Stage 7 — Begin Investing.</p>
          <Link href="/shared-journey" className="text-purple-400 text-sm hover:text-purple-300 block">View shared journey →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {investments.map((inv) => {
            const val = inv.current_value ?? 0;
            const pct = totalValue > 0 ? Math.round((val / totalValue) * 100) : 0;
            return (
              <div key={inv.id} className="rounded-xl border border-slate-700 bg-slate-800 p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-sm font-semibold text-slate-200">{inv.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{assetTypeLabel(inv.asset_type)} · {inv.currency} · {inv.visibility}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-teal-400">{fmt(val, inv.currency)}</p>
                    <p className="text-xs text-slate-600">{pct}% of portfolio</p>
                  </div>
                </div>
                {inv.has_secure_details && (
                  <div className="mt-4 rounded-lg border border-slate-700 bg-slate-900/70 p-3 space-y-3">
                    {revealedSecure[inv.id] ? (
                      <div className="grid gap-2 text-xs text-slate-300 sm:grid-cols-2">
                        <p><span className="text-slate-500">Investment ID/account no.</span><br />{revealedSecure[inv.id].account_number || "—"}</p>
                        <p><span className="text-slate-500">Email</span><br />{revealedSecure[inv.id].account_email || "—"}</p>
                        <p><span className="text-slate-500">Login ID</span><br />{revealedSecure[inv.id].login_id || "—"}</p>
                        <p><span className="text-slate-500">Secure notes</span><br />{revealedSecure[inv.id].secure_notes || "—"}</p>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <button type="button" onClick={() => requestSecureCode(inv)}
                          className="rounded-lg bg-teal-600 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-500">
                          Verify to View
                        </button>
                        <input inputMode="numeric" maxLength={6} placeholder="6-digit code"
                          className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-white outline-none focus:border-teal-500"
                          value={secureCodes[inv.id] ?? ""}
                          onChange={(e) => setSecureCodes((s) => ({ ...s, [inv.id]: e.target.value }))} />
                        <button type="button" onClick={() => verifySecureCode(inv)}
                          className="rounded-lg border border-slate-600 px-3 py-2 text-xs font-semibold text-slate-300 hover:border-slate-400">
                          View
                        </button>
                      </div>
                    )}
                    {secureStatus[inv.id] && <p className="text-xs text-slate-500">{secureStatus[inv.id]}</p>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
