import { type ReactNode } from "react";
import { cn } from "./cn";

interface KbdProps {
  children: ReactNode;
  className?: string;
}

export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex items-center justify-center",
        "px-1.5 py-0.5 min-w-[1.5rem] h-5",
        "bg-[var(--surface-2)] border border-[var(--border)]",
        "rounded-sm",
        "text-[var(--text-fs-1)] text-[var(--text-muted)] font-mono",
        "shadow-[inset_0_-1px_0_var(--border-strong)]",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
