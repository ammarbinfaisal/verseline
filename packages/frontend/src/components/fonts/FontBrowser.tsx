"use client";

import { useState, useRef, useCallback } from "react";
import { useMountEffect } from "@/hooks/useMountEffect";
import { apiFetch } from "@/lib/api";
import { useProjectStore } from "@/stores/project-store";
import type { Font } from "@verseline/shared";
import { Button, Input, Spinner } from "@/components/ui";

interface GoogleFontMeta {
  family: string;
  category: string;
  variants: string[];
}

interface FontBrowserProps {
  onClose: () => void;
}

const CATEGORY_TINT: Record<string, string> = {
  serif: "color-mix(in srgb, var(--accent-warm) 22%, transparent)",
  "sans-serif": "color-mix(in srgb, var(--brand-primary) 22%, transparent)",
  display: "color-mix(in srgb, var(--accent-cool) 22%, transparent)",
  handwriting: "color-mix(in srgb, var(--error) 22%, transparent)",
  monospace: "color-mix(in srgb, var(--success) 22%, transparent)",
};

const SAMPLE_TEXT = "Aḥādīth of Rasūllullāh صلى الله عليه وسلم";

/** Injects a Google Fonts CSS <link> and renders sample text in that font. */
function GoogleFontPreview({ family }: { family: string }) {
  useMountEffect(() => {
    const id = `gf-${family.replace(/\s+/g, "-")}`;
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}&display=swap`;
    document.head.appendChild(link);
    return () => {
      document.getElementById(id)?.remove();
    };
  });

  return (
    <span
      className="text-[var(--text-fs-2)] text-[var(--text-muted)]"
      style={{ fontFamily: `"${family}", sans-serif` }}
    >
      {SAMPLE_TEXT}
    </span>
  );
}

export function FontBrowser({ onClose }: FontBrowserProps) {
  const { project, upsertFont } = useProjectStore();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GoogleFontMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState<Set<string>>(new Set());
  const [downloaded, setDownloaded] = useState<Set<string>>(new Set());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const projectFontFamilies = new Set((project?.fonts ?? []).map((f) => f.family));

  useMountEffect(() => {
    setDownloaded(new Set(projectFontFamilies));
  });

  const doSearch = useCallback((q: string) => {
    setLoading(true);
    apiFetch<{ fonts: GoogleFontMeta[] }>(
      `/fonts/google?q=${encodeURIComponent(q.trim())}&limit=40`,
    )
      .then((data) => setResults(data.fonts))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  useMountEffect(() => {
    doSearch("");
  });

  const runSearch = useCallback(
    (q: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        doSearch(q);
      }, 300);
    },
    [doSearch],
  );

  const handleDownload = async (font: GoogleFontMeta) => {
    if (downloading.has(font.family)) return;

    setDownloading((prev) => new Set(prev).add(font.family));
    try {
      const result = await apiFetch<{ r2Key: string; family: string; variant: string }>(
        "/fonts/google/download",
        { method: "POST", body: JSON.stringify({ family: font.family, variant: "regular" }) },
      );

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
    <div className="flex flex-col h-full" data-testid="font-browser">
      <div className="px-4 py-3 border-b border-[var(--border)] flex items-center gap-2">
        <h2 className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em] flex-1">
          Google Fonts
        </h2>
        <Button size="sm" variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>

      <div className="px-4 py-3 border-b border-[var(--border)]">
        <Input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            runSearch(e.target.value);
          }}
          placeholder="Search fonts…"
          autoFocus
          fullWidth
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="px-4 py-6 text-[var(--text-fs-2)] text-[var(--text-muted)] text-center flex items-center justify-center gap-2">
            <Spinner size={12} /> Searching
          </p>
        ) : results.length === 0 ? (
          <p className="px-4 py-6 text-[var(--text-fs-2)] text-[var(--text-faint)] text-center">
            No results.
          </p>
        ) : (
          <ul>
            {results.map((font) => {
              const isDone = downloaded.has(font.family);
              const isLoading = downloading.has(font.family);
              return (
                <li
                  key={font.family}
                  className="px-4 py-3 flex items-center gap-3 border-b border-[var(--divider)]"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[var(--text-fs-3)] font-medium text-[var(--text)] truncate">
                        {font.family}
                      </span>
                      <span
                        className="text-[var(--text-fs-1)] px-1.5 py-0.5 rounded-sm font-medium shrink-0"
                        style={{
                          background: CATEGORY_TINT[font.category] ?? "var(--surface-2)",
                          color: "var(--text)",
                        }}
                      >
                        {font.category}
                      </span>
                    </div>
                    <GoogleFontPreview family={font.family} />
                  </div>

                  <Button
                    size="sm"
                    variant={isDone ? "ghost" : "secondary"}
                    onClick={() => handleDownload(font)}
                    disabled={isDone || isLoading}
                    loading={isLoading}
                  >
                    {isDone ? "✓ Added" : isLoading ? "" : "Download"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
