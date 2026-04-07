"use client";

import { useState, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";

interface AssetUploaderProps {
  /** Label shown above the upload area */
  label: string;
  /** Which asset field to update in the project after upload: "assets.audio" | "assets.background.path" */
  fieldPath: string;
  /** Currently stored file name / path (for display) */
  currentValue: string | undefined;
  /** Accepted MIME types, e.g. "audio/*" or "video/*,image/*" */
  accept?: string;
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function AssetUploader({ label, fieldPath, currentValue, accept }: AssetUploaderProps) {
  const { project, updateField } = useProjectStore();
  const [state, setState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const projectId = project?.id;

  const upload = useCallback(
    async (file: File) => {
      if (!projectId) return;
      setError(null);
      setState("uploading");
      setProgress(0);

      try {
        // 1. Get presigned upload URL
        const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
          `/projects/${projectId}/assets/upload-url`,
          {
            method: "POST",
            body: JSON.stringify({ filename: file.name, contentType: file.type }),
          }
        );

        // 2. Upload directly to R2 via presigned URL (XHR for progress tracking)
        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type);
          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setProgress(100);
              resolve();
            } else {
              reject(new Error(`Upload failed: ${xhr.status}`));
            }
          };
          xhr.onerror = () => reject(new Error("Upload network error"));
          xhr.send(file);
        });

        // 3. Confirm with API and update local store
        await apiFetch(`/projects/${projectId}/assets/confirm`, {
          method: "POST",
          body: JSON.stringify({ key, fieldPath }),
        });

        updateField(fieldPath, key);
        setState("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setState("error");
      }
    },
    [projectId, fieldPath, updateField]
  );

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    upload(files[0]);
  };

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [upload]
  );

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs text-zinc-400">{label}</label>

      {/* Current file */}
      {currentValue && (
        <div className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2">
          <span className="text-xs text-zinc-400 truncate flex-1 font-mono">{currentValue}</span>
          <span className="text-xs text-zinc-600 shrink-0">current</span>
        </div>
      )}

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        className={`relative border-2 border-dashed rounded-lg px-4 py-6 text-center cursor-pointer transition-colors ${
          dragOver
            ? "border-blue-500 bg-blue-950/30"
            : state === "done"
            ? "border-green-700 bg-green-950/20"
            : state === "error"
            ? "border-red-700 bg-red-950/20"
            : "border-zinc-700 hover:border-zinc-500 hover:bg-zinc-800/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />

        {state === "uploading" ? (
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs text-zinc-400">Uploading... {progress}%</span>
            <div className="w-full bg-zinc-700 rounded-full h-1">
              <div
                className="bg-blue-500 h-1 rounded-full transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : state === "done" ? (
          <span className="text-xs text-green-400">Upload complete</span>
        ) : state === "error" ? (
          <span className="text-xs text-red-400">{error}</span>
        ) : (
          <span className="text-xs text-zinc-500">
            Drag &amp; drop or click to upload
          </span>
        )}
      </div>
    </div>
  );
}
