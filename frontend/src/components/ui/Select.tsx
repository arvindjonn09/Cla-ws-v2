"use client";
import { cn } from "@/lib/utils";
import type { SelectHTMLAttributes } from "react";

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, error, options, className, id, ...rest }: Props) {
  const selectId = id ?? label?.toLowerCase().replace(/\s+/g, "_");
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={selectId} className="text-sm font-medium text-slate-300">
          {label}
        </label>
      )}
      <select
        id={selectId}
        className={cn(
          "w-full rounded-lg border bg-slate-800 px-3 py-2.5 text-sm text-slate-100 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500",
          error ? "border-red-500" : "border-slate-600 focus:border-blue-500",
          className
        )}
        {...rest}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
