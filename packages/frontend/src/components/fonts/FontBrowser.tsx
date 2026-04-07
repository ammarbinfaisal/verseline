"use client";

import { useState, useEffect, useRef } from "react";
import { apiFetch } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";
import type { Font } from "@verseline/shared";

interface GoogleFontMeta {
  family: string;
  category: string;
  variants: string[];
}

interface FontBrowserProps {
  onClose: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  serif: "bg-amber-900/50 text-amber-300",
  "sans-serif": "bg-blue-900/50 text-blue-300",
  display: "bg-purple-900/50 text-purple-300",
  handwriting: "bg-pink-900/50 text-pink-300",
  monospace: "bg-green-900/50 text-green-300",
};

export function FontBrowser({ onClose }: FontBrowserProps) {
  const { project, upsertFont } = useProjectStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleFontMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const projectFontFamilies = new Set((project?.fonts ?? []).map((f) => f.family));

  // Seed with already-added families
  useEffect(() => {
    setDownloaded(new Set(projectFontFamilies));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Search whenever query changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const q = query.trim();
      setLoading(true);
      apiFetch<{ fonts: GoogleFontMeta[] }>(
        `/fonts/google?q=${encodeURIComponent(q)}&limit=40`
      )
        .then((data) => setResults(data.fonts))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleDownload = async (font: GoogleFontMeta) => {
    if (downloading.has(font.family)) return;

    setDownloading((prev) => new Set(prev).add(font.family));
    try {
      const result = await apiFetch<{ r2Key: string; family: string; variant: string }>(
        "/fonts/google/download",
        { method: "POST", body: JSON.stringify({ family: font.family, variant: "regular" }) }
      );

      // Build a Font record for the project
      const id = font.family.toLowerCase().replace(/\s+/g, "-");
      const newFont: Font = {
        id,
        family: result.family,
        files: [result.r2Key],
      };
      upsertFont(newFont);
      setDownloaded((prev) => new Set(prev).add(font.family));
    } catch (err) {
      console.error("[FontBrowser] download failed", err);
    } finally {
      setDownloading((prev) => {
        const next = new Set(prev);
        next.delete(font.family);
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest flex-1">
          Google Fonts
        </h2>
        <button
          onClick={onClose}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Close
        </button>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-zinc-800">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fonts..."
          autoFocus
          className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-6 text-xs text-zinc-500 text-center">Searching...</p>
        ) : results.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-600 text-center">No results.</p>
        ) : (
          <ul className="divide-y divide-zinc-800">
            {results.map((font) => {
              const isDone = downloaded.has(font.family);
              const isLoading = downloading.has(font.family);
              const catClass = CATEGORY_COLORS[font.category] ?? "bg-zinc-700 text-zinc-300";

              return (
                <li key={font.family} className="px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    {/* Name + badge */}
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-zinc-200 truncate">
                        {font.family}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${catClass}`}>
                        {font.category}
                      </span>
                    </div>
                    {/* Sample text */}
                    <span className="text-xs text-zinc-500 italic">
                      The quick brown fox jumps over the lazy dog
                    </span>
                  </div>

                  {/* Download button */}
                  <button
                    onClick={() => handleDownload(font)}
                    disabled={isDone || isLoading}
                    className={`shrink-0 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      isDone
                        ? "text-green-400 bg-green-900/30 cursor-default"
                        : isLoading
                        ? "text-zinc-500 bg-zinc-800 cursor-wait"
                        : "text-zinc-300 bg-zinc-800 hover:bg-zinc-700 hover:text-white"
                    }`}
                  >
                    {isDone ? "Added" : isLoading ? "..." : "Download"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
