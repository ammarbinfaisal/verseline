/**
 * High-level render orchestration service.
 * Ports verselinePreviewSegments / verselineRenderProjectProfiles /
 * buildVerselineRenderPlan from verseline_workflow.go and verseline_render.go.
 */
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type {
  Font,
  Style,
  Placement,
  Block,
  RenderProfile,
} from "@verseline/shared";
import { renderBlockImageToFile } from "./rasterizer.js";
import { buildFFmpegArgs, runFFmpeg, probeMediaDuration } from "./ffmpeg.js";
import type { RenderBlock, RenderPlan } from "./ffmpeg.js";
import { resolveFontPath } from "./font-resolver.js";
import { uploadToR2, getPresignedDownloadUrl, downloadFromR2 } from "./storage.js";

// ---- DB row types (from schema) ---------------------------------------------
// These mirror the JSONB-stored project fields as they come out of Postgres.

export interface ProjectRow {
  id: string;
  name: string;
  canvas: { width: number; height: number; fps: number };
  assets: {
    audio?: string | { path?: string; filename?: string };
    background: { type?: string; path: string; loop?: boolean; fit?: string };
  };
  fonts: Font[];
  styles: Style[];
  placements: Placement[];
  renderProfiles: RenderProfile[];
}

export interface SegmentRow {
  id: string;
  sortOrder: number;
  startMs: number;
  endMs: number;
  blocks: Block[];
}

// ---- Render plan types (re-exported for routes) ----------------------------

export type { RenderBlock, RenderPlan };

// ---- Position calculation ---------------------------------------------------

/**
 * Compute overlay (x, y) from anchor + margins and known image dimensions.
 * Ports verselinePlacementTag / verselineOverlayPosition from verseline_render.go
 * but yields concrete pixel values instead of filter expressions.
 */
function resolveOverlayPosition(
  anchor: string,
  marginX: number,
  marginY: number,
  imageW: number,
  imageH: number,
  canvasW: number,
  canvasH: number,
): { x: number; y: number } {
  const a = anchor
    .toLowerCase()
    .trim()
    .replace(/[-\s]+/g, "_");

  switch (a) {
    case "top_left":
      return { x: marginX, y: marginY };
    case "top_center":
      return { x: Math.floor((canvasW - imageW) / 2), y: marginY };
    case "top_right":
      return { x: canvasW - imageW - marginX, y: marginY };
    case "center_left":
    case "middle_left":
      return { x: marginX, y: Math.floor((canvasH - imageH) / 2) };
    case "center":
    case "middle_center":
      return {
        x: Math.floor((canvasW - imageW) / 2),
        y: Math.floor((canvasH - imageH) / 2),
      };
    case "center_right":
    case "middle_right":
      return {
        x: canvasW - imageW - marginX,
        y: Math.floor((canvasH - imageH) / 2),
      };
    case "bottom_left":
      return { x: marginX, y: canvasH - imageH - marginY };
    case "bottom_right":
      return { x: canvasW - imageW - marginX, y: canvasH - imageH - marginY };
    case "bottom_center":
    default:
      return { x: Math.floor((canvasW - imageW) / 2), y: canvasH - imageH - marginY };
  }
}

// ---- Style normalisation (snake_case → camelCase) ---------------------------
// The shared Style type uses snake_case keys as defined in the Zod schema.

function styleToRasterConfig(style: Style, fontFamily: string) {
  return {
    font: fontFamily || style.font,
    size: style.size,
    color: style.color,
    outlineColor: style.outline_color,
    outline: style.outline,
    shadowColor: style.shadow_color,
    shadow: style.shadow,
    textBg: style.text_bg,
    textBgPad: style.text_bg_pad,
    textBgRadius: style.text_bg_radius,
    align: (style.align ?? "center") as "left" | "center" | "right",
  };
}

// ---- Temp dir helpers -------------------------------------------------------

async function makeTempDir(prefix: string): Promise<string> {
  const dir = await fs.promises.mkdtemp(
    path.join(os.tmpdir(), `verseline-${prefix}-`),
  );
  return dir;
}

// ---- Asset resolution -------------------------------------------------------

const ASSET_CACHE_DIR =
  process.env.ASSET_CACHE_DIR ??
  path.join(os.tmpdir(), "verseline-assets");

/**
 * Resolve a project asset (background image/video, audio) to an absolute local
 * file path, downloading from R2 if necessary.
 *
 * Resolution order:
 *   1. Absolute path that exists on disk → use directly
 *   2. On-disk cache in ASSET_CACHE_DIR
 *   3. Download from R2 (try key as-is, then under projects/{projectId}/assets/)
 */
async function resolveAssetPath(
  assetPath: string,
  projectId: string,
): Promise<string> {
  // 1. Absolute path on disk
  if (path.isAbsolute(assetPath) && fs.existsSync(assetPath)) {
    return assetPath;
  }

  // Determine local cache path from the basename
  const basename = path.basename(assetPath);
  const localCached = path.join(ASSET_CACHE_DIR, projectId, basename);

  // 2. On-disk cache
  if (fs.existsSync(localCached)) {
    return localCached;
  }

  // 3. Download from R2
  await fs.promises.mkdir(path.dirname(localCached), { recursive: true });

  // Try the path as a direct R2 key first (e.g. "projects/.../assets/background/bg.jpg")
  const keysToTry = [assetPath];

  // If it doesn't look like a full R2 key, also try under the project assets prefix
  if (!assetPath.startsWith("projects/")) {
    keysToTry.push(`projects/${projectId}/assets/${basename}`);
    keysToTry.push(`projects/${projectId}/assets/background/${basename}`);
    keysToTry.push(`projects/${projectId}/assets/audio/${basename}`);
  }

  for (const r2Key of keysToTry) {
    try {
      const stream = await downloadFromR2(r2Key);
      const chunks: Buffer[] = [];
      const reader = stream.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }
      await fs.promises.writeFile(localCached, Buffer.concat(chunks));
      return localCached;
    } catch {
      // try next key
    }
  }

  throw new Error(
    `Cannot resolve asset "${assetPath}" for project ${projectId}. ` +
    `Upload it via the assets API or provide an absolute path.`,
  );
}

// ---- Core plan builder ------------------------------------------------------

/**
 * Build a RenderPlan: rasterise each block to a PNG and record overlay params.
 * Ports buildVerselineRenderPlan + renderVerselineBlockImages.
 */
export async function buildRenderPlan(
  project: ProjectRow,
  segments: SegmentRow[],
  profile: {
    videoCodec?: string;
    audioCodec?: string;
    audioBitrate?: string;
    crf?: number;
    preset?: string;
    pixFmt?: string;
    colorPrimaries?: string;
    colorTrc?: string;
    colorSpace?: string;
    colorRange?: string;
    extraArgs?: string[];
  },
  outputPath: string,
  tempDir: string,
  opts: {
    inputOffsetMs?: number;
    durationMs?: number;
    width?: number;
    height?: number;
    fps?: number;
  } = {},
): Promise<RenderPlan> {
  const canvasW = opts.width ?? project.canvas.width;
  const canvasH = opts.height ?? project.canvas.height;
  const fps = opts.fps ?? project.canvas.fps;

  // Build lookup maps
  const styleById = new Map<string, Style>(
    (project.styles ?? []).map((s) => [s.id, s]),
  );
  const placementById = new Map<string, Placement>(
    (project.placements ?? []).map((p) => [p.id, p]),
  );
  const fontById = new Map<string, Font>(
    (project.fonts ?? []).map((f) => [f.id, f]),
  );

  // Resolve font paths and family names up front
  const fontPathById = new Map<string, string>();
  const fontFamilyById = new Map<string, string>();
  for (const font of project.fonts ?? []) {
    fontFamilyById.set(font.id, font.family ?? font.id);
    try {
      const fp = await resolveFontPath(font, project.id);
      fontPathById.set(font.id, fp);
    } catch {
      // non-fatal — will fall back to system font matching during render
    }
  }

  // Determine per-style font file path (style.font is a font ID)
  const fontPathByStyleId = new Map<string, string>();
  const fontFamilyByStyleId = new Map<string, string>();
  for (const style of project.styles ?? []) {
    const fontId = style.font;
    const fp = fontPathById.get(fontId);
    if (fp) fontPathByStyleId.set(style.id, fp);
    const family = fontFamilyById.get(fontId) ?? style.font;
    fontFamilyByStyleId.set(style.id, family);
  }

  const inputOffset = opts.inputOffsetMs ?? 0;
  const explicitDuration = opts.durationMs ?? 0;

  // Collect all resolved blocks
  interface ResolvedBlock {
    text: string;
    startMs: number;
    endMs: number;
    style: Style;
    styleFamily: string;
    fontPath?: string;
    placement: Placement;
    spanColors: Record<string, string>;
  }

  const resolvedBlocks: ResolvedBlock[] = [];
  let clipEndMs = 0;

  for (const seg of segments) {
    const startMs = seg.startMs;
    const endMs = seg.endMs;
    clipEndMs = Math.max(clipEndMs, endMs);

    for (const block of seg.blocks) {
      const styleId =
        (block.style ?? "").trim() || (project.styles?.[0]?.id ?? "");
      const style = styleById.get(styleId);
      if (!style) continue;

      const placementId =
        (block.placement ?? "").trim() || (project.placements?.[0]?.id ?? "");
      const placement = placementById.get(placementId);
      if (!placement) continue;

      const text = (block.text ?? "").trim();
      if (!text) continue;

      // Build span colors from project styles so inline tags resolve correctly
      const spanColors: Record<string, string> = {};
      for (const s of project.styles ?? []) {
        if (s.color) spanColors[s.id] = s.color;
      }

      resolvedBlocks.push({
        text,
        startMs,
        endMs,
        style,
        styleFamily: fontFamilyByStyleId.get(styleId) ?? style.font,
        fontPath: fontPathByStyleId.get(styleId),
        placement,
        spanColors,
      });
    }
  }

  // Apply time-window clipping if a duration is specified
  let finalBlocks = resolvedBlocks;
  let totalDurationMs = explicitDuration > 0 ? explicitDuration : clipEndMs;

  if (explicitDuration > 0) {
    const windowEnd = inputOffset + explicitDuration;
    finalBlocks = resolvedBlocks
      .filter((b) => !(b.endMs <= inputOffset || b.startMs >= windowEnd))
      .map((b) => ({
        ...b,
        startMs: Math.max(b.startMs, inputOffset) - inputOffset,
        endMs: Math.min(b.endMs, windowEnd) - inputOffset,
      }));
    totalDurationMs = explicitDuration;
  }

  // Render each block to a PNG
  const layerDir = outputPath.replace(/\.[^.]+$/, ".layers");
  await fs.promises.mkdir(layerDir, { recursive: true });

  const renderBlocks: RenderBlock[] = [];

  for (let i = 0; i < finalBlocks.length; i++) {
    const b = finalBlocks[i];
    const imagePath = path.join(layerDir, `block-${String(i + 1).padStart(3, "0")}.png`);

    await renderBlockImageToFile(
      {
        text: b.text,
        style: styleToRasterConfig(b.style, b.styleFamily),
        placement: {
          maxWidth: b.placement.max_width,
          maxHeight: b.placement.max_height,
        },
        canvasWidth: canvasW,
        spanColors: b.spanColors,
        fontPath: b.fontPath,
      },
      imagePath,
    );

    // Measure the rendered PNG to compute concrete overlay position
    const { width: imgW, height: imgH } = await getPngDimensions(imagePath);
    const marginX = b.placement.margin_x ?? 0;
    const marginY = b.placement.margin_y ?? 0;
    const { x, y } = resolveOverlayPosition(
      b.placement.anchor ?? "bottom_center",
      marginX,
      marginY,
      imgW,
      imgH,
      canvasW,
      canvasH,
    );

    renderBlocks.push({
      imagePath,
      startSecs: b.startMs / 1000,
      endSecs: b.endMs / 1000,
      x,
      y,
    });
  }

  // Resolve background and audio to absolute local paths
  const bgPath = await resolveAssetPath(
    project.assets.background.path,
    project.id,
  );

  let audioPath: string | undefined;
  const rawAudio = project.assets.audio;
  if (rawAudio) {
    // audio may be a string path or an object { path, filename } from the assets confirm route
    const audioStr =
      typeof rawAudio === "string"
        ? rawAudio
        : (rawAudio as { path?: string }).path;
    if (audioStr) {
      audioPath = await resolveAssetPath(audioStr, project.id);
    }
  }

  return {
    outputPath,
    background: {
      type: project.assets.background.type ?? "image",
      path: bgPath,
      fit: project.assets.background.fit ?? "cover",
      loop: project.assets.background.loop,
    },
    audio: audioPath,
    canvas: { width: canvasW, height: canvasH, fps },
    profile,
    blocks: renderBlocks,
    totalDurationMs,
    inputOffsetMs: inputOffset > 0 ? inputOffset : undefined,
  };
}

// ---- PNG dimension reader ---------------------------------------------------

async function getPngDimensions(
  filePath: string,
): Promise<{ width: number; height: number }> {
  // PNG header: bytes 16-20 = width (BE uint32), 20-24 = height (BE uint32)
  const fd = await fs.promises.open(filePath, "r");
  try {
    const buf = Buffer.alloc(24);
    await fd.read(buf, 0, 24, 0);
    const width = buf.readUInt32BE(16);
    const height = buf.readUInt32BE(20);
    return { width, height };
  } finally {
    await fd.close();
  }
}

// ---- Preview render ---------------------------------------------------------

/**
 * Renders a single segment as a low-quality preview clip.
 * Returns the local file path of the rendered MP4.
 */
export async function renderPreview(
  projectId: string,
  segmentIndex: number, // 0-based
  project: ProjectRow,
  allSegments: SegmentRow[],
): Promise<{ localPath: string }> {
  const segment = allSegments[segmentIndex];
  if (!segment) {
    throw new Error(
      `Segment index ${segmentIndex} out of range (${allSegments.length} segments)`,
    );
  }

  const padding = 250; // ms
  const windowStart = Math.max(segment.startMs - padding, 0);
  const windowEnd = segment.endMs + padding;
  const durationMs = windowEnd - windowStart;

  const tempDir = await makeTempDir("preview");
  const outputPath = path.join(
    tempDir,
    `preview-seg${String(segmentIndex + 1).padStart(3, "0")}.mp4`,
  );

  const canvasW = project.canvas.width;
  const canvasH = project.canvas.height;

  const previewProfile = {
    videoCodec: "libx264",
    audioCodec: "aac",
    audioBitrate: "96k",
    crf: 32,
    preset: "veryfast",
    pixFmt: "yuv420p",
  };

  const plan = await buildRenderPlan(
    project,
    allSegments,
    previewProfile,
    outputPath,
    tempDir,
    {
      inputOffsetMs: windowStart,
      durationMs,
      width: Math.max(Math.floor(canvasW / 2), 540),
      height: Math.max(Math.floor(canvasH / 2), 960),
      fps: Math.min(project.canvas.fps, 24),
    },
  );

  const ffmpegArgs = buildFFmpegArgs(plan);
  await runFFmpeg(ffmpegArgs, { totalDurationMs: durationMs });

  return { localPath: outputPath };
}

// ---- Full render ------------------------------------------------------------

/**
 * Renders the full video from all segments using the specified render profile.
 * Returns the local file path of the rendered output.
 */
export async function renderProject(
  projectId: string,
  project: ProjectRow,
  segments: SegmentRow[],
  profileId: string,
  onProgress?: (percent: number) => void,
): Promise<{ localPath: string }> {
  const profile = (project.renderProfiles ?? []).find(
    (p) => p.id === profileId,
  );
  if (!profile && profileId !== "default") {
    throw new Error(`Unknown render profile "${profileId}"`);
  }

  const p: RenderProfile = profile ?? ({ id: "default" } as RenderProfile);
  const resolvedProfile = {
    videoCodec: p.video_codec ?? "libx264",
    audioCodec: p.audio_codec ?? "aac",
    audioBitrate: p.audio_bitrate ?? "192k",
    crf: p.crf ?? 23,
    preset: p.preset ?? "",
    pixFmt: p.pix_fmt ?? "yuv420p",
    colorPrimaries: p.color_primaries ?? "",
    colorTrc: p.color_trc ?? "",
    colorSpace: p.colorspace ?? "",
    colorRange: p.color_range ?? "",
    extraArgs: p.extra_args ?? [],
  };

  const width = (p.width ?? 0) > 0 ? p.width! : project.canvas.width;
  const height = (p.height ?? 0) > 0 ? p.height! : project.canvas.height;
  const fps = (p.fps ?? 0) > 0 ? p.fps! : project.canvas.fps;

  const tempDir = await makeTempDir("render");

  // Build output filename from profile or project name
  const suffix =
    (p.output_suffix ?? "").trim() ||
    (profileId !== "default" ? profileId : "");
  const baseName = (project.name ?? "verseline").replace(/[^a-zA-Z0-9_-]/g, "_");
  const outputName = suffix ? `${baseName}.${suffix}.mp4` : `${baseName}.mp4`;
  const outputPath = path.join(tempDir, outputName);

  // Compute total duration from all segments
  const totalDurationMs =
    segments.length > 0
      ? Math.max(...segments.map((s) => s.endMs))
      : 0;

  const plan = await buildRenderPlan(
    project,
    segments,
    resolvedProfile,
    outputPath,
    tempDir,
    { width, height, fps },
  );

  const ffmpegArgs = buildFFmpegArgs(plan);
  await runFFmpeg(ffmpegArgs, {
    totalDurationMs: plan.totalDurationMs,
    onProgress,
  });

  return { localPath: outputPath };
}
