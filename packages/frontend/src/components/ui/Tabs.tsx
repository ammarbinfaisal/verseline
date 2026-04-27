"use client";

import { type ReactNode } from "react";
import { cn } from "./cn";

interface Tab<T extends string> {
  id: T;
  label: ReactNode;
}

interface TabsProps<T extends string> {
  tabs: ReadonlyArray<Tab<T>>;
  /** Active id. Passing a value not in `tabs` renders no tab as active — useful when "no panel" is a valid app state. */
  active: T | (string & {});
  onChange: (id: T) => void;
  className?: string;
  variant?: "underline" | "pill";
}

export function Tabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  variant = "underline",
}: TabsProps<T>) {
  return (
    <div role="tablist" className={cn("flex gap-1 items-center", className)}>
      {tabs.map((t) => {
        const isActive = active === t.id;
        if (variant === "underline") {
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(t.id)}
              className={cn(
                "relative px-3 py-2 text-[var(--text-fs-2)] font-medium",
                "transition-colors duration-[120ms] ease-[var(--ease-out-soft)]",
                "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-4px] focus-visible:outline-[var(--focus-ring)]",
                isActive
                  ? "text-[var(--text)]"
                  : "text-[var(--text-muted)] hover:text-[var(--text)]",
              )}
            >
              {t.label}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute left-2 right-2 bottom-0 h-0.5 rounded-full"
                  style={{ background: "var(--accent-cool)" }}
                />
              )}
            </button>
          );
        }
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "px-3 py-1 text-[var(--text-fs-2)] font-medium rounded-md",
              "transition-colors duration-[120ms] ease-[var(--ease-out-soft)]",
              "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
              isActive
                ? "bg-[var(--surface-2)] text-[var(--text)]"
                : "text-[var(--text-muted)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
