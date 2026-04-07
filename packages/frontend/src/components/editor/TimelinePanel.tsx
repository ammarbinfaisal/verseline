"use client";

import { useState, useCallback } from "react";
import type { Segment, Block, Style, Placement, Canvas } from "@verseline/shared";
import { useTimelineStore } from "@/stores/timeline-store";
import { useProjectStore } from "@/stores/project-store";
import BlockEditor from "./BlockEditor";
import TimestampInput from "@/components/common/TimestampInput";
import VideoPlayer from "./VideoPlayer";
import CanvasPreview from "./CanvasPreview";
import { apiFetch } from "@/lib/api";

interface TimelinePanelProps {
  projectId: string;
}

type StatusValue = "draft" | "approved" | "needs_fix";

const STATUS_BADGE: Record<string, string> = {
  draft:      "bg-zinc-700 text-zinc-300",
  approved:   "bg-green-900/60 text-green-300",
  needs_fix:  "bg-red-900/60 text-red-300",
};

function formatRange(start: string, end: string) {
  // Show compact MM:SS.s form
  function shorten(ts: string) {
    // HH:MM:SS.mmm → drop leading 00: if hours == 0
    return ts.replace(/^00:/, "");
  }
  return `${shorten(start)} – ${shorten(end)}`;
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

  // Split text by blank lines as default suggestion
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
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
                <option key={i} value={i}>Block {i + 1}: {(b.text ?? "").slice(0, 40)}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-zinc-500 dark:text-zinc-400">Text parts (separate with blank lines)</label>
            <textarea
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              rows={8}
              className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="text-xs text-zinc-600 dark:text-zinc-500">{lines.length} part{lines.length !== 1 ? "s" : ""} detected</p>
          </div>

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-2 justify-end mt-2">
            <button onClick={onClose} className="px-3 py-1.5 text-xs text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors">
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

export default function TimelinePanel({ projectId }: TimelinePanelProps) {
  const { segments, loading, updateSegment, deleteSegment, createSegment, splitSegment } = useTimelineStore();
  const { project } = useProjectStore();
  const styles: Style[] = project?.styles ?? [];
  const placements: Placement[] = project?.placements ?? [];
  const canvas: Canvas = project?.canvas ?? { width: 1920, height: 1080, fps: 30 };

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSplit, setShowSplit] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const selected = segments.find((s) => s.id === selectedId) ?? null;
  // Auto-select first segment when list loads
  const effectiveSelected = selected ?? (segments[0] ?? null);

  // ---- Segment field update helpers ----

  const updateField = useCallback(async (field: "start" | "end" | "status" | "notes", value: string) => {
    if (!effectiveSelected?.id) return;
    setSaving(true);
    setError(null);
    try {
      await updateSegment(effectiveSelected.id, { [field]: value });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }, [effectiveSelected, updateSegment]);

  const updateBlock = useCallback(async (blockIndex: number, updates: Partial<Block>) => {
    if (!effectiveSelected?.id) return;
    setSaving(true);
    setError(null);
    try {
      await updateSegment(effectiveSelected.id, {
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
  }, [effectiveSelected, updateSegment]);

  // ---- Actions ----

  async function handleNewSegment() {
    const last = segments[segments.length - 1];
    setSaving(true);
    setError(null);
    try {
      await createSegment(projectId, {
        start: last?.end ?? "00:00:00.000",
        end:   last?.end ?? "00:00:03.000",
        status: "draft",
        blocks: [{ text: "", style: styles[0]?.id, placement: placements[0]?.id }],
      });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!effectiveSelected?.id) return;
    if (!confirm("Delete this segment?")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteSegment(effectiveSelected.id);
      setSelectedId(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleSplit(blockIndex: number, texts: string[]) {
    if (!effectiveSelected?.id) return;
    await splitSegment(effectiveSelected.id, blockIndex, texts);
  }

  async function handlePreview() {
    if (!effectiveSelected?.id) return;
    const segIndex = segments.findIndex((s) => s.id === effectiveSelected.id);
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

  async function handleAddBlock() {
    if (!effectiveSelected?.id) return;
    const seg = effectiveSelected;
    // We update the segment with an additional block by re-sending all blocks via blockIndex trick.
    // Since the API only supports updating one block at a time, we create a new segment approach:
    // Actually, SegmentUpdates doesn't support adding blocks. We'll use updateSegment with blockIndex
    // pointing to a new index. If the API doesn't support it, we alert.
    const newBlockIndex = seg.blocks.length;
    setSaving(true);
    setError(null);
    try {
      await updateSegment(seg.id!, {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center flex-1 text-zinc-600 dark:text-zinc-500 text-sm">
        Loading segments…
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Main area: list + detail */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: segment list */}
        <div className="w-64 shrink-0 border-r border-zinc-300 dark:border-zinc-700 flex flex-col overflow-hidden">
          <div className="overflow-y-auto flex-1">
            {segments.length === 0 ? (
              <div className="flex items-center justify-center h-32 text-zinc-600 dark:text-zinc-500 text-xs">
                No segments yet
              </div>
            ) : (
              segments.map((seg, i) => {
                const isActive = seg.id === (effectiveSelected?.id);
                const preview = seg.blocks.map((b) => b.text).filter(Boolean).join(" / ");
                const statusClass = STATUS_BADGE[seg.status ?? "draft"] ?? STATUS_BADGE.draft;

                return (
                  <button
                    key={seg.id ?? i}
                    onClick={() => setSelectedId(seg.id ?? null)}
                    className={[
                      "w-full text-left px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100/70 dark:hover:bg-zinc-800/70 transition-colors",
                      isActive ? "bg-zinc-100 dark:bg-zinc-800" : "",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-zinc-600 dark:text-zinc-500 shrink-0">{String(i + 1).padStart(2, "0")}</span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${statusClass}`}>
                        {seg.status ?? "draft"}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-zinc-700 dark:text-zinc-300 mb-0.5">
                      {formatRange(seg.start, seg.end)}
                    </div>
                    <div className="text-xs text-zinc-600 dark:text-zinc-500 truncate">{preview || "(empty)"}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right: detail panel */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 min-w-0">
          {!effectiveSelected ? (
            <div className="flex items-center justify-center flex-1 text-zinc-600 dark:text-zinc-500 text-sm">
              Select a segment to edit
            </div>
          ) : (
            <>
              {/* Timing + status */}
              <div className="flex flex-wrap gap-4 items-end">
                <TimestampInput
                  label="Start"
                  value={effectiveSelected.start}
                  onChange={(v) => updateField("start", v)}
                />
                <TimestampInput
                  label="End"
                  value={effectiveSelected.end}
                  onChange={(v) => updateField("end", v)}
                />
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-zinc-500 dark:text-zinc-400">Status</label>
                  <select
                    value={effectiveSelected.status ?? "draft"}
                    onChange={(e) => updateField("status", e.target.value)}
                    className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    {(["draft", "approved", "needs_fix"] as StatusValue[]).map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes */}
              <div className="flex flex-col gap-1">
                <label className="text-xs text-zinc-500 dark:text-zinc-400">Notes</label>
                <input
                  type="text"
                  value={effectiveSelected.notes ?? ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="Optional notes…"
                  className="bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white border border-zinc-400 dark:border-zinc-600 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              {/* Canvas preview */}
              <CanvasPreview
                blocks={effectiveSelected.blocks}
                styles={styles}
                placements={placements}
                canvas={canvas}
              />

              {/* Blocks */}
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">Blocks</span>
                  <button
                    onClick={handleAddBlock}
                    disabled={saving}
                    className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-50"
                  >
                    + Add Block
                  </button>
                </div>

                {effectiveSelected.blocks.map((block, i) => (
                  <BlockEditor
                    key={block.id ?? i}
                    block={block}
                    index={i}
                    styles={styles}
                    placements={placements}
                    onChange={(updates) => updateBlock(i, updates)}
                  />
                ))}
              </div>

              {/* Video preview */}
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

              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded px-3 py-2">
                  {error}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Bottom toolbar */}
      <div className="border-t border-zinc-300 dark:border-zinc-700 px-4 py-2 flex items-center gap-2 bg-zinc-50 dark:bg-zinc-900 shrink-0">
        <button
          onClick={handleNewSegment}
          disabled={saving}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          + New Segment
        </button>

        <button
          onClick={handleDelete}
          disabled={saving || !effectiveSelected}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-red-900 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          Delete
        </button>

        <button
          onClick={() => setShowSplit(true)}
          disabled={saving || !effectiveSelected}
          className="px-3 py-1.5 bg-zinc-700 hover:bg-zinc-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          Split
        </button>

        <button
          onClick={handlePreview}
          disabled={saving || previewLoading || !effectiveSelected}
          className="px-3 py-1.5 bg-indigo-700 hover:bg-indigo-600 text-white text-xs rounded-lg transition-colors disabled:opacity-50"
        >
          {previewLoading ? "Rendering…" : "Preview"}
        </button>

        {saving && <span className="text-xs text-zinc-600 dark:text-zinc-500 ml-2">Saving…</span>}
      </div>

      {/* Split modal */}
      {showSplit && effectiveSelected && (
        <SplitModal
          segment={effectiveSelected}
          onClose={() => setShowSplit(false)}
          onSplit={handleSplit}
        />
      )}
    </div>
  );
}
