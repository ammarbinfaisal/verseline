"use client";

import { useState } from "react";
import { useProjectStore } from "@/stores/project-store";
import { FontList } from "./FontList";
import { FontBrowser } from "./FontBrowser";

export function FontsTab() {
  const { project } = useProjectStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [browsing, setBrowsing] = useState(false);

  const fonts = project?.fonts ?? [];
  const selected = fonts.find((f) => f.id === selectedId) ?? null;

  return (
    <div className="flex h-full">
      {/* Left: project font list */}
      <div className="w-56 shrink-0 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
        <FontList
          fonts={fonts}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setBrowsing(false);
          }}
        />
        <div className="p-3 border-t border-zinc-200 dark:border-zinc-800">
          <button
            onClick={() => setBrowsing(true)}
            className="w-full py-2 text-xs font-medium text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-lg transition-colors"
          >
            Browse Google Fonts
          </button>
        </div>
      </div>

      {/* Right: browser or font detail */}
      <div className="flex-1 min-w-0">
        {browsing ? (
          <FontBrowser onClose={() => setBrowsing(false)} />
        ) : selected ? (
          <div className="flex flex-col h-full">
            <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
              <h2 className="text-xs font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">
                Font Details
              </h2>
            </div>
            <div className="px-4 py-4 space-y-3">
              <div>
                <span className="text-xs text-zinc-600 dark:text-zinc-500 block">ID</span>
                <span className="text-sm text-zinc-800 dark:text-zinc-200">{selected.id}</span>
              </div>
              <div>
                <span className="text-xs text-zinc-600 dark:text-zinc-500 block">Family</span>
                <span className="text-sm text-zinc-800 dark:text-zinc-200">{selected.family}</span>
              </div>
              {selected.files && selected.files.length > 0 && (
                <div>
                  <span className="text-xs text-zinc-600 dark:text-zinc-500 block mb-1">Files</span>
                  <ul className="space-y-1">
                    {selected.files.map((f) => (
                      <li key={f} className="text-xs text-zinc-500 dark:text-zinc-400 font-mono truncate bg-zinc-100 dark:bg-zinc-800 rounded px-2 py-1">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-zinc-400 dark:text-zinc-600 text-sm">
            Select a font or browse Google Fonts
          </div>
        )}
      </div>
    </div>
  );
}
