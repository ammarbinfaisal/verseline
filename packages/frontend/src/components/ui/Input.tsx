import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
  /** Set when input is in a flex layout and should fill available space */
  fullWidth?: boolean;
}

const base =
  "bg-[var(--surface-2)] text-[var(--text)] " +
  "border border-[var(--border)] rounded-md " +
  "px-3 py-1.5 text-[var(--text-fs-3)] " +
  "placeholder:text-[var(--text-faint)] " +
  "transition-colors duration-[120ms] ease-[var(--ease-out-soft)] " +
  "focus:outline-none focus-visible:outline-none " +
  "focus:border-[var(--brand-primary)] " +
  "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--bg)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed";

const invalidStyles =
  "border-[var(--error)] focus:border-[var(--error)] " +
  "focus-visible:ring-[var(--error)]";

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, fullWidth, className, ...rest },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(base, fullWidth && "w-full", invalid && invalidStyles, className)}
      {...rest}
    />
  );
});
