"use client";
import { useState, useRef } from "react";
import { importApi, type PreviewBill, type PreviewTransaction, type PreviewTransfer } from "@/lib/api";
import { getPersonalAccountId } from "@/lib/utils";

// ── Bill tracker types ──────────────────────────────────────────────────────

type Bill = {
  id: string;
  name: string;
  amount: string;
  currency: string;
  due_day: number;
  category: string;
  is_recurring: boolean;
  last_paid?: string;
};

// ── Statement types ─────────────────────────────────────────────────────────

type Tx = {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
};

// ── Categories ──────────────────────────────────────────────────────────────

const BILL_CATEGORIES = [
  "Rent / Mortgage","Electricity","Water","Internet",
  "Insurance","Phone","Transport","Rates & Taxes","Other",
];

const CURRENCIES = ["EUR","USD","INR","AUD"];

const STMT_CATEGORIES = [
  // ── Australian-specific first (checked before generic) ────────────────────
  {
    id: "bnpl",
    label: "Buy Now Pay Later",
    icon: "💳",
    color: "text-violet-400",
    border: "border-violet-500/30",
    bg: "bg-violet-950/20",
    keywords: ["afterpay","after pay","after-pay","zip ","zippay","zip pay","zipmoney","zip money","zip co","humm ","shophumm","humm australia","latitude pay","latitudepay","gem visa","latitude financial","sezzle","laybuy","paright","payright","openpay","open pay","splitit","split it","bundll","klarna"],
  },
  {
    id: "income",
    label: "Salary / Income",
    icon: "💰",
    color: "text-emerald-400",
    border: "border-emerald-500/30",
    bg: "bg-emerald-950/20",
    keywords: ["salary","wages ","payroll","stp payment","pay slip","centrelink","services australia","jobseeker","jobkeeper","ato refund","tax refund"],
  },
  {
    id: "government",
    label: "Government / Tax",
    icon: "🏛",
    color: "text-indigo-400",
    border: "border-indigo-500/30",
    bg: "bg-indigo-950/20",
    keywords: ["ato ","australian tax","tax office","medicare levy","council rates","water rates","land tax","stamp duty","transport for nsw","transport for vic","vic roads","service nsw","service vic"],
  },
  // ── Regular categories ────────────────────────────────────────────────────
  {
    id: "fuel",
    label: "Fuel / Servos",
    icon: "⛽",
    color: "text-orange-400",
    border: "border-orange-500/30",
    bg: "bg-orange-950/20",
    keywords: ["bp ","shell","caltex","ampol","7-eleven","7eleven","united petro","puma ","petrol","diesel","fuel ","servo","service station","liberty oil","bpme","ez fuel","viva energy","budget fuel"],
  },
  {
    id: "food",
    label: "Food / Cafe",
    icon: "🍔",
    color: "text-yellow-400",
    border: "border-yellow-500/30",
    bg: "bg-yellow-950/20",
    keywords: ["mcdonald","kfc ","domino","hungry jack","subway","pizza","uber eat","doordash","menulog","deliveroo","cafe ","coffee","starbucks","gloria jean","nando","grill'd","zambreros","oporto","red rooster","sushi","thai ","chinese ","restaurant","eatery","bistro","bakery","bakers delight","roll'd","guzman","foodco","gelato","dim sum","dumplings","burrito","taco","falafel","kebab","muffin break","boost juice","chatime","gong cha","the coffee club"],
  },
  {
    id: "entertainment",
    label: "Entertainment",
    icon: "🎬",
    color: "text-purple-400",
    border: "border-purple-500/30",
    bg: "bg-purple-950/20",
    keywords: ["cinema","hoyts","event cinema","village cinema","reading cinema","netflix","spotify","disney","stan ","binge","paramount","steam","playstation","xbox","gaming","bowling","laser tag","escape room","concert","ticketek","ticketmaster","eventbrite","luna park","theme park","zoo","aquarium","foxtel","youtube premium","twitch"],
  },
  {
    id: "groceries",
    label: "Groceries",
    icon: "🛒",
    color: "text-green-400",
    border: "border-green-500/30",
    bg: "bg-green-950/20",
    keywords: ["woolworths","coles ","aldi ","iga ","harris farm","costco","spar ","drakes","foodland","ritchies","fresh market","deli ","butcher","fruit"],
  },
  {
    id: "transport",
    label: "Transport",
    icon: "🚌",
    color: "text-blue-400",
    border: "border-blue-500/30",
    bg: "bg-blue-950/20",
    keywords: ["uber ","lyft","ola cab","didi ","myki","opal ","transurban","citylink","eastlink","westlink","parking","public transport","metro train","bus fare","train ","tram ","ferry","toll ","car park","linkt","e-toll","roam express","go via"],
  },
  {
    id: "health",
    label: "Health / Medical",
    icon: "💊",
    color: "text-red-400",
    border: "border-red-500/30",
    bg: "bg-red-950/20",
    keywords: ["pharmacy","chemist","priceline","medicare","medical","doctor","hospital","clinic","dental","optometrist","physio","pathology","health fund","medibank","bupa ","nib ","hcf ","ahm health","bulk bill","gp clinic"],
  },
  {
    id: "shopping",
    label: "Shopping / Retail",
    icon: "🛍",
    color: "text-pink-400",
    border: "border-pink-500/30",
    bg: "bg-pink-950/20",
    keywords: ["amazon","target ","kmart","myer ","david jones","jb hi-fi","harvey norman","bunnings","officeworks","the good guys","rebel sport","cotton on","uniqlo","h&m ","cotton:on","factorie","glue store","sephora","priceline cosm","ebay","catch.com","mighty ape"],
  },
  {
    id: "subscriptions",
    label: "Subscriptions",
    icon: "🔁",
    color: "text-cyan-400",
    border: "border-cyan-500/30",
    bg: "bg-cyan-950/20",
    keywords: ["apple.com","apple subscription","itunes","google play","google storage","microsoft","adobe ","canva ","dropbox","icloud","youtube","amazon prime","audible","kindle","github","chatgpt","openai"],
  },
  {
    id: "atm",
    label: "ATM / Cash",
    icon: "💵",
    color: "text-amber-400",
    border: "border-amber-500/30",
    bg: "bg-amber-950/20",
    keywords: ["atm ","cash out","withdrawal","cash advance","atm withdrawal"],
  },
  {
    id: "uncategorized",
    label: "Uncategorized",
    icon: "❓",
    color: "text-slate-400",
    border: "border-slate-700",
    bg: "bg-slate-800",
    keywords: [],
  },
] as const;

type CategoryId = (typeof STMT_CATEGORIES)[number]["id"];

function autoCategory(description: string): CategoryId {
  const lower = description.toLowerCase();
  for (const cat of STMT_CATEGORIES) {
    if (cat.id === "uncategorized") continue;
    if ((cat.keywords as readonly string[]).some((kw) => lower.includes(kw))) {
      return cat.id;
    }
  }
  return "uncategorized";
}

function getCat(id: string) {
  return STMT_CATEGORIES.find((c) => c.id === id) ?? STMT_CATEGORIES[STMT_CATEGORIES.length - 1];
}

// ── CSV parser ──────────────────────────────────────────────────────────────

function parseCSVRow(line: string, delim: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === delim && !inQuotes) { result.push(current.trim().replace(/^"|"$/g, "")); current = ""; }
    else { current += ch; }
  }
  result.push(current.trim().replace(/^"|"$/g, ""));
  return result;
}

function parseCSV(text: string): { transactions: Tx[]; error: string | null } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { transactions: [], error: "File has fewer than 2 rows — nothing to parse." };

  const delim = lines[0].split("\t").length > lines[0].split(",").length ? "\t" : ",";
  const headers = parseCSVRow(lines[0], delim).map((h) => h.toLowerCase());

  const find = (...terms: string[]) => headers.findIndex((h) => terms.some((t) => h.includes(t)));

  const dateIdx  = find("date");
  const descIdx  = find("description","details","narration","particulars","transaction details","memo","reference","detail");
  const amtIdx   = find("amount");
  const debitIdx = find("debit","withdrawal","dr");
  const creditIdx= find("credit","deposit","cr");

  if (dateIdx === -1) return { transactions: [], error: "Could not find a Date column. Please check your CSV headers." };
  if (descIdx === -1) return { transactions: [], error: "Could not find a Description/Details column. Please check your CSV headers." };

  const transactions: Tx[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVRow(lines[i], delim);
    const date        = cols[dateIdx]?.trim() || "";
    const description = cols[descIdx]?.trim()  || "";
    if (!date || !description) continue;

    let amount = 0;

    if (amtIdx !== -1) {
      const raw = cols[amtIdx]?.replace(/[^0-9.-]/g, "") || "0";
      const n = parseFloat(raw);
      // negative = expense in most bank CSVs
      if (n < 0) amount = Math.abs(n);
      else if (n > 0 && creditIdx === -1) amount = n; // some banks use positive debits
    } else if (debitIdx !== -1) {
      const raw = cols[debitIdx]?.replace(/[^0-9.]/g, "") || "0";
      amount = parseFloat(raw) || 0;
    }

    if (amount <= 0) continue;

    transactions.push({
      id: crypto.randomUUID(),
      date,
      description,
      amount,
      category: autoCategory(description),
    });
  }

  if (transactions.length === 0)
    return { transactions: [], error: "No expense transactions found. Make sure your CSV has debit/expense rows." };

  return { transactions, error: null };
}

// ── Bill tracker helpers ────────────────────────────────────────────────────

function daysUntilDue(day: number): number {
  const now = new Date();
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), day);
  if (thisMonth <= now) {
    const next = new Date(now.getFullYear(), now.getMonth() + 1, day);
    return Math.ceil((next.getTime() - now.getTime()) / 86400000);
  }
  return Math.ceil((thisMonth.getTime() - now.getTime()) / 86400000);
}

function urgencyColor(days: number) {
  if (days <= 3) return "text-red-400 border-red-500/30 bg-red-950/20";
  if (days <= 7) return "text-amber-400 border-amber-500/30 bg-amber-950/20";
  return "text-slate-300 border-slate-700 bg-slate-800";
}

function loadBills(): Bill[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem("bills") ?? "[]"); }
  catch { return []; }
}

// ── Transaction preview panel ────────────────────────────────────────────────
// Categorised rows show normally; uncategorized rows are GROUPED by merchant
// so the user assigns one category to all transactions from the same place.

function merchantLabel(description: string): string {
  // Strip common bank prefixes / noise — mirrors the backend _clean_description
  let s = description
    .replace(/^EFTPOS\s+(PURCHASE|WITHDRAWAL|DEBIT|CREDIT|TRAN)\s*/i, "")
    .replace(/^EFTPOS\s+/i, "")
    .replace(/^TSP\*/i, "")
    .replace(/^SQ[\s*]+/i, "")
    .replace(/^ZLR\*/i, "")
    .replace(/^PAYPAL\*/i, "")
    .replace(/^VISA\s+(DEBIT|CREDIT|PURCHASE|TRAN)\s*/i, "")
    .replace(/^VIS\s+/i, "")
    .replace(/^DEBIT\s+(CARD\s*|PURCHASE\s*)/i, "")
    .replace(/^CREDIT\s+(CARD\s*|PURCHASE\s*)/i, "")
    .replace(/^CARD\s+\d+\s+/i, "")
    .replace(/^DIRECT\s+(DEBIT|CREDIT)\s*/i, "")
    .replace(/^\d{2}[A-Z]{3}\s+/i, "");
  // Strip trailing state/country codes
  s = s.replace(/\s+(NSW|VIC|QLD|SA|WA|TAS|NT|ACT)(\s+[A-Z]{2,3})?$/i, "");
  s = s.replace(/\s+(AUS|USA|GBR|NLD|IRL|NZL|SGP|CAN|FRA|DEU|IND)$/i, "");
  // Strip trailing 4+ digit terminal/ref numbers
  s = s.replace(/\s+\d{4,}\s*$/, "");
  // Take first 3 meaningful words as the merchant key
  const words = s.trim().split(/\s+/).filter(Boolean).slice(0, 3);
  return words.join(" ").toUpperCase() || description.slice(0, 30).toUpperCase();
}

function TransactionPreviewPanel({
  transactions,
  onCategoryChange,
  onMoveToBill,
  onRemove,
}: {
  transactions: PreviewTransaction[];
  onCategoryChange: (id: string, cat: string) => void;
  onMoveToBill: (tx: PreviewTransaction) => void;
  onRemove: (id: string) => void;
}) {
  const categorised = transactions.filter((t) => t.category !== "uncategorized");
  const uncategorised = transactions.filter((t) => t.category === "uncategorized");

  // Group uncategorised by merchant label
  const groups: Map<string, PreviewTransaction[]> = new Map();
  for (const tx of uncategorised) {
    const key = merchantLabel(tx.description);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(tx);
  }
  const groupEntries = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  function assignGroup(label: string, category: string) {
    const ids = groups.get(label)?.map((t) => t.id) ?? [];
    ids.forEach((id) => onCategoryChange(id, category));
  }

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-300">
          💳 Transactions ({transactions.length})
        </p>
        {uncategorised.length > 0 && (
          <span className="text-[11px] rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 px-2 py-0.5">
            {uncategorised.length} need a category
          </span>
        )}
      </div>

      {/* ── Uncategorised groups ── */}
      {groupEntries.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
            Assign category — grouped by merchant
          </p>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {groupEntries.map(([label, txs]) => {
              const total = txs.reduce((s, t) => s + t.amount, 0);
              return (
                <div key={label}
                  className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-950/15 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-amber-200 truncate">{label}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {txs.length} transaction{txs.length !== 1 ? "s" : ""} · total {total.toFixed(2)}
                    </p>
                  </div>
                  <select
                    defaultValue="uncategorized"
                    onChange={(e) => assignGroup(label, e.target.value)}
                    className="shrink-0 rounded-lg border border-amber-500 bg-amber-950/30 px-2 py-1 text-xs text-amber-100 outline-none focus:border-blue-500 focus:bg-slate-900 focus:text-white transition-colors"
                  >
                    <option value="uncategorized">Pick category…</option>
                    {STMT_CATEGORIES.filter((c) => c.id !== "uncategorized").map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Categorised rows ── */}
      {categorised.length > 0 && (
        <div className="space-y-1 max-h-64 overflow-y-auto">
          {groupEntries.length > 0 && (
            <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
              Auto-categorised
            </p>
          )}
          {categorised.map((tx) => (
            <div key={tx.id}
              className="flex items-center gap-3 py-1.5 border-b border-slate-700/50 last:border-0">
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-300 truncate">{tx.description}</p>
                <p className="text-[10px] text-slate-500">{tx.date} · {tx.amount.toFixed(2)}</p>
              </div>
              <select
                value={tx.category}
                onChange={(e) => onCategoryChange(tx.id, e.target.value)}
                className="shrink-0 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
              >
                {STMT_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                ))}
              </select>
              <button type="button" onClick={() => onMoveToBill(tx)}
                title="Move to bills"
                className="text-[10px] text-slate-500 hover:text-cyan-400 transition-colors shrink-0">🔁</button>
              <button type="button" onClick={() => onRemove(tx.id)}
                className="text-xs text-slate-500 hover:text-red-400 transition-colors shrink-0">✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Statement Analysis tab ────────────────────────────────────────────────────

type TransferDecision = "owe_me" | "i_owe" | "skip";

type ImportState =
  | { stage: "idle" }
  | { stage: "loading"; fileName: string }
  | { stage: "preview"; fileName: string; bills: PreviewBill[]; transactions: PreviewTransaction[]; transfers: PreviewTransfer[]; skipped: number; unreadable: boolean }
  | { stage: "saving" }
  | { stage: "done"; saved: number; billsAdded: number; transfersSaved: number };

function StatementTab() {
  const [state, setState] = useState<ImportState>({ stage: "idle" });
  const [csvTransactions, setCsvTransactions] = useState<Tx[]>([]);
  const [csvError, setCsvError] = useState("");
  const [csvFileName, setCsvFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [expandedCat, setExpandedCat] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // For PDF preview: mutable local copies
  const [previewBills, setPreviewBills] = useState<PreviewBill[]>([]);
  const [previewTxs, setPreviewTxs] = useState<PreviewTransaction[]>([]);
  const [previewTransfers, setPreviewTransfers] = useState<PreviewTransfer[]>([]);
  // Transfer decisions: id → "owe_me" | "i_owe" | "skip"
  const [transferDecisions, setTransferDecisions] = useState<Record<string, TransferDecision>>({});
  // Track original categories to detect user corrections for learning
  const [originalCategories, setOriginalCategories] = useState<Record<string, string>>({});

  async function handleFile(file: File) {
    setCsvError("");
    setCsvTransactions([]);

    if (file.name.toLowerCase().endsWith(".pdf")) {
      const accountId = getPersonalAccountId();
      if (!accountId) { setCsvError("Not logged in — please refresh and try again."); return; }

      setState({ stage: "loading", fileName: file.name });
      try {
        const result = await importApi.parsePdf(accountId, file);
        setPreviewBills(result.bills);
        setPreviewTxs(result.transactions);
        setPreviewTransfers(result.transfers ?? []);
        // Remember original auto-categories so we can detect user corrections
        const origCats: Record<string, string> = {};
        for (const tx of result.transactions) origCats[tx.id] = tx.category;
        setOriginalCategories(origCats);
        // Default all transfers to "skip"
        const decisions: Record<string, TransferDecision> = {};
        for (const tf of result.transfers ?? []) decisions[tf.id] = "skip";
        setTransferDecisions(decisions);
        setState({
          stage: "preview",
          fileName: file.name,
          bills: result.bills,
          transactions: result.transactions,
          transfers: result.transfers ?? [],
          skipped: result.skipped_duplicates,
          unreadable: result.unreadable,
        });
      } catch (err) {
        setState({ stage: "idle" });
        setCsvError(err instanceof Error ? err.message : "Failed to parse PDF");
      }
      return;
    }

    // CSV fallback
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const { transactions: txs, error } = parseCSV(text);
      if (error) { setCsvError(error); setCsvTransactions([]); }
      else { setCsvTransactions(txs); setCsvError(""); }
    };
    reader.readAsText(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function assignCsvCategory(id: string, category: string) {
    setCsvTransactions((prev) => prev.map((t) => (t.id === id ? { ...t, category } : t)));
  }

  function assignPreviewTxCategory(id: string, category: string) {
    setPreviewTxs((prev) => prev.map((t) => (t.id === id ? { ...t, category } : t)));
  }

  function setTransferDecision(id: string, decision: TransferDecision) {
    setTransferDecisions((prev) => ({ ...prev, [id]: decision }));
  }

  function assignPreviewBillCategory(id: string, category: string) {
    setPreviewBills((prev) => prev.map((b) => (b.id === id ? { ...b, category } : b)));
  }

  function moveTxToBill(tx: PreviewTransaction) {
    const bill: PreviewBill = {
      id: tx.id,
      name: tx.description.slice(0, 60),
      amount: tx.amount,
      currency: "AUD",
      due_day: new Date(tx.date).getDate() || 1,
      category: tx.category,
      sample_dates: [tx.date],
    };
    setPreviewBills((prev) => [...prev, bill]);
    setPreviewTxs((prev) => prev.filter((t) => t.id !== tx.id));
  }

  function removeBill(id: string) {
    setPreviewBills((prev) => prev.filter((b) => b.id !== id));
  }

  function removeTx(id: string) {
    setPreviewTxs((prev) => prev.filter((t) => t.id !== id));
  }

  async function confirmImport() {
    const accountId = getPersonalAccountId();
    if (!accountId) return;

    // Check uncategorized
    const hasUncategorized = previewTxs.some((t) => t.category === "uncategorized");
    if (hasUncategorized) {
      setCsvError("Please assign a category to all uncategorized transactions before saving.");
      return;
    }

    setState({ stage: "saving" });
    try {
      // Build all transactions to save (regular + decided transfers)
      const allTxsToSave: { date: string; description: string; amount: number; category: string; currency: string; type: string }[] = [
        ...previewTxs.map((t) => ({ date: t.date, description: t.description, amount: t.amount, category: t.category, currency: "AUD", type: t.category === "income" ? "income" : "expense" })),
        ...previewTransfers
          .filter((tf) => transferDecisions[tf.id] !== "skip")
          .map((tf) => ({
            date: tf.date,
            description: tf.description,
            amount: tf.amount,
            currency: "AUD",
            category: transferDecisions[tf.id] === "owe_me" ? "transfer_in" : "transfer_out",
            type: transferDecisions[tf.id] === "owe_me" ? "income" : "expense",
          })),
      ];

      let saved = 0;
      if (allTxsToSave.length > 0) {
        const result = await importApi.bulkSave(accountId, allTxsToSave);
        saved = result.saved;
      }

      // Save bills to localStorage
      const existing: Bill[] = loadBills();
      const newBills: Bill[] = previewBills.map((b) => ({
        id: crypto.randomUUID(),
        name: b.name,
        amount: String(b.amount),
        currency: b.currency,
        due_day: b.due_day,
        category: mapStmtCategoryToBillCategory(b.category),
        is_recurring: true,
      }));
      localStorage.setItem("bills", JSON.stringify([...existing, ...newBills]));

      // Send user corrections back to the server to teach future imports
      const corrections = previewTxs
        .filter((t) => originalCategories[t.id] !== t.category && t.category !== "uncategorized")
        .map((t) => ({ description: t.description, category: t.category }));
      if (corrections.length > 0) {
        importApi.learnRules(corrections).catch(() => {}); // fire-and-forget
      }

      const transfersSaved = allTxsToSave.length - previewTxs.length;
      setState({ stage: "done", saved: saved - transfersSaved, billsAdded: newBills.length, transfersSaved });
    } catch (err) {
      setState({ stage: "idle" });
      setCsvError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function resetAll() {
    setState({ stage: "idle" });
    setCsvTransactions([]);
    setCsvError("");
    setCsvFileName("");
    setPreviewBills([]);
    setPreviewTxs([]);
    setPreviewTransfers([]);
    setTransferDecisions({});
    setOriginalCategories({});
    if (fileRef.current) fileRef.current.value = "";
  }

  // ── CSV grouped view ───────────────────────────────────────────────────────
  const grouped: Record<string, Tx[]> = {};
  for (const tx of csvTransactions) {
    if (!grouped[tx.category]) grouped[tx.category] = [];
    grouped[tx.category].push(tx);
  }
  const csvUncategorized = grouped["uncategorized"] ?? [];
  const csvTotal = csvTransactions.reduce((s, t) => s + t.amount, 0);

  const isIdle = state.stage === "idle";
  const isLoading = state.stage === "loading";

  if (state.stage === "done") {
    return (
      <div className="rounded-2xl border border-green-500/30 bg-green-950/20 p-8 text-center space-y-3">
        <p className="text-3xl">✅</p>
        <p className="text-green-300 font-semibold text-lg">Import complete</p>
        <p className="text-sm text-slate-400">
          {state.saved > 0 && <span>{state.saved} transaction{state.saved !== 1 ? "s" : ""} saved. </span>}
          {state.transfersSaved > 0 && <span>{state.transfersSaved} transfer{state.transfersSaved !== 1 ? "s" : ""} recorded. </span>}
          {state.billsAdded > 0 && <span>{state.billsAdded} bill{state.billsAdded !== 1 ? "s" : ""} added to your bill tracker. </span>}
        </p>
        <button type="button" onClick={resetAll}
          className="mt-2 rounded-xl bg-slate-700 px-4 py-2 text-sm text-slate-300 hover:bg-slate-600 transition-colors">
          Import another file
        </button>
      </div>
    );
  }

  if (state.stage === "preview") {
    const txUncategorized = previewTxs.filter((t) => t.category === "uncategorized");

    return (
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{state.fileName}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {previewBills.length} bill{previewBills.length !== 1 ? "s" : ""} ·{" "}
              {previewTxs.length} transaction{previewTxs.length !== 1 ? "s" : ""}
              {previewTransfers.length > 0 && ` · ${previewTransfers.length} transfer${previewTransfers.length !== 1 ? "s" : ""}`}
              {state.skipped > 0 && ` · ${state.skipped} duplicate${state.skipped !== 1 ? "s" : ""} skipped`}
            </p>
          </div>
          <button type="button" onClick={resetAll}
            className="text-xs text-slate-400 hover:text-red-400 border border-slate-700 rounded-lg px-3 py-1.5 transition-colors">
            Cancel
          </button>
        </div>

        {state.unreadable && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
            This PDF could not be fully parsed — some transactions may be missing. Consider exporting as CSV for best results.
          </div>
        )}

        {/* Uncategorized warning */}
        {txUncategorized.length > 0 && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 px-4 py-3 text-sm text-amber-300">
            {txUncategorized.length} transaction{txUncategorized.length !== 1 ? "s" : ""} need a category before you can save.
          </div>
        )}

        {/* Suggested Bills */}
        {previewBills.length > 0 && (
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/10 p-4 space-y-3">
            <p className="text-sm font-semibold text-cyan-300">🔁 Recurring bills detected</p>
            <p className="text-xs text-slate-500">These appear every month — they&apos;ll be added to your bill tracker.</p>
            <div className="space-y-2 max-h-72 overflow-y-auto">
              {previewBills.map((bill) => (
                <div key={bill.id} className="flex items-center gap-3 py-2 border-b border-slate-700/50 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-slate-200 truncate font-medium">{bill.name}</p>
                    <p className="text-[10px] text-slate-500">
                      ~{bill.amount.toFixed(2)} · due day {bill.due_day}
                      {bill.sample_dates.length > 0 && ` · seen ${bill.sample_dates.length}×`}
                    </p>
                  </div>
                  <select
                    value={bill.category}
                    onChange={(e) => assignPreviewBillCategory(bill.id, e.target.value)}
                    className="shrink-0 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-blue-500"
                  >
                    {STMT_CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => removeBill(bill.id)}
                    className="text-xs text-slate-500 hover:text-red-400 transition-colors shrink-0">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Transactions — categorised then grouped uncategorized */}
        {previewTxs.length > 0 && (
          <TransactionPreviewPanel
            transactions={previewTxs}
            onCategoryChange={assignPreviewTxCategory}
            onMoveToBill={moveTxToBill}
            onRemove={removeTx}
          />
        )}

        {/* Transfers / IOUs */}
        {previewTransfers.length > 0 && (
          <div className="rounded-xl border border-slate-600 bg-slate-800/40 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-300">↔ Transfers ({previewTransfers.length})</p>
              <p className="text-xs text-slate-500 mt-0.5">
                These look like money sent to or from someone. Tell us what each one means.
              </p>
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {previewTransfers.map((tf) => {
                const dec = transferDecisions[tf.id] ?? "skip";
                return (
                  <div key={tf.id} className="rounded-lg border border-slate-700 bg-slate-900 p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-slate-200 font-medium truncate">{tf.description}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{tf.date} · {tf.amount.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button type="button"
                        onClick={() => setTransferDecision(tf.id, "owe_me")}
                        className={`flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                          dec === "owe_me"
                            ? "border-green-500 bg-green-900/40 text-green-300"
                            : "border-slate-600 text-slate-400 hover:border-green-500/50 hover:text-green-400"
                        }`}>
                        💰 They owe me
                      </button>
                      <button type="button"
                        onClick={() => setTransferDecision(tf.id, "i_owe")}
                        className={`flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                          dec === "i_owe"
                            ? "border-red-500 bg-red-900/40 text-red-300"
                            : "border-slate-600 text-slate-400 hover:border-red-500/50 hover:text-red-400"
                        }`}>
                        💸 I owe them
                      </button>
                      <button type="button"
                        onClick={() => setTransferDecision(tf.id, "skip")}
                        className={`flex-1 rounded-lg border py-1.5 text-[11px] font-semibold transition-colors ${
                          dec === "skip"
                            ? "border-slate-500 bg-slate-700 text-slate-300"
                            : "border-slate-600 text-slate-500 hover:border-slate-400 hover:text-slate-300"
                        }`}>
                        ⏭ Skip
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Confirm */}
        {(previewBills.length > 0 || previewTxs.length > 0 || previewTransfers.some((tf) => transferDecisions[tf.id] !== "skip")) && (
          <button
            type="button"
            onClick={confirmImport}
            disabled={txUncategorized.length > 0}
            className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {txUncategorized.length > 0
              ? `Assign ${txUncategorized.length} categor${txUncategorized.length === 1 ? "y" : "ies"} first`
              : `Confirm import — ${previewTxs.length} transaction${previewTxs.length !== 1 ? "s" : ""} · ${previewBills.length} bill${previewBills.length !== 1 ? "s" : ""} · ${previewTransfers.filter((tf) => transferDecisions[tf.id] !== "skip").length} transfer${previewTransfers.filter((tf) => transferDecisions[tf.id] !== "skip").length !== 1 ? "s" : ""}`}
          </button>
        )}

        {previewBills.length === 0 && previewTxs.length === 0 && previewTransfers.length === 0 && (
          <div className="rounded-xl border border-slate-700 p-6 text-center space-y-2">
            <p className="text-slate-400 text-sm">No new transactions found.</p>
            {state.skipped > 0 && <p className="text-xs text-slate-500">{state.skipped} were already in your history.</p>}
          </div>
        )}

        {csvError && (
          <p className="text-xs text-red-400 bg-red-950/20 border border-red-500/30 rounded-lg px-3 py-2">{csvError}</p>
        )}
      </div>
    );
  }

  // ── Upload zone / CSV results ──────────────────────────────────────────────
  return (
    <div className="space-y-5">
      {csvTransactions.length === 0 ? (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isLoading && fileRef.current?.click()}
          className={`rounded-2xl border-2 border-dashed cursor-pointer transition-colors p-10 text-center space-y-3 ${
            dragging ? "border-blue-500 bg-blue-950/20" : isLoading ? "border-slate-600 opacity-60" : "border-slate-700 hover:border-slate-500"
          }`}
        >
          {isLoading ? (
            <>
              <p className="text-4xl animate-pulse">⏳</p>
              <p className="text-slate-300 font-semibold">Parsing {state.fileName}…</p>
              <p className="text-sm text-slate-500">This may take a few seconds</p>
            </>
          ) : (
            <>
              <p className="text-4xl">📂</p>
              <p className="text-slate-300 font-semibold">Upload your bank statement</p>
              <p className="text-sm text-slate-500">Drag & drop or click — PDF and CSV supported</p>
              <span className="inline-block mt-1 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white">
                Choose file
              </span>
            </>
          )}
          <input ref={fileRef} type="file" accept=".csv,.pdf" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
      ) : (
        /* ── CSV results ── */
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-400">{csvFileName}</p>
              <p className="text-xs text-slate-500 mt-0.5">{csvTransactions.length} expense transactions · total {csvTotal.toFixed(2)}</p>
            </div>
            <button type="button" onClick={resetAll}
              className="text-xs text-slate-400 hover:text-red-400 border border-slate-700 rounded-lg px-3 py-1.5 transition-colors">
              Clear
            </button>
          </div>

          {/* Category summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {STMT_CATEGORIES.filter((c) => grouped[c.id]?.length).map((cat) => {
              const txs = grouped[cat.id] ?? [];
              const catTotal = txs.reduce((s, t) => s + t.amount, 0);
              const isOpen = expandedCat === cat.id;
              return (
                <button key={cat.id} type="button"
                  onClick={() => setExpandedCat(isOpen ? null : cat.id)}
                  className={`rounded-xl border p-3 text-left transition-colors space-y-1 ${cat.border} ${cat.bg} ${isOpen ? "ring-1 ring-white/10" : "hover:brightness-110"}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-base">{cat.icon}</span>
                    <span className={`text-xs font-semibold ${cat.color}`}>{cat.label}</span>
                  </div>
                  <p className="text-white font-bold text-sm">{catTotal.toFixed(2)}</p>
                  <p className="text-[10px] text-slate-500">{txs.length} transaction{txs.length !== 1 ? "s" : ""}</p>
                </button>
              );
            })}
          </div>

          {expandedCat && grouped[expandedCat] && (
            <div className={`rounded-xl border p-4 space-y-2 ${getCat(expandedCat).border} ${getCat(expandedCat).bg}`}>
              <p className={`text-sm font-semibold ${getCat(expandedCat).color}`}>
                {getCat(expandedCat).icon} {getCat(expandedCat).label}
              </p>
              <div className="space-y-1 max-h-64 overflow-y-auto">
                {grouped[expandedCat].map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center py-1 border-b border-slate-700/50 last:border-0">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs text-slate-200 truncate">{tx.description}</p>
                      <p className="text-[10px] text-slate-500">{tx.date}</p>
                    </div>
                    <span className="text-xs font-semibold text-slate-300 shrink-0">{tx.amount.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {csvUncategorized.length > 0 && (
            <div className="rounded-xl border border-slate-600 bg-slate-800 p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-slate-300">Uncategorized transactions</p>
                <p className="text-xs text-slate-500 mt-0.5">We couldn&apos;t auto-detect these — pick a category for each</p>
              </div>
              <div className="space-y-2">
                {csvUncategorized.map((tx) => (
                  <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-200 truncate">{tx.description}</p>
                      <p className="text-[10px] text-slate-500">{tx.date} · {tx.amount.toFixed(2)}</p>
                    </div>
                    <select value={tx.category} onChange={(e) => assignCsvCategory(tx.id, e.target.value)}
                      className="shrink-0 rounded-lg border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white outline-none focus:border-blue-500">
                      {STMT_CATEGORIES.map((c) => (
                        <option key={c.id} value={c.id}>{c.icon} {c.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {csvError && (
        <div className="rounded-xl border border-red-500/30 bg-red-950/20 px-4 py-3 text-sm text-red-300 space-y-1">
          <p className="font-semibold">Could not parse file</p>
          <p className="text-xs text-red-400">{csvError}</p>
        </div>
      )}
    </div>
  );
}

function mapStmtCategoryToBillCategory(stmtCat: string): string {
  const map: Record<string, string> = {
    transport: "Transport",
    subscriptions: "Internet",
    health: "Insurance",
    fuel: "Transport",
  };
  return map[stmtCat] ?? "Other";
}

// ── Main page ───────────────────────────────────────────────────────────────

export default function BillsPage() {
  const [tab, setTab] = useState<"bills" | "statement">("bills");
  const [bills, setBills] = useState<Bill[]>(loadBills);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<Omit<Bill, "id">>({
    name: "", amount: "", currency: "AUD", due_day: 1,
    category: "Rent / Mortgage", is_recurring: true,
  });

  function save() {
    if (!form.name || !form.amount) return;
    const bill: Bill = { ...form, id: crypto.randomUUID() };
    const updated = [...bills, bill];
    setBills(updated);
    localStorage.setItem("bills", JSON.stringify(updated));
    setForm({ name: "", amount: "", currency: "AUD", due_day: 1, category: "Rent / Mortgage", is_recurring: true });
    setAdding(false);
  }

  function markPaid(id: string) {
    const updated = bills.map((b) =>
      b.id === id ? { ...b, last_paid: new Date().toISOString().split("T")[0] } : b,
    );
    setBills(updated);
    localStorage.setItem("bills", JSON.stringify(updated));
  }

  function remove(id: string) {
    const updated = bills.filter((b) => b.id !== id);
    setBills(updated);
    localStorage.setItem("bills", JSON.stringify(updated));
  }

  const sorted = [...bills].sort((a, b) => daysUntilDue(a.due_day) - daysUntilDue(b.due_day));

  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Bills</h1>
        <p className="text-slate-500 text-sm mt-0.5">Track recurring bills and analyse your spending</p>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-700 overflow-hidden text-sm">
        <button
          type="button"
          onClick={() => setTab("bills")}
          className={`flex-1 py-2.5 font-medium transition-colors ${tab === "bills" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        >
          Recurring Bills
        </button>
        <button
          type="button"
          onClick={() => setTab("statement")}
          className={`flex-1 py-2.5 font-medium transition-colors ${tab === "statement" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}
        >
          Statement Analysis
        </button>
      </div>

      {/* ── Recurring Bills tab ── */}
      {tab === "bills" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            {bills.length > 0 && (
              <span className="text-xs text-slate-500">{bills.length} bill{bills.length !== 1 ? "s" : ""} tracked</span>
            )}
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="ml-auto rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors"
            >
              + Add Bill
            </button>
          </div>

          {adding && (
            <div className="rounded-xl border border-blue-500/30 bg-blue-950/20 p-5 space-y-4">
              <h2 className="text-sm font-semibold text-slate-300">New Bill</h2>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs text-slate-400 mb-1">Bill name</label>
                  <input className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    placeholder="e.g. Electricity"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Amount</label>
                  <input className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    type="number" placeholder="0.00"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Currency</label>
                  <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    value={form.currency}
                    onChange={(e) => setForm((f) => ({ ...f, currency: e.target.value }))}>
                    {CURRENCIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Due day of month</label>
                  <input className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    type="number" min={1} max={31}
                    value={form.due_day}
                    onChange={(e) => setForm((f) => ({ ...f, due_day: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Category</label>
                  <select className="w-full rounded-lg border border-slate-600 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                    {BILL_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={save} disabled={!form.name || !form.amount}
                  className="flex-1 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors">
                  Save bill
                </button>
                <button type="button" onClick={() => setAdding(false)}
                  className="flex-1 rounded-xl border border-slate-700 bg-slate-800 py-2 text-sm text-slate-300 hover:border-slate-500 transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          )}

          {sorted.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center space-y-2">
              <p className="text-3xl">📃</p>
              <p className="text-slate-400 text-sm">No bills tracked yet.</p>
              <button type="button" onClick={() => setAdding(true)} className="text-blue-400 text-sm hover:text-blue-300">
                Add your first bill →
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {sorted.map((bill) => {
                const days = daysUntilDue(bill.due_day);
                const colors = urgencyColor(days);
                const paidToday = bill.last_paid === new Date().toISOString().split("T")[0];
                return (
                  <div key={bill.id} className={`rounded-xl border p-4 ${colors}`}>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-semibold">{bill.name}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{bill.category} · Due day {bill.due_day}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-bold">{bill.currency} {parseFloat(bill.amount).toFixed(2)}</p>
                        <p className="text-xs mt-0.5">
                          {paidToday
                            ? <span className="text-green-400">✓ Paid today</span>
                            : <span>{days === 0 ? "Due today" : `${days}d remaining`}</span>}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      {!paidToday && (
                        <button type="button" onClick={() => markPaid(bill.id)}
                          className="text-xs rounded-lg border border-green-500/30 bg-green-950/20 px-3 py-1.5 text-green-400 hover:bg-green-950/40 transition-colors">
                          Mark paid
                        </button>
                      )}
                      <button type="button" onClick={() => remove(bill.id)}
                        className="text-xs rounded-lg border border-slate-700 px-3 py-1.5 text-slate-500 hover:text-red-400 hover:border-red-500/30 transition-colors ml-auto">
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Statement Analysis tab ── */}
      {tab === "statement" && <StatementTab />}
    </div>
  );
}
