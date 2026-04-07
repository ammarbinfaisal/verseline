import { z } from "zod";
import { getSegments, splitSegment } from "../api-client.js";
import { findSegment, summarizeSegment } from "../helpers.js";

export const splitSegmentInputSchema = {
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
  block_index: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("1-based index of the block whose text to split (default: 1)"),
  texts: z
    .array(z.string())
    .min(2)
    .describe(
      "The new text fragments to replace the block text (minimum 2). Time is split equally across fragments.",
    ),
  dry_run: z
    .boolean()
    .optional()
    .default(false)
    .describe("If true, validate and return the result without saving"),
};

export async function handleSplitSegment(input: {
  project_id: string;
  timeline?: "draft" | "approved";
  segment_number?: number;
  segment_id?: string;
  block_index?: number;
  texts: string[];
  dry_run?: boolean;
}) {
  const timeline = input.timeline ?? "draft";
  const dryRun = input.dry_run ?? false;
  const blockIndex = Math.max((input.block_index ?? 1) - 1, 0);

  if (input.texts.length < 2) {
    throw new Error("texts must contain at least 2 items");
  }

  const allSegments = await getSegments(input.project_id, timeline);
  const [seg, idx] = findSegment(allSegments, input.segment_number, input.segment_id);

  if (dryRun) {
    // Build a preview without calling the API
    const totalMs = seg.endMs - seg.startMs;
    const splitDuration = Math.floor(totalMs / input.texts.length);
    const preview = input.texts.map((text, i) => {
      const startMs = seg.startMs + splitDuration * i;
      const endMs =
        i === input.texts.length - 1 ? seg.endMs : startMs + splitDuration;
      return {
        number: idx + 1 + i,
        start_ms: startMs,
        end_ms: endMs,
        text,
      };
    });

    const output = {
      project_id: input.project_id,
      timeline,
      original_number: idx + 1,
      replacement_count: input.texts.length,
      segments: preview,
      saved: false,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: `[dry-run] Would split ${timeline} segment ${idx + 1} into ${input.texts.length} segments`,
        },
        { type: "text" as const, text: JSON.stringify(output, null, 2) },
      ],
    };
  }

  const created = await splitSegment(input.project_id, seg.id, {
    blockIndex,
    texts: input.texts,
  });

  const summaries = created.map((s, i) => summarizeSegment(s, idx + 1 + i));

  const output = {
    project_id: input.project_id,
    timeline,
    original_number: idx + 1,
    replacement_count: created.length,
    segments: summaries,
    saved: true,
  };

  const text = `Split ${timeline} segment ${idx + 1} into ${created.length} segments`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
