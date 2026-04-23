export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-slate-950">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-1">Financial</p>
          <h1 className="text-3xl font-bold text-blue-400">Command Center</h1>
          <p className="text-sm text-slate-500 mt-2">Debt → Savings → Investment</p>
        </div>
        {children}
      </div>
    </div>
  );
}
