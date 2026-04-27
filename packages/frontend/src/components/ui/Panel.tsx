import { type ReactNode } from "react";
import { cn } from "./cn";

interface PanelProps {
  children: ReactNode;
  header?: ReactNode;
  footer?: ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Render with surface-1 (default) or surface-2 */
  surface?: "1" | "2";
}

export function Panel({ children, header, footer, className, bodyClassName, surface = "1" }: PanelProps) {
  const bg = surface === "1" ? "bg-[var(--surface-1)]" : "bg-[var(--surface-2)]";
  return (
    <section
      className={cn(
        "flex flex-col rounded-[var(--radius-md)] border border-[var(--border)]",
        bg,
        className,
      )}
    >
      {header && (
        <div className="px-4 py-2.5 border-b border-[var(--border)] flex items-center gap-2">
          {header}
        </div>
      )}
      <div className={cn("flex-1 min-h-0", bodyClassName)}>{children}</div>
      {footer && (
        <div className="px-4 py-2.5 border-t border-[var(--border)] flex items-center gap-2">
          {footer}
        </div>
      )}
    </section>
  );
}
