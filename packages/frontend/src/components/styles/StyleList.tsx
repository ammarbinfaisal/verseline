"use client";

import type { Style } from "@verseline/shared";

interface StyleListProps {
  styles: Style[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
}

export function StyleList({ styles, selectedId, onSelect, onNew }: StyleListProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-zinc-800">
        <h2 className="text-xs font-semibold text-zinc-400 uppercase tracking-widest">Styles</h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {styles.length === 0 ? (
          <p className="px-4 py-6 text-xs text-zinc-600 text-center">No styles yet.</p>
        ) : (
          <ul>
            {styles.map((style) => (
              <li key={style.id}>
                <button
                  onClick={() => onSelect(style.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-zinc-800 ${
                    selectedId === style.id ? "bg-zinc-800 border-l-2 border-blue-500" : "border-l-2 border-transparent"
                  }`}
                >
                  {/* Color swatch */}
                  <span
                    className="shrink-0 w-4 h-4 rounded-sm border border-zinc-700"
                    style={{ backgroundColor: style.color ?? "#ffffff" }}
                  />

                  {/* Info */}
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium text-zinc-200 truncate">{style.id}</span>
                    <span className="block text-xs text-zinc-500 truncate">
                      {style.font} &middot; {style.size}px
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="p-3 border-t border-zinc-800">
        <button
          onClick={onNew}
          className="w-full py-2 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
        >
          + New Style
        </button>
      </div>
    </div>
  );
}
