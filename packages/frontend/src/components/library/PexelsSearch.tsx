"use client";

import { useState, useRef, useCallback } from "react";
import { usePexelsStore } from "@/stores/pexels-store";
import { useMountEffect } from "@/hooks/useMountEffect";

export default function PexelsSearch() {
  const {
    photos,
    videos,
    savedSearches,
    searchQuery,
    searchType,
    totalResults,
    page,
    loading,
    libraryIds,
    setSearchQuery,
    setSearchType,
    search,
    saveToLibrary,
    loadSavedSearches,
    saveSearch,
    deleteSavedSearch,
  } = usePexelsStore();

  const [savingIds, setSavingIds] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useMountEffect(() => {
    loadSavedSearches();
  });

  const handleInputChange = useCallback(
    (value: string) => {
      setSearchQuery(value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        if (value.trim()) search(value);
      }, 500);
    },
    [setSearchQuery, search],
  );

  const handleSaveToLibrary = useCallback(
    async (
      pexelsId: number,
      url: string,
      type: "photo" | "video",
      name?: string,
      photographer?: string,
    ) => {
      const key = String(pexelsId);
      setSavingIds((s) => new Set(s).add(key));
      try {
        await saveToLibrary(key, url, type, name, photographer);
      } finally {
        setSavingIds((s) => {
          const next = new Set(s);
          next.delete(key);
          return next;
        });
      }
    },
    [saveToLibrary],
  );

  const handleSaveSearch = useCallback(() => {
    if (searchQuery.trim()) {
      saveSearch(searchQuery.trim(), searchType, totalResults);
    }
  }, [searchQuery, searchType, totalResults, saveSearch]);

  const results = searchType === "photo" ? photos : videos;
  const hasMore = results.length > 0 && results.length < totalResults;

  return (
    <div className="flex flex-col gap-4">
      {/* Search input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search Pexels..."
          className="flex-1 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <div className="flex rounded-lg border border-zinc-300 dark:border-zinc-700 overflow-hidden">
          <button
            onClick={() => {
              setSearchType("photo");
              if (searchQuery.trim()) search(searchQuery, 1);
            }}
            className={`px-3 py-2 text-xs transition-colors ${
              searchType === "photo"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Photos
          </button>
          <button
            onClick={() => {
              setSearchType("video");
              if (searchQuery.trim()) search(searchQuery, 1);
            }}
            className={`px-3 py-2 text-xs transition-colors ${
              searchType === "video"
                ? "bg-indigo-600 text-white"
                : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            }`}
          >
            Videos
          </button>
        </div>
        {searchQuery.trim() && (
          <button
            onClick={handleSaveSearch}
            title="Save this search"
            className="px-3 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700 rounded-lg text-xs hover:text-zinc-900 dark:hover:text-white transition-colors"
          >
            Save
          </button>
        )}
      </div>

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedSearches.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-full px-3 py-1"
            >
              <button
                onClick={() => {
                  setSearchQuery(s.query);
                  setSearchType(s.searchType as "photo" | "video");
                  search(s.query, 1);
                }}
                className="text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white"
              >
                {s.query}
              </button>
              <button
                onClick={() => deleteSavedSearch(s.id)}
                className="text-xs text-zinc-400 hover:text-red-400 ml-1"
              >
                x
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-sm text-zinc-500 py-4 text-center">Searching...</div>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <>
          <p className="text-xs text-zinc-500">
            {totalResults.toLocaleString()} results
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {searchType === "photo"
              ? photos.map((photo) => {
                  const inLibrary = !!libraryIds[String(photo.id)];
                  const saving = savingIds.has(String(photo.id));
                  return (
                    <div
                      key={photo.id}
                      className="group relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800"
                    >
                      <img
                        src={photo.src.medium}
                        alt={photo.alt}
                        className="w-full aspect-video object-cover"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                        <span className="text-[10px] text-white/80 truncate">
                          {photo.photographer}
                        </span>
                        {inLibrary ? (
                          <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded">
                            In Library
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              handleSaveToLibrary(
                                photo.id,
                                photo.src.original,
                                "photo",
                                photo.alt || `Pexels ${photo.id}`,
                                photo.photographer,
                              )
                            }
                            disabled={saving}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded disabled:opacity-50"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              : videos.map((video) => {
                  const inLibrary = !!libraryIds[String(video.id)];
                  const saving = savingIds.has(String(video.id));
                  const bestFile =
                    video.video_files.find((f) => f.quality === "hd") ??
                    video.video_files[0];
                  return (
                    <div
                      key={video.id}
                      className="group relative rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800"
                    >
                      <img
                        src={video.image}
                        alt={`Video ${video.id}`}
                        className="w-full aspect-video object-cover"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2">
                        <span className="text-[10px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                          {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100">
                        <span className="text-[10px] text-white/80 truncate">
                          {video.user.name}
                        </span>
                        {inLibrary ? (
                          <span className="text-[10px] bg-green-600 text-white px-2 py-0.5 rounded">
                            In Library
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              handleSaveToLibrary(
                                video.id,
                                bestFile?.link ?? video.url,
                                "video",
                                `Pexels Video ${video.id}`,
                                video.user.name,
                              )
                            }
                            disabled={saving}
                            className="text-[10px] bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-0.5 rounded disabled:opacity-50"
                          >
                            {saving ? "Saving..." : "Save"}
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => search(searchQuery, page + 1)}
              disabled={loading}
              className="mx-auto px-4 py-2 bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              Load more
            </button>
          )}
        </>
      )}

      {/* Empty state */}
      {!loading && searchQuery.trim() && results.length === 0 && (
        <p className="text-sm text-zinc-500 py-8 text-center">
          No {searchType}s found for &ldquo;{searchQuery}&rdquo;
        </p>
      )}
    </div>
  );
}
