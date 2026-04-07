"use client";

import { create } from "zustand";
import { api, type PexelsPhoto, type PexelsVideo, type SavedSearch } from "@/lib/api";

interface PexelsState {
  photos: PexelsPhoto[];
  videos: PexelsVideo[];
  savedSearches: SavedSearch[];
  searchQuery: string;
  searchType: "photo" | "video";
  totalResults: number;
  page: number;
  loading: boolean;
  libraryIds: Record<string, string>;

  setSearchQuery: (q: string) => void;
  setSearchType: (t: "photo" | "video") => void;
  search: (query?: string, page?: number) => Promise<void>;
  saveToLibrary: (pexelsId: string, url: string, type: "photo" | "video", name?: string, photographer?: string) => Promise<void>;
  loadSavedSearches: () => Promise<void>;
  saveSearch: (query: string, searchType: string, resultCount?: number) => Promise<void>;
  deleteSavedSearch: (id: string) => Promise<void>;
}

export const usePexelsStore = create<PexelsState>((set, get) => ({
  photos: [],
  videos: [],
  savedSearches: [],
  searchQuery: "",
  searchType: "photo",
  totalResults: 0,
  page: 1,
  loading: false,
  libraryIds: {},

  setSearchQuery: (q) => set({ searchQuery: q }),
  setSearchType: (t) => set({ searchType: t }),

  async search(query, page) {
    const q = query ?? get().searchQuery;
    const p = page ?? 1;
    if (!q.trim()) return;
    set({ loading: true, page: p });
    try {
      if (get().searchType === "photo") {
        const res = await api.pexels.searchPhotos(q, p);
        set({ photos: res.photos, totalResults: res.totalResults, libraryIds: { ...get().libraryIds, ...res.libraryIds }, loading: false });
      } else {
        const res = await api.pexels.searchVideos(q, p);
        set({ videos: res.videos, totalResults: res.totalResults, libraryIds: { ...get().libraryIds, ...res.libraryIds }, loading: false });
      }
    } catch {
      set({ loading: false });
    }
  },

  async saveToLibrary(pexelsId, url, type, name, photographer) {
    const res = await api.pexels.saveToLibrary({ pexelsId, url, type, name, photographer });
    set((s) => ({ libraryIds: { ...s.libraryIds, [pexelsId]: res.asset.id } }));
  },

  async loadSavedSearches() {
    const res = await api.pexels.listSearches();
    set({ savedSearches: res.searches });
  },

  async saveSearch(query, searchType, resultCount) {
    const res = await api.pexels.saveSearch({ query, searchType, resultCount });
    set((s) => ({ savedSearches: [res.search, ...s.savedSearches] }));
  },

  async deleteSavedSearch(id) {
    await api.pexels.deleteSearch(id);
    set((s) => ({ savedSearches: s.savedSearches.filter((s2) => s2.id !== id) }));
  },
}));
