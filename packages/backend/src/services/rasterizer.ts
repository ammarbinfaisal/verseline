/**
 * Text-to-PNG rasterization service.
 * Ports renderVerselineBlockImageGoText / verselineParseTextSpans from verseline_raster.go
 * using @napi-rs/canvas instead of the Go text-rendering stack.
 */
import {
  createCanvas,
  GlobalFonts,
  type SKRSContext2D,
} from "@napi-rs/canvas";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ---- Types ------------------------------------------------------------------

export interface StyleConfig {
  font: string; // font family name (already resolved to the registered family)
  size: number;
  color?: string; // hex e.g. "#FFFFFF"
  outlineColor?: string;
  outline?: number; // px
  shadowColor?: string;
  shadow?: number; // px offset
  textBg?: string; // hex background color
  textBgPad?: number;
  textBgRadius?: number;
  align?: "left" | "center" | "right";
}

export interface PlacementConfig {
  maxWidth?: number;
  maxHeight?: number;
}

export interface RenderBlockOptions {
  text: string; // may contain <styleId>content</styleId> inline tags
  style: StyleConfig;
  placement: PlacementConfig;
  canvasWidth: number; // used to derive maxWidth when placement.maxWidth is absent
  spanColors?: Record<string, string>; // styleId → hex color
  fontPath?: string; // absolute path to the font file (already downloaded)
}

// ---- Font registration cache ------------------------------------------------

const registeredFonts = new Set<string>();

/**
 * Register a font file with @napi-rs/canvas so it can be referenced by family
 * name in canvas contexts.  Idempotent — won't re-register the same path.
 */
export function registerFontPath(fontPath: string, family?: string): void {
  if (registeredFonts.has(fontPath)) return;
  if (!fs.existsSync(fontPath)) return;
  if (family) {
    GlobalFonts.registerFromPath(fontPath, family);
  } else {
    GlobalFonts.registerFromPath(fontPath);
  }
  registeredFonts.add(fontPath);
}

// ---- Inline style-tag parser ------------------------------------------------

interface TextSpan {
  text: string;
  styleId: string; // empty = default style
}

/**
 * Port of verselineParseTextSpans from verseline_render.go.
 * Splits text containing <styleID>…</styleID> tags into spans.
 * Tags do not nest; an open tag must be closed before another opens.
 */
export function parseTextSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    const openIdx = remaining.indexOf("<");
    if (openIdx < 0) {
      spans.push({ text: remaining, styleId: "" });
      break;
    }

    const closeAngle = remaining.indexOf(">", openIdx);
    if (closeAngle < 0) {
      spans.push({ text: remaining, styleId: "" });
      break;
    }

    const tagName = remaining.slice(openIdx + 1, closeAngle);
    if (
      tagName === "" ||
      tagName.startsWith("/") ||
      /[\s\t\n]/.test(tagName)
    ) {
      // Not a valid style tag — treat as literal text up to and including '>'
      spans.push({ text: remaining.slice(0, closeAngle + 1), styleId: "" });
      remaining = remaining.slice(closeAngle + 1);
      continue;
    }

    const closeTag = `</${tagName}>`;
    const closeTagIdx = remaining.indexOf(closeTag, openIdx);
    if (closeTagIdx < 0) {
      // No closing tag — treat as literal
      spans.push({ text: remaining.slice(0, closeAngle + 1), styleId: "" });
      remaining = remaining.slice(closeAngle + 1);
      continue;
    }

    // Emit any text before the opening tag
    if (openIdx > 0) {
      spans.push({ text: remaining.slice(0, openIdx), styleId: "" });
    }

    const innerStart = closeAngle + 1;
    const innerEnd = closeTagIdx;
    spans.push({ text: remaining.slice(innerStart, innerEnd), styleId: tagName });
    remaining = remaining.slice(innerEnd + closeTag.length);
  }

  return spans;
}

/**
 * Strip <styleID>…</styleID> tags from text, preserving their content.
 */
export function stripStyleTags(text: string): string {
  return parseTextSpans(text)
    .map((s) => s.text)
    .join("");
}

/**
 * Build a per-character color array (same length as the plain-text string).
 * Characters inside a tagged span get that span's color from spanColors;
 * others get the fallback.
 */
function buildCharColors(
  spans: TextSpan[],
  fallback: string,
  spanColors: Record<string, string>,
): string[] {
  const colors: string[] = [];
  for (const span of spans) {
    const color =
      span.styleId && spanColors[span.styleId]
        ? spanColors[span.styleId]
        : fallback;
    for (let i = 0; i < span.text.length; i++) {
      colors.push(color);
    }
  }
  return colors;
}

// ---- Color utilities --------------------------------------------------------

function parseHexColor(hex: string, alpha = 1): string {
  const trimmed = hex.trim().replace(/^#/, "");
  if (trimmed.length === 6) {
    const r = parseInt(trimmed.slice(0, 2), 16);
    const g = parseInt(trimmed.slice(2, 4), 16);
    const b = parseInt(trimmed.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }
  if (trimmed.length === 8) {
    const r = parseInt(trimmed.slice(0, 2), 16);
    const g = parseInt(trimmed.slice(2, 4), 16);
    const b = parseInt(trimmed.slice(4, 6), 16);
    const a = parseInt(trimmed.slice(6, 8), 16) / 255;
    return `rgba(${r},${g},${b},${a * alpha})`;
  }
  return hex; // pass through if unrecognised
}

// ---- Word-wrap helper -------------------------------------------------------

interface WrappedLine {
  text: string;
  width: number; // measured px
}

function wrapText(
  ctx: SKRSContext2D,
  plainText: string,
  maxWidth: number,
): WrappedLine[] {
  const lines: WrappedLine[] = [];
  const paragraphs = plainText.split("\n");

  for (const para of paragraphs) {
    if (para.trim() === "") {
      const m = ctx.measureText(" ");
      lines.push({ text: "", width: 0 });
      continue;
    }

    const words = para.split(" ");
    let current = "";

    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      const { width } = ctx.measureText(candidate);
      if (width > maxWidth && current) {
        lines.push({ text: current, width: ctx.measureText(current).width });
        current = word;
      } else {
        current = candidate;
      }
    }
    if (current) {
      lines.push({ text: current, width: ctx.measureText(current).width });
    }
  }

  return lines;
}

// ---- Rounded rect fill ------------------------------------------------------

function drawRoundedRect(
  ctx: SKRSContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  if (w <= 0 || h <= 0) return;
  const radius = Math.min(r, Math.floor(Math.min(w, h) / 2));
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}

// ---- Per-character colored text drawing -------------------------------------

/**
 * Draw a line of text with per-character color switching.
 * charColors must be the same length as line.text (unicode chars).
 */
function drawTextColored(
  ctx: SKRSContext2D,
  line: string,
  charColors: string[],
  x: number,
  y: number,
  fallback: string,
  drawMode: "fill" | "stroke",
): void {
  let cursor = x;
  let runStart = 0;

  const chars = [...line]; // spread handles surrogate pairs
  const flush = (end: number, color: string) => {
    if (end <= runStart) return;
    const segment = chars.slice(runStart, end).join("");
    if (drawMode === "stroke") {
      ctx.strokeStyle = color;
      ctx.strokeText(segment, cursor, y);
    } else {
      ctx.fillStyle = color;
      ctx.fillText(segment, cursor, y);
    }
    cursor += ctx.measureText(segment).width;
    runStart = end;
  };

  let currentColor = charColors[0] ?? fallback;
  for (let i = 1; i < chars.length; i++) {
    const c = charColors[i] ?? fallback;
    if (c !== currentColor) {
      flush(i, currentColor);
      currentColor = c;
    }
  }
  flush(chars.length, currentColor);
}

// ---- Main export ------------------------------------------------------------

/**
 * Render a block of styled text to a transparent PNG buffer.
 * Ports renderVerselineBlockImageGoText from verseline_raster.go.
 */
export async function renderBlockImage(
  options: RenderBlockOptions,
): Promise<Buffer> {
  const { text, style, placement, canvasWidth, spanColors = {}, fontPath } = options;

  // Register the font file if a path is supplied
  if (fontPath) {
    registerFontPath(fontPath, style.font);
  }

  const fontSize = Math.max(style.size ?? 24, 1);
  const outline = Math.max(style.outline ?? 0, 0);
  const shadow = Math.max(style.shadow ?? 0, 0);
  const effectPad = Math.max(4, outline + shadow + 2);
  const hasTextBg = (style.textBg ?? "").trim() !== "";
  const bgPad = hasTextBg ? Math.max(style.textBgPad ?? 0, 4) : 0;
  const pad = effectPad + bgPad;

  const primaryColor = (style.color ?? "#FFFFFF").trim() || "#FFFFFF";
  const outlineColor = (style.outlineColor ?? "#000000").trim() || "#000000";

  // Derive max width for text wrapping
  let maxWidth = placement.maxWidth ?? 0;
  if (maxWidth <= 0) {
    maxWidth = Math.max(canvasWidth - 2 * pad, 200);
  }

  // Parse inline tags
  const spans = parseTextSpans(text);
  const plainText = spans.map((s) => s.text).join("");
  const charColors = buildCharColors(spans, primaryColor, spanColors);

  // --- Measure pass to figure out image dimensions ---
  const fontSpec = `${fontSize}px "${style.font}"`;
  // Use an off-screen canvas just to measure
  const measure = createCanvas(1, 1);
  const mctx = measure.getContext("2d");
  mctx.font = fontSpec;
  const wrappedLines = wrapText(mctx, plainText, maxWidth);

  // Approximate line height from font metrics
  const lineMetrics = mctx.measureText("Mg");
  const ascent = lineMetrics.actualBoundingBoxAscent || fontSize * 0.8;
  const descent = lineMetrics.actualBoundingBoxDescent || fontSize * 0.2;
  const lineHeight = ascent + descent;

  let imageWidth = pad * 2;
  const imageHeight = pad * 2 + wrappedLines.length * lineHeight;
  for (const line of wrappedLines) {
    imageWidth = Math.max(imageWidth, line.width + pad * 2);
  }
  // Ensure minimum size
  imageWidth = Math.max(imageWidth, 1);
  const imageHeightInt = Math.max(Math.ceil(imageHeight), 1);
  const imageWidthInt = Math.max(Math.ceil(imageWidth), 1);

  // --- Render pass ---
  const canvas = createCanvas(imageWidthInt, imageHeightInt);
  const ctx = canvas.getContext("2d");
  ctx.font = fontSpec;
  ctx.textBaseline = "alphabetic";

  // Text background
  if (hasTextBg && style.textBg) {
    ctx.fillStyle = parseHexColor(style.textBg, 200 / 255);
    const bgX = effectPad;
    const bgY = effectPad;
    const bgW = imageWidthInt - effectPad * 2;
    const bgH = imageHeightInt - effectPad * 2;
    const bgRadius = Math.min(
      style.textBgRadius ?? 0,
      Math.floor(Math.min(bgW, bgH) / 2),
    );
    drawRoundedRect(ctx, bgX, bgY, bgW, bgH, bgRadius);
  }

  const shadowColorStr = (() => {
    const base = outlineColor;
    if ((style.shadowColor ?? "").trim()) {
      return parseHexColor(style.shadowColor!, 170 / 255);
    }
    // Same RGB as outline color but 170/255 alpha
    const m = base.match(/rgba?\((\d+),(\d+),(\d+)/);
    if (m) return `rgba(${m[1]},${m[2]},${m[3]},${170 / 255})`;
    return parseHexColor(base, 170 / 255);
  })();

  const align = (style.align ?? "center").toLowerCase() as
    | "left"
    | "center"
    | "right";
  const contentWidth = imageWidthInt - pad * 2;

  let y = pad + ascent;
  for (const line of wrappedLines) {
    let x: number;
    switch (align) {
      case "left":
        x = pad;
        break;
      case "right":
        x = pad + Math.max(contentWidth - line.width, 0);
        break;
      default:
        x = pad + Math.max(contentWidth - line.width, 0) / 2;
    }

    // Shadow pass (single color)
    if (shadow > 0) {
      ctx.fillStyle = shadowColorStr;
      ctx.fillText(line.text, x + shadow, y + shadow);
    }

    // Outline pass (stroke each offset pixel within the circle)
    if (outline > 0) {
      ctx.lineWidth = outline * 2;
      ctx.strokeStyle = parseHexColor(outlineColor);
      // Use canvas shadow as outline approximation: stroke with lineWidth
      // For pixel-perfect circle outline, iterate offsets like Go does
      for (let dy = -outline; dy <= outline; dy++) {
        for (let dx = -outline; dx <= outline; dx++) {
          if (dx === 0 && dy === 0) continue;
          if (dx * dx + dy * dy > outline * outline) continue;
          ctx.strokeStyle = parseHexColor(outlineColor);
          ctx.lineWidth = 1;
          ctx.strokeText(line.text, x + dx, y + dy);
        }
      }
    }

    // Fill pass — per-character color switching
    const lineChars = [...line.text];
    // Find which character index in the full plain text this line starts at
    const lineStartInFull = plainText.indexOf(line.text);
    const lineCharColors =
      lineStartInFull >= 0
        ? charColors.slice(lineStartInFull, lineStartInFull + lineChars.length)
        : lineChars.map(() => primaryColor);

    drawTextColored(ctx, line.text, lineCharColors, x, y, primaryColor, "fill");

    y += lineHeight;
  }

  return canvas.toBuffer("image/png");
}

/**
 * Save a rendered block image to a file path. Creates parent dirs as needed.
 */
export async function renderBlockImageToFile(
  options: RenderBlockOptions,
  outputPath: string,
): Promise<void> {
  const buf = await renderBlockImage(options);
  await fs.promises.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.promises.writeFile(outputPath, buf);
}
