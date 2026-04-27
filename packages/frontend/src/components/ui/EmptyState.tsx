import { type ReactNode } from "react";
import { cn } from "./cn";

interface EmptyStateProps {
  title: string;
  body?: ReactNode;
  cta?: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function EmptyState({ title, body, cta, icon, className }: EmptyStateProps) {
  return (
    <div className={cn("flex flex-col items-center text-center py-16 px-6", className)}>
      {icon && (
        <div
          className="mb-4 text-[var(--text-faint)]"
          aria-hidden="true"
          style={{ fontSize: "var(--text-fs-6)" }}
        >
          {icon}
        </div>
      )}
      <h3 className="text-[var(--text-fs-5)] text-[var(--text)] font-semibold mb-2">{title}</h3>
      {body && (
        <p className="text-[var(--text-fs-3)] text-[var(--text-muted)] max-w-md mb-6">{body}</p>
      )}
      {cta}
    </div>
  );
}
