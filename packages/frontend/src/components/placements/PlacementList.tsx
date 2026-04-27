"use client";

import type { Placement } from "@verseline/shared";
import { Button } from "@/components/ui";

interface PlacementListProps {
  placements: Placement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function PlacementList({ placements, selectedId, onSelect, onNew }: PlacementListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Placements">
        {placements.length === 0 ? (
          <p className="px-4 py-6 text-[var(--text-fs-1)] text-[var(--text-faint)] text-center">
            No placements yet.
          </p>
        ) : (
          <ul>
            {placements.map((p) => {
              const active = selectedId === p.id;
              return (
                <li key={p.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(p.id)}
                    data-testid={`placement-row-${p.id}`}
                    className={[
                      "w-full flex flex-col px-3 py-2 text-left transition-colors relative",
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
                    <span className="text-[var(--text-fs-3)] font-medium text-[var(--text)] truncate">
                      {p.name || p.id}
                    </span>
                    <span className="text-[var(--text-fs-1)] font-mono text-[var(--text-muted)] truncate">
                      {p.x != null && p.y != null
                        ? `${(p.x * 100).toFixed(0)}% · ${(p.y * 100).toFixed(0)}%`
                        : p.anchor}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="p-2 border-t border-[var(--border)]">
        <Button size="sm" variant="ghost" fullWidth onClick={onNew} data-testid="new-placement">
          + New Placement
        </Button>
      </div>
    </div>
  );
}
