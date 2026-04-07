"use client";

import { useRef, useCallback } from "react";
import type { Block, Style, Placement, Font } from "@verseline/shared";
import { generateStyleLabel, generatePlacementLabel } from "@verseline/shared";
import { useStyleTagAutocomplete, StyleTagDropdown } from "./StyleTagAutocomplete";

interface BlockEditorProps {
  block: Block;
  index: number;
  styles: Style[];
  placements: Placement[];
  fonts: Font[];
  onChange: (updates: Partial<Block>) => void;
  onRemove?: () => void;
}

export default function BlockEditor({ block, index, styles, placements, fonts, onChange, onRemove }: BlockEditorProps) {
  const hasInlineTags = /<[^>]+>/.test(block.text ?? "");

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autocomplete = useStyleTagAutocomplete(styles, fonts);

  const handleStyleSelect = useCallback((styleId: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const text = block.text ?? "";
    const pos = textarea.selectionStart;

    // Find the < that triggered autocomplete
    const before = text.slice(0, pos);
    const lastOpen = before.lastIndexOf("<");

    // Replace from < to cursor with <styleId></styleId> and place cursor between tags
    const tag = `<${styleId}></${styleId}>`;
    const newText = text.slice(0, lastOpen) + tag + text.slice(pos);
    onChange({ text: newText });

    // Set cursor position between the tags (after setTimeout to let React re-render)
    const cursorTarget = lastOpen + styleId.length + 2; // after <styleId>
    setTimeout(() => {
      textarea.setSelectionRange(cursorTarget, cursorTarget);
      textarea.focus();
    }, 0);

    autocomplete.dismiss();
  }, [block.text, onChange, autocomplete]);

  const wrapSelectionWithTag = useCallback((styleId: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = block.text ?? "";

    if (start === end) return; // nothing selected

    const selected = text.slice(start, end);
    const wrapped = `<${styleId}>${selected}</${styleId}>`;
    const newText = text.slice(0, start) + wrapped + text.slice(end);
    onChange({ text: newText });
  }, [block.text, onChange]);

  return (
    <div className="border border-zinc-300 dark:border-zinc-700 rounded-lg p-3 bg-zinc-100/50 dark:bg-zinc-800/50 flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
          Block {index + 1}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-xs text-zinc-600 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 transition-colors"
            title="Remove block"
          >
            Remove
          </button>
        )}
      </div>

      {/* Text area */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-600 dark:text-zinc-500">Text</label>

        {/* Style wrap buttons */}
        {styles.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 mr-1">Wrap:</span>
            {styles.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => wrapSelectionWithTag(s.id)}
                className="text-[10px] px-1.5 py-0.5 bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300 rounded hover:bg-indigo-200 dark:hover:bg-indigo-900 transition-colors"
                title={`Wrap selection with <${s.id}>...</${s.id}>`}
              >
                {s.id}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <textarea
            ref={textareaRef}
            value={block.text ?? ""}
            onChange={(e) => {
              const newValue = e.target.value;
              const cursorPos = e.target.selectionStart;
              onChange({ text: newValue });
              autocomplete.onTextChange(newValue, cursorPos);
            }}
            onKeyDown={(e) => {
              const result = autocomplete.onKeyDown(e);
              if (typeof result === "string") {
                handleStyleSelect(result);
              }
            }}
            rows={3}
            className="w-full bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed"
            placeholder="Block text…"
            spellCheck={false}
          />
          {autocomplete.visible && (
            <StyleTagDropdown
              styles={autocomplete.filtered}
              highlightIndex={autocomplete.highlightIndex}
              onSelect={handleStyleSelect}
              textareaRef={textareaRef}
            />
          )}
        </div>

        {hasInlineTags && (
          <p className="text-xs text-indigo-400">
            Uses inline style tags — colors render in the canvas preview.
            Type <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">&lt;</code> for autocomplete.
          </p>
        )}
      </div>

      {/* Style dropdown */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-600 dark:text-zinc-500">Style</label>
        <select
          value={block.style ?? ""}
          onChange={(e) => onChange({ style: e.target.value || undefined })}
          className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">(none)</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} — {generateStyleLabel(s, fonts)}
            </option>
          ))}
        </select>
      </div>

      {/* Placement dropdown */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-600 dark:text-zinc-500">Placement</label>
        <select
          value={block.placement ?? ""}
          onChange={(e) => onChange({ placement: e.target.value || undefined })}
          className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          <option value="">(none)</option>
          {placements.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} — {generatePlacementLabel(p)}
            </option>
          ))}
        </select>
      </div>

      {/* Language */}
      <div className="flex flex-col gap-1">
        <label className="text-xs text-zinc-600 dark:text-zinc-500">Language</label>
        <input
          type="text"
          value={block.language ?? ""}
          onChange={(e) => onChange({ language: e.target.value || undefined })}
          placeholder="e.g. en, ar, fr"
          className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
      </div>
    </div>
  );
}
