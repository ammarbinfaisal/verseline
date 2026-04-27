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
      <div className="px-3 py-2 border-b border-[var(--border)]">
        <h2 className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em]">
          Project Fonts
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto" role="listbox" aria-label="Project fonts">
        {fonts.length === 0 ? (
          <p className="px-4 py-6 text-[var(--text-fs-1)] text-[var(--text-faint)] text-center">
            No fonts yet.
          </p>
        ) : (
          <ul>
            {fonts.map((font) => {
              const active = selectedId === font.id;
              return (
                <li key={font.id}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => onSelect(font.id)}
                    data-testid={`font-row-${font.id}`}
                    className={[
                      "w-full flex flex-col px-3 py-2 text-left transition-colors relative",
                      "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--focus-ring)]",
                      active
                        ? "bg-[color-mix(in_srgb,var(--accent-cool)_10%,transparent)]"
                        : "hover:bg-[var(--surface-2)]",
                    ].join(" ")}
                  >
                    {active && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-1 bottom-1 w-0.5"
                        style={{ background: "var(--accent-cool)" }}
                      />
                    )}
                    <span className="text-[var(--text-fs-3)] font-medium text-[var(--text)] truncate">
                      {font.id}
                    </span>
                    <span className="text-[var(--text-fs-1)] font-mono text-[var(--text-muted)] truncate">
                      {font.family}
                    </span>
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
