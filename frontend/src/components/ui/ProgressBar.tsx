import { cn } from "@/lib/utils";

interface Props {
  value: number; // 0–100
  color?: "blue" | "green" | "amber" | "red";
  size?: "sm" | "md";
  label?: string;
  className?: string;
}

const colorMap = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
};

const sizeMap = {
  sm: "h-1.5",
  md: "h-2.5",
};

export default function ProgressBar({ value, color = "blue", size = "md", label, className }: Props) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("w-full", className)}>
      {label && (
        <div className="flex justify-between text-xs text-slate-400 mb-1">
          <span>{label}</span>
          <span>{clamped}%</span>
        </div>
      )}
      <div className={cn("w-full rounded-full bg-slate-700", sizeMap[size])}>
        <div
          className={cn("rounded-full transition-all duration-500", colorMap[color], sizeMap[size])}
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}
