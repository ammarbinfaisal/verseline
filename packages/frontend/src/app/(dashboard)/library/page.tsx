"use client";

import { useState, useCallback } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useLibraryStore } from "@/stores/library-store";
import LibraryAssetCard from "@/components/library/LibraryAssetCard";
import LibraryUploader from "@/components/library/LibraryUploader";
import PexelsSearch from "@/components/library/PexelsSearch";

const ASSET_TYPE_TABS = [
  { value: "", label: "All" },
  { value: "background", label: "Backgrounds" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "audio", label: "Audio" },
  { value: "font", label: "Fonts" },
  { value: "style", label: "Styles" },
] as const;

type ViewTab = "library" | "pexels";

export default function LibraryPage() {
  const { assets, total, loading, filter, loadAssets, deleteAsset } =
    useLibraryStore();
  const [viewTab, setViewTab] = useState<ViewTab>("library");
  const [showUploader, setShowUploader] = useState(false);

  useMountEffect(() => {
    loadAssets();
  });

  const handleTypeFilter = useCallback(
    (type: string) => {
      loadAssets({ ...filter, type: type || undefined, page: 1 });
    },
    [filter, loadAssets],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm("Delete this asset from your library?")) return;
      await deleteAsset(id);
    },
    [deleteAsset],
  );

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-white">
          Library
        </h1>
        <button
          onClick={() => setShowUploader((s) => !s)}
          className="px-4 py-2 rounded-lg bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-colors border border-zinc-300 dark:border-zinc-700"
        >
          {showUploader ? "Hide Uploader" : "Upload Asset"}
        </button>
      </div>

      {/* Uploader */}
      {showUploader && (
        <div className="mb-6">
          <LibraryUploader
            onUploaded={() => {
              setShowUploader(false);
              loadAssets();
            }}
          />
        </div>
      )}

      {/* View tabs: Library / Pexels */}
      <div className="flex items-center gap-4 mb-6 border-b border-zinc-200 dark:border-zinc-800">
        <button
          onClick={() => setViewTab("library")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            viewTab === "library"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          My Library
        </button>
        <button
          onClick={() => setViewTab("pexels")}
          className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
            viewTab === "pexels"
              ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
          }`}
        >
          Pexels
        </button>
      </div>

      {viewTab === "pexels" ? (
        <PexelsSearch />
      ) : (
        <>
          {/* Type filter tabs */}
          <div className="flex flex-wrap gap-2 mb-6">
            {ASSET_TYPE_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => handleTypeFilter(tab.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  (filter.type ?? "") === tab.value
                    ? "bg-indigo-600 text-white"
                    : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white border border-zinc-200 dark:border-zinc-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Loading */}
          {loading && (
            <div className="text-zinc-500 text-sm py-8 text-center">
              Loading...
            </div>
          )}

          {/* Empty state */}
          {!loading && assets.length === 0 && (
            <div className="text-center py-20">
              <p className="text-zinc-500 text-sm mb-4">
                No assets in your library yet.
              </p>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={() => setShowUploader(true)}
                  className="px-4 py-2 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-sm hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors border border-zinc-300 dark:border-zinc-700"
                >
                  Upload an asset
                </button>
                <button
                  onClick={() => setViewTab("pexels")}
                  className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium text-sm hover:bg-indigo-500 transition-colors"
                >
                  Browse Pexels
                </button>
              </div>
            </div>
          )}

          {/* Asset grid */}
          {!loading && assets.length > 0 && (
            <>
              <p className="text-xs text-zinc-500 mb-4">
                {total} asset{total !== 1 ? "s" : ""}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {assets.map((asset) => (
                  <LibraryAssetCard
                    key={asset.id}
                    asset={asset}
                    proxyUrl={
                      asset.r2Key
                        ? `${API_BASE}/library/${asset.id}/proxy`
                        : asset.pexelsUrl ?? undefined
                    }
                    onDelete={() => handleDelete(asset.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
