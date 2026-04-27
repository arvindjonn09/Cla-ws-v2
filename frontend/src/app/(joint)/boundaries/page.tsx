"use client";
import { useEffect, useState, useCallback } from "react";
import { jointApi } from "@/lib/api";
import { getJointAccountId } from "@/lib/utils";
import type { SpendingBoundary } from "@/types";

const CLASSIFICATIONS = ["shared","personal","grey"] as const;
const SPLIT_METHODS = ["equal","percentage","decide_each_time"] as const;
const CATEGORIES = [
  "Food & Groceries","Transport","Rent / Mortgage","Utilities","Insurance",
  "Healthcare","Education","Entertainment","Clothing","Personal Care","Other",
];

type BoundaryForm = {
  category: string;
  classification: "shared"|"personal"|"grey";
  split_method: "equal"|"percentage"|"decide_each_time"|null;
  member_a_percentage: string;
  member_b_percentage: string;
  notes: string;
};

function BoundaryModal({
  boundary, onClose, onSave,
}: {
  boundary: SpendingBoundary|null; onClose: ()=>void; onSave: (f:BoundaryForm)=>Promise<void>;
}) {
  const [form, setForm] = useState<BoundaryForm>({
    category:             boundary?.category ?? "Food & Groceries",
    classification:       boundary?.classification ?? "shared",
    split_method:         boundary?.split_method ?? "equal",
    member_a_percentage:  String(boundary?.member_a_percentage ?? "50"),
    member_b_percentage:  String(boundary?.member_b_percentage ?? "50"),
    notes:                boundary?.notes ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof BoundaryForm, v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setError("");
    try { await onSave(form); onClose(); }
    catch (err) { setError(err instanceof Error ? err.message : "Failed"); }
    finally { setSaving(false); }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl">
        <div className="border-b border-slate-800 px-6 py-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">{boundary ? "Edit" : "Add"} Boundary</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-300 text-xl">✕</button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Category</label>
            <select value={form.category} onChange={(e) => set("category", e.target.value)}
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500">
              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-2">Classification</label>
            <div className="grid grid-cols-3 gap-2">
              {CLASSIFICATIONS.map((c) => (
                <button key={c} type="button" onClick={() => set("classification", c)}
                  className={`rounded-lg py-2 text-xs font-medium border capitalize transition-colors ${
                    form.classification === c ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-slate-700 bg-slate-800 text-slate-400"
                  }`}>
                  {c === "grey" ? "Grey Zone" : c}
                </button>
              ))}
            </div>
          </div>
          {form.classification === "shared" && (
            <div>
              <label className="block text-xs text-slate-400 mb-2">Split method</label>
              <div className="grid grid-cols-3 gap-2">
                {SPLIT_METHODS.map((m) => (
                  <button key={m} type="button" onClick={() => set("split_method", m)}
                    className={`rounded-lg py-2 text-xs font-medium border transition-colors ${
                      form.split_method === m ? "border-purple-500 bg-purple-500/20 text-purple-300" : "border-slate-700 bg-slate-800 text-slate-400"
                    }`}>
                    {m === "equal" ? "Equal" : m === "percentage" ? "Percentage" : "Case by case"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {form.split_method === "percentage" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Partner A %</label>
                <input type="number" min="0" max="100" value={form.member_a_percentage}
                  onChange={(e) => set("member_a_percentage", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Partner B %</label>
                <input type="number" min="0" max="100" value={form.member_b_percentage}
                  onChange={(e) => set("member_b_percentage", e.target.value)}
                  className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500" />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs text-slate-400 mb-1">Notes</label>
            <textarea value={form.notes} onChange={(e) => set("notes", e.target.value)}
              rows={2} placeholder="Any agreed rules for this category"
              className="w-full rounded-lg border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white outline-none focus:border-purple-500 resize-none" />
          </div>
          {error && <p className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-300">{error}</p>}
          <div className="flex gap-3">
            <button type="button" onClick={onClose}
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-sm font-semibold text-slate-300">Cancel</button>
            <button type="submit" disabled={saving}
              className="flex-1 rounded-xl bg-purple-600 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const CLASS_COLORS: Record<string, string> = {
  shared:   "border-blue-500/30 bg-blue-950/20 text-blue-400",
  personal: "border-green-500/30 bg-green-950/20 text-green-400",
  grey:     "border-amber-500/30 bg-amber-950/20 text-amber-400",
};

export default function BoundariesPage() {
  const [boundaries, setBoundaries] = useState<SpendingBoundary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editB, setEditB] = useState<SpendingBoundary|null>(null);

  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;

  const load = useCallback(async () => {
    if (!accountId) return;
    const data = await jointApi.listBoundaries(accountId).catch(() => [] as SpendingBoundary[]);
    setBoundaries(data);
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  async function handleSave(form: BoundaryForm) {
    if (!accountId) return;
    const payload = {
      category:            form.category,
      classification:      form.classification as "shared"|"personal"|"grey",
      split_method:        form.split_method as "equal"|"percentage"|"decide_each_time"|null,
      member_a_percentage: form.split_method === "percentage" ? parseFloat(form.member_a_percentage)||null : null,
      member_b_percentage: form.split_method === "percentage" ? parseFloat(form.member_b_percentage)||null : null,
      notes:               form.notes || null,
    };
    await jointApi.createBoundary(accountId, payload);
    await load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" /></div>;

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Boundaries</h1>
          <p className="text-slate-500 text-sm mt-0.5">Agree on how spending categories are classified</p>
        </div>
        <button type="button" onClick={() => { setEditB(null); setModal(true); }}
          className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white hover:bg-purple-500">
          + Add
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        {["shared","personal","grey"].map((c) => (
          <div key={c} className={`rounded-xl border p-3 ${CLASS_COLORS[c]}`}>
            <p className="text-lg font-bold">{boundaries.filter((b) => b.classification === c).length}</p>
            <p className="text-xs capitalize">{c === "grey" ? "Grey Zone" : c}</p>
          </div>
        ))}
      </div>

      {boundaries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center">
          <p className="text-slate-500 text-sm">No boundaries set yet</p>
          <p className="text-xs text-slate-600 mt-1">Agree on which spending is shared vs personal</p>
        </div>
      ) : (
        <div className="space-y-2">
          {boundaries.map((b) => (
            <div key={b.id} className={`rounded-xl border p-4 ${CLASS_COLORS[b.classification]}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">{b.category}</p>
                  <p className="text-xs opacity-70 mt-0.5 capitalize">
                    {b.classification}{b.split_method ? ` · ${b.split_method.replace(/_/g, " ")}` : ""}
                    {b.member_a_percentage ? ` · ${b.member_a_percentage}/${b.member_b_percentage}%` : ""}
                  </p>
                  {b.notes && <p className="text-xs opacity-60 mt-1">{b.notes}</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal && <BoundaryModal boundary={editB} onClose={() => { setModal(false); setEditB(null); }} onSave={handleSave} />}
    </div>
  );
}
