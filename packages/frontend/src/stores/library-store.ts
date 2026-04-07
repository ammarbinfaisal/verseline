"use client";

import { create } from "zustand";
import { api, type LibraryAsset } from "@/lib/api";

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
}));
