import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { inputClassName } from "@/components/ui/input";
import {
  FieldError,
  FieldLabel,
  fieldControlClassName,
  fieldErrorProps,
  fieldIconClassName,
} from "@/components/form/FormField";

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

/** Native select styled with the same token classes as `Input`; options read the popover tokens. */
export function SelectField({ id, name, label, value, onChange, error, icon, children }: SelectFieldProps) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <span className={fieldIconClassName}>{icon}</span>
        <select
          id={id}
          name={name ?? id}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          className={cn(
            inputClassName,
            fieldControlClassName,
            "[&>option]:bg-popover [&>option]:text-popover-foreground",
          )}
          {...fieldErrorProps(id, error)}
        >
          {children}
        </select>
      </div>
      {error && <FieldError id={id} message={error} />}
    </div>
  );
}
