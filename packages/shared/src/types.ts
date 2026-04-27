import { z } from "zod";

// --- Canvas ---

export const CanvasSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().int().positive(),
});
export type Canvas = z.infer<typeof CanvasSchema>;

// --- Background ---

export const BackgroundSchema = z.object({
  type: z.string().optional(),
  path: z.string().min(1),
  loop: z.boolean().optional(),
  fit: z.string().optional(),
});
export type Background = z.infer<typeof BackgroundSchema>;

// --- Assets ---

export const AssetsSchema = z.object({
  audio: z.string().optional(),
  background: BackgroundSchema,
});
export type Assets = z.infer<typeof AssetsSchema>;

// --- Font ---

export const FontSchema = z.object({
  id: z.string().min(1),
  family: z.string(),
  files: z.array(z.string()).optional(),
});
export type Font = z.infer<typeof FontSchema>;

// --- Style ---

export const StyleSchema = z.object({
  id: z.string().min(1),
  font: z.string(),
  size: z.number().int(),
  color: z.string().optional(),
  outline_color: z.string().optional(),
  outline: z.number().int().optional(),
  shadow_color: z.string().optional(),
  shadow: z.number().int().optional(),
  text_bg: z.string().optional(),
  text_bg_pad: z.number().int().optional(),
  text_bg_radius: z.number().int().optional(),
  align: z.string().optional(),
  line_height: z.number().int().optional(),
});
export type Style = z.infer<typeof StyleSchema>;

// --- Placement ---
//
// Placements pin text on the canvas. Two coexistent positioning systems:
//   1. `anchor` (legacy 9-point) + `margin_x`/`margin_y` pixel offsets
//   2. `x`, `y` normalized 0..1 free-form coordinates (preferred when present)
// When `x` and `y` are both defined, free-form takes precedence over anchor;
// `anchor` then describes which corner of the *text box* sits at (x,y).

export const PlacementSchema = z.object({
  id: z.string().min(1),
  /** Display name for the user (anchor is still required for serialization). */
  name: z.string().optional(),
  anchor: z.string(),
  /** Free-form x in [0..1] of canvas width. When set, takes precedence over margin_x. */
  x: z.number().min(0).max(1).optional(),
  /** Free-form y in [0..1] of canvas height. When set, takes precedence over margin_y. */
  y: z.number().min(0).max(1).optional(),
  margin_x: z.number().int().optional(),
  margin_y: z.number().int().optional(),
  max_width: z.number().int().optional(),
  max_height: z.number().int().optional(),
});
export type Placement = z.infer<typeof PlacementSchema>;

// --- Source ---

export const SourceSchema = z.object({
  id: z.string().min(1),
  type: z.string(),
  path: z.string(),
  language: z.string().optional(),
  text_field: z.string().optional(),
  key_field: z.string().optional(),
});
export type Source = z.infer<typeof SourceSchema>;

// --- Block Source ---

export const BlockSourceSchema = z.object({
  source: z.string().min(1),
  mode: z.string().optional(),
  refs: z.array(z.string()).optional(),
});
export type BlockSource = z.infer<typeof BlockSourceSchema>;

// --- Block ---

export const BlockSchema = z.object({
  id: z.string().optional(),
  kind: z.string().optional(),
  text: z.string().optional(),
  style: z.string().optional(),
  placement: z.string().optional(),
  language: z.string().optional(),
  source: BlockSourceSchema.optional(),
});
export type Block = z.infer<typeof BlockSchema>;

// --- Overlay ---

export const OverlaySchema = z.object({
  id: z.string().optional(),
  start: z.string().optional(),
  end: z.string().optional(),
  blocks: z.array(BlockSchema),
});
export type Overlay = z.infer<typeof OverlaySchema>;

// --- Preview Settings ---

export const PreviewSettingsSchema = z.object({
  player: z.string().optional(),
  player_args: z.array(z.string()).optional(),
  directory: z.string().optional(),
  padding_ms: z.number().int().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  fps: z.number().int().optional(),
  video_codec: z.string().optional(),
  audio_codec: z.string().optional(),
  audio_bitrate: z.string().optional(),
  crf: z.number().int().optional(),
  preset: z.string().optional(),
  pix_fmt: z.string().optional(),
  extra_args: z.array(z.string()).optional(),
});
export type PreviewSettings = z.infer<typeof PreviewSettingsSchema>;

// --- Render Profile ---

export const RenderProfileSchema = z.object({
  id: z.string().min(1),
  label: z.string().optional(),
  width: z.number().int().optional(),
  height: z.number().int().optional(),
  fps: z.number().int().optional(),
  output: z.string().optional(),
  output_suffix: z.string().optional(),
  video_codec: z.string().optional(),
  audio_codec: z.string().optional(),
  audio_bitrate: z.string().optional(),
  crf: z.number().int().optional(),
  preset: z.string().optional(),
  pix_fmt: z.string().optional(),
  color_primaries: z.string().optional(),
  color_trc: z.string().optional(),
  colorspace: z.string().optional(),
  color_range: z.string().optional(),
  extra_args: z.array(z.string()).optional(),
});
export type RenderProfile = z.infer<typeof RenderProfileSchema>;

// --- Timeline Paths ---

export const TimelinePathsSchema = z.object({
  draft: z.string().optional(),
  approved: z.string().optional(),
});
export type TimelinePaths = z.infer<typeof TimelinePathsSchema>;

// --- Project ---

export const ProjectSchema = z.object({
  name: z.string().optional(),
  output: z.string().optional(),
  canvas: CanvasSchema,
  assets: AssetsSchema,
  fonts: z.array(FontSchema).optional(),
  styles: z.array(StyleSchema).optional(),
  placements: z.array(PlacementSchema).optional(),
  sources: z.array(SourceSchema).optional(),
  overlays: z.array(OverlaySchema).optional(),
  preview: PreviewSettingsSchema.optional(),
  render_profiles: z.array(RenderProfileSchema).optional(),
  timeline: TimelinePathsSchema,
});
export type Project = z.infer<typeof ProjectSchema>;

// --- Segment ---

export const SegmentSchema = z.object({
  id: z.string().optional(),
  start: z.string().min(1),
  end: z.string().min(1),
  confidence: z.number().optional(),
  notes: z.string().optional(),
  blocks: z.array(BlockSchema).min(1),
});
export type Segment = z.infer<typeof SegmentSchema>;

// --- API types ---

export interface SegmentUpdates {
  start?: string;
  end?: string;
  notes?: string;
  blockIndex?: number;
  blockText?: string;
  blockStyle?: string;
  blockPlacement?: string;
}

export interface SplitRequest {
  blockIndex: number;
  texts: string[];
}

// --- Anchors ---

export const ANCHORS = [
  "top_left",
  "top_center",
  "top_right",
  "center_left",
  "center",
  "center_right",
  "bottom_left",
  "bottom_center",
  "bottom_right",
] as const;

export type Anchor = (typeof ANCHORS)[number];
