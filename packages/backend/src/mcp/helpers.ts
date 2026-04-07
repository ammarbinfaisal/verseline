/**
 * Shared helpers for MCP tool handlers.
 */

import type { ApiSegment, ApiBlock } from "./api-client.js";

// ---- Timestamp helpers ----

/** Convert milliseconds to HH:MM:SS.mmm */
export function msToTs(ms: number): string {
  const totalMs = Math.round(ms);
  const h = Math.floor(totalMs / 3_600_000);
  const m = Math.floor((totalMs % 3_600_000) / 60_000);
  const s = Math.floor((totalMs % 60_000) / 1_000);
  const millis = totalMs % 1_000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(millis).padStart(3, "0")}`;
}

/** Parse HH:MM:SS.mmm (or HH:MM:SS) to milliseconds. Returns null on failure. */
export function tsToMs(ts: string): number | null {
  const m = /^(\d+):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(ts.trim());
  if (!m) return null;
  const h = parseInt(m[1]!, 10);
  const min = parseInt(m[2]!, 10);
  const sec = parseInt(m[3]!, 10);
  const raw = m[4] ?? "0";
  const millis = parseInt(raw.padEnd(3, "0"), 10);
  return h * 3_600_000 + min * 60_000 + sec * 1_000 + millis;
}

// ---- Segment summary ----

export interface SegmentSummary {
  number: number;
  id: string;
  start: string;
  end: string;
  status: string;
  notes: string | null;
  block_count: number;
  text_preview: string;
  source_refs: string[];
}

export function summarizeSegment(seg: ApiSegment, oneBased: number): SegmentSummary {
  const blocks = (seg.blocks ?? []) as ApiBlock[];
  return {
    number: oneBased,
    id: seg.id,
    start: msToTs(seg.startMs),
    end: msToTs(seg.endMs),
    status: seg.status,
    notes: seg.notes,
    block_count: blocks.length,
    text_preview: blockPreview(blocks),
    source_refs: collectRefs(blocks),
  };
}

function blockPreview(blocks: ApiBlock[]): string {
  const parts: string[] = [];
  for (const block of blocks) {
    const text = (block.text ?? "").trim();
    if (text) {
      parts.push(text);
    } else if (block.source) {
      const refs = (block.source.refs ?? []).join(",") || "?";
      parts.push(`[${block.source.source}:${refs}]`);
    }
  }
  const preview = parts.join(" | ");
  const runes = [...preview];
  if (runes.length > 160) {
    return runes.slice(0, 160).join("") + "...";
  }
  return preview;
}

function collectRefs(blocks: ApiBlock[]): string[] {
  const seen = new Set<string>();
  const refs: string[] = [];
  for (const block of blocks) {
    for (const ref of block.source?.refs ?? []) {
      const r = ref.trim();
      if (r && !seen.has(r)) {
        seen.add(r);
        refs.push(r);
      }
    }
  }
  return refs.sort();
}

/** Find a segment by 1-based number or id. Returns [segment, index] or throws. */
export function findSegment(
  segs: ApiSegment[],
  segmentNumber?: number,
  segmentId?: string,
): [ApiSegment, number] {
  if (segmentId) {
    const idx = segs.findIndex((s) => s.id === segmentId);
    if (idx === -1) throw new Error(`Segment with id "${segmentId}" not found`);
    return [segs[idx]!, idx];
  }
  if (segmentNumber && segmentNumber >= 1) {
    const idx = segmentNumber - 1;
    if (idx >= segs.length) {
      throw new Error(
        `Segment number ${segmentNumber} out of range (total: ${segs.length})`,
      );
    }
    return [segs[idx]!, idx];
  }
  throw new Error("Either segment_number (1-based) or segment_id is required");
}

/** Format a tool result as a JSON text content block. */
export function jsonResult(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}
