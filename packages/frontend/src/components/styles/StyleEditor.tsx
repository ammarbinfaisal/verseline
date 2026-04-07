"use client";

import { useState, useEffect } from "react";
import type { Style, Font } from "@verseline/shared";

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
      <label className="text-xs text-zinc-500 dark:text-zinc-400">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-zinc-300 dark:border-zinc-700 bg-transparent p-0.5"
        />
        <input
          type="text"
          value={display}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#ffffff"
          className="flex-1 min-w-0 bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 font-mono focus:outline-none focus:border-blue-500 transition-colors"
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
      <label className="text-xs text-zinc-500 dark:text-zinc-400">{label}</label>
      <input
        type="number"
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? undefined : parseInt(v, 10));
        }}
        placeholder={placeholder ?? "0"}
        className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
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
  const [form, setForm] = useState<Style>(style ?? EMPTY_STYLE);

  useEffect(() => {
    setForm(style ?? EMPTY_STYLE);
  }, [style]);

  if (!style && !isNew) {
    return (
      <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-sm">
        Select a style to edit
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
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest flex-1">
          {isNew ? "New Style" : "Edit Style"}
        </h2>
        <button
          onClick={onCancel}
          className="text-xs text-zinc-600 dark:text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300 transition-colors"
        >
          Cancel
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {/* ID */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">ID</label>
          <input
            type="text"
            value={form.id}
            onChange={(e) => set("id", e.target.value)}
            disabled={!isNew}
            placeholder="my-style"
            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        {/* Font */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Font</label>
          <select
            value={form.font}
            onChange={(e) => set("font", e.target.value)}
            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
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
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Size (px)</label>
          <input
            type="number"
            value={form.size}
            onChange={(e) => set("size", parseInt(e.target.value, 10) || 0)}
            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
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
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Align</label>
          <select
            value={form.align ?? "center"}
            onChange={(e) => set("align", e.target.value)}
            className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-800 dark:text-zinc-200 focus:outline-none focus:border-blue-500 transition-colors"
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
      <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={!form.id.trim()}
          className="flex-1 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors"
        >
          Save
        </button>
        {!isNew && (
          <button
            onClick={() => onDelete(form.id)}
            className="py-2 px-4 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-500 dark:hover:text-red-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg transition-colors"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
