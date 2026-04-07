import { z } from "zod";
import { getProject, getSegments } from "../api-client.js";
import { tsToMs } from "../helpers.js";

export const validateInputSchema = {
  project_id: z.string().min(1).describe("The project UUID to validate"),
  timeline: z
    .enum(["draft", "approved"])
    .optional()
    .default("draft")
    .describe('Which timeline to validate: "draft" (default) or "approved"'),
};

export async function handleValidateProject(input: {
  project_id: string;
  timeline?: "draft" | "approved";
}) {
  const timeline = input.timeline ?? "draft";

  const [project, segs] = await Promise.all([
    getProject(input.project_id),
    getSegments(input.project_id, timeline),
  ]);

  // Validate canvas dimensions
  if (!project.canvas.width || project.canvas.width <= 0) {
    throw new Error("canvas.width must be positive");
  }
  if (!project.canvas.height || project.canvas.height <= 0) {
    throw new Error("canvas.height must be positive");
  }
  if (!project.canvas.fps || project.canvas.fps <= 0) {
    throw new Error("canvas.fps must be positive");
  }

  // Validate background path
  if (!project.assets?.background?.path) {
    throw new Error("assets.background.path is required");
  }

  // Build lookup sets for styles, placements, sources
  const styleIds = new Set((project.styles ?? []).map((s) => s.id));
  const placementIds = new Set((project.placements ?? []).map((p) => p.id));
  const sourceIds = new Set((project.sources ?? []).map((s) => s.id));

  // Validate each segment
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i]!;
    const num = i + 1;

    if (seg.startMs < 0) {
      throw new Error(`Segment ${num}: startMs must be >= 0`);
    }
    if (seg.endMs <= seg.startMs) {
      throw new Error(
        `Segment ${num}: endMs (${seg.endMs}) must be greater than startMs (${seg.startMs})`,
      );
    }

    const blocks = (seg.blocks ?? []) as Array<{
      text?: string;
      style?: string;
      placement?: string;
      source?: { source?: string };
    }>;

    for (let bi = 0; bi < blocks.length; bi++) {
      const block = blocks[bi]!;
      const hasText = typeof block.text === "string" && block.text.trim() !== "";
      const hasSource = !!block.source?.source;
      if (!hasText && !hasSource) {
        throw new Error(
          `Segment ${num} block ${bi + 1}: must have text or a source reference`,
        );
      }
      if (block.style && !styleIds.has(block.style)) {
        throw new Error(
          `Segment ${num} block ${bi + 1}: style "${block.style}" not found in project styles`,
        );
      }
      if (block.placement && !placementIds.has(block.placement)) {
        throw new Error(
          `Segment ${num} block ${bi + 1}: placement "${block.placement}" not found in project placements`,
        );
      }
      if (block.source?.source && !sourceIds.has(block.source.source)) {
        throw new Error(
          `Segment ${num} block ${bi + 1}: source "${block.source.source}" not found in project sources`,
        );
      }
    }
  }

  const output = {
    project_id: input.project_id,
    timeline,
    segment_count: segs.length,
    valid: true,
  };

  const text = `Validated ${segs.length} ${timeline} timeline segments for project "${project.name}" — OK`;

  return {
    content: [
      { type: "text" as const, text },
      { type: "text" as const, text: JSON.stringify(output, null, 2) },
    ],
  };
}
