"use client";

import { useState, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { useLibraryStore } from "@/stores/library-store";
import { getToken } from "@/lib/auth";
import { Button, Select, Spinner } from "@/components/ui";

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

  const handleFile = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setUploading(true);
      setError(null);
      setProgress("Getting upload URL");

      try {
        const { uploadUrl, key } = await api.library.getUploadUrl({
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          assetType,
        });

        setProgress("Uploading");
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

        setProgress("Confirming");
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
    },
    [assetType, createAsset, onUploaded],
  );

  return (
    <div className="flex flex-col gap-3 p-4 bg-[var(--surface-1)] border border-[var(--border)] rounded-md">
      <div className="flex items-center gap-3">
        <Select
          value={assetType}
          onChange={(e) => setAssetType(e.target.value)}
          aria-label="Asset type"
        >
          {ASSET_TYPES.map((t) => (
            <option key={t} value={t}>
              {t.charAt(0).toUpperCase() + t.slice(1)}
            </option>
          ))}
        </Select>

        <input ref={fileRef} type="file" className="hidden" onChange={handleFile} />

        <Button
          variant="ghost"
          onClick={() => fileRef.current?.click()}
          loading={uploading}
        >
          {uploading ? "Uploading" : "Choose file"}
        </Button>

        {progress && (
          <span className="text-[var(--text-fs-2)] text-[var(--text-muted)] flex items-center gap-2">
            <Spinner size={12} /> {progress}
          </span>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="text-[var(--text-fs-2)] px-3 py-2 rounded-md"
          style={{ background: "var(--error-bg)", color: "var(--error)" }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
