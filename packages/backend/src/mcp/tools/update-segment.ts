import { z } from "zod";
import { getSegments, updateSegment } from "../api-client.js";
import { findSegment, summarizeSegment, tsToMs, msToTs } from "../helpers.js";
import type { ApiBlock, ApiSegment } from "../api-client.js";

export const updateSegmentInputSchema = {
  project_id: z.string().min(1).describe("The project UUID"),
  timeline: z
    .enum(["draft", "approved"])
    .optional()
    .default("draft")
    .describe('Timeline to edit: "draft" (default) or "approved"'),
  segment_number: z
    .number()
    .int()
    .min(1)
    .optional()
    .describe("1-based segment number (use this or segment_id)"),
  segment_id: z
    .string()
    .optional()
    .describe("Segment UUID (use this or segment_number)"),
  start: z
    .string()
    .optional()
    .describe("New start timestamp in HH:MM:SS.mmm format"),
  end: z
    .string()
    .optional()
    .describe("New end timestamp in HH:MM:SS.mmm format"),
  status: z
    .enum(["draft", "approved", "needs_fix"])
    .optional()
    .describe('New status: "draft", "approved", or "needs_fix"'),
  notes: z
    .string()
    .optional()
    .describe("Reviewer notes or empty string to clear"),
  block_index: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("1-based index of the block to edit (default: 1)"),
  block_text: z
    .string()
    .optional()
    .describe(
      "New text for the block. May contain inline style tags: <styleID>text</styleID>",
    ),
  block_style: z
    .string()
    .optional()
    .describe("Style ID to apply to the block (must exist in project styles)"),
  block_placement: z
    .string()
    .optional()
    .describe(
      "Placement ID to apply to the block (must exist in project placements)",
    ),
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, validate and return the result without saving"),
};

export async function handleUpdateSegment(input: {
  project_id: string;
  timeline?: "draft" | "approved";
  segment_number?: number;
  segment_id?: string;
  start?: string;
  end?: string;
  status?: "draft" | "approved" | "needs_fix";
  notes?: string;
  block_index?: number;
  block_text?: string;
  block_style?: string;
  block_placement?: string;
  dry_run?: boolean;
}) {
  const timeline = input.timeline ?? "draft";
  const dryRun = input.dry_run ?? false;

  const allSegments = await getSegments(input.project_id, timeline);
  const [seg, idx] = findSegment(allSegments, input.segment_number, input.segment_id);

  // Build updates
  const updates: Partial<Pick<ApiSegment, "startMs" | "endMs" | "status" | "notes" | "blocks">> = {};

  if (input.start !== undefined) {
    const ms = tsToMs(input.start);
    if (ms === null) throw new Error(`Invalid start timestamp: "${input.start}"`);
    updates.startMs = ms;
  }
  if (input.end !== undefined) {
    const ms = tsToMs(input.end);
    if (ms === null) throw new Error(`Invalid end timestamp: "${input.end}"`);
    updates.endMs = ms;
  }
  if (input.status !== undefined) updates.status = input.status;
  if (input.notes !== undefined) updates.notes = input.notes;

  // Block-level updates
  const blockIdx = Math.max((input.block_index ?? 1) - 1, 0);
  const blocks = [...((seg.blocks ?? []) as ApiBlock[])];

  if (
    input.block_text !== undefined ||
    input.block_style !== undefined ||
    input.block_placement !== undefined
  ) {
    if (blockIdx >= blocks.length) {
      throw new Error(
        `block_index ${blockIdx + 1} is out of range (segment has ${blocks.length} block(s))`,
      );
    }
    const existing = { ...(blocks[blockIdx] ?? {}) } as ApiBlock;
    if (input.block_text !== undefined) existing.text = input.block_text;
    if (input.block_style !== undefined) existing.style = input.block_style;
    if (input.block_placement !== undefined) existing.placement = input.block_placement;
    blocks[blockIdx] = existing;
    updates.blocks = blocks;
  }

  // Apply updates to in-memory copy for dry-run summary
  const merged: ApiSegment = {
    ...seg,
    ...updates,
  };

  let savedSeg = merged;
  if (!dryRun) {
    savedSeg = await updateSegment(input.project_id, seg.id, updates);
  }

  const summary = summarizeSegment(savedSeg, idx + 1);
  const output = {
    project_id: input.project_id,
    timeline,
    segment: summary,
    saved: !dryRun,
  };

  const text = dryRun
    ? `[dry-run] Would update ${timeline} segment ${idx + 1}`
    : `Updated ${timeline} segment ${idx + 1} in project ${input.project_id}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
