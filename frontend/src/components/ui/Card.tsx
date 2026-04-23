import { cn } from "@/lib/utils";

interface Props {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hover?: boolean;
}

export default function Card({ children, className, onClick, hover }: Props) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-xl border border-slate-700 bg-slate-800 p-4",
        hover && "cursor-pointer hover:border-slate-500 hover:bg-slate-750 transition-colors",
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={cn("text-sm font-semibold text-slate-400 uppercase tracking-wide mb-3", className)}>{children}</h3>;
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: "blue" | "green" | "red" | "amber";
}) {
  const accentColor = {
    blue: "text-blue-400",
    green: "text-green-400",
    red: "text-red-400",
    amber: "text-amber-400",
  }[accent ?? "blue"];

  return (
    <Card>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={cn("text-2xl font-bold", accentColor)}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </Card>
  );
}
