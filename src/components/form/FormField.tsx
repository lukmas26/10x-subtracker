import type { HTMLAttributes, ReactNode } from "react";
import { CircleAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Field-level additions on top of the `Input` base (room for the leading icon, size, glass surface). */
export const fieldControlClassName = "h-auto rounded-lg bg-card py-2 pl-10 text-base md:text-base dark:bg-card";

export const fieldIconClassName =
  "pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground";

export function fieldErrorId(id: string) {
  return `${id}-error`;
}

/** `aria-invalid` / `aria-describedby` for a control whose error is rendered by `FieldError`. */
export function fieldErrorProps(id: string, error?: string) {
  return error ? { "aria-invalid": true, "aria-describedby": fieldErrorId(id) } : {};
}

export function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <Label htmlFor={htmlFor} className="text-muted-foreground mb-1 leading-5 font-normal">
      {children}
    </Label>
  );
}

export function FieldError({ id, message }: { id: string; message: string }) {
  return (
    <p id={fieldErrorId(id)} className="text-destructive mt-1 flex items-center gap-1 text-xs">
      <CircleAlert className="size-3" aria-hidden="true" />
      {message}
    </p>
  );
}

interface FormFieldProps {
  id: string;
  name?: string;
  label: string;
  type?: string;
  inputMode?: HTMLAttributes<HTMLInputElement>["inputMode"];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  icon: ReactNode;
  endContent?: ReactNode;
  disabled?: boolean;
}

export function FormField({
  id,
  name,
  label,
  type = "text",
  inputMode,
  value,
  onChange,
  placeholder,
  error,
  hint,
  icon,
  endContent,
  disabled,
}: FormFieldProps) {
  return (
    <div>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <span className={fieldIconClassName}>{icon}</span>
        <Input
          id={id}
          name={name ?? id}
          type={type}
          inputMode={inputMode}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={fieldControlClassName}
          {...fieldErrorProps(id, error)}
        />
        {endContent}
      </div>
      {error ? <FieldError id={id} message={error} /> : hint}
    </div>
  );
}
