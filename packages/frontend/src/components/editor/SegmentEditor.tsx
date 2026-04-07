"use client";

import { useState, useCallback } from "react";
import type { Segment, Block, Style, Placement, Font, Canvas } from "@verseline/shared";
import { useTimelineStore } from "@/stores/timeline-store";
import BlockEditor from "./BlockEditor";
import TimestampInput from "@/components/common/TimestampInput";
import VideoPlayer from "./VideoPlayer";
import { apiFetch } from "@/lib/api";

interface SegmentEditorProps {
  projectId: string;
  segment: Segment;
  segments: Segment[];
  styles: Style[];
  placements: Placement[];
  fonts: Font[];
  canvas: Canvas;
}

interface SplitModalProps {
  segment: Segment;
  onClose: () => void;
  onSplit: (blockIndex: number, texts: string[]) => Promise<void>;
}

function SplitModal({ segment, onClose, onSplit }: SplitModalProps) {
  const [blockIndex, setBlockIndex] = useState(0);
  const [rawText, setRawText] = useState(segment.blocks[0]?.text ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lines = rawText.split(/\n{2,}/).map((l) => l.trim()).filter(Boolean);

  async function handleSubmit() {
    if (lines.length < 2) {
      setError("Enter at least two parts separated by blank lines.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSplit(blockIndex, lines);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white mb-4">Split Segment</h3>

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">Block to split</label>
            <select
              value={blockIndex}
              onChange={(e) => {
                const idx = Number(e.target.value);
                setBlockIndex(idx);
                setRawText(segment.blocks[idx]?.text ?? "");
              }}
              className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              {segment.blocks.map((b, i) => (
                <option key={i} value={i}>
                  Block {i + 1}: {(b.text ?? "").slice(0, 40)}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">
              Text parts (separate with blank lines)
            </label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-xs text-zinc-600 dark:text-zinc-500">
              {lines.length} part{lines.length !== 1 ? "s" : ""} detected
            </p>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end mt-2">
            <button
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving || lines.length < 2}
              className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs rounded-lg transition-colors"
            >
              {saving ? "Splitting…" : "Split"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SegmentEditor({
  projectId,
  segment,
  segments,
  styles,
  placements,
  fonts,
  canvas: _canvas,
}: SegmentEditorProps) {
  void _canvas; // reserved for future use

  const { updateSegment, deleteSegment, createSegment, splitSegment } = useTimelineStore();

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const updateField = useCallback(async (field: "start" | "end" | "notes", value: string) => {
    if (!segment.id) return;
    setSaving(true);
    setError(null);
    try {
      await updateSegment(segment.id, { [field]: value });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [segment, updateSegment]);

  const updateBlock = useCallback(async (blockIndex: number, updates: Partial<Block>) => {
    if (!segment.id) return;
    setSaving(true);
    setError(null);
    try {
      await updateSegment(segment.id, {
        blockIndex,
        blockText: updates.text,
        blockStyle: updates.style,
        blockPlacement: updates.placement,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [segment, updateSegment]);

  async function handleAddBlock() {
    if (!segment.id) return;
    const newBlockIndex = segment.blocks.length;
    setSaving(true);
    setError(null);
    try {
      await updateSegment(segment.id, {
        blockIndex: newBlockIndex,
        blockText: "",
        blockStyle: styles[0]?.id,
        blockPlacement: placements[0]?.id,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!segment.id) return;
    if (!confirm("Delete this segment?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteSegment(segment.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSplit(blockIndex: number, texts: string[]) {
    if (!segment.id) return;
    await splitSegment(segment.id, blockIndex, texts);
  }

  async function handlePreview() {
    if (!segment.id) return;
    const segIndex = segments.findIndex((s) => s.id === segment.id);
    if (segIndex < 0) return;
    setPreviewLoading(true);
    setPreviewUrl(null);
    setError(null);
    try {
      const res = await apiFetch<{ url: string }>(`/projects/${projectId}/preview/${segIndex}`, { method: "POST" });
      setPreviewUrl(res.url);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleDuplicate() {
    if (!segment.id) return;
    setSaving(true);
    setError(null);
    try {
      await createSegment(projectId, {
        start: segment.start,
        end: segment.end,
        blocks: segment.blocks,
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Scrollable content area */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-w-0">

        {/* Timing */}
        <div className="flex flex-wrap gap-4 items-end">
          <TimestampInput
            label="Start"
            value={segment.start}
            onChange={(v) => updateField("start", v)}
          />
          <TimestampInput
            label="End"
            value={segment.end}
            onChange={(v) => updateField("end", v)}
          />
        </div>

        {/* Notes */}
        <div className="flex flex-col gap-1">
          <label className="text-xs text-zinc-500 dark:text-zinc-400">Notes</label>
          <input
            type="text"
            value={segment.notes ?? ""}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Optional notes…"
            className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
        </div>

        {/* Blocks */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
              Blocks
            </span>
          </div>

          {segment.blocks.map((block, i) => (
            <BlockEditor
              key={block.id ?? i}
              block={block}
              index={i}
              styles={styles}
              placements={placements}
              fonts={fonts}
              onChange={(updates) => updateBlock(i, updates)}
            />
          ))}
        </div>

        {/* Preview video */}
        {previewUrl && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-zinc-500 dark:text-zinc-400">Preview</span>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-xs text-zinc-600 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
              >
                Close
              </button>
            </div>
            <VideoPlayer src={previewUrl} autoPlay className="max-h-64" />
          </div>
        )}

        {/* Error */}
        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Sticky footer action bar */}
      <div className="border-t border-zinc-300 dark:border-zinc-700 px-4 py-2 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 shrink-0">
        <button
          onClick={handleAddBlock}
          disabled={saving}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          + Add Block
        </button>

        <button
          onClick={() => setShowSplit(true)}
          disabled={saving}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          Split
        </button>

        <button
          onClick={handleDuplicate}
          disabled={saving}
          title="Ctrl+D"
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          Duplicate
          <span className="ml-1.5 text-zinc-400 text-[10px]">Ctrl+D</span>
        </button>

        <button
          onClick={handlePreview}
          disabled={saving || previewLoading}
          className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          {previewLoading ? "Rendering…" : "Preview"}
        </button>

        {saving && (
          <span className="text-xs text-zinc-600 dark:text-zinc-500 ml-1">Saving…</span>
        )}

        <div className="flex-1" />

        <button
          onClick={handleDelete}
          disabled={saving}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-red-900 text-red-400 hover:text-red-300 text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {/* Split modal */}
      {showSplit && (
        <SplitModal
          segment={segment}
          onClose={() => setShowSplit(false)}
          onSplit={handleSplit}
        />
      )}
    </div>
  );
}
