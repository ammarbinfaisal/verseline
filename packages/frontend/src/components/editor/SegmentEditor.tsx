"use client";

import { useState, useCallback } from "react";
import type { Segment, Block, Style, Placement, Font, Canvas } from "@verseline/shared";
import { useTimelineStore } from "@/stores/timeline-store";
import BlockEditor from "./BlockEditor";
import TimestampInput from "@/components/common/TimestampInput";
import VideoPlayer from "./VideoPlayer";
import { apiFetch } from "@/lib/api";
import { Button, Input, Modal, Spinner } from "@/components/ui";

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
    <Modal
      open
      onClose={onClose}
      title="Split segment"
      size="md"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={saving || lines.length < 2}
            loading={saving}
            data-testid="split-confirm"
          >
            {saving ? "Splitting" : "Split"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Block to split</label>
          <select
            value={blockIndex}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setBlockIndex(idx);
              setRawText(segment.blocks[idx]?.text ?? "");
            }}
            className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-1.5 text-[var(--text-fs-3)] focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          >
            {segment.blocks.map((b, i) => (
              <option key={i} value={i}>
                Block {i + 1}: {(b.text ?? "").slice(0, 40)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">
            Text parts (separate with blank lines)
          </label>
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            rows={8}
            className="bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-md px-3 py-2 text-[var(--text-fs-3)] font-mono resize-y focus:outline-none focus:border-[var(--brand-primary)] focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2"
          />
          <p className="text-[var(--text-fs-1)] text-[var(--text-muted)] mt-1">
            {lines.length} part{lines.length !== 1 ? "s" : ""} detected
          </p>
        </div>

        {error && (
          <p
            role="alert"
            className="text-[var(--text-fs-2)] px-3 py-2 rounded-md"
            style={{ background: "var(--error-bg)", color: "var(--error)" }}
          >
            {error}
          </p>
        )}
      </div>
    </Modal>
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
  const [showDelete, setShowDelete] = useState(false);
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
    setShowDelete(false);
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
    <div className="flex flex-col h-full" data-testid="segment-editor">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-5 min-w-0">
        {/* Timing */}
        <div className="flex flex-wrap gap-3 items-end">
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
          <label className="text-[var(--text-fs-2)] text-[var(--text-muted)] font-medium">Notes</label>
          <Input
            type="text"
            value={segment.notes ?? ""}
            onChange={(e) => updateField("notes", e.target.value)}
            placeholder="Optional notes"
            fullWidth
            data-testid="segment-notes"
          />
        </div>

        {/* Blocks */}
        <div className="flex flex-col gap-3">
          <span className="text-[var(--text-fs-1)] font-semibold text-[var(--text-muted)] uppercase tracking-[0.14em]">
            Blocks
          </span>

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

        {previewUrl && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[var(--text-fs-2)] text-[var(--text-muted)]">Preview</span>
              <button
                onClick={() => setPreviewUrl(null)}
                className="text-[var(--text-fs-2)] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
              >
                Close
              </button>
            </div>
            <VideoPlayer src={previewUrl} autoPlay className="max-h-64" />
          </div>
        )}

        {error && (
          <p
            role="alert"
            className="text-[var(--text-fs-2)] px-3 py-2 rounded-md"
            style={{ background: "var(--error-bg)", color: "var(--error)" }}
          >
            {error}
          </p>
        )}
      </div>

      {/* Sticky footer action bar */}
      <div className="border-t border-[var(--border)] px-3 py-2 flex items-center gap-2 bg-[var(--surface-1)] shrink-0">
        <Button size="sm" variant="ghost" onClick={handleAddBlock} disabled={saving} data-testid="add-block">
          + Block
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setShowSplit(true)} disabled={saving} data-testid="open-split">
          Split
        </Button>
        <Button size="sm" variant="ghost" onClick={handleDuplicate} disabled={saving} title="Cmd/Ctrl+D" data-testid="duplicate-segment">
          Duplicate
        </Button>
        <Button size="sm" variant="secondary" onClick={handlePreview} disabled={saving || previewLoading} loading={previewLoading} data-testid="preview-segment">
          {previewLoading ? "Rendering" : "Preview"}
        </Button>

        {saving && <Spinner size={12} />}

        <div className="flex-1" />

        <Button size="sm" variant="danger" onClick={() => setShowDelete(true)} disabled={saving} data-testid="open-delete">
          Delete
        </Button>
      </div>

      {showSplit && (
        <SplitModal
          segment={segment}
          onClose={() => setShowSplit(false)}
          onSplit={handleSplit}
        />
      )}

      <Modal
        open={showDelete}
        onClose={() => setShowDelete(false)}
        title="Delete segment?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setShowDelete(false)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} data-testid="delete-confirm">Delete</Button>
          </>
        }
      >
        <p className="text-[var(--text-fs-3)] text-[var(--text-muted)]">
          This will remove the segment and its blocks. This action cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
