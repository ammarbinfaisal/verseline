"use client";

import { useState } from "react";
import type { Style, Placement, Font, PresetRecord } from "@verseline/shared";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useLibraryStore } from "@/stores/library-store";
import { Button, EmptyState, Modal } from "@/components/ui";

type Kind = "style" | "placement" | "font";

interface PresetPickerProps {
  kind: Kind;
  open: boolean;
  onClose: () => void;
  /** Insert chosen preset into the current project. */
  onPick: (preset: Style | Placement | Font) => void;
}

const TITLES: Record<Kind, string> = {
  style: "Insert a style from your library",
  placement: "Insert a placement from your library",
  font: "Insert a font from your library",
};

function describe(kind: Kind, p: Style | Placement | Font): string {
  if (kind === "placement") {
    const pl = p as Placement;
    if (pl.x != null && pl.y != null)
      return `x ${(pl.x * 100).toFixed(0)}% · y ${(pl.y * 100).toFixed(0)}%`;
    return pl.anchor;
  }
  if (kind === "style") {
    const st = p as Style;
    return [st.font, st.size && `${st.size}px`, st.color].filter(Boolean).join(" · ");
  }
  if (kind === "font") {
    return (p as Font).family;
  }
  return "";
}

export function PresetPicker({ kind, open, onClose, onPick }: PresetPickerProps) {
  const loadPresets = useLibraryStore((s) => s.loadPresets);
  const presetsLoaded = useLibraryStore((s) => s.presetsLoaded);
  const records = useLibraryStore((s) => s.presetRecords);

  // Per-kind delete dispatch. Captured by string key so we don't import three
  // selectors when one is enough.
  const deleteStyle = useLibraryStore((s) => s.deleteStylePreset);
  const deletePlacement = useLibraryStore((s) => s.deletePlacementPreset);
  const deleteFont = useLibraryStore((s) => s.deleteFontPreset);

  const [busyId, setBusyId] = useState<string | null>(null);

  useMountEffect(() => {
    if (open && !presetsLoaded) {
      void loadPresets();
    }
  });

  const items: PresetRecord[] = open ? records.filter((r) => r.kind === kind) : [];
  const builtIn = items.filter((r) => r.builtIn);
  const userOwned = items.filter((r) => !r.builtIn);

  const handleRemove = async (record: PresetRecord) => {
    if (record.builtIn) return;
    setBusyId(record.id);
    const id = (record.payload as { id: string }).id;
    try {
      if (record.kind === "style") await deleteStyle(id);
      else if (record.kind === "placement") await deletePlacement(id);
      else if (record.kind === "font") await deleteFont(id);
    } finally {
      setBusyId(null);
    }
  };

  const handlePick = (record: PresetRecord) => {
    onPick(record.payload as Style | Placement | Font);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[kind]}
      size="md"
      footer={<Button variant="ghost" onClick={onClose}>Close</Button>}
    >
      {items.length === 0 ? (
        <EmptyState
          title="No presets yet"
          body={`Save a ${kind} to your library and it'll appear here.`}
        />
      ) : (
        <div className="flex flex-col gap-4" data-testid={`preset-list-${kind}`}>
          {builtIn.length > 0 && (
            <Section label="Built-in" records={builtIn} kind={kind} onPick={handlePick} />
          )}
          {userOwned.length > 0 && (
            <Section
              label={builtIn.length > 0 ? "Your library" : undefined}
              records={userOwned}
              kind={kind}
              onPick={handlePick}
              onRemove={handleRemove}
              busyId={busyId}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

interface SectionProps {
  label?: string;
  records: PresetRecord[];
  kind: Kind;
  onPick: (record: PresetRecord) => void;
  onRemove?: (record: PresetRecord) => void;
  busyId?: string | null;
}

function Section({ label, records, kind, onPick, onRemove, busyId }: SectionProps) {
  return (
    <section>
      {label && (
        <h3 className="text-[var(--text-fs-1)] uppercase tracking-[0.14em] text-[var(--text-muted)] font-semibold mb-2">
          {label}
        </h3>
      )}
      <ul className="flex flex-col gap-1">
        {records.map((record) => {
          const payload = record.payload as { id: string; name?: string };
          return (
            <li
              key={record.id}
              className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-[var(--surface-2)] transition-colors"
            >
              <button
                type="button"
                onClick={() => onPick(record)}
                data-testid={`preset-pick-${payload.id}`}
                className="flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-sm"
              >
                <div className="text-[var(--text-fs-3)] text-[var(--text)] font-medium">
                  {payload.name || payload.id}
                </div>
                <div className="text-[var(--text-fs-1)] text-[var(--text-muted)] font-mono">
                  {describe(kind, record.payload as Style | Placement | Font)}
                </div>
              </button>
              {onRemove && (
                <button
                  type="button"
                  onClick={() => onRemove(record)}
                  disabled={busyId === record.id}
                  aria-label={`Remove ${payload.id} from library`}
                  className="text-[var(--text-fs-1)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors px-2 py-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] disabled:opacity-50"
                >
                  {busyId === record.id ? "…" : "Remove"}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
