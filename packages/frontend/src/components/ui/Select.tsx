import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  invalid?: boolean;
  fullWidth?: boolean;
}

const base =
  "bg-[var(--surface-2)] text-[var(--text)] " +
  "border border-[var(--border)] rounded-md " +
  "px-3 py-1.5 pr-8 text-[var(--text-fs-3)] " +
  "transition-colors duration-[120ms] ease-[var(--ease-out-soft)] " +
  "focus:outline-none focus-visible:outline-none " +
  "focus:border-[var(--brand-primary)] " +
  "focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-[var(--bg)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed " +
  "appearance-none bg-no-repeat bg-right cursor-pointer";

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { invalid, fullWidth, className, children, style, ...rest },
  ref,
) {
  return (
    <select
      ref={ref}
      aria-invalid={invalid || undefined}
      className={cn(base, fullWidth && "w-full", invalid && "border-[var(--error)]", className)}
      style={{
        backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M2 4l4 4 4-4' stroke='currentColor' stroke-width='1.5' fill='none' stroke-linecap='round' stroke-linejoin='round'/></svg>")`,
        backgroundPosition: "right 8px center",
        backgroundSize: "12px 12px",
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
});
