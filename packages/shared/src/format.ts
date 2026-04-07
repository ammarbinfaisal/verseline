import { z } from "zod";
import {
  CanvasSchema,
  AssetsSchema,
  FontSchema,
  StyleSchema,
  PlacementSchema,
  SourceSchema,
  OverlaySchema,
  RenderProfileSchema,
  BlockSchema,
} from "./types";

// --- Unified .verseline format (v1) ---

export const UnifiedSegmentSchema = z.object({
  id: z.string().optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  status: z.string().optional(),
  confidence: z.number().optional(),
  notes: z.string().optional(),
  blocks: z.array(BlockSchema).min(1),
});

export const UnifiedFormatSchema = z.object({
  version: z.literal(1),
  name: z.string().optional(),
  canvas: CanvasSchema,
  assets: AssetsSchema,
  fonts: z.array(FontSchema).optional().default([]),
  styles: z.array(StyleSchema).optional().default([]),
  placements: z.array(PlacementSchema).optional().default([]),
  sources: z.array(SourceSchema).optional().default([]),
  overlays: z.array(OverlaySchema).optional().default([]),
  render_profiles: z.array(RenderProfileSchema).optional().default([]),
  segments: z.array(UnifiedSegmentSchema).default([]),
});

export type UnifiedFormat = z.infer<typeof UnifiedFormatSchema>;

// --- Legacy format detection ---

/** Check if a parsed JSON object looks like a legacy project.json (has timeline paths, no segments array). */
export function isLegacyProject(obj: unknown): boolean {
  if (!obj || typeof obj !== "object") return false;
  const o = obj as Record<string, unknown>;
  return (
    "canvas" in o &&
    "timeline" in o &&
    typeof o.timeline === "object" &&
    o.timeline !== null &&
    !("version" in o) &&
    !("segments" in o)
  );
}
