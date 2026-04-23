"use client";
import Link from "next/link";

export default function NotificationsPage() {
  return (
    <div className="px-4 py-6 lg:px-8 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-100">Notifications</h1>
        <p className="text-slate-500 text-sm mt-0.5">Payment reminders and account alerts</p>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-800 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">Active Alerts</h2>
        <div className="text-sm text-slate-500 space-y-2">
          <p>✓ 30-day payment warnings</p>
          <p>✓ 7-day payment warnings</p>
          <p>✓ 1-day payment reminders</p>
          <p>✓ Payment day alerts</p>
          <p>✓ 3-day missed payment alerts</p>
        </div>
        <p className="text-xs text-slate-600">
          All notifications are sent via email. Security alerts are always on and cannot be disabled.
        </p>
      </div>

      <Link href="/payment-warnings" className="block rounded-xl border border-amber-500/20 bg-amber-950/20 p-4 text-sm text-amber-400 hover:bg-amber-950/30">
        View active payment warnings →
      </Link>
    </div>
  );
}
