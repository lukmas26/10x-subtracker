import type { ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

interface SelectFieldProps {
  id: string;
  name?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  icon: ReactNode;
  children: ReactNode;
}

/** Native select styled like `FormField`; options get a dark background so they stay readable. */
export function SelectField({ id, name, label, value, onChange, error, icon, children }: SelectFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm text-blue-100/80">
        {label}
      </label>
      <div className="relative">
        <span className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/40">
          {icon}
        </span>
        <select
          id={id}
          name={name ?? id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className={cn(
            "w-full rounded-lg border bg-white/10 px-3 py-2 pl-10 text-white transition-colors focus:ring-2 focus:outline-none [&>option]:bg-slate-900 [&>option]:text-white",
            error ? "border-red-400/60 focus:ring-red-400" : "border-white/20 focus:ring-purple-400",
          )}
        >
          {children}
        </select>
      </div>
      {error && (
        <p className="mt-1 flex items-center gap-1 text-xs text-red-300">
          <CircleAlert className="size-3" />
          {error}
        </p>
      )}
    </div>
  );
}
