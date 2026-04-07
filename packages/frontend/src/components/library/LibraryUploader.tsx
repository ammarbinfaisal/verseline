"use client";

import { useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useLibraryStore } from "@/stores/library-store";
import { getToken } from "@/lib/auth";

const ASSET_TYPES = ["background", "audio", "font", "image", "video"] as const;

interface LibraryUploaderProps {
  defaultType?: string;
  onUploaded?: () => void;
}

export default function LibraryUploader({ defaultType, onUploaded }: LibraryUploaderProps) {
  const [assetType, setAssetType] = useState(defaultType ?? "background");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { createAsset } = useLibraryStore();

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setProgress("Getting upload URL...");

    try {
      // Get presigned upload URL
      const { uploadUrl, key } = await api.library.getUploadUrl({
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        assetType,
      });

      // Upload directly to R2
      setProgress("Uploading...");
      const token = getToken();
      const uploadRes = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": file.type || "application/octet-stream",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: file,
      });
      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);

      // Confirm upload
      setProgress("Confirming...");
      await createAsset({
        key,
        assetType,
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        name: file.name.replace(/\.[^.]+$/, ""),
      });

      setProgress(null);
      onUploaded?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [assetType, createAsset, onUploaded]);

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl">
      <div className="flex items-center gap-3">
        <select
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
          className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-300 dark:border-zinc-700 rounded px-2 py-1.5 text-sm"
        >
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </select>

        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={handleFile}
        />

        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="px-4 py-1.5 bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-600 transition-colors disabled:opacity-50"
        >
          {uploading ? "Uploading..." : "Choose File"}
        </button>

        {progress && (
          <span className="text-xs text-zinc-500">{progress}</span>
        )}
      </div>

      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}
