"use client";

import type { LibraryAsset } from "@/lib/api";

const TYPE_TINT: Record<string, string> = {
  background: "color-mix(in srgb, var(--brand-primary) 22%, transparent)",
  audio: "color-mix(in srgb, var(--success) 22%, transparent)",
  font: "color-mix(in srgb, var(--accent-cool) 22%, transparent)",
  style: "color-mix(in srgb, var(--accent-warm) 22%, transparent)",
  image: "color-mix(in srgb, var(--brand-primary) 22%, transparent)",
  video: "color-mix(in srgb, var(--error) 22%, transparent)",
  photo: "color-mix(in srgb, var(--brand-primary) 22%, transparent)",
};

interface LibraryAssetCardProps {
  asset: LibraryAsset;
  proxyUrl?: string;
  projectCount?: number;
  onClick?: () => void;
  onDelete?: () => void;
}

export default function LibraryAssetCard({
  asset,
  proxyUrl,
  projectCount,
  onClick,
  onDelete,
}: LibraryAssetCardProps) {
  const isImage =
    asset.assetType === "background" ||
    asset.assetType === "image" ||
    asset.assetType === "photo" ||
    asset.contentType?.startsWith("image/");
  const isVideo =
    asset.assetType === "video" || asset.contentType?.startsWith("video/");
  const isAudio =
    asset.assetType === "audio" || asset.contentType?.startsWith("audio/");

  return (
    <div
      className="group bg-[var(--surface-1)] border border-[var(--border)] rounded-md overflow-hidden hover:border-[var(--border-strong)] transition-colors cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
    >
      <div
        className="aspect-video flex items-center justify-center relative overflow-hidden"
        style={{ background: "var(--surface-2)" }}
      >
        {isImage && proxyUrl ? (
          <img src={proxyUrl} alt={asset.name} className="w-full h-full object-cover" />
        ) : isVideo && proxyUrl ? (
          <video src={proxyUrl} className="w-full h-full object-cover" muted playsInline />
        ) : isAudio ? (
          <svg
            className="w-8 h-8"
            style={{ color: "var(--text-faint)" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        ) : asset.assetType === "font" ? (
          <span className="text-[var(--text-fs-6)] text-[var(--text-faint)] font-serif">Aa</span>
        ) : asset.assetType === "style" ? (
          <div
            className="w-12 h-12 rounded-md border border-[var(--border)]"
            style={{
              backgroundColor:
                ((asset.metadata as Record<string, unknown>)?.color as string) ?? "#FFFFFF",
            }}
            aria-hidden="true"
          />
        ) : (
          <svg
            className="w-8 h-8"
            style={{ color: "var(--text-faint)" }}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            aria-hidden="true"
          >
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}

        {asset.pexelsId && (
          <span
            className="absolute top-2 right-2 text-[var(--text-fs-1)] px-1.5 py-0.5 rounded-sm font-mono"
            style={{
              background: "color-mix(in srgb, var(--canvas-frame) 75%, transparent)",
              color: "#FFFFFF",
            }}
          >
            Pexels
          </span>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[var(--text-fs-3)] font-medium text-[var(--text)] truncate flex-1">
            {asset.name}
          </h3>
          <span
            className="text-[var(--text-fs-1)] px-1.5 py-0.5 rounded-sm shrink-0 font-medium"
            style={{
              background: TYPE_TINT[asset.assetType] ?? "var(--surface-2)",
              color: "var(--text)",
            }}
          >
            {asset.assetType}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-[var(--text-fs-1)] text-[var(--text-muted)] truncate">{asset.filename}</p>
          {projectCount !== undefined && projectCount > 0 && (
            <span className="text-[var(--text-fs-1)] text-[var(--text-faint)] shrink-0 ml-2">
              {projectCount} project{projectCount !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {onDelete && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="mt-2 text-[var(--text-fs-1)] text-[var(--error)] hover:underline opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)] rounded-sm"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
