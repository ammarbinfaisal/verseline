"use client";

import { useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { FontList } from "./FontList";
import { FontBrowser } from "./FontBrowser";
import { Button } from "@/components/ui";

export function FontsTab() {
  const { project } = useProjectStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const fonts = project?.fonts ?? [];
  const selected = fonts.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="flex h-full" data-testid="fonts-tab">
      {/* Left: project font list */}
      <div className="w-56 shrink-0 border-r border-[var(--border)] flex flex-col">
        <FontList
          fonts={fonts}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setBrowsing(false);
          }}
        />
        <div className="p-2 border-t border-[var(--border)]">
          <Button
            size="sm"
            variant="ghost"
            fullWidth
            onClick={() => setBrowsing(true)}
            data-testid="browse-google-fonts"
          >
            Browse Google Fonts
          </Button>
        </div>
      </div>

      {/* Right: browser or font detail */}
      <div className="flex-1 min-w-0">
        {browsing ? (
          <FontBrowser onClose={() => setBrowsing(false)} />
        ) : selected ? (
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h2 className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em]">
                Font Details
              </h2>
            </div>
            <div className="px-4 py-4 flex flex-col gap-3">
              <div>
                <span className="text-[var(--text-fs-2)] text-[var(--text-muted)] block">ID</span>
                <span className="text-[var(--text-fs-3)] text-[var(--text)] font-mono">{selected.id}</span>
              </div>
              <div>
                <span className="text-[var(--text-fs-2)] text-[var(--text-muted)] block">Family</span>
                <span className="text-[var(--text-fs-3)] text-[var(--text)]">{selected.family}</span>
              </div>
              {selected.files && selected.files.length > 0 && (
                <div>
                  <span className="text-[var(--text-fs-2)] text-[var(--text-muted)] block mb-1">Files</span>
                  <ul className="flex flex-col gap-1">
                    {selected.files.map((f) => (
                      <li
                        key={f}
                        className="text-[var(--text-fs-1)] text-[var(--text-muted)] font-mono truncate bg-[var(--surface-2)] rounded-sm px-2 py-1"
                      >
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-[var(--text-fs-2)] text-[var(--text-muted)]">
            Select a font or browse Google Fonts
          </div>
        )}
      </div>
    </div>
  );
}
