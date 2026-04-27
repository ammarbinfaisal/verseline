"use client";

import { useState, useRef, useCallback } from "react";
import { usePexelsStore } from "@/stores/pexels-store";
import { useMountEffect } from "@/hooks/useMountEffect";
import { Button, Input, Spinner, Tabs, EmptyState } from "@/components/ui";

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
    <div className="flex flex-col gap-4" data-testid="pexels-search">
      {/* Search input + tabs */}
      <div className="flex gap-2">
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search Pexels…"
          fullWidth
        />
        <Tabs
          variant="pill"
          tabs={[
            { id: "photo" as const, label: "Photos" },
            { id: "video" as const, label: "Videos" },
          ]}
          active={searchType}
          onChange={(id) => {
            setSearchType(id);
            if (searchQuery.trim()) search(searchQuery, 1);
          }}
        />
        {searchQuery.trim() && (
          <Button
            size="md"
            variant="ghost"
            onClick={handleSaveSearch}
            title="Save this search"
          >
            Save
          </Button>
        )}
      </div>

      {savedSearches.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {savedSearches.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1 bg-[var(--surface-1)] border border-[var(--border)] rounded-sm px-2 py-1"
            >
              <button
                onClick={() => {
                  setSearchQuery(s.query);
                  setSearchType(s.searchType as "photo" | "video");
                  search(s.query, 1);
                }}
                className="text-[var(--text-fs-1)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-sm px-1"
              >
                {s.query}
              </button>
              <button
                onClick={() => deleteSavedSearch(s.id)}
                aria-label={`Remove saved search ${s.query}`}
                className="text-[var(--text-fs-1)] text-[var(--text-faint)] hover:text-[var(--error)] transition-colors px-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {loading && (
        <div className="text-[var(--text-fs-2)] text-[var(--text-muted)] py-4 text-center flex items-center justify-center gap-2">
          <Spinner size={12} /> Searching
        </div>
      )}

      {!loading && results.length > 0 && (
        <>
          <p className="text-[var(--text-fs-1)] text-[var(--text-muted)]">
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
                      className="group relative rounded-md overflow-hidden bg-[var(--surface-2)]"
                    >
                      <img
                        src={photo.src.medium}
                        alt={photo.alt}
                        className="w-full aspect-video object-cover"
                        loading="lazy"
                      />
                      <div
                        className="absolute inset-0 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100"
                        style={{
                          background:
                            "color-mix(in srgb, var(--canvas-frame) 50%, transparent)",
                        }}
                      >
                        <span
                          className="text-[var(--text-fs-1)] truncate"
                          style={{ color: "rgba(255,255,255,0.85)" }}
                        >
                          {photo.photographer}
                        </span>
                        {inLibrary ? (
                          <span
                            className="text-[var(--text-fs-1)] px-2 py-0.5 rounded-sm font-medium"
                            style={{ background: "var(--success)", color: "#FFFFFF" }}
                          >
                            In library
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
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
                            loading={saving}
                          >
                            {saving ? "" : "Save"}
                          </Button>
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
                      className="group relative rounded-md overflow-hidden bg-[var(--surface-2)]"
                    >
                      <img
                        src={video.image}
                        alt={`Video ${video.id}`}
                        className="w-full aspect-video object-cover"
                        loading="lazy"
                      />
                      <div className="absolute top-2 left-2">
                        <span
                          className="text-[var(--text-fs-1)] px-1.5 py-0.5 rounded-sm font-mono"
                          style={{
                            background:
                              "color-mix(in srgb, var(--canvas-frame) 60%, transparent)",
                            color: "#FFFFFF",
                          }}
                        >
                          {Math.floor(video.duration / 60)}:
                          {String(video.duration % 60).padStart(2, "0")}
                        </span>
                      </div>
                      <div
                        className="absolute inset-0 transition-colors flex items-end justify-between p-2 opacity-0 group-hover:opacity-100"
                        style={{
                          background:
                            "color-mix(in srgb, var(--canvas-frame) 50%, transparent)",
                        }}
                      >
                        <span
                          className="text-[var(--text-fs-1)] truncate"
                          style={{ color: "rgba(255,255,255,0.85)" }}
                        >
                          {video.user.name}
                        </span>
                        {inLibrary ? (
                          <span
                            className="text-[var(--text-fs-1)] px-2 py-0.5 rounded-sm font-medium"
                            style={{ background: "var(--success)", color: "#FFFFFF" }}
                          >
                            In library
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="primary"
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
                            loading={saving}
                          >
                            {saving ? "" : "Save"}
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
          </div>

          {hasMore && (
            <Button
              variant="ghost"
              onClick={() => search(searchQuery, page + 1)}
              disabled={loading}
              className="mx-auto"
            >
              Load more
            </Button>
          )}
        </>
      )}

      {!loading && searchQuery.trim() && results.length === 0 && (
        <EmptyState
          title={`No ${searchType}s found`}
          body={`Nothing on Pexels for “${searchQuery}”. Try a different query.`}
        />
      )}
    </div>
  );
}
