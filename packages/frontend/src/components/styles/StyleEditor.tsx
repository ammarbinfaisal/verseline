"use client";

import { useState } from "react";
import type { Style, Font } from "@verseline/shared";
import { Button, toast } from "@/components/ui";
import { useLibraryStore } from "@/stores/library-store";

interface StyleEditorProps {
  style: Style | null;
  isNew: boolean;
  fonts: Font[];
  onSave: (style: Style) => void;
  onDelete: (id: string) => void;
  onCancel: () => void;
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  const display = value ?? "#ffffff";
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-md cursor-pointer border border-[var(--border)] bg-transparent p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        />
        <input
          type="text"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className="flex-1 min-w-0 bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] font-mono focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-colors duration-[120ms] ease-[var(--ease-out-soft)]"
        />
      </div>
    </div>
  );
}

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
      <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : parseInt(v, 10));
        }}
        placeholder={placeholder ?? "0"}
        className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-colors duration-[120ms] ease-[var(--ease-out-soft)]"
      />
    </div>
  );
}

const EMPTY_STYLE: Style = {
  id: "",
  font: "",
  size: 48,
  color: "#ffffff",
  outline_color: undefined,
  outline: undefined,
  shadow_color: undefined,
  shadow: undefined,
  text_bg: undefined,
  text_bg_pad: undefined,
  text_bg_radius: undefined,
  align: "center",
  line_height: undefined,
};

export function StyleEditor({ style, isNew, fonts, onSave, onDelete, onCancel }: StyleEditorProps) {
  // State is initialized from props; the parent uses key={style?.id ?? '__new__'} to remount
  // this component whenever the selected style changes, so no sync effect is needed.
  const [form, setForm] = useState<Style>(style ?? EMPTY_STYLE);

  if (!style && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-[var(--text-fs-2)] text-[var(--text-muted)]">
        Select a style to edit, or create a new one.
      </div>
    );
  }

  const set = <K extends keyof Style>(key: K, value: Style[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = () => {
    if (!form.id.trim()) return;
    onSave(form);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2 shrink-0">
        <h2 className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em] flex-1">
          {isNew ? "New Style" : "Edit Style"}
        </h2>
        <button
          onClick={onCancel}
          className="text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors px-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ID */}
        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">ID</label>
          <input
            type="text"
            value={form.id}
            onChange={(e) => set("id", e.target.value)}
            disabled={!isNew}
            placeholder="my-style"
            className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-colors duration-[120ms] ease-[var(--ease-out-soft)] disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Font */}
        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Font</label>
          <select
            value={form.font}
            onChange={(e) => set("font", e.target.value)}
            className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-colors duration-[120ms] ease-[var(--ease-out-soft)]"
          >
            <option value="">-- select font --</option>
            {fonts.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id} ({f.family})
              </option>
            ))}
          </select>
        </div>

        {/* Size */}
        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Size (px)</label>
          <input
            type="number"
            value={form.size}
            onChange={(e) => set("size", parseInt(e.target.value, 10) || 0)}
            className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-colors duration-[120ms] ease-[var(--ease-out-soft)]"
          />
        </div>

        {/* Color */}
        <ColorField label="Color" value={form.color} onChange={(v) => set("color", v)} />

        {/* Outline */}
        <div className="grid grid-cols-2 gap-3">
          <ColorField
            label="Outline Color"
            value={form.outline_color}
            onChange={(v) => set("outline_color", v)}
          />
          <NumberField
            label="Outline (px)"
            value={form.outline}
            onChange={(v) => set("outline", v)}
          />
        </div>

        {/* Shadow */}
        <div className="grid grid-cols-2 gap-3">
          <ColorField
            label="Shadow Color"
            value={form.shadow_color}
            onChange={(v) => set("shadow_color", v)}
          />
          <NumberField
            label="Shadow (px)"
            value={form.shadow}
            onChange={(v) => set("shadow", v)}
          />
        </div>

        {/* Text background */}
        <ColorField
          label="Text Background"
          value={form.text_bg}
          onChange={(v) => set("text_bg", v)}
        />

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Text BG Padding"
            value={form.text_bg_pad}
            onChange={(v) => set("text_bg_pad", v)}
          />
          <NumberField
            label="Text BG Radius"
            value={form.text_bg_radius}
            onChange={(v) => set("text_bg_radius", v)}
          />
        </div>

        {/* Align */}
        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Align</label>
          <select
            value={form.align ?? "center"}
            onChange={(e) => set("align", e.target.value)}
            className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)] transition-colors duration-[120ms] ease-[var(--ease-out-soft)]"
          >
            <option value="left">Left</option>
            <option value="center">Center</option>
            <option value="right">Right</option>
          </select>
        </div>

        {/* Line height */}
        <NumberField
          label="Line Height"
          value={form.line_height}
          onChange={(v) => set("line_height", v)}
          placeholder="auto"
        />
      </div>

      {/* Actions */}
      <ActionsFooter
        canSave={Boolean(form.id.trim())}
        onSave={handleSave}
        onSaveLibrary={async () => {
          if (!form.id.trim()) return;
          try {
            await useLibraryStore.getState().saveStylePreset(form);
            toast.success(`“${form.id}” saved to library`);
          } catch (err) {
            toast.error(err instanceof Error ? err.message : "Failed to save to library");
          }
        }}
        isNew={isNew}
        onDelete={() => onDelete(form.id)}
      />
    </div>
  );
}

function ActionsFooter({
  canSave,
  onSave,
  onSaveLibrary,
  isNew,
  onDelete,
}: {
  canSave: boolean;
  onSave: () => void;
  onSaveLibrary: () => void;
  isNew: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="px-4 py-3 border-t border-[var(--border)] flex items-center gap-2 shrink-0">
      <Button
        variant="primary"
        size="md"
        fullWidth
        disabled={!canSave}
        onClick={onSave}
        data-testid="style-save"
      >
        Save
      </Button>
      <Button
        variant="ghost"
        size="md"
        disabled={!canSave}
        onClick={onSaveLibrary}
        data-testid="style-save-library"
        title="Save this style to your shared library"
      >
        ★ Library
      </Button>
      {!isNew && (
        <Button variant="danger" size="md" onClick={onDelete} data-testid="style-delete">
          Delete
        </Button>
      )}
    </div>
  );
}
