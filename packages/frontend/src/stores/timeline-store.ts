import { create } from "zustand";
import type { Segment, SegmentUpdates } from "@verseline/shared";
import { api } from "@/lib/api";

interface TimelineState {
  segments: Segment[];
  loading: boolean;
  dirty: boolean;
  timelineKind: "draft" | "approved";

  loadSegments: (projectId: string, kind?: "draft" | "approved") => Promise<void>;
  updateSegment: (segId: string, updates: SegmentUpdates) => Promise<void>;
  splitSegment: (segId: string, blockIndex: number, texts: string[]) => Promise<void>;
  deleteSegment: (segId: string) => Promise<void>;
  createSegment: (projectId: string, data: Partial<Segment>) => Promise<void>;
  approveTimeline: (projectId: string) => Promise<void>;
}

// Store project ID alongside so actions can reference it without needing it passed again
let _projectId: string | null = null;

export const useTimelineStore = create<TimelineState>((set, get) => ({
  segments: [],
  loading: false,
  dirty: false,
  timelineKind: "draft",

  async loadSegments(projectId, kind = "draft") {
    _projectId = projectId;
    set({ loading: true, timelineKind: kind });
    try {
      const segs = await api.segments.list(projectId, kind);
      set({ segments: segs, loading: false, dirty: false });
    } catch (err) {
      set({ loading: false });
      throw err;
    }
  },

  async updateSegment(segId, updates) {
    if (!_projectId) throw new Error("No project loaded");
    const updated = await api.segments.update(_projectId, segId, updates);
    set((state) => ({
      segments: state.segments.map((s) => (s.id === segId ? updated : s)),
      dirty: true,
    }));
  },

  async splitSegment(segId, blockIndex, texts) {
    if (!_projectId) throw new Error("No project loaded");
    const newSegs = await api.segments.split(_projectId, segId, { blockIndex, texts });
    set((state) => {
      const idx = state.segments.findIndex((s) => s.id === segId);
      if (idx < 0) return { segments: [...state.segments, ...newSegs], dirty: true };
      const next = [
        ...state.segments.slice(0, idx),
        ...newSegs,
        ...state.segments.slice(idx + 1),
      ];
      return { segments: next, dirty: true };
    });
  },

  async deleteSegment(segId) {
    if (!_projectId) throw new Error("No project loaded");
    await api.segments.delete(_projectId, segId);
    set((state) => ({
      segments: state.segments.filter((s) => s.id !== segId),
      dirty: true,
    }));
  },

  async createSegment(projectId, data) {
    _projectId = projectId;
    const seg = await api.segments.create(projectId, data);
    set((state) => ({ segments: [...state.segments, seg], dirty: true }));
  },

  async approveTimeline(projectId) {
    _projectId = projectId;
    set({ loading: true });
    await api.segments.approve(projectId);
    const segs = await api.segments.list(projectId, "approved");
    set({ segments: segs, timelineKind: "approved", loading: false, dirty: false });
  },
}));
