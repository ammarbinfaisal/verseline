"use client";

import type { LibraryAsset } from "@/lib/api";

const TYPE_COLORS: Record<string, string> = {
  background: "bg-blue-500/20 text-blue-400",
  audio: "bg-green-500/20 text-green-400",
  font: "bg-purple-500/20 text-purple-400",
  style: "bg-amber-500/20 text-amber-400",
  image: "bg-blue-500/20 text-blue-400",
  video: "bg-rose-500/20 text-rose-400",
  photo: "bg-blue-500/20 text-blue-400",
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
      className="group bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-400 dark:hover:border-zinc-600 transition-colors cursor-pointer"
      onClick={onClick}
    >
      {/* Preview area */}
      <div className="aspect-video bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center relative overflow-hidden">
        {isImage && proxyUrl ? (
          <img
            src={proxyUrl}
            alt={asset.name}
            className="w-full h-full object-cover"
          />
        ) : isVideo && proxyUrl ? (
          <video
            src={proxyUrl}
            className="w-full h-full object-cover"
            muted
            playsInline
          />
        ) : isAudio ? (
          <svg className="w-8 h-8 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        ) : asset.assetType === "font" ? (
          <span className="text-2xl text-zinc-400 font-serif">Aa</span>
        ) : asset.assetType === "style" ? (
          <div
            className="w-12 h-12 rounded-lg border border-zinc-300 dark:border-zinc-600"
            style={{
              backgroundColor:
                (asset.metadata as Record<string, unknown>)?.color as string ??
                "#ffffff",
            }}
          />
        ) : (
          <svg className="w-8 h-8 text-zinc-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        )}

        {/* Pexels badge */}
        {asset.pexelsId && (
          <span className="absolute top-2 right-2 text-[10px] bg-zinc-900/70 text-white px-1.5 py-0.5 rounded">
            Pexels
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-medium text-zinc-900 dark:text-white truncate flex-1">
            {asset.name}
          </h3>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${TYPE_COLORS[asset.assetType] ?? "bg-zinc-500/20 text-zinc-400"}`}
          >
            {asset.assetType}
          </span>
        </div>

        <div className="flex items-center justify-between mt-2">
          <p className="text-xs text-zinc-500 dark:text-zinc-500 truncate">
            {asset.filename}
          </p>
          {projectCount !== undefined && projectCount > 0 && (
            <span className="text-[10px] text-zinc-400 shrink-0 ml-2">
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
            className="mt-2 text-xs text-red-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            Delete
          </button>
        )}
      </div>
    </div>
  );
}
