"use client";

import { useRef, useCallback } from "react";
import type { Block, Style, Placement, Font } from "@verseline/shared";
import { generateStyleLabel, generatePlacementLabel } from "@verseline/shared";
import { useStyleTagAutocomplete, StyleTagDropdown } from "./StyleTagAutocomplete";
import { Input, Select, Textarea } from "@/components/ui";

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

    const before = text.slice(0, pos);
    const lastOpen = before.lastIndexOf("<");

    const tag = `<${styleId}></${styleId}>`;
    const newText = text.slice(0, lastOpen) + tag + text.slice(pos);
    onChange({ text: newText });

    const cursorTarget = lastOpen + styleId.length + 2;
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

    if (start === end) return;

    const selected = text.slice(start, end);
    const wrapped = `<${styleId}>${selected}</${styleId}>`;
    const newText = text.slice(0, start) + wrapped + text.slice(end);
    onChange({ text: newText });
  }, [block.text, onChange]);

  return (
    <div
      className="border border-[var(--border)] rounded-md p-3 bg-[var(--surface-1)] flex flex-col gap-3"
      data-testid={`block-editor-${index}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em]">
          Block {index + 1}
        </span>
        {onRemove && (
          <button
            onClick={onRemove}
            className="text-[var(--text-fs-1)] text-[var(--text-muted)] hover:text-[var(--error)] transition-colors px-1 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
            title="Remove block"
          >
            Remove
          </button>
        )}
      </div>

      {/* Text area */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Text</label>

        {styles.length > 0 && (
          <div className="flex items-center gap-1 flex-wrap">
            <span className="text-[var(--text-fs-1)] text-[var(--text-faint)] mr-1">Wrap:</span>
            {styles.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => wrapSelectionWithTag(s.id)}
                className="text-[var(--text-fs-1)] px-1.5 py-0.5 bg-[var(--surface-2)] text-[var(--text-muted)] rounded-sm hover:bg-[color-mix(in_srgb,var(--accent-cool)_18%,transparent)] hover:text-[var(--text)] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
                title={`Wrap selection with <${s.id}>...</${s.id}>`}
              >
                {s.id}
              </button>
            ))}
          </div>
        )}

        <div className="relative">
          <Textarea
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
            placeholder="Block text…"
            spellCheck={false}
            mono
            fullWidth
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
          <p className="text-[var(--text-fs-1)] text-[var(--accent-cool)]">
            Uses inline style tags — colors render in the canvas preview. Type{" "}
            <code className="bg-[var(--surface-2)] px-1 rounded-sm font-mono">&lt;</code> for autocomplete.
          </p>
        )}
      </div>

      {/* Style dropdown */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Style</label>
        <Select
          value={block.style ?? ""}
          onChange={(e) => onChange({ style: e.target.value || undefined })}
          fullWidth
        >
          <option value="">(none)</option>
          {styles.map((s) => (
            <option key={s.id} value={s.id}>
              {s.id} — {generateStyleLabel(s, fonts)}
            </option>
          ))}
        </Select>
      </div>

      {/* Placement dropdown */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Placement</label>
        <Select
          value={block.placement ?? ""}
          onChange={(e) => onChange({ placement: e.target.value || undefined })}
          fullWidth
        >
          <option value="">(none)</option>
          {placements.map((p) => (
            <option key={p.id} value={p.id}>
              {p.id} — {generatePlacementLabel(p)}
            </option>
          ))}
        </Select>
      </div>

      {/* Language */}
      <div className="flex flex-col gap-1.5">
        <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Language</label>
        <Input
          type="text"
          value={block.language ?? ""}
          onChange={(e) => onChange({ language: e.target.value || undefined })}
          placeholder="e.g. en, ar, fr"
          fullWidth
        />
      </div>
    </div>
  );
}
