import { cn } from "@/lib/utils";

type Color = "blue" | "green" | "red" | "amber" | "slate" | "purple";

const colorMap: Record<Color, string> = {
  blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  green: "bg-green-500/20 text-green-400 border-green-500/30",
  red: "bg-red-500/20 text-red-400 border-red-500/30",
  amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  slate: "bg-slate-600/40 text-slate-300 border-slate-500/30",
  purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
};

interface Props {
  children: React.ReactNode;
  color?: Color;
  className?: string;
}

export default function Badge({ children, color = "slate", className }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium",
        colorMap[color],
        className
      )}
    >
      {children}
    </span>
  );
}
