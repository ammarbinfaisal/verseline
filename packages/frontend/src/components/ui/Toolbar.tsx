import { type ReactNode } from "react";
import { cn } from "./cn";

interface ToolbarProps {
  children: ReactNode;
  className?: string;
  /** Compact = 32px, default = 44px */
  size?: "compact" | "default";
}

export function Toolbar({ children, className, size = "default" }: ToolbarProps) {
  return (
    <div
      role="toolbar"
      className={cn(
        "flex items-center gap-1 px-2 border-b border-[var(--border)] bg-[var(--surface-1)]",
        size === "compact" ? "h-8" : "h-11",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-1", className)}>{children}</div>;
}

export function ToolbarSpacer() {
  return <div className="flex-1" />;
}

export function ToolbarDivider() {
  return <div className="w-px h-5 bg-[var(--border)] mx-1" aria-hidden="true" />;
}
