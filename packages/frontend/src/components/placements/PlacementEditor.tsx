"use client";

import { useState, useEffect } from "react";
import type { Placement, Anchor } from "@verseline/shared";
import { AnchorPicker } from "./AnchorPicker";

interface PlacementEditorProps {
  placement: Placement | null;
  isNew: boolean;
  onSave: (placement: Placement) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

const EMPTY: Placement = {
  id: "",
  anchor: "bottom_center",
  margin_x: undefined,
  margin_y: undefined,
  max_width: undefined,
  max_height: undefined,
};

function NumberField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-zinc-400">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : parseInt(v, 10));
        }}
        placeholder={placeholder ?? "0"}
        className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
      />
    </div>
  );
}

export function PlacementEditor({ placement, isNew, onSave, onDelete, onCancel }: PlacementEditorProps) {
  const [form, setForm] = useState<Placement>(placement ?? EMPTY);

  useEffect(() => {
    setForm(placement ?? EMPTY);
  }, [placement]);

  if (!placement && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-600 text-sm">
        Select a placement to edit
      </div>
    );
  }

  const set = <K extends keyof Placement>(key: K, value: Placement[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex-1">
          {isNew ? "New Placement" : "Edit Placement"}
        </h2>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ID */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-400">ID</label>
          <input
            type="text"
            value={form.id}
            onChange={(e) => set("id", e.target.value)}
            disabled={!isNew}
            placeholder="bottom-center"
            className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Anchor picker */}
        <AnchorPicker
          value={form.anchor}
          onChange={(anchor: Anchor) => set("anchor", anchor)}
        />

        {/* Margins */}
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Margin X (px)"
            value={form.margin_x}
            onChange={(v) => set("margin_x", v)}
          />
          <NumberField
            label="Margin Y (px)"
            value={form.margin_y}
            onChange={(v) => set("margin_y", v)}
          />
        </div>

        {/* Max dimensions */}
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Max Width (px)"
            value={form.max_width}
            onChange={(v) => set("max_width", v)}
          />
          <NumberField
            label="Max Height (px)"
            value={form.max_height}
            onChange={(v) => set("max_height", v)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 py-3 border-t border-zinc-800 flex items-center gap-2">
        <button
          onClick={() => form.id.trim() && onSave(form)}
          disabled={!form.id.trim()}
          className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Save
        </button>
        {!isNew && (
          <button
            onClick={() => onDelete(form.id)}
            className="py-2 px-4 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
