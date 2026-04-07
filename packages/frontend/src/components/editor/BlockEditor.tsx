"use client";

import type { Block, Style, Placement } from "@verseline/shared";

interface BlockEditorProps {
  block: Block;
  index: number;
  styles: Style[];
  placements: Placement[];
  onChange: (updates: Partial<Block>) => void;
  onRemove?: () => void;
}

/**
 * Render block text with inline <styleId>text</styleId> tags highlighted.
 * We just use a textarea with a visual hint since contentEditable adds complexity.
 */
export default function BlockEditor({ block, index, styles, placements, onChange, onRemove }: BlockEditorProps) {
  const hasInlineTags = /<[^>]+>/.test(block.text ?? "");

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
        <textarea
          value={block.text ?? ""}
          onChange={(e) => onChange({ text: e.target.value })}
          rows={3}
          className="bg-zinc-50 dark:bg-zinc-900 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono leading-relaxed"
          placeholder="Block text…"
          spellCheck={false}
        />
        {hasInlineTags && (
          <p className="text-xs text-indigo-400">
            Contains inline style tags (e.g. <code className="bg-zinc-100 dark:bg-zinc-800 px-1 rounded">&lt;styleId&gt;text&lt;/styleId&gt;</code>)
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
              {s.id} — {s.font}, {s.size}px
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
              {p.id} — {p.anchor}
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
