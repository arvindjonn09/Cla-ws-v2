"use client";
import { useEffect, useState, useRef, useCallback } from "react";
import { jointApi } from "@/lib/api";
import { getJointAccountId } from "@/lib/utils";
import type { SafeSpaceMessage } from "@/types";

export default function SafeSpacePage() {
  const [messages, setMessages] = useState<SafeSpaceMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const accountId = typeof window !== "undefined" ? getJointAccountId() : null;
  const userRaw = typeof window !== "undefined" ? localStorage.getItem("user") : null;
  const userId = userRaw ? JSON.parse(userRaw)?.id : null;

  const load = useCallback(async () => {
    if (!accountId) { setLoading(false); return; }
    const data = await jointApi.getMessages(accountId).catch(() => [] as SafeSpaceMessage[]);
    setMessages(data.sort((a, b) => a.sent_at.localeCompare(b.sent_at)));
    setLoading(false);
  }, [accountId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!accountId || !input.trim()) return;
    setSending(true);
    try {
      await jointApi.sendMessage(accountId, input.trim());
      setInput("");
      await load();
    } catch { /* ignore */ }
    finally { setSending(false); }
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400" /></div>;

  return (
    <div className="flex flex-col h-screen max-h-screen">
      {/* Header */}
      <div className="border-b border-slate-800 px-6 py-4 shrink-0">
        <h1 className="text-lg font-bold text-slate-100">Safe Space</h1>
        <p className="text-xs text-slate-500">A calm place to talk about money — no blame, no judgment</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <p className="text-4xl mb-3">💬</p>
            <p className="text-slate-400 text-sm">No messages yet. Start the conversation.</p>
            <p className="text-xs text-slate-600 mt-1">Use team language — say "we" and "our", not "you" and "your".</p>
          </div>
        )}
        {messages.map((m) => {
          const isMe = m.sender_id === userId;
          return (
            <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-xs lg:max-w-md rounded-2xl px-4 py-3 ${
                isMe
                  ? "bg-purple-600 text-white rounded-br-sm"
                  : "bg-slate-800 border border-slate-700 text-slate-200 rounded-bl-sm"
              }`}>
                <p className="text-sm">{m.message}</p>
                <p className={`text-[10px] mt-1 ${isMe ? "text-purple-300" : "text-slate-500"}`}>
                  {new Date(m.sent_at).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Prompts */}
      <div className="px-4 pb-2 shrink-0">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {[
            "I feel anxious about our finances.",
            "Can we review the plan together?",
            "I appreciate the progress we've made.",
            "I want to talk about our goals.",
          ].map((p) => (
            <button key={p} type="button" onClick={() => setInput(p)}
              className="shrink-0 text-xs bg-slate-800 border border-slate-700 rounded-full px-3 py-1.5 text-slate-400 hover:border-purple-500 hover:text-purple-400 transition-colors">
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Input */}
      <form onSubmit={send} className="border-t border-slate-800 px-4 py-3 flex gap-3 shrink-0 bg-slate-950">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something supportive…"
          className="flex-1 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2.5 text-sm text-white outline-none focus:border-purple-500 placeholder:text-slate-500"
        />
        <button type="submit" disabled={sending || !input.trim()}
          className="rounded-xl bg-purple-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-purple-500 disabled:opacity-50 transition-colors">
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
