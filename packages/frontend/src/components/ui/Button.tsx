import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { Spinner } from "./Spinner";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  fullWidth?: boolean;
}

const base =
  "inline-flex items-center justify-center gap-2 font-medium rounded-md " +
  "transition-colors duration-[120ms] ease-[var(--ease-out-soft)] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-[var(--focus-ring)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none " +
  "select-none whitespace-nowrap";

const sizeMap: Record<Size, string> = {
  sm: "px-2.5 py-1 text-[var(--text-fs-1)] h-7",
  md: "px-3.5 py-1.5 text-[var(--text-fs-2)] h-9",
  lg: "px-5 py-2.5 text-[var(--text-fs-3)] h-11",
};

const variantMap: Record<Variant, string> = {
  // Primary CTA — amber, "act on this next"
  primary:
    "bg-[var(--accent-warm)] text-[var(--text-on-warm)] " +
    "hover:bg-[var(--accent-warm-hi)] active:bg-[var(--accent-warm-lo)] " +
    "shadow-[var(--shadow-sm)]",
  // Secondary — teal-blue, the brand color
  secondary:
    "bg-[var(--brand-primary)] text-[var(--text-on-accent)] " +
    "hover:bg-[var(--brand-primary-hi)] active:bg-[var(--brand-primary-lo)]",
  // Ghost — surface-1 with border, recedes
  ghost:
    "bg-[var(--surface-1)] text-[var(--text)] border border-[var(--border)] " +
    "hover:bg-[var(--surface-2)] hover:border-[var(--border-strong)] " +
    "active:bg-[var(--surface-2)]",
  // Danger — desaturated red
  danger:
    "bg-[var(--error)] text-white hover:opacity-90 active:opacity-80",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "ghost",
    size = "md",
    loading = false,
    iconLeft,
    iconRight,
    fullWidth = false,
    className,
    children,
    disabled,
    type = "button",
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(base, sizeMap[size], variantMap[variant], fullWidth && "w-full", className)}
      {...rest}
    >
      {loading ? <Spinner size={size === "lg" ? 16 : 14} /> : iconLeft}
      {children}
      {!loading && iconRight}
    </button>
  );
});
