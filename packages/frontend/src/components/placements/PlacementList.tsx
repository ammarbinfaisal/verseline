"use client";

import type { Placement } from "@verseline/shared";

interface PlacementListProps {
  placements: Placement[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function PlacementList({ placements, selectedId, onSelect, onNew }: PlacementListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Placements</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {placements.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-400 dark:text-zinc-600 text-center">No placements yet.</p>
        ) : (
          <ul>
            {placements.map((p) => (
              <li key={p.id}>
                <button
                  onClick={() => onSelect(p.id)}
                  className={`w-full flex flex-col px-4 py-2.5 text-left transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    selectedId === p.id
                      ? "bg-zinc-100 dark:bg-zinc-800 border-l-2 border-blue-500"
                      : "border-l-2 border-transparent"
                  }`}
                >
                  <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200 truncate">{p.id}</span>
                  <span className="text-xs text-zinc-600 dark:text-zinc-500 truncate">
                    {p.anchor}
                    {(p.margin_x !== undefined || p.margin_y !== undefined) && (
                      <> &middot; {p.margin_x ?? 0}/{p.margin_y ?? 0}px</>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
        <button
          onClick={onNew}
          className="w-full py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
        >
          + New Placement
        </button>
      </div>
    </div>
  );
}
