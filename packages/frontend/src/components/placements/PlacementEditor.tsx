"use client";

import { useState } from "react";
import type { Placement } from "@verseline/shared";
import { Button, Field, Input, toast } from "@/components/ui";
import { FreeformPlacementEditor } from "./FreeformPlacementEditor";
import { useLibraryStore } from "@/stores/library-store";

interface PlacementEditorProps {
  placement: Placement | null;
  isNew: boolean;
  canvas: { width: number; height: number };
  onSave: (placement: Placement) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const EMPTY: Placement = {
  id: "",
  name: "",
  anchor: "bottom_center",
  x: 0.5,
  y: 0.85,
};

export function PlacementEditor({
  placement,
  isNew,
  canvas,
  onSave,
  onDelete,
  onCancel,
}: PlacementEditorProps) {
  const [form, setForm] = useState<Placement>(placement ?? EMPTY);
  const saveToLibrary = useLibraryStore((s) => s.savePlacementPreset);

  if (!placement && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-fs-2)] text-[var(--text-muted)]">
        Select a placement to edit, or create a new one.
      </div>
    );
  }

  const handleSaveLib = async () => {
    try {
      await saveToLibrary(form);
      toast.success(`“${form.name || form.id}” saved to library`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save to library");
    }
  };

  return (
    <div className="flex flex-col h-full" data-testid="placement-editor">
      <header className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 shrink-0">
        <h2 className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em] flex-1">
          {isNew ? "New Placement" : "Edit Placement"}
        </h2>
        <Button size="sm" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="ID" hint="Used in the schema, lowercase">
            {(p) => (
              <Input
                {...p}
                type="text"
                value={form.id}
                onChange={(e) => setForm((f) => ({ ...f, id: e.target.value.replace(/\s+/g, "-").toLowerCase() }))}
                disabled={!isNew}
                placeholder="bottom-center"
                fullWidth
                data-testid="placement-id"
              />
            )}
          </Field>
          <Field label="Name" hint="Shown in pickers">
            {(p) => (
              <Input
                {...p}
                type="text"
                value={form.name ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value || undefined }))}
                placeholder="Bottom caption"
                fullWidth
                data-testid="placement-name"
              />
            )}
          </Field>
        </div>

        <FreeformPlacementEditor
          canvas={canvas}
          value={form}
          onChange={(next) => setForm(next)}
        />
      </div>

      <footer className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-2 shrink-0">
        <Button
          variant="primary"
          size="md"
          fullWidth
          disabled={!form.id.trim()}
          onClick={() => onSave(form)}
          data-testid="placement-save"
        >
          Save
        </Button>
        <Button
          variant="ghost"
          size="md"
          onClick={handleSaveLib}
          disabled={!form.id.trim()}
          data-testid="placement-save-library"
          title="Save this placement to your shared library"
        >
          ★ Library
        </Button>
        {!isNew && (
          <Button variant="danger" size="md" onClick={() => onDelete(form.id)} data-testid="placement-delete">
            Delete
          </Button>
        )}
      </footer>
    </div>
  );
}
