"use client";

import { create } from "zustand";
import { api, type LibraryAsset } from "@/lib/api";
import type { Style, Placement, Font, PresetRecord } from "@verseline/shared";
import { presetLibrary } from "@/lib/preset-library";

const MIGRATION_FLAG = "verseline.preset-library.migrated.v1";

interface LibraryState {
  assets: LibraryAsset[];
  total: number;
  loading: boolean;
  filter: { type?: string; q?: string; page?: number };

  loadAssets: (filter?: { type?: string; q?: string; page?: number }) => Promise<void>;
  createAsset: (data: Parameters<typeof api.library.confirm>[0]) => Promise<LibraryAsset>;
  updateAsset: (id: string, data: { name?: string; metadata?: Record<string, unknown> }) => Promise<void>;
  deleteAsset: (id: string) => Promise<void>;
  linkToProject: (assetId: string, projectId: string) => Promise<void>;
  unlinkFromProject: (assetId: string, projectId: string) => Promise<void>;

  // Preset library — server-backed (V2.2). Cache in store; sync getters return
  // the cached payloads, async loaders hydrate from `/presets`. localStorage
  // is kept as an offline fallback and migrated to server on first auth load.
  presetRecords: PresetRecord[];
  presetsLoaded: boolean;
  loadPresets: () => Promise<void>;
  saveStylePreset: (style: Style) => Promise<void>;
  saveFontPreset: (font: Font) => Promise<void>;
  savePlacementPreset: (placement: Placement) => Promise<void>;
  listStylePresets: () => Style[];
  listPlacementPresets: () => Placement[];
  listFontPresets: () => Font[];
  deleteStylePreset: (id: string) => Promise<void>;
  deletePlacementPreset: (id: string) => Promise<void>;
  deleteFontPreset: (id: string) => Promise<void>;
}

/**
 * One-shot migration of any existing localStorage preset entries to the server.
 * Runs at most once per browser per user. Idempotent on the server side because
 * the unique index on (user, kind, payload->>'id') turns repeated POSTs into
 * upserts.
 */
async function migrateLocalToServerOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (window.localStorage.getItem(MIGRATION_FLAG) === "true") return;

  const styles = presetLibrary.listStyles();
  const placements = presetLibrary.listPlacements();
  const fonts = presetLibrary.listFonts();

  try {
    for (const s of styles) {
      // Strip the local __savedAt metadata before sending
      const { /* eslint-disable-next-line @typescript-eslint/no-unused-vars */ __savedAt, ...payload } = s;
      await api.presets.upsert("style", payload as Style);
    }
    for (const p of placements) {
      const { /* eslint-disable-next-line @typescript-eslint/no-unused-vars */ __savedAt, ...payload } = p;
      await api.presets.upsert("placement", payload as Placement);
    }
    for (const f of fonts) {
      const { /* eslint-disable-next-line @typescript-eslint/no-unused-vars */ __savedAt, ...payload } = f;
      await api.presets.upsert("font", payload as Font);
    }
    window.localStorage.setItem(MIGRATION_FLAG, "true");
  } catch (err) {
    // If the server is unreachable, leave the flag unset so we retry next load.
    console.warn("[library-store] preset migration deferred:", err);
  }
}

function recordsToPayloads<T>(records: PresetRecord[], kind: PresetRecord["kind"]): T[] {
  return records
    .filter((r) => r.kind === kind)
    .map((r) => r.payload as unknown as T);
}

export const useLibraryStore = create<LibraryState>((set, get) => ({
  assets: [],
  total: 0,
  loading: false,
  filter: {},

  async loadAssets(filter) {
    set({ loading: true, filter: filter ?? get().filter });
    try {
      const res = await api.library.list(filter ?? get().filter);
      set({ assets: res.assets, total: res.total, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async createAsset(data) {
    const res = await api.library.confirm(data);
    set((s) => ({ assets: [res.asset, ...s.assets], total: s.total + 1 }));
    return res.asset;
  },

  async updateAsset(id, data) {
    const res = await api.library.update(id, data);
    set((s) => ({ assets: s.assets.map((a) => (a.id === id ? res.asset : a)) }));
  },

  async deleteAsset(id) {
    await api.library.delete(id);
    set((s) => ({ assets: s.assets.filter((a) => a.id !== id), total: s.total - 1 }));
  },

  async linkToProject(assetId, projectId) {
    await api.library.linkToProject(assetId, projectId);
  },

  async unlinkFromProject(assetId, projectId) {
    await api.library.unlinkFromProject(assetId, projectId);
  },

  // ---- Preset library (server-backed) ----

  presetRecords: [],
  presetsLoaded: false,

  async loadPresets() {
    await migrateLocalToServerOnce();
    try {
      const records = await api.presets.list();
      set({ presetRecords: records, presetsLoaded: true });
    } catch (err) {
      // Fallback to localStorage so the picker still works offline.
      console.warn("[library-store] preset list failed; using local cache:", err);
      const local: PresetRecord[] = [
        ...presetLibrary.listStyles().map((s) => ({
          id: s.id,
          userId: null,
          kind: "style" as const,
          payload: s,
          builtIn: false,
          createdAt: "",
          updatedAt: "",
        })),
        ...presetLibrary.listPlacements().map((p) => ({
          id: p.id,
          userId: null,
          kind: "placement" as const,
          payload: p,
          builtIn: false,
          createdAt: "",
          updatedAt: "",
        })),
        ...presetLibrary.listFonts().map((f) => ({
          id: f.id,
          userId: null,
          kind: "font" as const,
          payload: f,
          builtIn: false,
          createdAt: "",
          updatedAt: "",
        })),
      ];
      set({ presetRecords: local, presetsLoaded: true });
    }
  },

  async saveStylePreset(style) {
    presetLibrary.saveStyle(style); // local fallback
    try {
      const record = await api.presets.upsert("style", style);
      set((s) => ({
        presetRecords: [
          record,
          ...s.presetRecords.filter(
            (r) => !(r.kind === "style" && (r.payload as Style).id === style.id),
          ),
        ],
      }));
    } catch (err) {
      console.warn("[library-store] saveStylePreset offline:", err);
    }
  },

  async saveFontPreset(font) {
    presetLibrary.saveFont(font);
    try {
      const record = await api.presets.upsert("font", font);
      set((s) => ({
        presetRecords: [
          record,
          ...s.presetRecords.filter(
            (r) => !(r.kind === "font" && (r.payload as Font).id === font.id),
          ),
        ],
      }));
    } catch (err) {
      console.warn("[library-store] saveFontPreset offline:", err);
    }
  },

  async savePlacementPreset(placement) {
    presetLibrary.savePlacement(placement);
    try {
      const record = await api.presets.upsert("placement", placement);
      set((s) => ({
        presetRecords: [
          record,
          ...s.presetRecords.filter(
            (r) => !(r.kind === "placement" && (r.payload as Placement).id === placement.id),
          ),
        ],
      }));
    } catch (err) {
      console.warn("[library-store] savePlacementPreset offline:", err);
    }
  },

  listStylePresets: () => recordsToPayloads<Style>(get().presetRecords, "style"),
  listPlacementPresets: () => recordsToPayloads<Placement>(get().presetRecords, "placement"),
  listFontPresets: () => recordsToPayloads<Font>(get().presetRecords, "font"),

  async deleteStylePreset(id) {
    presetLibrary.deleteStyle(id);
    const target = get().presetRecords.find(
      (r) => r.kind === "style" && (r.payload as Style).id === id,
    );
    if (target && !target.builtIn) {
      try {
        await api.presets.delete(target.id);
      } catch (err) {
        console.warn("[library-store] deleteStylePreset failed:", err);
      }
    }
    set((s) => ({ presetRecords: s.presetRecords.filter((r) => r !== target) }));
  },

  async deletePlacementPreset(id) {
    presetLibrary.deletePlacement(id);
    const target = get().presetRecords.find(
      (r) => r.kind === "placement" && (r.payload as Placement).id === id,
    );
    if (target && !target.builtIn) {
      try {
        await api.presets.delete(target.id);
      } catch (err) {
        console.warn("[library-store] deletePlacementPreset failed:", err);
      }
    }
    set((s) => ({ presetRecords: s.presetRecords.filter((r) => r !== target) }));
  },

  async deleteFontPreset(id) {
    presetLibrary.deleteFont(id);
    const target = get().presetRecords.find(
      (r) => r.kind === "font" && (r.payload as Font).id === id,
    );
    if (target && !target.builtIn) {
      try {
        await api.presets.delete(target.id);
      } catch (err) {
        console.warn("[library-store] deleteFontPreset failed:", err);
      }
    }
    set((s) => ({ presetRecords: s.presetRecords.filter((r) => r !== target) }));
  },
}));
