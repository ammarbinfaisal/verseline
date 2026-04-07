/**
 * FFmpeg command building and execution service.
 * Ports buildVerselineFFmpegArgs / runVerselineFFmpeg / scanVerselineProgress
 * from verseline_workflow.go.
 */
import type { RenderProfile } from "@verseline/shared";

// ---- Types ------------------------------------------------------------------

export interface RenderBlock {
  imagePath: string; // absolute path to the rendered PNG overlay
  startSecs: number;
  endSecs: number;
  x: number; // overlay x position in the video
  y: number; // overlay y position in the video
}

export interface RenderPlan {
  outputPath: string;
  background: {
    type: string; // "image" | "video"
    path: string;
    fit: string; // "cover" | "contain"
    loop?: boolean;
  };
  audio?: string; // absolute path, or undefined if no audio
  canvas: {
    width: number;
    height: number;
    fps: number;
  };
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
  };
  blocks: RenderBlock[];
  totalDurationMs: number; // total clip duration for progress calculation
  inputOffsetMs?: number; // seek offset applied to video/audio inputs
}

// ---- FFmpeg args builder ----------------------------------------------------

/**
 * Port of buildVerselineFFmpegArgs from verseline_workflow.go.
 * Builds the full ffmpeg argument array for a render plan.
 */
export function buildFFmpegArgs(plan: RenderPlan): string[] {
  const args: string[] = ["-y", "-progress", "pipe:1", "-nostats"];

  const backgroundType = (plan.background.type ?? "image").toLowerCase();
  const backgroundLoop =
    plan.background.loop !== undefined
      ? plan.background.loop
      : backgroundType !== "video";

  // --- Background input ---
  switch (backgroundType) {
    case "image":
      args.push(
        "-loop", "1",
        "-framerate", String(plan.canvas.fps),
        "-i", plan.background.path,
      );
      break;
    case "video":
      if (plan.inputOffsetMs && plan.inputOffsetMs > 0) {
        args.push("-ss", msToSecs(plan.inputOffsetMs));
      }
      if (backgroundLoop) {
        args.push("-stream_loop", "-1");
      }
      if (plan.totalDurationMs > 0) {
        args.push("-t", msToSecs(plan.totalDurationMs));
      }
      args.push("-i", plan.background.path);
      break;
    default:
      throw new Error(`Unsupported background.type "${plan.background.type}"`);
  }

  // --- Audio input ---
  if (plan.audio) {
    if (plan.inputOffsetMs && plan.inputOffsetMs > 0) {
      args.push("-ss", msToSecs(plan.inputOffsetMs));
    }
    if (plan.totalDurationMs > 0) {
      args.push("-t", msToSecs(plan.totalDurationMs));
    }
    args.push("-i", plan.audio);
  }

  // --- Overlay PNG inputs (one per block) ---
  const firstOverlayInput = plan.audio ? 2 : 1;
  for (const block of plan.blocks) {
    args.push("-loop", "1", "-i", block.imagePath);
  }

  // --- Filter complex ---
  const { filterGraph, finalLabel } = buildOverlayFilterGraph(
    plan,
    firstOverlayInput,
  );
  args.push("-filter_complex", filterGraph);

  // --- Output mapping ---
  args.push("-r", String(plan.canvas.fps));
  args.push("-map", finalLabel);

  if (plan.audio) {
    args.push(
      "-map", "1:a:0",
      "-c:a", plan.profile.audioCodec ?? "aac",
      "-b:a", plan.profile.audioBitrate ?? "192k",
      "-shortest",
    );
  } else if (plan.totalDurationMs > 0) {
    args.push("-t", msToSecs(plan.totalDurationMs));
  }

  // --- Video codec settings ---
  args.push("-c:v", plan.profile.videoCodec ?? "libx264");
  if (plan.profile.crf && plan.profile.crf > 0) {
    args.push("-crf", String(plan.profile.crf));
  }
  if ((plan.profile.preset ?? "").trim()) {
    args.push("-preset", plan.profile.preset!);
  }
  args.push("-pix_fmt", plan.profile.pixFmt ?? "yuv420p");

  if ((plan.profile.colorPrimaries ?? "").trim()) {
    args.push("-color_primaries", plan.profile.colorPrimaries!);
  }
  if ((plan.profile.colorTrc ?? "").trim()) {
    args.push("-color_trc", plan.profile.colorTrc!);
  }
  if ((plan.profile.colorSpace ?? "").trim()) {
    args.push("-colorspace", plan.profile.colorSpace!);
  }
  if ((plan.profile.colorRange ?? "").trim()) {
    args.push("-color_range", plan.profile.colorRange!);
  }

  args.push("-movflags", "+faststart");

  if (plan.profile.extraArgs?.length) {
    args.push(...plan.profile.extraArgs);
  }

  args.push(plan.outputPath);

  return args;
}

// ---- Filter graph builder ---------------------------------------------------

function buildOverlayFilterGraph(
  plan: RenderPlan,
  firstOverlayInput: number,
): { filterGraph: string; finalLabel: string } {
  const parts: string[] = [
    `[0:v]${buildBaseFilter(plan)}[base0]`,
  ];

  let current = "base0";
  for (let i = 0; i < plan.blocks.length; i++) {
    const block = plan.blocks[i];
    const overlayInput = firstOverlayInput + i;
    const next = `base${i + 1}`;
    const startSecs = block.startSecs.toFixed(3);
    const endSecs = block.endSecs.toFixed(3);
    // Use explicit x/y computed from anchor by the renderer
    parts.push(
      `[${current}][${overlayInput}:v]overlay=${block.x}:${block.y}:enable='between(t,${startSecs},${endSecs})'[${next}]`,
    );
    current = next;
  }

  parts.push(`[${current}]format=yuv420p[vout]`);
  return { filterGraph: parts.join(";"), finalLabel: "[vout]" };
}

function buildBaseFilter(plan: RenderPlan): string {
  const { width, height } = plan.canvas;
  const fit = (plan.background.fit ?? "cover").toLowerCase();

  if (fit === "contain") {
    return (
      `scale=${width}:${height}:force_original_aspect_ratio=decrease,` +
      `pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`
    );
  }
  // Default: cover (scale up + crop)
  return (
    `scale=${width}:${height}:force_original_aspect_ratio=increase,` +
    `crop=${width}:${height},setsar=1`
  );
}

// ---- FFmpeg runner ----------------------------------------------------------

/**
 * Port of runVerselineFFmpeg from verseline_workflow.go.
 * Spawns FFmpeg, parses -progress pipe:1 output for percent updates,
 * and resolves when FFmpeg exits successfully.
 */
export async function runFFmpeg(
  args: string[],
  options: {
    totalDurationMs?: number;
    onProgress?: (percent: number) => void;
  } = {},
): Promise<void> {
  const { totalDurationMs = 0, onProgress } = options;

  const ffmpegBin = process.env.FFMPEG_BIN ?? "ffmpeg";

  const proc = Bun.spawn([ffmpegBin, ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });

  // Collect stderr in case we need to include it in an error message
  let stderrText = "";
  const stderrReader = proc.stderr?.getReader();
  const drainStderr = stderrReader
    ? (async () => {
        const decoder = new TextDecoder();
        for (;;) {
          const { done, value } = await stderrReader.read();
          if (done) break;
          stderrText += decoder.decode(value, { stream: true });
        }
      })()
    : Promise.resolve();

  // Parse progress from stdout
  let progressErr: Error | null = null;
  const stdoutReader = proc.stdout?.getReader();
  const parseProgress = stdoutReader
    ? (async () => {
        const decoder = new TextDecoder();
        let buf = "";
        for (;;) {
          const { done, value } = await stdoutReader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            const eqIdx = line.indexOf("=");
            if (eqIdx < 0) continue;
            const key = line.slice(0, eqIdx);
            const val = line.slice(eqIdx + 1);
            if (key === "out_time_ms") {
              const micros = parseInt(val, 10);
              if (!isNaN(micros) && totalDurationMs > 0) {
                const outMs = micros / 1000;
                const pct = Math.min(100, (outMs / totalDurationMs) * 100);
                onProgress?.(pct);
              }
            } else if (key === "progress" && val === "end") {
              onProgress?.(100);
            }
          }
        }
      })()
    : Promise.resolve();

  const exitCode = await proc.exited;
  await Promise.all([drainStderr, parseProgress]);

  const trimmedStderr = stderrText.trim();
  if (trimmedStderr) {
    console.error("[ffmpeg stderr]", trimmedStderr);
  }

  if (exitCode !== 0) {
    const detail = trimmedStderr ? `: ${trimmedStderr}` : "";
    throw new Error(`FFmpeg exited with code ${exitCode}${detail}`);
  }
}

// ---- Duration probe ---------------------------------------------------------

/**
 * Get media duration in milliseconds using ffprobe.
 */
export async function probeMediaDuration(filePath: string): Promise<number> {
  const ffprobeBin = process.env.FFPROBE_BIN ?? "ffprobe";

  const proc = Bun.spawnSync(
    [
      ffprobeBin,
      "-v", "quiet",
      "-print_format", "json",
      "-show_format",
      filePath,
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  if (proc.exitCode !== 0) {
    throw new Error(
      `ffprobe failed for "${filePath}": ${proc.stderr?.toString().trim() ?? ""}`,
    );
  }

  const raw = proc.stdout?.toString() ?? "{}";
  let parsed: { format?: { duration?: string } };
  try {
    parsed = JSON.parse(raw) as { format?: { duration?: string } };
  } catch {
    throw new Error(`Failed to parse ffprobe output for "${filePath}"`);
  }

  const durationStr = parsed.format?.duration;
  if (!durationStr) {
    throw new Error(`ffprobe returned no duration for "${filePath}"`);
  }

  const secs = parseFloat(durationStr);
  if (isNaN(secs)) {
    throw new Error(`ffprobe returned invalid duration "${durationStr}"`);
  }

  return Math.round(secs * 1000);
}

// ---- Utilities --------------------------------------------------------------

/** Convert milliseconds to a seconds string suitable for FFmpeg (-ss, -t). */
function msToSecs(ms: number): string {
  return (ms / 1000).toFixed(3);
}
