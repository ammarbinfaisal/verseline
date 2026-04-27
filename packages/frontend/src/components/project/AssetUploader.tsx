"use client";

import { useState, useRef, useCallback } from "react";
import { apiFetch } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";

interface AssetUploaderProps {
  /** Label shown above the upload area */
  label: string;
  /** Which asset field to update in the project after upload */
  fieldPath: string;
  /** Currently stored file name / path (for display) */
  currentValue: string | undefined;
  /** Accepted MIME types */
  accept?: string;
  /** Asset type sent to the backend to determine R2 path prefix */
  assetType: "audio" | "background" | "font";
}

type UploadState = "idle" | "uploading" | "done" | "error";

export function AssetUploader({ label, fieldPath, currentValue, accept, assetType }: AssetUploaderProps) {
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
        const { uploadUrl, key } = await apiFetch<{ uploadUrl: string; key: string }>(
          `/projects/${projectId}/assets/upload-url`,
          {
            method: "POST",
            body: JSON.stringify({ filename: file.name, contentType: file.type, assetType }),
          },
        );

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

        await apiFetch(`/projects/${projectId}/assets/confirm`, {
          method: "POST",
          body: JSON.stringify({ key, assetType, filename: file.name }),
        });

        updateField(fieldPath, key);
        setState("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setState("error");
      }
    },
    [projectId, fieldPath, assetType, updateField],
  );

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      void upload(files[0]);
    },
    [upload],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles],
  );

  // Border + background depend on state — derived, not stored.
  const dropClass = dragOver
    ? "border-[var(--brand-primary)] bg-[color-mix(in_srgb,var(--brand-primary)_10%,transparent)]"
    : state === "done"
    ? "border-[var(--success)] bg-[var(--success-bg)]"
    : state === "error"
    ? "border-[var(--error)] bg-[var(--error-bg)]"
    : "border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-2)]";

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">{label}</label>

      {currentValue && (
        <div className="flex items-center gap-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-md px-3 py-2">
          <span className="text-[var(--text-fs-1)] text-[var(--text-muted)] truncate flex-1 font-mono">
            {currentValue}
          </span>
          <span className="text-[var(--text-fs-1)] text-[var(--text-faint)] shrink-0">current</span>
        </div>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Upload ${label}`}
        className={[
          "relative border-2 border-dashed rounded-md px-4 py-6 text-center cursor-pointer transition-colors",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]",
          dropClass,
        ].join(" ")}
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
            <span className="text-[var(--text-fs-1)] text-[var(--text-muted)]">
              Uploading… {progress}%
            </span>
            <div className="w-full bg-[var(--surface-2)] rounded-full h-1">
              <div
                className="h-1 rounded-full transition-all"
                style={{ width: `${progress}%`, background: "var(--brand-primary)" }}
              />
            </div>
          </div>
        ) : state === "done" ? (
          <span className="text-[var(--text-fs-1)] text-[var(--success)]">Upload complete</span>
        ) : state === "error" ? (
          <span className="text-[var(--text-fs-1)] text-[var(--error)]">{error}</span>
        ) : (
          <span className="text-[var(--text-fs-1)] text-[var(--text-muted)]">
            Drag &amp; drop or click to upload
          </span>
        )}
      </div>
    </div>
  );
}
