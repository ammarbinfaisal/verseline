"use client";

import type { Style } from "@verseline/shared";
import { Button } from "@/components/ui";

interface StyleListProps {
  styles: Style[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function StyleList({ styles, selectedId, onSelect, onNew }: StyleListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Styles">
        {styles.length === 0 ? (
          <p className="px-4 py-6 text-[var(--text-fs-1)] text-[var(--text-faint)] text-center">
            No styles yet.
          </p>
        ) : (
          <ul>
            {styles.map((style) => {
              const active = selectedId === style.id;
              return (
                <li key={style.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(style.id)}
                    data-testid={`style-row-${style.id}`}
                    className={[
                      "w-full flex items-center gap-3 px-3 py-2 text-left transition-colors relative",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]",
                      active
                        ? "bg-[color-mix(in_srgb,var(--accent-cool)_10%,transparent)]"
                        : "hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1 bottom-1 w-0.5"
                        style={{ background: "var(--accent-cool)" }}
                      />
                    )}
                    <span
                      className="shrink-0 w-4 h-4 rounded-sm border border-[var(--border)]"
                      style={{ backgroundColor: style.color ?? "#ffffff" }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[var(--text-fs-3)] font-medium text-[var(--text)] truncate">
                        {style.id}
                      </span>
                      <span className="block text-[var(--text-fs-1)] font-mono text-[var(--text-muted)] truncate">
                        {style.font} · {style.size}px
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-2 border-t border-[var(--border)]">
        <Button size="sm" variant="ghost" fullWidth onClick={onNew} data-testid="new-style">
          + New Style
        </Button>
      </div>
    </div>
  );
}
