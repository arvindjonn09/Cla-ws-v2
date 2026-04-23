"use client";
import PersonalNav from "@/components/shared/PersonalNav";

export default function PersonalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-slate-950">
      <PersonalNav />
      <main className="flex-1 overflow-y-auto pb-20 lg:pb-0">
        {children}
      </main>
    </div>
  );
}
