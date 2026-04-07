"use client";

import type { Font } from "@verseline/shared";

interface FontListProps {
  fonts: Font[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function FontList({ fonts, selectedId, onSelect }: FontListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Project Fonts</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {fonts.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-600 text-center">No fonts yet.</p>
        ) : (
          <ul>
            {fonts.map((font) => (
              <li key={font.id}>
                <button
                  onClick={() => onSelect(font.id)}
                  className={`w-full flex flex-col px-4 py-2.5 text-left transition-colors hover:bg-zinc-800 ${
                    selectedId === font.id
                      ? "bg-zinc-800 border-l-2 border-blue-500"
                      : "border-l-2 border-transparent"
                  }`}
                >
                  <span className="text-sm font-medium text-zinc-200 truncate">{font.id}</span>
                  <span className="text-xs text-zinc-500 truncate">{font.family}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
