"use client";

import { useState, useCallback, useMemo } from "react";
import type { Style, Font } from "@verseline/shared";
import { generateStyleLabel } from "@verseline/shared";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStyleTagAutocomplete(styles: Style[], fonts: Font[]) {
  const [visible, setVisible] = useState(false);
  const [partial, setPartial] = useState("");
  const [highlightIndex, setHighlightIndex] = useState(0);

  const filtered = useMemo(
    () => styles.filter((s) => s.id.toLowerCase().startsWith(partial.toLowerCase())),
    [styles, partial],
  );

  const filteredWithLabels = useMemo(
    () => filtered.map((s) => ({ ...s, label: generateStyleLabel(s, fonts) })),
    [filtered, fonts],
  );

  /** Call from textarea onChange to detect < trigger. */
  const onTextChange = useCallback((text: string, cursorPos: number) => {
    const before = text.slice(0, cursorPos);
    const lastOpen = before.lastIndexOf("<");
    const lastClose = before.lastIndexOf(">");

    if (lastOpen > lastClose && lastOpen >= 0) {
      const p = before.slice(lastOpen + 1);
      if (!/[\s/>]/.test(p)) {
        setPartial(p);
        setVisible(true);
        setHighlightIndex(0);
        return;
      }
    }
    setVisible(false);
  }, []);

  /**
   * Call from the textarea's onKeyDown.
   * Returns the selected style ID string when Enter is pressed on a match,
   * `true` when the key was handled but no selection was made,
   * or `false` when the key was not handled.
   */
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent): string | boolean => {
      if (!visible) return false;

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
        return true;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setVisible(false);
        return true;
      }
      if (e.key === "Enter" && filtered.length > 0) {
        e.preventDefault();
        const selected = filtered[highlightIndex]?.id;
        if (selected) {
          setVisible(false);
          return selected;
        }
      }
      return false;
    },
    [visible, filtered, highlightIndex],
  );

  const dismiss = useCallback(() => setVisible(false), []);

  return {
    visible,
    filtered: filteredWithLabels,
    highlightIndex,
    partial,
    onTextChange,
    onKeyDown,
    dismiss,
  };
}

// ---------------------------------------------------------------------------
// Dropdown UI
// ---------------------------------------------------------------------------

interface StyleTagDropdownProps {
  styles: Array<Style & { label: string }>;
  highlightIndex: number;
  onSelect: (styleId: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function StyleTagDropdown({
  styles,
  highlightIndex,
  onSelect,
  textareaRef,
}: StyleTagDropdownProps) {
  if (styles.length === 0) return null;

  const offsetTop = textareaRef.current?.offsetHeight ?? 0;

  return (
    <div
      className="absolute left-0 z-50 max-h-48 overflow-y-auto bg-[var(--surface-1)] border border-[var(--border)] rounded-md shadow-[var(--shadow-md)]"
      style={{ top: offsetTop }}
      role="listbox"
    >
      {styles.map((style, i) => {
        const active = i === highlightIndex;
        return (
          <button
            key={style.id}
            type="button"
            role="option"
            aria-selected={active}
            className={[
              "flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-[var(--text-fs-3)] transition-colors",
              "hover:bg-[var(--surface-2)]",
              active ? "bg-[color-mix(in_srgb,var(--accent-cool)_12%,transparent)]" : "",
            ].join(" ")}
            onMouseDown={(e) => {
              // mousedown so the textarea doesn't lose focus before we handle it
              e.preventDefault();
              onSelect(style.id);
            }}
          >
            <span className="font-semibold text-[var(--text)] font-mono">{style.id}</span>
            <span className="text-[var(--text-fs-1)] text-[var(--text-muted)]">{style.label}</span>
          </button>
        );
      })}
    </div>
  );
}
