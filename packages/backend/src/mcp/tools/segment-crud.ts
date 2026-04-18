import { z } from "zod";
import { getSegments, createSegment, deleteSegment } from "../api-client.js";
import type { ApiBlock } from "../api-client.js";
import { findSegment, summarizeSegment, tsToMs } from "../helpers.js";

// ---- createSegment ----

export const createSegmentInputSchema = {
  project_id: z.string().min(1).describe("The project UUID"),
  timeline: z
    .enum(["draft", "approved"])
    .optional()
    .default("draft")
    .describe('Which timeline to create the segment in: "draft" (default) or "approved"'),
  start: z
    .string()
    .describe("Start timestamp in HH:MM:SS.mmm format"),
  end: z
    .string()
    .describe("End timestamp in HH:MM:SS.mmm format"),
  status: z
    .enum(["draft", "approved", "needs_fix"])
    .optional()
    .describe('Segment status: "draft", "approved", or "needs_fix". Defaults to "draft".'),
  notes: z
    .string()
    .optional()
    .describe("Reviewer notes attached to the segment"),
  sort_order: z
    .number()
    .int()
    .optional()
    .describe(
      "Explicit sort order integer. If omitted the server appends the segment after the last existing one.",
    ),
  blocks: z
    .array(z.object({}).passthrough())
    .optional()
    .describe(
      "Initial blocks array. Each element is an ApiBlock-shaped object ({ text, style, placement, source, ... }). Defaults to [] if omitted.",
    ),
};

export async function handleCreateSegment(input: {
  project_id: string;
  timeline?: "draft" | "approved";
  start: string;
  end: string;
  status?: "draft" | "approved" | "needs_fix";
  notes?: string;
  sort_order?: number;
  blocks?: object[];
}) {
  const timeline = input.timeline ?? "draft";

  const startMs = tsToMs(input.start);
  if (startMs === null) throw new Error(`Invalid start timestamp: "${input.start}"`);

  const endMs = tsToMs(input.end);
  if (endMs === null) throw new Error(`Invalid end timestamp: "${input.end}"`);

  if (endMs <= startMs) {
    throw new Error(`end (${input.end}) must be after start (${input.start})`);
  }

  const body: Record<string, unknown> = {
    timelineKind: timeline,
    startMs,
    endMs,
    blocks: (input.blocks ?? []) as ApiBlock[],
  };

  if (input.status !== undefined) body.status = input.status;
  if (input.notes !== undefined) body.notes = input.notes;
  if (input.sort_order !== undefined) body.sortOrder = input.sort_order;

  const segment = await createSegment(input.project_id, body as Parameters<typeof createSegment>[1]);

  // Derive 1-based number directly from the returned sortOrder so this is
  // safe under concurrent writes (no re-fetch round-trip / no race window).
  const oneBased = segment.sortOrder + 1;

  const summary = summarizeSegment(segment, oneBased);

  const output = {
    project_id: input.project_id,
    timeline,
    segment: summary,
  };

  const text = `Created ${timeline} segment ${oneBased} in project ${input.project_id}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}

// ---- deleteSegment ----

export const deleteSegmentInputSchema = {
  project_id: z.string().min(1).describe("The project UUID"),
  timeline: z
    .enum(["draft", "approved"])
    .optional()
    .default("draft")
    .describe('Which timeline to delete from: "draft" (default) or "approved"'),
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
};

export async function handleDeleteSegment(input: {
  project_id: string;
  timeline?: "draft" | "approved";
  segment_number?: number;
  segment_id?: string;
}) {
  const timeline = input.timeline ?? "draft";

  const allSegments = await getSegments(input.project_id, timeline);
  const [seg, idx] = findSegment(allSegments, input.segment_number, input.segment_id);

  await deleteSegment(input.project_id, seg.id);

  const output = {
    deleted: true,
    project_id: input.project_id,
    timeline,
    segment_number: idx + 1,
    segment_id: seg.id,
  };

  const text = `Deleted ${timeline} segment ${idx + 1} (${seg.id}) from project ${input.project_id}`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
