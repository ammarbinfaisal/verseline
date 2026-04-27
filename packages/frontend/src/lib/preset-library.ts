/**
 * Client-side preset library — stores reusable Style/Placement/Font presets in
 * localStorage. v1 is local-only; v2 will sync to a server table without
 * changing the call-site API.
 *
 * See /design.md §8 (shared library tiers).
 */

import type { Style, Placement, Font } from "@verseline/shared";

type PresetKind = "style" | "placement" | "font";
type PresetEntry<T> = T & { __savedAt: number };

const KEYS: Record<PresetKind, string> = {
  style:     "verseline.preset-library.style.v1",
  placement: "verseline.preset-library.placement.v1",
  font:      "verseline.preset-library.font.v1",
};

function read<T>(kind: PresetKind): PresetEntry<T>[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEYS[kind]);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function write<T>(kind: PresetKind, entries: PresetEntry<T>[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEYS[kind], JSON.stringify(entries));
}

function upsertById<T extends { id: string }>(
  kind: PresetKind,
  item: T,
): PresetEntry<T>[] {
  const existing = read<T>(kind);
  const filtered = existing.filter((e) => e.id !== item.id);
  const next = [{ ...item, __savedAt: Date.now() } as PresetEntry<T>, ...filtered];
  write(kind, next);
  return next;
}

export const presetLibrary = {
  // Styles
  listStyles: () => read<Style>("style"),
  saveStyle: (s: Style) => upsertById<Style>("style", s),
  deleteStyle: (id: string) => {
    const next = read<Style>("style").filter((e) => e.id !== id);
    write("style", next);
    return next;
  },

  // Placements
  listPlacements: () => read<Placement>("placement"),
  savePlacement: (p: Placement) => upsertById<Placement>("placement", p),
  deletePlacement: (id: string) => {
    const next = read<Placement>("placement").filter((e) => e.id !== id);
    write("placement", next);
    return next;
  },

  // Fonts
  listFonts: () => read<Font>("font"),
  saveFont: (f: Font) => upsertById<Font>("font", f),
  deleteFont: (id: string) => {
    const next = read<Font>("font").filter((e) => e.id !== id);
    write("font", next);
    return next;
  },
};

export type { PresetEntry };
