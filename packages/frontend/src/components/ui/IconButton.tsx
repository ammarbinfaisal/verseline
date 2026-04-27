import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

type Size = "sm" | "md" | "lg";
type Variant = "default" | "ghost" | "primary" | "selected";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  size?: Size;
  variant?: Variant;
  /** Required for a11y — every IconButton needs a label */
  label: string;
  children: ReactNode;
}

const base =
  "inline-flex items-center justify-center rounded-md " +
  "transition-colors duration-[120ms] ease-[var(--ease-out-soft)] " +
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 " +
  "focus-visible:outline-[var(--focus-ring)] " +
  "disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none";

const sizeMap: Record<Size, string> = {
  sm: "w-7 h-7",
  md: "w-9 h-9",
  lg: "w-11 h-11",
};

const variantMap: Record<Variant, string> = {
  default:
    "text-[var(--text)] hover:bg-[var(--surface-2)] active:bg-[var(--surface-3)]",
  ghost:
    "text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]",
  primary:
    "bg-[var(--accent-warm)] text-[var(--text-on-warm)] " +
    "hover:bg-[var(--accent-warm-hi)] active:bg-[var(--accent-warm-lo)]",
  selected:
    "bg-[var(--accent-cool)] text-[var(--text-on-accent)] " +
    "hover:bg-[var(--accent-cool-hi)]",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { size = "md", variant = "default", label, className, children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(base, sizeMap[size], variantMap[variant], className)}
      {...rest}
    >
      {children}
    </button>
  );
});
