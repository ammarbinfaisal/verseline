import { create } from "zustand";
import type { Project, Style, Placement, Font } from "@verseline/shared";
import { api } from "@/lib/api";

interface ProjectState {
  project: (Project & { id: string }) | null;
  loading: boolean;
  dirty: boolean;

  loadProject: (id: string) => Promise<void>;
  saveProject: () => Promise<void>;
  updateField: (path: string, value: unknown) => void;
  upsertStyle: (style: Style) => void;
  removeStyle: (id: string) => void;
  upsertPlacement: (placement: Placement) => void;
  removePlacement: (id: string) => void;
  upsertFont: (font: Font) => void;
  removeFont: (id: string) => void;
}

function setNestedPath(obj: Record<string, unknown>, path: string, value: unknown): Record<string, unknown> {
  const parts = path.split(".");
  const result = { ...obj };
  let cur: Record<string, unknown> = result;
  for (let i = 0; i < parts.length - 1; i++) {
    cur[parts[i]] = { ...(cur[parts[i]] as Record<string, unknown>) };
    cur = cur[parts[i]] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
  return result;
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  loading: false,
  dirty: false,

  async loadProject(id) {
    set({ loading: true });
    try {
      const record = await api.projects.get(id);
      set({ project: { ...record.data, id: record.id }, loading: false, dirty: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  async saveProject() {
    const { project } = get();
    if (!project) return;
    set({ loading: true });
    try {
      const { id, ...data } = project;
      const record = await api.projects.update(id, data as Project);
      set({ project: { ...record.data, id: record.id }, loading: false, dirty: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  updateField(path, value) {
    const { project } = get();
    if (!project) return;
    const updated = setNestedPath(project as unknown as Record<string, unknown>, path, value);
    set({ project: updated as unknown as (Project & { id: string }), dirty: true });
  },

  upsertStyle(style) {
    const { project } = get();
    if (!project) return;
    const styles = project.styles ?? [];
    const idx = styles.findIndex((s) => s.id === style.id);
    const next = idx >= 0
      ? styles.map((s, i) => (i === idx ? style : s))
      : [...styles, style];
    set({ project: { ...project, styles: next }, dirty: true });
  },

  removeStyle(id) {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, styles: (project.styles ?? []).filter((s) => s.id !== id) },
      dirty: true,
    });
  },

  upsertPlacement(placement) {
    const { project } = get();
    if (!project) return;
    const placements = project.placements ?? [];
    const idx = placements.findIndex((p) => p.id === placement.id);
    const next = idx >= 0
      ? placements.map((p, i) => (i === idx ? placement : p))
      : [...placements, placement];
    set({ project: { ...project, placements: next }, dirty: true });
  },

  removePlacement(id) {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, placements: (project.placements ?? []).filter((p) => p.id !== id) },
      dirty: true,
    });
  },

  upsertFont(font) {
    const { project } = get();
    if (!project) return;
    const fonts = project.fonts ?? [];
    const idx = fonts.findIndex((f) => f.id === font.id);
    const next = idx >= 0
      ? fonts.map((f, i) => (i === idx ? font : f))
      : [...fonts, font];
    set({ project: { ...project, fonts: next }, dirty: true });
  },

  removeFont(id) {
    const { project } = get();
    if (!project) return;
    set({
      project: { ...project, fonts: (project.fonts ?? []).filter((f) => f.id !== id) },
      dirty: true,
    });
  },
}));
