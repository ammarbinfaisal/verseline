"use client";

import { useState } from "react";
import type { Style, Placement, Font } from "@verseline/shared";
import { useMountEffect } from "@/hooks/useMountEffect";
import { Button, EmptyState, Modal } from "@/components/ui";

type Kind = "style" | "placement" | "font";
type Preset = Style | Placement | Font;

interface PresetPickerProps<T extends Preset> {
  kind: Kind;
  open: boolean;
  onClose: () => void;
  onPick: (preset: T) => void;
  list: () => T[];
  remove: (id: string) => void;
}

const TITLES: Record<Kind, string> = {
  style: "Insert a style from your library",
  placement: "Insert a placement from your library",
  font: "Insert a font from your library",
};

function describe(kind: Kind, p: Preset): string {
  if (kind === "placement") {
    const pl = p as Placement;
    if (pl.x != null && pl.y != null) return `x ${(pl.x * 100).toFixed(0)}% · y ${(pl.y * 100).toFixed(0)}%`;
    return pl.anchor;
  }
  if (kind === "style") {
    const st = p as Style;
    return [st.font, st.size && `${st.size}px`, st.color].filter(Boolean).join(" · ");
  }
  if (kind === "font") {
    const f = p as Font;
    return f.family;
  }
  return "";
}

export function PresetPicker<T extends Preset>({
  kind,
  open,
  onClose,
  onPick,
  list,
  remove,
}: PresetPickerProps<T>) {
  const [items, setItems] = useState<T[]>([]);

  useMountEffect(() => {
    if (open) setItems(list());
  });

  // Re-list when opened (state-derived, not effect)
  const visibleItems = open && items.length === 0 ? list() : items;

  const handleRemove = (id: string) => {
    remove(id);
    setItems(list());
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[kind]}
      size="md"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {visibleItems.length === 0 ? (
        <EmptyState
          title="No presets yet"
          body={`Save a ${kind} to your library and it'll appear here.`}
        />
      ) : (
        <ul className="flex flex-col gap-1" data-testid={`preset-list-${kind}`}>
          {visibleItems.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--surface-2)] transition-colors"
            >
              <button
                type="button"
                onClick={() => {
                  onPick(p);
                  onClose();
                }}
                data-testid={`preset-pick-${p.id}`}
                className="flex-1 text-left"
              >
                <div className="text-[var(--text-fs-3)] text-[var(--text)] font-medium">
                  {("name" in p && (p as { name?: string }).name) || p.id}
                </div>
                <div className="text-[var(--text-fs-1)] text-[var(--text-muted)] font-mono">
                  {describe(kind, p)}
                </div>
              </button>
              <button
                type="button"
                onClick={() => handleRemove(p.id)}
                aria-label={`Remove ${p.id} from library`}
                className="text-[var(--text-fs-1)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors px-2 py-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </Modal>
  );
}
