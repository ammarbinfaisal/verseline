import { z } from "zod";
import { getSegments } from "../api-client.js";
import { summarizeSegment } from "../helpers.js";

export const listInputSchema = {
  project_id: z.string().min(1).describe("The project UUID"),
  timeline: z
    .enum(["draft", "approved"])
    .optional()
    .default("draft")
    .describe('Which timeline to list: "draft" (default) or "approved"'),
  start_at: z
    .number()
    .int()
    .min(1)
    .optional()
    .default(1)
    .describe("1-based index of the first segment to return (default: 1)"),
  limit: z
    .number()
    .int()
    .min(1)
    .max(200)
    .optional()
    .default(50)
    .describe("Maximum number of segments to return (default: 50, max: 200)"),
};

export async function handleListSegments(input: {
  project_id: string;
  timeline?: "draft" | "approved";
  start_at?: number;
  limit?: number;
}) {
  const timeline = input.timeline ?? "draft";
  const startAt = Math.max(input.start_at ?? 1, 1);
  const limit = Math.min(Math.max(input.limit ?? 50, 1), 200);

  const allSegments = await getSegments(input.project_id, timeline);

  const startIndex = startAt - 1;
  const endIndex = Math.min(allSegments.length, startIndex + limit);
  const page = allSegments.slice(
    Math.min(startIndex, allSegments.length),
    endIndex,
  );

  const summaries = page.map((seg, i) =>
    summarizeSegment(seg, startIndex + i + 1),
  );

  const output = {
    project_id: input.project_id,
    timeline,
    total_count: allSegments.length,
    start_at: startAt,
    limit,
    has_more: endIndex < allSegments.length,
    segments: summaries,
  };

  const text = `Listed ${summaries.length} of ${allSegments.length} ${timeline} timeline segments`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
