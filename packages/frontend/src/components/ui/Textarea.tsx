import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
  fullWidth?: boolean;
  /** Render with monospace font (for text/code editing) */
  mono?: boolean;
}

const base =
  "bg-[var(--surface-2)] text-[var(--text)] " +
  "border border-[var(--border)] rounded-md " +
  "px-3 py-2 text-[var(--text-fs-3)] " +
  "placeholder:text-[var(--text-faint)] " +
  "transition-colors duration-[120ms] ease-[var(--ease-out-soft)] " +
  "focus:outline-none focus-visible:outline-none " +
  "focus:border-[var(--brand-primary)] " +
  "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--bg)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "resize-y";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, fullWidth, mono, className, ...rest },
  ref,
) {
  return (
    <textarea
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(
        base,
        fullWidth && "w-full",
        invalid && "border-[var(--error)]",
        mono && "font-mono",
        className,
      )}
      {...rest}
    />
  );
});
