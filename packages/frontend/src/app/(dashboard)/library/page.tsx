"use client";

import { useState, useCallback } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { useLibraryStore } from "@/stores/library-store";
import LibraryAssetCard from "@/components/library/LibraryAssetCard";
import LibraryUploader from "@/components/library/LibraryUploader";
import PexelsSearch from "@/components/library/PexelsSearch";
import { Button, EmptyState, Modal, Tabs, toast } from "@/components/ui";

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
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  useMountEffect(() => {
    loadAssets();
  });

  const handleTypeFilter = useCallback(
    (type: string) => {
      loadAssets({ ...filter, type: type || undefined, page: 1 });
    },
    [filter, loadAssets],
  );

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    try {
      await deleteAsset(pendingDelete);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setPendingDelete(null);
    }
  };

  const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  return (
    <div className="max-w-6xl mx-auto px-8 py-12">
      <header className="flex items-end justify-between gap-6 mb-10 pb-6 border-b border-[var(--border)]">
        <div>
          <p className="text-[var(--text-fs-1)] uppercase tracking-[0.18em] text-[var(--text-muted)] font-mono mb-2">
            Workspace
          </p>
          <h1
            className="font-display text-[var(--text-fs-7)] text-[var(--text)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Library
          </h1>
        </div>
        <Button
          variant="ghost"
          onClick={() => setShowUploader((s) => !s)}
          data-testid="toggle-uploader"
        >
          {showUploader ? "Hide uploader" : "Upload asset"}
        </Button>
      </header>

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

      <Tabs
        variant="underline"
        className="mb-6 border-b border-[var(--border)]"
        tabs={[
          { id: "library" as const, label: "My library" },
          { id: "pexels" as const, label: "Pexels" },
        ]}
        active={viewTab}
        onChange={setViewTab}
      />

      {viewTab === "pexels" ? (
        <PexelsSearch />
      ) : (
        <>
          <div className="flex flex-wrap gap-2 mb-6">
            {ASSET_TYPE_TABS.map((tab) => {
              const active = (filter.type ?? "") === tab.value;
              return (
                <button
                  key={tab.value}
                  onClick={() => handleTypeFilter(tab.value)}
                  aria-pressed={active}
                  className={[
                    "px-3 py-1 rounded-sm text-[var(--text-fs-1)] font-medium transition-colors",
                    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
                    active
                      ? "bg-[var(--accent-cool)] text-[var(--text-on-accent)]"
                      : "bg-[var(--surface-1)] text-[var(--text-muted)] hover:text-[var(--text)] border border-[var(--border)] hover:border-[var(--border-strong)]",
                  ].join(" ")}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {loading && (
            <div className="text-[var(--text-fs-2)] text-[var(--text-muted)] py-8 text-center">
              Loading…
            </div>
          )}

          {!loading && assets.length === 0 && (
            <EmptyState
              title="No assets yet"
              body="Upload from your computer or pull from Pexels to get started."
              cta={
                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setShowUploader(true)}>
                    Upload an asset
                  </Button>
                  <Button variant="primary" onClick={() => setViewTab("pexels")}>
                    Browse Pexels
                  </Button>
                </div>
              }
            />
          )}

          {!loading && assets.length > 0 && (
            <>
              <p className="text-[var(--text-fs-1)] text-[var(--text-muted)] mb-4">
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
                    onDelete={() => setPendingDelete(asset.id)}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete asset?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Delete</Button>
          </>
        }
      >
        <p className="text-[var(--text-fs-3)] text-[var(--text-muted)]">
          This removes the asset from your library. Projects already using it keep
          working until you unlink them.
        </p>
      </Modal>
    </div>
  );
}
