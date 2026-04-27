import { useId, type ReactNode } from "react";
import { cn } from "./cn";

interface FieldProps {
  label: string;
  children: (props: { id: string; "aria-describedby"?: string; "aria-invalid"?: boolean }) => ReactNode;
  hint?: string;
  error?: string;
  className?: string;
  /** Hide the visual label but keep it for screen readers */
  visuallyHiddenLabel?: boolean;
}

export function Field({ label, children, hint, error, className, visuallyHiddenLabel }: FieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error && errorId, !error && hint && hintId].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label
        htmlFor={id}
        className={cn(
          "text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium",
          visuallyHiddenLabel && "sr-only",
        )}
      >
        {label}
      </label>
      {children({
        id,
        "aria-describedby": describedBy,
        "aria-invalid": Boolean(error),
      })}
      {error ? (
        <p id={errorId} role="alert" className="text-[var(--text-fs-1)] text-[var(--error)] mt-0.5">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[var(--text-fs-1)] text-[var(--text-faint)] mt-0.5">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
