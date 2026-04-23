"use client";
import JointNav from "@/components/shared/JointNav";

export default function JointLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <JointNav />
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
