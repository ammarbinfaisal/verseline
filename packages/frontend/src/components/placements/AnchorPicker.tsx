"use client";

import type { Anchor } from "@verseline/shared";
import { ANCHORS } from "@verseline/shared";

interface AnchorPickerProps {
  value: string;
  onChange: (anchor: Anchor) => void;
}

const GRID: Anchor[][] = [
  ["top_left", "top_center", "top_right"],
  ["center_left", "center", "center_right"],
  ["bottom_left", "bottom_center", "bottom_right"],
];

const LABELS: Record<Anchor, string> = {
  top_left: "Top left",
  top_center: "Top center",
  top_right: "Top right",
  center_left: "Center left",
  center: "Center",
  center_right: "Center right",
  bottom_left: "Bottom left",
  bottom_center: "Bottom center",
  bottom_right: "Bottom right",
};

export function AnchorPicker({ value, onChange }: AnchorPickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-500 dark:text-zinc-400">Anchor</label>
      <div
        className="relative w-full aspect-video bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg overflow-hidden"
        title="Click a position to set the anchor"
      >
        {/* Grid of 9 buttons */}
        <div className="absolute inset-0 grid grid-rows-3 grid-cols-3">
          {GRID.map((row) =>
            row.map((anchor) => (
              <button
                key={anchor}
                type="button"
                onClick={() => onChange(anchor)}
                title={LABELS[anchor]}
                className="flex items-center justify-center group"
              >
                <span
                  className={`w-3 h-3 rounded-full border-2 transition-all ${
                    value === anchor
                      ? "bg-blue-500 border-blue-400 scale-125"
                      : "bg-zinc-300 dark:bg-zinc-700 border-zinc-400 dark:border-zinc-600 group-hover:bg-zinc-400 dark:group-hover:bg-zinc-500 group-hover:border-zinc-400 dark:group-hover:border-zinc-400"
                  }`}
                />
              </button>
            ))
          )}
        </div>
      </div>
      <p className="text-xs text-zinc-600 dark:text-zinc-500">{LABELS[value as Anchor] ?? value}</p>
    </div>
  );
}
