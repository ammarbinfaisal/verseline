"use client";

import { useState, useRef } from "react";
import { getToken } from "@/lib/auth";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/**
 * Fetch an R2 asset via the backend proxy, returning a blob URL.
 * The blob URL can be used as src for <img>, <video>, <audio> elements.
 * Returns null while loading or if the key is empty.
 */
export function useAssetUrl(projectId: string | undefined, r2Key: string | undefined): string | null {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const currentKeyRef = useRef<string>("");
  const fetchingRef = useRef(false);

  // Determine the relative key for the proxy endpoint
  const relativeKey = r2Key
    ? (r2Key.startsWith(`projects/${projectId}/assets/`)
        ? r2Key.slice(`projects/${projectId}/assets/`.length)
        : r2Key)
    : "";

  const cacheKey = `${projectId}::${relativeKey}`;

  // If the key changed, start a new fetch
  if (cacheKey !== currentKeyRef.current) {
    // Revoke old blob URL
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }
    currentKeyRef.current = cacheKey;
    fetchingRef.current = false;
  }

  if (projectId && relativeKey && !blobUrl && !fetchingRef.current) {
    fetchingRef.current = true;
    const token = getToken();
    const url = `${API_BASE}/projects/${projectId}/assets/${relativeKey}`;

    fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Asset fetch failed: ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        // Only set if this is still the current key
        if (currentKeyRef.current === cacheKey) {
          setBlobUrl(URL.createObjectURL(blob));
        }
      })
      .catch(() => {
        fetchingRef.current = false;
      });
  }

  return blobUrl;
}

/**
 * Build the proxy URL for an R2 asset without fetching it.
 * Useful when you need a plain URL (e.g. for a download link) rather than a blob URL.
 */
export function assetProxyUrl(projectId: string, r2Key: string): string {
  const prefix = `projects/${projectId}/assets/`;
  const relative = r2Key.startsWith(prefix) ? r2Key.slice(prefix.length) : r2Key;
  return `${API_BASE}/projects/${projectId}/assets/${relative}`;
}
